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
//   planFlow, tarjeta { tipo, ultimos4 }, cancelaAlFinal, periodoFin, planPendiente,
//   entorno ('sandbox' | 'produccion'; sin el campo, es de sandbox: así se
//   guardaba antes de pasar a producción)
// }

const flow = require('./flow');
const store = require('./store');
const recargas = require('./recargas');
const pruebaGratis = require('./prueba-gratis');
const { PLANES, getPlan } = require('./planes');
const beneficios = require('./beneficios');

// alCobro(negocioId, evento, datos): 'pago' (cobro de la suscripción pagado),
// 'fallido' (no se pudo cobrar) y 'recarga' (compra de créditos pagada).
let deps = { planDeCortesia: () => false, notificar: () => {}, alCobro: () => {} };
function configurar(d) { deps = Object.assign(deps, d); }

const ACTIVAS = new Set(['active', 'trialing']);

// El plan de Rubrofy que corresponde a un plan de Flow (rubrofy-pro-19990).
function planDesdeFlow(planFlow) {
  const m = /^rubrofy-([a-z]+)(?:-anual)?-\d+$/.exec(String(planFlow || ''));
  return m && PLANES[m[1]] && m[1] !== 'gratis' ? m[1] : null;
}
// 'anual' o 'mensual' según el plan de Flow.
function periodoDesdeFlow(planFlow) {
  return /-anual-\d+$/.test(String(planFlow || '')) ? 'anual' : 'mensual';
}

function buscarPor(campo, valor) {
  if (!valor) return null;
  return store.listNegocios().find((n) => n.flow && n.flow[campo] === valor) || null;
}

// Aplica lo que Flow dice de una suscripción al negocio que la sigue.
// Un cobro (invoice) de Flow como lo muestra "Mi cuenta". El enlace de
// pago solo se guarda si el cobro está pendiente y es de flow.cl.
function cobroDeFlow(i) {
  const st = Number(i.status);
  const estado = st === 1 ? 'pagado' : st === 2 ? 'anulado' : 'pendiente';
  const enlace = String(i.paymentLink || '');
  const dia = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(0, 10) : null);
  return {
    id: i.id,
    fecha: dia(i.created),
    monto: Number(i.amount) || 0,
    estado,
    periodo: dia(i.period_start) && dia(i.period_end) ? { desde: dia(i.period_start), hasta: dia(i.period_end) } : null,
    link: estado === 'pendiente' && /^https:\/\/([a-z0-9-]+\.)?flow\.cl\//.test(enlace) ? enlace : null,
  };
}

