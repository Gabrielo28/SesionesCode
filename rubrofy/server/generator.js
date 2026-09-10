// Motor de generación de contenido.
// Por defecto usa plantillas de texto (gratis, sin llamadas externas).
// Si hay ANTHROPIC_API_KEY configurada, "Otra versión" puede pedirle a
// Claude una variante nueva en vez de solo rotar las precalculadas.

const { getNicho } = require('./nichos');

const HEADLINES = {
  turismo: {
    experiencia: ['DESCONECTA\nDE VERDAD', 'ASÍ SE VIVE\nAQUÍ'],
    precio: ['RESERVA\nCON DESCUENTO', 'TARIFA DE\nTEMPORADA'],
    urgencia: ['QUEDAN POCAS\nFECHAS', 'SE ESTÁ\nAGOTANDO'],
    recinto: ['CONOCE\nEL LUGAR', 'CADA RINCÓN\nCUENTA'],
  },
  panaderia: {
    producto: ['RECIÉN\nHORNEADO', 'HOY SALIÓ\nDEL HORNO'],
    precio: ['PROMO\nDE LA SEMANA', 'PRECIO\nESPECIAL'],
    urgencia: ['STOCK\nLIMITADO', 'ÚLTIMAS\nUNIDADES'],
    proceso: ['ASÍ LO\nHACEMOS', 'DESDE CERO\nCADA DÍA'],
  },
  clinica_dental: {
    servicio: ['TU SONRISA\nEN BUENAS MANOS', 'SIN LETRA\nCHICA'],
    precio: ['PLANES\nDISPONIBLES', 'EVALUACIÓN\nINCLUIDA'],
    confianza: ['CONFÍA EN\nTU EQUIPO', 'TECNOLOGÍA\nQUE TRANQUILIZA'],
    recordatorio: ['AGENDA TU\nCONTROL', 'UN CHEQUEO\na TIEMPO'],
  },
};

const HUES = {
  turismo: [['#3a4a3c', '#151d16'], ['#2c3a4a', '#0f151d']],
  panaderia: [['#4a3c2c', '#1d160f'], ['#4a4230', '#1d1a10']],
  clinica_dental: [['#244042', '#0d1a1b'], ['#2c3a4a', '#0f151d']],
};

const d = (n) => (n.datos || {});

const CAPTIONS = {
  turismo: {
    experiencia: [
      (n) => `Desconecta de verdad: así se vive una estadía en ${n.nombre}.`,
      (n) => `El silencio, el paisaje, el detalle. Eso es ${n.nombre}.`,
    ],
    precio: [
      (n) => `Reserva hoy y aprovecha ${d(n).promo || 'nuestras tarifas de temporada'}. Desde ${d(n).precioDesde || 'consulta valores'} la ${d(n).unidad || 'noche'}.`,
      (n) => `${d(n).promo ? d(n).promo + '. ' : ''}Cupos disponibles esta semana en ${n.nombre}.`,
    ],
    urgencia: [
      (n) => `Quedan pocas fechas disponibles este mes en ${n.nombre}. No las dejes pasar.`,
      (n) => `Se están agotando los cupos del fin de semana. Reserva antes de que se acaben.`,
    ],
    recinto: [
      (n) => `Conoce por dentro uno de los espacios más pedidos de ${n.nombre}.`,
      (n) => `Cada rincón de ${n.nombre} está pensado para desconectar.`,
    ],
  },
  panaderia: {
    producto: [
      (n) => `Hoy salió del horno: ${d(n).productoDestacado || 'nuestro producto estrella'}. Ven a probarlo fresco.`,
      (n) => `${d(n).productoDestacado || 'Nuestro producto estrella'}, recién horneado, todos los días en ${n.nombre}.`,
    ],
    precio: [
      (n) => `${d(n).promo || 'Promoción de la semana'} en ${n.nombre}. Desde ${d(n).precioDesde || 'consulta valores'}.`,
      (n) => `Este ${d(n).unidad || 'combo'} tiene precio especial toda la semana. Solo en ${n.nombre}.`,
    ],
    urgencia: [
      (n) => `Producción limitada del día. Cuando se acaba, se acaba.`,
      (n) => `Últimas unidades de hoy. Mañana volvemos a hornear desde temprano.`,
    ],
    proceso: [
      (n) => `Así preparamos cada mañana lo que vas a comer hoy en ${n.nombre}.`,
      (n) => `Ingredientes simples, proceso artesanal. Así hacemos las cosas en ${n.nombre}.`,
    ],
  },
  clinica_dental: {
    servicio: [
      (n) => `¿Sabes en qué consiste realmente ${d(n).productoDestacado || 'un tratamiento dental'}? Te lo explicamos simple.`,
      (n) => `En ${n.nombre} explicamos cada tratamiento antes de empezar. Sin letra chica.`,
    ],
    precio: [
      (n) => `${d(n).promo || 'Plan de pago disponible'} para tu tratamiento. Consulta valores en ${n.nombre}.`,
      (n) => `Desde ${d(n).precioDesde || 'consulta valores'}, con evaluación incluida.`,
    ],
    confianza: [
      (n) => `Equipo y tecnología pensados para que la visita al dentista deje de darte miedo.`,
      (n) => `Más de una razón para confiar en ${n.nombre} para tu salud dental.`,
    ],
    recordatorio: [
      (n) => `Un control a tiempo evita tratamientos más grandes después. Agenda tu hora en ${n.nombre}.`,
      (n) => `¿Cuánto hace que no te haces un chequeo? Este es tu recordatorio.`,
    ],
  },
};

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

