// Cliente mínimo de Stripe por REST — sin el SDK oficial, mismo criterio de
// cero dependencias del resto del proyecto. Usa Checkout (página alojada
// por Stripe) para cobrar la suscripción y el Billing Portal para que el
// negocio la gestione (cambiar tarjeta, cancelar) sin construir esa
// pantalla nosotros mismos.

const crypto = require('crypto');

const STRIPE_API = 'https://api.stripe.com/v1';

// Stripe espera application/x-www-form-urlencoded con notación de
// corchetes para objetos/arrays anidados (ej. line_items[0][price]=...).
function formBody(obj) {
  const params = new URLSearchParams();
  function walk(value, key) {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${key}[${i}]`));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, `${key}[${k}]`);
    } else {
      params.append(key, String(value));
    }
  }
  for (const [k, v] of Object.entries(obj)) walk(v, k);
  return params;
}

async function stripeFetch(path, body, method = 'POST') {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) return { error: 'Stripe no está configurado en este servidor' };
  try {
    const opciones = { method, headers: { authorization: `Bearer ${apiKey}` } };
    if (method !== 'GET') {
      opciones.headers['content-type'] = 'application/x-www-form-urlencoded';
      opciones.body = formBody(body || {});
    }
    const res = await fetch(`${STRIPE_API}${path}`, opciones);
    const data = await res.json();
    if (!res.ok) return { error: (data.error && data.error.message) || 'Error de Stripe' };
    return { data };
  } catch (err) {
    return { error: 'Error de red al conectar con Stripe: ' + err.message };
  }
}

async function crearCheckoutSession({ priceId, negocioId, planId, successUrl, cancelUrl, customerId, email }) {
  const body = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: negocioId,
    metadata: { negocioId, planId },
    subscription_data: { metadata: { negocioId, planId } },
  };
  if (customerId) body.customer = customerId;
  else if (email) body.customer_email = email;
  return stripeFetch('/checkout/sessions', body);
}

// Recarga: pago único (modo "payment"), con el precio armado aquí mismo
// (price_data): no hace falta crear productos en Stripe. CLP no tiene
// decimales, así que unit_amount va en pesos.
async function crearCheckoutPago({ nombre, precioClp, negocioId, recargaId, successUrl, cancelUrl, customerId, email }) {
  const body = {
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'clp', unit_amount: precioClp, product_data: { name: nombre } } }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: negocioId,
    metadata: { negocioId, recargaId, tipo: 'recarga' },
    payment_intent_data: { metadata: { negocioId, recargaId, tipo: 'recarga' } },
  };
  if (customerId) body.customer = customerId;
  else if (email) body.customer_email = email;
  return stripeFetch('/checkout/sessions', body);
}

async function crearPortalSession({ customerId, returnUrl }) {
  return stripeFetch('/billing_portal/sessions', { customer: customerId, return_url: returnUrl });
}

async function obtenerSuscripcion(subscriptionId) {
  return stripeFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}`, null, 'GET');
}

// Cambio de plan de un negocio que YA tiene suscripción: se cambia el precio
// de esa misma suscripción (con prorrateo) en vez de abrir un Checkout
// nuevo, que crearía una segunda suscripción cobrando en paralelo.
async function cambiarPrecioSuscripcion({ subscriptionId, itemId, priceId, planId }) {
  return stripeFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: 'create_prorations',
    metadata: { planId },
  });
}

// Al eliminar una cuenta con una suscripción activa hay que cancelarla en
// Stripe también — si no, el negocio sigue pagando para siempre aunque ya
// no exista en Rubrofy. Best-effort: un fallo acá no debe bloquear el
// borrado de la cuenta (el dueño puede cancelarla igual desde el Billing
// Portal si esta llamada falla).
async function cancelarSuscripcion(subscriptionId) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey || !subscriptionId) return { error: null };
  try {
    const res = await fetch(`${STRIPE_API}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    if (!res.ok) return { error: (data.error && data.error.message) || 'Error de Stripe' };
    return { data };
  } catch (err) {
    return { error: 'Error de red al conectar con Stripe: ' + err.message };
  }
}

// Firma HMAC del webhook, formato "t=<epoch>,v1=<hmac hex>". Verifica sin
// el SDK: recalcula el HMAC sobre "timestamp.cuerpo_crudo" y lo compara en
// tiempo constante; rechaza timestamps viejos (protección de repetición).
function verificarFirmaWebhook(payloadRaw, header, secret, toleranciaSeg = 300) {
  if (!header || !secret) return false;
  const partes = {};
  for (const par of header.split(',')) {
    const idx = par.indexOf('=');
    if (idx === -1) continue;
    partes[par.slice(0, idx)] = par.slice(idx + 1);
  }
  const t = partes.t;
  const v1 = partes.v1;
  if (!t || !v1 || !/^[0-9]+$/.test(t) || !/^[a-f0-9]+$/.test(v1)) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranciaSeg) return false;

  const esperada = crypto.createHmac('sha256', secret).update(`${t}.${payloadRaw}`).digest('hex');
  const a = Buffer.from(esperada, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  crearCheckoutSession, crearCheckoutPago, crearPortalSession, obtenerSuscripcion, cambiarPrecioSuscripcion,
  cancelarSuscripcion, verificarFirmaWebhook,
};
