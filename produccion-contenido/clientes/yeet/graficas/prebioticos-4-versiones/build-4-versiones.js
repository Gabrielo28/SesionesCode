/*
 * 4 versiones distintas del post "Bebida funcional / Prebióticos" — YEET
 *   node build-4-versiones.js
 * Salida: 4 piezas 1080x1350 en PNG/, cada una con formato y copy distintos,
 * inspiradas en patrones de post que funcionan bien en Instagram:
 *   1. moto        → comparación rápida (energética vs funcional)
 *   2. basket      → dato/número gigante (formato "big stat")
 *   3. skate       → pregunta/POV conversacional
 *   4. neon-skate  → declaración tipo póster, minimalista
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FONTS = path.join(__dirname, '..', 'fonts');
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-color.png');
const LATA_CLASSIC = path.join(__dirname, '..', 'anuncios', 'higgsfield', 'lata-classic-solo.png');
const LATA_PUNCH = path.join(__dirname, '..', 'anuncios', 'higgsfield', 'lata-punch-solo.png');
const BG_DEPORTE = path.join(__dirname, '..', 'deporte', 'higgsfield');
const BG_ANUNCIOS = path.join(__dirname, '..', 'anuncios', 'higgsfield');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;
const CIAN = '#28D9E5';

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const logo = b64(LOGO);
const latexClassic = b64(LATA_CLASSIC);
const latexPunch = b64(LATA_PUNCH);
const antonF = b64(path.join(FONTS, 'Anton.ttf'));
const oswaldF = b64(path.join(FONTS, 'Oswald-Bold.ttf'));
const markerF = b64(path.join(FONTS, 'PermanentMarker.ttf'));

const baseCSS = fondo => `
  @font-face { font-family:'Anton'; src:url(data:font/ttf;base64,${antonF}) format('truetype'); }
  @font-face { font-family:'Oswald'; src:url(data:font/ttf;base64,${oswaldF}) format('truetype'); font-weight:700; }
  @font-face { font-family:'Marker'; src:url(data:font/ttf;base64,${markerF}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:#000 url(data:image/png;base64,${fondo}) center/cover no-repeat;
       font-family:'Oswald',sans-serif;overflow:hidden;position:relative;color:${C.blanco}}

  .duotono{position:absolute;inset:0;mix-blend-mode:color;opacity:.5;
           background:radial-gradient(circle at 10% 6%, ${C.magenta} 0%, transparent 42%),
                      radial-gradient(circle at 92% 96%, ${CIAN} 0%, transparent 46%)}

  .glitch{position:absolute;inset:0;overflow:hidden;mix-blend-mode:screen}
  .glitch span{position:absolute;display:block}
  .gm{background:${C.magenta}} .gc{background:${CIAN}}
  .g1{top:2%;left:0;width:32%;height:10px;transform:skewX(-18deg);opacity:.9}
  .g2{top:2%;left:34%;width:16%;height:10px;transform:skewX(-18deg);opacity:.8}
  .g3{top:5%;left:6%;width:20%;height:6px;transform:skewX(-18deg);opacity:.7}
  .g4{top:5%;left:48%;width:36%;height:6px;transform:skewX(-18deg);opacity:.7}
  .g5{top:22%;right:0;width:10%;height:900px;opacity:.14}
  .g6{top:41%;left:0;width:1080px;height:3px;opacity:.5}
  .g7{top:41.4%;left:0;width:1080px;height:3px;opacity:.4}
  .g8{top:58%;left:8%;width:70px;height:70px;opacity:.28}
  .g9{top:63%;left:85%;width:44px;height:180px;opacity:.26}
  .g10{top:79%;left:0;width:220px;height:9px;transform:skewX(-18deg);opacity:.75}
  .g11{top:79%;left:240px;width:120px;height:9px;transform:skewX(-18deg);opacity:.55}
  .g12{top:93%;left:20%;width:1080px;height:2px;opacity:.38}
  .g13{top:12%;left:0;width:14px;height:1350px;opacity:.45}
  .g14{top:12%;left:18px;width:7px;height:1350px;opacity:.35}
  .scan{position:absolute;inset:0;mix-blend-mode:overlay;opacity:.45;
        background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0px,rgba(255,255,255,.08) 1px,transparent 1px,transparent 3px)}
  .grano{position:absolute;inset:0;opacity:.16;mix-blend-mode:overlay;
         background-image:radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px);background-size:3px 3px}

  .handle{position:absolute;top:50px;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;
          font-size:19px;letter-spacing:.24em;color:${C.blanco};text-transform:uppercase;
          text-shadow:0 2px 8px rgba(0,0,0,.9);z-index:6}

  .chip{background:${C.magenta};color:#000;font-family:'Oswald';font-weight:700;
        font-size:22px;letter-spacing:.03em;text-transform:uppercase;padding:10px 20px;
        box-shadow:0 8px 20px rgba(0,0,0,.5)}

  .latas{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:flex-end;gap:4px;z-index:5}
  .latas img{height:300px;width:auto;object-fit:contain;
             filter:drop-shadow(0 20px 16px rgba(0,0,0,.6)) drop-shadow(0 0 30px rgba(255,6,156,.35)) drop-shadow(0 0 30px rgba(40,217,229,.25))}
  .latas.sm img{height:230px}

  .footer{position:absolute;bottom:52px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:6}
  .footer img{width:120px;filter:drop-shadow(0 4px 14px rgba(0,0,0,.8))}
  .footer .tag{font-family:'Oswald';font-weight:700;font-size:15px;letter-spacing:.14em;color:#cfd6e0;text-transform:uppercase}
`;

const glitchHTML = `
  <div class="duotono"></div>
  <div class="glitch">
    <span class="g1 gm"></span><span class="g2 gc"></span><span class="g3 gc"></span><span class="g4 gm"></span>
    <span class="g5 gc"></span><span class="g6 gm"></span><span class="g7 gc"></span>
    <span class="g8 gm"></span><span class="g9 gc"></span><span class="g10 gc"></span><span class="g11 gm"></span>
    <span class="g12 gm"></span><span class="g13 gc"></span><span class="g14 gm"></span>
  </div>
  <div class="scan"></div>
  <div class="grano"></div>
`;

const cans = `${latexClassic ? `<img src="data:image/png;base64,${latexClassic}">` : ''}${latexPunch ? `<img src="data:image/png;base64,${latexPunch}">` : ''}`;

const footerHTML = `
  <div class="footer">
    ${logo ? `<img src="data:image/png;base64,${logo}">` : ''}
    <div class="tag">PowerDrink · No energética</div>
  </div>
`;

const piezas = [
  // ---------- 1. MOTO — formato comparación rápida ----------
  {
    archivo: path.join(BG_DEPORTE, 'moto.png'),
    nombre: '1-comparacion',
    extra: `
      <div class="handle">${M.instagram}</div>
      <div style="position:absolute;top:120px;left:0;right:0;text-align:center;z-index:6">
        <span class="chip" style="transform:rotate(-2deg);display:inline-block">Energética vs funcional</span>
      </div>
      <div style="position:absolute;top:830px;left:56px;right:56px;z-index:6;
                  background:rgba(0,0,0,.6);border-radius:20px;padding:26px 30px;
                  border:2px solid rgba(255,255,255,.15)">
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:12px 0;border-bottom:1px solid rgba(255,255,255,.15);
                    font-family:'Oswald';font-weight:700;font-size:23px">
          <span style="color:#ff5c7a">✗ Cafeína / estimulantes</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:12px 0;font-family:'Oswald';font-weight:700;font-size:23px">
          <span style="color:${C.lima}">✓ Vitaminas + prebióticos</span>
        </div>
      </div>
      <div class="latas" style="top:400px">${cans}</div>
      <div style="position:absolute;top:1090px;left:60px;right:60px;text-align:center;z-index:6;
                  font-family:'Anton';font-size:52px;line-height:1;color:${C.blanco};
                  -webkit-text-stroke:2px #000;text-shadow:0 4px 0 #000">
        NO ES ENERGÉTICA<br><span style="color:${C.lima};-webkit-text-stroke:2px #000">ES FUNCIONAL</span>
      </div>
    `,
  },
  // ---------- 2. BASKET — formato dato/número gigante ----------
  {
    archivo: path.join(BG_DEPORTE, 'basket.png'),
    nombre: '2-dato',
    extra: `
      <div class="handle">${M.instagram}</div>
      <div style="position:absolute;top:150px;left:0;right:0;text-align:center;z-index:6;
                  font-family:'Oswald';font-weight:700;font-size:22px;letter-spacing:.14em;
                  color:${C.lima};text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,.9)">
        Por cada lata
      </div>
      <div style="position:absolute;top:186px;left:0;right:0;text-align:center;z-index:6">
        <span style="font-family:'Anton';font-size:280px;line-height:.85;color:${C.blanco};
                     -webkit-text-stroke:5px #000;text-shadow:0 10px 0 #000">1G</span>
      </div>
      <div style="position:absolute;top:520px;left:0;right:0;text-align:center;z-index:6;
                  font-family:'Anton';font-size:40px;color:${C.blanco};-webkit-text-stroke:2px #000;
                  text-shadow:0 4px 0 #000;padding:0 80px;line-height:1.05">
        DE FIBRA <span style="color:${C.lima};-webkit-text-stroke:2px #000">PREBIÓTICA</span>
      </div>
      <div class="latas sm" style="top:640px">${cans}</div>
      <div style="position:absolute;top:920px;left:100px;right:100px;text-align:center;z-index:6;
                  font-family:'Marker';font-size:27px;line-height:1.32;color:${C.blanco};
                  text-shadow:0 2px 10px rgba(0,0,0,.9)">
        Alimenta las bacterias buenas<br>de tu intestino. Así de simple.
      </div>
    `,
  },
  // ---------- 3. SKATE — formato pregunta / POV ----------
  {
    archivo: path.join(BG_DEPORTE, 'skate.png'),
    nombre: '3-pregunta',
    extra: `
      <div class="handle">${M.instagram}</div>
      <div style="position:absolute;top:140px;left:0;right:0;text-align:center;z-index:6">
        <span class="chip" style="transform:rotate(2deg);display:inline-block">POV</span>
      </div>
      <div style="position:absolute;top:210px;left:0;right:0;text-align:center;z-index:6;
                  font-family:'Anton';font-size:62px;line-height:1.02;color:${C.blanco};
                  -webkit-text-stroke:2.5px #000;text-shadow:0 5px 0 #000;padding:0 64px">
        ¿SABÍAS QUE TU YEET<br>TAMBIÉN CUIDA TU<br><span style="color:${C.lima};-webkit-text-stroke:2.5px #000">INTESTINO?</span>
      </div>
      <div class="latas" style="top:580px">${cans}</div>
      <div style="position:absolute;top:940px;left:0;right:0;display:flex;justify-content:center;gap:12px;z-index:6">
        <span class="chip" style="background:${C.blanco};transform:none">Prebióticos 🦠</span>
        <span class="chip" style="background:${C.lima};transform:none">Sin cafeína</span>
      </div>
    `,
  },
  // ---------- 4. NEON SKATEPARK — declaración tipo póster, minimalista ----------
  {
    archivo: path.join(BG_ANUNCIOS, 'fondo-neon-2.png'),
    nombre: '4-declaracion',
    extra: `
      <div class="handle">${M.instagram}</div>
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;
                  align-items:center;justify-content:center;gap:38px;z-index:6">
        <div style="font-family:'Anton';font-size:104px;line-height:.96;text-align:center;color:${C.blanco};
                    -webkit-text-stroke:3px #000;text-shadow:0 6px 0 #000;padding:0 50px">
          FUNCIONAL.<br><span style="color:${C.magenta};-webkit-text-stroke:3px #000">NO</span>
          <span style="color:${C.lima};-webkit-text-stroke:3px #000">ENERGÉTICA.</span>
        </div>
        <div class="latas" style="position:relative;top:0">${cans}</div>
      </div>
      ${footerHTML}
    `,
  },
];

const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

console.log('\n  YEET · 4 versiones "Bebida funcional / Prebióticos"\n');

piezas.forEach(p => {
  const fondo = b64(p.archivo);
  if (!fondo) { console.log(`  ⚠ Falta ${p.archivo}`); return; }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${baseCSS(fondo)}</style></head>
<body>${glitchHTML}${p.extra}</body></html>`;

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
