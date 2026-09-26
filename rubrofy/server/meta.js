// Conexión con Meta del lado de Facebook (graph.facebook.com), distinta de
// la de Instagram que usa el publicador: la usan Meta Ads (permiso
// ads_read) y el seguimiento de competidores (Business Discovery, que solo
// existe en la API de Instagram con inicio de sesión de Facebook).
//
// Meta Ads es de SOLO LECTURA: se sincroniza a diario el gasto y los
// resultados por campaña y por día; Rubrofy no crea ni edita campañas.

const store = require('./store');
const analitica = require('./analitica');

const VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
const FB = `https://graph.facebook.com/${VERSION}`;
const db = store.db;

db.exec(`
  CREATE TABLE IF NOT EXISTS meta_ads_diario (
    negocio_id TEXT NOT NULL,
    campana_id TEXT NOT NULL,
    fecha TEXT NOT NULL,             -- AAAA-MM-DD en la zona de la cuenta publicitaria
    campana TEXT,
    objetivo TEXT,
    gasto REAL,
    impresiones INTEGER,
    clics INTEGER,
    compras REAL,
    leads REAL,
    mensajes REAL,
    valor_compras REAL,
    PRIMARY KEY (negocio_id, campana_id, fecha)
  );
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM meta_ads_diario WHERE negocio_id = ?').run(negocioId));

// Qué cuenta como "resultado" para una pyme: compras, formularios (leads) y
// conversaciones iniciadas (WhatsApp / Messenger / Instagram Direct).
const ACCIONES = {
  compras: ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'onsite_web_purchase'],
  leads: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'],
  mensajes: ['onsite_conversion.messaging_conversation_started_7d'],
};

function sumarAcciones(lista, tipos) {
  // Meta repite la misma conversión con varios nombres (purchase y
  // omni_purchase, por ejemplo): se toma el mayor, no la suma.
  let mejor = 0;
  for (const a of lista || []) {
    if (tipos.includes(a.action_type)) mejor = Math.max(mejor, Number(a.value) || 0);
  }
  return mejor;
}

class ErrorMeta extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.codigo = codigo;
    this.tipo = analitica.tipoErrorAnalitica(codigo);
  }
}

async function fbGet(ruta, params, accessToken) {
  const qs = new URLSearchParams(Object.assign({}, params, { access_token: accessToken }));
  const url = ruta.startsWith('http') ? ruta : `${FB}${ruta}?${qs}`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new ErrorMeta('Error de red al conectar con Meta: ' + err.message, null);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw new ErrorMeta(e.message || `Meta respondió ${res.status}`, e.code || null);
  }
  return data;
}

// Todas las páginas de un listado de Graph (sigue paging.next).
async function todasLasPaginas(ruta, params, accessToken, maxPaginas = 20) {
  const filas = [];
  let data = await fbGet(ruta, params, accessToken);
  for (let i = 0; i < maxPaginas; i++) {
    filas.push(...(data.data || []));
    if (!data.paging || !data.paging.next) break;
    data = await fbGet(data.paging.next, {}, accessToken);
  }
  return filas;
}

// Al conectar: con el token, qué cuentas publicitarias y qué cuentas de
// Instagram (vinculadas a páginas de Facebook) puede elegir el negocio.
async function opcionesDeCuenta(accessToken) {
  const cuentas = await todasLasPaginas('/me/adaccounts', { fields: 'account_id,name,currency,timezone_name,account_status', limit: '100' }, accessToken)
    .catch((err) => { if (err.tipo === 'token') throw err; return []; });
  const paginas = await todasLasPaginas('/me/accounts', { fields: 'name,instagram_business_account{id,username}', limit: '100' }, accessToken)
    .catch((err) => { if (err.tipo === 'token') throw err; return []; });
  return {
    cuentasPublicitarias: cuentas.map((c) => ({ id: 'act_' + c.account_id, nombre: c.name, moneda: c.currency, zona: c.timezone_name, activa: c.account_status === 1 })),
    cuentasInstagram: paginas.filter((p) => p.instagram_business_account).map((p) => ({
      id: p.instagram_business_account.id, username: p.instagram_business_account.username, pagina: p.name,
    })),
  };
}

// Token de larga duración (~60 días) a partir de uno corto, si el servidor
// tiene los datos de la app de Meta. Los tokens de "usuario del sistema"
// de Business Manager no vencen y no necesitan esto.
async function tokenLargo(accessToken) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) return null;
  try {
    const data = await fbGet('/oauth/access_token', {
      grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET, fb_exchange_token: accessToken,
    }, accessToken);
    return data.access_token ? { accessToken: data.access_token, expiraEnSeg: Number(data.expires_in) || null } : null;
  } catch (err) {
    return null;
  }
}

// --- Meta Ads ---

const sqlAds = {
  upsert: db.prepare(`INSERT INTO meta_ads_diario (negocio_id, campana_id, fecha, campana, objetivo, gasto, impresiones,
      clics, compras, leads, mensajes, valor_compras)
    VALUES (@negocio_id, @campana_id, @fecha, @campana, @objetivo, @gasto, @impresiones, @clics, @compras, @leads, @mensajes, @valor_compras)
    ON CONFLICT (negocio_id, campana_id, fecha) DO UPDATE SET campana = excluded.campana, objetivo = excluded.objetivo,
      gasto = excluded.gasto, impresiones = excluded.impresiones, clics = excluded.clics, compras = excluded.compras,
      leads = excluded.leads, mensajes = excluded.mensajes, valor_compras = excluded.valor_compras`),
  hayDatos: db.prepare('SELECT COUNT(*) AS n FROM meta_ads_diario WHERE negocio_id = ?'),
};

// Primera vez: 30 días. Después: los últimos 3 (Meta sigue atribuyendo
// conversiones a días anteriores). Consultas por campaña y por día, en
// rangos cortos para no chocar con el límite de tiempo de Meta.
async function sincronizarAds(negocioId) {
  const negocio = store.getNegocio(negocioId);
  const meta = negocio && negocio.meta;
  if (!meta || !meta.accessToken || !meta.adAccountId) return { ok: false, error: 'Meta Ads no está conectado' };
  try {
    const hoy = analitica.fechaLocal(new Date());
    const dias = sqlAds.hayDatos.get(negocioId).n ? 3 : 30;
    const filas = await todasLasPaginas(`/${meta.adAccountId}/insights`, {
      level: 'campaign',
      fields: 'campaign_id,campaign_name,objective,spend,impressions,clicks,actions,action_values',
      time_increment: '1',
      time_range: JSON.stringify({ since: analitica.sumarDias(hoy, -dias), until: hoy }),
      limit: '500',
    }, meta.accessToken);
    store.transaccion(() => {
      for (const f of filas) {
        sqlAds.upsert.run({
          negocio_id: negocioId,
          campana_id: String(f.campaign_id),
          fecha: f.date_start,
          campana: f.campaign_name || null,
          objetivo: f.objective || null,
          gasto: Number(f.spend) || 0,
          impresiones: Number(f.impressions) || 0,
          clics: Number(f.clicks) || 0,
          compras: sumarAcciones(f.actions, ACCIONES.compras),
          leads: sumarAcciones(f.actions, ACCIONES.leads),
          mensajes: sumarAcciones(f.actions, ACCIONES.mensajes),
          valor_compras: sumarAcciones(f.action_values, ACCIONES.compras),
        });
      }
    });
    analitica.registrarSync(negocioId, 'meta_ads', null, null);
    return { ok: true, filas: filas.length };
  } catch (err) {
    const tipo = err.tipo || 'otro';
    if (tipo === 'token') {
      const n = store.getNegocio(negocioId);
      if (n && n.meta) {
        n.meta.estado = 'reconectar';
        store.saveNegocio(n);
      }
    }
    const detalle = tipo === 'permiso'
      ? 'El token de Meta no tiene permiso para leer la cuenta publicitaria (ads_read) o no tienes acceso a ella.'
      : (tipo === 'token' ? 'El token de Meta venció o fue revocado. Pega uno nuevo en Configuración.' : err.message);
    analitica.registrarSync(negocioId, 'meta_ads', tipo, detalle);
    return { ok: false, error: detalle, tipo };
  }
}

const sqlResumen = {
  campanas: db.prepare(`SELECT campana_id, MAX(campana) AS campana, MAX(objetivo) AS objetivo, SUM(gasto) AS gasto,
      SUM(impresiones) AS impresiones, SUM(clics) AS clics, SUM(compras) AS compras, SUM(leads) AS leads,
      SUM(mensajes) AS mensajes, SUM(valor_compras) AS valor_compras
    FROM meta_ads_diario WHERE negocio_id = ? AND fecha BETWEEN ? AND ? GROUP BY campana_id ORDER BY gasto DESC`),
  serie: db.prepare(`SELECT fecha, SUM(gasto) AS gasto, SUM(clics) AS clics,
      SUM(compras) + SUM(leads) + SUM(mensajes) AS resultados
    FROM meta_ads_diario WHERE negocio_id = ? AND fecha BETWEEN ? AND ? GROUP BY fecha ORDER BY fecha`),
};

function metricasDe(t) {
  const resultados = (t.compras || 0) + (t.leads || 0) + (t.mensajes || 0);
  return {
    gasto: t.gasto || 0,
    impresiones: t.impresiones || 0,
    clics: t.clics || 0,
    ctr: t.impresiones ? (t.clics / t.impresiones) : null,
    cpc: t.clics ? t.gasto / t.clics : null,
    cpm: t.impresiones ? (t.gasto / t.impresiones) * 1000 : null,
    compras: t.compras || 0,
    leads: t.leads || 0,
    mensajes: t.mensajes || 0,
    resultados,
    costoPorResultado: resultados ? t.gasto / resultados : null,
    valorCompras: t.valor_compras || 0,
    roas: t.gasto && t.valor_compras ? t.valor_compras / t.gasto : null,
  };
}

function resumenAds(negocioId, desde, hasta) {
  const campanas = sqlResumen.campanas.all(negocioId, desde, hasta).map((c) => Object.assign({
    id: c.campana_id, nombre: c.campana, objetivo: c.objetivo,
  }, metricasDe(c)));
  const total = campanas.reduce((t, c) => {
    for (const k of ['gasto', 'impresiones', 'clics', 'compras', 'leads', 'mensajes']) t[k] = (t[k] || 0) + c[k];
    t.valor_compras = (t.valor_compras || 0) + c.valorCompras;
    return t;
  }, {});
  return {
    desde, hasta,
    total: metricasDe(total),
    campanas,
    serie: sqlResumen.serie.all(negocioId, desde, hasta).map((f) => Object.assign({}, f)),
  };
}

function publicoMeta(meta) {
  if (!meta || !meta.accessToken) return null;
  return {
    adAccountId: meta.adAccountId || null, cuentaNombre: meta.cuentaNombre || null, moneda: meta.moneda || null,
    igUserId: meta.igUserId || null, igUsername: meta.igUsername || null,
    estado: meta.estado || 'ok', venceEl: meta.venceEl || null, conectadoEl: meta.conectadoEl,
  };
}

module.exports = {
  fbGet, todasLasPaginas, opcionesDeCuenta, tokenLargo, sincronizarAds, resumenAds, publicoMeta, ErrorMeta, sumarAcciones,
};
