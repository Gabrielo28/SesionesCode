// Analítica de Instagram: sincroniza a diario las métricas de la cuenta y de
// cada post (Instagram API with Instagram Login, permiso
// instagram_business_manage_insights) y las guarda en SQLite para mostrar
// Resultados, armar el informe mensual y enseñarle a la IA qué funciona.
//
// Presupuesto de llamadas: Meta permite ~200 por hora por cuenta. Una
// sincronización diaria usa ~3 + 1 por cada post de los últimos 30 días; la
// primera trae 30 días de historia de la cuenta (30 llamadas más).

const store = require('./store');
const { GRAPH_BASE } = require('./instagram');
const programacion = require('./programacion');

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS ig_cuenta_diaria (
    negocio_id TEXT NOT NULL,
    fecha TEXT NOT NULL,              -- AAAA-MM-DD en la zona del negocio
    seguidores INTEGER,
    alcance INTEGER,
    vistas INTEGER,
    interacciones INTEGER,
    cuentas_interactuaron INTEGER,
    me_gusta INTEGER,
    comentarios INTEGER,
    guardados INTEGER,
    compartidos INTEGER,
    clics_enlace INTEGER,
    PRIMARY KEY (negocio_id, fecha)
  );
  CREATE TABLE IF NOT EXISTS ig_posts (
    negocio_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    publicado_el TEXT NOT NULL,       -- ISO UTC
    tipo TEXT,                        -- FEED | REELS | ...
    formato TEXT,                     -- IMAGE | CAROUSEL_ALBUM | VIDEO
    permalink TEXT,
    caption TEXT,
    alcance INTEGER,
    vistas INTEGER,
    me_gusta INTEGER,
    comentarios INTEGER,
    guardados INTEGER,
    compartidos INTEGER,
    interacciones INTEGER,
    item_id TEXT,                     -- pieza de Rubrofy, si salió de acá
    enfoque_id TEXT,
    actualizado_el TEXT,
    PRIMARY KEY (negocio_id, media_id)
  );
  CREATE INDEX IF NOT EXISTS ig_posts_fecha ON ig_posts (negocio_id, publicado_el);
  CREATE TABLE IF NOT EXISTS sync_estado (
    negocio_id TEXT NOT NULL,
    fuente TEXT NOT NULL,             -- instagram | meta_ads | google_ads | competencia
    ultima_ok TEXT,
    ultimo_intento TEXT,
    error TEXT,                       -- null | token | permiso | otro
    detalle TEXT,
    PRIMARY KEY (negocio_id, fuente)
  );
`);
store.registrarLimpieza((negocioId) => {
  for (const tabla of ['ig_cuenta_diaria', 'ig_posts', 'sync_estado']) {
    db.prepare(`DELETE FROM ${tabla} WHERE negocio_id = ?`).run(negocioId);
  }
});

// --- estado de sincronización (compartido con ads y competencia) ---

const sqlEstado = {
  get: db.prepare('SELECT * FROM sync_estado WHERE negocio_id = ? AND fuente = ?'),
  set: db.prepare(`INSERT INTO sync_estado (negocio_id, fuente, ultima_ok, ultimo_intento, error, detalle)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (negocio_id, fuente) DO UPDATE SET ultima_ok = excluded.ultima_ok,
      ultimo_intento = excluded.ultimo_intento, error = excluded.error, detalle = excluded.detalle`),
};

function estadoSync(negocioId, fuente) {
  return sqlEstado.get.get(negocioId, fuente) || null;
}

function registrarSync(negocioId, fuente, error, detalle) {
  const previo = estadoSync(negocioId, fuente) || {};
  const ahora = new Date().toISOString();
  sqlEstado.set.run(negocioId, fuente, error ? previo.ultima_ok || null : ahora, ahora, error || null, detalle || null);
}

// --- Graph API ---

// Errores que importan acá: token inválido (lo maneja el publicador, que
// pide reconectar) y falta de permiso de métricas (el token sirve para
// publicar pero no se autorizó instagram_business_manage_insights).
function tipoErrorAnalitica(codigo) {
  if (codigo === 190 || codigo === 102) return 'token';
  if (codigo === 10 || (codigo >= 200 && codigo < 300)) return 'permiso';
  if (codigo === 100) return 'parametro';
  return 'otro';
}

class ErrorGraph extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.codigo = codigo;
    this.tipo = tipoErrorAnalitica(codigo);
  }
}

async function graphGet(ruta, params, accessToken) {
  const qs = new URLSearchParams(Object.assign({}, params, { access_token: accessToken }));
  let res;
  try {
    res = await fetch(`${GRAPH_BASE}${ruta}?${qs}`);
  } catch (err) {
    throw new ErrorGraph('Error de red al conectar con Instagram: ' + err.message, null);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = data.error || {};
    throw new ErrorGraph(e.message || `Instagram respondió ${res.status}`, e.code || null);
  }
  return data;
}

// Valor de una métrica en la respuesta de /insights (total_value o values[0]).
function valorMetrica(data, nombre) {
  const m = (data.data || []).find((x) => x.name === nombre);
  if (!m) return null;
  if (m.total_value && m.total_value.value != null) return Number(m.total_value.value);
  if (m.values && m.values.length) return Number(m.values[m.values.length - 1].value);
  return null;
}

// --- fechas en la zona del negocio ---

function fechaLocal(date) {
  const p = programacion.partesEnZona(date);
  return `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
}

