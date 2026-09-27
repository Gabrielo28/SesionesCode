// Cliente mínimo de la API de Claude para los módulos nuevos (voz de marca,
// redactor, prompts de imagen y video). Devuelve el texto de la respuesta o
// null si no hay API key o algo falla: cada llamador tiene su plan B.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

function configurado() {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function pedir({ prompt, maxTokens = 800, imagenes }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const content = imagenes && imagenes.length
    ? [...imagenes.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.tipo, data: i.base64 } })), { type: 'text', text: prompt }]
    : prompt;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const texto = data && data.content && data.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
    return texto || null;
  } catch (err) {
    return null;
  }
}

// El primer objeto u arreglo JSON dentro del texto (Claude a veces agrega texto alrededor).
function extraerJSON(texto, tipo = 'objeto') {
  if (!texto) return null;
  const [a, b] = tipo === 'arreglo' ? ['[', ']'] : ['{', '}'];
  const inicio = texto.indexOf(a);
  const fin = texto.lastIndexOf(b);
  if (inicio === -1 || fin <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fin + 1));
  } catch (err) {
    return null;
  }
}

module.exports = { pedir, extraerJSON, configurado, MODEL };
