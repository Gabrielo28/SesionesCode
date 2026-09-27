// Voz de marca: el "ADN" de cómo habla un negocio y las herramientas que lo
// usan.
//   - ficha: quiénes son, a quién le hablan, personalidad, trato (tú o
//     usted), variante del español, emojis, palabras que sí y que no,
//     frases de la marca, temas o promesas prohibidas y ejemplos que "sí
//     suenan a nosotros";
//   - completar con IA: Claude propone la ficha a partir de lo que ya se sabe
//     del negocio (estrategia, plan, "Mi estilo", lo aprobado);
//   - puntaje de fidelidad: qué tan fiel es un texto a la ficha, con reglas
//     explicables (sin IA, instantáneo, en todos los planes);
//   - redactor: escribe cualquier texto con la voz (anuncios, correos,
//     WhatsApp, fichas de producto, web, bio), en 3 versiones puntuadas.

const claude = require('./claude');
const contextoIA = require('./contexto-ia');
const estilo = require('./estilo');
const aprendizaje = require('./aprendizaje');

const TRATOS = { tu: 'Tutea (tú)', usted: 'Trata de usted' };
const VARIANTES = {
  'chileno-cercano': 'Español de Chile, cercano (se permiten chilenismos suaves)',
  'chileno-formal': 'Español de Chile, formal (sin chilenismos)',
  neutro: 'Español neutro, para toda Latinoamérica',
};
const EMOJIS = { ninguno: 'Sin emojis', pocos: 'Pocos emojis (1 o 2)', varios: 'Emojis con libertad' };
const LARGOS = { corto: 'Textos cortos', medio: 'Largo medio', largo: 'Textos largos y detallados' };

const TIPOS_REDACCION = {
  anuncio: { nombre: 'Anuncio (Meta Ads)', pide: 'un anuncio para Meta Ads: "titulo" de máximo 40 caracteres y "texto" principal de máximo 250 caracteres con un llamado a la acción claro' },
  correo: { nombre: 'Correo', pide: 'un correo a clientes: "titulo" es el asunto (máximo 60 caracteres) y "texto" el cuerpo (máximo 900 caracteres, con saludo y cierre)' },
  whatsapp: { nombre: 'Mensaje de WhatsApp', pide: 'un mensaje de WhatsApp: "texto" de máximo 400 caracteres, natural, que se pueda enviar tal cual; "titulo" vacío' },
  producto: { nombre: 'Descripción de producto o servicio', pide: 'una descripción de producto o servicio para web o catálogo: "titulo" con el nombre y "texto" de máximo 600 caracteres' },
  web: { nombre: 'Texto para la web', pide: 'un bloque de texto para su sitio web: "titulo" como título de sección y "texto" de máximo 700 caracteres' },
  bio: { nombre: 'Bio de Instagram', pide: 'la bio de Instagram: "texto" de máximo 150 caracteres; "titulo" vacío' },
  post: { nombre: 'Publicación para redes', pide: 'una publicación para Instagram o Facebook: "titulo" como titular de máximo 5 palabras y "texto" de máximo 300 caracteres' },
  otro: { nombre: 'Otro texto', pide: 'el texto que se describe en el tema: "titulo" si corresponde y "texto" con el contenido' },
};

const MAX_LISTA = 20;
const lista = (v, max = MAX_LISTA, largo = 80) => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]/))
  .map((x) => String(x).trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, largo));
const txt = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const opcion = (v, validas, porDefecto) => (Object.prototype.hasOwnProperty.call(validas, v) ? v : porDefecto);

// Valida la ficha que manda el panel (o que propone Claude).
function normalizar(body, actual) {
  const b = body || {};
  const a = actual || {};
  const tomar = (k, f) => (b[k] === undefined ? a[k] : f(b[k]));
  const ficha = {
    quienesSomos: tomar('quienesSomos', (v) => txt(v, 800)) || '',
    publico: tomar('publico', (v) => txt(v, 500)) || '',
    personalidad: tomar('personalidad', (v) => lista(v, 6, 30)) || [],
    trato: opcion(tomar('trato', (v) => v), TRATOS, 'tu'),
    variante: opcion(tomar('variante', (v) => v), VARIANTES, 'chileno-cercano'),
    emojis: opcion(tomar('emojis', (v) => v), EMOJIS, 'pocos'),
    largo: opcion(tomar('largo', (v) => v), LARGOS, 'medio'),
    palabrasSi: tomar('palabrasSi', (v) => lista(v)) || [],
    palabrasNo: tomar('palabrasNo', (v) => lista(v)) || [],
    frases: tomar('frases', (v) => lista(v, 8, 120)) || [],
    prohibido: tomar('prohibido', (v) => lista(v, 15, 120)) || [],
    ejemplos: tomar('ejemplos', (v) => lista(v, 8, 600)) || [],
  };
  ficha.actualizadoEl = new Date().toISOString();
  return ficha;
}