function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  const r = new Date(Date.UTC(a, m - 1, d + dias));
  return r.toISOString().slice(0, 10);
}

// Inicio del día `fecha` en la zona, en segundos Unix (para since/until).
function inicioDelDia(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return Math.floor(Date.parse(programacion.isoDesdeZona(a, m, d, 0, 0)) / 1000);
}

// --- sincronización ---

const sqlCuenta = {
  upsert: db.prepare(`INSERT INTO ig_cuenta_diaria (negocio_id, fecha, seguidores, alcance, vistas, interacciones,
      cuentas_interactuaron, me_gusta, comentarios, guardados, compartidos, clics_enlace)
    VALUES (@negocio_id, @fecha, @seguidores, @alcance, @vistas, @interacciones, @cuentas_interactuaron,
      @me_gusta, @comentarios, @guardados, @compartidos, @clics_enlace)
    ON CONFLICT (negocio_id, fecha) DO UPDATE SET
      seguidores = COALESCE(excluded.seguidores, seguidores),
      alcance = COALESCE(excluded.alcance, alcance),
      vistas = COALESCE(excluded.vistas, vistas),
      interacciones = COALESCE(excluded.interacciones, interacciones),
      cuentas_interactuaron = COALESCE(excluded.cuentas_interactuaron, cuentas_interactuaron),
      me_gusta = COALESCE(excluded.me_gusta, me_gusta),
      comentarios = COALESCE(excluded.comentarios, comentarios),
      guardados = COALESCE(excluded.guardados, guardados),
      compartidos = COALESCE(excluded.compartidos, compartidos),
      clics_enlace = COALESCE(excluded.clics_enlace, clics_enlace)`),
  diasConMetricas: db.prepare(`SELECT fecha FROM ig_cuenta_diaria
    WHERE negocio_id = ? AND alcance IS NOT NULL AND fecha >= ?`),
};

const sqlPosts = {
  upsert: db.prepare(`INSERT INTO ig_posts (negocio_id, media_id, publicado_el, tipo, formato, permalink, caption,
      alcance, vistas, me_gusta, comentarios, guardados, compartidos, interacciones, item_id, enfoque_id, actualizado_el)
    VALUES (@negocio_id, @media_id, @publicado_el, @tipo, @formato, @permalink, @caption, @alcance, @vistas,
      @me_gusta, @comentarios, @guardados, @compartidos, @interacciones, @item_id, @enfoque_id, @actualizado_el)
    ON CONFLICT (negocio_id, media_id) DO UPDATE SET
      tipo = excluded.tipo, formato = excluded.formato, permalink = excluded.permalink, caption = excluded.caption,
      alcance = COALESCE(excluded.alcance, alcance), vistas = COALESCE(excluded.vistas, vistas),
      me_gusta = excluded.me_gusta, comentarios = excluded.comentarios,
      guardados = COALESCE(excluded.guardados, guardados), compartidos = COALESCE(excluded.compartidos, compartidos),
      interacciones = COALESCE(excluded.interacciones, interacciones),
      item_id = COALESCE(excluded.item_id, item_id), enfoque_id = COALESCE(excluded.enfoque_id, enfoque_id),
      actualizado_el = excluded.actualizado_el`),
  get: db.prepare('SELECT actualizado_el, publicado_el FROM ig_posts WHERE negocio_id = ? AND media_id = ?'),
};

