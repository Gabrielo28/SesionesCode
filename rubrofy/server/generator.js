// Motor de generación de contenido.
// La plantilla de cada negocio (tono, enfoques, categorías de foto) sale de
// su propia `estrategia` (ver server/estrategia.js), generada por Claude a
// partir de su rubro — no de una tabla fija por nicho. Con ANTHROPIC_API_KEY
// configurada Y un plan pagado (ver server/planes.js), Claude también
// escribe los titulares y captions reales; en el plan gratis, o sin key,
// usa plantillas genéricas con los datos del negocio.

const { fechaProgramada, etiquetaFecha } = require('./programacion');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

// Paleta de degradés de respaldo para el marcador de la tarjeta cuando no
// hay una foto real todavía. Ya no depende del rubro (antes había un set de
// colores por nicho) — rota por el índice de la pieza.
const HUES = [
  ['#5a3d1e', '#20140a'],
  ['#5c2c1e', '#22100a'],
  ['#5a4526', '#20160a'],
  ['#4a3624', '#1c130a'],
];

function headlineGenerico(enfoque) {
  const palabras = enfoque.label.toUpperCase().split(/\s+/);
  const mitad = Math.ceil(palabras.length / 2);
  const l1 = palabras.slice(0, mitad).join(' ');
  const l2 = palabras.slice(mitad).join(' ');
  return l2 ? `${l1}\n${l2}` : l1;
}

function captionGenerico(enfoque, negocio) {
  const d = negocio.datos || {};
  if (enfoque.id === 'precio' || /precio|promo/i.test(enfoque.id)) {
    return `${d.promo || 'Promoción disponible'} en ${negocio.nombre}.` +
      (d.precioDesde ? ` Desde ${d.precioDesde}${d.unidad ? ' ' + d.unidad : ''}.` : '');
  }
  if (enfoque.id === 'urgencia' || /urgen/i.test(enfoque.id)) {
    return `Cupos limitados esta semana en ${negocio.nombre}. No te quedes fuera.`;
  }
  return `${enfoque.label}: ${d.productoDestacado ? d.productoDestacado + ', en ' : ''}${negocio.nombre}.`;
}

function extraerJSONArray(texto) {
  const inicio = texto.indexOf('[');
  const fin = texto.lastIndexOf(']');
  if (inicio === -1 || fin === -1) return null;
  try {
    return JSON.parse(texto.slice(inicio, fin + 1));
  } catch (err) {
    return null;
  }
}

// Pide a Claude titulares + captions reales para un lote de piezas nuevas,
// en una sola llamada. Devuelve null si no hay API key o si algo falla — el
// llamador cae de vuelta a las plantillas genéricas.
async function generarLoteConClaude(negocio, enfoquesDelLote) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || negocio.plan === 'gratis') return null;

  const estrategia = negocio.estrategia;
  const lista = enfoquesDelLote
    .map((e, i) => `${i + 1}. Enfoque "${e.label}": ${e.pista}`)
    .join('\n');

  const prompt =
    `Eres el redactor de contenido de "${negocio.nombre}" (rubro: ${estrategia.rubro}). ` +
    `Tono: ${estrategia.tono}. Datos reales del negocio, úsalos solo si son útiles y nunca inventes ` +
    `datos que no aparecen aquí: ${JSON.stringify(negocio.datos || {})}.\n\n` +
    `Genera ${enfoquesDelLote.length} publicaciones para Instagram, una por cada enfoque, en este orden:\n${lista}\n\n` +
    `Responde SOLO con un JSON array de ${enfoquesDelLote.length} objetos en el mismo orden, sin texto fuera ` +
    `del array, con esta forma: [{"headline": "TITULAR CORTO\\nEN DOS LINEAS", "caption": "texto real de la publicación"}]\n` +
    `El "headline" es un titular tipo cartel, máximo 4-5 palabras en total, en dos líneas separadas por \\n, ` +
    `todo en mayúsculas. El "caption" es el texto real de la publicación, tono natural, sin hashtags excesivos, máximo 220 caracteres.`;

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
        max_tokens: 200 * enfoquesDelLote.length,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const texto = data && data.content && data.content[0] && data.content[0].text;
    const parsed = texto && extraerJSONArray(texto);
    if (!Array.isArray(parsed) || parsed.length !== enfoquesDelLote.length) return null;
    if (!parsed.every((p) => p && typeof p.headline === 'string' && typeof p.caption === 'string')) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

