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
  -- Desgloses por día: por anuncio (clave = ad_id), por edad y sexo
  -- (clave = "25-34|female") y por ubicación (clave = "instagram|reels").
  CREATE TABLE IF NOT EXISTS meta_ads_desglose (
    negocio_id TEXT NOT NULL,
    tipo TEXT NOT NULL,              -- anuncio | edad_sexo | ubicacion
    clave TEXT NOT NULL,
    fecha TEXT NOT NULL,
    gasto REAL,
    impresiones INTEGER,
    clics INTEGER,
    resultados REAL,
    valor_compras REAL,
    PRIMARY KEY (negocio_id, tipo, clave, fecha)
  );
  CREATE TABLE IF NOT EXISTS meta_anuncios (
    negocio_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    nombre TEXT,
    campana TEXT,
    miniatura TEXT,
    estado TEXT,
    PRIMARY KEY (negocio_id, ad_id)
  );
  -- Estado, objetivo y presupuesto de cada campaña (para saber si el dueño
  -- pausó una campaña o movió presupuesto; ver aprendizaje-ads.js).
  CREATE TABLE IF NOT EXISTS meta_campanas (
    negocio_id TEXT NOT NULL,
    campana_id TEXT NOT NULL,
    nombre TEXT,
    estado TEXT,
    objetivo TEXT,
    presupuesto REAL,                -- diario o total, en la unidad que entrega Meta
    PRIMARY KEY (negocio_id, campana_id)
  );
`);
// De cada anuncio también: su campaña, cuándo se creó, el texto y si es
// video o imagen (lo que la IA aprende de los anuncios que mejor funcionan).
for (const [col, tipo] of [['campana_id', 'TEXT'], ['creado_el', 'TEXT'], ['texto', 'TEXT'], ['formato', 'TEXT']]) {
  if (!db.prepare('PRAGMA table_info(meta_anuncios)').all().some((c) => c.name === col)) db.exec(`ALTER TABLE meta_anuncios ADD COLUMN ${col} ${tipo}`);
}
store.registrarLimpieza((negocioId) => {
  for (const tabla of ['meta_ads_diario', 'meta_ads_desglose', 'meta_anuncios', 'meta_campanas']) {
    db.prepare(`DELETE FROM ${tabla} WHERE negocio_id = ?`).run(negocioId);
  }
});

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
  const qs = new URLSearchParams(Object.assign({}, params, accessToken ? { access_token: accessToken } : {}));
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

// --- "Conectar con Facebook" (OAuth) ---
// El dueño inicia sesión en Facebook y acepta los permisos; Meta vuelve a
// /api/meta/callback con un código que se canjea por un token de usuario y
// luego por uno de ~60 días. Así nadie tiene que pegar tokens.
// Con META_LOGIN_CONFIG_ID (Facebook Login para empresas, apps de tipo
// Empresa) se manda esa configuración; si no, la lista de permisos.
const PERMISOS_LOGIN = ['ads_read', 'pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_manage_insights', 'business_management'];

function loginDisponible() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function urlLogin(redirectUri, state) {
  const qs = new URLSearchParams({ client_id: process.env.META_APP_ID, redirect_uri: redirectUri, state, response_type: 'code' });
  if (process.env.META_LOGIN_CONFIG_ID) {
    qs.set('config_id', process.env.META_LOGIN_CONFIG_ID);
    qs.set('override_default_response_type', 'true');
  } else {
    qs.set('scope', (process.env.META_LOGIN_PERMISOS || PERMISOS_LOGIN.join(',')).replace(/\s+/g, ''));
  }
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${qs}`;
}

// Código de la vuelta → { accessToken, venceEl } (largo si Meta lo entrega).
async function canjearCodigo(code, redirectUri) {
  const corto = await fbGet('/oauth/access_token', {
    client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: redirectUri, code,
  });
  if (!corto.access_token) throw new ErrorMeta('Meta no entregó un token', null);
  const largo = await tokenLargo(corto.access_token);
  const token = largo ? largo.accessToken : corto.access_token;
  const seg = largo ? largo.expiraEnSeg : Number(corto.expires_in) || null;
  return { accessToken: token, venceEl: seg ? new Date(Date.now() + seg * 1000).toISOString() : null };
}

