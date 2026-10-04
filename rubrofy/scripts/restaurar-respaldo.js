#!/usr/bin/env node
// Convierte un respaldo de la base (descargado del bucket) en un archivo
// SQLite listo para usar.
//
//   node scripts/restaurar-respaldo.js rubrofy-lunes.db.gz rubrofy.db
//   RESPALDO_CLAVE=... node scripts/restaurar-respaldo.js rubrofy-lunes.db.gz.enc rubrofy.db
//
// Para volver a ese punto en Railway: detén el servicio, reemplaza
// rubrofy.db en el Volume (y borra rubrofy.db-wal y rubrofy.db-shm si
// existen) y vuelve a encenderlo. Las fotos y videos están en archivos/ del
// bucket, con la misma estructura que la carpeta data.
const fs = require('fs');
const zlib = require('zlib');
const { descifrar } = require('../server/respaldos-cifrado');

const [origen, destino] = process.argv.slice(2);
if (!origen || !destino) {
  console.error('Uso: node scripts/restaurar-respaldo.js <respaldo.db.gz[.enc]> <destino.db>');
  process.exit(1);
}
if (fs.existsSync(destino)) {
  console.error(`${destino} ya existe: elige otro nombre para no pisarlo.`);
  process.exit(1);
}
let datos = fs.readFileSync(origen);
if (origen.endsWith('.enc')) {
  if (!process.env.RESPALDO_CLAVE) { console.error('Este respaldo está cifrado: define RESPALDO_CLAVE con la misma clave del servidor.'); process.exit(1); }
  datos = descifrar(datos, process.env.RESPALDO_CLAVE);
}
const base = zlib.gunzipSync(datos);
if (base.slice(0, 15).toString() !== 'SQLite format 3') { console.error('El archivo no es una base SQLite válida.'); process.exit(1); }
fs.writeFileSync(destino, base);
console.log(`Listo: ${destino} (${Math.round(base.length / 1024)} KB).`);
