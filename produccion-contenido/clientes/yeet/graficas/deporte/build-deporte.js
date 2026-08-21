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
const LOGO = path.join(__dirname, '..', '..', 'assets', 'logo-color.png');
const FONTS = path.join(__dirname, '..', 'fonts');
const BG_DIR = path.join(__dirname, 'higgsfield');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'marca.json'), 'utf8'));
const C = M.colores;
const CIAN = '#28D9E5';

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

  /* --- duotono de marca: magenta arriba-izq, cian abajo-der --- */
  .duotono{position:absolute;inset:0;mix-blend-mode:color;opacity:.55;
           background:radial-gradient(circle at 12% 8%, ${C.magenta} 0%, transparent 42%),
                      radial-gradient(circle at 90% 96%, ${CIAN} 0%, transparent 46%)}
  .duotono2{position:absolute;inset:0;mix-blend-mode:overlay;opacity:.4;
            background:linear-gradient(135deg, ${C.magenta} 0%, transparent 30%, transparent 70%, ${CIAN} 100%)}

  /* --- ruido / glitch a pantalla completa --- */
  .glitch{position:absolute;inset:0;overflow:hidden;mix-blend-mode:screen}
  .glitch span{position:absolute;display:block}
  .gm{background:${C.magenta}}
  .gc{background:${CIAN}}
  .g1{top:2%;left:0;width:32%;height:10px;transform:skewX(-18deg);opacity:.9}
  .g2{top:2%;left:34%;width:16%;height:10px;transform:skewX(-18deg);opacity:.8}
  .g3{top:5%;left:6%;width:20%;height:6px;transform:skewX(-18deg);opacity:.7}
  .g4{top:5%;left:48%;width:36%;height:6px;transform:skewX(-18deg);opacity:.7}
  .g5{top:22%;right:0;width:10%;height:900px;opacity:.12}
  .g6{top:34%;left:0;width:1080px;height:3px;opacity:.55}
  .g7{top:34.4%;left:0;width:1080px;height:3px;opacity:.45}
  .g8{top:58%;left:8%;width:70px;height:70px;opacity:.35}
  .g9{top:63%;left:82%;width:44px;height:180px;opacity:.3}
  .g10{top:71%;left:0;width:220px;height:9px;transform:skewX(-18deg);opacity:.8}
  .g11{top:71%;left:240px;width:120px;height:9px;transform:skewX(-18deg);opacity:.6}
  .g12{top:88%;left:20%;width:1080px;height:2px;opacity:.4}
  .g13{top:12%;left:0;width:14px;height:1350px;opacity:.5}
  .g14{top:12%;left:18px;width:7px;height:1350px;opacity:.4}
  .scan{position:absolute;inset:0;mix-blend-mode:overlay;opacity:.5;
        background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0px,rgba(255,255,255,.08) 1px,transparent 1px,transparent 3px)}
  .grano{position:absolute;inset:0;opacity:.18;mix-blend-mode:overlay;
         background-image:radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px);
         background-size:3px 3px}

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
  <div class="duotono"></div>
  <div class="duotono2"></div>
  <div class="scrim-top"></div>
  <div class="glitch">
    <span class="g1 gm"></span><span class="g2 gc"></span><span class="g3 gc"></span><span class="g4 gm"></span>
    <span class="g5 gc"></span><span class="g6 gm"></span><span class="g7 gc"></span>
    <span class="g8 gm"></span><span class="g9 gc"></span><span class="g10 gc"></span><span class="g11 gm"></span>
    <span class="g12 gm"></span><span class="g13 gc"></span><span class="g14 gm"></span>
  </div>
  <div class="scan"></div>
  <div class="grano"></div>
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
