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
const programacion = require('./programacion');

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
// Detalle del análisis (formatos, días, horas, hashtags, mejores posts),
// agregado después: se suma la columna en bases existentes.
if (!db.prepare('PRAGMA table_info(competencia_diaria)').all().some((c) => c.name === 'detalle')) {
  db.exec('ALTER TABLE competencia_diaria ADD COLUMN detalle TEXT');
}
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
  snapshot: db.prepare(`INSERT INTO competencia_diaria (negocio_id, username, fecha, nombre, seguidores, publicaciones, posts_30d, interaccion_promedio, mejor_post, detalle)
    VALUES (@negocio_id, @username, @fecha, @nombre, @seguidores, @publicaciones, @posts_30d, @interaccion_promedio, @mejor_post, @detalle)
    ON CONFLICT (negocio_id, username, fecha) DO UPDATE SET nombre = excluded.nombre, seguidores = excluded.seguidores,
      publicaciones = excluded.publicaciones, posts_30d = excluded.posts_30d,
      interaccion_promedio = excluded.interaccion_promedio, mejor_post = excluded.mejor_post, detalle = excluded.detalle`),
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
    'media.limit(25){like_count,comments_count,timestamp,permalink,caption,media_type,media_url,thumbnail_url}}';
  const data = await meta.fbGet(`/${negocio.meta.igUserId}`, { fields: campos }, negocio.meta.accessToken);
  return data.business_discovery;
}

// --- análisis de publicaciones (competidores y la propia cuenta, misma vara) ---

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const FORMATOS = { IMAGE: 'foto', CAROUSEL_ALBUM: 'carrusel', VIDEO: 'video' };
const FORMATO_NOMBRE = { foto: 'Fotos', carrusel: 'Carruseles', video: 'Videos y reels' };
const FRANJAS = [
  { id: 'manana', label: 'mañana (6 a 12)', desde: 6, hasta: 12 },
  { id: 'tarde', label: 'tarde (12 a 18)', desde: 12, hasta: 18 },
  { id: 'noche', label: 'noche (18 a 24)', desde: 18, hasta: 24 },
  { id: 'madrugada', label: 'madrugada (0 a 6)', desde: 0, hasta: 6 },
];