// --- Meta Ads ---

// "Hacer este cambio en Meta": abre el Administrador de anuncios en la
// cuenta y, si se sabe, en la campaña o los anuncios del hallazgo. Rubrofy
// no cambia nada: el dueño lo hace en Meta. Los parámetros de selección no
// están documentados por Meta; si dejaran de funcionar, igual se abre la
// cuenta correcta en la vista indicada (y el panel dice qué buscar).
const ADS_MANAGER = 'https://adsmanager.facebook.com/adsmanager/manage';
function enlaceAdministrador(adAccountId, destino) {
  const act = String(adAccountId || '').replace(/^act_/, '').replace(/\D/g, '');
  const ids = (l) => (l || []).filter((x) => x != null && String(x) !== '').map((x) => encodeURIComponent(String(x))).join(',');
  const vista = destino.tipo === 'anuncios' ? 'ads' : destino.tipo === 'conjuntos' ? 'adsets' : 'campaigns';
  let url = `${ADS_MANAGER}/${vista}?act=${act}`;
  const campanas = ids(destino.tipo === 'campanas' ? destino.ids : destino.campanas);
  if (campanas) url += `&selected_campaign_ids=${campanas}`;
  if (destino.tipo === 'anuncios' && ids(destino.ids)) url += `&selected_ad_ids=${ids(destino.ids)}`;
  return url;
}

const sqlAds = {
  upsert: db.prepare(`INSERT INTO meta_ads_diario (negocio_id, campana_id, fecha, campana, objetivo, gasto, impresiones,
      clics, compras, leads, mensajes, valor_compras)
    VALUES (@negocio_id, @campana_id, @fecha, @campana, @objetivo, @gasto, @impresiones, @clics, @compras, @leads, @mensajes, @valor_compras)
    ON CONFLICT (negocio_id, campana_id, fecha) DO UPDATE SET campana = excluded.campana, objetivo = excluded.objetivo,
      gasto = excluded.gasto, impresiones = excluded.impresiones, clics = excluded.clics, compras = excluded.compras,
      leads = excluded.leads, mensajes = excluded.mensajes, valor_compras = excluded.valor_compras`),
  hayDatos: db.prepare('SELECT COUNT(*) AS n FROM meta_ads_diario WHERE negocio_id = ?'),
  upsertDesglose: db.prepare(`INSERT INTO meta_ads_desglose (negocio_id, tipo, clave, fecha, gasto, impresiones, clics, resultados, valor_compras)
    VALUES (@negocio_id, @tipo, @clave, @fecha, @gasto, @impresiones, @clics, @resultados, @valor_compras)
    ON CONFLICT (negocio_id, tipo, clave, fecha) DO UPDATE SET gasto = excluded.gasto, impresiones = excluded.impresiones,
      clics = excluded.clics, resultados = excluded.resultados, valor_compras = excluded.valor_compras`),
  hayDesglose: db.prepare('SELECT COUNT(*) AS n FROM meta_ads_desglose WHERE negocio_id = ?'),
  upsertAnuncio: db.prepare(`INSERT INTO meta_anuncios (negocio_id, ad_id, nombre, campana, miniatura, estado, campana_id, creado_el, texto, formato)
    VALUES (@negocio_id, @ad_id, @nombre, @campana, @miniatura, @estado, @campana_id, @creado_el, @texto, @formato)
    ON CONFLICT (negocio_id, ad_id) DO UPDATE SET nombre = COALESCE(excluded.nombre, nombre), campana = COALESCE(excluded.campana, campana),
      miniatura = COALESCE(excluded.miniatura, miniatura), estado = COALESCE(excluded.estado, estado),
      campana_id = COALESCE(excluded.campana_id, campana_id), creado_el = COALESCE(excluded.creado_el, creado_el),
      texto = COALESCE(excluded.texto, texto), formato = COALESCE(excluded.formato, formato)`),
  upsertCampana: db.prepare(`INSERT INTO meta_campanas (negocio_id, campana_id, nombre, estado, objetivo, presupuesto)
    VALUES (@negocio_id, @campana_id, @nombre, @estado, @objetivo, @presupuesto)
    ON CONFLICT (negocio_id, campana_id) DO UPDATE SET nombre = excluded.nombre, estado = excluded.estado,
      objetivo = excluded.objetivo, presupuesto = excluded.presupuesto`),
};

