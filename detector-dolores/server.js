/*
 * Servidor del Escáner de Negocio — Influence Chile
 * Railway lo levanta con `node server.js` (ver railway.json). En tu PC: `npm start`.
 *
 *   /            → escaner/index.html   (el escáner público)
 *   /proceso     → proceso/index.html   (radiografía de proceso)
 *   /centro      → Centro de escaneo, la herramienta interna (contraseña: variable CENTRO_CLAVE)
 *
 * Solo se entregan archivos públicos (escaner/, proceso/, medicion.js). Los datos del
 * Centro y los resultados de los escaneos nunca se sirven como archivos.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const centro = require('./centro/servidor-centro.js');

const RAIZ = __dirname;
const PUERTO = process.env.PORT || 5180;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const ALIAS = { '/': '/escaner/index.html', '/escaner': '/escaner/index.html', '/escaner/': '/escaner/index.html', '/proceso': '/proceso/index.html', '/proceso/': '/proceso/index.html' };
const PUBLICO = [/^\/escaner\/(index\.html|codigos\.js)$/, /^\/proceso\/index\.html$/, /^\/medicion\.js$/];

function noEncontrado(res) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No encontrado'); }

http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try { if (await centro.manejar(req, res)) return; } catch (e) { console.error(e); if (!res.headersSent) { res.writeHead(500); res.end('Error'); } return; }
  let ruta;
  try { ruta = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { return noEncontrado(res); }
  ruta = ALIAS[ruta] || ruta;
  if (!PUBLICO.some(re => re.test(ruta))) return noEncontrado(res);
  const archivo = path.join(RAIZ, ruta);
  fs.stat(archivo, (err, st) => {
    if (err || !st.isFile()) return noEncontrado(res);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': ruta.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
    fs.createReadStream(archivo).pipe(res);
  });
}).listen(PUERTO, () => {
  const i = centro.info();
  console.log('Escáner de Negocio en http://localhost:' + PUERTO);
  console.log('Centro de escaneo en http://localhost:' + PUERTO + '/centro' + (i.conClave ? ' (con contraseña)' : ' (solo desde este computador)'));
  console.log('Datos del Centro: ' + i.archivo);
});
