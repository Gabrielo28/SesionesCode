/*
 * Genera centro-de-escaneo.html (la versión artifact de claude.ai) a partir de app.html
 * (la versión independiente). Edita app.html y corre:  node armar-artifact.js
 */
const fs = require('fs'), path = require('path');
const app = fs.readFileSync(path.join(__dirname, 'app.html'), 'utf8');
const cod = fs.readFileSync(path.join(__dirname, '..', 'escaner', 'codigos.js'), 'utf8');
const cabeza = app.slice(app.indexOf('<title>'), app.indexOf('\n</head>'));
const cuerpo = app.slice(app.indexOf('<body>') + 6, app.lastIndexOf('\n</body>'));
const modelo = fs.readFileSync(path.join(__dirname, 'modelo.js'), 'utf8');
const salida = cabeza + cuerpo.replace('<script src="/escaner/codigos.js"></script>', () => '<script>\n' + cod + '\n</script>')
  .replace('<script src="/centro/modelo.js"></script>', () => '<script>\n' + modelo + '\n</script>') + '\n';
fs.writeFileSync(path.join(__dirname, 'centro-de-escaneo.html'), salida);
console.log('centro-de-escaneo.html listo (' + Math.round(salida.length / 1024) + ' KB)');
