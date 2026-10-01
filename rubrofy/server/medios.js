// Imágenes y videos con IA para las piezas de contenido. Dos proveedores:
//
//   - Higgsfield (HIGGSFIELD_API_KEY = "id:secreto", de cloud.higgsfield.ai):
//     una sola cuenta para imágenes (Soul 2) y videos (Seedance), con saldo
//     prepagado en dólares. Es el preferido si está configurado.
//   - OpenAI (OPENAI_API_KEY): imágenes con gpt-image-1 y videos con Sora 2.
//
// Las imágenes se esperan en el mismo pedido (tardan segundos). Los videos
// tardan minutos: se crea un trabajo y un sondeo en segundo plano lo baja
// cuando está listo y lo deja como video de la pieza (tabla trabajos_media),
// aunque el dueño haya cerrado el panel.
//
// Los prompts se arman con la idea visual de la pieza, el rubro y el
// contexto de "Imágenes con IA" / "Videos con IA" (server/contexto-ia.js).
// Nunca reemplaza una foto o un video real que el negocio haya subido.

const fs = require('fs');
const store = require('./store');
const contextoIA = require('./contexto-ia');

const HF = 'https://api.higgsfield.ai';
const HF_IMAGEN = () => process.env.HIGGSFIELD_MODELO_IMAGEN || 'higgsfield-ai/soul/v2/standard';
const HF_VIDEO = () => process.env.HIGGSFIELD_MODELO_VIDEO || 'bytedance/seedance-2.0';
const OA_IMAGEN = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const OA_VIDEO = () => process.env.OPENAI_VIDEO_MODEL || 'sora-2';
const SEGUNDOS_VIDEO = () => Math.min(12, Math.max(4, Number(process.env.VIDEO_IA_SEGUNDOS) || 5));
const VERTICAL = new Set(['reel', 'historia']);
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VENCE_MIN = 25; // un video que no termina en 25 minutos se da por fallido

function proveedorImagen() {
  if (process.env.HIGGSFIELD_API_KEY) return 'higgsfield';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return null;
}
const proveedorVideo = proveedorImagen;

function estado() {
  return {
    imagen: proveedorImagen(),
    video: proveedorVideo(),
    modeloImagen: proveedorImagen() === 'higgsfield' ? HF_IMAGEN() : (proveedorImagen() === 'openai' ? OA_IMAGEN() : null),
    modeloVideo: proveedorVideo() === 'higgsfield' ? HF_VIDEO() : (proveedorVideo() === 'openai' ? OA_VIDEO() : null),
  };
}

// --- prompts ---

function describir(negocio, item) {
  const e = negocio.estrategia || {};
  const enfoque = (e.enfoques || []).find((x) => x.id === item.enfoqueId);
  return {
    negocio: `"${negocio.nombre}", un negocio de ${e.rubro || 'rubro no indicado'}`,
    escena: item.idea || (enfoque ? `${enfoque.label}: ${enfoque.pista}` : item.tag || ''),
    categoria: item.categoriaFoto || '',
  };
}

function promptImagen(negocio, item, incluirTexto) {
  const d = describir(negocio, item);
  let p = `Fotografía publicitaria realista para Instagram de ${d.negocio}. Escena: ${d.escena}.`
    + (d.categoria ? ` Tipo de foto: ${d.categoria}.` : '')
    + ' Fotografía profesional, luz natural, composición atractiva para redes sociales, sin marcas de agua ni logos inventados.';
  const ctx = contextoIA.plano(negocio, ['imagen']);
  if (ctx) p += ` Indicaciones visuales: ${ctx}`;
  p += incluirTexto && item.headline
    ? ` Incluye el titular "${item.headline.replace(/\n/g, ' ')}" como texto grande y legible sobre la imagen.`
    : ' No incluyas texto, letras ni palabras en la imagen.';
  return p.slice(0, 3000);
}

function promptVideo(negocio, item) {
  const d = describir(negocio, item);
  let p = `Video vertical corto para un Reel de Instagram de ${d.negocio}. Escena: ${d.escena}.`
    + ' Movimiento de cámara suave y cinematográfico, luz natural, aspecto real (no animación), sin texto en pantalla, sin logos.';
  const ctx = contextoIA.plano(negocio, ['video']);
  if (ctx) p += ` Indicaciones: ${ctx}`;
  return p.slice(0, 3000);
}

// --- Higgsfield ---