function aplicarSuscripcion(negocioId, sub) {
  const negocio = store.getNegocio(negocioId);
  if (!negocio || !sub) return null;
  // Una suscripción que no es la que el negocio sigue (una anterior) no le cambia el plan.
  if (negocio.flow && negocio.flow.subscriptionId && negocio.flow.subscriptionId !== sub.subscriptionId) return negocio;
  const estado = flow.estadoSuscripcion(sub);
  const antes = new Map(((negocio.flow && negocio.flow.cobros) || []).map((c) => [c.id, c.estado]));
  negocio.flow = Object.assign({}, negocio.flow, {
    entorno: flow.entorno(),
    subscriptionId: sub.subscriptionId,
    customerId: sub.customerId || (negocio.flow && negocio.flow.customerId),
    estado,
    planFlow: sub.planId,
    periodo: periodoDesdeFlow(sub.planId),
    cancelaAlFinal: Number(sub.cancel_at_period_end) === 1,
    periodoFin: sub.period_end || null,
  });
  // Los cobros de la suscripción, para "Mi cuenta" (los últimos 24).
  if (Array.isArray(sub.invoices)) negocio.flow.cobros = sub.invoices.slice(-24).map(cobroDeFlow);
  // Cobros recién pagados (de los últimos 4 días: al empezar a guardarlos no
  // se manda un comprobante por cada pago antiguo).
  const recientes = Date.now() - 4 * 24 * 3600 * 1000;
  const pagados = (negocio.flow.cobros || []).filter((c) => c.estado === 'pagado' && antes.get(c.id) !== 'pagado' && c.fecha && Date.parse(c.fecha) >= recientes);
  delete negocio.flow.planPendiente;
  delete negocio.flow.codigoPendiente;
  delete negocio.flow.periodoPendiente;
  const enPrueba = pruebaGratis.vigente(negocio);
  if (ACTIVAS.has(estado)) {
    // Si paga durante la prueba gratis, la prueba termina y manda el plan pagado.
    if (enPrueba) negocio.prueba.terminada = 'suscripcion';
    // Lo mismo con un plan de regalo: ahora manda el que paga.
    beneficios.terminarRegalo(negocio, 'suscripcion', { suscrito: true });
    negocio.plan = planDesdeFlow(sub.planId) || negocio.plan || 'gratis';
  } else {
    // Cancelada, sin iniciar o con un cobro vencido: vuelve a sin plan
    // (o conserva la prueba gratis o el plan de regalo hasta su fecha).
    negocio.plan = enPrueba ? negocio.prueba.plan : beneficios.planSinPago(negocio);
  }
  deps.planDeCortesia(negocio);
  store.saveNegocio(negocio);
  for (const c of pagados) deps.alCobro(negocioId, 'pago', c);
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
    deps.notificar(negocioId, { titulo: 'No pudimos cobrar tu plan', cuerpo: 'Revisa tu tarjeta en Plan para seguir creando contenido.', url: '/app#cuenta', tag: 'cobro' });
    deps.alCobro(negocioId, 'fallido', {});
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
  // En producción, un cliente creado en sandbox no sirve: se crea otro. En
  // sandbox nunca se reemplaza lo guardado (podría ser un cliente real).
  const reutilizable = flow.entorno() === 'sandbox' || entornoDe(negocio.flow) === 'produccion';
  if (negocio.flow && negocio.flow.customerId && reutilizable) return { data: negocio.flow.customerId };
  const r = await flow.crearCliente({ nombre: negocio.nombre, email: negocio.email, negocioId: negocio.id });
  if (r.error) return r;
  const fresco = store.getNegocio(negocio.id);
  fresco.flow = Object.assign({}, fresco.flow, { customerId: r.data.customerId, entorno: flow.entorno() });
  store.saveNegocio(fresco);
  return { data: r.data.customerId };
}

// El cupón de Flow de un código de descuento (se crea la primera vez que se
// usa en cada ambiente). Se guarda como "produccion:123"; un id sin prefijo
// es de antes de pasar a producción, o sea de sandbox.
async function cuponDe(fila) {
  const guardado = String(fila.flow_cupon || '');
  const [ent, id] = guardado.includes(':') ? guardado.split(':') : ['sandbox', guardado];
  if (id && ent === flow.entorno()) return { data: id };
  const r = await flow.crearCupon({
    nombre: `Rubrofy ${fila.codigo}`, meses: fila.meses,
    porcentaje: fila.tipo === 'porcentaje' ? fila.valor : null, monto: fila.tipo === 'monto' ? fila.valor : null,
  });
  if (r.error) return r;
  beneficios.guardarCuponFlow(fila.codigo, `${flow.entorno()}:${r.data.id}`);
  return { data: String(r.data.id) };
}

// Valida el código para ese plan y devuelve { cupon, codigo } (o nada si no hay código).
async function prepararCodigo(negocioId, planId, codigo) {
  if (!codigo) return {};
  const v = beneficios.validarCodigo(codigo, negocioId, planId);
  if (v.error) return { error: v.error, status: 400 };
  const c = await cuponDe(v.fila);
  if (c.error) return c;
  return { cupon: c.data, codigo: v.fila.codigo };
}

