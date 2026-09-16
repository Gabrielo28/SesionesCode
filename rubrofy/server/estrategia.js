// La "estrategia" es la plantilla de contenido de un negocio: tono, enfoques
// (ángulos de contenido) y categorías de foto. Antes era una tabla fija por
// nicho (turismo/panadería/clínica dental); ahora la genera Claude a partir
// de la descripción libre del rubro que el negocio escribe al registrarse,
// para poder adaptarse a cualquier tipo de negocio. Sin ANTHROPIC_API_KEY
// (o si Claude falla) usa una plantilla genérica razonable como respaldo.

const MODEL = 'claude-haiku-4-5-20251001';

function estrategiaGenerica(rubro) {
  return {
    rubro,
    tono: 'cercano y directo, que hable de lo que el negocio realmente ofrece',
    categoriasFoto: ['producto', 'local', 'equipo'],
    enfoques: [
      { id: 'producto', label: 'Producto o servicio', pista: 'muestra o describe lo que se ofrece, con un detalle concreto', categoriaFoto: 'producto' },
      { id: 'precio', label: 'Precio y promociones', pista: 'menciona una tarifa, promoción o condición real', categoriaFoto: 'local' },
      { id: 'urgencia', label: 'Urgencia', pista: 'destaca cupos limitados, stock o una fecha que se acerca', categoriaFoto: 'local' },
      { id: 'equipo', label: 'Detrás de escena', pista: 'muestra el equipo, el proceso o el lugar', categoriaFoto: 'equipo' },
    ],
  };
}

function esEstrategiaValida(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.tono !== 'string' || !obj.tono.trim()) return false;
  if (!Array.isArray(obj.categoriasFoto) || obj.categoriasFoto.length < 1) return false;
  if (!Array.isArray(obj.enfoques) || obj.enfoques.length < 1) return false;
  return obj.enfoques.every((e) =>
    e && typeof e.id === 'string' && e.id.trim() &&
    typeof e.label === 'string' && e.label.trim() &&
    typeof e.pista === 'string' && e.pista.trim() &&
    typeof e.categoriaFoto === 'string' && obj.categoriasFoto.includes(e.categoriaFoto)
  );
}

function extraerJSON(texto) {
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio === -1 || fin === -1) return null;
  try {
    return JSON.parse(texto.slice(inicio, fin + 1));
  } catch (err) {
    return null;
  }
}

// Genera la estrategia de contenido de un negocio a partir de su rubro
// (texto libre, ej: "panadería artesanal de barrio" o "estudio de tatuajes").
async function generarEstrategia({ nombre, rubro }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return estrategiaGenerica(rubro);

  const prompt =
    `Eres un estratega de contenido para redes sociales. Un negocio llamado "${nombre}" ` +
    `se describe a sí mismo así: "${rubro}".\n\n` +
    `Diseña su estrategia de contenido para Instagram en JSON puro (sin texto fuera del JSON, ` +
    `sin markdown), con esta forma exacta:\n` +
    `{"tono": "descripción breve del tono de voz, en español, una frase", ` +
    `"categoriasFoto": ["categoria1", "categoria2"], ` +
    `"enfoques": [{"id": "slug-corto", "label": "Nombre corto", "pista": "qué debe transmitir este tipo de publicación", "categoriaFoto": "una de categoriasFoto"}]}\n\n` +
    `Reglas:\n` +
    `- Exactamente 4 enfoques distintos y relevantes para ESTE negocio en particular, no genéricos de otro rubro.\n` +
    `- "categoriasFoto": 2 o 3 tipos de fotos que este negocio realmente podría tomar (ej: "platos", "sala de espera", "fachada", "piezas terminadas"), específicas del rubro, no genéricas como "foto1".\n` +
    `- Cada enfoque.categoriaFoto debe ser exactamente una de las categoriasFoto declaradas.\n` +
    `- Los "id" de los enfoques van en minúsculas, sin espacios ni tildes (ej: "experiencia", "precio", "urgencia").\n` +
    `- Responde SOLO con el JSON, nada más.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return estrategiaGenerica(rubro);
    const data = await res.json();
    const texto = data && data.content && data.content[0] && data.content[0].text;
    const parsed = texto && extraerJSON(texto);
    if (!esEstrategiaValida(parsed)) return estrategiaGenerica(rubro);
    return { rubro, tono: parsed.tono, categoriasFoto: parsed.categoriasFoto, enfoques: parsed.enfoques };
  } catch (err) {
    return estrategiaGenerica(rubro);
  }
}

module.exports = { generarEstrategia, estrategiaGenerica };
