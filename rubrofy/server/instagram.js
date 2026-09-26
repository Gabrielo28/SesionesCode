// Publicación real en Instagram vía Graph API (Instagram API with Instagram
// Login). Dos llamadas separadas — crear el contenedor de media y luego
// publicarlo — para que el publicador (server/publicador.js) pueda guardar
// el contenedor entre medio: si la publicación falla o el servidor se
// reinicia, reintenta publicando ESE contenedor en vez de crear otro (lo que
// arriesgaría un post duplicado).
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login

// Meta retira cada versión de la Graph API unos dos años después de lanzarla;
// se puede subir sin tocar código con META_GRAPH_VERSION.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

// Qué hacer con un error de la Graph API:
// - auth: el token venció o fue revocado → el negocio debe reconectar.
// - limite: se pasó un límite de llamadas de Meta → reintentar más tarde.
// - no_listo: el contenedor todavía se está procesando → reintentar pronto.
// - permanente: parámetro inválido (ej. caption demasiado largo) → no reintentar.
// - reintentable: error del lado de Meta o de red → reintentar con espera.
function clasificarError(error) {
  const code = error && error.code;
  if (code === 190 || code === 102 || code === 10 || (code >= 200 && code < 300)) return 'auth';
  if ([4, 17, 32, 613, 80002].includes(code)) return 'limite';
  if (code === 9007) return 'no_listo';
  if (code === 100) return 'permanente';
  return 'reintentable';
}

function errorDeGraph(data, status) {
  const error = (data && data.error) || {};
  return {
    ok: false,
    tipo: clasificarError(error),
    error: error.message || `Instagram respondió ${status}`,
    codigo: error.code || null,
  };
}

async function graphPost(path, params) {
  try {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) return errorDeGraph(data, res.status);
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, tipo: 'reintentable', error: 'Error de red al conectar con Instagram: ' + err.message, codigo: null };
  }
}

// Paso 1: Instagram descarga la foto o el video y deja el post listo (sin
// publicar). Devuelve { ok, id } con el id del contenedor. Según `tipo`:
//   imagen   → post de feed con una foto (imageUrl)
//   carrusel → de 2 a 10 fotos (imageUrls): un contenedor por foto y uno
//              padre que las agrupa; el que se publica es el padre
//   reel     → video 9:16 (videoUrl); Meta lo procesa unos minutos
//   historia → foto (imageUrl) o video (videoUrl)
async function crearContenedor({ userId, accessToken, tipo = 'imagen', imageUrl, imageUrls, videoUrl, caption }) {
  const base = { access_token: accessToken };
  if (tipo === 'carrusel') {
    const hijos = [];
    for (const url of imageUrls || []) {
      const hijo = await graphPost(`/${userId}/media`, Object.assign({ image_url: url, is_carousel_item: 'true' }, base));
      if (!hijo.ok) return hijo;
      hijos.push(hijo.id);
    }
    return graphPost(`/${userId}/media`, Object.assign({ media_type: 'CAROUSEL', children: hijos.join(','), caption: caption || '' }, base));
  }
  if (tipo === 'reel') {
    return graphPost(`/${userId}/media`, Object.assign({ media_type: 'REELS', video_url: videoUrl, caption: caption || '', share_to_feed: 'true' }, base));
  }
  if (tipo === 'historia') {
    const media = videoUrl ? { video_url: videoUrl } : { image_url: imageUrl };
    return graphPost(`/${userId}/media`, Object.assign({ media_type: 'STORIES' }, media, base));
  }
  return graphPost(`/${userId}/media`, Object.assign({ image_url: imageUrl, caption: caption || '' }, base));
}

// Estado de un contenedor: IN_PROGRESS (procesando video), FINISHED (listo),
// ERROR, EXPIRED (pasaron 24 h) o PUBLISHED (ya se publicó). Sirve para no
// publicar un video a medio procesar y para no duplicar uno ya publicado.
async function estadoContenedor({ accessToken, creationId }) {
  try {
    const url = `${GRAPH_BASE}/${creationId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.status_code) return errorDeGraph(data, res.status);
    return { ok: true, estado: data.status_code, detalle: data.status || null };
  } catch (err) {
    return { ok: false, tipo: 'reintentable', error: 'Error de red al conectar con Instagram: ' + err.message, codigo: null };
  }
}

// Paso 2: publica el contenedor. Devuelve { ok, id } con el id del post.
function publicarContenedor({ userId, accessToken, creationId }) {
  return graphPost(`/${userId}/media_publish`, { creation_id: creationId, access_token: accessToken });
}

// Los tokens de larga duración duran 60 días y se pueden renovar (con al
// menos 24 horas de antigüedad) por otros 60. Devuelve el token nuevo.
async function renovarToken(accessToken) {
  try {
    const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) return errorDeGraph(data, res.status);
    return { ok: true, accessToken: data.access_token, expiraEnSeg: Number(data.expires_in) || 60 * 24 * 3600 };
  } catch (err) {
    return { ok: false, tipo: 'reintentable', error: 'Error de red al conectar con Instagram: ' + err.message };
  }
}

// --- "Conectar con Instagram" (API de Instagram con inicio de sesión de
// Instagram). El dueño inicia sesión en Instagram, acepta los permisos y
// vuelve con un código que se canjea por un token de larga duración.
// Requiere INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET: los de la sección
// "API con inicio de sesión de Instagram" de la app en Meta for Developers
// (no son el ID y la clave de la app de Meta).
const PERMISOS_LOGIN = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
];

function loginConfigurado() {
  return !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}

function urlLogin(redirectUri, state) {
  const q = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PERMISOS_LOGIN.join(','),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

class ErrorLogin extends Error {}

async function jsonDe(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = (data.error && (data.error.message || data.error)) || data.error_message || data.error_description || `HTTP ${res.status}`;
    throw new ErrorLogin(typeof m === 'string' ? m : JSON.stringify(m));
  }
  return data;
}

// Código → token de corta duración → token de 60 días → cuenta profesional.
// Devuelve { userId, username, accessToken, expiraEnSeg }.
async function conectarConCodigo(codigo, redirectUri) {
  const code = String(codigo || '').replace(/#_$/, ''); // Instagram agrega "#_" al final
  if (!code) throw new ErrorLogin('Instagram no devolvió el código de acceso');
  const corto = await jsonDe(await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  }));
  const fila = Array.isArray(corto.data) ? corto.data[0] || {} : corto;
  if (!fila.access_token) throw new ErrorLogin('Instagram no entregó un token');
  const largo = await jsonDe(await fetch('https://graph.instagram.com/access_token?' + new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    access_token: fila.access_token,
  })));
  const token = largo.access_token || fila.access_token;
  // El ID con el que se publica es el de la cuenta profesional (user_id de /me).
  const me = await jsonDe(await fetch(`${GRAPH_BASE}/me?` + new URLSearchParams({ fields: 'user_id,username,account_type', access_token: token })));
  const userId = String(me.user_id || fila.user_id || '');
  if (!/^[0-9]+$/.test(userId)) throw new ErrorLogin('No se pudo leer el ID de tu cuenta de Instagram');
  return { userId, username: me.username || null, accessToken: token, expiraEnSeg: Number(largo.expires_in) || 60 * 24 * 3600 };
}

module.exports = {
  crearContenedor, estadoContenedor, publicarContenedor, renovarToken, clasificarError, GRAPH_BASE,
  loginConfigurado, urlLogin, conectarConCodigo, ErrorLogin, PERMISOS_LOGIN,
};
