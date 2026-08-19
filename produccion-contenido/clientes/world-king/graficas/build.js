/*
 * Generador de gráficas — World King
 *   node build.js            genera todas las piezas definidas en piezas[]
 * Salida: HTML por pieza + PNG en PNG/
 *
 * Las piezas fotorrealistas (fondos generados con Higgsfield) viven en ../visuales/
 * y se embeben como base64. Este script sólo pone la capa tipográfica encima.
 *
 * DIRECCIÓN: género urbano con concepto espacial. El espacio es el escenario,
 * el código es de calle. Tipografía enorme que sangra, oro metálico, grano,
 * diagonales y texto encima de la foto — nunca ficha técnica ni tabla de datos.
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
const REFS = path.join(__dirname, '..', 'referencias');
const emblema = b64(path.join(REFS, 'logo-wk-emblema.png'));

// ---------- DATOS ----------
// Confirmados en el press kit oficial (ver ../press-kit-oficial.pdf).
const EP = '3L REYGRESO';
const SINGLE = 'CACHAY';
const FORMATO_AUDIO = 'DOLBY ATMOS 7.1.4';
const BARRIO = 'CERRO 18 SUR';
const COMUNA = 'LO BARNECHEA · SANTIAGO';

// PENDIENTE del cliente: se muestra como marcador visible para no publicar datos inventados.
const FECHA_LANZAMIENTO = 'XX.XX.2026';

// ---------- PIEZAS ----------
const piezas = [
  {
    // La llegada: instala quién es y de dónde viene.
    id: 'post-01-llegada',
    w: 1080, h: 1350,
    tipo: 'hero',
    imagen: 'real-rey-capa-espacio.png',
    sobre: 'TRANSMISIÓN DESDE LA EXÓSFERA',
    titulo: 'NO SOY<br><span class="oro">DE ACÁ</span>',
    texto: 'Bajé a traer algo que todavía no existe.',
    pie: `${EP} · ${FECHA_LANZAMIENTO}`,
  },
  {
    id: 'post-02-genero-nuevo',
    w: 1080, h: 1350,
    tipo: 'hero',
    imagen: 'exo-ondas.png',
    sobre: 'LO QUE TRAIGO',
    titulo: 'UN GÉNERO<br><span class="oro">NUEVO</span>',
    texto: 'Reguetón old school y percusión afro en vivo.<br>Nunca lo escuchaste así.',
    pie: `${SINGLE} · YA DISPONIBLE`,
  },
  {
    id: 'post-03-sonido',
    w: 1080, h: 1350,
    tipo: 'espectro',
    titulo: 'SONIDOS<br><span class="oro">TR<span class="tres">3</span>E</span><br>DIMENSIONAL',
    texto: 'Ponte los audífonos.<br>El sonido te da la vuelta.',
    pie: FORMATO_AUDIO,
  },
  {
    // El vestuario real: corona con gemas, lamé dorado, ankh, cetro.
    id: 'post-04-corona',
    w: 1080, h: 1350,
    tipo: 'hero',
    imagen: 'real-rey-luna.png',
    sobre: 'EL REY',
    titulo: 'LA CORONA<br><span class="oro">NO SE PRESTA</span>',
    texto: 'Bajé con ella puesta.',
    pie: '@worldkingoficial',
  },
  {
    id: 'post-05-ankh',
    w: 1080, h: 1350,
    tipo: 'hero',
    imagen: 'ankh-macro.png',
    sobre: 'LA MARCA',
    titulo: 'VIDA<br><span class="oro">ETERNA</span>',
    texto: 'El ankh no es adorno. Es de dónde vengo.',
    pie: `${EP}`,
  },
  {
    // Prueba social: el press kit ya citaba a Américo, ahora hay foto.
    id: 'post-06-trayectoria',
    w: 1080, h: 1350,
    tipo: 'flex',
    imagen: 'exo-multitud.png',
    sobre: 'NO ES LA PRIMERA VEZ',
    cifra: '12.000',
    unidad: 'PERSONAS',
    titulo: 'YA<br><span class="oro">ATERRICÉ</span><br>ANTES',
    pie: 'FESTIVAL DE LAS CONDES 2024 · TELONERO DE CARLOS VIVES',
  },

  // ----- PORTADAS DE REEL (9:16, el frame que se ve en el perfil) -----
  {
    id: 'reel-01-la-llegada',
    w: 1080, h: 1920,
    tipo: 'reel',
    imagen: 'exo-llegada-cielo.png',
    n: '01',
    sobre: 'PONTE AUDÍFONOS',
    titulo: 'LA<br><span class="oro">LLEGADA</span>',
    texto: 'Experiencia 3D',
  },
  {
    id: 'reel-02-adaptacion',
    w: 1080, h: 1920,
    tipo: 'reel',
    imagen: 'real-rey-story.png',
    n: '02',
    sobre: 'PERFORMANCE',
    titulo: 'ME<br><span class="oro">ADAPTO</span>',
    texto: 'Reguetón old school · percusión afro',
  },
  {
    id: 'reel-03-frecuencias',
    w: 1080, h: 1920,
    tipo: 'reel',
    imagen: 'exo-fondo-horizonte.png',
    n: '03',
    sobre: 'FRECUENCIAS ANÓMALAS',
    titulo: 'NO<br><span class="oro">SOY</span><br>HUMANO',
    texto: 'Slowed + reverb',
  },
  {
    id: 'reel-04-transmision',
    w: 1080, h: 1920,
    tipo: 'reel',
    imagen: 'exo-ondas.png',
    n: '04',
    sobre: 'TRANSMISIÓN DIRECTA',
    titulo: 'SINCRONIZA<br><span class="oro">TU FRECUENCIA</span>',
    texto: 'Link en la bio',
  },

  // ----- HISTORIAS QUE FALTABAN -----
  {
    id: 'historia-02-pregunta',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'exo-pregunta.png',
    sobre: 'CAJA DE INTERACCIÓN',
    titulo: '¿QUÉ<br><span class="oro">MENSAJE</span><br>ME LLEVO?',
    texto: 'De la Tierra a la exósfera.',
    hueco: true,
    pie: 'DEJA ESPACIO ABAJO PARA EL STICKER DE PREGUNTAS',
  },
  {
    id: 'historia-03-bts',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'exo-estudio.png',
    sobre: 'DETRÁS DE LA SEÑAL',
    titulo: 'ASÍ<br><span class="oro">SUENA</span><br>ADENTRO',
    texto: `${FORMATO_AUDIO}`,
    hueco: true,
    pie: 'DEJA ESPACIO ABAJO PARA EL STICKER AL SITIO',
  },
  {
    id: 'historia-04-outfit',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'detalle-corona.png',
    sobre: 'ANATOMÍA DEL EQUIPO',
    titulo: 'LA<br><span class="oro">CORONA</span>',
    texto: 'Equipado para la gravedad terrestre.',
    hueco: true,
    pie: '1 DE 3 · CORONA · HOMBRERAS · ANKH',
  },
  {
    id: 'historia-04b-outfit-ankh',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'detalle-ankh.png',
    sobre: 'ANATOMÍA DEL EQUIPO',
    titulo: 'EL<br><span class="oro">ANKH</span>',
    texto: 'Vida eterna. No es adorno.',
    hueco: true,
    pie: '3 DE 3 · CORONA · HOMBRERAS · ANKH',
  },
  {
    id: 'historia-05-invocacion',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'exo-vinilo.png',
    sobre: 'INVOCACIÓN EN VIVO',
    titulo: 'DALE<br><span class="oro">PLAY</span>',
    texto: `${SINGLE} · ya disponible`,
    hueco: true,
    pie: 'DEJA ESPACIO ABAJO PARA EL STICKER DE MÚSICA',
  },
  {
    id: 'historia-06-prueba-impacto',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'exo-multitud.png',
    sobre: 'PRUEBA DE IMPACTO',
    titulo: 'USTEDES<br><span class="oro">SE SIENTEN</span><br>DESDE ARRIBA',
    texto: 'Etiquétame y te comparto.',
    hueco: true,
    pie: 'DEJA ESPACIO ABAJO PARA EL REPOST',
  },

  // ----- PORTADAS DE HISTORIAS DESTACADAS (1:1) -----
  { id: 'destacada-1-el-rey',   w: 1080, h: 1080, tipo: 'destacada', icono: '\u265A', rotulo: 'EL REY' },
  { id: 'destacada-2-musica',   w: 1080, h: 1080, tipo: 'destacada', icono: '\u266B', rotulo: 'MÚSICA' },
  { id: 'destacada-3-senal',    w: 1080, h: 1080, tipo: 'destacada', icono: '\u25CE', rotulo: 'LA SEÑAL' },
  { id: 'destacada-4-ankh',     w: 1080, h: 1080, tipo: 'destacada', icono: '\u2625', rotulo: 'ORIGEN' },
  { id: 'destacada-5-shows',    w: 1080, h: 1080, tipo: 'destacada', icono: '\u2605', rotulo: 'SHOWS' },
  { id: 'destacada-6-terrestres', w: 1080, h: 1080, tipo: 'destacada', icono: '\u2641', rotulo: 'TERRESTRES' },
  {
    id: 'historia-01-cuenta-regresiva',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'real-rey-story.png',
    sobre: 'ENTRADA EN LA ATMÓSFERA',
    titulo: 'YA<br><span class="oro">VOY<br>BAJANDO</span>',
    texto: EP,
    hueco: true,
    pie: 'DEJA ESPACIO ABAJO PARA EL STICKER',
  },
  {
    id: 'historia-07-cita-musical',
    w: 1080, h: 1920,
    tipo: 'historia',
    imagen: 'exo-fondo-horizonte.png',
    cita: true,
    titulo: 'LA BARRA MÁS<br><span class="oro">CONTUNDENTE</span><br>DEL TEMA VA ACÁ',
    hueco: true,
    pie: 'DEJA ESPACIO ABAJO PARA EL STICKER DE MÚSICA',
  },
  {
    id: 'historia-08-ultimo-aviso',
    w: 1080, h: 1920,
    tipo: 'alerta',
    sobre: 'ÚLTIMO AVISO',
    titulo: 'ME<br>DEVUELVO<br><span class="oro">ARRIBA</span>',
    texto: 'El link está en la bio.<br>Después de esto, se corta la señal.',
    pie: `${SINGLE} · YA DISPONIBLE`,
  },
];

// ---------- estilos ----------
const css = `
  @font-face { font-family:'Mont'; src:url(data:font/ttf;base64,${fuente}) format('truetype'); }
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:${C.negro};overflow:hidden}
  .frame{position:relative;overflow:hidden;font-family:'Mont',sans-serif;
         background:${C.negro};color:${C.blanco}}

  .bg{position:absolute;inset:0;background-size:cover;background-position:center}
  /* Velo fuerte abajo: el texto va ENCIMA de la foto, no al lado. */
  .veil{position:absolute;inset:0;
        background:linear-gradient(180deg,rgba(4,7,12,.55) 0%,rgba(4,7,12,.05) 20%,
                   rgba(4,7,12,.05) 50%,rgba(4,7,12,.72) 68%,rgba(4,7,12,.98) 82%,rgba(4,7,12,1) 100%)}
  /* Tinte frío para amarrar cualquier foto a la paleta oscura de la marca. */
  .tinte{position:absolute;inset:0;background:${C.azul_profundo};mix-blend-mode:color;opacity:.34}

  /* Grano: saca el brillo digital y ensucia la imagen. */
  .grano{position:absolute;inset:-50%;opacity:.16;pointer-events:none;
         background-image:radial-gradient(${C.blanco} .6px,transparent .7px);
         background-size:3px 3px}
  /* Barrido de tubo, más crudo que un scanline fino. */
  .scan{position:absolute;inset:0;opacity:.22;
        background:repeating-linear-gradient(180deg,rgba(0,0,0,.9) 0 3px,transparent 3px 9px)}

  /* Fondo sin foto: resplandor sucio, sin rejilla de dashboard. */
  .humo{position:absolute;inset:0;
        background:radial-gradient(90% 44% at 22% 12%,${C.magenta_galaxia}30,transparent 64%),
                   radial-gradient(95% 46% at 78% 22%,${C.azul_galaxia}33,transparent 64%),
                   radial-gradient(130% 56% at 50% 112%,${C.ambar}26,transparent 58%),
                   linear-gradient(180deg,${C.azul_profundo} 0%,${C.negro} 60%,#02040A 100%)}

  /* Banda diagonal: el gesto de flyer de fiesta. */
  .banda{position:absolute;left:-14%;width:128%;height:120px;transform:rotate(-6deg);
         background:${C.dorado};opacity:.92;display:flex;align-items:center;
         justify-content:center;gap:60px;overflow:hidden}
  .banda span{font-size:38px;font-weight:900;letter-spacing:.16em;color:${C.negro};
              white-space:nowrap;text-transform:uppercase}

  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;
        justify-content:flex-end;padding:0 68px 96px;z-index:5}
  .wrap.arriba{justify-content:flex-start;padding:210px 68px 96px}
  .wrap.centro{justify-content:center;text-align:center;align-items:center}

  .handle{position:absolute;top:52px;left:68px;right:68px;z-index:6;
          display:flex;justify-content:space-between;align-items:center;
          font-size:20px;font-weight:800;letter-spacing:.20em;color:${C.dorado}}
  .handle .r{color:#4A5D72;letter-spacing:.14em}

  /* Etiqueta sólida, no kicker con línea fina corporativa. */
  .sobre{display:inline-block;align-self:flex-start;background:${C.dorado};color:${C.negro};
         font-size:25px;font-weight:900;letter-spacing:.16em;padding:11px 22px;
         margin-bottom:26px;text-transform:uppercase;transform:rotate(-2deg)}
  .centro .sobre{align-self:center}

  /* TIPOGRAFÍA: enorme, condensada e inclinada. Sangra fuera del margen. */
  h1{font-size:158px;font-weight:900;line-height:.86;letter-spacing:-.055em;
     text-transform:uppercase;transform:scaleX(.92) skewX(-5deg);transform-origin:left bottom;
     margin-left:-8px;text-shadow:0 14px 44px rgba(0,0,0,.85)}
  h1.mid{font-size:132px}
  /* El espectro respira menos arriba para no cortarse en la grilla 1:1 */
  .espectro h1{font-size:118px}
  .espectro .barras{height:170px;margin-top:34px}
  h1.cita{font-size:96px;line-height:.98;letter-spacing:-.04em}
  .centro h1{transform-origin:center bottom}

  /* Oro metálico con degradado, no un plano amarillo. */
  .oro{background:linear-gradient(177deg,#FFF6D8 2%,${C.dorado_claro} 16%,${C.dorado} 40%,
                 ${C.dorado_oscuro} 60%,${C.dorado} 78%,${C.dorado_claro} 94%,#FFF6D8 100%);
       -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
       filter:drop-shadow(0 3px 0 ${C.dorado_oscuro}) drop-shadow(0 7px 14px rgba(0,0,0,.85))}
  .azul{color:${C.azul_led}}
  /* El 3 en lugar de la E es el único código gráfico propio del artista. */
  .tres{font-style:italic}

  p{font-size:40px;font-weight:700;line-height:1.24;color:${C.blanco};
    margin-top:30px;max-width:830px;text-shadow:0 6px 24px rgba(0,0,0,.9)}
  .centro p{margin-left:auto;margin-right:auto}

  .pie{margin-top:32px;max-width:770px;line-height:1.35;font-size:23px;font-weight:900;
       letter-spacing:.16em;color:${C.dorado};text-transform:uppercase;
       text-shadow:0 4px 18px rgba(0,0,0,.95)}
  .ankh{display:inline-block;vertical-align:-2px;margin-right:12px;color:${C.dorado}}
  .sello{position:absolute;bottom:56px;right:64px;width:132px;z-index:7;opacity:.96;
         filter:drop-shadow(0 6px 18px rgba(0,0,0,.9))}
  .pie.pendiente{color:#5A6E88;font-weight:700;letter-spacing:.1em}

  /* --- el dato como flex --- */
  .cifra{font-size:300px;font-weight:900;line-height:.78;letter-spacing:-.06em;
         transform:scaleX(.9) skewX(-5deg);transform-origin:left bottom;margin-left:-12px;
         background:linear-gradient(177deg,#FFF6D8 2%,${C.dorado_claro} 18%,${C.dorado} 44%,
                    ${C.dorado_oscuro} 62%,${C.dorado} 80%,#FFF6D8 100%);
         -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
         filter:drop-shadow(0 4px 0 ${C.dorado_oscuro}) drop-shadow(0 10px 20px rgba(0,0,0,.9))}
  .unidad{font-size:52px;font-weight:900;letter-spacing:.22em;color:${C.blanco};
          margin:-6px 0 30px 2px}

  /* --- barrio --- */
  .comuna{font-size:31px;font-weight:800;letter-spacing:.2em;color:${C.azul_led};
          margin-top:20px;text-transform:uppercase}

  /* --- espectro --- */
  .barras{display:flex;align-items:flex-end;gap:9px;height:210px;margin-top:44px}
  .barras i{flex:1;background:linear-gradient(180deg,${C.dorado_claro},${C.naranja_brasa} 62%,${C.azul_led})}

  /* --- portada de reel: el frame que queda fijo en el perfil --- */
  .reelnum{position:absolute;top:150px;left:68px;z-index:6;font-size:150px;font-weight:900;
           line-height:.8;letter-spacing:-.06em;color:transparent;-webkit-text-stroke:3px ${C.dorado};
           opacity:.55}
  .play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:6;
        width:150px;height:150px;border:5px solid ${C.blanco};border-radius:50%;opacity:.92;
        box-shadow:0 10px 40px rgba(0,0,0,.7)}
  .play::after{content:'';position:absolute;top:50%;left:56%;transform:translate(-50%,-50%);
        border-left:44px solid ${C.blanco};border-top:27px solid transparent;
        border-bottom:27px solid transparent}

  /* --- portada de historia destacada --- */
  .dest{position:absolute;inset:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;z-index:5;gap:38px}
  .dest .aro{width:560px;height:560px;border:8px solid ${C.dorado};border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 70px rgba(201,162,75,.34), inset 0 0 60px rgba(201,162,75,.18)}
  .dest .ico{font-size:250px;line-height:1;
        background:linear-gradient(177deg,#FFF6D8 4%,${C.dorado_claro} 22%,${C.dorado} 50%,
                   ${C.dorado_oscuro} 74%,${C.dorado_claro} 100%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .dest .rot{font-size:52px;font-weight:900;letter-spacing:.26em;color:${C.blanco};
        text-transform:uppercase}

  /* --- alerta --- */
  .marco{position:absolute;inset:36px;border:5px solid ${C.dorado};opacity:.9}
  .marco::before,.marco::after{content:'';position:absolute;width:74px;height:74px;
        border:9px solid ${C.azul_led}}
  .marco::before{top:-9px;left:-9px;border-right:0;border-bottom:0}
  .marco::after{bottom:-9px;right:-9px;border-left:0;border-top:0}
`;

// ---------- render ----------
const barras = () => Array.from({ length: 30 }, (_, i) => {
  const t = i / 29;
  const alto = 16 + 84 * Math.pow(Math.sin(Math.PI * t), 1.3) * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.7)));
  return `<i style="height:${alto.toFixed(1)}%"></i>`;
}).join('');

const cinta = (txt, top) =>
  `<div class="banda" style="top:${top}">${Array(4).fill(`<span>${txt}</span>`).join('')}</div>`;

const render = p => {
  const ankh = '<span class="ankh">\u2625</span>';
  const pie = p.pie ? `<div class="pie ${p.pie.startsWith('DEJA') ? 'pendiente' : ''}">${p.pie.startsWith('DEJA') ? '' : ankh}${p.pie}</div>` : '';
  const img = p.imagen ? fondo(p.imagen) : null;
  const cab = `
    ${img ? `<div class="bg" style="background-image:url(data:image/png;base64,${img})"></div><div class="veil"></div>`
          : '<div class="humo"></div>'}
    ${img ? '<div class="tinte"></div>' : ''}
    ${p.tipo === 'alerta' ? '<div class="scan"></div>' : ''}
    <div class="grano"></div>
    ${p.tipo === 'alerta' ? '<div class="marco"></div>' : ''}
    ${p.tipo === 'destacada' ? '' : `<div class="handle"><span>${M.instagram}</span><span class="r">${EP}</span></div>`}
    ${emblema && p.tipo !== 'destacada' ? `<img class="sello" src="data:image/png;base64,${emblema}">` : ''}`;

  const sobre = p.sobre ? `<div class="sobre">${p.sobre}</div>` : '';
  let cuerpo = '';

  if (p.tipo === 'flex') {
    cuerpo = `<div class="wrap">
        ${sobre}
        <div class="cifra">${p.cifra}</div>
        <div class="unidad">${p.unidad}</div>
        <h1 class="mid">${p.titulo}</h1>
        ${pie}
      </div>`;
  } else if (p.tipo === 'espectro') {
    cuerpo = `${cinta(FORMATO_AUDIO, '96px')}
      <div class="wrap">
        <h1>${p.titulo}</h1>
        <div class="barras">${barras()}</div>
        <p>${p.texto}</p>
        ${pie}
      </div>`;
  } else if (p.tipo === 'barrio') {
    cuerpo = `<div class="wrap">
        ${sobre}
        <h1>${p.titulo}</h1>
        <div class="comuna">${p.comuna}</div>
        <p>${p.texto}</p>
        ${pie}
      </div>`;
  } else if (p.tipo === 'reel') {
    cuerpo = `<div class="reelnum">${p.n}</div><div class="play"></div>
      <div class="wrap">
        ${sobre}
        <h1 class="mid">${p.titulo}</h1>
        <p>${p.texto}</p>
        ${pie}
      </div>`;
  } else if (p.tipo === 'destacada') {
    cuerpo = `<div class="dest">
        <div class="aro"><span class="ico">${p.icono}</span></div>
        <div class="rot">${p.rotulo}</div>
      </div>`;
  } else if (p.tipo === 'alerta') {
    cuerpo = `${cinta(`${SINGLE} · ${SINGLE} · ${SINGLE}`, '1230px')}
      <div class="wrap centro">
        ${sobre}
        <h1>${p.titulo}</h1>
        <p>${p.texto}</p>
        ${pie}
      </div>`;
  } else {
    cuerpo = `<div class="wrap ${p.hueco ? 'arriba' : ''}">
        ${sobre}
        <h1 class="${p.cita ? 'cita' : ''}">${p.titulo}</h1>
        ${p.texto ? `<p>${p.texto}</p>` : ''}
        ${pie}
      </div>`;
  }

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style></head>
    <body><div class="frame ${p.tipo}" style="width:${p.w}px;height:${p.h}px">${cab}${cuerpo}</div></body></html>`;
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
      '--force-device-scale-factor=1', '--default-background-color=ff05090F',
      `--screenshot=${png}`, `--window-size=${p.w},${p.h}`,
      'file://' + html.replace(/\\/g, '/')], { stdio: 'pipe' });
    console.log('✓');
  } catch (e) {
    console.log('✗', String(e.stderr || e.message).slice(0, 140));
  }
});

console.log(`\n  → ${outPNG}\n`);
