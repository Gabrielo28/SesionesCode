/*
 * Servidor estático del Escáner de Negocio — Influence Chile
 * Sin dependencias. Railway lo levanta con `node server.js` (ver railway.json).
 *
 *   /            → escaner/index.html   (el escáner)
 *   /proceso     → proceso/index.html   (radiografía de proceso)
 *   /<ruta>      → cualquier archivo de esta carpeta (html, js, json, pdf)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = __dirname;
const PUERTO = process.env.PORT || 5180;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const ALIAS = { '/': '/escaner/index.html', '/escaner': '/escaner/index.html', '/escaner/': '/escaner/index.html', '/proceso': '/proceso/index.html', '/proceso/': '/proceso/index.html' };

http.createServer((req, res) => {
  let ruta = decodeURIComponent((req.url || '/').split('?')[0]);
  ruta = ALIAS[ruta] || ruta;
  const archivo = path.normalize(path.join(RAIZ, ruta));
  if (!archivo.startsWith(RAIZ) || /(^|[\\/])\.(git|claude)/.test(ruta) || /server\.js$|package\.json$|railway\.json$/.test(ruta)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado');
  }
  fs.stat(archivo, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': ruta.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' });
    fs.createReadStream(archivo).pipe(res);
  });
}).listen(PUERTO, () => console.log('Escáner de Negocio en http://localhost:' + PUERTO));
