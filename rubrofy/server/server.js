// Servidor de Rubrofy. Node puro, sin dependencias externas
// (mismo criterio que colchones-yole): un archivo sirve la web y la API.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const store = require('./store');
const auth = require('./auth');
const { generarEstrategia } = require('./estrategia');
const { generarBanco, generarVarianteConClaude } = require('./generator');
const { crearPublicador } = require('./publicador');
const programacion = require('./programacion');
const { generarImagenIA } = require('./imagenes');
const { getPlan, listPlanesPublico, stripePriceId, planIdDesdePriceId } = require('./planes');
const stripe = require('./stripe');
const { crearLimitador, ipCliente } = require('./limites');

const PORT = process.env.PORT || 5180;
const SITE_DIR = path.join(__dirname, '..', 'public', 'site');
const APP_DIR = path.join(__dirname, '..', 'public', 'app');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Máximo de piezas por cada "generar" — el panel pide 6; esto evita que una
// llamada directa a la API pida miles de una vez.
const MAX_PIEZAS_POR_GENERACION = 12;

// Registro: cada uno llama a Claude, así que se limita por IP. Login: solo
// cuentan los intentos fallidos, para no molestar a quien entra bien.
const limiteRegistro = crearLimitador({ max: 5, ventanaMs: 60 * 60 * 1000 });
const limiteLoginFallido = crearLimitador({ max: 10, ventanaMs: 15 * 60 * 1000 });

// Estados de una suscripción de Stripe que ya terminó: solo en ese caso un
// cambio de plan puede abrir un Checkout nuevo sin duplicar el cobro.
const SUSCRIPCION_TERMINADA = new Set(['canceled', 'incomplete_expired']);

// El acceso es self-service: cada negocio es su propia cuenta (email +
// clave), no hay una clave maestra que vea todos los negocios juntos.
function sesionActual(req) {
  return auth.verificarSesion(auth.leerCookie(req, 'rubrofy_sesion'));
}

function noAutorizado(res) {
  sendJSON(res, 401, { error: 'No autorizado' });
}

// Sesión por cookie (en vez de Basic Auth) tiene el mismo problema de CSRF:
// el navegador la reenvía sola a cualquier origen. Un <form> ajeno no puede
// agregar esta cabecera custom ni mandar JSON, así que exigir ambas bloquea
// esa clase de ataque en toda mutación bajo /api.
const CSRF_HEADER = 'x-rubrofy-panel';