function tieneFicha(negocio) {
  const v = negocio && negocio.voz;
  return !!(v && (v.quienesSomos || v.personalidad.length || v.palabrasNo.length || v.ejemplos.length));
}

// Bloque para cualquier prompt que escriba en nombre del negocio.
function textoParaPrompt(negocio) {
  const v = negocio && negocio.voz;
  if (!tieneFicha(negocio)) return '';
  const l = [];
  if (v.quienesSomos) l.push(`Quiénes son: ${v.quienesSomos}`);
  if (v.publico) l.push(`A quién le hablan: ${v.publico}`);
  if (v.personalidad.length) l.push(`Personalidad: ${v.personalidad.join(', ')}`);
  l.push(`Trato: ${TRATOS[v.trato]}. ${VARIANTES[v.variante]}. ${EMOJIS[v.emojis]}. ${LARGOS[v.largo]}.`);
  if (v.palabrasSi.length) l.push(`Palabras y expresiones propias de la marca (úsalas cuando calcen): ${v.palabrasSi.join(', ')}`);
  if (v.palabrasNo.length) l.push(`Palabras que la marca NUNCA usa: ${v.palabrasNo.join(', ')}`);
  if (v.frases.length) l.push(`Frases de la marca: ${v.frases.join(' | ')}`);
  if (v.prohibido.length) l.push(`Prohibido prometer o mencionar: ${v.prohibido.join(' | ')}`);
  if (v.ejemplos.length) l.push('Textos que "sí suenan a la marca" (imita el estilo, no los copies):\n' + v.ejemplos.map((e) => `  - ${e}`).join('\n'));
  return '\n\nVoz de marca (respétala en todo lo que escribas):\n- ' + l.join('\n- ');
}

// --- puntaje de fidelidad ---

const GENERICAS = [
  /en el mundo de hoy/i, /no te lo puedes perder/i, /sum[eé]rgete/i, /eleva tu/i, /experiencia [uú]nica/i,
  /calidad inigualable/i, /te invitamos a/i, /no esperes m[aá]s/i, /¿qu[eé] esperas\?/i, /descubre (la|el|nuestr)/i,
  /lleva tu .* al siguiente nivel/i, /somos tu mejor opci[oó]n/i, /desbloquea/i, /¡no te quedes fuera!/i,
];
const CHILENISMOS = /\b(po|cachai|cachay|bac[aá]n|al tiro|filete|la raja|pololo|polola|weon|we[oó]n|fome|harto)\b/i;
const MARCAS_TU = /\b(t[uú]|tus|te|contigo|ti)\b|\b(ven|pide|escr[ií]benos|reserva|aprovecha|visítanos|pásate|cuéntanos)\b/i;
const MARCAS_USTED = /\b(usted|ustedes|le invitamos|lo esperamos|la esperamos|visítenos|escríbanos|reserve|aproveche)\b/i;
const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function contiene(texto, frase) {
  const t = normal(texto);
  const f = normal(frase).trim();
  if (!f) return false;
  // Palabra completa si es una sola palabra; si no, la frase tal cual.
  return /\s/.test(f) ? t.includes(f) : new RegExp(`(^|[^a-z0-9ñ])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9ñ]|$)`).test(t);
}

