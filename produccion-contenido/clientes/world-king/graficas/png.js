const zlib = require('zlib');

// --- CRC32 (tabla PNG estandar) ---
const TABLA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABLA[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const trozo = (tipo, datos) => {
  const cab = Buffer.alloc(8);
  cab.writeUInt32BE(datos.length, 0);
  cab.write(tipo, 4, 'ascii');
  const cola = Buffer.alloc(4);
  cola.writeUInt32BE(crc32(Buffer.concat([cab.slice(4), datos])), 0);
  return Buffer.concat([cab, datos, cola]);
};

// Devuelve {ancho, alto, canales, pixeles} de un PNG RGB/RGBA de 8 bits sin entrelazar.
function leerPNG(buf) {
  let i = 8, ihdr = null;
  const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const tipo = buf.toString('ascii', i + 4, i + 8);
    const datos = buf.slice(i + 8, i + 8 + len);
    if (tipo === 'IHDR') ihdr = datos;
    else if (tipo === 'IDAT') idat.push(datos);
    else if (tipo === 'IEND') break;
    i += 12 + len;
  }
  const ancho = ihdr.readUInt32BE(0), alto = ihdr.readUInt32BE(4);
  const prof = ihdr[8], tipoColor = ihdr[9], entrelazado = ihdr[12];
  if (prof !== 8 || entrelazado !== 0 || (tipoColor !== 2 && tipoColor !== 6))
    throw new Error(`PNG no soportado: prof=${prof} color=${tipoColor} entrelazado=${entrelazado}`);
  const canales = tipoColor === 6 ? 4 : 3;
  const bruto = zlib.inflateSync(Buffer.concat(idat));
  const paso = ancho * canales;
  const pix = Buffer.alloc(alto * paso);
  let p = 0;
  for (let y = 0; y < alto; y++) {
    const filtro = bruto[p++];
    const fila = bruto.slice(p, p + paso); p += paso;
    const dst = pix.slice(y * paso, (y + 1) * paso);
    const arriba = y ? pix.slice((y - 1) * paso, y * paso) : null;
    for (let x = 0; x < paso; x++) {
      const a = x >= canales ? dst[x - canales] : 0;
      const b = arriba ? arriba[x] : 0;
      const c = arriba && x >= canales ? arriba[x - canales] : 0;
      let v = fila[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      dst[x] = v & 0xFF;
    }
  }
  return { ancho, alto, canales, pix, tipoColor };
}

// Recorta el PNG a las primeras `alto` filas y lo reescribe.
function recortarAlto(buf, alto) {
  const im = leerPNG(buf);
  if (im.alto === alto) return buf;
  const paso = im.ancho * im.canales;
  const bruto = Buffer.alloc(alto * (paso + 1));
  for (let y = 0; y < alto; y++) {
    bruto[y * (paso + 1)] = 0;                       // filtro None: simple y comprime bien
    im.pix.copy(bruto, y * (paso + 1) + 1, y * paso, (y + 1) * paso);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(im.ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; ihdr[9] = im.tipoColor; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(bruto, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}
module.exports = { leerPNG, recortarAlto };