function peticionLegitima(req) {
  if (req.headers[CSRF_HEADER] !== '1') return false;
  if (req.method === 'POST' || req.method === 'PUT') {
    const tipo = (req.headers['content-type'] || '').split(';')[0].trim();
    if (tipo !== 'application/json') return false;
  }
  return true;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const FOTO_EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ESTILOS_IMAGEN = ['limpia', 'texto'];

function slugify(str) {
  const base = String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return base || 'negocio';
}

function idUnico(base) {
  let id = base;
  let n = 2;
  while (store.getNegocio(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function sendJSON(res, status, data, extraHeaders) {
  const body = JSON.stringify(data);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
  }, extraHeaders));
  res.end(body);
}

// Datos públicos de un negocio (nunca la clave, el token de Instagram, ni
// los IDs internos de Stripe).
function negocioPublico(negocio) {
  const { auth: _auth, instagram, stripe: stripeInfo, ...resto } = negocio;
  resto.instagramConectado = !!(instagram && instagram.accessToken);
  // 'ok' | 'reconectar' (el token venció o fue revocado: las publicaciones
  // programadas esperan hasta que se reconecte).
  resto.instagramEstado = instagram && instagram.accessToken ? (instagram.estado || 'ok') : null;
  resto.instagramMotivoReconexion = (instagram && instagram.motivoReconexion) || null;
  resto.instagramVenceEl = (instagram && instagram.venceEl) || null;
  resto.zonaHoraria = programacion.ZONA;
  resto.plan = negocio.plan || 'gratis';
  resto.tieneSuscripcionStripe = !!(stripeInfo && stripeInfo.customerId);
  resto.fotosIADisponibles = fotosIADisponibles(negocio);
  resto.textosIADisponibles = textosIADisponibles(negocio);
  return resto;
}

// URL absoluta y pública del propio servidor, para construir el enlace que
// Instagram usa para descargar una foto al publicar. Usa PUBLIC_URL si está
// configurada (recomendado en producción); si no, la deduce del request.
function urlBase(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

function buscarNegocioPorEmail(email) {
  const buscado = String(email || '').trim().toLowerCase();
  return store.listNegocios().find((n) => n.email === buscado) || null;
}

function notFound(res) {
  sendJSON(res, 404, { error: 'No encontrado' });
}

function readBody(req, maxBytes) {
  const limit = maxBytes || 1e6;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, baseDir, rel) {
  const relLimpio = rel === '' || rel === '/' ? '/index.html' : rel;
  const filePath = path.join(baseDir, relLimpio);
  if (!filePath.startsWith(baseDir)) return notFound(res);

  fs.readFile(filePath, (err, content) => {
    if (err) return notFound(res);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(content);
  });
}

function encontrarItem(items, itemId) {
  return items.find((it) => it.id === itemId);
}

// Mismo criterio anti-repetición que usa el panel (public/app/app.js) para
// repartir varias fotos de una categoría entre distintas piezas de contenido.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function elegirFoto(negocioId, categoria, itemId) {
  const disponibles = (store.listFotos(negocioId)[categoria]) || [];
  if (!disponibles.length) return null;
  return disponibles[hashString(itemId) % disponibles.length];
}

// Cuotas mensuales de IA (fotos y textos, las trae el plan del negocio, ver
// server/planes.js). Se resetean solas cada mes calendario — no hay cron ni
// tarea de fondo, solo se compara contra el mes guardado la próxima vez que
// se usan.
function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function usoDelMes(negocio, campo) {
  const uso = negocio[campo];
  return uso && uso.mes === mesActual() ? uso.cantidad : 0;
}

function fotosIADisponibles(negocio) {
  const cuota = getPlan(negocio.plan).cuotaFotosIA;
  if (!cuota) return 0;
  return Math.max(0, cuota - usoDelMes(negocio, 'usoFotosIA'));
}

function textosIADisponibles(negocio) {
  const cuota = getPlan(negocio.plan).cuotaTextosIA;
  if (!cuota) return 0;
  return Math.max(0, cuota - usoDelMes(negocio, 'usoTextosIA'));
}

// Registra el uso sobre el negocio recién leído de disco, no sobre el objeto
// que el request cargó al empezar: entre medio hubo una llamada larga a una
// API (Claude, imágenes, Instagram) y otro request — por ejemplo el webhook
// de Stripe cambiando el plan — pudo guardar cambios que no hay que pisar.
function registrarUsoIA(negocioId, campo, cantidad) {
  if (!cantidad) return;
  const fresco = store.getNegocio(negocioId);
  if (!fresco) return;
  const mes = mesActual();
  if (!fresco[campo] || fresco[campo].mes !== mes) fresco[campo] = { mes, cantidad: 0 };
  fresco[campo].cantidad += cantidad;
  store.saveNegocio(fresco);
}

function buscarNegocioPorStripeCustomerId(customerId) {
  return store.listNegocios().find((n) => n.stripe && n.stripe.customerId === customerId) || null;
}

function buscarNegocioPorStripeSubscriptionId(subscriptionId) {
  return store.listNegocios().find((n) => n.stripe && n.stripe.subscriptionId === subscriptionId) || null;
}

// Lo que el publicador (server/publicador.js) necesita para crear el post:
// la foto de la pieza (real, o generada por IA como respaldo) expuesta con un
// enlace temporal firmado que Instagram pueda descargar, y el caption. Si no
// hay foto, devuelve { motivo } y la pieza queda fallida hasta que se suba
// una y se reintente.
async function prepararPublicacion(negocio, item) {
  let categoria = item.categoriaFoto;
  let archivo = categoria ? elegirFoto(negocio.id, categoria, item.id) : null;
  let generadaPorIA = false;

  if (!archivo && process.env.OPENAI_API_KEY) {
    if (!store.tieneFotoIA(negocio.id, item.id) && fotosIADisponibles(negocio) > 0) {
      const buffer = await generarImagenIA({ negocio, item, incluirTexto: negocio.estiloImagen === 'texto' });
      if (buffer) {
        store.guardarFotoIA(negocio.id, item.id, buffer);
        registrarUsoIA(negocio.id, 'usoFotosIA', 1);
      }
    }
    if (store.tieneFotoIA(negocio.id, item.id)) {
      categoria = '_ia';
      archivo = item.id + '.png';
      generadaPorIA = true;
    }
  }

  if (!archivo) {
    return { motivo: 'Esta pieza no tiene foto. Sube una en Fotos y usa "Reintentar".' };
  }

  // El publicador corre sin un request a mano: usa PUBLIC_URL, o la URL
  // desde la que se aprobó la pieza.
  const base = process.env.PUBLIC_URL
    ? process.env.PUBLIC_URL.replace(/\/$/, '')
    : item.publicacion && item.publicacion.urlBase;
  if (!base) return { motivo: 'Falta configurar PUBLIC_URL en el servidor' };

  const token = auth.crearTokenFoto(negocio.id, categoria, archivo);
  return {
    imageUrl: `${base}/fotos/${negocio.id}/${categoria}/${archivo}?t=${token}`,
    caption: item.variants[item.variantIndex],
    generadaPorIA,
  };
}

const publicador = crearPublicador({
  prepararPublicacion,
  intervaloMs: (Number(process.env.PUBLICADOR_INTERVALO_SEG) || 30) * 1000,
});

// Deja una pieza aprobada lista para que el publicador la publique en
// `cuando` (ISO), sin perder el contenedor ya creado si lo había.
function programar(it, cuando, req) {
  it.publicacion = Object.assign({}, it.publicacion, {
    estado: 'programada',
    intentos: 0,
    proximoIntento: cuando,
    urlBase: urlBase(req),
  });
  delete it.publicacion.motivo;
  delete it.publicacion.ultimoError;
  delete it.instagram;
}

function maxISO(a, b) {
  return Date.parse(a) > Date.parse(b) ? a : b;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean);

  // El webhook de Stripe es una mutación legítima que no viene del panel
  // (no puede llevar la cabecera custom): se autentica con su propia firma
  // HMAC en vez del esquema anti-CSRF de /api.
  const esWebhookStripe = parts[0] === 'api' && parts[1] === 'stripe' && parts[2] === 'webhook';

  const mutando = req.method !== 'GET' && req.method !== 'HEAD';
  if (parts[0] === 'api' && mutando && !esWebhookStripe && !peticionLegitima(req)) {
    return sendJSON(res, 403, { error: 'Solicitud rechazada' });
  }

  try {
    // --- API ---
    if (parts[0] === 'api') {
      // POST /api/stripe/webhook — eventos de Stripe (checkout completado,
      // suscripción actualizada/cancelada). Necesita el cuerpo crudo exacto
      // para verificar la firma, así que no pasa por readBody (que ya
      // parsea a JSON).
      if (esWebhookStripe && req.method === 'POST') {
        const raw = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
        const firmaOk = stripe.verificarFirmaWebhook(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
        if (!firmaOk) return sendJSON(res, 400, { error: 'Firma inválida' });

        let evento;
        try {
          evento = JSON.parse(raw);
        } catch (err) {
          return sendJSON(res, 400, { error: 'JSON inválido' });
        }

        if (evento.type === 'checkout.session.completed') {
          const session = evento.data.object;
          const negocioId = session.client_reference_id || (session.metadata && session.metadata.negocioId);
          const planId = session.metadata && session.metadata.planId;
          let negocio = negocioId && store.getNegocio(negocioId);
          const anterior = negocio && negocio.stripe && negocio.stripe.subscriptionId;
          if (negocio && planId && anterior && anterior !== session.subscription) {
            // El negocio ya sigue otra suscripción. Dos casos:
            // - Se pagaron dos Checkouts a la vez: la nueva está activa y la
            //   anterior se cancela, o quedaría huérfana cobrando para siempre.
            // - Stripe reintenta un evento viejo: la suscripción del evento ya
            //   no está activa y se ignora, para no cancelar la vigente.
            const nueva = await stripe.obtenerSuscripcion(session.subscription);
            if (nueva.error) return sendJSON(res, 500, { error: 'No se pudo verificar la suscripción' }); // Stripe reintenta
            if (SUSCRIPCION_TERMINADA.has(nueva.data.status)) return sendJSON(res, 200, { recibido: true });
            await stripe.cancelarSuscripcion(anterior);
            negocio = store.getNegocio(negocioId); // releído después de esperar a Stripe
          }
          if (negocio && planId) {
            negocio.stripe = {
              customerId: session.customer,
              subscriptionId: session.subscription,
              estado: 'active',
            };
            negocio.plan = planId;
            store.saveNegocio(negocio);
          }
        } else if (evento.type === 'customer.subscription.updated' || evento.type === 'customer.subscription.deleted') {
          const sub = evento.data.object;
          const negocio = buscarNegocioPorStripeSubscriptionId(sub.id) || buscarNegocioPorStripeCustomerId(sub.customer);
          // Un evento de una suscripción que no es la que el negocio sigue (por
          // ejemplo la anterior, recién cancelada) no debe cambiarle el plan.
          const esOtraSuscripcion = negocio && negocio.stripe && negocio.stripe.subscriptionId
            && negocio.stripe.subscriptionId !== sub.id;
          if (negocio && !esOtraSuscripcion) {
            const activa = sub.status === 'active' || sub.status === 'trialing';
            const priceId = sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].price && sub.items.data[0].price.id;
            negocio.stripe = {
              customerId: sub.customer,
              subscriptionId: sub.id,
              estado: sub.status,
            };
            negocio.plan = activa ? (planIdDesdePriceId(priceId) || negocio.plan || 'gratis') : 'gratis';
            store.saveNegocio(negocio);
          }
        }

        return sendJSON(res, 200, { recibido: true });
      }

      // GET /api/planes — pública: la necesita el sitio y el panel para mostrar precios.
      if (parts[1] === 'planes' && parts.length === 2 && req.method === 'GET') {
        return sendJSON(res, 200, listPlanesPublico());
      }

      // POST /api/auth/registro  { nombre, rubro, email, password, datos }
      if (parts[1] === 'auth' && parts[2] === 'registro' && parts.length === 3 && req.method === 'POST') {
        const ip = ipCliente(req);
        const esperaRegistro = limiteRegistro.esperaSegundos(ip);
        if (esperaRegistro) {
          return sendJSON(res, 429, { error: 'Demasiados registros desde esta conexión. Intenta más tarde.' }, { 'Retry-After': String(esperaRegistro) });
        }
        limiteRegistro.registrar(ip);
        const body = await readBody(req);
        const nombre = (body.nombre || '').trim();
        const rubro = String(body.rubro || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!nombre) return sendJSON(res, 400, { error: 'Falta el nombre del negocio' });
        if (!rubro) return sendJSON(res, 400, { error: 'Falta describir el rubro del negocio' });
        if (rubro.length > 300) return sendJSON(res, 400, { error: 'La descripción del rubro es muy larga' });
        if (!EMAIL_RE.test(email)) return sendJSON(res, 400, { error: 'Email inválido' });
        if (password.length < 8) return sendJSON(res, 400, { error: 'La clave debe tener al menos 8 caracteres' });
        if (buscarNegocioPorEmail(email)) return sendJSON(res, 409, { error: 'Ya existe una cuenta con ese email' });

        const id = idUnico(slugify(nombre));
        const estrategia = await generarEstrategia({ nombre, rubro });
        const negocio = {
          id,
          nombre,
          estrategia,
          email,
          auth: auth.hashPassword(password),
          marca: { color: '#e6a23a' },
          plan: 'gratis',
          estiloImagen: 'limpia',
          datos: {
            precioDesde: body.datos && body.datos.precioDesde ? String(body.datos.precioDesde).trim() : '',
            unidad: body.datos && body.datos.unidad ? String(body.datos.unidad).trim() : '',
            promo: body.datos && body.datos.promo ? String(body.datos.promo).trim() : '',
            productoDestacado: body.datos && body.datos.productoDestacado ? String(body.datos.productoDestacado).trim() : '',
          },
        };
        store.saveNegocio(negocio);
        store.saveContenido(id, await generarBanco(negocio, 6, 0));
        const cookie = auth.cookieSesion(req, auth.crearSesion(id));
        return sendJSON(res, 201, negocioPublico(negocio), { 'Set-Cookie': cookie });
      }

      // POST /api/auth/login  { email, password }
      if (parts[1] === 'auth' && parts[2] === 'login' && parts.length === 3 && req.method === 'POST') {
        const ip = ipCliente(req);
        const esperaLogin = limiteLoginFallido.esperaSegundos(ip);
        if (esperaLogin) {
          return sendJSON(res, 429, { error: 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.' }, { 'Retry-After': String(esperaLogin) });
        }
        const body = await readBody(req);
        const negocio = buscarNegocioPorEmail(body.email);
        const claveOk = negocio && negocio.auth && auth.verifyPassword(String(body.password || ''), negocio.auth.salt, negocio.auth.hash);
        if (!claveOk) {
          limiteLoginFallido.registrar(ip);
          return sendJSON(res, 401, { error: 'Email o clave incorrectos' });
        }
        limiteLoginFallido.reiniciar(ip);
        const cookie = auth.cookieSesion(req, auth.crearSesion(negocio.id));
        return sendJSON(res, 200, negocioPublico(negocio), { 'Set-Cookie': cookie });
      }

      // POST /api/auth/logout
      if (parts[1] === 'auth' && parts[2] === 'logout' && parts.length === 3 && req.method === 'POST') {
        return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieSesion(req, null) });
      }

      // GET /api/me — el negocio de la sesión actual, o 401 si no hay sesión.
      if (parts[1] === 'me' && parts.length === 2 && req.method === 'GET') {
        const negocioId = sesionActual(req);
        const negocio = negocioId && store.getNegocio(negocioId);
        if (!negocio) return noAutorizado(res);
        return sendJSON(res, 200, negocioPublico(negocio));
      }

      if (parts[1] === 'negocios' && parts.length >= 3) {
        const negocioId = parts[2];
        if (sesionActual(req) !== negocioId) return noAutorizado(res);
        const negocio = store.getNegocio(negocioId);
        if (!negocio) return sendJSON(res, 404, { error: 'Negocio no encontrado' });

        // GET /api/negocios/:id
        if (parts.length === 3 && req.method === 'GET') {
          return sendJSON(res, 200, negocioPublico(negocio));
        }

        // PUT /api/negocios/:id  { nombre, datos, estiloImagen }
        if (parts.length === 3 && req.method === 'PUT') {
          const body = await readBody(req);
          const nombre = (body.nombre || '').trim();
          if (!nombre) return sendJSON(res, 400, { error: 'Falta el nombre del negocio' });
          if (body.estiloImagen && !ESTILOS_IMAGEN.includes(body.estiloImagen)) {
            return sendJSON(res, 400, { error: 'Estilo de imagen inválido' });
          }
          negocio.nombre = nombre;
          negocio.datos = {
            precioDesde: body.datos && body.datos.precioDesde ? String(body.datos.precioDesde).trim() : '',
            unidad: body.datos && body.datos.unidad ? String(body.datos.unidad).trim() : '',
            promo: body.datos && body.datos.promo ? String(body.datos.promo).trim() : '',
            productoDestacado: body.datos && body.datos.productoDestacado ? String(body.datos.productoDestacado).trim() : '',
          };
          if (body.estiloImagen) negocio.estiloImagen = body.estiloImagen;
          store.saveNegocio(negocio);
          return sendJSON(res, 200, negocioPublico(negocio));
        }

        // DELETE /api/negocios/:id
        if (parts.length === 3 && req.method === 'DELETE') {
          if (negocio.stripe && negocio.stripe.subscriptionId) {
            await stripe.cancelarSuscripcion(negocio.stripe.subscriptionId);
          }
          store.deleteNegocio(negocioId);
          return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieSesion(req, null) });
        }

        // PUT /api/negocios/:id/instagram  { userId, accessToken }
        if (parts[3] === 'instagram' && parts.length === 4 && req.method === 'PUT') {
          const body = await readBody(req);
          const userId = String(body.userId || '').trim();
          const accessToken = String(body.accessToken || '').trim();
          if (!/^[0-9]+$/.test(userId)) return sendJSON(res, 400, { error: 'ID de usuario de Instagram inválido' });
          if (!accessToken) return sendJSON(res, 400, { error: 'Falta el token de acceso' });
          negocio.instagram = { userId, accessToken, conectadoEl: new Date().toISOString() };
          store.saveNegocio(negocio);
          // Lo aprobado antes de conectar, con fecha futura, entra a la cola.
          // Lo que esperaba una reconexión ya está programado: se publica solo.
          const items = store.getContenido(negocioId);
          const ahora = new Date().toISOString();
          let programadas = 0;
          for (const it of items) {
            const publicable = it.status === 'aprobado' && !it.publicacion && !(it.instagram && it.instagram.ok);
            if (publicable && Date.parse(programacion.asegurarPublicarEl(it)) > Date.parse(ahora)) {
              programar(it, it.publicarEl, req);
              programadas += 1;
            }
          }
          if (programadas) store.saveContenido(negocioId, items);
          return sendJSON(res, 200, negocioPublico(negocio));
        }

        // DELETE /api/negocios/:id/instagram
        if (parts[3] === 'instagram' && parts.length === 4 && req.method === 'DELETE') {
          delete negocio.instagram;
          store.saveNegocio(negocio);
          return sendJSON(res, 200, negocioPublico(negocio));
        }

        // POST /api/negocios/:id/checkout  { plan: 'pro' | 'estudio' }
        // Sin suscripción vigente: crea una sesión de Stripe Checkout y
        // devuelve { url }; el negocio pasa de plan al confirmar el pago, vía
        // el webhook (no acá). Con una suscripción vigente: cambia el precio
        // de ESA suscripción (con prorrateo) y devuelve { negocio } — nunca
        // abre un segundo Checkout, que crearía una suscripción paralela
        // cobrando dos veces.
        if (parts[3] === 'checkout' && parts.length === 4 && req.method === 'POST') {
          const body = await readBody(req);
          const planId = body.plan;
          const priceId = stripePriceId(planId);
          if (!priceId) return sendJSON(res, 400, { error: 'Ese plan no está disponible todavía' });

          const subscriptionId = negocio.stripe && negocio.stripe.subscriptionId;
          if (subscriptionId) {
            const actual = await stripe.obtenerSuscripcion(subscriptionId);
            if (actual.error) return sendJSON(res, 502, { error: actual.error });
            const sub = actual.data;
            if (!SUSCRIPCION_TERMINADA.has(sub.status)) {
              const item = sub.items && sub.items.data && sub.items.data[0];
              if (!item) return sendJSON(res, 502, { error: 'La suscripción no tiene un plan asociado' });
              if (item.price && item.price.id === priceId) {
                return sendJSON(res, 409, { error: 'Ya tienes ese plan' });
              }
              const cambio = await stripe.cambiarPrecioSuscripcion({ subscriptionId, itemId: item.id, priceId, planId });
              if (cambio.error) return sendJSON(res, 502, { error: cambio.error });

              // El webhook customer.subscription.updated también lo confirma;
              // esto solo evita que el panel muestre el plan viejo mientras llega.
              const fresco = store.getNegocio(negocioId);
              const activa = cambio.data.status === 'active' || cambio.data.status === 'trialing';
              fresco.stripe = Object.assign({}, fresco.stripe, { estado: cambio.data.status });
              if (activa) fresco.plan = planId;
              store.saveNegocio(fresco);
              return sendJSON(res, 200, { negocio: negocioPublico(fresco) });
            }
          }

          const base = urlBase(req);
          const resultado = await stripe.crearCheckoutSession({
            priceId,
            negocioId,
            planId,
            successUrl: `${base}/app?checkout=exito`,
            cancelUrl: `${base}/app?checkout=cancelado`,
            customerId: negocio.stripe && negocio.stripe.customerId,
            email: negocio.email,
          });
          if (resultado.error) return sendJSON(res, 502, { error: resultado.error });
          return sendJSON(res, 200, { url: resultado.data.url });
        }

        // POST /api/negocios/:id/portal — enlace al Billing Portal de Stripe
        // (cambiar tarjeta, cancelar) para negocios que ya tienen una
        // suscripción; Stripe se encarga de esa pantalla, no nosotros.
        if (parts[3] === 'portal' && parts.length === 4 && req.method === 'POST') {
          if (!negocio.stripe || !negocio.stripe.customerId) {
            return sendJSON(res, 400, { error: 'Todavía no tienes una suscripción para gestionar' });
          }
          const resultado = await stripe.crearPortalSession({
            customerId: negocio.stripe.customerId,
            returnUrl: `${urlBase(req)}/app`,
          });
          if (resultado.error) return sendJSON(res, 502, { error: resultado.error });
          return sendJSON(res, 200, { url: resultado.data.url });
        }

        // GET /api/negocios/:id/contenido
        if (parts[3] === 'contenido' && parts.length === 4 && req.method === 'GET') {
          return sendJSON(res, 200, store.getContenido(negocioId));
        }

        // GET /api/negocios/:id/estrategia  (plantilla completa: enfoques + categorías de foto)
        if (parts[3] === 'estrategia' && parts.length === 4 && req.method === 'GET') {
          return sendJSON(res, 200, negocio.estrategia);
        }

        // GET /api/negocios/:id/fotos
        if (parts[3] === 'fotos' && parts.length === 4 && req.method === 'GET') {
          return sendJSON(res, 200, store.listFotos(negocioId));
        }

        // POST /api/negocios/:id/fotos  { categoria, filename, dataBase64 }
        if (parts[3] === 'fotos' && parts.length === 4 && req.method === 'POST') {
          const body = await readBody(req, 15e6);
          const categoria = body.categoria;
          if (!negocio.estrategia.categoriasFoto.includes(categoria)) {
            return sendJSON(res, 400, { error: 'Categoría de foto inválida' });
          }
          const extOriginal = path.extname(body.filename || '').toLowerCase();
          const ext = FOTO_EXTENSIONES.has(extOriginal) ? extOriginal : '.jpg';
          const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
          const base64 = String(body.dataBase64 || '').replace(/^data:[^,]+,/, '');
          if (!base64) return sendJSON(res, 400, { error: 'Falta la imagen' });

          store.addFoto(negocioId, categoria, nombreArchivo, Buffer.from(base64, 'base64'));
          return sendJSON(res, 201, store.listFotos(negocioId));
        }

        // DELETE /api/negocios/:id/fotos/:categoria/:archivo
        if (parts[3] === 'fotos' && parts.length === 6 && req.method === 'DELETE') {
          const categoria = path.basename(parts[4]);
          const archivo = path.basename(parts[5]);
          if (!negocio.estrategia.categoriasFoto.includes(categoria)) {
            return sendJSON(res, 400, { error: 'Categoría de foto inválida' });
          }
          store.deleteFoto(negocioId, categoria, archivo);
          return sendJSON(res, 200, store.listFotos(negocioId));
        }

        // POST /api/negocios/:id/generar  { cantidad }
        if (parts[3] === 'generar' && parts.length === 4 && req.method === 'POST') {
          const body = await readBody(req);
          let cantidad = Math.min(Math.max(Math.floor(Number(body.cantidad)) || 6, 1), MAX_PIEZAS_POR_GENERACION);
          const usaIA = getPlan(negocio.plan).usaIA;
          if (usaIA) {
            const disponibles = textosIADisponibles(negocio);
            if (disponibles <= 0) {
              return sendJSON(res, 403, { error: 'Ya usaste todas las piezas con IA de este mes. Se renuevan el día 1.' });
            }
            cantidad = Math.min(cantidad, disponibles);
          }
          const nuevos = await generarBanco(negocio, cantidad, store.getContenido(negocioId).length, { usarIA: usaIA });
          registrarUsoIA(negocioId, 'usoTextosIA', nuevos.filter((n) => n.generadoConIA).length);
          // Se relee la cola después de esperar a Claude, para no pisar lo que
          // el negocio aprobó o editó mientras tanto.
          const items = store.getContenido(negocioId).concat(nuevos);
          store.saveContenido(negocioId, items);
          return sendJSON(res, 200, items);
        }

        // Acciones sobre un item: /api/negocios/:id/contenido/:itemId/:accion
        // Cada acción arma un cambio (`aplicar`) y al final se aplica sobre la
        // cola recién leída de disco: las acciones que esperan a una API
        // externa (Instagram, Claude, imágenes) pueden tardar varios segundos
        // y no deben pisar lo que se hizo con otras piezas entre medio.
        if (parts[3] === 'contenido' && parts.length === 6) {
          const itemId = parts[4];
          const accion = parts[5];
          const item = encontrarItem(store.getContenido(negocioId), itemId);
          if (!item) return sendJSON(res, 404, { error: 'Contenido no encontrado' });

          const publicada = !!(item.instagram && item.instagram.ok);
          const seEstaPublicando = (item.publicacion && item.publicacion.estado === 'publicando')
            || publicador.estaPublicando(negocioId, itemId);
          const igConectado = !!(negocio.instagram && negocio.instagram.accessToken);
          const ocupada = () => sendJSON(res, 409, { error: 'Esta pieza se está publicando en este momento. Intenta en unos segundos.' });
          // Tras guardar: si la pieza ya está vencida (su hora pasó, o se pidió
          // "publicar ahora"), se publica en este mismo request en vez de
          // esperar la próxima pasada del publicador.
          let publicarYa = false;

          let aplicar;
          if (accion === 'aprobar' && req.method === 'POST') {
            if (publicada) {
              // Ya está en Instagram (se aprobó, se deshizo y se vuelve a
              // aprobar): se marca aprobada sin publicarla por segunda vez.
              aplicar = (it) => { it.status = 'aprobado'; };
            } else {
              // Aprobar ya no publica en el acto: deja la pieza programada
              // para su fecha. Sin Instagram conectado queda solo aprobada.
              aplicar = (it) => {
                const cuando = programacion.asegurarPublicarEl(it);
                it.status = 'aprobado';
                const yaEnCola = it.publicacion && ['programada', 'publicando'].includes(it.publicacion.estado);
                if (igConectado && !yaEnCola) programar(it, maxISO(cuando, new Date().toISOString()), req);
              };
              publicarYa = true;
            }
          } else if ((accion === 'rechazar' || accion === 'deshacer') && req.method === 'POST') {
            if (seEstaPublicando) return ocupada();
            aplicar = (it) => {
              it.status = accion === 'rechazar' ? 'rechazado' : 'pendiente';
              // Sale de la cola de publicación; el registro de una ya
              // publicada se conserva (así no se publica de nuevo al re-aprobar).
              if (it.publicacion && it.publicacion.estado !== 'publicada') delete it.publicacion;
            };
          } else if ((accion === 'publicar-ahora' || accion === 'reintentar') && req.method === 'POST') {
            if (item.status !== 'aprobado') return sendJSON(res, 400, { error: 'Primero aprueba la pieza' });
            if (publicada) return sendJSON(res, 409, { error: 'Esta pieza ya está publicada en Instagram' });
            if (!igConectado) return sendJSON(res, 400, { error: 'Conecta Instagram en Configuración para publicar' });
            if (seEstaPublicando) return ocupada();
            aplicar = (it) => {
              const ahora = new Date().toISOString();
              // "Publicar ahora" también mueve la fecha; "Reintentar" la deja.
              if (accion === 'publicar-ahora') programacion.fijarPublicarEl(it, ahora);
              else programacion.asegurarPublicarEl(it);
              programar(it, ahora, req);
            };
            publicarYa = true;
          } else if (accion === 'reprogramar' && req.method === 'PUT') {
            if (publicada) return sendJSON(res, 409, { error: 'Esta pieza ya está publicada en Instagram' });
            if (seEstaPublicando) return ocupada();
            const body = await readBody(req);
            const cuando = programacion.isoDesdeInputLocal(body.fecha);
            if (!cuando) return sendJSON(res, 400, { error: 'Fecha inválida' });
            const diferencia = Date.parse(cuando) - Date.now();
            if (diferencia < -60 * 1000) {
              return sendJSON(res, 400, { error: 'Esa fecha ya pasó. Para publicar de inmediato, aprueba la pieza y usa "Publicar ahora".' });
            }
            if (diferencia > 366 * 24 * 60 * 60 * 1000) return sendJSON(res, 400, { error: 'La fecha puede ser hasta un año adelante' });
            aplicar = (it) => {
              programacion.fijarPublicarEl(it, cuando);
              const enCola = it.status === 'aprobado' && it.publicacion && ['programada', 'fallida'].includes(it.publicacion.estado);
              if (enCola) programar(it, cuando, req);
            };
          } else if (accion === 'editar' && req.method === 'PUT') {
            const body = await readBody(req);
            if (typeof body.caption !== 'string') return sendJSON(res, 400, { error: 'Falta el texto' });
            aplicar = (it) => { it.variants[it.variantIndex] = body.caption; };
          } else if (accion === 'regenerar' && req.method === 'POST') {
            if (item.variantIndex + 1 < item.variants.length) {
              aplicar = (it) => { it.variantIndex = Math.min(it.variantIndex + 1, it.variants.length - 1); };
            } else {
              const usaIA = getPlan(negocio.plan).usaIA;
              if (usaIA && textosIADisponibles(negocio) <= 0) {
                return sendJSON(res, 403, { error: 'Ya usaste todas las piezas con IA de este mes. Se renuevan el día 1.' });
              }
              const nueva = usaIA ? await generarVarianteConClaude(negocio, item.enfoqueId, item.variants) : null;
              if (nueva) {
                registrarUsoIA(negocioId, 'usoTextosIA', 1);
                aplicar = (it) => { it.variants.push(nueva); it.variantIndex = it.variants.length - 1; };
              } else {
                aplicar = (it) => { it.variantIndex = 0; }; // sin IA: vuelve a rotar desde la primera
              }
            }
          } else if (accion === 'imagen' && req.method === 'POST') {
            if (!getPlan(negocio.plan).cuotaFotosIA) {
              return sendJSON(res, 403, { error: 'Las fotos generadas por IA están disponibles en el plan Estudio' });
            }
            if (!process.env.OPENAI_API_KEY) {
              return sendJSON(res, 400, { error: 'La generación de imágenes con IA no está configurada' });
            }
            if (!store.tieneFotoIA(negocioId, item.id)) {
              if (fotosIADisponibles(negocio) <= 0) {
                return sendJSON(res, 403, { error: 'Ya usaste tu cuota de fotos con IA de este mes' });
              }
              const buffer = await generarImagenIA({ negocio, item, incluirTexto: negocio.estiloImagen === 'texto' });
              if (!buffer) return sendJSON(res, 502, { error: 'No se pudo generar la imagen con IA' });
              store.guardarFotoIA(negocioId, item.id, buffer);
              registrarUsoIA(negocioId, 'usoFotosIA', 1);
            }
            aplicar = (it) => { it.imagenIA = true; };
          } else {
            return sendJSON(res, 400, { error: 'Acción o método inválido' });
          }

          const items = store.getContenido(negocioId);
          const fresco = encontrarItem(items, itemId);
          if (!fresco) return sendJSON(res, 404, { error: 'Contenido no encontrado' });
          aplicar(fresco);
          store.saveContenido(negocioId, items);
          if (publicarYa && publicador.estaVencida(fresco)) {
            const procesado = await publicador.procesar(negocioId, itemId);
            if (procesado) return sendJSON(res, 200, procesado);
          }
          return sendJSON(res, 200, fresco);
        }
      }

      return notFound(res);
    }

    // --- fotos subidas: /fotos/:negocioId/:categoria/:archivo ---
    if (parts[0] === 'fotos' && parts.length === 4 && req.method === 'GET') {
      const [, negocioId, categoria, archivo] = parts;
      const tokenFoto = url.searchParams.get('t');
      const autorizadoPorToken = tokenFoto && auth.verificarTokenFoto(tokenFoto, negocioId, categoria, archivo);
      if (sesionActual(req) !== negocioId && !autorizadoPorToken) return notFound(res);
      const esGenerada = categoria === '_ia';
      const filePath = esGenerada
        ? store.fotoIAAbsolutePath(path.basename(negocioId), path.basename(archivo, '.png'))
        : store.fotoAbsolutePath(path.basename(negocioId), path.basename(categoria), path.basename(archivo));
      const dirPermitido = esGenerada ? store.FOTOS_IA_DIR : store.FOTOS_DIR;
      if (!filePath.startsWith(dirPermitido)) return notFound(res);
      return fs.readFile(filePath, (err, content) => {
        if (err) return notFound(res);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(content);
      });
    }

    // --- estáticos ---
    if (req.method === 'GET') {
      if (parts[0] === 'app') {
        const rel = '/' + parts.slice(1).join('/');
        return serveStatic(res, APP_DIR, rel);
      }
      return serveStatic(res, SITE_DIR, url.pathname);
    }
    return notFound(res);
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'Error interno' });
  }
});

