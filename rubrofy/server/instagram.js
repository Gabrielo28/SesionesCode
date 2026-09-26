// Publicación real en Instagram vía Graph API (Instagram API with Instagram
// Login). Dos llamadas separadas — crear el contenedor de media y luego
// publicarlo — para que el publicador (server/publicador.js) pueda guardar
// el contenedor entre medio: si la publicación falla o el servidor se
// reinicia, reintenta publicando ESE contenedor en vez de crear otro (lo que
// arriesgaría un post duplicado).
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login

const GRAPH_VERSION = 'v21.0';
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

async function graphPost(path, params) {
  try {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      const error = data.error || {};
      return {
        ok: false,
        tipo: clasificarError(error),
        error: error.message || `Instagram respondió ${res.status}`,
        codigo: error.code || null,
      };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, tipo: 'reintentable', error: 'Error de red al conectar con Instagram: ' + err.message, codigo: null };
  }
}

// Paso 1: Instagram descarga la foto desde imageUrl y deja el post listo
// (sin publicar). Devuelve { ok, id } con el id del contenedor.
function crearContenedor({ userId, accessToken, imageUrl, caption }) {
  return graphPost(`/${userId}/media`, { image_url: imageUrl, caption: caption || '', access_token: accessToken });
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
    if (!res.ok || !data.access_token) {
      const error = data.error || {};
      return { ok: false, tipo: clasificarError(error), error: error.message || `Instagram respondió ${res.status}` };
    }
    return { ok: true, accessToken: data.access_token, expiraEnSeg: Number(data.expires_in) || 60 * 24 * 3600 };
  } catch (err) {
    return { ok: false, tipo: 'reintentable', error: 'Error de red al conectar con Instagram: ' + err.message };
  }
}

module.exports = { crearContenedor, publicarContenedor, renovarToken, clasificarError };