function formatDate(date) {
  return pad2(date.getDate()) + ' ' + MESES[date.getMonth()];
}

// cantidad: cuántas piezas nuevas generar.
// startIndex: desde dónde seguir la rotación de enfoques (para que "generar más" no repita
// exactamente lo mismo que ya existe en la cola).
function generarBanco(negocio, cantidad = 6, startIndex = 0) {
  const nicho = getNicho(negocio.nicho);
  if (!nicho) throw new Error('Nicho desconocido: ' + negocio.nicho);

  const enfoques = nicho.enfoques;
  const hues = HUES[negocio.nicho] || [['#333', '#111']];
  const hoy = new Date();
  const items = [];

  for (let i = 0; i < cantidad; i++) {
    const idx = startIndex + i;
    const enfoque = enfoques[idx % enfoques.length];
    const esHistoria = idx % 3 === 2;

    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + 2 + idx * 2);
    const hora = esHistoria ? '18:30' : '09:00';
    const dateLabel = `${formatDate(fecha)} - ${hora} - ${esHistoria ? 'Historia' : 'Post'}`;

    const headlineSet = HEADLINES[negocio.nicho][enfoque.id] || ['CONTENIDO\nNUEVO'];
    const captionTemplates = CAPTIONS[negocio.nicho][enfoque.id] || [() => `Novedades en ${negocio.nombre}.`];
    const hue = hues[idx % hues.length];

    items.push({
      id: `${negocio.id}-${Date.now()}-${idx}`,
      status: 'pendiente',
      variantIndex: 0,
      editing: false,
      aspect: esHistoria ? '9 / 16' : '4 / 5',
      headline: headlineSet[idx % headlineSet.length],
      tag: enfoque.label,
      enfoqueId: enfoque.id,
      categoriaFoto: enfoque.categoriaFoto || (nicho.categoriasFoto && nicho.categoriasFoto[0]) || null,
      date: dateLabel,
      hueFrom: hue[0],
      hueTo: hue[1],
      variants: captionTemplates.map((fn) => fn(negocio)),
    });
  }
  return items;
}

// Pide a Claude una variante nueva para "Otra versión" cuando ya no quedan
// variantes precalculadas. Devuelve null si no hay API key o si algo falla —
// el llamador debe tener un plan B (rotar de nuevo desde el principio).
async function generarVarianteConClaude(negocio, enfoqueId, previas) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const nicho = getNicho(negocio.nicho);
  const enfoque = nicho.enfoques.find((e) => e.id === enfoqueId) || nicho.enfoques[0];

  const prompt =
    `Eres el redactor de contenido de "${negocio.nombre}", un negocio de ${nicho.nombre.toLowerCase()}. ` +
    `Tono: ${nicho.tono}. Escribe UNA sola publicación nueva para Instagram con enfoque "${enfoque.label}" ` +
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
        model: 'claude-haiku-4-5-20251001',
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
