/*
 * Radiografía de proceso → PDF
 *
 *   node imprimir.js proceso.json
 *
 * Abre index.html con los datos cargados y lo imprime con Chrome headless.
 * Produce: radiografia-<empresa>.pdf en esta carpeta.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME_CANDIDATOS = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
].filter(Boolean);

const archivo = process.argv[2];
if (!archivo) { console.error('Uso: node imprimir.js proceso.json'); process.exit(1); }
const d = JSON.parse(fs.readFileSync(path.resolve(__dirname, archivo), 'utf8'));
if (!Array.isArray(d.pasos) || d.pasos.length < 2) throw new Error('El JSON necesita al menos 2 pasos');

const b64 = Buffer.from(JSON.stringify(d), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const slug = (d.empresa || 'empresa').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pdfPath = path.join(__dirname, `radiografia-${slug}.pdf`);
const url = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/').replace(/^\//, '') + '?d=' + b64;

const chrome = CHROME_CANDIDATOS.find(p => fs.existsSync(p));
if (!chrome) { console.error('No encontré Chrome. Abre index.html, carga el JSON con "Abrir JSON" e imprime a PDF.'); process.exit(0); }
try {
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', '--virtual-time-budget=4000', `--print-to-pdf=${pdfPath}`, url], { stdio: 'pipe' });
  console.log('PDF   ->', pdfPath);
} catch (e) {
  console.error('No se pudo generar el PDF.'); console.error(String(e.stderr || e.message).slice(0, 400));
}
