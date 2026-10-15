// Cobro con Mercado Pago: planes (suscripción) y recargas (pago único). Se
// ofrece junto a Flow: el negocio elige con cuál pagar. El cliente de la API
// está en server/mercadopago.js.
//
// Regla (la misma de Flow): el plan nunca cambia por lo que diga un aviso.
// El aviso solo trae un id; con él se le pregunta a Mercado Pago el estado
// real y se aplica eso. Además, cada 6 horas se revisan todas.
//
// negocio.mp = {
//   preapprovalId,   la suscripción que se sigue
//   pendiente: { id, plan, periodo, codigo, creadaEl }  creada, esperando
//                    que el negocio la autorice en Mercado Pago
//   estado (active | past_due | paused | canceled | incomplete), plan, periodo,
//   monto, emailPago, medio, periodoFin, cancelaAlFinal, pausada, cobros,
//   entorno ('prueba' | 'produccion')
// }
//
// Diferencias con Flow, por cómo funciona Mercado Pago:
// - Cambiar de plan cambia el monto de la misma suscripción: el plan nuevo
//   rige al tiro y el precio nuevo se cobra desde el próximo pago (sin
//   prorrateo).
// - Pasar de mensual a anual crea una suscripción nueva que empieza a cobrar
//   cuando termina lo ya pagado; al autorizarla se cancela la anterior.
// - Cancelar corta los cobros en Mercado Pago, pero el plan sigue hasta el
//   fin del período pagado. Pausar la deja en pausa y se reactiva sola.
// - Los códigos de descuento bajan el monto de la suscripción mientras
//   valgan; al vencer, Rubrofy vuelve a poner el precio del plan.

const mp = require('./mercadopago');
const store = require('./store');
const recargas = require('./recargas');
const pruebaGratis = require('./prueba-gratis');
const { PLANES, getPlan, precioAnual } = require('./planes');
const beneficios = require('./beneficios');

const DIA = 24 * 3600 * 1000;

let deps = { planDeCortesia: () => false, notificar: () => {}, alCobro: () => {} };
function configurar(d) { deps = Object.assign(deps, d); }

const ACTIVAS = new Set(['active']);
const VIGENTES = new Set(['active', 'past_due']);

