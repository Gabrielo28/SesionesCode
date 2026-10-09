// Lo que la IA aprende de cada negocio, mes a mes, para escribir cada vez
// más como él y más como lo que funciona:
//   - textos que el dueño aprobó tal cual (así le gusta),
//   - correcciones: cómo lo escribió la IA y cómo lo dejó el dueño,
//   - textos que rechazó (evitar),
//   - resultados reales: enfoques y posts con más interacción (analitica.js),
//   - publicidad: el texto, el formato, la ubicación y el público de sus
//     anuncios de Meta con resultados más baratos (aprendizaje-ads.js).
// Solo se usa en planes con IA (lo consume generator.js en el prompt).

const store = require('./store');
const analitica = require('./analitica');
const { getPlan } = require('./planes');

// Lo que enseñan sus anuncios (solo con Meta Ads conectado y en un plan con publicidad).
function leccionPublicidad(negocio) {
  if (!negocio.meta || !negocio.meta.adAccountId || !getPlan(negocio.plan).ads || !require('./meta').abiertoPara(negocio)) return null;
  try {
    return require('./aprendizaje-ads').leccion(negocio.id);
  } catch (err) {
    return null;
  }
}

const MAX_CARACTERES = 300;
const recortar = (t) => String(t || '').trim().slice(0, MAX_CARACTERES);

function porFechaDecision(a, b) {
  return String(b.decididoEl || '').localeCompare(String(a.decididoEl || ''));
}

function contexto(negocio) {
  const items = store.getContenido(negocio.id);
  const aprobados = items.filter((i) => i.status === 'aprobado').sort(porFechaDecision);
  const rechazados = items.filter((i) => i.status === 'rechazado').sort(porFechaDecision);

  const textoFinal = (i) => i.variants[i.variantIndex];
  const resultados = analitica.aprendizajeResultados(negocio.id, negocio.estrategia);

  return {
    aprobados: aprobados.filter((i) => !i.editado).slice(0, 5).map((i) => recortar(textoFinal(i))),
    correcciones: aprobados.filter((i) => i.editado && i.textoIA && i.textoIA !== textoFinal(i)).slice(0, 3)
      .map((i) => ({ antes: recortar(i.textoIA), despues: recortar(textoFinal(i)) })),
    rechazados: rechazados.slice(0, 3).map((i) => recortar(textoFinal(i))),
    mejoresEnfoques: resultados.mejoresEnfoques.map((e) => e.label),
    mejoresTextos: resultados.mejoresTextos.map(recortar),
    horario: resultados.horario,
    publicidad: (leccionPublicidad(negocio) || { prompt: [] }).prompt,
  };
}

// Bloque para el prompt de Claude; vacío si todavía no hay nada que aprender.
function textoParaPrompt(ctx) {
  const partes = [];
  if (ctx.aprobados.length) {
    partes.push('Publicaciones que el dueño aprobó tal cual (imita su estilo, no las copies):\n'
      + ctx.aprobados.map((t) => `- ${t}`).join('\n'));
  }
  if (ctx.correcciones.length) {
    partes.push('Así corrige el dueño los textos de la IA (aprende qué cambia):\n'
      + ctx.correcciones.map((c) => `- IA: ${c.antes}\n  Dueño: ${c.despues}`).join('\n'));
  }
  if (ctx.rechazados.length) {
    partes.push('Textos que el dueño rechazó (evita ese estilo):\n' + ctx.rechazados.map((t) => `- ${t}`).join('\n'));
  }
  if (ctx.mejoresEnfoques.length || ctx.mejoresTextos.length) {
    let bloque = 'Lo que mejor funcionó en Instagram (más interacción real):';
    if (ctx.mejoresEnfoques.length) bloque += `\n- Enfoques con mejores resultados: ${ctx.mejoresEnfoques.join(', ')}`;
    if (ctx.mejoresTextos.length) bloque += '\n' + ctx.mejoresTextos.map((t) => `- Post destacado: ${t}`).join('\n');
    partes.push(bloque);
  }
  if (ctx.publicidad && ctx.publicidad.length) {
    partes.push('Lo que mejor funcionó en sus anuncios pagados de Meta (resultados más baratos); úsalo como pista, sin copiar los textos:\n'
      + ctx.publicidad.map((t) => `- ${t}`).join('\n'));
  }
  return partes.length ? '\n\n' + partes.join('\n\n') : '';
}

module.exports = { contexto, textoParaPrompt };
