// Renderiza posts.html a PNG:  node render-posts.js
//   post-*      → ../posts/        (1080×1350)
//   hist-*      → ../historias/    (1080×1920)
//   destacada-* → ../destacadas/   (1080×1920)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 2000 } });
  await p.goto('file://' + path.join(__dirname, 'posts.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  const carpetas = { post: 'posts', hist: 'historias', destacada: 'destacadas' };
  for (const s of await p.$$('section')) {
    const id = await s.getAttribute('id');
    const dir = path.join(__dirname, '..', carpetas[id.split('-')[0]]);
    fs.mkdirSync(dir, { recursive: true });
    await s.screenshot({ path: path.join(dir, id + '.png') });
  }
  await b.close();
})();
