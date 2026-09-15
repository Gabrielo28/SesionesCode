// Publicación real en Instagram vía Graph API (Instagram API with Instagram
// Login). Dos llamadas: crear el contenedor de media, luego publicarlo.
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

async function publicarEnInstagram({ userId, accessToken, imageUrl, caption }) {
  try {
    const crear = await fetch(`${GRAPH_BASE}/${userId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ image_url: imageUrl, caption: caption || '', access_token: accessToken }),
    });
    const creado = await crear.json();
    if (!crear.ok || !creado.id) {
      return { ok: false, error: (creado.error && creado.error.message) || 'No se pudo crear el contenido en Instagram' };
    }

    const publicar = await fetch(`${GRAPH_BASE}/${userId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: creado.id, access_token: accessToken }),
    });
    const publicado = await publicar.json();
    if (!publicar.ok || !publicado.id) {
      return { ok: false, error: (publicado.error && publicado.error.message) || 'No se pudo publicar en Instagram' };
    }

    return { ok: true, mediaId: publicado.id };
  } catch (err) {
    return { ok: false, error: 'Error de red al conectar con Instagram: ' + err.message };
  }
}

module.exports = { publicarEnInstagram };
