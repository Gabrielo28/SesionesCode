// Soporte: las solicitudes que un negocio envía desde "Ayuda y soporte"
// (algo no funciona, una consulta, pagos o una sugerencia) y que el equipo
// responde desde /admin. Es lo único del negocio que el equipo lee, porque
// el cliente lo escribe para el equipo: no incluye sus publicaciones ni sus
// fotos, salvo la captura que el propio cliente adjunte.
//
// Estados: 'abierta' (espera al equipo), 'respondida' (espera al cliente) y
// 'cerrada'. Si el cliente vuelve a escribir, se abre de nuevo.

const fs = require('fs');
const path = require('path');
const store = require('./store');
const { DATA_DIR } = require('./datos');

const DIR = path.join(DATA_DIR, 'soporte');
const TIPOS = {
  problema: 'Algo no funciona',
  consulta: 'Consulta',
  pagos: 'Pagos y facturación',
  sugerencia: 'Sugerencia',
};
const MAX_POR_DIA = 8;            // solicitudes nuevas por negocio en 24 h
const MAX_MENSAJES_POR_DIA = 40;  // mensajes del negocio en 24 h
const MAX_ADJUNTO = 5 * 1024 * 1024;

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS soporte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    asunto TEXT NOT NULL,
    estado TEXT NOT NULL,
    contexto TEXT,
    creado_el TEXT NOT NULL,
    actualizado_el TEXT NOT NULL,
    leido_negocio INTEGER NOT NULL DEFAULT 1,
    leido_equipo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS soporte_mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id INTEGER NOT NULL,
    negocio_id TEXT NOT NULL,
    autor TEXT NOT NULL,
    texto TEXT NOT NULL,
    adjunto TEXT,
    creado_el TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS soporte_negocio ON soporte (negocio_id, actualizado_el);
  CREATE INDEX IF NOT EXISTS soporte_estado ON soporte (estado, actualizado_el);
  CREATE INDEX IF NOT EXISTS soporte_msj ON soporte_mensajes (solicitud_id, id);
