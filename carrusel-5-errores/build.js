const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const fontB64 = fs.readFileSync(path.join(DIR, 'assets', 'Montserrat.ttf')).toString('base64');

// ---- Brand tokens ----
const TEAL = '#33C7CE';
const TEAL_DARK = '#12959C';
const CORAL = '#FF7B7B';
const WHITE = '#FFFFFF';

// ---- SVG background (watercolor top + torn paper bottom) ----
function background() {
  return `
  <svg class="bg" viewBox="0 0 1080 1350" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6"/>
      </filter>
    </defs>
    <rect width="1080" height="1350" fill="${TEAL}"/>
    <!-- watercolor top band -->
    <g fill="${TEAL_DARK}" opacity="0.55" filter="url(#soft)">
      <path d="M0,0 H1080 V150
        C980,205 900,120 800,175
        C700,230 640,140 540,185
        C440,230 380,150 280,190
        C180,230 90,150 0,180 Z"/>
    </g>
    <g fill="${TEAL_DARK}" opacity="0.38" filter="url(#soft)">
      <ellipse cx="150" cy="215" rx="34" ry="46"/>
      <ellipse cx="470" cy="228" rx="26" ry="38"/>
      <ellipse cx="820" cy="212" rx="30" ry="42"/>
      <ellipse cx="980" cy="205" rx="22" ry="30"/>
      <ellipse cx="330" cy="205" rx="18" ry="26"/>
    </g>
    <!-- torn paper bottom -->
    <path fill="${WHITE}" d="M0,1200
      L120,1168 L180,1192 L250,1160 L330,1188 L410,1158 L500,1186
      L590,1156 L680,1184 L770,1156 L860,1182 L950,1156 L1030,1180 L1080,1162
      L1080,1350 L0,1350 Z"/>
  </svg>`;
}

// ---- Reusable footer (logo + handle on white paper) ----
function footer(tag) {
  return `
  <div class="footer">
    <div class="logo">
      <span class="logo-word">influence</span>
      <span class="logo-sub">AGENCIA · MARKETING</span>
    </div>
    ${tag ? `<span class="foot-tag">${tag}</span>` : ''}
  </div>`;
}

// ---- Icons ----
const megaphone = `<svg viewBox="0 0 100 100" class="icon"><g fill="none" stroke="${CORAL}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 42 L20 58 L34 58 L48 74 L48 26 L34 42 Z"/><path d="M48 26 L82 14 L82 86 L48 74"/><path d="M64 40 Q74 50 64 60"/><path d="M30 58 L34 82 L44 82 L40 62"/></g></svg>`;
const plane = `<svg viewBox="0 0 100 100" class="icon"><g fill="none" stroke="${CORAL}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M86 14 L10 48 L40 58 L52 86 L64 52 Z"/><path d="M40 58 L86 14"/></g></svg>`;

// ---- Slides ----
const slides = [
  {
    type: 'cover',
    handle: '@influence.chile',
    icon: megaphone,
    title: `<span class="coral">5 ERRORES</span><br>QUE FRENAN TUS<br>VENTAS EN <span class="coral">REDES</span>`,
    sub: 'Desliza y corrígelos hoy →',
    tag: '#marketing',
  },
  {
    type: 'error', n: 1, handle: '@influence.chile',
    title: `PUBLICAR SIN<br><span class="coral">ESTRATEGIA</span>`,
    body: 'Postear por postear no vende. Sin un objetivo claro, tu contenido se pierde en el feed y no lleva a nadie a comprar.',
  },
  {
    type: 'error', n: 2, handle: '@influence.chile',
    title: `HABLAS DE TI,<br>NO DE TU <span class="coral">CLIENTE</span>`,
    body: 'A tu audiencia no le importa lo increíble que eres. Le importa el problema que le resuelves. Habla de su dolor real.',
  },
  {
    type: 'error', n: 3, handle: '@influence.chile',
    title: `NO TIENES UN<br><span class="coral">CTA CLARO</span>`,
    body: 'Si no dices qué hacer —escribir, agendar o comprar— nadie lo hará. Cada publicación necesita un paso siguiente.',
  },
  {
    type: 'error', n: 4, handle: '@influence.chile',
    title: `CERO <span class="coral">PRUEBA</span><br>SOCIAL`,
    body: 'Sin resultados, reseñas ni casos reales generas dudas en vez de confianza. Muestra pruebas y baja la barrera para comprar.',
  },
  {
    type: 'error', n: 5, handle: '@influence.chile',
    title: `PUBLICAS Y<br><span class="coral">DESAPARECES</span>`,
    body: 'Las ventas se cierran en los comentarios y los DMs. Si no respondes a tiempo, dejas la plata sobre la mesa.',
  },
  {
    type: 'cta',
    handle: '@influence.chile',
    icon: plane,
    title: `¿LISTO PARA<br>CONVERTIR TUS REDES<br>EN <span class="coral">VENTAS</span>?`,
    body: 'En Influence Chile creamos estrategia, contenido y gestión de redes que sí venden.',
    cta: 'AGENDA UNA REUNIÓN',
    web: 'www.chileinfluence.cl',
    tag: '@influence.chile',
  },
];

