/*
 * Carrusel "Epic Like You" — secuencia motivadora para adolescentes
 *   node build-carrusel.js
 * Salida: 4 slides 1080x1350 en PNG/
 *
 * Estilo validado por el cliente: producto nítido + fondo real desenfocado
 * + splash de líquido en colores de marca, sin glitch. Narrativa: momento
 * relatable → tranquilidad "sin estimulantes" → qué sí tiene → cierre con
 * el tagline de marca.
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
const SPLASH_DIR = path.join(__dirname, '..', 'splash', 'higgsfield');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const logo = b64(LOGO);
const latexClassic = b64(LATA_CLASSIC);
const latexPunch = b64(LATA_PUNCH);
const antonF = b64(path.join(FONTS, 'Anton.ttf'));
const oswaldF = b64(path.join(FONTS, 'Oswald-Bold.ttf'));
const markerF = b64(path.join(FONTS, 'PermanentMarker.ttf'));

const baseCSS = (fondo, blur) => `
  @font-face { font-family:'Anton'; src:url(data:font/ttf;base64,${antonF}) format('truetype'); }
  @font-face { font-family:'Oswald'; src:url(data:font/ttf;base64,${oswaldF}) format('truetype'); font-weight:700; }
  @font-face { font-family:'Marker'; src:url(data:font/ttf;base64,${markerF}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:#000;overflow:hidden;position:relative;
       font-family:'Oswald',sans-serif;color:${C.blanco}}

  .fondo{position:absolute;inset:-30px;background:url(data:image/png;base64,${fondo}) center/cover no-repeat;
         filter:blur(${blur}px) brightness(.6) saturate(1.05)}
  .scrim-top{position:absolute;left:0;right:0;top:0;height:280px;
             background:linear-gradient(to bottom, rgba(0,0,0,.65) 0%, rgba(0,0,0,0) 100%);z-index:2}
  .scrim-bottom{position:absolute;left:0;right:0;bottom:0;height:560px;
                background:linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.5) 42%, rgba(0,0,0,0) 100%);z-index:2}

  .top{position:absolute;top:52px;left:0;right:0;display:flex;justify-content:space-between;
       align-items:center;padding:0 54px;z-index:8}
  .handle{font-family:'Oswald';font-weight:700;font-size:19px;letter-spacing:.22em;color:${C.blanco};
          text-transform:uppercase;text-shadow:0 2px 8px rgba(0,0,0,.9)}
  .num{font-family:'Oswald';font-weight:700;font-size:19px;letter-spacing:.1em;color:${C.blanco};
       text-shadow:0 2px 8px rgba(0,0,0,.9)}
  .logo-corner{position:absolute;top:44px;left:48px;width:150px;z-index:8;
               filter:drop-shadow(0 4px 12px rgba(0,0,0,.75))}

  .sobre{position:absolute;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;
         font-size:23px;letter-spacing:.16em;text-transform:uppercase;color:${C.lima};z-index:8;
         text-shadow:0 2px 8px rgba(0,0,0,.9)}
  h1{position:absolute;left:0;right:0;text-align:center;font-family:'Anton';font-weight:400;
     color:${C.blanco};-webkit-text-stroke:3px #000;text-shadow:0 6px 0 #000;z-index:8}
  h1 .accent{color:${C.lima};-webkit-text-stroke:3px #000}
  h1 .accent-m{color:${C.magenta};-webkit-text-stroke:3px #000}

  .splash{position:absolute;z-index:6;mix-blend-mode:screen}

  .sombra{position:absolute;border-radius:50%;background:radial-gradient(ellipse,
          rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 72%);z-index:4}

  .lata{position:absolute;z-index:7;width:auto;object-fit:contain}

  .caption{position:absolute;left:0;right:0;text-align:center;z-index:8;
           font-family:'Marker';color:${C.blanco};text-shadow:0 2px 10px rgba(0,0,0,.9)}

  .chips{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:12px;z-index:8;flex-wrap:wrap;padding:0 60px}
  .chip{background:${C.magenta};color:#000;font-family:'Oswald';font-weight:700;font-size:19px;
        letter-spacing:.03em;text-transform:uppercase;padding:11px 20px;box-shadow:0 8px 20px rgba(0,0,0,.5)}
  .chip.wht{background:${C.blanco}}
  .chip.lim{background:${C.lima}}

  .badge{font-family:'Oswald';font-weight:700;font-size:16px;letter-spacing:.06em;text-transform:uppercase;
         padding:9px 18px;border-radius:999px;border:2px solid ${C.blanco};color:${C.blanco};
         background:rgba(0,0,0,.5)}
  .badges{position:absolute;left:0;right:0;display:flex;justify-content:center;gap:10px;z-index:8}

  .cta{position:absolute;left:0;right:0;text-align:center;font-family:'Oswald';font-weight:700;
       font-size:21px;letter-spacing:.16em;color:${C.lima};text-transform:uppercase;z-index:8;
       text-shadow:0 2px 10px rgba(0,0,0,.9)}
`;

const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

const slides = [
  // ---------- 1. HOOK — momento relatable, portada ----------
  {
    nombre: '01-portada',
    fondo: b64(path.join(BG_DIR, 'skate.png')),
    blur: 10,
    extra: `
      <div class="top"><div class="handle">${M.instagram}</div><div class="num">01/04</div></div>
      <div class="sobre" style="top:150px">Tu día, tu momento</div>
      <h1 style="top:196px;font-size:80px;line-height:.98;padding:0 56px">
        TODO EPIC<br>EMPIEZA <span class="accent">CONTIGO</span>
      </h1>
      ${b64(path.join(SPLASH_DIR, 'splash-1.png')) ? `<img class="splash" style="top:420px;left:50%;transform:translateX(-46%);width:800px"
        src="data:image/png;base64,${b64(path.join(SPLASH_DIR, 'splash-1.png'))}">` : ''}
      <div class="sombra" style="bottom:340px;left:50%;transform:translateX(-50%);width:250px;height:50px"></div>
      ${latexClassic ? `<img class="lata" style="bottom:356px;left:50%;transform:translateX(-50%) rotate(-3deg);height:540px"
        src="data:image/png;base64,${latexClassic}">` : ''}
      <div class="cta" style="bottom:110px">Desliza →</div>
    `,
  },
  // ---------- 2. TRANQUILIDAD — sin cafeína / sin estimulantes ----------
  {
    nombre: '02-sin-estimulantes',
    fondo: b64(path.join(BG_DIR, 'moto.png')),
    blur: 10,
    extra: `
      <div class="top"><div class="handle">${M.instagram}</div><div class="num">02/04</div></div>
      <div class="sobre" style="top:150px">La energía es tuya</div>
      <h1 style="top:196px;font-size:70px;line-height:1.02;padding:0 56px">
        SIN CAFEÍNA.<br>SIN <span class="accent-m">ESTIMULANTES</span>.
      </h1>
      ${b64(path.join(SPLASH_DIR, 'splash-2.png')) ? `<img class="splash" style="top:430px;left:50%;transform:translateX(-46%);width:760px"
        src="data:image/png;base64,${b64(path.join(SPLASH_DIR, 'splash-2.png'))}">` : ''}
      <div class="sombra" style="bottom:340px;left:50%;transform:translateX(-50%);width:250px;height:50px"></div>
      ${latexPunch ? `<img class="lata" style="bottom:356px;left:50%;transform:translateX(-50%) rotate(3deg);height:540px"
        src="data:image/png;base64,${latexPunch}">` : ''}
      <div class="caption" style="bottom:180px;font-size:25px;line-height:1.3;padding:0 90px">
        Nosotros solo te acompañamos. El resto lo pones tú.
      </div>
    `,
  },
  // ---------- 3. SUSTANCIA — qué sí tiene ----------
  {
    nombre: '03-que-tiene',
    fondo: b64(path.join(BG_DIR, 'basket.png')),
    blur: 10,
    extra: `
      <div class="top"><div class="handle">${M.instagram}</div><div class="num">03/04</div></div>
      <div class="sobre" style="top:150px">Lo que sí tiene</div>
      <h1 style="top:196px;font-size:74px;line-height:1;padding:0 56px">
        VITAMINAS +<br><span class="accent">PREBIÓTICOS</span> 🦠
      </h1>
      <div class="sombra" style="bottom:498px;left:50%;transform:translateX(-50%);width:250px;height:50px"></div>
      ${latexClassic ? `<img class="lata" style="bottom:514px;left:50%;transform:translateX(-50%) rotate(-4deg);height:400px"
        src="data:image/png;base64,${latexClassic}">` : ''}
      <div class="chips" style="bottom:340px">
        <span class="chip wht">Vitaminas B·C·D3</span>
        <span class="chip lim">Magnesio + Zinc</span>
      </div>
      <div class="caption" style="bottom:230px;font-size:24px;line-height:1.28;padding:0 80px">
        1g de fibra prebiótica que alimenta<br>las bacterias buenas de tu intestino.
      </div>
      <div class="badges" style="bottom:170px">
        <span class="badge">Sin sellos</span>
        <span class="badge">Cero azúcar</span>
      </div>
    `,
  },
  // ---------- 4. CIERRE — tagline + CTA ----------
  {
    nombre: '04-cierre',
    fondo: b64(path.join(BG_DIR, 'skate.png')),
    blur: 12,
    extra: `
      <div class="top"><div></div><div class="num">04/04</div></div>
      ${logo ? `<img class="logo-corner" src="data:image/png;base64,${logo}">` : ''}
      <h1 style="top:220px;font-size:104px;line-height:.94;padding:0 40px">
        EPIC<br>LIKE <span class="accent">YOU</span>
      </h1>
      ${b64(path.join(SPLASH_DIR, 'splash-1.png')) ? `<img class="splash" style="top:540px;left:50%;transform:translateX(-45%);width:720px"
        src="data:image/png;base64,${b64(path.join(SPLASH_DIR, 'splash-1.png'))}">` : ''}
      <div class="sombra" style="bottom:340px;left:50%;transform:translateX(-50%);width:240px;height:48px"></div>
      ${latexPunch ? `<img class="lata" style="bottom:356px;left:50%;transform:translateX(-50%) rotate(4deg);height:520px"
        src="data:image/png;base64,${latexPunch}">` : ''}
      <div class="cta" style="bottom:190px">yeetpowerdrink.cl</div>
      <div class="badges" style="bottom:130px">
        <span class="badge">Sin cafeína</span>
        <span class="badge">Sin sellos</span>
        <span class="badge">Cero azúcar</span>
      </div>
    `,
  },
];

console.log('\n  YEET · carrusel "Epic Like You"\n');

slides.forEach(s => {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${baseCSS(s.fondo, s.blur)}</style></head>
<body>
  <div class="fondo"></div>
  <div class="scrim-top"></div>
  <div class="scrim-bottom"></div>
  ${s.extra}
</body></html>`;

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
