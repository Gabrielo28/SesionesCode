// Cobro con Flow: planes mensuales (suscripción con tarjeta inscrita) y
// recargas (pago único). El cliente de la API está en server/flow.js.
//
// Regla: el plan del negocio nunca cambia por lo que diga un aviso de Flow.
// Los avisos solo traen un token; con él (o con el id de la suscripción) se
// le pregunta a Flow el estado real y se aplica eso. Además, cada 6 horas se
// revisan todas las suscripciones por si un aviso no llegó.
//
// negocio.flow = {
//   customerId, subscriptionId, estado (active | trialing | past_due | canceled | incomplete),
//   planFlow, tarjeta { tipo, ultimos4 }, cancelaAlFinal, periodoFin, planPendiente
// }

const flow = require('./flow');
const store = require('./store');
const recargas = require('./recargas');
const pruebaGratis = require('./prueba-gratis');
const { PLANES, getPlan } = require('./planes');

let deps = { planDeCortesia: () => false, notificar: () => {} };
function configurar(d) { deps = Object.assign(deps, d); }

const ACTIVAS = new Set(['active', 'trialing']);

// El plan de Rubrofy que corresponde a un plan de Flow (rubrofy-pro-19990).
function planDesdeFlow(planFlow) {
  const m = /^rubrofy-([a-z]+)-\d+$/.exec(String(planFlow || ''));
  return m && PLANES[m[1]] && m[1] !== 'gratis' ? m[1] : null;
}

function buscarPor(campo, valor) {
  if (!valor) return null;
  return store.listNegocios().find((n) => n.flow && n.flow[campo] === valor) || null;
}

// Aplica lo que Flow dice de una suscripción al negocio que la sigue.
function aplicarSuscripcion(negocioId, sub) {
  const negocio = store.getNegocio(negocioId);
  if (!negocio || !sub) return null;
  // Una suscripción que no es la que el negocio sigue (una anterior) no le cambia el plan.
  if (negocio.flow && negocio.flow.subscriptionId && negocio.flow.subscriptionId !== sub.subscriptionId) return negocio;
  const estado = flow.estadoSuscripcion(sub);
  negocio.flow = Object.assign({}, negocio.flow, {
    subscriptionId: sub.subscriptionId,
    customerId: sub.customerId || (negocio.flow && negocio.flow.customerId),
    estado,
    planFlow: sub.planId,
    cancelaAlFinal: Number(sub.cancel_at_period_end) === 1,
    periodoFin: sub.period_end || null,
  });
  delete negocio.flow.planPendiente;
  const enPrueba = pruebaGratis.vigente(negocio);
  if (ACTIVAS.has(estado)) {
    // Si paga durante la prueba gratis, la prueba termina y manda el plan pagado.
    if (enPrueba) negocio.prueba.terminada = 'suscripcion';
    negocio.plan = planDesdeFlow(sub.planId) || negocio.plan || 'gratis';
  } else {
    // Cancelada, sin iniciar o con un cobro vencido: vuelve a sin plan
    // (o conserva la prueba gratis hasta su fecha).
    negocio.plan = enPrueba ? negocio.prueba.plan : 'gratis';
  }
  deps.planDeCortesia(negocio);
  store.saveNegocio(negocio);
  return negocio;
}

async function sincronizar(negocioId) {
  const negocio = store.getNegocio(negocioId);
  const id = negocio && negocio.flow && negocio.flow.subscriptionId;
  if (!id) return { negocio };
  const r = await flow.obtenerSuscripcion(id);
  if (r.error) return r;
  const antes = negocio.plan;
  const despues = aplicarSuscripcion(negocioId, r.data);
  if (despues && antes !== 'gratis' && despues.plan === 'gratis' && despues.flow.estado === 'past_due') {
    deps.notificar(negocioId, { titulo: 'No pudimos cobrar tu plan', cuerpo: 'Revisa tu tarjeta en Plan para seguir creando contenido.', url: '/app#config', tag: 'cobro' });
  }
  return { negocio: despues };
}

