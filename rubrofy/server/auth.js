// Autenticación por negocio: cada negocio es su propia cuenta (self-service).
// Contraseñas con scrypt (costoso de fuerza bruta) + sesión firmada con HMAC,
// sin dependencias externas (ni bcrypt ni jsonwebtoken).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./datos');

// Clave que firma las sesiones y los enlaces temporales. Si no viene en
// SESSION_SECRET, se genera una vez y se guarda en la carpeta de datos
// (el Volume en producción): así las sesiones sobreviven a cada redeploy.
function claveDeSesion() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const archivo = path.join(DATA_DIR, '.session-secret');
  try {
    const guardada = fs.readFileSync(archivo, 'utf8').trim();
    if (guardada.length >= 32) return guardada;
  } catch (err) {
    // todavía no existe
  }
  const nueva = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(archivo, nueva, { mode: 0o600 });
    console.log(`SESSION_SECRET no configurada: se generó una y se guardó en ${archivo}.`);
  } catch (err) {
    console.log('SESSION_SECRET no configurada y no se pudo guardar una: las sesiones no sobrevivirán un reinicio.');
  }
  return nueva;
}

const SESSION_SECRET = claveDeSesion();
const SESSION_DIAS = 30;

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

// Cuándo se emitió una sesión válida (ms), para invalidar las anteriores a
// un cambio de clave. null si el token no es válido.
function emisionSesion(token) {
  if (!verificarSesion(token)) return null;
  return Number(String(token).split('.')[1]) - SESSION_DIAS * 24 * 60 * 60 * 1000;
}

// Token de corta duración para exponer UNA foto puntual sin sesión —
// Instagram necesita descargar la imagen desde un servidor público para
// poder publicarla, así que en vez de abrir /fotos entero, generamos un
// enlace temporal (5 min) válido solo para ese archivo exacto.
const FOTO_TOKEN_MINUTOS = 5;

// `minutos`: los videos usan un plazo más largo, porque Meta puede tardar
// en descargarlos mientras procesa un Reel.
function crearTokenFoto(negocioId, categoria, archivo, minutos = FOTO_TOKEN_MINUTOS) {
  const vence = Date.now() + minutos * 60 * 1000;
  const payload = `${negocioId}/${categoria}/${archivo}.${vence}`;
  return `${vence}.${firmar(payload)}`;
}

function verificarTokenFoto(token, negocioId, categoria, archivo) {
  if (!token) return false;
  const partes = String(token).split('.');
  if (partes.length !== 2) return false;
  const [venceStr, firma] = partes;
  if (!/^[0-9]+$/.test(venceStr) || !/^[a-f0-9]{64}$/.test(firma)) return false;
  if (Number(venceStr) < Date.now()) return false;

  const payload = `${negocioId}/${categoria}/${archivo}.${venceStr}`;
  const esperada = Buffer.from(firmar(payload), 'hex');
  const recibida = Buffer.from(firma, 'hex');
  return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida);
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

module.exports = {
  hashPassword, verifyPassword, crearSesion, verificarSesion, leerCookie, cookieSesion,
  crearTokenFoto, verificarTokenFoto, emisionSesion,
};
