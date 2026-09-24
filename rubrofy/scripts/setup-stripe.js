// Crea en Stripe los productos y precios de los planes pagados de Rubrofy
// (ver server/planes.js) y muestra los IDs de precio para copiar como
// variables de entorno. Se corre una sola vez por cuenta de Stripe (o de
// nuevo en modo live cuando se pase de pruebas a producción).
//
// Uso:
//   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.js
//
// No modifica nada del código ni de los datos de Rubrofy — solo llama a la
// API de Stripe para crear el catálogo de precios.

const { PLANES } = require('../server/planes');

const STRIPE_API = 'https://api.stripe.com/v1';

async function stripePost(path, body) {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || 'Error de Stripe');
  return data;
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('Falta STRIPE_SECRET_KEY. Uso: STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.js');
    process.exit(1);
  }

  const planesPagados = Object.values(PLANES).filter((p) => p.stripePriceEnv);
  console.log(`Creando ${planesPagados.length} planes en Stripe...\n`);

  const resultados = [];
  for (const plan of planesPagados) {
    const producto = await stripePost('/products', { name: `Rubrofy — ${plan.nombre}` });
    const precio = await stripePost('/prices', {
      product: producto.id,
      currency: 'clp',
      unit_amount: plan.precioClp,
      'recurring[interval]': 'month',
    });
    resultados.push({ plan, precio });
    console.log(`${plan.nombre}: producto ${producto.id}, precio ${precio.id}`);
  }

  console.log('\nAgrega esto a tus variables de entorno:\n');
  for (const { plan, precio } of resultados) {
    console.log(`${plan.stripePriceEnv}=${precio.id}`);
  }
  console.log('\nY configura el endpoint de webhook en el Dashboard de Stripe apuntando a:');
  console.log('  https://tu-dominio.com/api/stripe/webhook');
  console.log('con los eventos: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted.');
  console.log('El "Signing secret" que te muestre ahí va en STRIPE_WEBHOOK_SECRET.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
