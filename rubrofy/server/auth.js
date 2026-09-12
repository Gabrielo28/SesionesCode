// Autenticación por negocio: cada negocio es su propia cuenta (self-service).
// Contraseñas con scrypt (costoso de fuerza bruta) + sesión firmada con HMAC,
// sin dependencias externas (ni bcrypt ni jsonwebtoken).

const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_DIAS = 30;

if (!process.env.SESSION_SECRET) {
  console.log('SESSION_SECRET no configurada: se generó una al azar para este proceso. Las sesiones no sobrevivirán un reinicio del servidor.');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hashEsperado) {
  const hash = Buffer.from(crypto.scryptSync(password, salt, 64).toString('hex'), 'hex');
  const esperado = Buffer.from(hashEsperado, 'hex');
  return hash.length === esperado.length && crypto.timingSafeEqual(hash, esperado);
}

function firmar(payload) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
}

function crearSesion(negocioId) {
  const vence = Date.now() + SESSION_DIAS * 24 * 60 * 60 * 1000;
  const payload = `${negocioId}.${vence}`;
  return `${payload}.${firmar(payload)}`;
}

function verificarSesion(token) {
  if (!token) return null;
  const partes = String(token).split('.');
  if (partes.length !== 3) return null;
  const [negocioId, venceStr, firma] = partes;
  if (!/^[0-9]+$/.test(venceStr) || !/^[a-f0-9]{64}$/.test(firma)) return null;

  const esperada = Buffer.from(firmar(`${negocioId}.${venceStr}`), 'hex');
  const recibida = Buffer.from(firma, 'hex');
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  if (Number(venceStr) < Date.now()) return null;
  return negocioId;
}

function leerCookie(req, nombre) {
  const header = req.headers.cookie || '';
  for (const parte of header.split(';')) {
    const idx = parte.indexOf('=');
    if (idx === -1) continue;
    if (parte.slice(0, idx).trim() === nombre) return decodeURIComponent(parte.slice(idx + 1).trim());
  }
  return null;
}

function cookieSesion(req, token) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  const maxAge = token ? SESSION_DIAS * 24 * 60 * 60 : 0;
  return `rubrofy_sesion=${token || ''}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

module.exports = { hashPassword, verifyPassword, crearSesion, verificarSesion, leerCookie, cookieSesion };