// Revisa todas las suscripciones de Flow. Devuelve cuántas revisó.
async function sincronizarTodas() {
  let n = 0;
  for (const neg of store.listNegocios()) {
    if (!(neg.flow && neg.flow.subscriptionId)) continue;
    if (neg.flow.estado === 'canceled') continue;
    const r = await sincronizar(neg.id);
    if (r.error) console.log(`Flow: no se pudo revisar la suscripción de ${neg.id}: ${r.error}`);
    n += 1;
  }
  return n;
}

async function asegurarCliente(negocio) {
  if (negocio.flow && negocio.flow.customerId) return { data: negocio.flow.customerId };
  const r = await flow.crearCliente({ nombre: negocio.nombre, email: negocio.email, negocioId: negocio.id });
  if (r.error) return r;
  const fresco = store.getNegocio(negocio.id);
  fresco.flow = Object.assign({}, fresco.flow, { customerId: r.data.customerId });
  store.saveNegocio(fresco);
  return { data: r.data.customerId };
}

async function suscribir(negocioId, planId, base) {
  const plan = getPlan(planId);
  const listo = await flow.asegurarPlan(plan, `${base}/api/flow/plan`);
  if (listo.error) return listo;
  const negocio = store.getNegocio(negocioId);
  const r = await flow.crearSuscripcion({ planId: flow.idPlan(plan), customerId: negocio.flow.customerId });
  if (r.error) return r;
  // La suscripción nueva pasa a ser la que se sigue.
  const fresco = store.getNegocio(negocioId);
  fresco.flow = Object.assign({}, fresco.flow, { subscriptionId: r.data.subscriptionId });
  store.saveNegocio(fresco);
  return { negocio: aplicarSuscripcion(negocioId, r.data) };
}

function suscripcionVigente(negocio) {
  return !!(negocio.flow && negocio.flow.subscriptionId && negocio.flow.estado !== 'canceled' && negocio.flow.estado !== 'incomplete');
}

// Elegir o cambiar de plan. Devuelve { url } (hay que inscribir la tarjeta
// en Flow), { negocio } (listo) o { error, status }.
async function elegirPlan(negocio, planId, base) {
  const plan = PLANES[planId];
  if (!plan || planId === 'gratis') return { error: 'Ese plan no está disponible', status: 400 };
  if (suscripcionVigente(negocio)) {
    if (planDesdeFlow(negocio.flow.planFlow) === planId && !negocio.flow.cancelaAlFinal) return { error: 'Ya tienes ese plan', status: 409 };
    const listo = await flow.asegurarPlan(plan, `${base}/api/flow/plan`);
    if (listo.error) return listo;
    const r = await flow.cambiarPlan({ subscriptionId: negocio.flow.subscriptionId, planId: flow.idPlan(plan) });
    if (r.error) return r;
    return sincronizar(negocio.id);
  }
  // El plan se deja listo en Flow antes de mandar a inscribir la tarjeta:
  // si Flow lo rechaza, el error se ve aquí y no después de inscribirla.
  const listo = await flow.asegurarPlan(plan, `${base}/api/flow/plan`);
  if (listo.error) return listo;
  const cliente = await asegurarCliente(negocio);
  if (cliente.error) return cliente;
  const fresco = store.getNegocio(negocio.id);
  if (fresco.flow.tarjeta) return suscribir(negocio.id, planId, base);
  fresco.flow.planPendiente = planId;
  store.saveNegocio(fresco);
  return inscribirTarjeta(fresco, base);
}

async function inscribirTarjeta(negocio, base) {
  const cliente = await asegurarCliente(negocio);
  if (cliente.error) return cliente;
  const r = await flow.registrarTarjeta({ customerId: cliente.data, urlRetorno: `${base}/api/flow/tarjeta` });
  if (r.error) return r;
  return { url: `${r.data.url}?token=${encodeURIComponent(r.data.token)}` };
}

