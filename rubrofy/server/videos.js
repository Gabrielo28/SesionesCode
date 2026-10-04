// Mis videos: la galería de videos del negocio (los que sube, los creados
// con IA y los editados por Rubrofy). Los archivos viven junto a los de los
// reels (data/videos/<negocio>/lib-…). Un reel usa su propio nombre de
// archivo (enlace duro, o copia si no se puede): borrar el video de la
// galería no rompe el reel, ni al revés.

const fs = require('fs');
const crypto = require('crypto');
const store = require('./store');

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS videos_biblioteca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id TEXT NOT NULL,
    archivo TEXT NOT NULL,
    nombre TEXT,
    bytes INTEGER NOT NULL DEFAULT 0,
    duracion REAL,
    origen TEXT NOT NULL,          -- subido | ia | editado
    editado_de INTEGER,
    creado_el TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS videos_biblioteca_negocio ON videos_biblioteca (negocio_id, id);
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM videos_biblioteca WHERE negocio_id = ?').run(negocioId));

const sql = {
  crear: db.prepare('INSERT INTO videos_biblioteca (negocio_id, archivo, nombre, bytes, duracion, origen, editado_de, creado_el) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  get: db.prepare('SELECT * FROM videos_biblioteca WHERE negocio_id = ? AND id = ?'),
  lista: db.prepare('SELECT * FROM videos_biblioteca WHERE negocio_id = ? ORDER BY id DESC LIMIT 300'),
  borrar: db.prepare('DELETE FROM videos_biblioteca WHERE negocio_id = ? AND id = ?'),
  cuantos: db.prepare('SELECT COUNT(*) AS n FROM videos_biblioteca WHERE negocio_id = ?'),
};

const MAX_VIDEOS = 300;
const ORIGENES = new Set(['subido', 'ia', 'editado']);
const nombreArchivo = (ext) => `lib-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext || '.mp4'}`;
const extDe = (archivo) => (/\.mov$/i.test(archivo) ? '.mov' : '.mp4');

// Enlaza (o copia) un archivo de video a otro nombre en la carpeta del negocio.
function enlazar(origen, destino) {
  try { fs.linkSync(origen, destino); } catch (e) { fs.copyFileSync(origen, destino); }
}

function publico(fila, contenido) {
  const enReels = (contenido || []).filter((i) => i.video && i.video.desdeBiblioteca === fila.id && i.status !== 'rechazado')
    .map((i) => ({ id: i.id, titulo: String(i.gancho || i.headline || 'Reel').replace(/\n/g, ' ').slice(0, 80), publicado: !!(i.instagram && i.instagram.ok) }));
  return {
    id: fila.id, archivo: fila.archivo, nombre: fila.nombre || 'Video', bytes: fila.bytes, duracion: fila.duracion,
    origen: fila.origen, editadoDe: fila.editado_de || null, creadoEl: fila.creado_el, enReels,
  };
}

// Agrega a la galería un archivo que ya está en la carpeta de videos del
// negocio (se renombra). Devuelve la fila.
function agregar(negocioId, archivo, { nombre, duracion, origen = 'subido', editadoDe = null } = {}) {
  const ruta = store.videoAbsolutePath(negocioId, archivo);
  const bytes = fs.statSync(ruta).size;
  const id = Number(sql.crear.run(negocioId, archivo, String(nombre || 'Video').slice(0, 80), bytes,
    Number.isFinite(Number(duracion)) && Number(duracion) > 0 ? Math.round(Number(duracion) * 10) / 10 : null,
    ORIGENES.has(origen) ? origen : 'subido', editadoDe, new Date().toISOString()).lastInsertRowid);
  return sql.get.get(negocioId, id);
}

// Copia a la galería un video que usa un reel (subido en la tarjeta, creado
// con IA o editado). Devuelve el id nuevo, o null si no se pudo.
function desdeReel(negocioId, archivoReel, opciones = {}) {
  try {
    if (sql.cuantos.get(negocioId).n >= MAX_VIDEOS) return null;
    const archivo = nombreArchivo(extDe(archivoReel));
    enlazar(store.videoAbsolutePath(negocioId, archivoReel), store.videoAbsolutePath(negocioId, archivo));
    return agregar(negocioId, archivo, opciones).id;
  } catch (err) {
    console.log(`Mis videos: no se pudo copiar ${archivoReel} de ${negocioId}: ${err.message}`);
    return null;
  }
}

// El archivo del video de la galería con otro nombre, para un reel.
function copiarParaReel(negocioId, fila, nombreReel) {
  enlazar(store.videoAbsolutePath(negocioId, fila.archivo), store.videoAbsolutePath(negocioId, nombreReel));
  return fs.statSync(store.videoAbsolutePath(negocioId, nombreReel)).size;
}

function obtener(negocioId, id) {
  return sql.get.get(negocioId, Number(id)) || null;
}

function lista(negocioId) {
  const contenido = store.getContenido(negocioId);
  return sql.lista.all(negocioId).map((f) => publico(f, contenido));
}

function borrar(negocioId, id) {
  const f = obtener(negocioId, id);
  if (!f) return false;
  store.borrarVideo(negocioId, f.archivo);
  sql.borrar.run(negocioId, f.id);
  return true;
}

const lleno = (negocioId) => sql.cuantos.get(negocioId).n >= MAX_VIDEOS;

module.exports = { MAX_VIDEOS, nombreArchivo, extDe, agregar, desdeReel, copiarParaReel, obtener, lista, borrar, lleno, publico };
