/*
 * Anuncio "Bebida funcional / Prebióticos" — YEET PowerDrink
 *   node build-prebioticos.js
 * Salida: anuncio-prebioticos.html + PNG 1080x1350 en PNG/
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const RAIZ = path.join(__dirname, '..', '..', '..', '..', '..');
const FUENTE = path.join(RAIZ, 'carrusel-5-errores', 'assets', 'Montserrat.ttf');
const UPLOADS = '/root/.claude/uploads/87e39a38-9453-5c0b-983a-e32503ffcbe6';
const LOGO = path.join(UPLOADS, '2dd48002-Sin_ti_tulo2.png');
const LATA_CLASSIC = path.join(UPLOADS, '1afbb687-Classic_Jumbo.jpeg');
const LATA_PUNCH = path.join(UPLOADS, '34d56bc3-Punch_Jumbo.jpeg');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const fuente = b64(FUENTE);
const logo = b64(LOGO);
const latexClassic = b64(LATA_CLASSIC);
const latexPunch = b64(LATA_PUNCH);

if (!fuente) console.log('  ⚠ No encontré Montserrat.ttf');
if (!logo) console.log('  ⚠ No encontré el logo');
if (!latexClassic || !latexPunch) console.log('  ⚠ No encontré una de las latas');

const css = `
  @font-face { font-family:'Mont'; src:url(data:font/ttf;base64,${fuente}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:${C.negro};font-family:'Mont',sans-serif;
       overflow:hidden;position:relative;color:${C.blanco}}

  .diag{position:absolute;width:1700px;height:230px;background:${C.magenta};
        transform:rotate(-14deg);left:-280px;opacity:.24}
  .diag.a{top:-70px}
  .diag.b{top:1160px;background:${C.lima};opacity:.18}

  .top{position:absolute;top:56px;left:0;right:0;text-align:center}
  .handle{font-size:22px;font-weight:700;letter-spacing:.22em;color:${C.magenta};text-transform:uppercase}

  .wrap{position:absolute;top:100px;left:0;right:0;bottom:24px;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:20px;padding:0 80px}

  .cabecera{text-align:center}
  .sobre{font-size:24px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;
         color:${C.lima};margin-bottom:10px}
  h1{font-size:66px;font-weight:900;line-height:1.04;letter-spacing:-.03em;text-transform:uppercase;
     text-align:center}
  .lima{color:${C.lima}}
  .mag{color:${C.magenta}}

  .latas{position:relative;background:${C.blanco};border-radius:28px;
         width:860px;height:250px;display:flex;align-items:center;justify-content:center;gap:0;
         box-shadow:0 24px 50px rgba(0,0,0,.45);flex-shrink:0}
  .latas img{height:222px;width:275px;object-fit:cover;object-position:center 12%}
  .latas img.classic{border-radius:28px 0 0 28px}
  .latas img.punch{border-radius:0 28px 28px 0}
  .divisor{position:absolute;left:50%;top:18px;bottom:18px;width:2px;background:rgba(0,0,0,.12);
           transform:translateX(-1px)}

  .panel{width:860px;background:rgba(255,255,255,.06);border:2px solid rgba(180,230,29,.35);
         border-radius:20px;padding:20px 40px;flex-shrink:0}
  .panel .etq{font-size:19px;font-weight:800;letter-spacing:.12em;color:${C.lima};text-transform:uppercase;
              margin-bottom:8px}
  .panel p{font-size:25px;font-weight:500;line-height:1.34;color:#eaeaea}

  .badges{display:flex;gap:14px;flex-shrink:0}
  .badge{font-size:19px;font-weight:800;letter-spacing:.04em;padding:12px 22px;border-radius:999px}
  .badge.b1{background:${C.lima};color:#000}
  .badge.b2{background:transparent;border:2px solid ${C.blanco};color:${C.blanco}}
  .badge.b3{background:${C.magenta};color:#fff}

  .footer{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0}
  .footer img{width:110px}
  .footer .tag{font-size:18px;font-weight:800;letter-spacing:.12em;color:${C.blanco};text-transform:uppercase}
`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <div class="diag a"></div><div class="diag b"></div>
  <div class="top"><div class="handle">${M.instagram}</div></div>

  <div class="wrap">
    <div class="cabecera">
      <div class="sobre">Bebida funcional</div>
      <h1>ADENTRO<br>TAMBIÉN ES <span class="lima">EPIC</span></h1>
    </div>

    <div class="latas">
      <div class="divisor"></div>
      ${latexClassic ? `<img class="classic" src="data:image/jpeg;base64,${latexClassic}">` : ''}
      ${latexPunch ? `<img class="punch" src="data:image/jpeg;base64,${latexPunch}">` : ''}
    </div>

    <div class="panel">
      <div class="etq">Qué son los prebióticos</div>
      <p>Fibra que alimenta las bacterias buenas de tu intestino.<br>Eso es todo.</p>
    </div>

    <div class="badges">
      <span class="badge b1">CON INULINA</span>
      <span class="badge b2">SIN CAFEÍNA</span>
      <span class="badge b3">SIN TAURINA</span>
    </div>

    <div class="footer">
      ${logo ? `<img src="data:image/png;base64,${logo}">` : ''}
      <div class="tag">PowerDrink · No energética</div>
    </div>
  </div>
</body></html>`;

const outDir = __dirname;
const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

const htmlPath = path.join(outDir, 'anuncio-prebioticos.html');
const pngPath = path.join(outPNG, 'anuncio-prebioticos.png');
fs.writeFileSync(htmlPath, html, 'utf8');

console.log('\n  YEET · anuncio "Bebida funcional / Prebióticos"\n');
try {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=2000',
    `--screenshot=${pngPath}`, '--window-size=1080,1350',
    'file://' + htmlPath], { stdio: 'pipe' });
  console.log('  ✓', pngPath);
} catch (e) {
  console.log('  ✗', String(e.stderr || e.message).slice(0, 400));
}