async function suscribir(negocioId, planId, base, codigo, periodo) {
  const plan = getPlan(planId);
  const listo = await flow.asegurarPlan(plan, `${base}/api/flow/plan`, periodo);
  if (listo.error) return listo;
  const d = await prepararCodigo(negocioId, planId, codigo);
  if (d.error) return d;
  const negocio = store.getNegocio(negocioId);
  const r = await flow.crearSuscripcion({ planId: flow.idPlan(plan, periodo), customerId: negocio.flow.customerId, couponId: d.cupon });
  if (r.error) return r;
  if (d.codigo) beneficios.registrarCanje(d.codigo, negocioId, planId);
  // La suscripción nueva pasa a ser la que se sigue.
  const fresco = store.getNegocio(negocioId);
  fresco.flow = Object.assign({}, fresco.flow, { subscriptionId: r.data.subscriptionId, entorno: flow.entorno() });
  store.saveNegocio(fresco);
  return { negocio: aplicarSuscripcion(negocioId, r.data) };
}

function suscripcionVigente(negocio) {
  return !!(negocio.flow && negocio.flow.subscriptionId && negocio.flow.estado !== 'canceled' && negocio.flow.estado !== 'incomplete');
}

// Elegir o cambiar de plan. Devuelve { url } (hay que inscribir la tarjeta
// en Flow), { negocio } (listo) o { error, status }.
// codigo: código de descuento opcional (se valida para ese plan).
// periodo: 'mensual' o 'anual' (2 meses gratis; sin códigos de descuento).
async function elegirPlan(negocio, planId, base, codigo, periodo = 'mensual') {
  const plan = PLANES[planId];
  if (!plan || planId === 'gratis') return { error: 'Ese plan no está disponible', status: 400 };
  if (codigo && periodo === 'anual') return { error: 'Los códigos de descuento son para el pago mensual. El plan anual ya trae 2 meses gratis.', status: 400 };
  if (codigo) {
    const v = beneficios.validarCodigo(codigo, negocio.id, planId);
    if (v.error) return { error: v.error, status: 400 };
  }
  if (suscripcionVigente(negocio)) {
    if (planDesdeFlow(negocio.flow.planFlow) === planId && periodoDesdeFlow(negocio.flow.planFlow) === periodo && !negocio.flow.cancelaAlFinal) return { error: 'Ya tienes ese plan', status: 409 };
    const listo = await flow.asegurarPlan(plan, `${base}/api/flow/plan`, periodo);
    if (listo.error) return listo;
    const r = await flow.cambiarPlan({ subscriptionId: negocio.flow.subscriptionId, planId: flow.idPlan(plan, periodo) });
    if (r.error) return r;
    if (codigo) {
      const a = await aplicarCodigo(store.getNegocio(negocio.id), codigo, planId);
      if (a.error) return a;
    }
    return sincronizar(negocio.id);
  }
  // El plan se deja listo en Flow antes de mandar a inscribir la tarjeta:
  // si Flow lo rechaza, el error se ve aquí y no después de inscribirla.
  const listo = await flow.asegurarPlan(plan, `${base}/api/flow/plan`);
  if (listo.error) return listo;
  const cliente = await asegurarCliente(negocio);
  if (cliente.error) return cliente;
  const fresco = store.getNegocio(negocio.id);
  if (fresco.flow.tarjeta) return suscribir(negocio.id, planId, base, codigo, periodo);
  fresco.flow.planPendiente = planId;
  fresco.flow.periodoPendiente = periodo;
  if (codigo) fresco.flow.codigoPendiente = beneficios.normalizarCodigo(codigo);
  else delete fresco.flow.codigoPendiente;
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
  const codigo = negocio.flow.codigoPendiente;
  const periodo = negocio.flow.periodoPendiente;
  store.saveNegocio(negocio);
  // Solo cambió la tarjeta, o ya tiene una suscripción vigente: no se crea otra.
  if (!pendiente || suscripcionVigente(negocio)) return { resultado: pendiente ? 'exito' : 'tarjeta-ok', negocioId: negocio.id };
  let s = await suscribir(negocio.id, pendiente, base, codigo, periodo);
  // Si el código dejó de valer entre medio (se agotó), se suscribe igual sin él.
  if (s.error && codigo && s.status === 400) s = await suscribir(negocio.id, pendiente, base, null, periodo);
  return { resultado: s.error ? 'error' : 'exito', negocioId: negocio.id };
}

