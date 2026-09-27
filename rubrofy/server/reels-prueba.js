// Reels de prueba: cuando un Reel le va claramente mejor que al resto,
// Rubrofy prepara una nueva publicación del mismo video como "Reel de
// prueba" (trial reel) de Instagram, que se muestra primero SOLO a gente
// que no sigue la cuenta. Así un video que ya funcionó vuelve a trabajar
// para llegar a público nuevo.
//
//   - candidatos: Reels de los últimos 60 días, con al menos 2 días de
//     publicados (las métricas ya se asentaron), cuyas vistas (o alcance)
//     son 1,5 veces o más la mediana de los Reels de la cuenta. Se necesitan
//     al menos 3 Reels para comparar.
//   - crear: copia el video (el que se publicó desde Rubrofy o, si no, el
//     que entrega Instagram), escribe con IA un texto pensado para quien no
//     conoce la marca y deja la pieza en Por aprobar. Nada se publica sin el
//     "sí" del dueño.
//   - automático: tras cada sincronización, el mejor candidato nuevo pasa
//     solo a Por aprobar (máximo uno por semana, se puede apagar).
//
// Al publicar, el contenedor lleva trial_params con la "graduación": que
// Instagram lo muestre también a los seguidores si le va bien
// (SS_PERFORMANCE) o que lo decida el dueño en la app (MANUAL).

const fs = require('fs');
const store = require('./store');
const analitica = require('./analitica');
const claude = require('./claude');
const voz = require('./voz');
const contextoIA = require('./contexto-ia');
const guardian = require('./guardian');
const { fechaProgramada, etiquetaFecha } = require('./programacion');

const DIA = 24 * 3600 * 1000;
const FACTOR_MINIMO = 1.5;
const MIN_REELS = 3;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const AUTO_CADA_DIAS = 7;
const GRADUACIONES = {
  SS_PERFORMANCE: 'Si le va bien, Instagram lo muestra también a tus seguidores',
  MANUAL: 'Tú decides en la app de Instagram si lo compartes con tus seguidores',
};

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS reels_prueba (
    negocio_id TEXT NOT NULL,
    media_id TEXT NOT NULL,          -- el Reel original
    item_id TEXT NOT NULL,           -- la pieza de prueba en la cola
    automatico INTEGER NOT NULL DEFAULT 0,
    creado_el TEXT NOT NULL,
    PRIMARY KEY (negocio_id, media_id)
  );
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM reels_prueba WHERE negocio_id = ?').run(negocioId));
const sql = {
  reels: db.prepare(`SELECT * FROM ig_posts WHERE negocio_id = ? AND tipo = 'REELS' AND publicado_el >= ? ORDER BY publicado_el DESC`),
  enviados: db.prepare('SELECT * FROM reels_prueba WHERE negocio_id = ? ORDER BY creado_el DESC'),
  registrar: db.prepare('INSERT OR REPLACE INTO reels_prueba (negocio_id, media_id, item_id, automatico, creado_el) VALUES (?, ?, ?, ?, ?)'),
  ultimoAuto: db.prepare('SELECT MAX(creado_el) AS f FROM reels_prueba WHERE negocio_id = ? AND automatico = 1'),
  borrar: db.prepare('DELETE FROM reels_prueba WHERE negocio_id = ? AND media_id = ?'),
};

