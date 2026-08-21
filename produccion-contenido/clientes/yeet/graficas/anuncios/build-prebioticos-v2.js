/*
 * Anuncio "Lo que sí tiene: prebióticos" — YEET PowerDrink (v2, estilo real de marca)
 *   node build-prebioticos-v2.js
 * Salida: anuncio-prebioticos-v2.html + PNG 1080x1350 en PNG/
 *
 * Referencias: produccion-contenido/clientes/yeet/referencias/
 * (glitch/VHS, producto en hielo, tipografía brush+stencil+condensada,
 *  copy real "LO QUE SÍ TIENE:" del reel "¿es una bebida energética?")
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const UPLOADS = '/root/.claude/uploads/87e39a38-9453-5c0b-983a-e32503ffcbe6';
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-color.png');
const LATA_CLASSIC = path.join(__dirname, 'higgsfield', 'lata-classic-solo.png');
const LATA_PUNCH = path.join(__dirname, 'higgsfield', 'lata-punch-solo.png');
const FONDO = path.join(__dirname, 'higgsfield', 'fondo-hielo-1.png');
const FONTS = path.join(__dirname, '..', 'fonts');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;
const CIAN = '#28D9E5';

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const logo = b64(LOGO);
const latexClassic = b64(LATA_CLASSIC);
const latexPunch = b64(LATA_PUNCH);
const fondo = b64(FONDO);
const antonF = b64(path.join(FONTS, 'Anton.ttf'));
const oswaldF = b64(path.join(FONTS, 'Oswald-Bold.ttf'));
const markerF = b64(path.join(FONTS, 'PermanentMarker.ttf'));

if (!logo) console.log('  ⚠ No encontré el logo');
if (!latexClassic || !latexPunch) console.log('  ⚠ No encontré una de las latas');
if (!fondo) console.log('  ⚠ No encontré el fondo de hielo Higgsfield');
if (!antonF || !oswaldF || !markerF) console.log('  ⚠ Falta alguna fuente descargada');

const css = `
  @font-face { font-family:'Anton'; src:url(data:font/ttf;base64,${antonF}) format('truetype'); }
  @font-face { font-family:'Oswald'; src:url(data:font/ttf;base64,${oswaldF}) format('truetype'); font-weight:700; }
  @font-face { font-family:'Marker'; src:url(data:font/ttf;base64,${markerF}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:#03060c ${fondo ? `url(data:image/png;base64,${fondo})` : ''} center/cover no-repeat;
       font-family:'Oswald',sans-serif;overflow:hidden;position:relative;color:${C.blanco}}

  /* --- franja glitch/VHS arriba --- */
  .glitch{position:absolute;top:0;left:0;right:0;height:150px;overflow:hidden;opacity:.85;mix-blend-mode:screen}
  .glitch span{position:absolute;display:block;background:${C.magenta}}
  .g1{top:8px;left:0;width:340px;height:14px;transform:skewX(-18deg)}
  .g2{top:8px;left:360px;width:180px;height:14px;background:${CIAN};transform:skewX(-18deg)}
  .g3{top:30px;left:60px;width:220px;height:8px;transform:skewX(-18deg)}
  .g4{top:30px;left:520px;width:400px;height:8px;background:${CIAN};transform:skewX(-18deg)}
  .g5{top:46px;left:0;width:1080px;height:3px;background:rgba(255,255,255,.5)}
  .g6{top:58px;left:120px;width:60px;height:60px;background:#000;opacity:.7}
  .g7{top:70px;left:640px;width:40px;height:40px;background:${C.magenta};opacity:.6}
  .g8{top:90px;left:820px;width:90px;height:20px;background:${CIAN};opacity:.5;transform:skewX(-18deg)}
  .g9{top:5px;left:900px;width:16px;height:120px;background:#000;opacity:.8}
  .g10{top:5px;left:930px;width:8px;height:120px;background:#000;opacity:.8}
  .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0px,rgba(255,255,255,.05) 1px,transparent 1px,transparent 3px)}

  .handle{position:absolute;top:56px;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;
          font-size:20px;letter-spacing:.28em;color:${C.blanco};text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,.9)}

  .chip{position:absolute;top:130px;left:66px;background:${C.magenta};color:#000;font-family:'Oswald';font-weight:700;
        font-size:24px;letter-spacing:.03em;text-transform:uppercase;padding:12px 22px;transform:rotate(-3deg);
        box-shadow:0 8px 20px rgba(0,0,0,.5)}

  h1{position:absolute;top:196px;left:0;right:0;text-align:center;font-family:'Anton';font-weight:400;
     font-size:104px;line-height:.92;letter-spacing:.01em;text-transform:uppercase;color:${C.blanco};
     -webkit-text-stroke:3px #000;text-shadow:0 6px 0 #000,0 10px 24px rgba(0,0,0,.7)}
  h1 .accent{color:${C.lima};-webkit-text-stroke:3px #000}

  .latas{position:absolute;top:380px;left:0;right:0;display:flex;justify-content:center;align-items:flex-end;gap:8px}
  .latas img{height:400px;width:auto;object-fit:contain;
             filter:drop-shadow(0 26px 22px rgba(0,0,0,.55)) drop-shadow(0 0 34px rgba(120,180,255,.25))}

  .chips2{position:absolute;top:718px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:14px}
  .fila{display:flex;gap:14px}
  .b{font-family:'Oswald';font-weight:700;font-size:27px;letter-spacing:.02em;text-transform:uppercase;
     padding:14px 28px;text-align:center}
  .b.mag{background:${C.magenta};color:#000}
  .b.wht{background:${C.blanco};color:#000}
  .b.lim{background:${C.lima};color:#000}

  .caption{position:absolute;top:918px;left:90px;right:90px;text-align:center;font-family:'Marker';
           font-size:30px;line-height:1.3;color:${C.blanco};text-shadow:0 2px 10px rgba(0,0,0,.9)}

  .badges{position:absolute;top:1040px;left:0;right:0;display:flex;justify-content:center;gap:14px}
  .badge{font-family:'Oswald';font-weight:700;font-size:20px;letter-spacing:.08em;text-transform:uppercase;
         padding:12px 22px;border-radius:999px;border:2px solid ${C.blanco};color:${C.blanco};background:rgba(0,0,0,.35)}

  .footer{position:absolute;bottom:64px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px}
  .footer img{width:150px;filter:drop-shadow(0 4px 14px rgba(0,0,0,.8))}
  .footer .tag{font-family:'Oswald';font-weight:700;font-size:18px;letter-spacing:.14em;color:#cfd6e0;
               text-transform:uppercase}
`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <div class="glitch">
    <span class="g1"></span><span class="g2"></span><span class="g3"></span><span class="g4"></span>
    <span class="g5"></span><span class="g6"></span><span class="g7"></span><span class="g8"></span>
    <span class="g9"></span><span class="g10"></span>
    <div class="scan"></div>
  </div>
  <div class="handle">${M.instagram}</div>

  <div class="chip">¿Qué lleva adentro?</div>
  <h1>LO QUE<br>SÍ <span class="accent">TIENE</span></h1>

  <div class="latas">
    ${latexClassic ? `<img src="data:image/png;base64,${latexClassic}">` : ''}
    ${latexPunch ? `<img src="data:image/png;base64,${latexPunch}">` : ''}
  </div>

  <div class="chips2">
    <div class="fila">
      <span class="b mag">Vitaminas y minerales</span>
    </div>
    <div class="fila">
      <span class="b wht">Prebióticos 🦠</span>
      <span class="b lim">Magnesio + Zinc</span>
    </div>
  </div>

  <div class="caption">Fibra que alimenta las bacterias<br>buenas de tu intestino. Eso es todo.</div>

  <div class="badges">
    <span class="badge">Sin sellos</span>
    <span class="badge">Cero azúcar</span>
    <span class="badge">Cero cafeína</span>
  </div>

  <div class="footer">
    ${logo ? `<img src="data:image/png;base64,${logo}">` : ''}
    <div class="tag">PowerDrink · No energética</div>
  </div>
</body></html>`;

const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

const htmlPath = path.join(__dirname, 'anuncio-prebioticos-v2.html');
const pngPath = path.join(outPNG, 'anuncio-prebioticos-v2.png');
fs.writeFileSync(htmlPath, html, 'utf8');

console.log('\n  YEET · anuncio v2 "Lo que sí tiene" (estilo real)\n');
try {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=2000',
    `--screenshot=${pngPath}`, '--window-size=1080,1350',
    'file://' + htmlPath], { stdio: 'pipe' });
  console.log('  ✓', pngPath);
} catch (e) {
  console.log('  ✗', String(e.stderr || e.message).slice(0, 400));
}
