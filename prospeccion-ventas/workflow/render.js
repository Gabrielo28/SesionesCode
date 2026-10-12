const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1123, height: 794 } });
  await p.goto('file:///home/user/SesionesCode/prospeccion-ventas/workflow/workflow-prospeccion.html', { waitUntil: 'networkidle' });
  await p.emulateMedia({ media: 'print' });
  const secs = await p.$$('section.page');
  for (let i = 0; i < secs.length; i++) await secs[i].screenshot({ path: `/home/user/SesionesCode/prospeccion-ventas/workflow/workflow-p${i+1}.png` });
  await p.pdf({ path: '/home/user/SesionesCode/prospeccion-ventas/workflow/workflow-prospeccion.pdf', printBackground: true, preferCSSPageSize: true });
  await b.close(); console.log('render ok', secs.length);
})();
