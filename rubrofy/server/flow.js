// Cliente mínimo de Flow (flow.cl) por REST, sin SDK: mismo criterio de cero
// dependencias del resto del proyecto. Referencia: https://www.flow.cl/docs/api.html
//
// Cómo cobra Rubrofy con Flow:
// - Planes mensuales: el negocio es un "cliente" de Flow, registra su tarjeta
//   en la página de Flow y queda suscrito a un "plan" de Flow que cobra solo
//   cada mes. Los planes de Flow se crean solos la primera vez (ids
//   rubrofy-pro-19990, etc.: si cambia el precio, se crea otro plan).
// - Recargas: un pago único (payment/create) que Flow confirma a
//   urlConfirmation.
//
// Flow no firma sus avisos: manda un token y quien lo recibe le pregunta a
// Flow el resultado con la API (firmada con la clave secreta). Por eso aquí
// nada se da por pagado según lo que diga un aviso, siempre se consulta.

const crypto = require('crypto');

const API = {
  produccion: 'https://www.flow.cl/api',
  sandbox: 'https://sandbox.flow.cl/api',
};

function configurado() {
  return !!(process.env.FLOW_API_KEY && process.env.FLOW_SECRET_KEY);
}

function base() {
  return process.env.FLOW_SANDBOX === '1' ? API.sandbox : API.produccion;
}

// 'sandbox' o 'produccion'. Los clientes, suscripciones y cupones de un
// ambiente no existen en el otro: se guarda en cuál se crearon.
function entorno() {
  return process.env.FLOW_SANDBOX === '1' ? 'sandbox' : 'produccion';
}

// Firma: parámetros ordenados por nombre, concatenados nombre+valor, HMAC
// SHA-256 con la clave secreta (sin el parámetro s).
function firmar(params, secreto) {
  const texto = Object.keys(params).filter((k) => k !== 's').sort().map((k) => k + params[k]).join('');
  return crypto.createHmac('sha256', secreto).update(texto).digest('hex');
}

