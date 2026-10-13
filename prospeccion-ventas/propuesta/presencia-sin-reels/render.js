// Renderiza el HTML a PDF. En Windows cambia executablePath a la ruta de Chrome.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const dir = __dirname;
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('file://' + path.join(dir, 'propuesta-presencia-sin-reels.html'), { waitUntil: 'networkidle' });
  await p.pdf({ path: path.join(dir, 'propuesta-presencia-sin-reels.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await b.close(); console.log('pdf ok');
})();
