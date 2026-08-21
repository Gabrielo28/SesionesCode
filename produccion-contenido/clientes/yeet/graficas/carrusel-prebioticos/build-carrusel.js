/*
 * Carrusel "Bebida funcional / Prebióticos" — YEET PowerDrink
 *   node build-carrusel.js
 * Salida: 3 slides 1080x1350 en PNG/ (portada-moto, prebioticos-basket, cierre-skate)
 *
 * Usa las 3 fotos de deporte (moto/básquetbol/skate) ya generadas como
 * fondo de cada slide, con el mismo tratamiento de marca (duotono
 * magenta/cian + glitch) y las latas reales recortadas.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FONTS = path.join(__dirname, '..', 'fonts');
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-color.png');
const LATA_CLASSIC = path.join(__dirname, '..', 'anuncios', 'higgsfield', 'lata-classic-solo.png');
const LATA_PUNCH = path.join(__dirname, '..', 'anuncios', 'higgsfield', 'lata-punch-solo.png');
const BG_DIR = path.join(__dirname, '..', 'deporte', 'higgsfield');

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
  .scrim{position:absolute;inset:0;background:linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.15) 24%, rgba(0,0,0,.25) 55%, rgba(0,0,0,.78) 100%)}

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

  .top{position:absolute;top:52px;left:0;right:0;display:flex;justify-content:space-between;align-items:center;
       padding:0 56px;z-index:6}
  .handle{font-family:'Oswald';font-weight:700;font-size:19px;letter-spacing:.22em;color:${C.blanco};
          text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,.9)}
  .num{font-family:'Oswald';font-weight:700;font-size:19px;letter-spacing:.1em;color:${C.blanco};
       text-shadow:0 2px 8px rgba(0,0,0,.9)}

  .chip{position:absolute;left:66px;background:${C.magenta};color:#000;font-family:'Oswald';font-weight:700;
        font-size:23px;letter-spacing:.03em;text-transform:uppercase;padding:11px 20px;transform:rotate(-3deg);
        box-shadow:0 8px 20px rgba(0,0,0,.5);z-index:6}

  h1{position:absolute;left:0;right:0;text-align:center;font-family:'Anton';font-weight:400;
     text-transform:uppercase;color:${C.blanco};-webkit-text-stroke:2.5px #000;
     text-shadow:0 5px 0 #000,0 10px 22px rgba(0,0,0,.7);z-index:6;padding:0 56px}
  h1 .accent{color:${C.lima};-webkit-text-stroke:2.5px #000}

  .latas{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:flex-end;gap:6px;z-index:5}
  .latas img{height:330px;width:auto;object-fit:contain;
             filter:drop-shadow(0 22px 18px rgba(0,0,0,.6)) drop-shadow(0 0 34px rgba(255,6,156,.35)) drop-shadow(0 0 34px rgba(40,217,229,.25))}

  .fila{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:12px;z-index:6}
  .b{font-family:'Oswald';font-weight:700;font-size:23px;letter-spacing:.02em;text-transform:uppercase;
     padding:12px 22px;text-align:center}
  .b.mag{background:${C.magenta};color:#000}
  .b.wht{background:${C.blanco};color:#000}
  .b.lim{background:${C.lima};color:#000}

  .caption{position:absolute;left:100px;right:100px;text-align:center;font-family:'Marker';
           font-size:27px;line-height:1.32;color:${C.blanco};text-shadow:0 2px 10px rgba(0,0,0,.9);z-index:6}

  .badges{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:12px;z-index:6}
  .badge{font-family:'Oswald';font-weight:700;font-size:18px;letter-spacing:.08em;text-transform:uppercase;
         padding:11px 20px;border-radius:999px;border:2px solid ${C.blanco};color:${C.blanco};background:rgba(0,0,0,.4)}

  .footer{position:absolute;bottom:56px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:6}
  .footer img{width:130px;filter:drop-shadow(0 4px 14px rgba(0,0,0,.8))}
  .footer .tag{font-family:'Oswald';font-weight:700;font-size:16px;letter-spacing:.14em;color:#cfd6e0;text-transform:uppercase}

  .cta{position:absolute;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;font-size:22px;
       letter-spacing:.14em;color:${C.lima};text-transform:uppercase;text-shadow:0 2px 10px rgba(0,0,0,.9);z-index:6}
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

const cans = `
  ${latexClassic ? `<img src="data:image/png;base64,${latexClassic}">` : ''}
  ${latexPunch ? `<img src="data:image/png;base64,${latexPunch}">` : ''}
`;

const footerHTML = `
  <div class="footer">
    ${logo ? `<img src="data:image/png;base64,${logo}">` : ''}
    <div class="tag">PowerDrink · No energética</div>
  </div>
`;

const slides = [
  {
    archivo: 'moto', nombre: '01-portada',
    extra: `
      <div class="top"><div class="handle">${M.instagram}</div><div class="num">01/03</div></div>
      <div class="scrim"></div>
      <div class="chip" style="top:130px">Bebida funcional</div>
      <h1 style="top:196px;font-size:74px;line-height:1.02">¿Y SI TU BEBIDA<br>FAVORITA TE DIERA<br><span class="accent">ALGO MÁS?</span></h1>
      <div class="latas" style="top:560px">${cans}</div>
      <div class="cta" style="bottom:120px">Desliza →</div>
    `,
  },
  {
    archivo: 'basket', nombre: '02-prebioticos',
    extra: `
      <div class="top"><div class="handle">${M.instagram}</div><div class="num">02/03</div></div>
      <div class="scrim"></div>
      <div class="chip" style="top:130px">¿Qué lleva adentro?</div>
      <h1 style="top:196px;font-size:96px;line-height:.94">PRE<br><span class="accent">BIÓTICOS</span> 🦠</h1>
      <div class="latas" style="top:470px">${cans}</div>
      <div class="fila" style="top:832px">
        <span class="b mag">Vitaminas y minerales</span>
        <span class="b lim">Magnesio + Zinc</span>
      </div>
      <div class="caption" style="top:928px">Fibra que alimenta las bacterias<br>buenas de tu intestino. Eso es todo.</div>
    `,
  },
  {
    archivo: 'skate', nombre: '03-cierre',
    extra: `
      <div class="top"><div class="handle">${M.instagram}</div><div class="num">03/03</div></div>
      <div class="scrim"></div>
      <h1 style="top:190px;font-size:88px;line-height:.94">EPIC<br>POR <span class="accent">DENTRO</span></h1>
      <div class="latas" style="top:470px">${cans}</div>
      <div class="badges" style="top:832px">
        <span class="badge">Sin sellos</span>
        <span class="badge">Cero azúcar</span>
        <span class="badge">Cero cafeína</span>
      </div>
      ${footerHTML}
    `,
  },
];

const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

console.log('\n  YEET · carrusel "Bebida funcional / Prebióticos"\n');

slides.forEach(s => {
  const fondo = b64(path.join(BG_DIR, `${s.archivo}.png`));
  if (!fondo) { console.log(`  ⚠ Falta ${s.archivo}.png`); return; }

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${baseCSS(fondo)}</style></head>
<body>${glitchHTML}${s.extra}</body></html>`;

  const htmlPath = path.join(__dirname, `${s.nombre}.html`);
  const pngPath = path.join(outPNG, `${s.nombre}.png`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  process.stdout.write(`  ${s.nombre} ... `);
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
