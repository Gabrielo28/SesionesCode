// Imágenes y videos con IA para las piezas de contenido. Dos proveedores:
//
//   - Higgsfield (HIGGSFIELD_API_KEY: la llave completa, tal como se copia de
//     open.higgsfield.ai/api-keys; las antiguas venían como "id:secreto"):
//     una sola cuenta para imágenes (Soul 2) y videos (Seedance), con saldo
//     prepagado en dólares. Es el preferido si está configurado.
//   - OpenAI (OPENAI_API_KEY): solo imágenes, con gpt-image-2.5-flare
//     (gpt-image-1 se retira el 23 de octubre de 2026). OpenAI cerró su API
//     de videos (Sora 2) el 24 de septiembre de 2026: los videos con IA
//     necesitan Higgsfield.
//
// Las imágenes se esperan en el mismo pedido (tardan segundos). Los videos
// tardan minutos: se crea un trabajo y un sondeo en segundo plano lo baja
// cuando está listo y lo deja como video de la pieza (tabla trabajos_media),
// aunque el dueño haya cerrado el panel.
//
// Qué modelo de Higgsfield se usa lo decide server/creditos.js según la
// calidad que eligió el negocio (Rápida, Recomendada o Premium); cada familia
// de modelos recibe sus propios parámetros (ver cuerpoImagen / cuerpoVideo).
// Si Higgsfield responde que no hay saldo, el error lleva sinSaldo = true para
// que el servidor pause las creaciones y no cobre.
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
const OA_IMAGEN = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';
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
// Videos: solo Higgsfield (OpenAI ya no tiene API de videos).
function proveedorVideo() {
  return process.env.HIGGSFIELD_API_KEY ? 'higgsfield' : null;
}

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
  const guia = require('./diseno-ia').guiaVisual(negocio);
  if (guia) p += ` Estilo visual de la marca: ${guia}`;
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

