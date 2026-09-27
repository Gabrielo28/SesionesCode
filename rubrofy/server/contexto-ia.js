// Contexto para la IA, en capas. Cada pedido a la IA (estrategia, textos,
// voz, imágenes, videos) recibe, para las secciones que le tocan:
//
//   1. Reglas de la plataforma: las escribe el administrador de Rubrofy
//      (ADMIN_EMAILS) y valen para todos los negocios. Son criterios de
//      calidad, no contenido de ningún negocio: el administrador sigue sin
//      ver lo que escribe cada uno.
//   2. Contexto del negocio: lo escribe el dueño, por sección.
//   3. La indicación puntual de un pedido ("más corto", "menciona el
//      aniversario"), que no se guarda.
//
// Si algo se contradice, manda lo más específico: la indicación puntual,
// después el negocio y al final la plataforma.

const store = require('./store');

const SECCIONES = {
  general: { nombre: 'General', ayuda: 'Lo que la IA debe saber siempre: qué vendes, qué te diferencia, qué nunca decir.' },
  voz: { nombre: 'Voz de marca', ayuda: 'Cómo hablas: expresiones, temas delicados, cómo tratar a tus clientes.' },
  estrategia: { nombre: 'Estrategia', ayuda: 'Objetivos del momento, temporadas, lanzamientos, qué quieres comunicar este mes.' },
  copys: { nombre: 'Copys (todos los textos)', ayuda: 'Reglas para los textos: largo, llamados a la acción, hashtags, emojis.' },
  post: { nombre: 'Posts', ayuda: 'Qué funciona en tus posts de una foto.' },
  carrusel: { nombre: 'Carruseles', ayuda: 'Cómo armar tus carruseles: número de láminas, portada, cierre.' },
  reel: { nombre: 'Reels', ayuda: 'Ritmo, duración, qué mostrar en el primer segundo, música.' },
  historia: { nombre: 'Historias', ayuda: 'Stickers, encuestas, enlaces, frecuencia.' },
  imagen: { nombre: 'Imágenes con IA', ayuda: 'Estilo visual: colores, luz, ambiente, qué evitar (personas, texto, logos).' },
  video: { nombre: 'Videos con IA', ayuda: 'Movimiento de cámara, ambiente, duración, sin personas hablando, etc.' },
};
const MAX_SECCION = 2000;
const MAX_GENERAL = 4000;
const MAX_INDICACION = 500;

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS config_plataforma (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    actualizado_el TEXT NOT NULL
  );
`);
const sql = {
  leer: db.prepare('SELECT valor, actualizado_el FROM config_plataforma WHERE clave = ?'),
  guardar: db.prepare(`INSERT INTO config_plataforma (clave, valor, actualizado_el) VALUES (?, ?, ?)
    ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, actualizado_el = excluded.actualizado_el`),
};

function limpiar(obj) {
  const out = {};
  for (const k of Object.keys(SECCIONES)) {
    const v = obj && typeof obj[k] === 'string' ? obj[k].replace(/\r/g, '').trim() : '';
    if (v) out[k] = v.slice(0, k === 'general' ? MAX_GENERAL : MAX_SECCION);
  }
  return out;
}

function dePlataforma() {
  const f = sql.leer.get('contexto_ia');
  return f ? JSON.parse(f.valor) : {};
}

function guardarPlataforma(body) {
  const valor = limpiar(body);
  sql.guardar.run('contexto_ia', JSON.stringify(valor), new Date().toISOString());
  return valor;
}

function delNegocio(negocio) {
  return (negocio && negocio.contextoIA) || {};
}

// Mezcla lo guardado con lo que llega: solo se tocan las secciones enviadas.
function editarNegocio(negocio, body) {
  const actual = delNegocio(negocio);
  const cambios = {};
  for (const k of Object.keys(SECCIONES)) if (body && typeof body[k] === 'string') cambios[k] = body[k];
  const junto = Object.assign({}, actual, cambios);
  return limpiar(junto);
}

function indicacion(texto) {
  return typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim().slice(0, MAX_INDICACION) : '';
}

// Bloque para el prompt con las secciones pedidas (en ese orden).
function bloque(negocio, secciones, indicacionPuntual) {
  const plataforma = dePlataforma();
  const propio = delNegocio(negocio);
  const reglas = secciones.filter((s) => plataforma[s]).map((s) => `- ${SECCIONES[s].nombre}: ${plataforma[s]}`);
  const contexto = secciones.filter((s) => propio[s]).map((s) => `- ${SECCIONES[s].nombre}: ${propio[s]}`);
  const partes = [];
  if (reglas.length) partes.push('Reglas de calidad de la plataforma (síguelas siempre):\n' + reglas.join('\n'));
  if (contexto.length) partes.push('Contexto e indicaciones del negocio (tienen prioridad sobre tus supuestos):\n' + contexto.join('\n'));
  const ind = indicacion(indicacionPuntual);
  if (ind) partes.push(`Indicación para este pedido (tiene prioridad sobre todo lo anterior): ${ind}`);
  return partes.length ? '\n\n' + partes.join('\n\n') : '';
}

// Versión compacta (sin encabezados) para prompts de imagen y video.
function plano(negocio, secciones) {
  const plataforma = dePlataforma();
  const propio = delNegocio(negocio);
  return secciones.flatMap((s) => [plataforma[s], propio[s]]).filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 1200);
}

// Cuántas secciones tiene completas el negocio (para el panel).
function resumen(negocio) {
  const propio = delNegocio(negocio);
  return { completas: Object.keys(propio).length, total: Object.keys(SECCIONES).length };
}

function catalogo() {
  return Object.entries(SECCIONES).map(([id, s]) => ({ id, nombre: s.nombre, ayuda: s.ayuda, maximo: id === 'general' ? MAX_GENERAL : MAX_SECCION }));
}

module.exports = { SECCIONES, bloque, plano, delNegocio, editarNegocio, dePlataforma, guardarPlataforma, indicacion, resumen, catalogo };
