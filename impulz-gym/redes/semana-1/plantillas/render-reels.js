// Renderiza las capas de texto de los reels (PNG transparentes 1080×1920):  node render-reels.js <carpeta-salida>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || path.join(__dirname, 'capas');
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 2000 } });
  await p.goto('file://' + path.join(__dirname, 'reels.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  for (const s of await p.$$('section.o')) {
    const id = await s.getAttribute('id');
    await s.screenshot({ path: path.join(out, id + '.png'), omitBackground: true });
  }
  await b.close();
})();
