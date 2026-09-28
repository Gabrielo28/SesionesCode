// Definición de los planes de Rubrofy. Cambiar precio o cuota acá no
// requiere tocar el resto del código — server.js y el panel solo leen esta
// tabla. El ID de precio de Stripe de cada plan pagado se configura por
// variable de entorno porque se crea en la cuenta de Stripe de cada
// despliegue (ver scripts/setup-stripe.js) — nunca se hardcodea acá.

// analitica: Resultados e informe mensual. ads / competencia: Meta Ads,
// Google Ads y seguimiento de competidores (pensados para un futuro plan
// Agencia; mientras no exista, van en Estudio).
// cuotaFotosIA / cuotaVideosIA: imágenes y videos con IA por mes (cuestan
// dinero real en Higgsfield u OpenAI: un video de 5 s ronda USD 0,5-1).
// cuotaTextosIA: cuántas piezas de texto puede escribir Claude por mes
// (generar + "otra versión"). Es un techo contra el abuso, no un límite que
// un negocio normal debiera tocar: ~150 piezas son varias veces lo que
// publica una pyme en un mes.
const PLANES = {
  // "Sin plan": Rubrofy es solo de pago. Es el estado de una cuenta sin
  // suscripción: puede configurar su negocio y elegir un plan, pero no
  // generar contenido.
  gratis: {
    id: 'gratis',
    nombre: 'Sin plan',
    precioClp: 0,
    usaIA: false,
    cuotaTextosIA: 0,
    cuotaFotosIA: 0,
    cuotaVideosIA: 0,
    analitica: false,
    ads: false,
    competencia: false,
    stripePriceEnv: null,
  },
  pro: {
    id: 'pro',
    nombre: 'Pro',
    precioClp: 19990,
    usaIA: true,
    cuotaTextosIA: 150,
    cuotaFotosIA: 0,
    cuotaVideosIA: 0,
    analitica: true,
    ads: false,
    competencia: false,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
  },
  estudio: {
    id: 'estudio',
    nombre: 'Estudio',
    precioClp: 39990,
    usaIA: true,
    cuotaTextosIA: 300,
    cuotaFotosIA: 20,
    cuotaVideosIA: 6,
    analitica: true,
    ads: true,
    competencia: true,
    stripePriceEnv: 'STRIPE_PRICE_ESTUDIO',
  },
};

function getPlan(id) {
  return PLANES[id] || PLANES.gratis;
}

// Precios y disponibilidad para mostrar en el sitio/panel — nunca incluye
// nada de Stripe (IDs de producto, claves) del lado del cliente.
function listPlanesPublico() {
  return Object.values(PLANES).filter((p) => p.id !== 'gratis').map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precioClp: p.precioClp,
    usaIA: p.usaIA,
    cuotaTextosIA: p.cuotaTextosIA,
    cuotaFotosIA: p.cuotaFotosIA,
    cuotaVideosIA: p.cuotaVideosIA,
    analitica: p.analitica,
    ads: p.ads,
    competencia: p.competencia,
    disponible: !!(process.env.STRIPE_SECRET_KEY && p.stripePriceEnv && process.env[p.stripePriceEnv]),
  }));
}

function stripePriceId(planId) {
  const plan = PLANES[planId];
  if (!plan || !plan.stripePriceEnv) return null;
  return process.env[plan.stripePriceEnv] || null;
}

// El plan pagado correspondiente a un price ID de Stripe, o null si no
// coincide con ninguno configurado (ej. un price viejo o de otro producto).
function planIdDesdePriceId(priceId) {
  for (const plan of Object.values(PLANES)) {
    if (plan.stripePriceEnv && priceId && process.env[plan.stripePriceEnv] === priceId) return plan.id;
  }
  return null;
}

module.exports = { PLANES, getPlan, listPlanesPublico, stripePriceId, planIdDesdePriceId };
