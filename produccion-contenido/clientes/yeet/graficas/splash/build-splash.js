/*
 * Producto nítido + fondo desenfocado + splash de líquido en colores de marca
 * (referencias: Red Bull splash dorado, Balтika atravesando nubes)
 *   node build-splash.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FONTS = path.join(__dirname, '..', 'fonts');
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-color.png');
const LATA_CLASSIC = path.join(__dirname, '..', 'anuncios', 'higgsfield', 'lata-classic-solo.png');
const FONDO = path.join(__dirname, '..', 'deporte', 'higgsfield', 'skate.png');
const SPLASH = path.join(__dirname, 'higgsfield', 'splash-1.png');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const logo = b64(LOGO);
const lata = b64(LATA_CLASSIC);
const fondo = b64(FONDO);
const splash = b64(SPLASH);
const antonF = b64(path.join(FONTS, 'Anton.ttf'));
const oswaldF = b64(path.join(FONTS, 'Oswald-Bold.ttf'));

const css = `
  @font-face { font-family:'Anton'; src:url(data:font/ttf;base64,${antonF}) format('truetype'); }
  @font-face { font-family:'Oswald'; src:url(data:font/ttf;base64,${oswaldF}) format('truetype'); font-weight:700; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:#000;overflow:hidden;position:relative;
       font-family:'Oswald',sans-serif;color:${C.blanco}}

  .fondo{position:absolute;inset:-30px;background:url(data:image/png;base64,${fondo}) center/cover no-repeat;
         filter:blur(10px) brightness(.62) saturate(1.05)}
  .scrim-top{position:absolute;left:0;right:0;top:0;height:280px;
             background:linear-gradient(to bottom, rgba(0,0,0,.65) 0%, rgba(0,0,0,0) 100%);z-index:2}
  .scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:520px;
                background:linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.55) 40%, rgba(0,0,0,0) 100%);z-index:2}

  .handle{position:absolute;top:52px;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;
          font-size:20px;letter-spacing:.24em;color:${C.blanco};text-transform:uppercase;
          text-shadow:0 2px 8px rgba(0,0,0,.9);z-index:8}
  .logo-corner{position:absolute;top:44px;left:48px;width:150px;z-index:8;
               filter:drop-shadow(0 4px 12px rgba(0,0,0,.75))}

  h1{position:absolute;top:142px;left:0;right:0;text-align:center;font-family:'Anton';font-weight:400;
     font-size:78px;line-height:.98;color:${C.blanco};-webkit-text-stroke:3px #000;
     text-shadow:0 6px 0 #000;padding:0 60px;z-index:8}
  h1 .accent{color:${C.lima};-webkit-text-stroke:3px #000}

  .splash{position:absolute;top:400px;left:50%;transform:translateX(-46%);
          width:820px;height:auto;z-index:6;mix-blend-mode:screen;opacity:.95}

  .sombra{position:absolute;bottom:334px;left:50%;transform:translateX(-50%);
          width:260px;height:54px;border-radius:50%;background:radial-gradient(ellipse,
          rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 72%);z-index:4}

  .lata{position:absolute;bottom:350px;left:50%;transform:translateX(-50%) rotate(-3deg);
        height:560px;width:auto;z-index:7;
        filter:drop-shadow(0 26px 20px rgba(0,0,0,.75)) drop-shadow(0 0 3px rgba(255,255,255,.4))}

  .caption{position:absolute;bottom:280px;left:0;right:0;text-align:center;z-index:8;
           font-family:'Oswald';font-weight:700;font-size:24px;letter-spacing:.02em;
           color:${C.blanco};text-shadow:0 2px 10px rgba(0,0,0,.9);padding:0 90px}

  .badges{position:absolute;bottom:200px;left:0;right:0;display:flex;justify-content:center;gap:12px;z-index:8}
  .badge{font-family:'Oswald';font-weight:700;font-size:18px;letter-spacing:.06em;text-transform:uppercase;
         padding:10px 20px;border-radius:999px;border:2px solid ${C.blanco};color:${C.blanco};
         background:rgba(0,0,0,.5)}
`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <div class="fondo"></div>
  <div class="scrim-top"></div>
  ${splash ? `<img class="splash" src="data:image/png;base64,${splash}">` : ''}
  <div class="scrim-bottom"></div>
  ${logo ? `<img class="logo-corner" src="data:image/png;base64,${logo}">` : ''}
  <div class="handle">${M.instagram}</div>
  <h1>PREBIÓTICOS<br>PARA TU <span class="accent">DÍA A DÍA</span></h1>
  <div class="sombra"></div>
  ${lata ? `<img class="lata" src="data:image/png;base64,${lata}">` : ''}
  <div class="caption">1g de fibra prebiótica en cada lata. Sin cafeína.</div>
  <div class="badges">
    <span class="badge">Sin sellos</span>
    <span class="badge">Cero azúcar</span>
  </div>
</body></html>`;

const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });
const htmlPath = path.join(__dirname, 'splash-1.html');
const pngPath = path.join(outPNG, 'splash-1.png');
fs.writeFileSync(htmlPath, html, 'utf8');

console.log('\n  YEET · producto + fondo desenfocado + splash\n');
try {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=2000',
    `--screenshot=${pngPath}`, '--window-size=1080,1350',
    'file://' + htmlPath], { stdio: 'pipe' });
  console.log('  ✓', pngPath);
} catch (e) {
  console.log('  ✗', String(e.stderr || e.message).slice(0, 400));
}