`);
store.registrarLimpieza((negocioId) => {
  db.prepare('DELETE FROM soporte_mensajes WHERE negocio_id = ?').run(negocioId);
  db.prepare('DELETE FROM soporte WHERE negocio_id = ?').run(negocioId);
  fs.rmSync(path.join(DIR, negocioId), { recursive: true, force: true });
});

const sql = {
  crear: db.prepare(`INSERT INTO soporte (negocio_id, tipo, asunto, estado, contexto, creado_el, actualizado_el, leido_negocio, leido_equipo)
    VALUES (?, ?, ?, 'abierta', ?, ?, ?, 1, 0)`),
  mensaje: db.prepare('INSERT INTO soporte_mensajes (solicitud_id, negocio_id, autor, texto, adjunto, creado_el) VALUES (?, ?, ?, ?, ?, ?)'),
  get: db.prepare('SELECT * FROM soporte WHERE id = ?'),
  delNegocio: db.prepare('SELECT * FROM soporte WHERE negocio_id = ? ORDER BY actualizado_el DESC LIMIT 50'),
  mensajes: db.prepare('SELECT * FROM soporte_mensajes WHERE solicitud_id = ? ORDER BY id'),
  ultimo: db.prepare('SELECT * FROM soporte_mensajes WHERE solicitud_id = ? ORDER BY id DESC LIMIT 1'),
  porEquipo: db.prepare('UPDATE soporte SET estado = ?, actualizado_el = ?, leido_negocio = 0, leido_equipo = 1 WHERE id = ?'),
  porNegocio: db.prepare("UPDATE soporte SET estado = 'abierta', actualizado_el = ?, leido_equipo = 0 WHERE id = ?"),
  estado: db.prepare('UPDATE soporte SET estado = ?, actualizado_el = ? WHERE id = ?'),
  leidoNegocio: db.prepare('UPDATE soporte SET leido_negocio = 1 WHERE negocio_id = ? AND leido_negocio = 0'),
  leidoEquipo: db.prepare('UPDATE soporte SET leido_equipo = 1 WHERE id = ?'),
  sinLeer: db.prepare('SELECT COUNT(*) AS n FROM soporte WHERE negocio_id = ? AND leido_negocio = 0'),
  nuevasDia: db.prepare('SELECT COUNT(*) AS n FROM soporte WHERE negocio_id = ? AND creado_el > ?'),
  mensajesDia: db.prepare("SELECT COUNT(*) AS n FROM soporte_mensajes WHERE negocio_id = ? AND autor = 'negocio' AND creado_el > ?"),
  abiertas: db.prepare("SELECT * FROM soporte WHERE estado = 'abierta' ORDER BY actualizado_el DESC LIMIT 200"),
  todas: db.prepare('SELECT * FROM soporte ORDER BY actualizado_el DESC LIMIT 200'),
  conteo: db.prepare("SELECT SUM(estado = 'abierta') AS abiertas, SUM(estado = 'abierta' AND leido_equipo = 0) AS nuevas, SUM(estado = 'respondida') AS respondidas FROM soporte"),
};

const ahora = () => new Date().toISOString();
const hace24h = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const limpio = (s, max) => String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

// Lo que el panel manda para entender un error: qué pantalla, qué navegador y
// los últimos errores. Se guardan solo esas claves y con largo acotado.
function contextoLimpio(c) {
  if (!c || typeof c !== 'object') return null;
  const corto = (v, n) => (v == null ? undefined : String(v).slice(0, n));
  const out = {
    pantalla: corto(c.pantalla, 40),
    navegador: corto(c.navegador, 300),
    ventana: corto(c.ventana, 20),
    version: corto(c.version, 20),
    errores: Array.isArray(c.errores) ? c.errores.slice(-8).map((e) => ({
      cuando: corto(e && e.cuando, 30),
      que: corto(e && e.que, 120),
      estado: e && Number.isFinite(Number(e.estado)) ? Number(e.estado) : undefined,
      mensaje: corto(e && e.mensaje, 300),
    })) : undefined,
  };
  return JSON.stringify(out);
}

// Una captura de pantalla: PNG, JPG o WebP de hasta 5 MB (se revisan los bytes).
function leerAdjunto(adj) {
  if (!adj || !adj.dataBase64) return { buffer: null };
  const buffer = Buffer.from(String(adj.dataBase64).replace(/^data:[^,]+,/, ''), 'base64');
  if (!buffer.length) return { buffer: null };
  if (buffer.length > MAX_ADJUNTO) return { error: 'La imagen pesa más de 5 MB. Prueba con una captura más liviana.' };
  let ext = null;
  if (buffer[0] === 0x89 && buffer.slice(1, 4).toString() === 'PNG') ext = '.png';
  else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ext = '.jpg';
  else if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') ext = '.webp';
  if (!ext) return { error: 'La captura tiene que ser una imagen PNG, JPG o WebP.' };
  return { buffer, ext };
}

function guardarAdjunto(negocioId, solicitudId, adj) {
  if (!adj || !adj.buffer) return null;
  const nombre = `${solicitudId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${adj.ext}`;
  fs.mkdirSync(path.join(DIR, negocioId), { recursive: true });
  fs.writeFileSync(path.join(DIR, negocioId, nombre), adj.buffer);
  return nombre;
}

// Ruta del archivo adjunto, solo si es de esa solicitud y de ese negocio.
function rutaAdjunto(solicitud, archivo) {
  if (!solicitud || !/^[0-9]+-[0-9]+-[a-z0-9]+\.(png|jpg|webp)$/.test(String(archivo || ''))) return null;
  if (!archivo.startsWith(solicitud.id + '-')) return null;
  const ruta = path.join(DIR, solicitud.negocio_id, archivo);
  return fs.existsSync(ruta) ? ruta : null;
}

function publica(fila, { conContexto = false } = {}) {
  if (!fila) return null;
  const out = {
    id: fila.id,
    tipo: fila.tipo,
    tipoNombre: TIPOS[fila.tipo] || fila.tipo,
    asunto: fila.asunto,
    estado: fila.estado,
    creadoEl: fila.creado_el,
    actualizadoEl: fila.actualizado_el,
    sinLeer: !fila.leido_negocio,
    mensajes: sql.mensajes.all(fila.id).map((m) => ({ autor: m.autor, texto: m.texto, adjunto: m.adjunto || null, creadoEl: m.creado_el })),
  };
  if (conContexto) {
    out.negocioId = fila.negocio_id;
    out.nuevaParaEquipo = !fila.leido_equipo;
    try { out.contexto = fila.contexto ? JSON.parse(fila.contexto) : null; } catch (e) { out.contexto = null; }
  }
  return out;
}

// Crea una solicitud. Devuelve { solicitud } o { error, status }.
function crear(negocioId, { tipo, asunto, texto, contexto, adjunto }) {
  if (!TIPOS[tipo]) return { error: 'Elige de qué se trata.', status: 400 };
  const a = limpio(asunto, 120);
  const t = limpio(texto, 4000);
  if (a.length < 3) return { error: 'Escribe un asunto corto, por ejemplo "No se publicó mi post".', status: 400 };
  if (t.length < 10) return { error: 'Cuéntanos un poco más (al menos 10 letras) para poder ayudarte.', status: 400 };
  if (sql.nuevasDia.get(negocioId, hace24h()).n >= MAX_POR_DIA) return { error: 'Enviaste varias solicitudes hoy. Responde en una de las que ya tienes y te ayudamos ahí.', status: 429 };
  const adj = leerAdjunto(adjunto);
  if (adj.error) return { error: adj.error, status: 400 };
  const cuando = ahora();
  let id;
  store.transaccion(() => {
    id = Number(sql.crear.run(negocioId, tipo, a, contextoLimpio(contexto), cuando, cuando).lastInsertRowid);
    sql.mensaje.run(id, negocioId, 'negocio', t, guardarAdjunto(negocioId, id, adj), cuando);
  });
  return { solicitud: publica(sql.get.get(id)) };
}

// Mensaje nuevo en una solicitud. autor: 'negocio' | 'equipo'.
function responder(solicitudId, autor, { texto, adjunto, cerrar = false }) {
  const fila = sql.get.get(Number(solicitudId));
  if (!fila) return { error: 'No encontramos esa solicitud.', status: 404 };
  const t = limpio(texto, 4000);
  if (t.length < 2) return { error: 'Escribe tu mensaje.', status: 400 };
  if (autor === 'negocio' && sql.mensajesDia.get(fila.negocio_id, hace24h()).n >= MAX_MENSAJES_POR_DIA) {
    return { error: 'Enviaste muchos mensajes hoy. Te respondemos pronto.', status: 429 };
  }
  const adj = leerAdjunto(adjunto);
  if (adj.error) return { error: adj.error, status: 400 };
  const cuando = ahora();
  store.transaccion(() => {
    sql.mensaje.run(fila.id, fila.negocio_id, autor, t, guardarAdjunto(fila.negocio_id, fila.id, adj), cuando);
    if (autor === 'equipo') sql.porEquipo.run(cerrar ? 'cerrada' : 'respondida', cuando, fila.id);
    else sql.porNegocio.run(cuando, fila.id);
  });
  return { solicitud: publica(sql.get.get(fila.id), { conContexto: autor === 'equipo' }), fila: sql.get.get(fila.id) };
}

function cambiarEstado(solicitudId, estado) {
  const fila = sql.get.get(Number(solicitudId));
  if (!fila || !['abierta', 'respondida', 'cerrada'].includes(estado)) return null;
  sql.estado.run(estado, ahora(), fila.id);
  return sql.get.get(fila.id);
}

function obtener(solicitudId) {
  return sql.get.get(Number(solicitudId)) || null;
}

// Las solicitudes del negocio (las más recientes primero). marcarLeidas: al
// abrir "Ayuda y soporte" se dan por vistas las respuestas.
function delNegocio(negocioId, { marcarLeidas = false } = {}) {
  const lista = sql.delNegocio.all(negocioId).map((f) => publica(f));
  if (marcarLeidas) sql.leidoNegocio.run(negocioId);
  return lista;
}

function sinLeer(negocioId) {
  return sql.sinLeer.get(negocioId).n;
}

// Bandeja del equipo. nombreDe(id) -> { nombre, email, plan } del negocio.
function bandeja({ estado = 'abiertas', nombreDe }) {
  const filas = estado === 'todas' ? sql.todas.all() : sql.abiertas.all();
  const c = sql.conteo.get();
  return {
    conteo: { abiertas: c.abiertas || 0, nuevas: c.nuevas || 0, respondidas: c.respondidas || 0 },
    solicitudes: filas.map((f) => {
      const u = sql.ultimo.get(f.id);
      return {
        id: f.id, tipo: f.tipo, tipoNombre: TIPOS[f.tipo] || f.tipo, asunto: f.asunto, estado: f.estado,
        creadoEl: f.creado_el, actualizadoEl: f.actualizado_el, nueva: !f.leido_equipo,
        negocio: nombreDe(f.negocio_id),
        ultimo: u ? { autor: u.autor, texto: u.texto.slice(0, 140) } : null,
      };
    }),
  };
}

function detalleEquipo(solicitudId) {
  const fila = sql.get.get(Number(solicitudId));
  if (!fila) return null;
  sql.leidoEquipo.run(fila.id);
  return publica(sql.get.get(fila.id), { conContexto: true });
}

module.exports = {
  TIPOS, crear, responder, cambiarEstado, obtener, delNegocio, sinLeer, bandeja, detalleEquipo, rutaAdjunto, publica,
};