// La referencia que viaja con la suscripción: de qué negocio, plan y período es.
function referencia(negocioId, planId, periodo) {
  return `rubrofy|${negocioId}|${planId}|${periodo}`;
}
function leerReferencia(ref) {
  const m = /^rubrofy\|([^|]+)\|([a-z]+)\|(mensual|anual)$/.exec(String(ref || ''));
  if (!m) return null;
  return { negocioId: m[1], plan: PLANES[m[2]] && m[2] !== 'gratis' ? m[2] : null, periodo: m[3] };
}
const motivo = (plan, periodo) => `Rubrofy ${plan.nombre}${periodo === 'anual' ? ' (pago anual)' : ''}`;
const dia = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : null);
const limpiarEmail = (e) => {
  const t = String(e || '').trim().toLowerCase().slice(0, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
};

// Lo que se cobra cada período: el precio del plan (anual: 12 meses por el
// precio de 10) menos el código de descuento vigente (solo en el mensual).
// fila: un código recién validado que todavía no se registra como usado.
function montoPara(negocioId, planId, periodo, fila) {
  const plan = getPlan(planId);
  if (periodo === 'anual') return precioAnual(plan);
  return beneficios.precioConDescuento(plan.precioClp, fila || beneficios.descuentoVigente(negocioId, planId));
}

// Una cuota de la suscripción como la muestra "Mi cuenta". Las cuotas
// programadas que todavía no se intentan cobrar no se muestran.
function cobroDeMp(c) {
  const pago = c.payment || {};
  const st = String(pago.status || '');
  let estado = 'pendiente';
  if (st === 'approved' || st === 'authorized') estado = 'pagado';
  else if (['refunded', 'charged_back', 'cancelled', 'canceled'].includes(st) || c.status === 'canceled') estado = 'anulado';
  return { id: String(c.id), fecha: dia(c.debit_date || c.date_created), monto: Number(c.transaction_amount) || 0, estado, periodo: null, link: null };
}
const cuotaIntentada = (c) => !(c.status === 'scheduled' && !(c.payment && c.payment.id));

function buscarPorSuscripcion(id) {
  if (!id) return null;
  return store.listNegocios().find((n) => n.mp && (n.mp.preapprovalId === id || (n.mp.pendiente && n.mp.pendiente.id === id))) || null;
}

function suscripcionVigente(negocio) {
  const m = negocio && negocio.mp;
  return !!(m && m.preapprovalId && !['canceled', 'incomplete'].includes(m.estado));
}

// Aplica lo que Mercado Pago dice de una suscripción al negocio que la sigue
// (o que la acaba de autorizar). cobros: las cuotas, si se consultaron.
function aplicarSuscripcion(negocioId, pre, cobros, ahora = Date.now()) {
  const negocio = store.getNegocio(negocioId);
  if (!negocio || !pre) return null;
  const m = negocio.mp || {};
  const esPendiente = !!(m.pendiente && m.pendiente.id === pre.id);
  // Una suscripción que no es la que el negocio sigue (una anterior) no le cambia el plan.
  if (!esPendiente && m.preapprovalId !== pre.id) return negocio;
  const estadoMp = mp.estadoSuscripcion(pre);
  if (esPendiente) {
    if (estadoMp === 'incomplete') return negocio; // todavía no la autoriza
    if (estadoMp === 'canceled') {
      delete negocio.mp.pendiente;
      store.saveNegocio(negocio);
      return negocio;
    }
  }
  const ref = leerReferencia(pre.external_reference) || {};
  const cancelaAlFinal = esPendiente ? false : !!m.cancelaAlFinal;
  const pausada = esPendiente ? false : !!m.pausada;
  // Mientras cobra, el fin del período es la fecha del próximo cobro; cancelada
  // o en pausa, la que se guardó al cancelar o pausar.
  const periodoFin = VIGENTES.has(estadoMp) ? dia(pre.next_payment_date) || m.periodoFin || null : m.periodoFin || dia(pre.next_payment_date);
  let estado = estadoMp;
  // Cancelada o en pausa desde Rubrofy: el plan sigue hasta el fin de lo pagado.
  if (((estado === 'canceled' && cancelaAlFinal) || (estado === 'paused' && pausada)) && periodoFin && Date.parse(periodoFin) > ahora) estado = 'active';
  const antes = new Map((m.cobros || []).map((c) => [c.id, c.estado]));
  negocio.mp = Object.assign({}, m, {
    entorno: mp.entorno(),
    preapprovalId: pre.id,
    estado,
    plan: ref.plan || (esPendiente && m.pendiente.plan) || m.plan || null,
    periodo: ref.periodo || m.periodo || 'mensual',
    monto: Number(pre.auto_recurring && pre.auto_recurring.transaction_amount) || m.monto || null,
    medio: pre.payment_method_id || m.medio || null,
    cancelaAlFinal,
    pausada,
    periodoFin,
  });
  if (esPendiente) delete negocio.mp.pendiente;
  if (Array.isArray(cobros)) {
    negocio.mp.cobros = cobros.filter(cuotaIntentada)
      .sort((a, b) => String(a.debit_date || a.date_created).localeCompare(String(b.debit_date || b.date_created)))
      .slice(-24).map(cobroDeMp);
  }
  // Cobros recién pagados (de los últimos 4 días): comprobante por correo.
  const recientes = ahora - 4 * DIA;
  const pagados = (negocio.mp.cobros || []).filter((c) => c.estado === 'pagado' && antes.get(c.id) !== 'pagado' && c.fecha && Date.parse(c.fecha) >= recientes);
  // Si paga con Flow al mismo tiempo (cambió de medio), esta no le quita el plan.
  if (!require('./pagos').activaFueraDe(negocio, 'mercadopago')) {
    const enPrueba = pruebaGratis.vigente(negocio);
    if (ACTIVAS.has(estado)) {
      if (enPrueba) negocio.prueba.terminada = 'suscripcion';
      beneficios.terminarRegalo(negocio, 'suscripcion', { suscrito: true });
      negocio.plan = negocio.mp.plan || negocio.plan || 'gratis';
      negocio.medioPago = 'mercadopago';
    } else {
      negocio.plan = enPrueba ? negocio.prueba.plan : beneficios.planSinPago(negocio);
    }
    deps.planDeCortesia(negocio);
  }
  store.saveNegocio(negocio);
  for (const c of pagados) deps.alCobro(negocioId, 'pago', c);
  return negocio;
}

// Consulta la suscripción (la que sigue el negocio, o id) y sus cuotas, y la aplica.
async function sincronizar(negocioId, id) {
  const negocio = store.getNegocio(negocioId);
  const m = (negocio && negocio.mp) || {};
  const preId = id || m.preapprovalId || (m.pendiente && m.pendiente.id);
  if (!negocio || !preId) return { negocio };
  const r = await mp.obtenerSuscripcion(preId);
  if (r.error) return r;
  const pre = r.data;
  const c = await mp.cobrosDe(pre.id);
  const cuotas = c.error ? null : (c.data.results || c.data.elements || []);
  const pendiente = m.pendiente && m.pendiente.id === pre.id ? m.pendiente : null;
  const autorizada = VIGENTES.has(mp.estadoSuscripcion(pre));
  // La nueva reemplaza a otra (pasó de mensual a anual, o volvió después de
  // cancelar): la anterior se cancela para que no cobre dos veces.
  if (pendiente && autorizada && m.preapprovalId && m.preapprovalId !== pre.id && m.estado !== 'canceled') {
    const x = await mp.actualizarSuscripcion(m.preapprovalId, { status: 'canceled' });
    if (x.error) console.log(`Mercado Pago: no se pudo cancelar la suscripción anterior de ${negocioId}: ${x.error}`);
  }
  const estadoAntes = m.estado;
  const despues = aplicarSuscripcion(negocioId, pre, cuotas);
  if (!despues || !despues.mp || despues.mp.preapprovalId !== pre.id) return { negocio: despues };
  if (pendiente && autorizada && pendiente.codigo) beneficios.registrarCanje(pendiente.codigo, negocioId, despues.mp.plan);
  if (estadoAntes !== 'past_due' && despues.mp.estado === 'past_due') {
    deps.notificar(negocioId, { titulo: 'No pudimos cobrar tu plan', cuerpo: 'Revisa tu medio de pago en Mercado Pago para seguir creando contenido.', url: '/app#cuenta', tag: 'cobro' });
    deps.alCobro(negocioId, 'fallido', {});
  }
  // El monto siempre es el precio del plan menos el código vigente: cuando
  // el código vence (o el precio cambia), se corrige para el próximo cobro.
  if (autorizada && !despues.mp.cancelaAlFinal && !despues.mp.pausada && despues.mp.plan) {
    const esperado = montoPara(negocioId, despues.mp.plan, despues.mp.periodo);
    if (esperado > 0 && Number(pre.auto_recurring && pre.auto_recurring.transaction_amount) !== esperado) {
      const u = await mp.actualizarSuscripcion(pre.id, { auto_recurring: { transaction_amount: esperado, currency_id: 'CLP' } });
      if (!u.error) {
        const fresco = store.getNegocio(negocioId);
        fresco.mp.monto = esperado;
        store.saveNegocio(fresco);
      }
    }
  }
  return { negocio: store.getNegocio(negocioId) };
}

// Revisa todas las suscripciones (y las pendientes de los últimos 2 días).
async function sincronizarTodas(ahora = Date.now()) {
  let n = 0;
  for (const neg of store.listNegocios()) {
    const m = neg.mp;
    if (!m) continue;
    const pendienteReciente = m.pendiente && ahora - Date.parse(m.pendiente.creadaEl || 0) < 2 * DIA;
    const seguir = m.preapprovalId && m.estado !== 'canceled';
    if (!seguir && !pendienteReciente) continue;
    const r = await sincronizar(neg.id, seguir ? m.preapprovalId : m.pendiente.id);
    if (r.error) console.log(`Mercado Pago: no se pudo revisar la suscripción de ${neg.id}: ${r.error}`);
    if (seguir && pendienteReciente) await sincronizar(neg.id, m.pendiente.id);
    n += 1;
  }
  return n;
}

// Crea la suscripción en Mercado Pago y devuelve { url } para autorizarla.
// inicio: desde cuándo cobra (cuando termina lo ya pagado), o ahora.
async function crearPendiente(negocio, planId, periodo, base, fila, emailPago, inicio) {
  const plan = getPlan(planId);
  const email = limpiarEmail(emailPago) || limpiarEmail(negocio.email);
  if (!email) return { error: 'Escribe el correo con el que pagas en Mercado Pago', status: 400 };
  const monto = montoPara(negocio.id, planId, periodo, fila);
  const desde = inicio && Date.parse(inicio) > Date.now() + 3600 * 1000 ? inicio : null;
  const r = await mp.crearSuscripcion({
    motivo: motivo(plan, periodo), referencia: referencia(negocio.id, planId, periodo), email, monto, periodo,
    urlRetorno: `${base}/api/mp/vuelta`, inicio: desde,
  });
  if (r.error) return r;
  if (!r.data.init_point || !r.data.id) return { error: 'Mercado Pago no devolvió el enlace para pagar. Intenta de nuevo en un momento.' };
  const fresco = store.getNegocio(negocio.id);
  const anterior = fresco.mp && fresco.mp.pendiente && fresco.mp.pendiente.id;
  fresco.mp = Object.assign({}, fresco.mp, {
    entorno: mp.entorno(), emailPago: email,
    pendiente: { id: r.data.id, plan: planId, periodo, codigo: fila ? fila.codigo : null, creadaEl: new Date().toISOString() },
  });
  store.saveNegocio(fresco);
  // Una pendiente anterior que no se autorizó ya no sirve.
  if (anterior && anterior !== r.data.id) mp.actualizarSuscripcion(anterior, { status: 'canceled' }).catch(() => {});
  return { url: r.data.init_point };
}

// Elegir o cambiar de plan. Devuelve { url } (hay que autorizar en Mercado
// Pago), { negocio } (listo) o { error, status }.
async function elegirPlan(negocio, planId, base, codigo, periodo = 'mensual', emailPago) {
  const plan = PLANES[planId];
  if (!plan || planId === 'gratis') return { error: 'Ese plan no está disponible', status: 400 };
  if (codigo && periodo === 'anual') return { error: 'Los códigos de descuento son para el pago mensual. El plan anual ya trae 2 meses gratis.', status: 400 };
  let fila = null;
  if (codigo) {
    const v = beneficios.validarCodigo(codigo, negocio.id, planId);
    if (v.error) return { error: v.error, status: 400 };
    fila = v.fila;
  }
  if (!(montoPara(negocio.id, planId, periodo, fila) > 0)) {
    return { error: 'Ese código deja el plan sin costo, y Mercado Pago no permite suscripciones de $0. Elige pagar con Flow para usarlo.', status: 400 };
  }
  const m = negocio.mp || {};
  if (suscripcionVigente(negocio)) {
    const sigueCobrando = !m.cancelaAlFinal && !m.pausada;
    if (m.plan === planId && m.periodo === periodo && sigueCobrando) return { error: 'Ya tienes ese plan', status: 409 };
    if (m.periodo === periodo && sigueCobrando) {
      // Mismo período: cambia el monto de la misma suscripción (desde el próximo cobro) y el plan cambia ahora.
      const r = await mp.actualizarSuscripcion(m.preapprovalId, {
        reason: motivo(plan, periodo), external_reference: referencia(negocio.id, planId, periodo),
        auto_recurring: { transaction_amount: montoPara(negocio.id, planId, periodo, fila), currency_id: 'CLP' },
      });
      if (r.error) return r;
      if (fila) beneficios.registrarCanje(fila.codigo, negocio.id, planId);
      return sincronizar(negocio.id);
    }
    // Otro período, o volver después de cancelar: una suscripción nueva que
    // empieza a cobrar cuando termina lo que ya pagó.
    return crearPendiente(negocio, planId, periodo, base, fila, emailPago || m.emailPago, m.periodoFin);
  }
  return crearPendiente(negocio, planId, periodo, base, fila, emailPago, null);
}

// Aplica un código a la suscripción vigente (baja el monto desde el próximo cobro).
async function aplicarCodigo(negocio, codigo) {
  const m = negocio.mp || {};
  if (!suscripcionVigente(negocio) || m.cancelaAlFinal || m.pausada) return { error: 'No tienes una suscripción activa', status: 400 };
  if (m.periodo === 'anual') return { error: 'Los códigos de descuento son para el pago mensual. El plan anual ya trae 2 meses gratis.', status: 400 };
  const v = beneficios.validarCodigo(codigo, negocio.id, m.plan);
  if (v.error) return { error: v.error, status: 400 };
  const monto = montoPara(negocio.id, m.plan, m.periodo, v.fila);
  if (!(monto > 0)) return { error: 'Ese código deja el plan sin costo, y Mercado Pago no permite suscripciones de $0.', status: 400 };
  const r = await mp.actualizarSuscripcion(m.preapprovalId, { auto_recurring: { transaction_amount: monto, currency_id: 'CLP' } });
  if (r.error) return r;
  beneficios.registrarCanje(v.fila.codigo, negocio.id, m.plan);
  return sincronizar(negocio.id);
}

// Fecha del próximo cobro según Mercado Pago (o la guardada).
async function proximoCobro(m) {
  const g = await mp.obtenerSuscripcion(m.preapprovalId);
  return (!g.error && dia(g.data.next_payment_date)) || m.periodoFin || null;
}

// Cancelar: Mercado Pago deja de cobrar y el plan sigue hasta el fin del período pagado.
async function cancelar(negocio) {
  const m = negocio.mp || {};
  if (!suscripcionVigente(negocio)) return { error: 'No tienes una suscripción activa', status: 400 };
  if (m.cancelaAlFinal) return { error: 'Tu suscripción ya está cancelada', status: 409 };
  const fin = await proximoCobro(m);
  const r = await mp.actualizarSuscripcion(m.preapprovalId, { status: 'canceled' });
  if (r.error) return r;
  const fresco = store.getNegocio(negocio.id);
  fresco.mp = Object.assign({}, fresco.mp, { cancelaAlFinal: true, periodoFin: fin });
  store.saveNegocio(fresco);
  return { negocio: aplicarSuscripcion(negocio.id, Object.assign({}, r.data, { id: m.preapprovalId, status: 'canceled', external_reference: r.data.external_reference || referencia(negocio.id, m.plan, m.periodo) })) };
}

// Pausa (server/fidelizacion.js): sin cobros desde ahora; el plan sigue
// hasta el fin del período pagado.
async function pausar(negocio) {
  const m = negocio.mp || {};
  if (!suscripcionVigente(negocio) || m.cancelaAlFinal || m.pausada) return { error: 'No tienes una suscripción activa', status: 400 };
  const fin = await proximoCobro(m);
  const r = await mp.actualizarSuscripcion(m.preapprovalId, { status: 'paused' });
  if (r.error) return r;
  const fresco = store.getNegocio(negocio.id);
  fresco.mp = Object.assign({}, fresco.mp, { pausada: true, periodoFin: fin });
  store.saveNegocio(fresco);
  return { negocio: aplicarSuscripcion(negocio.id, Object.assign({}, r.data, { id: m.preapprovalId, status: 'paused', external_reference: r.data.external_reference || referencia(negocio.id, m.plan, m.periodo) })) };
}

// Fin de la pausa: Mercado Pago vuelve a cobrar con el mismo medio de pago.
async function reanudar(negocioId) {
  const negocio = store.getNegocio(negocioId);
  const m = (negocio && negocio.mp) || {};
  if (!m.preapprovalId || !m.pausada) return { error: 'Tu suscripción no está en pausa', status: 400 };
  const r = await mp.actualizarSuscripcion(m.preapprovalId, { status: 'authorized' });
  if (r.error) return r;
  const fresco = store.getNegocio(negocioId);
  fresco.mp = Object.assign({}, fresco.mp, { pausada: false });
  store.saveNegocio(fresco);
  return sincronizar(negocioId);
}

// Cambiar el medio de pago: la misma página de Mercado Pago de la suscripción.
async function cambiarMedio(negocio) {
  const m = negocio.mp || {};
  if (!m.preapprovalId) return { error: 'Todavía no tienes una suscripción para gestionar', status: 400 };
  const r = await mp.obtenerSuscripcion(m.preapprovalId);
  if (r.error) return r;
  if (!r.data.init_point) return { error: 'Mercado Pago no devolvió el enlace. Cambia tu medio de pago desde tu cuenta de Mercado Pago, en Suscripciones.', status: 424 };
  return { url: r.data.init_point };
}

// Al eliminar la cuenta: se corta al tiro para que no se cobre más.
async function cancelarYa(negocio) {
  const m = negocio.mp || {};
  if (m.pendiente && m.pendiente.id) await mp.actualizarSuscripcion(m.pendiente.id, { status: 'canceled' });
  if (!m.preapprovalId || (m.estado === 'canceled') || (m.cancelaAlFinal && !m.pausada)) return {};
  return mp.actualizarSuscripcion(m.preapprovalId, { status: 'canceled' });
}

// Aviso de Mercado Pago (Webhooks). tipo: subscription_preapproval,
// subscription_authorized_payment o payment (también los nombres de IPN).
async function procesarAviso(tipo, id) {
  if (!id) return { estado: 'ignorado' };
  if (tipo === 'payment') return confirmarPago(id);
  let preId = null;
  if (tipo === 'subscription_preapproval' || tipo === 'preapproval') preId = id;
  else if (tipo === 'subscription_authorized_payment' || tipo === 'authorized_payment') {
    const c = await mp.obtenerCobro(id);
    if (c.error) return { estado: 'error' };
    preId = c.data.preapproval_id;
  } else return { estado: 'ignorado' };
  const negocio = buscarPorSuscripcion(preId);
  // Solo suscripciones que Rubrofy creó para ese negocio (nunca una ajena).
  if (!negocio) return { estado: 'ignorado' };
  const s = await sincronizar(negocio.id, preId);
  return { estado: s.error ? 'error' : 'ok' };
}

// Vuelta del negocio después de autorizar la suscripción en Mercado Pago.
// Devuelve 'exito' (quedó con plan), 'pendiente' (Mercado Pago todavía
// procesa) o 'error'.
async function vuelta(preId) {
  const negocio = buscarPorSuscripcion(preId);
  if (!negocio) return 'error';
  const s = await sincronizar(negocio.id, preId);
  if (s.error || !s.negocio) return 'error';
  const m = s.negocio.mp || {};
  return m.preapprovalId === preId && ACTIVAS.has(m.estado) ? 'exito' : 'pendiente';
}

// --- Recargas ---
async function pagarRecarga({ negocio, recarga, base }) {
  const p = recarga.paquete;
  const r = await mp.crearPreferencia({
    id: recarga.id, titulo: `Rubrofy · ${p.cantidad} ${recargas.TIPOS[p.tipo].nombre}`, monto: p.precioClp, email: negocio.email,
    referencia: 'recarga:' + recarga.id, urlRetorno: `${base}/api/mp/retorno`, urlAviso: `${base}/api/mp/aviso`,
  });
  if (r.error) return r;
  if (!r.data.init_point) return { error: 'Mercado Pago no devolvió el enlace para pagar. Intenta de nuevo en un momento.' };
  recargas.registrarSesion(recarga.id, 'mp:' + r.data.id);
  return { url: r.data.init_point };
}

// Confirma un pago de recarga. Devuelve { estado: 'pagado' | 'pendiente' | 'rechazado' | 'ignorado' | 'error' }.
async function confirmarPago(pagoId) {
  const r = await mp.obtenerPago(pagoId);
  if (r.error) return { estado: 'error' };
  const pago = r.data;
  const ref = String(pago.external_reference || '');
  // Los pagos de las suscripciones llegan por su propio aviso.
  if (!ref.startsWith('recarga:')) return { estado: 'ignorado' };
  const st = String(pago.status || '');
  if (['pending', 'in_process', 'authorized'].includes(st)) return { estado: 'pendiente' };
  if (st !== 'approved') return { estado: 'rechazado' };
  const recarga = recargas.obtener(ref.slice('recarga:'.length));
  // Se acredita solo si el monto pagado es el del paquete, en pesos.
  if (!recarga || String(pago.currency_id || '').toUpperCase() !== 'CLP' || Number(pago.transaction_amount) !== recarga.precio_clp) {
    console.log(`Mercado Pago: pago ${pago.id} no coincide con una recarga (${ref}, ${pago.transaction_amount} ${pago.currency_id})`);
    return { estado: 'error' };
  }
  const lote = recargas.acreditar(recarga.id, { sesion: 'mp:' + pago.id });
  if (lote) {
    deps.notificar(lote.negocio_id, { titulo: 'Recarga lista', cuerpo: `Se cargaron ${lote.cantidad} ${recargas.TIPOS[lote.tipo].nombre}. Ya puedes seguir creando.`, url: '/app', tag: 'recarga' });
    deps.alCobro(lote.negocio_id, 'recarga', { monto: recarga.precio_clp, detalle: `${lote.cantidad} ${recargas.TIPOS[lote.tipo].nombre}` });
  }
  return { estado: 'pagado' };
}

// Lo que ve el panel.
function publico(negocio) {
  const m = negocio.mp;
  if (!m) return null;
  return {
    estado: m.estado || null,
    cancelaAlFinal: !!(m.cancelaAlFinal || m.pausada),
    periodoFin: m.periodoFin || null,
    periodo: m.periodo || 'mensual',
    emailPago: m.emailPago || null,
  };
}

// Al pasar de credenciales de prueba a producción, lo creado en prueba no
// existe en Mercado Pago de verdad: se archiva en negocio.mpPrueba y el plan
// vuelve a lo que corresponde sin pago (como limpiarSandbox de Flow).
function limpiarPrueba(ahora = Date.now()) {
  if (!mp.configurado() || mp.entorno() !== 'produccion') return [];
  const limpiados = [];
  for (const n of store.listNegocios()) {
    if (!n.mp || n.mp.entorno !== 'prueba') continue;
    const negocio = store.getNegocio(n.id);
    const antes = negocio.plan || 'gratis';
    negocio.mpPrueba = Object.assign({}, negocio.mp, { archivadoEl: new Date(ahora).toISOString() });
    delete negocio.mp;
    if (!require('./pagos').activaFueraDe(negocio, 'mercadopago')) {
      if (negocio.pausa) delete negocio.pausa;
      negocio.plan = pruebaGratis.vigente(negocio, ahora) ? negocio.prueba.plan : beneficios.planSinPago(negocio, ahora);
      deps.planDeCortesia(negocio);
    }
    store.saveNegocio(negocio);
    limpiados.push({ negocioId: negocio.id, antes, despues: negocio.plan || 'gratis' });
  }
  return limpiados;
}

module.exports = {
  configurar, referencia, leerReferencia, montoPara, aplicarSuscripcion, sincronizar, sincronizarTodas,
  elegirPlan, aplicarCodigo, cancelar, pausar, reanudar, cambiarMedio, cancelarYa, suscripcionVigente,
  procesarAviso, vuelta, pagarRecarga, confirmarPago, publico, limpiarPrueba, cobroDeMp,
};