function pageHTML(s) {
  let inner = '';
  if (s.type === 'cover') {
    inner = `
      <div class="handle top">${s.handle}</div>
      <div class="cover-block">
        <div class="icon-wrap">${s.icon}</div>
        <h1 class="cover-title">${s.title}</h1>
        <div class="cover-sub">${s.sub}</div>
      </div>
      ${footer(s.tag)}`;
  } else if (s.type === 'error') {
    inner = `
      <div class="handle top">${s.handle}</div>
      <div class="error-block">
        <div class="bignum">${s.n}</div>
        <h1 class="err-title">${s.title}</h1>
        <p class="err-body">${s.body}</p>
      </div>
      ${footer('#communitymanager')}`;
  } else if (s.type === 'cta') {
    inner = `
      <div class="handle top">${s.handle}</div>
      <div class="cta-block">
        <div class="icon-wrap">${s.icon}</div>
        <h1 class="cta-title">${s.title}</h1>
        <p class="cta-body">${s.body}</p>
        <div class="cta-btn">${s.cta}</div>
        <div class="cta-web">${s.web}</div>
      </div>
      ${footer(s.tag)}`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:'Mont';src:url(data:font/ttf;base64,${fontB64}) format('truetype');font-weight:100 900;font-style:normal;}
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{width:1080px;height:1350px;}
    .slide{position:relative;width:1080px;height:1350px;overflow:hidden;font-family:'Mont',sans-serif;color:${WHITE};}
    .bg{position:absolute;inset:0;width:1080px;height:1350px;}
    .handle{position:absolute;left:0;right:0;text-align:center;font-weight:600;letter-spacing:2px;font-size:26px;color:rgba(255,255,255,.92);}
    .handle.top{top:70px;}
    .coral{color:${CORAL};}
    /* footer */
    .footer{position:absolute;left:70px;right:70px;bottom:56px;display:flex;align-items:flex-end;justify-content:space-between;}
    .logo{display:flex;flex-direction:column;line-height:1;}
    .logo-word{font-weight:700;font-style:italic;font-size:44px;color:${TEAL_DARK};letter-spacing:-1px;}
    .logo-sub{font-weight:700;font-size:13px;letter-spacing:6px;color:${TEAL_DARK};opacity:.85;margin-top:4px;margin-left:3px;}
    .foot-tag{font-weight:700;font-size:20px;letter-spacing:1px;color:${TEAL_DARK};opacity:.8;}
    /* cover */
    .cover-block{position:absolute;left:90px;right:90px;top:50%;transform:translateY(-52%);text-align:center;}
    .icon-wrap{display:flex;justify-content:center;margin-bottom:34px;}
    .icon{width:120px;height:120px;}
    .cover-title{font-weight:800;font-size:82px;line-height:1.02;letter-spacing:-1px;text-transform:uppercase;text-shadow:0 4px 18px rgba(0,80,84,.18);}
    .cover-sub{margin-top:40px;font-weight:600;font-size:32px;color:rgba(255,255,255,.95);}
    /* error */
    .error-block{position:absolute;left:90px;right:90px;top:50%;transform:translateY(-54%);text-align:center;}
    .bignum{font-weight:900;font-size:300px;line-height:.8;color:transparent;-webkit-text-stroke:7px ${CORAL};margin-bottom:6px;}
    .err-title{font-weight:800;font-size:76px;line-height:1.03;letter-spacing:-1px;text-transform:uppercase;}
    .err-body{margin:34px auto 0;max-width:820px;font-weight:500;font-size:33px;line-height:1.42;color:rgba(255,255,255,.96);}
    /* cta */
    .cta-block{position:absolute;left:90px;right:90px;top:49%;transform:translateY(-52%);text-align:center;}
    .cta-title{font-weight:800;font-size:70px;line-height:1.05;letter-spacing:-1px;text-transform:uppercase;}
    .cta-body{margin:32px auto 0;max-width:800px;font-weight:500;font-size:33px;line-height:1.4;color:rgba(255,255,255,.96);}
    .cta-btn{display:inline-block;margin-top:44px;background:${WHITE};color:${TEAL_DARK};font-weight:800;font-size:34px;letter-spacing:1px;padding:26px 52px;border-radius:60px;text-transform:uppercase;box-shadow:0 10px 30px rgba(0,70,74,.22);}
    .cta-web{margin-top:30px;font-weight:700;font-size:30px;color:${WHITE};letter-spacing:1px;}
  </style></head><body>
    <div class="slide">
      ${background()}
      ${inner}
    </div>
  </body></html>`;
}

slides.forEach((s, i) => {
  const name = `slide-${String(i + 1).padStart(2, '0')}.html`;
  fs.writeFileSync(path.join(DIR, name), pageHTML(s));
});
console.log('Generated', slides.length, 'slides');
