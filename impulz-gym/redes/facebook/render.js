// Renderiza las imágenes de Facebook desde plantillas.html:  node render.js
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1700, height: 1500 } });
  await p.goto('file://' + path.join(__dirname, 'plantillas.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await (await p.$('#perfil')).screenshot({ path: path.join(__dirname, 'impulz-perfil.png') });
  await (await p.$('#portada')).screenshot({ path: path.join(__dirname, 'impulz-portada.png') });
  await b.close();
})();
