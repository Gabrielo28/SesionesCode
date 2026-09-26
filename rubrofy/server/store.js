// Capa de datos. Negocios y colas de contenido viven en SQLite (el módulo
// node:sqlite que trae Node desde la 22.13: cero dependencias, mismo
// criterio que el resto del proyecto); fotos y videos siguen como archivos
// en data/. Toda la app pasa por estas funciones: cambiar a Postgres más
// adelante significa reescribir este archivo, no server.js ni el resto.
//
// Las funciones son síncronas a propósito: un leer-modificar-guardar sin
// `await` entre medio no se intercala con otros requests (ver publicador.js).

const fs = require('fs');
const path = require('path');

// node:sqlite avisa en cada arranque que es "experimental"; se silencia solo
// ese aviso para no ensuciar los logs.
const emitirAviso = process.emitWarning;
process.emitWarning = function (aviso, ...resto) {
  if (String(aviso && aviso.message ? aviso.message : aviso).includes('SQLite is an experimental')) return;
  return emitirAviso.call(process, aviso, ...resto);
};
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NEGOCIOS_DIR = path.join(DATA_DIR, 'negocios');
const CONTENIDO_DIR = path.join(DATA_DIR, 'contenido');
const FOTOS_DIR = path.join(DATA_DIR, 'fotos');
const FOTOS_IA_DIR = path.join(DATA_DIR, 'fotos-ia');
const VIDEOS_DIR = path.join(DATA_DIR, 'videos');
const DB_PATH = process.env.RUBROFY_DB || path.join(DATA_DIR, 'rubrofy.db');