function hfHeaders() {
  return { authorization: `Key ${process.env.HIGGSFIELD_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' };
}

async function hfEnviar(modelo, cuerpo) {
  const res = await fetch(`${HF}/${modelo}`, { method: 'POST', headers: hfHeaders(), body: JSON.stringify(cuerpo) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.request_id) throw new Error((data && (data.detail || data.error || data.message)) || `Higgsfield respondió ${res.status}`);
  return data.request_id;
}

async function hfEstado(id) {
  const res = await fetch(`${HF}/requests/${encodeURIComponent(id)}/status`, { headers: hfHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Higgsfield respondió ${res.status}`);
  const s = data.status;
  if (s === 'completed') {
    const url = (data.video && data.video.url) || (data.images && data.images[0] && data.images[0].url) || null;
    return url ? { estado: 'listo', url } : { estado: 'error', error: 'Higgsfield no entregó el archivo' };
  }
  if (s === 'failed' || s === 'canceled') return { estado: 'error', error: 'La generación falló en Higgsfield' };
  if (s === 'nsfw') return { estado: 'error', error: 'Higgsfield rechazó el contenido por sus políticas' };
  return { estado: 'generando' };
}

// --- OpenAI ---

async function oaImagen(prompt, vertical) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OA_IMAGEN(), prompt, size: vertical ? '1024x1536' : '1024x1024', n: 1, output_format: 'jpeg' }),
  });
  if (!res.ok) throw new Error(`OpenAI respondió ${res.status}`);
  const data = await res.json();
  const r = data && data.data && data.data[0];
  if (r && r.b64_json) return Buffer.from(r.b64_json, 'base64');
  if (r && r.url) return descargar(r.url, 20 * 1024 * 1024);
  throw new Error('OpenAI no entregó la imagen');
}

