// La "estrategia" es la plantilla de contenido de un negocio: tono, enfoques
// (ángulos de contenido) y categorías de foto. Antes era una tabla fija por
// nicho (turismo/panadería/clínica dental); ahora la genera Claude a partir
// de la descripción libre del rubro que el negocio escribe al registrarse,
// para poder adaptarse a cualquier tipo de negocio. Sin ANTHROPIC_API_KEY
// (o si Claude falla) usa una plantilla genérica razonable como respaldo.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const planContenido = require('./plan-contenido');

// Resumen de respaldo (sin IA): qué se va a comunicar y para qué.
function resumenGenerico(plan) {
  const objetivos = ((plan && plan.objetivos) || [])
    .map((id) => (planContenido.OBJETIVOS.find((o) => o.id === id) || {}).label).filter(Boolean);
  const para = objetivos.length ? objetivos.join(' y ').toLowerCase() : 'que más gente conozca y elija tu negocio';
  return `Mostrar lo que ofreces con datos concretos (precios, promociones y fotos reales), alternando ` +
    `producto, precio, urgencia y detrás de escena, para ${para}.`;
}

function estrategiaGenerica(rubro, plan, categoriasFoto) {
  return {
    rubro,
    resumen: resumenGenerico(plan),
    tono: 'cercano y directo, que hable de lo que el negocio realmente ofrece',
    categoriasFoto: categoriasFoto && categoriasFoto.length ? categoriasFoto : ['producto', 'local', 'equipo'],
    enfoques: [
      { id: 'producto', label: 'Producto o servicio', pista: 'muestra o describe lo que se ofrece, con un detalle concreto', categoriaFoto: 'producto' },
      { id: 'precio', label: 'Precio y promociones', pista: 'menciona una tarifa, promoción o condición real', categoriaFoto: 'local' },
      { id: 'urgencia', label: 'Urgencia', pista: 'destaca cupos limitados, stock o una fecha que se acerca', categoriaFoto: 'local' },
      { id: 'equipo', label: 'Detrás de escena', pista: 'muestra el equipo, el proceso o el lugar', categoriaFoto: 'equipo' },
    ].map((e, i, lista) => {
      // Con categorías propias del negocio, cada enfoque usa una de ellas.
      const cats = categoriasFoto && categoriasFoto.length ? categoriasFoto : null;
      return cats ? Object.assign({}, e, { categoriaFoto: cats[i % cats.length] }) : e;
    }),
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
// (texto libre, ej: "panadería artesanal de barrio" o "estudio de tatuajes")
// y, si ya lo respondió, su plan de contenido (objetivo, público, tono).
// categoriasFoto: si el negocio ya tiene categorías (y quizás fotos subidas),
// se mantienen para no dejar fotos huérfanas.
// contextoExtra: bloque de contexto para la IA (server/contexto-ia.js) y voz de marca.
async function generarEstrategia({ nombre, rubro, plan, categoriasFoto, contextoExtra, negocioId }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const respaldo = () => estrategiaGenerica(rubro, plan, categoriasFoto);
  if (!apiKey) return respaldo();

  const contexto = planContenido.textoParaPrompt(plan);
  const cats = categoriasFoto && categoriasFoto.length ? categoriasFoto : null;
  const prompt =
    `Eres un estratega de contenido para redes sociales. Un negocio llamado "${nombre}" ` +
    `se describe a sí mismo así: "${rubro}".` + (contexto ? ` ${contexto}` : '') + (contextoExtra || '') + `\n\n` +
    `Diseña su estrategia de contenido para Instagram en JSON puro (sin texto fuera del JSON, ` +
    `sin markdown), con esta forma exacta:\n` +
    `{"resumen": "2 frases: qué va a comunicar el negocio en Instagram y cómo eso lo acerca a su objetivo", ` +
    `"tono": "descripción breve del tono de voz, en español, una frase", ` +
    `"categoriasFoto": ["categoria1", "categoria2"], ` +
    `"enfoques": [{"id": "slug-corto", "label": "Nombre corto", "pista": "qué debe transmitir este tipo de publicación", "categoriaFoto": "una de categoriasFoto"}]}\n\n` +
    `Reglas:\n` +
    `- Entre 4 y 5 enfoques distintos y relevantes para ESTE negocio en particular, no genéricos de otro rubro, pensados para su objetivo.\n` +
    (cats
      ? `- "categoriasFoto" debe ser exactamente ${JSON.stringify(cats)} (el negocio ya tiene fotos en esas categorías).\n`
      : `- "categoriasFoto": 2 o 3 tipos de fotos que este negocio realmente podría tomar (ej: "platos", "sala de espera", "fachada", "piezas terminadas"), específicas del rubro, no genéricas como "foto1".\n`) +
    `- Cada enfoque.categoriaFoto debe ser exactamente una de las categoriasFoto declaradas.\n` +
    `- Los "id" de los enfoques van en minúsculas, sin espacios ni tildes (ej: "experiencia", "precio", "urgencia").\n` +
    `- Si hay un tono preferido, respétalo.\n` +
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
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return respaldo();
    const data = await res.json();
    require('./costos').claude(negocioId, 'estrategia', MODEL, data && data.usage);
    const texto = data && data.content && data.content[0] && data.content[0].text;
    const parsed = texto && extraerJSON(texto);
    if (!esEstrategiaValida(parsed)) return respaldo();
    if (cats && JSON.stringify(parsed.categoriasFoto) !== JSON.stringify(cats)) return respaldo();
    return {
      rubro,
      resumen: typeof parsed.resumen === 'string' && parsed.resumen.trim() ? parsed.resumen.trim().slice(0, 500) : resumenGenerico(plan),
      tono: parsed.tono,
      categoriasFoto: parsed.categoriasFoto,
      enfoques: parsed.enfoques.slice(0, 6).map(limpiarEnfoque),
    };
  } catch (err) {
    return respaldo();
  }
}

function slug(str) {
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function limpiarEnfoque(e) {
  return {
    id: slug(e.id) || slug(e.label) || 'enfoque',
    label: String(e.label).trim().slice(0, 60),
    pista: String(e.pista).trim().slice(0, 300),
    categoriaFoto: e.categoriaFoto,
  };
}

// Cambios a mano desde el panel: resumen, tono y enfoques (nombre, qué
// transmite y qué foto usa). Las categorías de foto no se tocan aquí.
// Devuelve { estrategia } o { error }.
function editar(actual, body) {
  const b = body || {};
  const tono = String(b.tono == null ? actual.tono : b.tono).trim().slice(0, 300);
  if (!tono) return { error: 'Describe el tono de voz' };
  const resumen = String(b.resumen == null ? (actual.resumen || '') : b.resumen).trim().slice(0, 500);
  if (!Array.isArray(b.enfoques)) return { error: 'Faltan los enfoques' };
  const enfoques = [];
  const usados = new Set();
  for (const e of b.enfoques) {
    const label = String((e && e.label) || '').trim();
    const pista = String((e && e.pista) || '').trim();
    if (!label && !pista) continue; // fila vacía: se ignora
    if (!label || !pista) return { error: 'Cada enfoque necesita un nombre y qué debe transmitir' };
    const categoriaFoto = actual.categoriasFoto.includes(e.categoriaFoto) ? e.categoriaFoto : actual.categoriasFoto[0];
    // Se conserva el id de un enfoque existente (el aprendizaje lo usa).
    let id = e.id && actual.enfoques.some((x) => x.id === e.id) ? e.id : (slug(label) || 'enfoque');
    while (usados.has(id)) id += '-2';
    usados.add(id);
    enfoques.push(limpiarEnfoque({ id, label, pista, categoriaFoto }));
  }
  if (!enfoques.length) return { error: 'Deja al menos un enfoque' };
  if (enfoques.length > 8) return { error: 'Máximo 8 enfoques' };
  return { estrategia: Object.assign({}, actual, { tono, resumen, enfoques }) };
}

module.exports = { generarEstrategia, estrategiaGenerica, editar };
