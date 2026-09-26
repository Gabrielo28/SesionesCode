// "Mi estilo": el negocio le muestra a Rubrofy el contenido que ya hace —
// posts, carruseles, reels e historias, importados de su Instagram o
// agregados a mano con texto, captura y una nota — y Claude sintetiza una
// guía de estilo por formato (tono, largo, emojis, estructura, qué se ve).
// El dueño puede corregir la guía. El generador la usa junto con ejemplos
// del mismo formato, respeta la mezcla de formatos del negocio y propone
// la idea visual de cada pieza.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const { GRAPH_BASE } = require('./instagram');

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS referencias (
    id TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    formato TEXT NOT NULL,          -- post | carrusel | reel | historia
    texto TEXT,
    nota TEXT,
    imagen TEXT,                    -- archivo en data/referencias/<negocio>/
    origen TEXT NOT NULL,           -- manual | instagram
    media_id TEXT,
    permalink TEXT,
    creado_el TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS referencias_negocio ON referencias (negocio_id, creado_el);
`);

const REFERENCIAS_DIR = path.join(path.dirname(store.FOTOS_DIR), 'referencias');
fs.mkdirSync(REFERENCIAS_DIR, { recursive: true });
store.registrarLimpieza((negocioId) => {
  db.prepare('DELETE FROM referencias WHERE negocio_id = ?').run(negocioId);
  fs.rmSync(path.join(REFERENCIAS_DIR, negocioId), { recursive: true, force: true });
});

const FORMATOS = ['post', 'carrusel', 'reel', 'historia'];
const ETIQUETAS = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };
const MAX_REFERENCIAS = 60;
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
const TIPOS_IMAGEN = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const sql = {
  listar: db.prepare('SELECT * FROM referencias WHERE negocio_id = ? ORDER BY creado_el DESC'),
  contar: db.prepare('SELECT COUNT(*) AS n FROM referencias WHERE negocio_id = ?'),
  insertar: db.prepare(`INSERT INTO referencias (id, negocio_id, formato, texto, nota, imagen, origen, media_id, permalink, creado_el)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  get: db.prepare('SELECT * FROM referencias WHERE negocio_id = ? AND id = ?'),
  borrar: db.prepare('DELETE FROM referencias WHERE negocio_id = ? AND id = ?'),
  porMedia: db.prepare('SELECT id FROM referencias WHERE negocio_id = ? AND media_id = ?'),
};

function listar(negocioId) {
  return sql.listar.all(negocioId).map((r) => Object.assign({}, r));
}

function imagenAbsoluta(negocioId, archivo) {
  return path.join(REFERENCIAS_DIR, path.basename(negocioId), path.basename(archivo));
}

function guardarImagen(negocioId, id, ext, buffer) {
  const dir = path.join(REFERENCIAS_DIR, negocioId);
  fs.mkdirSync(dir, { recursive: true });
  const archivo = id + ext;
  fs.writeFileSync(path.join(dir, archivo), buffer);
  return archivo;
}

// Alta manual: { formato, texto, nota, imagenBase64, filename }.
function agregar(negocioId, datos) {
  if (!FORMATOS.includes(datos.formato)) return { error: 'Formato inválido' };
  const texto = String(datos.texto || '').trim().slice(0, 2200);
  const nota = String(datos.nota || '').trim().slice(0, 300);
  const base64 = String(datos.imagenBase64 || '').replace(/^data:[^,]+,/, '');
  if (!texto && !base64) return { error: 'Agrega el texto de la publicación o una captura' };
  if (sql.contar.get(negocioId).n >= MAX_REFERENCIAS) return { error: `Puedes guardar hasta ${MAX_REFERENCIAS} ejemplos; borra alguno para agregar otro` };

  const id = 'ref-' + crypto.randomBytes(6).toString('hex');
  let imagen = null;
  if (base64) {
    const ext = TIPOS_IMAGEN[path.extname(String(datos.filename || '')).toLowerCase()] ? path.extname(datos.filename).toLowerCase() : '.jpg';
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_IMAGEN_BYTES) return { error: 'La captura pesa más de 5 MB' };
    imagen = guardarImagen(negocioId, id, ext, buffer);
  }
  sql.insertar.run(id, negocioId, datos.formato, texto || null, nota || null, imagen, 'manual', null, null, new Date().toISOString());
  return { ok: true, id };
}