const METRICAS_CUENTA = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'saves', 'shares', 'profile_links_taps'];
const METRICAS_CUENTA_MINIMAS = ['reach', 'total_interactions', 'accounts_engaged'];
const METRICAS_POST = ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions'];
const DIAS_HISTORIA = 30;
const REFRESCAR_POSTS_DIAS = 30;

async function metricasDelDia(userId, accessToken, fecha, metricas) {
  return graphGet(`/${userId}/insights`, {
    metric: metricas.join(','), period: 'day', metric_type: 'total_value',
    since: String(inicioDelDia(fecha)), until: String(inicioDelDia(sumarDias(fecha, 1))),
  }, accessToken);
}

// Enlaza un post de Instagram con su pieza de Rubrofy: por el id que devolvió
// la publicación o, si no quedó registrado, por el texto exacto.
function mapaDePiezas(negocioId) {
  const porMedia = new Map();
  const porTexto = new Map();
  for (const it of store.getContenido(negocioId)) {
    const mediaId = (it.publicacion && it.publicacion.mediaId) || (it.instagram && it.instagram.mediaId);
    if (mediaId) porMedia.set(String(mediaId), it);
    if (it.status === 'aprobado') porTexto.set((it.variants[it.variantIndex] || '').trim(), it);
  }
  return { porMedia, porTexto };
}

async function sincronizarInstagram(negocio) {
  const { userId, accessToken } = negocio.instagram;
  const hoy = fechaLocal(new Date());

  // 1. seguidores de hoy
  const perfil = await graphGet(`/${userId}`, { fields: 'followers_count,media_count,username' }, accessToken);
  sqlCuenta.upsert.run(filaCuenta(negocio.id, hoy, { seguidores: perfil.followers_count }));

  // 2. métricas de la cuenta por día: lo que falte de los últimos 30 días,
  // y siempre los 2 últimos (Meta los completa con hasta 48 h de atraso)
  const desde = sumarDias(hoy, -DIAS_HISTORIA);
  const tienen = new Set(sqlCuenta.diasConMetricas.all(negocio.id, desde).map((f) => f.fecha));
  let metricas = METRICAS_CUENTA;
  for (let i = DIAS_HISTORIA; i >= 1; i--) {
    const fecha = sumarDias(hoy, -i);
    if (tienen.has(fecha) && i > 2) continue;
    let data;
    try {
      data = await metricasDelDia(userId, accessToken, fecha, metricas);
    } catch (err) {
      // Si Meta dejó de aceptar alguna métrica, se sigue con las básicas.
      if (err.tipo !== 'parametro' || metricas === METRICAS_CUENTA_MINIMAS) throw err;
      metricas = METRICAS_CUENTA_MINIMAS;
      data = await metricasDelDia(userId, accessToken, fecha, metricas);
    }
    sqlCuenta.upsert.run(filaCuenta(negocio.id, fecha, {
      alcance: valorMetrica(data, 'reach'),
      vistas: valorMetrica(data, 'views'),
      interacciones: valorMetrica(data, 'total_interactions'),
      cuentas_interactuaron: valorMetrica(data, 'accounts_engaged'),
      me_gusta: valorMetrica(data, 'likes'),
      comentarios: valorMetrica(data, 'comments'),
      guardados: valorMetrica(data, 'saves'),
      compartidos: valorMetrica(data, 'shares'),
      clics_enlace: valorMetrica(data, 'profile_links_taps'),
    }));
  }

  // 3. posts recientes y sus métricas (los de los últimos 30 días se
  // refrescan en cada pasada; los más viejos quedan con su último valor)
  const lista = await graphGet(`/${userId}/media`, {
    fields: 'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count', limit: '50',
  }, accessToken);
  const { porMedia, porTexto } = mapaDePiezas(negocio.id);
  const limite = Date.now() - REFRESCAR_POSTS_DIAS * 24 * 3600 * 1000;
  for (const m of lista.data || []) {
    const publicado = Date.parse(m.timestamp);
    const existente = sqlPosts.get.get(negocio.id, m.id);
    if (existente && publicado < limite) continue;
    let ins = null;
    try {
      ins = await graphGet(`/${m.id}/insights`, { metric: METRICAS_POST.join(',') }, accessToken);
    } catch (err) {
      if (err.tipo === 'token' || err.tipo === 'permiso') throw err;
      // Algunos tipos no admiten todas las métricas: queda con lo básico.
    }
    const pieza = porMedia.get(String(m.id)) || porTexto.get((m.caption || '').trim()) || null;
    const meGusta = ins ? valorMetrica(ins, 'likes') : null;
    const comentarios = ins ? valorMetrica(ins, 'comments') : null;
    sqlPosts.upsert.run({
      negocio_id: negocio.id,
      media_id: String(m.id),
      publicado_el: new Date(publicado).toISOString(),
      tipo: m.media_product_type || null,
      formato: m.media_type || null,
      permalink: m.permalink || null,
      caption: (m.caption || '').slice(0, 2200),
      alcance: ins ? valorMetrica(ins, 'reach') : null,
      vistas: ins ? valorMetrica(ins, 'views') : null,
      me_gusta: meGusta != null ? meGusta : (m.like_count != null ? m.like_count : null),
      comentarios: comentarios != null ? comentarios : (m.comments_count != null ? m.comments_count : null),
      guardados: ins ? valorMetrica(ins, 'saved') : null,
      compartidos: ins ? valorMetrica(ins, 'shares') : null,
      interacciones: ins ? valorMetrica(ins, 'total_interactions') : ((m.like_count || 0) + (m.comments_count || 0)),
      item_id: pieza ? pieza.id : null,
      enfoque_id: pieza ? pieza.enfoqueId : null,
      actualizado_el: new Date().toISOString(),
    });
  }
}

