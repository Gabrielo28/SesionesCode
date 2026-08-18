/*
 * Generador de gráficas — World King
 *   node build.js            genera todas las piezas definidas en piezas[]
 * Salida: HTML por pieza + PNG en PNG/
 *
 * Las piezas fotorrealistas (fondos generados con Higgsfield) viven en ../visuales/
 * y se embeben como base64. Este script sólo pone la capa tipográfica encima.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Chrome/Chromium: se busca en las rutas habituales de Windows, macOS y Linux.
const CANDIDATOS_CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);

const CHROME = CANDIDATOS_CHROME.find(p => { try { return fs.existsSync(p); } catch { return false; } });

const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const FUENTE = path.join(RAIZ, 'carrusel-5-errores', 'assets', 'Montserrat.ttf');
const VISUALES = path.join(__dirname, '..', 'visuales');

const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'marca.json'), 'utf8'));
const C = M.colores;

const b64 = f => { try { return fs.existsSync(f) ? fs.readFileSync(f).toString('base64') : null; } catch { return null; } };
const fuente = b64(FUENTE);
const fondo = n => b64(path.join(VISUALES, n));

// ---------- DATOS ----------
// Confirmados en el press kit oficial (ver ../press-kit-oficial.pdf).
const EP = '3L REYGRESO';
const SINGLE = 'CACHAY';
const FORMATO_AUDIO = 'DOLBY ATMOS 7.1.4';
const COORDENADAS = '33°21\'S  70°31\'W';   // Lo Barnechea, Cerro 18 Sur — barrio del artista
const ORIGEN = 'CERRO 18 SUR · LO BARNECHEA';

// PENDIENTE del cliente: se muestra como marcador visible para no publicar datos inventados.
const FECHA_LANZAMIENTO = 'XX.XX.2026';

// ---------- PIEZAS ----------
const piezas = [
  {
    id: 'post-02-slide-02-espectro',
    w: 1080, h: 1350,
    tipo: 'espectro',
    kicker: 'ESPECIFICACIÓN TÉCNICA',
    titulo: 'SONIDOS<br><span class="cian">TR3E</span> DIMENSIONAL',
    texto: 'La mezcla se mueve alrededor tuyo, no delante. Por eso hay que escucharlo con audífonos.',
    pie: `${FORMATO_AUDIO} · SEGUIMIENTO ESPACIAL`,
  },
  {
    id: 'post-02-slide-03-coordenadas',
    w: 1080, h: 1350,
    tipo: 'coordenadas',
    kicker: 'PUNTO DE ORIGEN',
    coords: COORDENADAS,
    altitud: ORIGEN,
    titulo: EP,
    texto: `El single <b>${SINGLE}</b> ya está sonando.<br>El EP completo aterriza el ${FECHA_LANZAMIENTO}.`,
  },
  {
    id: 'post-03-slide-01-terminal',
    w: 1080, h: 1350,
    tipo: 'terminal',
    kicker: 'REGISTRO VERIFICADO',
    titulo: 'NO ES LA<br><span class="cian">PRIMERA VEZ</span>',
    filas: [
      ['FESTIVAL DE LAS CONDES · 2024', '+12.000'],
      ['SEMANA BARNECHEINA · 2019', '1º LUGAR'],
      ['GIRA DE MEDIOS · COLOMBIA', '2018'],
    ],
    pie: 'TELONERO DE CARLOS VIVES · SANTIAGO',
  },
  {
    id: 'historia-01-cuenta-regresiva',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'historia-01-fondo-cuenta-regresiva.png',
    kicker: 'SEÑAL DETECTADA',
    titulo: 'EL REY<br><span class="violeta">VUELVE</span>',
    texto: `${EP} · cuenta regresiva activa.`,
    hueco: true,   // deja aire abajo para el sticker nativo de cuenta regresiva
    pie: 'DEJA ESPACIO ABAJO PARA EL STICKER',
  },
  {
    id: 'historia-07-cita-musical',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'historia-07-fondo-estrellado.png',
    kicker: '',
    cita: true,
    titulo: '«LA BARRA MÁS<br>CONTUNDENTE<br>DEL TEMA VA ACÁ»',
    texto: '',
    hueco: true,   // aire abajo para la herramienta musical nativa de Instagram
    pie: 'DEJA ESPACIO ABAJO PARA EL STICKER DE MÚSICA',
  },
  {
    id: 'historia-08-ultimo-aviso',
    w: 1080, h: 1920,
    tipo: 'alerta',
    kicker: '⚠ TRANSMISIÓN FINAL',
    titulo: 'ÚLTIMO<br>AVISO',
    texto: 'El enlace está en la biografía.<br>Después de esto, la señal se corta.',
    pie: 'LINK EN BIO',
  },
];

// ---------- estilos ----------
const css = `
  @font-face { font-family:'Mont'; src:url(data:font/ttf;base64,${fuente}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:${C.negro};overflow:hidden}
  /* Todo se dibuja dentro de .frame, con tamaño explícito: si se posiciona
     contra el body, Chrome headless deja sin pintar la franja inferior. */
  .frame{position:relative;overflow:hidden;font-family:'Mont',sans-serif;
         background:${C.negro};color:${C.blanco}}

  /* fondo fotográfico generado con IA */
  .bg{position:absolute;inset:0;background-size:cover;background-position:center}
  .veil{position:absolute;inset:0}
  .veil.top{background:linear-gradient(180deg,rgba(5,2,8,.92) 0%,rgba(5,2,8,.45) 42%,rgba(5,2,8,.30) 62%,rgba(5,2,8,.95) 100%)}

  /* rejilla técnica de fondo */
  .grid{position:absolute;inset:0;opacity:.16;
        background-image:linear-gradient(${C.violeta} 1px,transparent 1px),
                         linear-gradient(90deg,${C.violeta} 1px,transparent 1px);
        background-size:90px 90px}
  .glowtop{position:absolute;top:-30%;left:50%;transform:translateX(-50%);
           width:150%;height:70%;border-radius:50%;
           background:radial-gradient(closest-side,${C.violeta}66,transparent 70%);filter:blur(20px)}
  .glowbot{position:absolute;bottom:-25%;left:50%;transform:translateX(-50%);
           width:130%;height:55%;border-radius:50%;
           background:radial-gradient(closest-side,${C.cian}33,transparent 70%);filter:blur(20px)}

  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;
        justify-content:center;padding:0 96px;z-index:5}
  .wrap.arriba{justify-content:flex-start;padding-top:250px}

  .handle{position:absolute;top:60px;left:96px;right:96px;z-index:6;
          display:flex;justify-content:space-between;align-items:center;
          font-size:21px;font-weight:700;letter-spacing:.26em;color:${C.violeta_claro}}
  .handle .r{color:#5B4A72;letter-spacing:.18em}

  .kicker{font-size:26px;font-weight:700;letter-spacing:.30em;text-transform:uppercase;
          color:${C.cian};margin-bottom:30px;display:flex;align-items:center;gap:18px}
  .kicker::before{content:'';width:52px;height:2px;background:${C.cian}}

  h1{font-size:112px;font-weight:900;line-height:.94;letter-spacing:-.035em;text-transform:uppercase}
  h1.xl{font-size:150px}
  h1.mono{font-family:'Mont',ui-monospace,monospace;font-size:132px;letter-spacing:-.02em}
  h1.cita{font-size:78px;line-height:1.14;letter-spacing:-.02em;font-weight:800}
  .cian{color:${C.cian}}
  .violeta{color:${C.violeta_claro}}

  p{font-size:35px;font-weight:500;line-height:1.45;color:${C.gris_texto};
    margin-top:38px;max-width:800px}

  .pie{position:absolute;bottom:78px;left:96px;right:96px;z-index:6;line-height:1.35;
       font-size:22px;font-weight:700;letter-spacing:.22em;color:${C.violeta_claro};
       text-transform:uppercase}
  .pie.pendiente{color:#6E5A88;font-weight:600;letter-spacing:.12em}

  /* --- espectro de audio 3D --- */
  .barras{display:flex;align-items:flex-end;gap:11px;height:300px;margin-top:64px}
  .barras i{flex:1;border-radius:4px 4px 0 0;
            background:linear-gradient(180deg,${C.cian},${C.violeta})}
  .orbita{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
          width:760px;height:760px;border:2px solid ${C.violeta}44;border-radius:50%}
  .orbita.b{width:540px;height:540px;border-color:${C.cian}44}
  .orbita.c{width:320px;height:320px;border-color:${C.violeta}66}

  /* --- coordenadas --- */
  .coordbox{border:2px solid ${C.violeta}55;background:${C.negro_panel}CC;
            padding:44px 48px;margin-bottom:52px;align-self:flex-start}
  .coordbox .l{font-size:24px;letter-spacing:.24em;color:#7C6A94;font-weight:600;margin-bottom:12px}
  .coordbox .v{font-size:44px;letter-spacing:.06em;font-weight:800;color:${C.cian}}
  .coordbox .v+.l{margin-top:30px}

  /* --- terminal de datos --- */
  .tabla{margin-top:60px;border-top:2px solid ${C.violeta}55}
  .tabla .fila{display:flex;justify-content:space-between;align-items:baseline;
               padding:32px 4px;border-bottom:1px solid ${C.violeta}33}
  .tabla .k{font-size:29px;font-weight:600;letter-spacing:.14em;color:${C.gris_texto}}
  .tabla .v{font-size:52px;font-weight:900;color:${C.cian};letter-spacing:-.01em}

  /* --- alerta --- */
  .scan{position:absolute;inset:0;opacity:.30;
        background:repeating-linear-gradient(180deg,${C.violeta}22 0 2px,transparent 2px 7px)}
  .marco{position:absolute;inset:44px;border:3px solid ${C.violeta};opacity:.75}
  .marco::before,.marco::after{content:'';position:absolute;width:60px;height:60px;
        border:5px solid ${C.cian}}
  .marco::before{top:-5px;left:-5px;border-right:0;border-bottom:0}
  .marco::after{bottom:-5px;right:-5px;border-left:0;border-top:0}

  .centro{text-align:center;align-items:center}
  .centro .kicker{justify-content:center}
  .centro .kicker::before{display:none}
  .centro p{margin-left:auto;margin-right:auto}
`;

// ---------- render ----------
const barras = () => Array.from({ length: 26 }, (_, i) => {
  // curva simétrica tipo espectro, determinista para que el build sea reproducible
  const t = i / 25;
  const alto = 18 + 82 * Math.pow(Math.sin(Math.PI * t), 1.5) * (0.62 + 0.38 * Math.abs(Math.sin(i * 2.1)));
  return `<i style="height:${alto.toFixed(1)}%"></i>`;
}).join('');

const render = p => {
  const img = p.imagen ? fondo(p.imagen) : null;
  const cab = `
    ${img ? `<div class="bg" style="background-image:url(data:image/png;base64,${img})"></div>
             <div class="veil top"></div>` : `<div class="grid"></div><div class="glowtop"></div><div class="glowbot"></div>`}
    ${p.tipo === 'alerta' ? '<div class="scan"></div><div class="marco"></div>' : ''}
    <div class="handle"><span>${M.instagram}</span><span class="r">WORLD KING · 2026</span></div>`;

  let cuerpo = '';
  const kicker = p.kicker ? `<div class="kicker">${p.kicker}</div>` : '';

  if (p.tipo === 'espectro') {
    cuerpo = `<div class="orbita"></div><div class="orbita b"></div><div class="orbita c"></div>
      <div class="wrap">
        ${kicker}
        <h1>${p.titulo}</h1>
        <div class="barras">${barras()}</div>
        <p>${p.texto}</p>
      </div>`;
  } else if (p.tipo === 'coordenadas') {
    cuerpo = `<div class="wrap">
        ${kicker}
        <div class="coordbox">
          <div class="l">COORDENADAS</div><div class="v">${p.coords}</div>
          <div class="l">ALTITUD DE ORIGEN</div><div class="v">${p.altitud}</div>
        </div>
        <h1 class="mono">${p.titulo}</h1>
        <p>${p.texto}</p>
      </div>`;
  } else if (p.tipo === 'terminal') {
    cuerpo = `<div class="wrap">
        ${kicker}
        <h1>${p.titulo}</h1>
        <div class="tabla">
          ${p.filas.map(([k, v]) => `<div class="fila"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
        </div>
      </div>`;
  } else if (p.tipo === 'alerta') {
    cuerpo = `<div class="wrap centro">
        ${kicker}
        <h1 class="xl">${p.titulo}</h1>
        <p>${p.texto}</p>
      </div>`;
  } else { // historia sobre imagen
    cuerpo = `<div class="wrap ${p.hueco ? 'arriba' : ''}">
        ${kicker}
        <h1 class="${p.cita ? 'cita' : ''}">${p.titulo}</h1>
        ${p.texto ? `<p>${p.texto}</p>` : ''}
      </div>`;
  }

  const pie = p.pie ? `<div class="pie ${p.pie.startsWith('DEJA') ? 'pendiente' : ''}">${p.pie}</div>` : '';

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head>
    <body><div class="frame ${p.tipo}" style="width:${p.w}px;height:${p.h}px">${cab}${cuerpo}${pie}</div></body></html>`;
};

// ---------- build ----------
const outPNG = path.join(__dirname, 'PNG');
if (!fs.existsSync(outPNG)) fs.mkdirSync(outPNG, { recursive: true });

console.log(`\n  WORLD KING · ${piezas.length} gráficas\n`);
if (!fuente) console.log('  ⚠ No encontré Montserrat.ttf — se usará fuente del sistema');
if (!CHROME) { console.log('  ✗ No encontré Chrome/Chromium. Define CHROME_PATH.'); process.exit(1); }

piezas.forEach(p => {
  const html = path.join(__dirname, `${p.id}.html`);
  const png = path.join(outPNG, `${p.id}.png`);
  fs.writeFileSync(html, render(p), 'utf8');
  process.stdout.write(`  ${p.id.padEnd(34)} ... `);
  try {
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--default-background-color=ff050208',
      `--screenshot=${png}`, `--window-size=${p.w},${p.h}`,
      'file://' + html.replace(/\\/g, '/')], { stdio: 'pipe' });
    console.log('✓');
  } catch (e) {
    console.log('✗', String(e.stderr || e.message).slice(0, 140));
  }
});

console.log(`\n  → ${outPNG}\n`);
