// Cliente mínimo de Mercado Pago por REST, sin SDK: mismo criterio de cero
// dependencias del resto del proyecto. Referencia:
// https://www.mercadopago.cl/developers/es/docs/subscriptions/overview
//
// Cómo cobra Rubrofy con Mercado Pago (se ofrece junto a Flow; el negocio
// elige con cuál pagar):
// - Planes: una suscripción sin plan asociado (POST /preapproval) con estado
//   "pending". El negocio va a init_point, paga con su cuenta de Mercado Pago
//   o con tarjeta, y Mercado Pago cobra solo cada mes (o cada año).
// - Recargas: un pago único con Checkout Pro (POST /checkout/preferences).
//
// Como con Flow, nada se da por pagado según lo que diga un aviso: el aviso
// solo trae un id y con él se le pregunta a Mercado Pago el estado real (por
// eso no hace falta verificar su firma).

const crypto = require('crypto');

const API = 'https://api.mercadopago.com';

function configurado() {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN;
}

// 'prueba' (credenciales de prueba o MERCADOPAGO_PRUEBA=1) o 'produccion'.
// Las suscripciones y pagos de un ambiente no existen en el otro.
function entorno() {
  const token = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '');
  return process.env.MERCADOPAGO_PRUEBA === '1' || token.startsWith('TEST-') ? 'prueba' : 'produccion';
}

async function llamar(metodo, ruta, cuerpo) {
  if (!configurado()) return { error: 'Mercado Pago no está configurado en este servidor' };
  const headers = { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` };
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  // Un POST repetido por un reintento de red no crea dos suscripciones.
  if (metodo === 'POST') headers['X-Idempotency-Key'] = crypto.randomUUID();
  try {
    const res = await fetch(API + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
    const texto = await res.text();
    let data;
    try { data = JSON.parse(texto); } catch (e) { data = null; }
    if (!res.ok || !data) {
      // Credenciales malas o Mercado Pago caído: se avisa al equipo (un rechazo normal, no).
      if (res.status >= 500 || res.status === 401) require('./alertas').alertar('mercadopago', 'Mercado Pago está fallando', `${metodo} ${ruta} respondió ${res.status}${data && data.message ? ': ' + data.message : ''}. Revisa MERCADOPAGO_ACCESS_TOKEN o el estado de Mercado Pago.`);
      return { error: (data && (data.message || data.error)) || `Error de Mercado Pago (${res.status})`, status: res.status };
    }
    return { data };
  } catch (err) {
    require('./alertas').alertar('mercadopago', 'No se puede conectar con Mercado Pago', `${metodo} ${ruta}: ${err.message}`);
    return { error: 'Error de red al conectar con Mercado Pago: ' + err.message };
  }
}

// --- Suscripciones (preapproval) ---
// periodo: 'mensual' o 'anual'. inicio: fecha ISO desde la que cobra (para
// pasar de mensual a anual sin cobrar dos veces el mismo período).
function crearSuscripcion({ motivo, referencia, email, monto, periodo, urlRetorno, inicio }) {
  const auto = { frequency: periodo === 'anual' ? 12 : 1, frequency_type: 'months', transaction_amount: monto, currency_id: 'CLP' };
  if (inicio) {
    // start_date solo se respeta junto a end_date.
    const fin = new Date(inicio);
    fin.setUTCFullYear(fin.getUTCFullYear() + 10);
    Object.assign(auto, { start_date: new Date(inicio).toISOString(), end_date: fin.toISOString() });
  }
  return llamar('POST', '/preapproval', {
    reason: motivo, external_reference: referencia, payer_email: email,
    auto_recurring: auto, back_url: urlRetorno, status: 'pending',
  });
}
function obtenerSuscripcion(id) {
  return llamar('GET', `/preapproval/${encodeURIComponent(id)}`);
}
// cambios: { status, reason, external_reference, auto_recurring: { transaction_amount, currency_id } }
function actualizarSuscripcion(id, cambios) {
  return llamar('PUT', `/preapproval/${encodeURIComponent(id)}`, cambios);
}
// Los cobros (cuotas) de una suscripción.
function cobrosDe(id) {
  return llamar('GET', `/authorized_payments/search?preapproval_id=${encodeURIComponent(id)}&limit=50`);
}
function obtenerCobro(id) {
  return llamar('GET', `/authorized_payments/${encodeURIComponent(id)}`);
}

// Traduce una suscripción de Mercado Pago al vocabulario de Rubrofy (el
// mismo de Flow y Stripe): active, past_due, paused, canceled, incomplete.
//   status: pending (sin medio de pago) · authorized · paused · canceled
//   summarized.semaphore: green al día · yellow reintentando · red con cobros vencidos
function estadoSuscripcion(pre) {
  const st = String(pre.status || '');
  if (st === 'canceled' || st === 'cancelled') return 'canceled';
  if (st === 'paused') return 'paused';
  if (st !== 'authorized') return 'incomplete';
  const semaforo = pre.summarized && pre.summarized.semaphore;
  return semaforo === 'red' ? 'past_due' : 'active';
}

// --- Pagos únicos (recargas) con Checkout Pro ---
// Devuelve { id, init_point }.
function crearPreferencia({ id, titulo, monto, email, referencia, urlRetorno, urlAviso }) {
  return llamar('POST', '/checkout/preferences', {
    items: [{ id, title: titulo, quantity: 1, unit_price: monto, currency_id: 'CLP' }],
    payer: email ? { email } : undefined,
    external_reference: referencia,
    back_urls: { success: urlRetorno, failure: urlRetorno, pending: urlRetorno },
    auto_return: 'approved',
    notification_url: urlAviso,
    statement_descriptor: 'RUBROFY',
  });
}
//   status: approved · pending · in_process · rejected · cancelled · refunded · charged_back
function obtenerPago(id) {
  return llamar('GET', `/v1/payments/${encodeURIComponent(id)}`);
}

module.exports = {
  configurado, entorno,
  crearSuscripcion, obtenerSuscripcion, actualizarSuscripcion, cobrosDe, obtenerCobro, estadoSuscripcion,
  crearPreferencia, obtenerPago,
};