function filaCuenta(negocioId, fecha, valores) {
  return Object.assign({
    negocio_id: negocioId, fecha, seguidores: null, alcance: null, vistas: null, interacciones: null,
    cuentas_interactuaron: null, me_gusta: null, comentarios: null, guardados: null, compartidos: null, clics_enlace: null,
  }, valores);
}

// Sincroniza y deja registrado el resultado (para mostrarlo en el panel).
async function sincronizar(negocioId, log = console.log) {
  const negocio = store.getNegocio(negocioId);
  if (!negocio || !negocio.instagram || !negocio.instagram.accessToken) return { ok: false, error: 'Instagram no está conectado' };
  try {
    await sincronizarInstagram(negocio);
    registrarSync(negocioId, 'instagram', null, null);
    return { ok: true };
  } catch (err) {
    const tipo = err.tipo || 'otro';
    const detalle = tipo === 'permiso'
      ? 'El token de Instagram no tiene permiso para leer métricas (instagram_business_manage_insights). Genera uno nuevo que lo incluya.'
      : err.message;
    registrarSync(negocioId, 'instagram', tipo, detalle);
    log(`Analítica: ${negocioId} no se pudo sincronizar (${tipo}): ${err.message}`);
    return { ok: false, error: detalle, tipo };
  }
}

// --- consultas para el panel, el informe y la IA ---

function num(v) {
  return v == null ? 0 : Number(v);
}

const sqlConsultas = {
  serie: db.prepare(`SELECT fecha, seguidores, alcance, vistas, interacciones, cuentas_interactuaron, guardados,
      compartidos, clics_enlace FROM ig_cuenta_diaria WHERE negocio_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha`),
  seguidoresAntes: db.prepare(`SELECT seguidores FROM ig_cuenta_diaria WHERE negocio_id = ? AND fecha < ?
      AND seguidores IS NOT NULL ORDER BY fecha DESC LIMIT 1`),
  posts: db.prepare(`SELECT * FROM ig_posts WHERE negocio_id = ? AND publicado_el BETWEEN ? AND ?
      ORDER BY publicado_el DESC`),
  postsDesde: db.prepare('SELECT * FROM ig_posts WHERE negocio_id = ? AND publicado_el >= ?'),
};

