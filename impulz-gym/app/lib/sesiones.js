/*
 * Usuarios y sesiones. Los usuarios se definen en variables de entorno (Railway → Variables):
 *
 *   ADMIN_USUARIO / ADMIN_CLAVE           tú: ves todo, incluida tu inversión y ganancia
 *   DUENO_USUARIO / DUENO_CLAVE           dueño del gimnasio
 *   RECEPCION_USUARIO / RECEPCION_CLAVE   (opcional) recepción, mismos permisos que el dueño
 *   SESION_SECRETO                        texto largo al azar para firmar las sesiones
 *
 * La sesión es una cookie firmada (HMAC). No hay base de datos de usuarios.
 */
const crypto = require('crypto');

function usuarios() {
  const lista = [];
  const agregar = (rol, u, c) => { if (u && c) lista.push({ rol, usuario: String(u).trim().toLowerCase(), clave: String(c) }); };
  agregar('admin', process.env.ADMIN_USUARIO, process.env.ADMIN_CLAVE);
  agregar('dueno', process.env.DUENO_USUARIO, process.env.DUENO_CLAVE);
  agregar('recepcion', process.env.RECEPCION_USUARIO, process.env.RECEPCION_CLAVE);
  return lista;
}

const SECRETO = process.env.SESION_SECRETO || crypto.createHash('sha256').update('impulz:' + (process.env.ADMIN_CLAVE || crypto.randomBytes(16).toString('hex'))).digest('hex');
const DURACION = 30 * 24 * 3600 * 1000;
const NOMBRE = 'impulz_sesion';

const igual = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const firmar = datos => crypto.createHmac('sha256', SECRETO).update(datos).digest('base64url');

function verificarClave(usuario, clave) {
  const u = String(usuario || '').trim().toLowerCase();
  let encontrado = null;
  for (const x of usuarios()) if (igual(x.usuario, u) && igual(x.clave, clave || '')) encontrado = x;
  return encontrado ? { usuario: encontrado.usuario, rol: encontrado.rol } : null;
}

function crearCookie(sesion, req) {
  const datos = Buffer.from(JSON.stringify({ ...sesion, exp: Date.now() + DURACION })).toString('base64url');
  const seguro = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
  return `${NOMBRE}=${datos}.${firmar(datos)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACION / 1000}${seguro}`;
}
const borrarCookie = () => `${NOMBRE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

function leerSesion(req) {
  const m = (req.headers.cookie || '').match(new RegExp(NOMBRE + '=([^;]+)'));
  if (!m) return null;
  const [datos, firma] = m[1].split('.');
  if (!datos || !firma || !igual(firma, firmar(datos))) return null;
  try {
    const s = JSON.parse(Buffer.from(datos, 'base64url').toString());
    if (s.exp < Date.now()) return null;
    // si cambiaron las claves en Railway y el usuario ya no existe, la sesión deja de valer
    if (!usuarios().some(x => x.usuario === s.usuario && x.rol === s.rol)) return null;
    return { usuario: s.usuario, rol: s.rol };
  } catch (e) { return null; }
}

module.exports = { usuarios, verificarClave, crearCookie, borrarCookie, leerSesion };
