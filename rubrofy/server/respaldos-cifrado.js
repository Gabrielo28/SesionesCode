// Cifrado de los respaldos (AES-256-GCM con la clave RESPALDO_CLAVE). Va
// aparte para que scripts/restaurar-respaldo.js lo use sin abrir la base.
const crypto = require('crypto');

// Formato: "RBK1" + iv (12) + tag (16) + datos.
function cifrar(buf) {
  const clave = process.env.RESPALDO_CLAVE;
  if (!clave) return { buf, ext: '' };
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(clave).digest(), iv);
  const datos = Buffer.concat([c.update(buf), c.final()]);
  return { buf: Buffer.concat([Buffer.from('RBK1'), iv, c.getAuthTag(), datos]), ext: '.enc' };
}
function descifrar(buf, clave) {
  if (buf.slice(0, 4).toString() !== 'RBK1') throw new Error('No es un respaldo cifrado de Rubrofy');
  const d = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(clave).digest(), buf.slice(4, 16));
  d.setAuthTag(buf.slice(16, 32));
  return Buffer.concat([d.update(buf.slice(32)), d.final()]);
}

module.exports = { cifrar, descifrar };
