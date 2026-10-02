// Servidor de Rubrofy. Node puro, sin dependencias externas
// (mismo criterio que colchones-yole): un archivo sirve la web y la API.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const store = require('./store');
const auth = require('./auth');
const { generarEstrategia, editar: editarEstrategia } = require('./estrategia');
const planContenido = require('./plan-contenido');
const ruta = require('./ruta');
const instagram = require('./instagram');
const correo = require('./correo');
const avisos = require('./avisos');
const admin = require('./admin');
const INICIO = Date.now();
const { generarBanco, generarVarianteConClaude, ideaGenerica, limpiarHashtags } = require('./generator');
const estilo = require('./estilo');
const { crearPublicador } = require('./publicador');
const programacion = require('./programacion');
const analitica = require('./analitica');
const informe = require('./informe');
const meta = require('./meta');
const google = require('./google');
const competencia = require('./competencia');
const analisisAds = require('./analisis-ads');
const contextoIA = require('./contexto-ia');
const voz = require('./voz');
const reelsPrueba = require('./reels-prueba');
const push = require('./push');
const costos = require('./costos');
const perfil = require('./perfil');
const pruebaGratis = require('./prueba-gratis');
const recargas = require('./recargas');
const marca = require('./marca');
const edicionReels = require('./edicion-reels');
const guardian = require('./guardian');
const medios = require('./medios');
const { getPlan, listPlanesPublico, stripePriceId, planIdDesdePriceId } = require('./planes');
const stripe = require('./stripe');
const pagos = require('./pagos');
const cobroFlow = require('./cobro-flow');
const beneficios = require('./beneficios');
const creditos = require('./creditos');
const { crearLimitador, ipCliente } = require('./limites');

const PORT = process.env.PORT || 5180;
const VERSION = require('../package.json').version;
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
// "Olvidé mi clave": tope por conexión.
const limiteRecuperar = crearLimitador({ max: 5, ventanaMs: 60 * 60 * 1000 });
// Correo de prueba del resumen semanal: tope por negocio.
const limiteCorreoPrueba = crearLimitador({ max: 3, ventanaMs: 60 * 60 * 1000 });
// Regenerar la estrategia llama a Claude: tope por negocio.
const limiteEstrategia = crearLimitador({ max: 10, ventanaMs: 60 * 60 * 1000 });

// Estados de una suscripción de Stripe que ya terminó: solo en ese caso un
// cambio de plan puede abrir un Checkout nuevo sin duplicar el cobro.
const SUSCRIPCION_TERMINADA = new Set(['canceled', 'incomplete_expired']);

// El acceso es self-service: cada negocio es su propia cuenta (email +
// clave), no hay una clave maestra que vea todos los negocios juntos.
function sesionActual(req) {
  const token = auth.leerCookie(req, 'rubrofy_sesion');
  const negocioId = auth.verificarSesion(token);
  if (!negocioId) return null;
  // Después de cambiar la clave, las sesiones abiertas antes dejan de valer.
  const n = store.getNegocio(negocioId);
  if (n && n.sesionesDesde && auth.emisionSesion(token) < Date.parse(n.sesionesDesde)) return null;
  return negocioId;
}

// Enlace para elegir una clave nueva: vale 30 minutos y una sola vez (va
// ligado al hash de la clave actual, que cambia al usarlo).
function tokenClave(negocio) {
  return auth.crearTokenFoto(negocio.id, 'clave', negocio.auth.hash.slice(0, 16), 30);
}
function tokenClaveValido(negocio, token) {
  return !!(negocio && negocio.auth && auth.verificarTokenFoto(token, negocio.id, 'clave', negocio.auth.hash.slice(0, 16)));
}

function noAutorizado(res) {
  sendJSON(res, 401, { error: 'No autorizado' });
}

// Sesión por cookie (en vez de Basic Auth) tiene el mismo problema de CSRF:
// el navegador la reenvía sola a cualquier origen. Un <form> ajeno no puede
// agregar esta cabecera custom ni mandar JSON, así que exigir ambas bloquea
// esa clase de ataque en toda mutación bajo /api.
const CSRF_HEADER = 'x-rubrofy-panel';

// La subida de video es la única que no viaja como JSON (manda el archivo
// crudo, que puede pesar decenas de MB): se acepta su tipo de video, pero
// igual exige la cabecera custom, que un sitio ajeno no puede agregar.
const TIPOS_VIDEO = { 'video/mp4': '.mp4', 'video/quicktime': '.mov' };

function peticionLegitima(req, esSubidaVideo) {
  if (req.headers[CSRF_HEADER] !== '1') return false;
  if (req.method === 'POST' || req.method === 'PUT') {
    const tipo = (req.headers['content-type'] || '').split(';')[0].trim();
    if (esSubidaVideo ? !TIPOS_VIDEO[tipo] : tipo !== 'application/json') return false;
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
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const FOTO_EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_VIDEO_BYTES = (Number(process.env.MAX_VIDEO_MB) || 100) * 1024 * 1024;

// Formatos de publicación. Una pieza vieja sin `formato` se deduce de su
// proporción (9:16 era historia; 4:5, post).
const FORMATOS = {
  post: { aspect: '4 / 5', etiqueta: 'Post' },
  carrusel: { aspect: '4 / 5', etiqueta: 'Carrusel' },
  reel: { aspect: '9 / 16', etiqueta: 'Reel' },
  historia: { aspect: '9 / 16', etiqueta: 'Historia' },
};
const MAX_FOTOS_CARRUSEL = 10;

function formatoDe(item) {
  if (item.formato && FORMATOS[item.formato]) return item.formato;
  return item.aspect && item.aspect.trim().startsWith('9') ? 'historia' : 'post';
}

// Un contenedor ya creado en Instagram queda obsoleto si cambia lo que se va
// a publicar (formato o video): se descarta para crear uno nuevo.
function descartarContenedor(it) {
  if (it.publicacion && it.publicacion.estado !== 'publicada') {
    delete it.publicacion.creationId;
    delete it.publicacion.creationEl;
  }
}
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
  // Tampoco un id de una cuenta eliminada: sus sesiones y enlaces firmados
  // (que llevan el id) seguirían valiendo para la cuenta nueva.
  while (store.getNegocio(id) || store.idUsado(id)) {
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
    // Las respuestas de la API traen datos de la cuenta: ni el navegador ni
    // Cloudflare las guardan.
    'Cache-Control': 'no-store',
  }, CABECERAS_SEGURIDAD, extraHeaders));
  res.end(body);
}

// Datos públicos de un negocio (nunca la clave, el token de Instagram, ni
// los IDs internos de Stripe).
function negocioPublico(negocio) {
  const { auth: _auth, instagram: igInfo, stripe: stripeInfo, flow: _flowInfo, meta: metaInfo, google: googleInfo, ...resto } = negocio;
  resto.metaConexion = meta.publicoMeta(metaInfo);
  resto.googleConexion = google.publico(googleInfo);
  resto.googleConfigurado = google.configurado();
  resto.instagramConectado = !!(igInfo && igInfo.accessToken);
  // 'ok' | 'reconectar' (el token venció o fue revocado: las publicaciones
  // programadas esperan hasta que se reconecte).
  resto.instagramEstado = igInfo && igInfo.accessToken ? (igInfo.estado || 'ok') : null;
  resto.instagramMotivoReconexion = (igInfo && igInfo.motivoReconexion) || null;
  resto.instagramVenceEl = (igInfo && igInfo.venceEl) || null;
  resto.instagramUsuario = (igInfo && igInfo.username) || null;
  resto.instagramLoginDisponible = instagram.loginConfigurado();
  resto.avisosSemanal = !(negocio.avisos && negocio.avisos.semanal === false);
  resto.correoConfigurado = correo.configurado();
  resto.esAdmin = admin.esAdmin(negocio); // solo muestra el enlace; /api/admin valida por su cuenta
  resto.zonaHoraria = programacion.ZONA;
  resto.plan = negocio.plan || 'gratis';
  // Cómo paga: con qué (Flow o Stripe) y, si ya se suscribió, cómo va.
  const sus = pagos.suscripcion(negocio);
  const prov = sus ? sus.proveedor : pagos.proveedor();
  resto.pagos = Object.assign({ proveedor: prov, nombre: pagos.nombre(prov), suscripcion: !!sus, estado: sus ? sus.estado : null },
    sus && sus.proveedor === 'flow' ? cobroFlow.publico(negocio) : {});
  resto.tieneSuscripcion = !!sus || !!(stripeInfo && stripeInfo.customerId);
  delete resto.planRegalado;
  delete resto.creditosPlan; delete resto.referidoPor;
  resto.regalo = beneficios.regaloVigente(negocio) ? { plan: negocio.planRegalado.plan, hasta: negocio.planRegalado.hasta } : null;
  resto.creditos = creditos.publico(negocio);
  resto.fotosIADisponibles = fotosIADisponibles(negocio);
  resto.textosIADisponibles = textosIADisponibles(negocio);
  resto.videosIADisponibles = videosIADisponibles(negocio);
  resto.mediosIA = { imagen: !!medios.proveedorImagen(), video: !!medios.proveedorVideo() };
  resto.iaConfigurada = !!process.env.ANTHROPIC_API_KEY;
  resto.guias = process.env.GUIAS !== 'no'; // GUIAS=no apaga las guías del panel para todos
  resto.perfilCompleto = perfil.completo(negocio);
  resto.prueba = pruebaGratis.publico(negocio);
  resto.reelsEditadosDisponibles = reelsEditadosDisponibles(negocio);
  resto.edicionReels = { disponible: edicionReels.disponible(), subtitulosAuto: edicionReels.subtitulosAuto() };
  // Cupo del mes (usado / total) y saldo de recargas, para el panel.
  const plan = getPlan(negocio.plan);
  resto.cupos = {
    piezas: { usado: usoDelMes(negocio, 'usoTextosIA'), cupo: plan.cuotaTextosIA },
    reels: { usado: usoDelMes(negocio, 'usoReelsEditados'), cupo: plan.cuotaReelsEditados },
  };
  resto.saldos = recargas.saldos(negocio.id);
  const puede = recargas.puedeComprar(negocio, admin.esAdmin(negocio));
  resto.recargas = { pago: !!pagos.proveedor(), simular: admin.esAdmin(negocio), puede: puede.ok, motivo: puede.motivo || null };
  resto.sinPlan = (negocio.plan || 'gratis') === 'gratis';
  resto.usaIA = !!getPlan(negocio.plan).usaIA;
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

// Primer día libre después de lo que ya está en la cola sin publicar, para
// que "generar la semana" siga donde termina lo anterior y no la pise.
function diaSiguienteDeLaCola(items, ahora = Date.now()) {
  let ultimo = 0;
  for (const it of items) {
    if (it.status === 'rechazado' || (it.publicacion && it.publicacion.estado === 'publicada')) continue;
    const t = Date.parse(it.publicarEl || '');
    if (t > ultimo) ultimo = t;
  }
  if (!ultimo || ultimo <= ahora) return 1;
  return Math.max(1, Math.ceil((ultimo - ahora) / 86400000) + 1);
}

function buscarNegocioPorEmail(email) {
  const buscado = String(email || '').trim().toLowerCase();
  return store.listNegocios().find((n) => n.email === buscado) || null;
}

// Nadie puede meter Rubrofy en un iframe (clickjacking), se usa siempre
// https y no se filtra la ruta completa a otros sitios.
const CABECERAS_SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
};

function notFound(res) {
  sendJSON(res, 404, { error: 'No encontrado' });
}

// Cuerpo application/x-www-form-urlencoded (los avisos de Flow).
function leerFormulario(req) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    let largo = 0;
    req.on('data', (chunk) => {
      largo += chunk.length;
      if (largo > 1e4) { req.destroy(); return reject(new Error('Cuerpo demasiado grande')); }
      trozos.push(chunk);
    });
    req.on('end', () => resolve(new URLSearchParams(Buffer.concat(trozos).toString('utf8'))));
    req.on('error', reject);
  });
}

