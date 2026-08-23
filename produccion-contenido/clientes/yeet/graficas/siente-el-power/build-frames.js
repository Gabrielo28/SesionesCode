/*
 * "Siente el Power" — versión renovada del video real de la marca
 * (referencia: DisplayPoint_247_final.mp4, pieza real del cliente)
 *   node build-frames.js
 * Salida: 4 frames 1080x1920 en PNG/, listos para animar a video.
 *
 * Sistema visual replicado del video real: collage de manchas de color
 * plano (verde base + amarillo/magenta/azul/rojo en los bordes),
 * duotono verde sobre metraje de acción, tipografía brush azul con
 * contorno blanco, checklist con ✓/✗, logo e ícono de rinoceronte reales.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FONTS = path.join(__dirname, '..', 'fonts');
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-color.png');
const LATA_PUNCH = path.join(__dirname, '..', 'anuncios', 'higgsfield', 'lata-punch-solo.png');
const LATA_CLASSIC = path.join(__dirname, '..', 'anuncios', 'higgsfield', 'lata-classic-solo.png');
const BG_DIR = path.join(__dirname, '..', 'deporte', 'higgsfield');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const logo = b64(LOGO);
const latexPunch = b64(LATA_PUNCH);
const latexClassic = b64(LATA_CLASSIC);
const antonF = b64(path.join(FONTS, 'Anton.ttf'));
const markerF = b64(path.join(FONTS, 'PermanentMarker.ttf'));

// Blobs de color en las esquinas, con curvas suaves (clip-path), sobre base verde.
// Más pulido que el original (bordes limpios en vez de "papel roto").
const collageCSS = `
  .collage{position:absolute;inset:0;background:#3ee08a;overflow:hidden;z-index:0}
  .blob{position:absolute}
  .b-yellow-tl{top:-8%;left:-10%;width:62%;height:38%;background:#f4e02a;
    clip-path:path('M0,0 L420,0 Q560,60 520,160 Q460,260 320,240 Q140,220 60,160 Q-10,90 0,0 Z')}
  .b-magenta-tr{top:-4%;right:-8%;width:46%;height:56%;background:${C.magenta};
    clip-path:path('M520,0 L520,520 Q420,560 340,460 Q260,360 300,240 Q340,120 420,40 Q470,0 520,0 Z')}
  .b-red-t{top:-3%;right:18%;width:20%;height:16%;background:#e0273c;
    clip-path:path('M0,140 Q-10,60 60,10 Q140,-20 190,40 Q220,90 170,140 Q100,180 0,140 Z')}
  .b-blue-l1{top:36%;left:-12%;width:30%;height:16%;background:#2a2ed6;
    clip-path:path('M0,60 Q0,10 60,0 L280,0 Q330,10 330,60 Q330,110 280,120 L60,120 Q0,110 0,60 Z')}
  .b-blue-l2{top:56%;left:-14%;width:32%;height:26%;background:#2a2ed6;
    clip-path:path('M0,100 Q-10,40 70,10 Q160,-20 250,40 Q320,90 280,170 Q230,260 120,250 Q20,240 0,100 Z')}
  .b-yellow-br{bottom:-6%;right:-8%;width:40%;height:30%;background:#f4e02a;
    clip-path:path('M400,300 L0,300 Q-10,180 90,120 Q190,60 300,110 Q400,160 400,300 Z')}
  .b-red-b{bottom:-4%;left:8%;width:60%;height:14%;background:#e0273c;
    clip-path:path('M0,60 Q-10,10 80,0 L500,0 Q590,10 580,60 Q570,110 480,110 L100,110 Q10,110 0,60 Z')}
  .grain{position:absolute;inset:0;opacity:.12;mix-blend-mode:overlay;z-index:1;
    background-image:radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px);background-size:3px 3px}
`;

const collageHTML = `
  <div class="collage">
    <div class="blob b-yellow-tl"></div>
    <div class="blob b-magenta-tr"></div>
    <div class="blob b-red-t"></div>
    <div class="blob b-blue-l1"></div>
    <div class="blob b-blue-l2"></div>
    <div class="blob b-yellow-br"></div>
    <div class="blob b-red-b"></div>
    <div class="grain"></div>
  </div>
`;

const baseCSS = `
  @font-face { font-family:'Anton'; src:url(data:font/ttf;base64,${antonF}) format('truetype'); }
  @font-face { font-family:'Marker'; src:url(data:font/ttf;base64,${markerF}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1920px;overflow:hidden;position:relative;
       font-family:'Anton',sans-serif;color:#fff}
  ${collageCSS}

  .titulo{position:absolute;left:0;right:0;text-align:center;z-index:6;
          font-family:'Marker';color:#fff;-webkit-text-stroke:2px #1a1acc}
  .titulo .l{display:block}

  .lata{position:absolute;z-index:5;width:auto;object-fit:contain;
        filter:drop-shadow(0 30px 30px rgba(0,0,0,.4))}

  .accion{position:absolute;inset:0;z-index:2;overflow:hidden}
  .accion img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
    filter:grayscale(1) sepia(1) hue-rotate(60deg) saturate(4.5) brightness(.75) contrast(1.05)}
  .accion .duotono{position:absolute;inset:0;background:#1fae5a;mix-blend-mode:color;z-index:3}
  .accion .oscurecer{position:absolute;inset:0;background:rgba(10,40,20,.28);z-index:3}

  .check{display:flex;align-items:center;gap:16px}
  .check .txt{font-family:'Marker';font-size:44px;color:#fff;-webkit-text-stroke:1.6px #1a1acc;line-height:1.15}
  .check .ico{font-size:52px;font-weight:900;flex-shrink:0}
  .check .ico.si{color:#5a3ee0}
  .check .ico.no{color:#f4e02a;-webkit-text-stroke:2px #7a6600}

  .logo-final{z-index:6;width:auto}
  .rhino{position:absolute;z-index:4;opacity:.95}
`;

const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

const frames = [
  // ---------- 1. HERO — lata + titular ----------
  {
    nombre: '01-hero',
    extra: `
      ${collageHTML}
      <div class="titulo" style="top:130px;font-size:92px;line-height:1.02">
        <span class="l">SIENTE</span><span class="l">EL POWER!</span>
      </div>
      ${latexPunch ? `<img class="lata" src="data:image/png;base64,${latexPunch}"
        style="top:660px;left:50%;transform:translateX(-50%) rotate(-2deg);height:760px">` : ''}
    `,
  },
  // ---------- 2. ACCIÓN + recárgate ----------
  {
    nombre: '02-accion',
    extra: `
      <div class="accion">
        <img src="data:image/png;base64,${b64(path.join(BG_DIR, 'skate.png'))}">
        <div class="duotono"></div>
        <div class="oscurecer"></div>
      </div>
      <div class="titulo" style="top:110px;font-size:88px;line-height:1.02;z-index:6">
        <span class="l">¡RECÁRGATE</span><span class="l">AQUÍ!</span>
      </div>
    `,
  },
  // ---------- 3. CHECKLIST sobre acción ----------
  {
    nombre: '03-checklist',
    extra: `
      <div class="accion">
        <img src="data:image/png;base64,${b64(path.join(BG_DIR, 'moto.png'))}">
        <div class="duotono"></div>
        <div class="oscurecer"></div>
      </div>
      <div style="position:absolute;top:150px;left:60px;right:60px;z-index:6;display:flex;flex-direction:column;gap:56px">
        <div class="check"><span class="txt">Con Vitaminas<br>B, C, D</span><span class="ico si">✔</span></div>
        <div class="check"><span class="txt">Con Prebióticos<br>y Minerales</span><span class="ico si">✔</span></div>
        <div class="check"><span class="txt">Sin Cafeína<br>Sin Azúcar<br>Sin Sellos</span><span class="ico no">✕</span></div>
      </div>
    `,
  },
  // ---------- 4. CIERRE — logo + lata ----------
  {
    nombre: '04-cierre',
    extra: `
      ${collageHTML}
      ${logo ? `<img class="logo-final" src="data:image/png;base64,${logo}"
        style="position:absolute;top:120px;left:50%;transform:translateX(-50%);width:640px;z-index:6">` : ''}
      ${latexClassic ? `<img class="lata" src="data:image/png;base64,${latexClassic}"
        style="top:700px;left:50%;transform:translateX(-50%) rotate(2deg);height:740px">` : ''}
    `,
  },
];

console.log('\n  YEET · "Siente el Power" — frames\n');

frames.forEach(f => {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${baseCSS}</style></head>
<body>${f.extra}</body></html>`;

  const htmlPath = path.join(__dirname, `${f.nombre}.html`);
  const pngPath = path.join(outPNG, `${f.nombre}.png`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  process.stdout.write(`  ${f.nombre} ... `);
  try {
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--virtual-time-budget=2000',
      `--screenshot=${pngPath}`, '--window-size=1080,1920',
      'file://' + htmlPath], { stdio: 'pipe' });
    console.log('✓');
  } catch (e) {
    console.log('✗', String(e.stderr || e.message).slice(0, 300));
  }
});

console.log(`\n  → ${outPNG}\n`);