// Video o imagen, según lo que Meta dice del creativo.
function formatoCreativo(c) {
  if (!c) return null;
  if (c.video_id || c.object_type === 'VIDEO') return 'video';
  if (c.image_url || c.thumbnail_url || c.object_type === 'PHOTO' || c.object_type === 'SHARE') return 'imagen';
  return null;
}
const numeroONull = (v) => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));

const resultadosDe = (f) => sumarAcciones(f.actions, ACCIONES.compras) + sumarAcciones(f.actions, ACCIONES.leads)
  + sumarAcciones(f.actions, ACCIONES.mensajes);

// Los desgloses usan el mismo permiso (ads_read) y se piden aparte: si uno
// falla (por ejemplo, Meta no entrega edad y sexo para cierta cuenta), el
// resumen por campaña igual queda al día.
const DESGLOSES = [
  { tipo: 'anuncio', params: { level: 'ad', fields: 'ad_id,ad_name,campaign_name,spend,impressions,clicks,actions,action_values' }, clave: (f) => String(f.ad_id) },
  { tipo: 'edad_sexo', params: { level: 'account', breakdowns: 'age,gender', fields: 'spend,impressions,clicks,actions,action_values' }, clave: (f) => `${f.age}|${f.gender}` },
  { tipo: 'ubicacion', params: { level: 'account', breakdowns: 'publisher_platform,platform_position', fields: 'spend,impressions,clicks,actions,action_values' },
    clave: (f) => `${f.publisher_platform}|${f.platform_position}` },
];

async function sincronizarDesgloses(negocioId, meta, hoy) {
  const dias = sqlAds.hayDesglose.get(negocioId).n ? 3 : 30;
  const rango = JSON.stringify({ since: analitica.sumarDias(hoy, -dias), until: hoy });
  const nombres = new Map();
  for (const d of DESGLOSES) {
    let filas;
    try {
      filas = await todasLasPaginas(`/${meta.adAccountId}/insights`, Object.assign({ time_increment: '1', time_range: rango, limit: '500' }, d.params), meta.accessToken);
    } catch (err) {
      if (err.tipo === 'token') throw err;
      continue;
    }
    store.transaccion(() => {
      for (const f of filas) {
        sqlAds.upsertDesglose.run({
          negocio_id: negocioId, tipo: d.tipo, clave: d.clave(f), fecha: f.date_start,
          gasto: Number(f.spend) || 0, impresiones: Number(f.impressions) || 0, clics: Number(f.clicks) || 0,
          resultados: resultadosDe(f), valor_compras: sumarAcciones(f.action_values, ACCIONES.compras),
        });
        if (d.tipo === 'anuncio') nombres.set(String(f.ad_id), { nombre: f.ad_name, campana: f.campaign_name });
      }
    });
  }
  // Anuncios: miniatura (las URL de Meta vencen, por eso se refrescan en cada
  // sincronización), estado, campaña, fecha de creación, texto y formato.
  try {
    const ads = await todasLasPaginas(`/${meta.adAccountId}/ads`, {
      fields: 'id,name,effective_status,campaign_id,created_time,creative{thumbnail_url,image_url,body,object_type,video_id}', limit: '100',
    }, meta.accessToken, 5);
    for (const a of ads) {
      const n = nombres.get(String(a.id)) || {};
      const c = a.creative || {};
      sqlAds.upsertAnuncio.run({
        negocio_id: negocioId, ad_id: String(a.id), nombre: a.name || n.nombre || null, campana: n.campana || null,
        miniatura: c.thumbnail_url || c.image_url || null, estado: a.effective_status || null,
        campana_id: a.campaign_id ? String(a.campaign_id) : null, creado_el: a.created_time ? new Date(a.created_time).toISOString() : null,
        texto: typeof c.body === 'string' && c.body.trim() ? c.body.trim().slice(0, 300) : null, formato: formatoCreativo(c),
      });
      nombres.delete(String(a.id));
    }
  } catch (err) {
    if (err.tipo === 'token') throw err;
  }
  for (const [id, n] of nombres) {
    sqlAds.upsertAnuncio.run({ negocio_id: negocioId, ad_id: id, nombre: n.nombre || null, campana: n.campana || null, miniatura: null, estado: null,
      campana_id: null, creado_el: null, texto: null, formato: null });
  }
  // Campañas: estado, objetivo y presupuesto (una llamada).
  try {
    const campanas = await todasLasPaginas(`/${meta.adAccountId}/campaigns`, { fields: 'id,name,effective_status,objective,daily_budget,lifetime_budget', limit: '100' }, meta.accessToken, 5);
    store.transaccion(() => {
      for (const c of campanas) {
        sqlAds.upsertCampana.run({
          negocio_id: negocioId, campana_id: String(c.id), nombre: c.name || null, estado: c.effective_status || null, objetivo: c.objective || null,
          presupuesto: numeroONull(c.daily_budget) || numeroONull(c.lifetime_budget),
        });
      }
    });
  } catch (err) {
    if (err.tipo === 'token') throw err;
  }
}

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
    await sincronizarDesgloses(negocioId, meta, hoy);
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
      : (tipo === 'token' ? 'El token de Meta venció o fue revocado. Pega uno nuevo en Conexiones y ajustes.' : err.message);
    analitica.registrarSync(negocioId, 'meta_ads', tipo, detalle);
    return { ok: false, error: detalle, tipo };
  }
}

