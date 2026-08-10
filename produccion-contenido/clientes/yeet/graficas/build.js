/*
 * Generador de gráficas — YEET PowerDrink
 *   node build.js            genera el carrusel definido en slides[]
 * Salida: HTML por slide + PNG 1080x1350 en PNG/
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const FUENTE = path.join(RAIZ, 'carrusel-5-errores', 'assets', 'Montserrat.ttf');
const LOGO = 'C:/Users/mezma/OneDrive/Escritorio/TRABAJO/Yeet Epic Like You fuxia.png';

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'marca.json'), 'utf8'));
const C = M.colores;

const b64 = f => fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null;
const fuente = b64(FUENTE);
const logo = b64(LOGO);

// ---------- CARRUSEL: "Qué tiene adentro" (Post 1 de agosto) ----------
const slides = [
  {
    tipo: 'portada',
    sobre: 'Lo que nadie te muestra',
    titulo: 'QUÉ TIENE<br><span class="lima">ADENTRO</span>',
    pie: 'Desliza →'
  },
  {
    tipo: 'item',
    n: '01',
    etiqueta: 'COMPLEJO B',
    titulo: 'B3 · B5<br>B6 · B12',
    texto: 'Cuatro vitaminas del complejo B en cada lata.'
  },
  {
    tipo: 'item',
    n: '02',
    etiqueta: 'VITAMINA C',
    titulo: 'VITAMINA<br>C',
    texto: 'La misma que buscas en los cítricos, en formato lata.'
  },
  {
    tipo: 'item',
    n: '03',
    etiqueta: 'VITAMINA D',
    titulo: 'VITAMINA<br>D',
    texto: 'La que cuesta conseguir en invierno chileno.'
  },
  {
    tipo: 'item',
    n: '04',
    etiqueta: 'PREBIÓTICOS',
    titulo: 'PRE<br>BIÓTICOS',
    texto: 'Fibra que alimenta las bacterias buenas de tu intestino. Eso es todo.'
  },
  {
    tipo: 'cierre',
    titulo: 'CERO<br><span class="lima">ESTIMULANTES</span>',
    texto: 'Por eso somos una PowerDrink<br>y no una energética.',
    cta: 'yeetpowerdrink.cl',
    badge: '15% OFF primera compra'
  }
];

// ---------- plantilla ----------
const css = `
  @font-face { font-family:'Mont'; src:url(data:font/ttf;base64,${fuente}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1080px;height:1350px;background:${C.negro};font-family:'Mont',sans-serif;
       overflow:hidden;position:relative;color:${C.blanco}}

  /* franja diagonal de energía */
  .diag{position:absolute;width:1600px;height:210px;background:${C.magenta};
        transform:rotate(-14deg);left:-260px;opacity:.28}
  .diag.a{top:170px}
  .diag.b{top:1010px;background:${C.lima};opacity:.20}

  .handle{position:absolute;top:56px;left:0;right:0;text-align:center;
          font-size:22px;font-weight:600;letter-spacing:.24em;color:${C.magenta};text-transform:uppercase}
  .num{position:absolute;top:52px;right:64px;font-size:22px;font-weight:800;color:#4a4a4a;letter-spacing:.1em}

  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;
        justify-content:center;padding:0 96px}

  .sobre{font-size:30px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
         color:${C.lima};margin-bottom:26px}
  h1{font-size:132px;font-weight:900;line-height:.92;letter-spacing:-.035em;text-transform:uppercase}
  h1.mid{font-size:118px}
  h1.compacto{font-size:104px}
  .lima{color:${C.lima}}
  .mag{color:${C.magenta}}

  .etq{display:inline-block;align-self:flex-start;background:${C.magenta};color:#fff;
       font-size:24px;font-weight:800;letter-spacing:.14em;padding:12px 26px;
       border-radius:6px;margin-bottom:34px}
  /* Relleno sólido, NO -webkit-text-stroke: la Montserrat variable en peso 900
     rompe el glifo del 4 al aplicarle contorno (aparecen cajas superpuestas). */
  .big{position:absolute;top:150px;right:96px;font-size:196px;font-weight:900;
       color:#242424;line-height:1;letter-spacing:-.04em}

  p{font-size:37px;font-weight:500;line-height:1.42;color:#d8d8d8;margin-top:36px;max-width:800px}

  .pie{position:absolute;bottom:70px;left:96px;font-size:27px;font-weight:700;
       letter-spacing:.1em;color:${C.lima}}
  .logo{position:absolute;bottom:56px;right:74px;width:250px;opacity:.95}
  .logo.c{position:static;width:330px;margin:0 auto 52px;display:block}

  .cta{margin-top:44px;display:inline-block;align-self:flex-start;background:${C.lima};color:#000;
       font-size:40px;font-weight:900;padding:24px 46px;border-radius:10px;letter-spacing:-.01em}
  .badge{margin-top:26px;font-size:27px;font-weight:700;color:${C.magenta};letter-spacing:.06em}
  .centro{text-align:center;align-items:center}
  .centro .cta,.centro .etq{align-self:center}
`;

const render = (s, i, total) => {
  const cab = `<div class="diag a"></div><div class="diag b"></div>
    <div class="handle">${M.instagram}</div>
    <div class="num">${String(i + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}</div>`;

  let cuerpo = '';
  if (s.tipo === 'portada') {
    cuerpo = `<div class="wrap">
        <div class="sobre">${s.sobre}</div>
        <h1>${s.titulo}</h1>
        <div class="pie">${s.pie}</div>
      </div>
      ${logo ? `<img class="logo" src="data:image/png;base64,${logo}">` : ''}`;
  } else if (s.tipo === 'item') {
    cuerpo = `<div class="big">${s.n}</div>
      <div class="wrap">
        <span class="etq">${s.etiqueta}</span>
        <h1 class="mid">${s.titulo}</h1>
        <p>${s.texto}</p>
      </div>
      ${logo ? `<img class="logo" src="data:image/png;base64,${logo}">` : ''}`;
  } else {
    cuerpo = `<div class="wrap centro">
        ${logo ? `<img class="logo c" src="data:image/png;base64,${logo}">` : ''}
        <h1 class="compacto">${s.titulo}</h1>
        <p style="margin-left:auto;margin-right:auto">${s.texto}</p>
        <span class="cta">${s.cta}</span>
        <div class="badge">${s.badge}</div>
      </div>`;
  }

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head>
    <body>${cab}${cuerpo}</body></html>`;
};

// ---------- build ----------
const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

console.log(`\n  YEET · carrusel "Qué tiene adentro" · ${slides.length} slides\n`);
if (!fuente) console.log('  ⚠ No encontré Montserrat.ttf — se usará fuente del sistema');
if (!logo) console.log('  ⚠ No encontré el logo — los slides saldrán sin él');

slides.forEach((s, i) => {
  const n = String(i + 1).padStart(2, '0');
  const html = path.join(__dirname, `slide-${n}.html`);
  const png = path.join(outPNG, `slide-${n}.png`);
  fs.writeFileSync(html, render(s, i, slides.length), 'utf8');
  process.stdout.write(`  slide ${n} ... `);
  try {
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
      `--screenshot=${png}`, '--window-size=1080,1350',
      'file:///' + html.replace(/\\/g, '/')], { stdio: 'pipe' });
    console.log('✓');
  } catch (e) {
    console.log('✗', String(e.stderr || e.message).slice(0, 120));
  }
});

console.log(`\n  → ${outPNG}\n`);