// posts: [{ fecha: Date, formato: foto|carrusel|video, interacciones, caption, permalink, imagen }]
function analizarPosts(posts, seguidores) {
  const n = posts.length;
  const hace30 = Date.now() - 30 * 24 * 3600 * 1000;
  const formatos = {};
  for (const f of Object.keys(FORMATO_NOMBRE)) formatos[f] = { posts: 0, suma: 0 };
  const dias = [0, 0, 0, 0, 0, 0, 0];
  const franjas = {};
  const hashtags = new Map();
  for (const p of posts) {
    const f = formatos[p.formato] || formatos.foto;
    f.posts += 1;
    f.suma += p.interacciones;
    const z = programacion.partesEnZona(p.fecha);
    dias[new Date(Date.UTC(z.anio, z.mes - 1, z.dia)).getUTCDay()] += 1;
    const franja = FRANJAS.find((x) => z.hora >= x.desde && z.hora < x.hasta);
    franjas[franja.id] = (franjas[franja.id] || 0) + 1;
    for (const h of new Set(((p.caption || '').toLowerCase().match(/#[\p{L}\p{N}_]+/gu) || []))) hashtags.set(h, (hashtags.get(h) || 0) + 1);
  }
  const tasa = (v) => (seguidores ? v / seguidores : null);
  const recientes = posts.filter((p) => p.fecha.getTime() >= hace30);
  // Frecuencia: posts de los últimos 30 días; si todos los recientes caben en
  // menos de 30 días, se estima con el rango real que cubren.
  let porSemana = null;
  if (n >= 2) {
    const rango = Math.max(1, (posts[0].fecha - posts[n - 1].fecha) / (24 * 3600 * 1000));
    porSemana = recientes.length && recientes.length < n ? recientes.length / 30 * 7 : n / Math.max(rango, 7) * 7;
    porSemana = Math.round(porSemana * 10) / 10;
  }
  const diaTop = n ? dias.indexOf(Math.max(...dias)) : null;
  const franjaTop = n ? Object.entries(franjas).sort((a, b) => b[1] - a[1])[0][0] : null;
  const top = posts.slice().sort((a, b) => b.interacciones - a.interacciones).slice(0, 3).map((p) => ({
    permalink: p.permalink, caption: (p.caption || '').slice(0, 160), formato: p.formato, interacciones: p.interacciones,
    tasa: tasa(p.interacciones), imagen: p.imagen || null, fecha: p.fecha.toISOString(),
  }));
  return {
    postsAnalizados: n,
    porSemana,
    tasaInteraccion: n ? tasa(posts.reduce((s, p) => s + p.interacciones, 0) / n) : null,
    formatos: Object.fromEntries(Object.entries(formatos).map(([k, v]) => [k, {
      posts: v.posts, parte: n ? v.posts / n : 0, promedio: v.posts ? Math.round(v.suma / v.posts) : null, tasa: v.posts ? tasa(v.suma / v.posts) : null,
    }])),
    dias,
    diaFrecuente: diaTop == null || !dias[diaTop] ? null : DIAS[diaTop],
    franjaFrecuente: franjaTop ? FRANJAS.find((x) => x.id === franjaTop).label : null,
    hashtags: [...hashtags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, veces]) => ({ tag, veces })),
    top,
  };
}

function resumirPerfil(bd) {
  const media = (bd.media && bd.media.data) || [];
  const hace30 = Date.now() - 30 * 24 * 3600 * 1000;
  const ultimos = media.slice(0, 12);
  const interaccion = (m) => (Number(m.like_count) || 0) + (Number(m.comments_count) || 0);
  const mejor = ultimos.slice().sort((a, b) => interaccion(b) - interaccion(a))[0];
  const seguidores = Number(bd.followers_count) || 0;
  const posts = media.filter((m) => m.timestamp).map((m) => ({
    fecha: new Date(m.timestamp), formato: FORMATOS[m.media_type] || 'foto', interacciones: interaccion(m),
    caption: m.caption, permalink: m.permalink, imagen: m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url,
  }));
  return {
    nombre: bd.name || bd.username,
    seguidores,
    publicaciones: Number(bd.media_count) || 0,
    posts_30d: media.filter((m) => Date.parse(m.timestamp) >= hace30).length,
    interaccion_promedio: ultimos.length ? Math.round(ultimos.reduce((s, m) => s + interaccion(m), 0) / ultimos.length) : null,
    mejor_post: mejor ? JSON.stringify({ permalink: mejor.permalink, caption: (mejor.caption || '').slice(0, 200), interacciones: interaccion(mejor) }) : null,
    detalle: JSON.stringify(analizarPosts(posts, seguidores)),
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
    // Sin una foto de hace 30 días se compara con la primera; si la primera es de hoy, aún no hay variación.
    const base = sql.antes.get(negocio.id, c.username, hace30) || [sql.primero.get(negocio.id, c.username)].find((x) => x && x.fecha < hoy);
    return {
      username: c.username,
      nombre: u.nombre || c.username,
      propio: false,
      seguidores: u.seguidores == null ? null : u.seguidores,
      variacionSeguidores: u.seguidores != null && base && base.seguidores != null ? u.seguidores - base.seguidores : null,
      posts30d: u.posts_30d == null ? null : u.posts_30d,
      interaccionPromedio: u.interaccion_promedio == null ? null : u.interaccion_promedio,
      mejorPost: u.mejor_post ? JSON.parse(u.mejor_post) : null,
      detalle: u.detalle ? JSON.parse(u.detalle) : null,
      actualizadoEl: u.fecha || null,
      error: c.error,
      anuncios: bibliotecaAnuncios(u.nombre || c.username),
      perfil: `https://www.instagram.com/${c.username}/`,
    };
  });

  // La propia cuenta con la misma vara (me gusta + comentarios de los últimos 12 posts).
  const r = analitica.resumen(negocio.id, hace30, hoy, negocio.estrategia);
  const ultimos25 = db.prepare(`SELECT me_gusta, comentarios, permalink, caption, formato, tipo, publicado_el FROM ig_posts WHERE negocio_id = ?
    ORDER BY publicado_el DESC LIMIT 25`).all(negocio.id);
  const recientes = ultimos25.slice(0, 12);
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
    detalle: ultimos25.length ? analizarPosts(ultimos25.map((p) => ({
      fecha: new Date(p.publicado_el), formato: p.tipo === 'REELS' ? 'video' : (FORMATOS[p.formato] || 'foto'), interacciones: inter(p),
      caption: p.caption, permalink: p.permalink, imagen: null,
    })), r.seguidores) : null,
    anuncios: bibliotecaAnuncios(negocio.nombre),
  };
  const todas = [propio, ...filas];
  for (const f of todas) {
    const base = f.seguidores != null && f.variacionSeguidores != null ? f.seguidores - f.variacionSeguidores : null;
    f.crecimiento = base ? f.variacionSeguidores / base : null;
  }
  return { filas: todas, maximo: MAX_COMPETIDORES, conclusiones: conclusiones(propio, filas.filter((f) => f.detalle && !f.error)), formatos: FORMATO_NOMBRE };
}

