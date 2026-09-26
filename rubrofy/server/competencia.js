// Seguimiento de competidores en Instagram con Business Discovery (API de
// Instagram con inicio de sesión de Facebook, vía la conexión con Meta):
// datos PÚBLICOS de cuentas profesionales — seguidores, cantidad de posts y
// me gusta / comentarios de sus publicaciones recientes. No da su alcance
// ni métricas internas, y no funciona con cuentas personales.
//
// Los anuncios de la competencia no se leen por API: en Chile la
// Biblioteca de Anuncios solo entrega anuncios políticos por API, así que
// se enlaza a la búsqueda pública de la biblioteca.

const store = require('./store');
const analitica = require('./analitica');
const meta = require('./meta');

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS competidores (
    negocio_id TEXT NOT NULL,
    username TEXT NOT NULL,
    agregado_el TEXT NOT NULL,
    error TEXT,
    PRIMARY KEY (negocio_id, username)
  );
  CREATE TABLE IF NOT EXISTS competencia_diaria (
    negocio_id TEXT NOT NULL,
    username TEXT NOT NULL,
    fecha TEXT NOT NULL,
    nombre TEXT,
    seguidores INTEGER,
    publicaciones INTEGER,        -- total de la cuenta
    posts_30d INTEGER,            -- publicados en los últimos 30 días (de los 25 más recientes)
    interaccion_promedio REAL,    -- me gusta + comentarios por post (últimos 12)
    mejor_post TEXT,              -- JSON { permalink, caption, interacciones }
    PRIMARY KEY (negocio_id, username, fecha)
  );
`);
store.registrarLimpieza((negocioId) => {
  db.prepare('DELETE FROM competidores WHERE negocio_id = ?').run(negocioId);
  db.prepare('DELETE FROM competencia_diaria WHERE negocio_id = ?').run(negocioId);
});

const MAX_COMPETIDORES = 5;
const USERNAME = /^[a-z0-9._]{1,30}$/;

const sql = {
  listar: db.prepare('SELECT * FROM competidores WHERE negocio_id = ? ORDER BY agregado_el'),
  contar: db.prepare('SELECT COUNT(*) AS n FROM competidores WHERE negocio_id = ?'),
  agregar: db.prepare('INSERT OR IGNORE INTO competidores (negocio_id, username, agregado_el) VALUES (?, ?, ?)'),
  quitar: db.prepare('DELETE FROM competidores WHERE negocio_id = ? AND username = ?'),
  quitarDatos: db.prepare('DELETE FROM competencia_diaria WHERE negocio_id = ? AND username = ?'),
  error: db.prepare('UPDATE competidores SET error = ? WHERE negocio_id = ? AND username = ?'),
  snapshot: db.prepare(`INSERT INTO competencia_diaria (negocio_id, username, fecha, nombre, seguidores, publicaciones, posts_30d, interaccion_promedio, mejor_post)
    VALUES (@negocio_id, @username, @fecha, @nombre, @seguidores, @publicaciones, @posts_30d, @interaccion_promedio, @mejor_post)
    ON CONFLICT (negocio_id, username, fecha) DO UPDATE SET nombre = excluded.nombre, seguidores = excluded.seguidores,
      publicaciones = excluded.publicaciones, posts_30d = excluded.posts_30d,
      interaccion_promedio = excluded.interaccion_promedio, mejor_post = excluded.mejor_post`),
  ultimo: db.prepare('SELECT * FROM competencia_diaria WHERE negocio_id = ? AND username = ? ORDER BY fecha DESC LIMIT 1'),
  antes: db.prepare(`SELECT seguidores FROM competencia_diaria WHERE negocio_id = ? AND username = ? AND fecha <= ?
    ORDER BY fecha DESC LIMIT 1`),
  primero: db.prepare('SELECT seguidores, fecha FROM competencia_diaria WHERE negocio_id = ? AND username = ? ORDER BY fecha LIMIT 1'),
};

function normalizar(username) {
  return String(username || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase();
}

// Una consulta de Business Discovery: perfil + 25 publicaciones recientes.
async function consultar(negocio, username) {
  const campos = `business_discovery.username(${username}){username,name,followers_count,media_count,` +
    'media.limit(25){like_count,comments_count,timestamp,permalink,caption,media_type}}';
  const data = await meta.fbGet(`/${negocio.meta.igUserId}`, { fields: campos }, negocio.meta.accessToken);
  return data.business_discovery;
}

function resumirPerfil(bd) {
  const media = (bd.media && bd.media.data) || [];
  const hace30 = Date.now() - 30 * 24 * 3600 * 1000;
  const ultimos = media.slice(0, 12);
  const interaccion = (m) => (Number(m.like_count) || 0) + (Number(m.comments_count) || 0);
  const mejor = ultimos.slice().sort((a, b) => interaccion(b) - interaccion(a))[0];
  return {
    nombre: bd.name || bd.username,
    seguidores: Number(bd.followers_count) || 0,
    publicaciones: Number(bd.media_count) || 0,
    posts_30d: media.filter((m) => Date.parse(m.timestamp) >= hace30).length,
    interaccion_promedio: ultimos.length ? Math.round(ultimos.reduce((s, m) => s + interaccion(m), 0) / ultimos.length) : null,
    mejor_post: mejor ? JSON.stringify({ permalink: mejor.permalink, caption: (mejor.caption || '').slice(0, 200), interacciones: interaccion(mejor) }) : null,
  };
}

function guardarSnapshot(negocioId, username, perfil) {
  sql.snapshot.run(Object.assign({ negocio_id: negocioId, username, fecha: analitica.fechaLocal(new Date()) }, perfil));
  sql.error.run(null, negocioId, username);
}

function mensajeDeError(err) {
  if (err.tipo === 'token') return 'token';
  // 110 / 2207013: no existe, es personal o tiene restricción de edad
  if (err.codigo === 110 || err.codigo === 100) return 'Cuenta no encontrada o no es profesional (empresa o creador)';
  return err.message;
}

async function agregar(negocio, usernameCrudo) {
  const username = normalizar(usernameCrudo);
  if (!USERNAME.test(username)) return { error: 'Usuario de Instagram inválido' };
  if (username === (negocio.meta.igUsername || '').toLowerCase()) return { error: 'Esa es tu propia cuenta' };
  if (sql.contar.get(negocio.id).n >= MAX_COMPETIDORES) return { error: `Puedes seguir hasta ${MAX_COMPETIDORES} competidores` };
  let bd;
  try {
    bd = await consultar(negocio, username);
  } catch (err) {
    const m = mensajeDeError(err);
    return { error: m === 'token' ? 'Meta rechazó el token: vuelve a conectar Meta en Conexiones y ajustes' : m };
  }
  if (!bd) return { error: 'Cuenta no encontrada o no es profesional (empresa o creador)' };
  sql.agregar.run(negocio.id, username, new Date().toISOString());
  guardarSnapshot(negocio.id, username, resumirPerfil(bd));
  return { ok: true };
}

function quitar(negocioId, username) {
  sql.quitar.run(negocioId, normalizar(username));
  sql.quitarDatos.run(negocioId, normalizar(username));
}

// Una foto diaria de cada competidor (1 llamada por competidor).
async function sincronizar(negocioId) {
  const negocio = store.getNegocio(negocioId);
  if (!negocio || !negocio.meta || !negocio.meta.igUserId) return { ok: false, error: 'Falta conectar Meta con una cuenta de Instagram' };
  let errores = 0;
  for (const c of sql.listar.all(negocioId)) {
    try {
      const bd = await consultar(negocio, c.username);
      if (bd) guardarSnapshot(negocioId, c.username, resumirPerfil(bd));
    } catch (err) {
      const m = mensajeDeError(err);
      if (m === 'token') {
        negocio.meta.estado = 'reconectar';
        store.saveNegocio(negocio);
        analitica.registrarSync(negocioId, 'competencia', 'token', 'El token de Meta venció o fue revocado. Pega uno nuevo en Conexiones y ajustes.');
        return { ok: false, tipo: 'token' };
      }
      sql.error.run(m, negocioId, c.username);
      errores += 1;
    }
  }
  analitica.registrarSync(negocioId, 'competencia', null, errores ? `${errores} cuenta(s) no se pudieron actualizar` : null);
  return { ok: true };
}

function bibliotecaAnuncios(texto) {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=CL&q=${encodeURIComponent(texto)}`;
}