async function llamar(metodo, ruta, datos) {
  if (!configurado()) return { error: 'Flow no está configurado en este servidor' };
  const params = { apiKey: process.env.FLOW_API_KEY };
  for (const [k, v] of Object.entries(datos || {})) {
    if (v !== undefined && v !== null && v !== '') params[k] = String(v);
  }
  params.s = firmar(params, process.env.FLOW_SECRET_KEY);
  const cuerpo = new URLSearchParams(params);
  try {
    const res = metodo === 'GET'
      ? await fetch(`${base()}${ruta}?${cuerpo}`)
      : await fetch(`${base()}${ruta}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: cuerpo });
    const texto = await res.text();
    let data;
    try { data = JSON.parse(texto); } catch (e) { data = null; }
    if (!res.ok || !data) {
      // Llaves malas o Flow caído: se avisa al equipo (los rechazos normales, como un cupón inválido, no).
      if (res.status >= 500 || res.status === 401) require('./alertas').alertar('flow', 'Flow está fallando', `${metodo} ${ruta} respondió ${res.status}${data && data.message ? ': ' + data.message : ''}. Revisa FLOW_API_KEY y FLOW_SECRET_KEY o el estado de Flow.`);
      return { error: (data && data.message) || `Error de Flow (${res.status})`, codigo: data && data.code, status: res.status };
    }
    return { data };
  } catch (err) {
    require('./alertas').alertar('flow', 'No se puede conectar con Flow', `${metodo} ${ruta}: ${err.message}`);
    return { error: 'Error de red al conectar con Flow: ' + err.message };
  }
}

// --- Planes ---
// El plan de Flow que corresponde a un plan de Rubrofy a su precio actual.
// periodo: 'mensual' (por omisión) o 'anual' (12 meses por el precio de 10).
function idPlan(plan, periodo) {
  if (periodo === 'anual') return `rubrofy-${plan.id}-anual-${require('./planes').precioAnual(plan)}`;
  return `rubrofy-${plan.id}-${plan.precioClp}`;
}

const planesListos = new Map();
async function asegurarPlan(plan, urlCallback, periodo) {
  const id = idPlan(plan, periodo);
  const anual = periodo === 'anual';
  if (planesListos.has(id)) return { data: { planId: id } };
  const existe = await llamar('GET', '/plans/get', { planId: id });
  if (!existe.error && Number(existe.data.status) !== 0) {
    planesListos.set(id, true);
    return { data: existe.data };
  }
  const creado = await llamar('POST', '/plans/create', {
    planId: id, name: `Rubrofy ${plan.nombre}${anual ? ' anual' : ''}`, currency: 'CLP', amount: anual ? require('./planes').precioAnual(plan) : plan.precioClp,
    interval: anual ? 4 : 3, interval_count: 1, urlCallback,
  });
  if (creado.error) return creado;
  planesListos.set(id, true);
  return creado;
}

// --- Clientes y tarjeta ---
function crearCliente({ nombre, email, negocioId }) {
  return llamar('POST', '/customer/create', { name: nombre, email, externalId: negocioId });
}
// Devuelve { url, token }: el negocio va a url + '?token=' + token.
function registrarTarjeta({ customerId, urlRetorno }) {
  return llamar('POST', '/customer/register', { customerId, url_return: urlRetorno });
}
function estadoRegistro(token) {
  return llamar('GET', '/customer/getRegisterStatus', { token });
}

// --- Suscripciones ---
function crearSuscripcion({ planId, customerId, couponId }) {
  return llamar('POST', '/subscription/create', { planId, customerId, couponId });
}
function agregarCupon({ subscriptionId, couponId }) {
  return llamar('POST', '/subscription/addCoupon', { subscriptionId, couponId });
}

// --- Cupones de descuento (los códigos de /admin → Beneficios) ---
// porcentaje (1-100) o monto en pesos; meses: 0 = mientras dure la suscripción.
function crearCupon({ nombre, porcentaje, monto, meses }) {
  const datos = { name: nombre, duration: meses > 0 ? 1 : 0, times: meses > 0 ? meses : undefined };
  if (porcentaje) datos.percent_off = porcentaje;
  else Object.assign(datos, { amount: monto, currency: 'CLP' });
  return llamar('POST', '/coupon/create', datos);
}
function obtenerSuscripcion(subscriptionId) {
  return llamar('GET', '/subscription/get', { subscriptionId });
}
function cancelarSuscripcion(subscriptionId, alFinalDelPeriodo) {
  return llamar('POST', '/subscription/cancel', { subscriptionId, at_period_end: alFinalDelPeriodo ? 1 : 0 });
}
// Cambio de plan desde hoy (Flow calcula el saldo del período en curso).
function cambiarPlan({ subscriptionId, planId }) {
  return llamar('POST', '/subscription/changePlan', { subscriptionId, newPlanId: planId, startDateOfNewPlan: new Date().toISOString().slice(0, 10) });
}

// Traduce una suscripción de Flow al vocabulario que ya usa Rubrofy
// (el mismo de Stripe: active, trialing, past_due, canceled, incomplete).
//   status: 0 no iniciada · 1 activa · 2 en trial · 4 cancelada
//   morose: 0 al día · 1 algún cobro vencido · 2 cobro pendiente sin vencer
function estadoSuscripcion(sub) {
  const status = Number(sub.status);
  if (status === 4) return 'canceled';
  if (status === 0) return 'incomplete';
  if (Number(sub.morose) === 1) return 'past_due';
  return status === 2 ? 'trialing' : 'active';
}

// --- Pagos únicos (recargas) ---
// Devuelve { url, token, flowOrder }: el pagador va a url + '?token=' + token.
function crearPago({ orden, asunto, monto, email, urlConfirmacion, urlRetorno }) {
  return llamar('POST', '/payment/create', {
    commerceOrder: orden, subject: asunto, currency: 'CLP', amount: monto, email,
    urlConfirmation: urlConfirmacion, urlReturn: urlRetorno,
  });
}
//   status: 1 pendiente · 2 pagado · 3 rechazado · 4 anulado
function estadoPago(token) {
  return llamar('GET', '/payment/getStatus', { token });
}

module.exports = {
  configurado, entorno, firmar, idPlan, asegurarPlan,
  crearCliente, registrarTarjeta, estadoRegistro,
  crearSuscripcion, agregarCupon, crearCupon, obtenerSuscripcion, cancelarSuscripcion, cambiarPlan, estadoSuscripcion,
  crearPago, estadoPago,
};
