// Kit de marca y diseños: el logo, los colores, la tipografía y el llamado a
// la acción por defecto de cada negocio, más las imágenes que el panel
// arma con una plantilla (public/app/diseno.js) sobre la foto de una pieza.
//
// El diseño se dibuja en el navegador (canvas) y llega aquí ya listo como
// JPEG: el servidor solo valida que sea una imagen y la guarda. Al publicar,
// la pieza usa el diseño en vez de la foto original, que no se toca.
//
// Archivos: data/marca/<negocioId>/logo-<t>.<ext> y diseno-<itemId>-<t>.jpg

const fs = require('fs');
const path = require('path');
const store = require('./store');
const { DATA_DIR } = require('./datos');

const MARCA_DIR = path.join(DATA_DIR, 'marca');
fs.mkdirSync(MARCA_DIR, { recursive: true });

const FUENTES = ['Plus Jakarta Sans', 'Oswald', 'Playfair Display', 'Caveat'];
const POSICIONES = ['si', 'sd', 'ii', 'id']; // superior/inferior · izquierda/derecha
const PLANTILLAS = ['titular', 'precio', 'frase', 'logo', 'historia'];
const MAX_LOGO = 2 * 1024 * 1024;
const MAX_DISENO = 6 * 1024 * 1024;

store.registrarLimpieza((negocioId) => fs.rmSync(path.join(MARCA_DIR, path.basename(negocioId)), { recursive: true, force: true }));

const color = (v, def) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : def);

// Solo se tocan los campos que vienen. El logo se sube aparte.
function normalizar(body, actual) {
  const a = Object.assign({ color: '#ff4d94', color2: '#141217', fuente: 'Plus Jakarta Sans', posLogo: 'sd', cta: '' }, actual || {});
  const b = body || {};
  return Object.assign({}, a, {
    color: b.color === undefined ? a.color : color(b.color, a.color),
    color2: b.color2 === undefined ? a.color2 : color(b.color2, a.color2),
    fuente: FUENTES.includes(b.fuente) ? b.fuente : a.fuente,
    posLogo: POSICIONES.includes(b.posLogo) ? b.posLogo : a.posLogo,
    cta: b.cta === undefined ? a.cta : String(b.cta || '').replace(/\s+/g, ' ').trim().slice(0, 60),
  });
}

// Reconoce PNG, JPEG y WebP por sus primeros bytes (no por lo que diga el cliente).
function tipoImagen(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function dir(negocioId) {
  const d = path.join(MARCA_DIR, path.basename(negocioId));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function ruta(negocioId, archivo) {
  return path.join(MARCA_DIR, path.basename(negocioId), path.basename(archivo));
}

function decodificar(dataBase64, max) {
  const base64 = String(dataBase64 || '').replace(/^data:[^,]+,/, '');
  if (!base64) return { error: 'Falta la imagen' };
  const buf = Buffer.from(base64, 'base64');
  if (buf.length > max) return { error: `La imagen pesa más de ${Math.round(max / 1048576)} MB` };
  const tipo = tipoImagen(buf);
  if (!tipo) return { error: 'El archivo no es una imagen PNG, JPG o WebP' };
  return { buf, tipo };
}

// Devuelve { archivo } o { error }. Borra el logo anterior.
function guardarLogo(negocioId, dataBase64, anterior) {
  const r = decodificar(dataBase64, MAX_LOGO);
  if (r.error) return r;
  return guardarImagen(negocioId, 'logo', r.buf, anterior);
}

// Guarda una imagen ya leída (logo, o el logo que se encontró en la web del
// negocio mientras el dueño decide si lo usa). Borra la anterior.
function guardarImagen(negocioId, prefijo, buf, anterior) {
  const tipo = tipoImagen(buf);
  if (!tipo) return { error: 'El archivo no es una imagen PNG, JPG o WebP' };
  if (buf.length > MAX_LOGO) return { error: 'La imagen pesa más de 2 MB' };
  const archivo = `${prefijo}-${Date.now()}.${tipo}`;
  fs.writeFileSync(path.join(dir(negocioId), archivo), buf);
  if (anterior && anterior !== archivo) fs.rmSync(ruta(negocioId, anterior), { force: true });
  return { archivo };
}

function borrar(negocioId, archivo) {
  if (archivo) fs.rmSync(ruta(negocioId, archivo), { force: true });
}

// El diseño de una pieza: siempre JPEG (lo exporta el canvas del panel).
function guardarDiseno(negocioId, itemId, dataBase64, anterior) {
  const r = decodificar(dataBase64, MAX_DISENO);
  if (r.error) return r;
  if (r.tipo !== 'jpg') return { error: 'El diseño debe llegar como JPG' };
  const archivo = `diseno-${String(itemId).replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(dir(negocioId), archivo), r.buf);
  if (anterior) borrar(negocioId, anterior);
  return { archivo };
}

module.exports = { MARCA_DIR, FUENTES, POSICIONES, PLANTILLAS, normalizar, guardarLogo, guardarImagen, guardarDiseno, borrar, ruta, tipoImagen };
