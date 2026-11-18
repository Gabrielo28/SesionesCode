// Renderiza las láminas del carrusel a PNG 1080×1350:  node render.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 1400 } });
  await p.goto('file://' + path.join(__dirname, 'carrusel.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  for (let i = 1; i <= 6; i++) {
    await (await p.$('#s' + i)).screenshot({ path: path.join(__dirname, '..', 'mie-carrusel-' + i + '.png') });
  }
  await b.close();
})();
