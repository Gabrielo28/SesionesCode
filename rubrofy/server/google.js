// Google Ads de SOLO LECTURA: el negocio conecta su cuenta con "Iniciar
// sesión con Google" (OAuth, permiso adwords), elige la cuenta de Google Ads
// y Rubrofy sincroniza a diario inversión, clics y conversiones por campaña
// y por día. No crea ni modifica campañas.
//
// Desde septiembre de 2026 el acceso a la API se gestiona en Google Cloud y
// el developer token dejó de ser obligatorio; si el proyecto todavía usa
// uno, se envía (GOOGLE_ADS_DEVELOPER_TOKEN).

const crypto = require('crypto');
const store = require('./store');
const analitica = require('./analitica');

const VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v25';
const API = `https://googleads.googleapis.com/${VERSION}`;
const SCOPE = 'https://www.googleapis.com/auth/adwords';
const db = store.db;

db.exec(`
  CREATE TABLE IF NOT EXISTS google_ads_diario (
    negocio_id TEXT NOT NULL,
    campana_id TEXT NOT NULL,
    fecha TEXT NOT NULL,
    campana TEXT,
    tipo TEXT,                -- SEARCH, PERFORMANCE_MAX, DISPLAY...
    gasto REAL,
    impresiones INTEGER,
    clics INTEGER,
    conversiones REAL,
    valor REAL,
    PRIMARY KEY (negocio_id, campana_id, fecha)
  );
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM google_ads_diario WHERE negocio_id = ?').run(negocioId));

function configurado() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

class ErrorGoogle extends Error {
  constructor(mensaje, tipo) {
    super(mensaje);
    this.tipo = tipo || 'otro';
  }
}

// --- OAuth ---

function urlAutorizacion(redirectUri, state) {
  const qs = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code',
    scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${qs}`;
}

async function pedirToken(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.assign({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }, params)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // invalid_grant: el permiso fue revocado o el refresh token venció
    throw new ErrorGoogle(data.error_description || data.error || `Google respondió ${res.status}`, data.error === 'invalid_grant' ? 'token' : 'otro');
  }
  return data;
}

