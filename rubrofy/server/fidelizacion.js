// Fidelización: lo que hace que el dueño vuelva cada semana y vea que
// Rubrofy le sirve. Todo corre en el reloj de recordatorios de server.js
// (cada media hora) y cada aviso se manda una sola vez (marcas en
// negocio.avisos):
//
//   - Dato de la semana y lo que falta, para el correo de los lunes.
//   - Rescate: a los 10 días sin entrar (con publicaciones esperando), un
//     correo con "Aprobar todo" sin entrar al panel; a los 25, un correo
//     personal del equipo. En /admin esos negocios aparecen "en riesgo".
//   - Pausa: en vez de cancelar, 1 mes sin cobro; se reanuda sola.
//   - Celebraciones: una publicación que supera el promedio (push), la
//     tarjeta "Lo que lograste este mes" (Inicio) y el correo de los 3 meses.
//   - Racha: semanas seguidas publicando; a las 4 y a las 12, créditos ⚡.

const store = require('./store');
const analitica = require('./analitica');
const programacion = require('./programacion');
const creditos = require('./creditos');
const pagos = require('./pagos');
const { getPlan } = require('./planes');

const DIA = 24 * 3600 * 1000;
const DIAS_RESCATE = 10;
const DIAS_RIESGO = 25;
const MIN_POR_PUBLICACION = 20; // "horas ahorradas": lo que tarda hacerlo a mano
const HITOS_RACHA = [4, 12];

let deps = {};
function configurar(d) { deps = Object.assign(deps, d); }

const formatoDe = (i) => (i.formato ? i.formato : (i.aspect && i.aspect.trim().startsWith('9') ? 'historia' : 'post'));
const publicadaEl = (i) => (i.publicacion && i.publicacion.estado === 'publicada' && i.publicacion.publicadoEl) || null;
const semanaDe = (iso) => require('./avisos').semanaISO(programacion.partesEnZona(new Date(iso)));
const conPlan = (n) => (n.plan || 'gratis') !== 'gratis' && !n.suspendido;

function guardarAviso(negocioId, cambios) {
  const n = store.getNegocio(negocioId);
  if (!n) return null;
  n.avisos = Object.assign({}, n.avisos, cambios);
  store.saveNegocio(n);
  return n;
}

// ---------- datos para correos y tarjetas ----------