const sqlCuenta = {
  campanas: db.prepare('SELECT * FROM meta_campanas WHERE negocio_id = ?'),
  anuncios: db.prepare('SELECT * FROM meta_anuncios WHERE negocio_id = ?'),
  gastoCampanas: db.prepare('SELECT campana_id AS id, SUM(gasto) AS gasto FROM meta_ads_diario WHERE negocio_id = ? AND fecha BETWEEN ? AND ? GROUP BY campana_id'),
  gastoAnuncios: db.prepare("SELECT clave AS id, SUM(gasto) AS gasto FROM meta_ads_desglose WHERE negocio_id = ? AND tipo = 'anuncio' AND fecha BETWEEN ? AND ? GROUP BY clave"),
};

// Cómo está la cuenta ahora (campañas y anuncios), para saber qué cambió.
function estadoCuenta(negocioId) {
  return {
    campanas: new Map(sqlCuenta.campanas.all(negocioId).map((c) => [c.campana_id, { estado: c.estado, objetivo: c.objetivo, presupuesto: c.presupuesto }])),
    anuncios: sqlCuenta.anuncios.all(negocioId).map((a) => ({ id: a.ad_id, nombre: a.nombre, campanaId: a.campana_id, estado: a.estado, creadoEl: a.creado_el, texto: a.texto, formato: a.formato })),
  };
}