const puntaje = (p) => (p.vistas != null ? p.vistas : (p.alcance != null ? p.alcance : p.interacciones)) || 0;
function mediana(xs) {
  const o = xs.slice().sort((a, b) => a - b);
  if (!o.length) return 0;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

// Piezas de Rubrofy que son pruebas: sus Reels publicados no se vuelven a probar.
function idsDePruebas(negocioId) {
  return new Set(store.getContenido(negocioId).filter((i) => i.prueba).flatMap((i) => [
    i.publicacion && i.publicacion.mediaId, i.instagram && i.instagram.mediaId,
  ]).filter(Boolean).map(String));
}

function candidatos(negocio) {
  const reels = sql.reels.all(negocio.id, new Date(Date.now() - 90 * DIA).toISOString());
  const pruebas = idsDePruebas(negocio.id);
  const propios = reels.filter((r) => !pruebas.has(String(r.media_id)));
  if (propios.length < MIN_REELS) return { candidatos: [], reelsAnalizados: propios.length, mediana: null };
  const base = mediana(propios.map(puntaje));
  const enviados = new Map(sql.enviados.all(negocio.id).map((e) => [e.media_id, e]));
  const hace60 = Date.now() - 60 * DIA;
  const hace2 = Date.now() - 2 * DIA;
  const lista = propios
    .filter((r) => Date.parse(r.publicado_el) >= hace60 && Date.parse(r.publicado_el) <= hace2)
    .map((r) => ({
      mediaId: String(r.media_id), permalink: r.permalink, caption: (r.caption || '').slice(0, 300), publicadoEl: r.publicado_el,
      vistas: r.vistas, alcance: r.alcance, interacciones: r.interacciones, itemId: r.item_id,
      factor: base ? Math.round((puntaje(r) / base) * 10) / 10 : null,
      enviado: enviados.has(String(r.media_id)) ? enviados.get(String(r.media_id)).creado_el : null,
    }))
    .filter((r) => r.factor != null && r.factor >= FACTOR_MINIMO)
    .sort((a, b) => b.factor - a.factor);
  return { candidatos: lista, reelsAnalizados: propios.length, mediana: Math.round(base) };
}

// --- crear la pieza de prueba ---

async function textoParaPrueba(negocio, original) {
  const e = negocio.estrategia || {};
  const prompt = `Este Reel de "${negocio.nombre}" (rubro: ${e.rubro || 'no indicado'}) funcionó muy bien. Se va a publicar de nuevo como `
    + '"Reel de prueba": Instagram lo mostrará primero SOLO a personas que NO siguen la cuenta y no conocen la marca.\n'
    + `Texto original: "${original || '(sin texto)'}"\n`
    + `Datos reales del negocio (no inventes otros): ${JSON.stringify(negocio.datos || {})}.`
    + voz.textoParaPrompt(negocio)
    + contextoIA.bloque(negocio, ['general', 'voz', 'copys', 'reel'])
    + '\n\nReescribe el texto para esa audiencia nueva: primera línea con un gancho que haga detenerse, presenta brevemente '
    + 'quiénes son y cierra con una invitación a seguir la cuenta o a escribir. Máximo 220 caracteres, pocos hashtags. '
    + 'Responde SOLO con un JSON: {"caption": "..."}';
  const r = claude.extraerJSON(await claude.pedir({ prompt, maxTokens: 400, negocioId: negocio.id, uso: 'reels de prueba' }));
  return r && typeof r.caption === 'string' && r.caption.trim() ? r.caption.trim().slice(0, 2200) : null;
}

// Copia el video a un archivo propio de la pieza nueva. Primero el que se
// subió a Rubrofy; si no, el que entrega Instagram (no lo entrega para
// Reels con música con derechos).
async function copiarVideo(negocio, reel, nuevoId) {
  const archivo = `${nuevoId}.mp4`;
  const destino = store.videoAbsolutePath(negocio.id, archivo);
  fs.mkdirSync(store.videoDir(negocio.id), { recursive: true });
  const pieza = reel.itemId && store.getContenido(negocio.id).find((i) => i.id === reel.itemId);
  if (pieza && pieza.video && fs.existsSync(store.videoAbsolutePath(negocio.id, pieza.video.archivo))) {
    fs.copyFileSync(store.videoAbsolutePath(negocio.id, pieza.video.archivo), destino);
    return { archivo, bytes: fs.statSync(destino).size, origen: 'rubrofy' };
  }
  let media;
  try {
    media = await analitica.graphGet(`/${reel.mediaId}`, { fields: 'media_url,media_type,media_product_type' }, negocio.instagram.accessToken);
  } catch (err) {
    throw new Error('Instagram no respondió al pedir el video: ' + err.message);
  }
  if (!media || !media.media_url) {
    throw new Error('Instagram no entrega el video de este Reel (pasa con los que usan música con derechos). Crea la pieza a mano y sube el video.');
  }
  const res = await fetch(media.media_url);
  if (!res.ok) throw new Error(`No se pudo descargar el video (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_VIDEO_BYTES) throw new Error('El video es demasiado pesado');
  fs.writeFileSync(destino, buf);
  return { archivo, bytes: buf.length, origen: 'instagram' };
}

// opciones: { graduacion, usarIA, automatico, diaInicio, hora }
async function crear(negocio, mediaId, opciones = {}) {
  if (!negocio.instagram || !negocio.instagram.accessToken) return { error: 'Conecta Instagram para crear Reels de prueba' };
  const { candidatos: lista } = candidatos(negocio);
  const reel = lista.find((r) => r.mediaId === String(mediaId));
  if (!reel) return { error: 'Ese Reel no está entre los destacados de tu cuenta' };
  if (reel.enviado) return { error: 'Ese Reel ya tiene su Reel de prueba' };

  const graduacion = GRADUACIONES[opciones.graduacion] ? opciones.graduacion : 'SS_PERFORMANCE';
  const id = `${negocio.id}-prueba-${Date.now()}`;
  let video;
  try {
    video = await copiarVideo(negocio, reel, id);
  } catch (err) {
    return { error: err.message };
  }
  const pieza = store.getContenido(negocio.id).find((i) => i.id === reel.itemId);
  const textoOriginal = pieza ? pieza.variants[pieza.variantIndex] : reel.caption;
  const nuevo = opciones.usarIA ? await textoParaPrueba(negocio, textoOriginal) : null;
  const variantes = [nuevo, textoOriginal].filter((t, i, a) => t && a.indexOf(t) === i);
  const publicarEl = fechaProgramada(opciones.diaInicio || 1, opciones.hora || '19:00');
  const vistas = reel.vistas != null ? `${reel.vistas.toLocaleString('es-CL')} vistas` : `${(reel.alcance || 0).toLocaleString('es-CL')} de alcance`;
  const item = {
    id,
    status: 'pendiente',
    variantIndex: 0,
    editing: false,
    aspect: '9 / 16',
    formato: 'reel',
    idea: `Reel de prueba del Reel del ${new Date(reel.publicadoEl).toLocaleDateString('es-CL')}, que tuvo ${vistas} (${String(reel.factor).replace('.', ',')} veces tu promedio). Se muestra primero a gente que no te sigue.`,
    headline: 'REEL DE\nPRUEBA',
    tag: 'Reel de prueba',
    enfoqueId: null,
    categoriaFoto: null,
    date: etiquetaFecha(publicarEl, 'Reel de prueba'),
    publicarEl,
    hueFrom: '#6a2a45',
    hueTo: '#1c0e15',
    variants: variantes.length ? variantes : [''],
    generadoConIA: !!nuevo,
    video: { archivo: video.archivo, bytes: video.bytes, subidoEl: new Date().toISOString(), copiadoDe: reel.mediaId },
    prueba: { graduacion, origen: { mediaId: reel.mediaId, permalink: reel.permalink, factor: reel.factor, vistas: reel.vistas, alcance: reel.alcance }, automatico: !!opciones.automatico },
  };
  guardian.aplicar(item, negocio);
  const items = store.getContenido(negocio.id);
  items.push(item);
  items.sort((a, b) => Date.parse(a.publicarEl || 0) - Date.parse(b.publicarEl || 0));
  store.saveContenido(negocio.id, items);
  sql.registrar.run(negocio.id, reel.mediaId, id, opciones.automatico ? 1 : 0, new Date().toISOString());
  return { item, conIA: !!nuevo };
}

// Tras sincronizar: el mejor candidato nuevo pasa solo a Por aprobar.
async function automatico(negocio, opciones) {
  if (negocio.reelsPrueba && negocio.reelsPrueba.auto === false) return null;
  const ultimo = sql.ultimoAuto.get(negocio.id).f;
  if (ultimo && Date.now() - Date.parse(ultimo) < AUTO_CADA_DIAS * DIA) return null;
  const mejor = candidatos(negocio).candidatos.find((c) => !c.enviado);
  if (!mejor) return null;
  const graduacion = (negocio.reelsPrueba && negocio.reelsPrueba.graduacion) || 'SS_PERFORMANCE';
  return crear(negocio, mejor.mediaId, Object.assign({ graduacion, automatico: true }, opciones));
}

// Si la pieza de prueba se borra o se rechaza, el Reel vuelve a estar disponible.
function liberar(negocioId, item) {
  if (item && item.prueba && item.prueba.origen) sql.borrar.run(negocioId, item.prueba.origen.mediaId);
}

function vista(negocio) {
  const c = candidatos(negocio);
  return Object.assign(c, {
    auto: !(negocio.reelsPrueba && negocio.reelsPrueba.auto === false),
    graduacion: (negocio.reelsPrueba && negocio.reelsPrueba.graduacion) || 'SS_PERFORMANCE',
    graduaciones: GRADUACIONES,
    factorMinimo: FACTOR_MINIMO,
  });
}

module.exports = { candidatos, crear, automatico, liberar, vista, GRADUACIONES };