// cantidad: cuántas piezas nuevas generar.
// startIndex: desde dónde seguir la rotación de enfoques (para que "generar más" no repita
// exactamente lo mismo que ya existe en la cola).
// opciones.usarIA: false fuerza las plantillas aunque el plan incluya IA (se
// usa cuando el negocio agotó su cuota mensual de textos con IA).
async function generarBanco(negocio, cantidad = 6, startIndex = 0, opciones = {}) {
  const estrategia = negocio.estrategia;
  if (!estrategia) throw new Error('El negocio no tiene una estrategia de contenido');

  const enfoques = estrategia.enfoques;
  const plan = [];

  for (let i = 0; i < cantidad; i++) {
    const idx = startIndex + i;
    const enfoque = enfoques[idx % enfoques.length];
    const esHistoria = idx % 3 === 2;
    // Fecha real en la hora del negocio (ver server/programacion.js): es la
    // que usa el publicador para publicar la pieza una vez aprobada.
    const publicarEl = fechaProgramada(2 + idx * 2, esHistoria ? '18:30' : '09:00');
    plan.push({
      idx,
      enfoque,
      esHistoria,
      publicarEl,
      dateLabel: etiquetaFecha(publicarEl, esHistoria ? 'Historia' : 'Post'),
      hue: HUES[idx % HUES.length],
    });
  }

  const lote = opciones.usarIA === false ? null : await generarLoteConClaude(negocio, plan.map((p) => p.enfoque));

  return plan.map((p, i) => {
    const generado = lote && lote[i];
    const headline = generado ? generado.headline : headlineGenerico(p.enfoque);
    const caption = generado ? generado.caption : captionGenerico(p.enfoque, negocio);
    return {
      id: `${negocio.id}-${Date.now()}-${p.idx}`,
      status: 'pendiente',
      variantIndex: 0,
      editing: false,
      aspect: p.esHistoria ? '9 / 16' : '4 / 5',
      headline,
      tag: p.enfoque.label,
      enfoqueId: p.enfoque.id,
      categoriaFoto: p.enfoque.categoriaFoto || estrategia.categoriasFoto[0] || null,
      date: p.dateLabel,
      publicarEl: p.publicarEl,
      hueFrom: p.hue[0],
      hueTo: p.hue[1],
      variants: [caption],
      generadoConIA: !!generado, // para descontar de la cuota mensual de textos con IA
    };
  });
}

// Pide a Claude una variante nueva para "Otra versión" cuando ya no quedan
// variantes precalculadas. Devuelve null si no hay API key o si algo falla —
// el llamador debe tener un plan B (rotar de nuevo desde el principio).
async function generarVarianteConClaude(negocio, enfoqueId, previas) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || negocio.plan === 'gratis') return null;

  const estrategia = negocio.estrategia;
  const enfoque = estrategia.enfoques.find((e) => e.id === enfoqueId) || estrategia.enfoques[0];

  const prompt =
    `Eres el redactor de contenido de "${negocio.nombre}" (rubro: ${estrategia.rubro}). ` +
    `Tono: ${estrategia.tono}. Escribe UNA sola publicación nueva para Instagram con enfoque "${enfoque.label}" ` +
    `(${enfoque.pista}). Usa estos datos reales si son útiles, nunca inventes precios que no aparecen aquí: ` +
    `${JSON.stringify(negocio.datos || {})}. No repitas estas versiones ya usadas: ${previas.join(' | ')}. ` +
    `Responde solo con el texto de la publicación, sin comillas ni explicaciones, máximo 220 caracteres.`;

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
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data && data.content && data.content[0] && data.content[0].text;
    return text ? text.trim() : null;
  } catch (err) {
    return null;
  }
}

module.exports = { generarBanco, generarVarianteConClaude };