// Comparación: el negocio y sus competidores, con la variación de
// seguidores en los últimos 30 días (o desde que se empezó a seguir).
function comparacion(negocio) {
  const hoy = analitica.fechaLocal(new Date());
  const hace30 = analitica.sumarDias(hoy, -30);
  const filas = sql.listar.all(negocio.id).map((c) => {
    const u = sql.ultimo.get(negocio.id, c.username) || {};
    const base = sql.antes.get(negocio.id, c.username, hace30) || sql.primero.get(negocio.id, c.username);
    return {
      username: c.username,
      nombre: u.nombre || c.username,
      propio: false,
      seguidores: u.seguidores == null ? null : u.seguidores,
      variacionSeguidores: u.seguidores != null && base && base.seguidores != null ? u.seguidores - base.seguidores : null,
      posts30d: u.posts_30d == null ? null : u.posts_30d,
      interaccionPromedio: u.interaccion_promedio == null ? null : u.interaccion_promedio,
      mejorPost: u.mejor_post ? JSON.parse(u.mejor_post) : null,
      actualizadoEl: u.fecha || null,
      error: c.error,
      anuncios: bibliotecaAnuncios(u.nombre || c.username),
      perfil: `https://www.instagram.com/${c.username}/`,
    };
  });

  // La propia cuenta con la misma vara (me gusta + comentarios de los últimos 12 posts).
  const r = analitica.resumen(negocio.id, hace30, hoy, negocio.estrategia);
  const recientes = db.prepare(`SELECT me_gusta, comentarios, permalink, caption FROM ig_posts WHERE negocio_id = ?
    ORDER BY publicado_el DESC LIMIT 12`).all(negocio.id);
  const inter = (p) => (p.me_gusta || 0) + (p.comentarios || 0);
  const mejor = recientes.slice().sort((a, b) => inter(b) - inter(a))[0];
  const propio = {
    username: negocio.meta.igUsername || 'tu cuenta',
    nombre: negocio.nombre,
    propio: true,
    seguidores: r.seguidores,
    variacionSeguidores: r.seguidoresDelta,
    posts30d: r.publicaciones,
    interaccionPromedio: recientes.length ? Math.round(recientes.reduce((s, p) => s + inter(p), 0) / recientes.length) : null,
    mejorPost: mejor ? { permalink: mejor.permalink, caption: (mejor.caption || '').slice(0, 200), interacciones: inter(mejor) } : null,
    anuncios: bibliotecaAnuncios(negocio.nombre),
  };
  return { filas: [propio, ...filas], maximo: MAX_COMPETIDORES };
}

// Cuántos competidores sigue el negocio (para la ruta del Inicio).
function contar(negocioId) {
  return sql.listar.all(negocioId).length;
}

module.exports = { agregar, quitar, sincronizar, comparacion, normalizar, contar };