for (const dir of [DATA_DIR, FOTOS_DIR, FOTOS_IA_DIR, VIDEOS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS negocios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT,
    doc TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS negocios_email ON negocios (email);
  CREATE TABLE IF NOT EXISTS contenido (
    negocio_id TEXT PRIMARY KEY,
    items TEXT NOT NULL
  );
`);

const sql = {
  listNegocios: db.prepare('SELECT doc FROM negocios ORDER BY nombre COLLATE NOCASE'),
  getNegocio: db.prepare('SELECT doc FROM negocios WHERE id = ?'),
  saveNegocio: db.prepare(`INSERT INTO negocios (id, nombre, email, doc) VALUES (?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, email = excluded.email, doc = excluded.doc`),
  deleteNegocio: db.prepare('DELETE FROM negocios WHERE id = ?'),
  getContenido: db.prepare('SELECT items FROM contenido WHERE negocio_id = ?'),
  saveContenido: db.prepare(`INSERT INTO contenido (negocio_id, items) VALUES (?, ?)
    ON CONFLICT (negocio_id) DO UPDATE SET items = excluded.items`),
  deleteContenido: db.prepare('DELETE FROM contenido WHERE negocio_id = ?'),
};

// Varias escrituras como una sola: si algo falla a mitad, no queda nada a medias.
function transaccion(fn) {
  db.exec('BEGIN');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function listNegocios() {
  return sql.listNegocios.all().map((fila) => JSON.parse(fila.doc));
}

function getNegocio(id) {
  const fila = sql.getNegocio.get(String(id));
  return fila ? JSON.parse(fila.doc) : null;
}

function saveNegocio(negocio) {
  sql.saveNegocio.run(negocio.id, negocio.nombre || '', negocio.email || null, JSON.stringify(negocio));
  return negocio;
}

function getContenido(negocioId) {
  const fila = sql.getContenido.get(String(negocioId));
  return fila ? JSON.parse(fila.items) : [];
}

function saveContenido(negocioId, items) {
  sql.saveContenido.run(negocioId, JSON.stringify(items));
  return items;
}

// Migración única desde la versión con archivos JSON: si la base está vacía
// y existen data/negocios/*.json, se importan en una transacción y las
// carpetas viejas quedan renombradas como respaldo (no se borran).
function migrarDesdeJSON() {
  if (!fs.existsSync(NEGOCIOS_DIR)) return;
  const yaHayDatos = db.prepare('SELECT COUNT(*) AS n FROM negocios').get().n > 0;
  if (yaHayDatos) return;
  const archivos = fs.readdirSync(NEGOCIOS_DIR).filter((f) => f.endsWith('.json'));
  if (!archivos.length) return;

  transaccion(() => {
    for (const archivo of archivos) {
      const negocio = JSON.parse(fs.readFileSync(path.join(NEGOCIOS_DIR, archivo), 'utf8'));
      saveNegocio(negocio);
      const contenidoArchivo = path.join(CONTENIDO_DIR, archivo);
      if (fs.existsSync(contenidoArchivo)) {
        saveContenido(negocio.id, JSON.parse(fs.readFileSync(contenidoArchivo, 'utf8')));
      }
    }
  });
  const sufijo = '.migrado-' + new Date().toISOString().slice(0, 10);
  fs.renameSync(NEGOCIOS_DIR, NEGOCIOS_DIR + sufijo);
  if (fs.existsSync(CONTENIDO_DIR)) fs.renameSync(CONTENIDO_DIR, CONTENIDO_DIR + sufijo);
  console.log(`Base de datos: se migraron ${archivos.length} negocio(s) desde los archivos JSON (respaldo en data/*${sufijo}).`);
}
migrarDesdeJSON();

function deleteNegocio(negocioId) {
  transaccion(() => {
    for (const borrar of alBorrarNegocio) borrar(negocioId);
    sql.deleteContenido.run(negocioId);
    sql.deleteNegocio.run(negocioId);
  });
  fs.rmSync(path.join(FOTOS_DIR, negocioId), { recursive: true, force: true });
  fs.rmSync(path.join(FOTOS_IA_DIR, negocioId), { recursive: true, force: true });
  fs.rmSync(path.join(VIDEOS_DIR, negocioId), { recursive: true, force: true });
}

// --- fotos: data/fotos/<negocioId>/<categoria>/<archivo> ---

function negocioFotosDir(negocioId) {
  return path.join(FOTOS_DIR, negocioId);
}

function listFotos(negocioId) {
  const dir = negocioFotosDir(negocioId);
  const resultado = {};
  if (!fs.existsSync(dir)) return resultado;
  for (const categoria of fs.readdirSync(dir)) {
    const catDir = path.join(dir, categoria);
    if (!fs.statSync(catDir).isDirectory()) continue;
    resultado[categoria] = fs.readdirSync(catDir).sort();
  }
  return resultado;
}

function addFoto(negocioId, categoria, filename, buffer) {
  const dir = path.join(negocioFotosDir(negocioId), categoria);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
}

function deleteFoto(negocioId, categoria, filename) {
  const filePath = path.join(negocioFotosDir(negocioId), categoria, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function fotoAbsolutePath(negocioId, categoria, filename) {
  return path.join(negocioFotosDir(negocioId), categoria, filename);
}

// --- fotos generadas por IA: data/fotos-ia/<negocioId>/<itemId>.png ---
// Una por pieza de contenido (no por categoría) — cada pieza tiene su propio
// enfoque y headline, así que su foto de respaldo generada es única.

function fotoIAAbsolutePath(negocioId, itemId) {
  return path.join(FOTOS_IA_DIR, negocioId, itemId + '.png');
}

function tieneFotoIA(negocioId, itemId) {
  return fs.existsSync(fotoIAAbsolutePath(negocioId, itemId));
}

function guardarFotoIA(negocioId, itemId, buffer) {
  const dir = path.join(FOTOS_IA_DIR, negocioId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fotoIAAbsolutePath(negocioId, itemId), buffer);
}

// --- videos de Reels/historias: data/videos/<negocioId>/<itemId>.<ext> ---
// Uno por pieza. Se escriben por streaming desde server.js (pueden pesar
// decenas de MB), así que acá solo se resuelven rutas y se borran.

function videoDir(negocioId) {
  return path.join(VIDEOS_DIR, negocioId);
}

function videoAbsolutePath(negocioId, archivo) {
  return path.join(videoDir(negocioId), archivo);
}

function borrarVideo(negocioId, archivo) {
  if (archivo) fs.rmSync(videoAbsolutePath(negocioId, archivo), { force: true });
}

// Otros módulos (analítica, ads...) guardan tablas propias por negocio y se
// registran acá para que al eliminar una cuenta no quede nada suyo.
const alBorrarNegocio = [];
function registrarLimpieza(fn) {
  alBorrarNegocio.push(fn);
}

module.exports = {
  db,
  transaccion,
  registrarLimpieza,
  listNegocios,
  getNegocio,
  saveNegocio,
  getContenido,
  saveContenido,
  deleteNegocio,
  listFotos,
  addFoto,
  deleteFoto,
  fotoAbsolutePath,
  tieneFotoIA,
  guardarFotoIA,
  fotoIAAbsolutePath,
  videoDir,
  videoAbsolutePath,
  borrarVideo,
  FOTOS_DIR,
  FOTOS_IA_DIR,
  VIDEOS_DIR,
};
