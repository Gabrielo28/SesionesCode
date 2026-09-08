// Capa de datos: negocios y contenido guardados como JSON en disco.
// Cambiar a Postgres más adelante significa reescribir este archivo,
// no tocar server.js ni generator.js — toda la app pasa por estas funciones.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const NEGOCIOS_DIR = path.join(DATA_DIR, 'negocios');
const CONTENIDO_DIR = path.join(DATA_DIR, 'contenido');

for (const dir of [NEGOCIOS_DIR, CONTENIDO_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJSONAtomic(filePath, data) {
  const tmpPath = filePath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}

function negocioPath(id) {
  return path.join(NEGOCIOS_DIR, id + '.json');
}
function contenidoPath(id) {
  return path.join(CONTENIDO_DIR, id + '.json');
}

function listNegocios() {
  return fs
    .readdirSync(NEGOCIOS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJSON(path.join(NEGOCIOS_DIR, f), null))
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function getNegocio(id) {
  return readJSON(negocioPath(id), null);
}

function saveNegocio(negocio) {
  writeJSONAtomic(negocioPath(negocio.id), negocio);
  return negocio;
}

function getContenido(negocioId) {
  return readJSON(contenidoPath(negocioId), []);
}

function saveContenido(negocioId, items) {
  writeJSONAtomic(contenidoPath(negocioId), items);
  return items;
}

module.exports = {
  listNegocios,
  getNegocio,
  saveNegocio,
  getContenido,
  saveContenido,
};
