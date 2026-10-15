/*
 * Convierte las plantillas HTML a PNG en el tamaño de cada pieza.
 *   node build.js            todas
 *   node build.js story      solo las que contengan "story" en el nombre
 * Requiere Playwright (npm run pdf:instalar en influence-fit/) o Chrome.
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'plantillas');
const out = path.join(__dirname, 'png');
fs.mkdirSync(out, { recursive: true });
const filtro = process.argv[2] || '';
const archivos = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f.includes(filtro)).sort();

(async () => {
  const { chromium } = require('playwright');
  const exe = fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  const b = await chromium.launch(exe).catch(() => chromium.launch());
  for (const f of archivos) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = html.match(/<!--\s*(\d+)x(\d+)/);
    const w = m ? +m[1] : 1080, h = m ? +m[2] : 1350;
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.goto('file://' + path.join(dir, f), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const png = path.join(out, f.replace(/\.html$/, '.png'));
    await p.screenshot({ path: png, clip: { x: 0, y: 0, width: w, height: h } });
    console.log(`${f} -> ${w}x${h}`);
    await p.close();
  }
  await b.close();
})();