server.listen(PORT, () => {
  console.log(`Rubrofy corriendo en http://localhost:${PORT}`);
  publicador.iniciar();
  console.log(`Publicador activo: revisa las publicaciones programadas cada ${Number(process.env.PUBLICADOR_INTERVALO_SEG) || 30} s (zona ${programacion.ZONA}).`);
  if (!process.env.PUBLIC_URL) {
    console.log('PUBLIC_URL no configurada: el publicador usará la URL desde la que se aprobó cada pieza. En producción conviene definirla.');
  }
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(`Usando modelo ${process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'} para estrategia y contenido.`);
  } else {
    console.log('ANTHROPIC_API_KEY no configurada: estrategia y contenido usan las plantillas genéricas de respaldo.');
  }
  if (process.env.OPENAI_API_KEY) {
    console.log(`Usando modelo ${process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'} para fotos generadas por IA.`);
  } else {
    console.log('OPENAI_API_KEY no configurada: sin foto real ni generada, las piezas muestran un degradé de marcador.');
  }
  if (process.env.STRIPE_SECRET_KEY) {
    const planesDisponibles = listPlanesPublico().filter((p) => p.disponible && p.id !== 'gratis').map((p) => p.id);
    console.log(planesDisponibles.length
      ? `Stripe configurado — planes de pago disponibles: ${planesDisponibles.join(', ')}.`
      : 'Stripe configurado, pero falta STRIPE_PRICE_PRO / STRIPE_PRICE_ESTUDIO: nadie puede suscribirse todavía.');
  } else {
    console.log('STRIPE_SECRET_KEY no configurada: todos los negocios operan en el plan gratis.');
  }
});
