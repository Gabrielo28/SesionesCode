// Genera fotos con IA (OpenAI) para piezas de contenido que todavía no
// tienen una foto real subida por el negocio. Nunca reemplaza una foto real
// si existe — es solo un respaldo mejor que el degradé de color. Sin
// OPENAI_API_KEY, generarImagenIA devuelve null y el llamador cae al
// comportamiento de siempre (degradé, o "sin foto asignada" al publicar).

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

function construirPrompt({ negocio, item, incluirTexto }) {
  const estrategia = negocio.estrategia || {};
  const enfoque = (estrategia.enfoques || []).find((e) => e.id === item.enfoqueId);
  const descripcionEnfoque = enfoque ? `${enfoque.label} — ${enfoque.pista}` : item.tag;

  let prompt =
    `Fotografía publicitaria realista para Instagram de un negocio de ${estrategia.rubro || 'un rubro no especificado'} ` +
    `llamado "${negocio.nombre}". Categoría de foto: ${item.categoriaFoto || 'general'}. ` +
    `Enfoque de la publicación: ${descripcionEnfoque}. ` +
    `Estilo: fotografía profesional, luz natural, composición atractiva para redes sociales, sin marcas de agua ni logos inventados.`;

  if (incluirTexto && item.headline) {
    prompt += ` Incluye el siguiente titular como texto grande y legible sobre la imagen, en mayúsculas: "${item.headline.replace(/\n/g, ' ')}".`;
  } else {
    prompt += ' No incluyas ningún texto, letras ni palabras en la imagen.';
  }
  return prompt;
}

function tamanoParaAspecto(aspect) {
  return String(aspect || '').trim().startsWith('9') ? '1024x1536' : '1024x1024';
}

// Devuelve un Buffer con la imagen generada, o null si no hay API key o si algo falla.
async function generarImagenIA({ negocio, item, incluirTexto }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: construirPrompt({ negocio, item, incluirTexto }),
        size: tamanoParaAspecto(item.aspect),
        n: 1,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const resultado = data && data.data && data.data[0];
    if (!resultado) return null;
    if (resultado.b64_json) return Buffer.from(resultado.b64_json, 'base64');
    if (resultado.url) {
      const imgRes = await fetch(resultado.url);
      if (!imgRes.ok) return null;
      return Buffer.from(await imgRes.arrayBuffer());
    }
    return null;
  } catch (err) {
    return null;
  }
}

module.exports = { generarImagenIA };