// Qué hace distinto la competencia, en frases con una acción concreta.
function conclusiones(propio, rivales) {
  const out = [];
  const agregar = (nivel, titulo, detalle, accion) => out.push({ nivel, titulo, detalle, accion });
  if (!rivales.length) return out;
  const yo = propio.detalle;
  const pct = (v) => `${(v * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })} %`;
  const prom = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

  // 1. Qué formato rinde más en el rubro (tasa de interacción por formato, competidores juntos).
  const porFormato = {};
  for (const r of rivales) {
    for (const [k, v] of Object.entries(r.detalle.formatos)) {
      if (v.posts && v.tasa != null) (porFormato[k] = porFormato[k] || []).push(v.tasa);
    }
  }
  const ranking = Object.entries(porFormato).map(([k, xs]) => ({ k, tasa: prom(xs), cuentas: xs.length })).sort((a, b) => b.tasa - a.tasa);
  if (ranking.length >= 2 && ranking[0].tasa >= ranking[ranking.length - 1].tasa * 1.3) {
    const g = ranking[0];
    const miParte = yo ? yo.formatos[g.k].parte : null;
    agregar('idea', `En tu competencia, ${FORMATO_NOMBRE[g.k].toLowerCase()} son lo que más interacción consigue`,
      `${pct(g.tasa)} de interacción por publicación, contra ${pct(ranking[ranking.length - 1].tasa)} de ${FORMATO_NOMBRE[ranking[ranking.length - 1].k].toLowerCase()}.` +
        (miParte != null ? ` Hoy son el ${Math.round(miParte * 100)} % de lo que publicas.` : ''),
      miParte != null && miParte < 0.35 ? `Sube la proporción de ${FORMATO_NOMBRE[g.k].toLowerCase()} en tu plan semanal (Estrategia → Tu plan de contenido).` : 'Mantén ese formato en tu plan semanal.');
  }

  // 2. Frecuencia.
  const suFrecuencia = prom(rivales.map((r) => r.detalle.porSemana).filter((x) => x != null));
  if (suFrecuencia != null && yo && yo.porSemana != null) {
    if (yo.porSemana < suFrecuencia * 0.7) {
      agregar('alerta', `Publicas menos que tu competencia`, `Tú: ${yo.porSemana.toLocaleString('es-CL')} por semana. Ellos: ${suFrecuencia.toLocaleString('es-CL', { maximumFractionDigits: 1 })} en promedio.`,
        'Sube tu ritmo semanal en Estrategia; Rubrofy te deja las piezas listas para aprobar.');
    } else if (yo.porSemana >= suFrecuencia * 1.3) {
      agregar('bien', 'Publicas más seguido que tu competencia', `Tú: ${yo.porSemana.toLocaleString('es-CL')} por semana. Ellos: ${suFrecuencia.toLocaleString('es-CL', { maximumFractionDigits: 1 })}.`,
        'Cuida que la interacción no baje: más no sirve si cada post rinde menos.');
    }
  } else if (suFrecuencia != null) {
    agregar('idea', `Tu competencia publica ${suFrecuencia.toLocaleString('es-CL', { maximumFractionDigits: 1 })} veces por semana`, 'Todavía no tenemos tus publicaciones para comparar.', 'Conecta Instagram para compararte con la misma vara.');
  }

  // 3. Tasa de interacción: posición.
  const conTasa = [propio, ...rivales].filter((f) => f.detalle && f.detalle.tasaInteraccion != null).sort((a, b) => b.detalle.tasaInteraccion - a.detalle.tasaInteraccion);
  const pos = conTasa.indexOf(propio);
  if (pos >= 0 && conTasa.length >= 2) {
    const lider = conTasa[0];
    if (pos === 0) {
      agregar('bien', 'Tienes la mejor tasa de interacción de tu grupo', `${pct(propio.detalle.tasaInteraccion)} de tus seguidores interactúa con cada publicación.`,
        'Tu contenido conecta: el siguiente paso es llegar a más gente (reels, colaboraciones o publicidad).');
    } else {
      agregar('idea', `@${lider.username} consigue más interacción por seguidor`, `${pct(lider.detalle.tasaInteraccion)} contra tu ${pct(propio.detalle.tasaInteraccion)}.`,
        'Mira sus 3 mejores publicaciones abajo: qué muestran, cómo empiezan y qué piden al final.');
    }
  }

  // 4. Cuándo publican.
  const diasJuntos = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rivales) r.detalle.dias.forEach((v, i) => { diasJuntos[i] += v; });
  const totalDias = diasJuntos.reduce((s, x) => s + x, 0);
  const iDia = diasJuntos.indexOf(Math.max(...diasJuntos));
  // Solo si hay un día que de verdad concentra sus publicaciones (1 de cada 4 o más).
  if (totalDias >= 8 && diasJuntos[iDia] / totalDias >= 0.25) {
    const i = iDia;
    const franjas = {};
    for (const r of rivales) if (r.detalle.franjaFrecuente) franjas[r.detalle.franjaFrecuente] = (franjas[r.detalle.franjaFrecuente] || 0) + 1;
    const franja = Object.entries(franjas).sort((a, b) => b[1] - a[1])[0];
    agregar('idea', `Tu competencia publica sobre todo los ${DIAS[i]}${franja ? ` en la ${franja[0].replace(/ \(.*/, '')}` : ''}`,
      `${Math.round((diasJuntos[i] / totalDias) * 100)} % de sus publicaciones recientes salen ese día.`,
      'Publicar a la misma hora te pone a competir por la misma atención; prueba también un horario donde ellos no están y compara en Resultados.');
  }

  // 5. Quién crece más rápido.
  const crecen = rivales.filter((r) => r.crecimiento != null && r.crecimiento > 0).sort((a, b) => b.crecimiento - a.crecimiento);
  if (crecen.length && (propio.crecimiento == null || crecen[0].crecimiento > propio.crecimiento * 1.5)) {
    agregar('idea', `@${crecen[0].username} es quien más crece`, `+${pct(crecen[0].crecimiento)} de seguidores en 30 días${propio.crecimiento != null ? `, tú ${propio.crecimiento >= 0 ? '+' : ''}${pct(propio.crecimiento)}` : ''}.`,
      'Revisa si está haciendo publicidad (botón "Ver anuncios") o colaboraciones con otras cuentas.');
  }

  // 6. Hashtags que usan y tú no.
  const mios = new Set(yo ? yo.hashtags.map((h) => h.tag) : []);
  const suyos = new Map();
  for (const r of rivales) for (const h of r.detalle.hashtags) suyos.set(h.tag, (suyos.get(h.tag) || 0) + 1);
  const faltan = [...suyos.entries()].filter(([t, n]) => n >= 2 && !mios.has(t)).map(([t]) => t).slice(0, 5);
  if (faltan.length) {
    agregar('idea', 'Hashtags que usa tu competencia y tú no', faltan.join(' '), 'Suma los que describan tu negocio y tu zona; evita los genéricos.');
  }
  const peso = { alerta: 0, idea: 1, bien: 2 };
  return out.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

// Cuántos competidores sigue el negocio (para la ruta del Inicio).
function contar(negocioId) {
  return sql.listar.all(negocioId).length;
}

module.exports = { agregar, quitar, sincronizar, comparacion, normalizar, contar };