// Resumen de un período [desde, hasta] (fechas AAAA-MM-DD, zona del negocio).
function resumen(negocioId, desde, hasta, estrategia) {
  const serie = sqlConsultas.serie.all(negocioId, desde, hasta).map((f) => Object.assign({}, f));
  const conSeguidores = serie.filter((f) => f.seguidores != null);
  const inicial = sqlConsultas.seguidoresAntes.get(negocioId, desde);
  const seguidoresFin = conSeguidores.length ? conSeguidores[conSeguidores.length - 1].seguidores : null;
  const seguidoresInicio = inicial ? inicial.seguidores : (conSeguidores.length ? conSeguidores[0].seguidores : null);

  const alcance = serie.reduce((s, f) => s + num(f.alcance), 0);
  const interacciones = serie.reduce((s, f) => s + num(f.interacciones), 0);
  const posts = sqlConsultas.posts.all(negocioId, programacion.isoDesdeZona(...partes(desde), 0, 0),
    programacion.isoDesdeZona(...partes(sumarDias(hasta, 1)), 0, 0)).map((p) => Object.assign({}, p));

  // Posts sincronizados antes de quedar enlazados a su pieza (o publicados
  // sin id registrado) se enlazan también al consultar.
  const { porMedia, porTexto } = mapaDePiezas(negocioId);
  for (const p of posts) {
    if (p.enfoque_id) continue;
    const pieza = porMedia.get(String(p.media_id)) || porTexto.get((p.caption || '').trim());
    if (pieza) {
      p.item_id = pieza.id;
      p.enfoque_id = pieza.enfoqueId;
    }
  }

  const labels = new Map(((estrategia && estrategia.enfoques) || []).map((e) => [e.id, e.label]));
  const grupos = new Map();
  for (const p of posts) {
    if (!p.enfoque_id) continue;
    const g = grupos.get(p.enfoque_id) || { enfoqueId: p.enfoque_id, label: labels.get(p.enfoque_id) || p.enfoque_id, posts: 0, interacciones: 0, alcance: 0 };
    g.posts += 1;
    g.interacciones += num(p.interacciones);
    g.alcance += num(p.alcance);
    grupos.set(p.enfoque_id, g);
  }
  const porEnfoque = [...grupos.values()].map((g) => ({
    enfoqueId: g.enfoqueId, label: g.label, posts: g.posts,
    promedioInteracciones: Math.round(g.interacciones / g.posts),
    promedioAlcance: Math.round(g.alcance / g.posts),
  })).sort((a, b) => b.promedioInteracciones - a.promedioInteracciones);

  return {
    desde, hasta,
    seguidores: seguidoresFin,
    seguidoresDelta: seguidoresFin != null && seguidoresInicio != null ? seguidoresFin - seguidoresInicio : null,
    alcance, interacciones,
    tasaInteraccion: alcance ? interacciones / alcance : null,
    publicaciones: posts.length,
    serie,
    topPosts: posts.slice().sort((a, b) => num(b.interacciones) - num(a.interacciones)).slice(0, 5),
    porEnfoque,
  };
}

function partes(fecha) {
  return fecha.split('-').map(Number);
}