// Vuelta de inscribir la tarjeta. Devuelve { resultado }: 'exito' (quedó suscrito),
// 'tarjeta-ok' (solo cambió la tarjeta), 'tarjeta' (no se inscribió) o 'error'.
async function retornoTarjeta(token, base) {
  const r = await flow.estadoRegistro(token);
  if (r.error) return { resultado: 'error' };
  const negocio = buscarPor('customerId', r.data.customerId);
  if (!negocio) return { resultado: 'error' };
  if (String(r.data.status) !== '1') return { resultado: 'tarjeta' };
  negocio.flow.tarjeta = { tipo: r.data.creditCardType || '', ultimos4: r.data.last4CardDigits || '' };
  const pendiente = negocio.flow.planPendiente;
  store.saveNegocio(negocio);
  // Solo cambió la tarjeta, o ya tiene una suscripción vigente: no se crea otra.
  if (!pendiente || suscripcionVigente(negocio)) return { resultado: pendiente ? 'exito' : 'tarjeta-ok', negocioId: negocio.id };
  const s = await suscribir(negocio.id, pendiente, base);
  return { resultado: s.error ? 'error' : 'exito', negocioId: negocio.id };
}

async function cancelar(negocio) {
  if (!suscripcionVigente(negocio)) return { error: 'No tienes una suscripción activa', status: 400 };
  const r = await flow.cancelarSuscripcion(negocio.flow.subscriptionId, true);
  if (r.error) return r;
  return { negocio: aplicarSuscripcion(negocio.id, r.data) };
}

// Al eliminar la cuenta: se corta al tiro para que no se cobre más.
async function cancelarYa(negocio) {
  if (!suscripcionVigente(negocio)) return {};
  return flow.cancelarSuscripcion(negocio.flow.subscriptionId, false);
}

// --- Recargas ---
async function pagarRecarga({ negocio, recarga, base }) {
  const p = recarga.paquete;
  const r = await flow.crearPago({
    orden: recarga.id, asunto: `Rubrofy · ${p.cantidad} ${recargas.TIPOS[p.tipo].nombre}`, monto: p.precioClp, email: negocio.email,
    urlConfirmacion: `${base}/api/flow/confirmacion`, urlRetorno: `${base}/api/flow/retorno`,
  });
  if (r.error) return r;
  recargas.registrarSesion(recarga.id, 'flow:' + r.data.token);
  return { url: `${r.data.url}?token=${encodeURIComponent(r.data.token)}` };
}

// Confirma un pago de recarga con Flow. Devuelve { estado: 'pagado' | 'pendiente' | 'rechazado' | 'error' }.
async function confirmarPago(token) {
  const r = await flow.estadoPago(token);
  if (r.error) return { estado: 'error' };
  const pago = r.data;
  const status = Number(pago.status);
  if (status === 1) return { estado: 'pendiente' };
  if (status !== 2) return { estado: 'rechazado' };
  const recarga = recargas.obtener(pago.commerceOrder);
  // Se acredita solo si el monto pagado es el del paquete, en pesos.
  if (!recarga || String(pago.currency || 'CLP').toUpperCase() !== 'CLP' || Number(pago.amount) !== recarga.precio_clp) {
    console.log(`Flow: pago ${pago.flowOrder} no coincide con una recarga (${pago.commerceOrder}, ${pago.amount} ${pago.currency})`);
    return { estado: 'error' };
  }
  const lote = recargas.acreditar(recarga.id, { sesion: 'flow:' + pago.flowOrder });
  if (lote) deps.notificar(lote.negocio_id, { titulo: 'Recarga lista', cuerpo: `Se cargaron ${lote.cantidad} ${recargas.TIPOS[lote.tipo].nombre}. Ya puedes seguir creando.`, url: '/app', tag: 'recarga' });
  return { estado: 'pagado' };
}

// Lo que ve el panel.
function publico(negocio) {
  const f = negocio.flow;
  if (!f) return null;
  return {
    estado: f.estado || null,
    tarjeta: f.tarjeta || null,
    cancelaAlFinal: !!f.cancelaAlFinal,
    periodoFin: f.periodoFin || null,
  };
}

module.exports = {
  configurar, planDesdeFlow, aplicarSuscripcion, sincronizar, sincronizarTodas,
  elegirPlan, inscribirTarjeta, retornoTarjeta, cancelar, cancelarYa, suscripcionVigente,
  pagarRecarga, confirmarPago, publico,
};
