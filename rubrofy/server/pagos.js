// Con qué se cobra y en qué estado está la suscripción de un negocio, sin
// importar si es Flow o Stripe. Si Flow está configurado (FLOW_API_KEY y
// FLOW_SECRET_KEY), se cobra con Flow; si no, con Stripe, si está.
const flow = require('./flow');

const NOMBRES = { flow: 'Flow', stripe: 'Stripe' };

function proveedor() {
  if (flow.configurado()) return 'flow';
  if (process.env.STRIPE_SECRET_KEY) return 'stripe';
  return null;
}

// La suscripción que el negocio sigue (la de Flow manda si tiene ambas).
function suscripcion(negocio) {
  if (negocio.flow && negocio.flow.subscriptionId) return Object.assign({ proveedor: 'flow' }, negocio.flow);
  if (negocio.stripe && negocio.stripe.subscriptionId) return Object.assign({ proveedor: 'stripe' }, negocio.stripe);
  return null;
}

function estado(negocio) {
  const s = suscripcion(negocio);
  return s ? s.estado || null : null;
}

// Tiene una suscripción que sigue viva (incluye un cobro atrasado).
function suscrito(negocio) {
  return ['active', 'trialing', 'past_due'].includes(estado(negocio));
}

// Tiene una suscripción al día.
function activa(negocio) {
  return ['active', 'trialing'].includes(estado(negocio));
}

// Lo que el negocio paga de verdad al mes (CLP), para los ingresos de /admin:
// 0 sin una suscripción al día (prueba gratis, plan de regalo, cortesía o
// cobro cancelado). Con Flow manda el último cobro pagado, que ya trae el
// descuento; sin cobros todavía, el precio del plan menos el código vigente.
function pagoMensual(negocio, ahora = Date.now()) {
  const beneficios = require('./beneficios');
  if (negocio.cortesia || beneficios.regaloVigente(negocio, ahora) || !activa(negocio)) return 0;
  const pagados = ((negocio.flow && negocio.flow.cobros) || []).filter((c) => c.estado === 'pagado' && c.monto > 0)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  // Con pago anual, lo que corresponde a un mes.
  const anual = negocio.flow && negocio.flow.periodo === 'anual';
  if (pagados.length) return anual ? Math.round(pagados[pagados.length - 1].monto / 12) : pagados[pagados.length - 1].monto;
  const planes = require('./planes');
  const plan = planes.getPlan(negocio.plan);
  if (anual) return Math.round(planes.precioAnual(plan) / 12);
  return beneficios.precioConDescuento(plan.precioClp || 0, beneficios.descuentoVigente(negocio.id, plan.id, ahora));
}

module.exports = { proveedor, nombre: (p) => NOMBRES[p] || null, suscripcion, estado, suscrito, activa, pagoMensual };