// La llave tal como se pegó, sin espacios, comillas ni un "Key " de más
// (errores comunes al copiarla a Railway).
function hfLlave() {
  return String(process.env.HIGGSFIELD_API_KEY || '').trim().replace(/^["']|["']$/g, '').replace(/^Key\s+/i, '').trim();
}

function hfHeaders() {
  return { authorization: `Key ${hfLlave()}`, 'content-type': 'application/json', accept: 'application/json' };
}

const SIN_SALDO = /insufficient|not enough|balance|credits? (left|remaining)|out of credits|funds|top.?up|payment required|billing/i;

function errorProveedor(status, mensaje) {
  const err = new Error(mensaje);
  // Higgsfield: 401 es la llave mala; 402 y 403 son falta de saldo.
  if (status === 401 || /invalid credentials|unauthori[sz]ed|invalid api key/i.test(mensaje)) {
    // La llave está mal puesta: es un problema de configuración, no del cliente.
    err.credenciales = true;
    err.message = 'Las fotos y videos con IA no están disponibles por un problema de configuración. Ya avisamos para solucionarlo; no se descontaron créditos.';
    err.detalle = mensaje;
  } else if (status === 402 || status === 403 || SIN_SALDO.test(mensaje)) {
    err.sinSaldo = true;
    err.message = 'Las fotos y videos con IA están en pausa por unos minutos. No se descontaron créditos.';
    err.detalle = mensaje;
  }
  return err;
}

async function hfEnviar(modelo, cuerpo) {
  const res = await fetch(`${HF}/${modelo}`, { method: 'POST', headers: hfHeaders(), body: JSON.stringify(cuerpo) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.request_id) {
    const detalle = data && (data.detail || data.error || data.message);
    throw errorProveedor(res.status, (typeof detalle === 'string' ? detalle : detalle ? JSON.stringify(detalle) : '') || `Higgsfield respondió ${res.status}`);
  }
  return data.request_id;
}

// Parámetros de cada familia de modelos (open.higgsfield.ai/models).
function cuerpoImagen(modelo, prompt, vertical) {
  const aspect = vertical ? '9:16' : '1:1';
  if (!modelo || modelo.familia === 'soul') return { prompt, aspect_ratio: aspect, resolution: '1080p', batch_size: 1, enhance_prompt: true };
  if (modelo.familia === 'ideogram') return { prompt, aspect_ratio: aspect };
  return { prompt, aspect_ratio: aspect, resolution: '1k' };
}

function cuerpoVideo(modelo, prompt, segundos, imagenUrl) {
  let base;
  if (modelo.familia === 'kling') base = { prompt, duration: segundos, sound: 'on', cfg_scale: 0.5 };
  else base = { prompt, duration: segundos, resolution: modelo.resolucion || '720p', generate_audio: true };
  if (imagenUrl) base.image_url = imagenUrl;
  else base.aspect_ratio = '9:16';
  return base;
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
  if (s === 'failed' || s === 'canceled') {
    const motivo = data.error || data.detail || data.message || data.failure_reason || '';
    if (motivo) console.log('Higgsfield falló:', typeof motivo === 'string' ? motivo : JSON.stringify(motivo));
    return { estado: 'error', error: 'La generación falló en Higgsfield' };
  }
  if (s === 'nsfw') return { estado: 'error', error: 'Higgsfield rechazó el contenido por sus políticas' };
  return { estado: 'generando' };
}

// --- OpenAI ---

async function oaImagen(prompt, vertical) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OA_IMAGEN(), prompt, size: vertical ? '1024x1536' : '1024x1024', quality: process.env.OPENAI_IMAGE_QUALITY || 'medium', n: 1, output_format: 'jpeg' }),
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
async function generarImagen({ negocio, item, incluirTexto, modelo }) {
  return imagenDesdePrompt(promptImagen(negocio, item, incluirTexto), VERTICAL.has(item.formato), modelo);
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
  const guia = require('./diseno-ia').guiaVisual(negocio);
  if (guia) p += ` Estilo visual de la marca: ${guia}`;
  return p.slice(0, 3000);
}

// modelo: el de server/creditos.js para la calidad elegida (sin él, Soul 2).
async function imagenDesdePrompt(prompt, vertical, modelo) {
  const proveedor = proveedorImagen();
  if (!proveedor) throw new Error('La generación de imágenes con IA no está configurada');
  if (proveedor === 'openai') return oaImagen(prompt, vertical);
  const id = await hfEnviar(modelo ? modelo.ruta : HF_IMAGEN(), cuerpoImagen(modelo, prompt, vertical));
  const r = await esperar(hfEstado, id, 150);
  if (r.estado !== 'listo') throw new Error(r.error || 'No se pudo generar la imagen');
  return descargar(r.url, 20 * 1024 * 1024);
}

// --- edición de fotos con IA (Higgsfield) ---

function edicionDisponible() {
  return proveedorImagen() === 'higgsfield';
}

// Ancho y alto de una foto JPG, PNG o WebP (para pedir la misma proporción).
function medidas(b) {
  if (!b || b.length < 30) return null;
  if (b[0] === 0x89 && b[1] === 0x50) return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
  if (b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') {
    const tipo = b.slice(12, 16).toString('latin1');
    if (tipo === 'VP8X') return { ancho: 1 + b.readUIntLE(24, 3), alto: 1 + b.readUIntLE(27, 3) };
    if (tipo === 'VP8L') { const v = b.readUInt32LE(21); return { ancho: 1 + (v & 0x3fff), alto: 1 + ((v >> 14) & 0x3fff) }; }
    if (tipo === 'VP8 ') return { ancho: b.readUInt16LE(26) & 0x3fff, alto: b.readUInt16LE(28) & 0x3fff };
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const marca = b[i + 1];
      if (marca >= 0xc0 && marca <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marca)) return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
      if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

// La proporción que acepta el modelo más parecida a la de la foto.
const PROPORCIONES = ['1:1', '4:5', '3:4', '2:3', '9:16', '5:4', '4:3', '3:2', '16:9'];
const PROPORCIONES_QWEN = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9']);
function proporcion(m, familia) {
  if (!m || !m.ancho || !m.alto) return '1:1';
  const r = m.ancho / m.alto;
  const lista = PROPORCIONES.filter((p) => familia !== 'qwen-edit' || PROPORCIONES_QWEN.has(p));
  return lista.reduce((mejor, p) => {
    const [a, b] = p.split(':').map(Number);
    return Math.abs(Math.log(a / b / r)) < Math.abs(Math.log(mejor.r)) ? { p, r: a / b / r } : mejor;
  }, { p: '1:1', r: 1 / r }).p;
}

function cuerpoEdicion(modelo, prompt, imagenUrl, aspecto) {
  if (modelo.familia === 'flare') return { prompt, image_urls: [imagenUrl], quality: 'high', resolution: modelo.resolucion || '1k', aspect_ratio: aspecto };
  return { prompt, image_urls: [imagenUrl], resolution: modelo.resolucion || '1k', aspect_ratio: aspecto };
}

// Lo que el dueño escribe ("ponle fondo blanco y que diga Oferta 20%") se
// pasa a una instrucción precisa en inglés para el modelo; los textos que
// deben aparecer en la foto quedan tal cual, en español. Sin Claude, se
// manda la instrucción original envuelta en reglas básicas.
async function promptEdicion(negocio, instruccion) {
  const reglas = 'If it asks to add text, write that text exactly as given, in Spanish, with correct accents, clean and legible. Do not add logos, watermarks or anything that was not asked. Keep everything else in the photo unchanged.';
  const claude = require('./claude');
  if (claude.configurado()) {
    const e = negocio.estrategia || {};
    const r = await claude.llamar({
      maxTokens: 300,
      negocioId: negocio.id,
      uso: 'edicion',
      content: `Convierte la instrucción de un dueño de negocio para editar una foto en una instrucción para un modelo de edición de imágenes.
Reglas:
- Responde SOLO con la instrucción, en inglés, en 1 a 4 oraciones.
- Todo texto que deba quedar escrito en la imagen va entre comillas dobles y EXACTAMENTE como lo pidió el dueño, en español, con tildes y ñ. No lo traduzcas. Si lo pide sin comillas ("que diga oferta 20%"), deduce el texto exacto.
- Si dijo dónde, de qué tamaño o color va algo, inclúyelo; si no, elige algo legible que combine con la foto.
- Termina con "Keep everything else in the photo unchanged." salvo que pida cambiar la foto completa.
- No agregues logos, marcas de agua ni elementos que no pidió.
Negocio: ${negocio.nombre} (${e.rubro || 'rubro no indicado'}).
Instrucción del dueño: <<<${instruccion}>>>`,
    });
    const t = r.texto && r.texto.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    if (t && t.length > 8) return t.slice(0, 1500);
  }
  return `Edit this photo following this instruction written in Spanish: "${instruccion}". ${reglas}`;
}

// Foto editada: Buffer, o lanza un Error con un mensaje para el dueño.
// imagenUrl: enlace público y temporal a la foto original (Higgsfield la descarga).
async function editarImagen({ negocio, original, imagenUrl, instruccion, modelo }) {
  if (!edicionDisponible()) throw new Error('La edición de fotos con IA no está configurada');
  const prompt = await promptEdicion(negocio, instruccion);
  const id = await hfEnviar(modelo.ruta, cuerpoEdicion(modelo, prompt, imagenUrl, proporcion(medidas(original), modelo.familia)));
  const r = await esperar(hfEstado, id, 210);
  if (r.estado !== 'listo') throw new Error(r.error === 'La imagen tardó demasiado' ? 'La edición tardó demasiado. Intenta de nuevo; no se descontaron créditos.' : (r.error || 'No se pudo editar la foto'));
  return descargar(r.url, 25 * 1024 * 1024);
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
// Columnas agregadas después: qué modelo, cuántos segundos y qué se cobró.
// desde_foto / prompt / reintento: si animar la foto falla, se reintenta una
// vez desde el texto, sin cobrar de nuevo.
for (const [col, tipo] of [['modelo', 'TEXT'], ['segundos', 'INTEGER'], ['cobro', 'TEXT'], ['desde_foto', 'INTEGER'], ['prompt', 'TEXT'], ['reintento', 'INTEGER']]) {
  if (!db.prepare('PRAGMA table_info(trabajos_media)').all().some((c) => c.name === col)) db.exec(`ALTER TABLE trabajos_media ADD COLUMN ${col} ${tipo}`);
}
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM trabajos_media WHERE negocio_id = ?').run(negocioId));
const sqlT = {
  crear: db.prepare(`INSERT INTO trabajos_media (negocio_id, item_id, proveedor, trabajo, estado, creado_el, modelo, segundos, cobro, desde_foto, prompt)
    VALUES (?, ?, ?, ?, 'generando', ?, ?, ?, ?, ?, ?)`),
  reintentar: db.prepare('UPDATE trabajos_media SET trabajo = ?, creado_el = ?, desde_foto = 0, reintento = 1 WHERE id = ?'),
  pendientes: db.prepare("SELECT * FROM trabajos_media WHERE estado = 'generando' ORDER BY id LIMIT 20"),
  terminar: db.prepare('UPDATE trabajos_media SET estado = ?, error = ?, terminado_el = ? WHERE id = ?'),
  delItem: db.prepare("SELECT * FROM trabajos_media WHERE negocio_id = ? AND item_id = ? AND estado = 'generando'"),
};

// imagenUrl: foto de la pieza (URL pública firmada) para animarla; si no
// hay, el video se genera solo desde el texto.
// modelo y segundos vienen de server/creditos.js; cobro se guarda para
// devolverlo si el video no llega.
async function iniciarVideo({ negocio, item, imagenUrl, modelo, segundos, cobro }) {
  const proveedor = proveedorVideo();
  if (!proveedor) throw new Error('La generación de videos con IA no está configurada');
  if (sqlT.delItem.get(negocio.id, item.id)) throw new Error('Ya se está generando un video para esta pieza');
  const prompt = promptVideo(negocio, item);
  const seg = segundos || SEGUNDOS_VIDEO();
  let trabajo;
  if (proveedor === 'openai') {
    trabajo = await oaVideo(prompt);
  } else if (modelo) {
    trabajo = await hfEnviar(`${modelo.ruta}/${imagenUrl ? 'image-to-video' : 'text-to-video'}`, cuerpoVideo(modelo, prompt, seg, imagenUrl));
  } else {
    const base = { prompt, duration: seg, resolution: '720p', generate_audio: process.env.VIDEO_IA_AUDIO === '1' };
    trabajo = imagenUrl
      ? await hfEnviar(`${HF_VIDEO()}/image-to-video`, Object.assign(base, { image_url: imagenUrl }))
      : await hfEnviar(`${HF_VIDEO()}/text-to-video`, Object.assign(base, { aspect_ratio: '9:16' }));
  }
  sqlT.crear.run(negocio.id, item.id, proveedor, String(trabajo), new Date().toISOString(), modelo ? modelo.id : null, seg, cobro ? JSON.stringify(cobro) : null,
    imagenUrl && modelo ? 1 : 0, modelo ? prompt : null);
  return { proveedor, trabajo, desdeFoto: !!imagenUrl && proveedor === 'higgsfield' };
}

// Revisa los videos en curso. alTerminar(t, { ok, archivo, bytes, error }).
// modeloDe(id): el modelo de server/creditos.js, para reintentar desde el texto.
async function revisarTrabajos(alTerminar, modeloDe) {
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
    } else if (r.estado === 'error' && t.desde_foto && !t.reintento && t.prompt && modeloDe && modeloDe(t.modelo)) {
      // Animar la foto falló: una vez más desde el texto, sin cobrar de nuevo.
      try {
        const m = modeloDe(t.modelo);
        const nuevo = await hfEnviar(`${m.ruta}/text-to-video`, cuerpoVideo(m, t.prompt, t.segundos || 5, null));
        sqlT.reintentar.run(String(nuevo), ahora, t.id);
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

function crearSondeo(alTerminar, log = console.log, modeloDe = null) {
  let ocupado = false;
  const intervalo = (Number(process.env.MEDIOS_INTERVALO_SEG) || 15) * 1000;
  const vuelta = async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await revisarTrabajos(alTerminar, modeloDe);
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

module.exports = { edicionDisponible, editarImagen, promptEdicion, medidas, proporcion, cuerpoEdicion, cuerpoImagen, cuerpoVideo, proveedorImagen, proveedorVideo, estado, generarImagen, imagenDesdePrompt, promptLibre, ESTILOS_IMAGEN, iniciarVideo, crearSondeo, promptImagen, promptVideo };
