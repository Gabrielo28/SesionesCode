// Carpeta donde viven los datos (base SQLite, fotos, videos, ejemplos de
// estilo). En producción tiene que estar en un disco persistente: en
// Railway, un Volume. Se toma, en este orden:
//   1. RUBROFY_DATA_DIR (recomendado: la ruta donde se montó el Volume),
//   2. RAILWAY_VOLUME_MOUNT_PATH (la que Railway informa si hay un Volume),
//   3. rubrofy/data (desarrollo local).
const path = require('path');

const DATA_DIR = path.resolve(process.env.RUBROFY_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'data'));

module.exports = { DATA_DIR };
