// Con qué se cobra y en qué estado está la suscripción de un negocio, sin
// importar si es Flow, Mercado Pago o Stripe. Flow (FLOW_API_KEY y
// FLOW_SECRET_KEY) y Mercado Pago (MERCADOPAGO_ACCESS_TOKEN) pueden estar
// los dos: el negocio elige con cuál pagar. Stripe solo se usa si no hay
// ninguno de los dos.
const flow = require('./flow');
const mercadopago = require('./mercadopago');

const NOMBRES = { flow: 'Flow', mercadopago: 'Mercado Pago', stripe: 'Stripe' };

// Los medios de pago disponibles, en el orden en que se ofrecen.
function proveedores() {
  const lista = [];
  if (flow.configurado()) lista.push('flow');
  if (mercadopago.configurado()) lista.push('mercadopago');
  if (!lista.length && process.env.STRIPE_SECRET_KEY) lista.push('stripe');
  return lista;
}

// El medio por omisión (o null si no se puede cobrar).
function proveedor() {
  return proveedores()[0] || null;
}

function disponible(p) {
  return proveedores().includes(p);
}

const VIVAS = ['active', 'trialing', 'past_due'];

function todas(negocio) {
  const lista = [];
  if (negocio.flow && negocio.flow.subscriptionId) lista.push(Object.assign({ proveedor: 'flow' }, negocio.flow));
  if (negocio.mp && negocio.mp.preapprovalId) lista.push(Object.assign({ proveedor: 'mercadopago' }, negocio.mp));
  if (negocio.stripe && negocio.stripe.subscriptionId) lista.push(Object.assign({ proveedor: 'stripe' }, negocio.stripe));
  return lista;
}

// La suscripción que el negocio sigue: la que está viva; si ninguna, la del
// último medio con que pagó (negocio.medioPago), o la primera que tenga.
function suscripcion(negocio) {
  const lista = todas(negocio);
  return lista.find((s) => VIVAS.includes(s.estado)) || lista.find((s) => s.proveedor === negocio.medioPago) || lista[0] || null;
}

// ¿Paga al día con otro medio que no sea "menos"? Así, cuando se cancela la
// suscripción de un medio, no se le quita el plan que paga con el otro.
function activaFueraDe(negocio, menos) {
  return todas(negocio).some((s) => s.proveedor !== menos && ['active', 'trialing'].includes(s.estado));
}

function estado(negocio) {
  const s = suscripcion(negocio);
  return s ? s.estado || null : null;
}

// Tiene una suscripción que sigue viva (incluye un cobro atrasado).
function suscrito(negocio) {
  return VIVAS.includes(estado(negocio));
}

// Tiene una suscripción al día.
function activa(negocio) {
  return ['active', 'trialing'].includes(estado(negocio));
}

// Lo que el negocio paga de verdad al mes (CLP), para los ingresos de /admin:
// 0 sin una suscripción al día (prueba gratis, plan de regalo, cortesía o
// cobro cancelado). Manda el último cobro pagado, que ya trae el descuento;
// sin cobros todavía, el precio del plan menos el código vigente.
function pagoMensual(negocio, ahora = Date.now()) {
  const beneficios = require('./beneficios');
  if (negocio.cortesia || beneficios.regaloVigente(negocio, ahora) || !activa(negocio)) return 0;
  const s = suscripcion(negocio);
  const datos = s && s.proveedor === 'mercadopago' ? negocio.mp : negocio.flow;
  const pagados = ((datos && datos.cobros) || []).filter((c) => c.estado === 'pagado' && c.monto > 0)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  // Con pago anual, lo que corresponde a un mes.
  const anual = datos && datos.periodo === 'anual';
  if (pagados.length) return anual ? Math.round(pagados[pagados.length - 1].monto / 12) : pagados[pagados.length - 1].monto;
  if (s && s.proveedor === 'mercadopago' && datos.monto) return anual ? Math.round(datos.monto / 12) : datos.monto;
  const planes = require('./planes');
  const plan = planes.getPlan(negocio.plan);
  if (anual) return Math.round(planes.precioAnual(plan) / 12);
  return beneficios.precioConDescuento(plan.precioClp || 0, beneficios.descuentoVigente(negocio.id, plan.id, ahora));
}

module.exports = {
  proveedores, proveedor, disponible, nombre: (p) => NOMBRES[p] || null,
  suscripcion, activaFueraDe, estado, suscrito, activa, pagoMensual,
};
