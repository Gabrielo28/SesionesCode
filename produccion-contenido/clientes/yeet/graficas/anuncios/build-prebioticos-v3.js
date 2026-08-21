/*
 * Anuncio "Bebida funcional / Prebióticos" — YEET PowerDrink (v3, jóvenes)
 *   node build-prebioticos-v3.js
 * Salida: anuncio-prebioticos-v3.html + PNG 1080x1350 en PNG/
 *
 * v3 respecto a v2: colores de marca (magenta+cian) explícitos en el fondo
 * y mucho más ruido visual (glitch/scanlines/grano), pedido por el cliente.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const UPLOADS = '/root/.claude/uploads/87e39a38-9453-5c0b-983a-e32503ffcbe6';
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-color.png');
const LATA_CLASSIC = path.join(__dirname, 'higgsfield', 'lata-classic-solo.png');
const LATA_PUNCH = path.join(__dirname, 'higgsfield', 'lata-punch-solo.png');
const FONDO = path.join(__dirname, 'higgsfield', 'fondo-neon-2.png');
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

const css = `
  @font-face { font-family:'Anton'; src:url(data:font/ttf;base64,${antonF}) format('truetype'); }
  @font-face { font-family:'Oswald'; src:url(data:font/ttf;base64,${oswaldF}) format('truetype'); font-weight:700; }
  @font-face { font-family:'Marker'; src:url(data:font/ttf;base64,${markerF}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:#000 url(data:image/png;base64,${fondo}) center/cover no-repeat;
       font-family:'Oswald',sans-serif;overflow:hidden;position:relative;color:${C.blanco}}

  /* --- ruido / glitch a pantalla completa --- */
  .glitch{position:absolute;inset:0;overflow:hidden;mix-blend-mode:screen}
  .glitch span{position:absolute;display:block}
  .gm{background:${C.magenta}}
  .gc{background:${CIAN}}
  .g1{top:2%;left:0;width:32%;height:10px;transform:skewX(-18deg);opacity:.9}
  .g2{top:2%;left:34%;width:16%;height:10px;transform:skewX(-18deg);opacity:.8}
  .g3{top:5%;left:6%;width:20%;height:6px;transform:skewX(-18deg);opacity:.7}
  .g4{top:5%;left:48%;width:36%;height:6px;transform:skewX(-18deg);opacity:.7}
  .g5{top:22%;right:0;width:10%;height:900px;opacity:.14}
  .g6{top:41%;left:0;width:1080px;height:3px;opacity:.55}
  .g7{top:41.4%;left:0;width:1080px;height:3px;opacity:.45}
  .g8{top:58%;left:8%;width:70px;height:70px;opacity:.3}
  .g9{top:63%;left:85%;width:44px;height:180px;opacity:.28}
  .g10{top:79%;left:0;width:220px;height:9px;transform:skewX(-18deg);opacity:.8}
  .g11{top:79%;left:240px;width:120px;height:9px;transform:skewX(-18deg);opacity:.6}
  .g12{top:93%;left:20%;width:1080px;height:2px;opacity:.4}
  .g13{top:12%;left:0;width:14px;height:1350px;opacity:.5}
  .g14{top:12%;left:18px;width:7px;height:1350px;opacity:.4}
  .scan{position:absolute;inset:0;mix-blend-mode:overlay;opacity:.5;
        background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0px,rgba(255,255,255,.08) 1px,transparent 1px,transparent 3px)}
  .grano{position:absolute;inset:0;opacity:.18;mix-blend-mode:overlay;
         background-image:radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px);
         background-size:3px 3px}

  .handle{position:absolute;top:52px;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;
          font-size:20px;letter-spacing:.28em;color:${C.blanco};text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,.9)}

  .chip{position:absolute;top:118px;left:66px;background:${C.magenta};color:#000;font-family:'Oswald';font-weight:700;
        font-size:23px;letter-spacing:.03em;text-transform:uppercase;padding:11px 20px;transform:rotate(-3deg);
        box-shadow:0 8px 20px rgba(0,0,0,.5);z-index:5}

  h1{position:absolute;top:178px;left:0;right:0;text-align:center;font-family:'Anton';font-weight:400;
     font-size:60px;line-height:1.05;letter-spacing:.005em;text-transform:uppercase;color:${C.blanco};
     -webkit-text-stroke:2.5px #000;text-shadow:0 5px 0 #000,0 10px 22px rgba(0,0,0,.7);padding:0 60px;z-index:5}
  h1 .accent{color:${C.lima};-webkit-text-stroke:2.5px #000}

  .latas{position:absolute;top:420px;left:0;right:0;display:flex;justify-content:center;align-items:flex-end;gap:6px;z-index:4}
  .latas img{height:400px;width:auto;object-fit:contain;
             filter:drop-shadow(0 26px 22px rgba(0,0,0,.6)) drop-shadow(0 0 40px rgba(255,6,156,.35)) drop-shadow(0 0 40px rgba(40,217,229,.25))}

  .chips2{position:absolute;top:800px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:12px;z-index:5}
  .fila{display:flex;gap:12px}
  .b{font-family:'Oswald';font-weight:700;font-size:24px;letter-spacing:.02em;text-transform:uppercase;
     padding:12px 24px;text-align:center}
  .b.mag{background:${C.magenta};color:#000}
  .b.wht{background:${C.blanco};color:#000}
  .b.lim{background:${C.lima};color:#000}

  .caption{position:absolute;top:962px;left:100px;right:100px;text-align:center;font-family:'Marker';
           font-size:26px;line-height:1.3;color:${C.blanco};text-shadow:0 2px 10px rgba(0,0,0,.9);z-index:5}

  .badges{position:absolute;top:1060px;left:0;right:0;display:flex;justify-content:center;gap:12px;z-index:5}
  .badge{font-family:'Oswald';font-weight:700;font-size:18px;letter-spacing:.08em;text-transform:uppercase;
         padding:11px 20px;border-radius:999px;border:2px solid ${C.blanco};color:${C.blanco};background:rgba(0,0,0,.4)}

  .footer{position:absolute;bottom:56px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:5}
  .footer img{width:140px;filter:drop-shadow(0 4px 14px rgba(0,0,0,.8))}
  .footer .tag{font-family:'Oswald';font-weight:700;font-size:16px;letter-spacing:.14em;color:#cfd6e0;
               text-transform:uppercase}
`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head>
<body>
  <div class="glitch">
    <span class="g1 gm"></span><span class="g2 gc"></span><span class="g3 gc"></span><span class="g4 gm"></span>
    <span class="g5 gc"></span><span class="g6 gm"></span><span class="g7 gc"></span>
    <span class="g8 gm"></span><span class="g9 gc"></span><span class="g10 gc"></span><span class="g11 gm"></span>
    <span class="g12 gm"></span><span class="g13 gc"></span><span class="g14 gm"></span>
  </div>
  <div class="scan"></div>
  <div class="grano"></div>

  <div class="handle">${M.instagram}</div>
  <div class="chip">Bebida funcional</div>
  <h1>¿Y SI TU BEBIDA<br>FAVORITA TE DIERA<br><span class="accent">ALGO MÁS?</span></h1>

  <div class="latas">
    ${latexClassic ? `<img src="data:image/png;base64,${latexClassic}">` : ''}
    ${latexPunch ? `<img src="data:image/png;base64,${latexPunch}">` : ''}
  </div>

  <div class="chips2">
    <div class="fila">
      <span class="b mag">Prebióticos 🦠</span>
      <span class="b lim">Vitaminas y minerales</span>
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

const htmlPath = path.join(__dirname, 'anuncio-prebioticos-v3.html');
const pngPath = path.join(outPNG, 'anuncio-prebioticos-v3.png');
fs.writeFileSync(htmlPath, html, 'utf8');

console.log('\n  YEET · anuncio v3 "Bebida funcional" (jóvenes, colores de marca + ruido)\n');
try {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--virtual-time-budget=2000',
    `--screenshot=${pngPath}`, '--window-size=1080,1350',
    'file://' + htmlPath], { stdio: 'pipe' });
  console.log('  ✓', pngPath);
} catch (e) {
  console.log('  ✗', String(e.stderr || e.message).slice(0, 400));
}