// La publicación que mejor anduvo en los últimos 7 días (de Instagram).
function datoSemana(negocioId, ahora = new Date()) {
  const hasta = analitica.fechaLocal(ahora);
  const desde = analitica.sumarDias(hasta, -7);
  let r;
  try { r = analitica.resumen(negocioId, desde, hasta, null); } catch (err) { return null; }
  const top = (r.topPosts || [])[0];
  if (!top || !(Number(top.alcance) > 0 || Number(top.interacciones) > 0)) return null;
  return {
    texto: String(top.caption || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    formato: top.tipo === 'REELS' ? 'reel' : 'publicación',
    alcance: Number(top.alcance) || 0,
    interacciones: Number(top.interacciones) || 0,
    permalink: top.permalink || null,
    publicaciones: r.publicaciones || 0,
    alcanceSemana: r.alcance || 0,
  };
}

// Lo que impide publicar: reels pendientes sin video.
function faltantes(contenido) {
  const vivas = contenido.filter((i) => i.status !== 'rechazado' && !publicadaEl(i));
  const reelsSinVideo = vivas.filter((i) => formatoDe(i) === 'reel' && !i.video).length;
  return { reelsSinVideo };
}

// Semanas seguidas con al menos una publicación en Instagram, contando
// la semana actual o la anterior como punto de partida.
function racha(contenido, ahora = new Date()) {
  const semanas = new Set(contenido.map(publicadaEl).filter(Boolean).map(semanaDe));
  if (!semanas.size) return 0;
  const p = programacion.partesEnZona(ahora);
  let cursor = new Date(Date.UTC(p.anio, p.mes - 1, p.dia));
  const clave = (d) => require('./avisos').semanaISO({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() });
  // Si esta semana todavía no publica, la racha se cuenta desde la anterior.
  if (!semanas.has(clave(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 7);
  let n = 0;
  while (semanas.has(clave(cursor))) { n += 1; cursor.setUTCDate(cursor.getUTCDate() - 7); }
  return n;
}

// "Lo que lograste este mes": publicaciones, alcance y horas ahorradas.
function logros(negocio, contenido, ahora = new Date()) {
  const mes = analitica.fechaLocal(ahora).slice(0, 7);
  const publicadasMes = contenido.filter((i) => { const f = publicadaEl(i); return f && analitica.fechaLocal(new Date(f)).startsWith(mes); }).length;
  const total = contenido.filter(publicadaEl).length;
  let alcance = 0, interacciones = 0;
  if (getPlan(negocio.plan).analitica) {
    try {
      const r = analitica.resumen(negocio.id, `${mes}-01`, analitica.fechaLocal(ahora), null);
      alcance = r.alcance || 0; interacciones = r.interacciones || 0;
    } catch (err) { /* sin datos de Instagram */ }
  }
  const premios = creditos.config().promo;
  return {
    mes,
    publicacionesMes: publicadasMes,
    publicacionesTotal: total,
    alcance, interacciones,
    horasAhorradas: Math.round(publicadasMes * MIN_POR_PUBLICACION / 60 * 10) / 10,
    racha: racha(contenido, ahora),
    proximoHito: HITOS_RACHA.find((h) => h > racha(contenido, ahora)) || null,
    premioRacha: premios.racha || 0,
    referido: premios.referido || 0,
  };
}

// ---------- rescate de negocios que se enfrían ----------

function diasSinEntrar(n, ahora) {
  if (!n.ultimoAcceso) return null;
  return Math.floor((ahora - Date.parse(n.ultimoAcceso)) / DIA);
}

// Un aviso se repite solo si volvió a entrar después del aviso anterior.
const avisoVigente = (n, clave) => n.avisos && n.avisos[clave] && Date.parse(n.avisos[clave]) >= Date.parse(n.ultimoAcceso || 0);

function rescates(ahora = Date.now()) {
  const enviados = [];
  for (const n of deps.negocios()) {
    if (!conPlan(n) || !n.email || !n.bienvenidaCompletada) continue;
    const dias = diasSinEntrar(n, ahora);
    if (dias === null) continue;
    const contenido = store.getContenido(n.id);
    const pendientes = contenido.filter((i) => i.status === 'pendiente').length;
    if (dias >= DIAS_RIESGO && !avisoVigente(n, 'rescate25El')) {
      guardarAviso(n.id, { rescate25El: new Date(ahora).toISOString() });
      deps.correo(n.id, 'riesgo', { dias, pendientes });
      enviados.push({ negocioId: n.id, tipo: 'riesgo' });
    } else if (dias >= DIAS_RESCATE && pendientes > 0 && !avisoVigente(n, 'rescate10El')) {
      guardarAviso(n.id, { rescate10El: new Date(ahora).toISOString() });
      deps.correo(n.id, 'rescate', { dias, pendientes });
      deps.notificar(n.id, { titulo: `Tienes ${pendientes} publicacion${pendientes === 1 ? '' : 'es'} esperando`, cuerpo: 'Apruébalas en un minuto y se publican solas en su fecha.', url: '/app#cola', tag: 'rescate' });
      enviados.push({ negocioId: n.id, tipo: 'rescate' });
    }
  }
  return enviados;
}

// Para /admin: negocios con plan que llevan 10 o más días sin entrar.
function enRiesgo(ahora = Date.now()) {
  return deps.negocios().filter(conPlan).map((n) => {
    const dias = diasSinEntrar(n, ahora);
    if (dias === null || dias < DIAS_RESCATE) return null;
    const contenido = store.getContenido(n.id);
    return {
      id: n.id, nombre: n.nombre, email: n.email || null, plan: n.plan, dias,
      pendientes: contenido.filter((i) => i.status === 'pendiente').length,
      pausa: !!(n.pausa && n.pausa.hasta),
      avisado: avisoVigente(n, 'rescate25El') ? 'personal' : avisoVigente(n, 'rescate10El') ? 'rescate' : null,
    };
  }).filter(Boolean).sort((a, b) => b.dias - a.dias);
}

// "Aprobar todo" desde el correo: aprueba lo pendiente que ya tiene su
// material. Devuelve cuántas aprobó y cuántas quedaron por falta de video.
function aprobables(contenido) {
  const listas = [], faltan = [];
  for (const i of contenido) {
    if (i.status !== 'pendiente') continue;
    if (formatoDe(i) === 'reel' && !i.video) faltan.push(i); else listas.push(i);
  }
  return { listas, faltan };
}

// ---------- pausa de la suscripción ----------

function sumarMeses(iso, meses) {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString();
}

// Pausar: Flow deja de cobrar al terminar el período pagado; un mes después
// la suscripción se vuelve a crear sola (la tarjeta queda inscrita).
async function pausar(negocio, meses = 1) {
  if (negocio.pausa && negocio.pausa.hasta) return { error: 'Tu suscripción ya está en pausa', status: 409 };
  const r = await deps.cancelarAlFinal(negocio);
  if (r.error) return r;
  const fresco = store.getNegocio(negocio.id);
  const fin = (fresco.flow && fresco.flow.periodoFin) || new Date().toISOString().slice(0, 10);
  fresco.pausa = { desde: new Date().toISOString(), finPagado: fin, hasta: sumarMeses(fin, Math.min(3, Math.max(1, meses))), plan: fresco.plan, periodo: (fresco.flow && fresco.flow.periodo) || 'mensual', meses };
  store.saveNegocio(fresco);
  deps.correo(negocio.id, 'pausa', { hasta: fresco.pausa.hasta, finPagado: fin });
  return { negocio: fresco };
}

// Reanudar: si el período pagado no terminó, la suscripción se vuelve a
// crear justo cuando termine (no se cobra dos veces); si ya terminó, ahora.
async function reanudar(negocio, base) {
  if (!(negocio.pausa && negocio.pausa.hasta)) return { error: 'Tu suscripción no está en pausa', status: 400 };
  const fin = negocio.pausa.finPagado;
  if (fin && Date.parse(fin) > Date.now()) {
    const fresco = store.getNegocio(negocio.id);
    fresco.pausa = Object.assign({}, fresco.pausa, { hasta: fin, reanudadaPorDueno: true });
    store.saveNegocio(fresco);
    return { negocio: fresco };
  }
  return reactivar(negocio, base);
}

async function reactivar(negocio, base) {
  const r = await deps.suscribir(negocio.id, negocio.pausa.plan || negocio.plan, base, negocio.pausa.periodo);
  if (r.error) return r;
  const fresco = store.getNegocio(negocio.id);
  delete fresco.pausa;
  store.saveNegocio(fresco);
  return { negocio: fresco };
}

// Cada vuelta del reloj: avisa 3 días antes y reanuda al llegar la fecha.
async function revisarPausas(ahora = Date.now(), base) {
  const hechas = [];
  for (const n of deps.negocios()) {
    if (!(n.pausa && n.pausa.hasta)) continue;
    const hasta = Date.parse(n.pausa.hasta);
    if (hasta - ahora <= 3 * DIA && hasta > ahora && !n.pausa.avisoEl && !n.pausa.reanudadaPorDueno) {
      const fresco = store.getNegocio(n.id);
      fresco.pausa.avisoEl = new Date(ahora).toISOString();
      store.saveNegocio(fresco);
      deps.correo(n.id, 'pausa-termina', { hasta: n.pausa.hasta });
      hechas.push({ negocioId: n.id, tipo: 'aviso' });
    } else if (hasta <= ahora) {
      const r = await reactivar(n, base);
      if (r.error) {
        // Sin tarjeta válida: se le pide elegir el plan y la pausa termina igual.
        const fresco = store.getNegocio(n.id);
        delete fresco.pausa;
        store.saveNegocio(fresco);
        deps.correo(n.id, 'pausa-fallo', { error: r.error });
        hechas.push({ negocioId: n.id, tipo: 'fallo' });
      } else {
        deps.correo(n.id, 'reanudada', {});
        deps.notificar(n.id, { titulo: 'Tu plan se reanudó', cuerpo: 'Rubrofy vuelve a preparar tu contenido. Genera tu semana cuando quieras.', url: '/app#cola', tag: 'pausa' });
        hechas.push({ negocioId: n.id, tipo: 'reanudada' });
      }
    }
  }
  return hechas;
}

// ---------- celebraciones y racha ----------

// Una publicación de los últimos 3 días que supera en 50 % el promedio de
// los 30 anteriores (con al menos 5 publicaciones y 10 interacciones).
function celebrarPublicaciones(ahora = new Date()) {
  const avisados = [];
  const hoy = analitica.fechaLocal(ahora);
  for (const n of deps.negocios()) {
    if (!conPlan(n) || !getPlan(n.plan).analitica || !(n.instagram && n.instagram.accessToken)) continue;
    let base, recientes;
    try {
      base = analitica.resumen(n.id, analitica.sumarDias(hoy, -33), analitica.sumarDias(hoy, -3), null);
      recientes = analitica.resumen(n.id, analitica.sumarDias(hoy, -3), hoy, null);
    } catch (err) { continue; }
    if (!base.publicaciones || base.publicaciones < 5 || !base.interaccionesPosts) continue;
    const promedio = base.interaccionesPosts / base.publicaciones;
    const celebrados = (n.avisos && n.avisos.celebrados) || [];
    for (const p of recientes.topPosts || []) {
      const inter = Number(p.interacciones) || 0;
      const id = String(p.media_id);
      if (inter < 10 || inter < promedio * 1.5 || celebrados.includes(id)) continue;
      guardarAviso(n.id, { celebrados: celebrados.concat([id]).slice(-50) });
      deps.notificar(n.id, { titulo: `🎉 Tu ${p.tipo === 'REELS' ? 'reel' : 'publicación'} superó tu promedio`, cuerpo: `${inter} interacciones, contra ${Math.round(promedio)} de costumbre. Mira qué tuvo de distinto.`, url: '/app#resultados', tag: 'celebrar' });
      avisados.push({ negocioId: n.id, mediaId: id });
      break; // una por negocio por vuelta
    }
  }
  return avisados;
}

// Racha de 4 y 12 semanas: créditos de regalo y aviso.
function premiarRachas(ahora = new Date()) {
  const premiados = [];
  const premio = creditos.config().promo.racha || 0;
  for (const n of deps.negocios()) {
    if (!conPlan(n)) continue;
    const contenido = store.getContenido(n.id);
    const r = racha(contenido, ahora);
    const yaPremiada = (n.avisos && n.avisos.rachaPremiada) || 0;
    const hito = HITOS_RACHA.filter((h) => r >= h && h > yaPremiada).pop();
    if (!hito) continue;
    guardarAviso(n.id, { rachaPremiada: hito });
    if (premio) creditos.regalar(n.id, premio, 'racha', `Racha de ${hito} semanas publicando`);
    deps.notificar(n.id, { titulo: `🔥 ${hito} semanas seguidas publicando`, cuerpo: premio ? `Te regalamos ${premio} créditos ⚡ por la constancia.` : 'Así se construye una cuenta que crece.', url: '/app#inicio', tag: 'racha' });
    premiados.push({ negocioId: n.id, hito, premio });
  }
  return premiados;
}

// A los 3 meses con plan: correo con el resumen y créditos de regalo.
function aniversarios(ahora = Date.now()) {
  const enviados = [];
  const premio = creditos.config().promo.aniversario || 0;
  for (const n of deps.negocios()) {
    if (!conPlan(n) || !n.email || (n.avisos && n.avisos.aniversario3)) continue;
    const contenido = store.getContenido(n.id);
    const inicio = deps.creadoEl(n, contenido);
    if (!inicio || ahora - Date.parse(inicio) < 90 * DIA) continue;
    guardarAviso(n.id, { aniversario3: new Date(ahora).toISOString() });
    if (premio) creditos.regalar(n.id, premio, 'aniversario', 'Regalo por 3 meses con Rubrofy');
    const l = logros(n, contenido, new Date(ahora));
    deps.correo(n.id, 'aniversario', { logros: l, premio, desde: inicio });
    enviados.push({ negocioId: n.id, premio });
  }
  return enviados;
}

// Todo lo que corre en el reloj. Devuelve un resumen para el log.
async function vuelta(ahora = new Date(), base) {
  const ms = ahora.getTime();
  const r = { rescates: 0, pausas: 0, celebraciones: 0, rachas: 0, aniversarios: 0 };
  try { r.rescates = rescates(ms).length; } catch (err) { deps.log('fidelización/rescates: ' + err.message); }
  try { r.pausas = (await revisarPausas(ms, base)).length; } catch (err) { deps.log('fidelización/pausas: ' + err.message); }
  try { r.celebraciones = celebrarPublicaciones(ahora).length; } catch (err) { deps.log('fidelización/celebrar: ' + err.message); }
  try { r.rachas = premiarRachas(ahora).length; } catch (err) { deps.log('fidelización/rachas: ' + err.message); }
  try { r.aniversarios = aniversarios(ms).length; } catch (err) { deps.log('fidelización/aniversarios: ' + err.message); }
  return r;
}

module.exports = {
  configurar, datoSemana, faltantes, racha, logros, rescates, enRiesgo, aprobables,
  pausar, reanudar, revisarPausas, celebrarPublicaciones, premiarRachas, aniversarios, vuelta,
  DIAS_RESCATE, DIAS_RIESGO, HITOS_RACHA, MIN_POR_PUBLICACION,
};