// { puntaje 0-100, nivel, notas: [{ tipo: 'bien' | 'mal', texto }] }. null si no hay ficha.
function puntuar(texto, negocio) {
  if (!tieneFicha(negocio) || !texto) return null;
  const v = negocio.voz;
  let p = 100;
  const notas = [];
  const mal = (resta, t) => { p -= resta; notas.push({ tipo: 'mal', texto: t }); };
  const bien = (t) => notas.push({ tipo: 'bien', texto: t });

  const vetadas = v.palabrasNo.filter((w) => contiene(texto, w));
  if (vetadas.length) mal(Math.min(45, vetadas.length * 15), `Usa ${vetadas.map((w) => `"${w}"`).join(', ')}, que tu marca evita`);
  const prohibidas = v.prohibido.filter((w) => contiene(texto, w));
  if (prohibidas.length) mal(Math.min(50, prohibidas.length * 25), `Menciona algo prohibido: ${prohibidas.map((w) => `"${w}"`).join(', ')}`);

  const tu = MARCAS_TU.test(texto);
  const usted = MARCAS_USTED.test(texto);
  if (v.trato === 'tu' && usted) mal(10, 'Trata de usted, pero tu marca tutea');
  else if (v.trato === 'usted' && tu && !usted) mal(10, 'Tutea, pero tu marca trata de usted');
  else if (tu || usted) bien(v.trato === 'tu' ? 'Tutea, como tu marca' : 'Trata de usted, como tu marca');

  const emojis = (texto.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (v.emojis === 'ninguno' && emojis) mal(10, `Tiene ${emojis} emoji${emojis === 1 ? '' : 's'} y tu marca no usa`);
  else if (v.emojis === 'pocos' && emojis > 3) mal(8, `Tiene ${emojis} emojis; tu marca usa pocos`);

  if (v.variante !== 'chileno-cercano' && CHILENISMOS.test(texto)) mal(8, 'Usa chilenismos y tu marca habla más formal o neutro');

  const genericas = GENERICAS.filter((r) => r.test(texto)).length;
  if (genericas) mal(Math.min(18, genericas * 6), 'Tiene frases de plantilla que suenan a IA genérica');

  const propias = v.palabrasSi.filter((w) => contiene(texto, w));
  if (propias.length) bien(`Usa palabras de la marca: ${propias.slice(0, 3).join(', ')}`);
  else if (v.palabrasSi.length >= 3 && texto.length > 120) mal(5, 'No usa ninguna palabra propia de la marca');

  const n = texto.length;
  if (v.largo === 'corto' && n > 260) mal(5, 'Es largo; tu marca prefiere textos cortos');
  if (v.largo === 'largo' && n < 90) mal(5, 'Es corto; tu marca prefiere textos más desarrollados');

  const puntaje = Math.max(0, Math.min(100, p));
  return { puntaje, nivel: puntaje >= 85 ? 'alta' : (puntaje >= 65 ? 'media' : 'baja'), notas };
}

// --- completar la ficha con IA ---

function antecedentes(negocio) {
  const e = negocio.estrategia || {};
  const pc = negocio.planContenido || {};
  const l = [`Negocio: "${negocio.nombre}". Rubro: ${e.rubro || negocio.rubro || 'no indicado'}.`];
  if (e.resumen) l.push(`Estrategia: ${e.resumen}`);
  if (e.tono) l.push(`Tono definido: ${e.tono}`);
  if (pc.publico) l.push(`Público: ${pc.publico}`);
  if (pc.diferenciador) l.push(`Diferenciador: ${pc.diferenciador}`);
  if (negocio.estilo && negocio.estilo.general) l.push(`Guía de estilo detectada: ${negocio.estilo.general}`);
  const ejemplos = ['post', 'carrusel', 'reel', 'historia'].flatMap((f) => estilo.ejemplos(negocio.id, f, 2));
  let aprobados = [];
  try { aprobados = aprendizaje.contexto(negocio).aprobados; } catch (err) { aprobados = []; }
  const textos = [...ejemplos, ...aprobados].slice(0, 8);
  if (textos.length) l.push('Textos reales del negocio:\n' + textos.map((t) => `- ${t}`).join('\n'));
  return l.join('\n');
}

// Propuesta sin IA: lo que se deduce del plan y la estrategia.
function sugerenciaBasica(negocio) {
  const pc = negocio.planContenido || {};
  const tono = pc.tono || '';
  return normalizar({
    quienesSomos: [negocio.nombre, (negocio.estrategia && negocio.estrategia.rubro) || '', pc.diferenciador ? `— ${pc.diferenciador}` : ''].filter(Boolean).join(' '),
    publico: pc.publico || '',
    personalidad: { cercano: ['cercana', 'cálida'], profesional: ['confiable', 'clara'], divertido: ['divertida', 'enérgica'], inspirador: ['inspiradora', 'emotiva'], premium: ['elegante', 'cuidada'] }[tono] || [],
    trato: ['profesional', 'premium'].includes(tono) ? 'usted' : 'tu',
    variante: ['profesional', 'premium'].includes(tono) ? 'chileno-formal' : 'chileno-cercano',
    emojis: tono === 'divertido' ? 'varios' : (['profesional', 'premium'].includes(tono) ? 'ninguno' : 'pocos'),
  });
}

async function sugerir(negocio) {
  const prompt = 'Eres especialista en voz de marca. Con estos antecedentes, propone el ADN de marca del negocio.\n\n'
    + antecedentes(negocio) + contextoIA.bloque(negocio, ['general', 'voz'])
    + '\n\nResponde SOLO con un JSON con esta forma: {"quienesSomos": "2 frases", "publico": "1 frase", '
    + '"personalidad": ["3 a 5 adjetivos"], "trato": "tu" o "usted", "variante": "chileno-cercano" | "chileno-formal" | "neutro", '
    + '"emojis": "ninguno" | "pocos" | "varios", "largo": "corto" | "medio" | "largo", "palabrasSi": ["expresiones propias, máx 10"], '
    + '"palabrasNo": ["palabras o muletillas a evitar, máx 10"], "frases": ["frases de marca, máx 4"], "prohibido": ["promesas o temas a evitar, máx 6"]}. '
    + 'Básate en los textos reales si los hay; no inventes datos del negocio.';
  const r = claude.extraerJSON(await claude.pedir({ prompt, maxTokens: 900 }));
  if (!r || typeof r !== 'object') return { ficha: sugerenciaBasica(negocio), conIA: false };
  const actual = negocio.voz || {};
  // Los ejemplos elegidos por el dueño no se pisan.
  return { ficha: normalizar(Object.assign({}, r, { ejemplos: actual.ejemplos || [] })), conIA: true };
}

// --- redactor ---

async function redactar(negocio, { tipo, tema, indicaciones }) {
  const t = TIPOS_REDACCION[tipo] ? tipo : 'otro';
  const temaLimpio = txt(tema, 600);
  if (!temaLimpio) return { error: 'Cuenta de qué trata el texto' };
  const e = negocio.estrategia || {};
  const prompt = `Eres el redactor de "${negocio.nombre}" (rubro: ${e.rubro || 'no indicado'}). `
    + `Datos reales del negocio (nunca inventes precios, promociones ni datos que no estén aquí): ${JSON.stringify(negocio.datos || {})}.`
    + textoParaPrompt(negocio)
    + contextoIA.bloque(negocio, ['general', 'voz', 'copys'], indicaciones)
    + `\n\nEscribe 3 versiones distintas de ${TIPOS_REDACCION[t].pide}. Tema: ${temaLimpio}\n\n`
    + 'Responde SOLO con un JSON array de 3 objetos: [{"titulo": "...", "texto": "..."}]';
  const r = claude.extraerJSON(await claude.pedir({ prompt, maxTokens: 1500 }), 'arreglo');
  if (!Array.isArray(r) || !r.length) return { error: 'La IA no respondió. Intenta de nuevo en un momento.' };
  const versiones = r.slice(0, 3).filter((x) => x && typeof x.texto === 'string' && x.texto.trim()).map((x) => ({
    titulo: txt(x.titulo, 120), texto: txt(x.texto, 1500), voz: puntuar(`${x.titulo || ''} ${x.texto}`, negocio),
  }));
  if (!versiones.length) return { error: 'La IA no respondió. Intenta de nuevo en un momento.' };
  return { tipo: t, versiones };
}

function catalogo() {
  return {
    tratos: TRATOS, variantes: VARIANTES, emojis: EMOJIS, largos: LARGOS,
    tiposRedaccion: Object.fromEntries(Object.entries(TIPOS_REDACCION).map(([k, v]) => [k, v.nombre])),
  };
}

module.exports = { normalizar, tieneFicha, textoParaPrompt, puntuar, sugerir, redactar, catalogo, TIPOS_REDACCION };
