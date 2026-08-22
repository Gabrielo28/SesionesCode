/*
 * Prueba de estilo "producto nítido + fondo real desenfocado"
 * (referencia: Dad Water en cancha, Nature's Fury en gimnasio)
 *   node build-test.js
 * Sin Higgsfield: reutiliza fondo y latas ya generados, solo CSS.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FONTS = path.join(__dirname, '..', 'fonts');
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-color.png');
const LATA_CLASSIC = path.join(__dirname, '..', 'anuncios', 'higgsfield', 'lata-classic-solo.png');
const FONDO = path.join(__dirname, '..', 'deporte', 'higgsfield', 'skate.png');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const logo = b64(LOGO);
const lata = b64(LATA_CLASSIC);
const fondo = b64(FONDO);
const antonF = b64(path.join(FONTS, 'Anton.ttf'));
const oswaldF = b64(path.join(FONTS, 'Oswald-Bold.ttf'));

const css = `
  @font-face { font-family:'Anton'; src:url(data:font/ttf;base64,${antonF}) format('truetype'); }
  @font-face { font-family:'Oswald'; src:url(data:font/ttf;base64,${oswaldF}) format('truetype'); font-weight:700; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:#000;overflow:hidden;position:relative;
       font-family:'Oswald',sans-serif;color:${C.blanco}}

  .fondo{position:absolute;inset:-30px;background:url(data:image/png;base64,${fondo}) center/cover no-repeat;
         filter:blur(9px) brightness(.72) saturate(1.1)}
  .scrim-top{position:absolute;left:0;right:0;top:0;height:260px;
             background:linear-gradient(to bottom, rgba(0,0,0,.6) 0%, rgba(0,0,0,0) 100%);z-index:2}
  .scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:420px;
                background:linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,0) 100%);z-index:2}

  .handle{position:absolute;top:52px;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;
          font-size:20px;letter-spacing:.24em;color:${C.blanco};text-transform:uppercase;
          text-shadow:0 2px 8px rgba(0,0,0,.9);z-index:6}
  .logo-corner{position:absolute;top:44px;left:48px;width:150px;z-index:6;
               filter:drop-shadow(0 4px 12px rgba(0,0,0,.75))}

  h1{position:absolute;top:150px;left:0;right:0;text-align:center;font-family:'Anton';font-weight:400;
     font-size:82px;line-height:.98;color:${C.blanco};-webkit-text-stroke:3px #000;
     text-shadow:0 6px 0 #000;padding:0 60px;z-index:6}
  h1 .accent{color:${C.lima};-webkit-text-stroke:3px #000}

  .lata{position:absolute;bottom:330px;left:50%;transform:translateX(-50%) rotate(-4deg);
        height:560px;width:auto;z-index:5;
        filter:drop-shadow(0 30px 24px rgba(0,0,0,.7)) drop-shadow(0 0 2px rgba(255,255,255,.5))}

  .caption{position:absolute;bottom:220px;left:0;right:0;text-align:center;z-index:6;
           font-family:'Oswald';font-weight:700;font-size:24px;letter-spacing:.02em;
           color:${C.blanco};text-shadow:0 2px 10px rgba(0,0,0,.9);padding:0 90px}

  .badges{position:absolute;bottom:150px;left:0;right:0;display:flex;justify-content:center;gap:12px;z-index:6}
  .badge{font-family:'Oswald';font-weight:700;font-size:18px;letter-spacing:.06em;text-transform:uppercase;
         padding:10px 20px;border-radius:999px;border:2px solid ${C.blanco};color:${C.blanco};
         background:rgba(0,0,0,.4)}

  .footer{position:absolute;bottom:50px;left:0;right:0;display:flex;flex-direction:column;
          align-items:center;gap:4px;z-index:6}
  .footer .tag{font-family:'Oswald';font-weight:700;font-size:15px;letter-spacing:.14em;
               color:#cfd6e0;text-transform:uppercase}
`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <div class="fondo"></div>
  <div class="scrim-top"></div>
  <div class="scrim-bottom"></div>
  ${logo ? `<img class="logo-corner" src="data:image/png;base64,${logo}">` : ''}
  <div class="handle">${M.instagram}</div>
  <h1>PREBIÓTICOS<br>PARA TU <span class="accent">DÍA A DÍA</span></h1>
  ${lata ? `<img class="lata" src="data:image/png;base64,${lata}">` : ''}
  <div class="caption">1g de fibra prebiótica en cada lata. Sin cafeína.</div>
  <div class="badges">
    <span class="badge">Sin sellos</span>
    <span class="badge">Cero azúcar</span>
  </div>
  <div class="footer">
    <div class="tag">PowerDrink · No energética</div>
  </div>
</body></html>`;

const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });
const htmlPath = path.join(__dirname, 'test-dof.html');
const pngPath = path.join(outPNG, 'test-dof.png');
fs.writeFileSync(htmlPath, html, 'utf8');

console.log('\n  YEET · prueba fondo desenfocado (sin Higgsfield)\n');
try {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=2000',
    `--screenshot=${pngPath}`, '--window-size=1080,1350',
    'file://' + htmlPath], { stdio: 'pipe' });
  console.log('  ✓', pngPath);
} catch (e) {
  console.log('  ✗', String(e.stderr || e.message).slice(0, 400));
}
