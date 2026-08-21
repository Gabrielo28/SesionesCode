/*
 * Serie "Epic Like You — Deporte" — YEET PowerDrink
 *   node build-deporte.js
 * Salida: 3 piezas 1080x1350 en PNG/ (moto, básquetbol, skate)
 *
 * Estilo: foto de acción real a pantalla completa + logo brush arriba
 * izquierda + un titular corto abajo. Mismo patrón que ref-03-motocross.jpg
 * (referencias enviadas por el cliente) — sin producto en escena para no
 * arriesgar el arte del envase con regeneración de IA.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const UPLOADS = '/root/.claude/uploads/87e39a38-9453-5c0b-983a-e32503ffcbe6';
const LOGO = path.join(UPLOADS, '2dd48002-Sin_ti_tulo2.png');
const FONTS = path.join(__dirname, '..', 'fonts');
const BG_DIR = path.join(__dirname, 'higgsfield');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const logo = b64(LOGO);
const antonF = b64(path.join(FONTS, 'Anton.ttf'));

const piezas = [
  { archivo: 'moto',   nombre: 'anuncio-moto',   titular: 'SIN LÍMITES' },
  { archivo: 'basket', nombre: 'anuncio-basket', titular: 'EPIC LIKE YOU' },
  { archivo: 'skate',  nombre: 'anuncio-skate',  titular: 'ADRENALINA PURA' },
];

const css = fondo => `
  @font-face { font-family:'Anton'; src:url(data:font/ttf;base64,${antonF}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:#000 url(data:image/png;base64,${fondo}) center/cover no-repeat;
       font-family:'Anton',sans-serif;overflow:hidden;position:relative;color:${C.blanco}}

  .scrim{position:absolute;left:0;right:0;bottom:0;height:520px;
         background:linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.55) 38%, rgba(0,0,0,0) 100%)}
  .scrim-top{position:absolute;left:0;right:0;top:0;height:220px;
             background:linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)}

  .logo{position:absolute;top:54px;left:56px;width:170px;filter:drop-shadow(0 4px 14px rgba(0,0,0,.7))}

  h1{position:absolute;left:64px;right:64px;bottom:76px;font-size:96px;line-height:.94;
     letter-spacing:.005em;text-transform:uppercase;color:${C.blanco};
     -webkit-text-stroke:3px #000;text-shadow:0 6px 0 #000,0 12px 30px rgba(0,0,0,.7)}

  .tag{position:absolute;left:64px;bottom:44px;font-family:'Oswald',sans-serif;font-weight:700;
       font-size:20px;letter-spacing:.18em;color:${C.lima};text-transform:uppercase;display:none}
`;

const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

console.log('\n  YEET · serie "Epic Like You — Deporte"\n');

piezas.forEach(p => {
  const fondo = b64(path.join(BG_DIR, `${p.archivo}.png`));
  if (!fondo) { console.log(`  ⚠ Falta ${p.archivo}.png`); return; }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css(fondo)}</style></head>
<body>
  <div class="scrim-top"></div>
  ${logo ? `<img class="logo" src="data:image/png;base64,${logo}">` : ''}
  <div class="scrim"></div>
  <h1>${p.titular}</h1>
</body></html>`;

  const htmlPath = path.join(__dirname, `${p.nombre}.html`);
  const pngPath = path.join(outPNG, `${p.nombre}.png`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  process.stdout.write(`  ${p.nombre} ... `);
  try {
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--virtual-time-budget=2000',
      `--screenshot=${pngPath}`, '--window-size=1080,1350',
      'file://' + htmlPath], { stdio: 'pipe' });
    console.log('✓');
  } catch (e) {
    console.log('✗', String(e.stderr || e.message).slice(0, 300));
  }
});

console.log(`\n  → ${outPNG}\n`);
