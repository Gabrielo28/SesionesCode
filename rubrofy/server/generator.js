// Motor de generación de contenido.
// La plantilla de cada negocio (tono, enfoques, categorías de foto) sale de
// su propia `estrategia` (ver server/estrategia.js), generada por Claude a
// partir de su rubro — no de una tabla fija por nicho. Con ANTHROPIC_API_KEY
// configurada Y un plan pagado (ver server/planes.js), Claude también
// escribe los titulares y captions reales; en el plan gratis, o sin key,
// usa plantillas genéricas con los datos del negocio.

const { fechaProgramada, etiquetaFecha } = require('./programacion');
const aprendizaje = require('./aprendizaje');
const estilo = require('./estilo');
const guardian = require('./guardian');
const planContenido = require('./plan-contenido');
const voz = require('./voz');
const contextoIA = require('./contexto-ia');
const costos = require('./costos');

const ASPECTO = { post: '4 / 5', carrusel: '4 / 5', reel: '9 / 16', historia: '9 / 16' };

// Idea de respaldo (sin IA) de qué mostrar en cada formato.
function ideaGenerica(formato, enfoque) {
  const tema = enfoque.label.toLowerCase();
  if (formato === 'reel') return `Video vertical de 10-20 s sobre "${tema}": una toma general, un detalle de cerca y cierre con el titular en pantalla.`;
  if (formato === 'carrusel') return `3 a 5 láminas sobre "${tema}": portada con el titular, 2-3 láminas con fotos o datos, y una última con el llamado a la acción.`;
  if (formato === 'historia') return `Foto o video vertical sobre "${tema}" con el titular y un sticker de encuesta o de enlace.`;
  return `Una foto de "${enfoque.categoriaFoto || tema}" con buena luz, con el titular sobre la imagen.`;
}

// Guía de estilo del negocio y ejemplos del mismo formato ("Mi estilo").
function bloqueEstilo(negocio, formatos) {
  const partes = [];
  const g = negocio.estilo;
  if (g && g.general) partes.push(`Estilo del negocio (respétalo): ${g.general}`);
  for (const f of new Set(formatos)) {
    const lineas = [];
    if (g && g.porFormato && g.porFormato[f]) lineas.push(`guía: ${g.porFormato[f]}`);
    for (const ej of estilo.ejemplos(negocio.id, f)) lineas.push(`ejemplo real: ${ej}`);
    if (lineas.length) partes.push(`${estilo.ETIQUETAS[f]}:\n` + lineas.map((l) => `- ${l}`).join('\n'));
  }
  return partes.length ? '\n\nAsí publica este negocio (imita el estilo, no copies los textos):\n' + partes.join('\n') : '';
}

const claude = require('./claude');

