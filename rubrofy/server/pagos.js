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

module.exports = { proveedor, nombre: (p) => NOMBRES[p] || null, suscripcion, estado, suscrito, activa };