function canjearCodigo(code, redirectUri) {
  return pedirToken({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
}

async function accessToken(refreshToken) {
  return (await pedirToken({ refresh_token: refreshToken, grant_type: 'refresh_token' })).access_token;
}

// --- API de Google Ads (REST) ---

function cabeceras(token, loginCustomerId) {
  const h = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) h['developer-token'] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (loginCustomerId) h['login-customer-id'] = String(loginCustomerId);
  return h;
}

async function llamar(metodo, ruta, token, loginCustomerId, cuerpo) {
  let res;
  try {
    res = await fetch(`${API}${ruta}`, { method: metodo, headers: cabeceras(token, loginCustomerId), body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  } catch (err) {
    throw new ErrorGoogle('Error de red al conectar con Google Ads: ' + err.message, 'otro');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = Array.isArray(data) ? (data[0] && data[0].error) : data.error;
    const estado = e && e.status;
    const tipo = res.status === 401 || estado === 'UNAUTHENTICATED' ? 'token'
      : (res.status === 403 || estado === 'PERMISSION_DENIED' ? 'permiso' : 'otro');
    throw new ErrorGoogle((e && e.message) || `Google Ads respondió ${res.status}`, tipo);
  }
  return data;
}

// GAQL con searchStream: una sola llamada (1 operación de la cuota) sin
// importar cuántas filas devuelva.
async function consultar(token, customerId, query, loginCustomerId) {
  const lotes = await llamar('POST', `/customers/${customerId}/googleAds:searchStream`, token, loginCustomerId, { query });
  return (Array.isArray(lotes) ? lotes : [lotes]).flatMap((l) => l.results || []);
}

// Cuentas a las que el usuario que autorizó tiene acceso, con su nombre y
// moneda. Las administradoras (MCC) se muestran para elegir sus clientes.
async function cuentasAccesibles(refreshToken) {
  const token = await accessToken(refreshToken);
  const data = await llamar('GET', '/customers:listAccessibleCustomers', token);
  const cuentas = [];
  for (const recurso of (data.resourceNames || []).slice(0, 20)) {
    const id = recurso.split('/')[1];
    try {
      const filas = await consultar(token, id, 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer');
      const c = filas[0] && filas[0].customer;
      if (!c) continue;
      if (c.manager) {
        // Clientes de la cuenta administradora (primer nivel).
        const hijos = await consultar(token, id, 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.level FROM customer_client WHERE customer_client.level = 1').catch(() => []);
        for (const h of hijos) {
          const cc = h.customerClient;
          if (cc && !cc.manager) cuentas.push({ id: String(cc.id), nombre: cc.descriptiveName || String(cc.id), moneda: cc.currencyCode, loginCustomerId: id, via: c.descriptiveName });
        }
      } else {
        cuentas.push({ id: String(c.id), nombre: c.descriptiveName || String(c.id), moneda: c.currencyCode, loginCustomerId: null });
      }
    } catch (err) {
      if (err.tipo === 'token') throw err;
      // cuenta sin acceso de lectura: se omite
    }
  }
  return cuentas;
}

// --- sincronización ---

const sql = {
  upsert: db.prepare(`INSERT INTO google_ads_diario (negocio_id, campana_id, fecha, campana, tipo, gasto, impresiones, clics, conversiones, valor)
    VALUES (@negocio_id, @campana_id, @fecha, @campana, @tipo, @gasto, @impresiones, @clics, @conversiones, @valor)
    ON CONFLICT (negocio_id, campana_id, fecha) DO UPDATE SET campana = excluded.campana, tipo = excluded.tipo,
      gasto = excluded.gasto, impresiones = excluded.impresiones, clics = excluded.clics,
      conversiones = excluded.conversiones, valor = excluded.valor`),
  hayDatos: db.prepare('SELECT COUNT(*) AS n FROM google_ads_diario WHERE negocio_id = ?'),
  campanas: db.prepare(`SELECT campana_id, MAX(campana) AS campana, MAX(tipo) AS tipo, SUM(gasto) AS gasto,
      SUM(impresiones) AS impresiones, SUM(clics) AS clics, SUM(conversiones) AS conversiones, SUM(valor) AS valor
    FROM google_ads_diario WHERE negocio_id = ? AND fecha BETWEEN ? AND ? GROUP BY campana_id ORDER BY gasto DESC`),
  serie: db.prepare(`SELECT fecha, SUM(gasto) AS gasto, SUM(clics) AS clics, SUM(conversiones) AS resultados
    FROM google_ads_diario WHERE negocio_id = ? AND fecha BETWEEN ? AND ? GROUP BY fecha ORDER BY fecha`),
};

// Primera vez 30 días; después los últimos 7 (Google sigue atribuyendo
// conversiones a clics de días anteriores).
async function sincronizar(negocioId) {
  const negocio = store.getNegocio(negocioId);
  const g = negocio && negocio.google;
  if (!g || !g.refreshToken || !g.customerId) return { ok: false, error: 'Google Ads no está conectado' };
  try {
    const token = await accessToken(g.refreshToken);
    const hoy = analitica.fechaLocal(new Date());
    const dias = sql.hayDatos.get(negocioId).n ? 7 : 30;
    const filas = await consultar(token, g.customerId,
      'SELECT campaign.id, campaign.name, campaign.advertising_channel_type, segments.date, metrics.cost_micros, ' +
      'metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign ' +
      `WHERE segments.date BETWEEN '${analitica.sumarDias(hoy, -dias)}' AND '${hoy}'`, g.loginCustomerId);
    store.transaccion(() => {
      for (const f of filas) {
        const m = f.metrics || {};
        sql.upsert.run({
          negocio_id: negocioId,
          campana_id: String(f.campaign.id),
          fecha: f.segments.date,
          campana: f.campaign.name || null,
          tipo: f.campaign.advertisingChannelType || null,
          gasto: (Number(m.costMicros) || 0) / 1e6,
          impresiones: Number(m.impressions) || 0,
          clics: Number(m.clicks) || 0,
          conversiones: Number(m.conversions) || 0,
          valor: Number(m.conversionsValue) || 0,
        });
      }
    });
    analitica.registrarSync(negocioId, 'google_ads', null, null);
    return { ok: true, filas: filas.length };
  } catch (err) {
    const tipo = err.tipo || 'otro';
    if (tipo === 'token') {
      const n = store.getNegocio(negocioId);
      if (n && n.google) {
        n.google.estado = 'reconectar';
        store.saveNegocio(n);
      }
    }
    const detalle = tipo === 'token' ? 'Google revocó el permiso o venció. Vuelve a conectar Google Ads en Configuración.'
      : (tipo === 'permiso' ? 'Google Ads no permite leer esta cuenta con el acceso actual (revisa el acceso a la API del proyecto de Google Cloud o los permisos del usuario).' : err.message);
    analitica.registrarSync(negocioId, 'google_ads', tipo, detalle);
    return { ok: false, error: detalle, tipo };
  }
}

function metricasDe(t) {
  return {
    gasto: t.gasto || 0,
    impresiones: t.impresiones || 0,
    clics: t.clics || 0,
    ctr: t.impresiones ? t.clics / t.impresiones : null,
    cpc: t.clics ? t.gasto / t.clics : null,
    cpm: t.impresiones ? (t.gasto / t.impresiones) * 1000 : null,
    resultados: Math.round((t.conversiones || 0) * 100) / 100,
    costoPorResultado: t.conversiones ? t.gasto / t.conversiones : null,
    valorCompras: t.valor || 0,
    roas: t.gasto && t.valor ? t.valor / t.gasto : null,
  };
}

function resumen(negocioId, desde, hasta) {
  const campanas = sql.campanas.all(negocioId, desde, hasta).map((c) => Object.assign({ id: c.campana_id, nombre: c.campana, objetivo: c.tipo }, metricasDe(c)));
  const total = campanas.reduce((t, c) => {
    for (const k of ['gasto', 'impresiones', 'clics']) t[k] = (t[k] || 0) + c[k];
    t.conversiones = (t.conversiones || 0) + c.resultados;
    t.valor = (t.valor || 0) + c.valorCompras;
    return t;
  }, {});
  return {
    desde, hasta, total: metricasDe(total), campanas,
    serie: sql.serie.all(negocioId, desde, hasta).map((f) => Object.assign({}, f)),
  };
}

function publico(g) {
  if (!g || !g.refreshToken) return null;
  return {
    customerId: g.customerId || null, nombre: g.nombre || null, moneda: g.moneda || null,
    estado: g.estado || 'ok', opciones: g.customerId ? null : (g.opciones || []), conectadoEl: g.conectadoEl,
  };
}

function nuevoEstadoOAuth() {
  return crypto.randomBytes(9).toString('hex');
}

module.exports = {
  configurado, urlAutorizacion, canjearCodigo, cuentasAccesibles, sincronizar, resumen, publico, nuevoEstadoOAuth, SCOPE,
};
