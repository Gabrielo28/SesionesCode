/*
 * Centro de escaneo — versión independiente (no necesita Claude).
 *
 * Guarda todo en un archivo JSON (DATA_DIR/centro.json), escanea la cola con el mismo
 * motor del escáner de mercado (mercado/escanear-mercado.js) y protege la app con la
 * contraseña de la variable CENTRO_CLAVE. Sin CENTRO_CLAVE solo responde desde el mismo
 * computador (localhost).
 *
 *   /centro            la app
 *   /centro/entrar     formulario de contraseña
 *   /api/...           datos (requiere sesión)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { slug, registrosDe, masNuevo } = require('./modelo.js');

const DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'datos'));
const ARCHIVO = path.join(DIR, 'centro.json');
const CLAVE = process.env.CENTRO_CLAVE || '';
const MERCADO = path.join(__dirname, '..', 'mercado');
const APP = path.join(__dirname, 'app.html');

// ---------- almacén ----------
let datos = { version: 1, negocios: {}, seguimiento: {}, cola: [] };
try { fs.mkdirSync(DIR, { recursive: true }); if (fs.existsSync(ARCHIVO)) datos = Object.assign(datos, JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'))); } catch (e) { console.error('No pude leer ' + ARCHIVO + ': ' + e.message); }
let guardando = null, pendiente = false;
function guardar() {
  if (guardando) { pendiente = true; return; }
  const tmp = ARCHIVO + '.tmp';
  guardando = fs.promises.writeFile(tmp, JSON.stringify(datos)).then(() => fs.promises.rename(tmp, ARCHIVO))
    .catch(e => console.error('Error al guardar: ' + e.message))
    .finally(() => { guardando = null; if (pendiente) { pendiente = false; guardar(); } });
}

// ---------- escaneo ----------
const escaneo = { activo: false, hechos: 0, total: 0, lote: '', mensaje: '', terminado: null };
function escanearCola() {
  if (escaneo.activo) return false;
  const pend = datos.cola.filter(c => c.estado === 'pendiente');
  if (!pend.length) return false;
  const lotes = {}; pend.forEach(c => { (lotes[c.lote || 'cola'] = lotes[c.lote || 'cola'] || []).push(c); });
  const cola = Object.entries(lotes);
  Object.assign(escaneo, { activo: true, hechos: 0, total: pend.length, mensaje: 'Abriendo navegador…', terminado: null });
  const siguiente = (k, acumulado) => {
    if (k >= cola.length) { Object.assign(escaneo, { activo: false, mensaje: 'Listo: ' + acumulado + ' negocios escaneados.', terminado: new Date().toISOString() }); return; }
    const [lote, items] = cola[k];
    escaneo.lote = lote;
    const nombre = 'centro-' + slug(lote) + '-' + Date.now();
    const csv = path.join(DIR, nombre + '.csv');
    const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
    fs.writeFileSync(csv, ['nombre,web,rubro,ciudad'].concat(items.map(i => [i.nombre, i.web, i.rubro, i.ciudad].map(q).join(','))).join('\n'));
    const base = escaneo.hechos;
    const p = spawn(process.execPath, [path.join(MERCADO, 'escanear-mercado.js'), csv, '--nombre', nombre], { cwd: MERCADO });
    let salida = '';
    const leer = b => { salida += b; const m = String(b).match(/(\d+)\/(\d+)/g); if (m) { const [h] = m[m.length - 1].split('/'); escaneo.hechos = base + (+h); escaneo.mensaje = 'Escaneando ' + lote + '…'; } if (/sin navegador/i.test(b)) escaneo.mensaje = 'Escaneando sin navegador: las webs hechas con JavaScript quedarán para revisar a mano.'; };
    p.stdout.on('data', leer); p.stderr.on('data', leer);
    p.on('close', code => {
      try { fs.unlinkSync(csv); } catch (e) {}
      const res = path.join(MERCADO, 'resultados', nombre + '.json');
      let n = 0;
      if (code === 0 && fs.existsSync(res)) {
        const r = JSON.parse(fs.readFileSync(res, 'utf8'));
        const regs = registrosDe(r, lote); n = Object.keys(regs).length;
        Object.assign(datos.negocios, regs);
        const ids = new Set(items.map(i => i.id));
        datos.cola.forEach(c => { if (ids.has(c.id)) { c.estado = 'escaneado'; c.escaneado = new Date().toISOString(); } });
        ['.json', '.csv', '.html'].forEach(ext => { try { fs.unlinkSync(path.join(MERCADO, 'resultados', nombre + ext)); } catch (e) {} });
      } else {
        const motivo = (salida.match(/Error:[^\n]*/) || ['el escáner terminó con error'])[0].slice(0, 160);
        const ids = new Set(items.map(i => i.id));
        datos.cola.forEach(c => { if (ids.has(c.id)) { c.estado = 'error'; c.error = motivo; } });
      }
      guardar();
      escaneo.hechos = base + items.length;
      siguiente(k + 1, acumulado + n);
    });
  };
  siguiente(0, 0);
  return true;
}

