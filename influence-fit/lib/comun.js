/* Utilidades compartidas: lectura YAML/JSON, formato CLP, slug, HTML → PDF. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function leerDatos(archivo) {
  const txt = fs.readFileSync(archivo, 'utf8');
  if (/\.ya?ml$/i.test(archivo)) {
    const yaml = require('js-yaml');
    return yaml.load(txt);
  }
  return JSON.parse(txt);
}

const clp = n => (n == null || isNaN(n)) ? '—' : '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pct = (n, d = 0) => (n == null || isNaN(n) || !isFinite(n)) ? '—' : (n * 100).toFixed(d).replace('.', ',') + '%';
const num = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fechaLarga = (d = new Date()) => d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
const mesLargo = (d = new Date()) => d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

/* Convierte HTML a PDF. Orden: Playwright (si está instalado) → Chrome local (CHROME env o ruta Windows) → nada. */
async function aPdf(htmlPath, pdfPath) {
  try {
    const { chromium } = require('playwright');
    const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
    const b = await chromium.launch(exe ? { executablePath: exe } : {}).catch(() => chromium.launch());
    const p = await b.newPage();
    await p.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
    await p.emulateMedia({ media: 'print' });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
    await b.close();
    return 'playwright';
  } catch (e) { /* sigue con Chrome */ }
  const candidatos = [process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const chrome = candidatos.find(c => fs.existsSync(c));
  if (!chrome) return null;
  try {
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, 'file:///' + htmlPath.replace(/\\/g, '/')], { stdio: 'pipe' });
    return 'chrome';
  } catch (e) { return null; }
}

function escribirHtmlYPdf(dir, nombreBase, html) {
  const htmlPath = path.join(dir, nombreBase + '.html');
  const pdfPath = path.join(dir, nombreBase + '.pdf');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('HTML ->', htmlPath);
  return aPdf(htmlPath, pdfPath).then(motor => {
    if (motor) console.log('PDF  ->', pdfPath, `(${motor})`);
    else console.log('PDF  -> no generado (instala Playwright con `npm run pdf:instalar` o abre el HTML en Chrome e imprime a PDF)');
    return { htmlPath, pdfPath: motor ? pdfPath : null };
  });
}

module.exports = { leerDatos, clp, pct, num, esc, slug, fechaLarga, mesLargo, aPdf, escribirHtmlYPdf };