function borrar(negocioId, id) {
  const r = sql.get.get(negocioId, id);
  if (!r) return false;
  if (r.imagen) fs.rmSync(imagenAbsoluta(negocioId, r.imagen), { force: true });
  sql.borrar.run(negocioId, id);
  return true;
}

function formatoDeInstagram(m) {
  if (m.media_product_type === 'STORY') return 'historia';
  if (m.media_product_type === 'REELS' || m.media_type === 'VIDEO') return 'reel';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carrusel';
  return 'post';
}

async function graphGet(ruta, params, accessToken) {
  const qs = new URLSearchParams(Object.assign({}, params, { access_token: accessToken }));
  const res = await fetch(`${GRAPH_BASE}${ruta}?${qs}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error((data.error && data.error.message) || `Instagram respondió ${res.status}`);
  return data;
}

async function descargarImagen(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.length && buffer.length <= MAX_IMAGEN_BYTES ? buffer : null;
  } catch (err) {
    return null;
  }
}

// Importa los últimos posts (y las historias visibles ahora) del Instagram
// del negocio como ejemplos, con su imagen o portada para el análisis visual.
async function importarDeInstagram(negocio, limite = 30) {
  const { userId, accessToken } = negocio.instagram;
  const campos = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp';
  const posts = await graphGet(`/${userId}/media`, { fields: campos, limit: String(limite) }, accessToken);
  let historias = { data: [] };
  try {
    historias = await graphGet(`/${userId}/stories`, { fields: campos }, accessToken);
  } catch (err) {
    // sin historias activas o sin permiso: se importan solo los posts
  }
  let nuevas = 0;
  for (const m of [...(historias.data || []), ...(posts.data || [])]) {
    if (sql.porMedia.get(negocio.id, String(m.id))) continue;
    if (sql.contar.get(negocio.id).n >= MAX_REFERENCIAS) break;
    const id = 'ref-' + crypto.randomBytes(6).toString('hex');
    const urlImagen = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
    const buffer = urlImagen ? await descargarImagen(urlImagen) : null;
    const imagen = buffer ? guardarImagen(negocio.id, id, '.jpg', buffer) : null;
    const creado = m.timestamp ? new Date(Date.parse(m.timestamp)).toISOString() : new Date().toISOString();
    sql.insertar.run(id, negocio.id, formatoDeInstagram(m), (m.caption || '').slice(0, 2200) || null, null, imagen,
      'instagram', String(m.id), m.permalink || null, creado);
    nuevas += 1;
  }
  return { nuevas };
}

// Proporción de cada formato en los ejemplos (solo con 5 o más).
function mezcla(negocioId) {
  const refs = listar(negocioId);
  if (refs.length < 5) return null;
  const cuenta = {};
  for (const r of refs) cuenta[r.formato] = (cuenta[r.formato] || 0) + 1;
  const resultado = {};
  for (const f of FORMATOS) resultado[f] = Math.round(((cuenta[f] || 0) / refs.length) * 100);
  return resultado;
}

// Formatos para un lote de `cantidad` piezas siguiendo la mezcla del
// negocio (reparto por mayor resto, intercalado para no agrupar iguales).
// Sin mezcla: el patrón de siempre (post, post, historia...).
function planFormatos(negocioId, cantidad, startIndex) {
  const m = mezcla(negocioId);
  if (!m) return Array.from({ length: cantidad }, (_, i) => ((startIndex + i) % 3 === 2 ? 'historia' : 'post'));
  const exactos = FORMATOS.map((f) => ({ f, v: (m[f] / 100) * cantidad }));
  const base = exactos.map((x) => ({ f: x.f, n: Math.floor(x.v), resto: x.v - Math.floor(x.v) }));
  let faltan = cantidad - base.reduce((s, x) => s + x.n, 0);
  for (const x of base.slice().sort((a, b) => b.resto - a.resto)) {
    if (faltan <= 0) break;
    x.n += 1;
    faltan -= 1;
  }
  const lista = [];
  const pendientes = base.filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  while (lista.length < cantidad) {
    for (const x of pendientes) {
      if (x.n > 0 && lista.length < cantidad) {
        lista.push(x.f);
        x.n -= 1;
      }
    }
  }
  return lista;
}

// Ejemplos de texto de un formato para el prompt (los más recientes).
function ejemplos(negocioId, formato, max = 2) {
  return listar(negocioId).filter((r) => r.formato === formato && r.texto).slice(0, max).map((r) => r.texto.slice(0, 300));
}

// --- guía de estilo con Claude (visión incluida) ---

function extraerJSON(texto) {
  const inicio = texto.indexOf('{');
  const fin = texto.lastIndexOf('}');
  if (inicio === -1 || fin <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fin + 1));
  } catch (err) {
    return null;
  }
}

async function analizar(negocio, apiKey) {
  const refs = listar(negocio.id);
  if (refs.length < 3) return { error: 'Agrega al menos 3 ejemplos para analizar tu estilo' };

  // Hasta 6 imágenes, repartidas entre formatos, para que Claude vea el estilo visual.
  const conImagen = [];
  for (const f of FORMATOS) {
    for (const r of refs.filter((x) => x.formato === f && x.imagen).slice(0, 2)) conImagen.push(r);
  }
  const imagenes = [];
  for (const r of conImagen.slice(0, 6)) {
    try {
      const archivo = imagenAbsoluta(negocio.id, r.imagen);
      const tipo = TIPOS_IMAGEN[path.extname(archivo).toLowerCase()] || 'image/jpeg';
      imagenes.push({ ref: r, bloque: { type: 'image', source: { type: 'base64', media_type: tipo, data: fs.readFileSync(archivo).toString('base64') } } });
    } catch (err) {
      // imagen perdida: se analiza sin ella
    }
  }

  const lista = refs.slice(0, 30).map((r, i) => `${i + 1}. [${ETIQUETAS[r.formato]}]${r.nota ? ` (nota del dueño: ${r.nota})` : ''} ${r.texto ? r.texto.slice(0, 400) : '(sin texto)'}`).join('\n');
  const contenido = [];
  imagenes.forEach((img, i) => {
    contenido.push({ type: 'text', text: `Imagen ${i + 1}: ${ETIQUETAS[img.ref.formato]}${img.ref.nota ? ` — nota: ${img.ref.nota}` : ''}` });
    contenido.push(img.bloque);
  });
  contenido.push({
    type: 'text',
    text:
      `Eres estratega de contenido. "${negocio.nombre}" (rubro: ${(negocio.estrategia && negocio.estrategia.rubro) || 'sin especificar'}) ` +
      'te muestra el contenido que ya publica en Instagram para que aprendas su estilo. Ejemplos de texto:\n' + lista + '\n\n' +
      'Describe su estilo para que otro redactor lo imite. Responde SOLO con JSON, sin texto fuera, con esta forma:\n' +
      '{"general": "tono, persona (tú/usted), largo típico, emojis, hashtags, llamados a la acción", ' +
      '"post": "...", "carrusel": "...", "reel": "...", "historia": "..."}\n' +
      'Cada valor en español, máximo 350 caracteres, concreto y basado solo en lo que ves (texto e imágenes: encuadres, ' +
      'si aparecen personas, texto sobre la imagen, colores). Para un formato sin ejemplos escribe "".',
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: contenido }] }),
  });
  if (!res.ok) return { error: 'No se pudo analizar el estilo en este momento' };
  const data = await res.json();
  if (data.stop_reason === 'refusal') return { error: 'No se pudo analizar el estilo con estos ejemplos' };
  const texto = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const guia = extraerJSON(texto);
  if (!guia || typeof guia.general !== 'string') return { error: 'La IA no devolvió una guía válida; intenta de nuevo' };
  const limpio = (v) => (typeof v === 'string' ? v.trim().slice(0, 500) : '');
  return {
    estilo: {
      general: limpio(guia.general),
      porFormato: { post: limpio(guia.post), carrusel: limpio(guia.carrusel), reel: limpio(guia.reel), historia: limpio(guia.historia) },
      generadoEl: new Date().toISOString(),
      basadoEn: refs.length,
      origen: 'ia',
    },
  };
}

// Edición manual de la guía por el dueño (su palabra manda sobre la IA).
function normalizarGuia(body, anterior) {
  const limpio = (v) => String(v || '').trim().slice(0, 500);
  const porFormato = {};
  for (const f of FORMATOS) porFormato[f] = limpio(body.porFormato && body.porFormato[f]);
  return Object.assign({}, anterior, {
    general: limpio(body.general), porFormato, editadoEl: new Date().toISOString(),
  });
}

module.exports = {
  FORMATOS, ETIQUETAS, listar, agregar, borrar, importarDeInstagram, mezcla, planFormatos, ejemplos, analizar,
  normalizarGuia, imagenAbsoluta, REFERENCIAS_DIR,
};