// Gasto por campaña o por anuncio en un rango: Map id → gasto.
function gastoPor(negocioId, tipo, desde, hasta) {
  const sql = tipo === 'anuncios' ? sqlCuenta.gastoAnuncios : sqlCuenta.gastoCampanas;
  return new Map(sql.all(negocioId, desde, hasta).map((f) => [f.id, f.gasto || 0]));
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

function primeraFechaAds(negocioId) {
  return db.prepare('SELECT MIN(fecha) AS f FROM meta_ads_diario WHERE negocio_id = ?').get(negocioId).f;
}

function resumenAds(negocioId, desde, hasta) {
  const estados = new Map(sqlCuenta.campanas.all(negocioId).map((c) => [c.campana_id, c.estado]));
  const campanas = sqlResumen.campanas.all(negocioId, desde, hasta).map((c) => Object.assign({
    id: c.campana_id, nombre: c.campana, objetivo: c.objetivo, estado: estados.get(c.campana_id) || null,
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

const sqlDesglose = {
  porClave: db.prepare(`SELECT clave, SUM(gasto) AS gasto, SUM(impresiones) AS impresiones, SUM(clics) AS clics,
      SUM(resultados) AS resultados, SUM(valor_compras) AS valor_compras
    FROM meta_ads_desglose WHERE negocio_id = ? AND tipo = ? AND fecha BETWEEN ? AND ? GROUP BY clave ORDER BY gasto DESC`),
  anuncios: db.prepare('SELECT * FROM meta_anuncios WHERE negocio_id = ?'),
};

const EDADES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const SEXOS = { female: 'Mujeres', male: 'Hombres', unknown: 'Sin dato' };
const PLATAFORMAS = { instagram: 'Instagram', facebook: 'Facebook', messenger: 'Messenger', audience_network: 'Audience Network', threads: 'Threads' };
const POSICIONES = {
  feed: 'Feed', story: 'Historias', instagram_stories: 'Historias', reels: 'Reels', instagram_reels: 'Reels', facebook_reels: 'Reels',
  instagram_explore: 'Explorar', instagram_explore_grid_home: 'Explorar', marketplace: 'Marketplace', video_feeds: 'Videos',
  right_hand_column: 'Columna derecha', search: 'Búsqueda', instream_video: 'Video in-stream', an_classic: 'Apps y sitios',
  messenger_inbox: 'Bandeja de Messenger', profile_feed: 'Perfil', facebook_stories: 'Historias', instagram_profile_feed: 'Perfil',
};

function conCosto(f) {
  return Object.assign(f, {
    ctr: f.impresiones ? f.clics / f.impresiones : null,
    costoPorResultado: f.resultados ? f.gasto / f.resultados : null,
    cpm: f.impresiones ? (f.gasto / f.impresiones) * 1000 : null,
  });
}

// Anuncios, edad y sexo, y ubicaciones del período, listos para el panel.
function desglosesAds(negocioId, desde, hasta) {
  const leer = (tipo) => sqlDesglose.porClave.all(negocioId, tipo, desde, hasta).map((f) => Object.assign({}, f));
  const fichas = new Map(sqlDesglose.anuncios.all(negocioId).map((a) => [a.ad_id, a]));
  const anuncios = leer('anuncio').filter((f) => f.gasto > 0 || f.resultados > 0).map((f) => {
    const a = fichas.get(f.clave) || {};
    return conCosto({ id: f.clave, nombre: a.nombre || f.clave, campana: a.campana || null, miniatura: a.miniatura || null, estado: a.estado || null, formato: a.formato || null,
      gasto: f.gasto, impresiones: f.impresiones, clics: f.clics, resultados: f.resultados, valorCompras: f.valor_compras });
  });
  const edadSexo = leer('edad_sexo').map((f) => {
    const [edad, sexo] = f.clave.split('|');
    return conCosto({ edad, sexo, sexoNombre: SEXOS[sexo] || sexo, gasto: f.gasto, impresiones: f.impresiones, clics: f.clics, resultados: f.resultados });
  }).sort((a, b) => EDADES.indexOf(a.edad) - EDADES.indexOf(b.edad) || a.sexo.localeCompare(b.sexo));
  const ubicaciones = leer('ubicacion').map((f) => {
    const [plataforma, posicion] = f.clave.split('|');
    return conCosto({ plataforma, posicion, nombre: `${PLATAFORMAS[plataforma] || plataforma} · ${POSICIONES[posicion] || posicion}`,
      gasto: f.gasto, impresiones: f.impresiones, clics: f.clics, resultados: f.resultados });
  }).filter((f) => f.gasto > 0);
  return { anuncios, edadSexo, ubicaciones, edades: EDADES };
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
  fbGet, todasLasPaginas, opcionesDeCuenta, tokenLargo, loginDisponible, enlaceAdministrador, urlLogin, canjearCodigo, PERMISOS_LOGIN, sincronizarAds, resumenAds, primeraFechaAds, desglosesAds, publicoMeta, ErrorMeta, sumarAcciones,
  estadoCuenta, gastoPor, POSICIONES,
};