// ---------- sesión ----------
const firma = () => crypto.createHmac('sha256', CLAVE || 'local').update('centro-ok').digest('hex');
function cookies(req) { const o = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function esLocal(req) { const a = req.socket.remoteAddress || ''; return !req.headers['x-forwarded-for'] && (a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'); }
function autorizado(req) {
  if (!CLAVE) return esLocal(req);
  const c = cookies(req).centro || '';
  const a = Buffer.from(c), b = Buffer.from(firma());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const intentos = {};

// ---------- utilidades http ----------
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function cuerpo(req, max) {
  return new Promise((ok, mal) => { let b = ''; req.on('data', d => { b += d; if (b.length > (max || 25e6)) { mal(new Error('demasiado grande')); req.destroy(); } }); req.on('end', () => ok(b)); req.on('error', mal); });
}
const paginaEntrar = (error) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><link rel="icon" href="data:,"><title>Centro de escaneo</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B1A1B;color:#E6F1F1;font-family:system-ui,sans-serif;padding:16px}form{background:#10292B;border:1px solid #1F4548;border-radius:14px;padding:24px;width:min(360px,100%)}h1{font-size:18px;margin:0 0 4px;color:#2EC4CC;font-family:ui-monospace,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase}p{color:#8FB0B2;font-size:14px;margin:0 0 16px}input{width:100%;box-sizing:border-box;padding:12px;border-radius:9px;border:1px solid #1F4548;background:#153537;color:#E6F1F1;font-size:16px}button{margin-top:12px;width:100%;padding:12px;border:0;border-radius:30px;background:#2EC4CC;color:#06191A;font-weight:700;font-size:15px;cursor:pointer}.e{color:#FF6B6B;font-size:13px;margin-top:10px}</style></head>
<body><form method="post" action="/centro/entrar"><h1>Centro de escaneo</h1><p>Herramienta interna de Influence Chile.</p><label for="c" style="display:block;font-size:12px;color:#8FB0B2;margin-bottom:6px">Contraseña</label><input id="c" name="clave" type="password" autocomplete="current-password" autofocus required><button>Entrar</button>${error ? '<div class="e">' + error + '</div>' : ''}</form></body></html>`;

// Importa respaldo del Centro, resultados del escáner de mercado o el tablero HTML que trae los datos adentro
function importar(texto, nombreArchivo) {
  let obj = null;
  const t = texto.trim();
  if (t.startsWith('{')) obj = JSON.parse(t);
  else { const m = t.match(/var DATOS = (\{[\s\S]*?\});\s*\n\(function/); if (!m) throw new Error('No encontré datos en ese archivo.'); obj = JSON.parse(m[1]); }
  if (obj.negocios && !Array.isArray(obj.negocios) && obj.seguimiento) { // respaldo del Centro
    Object.assign(datos.negocios, obj.negocios);
    Object.entries(obj.seguimiento || {}).forEach(([id, s]) => { if (masNuevo(datos.seguimiento[id], s)) datos.seguimiento[id] = s; });
    // de la cola solo se traen los pendientes que no estén ya
    const ya = new Set(datos.cola.map(c => c.nombre + '|' + c.web));
    (obj.cola || []).filter(c => c.estado === 'pendiente' && !ya.has(c.nombre + '|' + c.web)).forEach(c => datos.cola.push(Object.assign({}, c, { id: /^[a-f0-9]{1,40}$/.test(c.id || '') ? c.id : crypto.randomBytes(6).toString('hex') })));
    return { negocios: Object.keys(obj.negocios).length, tipo: 'respaldo' };
  }
  if (Array.isArray(obj.negocios)) { // resultados del escáner de mercado (o tablero)
    const lote = slug(obj.loteCentro || (nombreArchivo || '').replace(/\.(json|html)$/i, '').replace(/^tablero-/, '') || obj.rubro || 'importado');
    const regs = registrosDe(obj, lote); Object.assign(datos.negocios, regs);
    return { negocios: Object.keys(regs).length, tipo: 'resultados', lote };
  }
  throw new Error('El archivo no tiene el formato del Centro ni del escáner de mercado.');
}

// ---------- rutas ----------
async function manejar(req, res) {
  const url = new URL(req.url, 'http://x'); const ruta = url.pathname;
  if (!(ruta === '/centro' || ruta.startsWith('/centro/') || ruta.startsWith('/api/'))) return false;

  if (ruta === '/centro/entrar') {
    if (req.method === 'POST') {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; const ahora = Date.now();
      intentos[ip] = (intentos[ip] || []).filter(t => ahora - t < 10 * 60e3);
      if (intentos[ip].length >= 10) { res.writeHead(429, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(paginaEntrar('Demasiados intentos. Espera 10 minutos.')); return true; }
      const clave = new URLSearchParams(await cuerpo(req, 1e4)).get('clave') || '';
      const a = crypto.createHash('sha256').update(clave).digest(), b = crypto.createHash('sha256').update(CLAVE).digest();
      if (CLAVE && crypto.timingSafeEqual(a, b)) {
        const seguro = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
        res.writeHead(302, { 'Set-Cookie': `centro=${firma()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 60}${seguro}`, Location: '/centro' }); res.end(); return true;
      }
      intentos[ip].push(ahora);
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(paginaEntrar(CLAVE ? 'Contraseña incorrecta.' : 'Falta configurar CENTRO_CLAVE en el servidor.')); return true;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(paginaEntrar('')); return true;
  }

  if (!autorizado(req)) {
    if (ruta.startsWith('/api/')) { json(res, 401, { error: 'sesion' }); return true; }
    if (!CLAVE) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('El Centro de escaneo solo se abre desde este computador. Para usarlo en internet, define la variable CENTRO_CLAVE.'); return true; }
    res.writeHead(302, { Location: '/centro/entrar' }); res.end(); return true;
  }

  if (ruta === '/centro' || ruta === '/centro/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); fs.createReadStream(APP).pipe(res); return true; }
  if (ruta === '/centro/modelo.js') { res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }); fs.createReadStream(path.join(__dirname, 'modelo.js')).pipe(res); return true; }
  if (ruta === '/centro/salir') { res.writeHead(302, { 'Set-Cookie': 'centro=; Path=/; Max-Age=0', Location: '/centro/entrar' }); res.end(); return true; }

  try {
    if (ruta === '/api/estado' && req.method === 'GET') { json(res, 200, { negocios: datos.negocios, seguimiento: datos.seguimiento, cola: datos.cola, escaneo }); return true; }
    let m;
    if ((m = ruta.match(/^\/api\/seguimiento\/([A-Za-z0-9._~:@+-]{1,200})$/)) && req.method === 'PUT') {
      const doc = JSON.parse(await cuerpo(req, 2e5)); datos.seguimiento[m[1]] = doc; guardar(); json(res, 200, { ok: true }); return true;
    }
    if (ruta === '/api/cola' && req.method === 'POST') {
      const { items, lote } = JSON.parse(await cuerpo(req, 2e6)); let n = 0;
      (items || []).forEach(i => { if (!i || !i.nombre || !i.web) return; datos.cola.push({ id: crypto.randomBytes(6).toString('hex'), nombre: String(i.nombre).slice(0, 200), web: String(i.web).slice(0, 300), rubro: String(i.rubro || '').slice(0, 120), ciudad: String(i.ciudad || '').slice(0, 120), lote: slug(lote || 'lista'), estado: 'pendiente', creado: new Date().toISOString() }); n++; });
      guardar(); json(res, 200, { agregados: n }); return true;
    }
    if ((m = ruta.match(/^\/api\/cola\/([a-f0-9]{1,40})$/)) && req.method === 'DELETE') { datos.cola = datos.cola.filter(c => c.id !== m[1]); guardar(); json(res, 200, { ok: true }); return true; }
    if (ruta === '/api/escanear' && req.method === 'POST') { const ok = escanearCola(); json(res, ok ? 200 : 409, ok ? { ok: true } : { error: escaneo.activo ? 'ya hay un escaneo en curso' : 'no hay pendientes en la cola' }); return true; }
    if (ruta === '/api/respaldo' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="centro-respaldo-${new Date().toISOString().slice(0, 10)}.json"` }); res.end(JSON.stringify(datos)); return true;
    }
    if (ruta === '/api/importar' && req.method === 'POST') { const r = importar(await cuerpo(req), url.searchParams.get('nombre') || ''); guardar(); json(res, 200, r); return true; }
  } catch (e) { json(res, 400, { error: e.message }); return true; }
  json(res, 404, { error: 'no encontrado' }); return true;
}

module.exports = { manejar, info: () => ({ archivo: ARCHIVO, conClave: !!CLAVE }) };