// Paleta de degradés de respaldo para el marcador de la tarjeta cuando no
// hay una foto real todavía. Ya no depende del rubro (antes había un set de
// colores por nicho) — rota por el índice de la pieza.
// Fondo de la tarjeta mientras la pieza no tiene foto (rosados y ciruelas oscuros).
const HUES = [
  ['#5a2340', '#1a0d14'],
  ['#3d2a4a', '#140f1a'],
  ['#6a2a45', '#1c0e15'],
  ['#2f2a36', '#111014'],
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

// "#Uno", "dos", "#tres cuatro" → ["#uno", "#dos", "#trescuatro"], sin repetidos, máximo 12.
function limpiarHashtags(v) {
  const lista = Array.isArray(v) ? v : String(v || '').split(/[\s,]+/);
  const out = [];
  for (const h of lista) {
    const t = '#' + String(h || '').toLowerCase().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    if (t.length > 2 && t.length <= 40 && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 12);
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
async function generarLoteConClaude(negocio, piezas, ctx, indicaciones) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || negocio.plan === 'gratis') return null;

  const estrategia = negocio.estrategia;
  const enfoquesDelLote = piezas;
  const lista = piezas
    .map((p, i) => `${i + 1}. ${estilo.ETIQUETAS[p.formato]} — enfoque "${p.enfoque.label}": ${p.enfoque.pista}`)
    .join('\n');

  const prompt =
    `Eres el redactor de contenido de "${negocio.nombre}" (rubro: ${estrategia.rubro}). ` +
    `Tono: ${estrategia.tono}. Datos reales del negocio, úsalos solo si son útiles y nunca inventes ` +
    `datos que no aparecen aquí: ${JSON.stringify(negocio.datos || {})}.` +
    (negocio.planContenido ? ' ' + planContenido.textoParaPrompt(negocio.planContenido) : '') +
    (ctx ? aprendizaje.textoParaPrompt(ctx) : '') +
    bloqueEstilo(negocio, piezas.map((p) => p.formato)) +
    voz.textoParaPrompt(negocio) +
    contextoIA.bloque(negocio, ['general', 'voz', 'copys', ...new Set(piezas.map((p) => p.formato))], indicaciones) + '\n\n' +
    `Genera ${enfoquesDelLote.length} publicaciones para Instagram, una por línea, con el formato y enfoque indicados, en este orden:\n${lista}\n\n` +
    `Responde SOLO con un JSON array de ${enfoquesDelLote.length} objetos en el mismo orden, sin texto fuera ` +
    `del array, con esta forma: [{"headline": "TITULAR CORTO\\nEN DOS LINEAS", "gancho": "...", "caption": "...", "hashtags": ["#uno", "#dos"], "idea": "qué mostrar"}]\n` +
    `- "headline": titular tipo cartel para la imagen, máximo 4-5 palabras, en dos líneas separadas por \\n, en mayúsculas.\n` +
    `- "gancho": la frase que detiene el scroll (máximo 90 caracteres). En posts y carruseles es la primera línea del texto; ` +
    `en reels, lo que se dice o aparece en pantalla en los primeros 2 segundos; en historias, la frase del sticker o de la primera pantalla.\n` +
    `- "caption": el texto completo de la publicación, empezando por el gancho: desarrolla la idea con datos reales del negocio, ` +
    `en párrafos cortos, y termina con un llamado a la acción concreto (escribir, reservar, pasar al local, guardar, comentar), ` +
    `usando los canales reales del negocio si los hay. Entre 250 y 600 caracteres en posts, carruseles y reels; máximo 150 en historias. Sin hashtags dentro del caption.\n` +
    `- "hashtags": entre 5 y 10 hashtags específicos del rubro, del tema y de la ciudad o zona si se conoce, en minúsculas, sin genéricos vacíos como #love o #instagood (en historias, máximo 3).\n` +
    `- "idea": en máximo 250 caracteres qué mostrar: qué foto usar en un post, qué va en cada lámina de un carrusel, ` +
    `las tomas de un reel (y qué dice el gancho en pantalla) o qué mostrar y qué sticker usar en una historia.`;

  try {
    const r = await claude.llamar({ maxTokens: 700 * enfoquesDelLote.length, content: prompt, negocioId: negocio.id, uso: 'contenido' });
    if (r.error) return null;
    const texto = r.texto;
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

  // Lo aprendido del negocio (aprobaciones, correcciones y resultados reales):
  // el enfoque que mejor funciona sale más seguido y los posts van a la hora
  // en que mejor le va a esta cuenta, si hay datos suficientes para saberlo.
  let ctx = null;
  try {
    ctx = aprendizaje.contexto(negocio);
  } catch (err) {
    ctx = null; // sin datos todavía: se genera como siempre
  }
  const enfoques = ordenarEnfoques(estrategia.enfoques, ctx);
  const pc = negocio.planContenido || null;
  // Hora de los posts: la que eligió el negocio, si no la que mejor le
  // funciona según sus resultados, si no las 9:00.
  const horaPost = (pc && pc.hora) || (ctx && ctx.horario && ctx.horario.hora) || '09:00';
  const plan = [];

  // Formatos: los del plan semanal del negocio; si no tiene, la mezcla que
  // mostró en "Mi estilo" (o el patrón de siempre).
  const formatos = estilo.planFormatos(negocio.id, cantidad, startIndex, planContenido.mezcla(pc));
  const fechas = pc ? fechasSegunPlan(formatos, pc, opciones.diaInicio || 1) : null;
  for (let i = 0; i < cantidad; i++) {
    const idx = startIndex + i;
    const enfoque = enfoques[idx % enfoques.length];
    const formato = formatos[i];
    const esHistoria = formato === 'historia';
    // Fecha real en la hora del negocio (ver server/programacion.js): es la
    // que usa el publicador para publicar la pieza una vez aprobada.
    const publicarEl = fechas
      ? fechaProgramada(fechas[i], esHistoria ? '18:30' : horaPost)
      : fechaProgramada(2 + idx * 2, esHistoria ? '18:30' : horaPost);
    plan.push({
      idx,
      enfoque,
      formato,
      esHistoria,
      publicarEl,
      dateLabel: etiquetaFecha(publicarEl, estilo.ETIQUETAS[formato]),
      hue: HUES[idx % HUES.length],
    });
  }

  const lote = opciones.usarIA === false ? null : await generarLoteConClaude(negocio, plan, ctx, opciones.indicaciones);

  return plan.map((p, i) => {
    const generado = lote && lote[i];
    const headline = generado ? generado.headline : headlineGenerico(p.enfoque);
    const caption = generado ? generado.caption : captionGenerico(p.enfoque, negocio);
    const gancho = generado && typeof generado.gancho === 'string' ? generado.gancho.trim().slice(0, 150) : '';
    const hashtags = generado ? limpiarHashtags(generado.hashtags) : [];
    return {
      id: `${negocio.id}-${Date.now()}-${p.idx}`,
      status: 'pendiente',
      variantIndex: 0,
      editing: false,
      aspect: ASPECTO[p.formato],
      formato: p.formato,
      idea: generado && typeof generado.idea === 'string' && generado.idea.trim()
        ? generado.idea.trim().slice(0, 300) : ideaGenerica(p.formato, p.enfoque),
      headline,
      tag: p.enfoque.label,
      enfoqueId: p.enfoque.id,
      categoriaFoto: p.enfoque.categoriaFoto || estrategia.categoriasFoto[0] || null,
      date: p.dateLabel,
      publicarEl: p.publicarEl,
      hueFrom: p.hue[0],
      hueTo: p.hue[1],
      variants: [caption],
      gancho: gancho || undefined, // la frase que detiene el scroll (primeros 2 s en un reel)
      hashtags: hashtags.length ? hashtags : undefined,
      alertas: guardian.revisar(caption, negocio), // qué verificar antes de aprobar
      voz: voz.puntuar(caption, negocio) || undefined, // fidelidad a la voz de marca
      generadoConIA: !!generado, // para descontar de la cuota mensual de textos con IA
    };
  });
}

// Días (desde hoy) de cada pieza según el plan semanal: las del feed (post,
// carrusel, reel) se reparten parejo en la semana y las historias aparte,
// así una historia puede salir el mismo día que un post. Si el lote trae más
// piezas que una semana, sigue en la semana siguiente.
function fechasSegunPlan(formatos, pc, diaInicio) {
  const feed = ['post', 'carrusel', 'reel'].reduce((s, f) => s + (pc.semanal[f] || 0), 0) || 1;
  const historias = pc.semanal.historia || 1;
  let nFeed = 0;
  let nHist = 0;
  return formatos.map((f) => {
    if (f === 'historia') return diaInicio + Math.floor((nHist++ * 7) / historias);
    return diaInicio + Math.floor((nFeed++ * 7) / feed);
  });
}

// Con un enfoque ganador claro, la rotación lo repite: [ganador, A, B,
// ganador, C, ...]. Sin datos, la rotación es la de siempre.
function ordenarEnfoques(enfoques, ctx) {
  const mejor = ctx && ctx.mejoresEnfoques && ctx.mejoresEnfoques[0];
  const ganador = mejor && enfoques.find((e) => e.label === mejor);
  if (!ganador || enfoques.length < 3) return enfoques;
  const resto = enfoques.filter((e) => e !== ganador);
  const mitad = Math.ceil(resto.length / 2);
  return [ganador, ...resto.slice(0, mitad), ganador, ...resto.slice(mitad)];
}

// Pide a Claude una variante nueva para "Otra versión" cuando ya no quedan
// variantes precalculadas. Devuelve null si no hay API key o si algo falla —
// el llamador debe tener un plan B (rotar de nuevo desde el principio).
async function generarVarianteConClaude(negocio, enfoqueId, previas, formato = 'post', indicacion = '') {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || negocio.plan === 'gratis') return null;

  const estrategia = negocio.estrategia;
  const enfoque = estrategia.enfoques.find((e) => e.id === enfoqueId) || estrategia.enfoques[0];

  const prompt =
    `Eres el redactor de contenido de "${negocio.nombre}" (rubro: ${estrategia.rubro}). ` +
    `Tono: ${estrategia.tono}. Escribe UNA sola publicación nueva para Instagram (${estilo.ETIQUETAS[formato] || 'Post'}) con enfoque "${enfoque.label}" ` +
    `(${enfoque.pista}). Usa estos datos reales si son útiles, nunca inventes precios que no aparecen aquí: ` +
    `${JSON.stringify(negocio.datos || {})}.` + (negocio.planContenido ? ' ' + planContenido.textoParaPrompt(negocio.planContenido) : '') + aprendizajeSeguro(negocio) + bloqueEstilo(negocio, [formato]) + voz.textoParaPrompt(negocio) +
    contextoIA.bloque(negocio, ['general', 'voz', 'copys', formato], indicacion) + `\n\nNo repitas estas versiones ya usadas: ${previas.join(' | ')}. ` +
    `Responde SOLO con un JSON: {"gancho": "frase que detiene el scroll, máximo 90 caracteres", ` +
    `"caption": "texto completo que empieza por el gancho y termina con un llamado a la acción, entre 250 y 600 caracteres (150 en historias), sin hashtags", ` +
    `"hashtags": ["5 a 10 hashtags específicos del rubro, el tema y la zona"]}`;

  try {
    const r = await claude.llamar({ maxTokens: 900, content: prompt, negocioId: negocio.id, uso: 'contenido' });
    if (r.error) return null;
    const text = r.texto;
    if (!text) return null;
    const inicio = text.indexOf('{');
    const fin = text.lastIndexOf('}');
    if (inicio !== -1 && fin > inicio) {
      try {
        const j = JSON.parse(text.slice(inicio, fin + 1));
        if (j && typeof j.caption === 'string' && j.caption.trim()) {
          return { caption: j.caption.trim(), gancho: typeof j.gancho === 'string' ? j.gancho.trim().slice(0, 150) : '', hashtags: limpiarHashtags(j.hashtags) };
        }
      } catch (err) { /* texto plano */ }
    }
    return { caption: text.trim(), gancho: '', hashtags: [] };
  } catch (err) {
    return null;
  }
}

function aprendizajeSeguro(negocio) {
  try {
    return aprendizaje.textoParaPrompt(aprendizaje.contexto(negocio));
  } catch (err) {
    return '';
  }
}

module.exports = { generarBanco, generarVarianteConClaude, ideaGenerica, limpiarHashtags };
