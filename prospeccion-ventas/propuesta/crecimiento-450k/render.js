// Uso: node render.js [nombre-archivo-sin-extension]   (por defecto: propuesta-crecimiento-450k)
// En Windows define CHROME con la ruta de Chrome.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = __dirname, name = process.argv[2] || 'propuesta-crecimiento-450k';
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('file://' + path.join(dir, name + '.html'), { waitUntil: 'networkidle' });
  await p.pdf({ path: path.join(dir, name + '.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await b.close(); console.log('pdf ok ->', name + '.pdf');
})();