// Mejor día y franja para publicar, según los posts de los últimos 90 días.
// Solo se sugiere con datos suficientes (8+ posts y 2+ en la franja ganadora).
const FRANJAS = [
  { id: 'manana', label: 'mañana', desde: 6, hasta: 12, hora: '09:00' },
  { id: 'tarde', label: 'tarde', desde: 12, hasta: 18, hora: '13:00' },
  { id: 'noche', label: 'noche', desde: 18, hasta: 24, hora: '19:30' },
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function mejorHorario(negocioId) {
  const desde = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const posts = sqlConsultas.postsDesde.all(negocioId, desde).filter((p) => p.interacciones != null);
  const celdas = [];
  for (let d = 0; d < 7; d++) for (const f of FRANJAS) celdas.push({ dia: d, franja: f.id, posts: 0, suma: 0 });
  let total = 0;
  let n = 0;
  for (const p of posts) {
    const iso = new Date(p.publicado_el);
    const partesZona = programacion.partesEnZona(iso);
    const dia = new Date(Date.UTC(partesZona.anio, partesZona.mes - 1, partesZona.dia)).getUTCDay();
    const franja = FRANJAS.find((f) => partesZona.hora >= f.desde && partesZona.hora < f.hasta);
    if (!franja) continue;
    const celda = celdas.find((c) => c.dia === dia && c.franja === franja.id);
    celda.posts += 1;
    celda.suma += num(p.interacciones);
    total += num(p.interacciones);
    n += 1;
  }
  const promedio = n ? total / n : 0;
  const resultado = celdas.map((c) => ({
    dia: c.dia, diaLabel: DIAS[c.dia], franja: c.franja,
    franjaLabel: FRANJAS.find((f) => f.id === c.franja).label,
    posts: c.posts, promedio: c.posts ? Math.round(c.suma / c.posts) : null,
  }));
  let mejor = null;
  if (n >= 8 && promedio > 0) {
    const candidatas = resultado.filter((c) => c.posts >= 2).sort((a, b) => b.promedio - a.promedio);
    if (candidatas.length) {
      const c = candidatas[0];
      mejor = Object.assign({}, c, {
        factor: Math.round((c.promedio / promedio) * 10) / 10,
        hora: FRANJAS.find((f) => f.id === c.franja).hora,
      });
      if (mejor.factor < 1.15) mejor = null; // sin diferencia real, no se sugiere nada
    }
  }
  return { celdas: resultado, postsAnalizados: n, promedio: Math.round(promedio), mejor };
}

// Lo que la IA necesita saber de los resultados: los enfoques que mejor
// funcionan y los textos de los posts con más interacción.
function aprendizajeResultados(negocioId, estrategia) {
  const hasta = fechaLocal(new Date());
  const r = resumen(negocioId, sumarDias(hasta, -90), hasta, estrategia);
  const conDatos = r.porEnfoque.filter((e) => e.posts >= 2);
  return {
    mejoresEnfoques: conDatos.length >= 2 ? conDatos.slice(0, 2) : [],
    mejoresTextos: r.topPosts.filter((p) => p.caption && num(p.interacciones) > 0).slice(0, 3).map((p) => p.caption.slice(0, 300)),
    horario: mejorHorario(negocioId).mejor,
  };
}

// --- sincronizador de fondo ---

const CADA_MS = 12 * 3600 * 1000;           // una sincronización cada 12 h
const REINTENTO_ERROR_MS = 3600 * 1000;     // si falló, reintenta en 1 h
const MIN_ENTRE_MANUALES_MS = 5 * 60 * 1000; // "Actualizar ahora" como mucho cada 5 min

function crearSincronizador({ debeSincronizar, fuentes = {}, intervaloMs = 10 * 60 * 1000, log = console.log }) {
  // fuentes: { nombre: async (negocioId) => ({ ok, error }) } — ads y
  // competencia se enganchan acá con el mismo calendario y estado.
  const todas = Object.assign({ instagram: (id) => sincronizar(id, log) }, fuentes);
  let corriendo = false;
  let timer = null;

  function toca(negocioId, fuente) {
    const e = estadoSync(negocioId, fuente);
    if (!e || !e.ultimo_intento) return true;
    const desde = Date.now() - Date.parse(e.ultimo_intento);
    return e.error ? desde > REINTENTO_ERROR_MS : desde > CADA_MS;
  }

  async function recorrer() {
    if (corriendo) return;
    corriendo = true;
    try {
      for (const negocio of store.listNegocios()) {
        for (const [fuente, fn] of Object.entries(todas)) {
          if (!debeSincronizar(negocio, fuente) || !toca(negocio.id, fuente)) continue;
          try {
            await fn(negocio.id);
          } catch (err) {
            log(`Sincronizador: error en ${negocio.id}/${fuente}: ${err.message}`);
          }
        }
      }
    } finally {
      corriendo = false;
    }
  }

  async function sincronizarAhora(negocioId, fuente = 'instagram') {
    const e = estadoSync(negocioId, fuente);
    if (e && e.ultimo_intento && Date.now() - Date.parse(e.ultimo_intento) < MIN_ENTRE_MANUALES_MS) {
      return { ok: false, espera: true, error: 'Se actualizó hace menos de 5 minutos' };
    }
    return todas[fuente](negocioId);
  }

  return {
    iniciar() {
      timer = setInterval(recorrer, intervaloMs);
      setTimeout(recorrer, 5000);
    },
    detener() { if (timer) clearInterval(timer); },
    recorrer,
    sincronizarAhora,
  };
}

module.exports = {
  sincronizar, resumen, mejorHorario, aprendizajeResultados, estadoSync, registrarSync, crearSincronizador,
  fechaLocal, sumarDias, inicioDelDia, graphGet, ErrorGraph, tipoErrorAnalitica,
};
