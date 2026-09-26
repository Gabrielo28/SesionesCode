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

module.exports = { crearContenedor, estadoContenedor, publicarContenedor, renovarToken, clasificarError, GRAPH_BASE };