function readBody(req, maxBytes) {
  const limit = maxBytes || 1e6;
  return new Promise((resolve, reject) => {
    const trozos = [];
    let largo = 0;
    req.on('data', (chunk) => {
      largo += chunk.length;
      if (largo > limit) { req.destroy(); return reject(new Error('Cuerpo demasiado grande')); }
      trozos.push(chunk);
    });
    req.on('end', () => {
      // Se une en bytes y recién ahí se decodifica: un carácter UTF-8
      // partido entre dos trozos se corrompía.
      const raw = Buffer.concat(trozos).toString('utf8');
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

// Páginas legales: el email de contacto sale de CONTACTO_EMAIL (o del
// remitente de los correos). Sin ninguno, el enlace queda como texto.
const PAGINAS_CON_CONTACTO = new Set(['/privacidad.html', '/terminos.html', '/eliminar-datos.html']);
function emailContacto() {
  const directo = String(process.env.CONTACTO_EMAIL || '').trim();
  if (directo) return directo;
  const m = /<([^>]+)>/.exec(process.env.EMAIL_FROM || '') || /^\s*(\S+@\S+)\s*$/.exec(process.env.EMAIL_FROM || '');
  return m ? m[1] : null;
}
function conContacto(html) {
  const email = emailContacto();
  if (email) return html.split('{{CONTACTO}}').join(email.replace(/[<>"&]/g, ''));
  return html.replace(/<a href="mailto:\{\{CONTACTO\}\}">\{\{CONTACTO\}\}<\/a>/g, 'nuestro correo de contacto');
}

function serveStatic(res, baseDir, rel) {
  const relLimpio = rel === '' || rel === '/' ? '/index.html' : rel;
  const filePath = path.join(baseDir, relLimpio);
  if (!filePath.startsWith(baseDir)) return notFound(res);

  fs.readFile(filePath, (err, content) => {
    if (err) return notFound(res);
    if (baseDir === SITE_DIR && PAGINAS_CON_CONTACTO.has(relLimpio)) content = Buffer.from(conContacto(content.toString('utf8')));
    const ext = path.extname(filePath);
    // HTML, JS y CSS se revalidan en cada visita (sin versión en la URL, un
    // caché de horas mezclaría el panel nuevo con archivos viejos tras un
    // deploy). Imágenes y fuentes se pueden guardar un día.
    const cache = ['.html', '.js', '.css', '.json', '.txt', '.xml', '.webmanifest'].includes(ext) ? 'no-cache' : 'public, max-age=86400';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cache,
      ...CABECERAS_SEGURIDAD,
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

// La foto de una pieza: la que el negocio eligió de su galería (si sigue
// existiendo) o una de la categoría de la pieza. { categoria, archivo } o null.
function fotoDeItem(negocioId, item) {
  const fe = item.fotoElegida;
  if (fe && ((store.listFotos(negocioId)[fe.categoria]) || []).includes(fe.archivo)) return { categoria: fe.categoria, archivo: fe.archivo };
  const archivo = item.categoriaFoto ? elegirFoto(negocioId, item.categoriaFoto, item.id) : null;
  return archivo ? { categoria: item.categoriaFoto, archivo } : null;
}

// Extensión según los primeros bytes (las imágenes de IA llegan como PNG, JPG o WebP).
function extensionImagen(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return '.png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return '.webp';
  return '.jpg';
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

// Lo que queda del cupo del mes más lo cargado con recargas (server/recargas.js).
function disponibleIA(negocio, cuota, campo) {
  const delMes = cuota ? Math.max(0, cuota - usoDelMes(negocio, campo)) : 0;
  return delMes + recargas.saldo(negocio.id, recargas.tipoDeCampo(campo));
}

// Fotos y videos con IA se pagan con créditos ⚡ (server/creditos.js): cuántas
// fotos o videos de 5 s alcanzan con el saldo, en calidad Recomendada.
function fotosIADisponibles(negocio) {
  if ((negocio.plan || 'gratis') === 'gratis') return 0;
  const c = creditos.costo('foto', 'recomendada');
  return c ? Math.floor(creditos.disponible(negocio, 'foto') / c.creditos) : 0;
}

function videosIADisponibles(negocio) {
  if ((negocio.plan || 'gratis') === 'gratis') return 0;
  const c = creditos.costo('video', 'recomendada', 5);
  return c ? Math.floor(creditos.disponible(negocio, 'video') / c.creditos) : 0;
}

// --- créditos ⚡ ---

function sinCreditos(error, faltan) {
  return { error, recargar: 'creditos', faltan: faltan || 0 };
}

// ¿Se puede crear? Devuelve { costo } o { status, body } para responder.
function prepararCreacion(negocio, tipo, calidad, segundos) {
  if ((negocio.plan || 'gratis') === 'gratis') return { status: 403, body: sinCreditos('Elige un plan para crear fotos y videos con IA.') };
  if (creditos.pausa()) return { status: 503, body: { error: 'Las fotos y videos con IA están en pausa por unos minutos. Vuelve a intentarlo más tarde; no se descontaron créditos.', pausa: true } };
  const costo = creditos.costo(tipo, calidad, segundos);
  if (!costo) return { status: 400, body: { error: 'Esa calidad no está disponible' } };
  const hay = creditos.disponible(negocio, tipo);
  if (hay < costo.creditos) {
    const que = tipo === 'foto' ? 'Esta foto' : `Este video de ${costo.segundos} s`;
    const extra = tipo === 'video' && creditos.config().parametros.videosSoloConPacks ? ' Los videos se pagan con créditos de packs.' : '';
    return { status: 403, body: sinCreditos(`${que} usa ${costo.creditos} ⚡ y te quedan ${hay}.${extra} Puedes comprar más créditos.`, costo.creditos - hay) };
  }
  return { costo };
}

const nombreCreacion = (tipo, costo) => `${tipo === 'foto' ? 'Foto' : 'Video'} ${creditos.CALIDADES[costo.calidad].nombre}${tipo === 'video' ? ` · ${costo.segundos} s` : ''}`;

// Error del proveedor: si se quedó sin saldo, se pausan las creaciones y se
// avisa a quien administra (una vez por pausa).
function respuestaErrorMedios(err, que) {
  if (err.sinSaldo) {
    if (creditos.pausar('higgsfield', err.detalle || err.message)) avisarAdmins('Higgsfield se quedó sin saldo',
      `Rubrofy pausó las fotos y videos con IA porque Higgsfield respondió: "${err.detalle || err.message}". `
      + 'Carga saldo en open.higgsfield.ai/billing y toca "Reanudar" en /admin → Créditos (o espera 30 minutos: se vuelve a intentar sola). '
      + 'A los clientes no se les descontaron créditos.').catch(() => {});
    return { status: 503, body: { error: err.message, pausa: true } };
  }
  return { status: 502, body: { error: `No se pudo generar ${que}: ${err.message}` } };
}

async function avisarAdmins(asunto, texto) {
  console.error('Aviso admin:', asunto, '-', texto);
  if (!correo.configurado()) return;
  for (const para of admin.adminEmails()) {
    await correo.enviar({ para, asunto: 'Rubrofy · ' + asunto, texto, html: `<p>${escapeHtmlSrv(texto)}</p>` });
  }
}

function escapeHtmlSrv(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function textosIADisponibles(negocio) {
  if (!getPlan(negocio.plan).usaIA) return 0;
  return disponibleIA(negocio, getPlan(negocio.plan).cuotaTextosIA, 'usoTextosIA');
}

function reelsEditadosDisponibles(negocio) {
  if ((negocio.plan || 'gratis') === 'gratis') return 0;
  return disponibleIA(negocio, getPlan(negocio.plan).cuotaReelsEditados, 'usoReelsEditados');
}

// Mensaje de "se acabó" con lo que el panel necesita para ofrecer una recarga.
function sinCupo(tipo, error) {
  return { error, recargar: tipo };
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
  if (cantidad > 0) {
    // Primero el cupo del mes; lo que pase de él sale de las recargas.
    const cupo = getPlan(fresco.plan)[{ usoTextosIA: 'cuotaTextosIA', usoFotosIA: 'cuotaFotosIA', usoVideosIA: 'cuotaVideosIA', usoReelsEditados: 'cuotaReelsEditados' }[campo]] || 0;
    const enCupo = Math.min(cantidad, Math.max(0, cupo - fresco[campo].cantidad));
    fresco[campo].cantidad += enCupo;
    const tipo = recargas.tipoDeCampo(campo);
    if (cantidad > enCupo && tipo) recargas.consumir(negocioId, tipo, cantidad - enCupo);
  } else {
    fresco[campo].cantidad = Math.max(0, fresco[campo].cantidad + cantidad);
  }
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
  // El publicador corre sin un request a mano: usa PUBLIC_URL, o la URL
  // desde la que se aprobó la pieza.
  const base = process.env.PUBLIC_URL
    ? process.env.PUBLIC_URL.replace(/\/$/, '')
    : item.publicacion && item.publicacion.urlBase;
  if (!base) return { motivo: 'Falta configurar PUBLIC_URL en el servidor' };

  const enlace = (categoria, archivo, minutos) =>
    `${base}/fotos/${negocio.id}/${categoria}/${archivo}?t=${auth.crearTokenFoto(negocio.id, categoria, archivo, minutos)}`;
  const enlaceVideo = (archivo) =>
    `${base}/videos/${negocio.id}/${archivo}?t=${auth.crearTokenFoto(negocio.id, '_video', archivo, 60)}`;
  const formato = formatoDe(item);
  // Texto final: el de la versión elegida más sus hashtags (si no los trae ya).
  const textoBase = item.variants[item.variantIndex] || '';
  const tags = (item.hashtags || []).filter((h) => !textoBase.toLowerCase().includes(h));
  const caption = tags.length ? `${textoBase}\n\n${tags.join(' ')}` : textoBase;
  const video = item.video && item.video.archivo;

  if (formato === 'reel') {
    if (!video) return { motivo: 'Este Reel no tiene video. Súbelo en la tarjeta y usa "Reintentar".' };
    return { tipo: 'reel', videoUrl: enlaceVideo(video), caption, prueba: item.prueba ? item.prueba.graduacion : undefined };
  }
  if (formato === 'historia' && video) {
    return { tipo: 'historia', videoUrl: enlaceVideo(video) };
  }
  // Diseño con la marca (server/marca.js): reemplaza la foto de la pieza.
  const diseno = item.diseno && item.diseno.archivo && fs.existsSync(marca.ruta(negocio.id, item.diseno.archivo)) ? item.diseno.archivo : null;
  if (diseno && formato !== 'carrusel') {
    return { tipo: formato === 'historia' ? 'historia' : 'imagen', imageUrl: enlace('_marca', diseno), caption, generadaPorIA: false };
  }
  if (formato === 'carrusel') {
    const categoria = item.categoriaFoto;
    const disponibles = (categoria && store.listFotos(negocio.id)[categoria]) || [];
    if (disponibles.length < 2) {
      return { motivo: `Un carrusel necesita al menos 2 fotos en la categoría "${categoria}". Sube más en Fotos y usa "Reintentar".` };
    }
    // Empieza en una foto distinta por pieza (mismo reparto que el panel).
    const inicio = hashString(item.id) % disponibles.length;
    const orden = disponibles.slice(inicio).concat(disponibles.slice(0, inicio)).slice(0, MAX_FOTOS_CARRUSEL);
    const imageUrls = orden.map((archivo) => enlace(categoria, archivo));
    if (diseno) imageUrls[0] = enlace('_marca', diseno); // la portada diseñada
    return { tipo: 'carrusel', imageUrls, caption };
  }

  // Post o historia con una foto: la real de su categoría o, si no hay, una
  // generada por IA como respaldo.
  const propia = fotoDeItem(negocio.id, item);
  let categoria = propia ? propia.categoria : item.categoriaFoto;
  let archivo = propia ? propia.archivo : null;
  let generadaPorIA = false;

  if (!archivo && medios.proveedorImagen()) {
    const auto = !store.tieneFotoIA(negocio.id, item.id) && prepararCreacion(negocio, 'foto', 'recomendada');
    if (auto && auto.costo) {
      const m = auto.costo.modelo;
      const buffer = await medios.generarImagen({ negocio, item, incluirTexto: negocio.estiloImagen === 'texto', modelo: m }).catch((err) => {
        if (err.sinSaldo) respuestaErrorMedios(err, 'la imagen');
        return null;
      });
      if (buffer) {
        store.guardarFotoIA(negocio.id, item.id, buffer);
        creditos.cobrar(negocio.id, auto.costo.creditos, { tipo: 'foto', detalle: 'Foto automática para publicar' });
        costos.imagen(negocio.id, medios.proveedorImagen(), m.ruta, m.usd);
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
  return {
    tipo: formato === 'historia' ? 'historia' : 'imagen',
    imageUrl: enlace(categoria, archivo),
    caption,
    generadaPorIA,
  };
}

// Qué tanto aprueba el dueño lo que propone la IA sin tocarlo: la métrica
// que dice si Rubrofy está aprendiendo su voz.
function estadisticasAprobacion(negocioId, desdeISO, hastaISO) {
  const decididas = store.getContenido(negocioId).filter((i) => i.decididoEl
    && i.decididoEl >= desdeISO && i.decididoEl < hastaISO && (i.status === 'aprobado' || i.status === 'rechazado'));
  const aprobadas = decididas.filter((i) => i.status === 'aprobado');
  const sinCambios = aprobadas.filter((i) => !i.editado).length;
  return {
    aprobadas: aprobadas.length,
    sinCambios,
    editadas: aprobadas.length - sinCambios,
    rechazadas: decididas.length - aprobadas.length,
    porcentajeSinCambios: aprobadas.length ? Math.round((sinCambios / aprobadas.length) * 100) : null,
  };
}

function datosResultados(negocio, dias) {
  const hasta = analitica.fechaLocal(new Date());
  const desde = analitica.sumarDias(hasta, -(dias - 1));
  const [a, m, d] = desde.split('-').map(Number);
  const desdeISO = programacion.isoDesdeZona(a, m, d, 0, 0);
  return {
    dias,
    instagramConectado: !!(negocio.instagram && negocio.instagram.accessToken),
    sync: analitica.estadoSync(negocio.id, 'instagram'),
    resumen: analitica.resumen(negocio.id, desde, hasta, negocio.estrategia),
    horario: analitica.mejorHorario(negocio.id),
    aprobacion: estadisticasAprobacion(negocio.id, desdeISO, new Date(Date.now() + 1000).toISOString()),
  };
}

const sincronizador = analitica.crearSincronizador({
  debeSincronizar: (negocio, fuente) => {
    const plan = getPlan(negocio.plan);
    if (fuente === 'instagram') {
      return plan.analitica && !!(negocio.instagram && negocio.instagram.accessToken && negocio.instagram.estado !== 'reconectar');
    }
    if (fuente === 'meta_ads') {
      return plan.ads && !!(negocio.meta && negocio.meta.accessToken && negocio.meta.adAccountId && negocio.meta.estado !== 'reconectar');
    }
    if (fuente === 'google_ads') {
      return plan.ads && !!(negocio.google && negocio.google.customerId && negocio.google.estado !== 'reconectar');
    }
    if (fuente === 'competencia') {
      return plan.competencia && !!(negocio.meta && negocio.meta.igUserId && negocio.meta.estado !== 'reconectar');
    }
    return false;
  },
  fuentes: {
    // Tras cada sincronización de Instagram, el Reel más destacado pasa solo
    // a Por aprobar como Reel de prueba (server/reels-prueba.js).
    instagram: async (id) => {
      const r = await analitica.sincronizar(id);
      if (r.ok) {
        const n = store.getNegocio(id);
        const usarIA = getPlan(n.plan).usaIA && textosIADisponibles(n) > 0;
        try {
          const creado = await reelsPrueba.automatico(n, { usarIA, diaInicio: diaSiguienteDeLaCola(store.getContenido(id)) });
          if (creado && creado.conIA) registrarUsoIA(id, 'usoTextosIA', 1);
          if (creado && creado.item) {
            const o = creado.item.prueba.origen;
            notificar(id, { titulo: 'Un Reel tuyo funcionó muy bien', cuerpo: `Tuvo ${String(o.factor).replace('.', ',')} veces tus vistas de siempre. Su Reel de prueba para gente que no te sigue está listo para aprobar.`, url: '/app#cola', tag: 'reel-prueba' });
          }
        } catch (err) {
          console.log(`Reels de prueba: ${id}: ${err.message}`);
        }
      }
      return r;
    },
    meta_ads: (id) => meta.sincronizarAds(id),
    google_ads: (id) => google.sincronizar(id),
    competencia: (id) => competencia.sincronizar(id),
  },
});

informe.registrarSeccion('competencia', (negocio) => {
  if (!getPlan(negocio.plan).competencia || !negocio.meta || !negocio.meta.igUserId) return null;
  const c = competencia.comparacion(negocio);
  return c.filas.length > 1 ? c : null;
});

informe.registrarSeccion('googleAds', (negocio, desde, hasta) => {
  if (!getPlan(negocio.plan).ads || !negocio.google || !negocio.google.customerId) return null;
  return Object.assign(google.resumen(negocio.id, desde, hasta), { moneda: negocio.google.moneda, cuenta: negocio.google.nombre });
});

// Estado de la ruta del cliente (server/ruta.js) con los datos del negocio.
function calcularRuta(negocio) {
  return ruta.calcular({
    negocio: negocioPublico(negocio),
    plan: getPlan(negocio.plan),
    contenido: store.getContenido(negocio.id),
    fotos: store.listFotos(negocio.id),
    referencias: estilo.listar(negocio.id).length,
    competidores: competencia.contar(negocio.id),
    fotosIA: medios.proveedorImagen() ? fotosIADisponibles(negocio) : 0,
    syncInstagram: analitica.estadoSync(negocio.id, 'instagram'),
    mesHoy: informe.mesActual(),
  });
}

// Enlace firmado para darse de baja del resumen semanal (vale 60 días).
function enlaceBajaAvisos(negocioId) {
  return `/api/avisos/baja?n=${encodeURIComponent(negocioId)}&t=${auth.crearTokenFoto(negocioId, 'avisos', 'baja', 60 * 24 * 60)}`;
}

function urlPublica(req) {
  return process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : urlBase(req);
}

// Sección de Meta Ads en el informe mensual (si el plan la incluye y hay cuenta).
informe.registrarSeccion('metaAds', (negocio, desde, hasta) => {
  if (!getPlan(negocio.plan).ads || !negocio.meta || !negocio.meta.adAccountId) return null;
  return Object.assign(meta.resumenAds(negocio.id, desde, hasta), { moneda: negocio.meta.moneda, cuenta: negocio.meta.cuentaNombre });
});

// --- notificaciones push (server/push.js) ---
const NOMBRE_FORMATO = { post: 'post', carrusel: 'carrusel', reel: 'Reel', historia: 'historia' };
function notificar(negocioId, mensaje) {
  push.enviar(negocioId, mensaje).catch((err) => console.log(`Push ${negocioId}: ${err.message}`));
}
function avisoPublicador(evento, negocioId, item) {
  const formato = item ? (NOMBRE_FORMATO[formatoDe(item)] || 'publicación') : '';
  if (evento === 'publicada') {
    notificar(negocioId, { titulo: `Se publicó tu ${formato} en Instagram`, cuerpo: (item.variants[item.variantIndex] || '').slice(0, 120), url: '/app#cola', tag: 'publicada' });
  } else if (evento === 'fallida') {
    notificar(negocioId, { titulo: `No se pudo publicar tu ${formato}`, cuerpo: (item.publicacion && item.publicacion.motivo) || 'Revísala en Por aprobar y usa "Reintentar".', url: '/app#cola', tag: 'fallida-' + item.id, urgente: true });
  } else if (evento === 'reconectar') {
    notificar(negocioId, { titulo: 'Instagram se desconectó', cuerpo: 'Tus publicaciones programadas esperan hasta que lo vuelvas a conectar en Conexiones y ajustes.', url: '/app#config', tag: 'reconectar', urgente: true });
  }
}

// Recordatorio de los lunes (desde las 9:00, una vez por semana): cuántas
// piezas esperan aprobación. Solo a quien activó las notificaciones.
async function recordatoriosSemanales(ahora = new Date()) {
  const p = programacion.partesEnZona(ahora);
  const lunes = new Date(Date.UTC(p.anio, p.mes - 1, p.dia)).getUTCDay() === 1;
  if (!lunes || p.hora < 9) return 0;
  const semana = avisos.semanaISO(p);
  let n = 0;
  for (const negocio of store.listNegocios()) {
    if ((negocio.avisos || {}).ultimaSemanaPush === semana || !push.dispositivos(negocio.id).length) continue;
    const fresco = store.getNegocio(negocio.id);
    fresco.avisos = Object.assign({}, fresco.avisos, { ultimaSemanaPush: semana });
    store.saveNegocio(fresco);
    const pendientes = store.getContenido(negocio.id).filter((i) => i.status === 'pendiente').length;
    const mensaje = pendientes
      ? { titulo: `Tienes ${pendientes} publicacion${pendientes === 1 ? '' : 'es'} por aprobar`, cuerpo: 'Apruébalas en un par de minutos y se publican solas en su fecha.', url: '/app#cola', tag: 'semana' }
      : { titulo: 'Tu semana está vacía', cuerpo: 'Genera la próxima semana de contenido: Rubrofy la deja lista para aprobar.', url: '/app#cola', tag: 'semana' };
    if (await push.enviar(negocio.id, mensaje)) n += 1;
  }
  return n;
}
// Rubrofy es solo de pago. Una cuenta administradora (ADMIN_EMAILS) sin
// plan recibe Estudio de cortesía, marcado para que no cuente como ingreso
// en /admin; si tiene un plan (pagado), se respeta. Da acceso al plan, no
// al contenido de otros negocios.
function planDeCortesia(negocio) {
  const esAdmin = admin.esAdmin(negocio);
  if (esAdmin && (negocio.plan || 'gratis') === 'gratis') {
    negocio.plan = 'estudio';
    negocio.cortesia = true;
    return true;
  }
  if (negocio.cortesia && (!esAdmin || negocio.plan !== 'estudio' || pagos.activa(negocio))) {
    // Dejó de ser administrador (vuelve a sin plan) o ya paga (manda su plan).
    if (!esAdmin && negocio.plan === 'estudio') negocio.plan = 'gratis';
    delete negocio.cortesia;
    return true;
  }
  return false;
}
// Al arrancar: cortesías al día y fin de las pruebas con código que quedaron
// de una versión anterior (las de 7 días del formulario no se tocan).
for (const n of store.listNegocios()) {
  let cambio = false;
  if (n.prueba && n.prueba.codigo) {
    const suscrito = pagos.suscrito(n);
    if (!suscrito) n.plan = 'gratis';
    delete n.prueba;
    cambio = true;
  }
  if (planDeCortesia(n)) cambio = true;
  if (cambio) store.saveNegocio(n);
}
store.db.exec('DROP TABLE IF EXISTS canjes; DROP TABLE IF EXISTS codigos;');
// Reels editados: el resultado reemplaza al video de la pieza (el original
// se guarda para poder volver a él).
edicionReels.iniciar({
  alCosto: (negocioId, segundos) => costos.audio(negocioId, 'openai', process.env.OPENAI_TRANSCRIPCION_MODEL || 'whisper-1', segundos),
  alTerminar: async ({ negocioId, itemId, ok, archivoTemporal, info, error }) => {
    const items = store.getContenido(negocioId);
    const it = encontrarItem(items, itemId);
    if (!it) return;
    if (!ok) {
      it.edicion = { estado: 'error', error: String(error || '').slice(0, 300), terminadoEl: new Date().toISOString() };
      store.saveContenido(negocioId, items);
      registrarUsoIA(negocioId, 'usoReelsEditados', -1); // no se cobra una edición que falló
      notificar(negocioId, { titulo: 'No se pudo editar tu reel', cuerpo: 'Revisa el video en la tarjeta e intenta de nuevo.', url: '/app#cola', tag: 'edicion-' + itemId });
      return;
    }
    const archivo = `${itemId}-ed-${Date.now()}.mp4`;
    fs.mkdirSync(store.videoDir(negocioId), { recursive: true });
    fs.renameSync(archivoTemporal, store.videoAbsolutePath(negocioId, archivo));
    if (!it.videoOriginal) it.videoOriginal = it.video;
    else if (it.video && it.video.archivo !== it.videoOriginal.archivo) store.borrarVideo(negocioId, it.video.archivo);
    const bytes = fs.statSync(store.videoAbsolutePath(negocioId, archivo)).size;
    it.video = { archivo, bytes, editado: true, subidoEl: new Date().toISOString() };
    it.edicion = { estado: 'lista', duracion: Math.round(info.duracion * 10) / 10, subtitulos: info.subtitulos, terminadoEl: new Date().toISOString() };
    descartarContenedor(it);
    store.saveContenido(negocioId, items);
    notificar(negocioId, { titulo: 'Tu reel editado está listo', cuerpo: 'Revísalo en la tarjeta y apruébalo cuando te guste.', url: '/app#cola', tag: 'edicion-' + itemId });
  },
});

// Prueba gratis (server/prueba-gratis.js): aviso 2 días antes y al terminar.
function revisarPruebas(ahora = Date.now()) {
  for (const a of pruebaGratis.revisar(ahora)) {
    notificar(a.negocioId, a.tipo === 'termino'
      ? { titulo: 'Terminó tu prueba gratis de Rubrofy', cuerpo: 'Elige tu plan para seguir creando y publicando. Todo lo que armaste sigue aquí.', url: '/app#config', tag: 'prueba' }
      : { titulo: 'Tu prueba gratis termina en 2 días', cuerpo: 'Elige tu plan para no cortar tus publicaciones programadas.', url: '/app#config', tag: 'prueba' });
  }
  // Planes de regalo vencidos (/admin → Beneficios).
  for (const id of beneficios.revisarRegalos(pagos.suscrito, ahora)) {
    notificar(id, { titulo: 'Terminó tu plan de regalo', cuerpo: 'Elige tu plan para seguir creando y publicando. Todo lo que armaste sigue aquí.', url: '/app#config', tag: 'regalo' });
  }
  // Referidos: cuando el invitado ya paga, los dos reciben créditos.
  try { creditos.revisarReferidos((n) => pagos.activa(n)); } catch (err) { console.error('referidos:', err.message); }
}
revisarPruebas();
// Flow: se revisan las suscripciones cada 6 horas (FLOW_REVISION_SEG) por si
// un aviso de cobro no llegó, y un minuto después de arrancar.
cobroFlow.configurar({ planDeCortesia, notificar });
let ultimaRevisionFlow = 0;
const revisarFlow = () => { if (pagos.proveedor() === 'flow') cobroFlow.sincronizarTodas().catch((err) => console.error('Flow:', err.message)); };
setTimeout(revisarFlow, 60 * 1000).unref();
setInterval(revisarFlow, (Number(process.env.FLOW_REVISION_SEG) || 6 * 3600) * 1000).unref();
const timerRecordatorios = setInterval(() => { recordatoriosSemanales().catch(() => {}); revisarPruebas(); }, (Number(process.env.RECORDATORIOS_INTERVALO_SEG) || 30 * 60) * 1000);
timerRecordatorios.unref();

// Videos con IA: cuando uno termina, queda como el video de la pieza.
const sondeoMedios = medios.crearSondeo(async (t, r) => {
  const items = store.getContenido(t.negocio_id);
  const it = encontrarItem(items, t.item_id);
  if (!it) {
    if (r.ok) store.borrarVideo(t.negocio_id, r.archivo);
    return;
  }
  if (r.ok && !(it.video && !it.video.generadoIA)) {
    if (it.video && it.video.archivo !== r.archivo) store.borrarVideo(t.negocio_id, it.video.archivo);
    it.video = { archivo: r.archivo, bytes: r.bytes, subidoEl: new Date().toISOString(), generadoIA: true };
    it.videoIA = { estado: 'listo', terminadoEl: new Date().toISOString() };
    descartarContenedor(it);
    const mv = creditos.config().modelos.find((m) => m.id === t.modelo);
    costos.video(t.negocio_id, t.proveedor, mv ? mv.ruta : medios.estado().modeloVideo, t.segundos || 5, mv ? mv.usd : undefined);
    notificar(t.negocio_id, { titulo: 'Tu video con IA está listo', cuerpo: 'Revísalo en la tarjeta y aprueba la pieza cuando te guste.', url: '/app#cola', tag: 'video-' + it.id });
  } else if (r.ok) {
    store.borrarVideo(t.negocio_id, r.archivo); // mientras tanto subió uno real: gana el real
    delete it.videoIA;
  } else {
    it.videoIA = { estado: 'error', error: r.error };
    let cobro = null;
    try { cobro = t.cobro ? JSON.parse(t.cobro) : null; } catch { cobro = null; }
    if (cobro) creditos.devolver(t.negocio_id, cobro, 'Devolución: el video no se pudo generar'); // no se cobra un video que no llegó
    notificar(t.negocio_id, { titulo: 'El video con IA no se pudo generar', cuerpo: `${r.error}. Te devolvimos los créditos.`, url: '/app#cola', tag: 'video-' + it.id });
  }
  store.saveContenido(t.negocio_id, items);
});

const avisador = avisos.crearAvisador({
  listarNegocios: () => store.listNegocios(),
  datosDe: (negocio) => ({ negocioPublico: negocioPublico(negocio), ruta: calcularRuta(negocio), contenido: store.getContenido(negocio.id) }),
  urlPublica: () => (process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : null),
  enlaceBaja: enlaceBajaAvisos,
  guardarAvisoReconectar: (negocioId) => {
    const n = store.getNegocio(negocioId);
    if (!n || !n.instagram) return;
    n.instagram.avisoReconectarEl = new Date().toISOString();
    store.saveNegocio(n);
  },
  guardarEnvio: (negocioId, semana) => {
    const n = store.getNegocio(negocioId);
    if (!n) return;
    n.avisos = Object.assign({}, n.avisos, { ultimaSemana: semana });
    store.saveNegocio(n);
  },
});

const publicador = crearPublicador({
  prepararPublicacion,
  alAvisar: avisoPublicador,
  intervaloMs: (Number(process.env.PUBLICADOR_INTERVALO_SEG) || 30) * 1000,
});

// Deja una pieza aprobada lista para que el publicador la publique en
// `cuando` (ISO), sin perder el contenedor ya creado si lo había.
// Guarda la conexión con Instagram (a mano o con "Conectar con Instagram").
// Lo aprobado antes de conectar, con fecha futura, entra a la cola; lo que
// esperaba una reconexión ya está programado y se publica solo.
function conectarInstagram(negocioId, { userId, accessToken, username, venceEl }, req) {
  const negocio = store.getNegocio(negocioId);
  negocio.instagram = { userId, accessToken, conectadoEl: new Date().toISOString() };
  if (username) negocio.instagram.username = username;
  if (venceEl) negocio.instagram.venceEl = venceEl;
  store.saveNegocio(negocio);
  const items = store.getContenido(negocioId);
  const ahora = Date.now();
  let programadas = 0;
  for (const it of items) {
    const publicable = it.status === 'aprobado' && !it.publicacion && !(it.instagram && it.instagram.ok);
    if (publicable && Date.parse(programacion.asegurarPublicarEl(it)) > ahora) {
      programar(it, it.publicarEl, req);
      programadas += 1;
    }
  }
  if (programadas) store.saveContenido(negocioId, items);
  return negocio;
}

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
  // Una ruta o un Host malformado respondía con una excepción fuera del try
  // que tumbaba el proceso entero: se contesta 400 y listo.
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Solicitud inválida');
  }
  const parts = url.pathname.split('/').filter(Boolean);

  // El webhook de Stripe es una mutación legítima que no viene del panel
  // (no puede llevar la cabecera custom): se autentica con su propia firma
  // HMAC en vez del esquema anti-CSRF de /api.
  const esWebhookStripe = parts[0] === 'api' && parts[1] === 'stripe' && parts[2] === 'webhook';
  // Lo mismo para los avisos y retornos de Flow: llegan del navegador del
  // cliente o de Flow con un token, y el resultado se consulta a Flow.
  const esAvisoFlow = parts[0] === 'api' && parts[1] === 'flow' && parts.length === 3;

  // GET /api/salud — para el healthcheck de Railway: responde 200 si el
  // servidor atiende y la base de datos contesta.
  if (url.pathname === '/api/salud' && req.method === 'GET') {
    try {
      store.db.prepare('SELECT 1').get();
      return sendJSON(res, 200, { ok: true, version: VERSION, edicionReels: edicionReels.disponible() });
    } catch (err) {
      return sendJSON(res, 503, { ok: false, error: 'La base de datos no responde' });
    }
  }

  const esSubidaVideo = parts[0] === 'api' && parts[1] === 'negocios' && parts[3] === 'contenido'
    && parts[5] === 'video' && parts.length === 6 && req.method === 'POST';
  const mutando = req.method !== 'GET' && req.method !== 'HEAD';
  if (parts[0] === 'api' && mutando && !esWebhookStripe && !esAvisoFlow && !peticionLegitima(req, esSubidaVideo)) {
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
          const trozos = [];
          let largo = 0;
          req.on('data', (chunk) => { largo += chunk.length; if (largo > 1e6) { req.destroy(); return reject(new Error('Cuerpo demasiado grande')); } trozos.push(chunk); });
          // En bytes: la firma de Stripe falla si un acento queda partido entre trozos.
          req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')));
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

        if (evento.type === 'checkout.session.completed' && evento.data.object.metadata && evento.data.object.metadata.tipo === 'recarga') {
          // Recarga pagada: se acredita una sola vez aunque Stripe repita el evento.
          const session = evento.data.object;
          if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
            const lote = recargas.acreditar(session.metadata.recargaId, { sesion: session.id });
            if (lote) {
              const p = recargas.paquete(lote.paquete);
              notificar(lote.negocio_id, { titulo: 'Recarga lista', cuerpo: `Se cargaron ${lote.cantidad} ${recargas.TIPOS[lote.tipo].nombre}. Ya puedes seguir creando.`, url: '/app', tag: 'recarga' });
              if (!p) console.log(`Recarga ${lote.id} con un paquete que ya no existe`);
            }
          }
        } else if (evento.type === 'checkout.session.completed') {
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
            // Con la prueba gratis vigente: si paga, la prueba termina; si una
            // suscripción se cae, conserva la prueba hasta su fecha.
            const enPrueba = pruebaGratis.vigente(negocio);
            if (activa && enPrueba) negocio.prueba.terminada = 'suscripcion';
            if (activa) beneficios.terminarRegalo(negocio, 'suscripcion', { suscrito: true });
            negocio.plan = activa ? (planIdDesdePriceId(priceId) || negocio.plan || 'gratis') : (enPrueba ? negocio.prueba.plan : beneficios.planSinPago(negocio));
            planDeCortesia(negocio);
            store.saveNegocio(negocio);
          }
        }

        return sendJSON(res, 200, { recibido: true });
      }

      // Flow (server/cobro-flow.js). Todos reciben un token (POST de
      // formulario o en la URL) y le preguntan a Flow el resultado.
      //   /api/flow/confirmacion  aviso de Flow: pago de una recarga
      //   /api/flow/retorno       vuelve el cliente de pagar una recarga → /app
      //   /api/flow/tarjeta       vuelve el cliente de inscribir su tarjeta → /app
      //   /api/flow/plan          aviso de Flow: cobro de una suscripción
      if (esAvisoFlow && ['POST', 'GET'].includes(req.method)) {
        if (!pagos.proveedor() || pagos.proveedor() !== 'flow') return notFound(res);
        const token = req.method === 'POST' ? (await leerFormulario(req)).get('token') : url.searchParams.get('token');
        const accion = parts[2];
        const redirigir = (destino) => { res.writeHead(303, { Location: destino, 'Cache-Control': 'no-store' }); res.end(); };
        if (accion === 'plan') {
          // No dice de qué suscripción es: se revisan todas, a lo más una vez por minuto.
          if (Date.now() - ultimaRevisionFlow > (process.env.FLOW_AVISO_PLAN_SEG ? Number(process.env.FLOW_AVISO_PLAN_SEG) : 60) * 1000) {
            ultimaRevisionFlow = Date.now();
            cobroFlow.sincronizarTodas().catch((err) => console.error('Flow:', err.message));
          }
          return sendJSON(res, 200, { recibido: true });
        }
        if (!token || String(token).length > 200) return accion === 'confirmacion' ? sendJSON(res, 400, { error: 'Falta el token' }) : redirigir('/app');
        if (accion === 'confirmacion') {
          const r = await cobroFlow.confirmarPago(token);
          return sendJSON(res, r.estado === 'error' ? 500 : 200, { estado: r.estado });
        }
        if (accion === 'retorno') {
          const r = await cobroFlow.confirmarPago(token);
          return redirigir(`/app?recarga=${r.estado === 'pagado' || r.estado === 'pendiente' ? 'exito' : 'cancelada'}`);
        }
        if (accion === 'tarjeta') {
          const r = await cobroFlow.retornoTarjeta(token, urlBase(req));
          return redirigir(`/app?checkout=${r.resultado}`);
        }
        return notFound(res);
      }

      // GET /api/plan-contenido — opciones de la bienvenida (objetivos, tonos, ritmos).
      if (parts[1] === 'plan-contenido' && parts.length === 2 && req.method === 'GET') {
        return sendJSON(res, 200, planContenido.catalogo());
      }

      // GET /api/planes — pública: la necesita el sitio y el panel para mostrar precios.
      // GET /api/prueba-gratis — plan, días y opciones del formulario.
      if (parts[1] === 'prueba-gratis' && parts.length === 2 && req.method === 'GET') {
        return sendJSON(res, 200, pruebaGratis.catalogo());
      }

      // GET /api/recargas — paquetes y precios (server/recargas.js).
      if (parts[1] === 'recargas' && parts.length === 2 && req.method === 'GET') {
        return sendJSON(res, 200, recargas.catalogo());
      }

      if (parts[1] === 'planes' && parts.length === 2 && req.method === 'GET') {
        return sendJSON(res, 200, listPlanesPublico());
      }

      // POST /api/auth/registro  { nombre, rubro, email, password, datos, ref? }
      // ref: código de invitación de otro negocio (créditos para ambos cuando paga).
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
        if (body.acepto !== true) return sendJSON(res, 400, { error: 'Para crear la cuenta tienes que aceptar los términos y la política de privacidad' });
        if (buscarNegocioPorEmail(email)) return sendJSON(res, 409, { error: 'Ya existe una cuenta con ese email' });
        // Los emails no se verifican al registrarse: un email de ADMIN_EMAILS
        // sin cuenta no puede crearse aquí (si no, quien lo conozca se haría
        // administrador). La cuenta administradora se crea antes de listarla.
        if (admin.adminEmails().includes(email)) return sendJSON(res, 409, { error: 'Ese email no está disponible' });
        // Prueba gratis pedida al registrarse: el formulario se valida antes de crear la cuenta.
        const pidePrueba = body.prueba && typeof body.prueba === 'object';
        if (pidePrueba) {
          const v = pruebaGratis.validar(body.prueba, email);
          if (v.error) return sendJSON(res, 400, { error: v.error, campo: 'prueba.' + v.campo });
        }

        const id = idUnico(slugify(nombre));
        const estrategia = await generarEstrategia({ nombre, rubro, negocioId: id });
        const negocio = {
          id,
          nombre,
          estrategia,
          email,
          auth: auth.hashPassword(password),
          marca: { color: '#ff4d94' },
          plan: 'gratis',
          estiloImagen: 'limpia',
          creadoEl: new Date().toISOString(),
          aceptoTerminosEl: new Date().toISOString(), // versión: la de /terminos.html y /privacidad.html a esa fecha
          ultimoAcceso: new Date().toISOString(),
          datos: {
            precioDesde: body.datos && body.datos.precioDesde ? String(body.datos.precioDesde).trim() : '',
            unidad: body.datos && body.datos.unidad ? String(body.datos.unidad).trim() : '',
            promo: body.datos && body.datos.promo ? String(body.datos.promo).trim() : '',
            productoDestacado: body.datos && body.datos.productoDestacado ? String(body.datos.productoDestacado).trim() : '',
          },
        };
        const padrino = body.ref ? creditos.negocioDeCodigo(body.ref) : null;
        if (padrino) negocio.referidoPor = padrino.id;
        store.saveNegocio(negocio);
        if (pidePrueba) {
          const r = pruebaGratis.activar(negocio, body.prueba);
          if (r.negocio) store.saveNegocio(r.negocio);
        }
        if (correo.configurado()) {
          correo.enviar(avisos.correoBienvenida({ negocio, urlPanel: urlPublica(req) + '/app' }))
            .then((r) => { if (!r.ok) console.log(`Bienvenida de ${id} no enviada: ${r.error}`); });
        }
        // Sin contenido todavía: la bienvenida del panel pregunta objetivo,
        // público y cuánto publicar, y con eso genera la primera semana.
        const cookie = auth.cookieSesion(req, auth.crearSesion(id));
        return sendJSON(res, 201, negocioPublico(negocio), { 'Set-Cookie': cookie });
      }

      // POST /api/auth/recuperar { email } — manda un enlace para elegir una
      // clave nueva. Responde lo mismo exista o no la cuenta.
      if (parts[1] === 'auth' && parts[2] === 'recuperar' && parts.length === 3 && req.method === 'POST') {
        const ip = ipCliente(req);
        const espera = limiteRecuperar.esperaSegundos(ip);
        if (espera) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un rato e intenta de nuevo.' }, { 'Retry-After': String(espera) });
        limiteRecuperar.registrar(ip);
        const body = await readBody(req);
        const negocio = buscarNegocioPorEmail(body.email);
        if (negocio && negocio.auth && correo.configurado()) {
          const enlace = `${urlPublica(req)}/app/restablecer.html?n=${encodeURIComponent(negocio.id)}&t=${tokenClave(negocio)}`;
          // Sin esperar el envío: la respuesta tarda lo mismo exista o no la cuenta.
          correo.enviar(avisos.correoClave({ negocio, enlace }))
            .then((r) => { if (!r.ok) console.log(`No se pudo enviar el correo de clave a ${negocio.id}: ${r.error}`); });
        }
        return sendJSON(res, 200, { ok: true, correoDisponible: correo.configurado() });
      }

      // POST /api/auth/restablecer { n, t, password } — guarda la clave nueva
      // y cierra las sesiones abiertas en otros dispositivos.
      if (parts[1] === 'auth' && parts[2] === 'restablecer' && parts.length === 3 && req.method === 'POST') {
        const body = await readBody(req);
        const negocio = store.getNegocio(String(body.n || ''));
        if (!tokenClaveValido(negocio, body.t)) return sendJSON(res, 400, { error: 'El enlace venció o ya se usó. Pide uno nuevo.' });
        const password = String(body.password || '');
        if (password.length < 8) return sendJSON(res, 400, { error: 'La clave debe tener al menos 8 caracteres' });
        negocio.auth = auth.hashPassword(password);
        negocio.sesionesDesde = new Date().toISOString();
        negocio.ultimoAcceso = negocio.sesionesDesde;
        store.saveNegocio(negocio);
        const cookie = auth.cookieSesion(req, auth.crearSesion(negocio.id));
        return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': cookie });
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
        planDeCortesia(negocio);
        negocio.ultimoAcceso = new Date().toISOString();
        store.saveNegocio(negocio);
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
        // Última actividad (para el panel de administración), como mucho una vez por hora.
        if (!negocio.ultimoAcceso || Date.now() - Date.parse(negocio.ultimoAcceso) > 3600000) {
          negocio.ultimoAcceso = new Date().toISOString();
          store.saveNegocio(negocio);
        }
        return sendJSON(res, 200, negocioPublico(negocio));
      }

      // Panel de administración (server/admin.js): solo cuentas en ADMIN_EMAILS.
      // Para cualquier otro, no existe (404).
      //   GET /api/admin/resumen?dias=30 · GET /api/admin/negocios
      //   GET/PUT /api/admin/contexto-ia — reglas de la plataforma para la IA
      if (parts[1] === 'admin' && ['GET', 'PUT', 'POST'].includes(req.method)) {
        const quien = store.getNegocio(sesionActual(req) || '');
        if (!admin.activo() || !admin.esAdmin(quien)) return sendJSON(res, 404, { error: 'No encontrado' });
        if (parts[2] === 'contexto-ia' && parts.length === 3) {
          const vista = () => ({
            contexto: contextoIA.dePlataforma(), secciones: contextoIA.catalogo(),
            proveedores: Object.assign({ textos: process.env.ANTHROPIC_API_KEY ? require('./claude').MODEL : null }, medios.estado(),
              medios.proveedorImagen() === 'higgsfield' ? { modeloImagen: 'Según la calidad (ver Créditos)', modeloVideo: 'Según la calidad (ver Créditos)' } : {}),
          });
          if (req.method === 'PUT') contextoIA.guardarPlataforma(await readBody(req));
          return sendJSON(res, 200, vista());
        }
        // Créditos ⚡ (server/creditos.js):
        //   GET  /api/admin/creditos            parámetros, modelos, packs, planes, promociones y estado
        //   PUT  /api/admin/creditos            guarda lo editado (se valida)
        //   POST /api/admin/creditos/reanudar   quita la pausa por falta de saldo del proveedor
        if (parts[2] === 'creditos') {
          if (req.method === 'GET' && parts.length === 3) return sendJSON(res, 200, creditos.resumenAdmin());
          if (req.method === 'PUT' && parts.length === 3) {
            const r = creditos.guardarConfig(await readBody(req));
            if (r.error) return sendJSON(res, 400, { error: r.error });
            return sendJSON(res, 200, creditos.resumenAdmin());
          }
          if (req.method === 'POST' && parts[3] === 'reanudar' && parts.length === 4) {
            creditos.reanudar();
            return sendJSON(res, 200, creditos.resumenAdmin());
          }
          return sendJSON(res, 404, { error: 'No encontrado' });
        }
        // Beneficios (server/beneficios.js):
        //   GET  /api/admin/beneficios                  regalos, códigos y cuentas para elegir
        //   POST /api/admin/beneficios/regalo           { negocioId, plan, meses, motivo }
        //   POST /api/admin/beneficios/regalo/revocar   { negocioId }
        //   POST /api/admin/beneficios/codigo           { codigo, tipo, valor, planes, meses, maxUsos, venceEl, nota }
        //   POST /api/admin/beneficios/codigo/estado    { codigo, activo }
        if (parts[2] === 'beneficios') {
          const vista = () => ({
            regalos: beneficios.listarRegalos(), codigos: beneficios.listarCodigos(),
            codigosConFlow: pagos.proveedor() === 'flow',
            cuentas: store.listNegocios().map((n) => ({ id: n.id, nombre: n.nombre, email: n.email || '', plan: n.plan || 'gratis', paga: pagos.activa(n), regalo: beneficios.regaloVigente(n) })),
          });
          if (req.method === 'GET' && parts.length === 3) return sendJSON(res, 200, vista());
          if (req.method !== 'POST') return sendJSON(res, 404, { error: 'No encontrado' });
          const body = await readBody(req);
          if (parts[3] === 'regalo' && parts.length === 4) {
            const n = store.getNegocio(String(body.negocioId || ''));
            if (!n) return sendJSON(res, 404, { error: 'No encontramos esa cuenta' });
            const r = beneficios.regalar(n, body, { suscrito: pagos.suscrito(n) });
            if (r.error) return sendJSON(res, 400, { error: r.error });
            store.saveNegocio(r.negocio);
            const pl = getPlan(r.negocio.planRegalado.plan);
            notificar(n.id, { titulo: `Te regalamos el plan ${pl.nombre}`, cuerpo: r.negocio.planRegalado.hasta ? 'Úsalo sin costo hasta la fecha que ves en tu panel.' : 'Ya puedes usarlo sin costo.', url: '/app#config', tag: 'regalo' });
            return sendJSON(res, 200, vista());
          }
          if (parts[3] === 'regalo' && parts[4] === 'revocar' && parts.length === 5) {
            const n = store.getNegocio(String(body.negocioId || ''));
            if (!n || !n.planRegalado) return sendJSON(res, 404, { error: 'Esa cuenta no tiene un plan de regalo' });
            beneficios.terminarRegalo(n, 'revocado', { suscrito: pagos.suscrito(n) });
            store.saveNegocio(n);
            return sendJSON(res, 200, vista());
          }
          if (parts[3] === 'codigo' && parts.length === 4) {
            const r = beneficios.crearCodigo(body);
            if (r.error) return sendJSON(res, 400, { error: r.error, campo: r.campo });
            return sendJSON(res, 200, vista());
          }
          if (parts[3] === 'codigo' && parts[4] === 'estado' && parts.length === 5) {
            if (!beneficios.activarCodigo(body.codigo, !!body.activo)) return sendJSON(res, 404, { error: 'Ese código no existe' });
            return sendJSON(res, 200, vista());
          }
          return sendJSON(res, 404, { error: 'No encontrado' });
        }
        if (req.method !== 'GET') return sendJSON(res, 404, { error: 'No encontrado' });
        if (parts[2] === 'resumen' && parts.length === 3) {
          const dias = [7, 30, 90].includes(Number(url.searchParams.get('dias'))) ? Number(url.searchParams.get('dias')) : 30;
          return sendJSON(res, 200, admin.resumen({ dias, calcularRuta, inicio: INICIO, version: VERSION }));
        }
        if (parts[2] === 'negocios' && parts.length === 3) {
          return sendJSON(res, 200, admin.negocios({ calcularRuta }));
        }
        // GET /api/admin/costos?dias=30 — gasto en IA (solo cifras de uso)
        // GET /api/admin/recargas?dias=30 — ventas de recargas y tu ganancia estimada.
        if (parts[2] === 'recargas' && parts.length === 3) {
          const dias = [7, 30, 90].includes(Number(url.searchParams.get('dias'))) ? Number(url.searchParams.get('dias')) : 30;
          const nombreDe = (id) => { const n = store.getNegocio(id); return n ? n.nombre : '(eliminado)'; };
          return sendJSON(res, 200, Object.assign(recargas.resumenAdmin({ dias, nombreDe }), {
            paquetes: recargas.todos().map((p) => Object.assign({ id: p.id, nombre: `${p.cantidad} ${recargas.TIPOS[p.tipo].nombre}`, precioClp: p.precioClp }, recargas.cuentas(p))),
          }));
        }
        // GET /api/admin/pruebas — quién pidió la prueba gratis (datos del formulario) y en qué quedó.
        if (parts[2] === 'pruebas' && parts.length === 3) {
          const lista = pruebaGratis.listar();
          const cuenta = (e) => lista.filter((x) => x.estado === e).length;
          return sendJSON(res, 200, { catalogo: pruebaGratis.catalogo(), total: lista.length, enPrueba: cuenta('en prueba'), pagando: cuenta('pagando'), sinPagar: cuenta('terminó sin pagar'), prospectos: lista });
        }
        if (parts[2] === 'costos' && parts.length === 3) {
          const dias = [7, 30, 90].includes(Number(url.searchParams.get('dias'))) ? Number(url.searchParams.get('dias')) : 30;
          return sendJSON(res, 200, costos.resumen({
            dias, negocios: store.listNegocios().map((n) => ({ id: n.id, nombre: n.nombre, plan: n.plan, cortesia: !!n.cortesia || beneficios.regaloVigente(n) })),
            precioPlan: (p) => getPlan(p).precioClp || 0,
          }));
        }
        return sendJSON(res, 404, { error: 'No encontrado' });
      }

      // GET /api/negocios/:id/informe?mes=AAAA-MM&t=... — informe compartido
      // por enlace firmado (sin sesión): lo puede abrir el cliente de una
      // agencia o un socio. Solo lectura, solo ese mes, vence a los 30 días.
      if (parts[1] === 'negocios' && parts[3] === 'informe' && parts.length === 4 && req.method === 'GET'
        && url.searchParams.get('t') && sesionActual(req) !== parts[2]) {
        const mes = url.searchParams.get('mes');
        const negocioCompartido = store.getNegocio(parts[2]);
        if (!negocioCompartido || !informe.mesValido(mes)
          || !auth.verificarTokenFoto(url.searchParams.get('t'), parts[2], 'informe', mes)) {
          return sendJSON(res, 404, { error: 'El enlace no es válido o ya venció' });
        }
        return sendJSON(res, 200, Object.assign(informe.datos(negocioCompartido, mes, estadisticasAprobacion), { compartido: true }));
      }

      // GET /api/avisos/baja?n&t — enlace "No quiero recibirlo más" del resumen semanal
      // GET /api/push/clave — clave pública VAPID para suscribirse (no es secreta)
      if (parts[1] === 'push' && parts[2] === 'clave' && parts.length === 3 && req.method === 'GET') {
        return sendJSON(res, 200, { clave: push.clavePublica() });
      }

      if (parts[1] === 'avisos' && parts[2] === 'baja' && parts.length === 3 && req.method === 'GET') {
        const id = url.searchParams.get('n');
        const n = id && store.getNegocio(id);
        const valido = n && auth.verificarTokenFoto(url.searchParams.get('t'), id, 'avisos', 'baja');
        if (valido) {
          n.avisos = Object.assign({}, n.avisos, { semanal: false });
          store.saveNegocio(n);
        }
        res.writeHead(valido ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Rubrofy</title>
          <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#140f0a;color:#f5efe4;font-family:Arial,sans-serif;padding:24px">
          <div style="max-width:420px;text-align:center"><h1 style="font-size:22px">${valido ? 'Listo: ya no recibirás el resumen semanal' : 'El enlace no es válido o ya venció'}</h1>
          <p style="color:#b9a892">${valido ? 'Puedes volver a activarlo cuando quieras en Conexiones y ajustes.' : 'Puedes desactivar el resumen en Conexiones y ajustes.'}</p>
          <p><a href="/app" style="color:#ffac2b">Ir a mi panel</a></p></div></body></html>`);
      }

      // GET /api/instagram/callback?code&state — vuelta de "Conectar con
      // Instagram". Igual que Google: state firmado, ligado al negocio y a la sesión.
      if (parts[1] === 'instagram' && parts[2] === 'callback' && parts.length === 3 && req.method === 'GET') {
        const volver = (q) => { res.writeHead(302, { Location: '/app?' + new URLSearchParams(q) }); res.end(); };
        const [negocioId, nonce, firma] = String(url.searchParams.get('state') || '').split('.');
        const firmaOk = negocioId && nonce && firma && auth.verificarTokenFoto(firma.replace(/_/g, '.'), negocioId, 'instagram-oauth', nonce);
        if (!firmaOk || sesionActual(req) !== negocioId) return volver({ instagram: 'error', motivo: 'La conexión venció o no corresponde a tu sesión. Intenta de nuevo.' });
        if (url.searchParams.get('error')) return volver({ instagram: 'error', motivo: 'No se dieron los permisos en Instagram.' });
        try {
          const r = await instagram.conectarConCodigo(url.searchParams.get('code'), urlPublica(req) + '/api/instagram/callback');
          conectarInstagram(negocioId, {
            userId: r.userId, accessToken: r.accessToken, username: r.username,
            venceEl: new Date(Date.now() + r.expiraEnSeg * 1000).toISOString(),
          }, req);
          return volver({ instagram: 'ok' });
        } catch (err) {
          return volver({ instagram: 'error', motivo: 'No se pudo conectar Instagram: ' + err.message });
        }
      }

      // GET /api/google/callback?code&state — vuelta de "Iniciar sesión con
      // Google". El state va firmado y ligado al negocio, y además tiene que
      // coincidir con la sesión: nadie puede enganchar su Google a otra cuenta.
      if (parts[1] === 'google' && parts[2] === 'callback' && parts.length === 3 && req.method === 'GET') {
        const volver = (q) => { res.writeHead(302, { Location: '/app?' + new URLSearchParams(q) }); res.end(); };
        const [negocioId, nonce, firma] = String(url.searchParams.get('state') || '').split('.');
        const firmaOk = negocioId && nonce && firma && auth.verificarTokenFoto(firma.replace(/_/g, '.'), negocioId, 'google-oauth', nonce);
        if (!firmaOk || sesionActual(req) !== negocioId) return volver({ google: 'error', motivo: 'La conexión venció o no corresponde a tu sesión. Intenta de nuevo.' });
        if (url.searchParams.get('error')) return volver({ google: 'error', motivo: 'No se dio permiso en Google.' });
        try {
          const tokens = await google.canjearCodigo(url.searchParams.get('code'), urlPublica(req) + '/api/google/callback');
          if (!tokens.refresh_token) return volver({ google: 'error', motivo: 'Google no entregó acceso permanente; quita el acceso de Rubrofy en tu cuenta de Google y vuelve a conectar.' });
          const opciones = await google.cuentasAccesibles(tokens.refresh_token);
          const n = store.getNegocio(negocioId);
          n.google = { refreshToken: tokens.refresh_token, opciones, conectadoEl: new Date().toISOString() };
          if (opciones.length === 1) {
            Object.assign(n.google, { customerId: opciones[0].id, nombre: opciones[0].nombre, moneda: opciones[0].moneda, loginCustomerId: opciones[0].loginCustomerId });
            delete n.google.opciones;
          }
          store.saveNegocio(n);
          if (n.google.customerId) await google.sincronizar(negocioId);
          return volver({ google: opciones.length ? 'ok' : 'sin-cuentas' });
        } catch (err) {
          return volver({ google: 'error', motivo: 'No se pudo conectar con Google Ads: ' + err.message });
        }
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
          // Con los datos nuevos (precio, promo...) cambia qué hay que
          // verificar en las piezas que todavía no salen.
          const piezas = store.getContenido(negocioId);
          for (const it of piezas) {
            if (!(it.publicacion && it.publicacion.estado === 'publicada')) guardian.aplicar(it, negocio);
          }
          store.saveContenido(negocioId, piezas);
          return sendJSON(res, 200, negocioPublico(negocio));
        }

        // DELETE /api/negocios/:id
        if (parts.length === 3 && req.method === 'DELETE') {
          if (negocio.stripe && negocio.stripe.subscriptionId) {
            await stripe.cancelarSuscripcion(negocio.stripe.subscriptionId);
          }
          await cobroFlow.cancelarYa(negocio);
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
          return sendJSON(res, 200, negocioPublico(conectarInstagram(negocioId, { userId, accessToken }, req)));
        }

        // GET /api/negocios/:id/instagram/conectar — "Conectar con Instagram":
        // lleva al inicio de sesión de Instagram con un state firmado.
        if (parts[3] === 'instagram' && parts[4] === 'conectar' && parts.length === 5 && req.method === 'GET') {
          if (!instagram.loginConfigurado()) {
            res.writeHead(302, { Location: '/app?' + new URLSearchParams({ instagram: 'error', motivo: 'El inicio de sesión con Instagram no está configurado en este servidor. Usa el ID y el token.' }) });
            return res.end();
          }
          const nonce = google.nuevoEstadoOAuth();
          const firma = auth.crearTokenFoto(negocioId, 'instagram-oauth', nonce, 15).replace(/\./g, '_');
          res.writeHead(302, { Location: instagram.urlLogin(urlPublica(req) + '/api/instagram/callback', `${negocioId}.${nonce}.${firma}`) });
          return res.end();
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
          // Con Flow: inscribir la tarjeta en Flow (devuelve { url }) o, si ya
          // hay suscripción o tarjeta, cambiar/crear la suscripción al tiro.
          if (body.codigo && pagos.proveedor() !== 'flow') return sendJSON(res, 400, { error: 'Los códigos de descuento todavía no están disponibles' });
          if (pagos.proveedor() === 'flow') {
            const espera = limiteEstrategia.esperaSegundos('cobro:' + negocioId);
            if (espera) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un rato.' });
            limiteEstrategia.registrar('cobro:' + negocioId);
            const r = await cobroFlow.elegirPlan(negocio, planId, urlBase(req), body.codigo ? String(body.codigo) : null);
            if (r.error) return sendJSON(res, r.status || 502, { error: r.error });
            if (r.url) return sendJSON(res, 200, { url: r.url });
            return sendJSON(res, 200, { negocio: negocioPublico(r.negocio || store.getNegocio(negocioId)) });
          }
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
        // Recargas del negocio:
        //   GET  /api/negocios/:id/recargas           saldo e historial
        //   POST /api/negocios/:id/recargas           { paquete } → Stripe Checkout (pago único)
        //   POST /api/negocios/:id/recargas/simular   { paquete } — solo cuentas administradoras, sin cobro
        // GET /api/negocios/:id/creditos — saldo ⚡, opciones con su costo,
        // movimientos y el enlace para invitar a otros negocios.
        if (parts[3] === 'creditos' && parts.length === 4 && req.method === 'GET') {
          const codigo = creditos.codigoReferido(negocio);
          return sendJSON(res, 200, Object.assign(creditos.publico(negocio), {
            movimientos: creditos.movimientos(negocioId),
            referido: { codigo, enlace: `${urlBase(req)}/registro.html?ref=${codigo}`, creditos: creditos.config().promo.referido },
            paquetes: recargas.catalogo().paquetes.filter((p) => p.tipo === 'creditos'),
          }));
        }
        if (parts[3] === 'recargas') {
          if (parts.length === 4 && req.method === 'GET') {
            return sendJSON(res, 200, { saldos: recargas.saldos(negocioId), historial: recargas.historial(negocioId), catalogo: recargas.catalogo() });
          }
          if (req.method === 'POST' && (parts.length === 4 || (parts.length === 5 && parts[4] === 'simular'))) {
            const simular = parts.length === 5;
            const esAdm = admin.esAdmin(negocio);
            if (simular && !esAdm) return sendJSON(res, 404, { error: 'No encontrado' });
            const puede = recargas.puedeComprar(negocio, esAdm);
            if (!puede.ok) return sendJSON(res, 403, { error: puede.motivo });
            const body = await readBody(req);
            const p = recargas.paquete(body.paquete);
            if (!p) return sendJSON(res, 400, { error: 'Elige un paquete' });
            if (simular) {
              const r = recargas.crearPendiente(negocioId, p.id);
              recargas.acreditar(r.id, { simulada: true });
              return sendJSON(res, 200, { simulada: true, negocio: negocioPublico(store.getNegocio(negocioId)) });
            }
            if (!pagos.proveedor()) return sendJSON(res, 503, { error: 'Los pagos todavía no están habilitados. Intenta más tarde.' });
            const espera = limiteEstrategia.esperaSegundos('recarga:' + negocioId);
            if (espera) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un rato.' });
            limiteEstrategia.registrar('recarga:' + negocioId);
            const r = recargas.crearPendiente(negocioId, p.id);
            const base = urlBase(req);
            if (pagos.proveedor() === 'flow') {
              const pf = await cobroFlow.pagarRecarga({ negocio, recarga: r, base });
              if (pf.error) return sendJSON(res, 502, { error: pf.error });
              return sendJSON(res, 200, { url: pf.url });
            }
            const resultado = await stripe.crearCheckoutPago({
              nombre: `Rubrofy · ${p.cantidad} ${recargas.TIPOS[p.tipo].nombre}`, precioClp: p.precioClp, negocioId, recargaId: r.id,
              successUrl: `${base}/app?recarga=exito`, cancelUrl: `${base}/app?recarga=cancelada`,
              customerId: negocio.stripe && negocio.stripe.customerId, email: negocio.email,
            });
            if (resultado.error) return sendJSON(res, 502, { error: resultado.error });
            recargas.registrarSesion(r.id, resultado.data.id);
            return sendJSON(res, 200, { url: resultado.data.url });
          }
        }

        // POST /api/negocios/:id/codigo  { codigo, plan? }
        // Con una suscripción de Flow vigente, aplica el descuento a esa
        // suscripción. Si no, solo revisa el código y dice qué descuento da
        // (se aplica al elegir el plan).
        if (parts[3] === 'codigo' && parts.length === 4 && req.method === 'POST') {
          if (pagos.proveedor() !== 'flow') return sendJSON(res, 400, { error: 'Los códigos de descuento todavía no están disponibles' });
          const espera = limiteEstrategia.esperaSegundos('codigo:' + negocioId);
          if (espera) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un rato.' });
          limiteEstrategia.registrar('codigo:' + negocioId);
          const body = await readBody(req);
          if (cobroFlow.suscripcionVigente(negocio)) {
            const r = await cobroFlow.aplicarCodigo(negocio, String(body.codigo || ''));
            if (r.error) return sendJSON(res, r.status || 502, { error: r.error });
            return sendJSON(res, 200, { aplicado: true, negocio: negocioPublico(r.negocio) });
          }
          const v = beneficios.validarCodigo(String(body.codigo || ''), negocioId, body.plan || null);
          if (v.error) return sendJSON(res, 400, { error: v.error });
          const precios = Object.fromEntries(v.codigo.planes.map((p) => [p, { antes: getPlan(p).precioClp, ahora: beneficios.precioConDescuento(getPlan(p).precioClp, v.codigo) }]));
          return sendJSON(res, 200, { codigo: v.codigo.codigo, descripcion: v.codigo.descripcion, planes: v.codigo.planes, precios });
        }

        // Suscripción con Flow (Flow no tiene un portal como Stripe):
        //   POST /api/negocios/:id/suscripcion/cancelar  se cancela al terminar el período pagado
        //   POST /api/negocios/:id/suscripcion/tarjeta   → { url } para inscribir otra tarjeta
        if (parts[3] === 'suscripcion' && parts.length === 5 && req.method === 'POST') {
          if (!(negocio.flow && negocio.flow.customerId)) return sendJSON(res, 400, { error: 'Todavía no tienes una suscripción para gestionar' });
          if (parts[4] === 'cancelar') {
            const r = await cobroFlow.cancelar(negocio);
            if (r.error) return sendJSON(res, r.status || 502, { error: r.error });
            return sendJSON(res, 200, { negocio: negocioPublico(r.negocio) });
          }
          if (parts[4] === 'tarjeta') {
            const espera = limiteEstrategia.esperaSegundos('cobro:' + negocioId);
            if (espera) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un rato.' });
            limiteEstrategia.registrar('cobro:' + negocioId);
            const fresco = store.getNegocio(negocioId);
            delete fresco.flow.planPendiente;
            store.saveNegocio(fresco);
            const r = await cobroFlow.inscribirTarjeta(fresco, urlBase(req));
            if (r.error) return sendJSON(res, 502, { error: r.error });
            return sendJSON(res, 200, { url: r.url });
          }
        }

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

        // PUT /api/negocios/:id/estrategia  { resumen, tono, enfoques } — cambios a mano
        if (parts[3] === 'estrategia' && parts.length === 4 && req.method === 'PUT') {
          const r = editarEstrategia(negocio.estrategia, await readBody(req));
          if (r.error) return sendJSON(res, 400, { error: r.error });
          negocio.estrategia = r.estrategia;
          negocio.estrategiaRevisadaEl = new Date().toISOString();
          store.saveNegocio(negocio);
          return sendJSON(res, 200, negocio.estrategia);
        }

        // POST /api/negocios/:id/estrategia/generar — la IA la vuelve a
        // proponer con el plan de contenido actual. Mantiene las categorías
        // de foto para no dejar fotos subidas sin categoría.
        if (parts[3] === 'estrategia' && parts[4] === 'generar' && parts.length === 5 && req.method === 'POST') {
          const espera = limiteEstrategia.esperaSegundos(negocioId);
          if (espera) return sendJSON(res, 429, { error: 'Ya propusiste varias estrategias esta hora. Intenta más tarde.' }, { 'Retry-After': String(espera) });
          limiteEstrategia.registrar(negocioId);
          const cuerpoEstrategia = await readBody(req).catch(() => ({}));
          const nueva = await generarEstrategia({
            nombre: negocio.nombre,
            rubro: negocio.estrategia.rubro,
            plan: negocio.planContenido,
            categoriasFoto: negocio.estrategia.categoriasFoto,
            contextoExtra: voz.textoParaPrompt(negocio) + contextoIA.bloque(negocio, ['general', 'voz', 'estrategia'], cuerpoEstrategia && cuerpoEstrategia.indicacion),
            negocioId,
          });
          const actual = store.getNegocio(negocioId); // releído: Claude tarda
          actual.estrategia = nueva;
          actual.estrategiaRevisadaEl = new Date().toISOString();
          store.saveNegocio(actual);
          return sendJSON(res, 200, nueva);
        }

        // PUT /api/negocios/:id/plan-contenido  { objetivos, publico, diferenciador, tono, semanal, hora }
        if (parts[3] === 'plan-contenido' && parts.length === 4 && req.method === 'PUT') {
          const r = planContenido.normalizar(await readBody(req));
          if (r.error) return sendJSON(res, 400, { error: r.error });
          negocio.planContenido = r.plan;
          negocio.estrategiaRevisadaEl = new Date().toISOString();
          store.saveNegocio(negocio);
          return sendJSON(res, 200, negocioPublico(negocio));
        }

        // GET /api/negocios/:id/ruta — en qué etapa va y qué le toca ahora (ver server/ruta.js)
        if (parts[3] === 'ruta' && parts.length === 4 && req.method === 'GET') {
          return sendJSON(res, 200, calcularRuta(negocio));
        }

        // PUT /api/negocios/:id/avisos { semanal } — resumen semanal por correo
        if (parts[3] === 'avisos' && parts.length === 4 && req.method === 'PUT') {
          const body = await readBody(req);
          negocio.avisos = Object.assign({}, negocio.avisos, { semanal: !!body.semanal });
          store.saveNegocio(negocio);
          return sendJSON(res, 200, negocioPublico(negocio));
        }

        // POST /api/negocios/:id/avisos/prueba — manda el resumen ahora, al email de la cuenta
        if (parts[3] === 'avisos' && parts[4] === 'prueba' && parts.length === 5 && req.method === 'POST') {
          if (!correo.configurado()) return sendJSON(res, 400, { error: 'El correo no está configurado en este servidor' });
          const espera = limiteCorreoPrueba.esperaSegundos(negocioId);
          if (espera) return sendJSON(res, 429, { error: 'Ya enviaste varios correos de prueba. Intenta en un rato.' }, { 'Retry-After': String(espera) });
          limiteCorreoPrueba.registrar(negocioId);
          const base = urlPublica(req);
          const mail = avisos.construir({
            negocio: negocioPublico(negocio), ruta: calcularRuta(negocio), contenido: store.getContenido(negocioId),
            urlPanel: base + '/app', urlBaja: base + enlaceBajaAvisos(negocioId), forzar: true,
          });
          const r = await correo.enviar({ para: negocio.email, asunto: mail.asunto, html: mail.html, texto: mail.texto });
          if (!r.ok) return sendJSON(res, 502, { error: r.error });
          return sendJSON(res, 200, { ok: true, para: negocio.email });
        }

        // POST /api/negocios/:id/ruta/informe-visto  { mes } — el dueño abrió su informe
        if (parts[3] === 'ruta' && parts[4] === 'informe-visto' && parts.length === 5 && req.method === 'POST') {
          const body = await readBody(req);
          if (!informe.mesValido(body.mes)) return sendJSON(res, 400, { error: 'Mes inválido' });
          negocio.ruta = Object.assign({}, negocio.ruta, { informeVisto: body.mes });
          store.saveNegocio(negocio);
          return sendJSON(res, 200, { ok: true });
        }

        // POST /api/negocios/:id/bienvenida  { reemplazar } — termina la
        // bienvenida. Con reemplazar, saca de la cola las piezas pendientes
        // que nadie tocó (se generaron antes de conocer el plan del negocio).
        if (parts[3] === 'bienvenida' && parts.length === 4 && req.method === 'POST') {
          const body = await readBody(req);
          if (!negocio.planContenido) negocio.planContenido = planContenido.normalizar({ objetivos: ['ventas'], semanal: planContenido.SEMANAL_POR_DEFECTO }).plan;
          negocio.bienvenidaCompletada = new Date().toISOString();
          store.saveNegocio(negocio);
          if (body.reemplazar) {
            store.saveContenido(negocioId, store.getContenido(negocioId).filter((it) =>
              !(it.status === 'pendiente' && !it.editado && !it.publicacion && (it.variants || []).length <= 1)));
          }
          return sendJSON(res, 200, negocioPublico(negocio));
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

        // POST /api/negocios/:id/galeria/ia  { texto, estilo, formato: 'cuadrado'|'vertical', categoria?, itemId? }
        // Genera una imagen con IA a partir de lo que el negocio describe y la
        // guarda en su galería (en la categoría pedida, la de la pieza o la
        // primera). Con itemId, además queda como la foto de esa pieza.
        if (parts[3] === 'galeria' && parts[4] === 'ia' && parts.length === 5 && req.method === 'POST') {
          if (!medios.proveedorImagen()) return sendJSON(res, 400, { error: 'La generación de imágenes con IA todavía no está activa.' });
          const body = await readBody(req);
          const prep = prepararCreacion(negocio, 'foto', body.calidad);
          if (!prep.costo) return sendJSON(res, prep.status, prep.body);
          const texto = String(body.texto || '').replace(/\s+/g, ' ').trim().slice(0, 800);
          if (texto.length < 5) return sendJSON(res, 400, { error: 'Describe qué quieres que muestre la foto' });
          const cats = negocio.estrategia.categoriasFoto;
          const itemDe = body.itemId ? encontrarItem(store.getContenido(negocioId), String(body.itemId)) : null;
          if (body.itemId && !itemDe) return sendJSON(res, 404, { error: 'Contenido no encontrado' });
          const categoria = cats.includes(body.categoria) ? body.categoria : (itemDe && cats.includes(itemDe.categoriaFoto) ? itemDe.categoriaFoto : cats[0]);
          let buffer;
          const modeloFoto = prep.costo.modelo;
          try {
            buffer = await medios.imagenDesdePrompt(medios.promptLibre(negocio, texto, body.estilo), body.formato === 'vertical', modeloFoto);
          } catch (err) {
            const e = respuestaErrorMedios(err, 'la imagen');
            return sendJSON(res, e.status, e.body);
          }
          const archivo = `ia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extensionImagen(buffer)}`;
          store.addFoto(negocioId, categoria, archivo, buffer);
          creditos.cobrar(negocioId, prep.costo.creditos, { tipo: 'foto', detalle: nombreCreacion('foto', prep.costo) });
          costos.imagen(negocioId, medios.proveedorImagen(), modeloFoto.ruta, modeloFoto.usd);
          if (itemDe) {
            const cont = store.getContenido(negocioId);
            const it = encontrarItem(cont, itemDe.id);
            if (it) { it.fotoElegida = { categoria, archivo }; delete it.diseno; store.saveContenido(negocioId, cont); }
          }
          return sendJSON(res, 201, { fotos: store.listFotos(negocioId), categoria, archivo, negocio: negocioPublico(store.getNegocio(negocioId)) });
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

        // Kit de marca (server/marca.js):
        //   PUT    /api/negocios/:id/marca       { color, color2, fuente, posLogo, cta }
        //   POST   /api/negocios/:id/marca/logo  { dataBase64 }
        //   DELETE /api/negocios/:id/marca/logo
        if (parts[3] === 'marca') {
          const fresco = store.getNegocio(negocioId);
          if (parts.length === 4 && req.method === 'PUT') {
            fresco.marca = Object.assign(marca.normalizar(await readBody(req), fresco.marca), { logo: (fresco.marca || {}).logo });
            if (!fresco.marca.logo) delete fresco.marca.logo;
            store.saveNegocio(fresco);
            return sendJSON(res, 200, negocioPublico(fresco));
          }
          if (parts.length === 5 && parts[4] === 'logo' && req.method === 'POST') {
            const body = await readBody(req, 3e6);
            const r = marca.guardarLogo(negocioId, body.dataBase64, (fresco.marca || {}).logo);
            if (r.error) return sendJSON(res, 400, { error: r.error });
            fresco.marca = Object.assign(marca.normalizar({}, fresco.marca), { logo: r.archivo });
            store.saveNegocio(fresco);
            return sendJSON(res, 200, negocioPublico(fresco));
          }
          if (parts.length === 5 && parts[4] === 'logo' && req.method === 'DELETE') {
            marca.borrar(negocioId, (fresco.marca || {}).logo);
            if (fresco.marca) delete fresco.marca.logo;
            store.saveNegocio(fresco);
            return sendJSON(res, 200, negocioPublico(fresco));
          }
        }

        // POST /api/negocios/:id/generar  { cantidad }
        if (parts[3] === 'generar' && parts.length === 4 && req.method === 'POST') {
          if ((negocio.plan || 'gratis') === 'gratis') return sendJSON(res, 402, { error: 'Tu cuenta no tiene un plan activo. Elige un plan (o activa tu prueba gratis) para crear contenido.', sinPlan: true });
          const body = await readBody(req);
          // segunPlan: una semana del plan de contenido del negocio.
          const porPlan = body.segunPlan && negocio.planContenido ? planContenido.totalSemanal(negocio.planContenido) : 0;
          let cantidad = Math.min(Math.max(Math.floor(Number(porPlan || body.cantidad)) || 6, 1), MAX_PIEZAS_POR_GENERACION);
          const usaIA = getPlan(negocio.plan).usaIA;
          if (usaIA) {
            const disponibles = textosIADisponibles(negocio);
            if (disponibles <= 0) {
              return sendJSON(res, 403, sinCupo('piezas', 'Ya usaste todas las piezas con IA de este mes. Se renuevan el día 1, o puedes cargar más.'));
            }
            cantidad = Math.min(cantidad, disponibles);
          }
          const existentes = store.getContenido(negocioId);
          const nuevos = await generarBanco(negocio, cantidad, existentes.length, {
            usarIA: usaIA, diaInicio: diaSiguienteDeLaCola(existentes), indicaciones: contextoIA.indicacion(body.indicaciones),
          });
          registrarUsoIA(negocioId, 'usoTextosIA', nuevos.filter((n) => n.generadoConIA).length);
          nuevos.sort((a, b) => Date.parse(a.publicarEl) - Date.parse(b.publicarEl)); // en la cola, por fecha
          // Se relee la cola después de esperar a Claude, para no pisar lo que
          // el negocio aprobó o editó mientras tanto.
          const items = store.getContenido(negocioId).concat(nuevos);
          store.saveContenido(negocioId, items);
          return sendJSON(res, 200, items);
        }

        // Conexión con Meta (lado Facebook) para Meta Ads y competencia:
        //   POST   /api/negocios/:id/meta/cuentas { accessToken } — qué cuentas puede elegir
        //   PUT    /api/negocios/:id/meta { accessToken, adAccountId, igUserId }
        //   DELETE /api/negocios/:id/meta
        if (parts[3] === 'meta') {
          const plan = getPlan(negocio.plan);
          if (!plan.ads && !plan.competencia) {
            return sendJSON(res, 403, { error: 'Meta Ads y competencia están disponibles en el plan Estudio' });
          }
          if (parts[4] === 'cuentas' && parts.length === 5 && req.method === 'POST') {
            const body = await readBody(req);
            const token = String(body.accessToken || '').trim();
            if (!token) return sendJSON(res, 400, { error: 'Falta el token de Meta' });
            try {
              return sendJSON(res, 200, await meta.opcionesDeCuenta(token));
            } catch (err) {
              return sendJSON(res, 400, { error: err.tipo === 'token' ? 'Meta rechazó el token: revisa que esté completo y vigente.' : err.message });
            }
          }
          if (parts.length === 4 && req.method === 'PUT') {
            const body = await readBody(req);
            let token = String(body.accessToken || '').trim();
            if (!token) return sendJSON(res, 400, { error: 'Falta el token de Meta' });
            let opciones;
            try {
              opciones = await meta.opcionesDeCuenta(token);
            } catch (err) {
              return sendJSON(res, 400, { error: 'Meta rechazó el token: revisa que esté completo y vigente.' });
            }
            const cuenta = opciones.cuentasPublicitarias.find((c) => c.id === body.adAccountId) || null;
            const ig = opciones.cuentasInstagram.find((c) => c.id === body.igUserId) || null;
            if (body.adAccountId && !cuenta) return sendJSON(res, 400, { error: 'Ese token no tiene acceso a la cuenta publicitaria elegida' });
            if (body.igUserId && !ig) return sendJSON(res, 400, { error: 'Ese token no tiene acceso a la cuenta de Instagram elegida' });
            if (!cuenta && !ig) return sendJSON(res, 400, { error: 'Elige una cuenta publicitaria o una cuenta de Instagram' });
            const largo = await meta.tokenLargo(token);
            if (largo) token = largo.accessToken;
            const fresco = store.getNegocio(negocioId);
            fresco.meta = {
              accessToken: token,
              adAccountId: cuenta ? cuenta.id : null, cuentaNombre: cuenta ? cuenta.nombre : null, moneda: cuenta ? cuenta.moneda : null,
              igUserId: ig ? ig.id : null, igUsername: ig ? ig.username : null,
              venceEl: largo && largo.expiraEnSeg ? new Date(Date.now() + largo.expiraEnSeg * 1000).toISOString() : null,
              conectadoEl: new Date().toISOString(),
            };
            store.saveNegocio(fresco);
            if (fresco.meta.adAccountId && plan.ads) await meta.sincronizarAds(negocioId);
            return sendJSON(res, 200, negocioPublico(store.getNegocio(negocioId)));
          }
          if (parts.length === 4 && req.method === 'DELETE') {
            const fresco = store.getNegocio(negocioId);
            delete fresco.meta;
            store.saveNegocio(fresco);
            return sendJSON(res, 200, negocioPublico(fresco));
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // Competencia en Instagram (plan Estudio, requiere la conexión con Meta):
        //   GET    /api/negocios/:id/competencia
        //   POST   /api/negocios/:id/competencia { username }
        //   DELETE /api/negocios/:id/competencia/:username
        //   POST   /api/negocios/:id/competencia/sincronizar
        if (parts[3] === 'competencia') {
          if (!getPlan(negocio.plan).competencia) return sendJSON(res, 403, { error: 'Competencia está disponible en el plan Estudio' });
          if (!negocio.meta || !negocio.meta.igUserId) {
            return sendJSON(res, 400, { error: 'Conecta Meta en Conexiones y ajustes y elige tu cuenta de Instagram para seguir a tu competencia' });
          }
          const vista = () => ({ comparacion: competencia.comparacion(store.getNegocio(negocioId)), sync: analitica.estadoSync(negocioId, 'competencia') });
          if (parts.length === 4 && req.method === 'GET') return sendJSON(res, 200, vista());
          if (parts.length === 4 && req.method === 'POST') {
            const body = await readBody(req);
            const r = await competencia.agregar(negocio, body.username);
            if (r.error) return sendJSON(res, 400, { error: r.error });
            return sendJSON(res, 201, vista());
          }
          if (parts.length === 5 && parts[4] === 'sincronizar' && req.method === 'POST') {
            const r = await sincronizador.sincronizarAhora(negocioId, 'competencia');
            if (!r.ok && r.espera) return sendJSON(res, 429, { error: r.error });
            return sendJSON(res, 200, vista());
          }
          if (parts.length === 5 && req.method === 'DELETE') {
            competencia.quitar(negocioId, decodeURIComponent(parts[4]));
            return sendJSON(res, 200, vista());
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // Google Ads (plan Estudio):
        //   GET    /api/negocios/:id/google/conectar — redirige a Google
        //   PUT    /api/negocios/:id/google { customerId } — elige la cuenta
        //   DELETE /api/negocios/:id/google
        //   GET    /api/negocios/:id/google-ads?dias=30 · POST .../google-ads/sincronizar
        if (parts[3] === 'google' || parts[3] === 'google-ads') {
          if (!getPlan(negocio.plan).ads) return sendJSON(res, 403, { error: 'Google Ads está disponible en el plan Estudio' });
          if (parts[3] === 'google' && parts[4] === 'conectar' && parts.length === 5 && req.method === 'GET') {
            if (!google.configurado()) return sendJSON(res, 400, { error: 'Google Ads no está configurado en este servidor' });
            const nonce = google.nuevoEstadoOAuth();
            // el token firmado lleva un punto; se cambia por _ para separar el state con puntos
            const firma = auth.crearTokenFoto(negocioId, 'google-oauth', nonce, 15).replace(/\./g, '_');
            res.writeHead(302, { Location: google.urlAutorizacion(urlPublica(req) + '/api/google/callback', `${negocioId}.${nonce}.${firma}`) });
            return res.end();
          }
          if (parts[3] === 'google' && parts.length === 4 && req.method === 'PUT') {
            const body = await readBody(req);
            const g = negocio.google;
            const elegida = g && (g.opciones || []).find((o) => o.id === String(body.customerId));
            if (!elegida) return sendJSON(res, 400, { error: 'Elige una de las cuentas disponibles' });
            const n = store.getNegocio(negocioId);
            Object.assign(n.google, { customerId: elegida.id, nombre: elegida.nombre, moneda: elegida.moneda, loginCustomerId: elegida.loginCustomerId });
            delete n.google.opciones;
            store.saveNegocio(n);
            await google.sincronizar(negocioId);
            return sendJSON(res, 200, negocioPublico(store.getNegocio(negocioId)));
          }
          if (parts[3] === 'google' && parts.length === 4 && req.method === 'DELETE') {
            const n = store.getNegocio(negocioId);
            delete n.google;
            store.saveNegocio(n);
            return sendJSON(res, 200, negocioPublico(n));
          }
          if (parts[3] === 'google-ads') {
            if (!negocio.google || !negocio.google.customerId) return sendJSON(res, 400, { error: 'Conecta Google Ads en Conexiones y ajustes' });
            if (parts.length === 5 && parts[4] === 'sincronizar' && req.method === 'POST') {
              const r = await sincronizador.sincronizarAhora(negocioId, 'google_ads');
              if (!r.ok && r.espera) return sendJSON(res, 429, { error: r.error });
            } else if (!(parts.length === 4 && req.method === 'GET')) {
              return sendJSON(res, 400, { error: 'Acción inválida' });
            }
            const dias = [7, 30, 90].includes(Number(url.searchParams.get('dias'))) ? Number(url.searchParams.get('dias')) : 30;
            const hasta = analitica.fechaLocal(new Date());
            const n = store.getNegocio(negocioId);
            return sendJSON(res, 200, Object.assign({
              dias,
              conexion: google.publico(n.google),
              sync: analitica.estadoSync(negocioId, 'google_ads'),
            }, analisisAds.analizar({
              resumenDe: (d, h) => google.resumen(negocioId, d, h),
              desde: analitica.sumarDias(hasta, -(dias - 1)), hasta, dias, moneda: n.google.moneda, sumarDias: analitica.sumarDias, primeraFecha: google.primeraFecha(negocioId),
            })));
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // GET  /api/negocios/:id/ads?dias=30 — Meta Ads del período (solo lectura)
        // POST /api/negocios/:id/ads/sincronizar
        if (parts[3] === 'ads') {
          if (!getPlan(negocio.plan).ads) return sendJSON(res, 403, { error: 'Meta Ads está disponible en el plan Estudio' });
          if (!negocio.meta || !negocio.meta.adAccountId) return sendJSON(res, 400, { error: 'Conecta tu cuenta publicitaria de Meta en Conexiones y ajustes' });
          if (parts.length === 5 && parts[4] === 'sincronizar' && req.method === 'POST') {
            const r = await sincronizador.sincronizarAhora(negocioId, 'meta_ads');
            if (!r.ok && r.espera) return sendJSON(res, 429, { error: r.error });
          } else if (!(parts.length === 4 && req.method === 'GET')) {
            return sendJSON(res, 400, { error: 'Acción inválida' });
          }
          const dias = [7, 30, 90].includes(Number(url.searchParams.get('dias'))) ? Number(url.searchParams.get('dias')) : 30;
          const hasta = analitica.fechaLocal(new Date());
          const n = store.getNegocio(negocioId);
          return sendJSON(res, 200, Object.assign({
            dias,
            conexion: meta.publicoMeta(n.meta),
            sync: analitica.estadoSync(negocioId, 'meta_ads'),
          }, analisisAds.analizar({
            resumenDe: (d, h) => meta.resumenAds(negocioId, d, h), desglosesDe: (d, h) => meta.desglosesAds(negocioId, d, h),
            desde: analitica.sumarDias(hasta, -(dias - 1)), hasta, dias, moneda: n.meta.moneda, sumarDias: analitica.sumarDias, primeraFecha: meta.primeraFechaAds(negocioId),
          })));
        }

        // POST /api/negocios/:id/prueba — activa los días gratis con el formulario.
        if (parts[3] === 'prueba' && parts.length === 4 && req.method === 'POST') {
          const espera = limiteEstrategia.esperaSegundos('prueba:' + negocioId);
          if (espera) return sendJSON(res, 429, { error: 'Demasiados intentos. Espera un rato.' });
          limiteEstrategia.registrar('prueba:' + negocioId);
          const r = pruebaGratis.activar(store.getNegocio(negocioId), await readBody(req));
          if (r.error) return sendJSON(res, 400, { error: r.error, campo: r.campo });
          store.saveNegocio(r.negocio);
          return sendJSON(res, 200, negocioPublico(r.negocio));
        }

        // Perfil del negocio (server/perfil.js): la introducción que usa toda la IA.
        //   PUT  /api/negocios/:id/perfil            { descripcion, ciudad, canales, productos, instagram, … }
        //   POST /api/negocios/:id/perfil/leer-web   { url } → propuesta leída de su sitio (no se guarda)
        if (parts[3] === 'perfil') {
          if (parts.length === 4 && req.method === 'PUT') {
            const body = await readBody(req);
            const fresco = store.getNegocio(negocioId);
            fresco.perfil = perfil.normalizar(body, fresco.perfil);
            store.saveNegocio(fresco);
            return sendJSON(res, 200, negocioPublico(fresco));
          }
          if (parts.length === 5 && parts[4] === 'leer-web' && req.method === 'POST') {
            if (!getPlan(negocio.plan).usaIA) return sendJSON(res, 403, { error: 'Leer tu web con IA está en los planes Pro y Estudio' });
            if (!process.env.ANTHROPIC_API_KEY) return sendJSON(res, 400, { error: 'La IA no está configurada en este servidor' });
            const espera = limiteEstrategia.esperaSegundos(negocioId);
            if (espera) return sendJSON(res, 429, { error: 'Demasiados intentos esta hora. Intenta más tarde.' });
            limiteEstrategia.registrar(negocioId);
            const r = await perfil.leerWeb(negocio, (await readBody(req)).url);
            if (r.error) return sendJSON(res, 400, { error: r.error });
            return sendJSON(res, 200, r);
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // Notificaciones push de este negocio (cada dispositivo es una suscripción).
        //   GET    /api/negocios/:id/push            dispositivos activos
        //   POST   /api/negocios/:id/push            { suscripcion, dispositivo }
        //   DELETE /api/negocios/:id/push            { endpoint }
        //   POST   /api/negocios/:id/push/prueba
        if (parts[3] === 'push') {
          const vistaPush = () => ({ dispositivos: push.dispositivos(negocioId).map((d) => ({ dispositivo: d.dispositivo, creadoEl: d.creadoEl, ultimoEnvio: d.ultimoEnvio, endpoint: d.endpoint })) });
          if (parts.length === 4 && req.method === 'GET') return sendJSON(res, 200, vistaPush());
          if (parts.length === 4 && req.method === 'POST') {
            const body = await readBody(req);
            const r = push.suscribir(negocioId, body.suscripcion, body.dispositivo);
            if (r.error) return sendJSON(res, 400, { error: r.error });
            return sendJSON(res, 201, vistaPush());
          }
          if (parts.length === 4 && req.method === 'DELETE') {
            push.desuscribir(negocioId, (await readBody(req)).endpoint);
            return sendJSON(res, 200, vistaPush());
          }
          if (parts.length === 5 && parts[4] === 'prueba' && req.method === 'POST') {
            const n = await push.enviar(negocioId, { titulo: 'Notificaciones activadas', cuerpo: 'Así te avisaremos cuando tengas contenido por aprobar o algo necesite tu atención.', url: '/app', tag: 'prueba' });
            return sendJSON(res, 200, { enviados: n });
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // Reels de prueba (server/reels-prueba.js).
        //   GET  /api/negocios/:id/reels-prueba      destacados y ajustes
        //   POST /api/negocios/:id/reels-prueba      { mediaId, graduacion } → pieza en Por aprobar
        //   PUT  /api/negocios/:id/reels-prueba      { auto, graduacion }
        if (parts[3] === 'reels-prueba' && parts.length === 4) {
          if (!getPlan(negocio.plan).analitica) return sendJSON(res, 403, { error: 'Los Reels de prueba están en los planes Pro y Estudio' });
          if (req.method === 'GET') return sendJSON(res, 200, reelsPrueba.vista(negocio));
          const body = await readBody(req);
          if (req.method === 'PUT') {
            const fresco = store.getNegocio(negocioId);
            fresco.reelsPrueba = {
              auto: body.auto !== false,
              graduacion: reelsPrueba.GRADUACIONES[body.graduacion] ? body.graduacion : 'SS_PERFORMANCE',
            };
            store.saveNegocio(fresco);
            return sendJSON(res, 200, reelsPrueba.vista(fresco));
          }
          if (req.method === 'POST') {
            const usarIA = getPlan(negocio.plan).usaIA && textosIADisponibles(negocio) > 0;
            const r = await reelsPrueba.crear(negocio, body.mediaId, {
              graduacion: body.graduacion, usarIA, diaInicio: diaSiguienteDeLaCola(store.getContenido(negocioId)),
            });
            if (r.error) return sendJSON(res, 400, { error: r.error });
            if (r.conIA) registrarUsoIA(negocioId, 'usoTextosIA', 1);
            return sendJSON(res, 201, { item: r.item, vista: reelsPrueba.vista(store.getNegocio(negocioId)) });
          }
          return sendJSON(res, 400, { error: 'Método inválido' });
        }

        // Contexto para la IA del negocio, por sección (server/contexto-ia.js).
        //   GET /api/negocios/:id/contexto-ia · PUT { general, estrategia, copys, post, … }
        if (parts[3] === 'contexto-ia' && parts.length === 4) {
          const vista = (n) => ({ contexto: contextoIA.delNegocio(n), plataforma: contextoIA.dePlataforma(), secciones: contextoIA.catalogo() });
          if (req.method === 'GET') return sendJSON(res, 200, vista(negocio));
          if (req.method === 'PUT') {
            const fresco = store.getNegocio(negocioId);
            fresco.contextoIA = contextoIA.editarNegocio(fresco, await readBody(req));
            store.saveNegocio(fresco);
            return sendJSON(res, 200, vista(fresco));
          }
          return sendJSON(res, 400, { error: 'Método inválido' });
        }

        // Voz de marca (server/voz.js).
        //   GET  /api/negocios/:id/voz              ficha, opciones y cómo va la cola
        //   PUT  /api/negocios/:id/voz              guarda la ficha y repuntúa lo pendiente
        //   POST /api/negocios/:id/voz/sugerir      propuesta de ficha con IA (no la guarda)
        //   POST /api/negocios/:id/voz/redactar     { tipo, tema, indicaciones } → 3 versiones
        //   POST /api/negocios/:id/voz/puntuar      { texto } → puntaje (sin IA)
        //   POST /api/negocios/:id/voz/ejemplos     { texto } → "así sí suena" pasa a la ficha
        if (parts[3] === 'voz') {
          const usaIA = getPlan(negocio.plan).usaIA;
          const vistaVoz = (n) => {
            const pendientes = store.getContenido(negocioId).filter((i) => i.status === 'pendiente' && i.voz);
            const aprobadas = store.getContenido(negocioId).filter((i) => i.status === 'aprobado');
            return {
              ficha: n.voz || null, opciones: voz.catalogo(), tieneFicha: voz.tieneFicha(n),
              puntajeCola: pendientes.length ? Math.round(pendientes.reduce((t, i) => t + i.voz.puntaje, 0) / pendientes.length) : null,
              sinCambios: aprobadas.length ? Math.round((aprobadas.filter((i) => !i.editado).length / aprobadas.length) * 100) : null,
              aprobadas: aprobadas.length,
              puedeIA: usaIA, iaConfigurada: !!process.env.ANTHROPIC_API_KEY, textosIADisponibles: textosIADisponibles(n),
            };
          };
          const conIA = async (fn) => {
            if (!usaIA) return sendJSON(res, 403, { error: 'Escribir con IA está disponible en los planes Pro y Estudio' });
            if (!process.env.ANTHROPIC_API_KEY) return sendJSON(res, 400, { error: 'La IA no está configurada en este servidor' });
            if (textosIADisponibles(negocio) <= 0) return sendJSON(res, 403, sinCupo('piezas', 'Ya usaste todas las piezas con IA de este mes. Se renuevan el día 1, o puedes cargar más.'));
            const r = await fn();
            if (r && r.error) return sendJSON(res, 400, r);
            registrarUsoIA(negocioId, 'usoTextosIA', 1);
            return sendJSON(res, 200, r);
          };
          if (parts.length === 4 && req.method === 'GET') return sendJSON(res, 200, vistaVoz(negocio));
          if (parts.length === 4 && req.method === 'PUT') {
            const body = await readBody(req);
            const fresco = store.getNegocio(negocioId);
            fresco.voz = voz.normalizar(body, fresco.voz);
            store.saveNegocio(fresco);
            const piezas = store.getContenido(negocioId);
            for (const it of piezas) if (!(it.publicacion && it.publicacion.estado === 'publicada')) guardian.aplicar(it, fresco);
            store.saveContenido(negocioId, piezas);
            return sendJSON(res, 200, vistaVoz(fresco));
          }
          if (parts.length === 5 && req.method === 'POST') {
            const body = await readBody(req);
            if (parts[4] === 'sugerir') return conIA(() => voz.sugerir(negocio));
            if (parts[4] === 'redactar') return conIA(() => voz.redactar(negocio, body));
            if (parts[4] === 'puntuar') {
              if (!voz.tieneFicha(negocio)) return sendJSON(res, 400, { error: 'Completa primero la ficha de tu voz de marca' });
              return sendJSON(res, 200, { voz: voz.puntuar(String(body.texto || '').slice(0, 3000), negocio) });
            }
            if (parts[4] === 'ejemplos') {
              const texto = String(body.texto || '').trim();
              if (!texto) return sendJSON(res, 400, { error: 'Falta el texto' });
              const fresco = store.getNegocio(negocioId);
              const actual = fresco.voz || voz.normalizar({}, null);
              const ejemplos = [texto, ...(actual.ejemplos || []).filter((e) => e !== texto)].slice(0, 8);
              fresco.voz = voz.normalizar({ ejemplos }, actual);
              store.saveNegocio(fresco);
              return sendJSON(res, 200, vistaVoz(fresco));
            }
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // "Mi estilo": ejemplos del contenido que ya hace el negocio y la guía
        // de estilo que la IA sintetiza de ellos (y el dueño puede corregir).
        //   GET    /api/negocios/:id/estilo
        //   PUT    /api/negocios/:id/estilo { general, porFormato }
        //   POST   /api/negocios/:id/estilo/referencias { formato, texto, nota, imagenBase64, filename }
        //   DELETE /api/negocios/:id/estilo/referencias/:refId
        //   POST   /api/negocios/:id/estilo/importar   — desde su Instagram
        //   POST   /api/negocios/:id/estilo/analizar   — guía con IA (planes con IA)
        if (parts[3] === 'estilo') {
          const vistaEstilo = (n) => ({
            referencias: estilo.listar(negocioId),
            estilo: n.estilo || null,
            mezcla: estilo.mezcla(negocioId),
            puedeAnalizar: getPlan(n.plan).usaIA,
            iaConfigurada: !!process.env.ANTHROPIC_API_KEY,
            instagramConectado: !!(n.instagram && n.instagram.accessToken),
          });
          if (parts.length === 4 && req.method === 'GET') return sendJSON(res, 200, vistaEstilo(negocio));
          if (parts.length === 4 && req.method === 'PUT') {
            const body = await readBody(req);
            const fresco = store.getNegocio(negocioId);
            fresco.estilo = estilo.normalizarGuia(body, fresco.estilo);
            store.saveNegocio(fresco);
            return sendJSON(res, 200, vistaEstilo(fresco));
          }
          if (parts[4] === 'referencias' && parts.length === 5 && req.method === 'POST') {
            const body = await readBody(req, 8e6);
            const r = estilo.agregar(negocioId, body);
            if (r.error) return sendJSON(res, 400, { error: r.error });
            return sendJSON(res, 201, vistaEstilo(negocio));
          }
          if (parts[4] === 'referencias' && parts.length === 6 && req.method === 'DELETE') {
            if (!estilo.borrar(negocioId, parts[5])) return sendJSON(res, 404, { error: 'Ejemplo no encontrado' });
            return sendJSON(res, 200, vistaEstilo(negocio));
          }
          if (parts[4] === 'importar' && parts.length === 5 && req.method === 'POST') {
            if (!negocio.instagram || !negocio.instagram.accessToken) {
              return sendJSON(res, 400, { error: 'Conecta Instagram en Conexiones y ajustes para importar tus publicaciones' });
            }
            try {
              const r = await estilo.importarDeInstagram(negocio);
              return sendJSON(res, 200, Object.assign(vistaEstilo(negocio), { importadas: r.nuevas }));
            } catch (err) {
              return sendJSON(res, 502, { error: 'No se pudo leer tu Instagram: ' + err.message });
            }
          }
          if (parts[4] === 'analizar' && parts.length === 5 && req.method === 'POST') {
            if (!getPlan(negocio.plan).usaIA) return sendJSON(res, 403, { error: 'El análisis de estilo con IA está en los planes Pro y Estudio' });
            if (!process.env.ANTHROPIC_API_KEY) return sendJSON(res, 400, { error: 'La IA no está configurada en este servidor' });
            if (textosIADisponibles(negocio) <= 0) return sendJSON(res, 403, sinCupo('piezas', 'Ya usaste todas las piezas con IA de este mes. Se renuevan el día 1, o puedes cargar más.'));
            const r = await estilo.analizar(negocio, process.env.ANTHROPIC_API_KEY);
            if (r.error) return sendJSON(res, 400, { error: r.error });
            registrarUsoIA(negocioId, 'usoTextosIA', 1);
            const fresco = store.getNegocio(negocioId);
            fresco.estilo = r.estilo;
            store.saveNegocio(fresco);
            return sendJSON(res, 200, vistaEstilo(fresco));
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // Informe mensual (planes con Resultados):
        //   GET  /api/negocios/:id/informe?mes=AAAA-MM
        //   POST /api/negocios/:id/informe/conclusion { mes } — (re)genera la conclusión
        //   POST /api/negocios/:id/informe/enlace { mes }     — enlace para compartir (30 días)
        if (parts[3] === 'informe') {
          if (!getPlan(negocio.plan).analitica) {
            return sendJSON(res, 403, { error: 'El informe mensual está disponible en los planes Pro y Estudio' });
          }
          if (parts.length === 4 && req.method === 'GET') {
            const mes = url.searchParams.get('mes') || informe.mesActual();
            if (!informe.mesValido(mes)) return sendJSON(res, 400, { error: 'Mes inválido' });
            return sendJSON(res, 200, informe.datos(negocio, mes, estadisticasAprobacion));
          }
          if (parts.length === 5 && req.method === 'POST') {
            const body = await readBody(req);
            const mes = body.mes || informe.mesActual();
            if (!informe.mesValido(mes)) return sendJSON(res, 400, { error: 'Mes inválido' });
            if (parts[4] === 'conclusion') {
              const plan = getPlan(negocio.plan);
              const conIA = plan.usaIA && textosIADisponibles(negocio) > 0;
              const d = informe.datos(negocio, mes, estadisticasAprobacion);
              const r = await informe.generarConclusion(negocio, mes, d, conIA);
              if (r.origen === 'ia') registrarUsoIA(negocioId, 'usoTextosIA', 1);
              return sendJSON(res, 200, informe.datos(store.getNegocio(negocioId), mes, estadisticasAprobacion));
            }
            if (parts[4] === 'enlace') {
              const minutos = 30 * 24 * 60;
              const t = auth.crearTokenFoto(negocioId, 'informe', mes, minutos);
              const base = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : urlBase(req);
              return sendJSON(res, 200, {
                url: `${base}/app/informe.html?n=${encodeURIComponent(negocioId)}&mes=${mes}&t=${t}`,
                venceEl: new Date(Date.now() + minutos * 60000).toISOString(),
              });
            }
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // GET /api/negocios/:id/analitica?dias=30 — Resultados del período.
        // POST /api/negocios/:id/analitica/sincronizar — actualizar ahora.
        if (parts[3] === 'analitica') {
          if (!getPlan(negocio.plan).analitica) {
            return sendJSON(res, 403, { error: 'Resultados está disponible en los planes Pro y Estudio' });
          }
          if (parts.length === 4 && req.method === 'GET') {
            const dias = [7, 30, 90].includes(Number(url.searchParams.get('dias'))) ? Number(url.searchParams.get('dias')) : 30;
            return sendJSON(res, 200, datosResultados(negocio, dias));
          }
          if (parts[4] === 'sincronizar' && parts.length === 5 && req.method === 'POST') {
            if (!negocio.instagram || !negocio.instagram.accessToken) {
              return sendJSON(res, 400, { error: 'Conecta Instagram en Conexiones y ajustes para ver tus resultados' });
            }
            const r = await sincronizador.sincronizarAhora(negocioId);
            if (!r.ok && r.espera) return sendJSON(res, 429, { error: r.error });
            return sendJSON(res, 200, datosResultados(store.getNegocio(negocioId), 30));
          }
          return sendJSON(res, 400, { error: 'Acción inválida' });
        }

        // POST /api/negocios/:id/contenido/:itemId/video — video de un Reel o
        // historia, como archivo crudo (video/mp4 o video/quicktime). Se
        // escribe por streaming a un archivo temporal y se corta si pasa del
        // máximo, sin cargarlo entero en memoria.
        // DELETE /api/negocios/:id/contenido/:itemId/video — lo quita.
        // Diseño con la marca de una pieza (JPEG armado en el panel):
        //   POST   /api/negocios/:id/contenido/:itemId/diseno { dataBase64, plantilla }
        //   DELETE /api/negocios/:id/contenido/:itemId/diseno
        if (parts[3] === 'contenido' && parts.length === 6 && parts[5] === 'diseno' && ['POST', 'DELETE'].includes(req.method)) {
          const itemId = parts[4];
          const items = store.getContenido(negocioId);
          const item = encontrarItem(items, itemId);
          if (!item) return sendJSON(res, 404, { error: 'Contenido no encontrado' });
          const pub = item.publicacion;
          if (pub && ['publicando', 'publicada'].includes(pub.estado)) return sendJSON(res, 409, { error: 'Esta pieza ya se publicó o se está publicando' });
          const anterior = item.diseno && item.diseno.archivo;
          if (req.method === 'DELETE') {
            marca.borrar(negocioId, anterior);
            delete item.diseno;
          } else {
            const body = await readBody(req, 9e6);
            const r = marca.guardarDiseno(negocioId, itemId, body.dataBase64, anterior);
            if (r.error) return sendJSON(res, 400, { error: r.error });
            item.diseno = { archivo: r.archivo, plantilla: marca.PLANTILLAS.includes(body.plantilla) ? body.plantilla : 'titular', creadoEl: new Date().toISOString() };
          }
          store.saveContenido(negocioId, items);
          return sendJSON(res, 200, item);
        }

        // Edición de reels (server/edicion-reels.js):
        //   POST /api/negocios/:id/contenido/:itemId/editar-reel  { opciones, capas: { gancho, cta, logo } }
        //   POST /api/negocios/:id/contenido/:itemId/video-original — deshace la edición
        if (parts[3] === 'contenido' && parts.length === 6 && ['editar-reel', 'video-original'].includes(parts[5]) && req.method === 'POST') {
          const itemId = parts[4];
          const items = store.getContenido(negocioId);
          const item = encontrarItem(items, itemId);
          if (!item) return sendJSON(res, 404, { error: 'Contenido no encontrado' });
          const pub = item.publicacion;
          if ((pub && ['publicando', 'publicada'].includes(pub.estado)) || publicador.estaPublicando(negocioId, itemId)) {
            return sendJSON(res, 409, { error: 'Esta pieza ya se publicó o se está publicando' });
          }
          if (edicionReels.enProceso(negocioId, itemId)) return sendJSON(res, 409, { error: 'Este reel se está editando. Espera a que termine.' });
          if (parts[5] === 'video-original') {
            if (!item.videoOriginal) return sendJSON(res, 400, { error: 'Este video no tiene una edición que deshacer' });
            if (item.video) store.borrarVideo(negocioId, item.video.archivo);
            item.video = item.videoOriginal;
            delete item.videoOriginal;
            delete item.edicion;
            descartarContenedor(item);
            store.saveContenido(negocioId, items);
            return sendJSON(res, 200, item);
          }
          if ((negocio.plan || 'gratis') === 'gratis') return sendJSON(res, 402, { error: 'Elige un plan para editar reels.', sinPlan: true });
          if (!edicionReels.disponible()) return sendJSON(res, 503, { error: 'La edición de reels todavía no está disponible. Intenta más tarde.' });
          if (!['reel', 'historia'].includes(formatoDe(item))) return sendJSON(res, 400, { error: 'La edición es para Reels e historias con video' });
          const base = item.videoOriginal || item.video;
          if (!base) return sendJSON(res, 400, { error: 'Sube primero el video de este reel' });
          if (reelsEditadosDisponibles(negocio) <= 0) return sendJSON(res, 403, sinCupo('reels', 'Ya usaste tus reels editados de este mes. Puedes cargar más.'));
          const body = await readBody(req, 14e6);
          const r = edicionReels.encolar({ negocioId, itemId, entrada: base.archivo, opciones: body.opciones, capas: body.capas });
          if (r.error) return sendJSON(res, 400, { error: r.error });
          registrarUsoIA(negocioId, 'usoReelsEditados', 1);
          item.edicion = { estado: 'editando', desde: new Date().toISOString() };
          store.saveContenido(negocioId, items);
          return sendJSON(res, 200, item);
        }

        if (parts[3] === 'contenido' && parts.length === 6 && parts[5] === 'video') {
          const itemId = parts[4];
          const item = encontrarItem(store.getContenido(negocioId), itemId);
          if (!item) return sendJSON(res, 404, { error: 'Contenido no encontrado' });
          const pub = item.publicacion;
          if ((pub && ['publicando', 'publicada'].includes(pub.estado)) || publicador.estaPublicando(negocioId, itemId)) {
            return sendJSON(res, 409, { error: 'Esta pieza ya se publicó o se está publicando' });
          }

          if (req.method === 'DELETE') {
            const items = store.getContenido(negocioId);
            const fresco = encontrarItem(items, itemId);
            if (fresco && fresco.video) {
              store.borrarVideo(negocioId, fresco.video.archivo);
              if (fresco.videoOriginal) store.borrarVideo(negocioId, fresco.videoOriginal.archivo);
              delete fresco.video;
              delete fresco.videoOriginal;
              delete fresco.edicion;
              descartarContenedor(fresco);
              store.saveContenido(negocioId, items);
            }
            return sendJSON(res, 200, fresco);
          }

          if (req.method === 'POST') {
            const tipo = (req.headers['content-type'] || '').split(';')[0].trim();
            const declarado = Number(req.headers['content-length']);
            if (declarado > MAX_VIDEO_BYTES) {
              return sendJSON(res, 413, { error: `El video pesa más de ${MAX_VIDEO_BYTES / 1024 / 1024} MB` });
            }
            const archivo = `${itemId}${TIPOS_VIDEO[tipo]}`;
            fs.mkdirSync(store.videoDir(negocioId), { recursive: true });
            const destino = store.videoAbsolutePath(negocioId, archivo);
            const temporal = `${destino}.subiendo-${Date.now()}`;
            const bytes = await new Promise((resolve) => {
              const salida = fs.createWriteStream(temporal);
              let total = 0;
              let cortado = false;
              req.on('data', (chunk) => {
                total += chunk.length;
                if (total > MAX_VIDEO_BYTES && !cortado) {
                  cortado = true;
                  req.unpipe(salida);
                  salida.destroy();
                  resolve(-1);
                }
              });
              req.pipe(salida);
              salida.on('finish', () => { if (!cortado) resolve(total); });
              salida.on('error', () => { if (!cortado) resolve(-2); });
              req.on('error', () => { if (!cortado) resolve(-2); });
            });
            if (bytes < 0) {
              fs.rmSync(temporal, { force: true });
              if (bytes === -1) {
                res.setHeader('Connection', 'close');
                return sendJSON(res, 413, { error: `El video pesa más de ${MAX_VIDEO_BYTES / 1024 / 1024} MB` });
              }
              return sendJSON(res, 400, { error: 'No se pudo recibir el video' });
            }
            if (!bytes) {
              fs.rmSync(temporal, { force: true });
              return sendJSON(res, 400, { error: 'Falta el video' });
            }

            const items = store.getContenido(negocioId);
            const fresco = encontrarItem(items, itemId);
            if (!fresco) {
              fs.rmSync(temporal, { force: true });
              return sendJSON(res, 404, { error: 'Contenido no encontrado' });
            }
            if (fresco.video && fresco.video.archivo !== archivo) store.borrarVideo(negocioId, fresco.video.archivo);
            if (fresco.videoOriginal && fresco.videoOriginal.archivo !== archivo) store.borrarVideo(negocioId, fresco.videoOriginal.archivo);
            delete fresco.videoOriginal; // un video nuevo reemplaza también a la edición anterior
            delete fresco.edicion;
            fs.renameSync(temporal, destino);
            fresco.video = { archivo, bytes, subidoEl: new Date().toISOString() };
            descartarContenedor(fresco);
            store.saveContenido(negocioId, items);
            return sendJSON(res, 200, fresco);
          }
          return sendJSON(res, 400, { error: 'Método inválido' });
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
          // PUT /api/negocios/:id/contenido/:item/foto  { categoria, archivo } | { quitar: true }
          // La pieza usa esa foto de la galería (el diseño anterior se descarta).
          if (accion === 'foto' && req.method === 'PUT') {
            if (publicada) return sendJSON(res, 409, { error: 'Esta pieza ya está publicada' });
            const b = await readBody(req);
            if (b.quitar) {
              aplicar = (it) => { delete it.fotoElegida; delete it.diseno; };
            } else {
              const categoria = String(b.categoria || '');
              const archivo = path.basename(String(b.archivo || ''));
              if (!((store.listFotos(negocioId)[categoria]) || []).includes(archivo)) return sendJSON(res, 404, { error: 'No encontramos esa foto en tu galería' });
              aplicar = (it) => { it.fotoElegida = { categoria, archivo }; delete it.diseno; };
            }
          } else if (accion === 'aprobar' && req.method === 'POST') {
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
                it.decididoEl = new Date().toISOString();
                const yaEnCola = it.publicacion && ['programada', 'publicando'].includes(it.publicacion.estado);
                if (igConectado && !yaEnCola) programar(it, maxISO(cuando, new Date().toISOString()), req);
              };
              publicarYa = true;
            }
          } else if ((accion === 'rechazar' || accion === 'deshacer') && req.method === 'POST') {
            if (seEstaPublicando) return ocupada();
            aplicar = (it) => {
              it.status = accion === 'rechazar' ? 'rechazado' : 'pendiente';
              if (accion === 'rechazar') it.decididoEl = new Date().toISOString();
              if (accion === 'rechazar') reelsPrueba.liberar(negocioId, it); // el Reel original vuelve a estar disponible
              // Sale de la cola de publicación; el registro de una ya
              // publicada se conserva (así no se publica de nuevo al re-aprobar).
              if (it.publicacion && it.publicacion.estado !== 'publicada') delete it.publicacion;
            };
          } else if ((accion === 'publicar-ahora' || accion === 'reintentar') && req.method === 'POST') {
            if (item.status !== 'aprobado') return sendJSON(res, 400, { error: 'Primero aprueba la pieza' });
            if (publicada) return sendJSON(res, 409, { error: 'Esta pieza ya está publicada en Instagram' });
            if (!igConectado) return sendJSON(res, 400, { error: 'Conecta Instagram en Conexiones y ajustes para publicar' });
            if (seEstaPublicando) return ocupada();
            aplicar = (it) => {
              const ahora = new Date().toISOString();
              // "Publicar ahora" también mueve la fecha; "Reintentar" la deja.
              if (accion === 'publicar-ahora') programacion.fijarPublicarEl(it, ahora);
              else programacion.asegurarPublicarEl(it);
              programar(it, ahora, req);
            };
            publicarYa = true;
          } else if (accion === 'formato' && req.method === 'PUT') {
            if (publicada) return sendJSON(res, 409, { error: 'Esta pieza ya está publicada en Instagram' });
            if (seEstaPublicando) return ocupada();
            const body = await readBody(req);
            if (!FORMATOS[body.formato]) return sendJSON(res, 400, { error: 'Formato inválido' });
            aplicar = (it) => {
              it.formato = body.formato;
              it.aspect = FORMATOS[body.formato].aspect;
              const enfoque = (negocio.estrategia.enfoques || []).find((e) => e.id === it.enfoqueId) || { label: it.tag || 'la publicación', categoriaFoto: it.categoriaFoto };
              it.idea = ideaGenerica(body.formato, enfoque);
              programacion.asegurarPublicarEl(it);
              it.date = programacion.etiquetaFecha(it.publicarEl, FORMATOS[body.formato].etiqueta);
              descartarContenedor(it);
            };
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
            const hashtagsNuevos = body.hashtags === undefined ? null : limpiarHashtags(body.hashtags);
            aplicar = (it) => {
              if (hashtagsNuevos) { if (hashtagsNuevos.length) it.hashtags = hashtagsNuevos; else delete it.hashtags; }
              const anterior = it.variants[it.variantIndex];
              if (body.caption === anterior) return;
              // Se guarda lo que escribió la IA la primera vez que el dueño lo
              // corrige: el par "IA → dueño" es lo que aprende el generador.
              if (!it.editado) it.textoIA = anterior;
              it.editado = true;
              it.variants[it.variantIndex] = body.caption;
              guardian.aplicar(it, negocio);
            };
          } else if (accion === 'regenerar' && req.method === 'POST' && (negocio.plan || 'gratis') === 'gratis') {
            return sendJSON(res, 402, { error: 'Tu cuenta no tiene un plan activo. Elige un plan (o activa tu prueba gratis) para crear contenido.', sinPlan: true });
          } else if (accion === 'regenerar' && req.method === 'POST') {
            // indicacion: "más corto", "menciona el despacho gratis"… pide
            // siempre un texto nuevo a la IA en vez de rotar versiones.
            const indicacion = contextoIA.indicacion((await readBody(req).catch(() => ({}))).indicacion);
            if (!indicacion && item.variantIndex + 1 < item.variants.length) {
              aplicar = (it) => { it.variantIndex = Math.min(it.variantIndex + 1, it.variants.length - 1); };
            } else {
              const usaIA = getPlan(negocio.plan).usaIA;
              if (usaIA && textosIADisponibles(negocio) <= 0) {
                return sendJSON(res, 403, sinCupo('piezas', 'Ya usaste todas las piezas con IA de este mes. Se renuevan el día 1, o puedes cargar más.'));
              }
              const nueva = usaIA ? await generarVarianteConClaude(negocio, item.enfoqueId, item.variants, formatoDe(item), indicacion) : null;
              if (nueva) {
                registrarUsoIA(negocioId, 'usoTextosIA', 1);
                aplicar = (it) => {
                  it.variants.push(nueva.caption);
                  it.variantIndex = it.variants.length - 1;
                  if (nueva.gancho) it.gancho = nueva.gancho;
                  if (nueva.hashtags.length) it.hashtags = nueva.hashtags;
                };
              } else {
                aplicar = (it) => { it.variantIndex = 0; }; // sin IA: vuelve a rotar desde la primera
              }
            }
            // Otra versión es un texto nuevo de la IA: la corrección anterior
            // era sobre otro texto y ya no cuenta como edición de este.
            const cambiarVersion = aplicar;
            aplicar = (it) => { cambiarVersion(it); delete it.editado; delete it.textoIA; guardian.aplicar(it, negocio); };
          } else if (accion === 'imagen' && req.method === 'POST') {
            if (!medios.proveedorImagen()) {
              return sendJSON(res, 400, { error: 'La generación de imágenes con IA no está configurada' });
            }
            // rehacer: descarta la imagen anterior y genera otra (cuenta en la cuota).
            const cuerpoImagen = await readBody(req).catch(() => ({}));
            if (cuerpoImagen.rehacer && store.tieneFotoIA(negocioId, item.id)) fs.rmSync(store.fotoIAAbsolutePath(negocioId, item.id), { force: true });
            if (!store.tieneFotoIA(negocioId, item.id)) {
              const prep = prepararCreacion(negocio, 'foto', cuerpoImagen.calidad);
              if (!prep.costo) return sendJSON(res, prep.status, prep.body);
              let buffer;
              try {
                buffer = await medios.generarImagen({ negocio, item, incluirTexto: negocio.estiloImagen === 'texto', modelo: prep.costo.modelo });
              } catch (err) {
                const e = respuestaErrorMedios(err, 'la imagen con IA');
                return sendJSON(res, e.status, e.body);
              }
              store.guardarFotoIA(negocioId, item.id, buffer);
              creditos.cobrar(negocioId, prep.costo.creditos, { tipo: 'foto', detalle: nombreCreacion('foto', prep.costo) });
              costos.imagen(negocioId, medios.proveedorImagen(), prep.costo.modelo.ruta, prep.costo.modelo.usd);
            }
            aplicar = (it) => { it.imagenIA = true; it.imagenIAVersion = Date.now(); };
          } else if (accion === 'video-ia' && req.method === 'POST') {
            // Video con IA para un Reel o historia: se anima la foto de la
            // pieza si tiene una (real o IA), si no se genera desde el texto.
            if (!medios.proveedorVideo()) return sendJSON(res, 400, { error: 'La generación de videos con IA no está configurada' });
            if (!['reel', 'historia'].includes(formatoDe(item))) return sendJSON(res, 400, { error: 'Los videos con IA son para Reels e historias' });
            if (item.video && !item.video.generadoIA) return sendJSON(res, 409, { error: 'Esta pieza ya tiene un video subido. Quítalo primero si quieres uno con IA.' });
            const cuerpoVideo = await readBody(req).catch(() => ({}));
            const prepV = prepararCreacion(negocio, 'video', cuerpoVideo.calidad, cuerpoVideo.segundos);
            if (!prepV.costo) return sendJSON(res, prepV.status, prepV.body);
            let imagenUrl = null;
            const base = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : null;
            if (base) {
              const propia = fotoDeItem(negocioId, item);
              const cat = propia && propia.categoria;
              const real = propia && propia.archivo;
              if (real) imagenUrl = `${base}/fotos/${negocioId}/${cat}/${real}?t=${auth.crearTokenFoto(negocioId, cat, real, 60)}`;
              else if (store.tieneFotoIA(negocioId, item.id)) {
                const a = item.id + '.png';
                imagenUrl = `${base}/fotos/${negocioId}/_ia/${a}?t=${auth.crearTokenFoto(negocioId, '_ia', a, 60)}`;
              }
            }
            // Se cobra antes de pedirlo (así dos pedidos a la vez no gastan de
            // más) y se devuelve si Higgsfield no lo acepta o el video no llega.
            const cobroV = creditos.cobrar(negocioId, prepV.costo.creditos, { tipo: 'video', detalle: nombreCreacion('video', prepV.costo) });
            if (!cobroV) return sendJSON(res, 403, sinCreditos('No te alcanzan los créditos para este video. Puedes comprar más.'));
            let inicio;
            try {
              inicio = await medios.iniciarVideo({ negocio, item, imagenUrl, modelo: prepV.costo.modelo, segundos: prepV.costo.segundos, cobro: cobroV });
            } catch (err) {
              creditos.devolver(negocioId, cobroV, 'Devolución: el video no se pudo iniciar');
              const e = respuestaErrorMedios(err, 'el video');
              return sendJSON(res, e.status, e.body);
            }
            const segV = prepV.costo.segundos, calV = prepV.costo.calidad, crV = prepV.costo.creditos;
            aplicar = (it) => { it.videoIA = { estado: 'generando', desdeFoto: inicio.desdeFoto, iniciadoEl: new Date().toISOString(), segundos: segV, calidad: calV, creditos: crV }; };
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

    // --- imágenes de "Mi estilo": /referencias/:negocioId/:archivo (solo con sesión) ---
    if (parts[0] === 'referencias' && parts.length === 3 && req.method === 'GET') {
      const [, negocioId, archivo] = parts;
      if (sesionActual(req) !== negocioId) return notFound(res);
      const filePath = estilo.imagenAbsoluta(negocioId, archivo);
      if (!filePath.startsWith(estilo.REFERENCIAS_DIR)) return notFound(res);
      return fs.readFile(filePath, (err, content) => {
        if (err) return notFound(res);
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'image/jpeg', 'X-Content-Type-Options': 'nosniff' });
        res.end(content);
      });
    }

    // --- videos: /videos/:negocioId/:archivo --- (sesión del negocio, o
    // enlace firmado temporal para que Meta los descargue al publicar)
    if (parts[0] === 'videos' && parts.length === 3 && req.method === 'GET') {
      const [, negocioId, archivo] = parts;
      const tokenVideo = url.searchParams.get('t');
      const autorizado = sesionActual(req) === negocioId
        || (tokenVideo && auth.verificarTokenFoto(tokenVideo, negocioId, '_video', archivo));
      if (!autorizado) return notFound(res);
      const filePath = store.videoAbsolutePath(path.basename(negocioId), path.basename(archivo));
      if (!filePath.startsWith(store.VIDEOS_DIR)) return notFound(res);
      return fs.stat(filePath, (err, info) => {
        if (err || !info.isFile()) return notFound(res);
        res.writeHead(200, {
          'Content-Type': path.extname(filePath) === '.mov' ? 'video/quicktime' : 'video/mp4',
          'Content-Length': info.size,
          'X-Content-Type-Options': 'nosniff',
        });
        fs.createReadStream(filePath).pipe(res);
      });
    }

    // --- fotos subidas: /fotos/:negocioId/:categoria/:archivo ---
    if (parts[0] === 'fotos' && parts.length === 4 && req.method === 'GET') {
      const [, negocioId, categoria, archivo] = parts;
      const tokenFoto = url.searchParams.get('t');
      const autorizadoPorToken = tokenFoto && auth.verificarTokenFoto(tokenFoto, negocioId, categoria, archivo);
      if (sesionActual(req) !== negocioId && !autorizadoPorToken) return notFound(res);
      const esGenerada = categoria === '_ia';
      const esMarca = categoria === '_marca'; // logo y diseños (server/marca.js)
      const filePath = esMarca ? marca.ruta(negocioId, archivo)
        : esGenerada
          ? store.fotoIAAbsolutePath(path.basename(negocioId), path.basename(archivo, '.png'))
          : store.fotoAbsolutePath(path.basename(negocioId), path.basename(categoria), path.basename(archivo));
      const dirPermitido = esMarca ? marca.MARCA_DIR : esGenerada ? store.FOTOS_IA_DIR : store.FOTOS_DIR;
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

    // --- estáticos --- (HEAD igual que GET: Node no manda el cuerpo)
    if (req.method === 'GET' || req.method === 'HEAD') {
      if (parts[0] === 'admin' && parts.length === 1) {
        if (!admin.activo()) return notFound(res);
        return serveStatic(res, APP_DIR, '/admin.html');
      }
      if (parts[0] === 'app') {
        const rel = '/' + parts.slice(1).join('/');
        return serveStatic(res, APP_DIR, rel);
      }
      if (req.method === 'GET') admin.registrarVisita(req, url.pathname);
      return serveStatic(res, SITE_DIR, url.pathname);
    }
    return notFound(res);
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'Error interno' });
  }
});

// Railway manda SIGTERM antes de cada redeploy: se dejan de tomar trabajos
// nuevos, se cierran las conexiones y la base. Si una publicación quedó a
// medias, el publicador la retoma al arrancar (sin duplicarla).
let apagando = false;
function apagar(senal) {
  if (apagando) return;
  apagando = true;
  console.log(`${senal} recibido: cerrando Rubrofy…`);
  publicador.detener();
  sincronizador.detener();
  avisador.detener();
  sondeoMedios.detener();
  clearInterval(timerRecordatorios);
  server.close(() => {
    try { store.db.close(); } catch (err) { /* ya cerrada */ }
    process.exit(0);
  });
  server.closeIdleConnections(); // las keep-alive ociosas no retienen el cierre
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));

// Última red: un error que se escape de una promesa se registra en vez de
// tumbar el servidor (y con él las ediciones de reels en curso).
process.on('unhandledRejection', (err) => console.error('Promesa rechazada sin manejar:', err));

server.listen(PORT, () => {
  console.log(`Rubrofy corriendo en http://localhost:${PORT} · datos en ${require('./datos').DATA_DIR}`);
  publicador.iniciar();
  sincronizador.iniciar();
  avisador.iniciar();
  console.log(`Publicador activo: revisa las publicaciones programadas cada ${Number(process.env.PUBLICADOR_INTERVALO_SEG) || 30} s (zona ${programacion.ZONA}).`);
  if (!process.env.PUBLIC_URL) {
    console.log('PUBLIC_URL no configurada: el publicador usará la URL desde la que se aprobó cada pieza. En producción conviene definirla.');
  }
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(`Usando modelo ${require('./claude').MODEL} para estrategia y contenido.`);
  } else {
    console.log('ANTHROPIC_API_KEY no configurada: estrategia y contenido usan las plantillas genéricas de respaldo.');
  }
  const med = medios.estado();
  console.log(med.imagen
    ? `Imágenes y videos con IA vía ${med.imagen} (imagen: ${med.modeloImagen}, video: ${med.modeloVideo}).`
    : 'HIGGSFIELD_API_KEY / OPENAI_API_KEY no configuradas: sin imágenes ni videos con IA.');
  console.log(instagram.loginConfigurado()
    ? '"Conectar con Instagram" activo (INSTAGRAM_APP_ID configurado).'
    : 'INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET no configurados: Instagram se conecta pegando ID y token.');
  console.log(correo.configurado()
    ? 'Correo configurado: resumen semanal los lunes.'
    : 'RESEND_API_KEY / EMAIL_FROM no configurados: no se envían resúmenes semanales.');
  if (pagos.proveedor() === 'flow') {
    console.log(`Cobro con Flow (${process.env.FLOW_SANDBOX === '1' ? 'sandbox, pagos de prueba' : 'producción'}): planes y recargas disponibles.`);
  } else if (process.env.STRIPE_SECRET_KEY) {
    const planesDisponibles = listPlanesPublico().filter((p) => p.disponible && p.id !== 'gratis').map((p) => p.id);
    console.log(planesDisponibles.length
      ? `Stripe configurado — planes de pago disponibles: ${planesDisponibles.join(', ')}.`
      : 'Stripe configurado, pero falta STRIPE_PRICE_PRO / STRIPE_PRICE_ESTUDIO: nadie puede suscribirse todavía.');
  } else {
    console.log('Sin cobro configurado (FLOW_API_KEY/FLOW_SECRET_KEY o STRIPE_SECRET_KEY): nadie puede suscribirse todavía.');
  }
});