async function oaVideo(prompt) {
  const res = await fetch('https://api.openai.com/v1/videos', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OA_VIDEO(), prompt, seconds: String(SEGUNDOS_VIDEO() <= 4 ? 4 : (SEGUNDOS_VIDEO() <= 8 ? 8 : 12)), size: '720x1280' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error((data.error && data.error.message) || `OpenAI respondió ${res.status}`);
  return data.id;
}

async function oaEstado(id) {
  const auth = { authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
  const res = await fetch(`https://api.openai.com/v1/videos/${encodeURIComponent(id)}`, { headers: auth });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI respondió ${res.status}`);
  if (data.status === 'completed') return { estado: 'listo', url: `https://api.openai.com/v1/videos/${encodeURIComponent(id)}/content`, headers: auth };
  if (data.status === 'failed') return { estado: 'error', error: (data.error && data.error.message) || 'La generación falló en OpenAI' };
  return { estado: 'generando' };
}

// --- comunes ---

async function descargar(url, maxBytes, headers) {
  const res = await fetch(url, { headers: headers || {} });
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('El archivo generado es demasiado grande');
  return buf;
}

async function esperar(consultar, id, maxSegundos) {
  const limite = Date.now() + maxSegundos * 1000;
  const pausa = Number(process.env.MEDIOS_PAUSA_MS) || 2500;
  while (Date.now() < limite) {
    const r = await consultar(id);
    if (r.estado !== 'generando') return r;
    await new Promise((ok) => setTimeout(ok, pausa));
  }
  return { estado: 'error', error: 'La imagen tardó demasiado' };
}

// Imagen para una pieza: Buffer, o lanza un Error con un mensaje para el dueño.
async function generarImagen({ negocio, item, incluirTexto }) {
  return imagenDesdePrompt(promptImagen(negocio, item, incluirTexto), VERTICAL.has(item.formato));
}

// Estilos que el negocio elige en "Generar con IA" (Galería y tarjetas).
const ESTILOS_IMAGEN = {
  realista: 'Fotografía realista con luz natural, como la de un buen fotógrafo profesional.',
  producto: 'Foto de producto en estudio: fondo limpio, iluminación suave y pareja, el producto como protagonista.',
  personas: 'Escena con personas reales y naturales, ambiente cálido y cercano, sin poses forzadas.',
  minimalista: 'Composición minimalista: mucho espacio libre, pocos elementos, colores suaves.',
};

// Prompt a partir de lo que el negocio describe con sus palabras.
function promptLibre(negocio, texto, estilo) {
  const e = negocio.estrategia || {};
  let p = `Imagen para el Instagram de "${negocio.nombre}", un negocio de ${e.rubro || 'rubro no indicado'}. Lo que debe mostrar: ${String(texto).trim()}.`
    + ` ${ESTILOS_IMAGEN[estilo] || ESTILOS_IMAGEN.realista}`
    + ' Composición atractiva para redes sociales, sin marcas de agua ni logos inventados. No incluyas texto, letras ni palabras en la imagen.';
  const ctx = contextoIA.plano(negocio, ['imagen']);
  if (ctx) p += ` Indicaciones visuales: ${ctx}`;
  return p.slice(0, 3000);
}

async function imagenDesdePrompt(prompt, vertical) {
  const proveedor = proveedorImagen();
  if (!proveedor) throw new Error('La generación de imágenes con IA no está configurada');
  if (proveedor === 'openai') return oaImagen(prompt, vertical);
  const id = await hfEnviar(HF_IMAGEN(), {
    prompt, aspect_ratio: vertical ? '9:16' : '1:1', resolution: '1080p', batch_size: 1, enhance_prompt: true,
  });
  const r = await esperar(hfEstado, id, 150);
  if (r.estado !== 'listo') throw new Error(r.error || 'No se pudo generar la imagen');
  return descargar(r.url, 20 * 1024 * 1024);
}

// --- videos: trabajos en segundo plano ---

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS trabajos_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    proveedor TEXT NOT NULL,
    trabajo TEXT NOT NULL,
    estado TEXT NOT NULL,           -- generando | listo | error
    error TEXT,
    creado_el TEXT NOT NULL,
    terminado_el TEXT
  );
  CREATE INDEX IF NOT EXISTS trabajos_media_estado ON trabajos_media (estado);
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM trabajos_media WHERE negocio_id = ?').run(negocioId));
const sqlT = {
  crear: db.prepare(`INSERT INTO trabajos_media (negocio_id, item_id, proveedor, trabajo, estado, creado_el)
    VALUES (?, ?, ?, ?, 'generando', ?)`),
  pendientes: db.prepare("SELECT * FROM trabajos_media WHERE estado = 'generando' ORDER BY id LIMIT 20"),
  terminar: db.prepare('UPDATE trabajos_media SET estado = ?, error = ?, terminado_el = ? WHERE id = ?'),
  delItem: db.prepare("SELECT * FROM trabajos_media WHERE negocio_id = ? AND item_id = ? AND estado = 'generando'"),
};

// imagenUrl: foto de la pieza (URL pública firmada) para animarla; si no
// hay, el video se genera solo desde el texto.
async function iniciarVideo({ negocio, item, imagenUrl }) {
  const proveedor = proveedorVideo();
  if (!proveedor) throw new Error('La generación de videos con IA no está configurada');
  if (sqlT.delItem.get(negocio.id, item.id)) throw new Error('Ya se está generando un video para esta pieza');
  const prompt = promptVideo(negocio, item);
  let trabajo;
  if (proveedor === 'openai') {
    trabajo = await oaVideo(prompt);
  } else {
    const base = { prompt, duration: SEGUNDOS_VIDEO(), resolution: '720p', generate_audio: process.env.VIDEO_IA_AUDIO === '1' };
    trabajo = imagenUrl
      ? await hfEnviar(`${HF_VIDEO()}/image-to-video`, Object.assign(base, { image_url: imagenUrl }))
      : await hfEnviar(`${HF_VIDEO()}/text-to-video`, Object.assign(base, { aspect_ratio: '9:16' }));
  }
  sqlT.crear.run(negocio.id, item.id, proveedor, String(trabajo), new Date().toISOString());
  return { proveedor, trabajo, desdeFoto: !!imagenUrl && proveedor === 'higgsfield' };
}

// Revisa los videos en curso. alTerminar(t, { ok, archivo, bytes, error }).
async function revisarTrabajos(alTerminar) {
  for (const t of sqlT.pendientes.all()) {
    let r;
    try {
      r = t.proveedor === 'openai' ? await oaEstado(t.trabajo) : await hfEstado(t.trabajo);
    } catch (err) {
      r = { estado: 'generando' }; // error de red: se reintenta en la próxima vuelta
    }
    const vencido = Date.now() - Date.parse(t.creado_el) > VENCE_MIN * 60 * 1000;
    if (r.estado === 'generando' && !vencido) continue;
    const ahora = new Date().toISOString();
    if (r.estado === 'listo') {
      try {
        const buf = await descargar(r.url, MAX_VIDEO_BYTES, r.headers);
        const archivo = `${t.item_id}-ia.mp4`;
        fs.mkdirSync(store.videoDir(t.negocio_id), { recursive: true });
        fs.writeFileSync(store.videoAbsolutePath(t.negocio_id, archivo), buf);
        sqlT.terminar.run('listo', null, ahora, t.id);
        await alTerminar(t, { ok: true, archivo, bytes: buf.length });
      } catch (err) {
        sqlT.terminar.run('error', err.message, ahora, t.id);
        await alTerminar(t, { ok: false, error: err.message });
      }
    } else {
      const error = r.error || 'El video tardó demasiado y se canceló';
      sqlT.terminar.run('error', error, ahora, t.id);
      await alTerminar(t, { ok: false, error });
    }
  }
}

function crearSondeo(alTerminar, log = console.log) {
  let ocupado = false;
  const intervalo = (Number(process.env.MEDIOS_INTERVALO_SEG) || 15) * 1000;
  const vuelta = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await revisarTrabajos(alTerminar);
    } catch (err) {
      log('medios: ' + err.message);
    } finally {
      ocupado = false;
    }
  };
  const timer = setInterval(vuelta, intervalo);
  timer.unref();
  return { detener: () => clearInterval(timer), vuelta };
}

module.exports = { proveedorImagen, proveedorVideo, estado, generarImagen, imagenDesdePrompt, promptLibre, ESTILOS_IMAGEN, iniciarVideo, crearSondeo, promptImagen, promptVideo };
