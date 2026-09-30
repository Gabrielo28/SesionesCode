// Panel de administración de la plataforma (/admin).
//
// Muestra métricas y estado, NO el contenido de cada negocio: ni textos, ni
// fotos, ni estrategias, ni resultados de Instagram. Es una decisión
// explícita del dueño de Rubrofy (no hay acceso total a los negocios).
// Solo entran las cuentas cuyos emails están en ADMIN_EMAILS; sin esa
// variable el panel no existe.
//
// Visitas del sitio: se cuentan en el servidor por día y página, sin
// cookies, sin IP y sin identificar a nadie; de dónde vienen se guarda solo
// como dominio (ej: instagram.com).

const fs = require('fs');
const store = require('./store');
const { DATA_DIR } = require('./datos');
const analitica = require('./analitica');
const planContenido = require('./plan-contenido');
const { getPlan } = require('./planes');

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS visitas (
    fecha TEXT NOT NULL,
    pagina TEXT NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (fecha, pagina)
  );
  CREATE TABLE IF NOT EXISTS referentes (
    fecha TEXT NOT NULL,
    dominio TEXT NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (fecha, dominio)
  );
`);
const sql = {
  visita: db.prepare(`INSERT INTO visitas (fecha, pagina, n) VALUES (?, ?, 1)
    ON CONFLICT (fecha, pagina) DO UPDATE SET n = n + 1`),
  referente: db.prepare(`INSERT INTO referentes (fecha, dominio, n) VALUES (?, ?, 1)
    ON CONFLICT (fecha, dominio) DO UPDATE SET n = n + 1`),
  visitasPorDia: db.prepare('SELECT fecha, pagina, n FROM visitas WHERE fecha >= ? ORDER BY fecha'),
  referentes: db.prepare(`SELECT dominio, SUM(n) AS n FROM referentes WHERE fecha >= ?
    GROUP BY dominio ORDER BY n DESC LIMIT 10`),
};

const PAGINAS = { '/': 'inicio', '/index.html': 'inicio', '/registro.html': 'registro' };
const BOT = /bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless|lighthouse|facebookexternalhit|^node\b|undici|axios|okhttp|go-http|java\//i;

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}
function activo() { return adminEmails().length > 0; }
function esAdmin(negocio) {
  return !!(negocio && negocio.email && adminEmails().includes(String(negocio.email).toLowerCase()));
}

// Cuenta una vista de una página pública del sitio.
function registrarVisita(req, pathname) {
  const pagina = PAGINAS[pathname];
  if (!pagina) return;
  const ua = req.headers['user-agent'] || '';
  if (!ua || BOT.test(ua)) return;
  const fecha = analitica.fechaLocal(new Date());
  try {
    sql.visita.run(fecha, pagina);
    const ref = req.headers.referer || req.headers.referrer;
    if (ref && pagina === 'inicio') {
      const dominio = new URL(ref).hostname.replace(/^www\./, '').replace(/^(l|lm|m)\.(?=instagram|facebook)/, '');
      const propio = String(req.headers.host || '').split(':')[0].replace(/^www\./, '');
      if (dominio && dominio !== propio) sql.referente.run(fecha, dominio.slice(0, 80));
    }
  } catch (err) { /* una visita perdida no importa */ }
}

const DIA = 86400000;
const fechaDe = (iso) => (iso ? analitica.fechaLocal(new Date(iso)) : null);

// Fecha de alta: la guardada; en cuentas antiguas, lo más temprano que se sepa.
function creadoEl(n, contenido) {
  if (n.creadoEl) return n.creadoEl;
  const marcas = [n.bienvenidaCompletada, n.instagram && n.instagram.conectadoEl]
    .concat(contenido.map((i) => { const m = /-(\d{13})-\d+$/.exec(i.id || ''); return m ? new Date(Number(m[1])).toISOString() : null; }))
    .filter(Boolean).sort();
  return marcas[0] || null;
}

function mesActual() { return analitica.fechaLocal(new Date()).slice(0, 7); }

// Resumen de un negocio sin su contenido: solo conteos y estados.
function fila(n, contenido, rutaNegocio) {
  const publicadas = contenido.filter((i) => i.publicacion && i.publicacion.estado === 'publicada');
  const aprobadas = contenido.filter((i) => i.status === 'aprobado');
  const mes = mesActual();
  const uso = (u) => (u && u.mes === mes ? u.cantidad || 0 : 0);
  const plan = getPlan(n.plan);
  return {
    id: n.id,
    nombre: n.nombre,
    email: n.email || null,
    plan: plan.id,
    precioClp: n.cortesia || require('./beneficios').regaloVigente(n) ? 0 : plan.precioClp || 0, // la cuenta de cortesía del administrador no es ingreso
    suscripcion: require('./pagos').estado(n),
    creadoEl: creadoEl(n, contenido),
    ultimoAcceso: n.ultimoAcceso || null,
    bienvenida: !!n.bienvenidaCompletada,
    instagram: n.instagram && n.instagram.accessToken ? (n.instagram.estado === 'reconectar' ? 'reconectar' : 'ok') : 'no',
    publicidad: !!((n.meta && n.meta.adAccountId) || (n.google && n.google.customerId)),
    avisos: !(n.avisos && n.avisos.semanal === false),
    semanal: planContenido.totalSemanal(n.planContenido) || null,
    etapa: rutaNegocio ? rutaNegocio.etapaActual : null,
    piezas: {
      total: contenido.length,
      pendientes: contenido.filter((i) => i.status === 'pendiente').length,
      aprobadas: aprobadas.length,
      publicadas: publicadas.length,
      fallidas: contenido.filter((i) => i.publicacion && i.publicacion.estado === 'fallida').length,
    },
    primeraAprobacion: aprobadas.map((i) => i.decididoEl).filter(Boolean).sort()[0] || null,
    primeraPublicacion: publicadas.map((i) => i.publicacion.publicadoEl).filter(Boolean).sort()[0] || null,
    iaMes: { textos: uso(n.usoTextosIA), fotos: uso(n.usoFotosIA) },
  };
}

// deps: { calcularRuta(negocio), inicio (ms del arranque), version }
function resumen({ dias = 30, calcularRuta, inicio, version }) {
  const hoy = analitica.fechaLocal(new Date());
  const desde = analitica.sumarDias(hoy, -(dias - 1));
  const negocios = store.listNegocios();
  const filas = negocios.map((n) => {
    const contenido = store.getContenido(n.id);
    let r = null;
    try { r = calcularRuta(n); } catch (err) { r = null; }
    return { f: fila(n, contenido, r), contenido };
  });
  const lista = filas.map((x) => x.f);

  // --- series por día ---
  const serie = {};
  for (let i = 0; i < dias; i++) {
    const d = analitica.sumarDias(desde, i);
    serie[d] = { fecha: d, visitas: 0, registros: 0, aprobaciones: 0, publicaciones: 0 };
  }
  for (const v of sql.visitasPorDia.all(desde)) if (serie[v.fecha] && v.pagina === 'inicio') serie[v.fecha].visitas += v.n;
  const visitasRegistro = sql.visitasPorDia.all(desde).filter((v) => v.pagina === 'registro').reduce((s, v) => s + v.n, 0);
  for (const { f, contenido } of filas) {
    const d = fechaDe(f.creadoEl);
    if (serie[d]) serie[d].registros += 1;
    for (const i of contenido) {
      const a = i.status === 'aprobado' && fechaDe(i.decididoEl);
      if (serie[a]) serie[a].aprobaciones += 1;
      const p = i.publicacion && i.publicacion.estado === 'publicada' && fechaDe(i.publicacion.publicadoEl);
      if (serie[p]) serie[p].publicaciones += 1;
    }
  }
  const dias_ = Object.values(serie);
  const suma = (k) => dias_.reduce((s, d) => s + d[k], 0);

  // --- embudo (todos los negocios) ---
  const pagos = lista.filter((f) => f.precioClp > 0);
  const embudo = [
    { id: 'registro', label: 'Se registraron', n: lista.length },
    { id: 'bienvenida', label: 'Terminaron la bienvenida', n: lista.filter((f) => f.bienvenida).length },
    { id: 'aprobacion', label: 'Aprobaron una publicación', n: lista.filter((f) => f.primeraAprobacion || f.piezas.aprobadas).length },
    { id: 'instagram', label: 'Conectaron Instagram', n: lista.filter((f) => f.instagram !== 'no').length },
    { id: 'publicacion', label: 'Publicaron con Rubrofy', n: lista.filter((f) => f.piezas.publicadas).length },
    { id: 'pago', label: 'Pagan un plan', n: pagos.length },
  ];

  // --- distribución ---
  const porPlan = {};
  for (const f of lista) porPlan[f.plan] = (porPlan[f.plan] || 0) + 1;
  const porEtapa = { configura: 0, crea: 0, mide: 0, mejora: 0 };
  for (const f of lista) if (f.etapa && porEtapa[f.etapa] != null) porEtapa[f.etapa] += 1;

  const hace7 = Date.now() - 7 * DIA;
  const activos7 = lista.filter((f) => (f.ultimoAcceso && Date.parse(f.ultimoAcceso) >= hace7)).length;

  let tamanoDb = null;
  try { tamanoDb = fs.statSync(store.DB_PATH || `${DATA_DIR}/rubrofy.db`).size; } catch (err) { tamanoDb = null; }

  const config = {
    'IA de textos (Anthropic)': !!process.env.ANTHROPIC_API_KEY,
    'Imágenes y videos con IA (Higgsfield u OpenAI)': !!(process.env.HIGGSFIELD_API_KEY || process.env.OPENAI_API_KEY),
    'Cobro (Flow o Stripe)': !!(require('./flow').configurado() || (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)),
    'Conectar con Instagram': !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
    'Meta Ads y competencia': !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    'Google Ads': !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    'Correo semanal (Resend)': !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    'URL pública (PUBLIC_URL)': !!process.env.PUBLIC_URL,
  };

  return {
    periodo: { dias, desde, hasta: hoy },
    kpis: {
      negocios: lista.length,
      nuevos: suma('registros'),
      activos7,
      pagando: pagos.length,
      mrr: pagos.reduce((s, f) => s + f.precioClp, 0),
      visitas: suma('visitas'),
      visitasRegistro,
      conversion: suma('visitas') ? suma('registros') / suma('visitas') : null,
      publicaciones: suma('publicaciones'),
      aprobaciones: suma('aprobaciones'),
      fallidas: lista.reduce((s, f) => s + f.piezas.fallidas, 0),
      reconectar: lista.filter((f) => f.instagram === 'reconectar').length,
      iaTextosMes: lista.reduce((s, f) => s + f.iaMes.textos, 0),
      iaFotosMes: lista.reduce((s, f) => s + f.iaMes.fotos, 0),
    },
    serie: dias_,
    embudo,
    porPlan,
    porEtapa,
    referentes: sql.referentes.all(desde).map((r) => ({ dominio: r.dominio, n: r.n })),
    sistema: {
      version,
      encendidoDesde: new Date(inicio).toISOString(),
      tamanoDb,
      zona: require('./programacion').ZONA,
      config,
    },
  };
}

function negocios({ calcularRuta }) {
  return store.listNegocios().map((n) => {
    let r = null;
    try { r = calcularRuta(n); } catch (err) { r = null; }
    return fila(n, store.getContenido(n.id), r);
  }).sort((a, b) => String(b.creadoEl || '').localeCompare(String(a.creadoEl || '')));
}

module.exports = { activo, esAdmin, registrarVisita, resumen, negocios, adminEmails };