// Aplica un código a la suscripción vigente (planId: el plan actual).
async function aplicarCodigo(negocio, codigo, planId) {
  if (!suscripcionVigente(negocio)) return { error: 'No tienes una suscripción activa', status: 400 };
  const plan = planId || planDesdeFlow(negocio.flow.planFlow);
  const d = await prepararCodigo(negocio.id, plan, codigo);
  if (d.error) return d;
  const r = await flow.agregarCupon({ subscriptionId: negocio.flow.subscriptionId, couponId: d.cupon });
  if (r.error) return r;
  beneficios.registrarCanje(d.codigo, negocio.id, plan);
  return { negocio: aplicarSuscripcion(negocio.id, r.data) };
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
  if (lote) {
    deps.notificar(lote.negocio_id, { titulo: 'Recarga lista', cuerpo: `Se cargaron ${lote.cantidad} ${recargas.TIPOS[lote.tipo].nombre}. Ya puedes seguir creando.`, url: '/app', tag: 'recarga' });
    deps.alCobro(lote.negocio_id, 'recarga', { monto: recarga.precio_clp, detalle: `${lote.cantidad} ${recargas.TIPOS[lote.tipo].nombre}` });
  }
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
    periodo: f.periodo || 'mensual',
  };
}

// En qué ambiente de Flow se creó lo guardado (sin el campo: sandbox).
function entornoDe(f) {
  return (f && f.entorno) || 'sandbox';
}

// Al pasar de sandbox a producción, los clientes y suscripciones de prueba
// no existen en Flow de verdad: con ellos nadie podría inscribir su tarjeta
// y una cuenta que "pagó" en sandbox seguiría con plan sin pagar nunca.
// Al arrancar en producción, lo de sandbox se archiva en negocio.flowSandbox
// y el plan vuelve a lo que corresponde sin pago (prueba gratis vigente,
// plan de regalo o cortesía de administrador). En sandbox no hace nada: así
// volver a probar nunca borra datos de cobros reales.
function limpiarSandbox(ahora = Date.now()) {
  if (flow.entorno() !== 'produccion') return [];
  const limpiados = [];
  for (const n of store.listNegocios()) {
    if (!n.flow || entornoDe(n.flow) === 'produccion') continue;
    const negocio = store.getNegocio(n.id);
    const antes = negocio.plan || 'gratis';
    negocio.flowSandbox = Object.assign({}, negocio.flow, { archivadoEl: new Date(ahora).toISOString() });
    delete negocio.flow;
    // La pausa se apoya en la suscripción de sandbox: ya no aplica.
    delete negocio.pausa;
    const pagaConStripe = !!(negocio.stripe && negocio.stripe.subscriptionId);
    if (!pagaConStripe) {
      negocio.plan = pruebaGratis.vigente(negocio, ahora) ? negocio.prueba.plan : beneficios.planSinPago(negocio, ahora);
      deps.planDeCortesia(negocio);
    }
    store.saveNegocio(negocio);
    limpiados.push({ negocioId: negocio.id, antes, despues: negocio.plan || 'gratis' });
  }
  return limpiados;
}

module.exports = {
  limpiarSandbox, entornoDe,
  configurar, planDesdeFlow, periodoDesdeFlow, aplicarSuscripcion, sincronizar, sincronizarTodas,
  elegirPlan, aplicarCodigo, inscribirTarjeta, retornoTarjeta, cancelar, cancelarYa, suscripcionVigente, suscribir,
  pagarRecarga, confirmarPago, publico, cobroDeFlow,
};
