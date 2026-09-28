// Edición de reels: a partir del video que subió el negocio, arma un reel
// 9:16 listo para publicar. Todo con ffmpeg en el servidor:
//
//   1. Mide el video y, si se pide, detecta los silencios (silencedetect).
//   2. Primera pasada: deja los tramos elegidos (recorte inicio/fin, sin
//      silencios, hasta la duración pedida), los une y ajusta la velocidad.
//   3. Subtítulos: palabra por palabra con OpenAI (si hay OPENAI_API_KEY) o
//      con el texto que escribió el dueño, repartido en el tiempo. Se
//      dibujan con libass (estilo reels: la palabra que suena, resaltada).
//   4. Segunda pasada: 1080×1920, zoom suave, color, subtítulos y las capas
//      del panel (gancho los primeros 2 s, llamado a la acción al final,
//      logo). Las capas llegan como PNG transparentes de 1080×1920 que el
//      panel dibuja con la tipografía de la marca (public/app/reels.js).
//
// Casi no usa IA: solo la transcripción (~USD 0,006 por minuto). Lo caro es
// la CPU, así que los trabajos van en cola, de a uno (EDICION_CONCURRENCIA).
// El video original se guarda y se puede volver a él.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const store = require('./store');
const { DATA_DIR } = require('./datos');

const TRABAJOS_DIR = path.join(DATA_DIR, 'ediciones');
fs.mkdirSync(TRABAJOS_DIR, { recursive: true });
const MAX_ENTRADA_SEG = 180;
const MAX_SALIDA_SEG = 90;
const TIMEOUT_MS = Number(process.env.EDICION_TIMEOUT_SEG || 360) * 1000;
const CONCURRENCIA = Math.max(1, Number(process.env.EDICION_CONCURRENCIA) || 1);
const ANCHO = 1080, ALTO = 1920;

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
let disponibleCache = null;
function disponible() {
  if (disponibleCache === null) {
    try {
      const a = spawnSync(FFMPEG, ['-hide_banner', '-version'], { timeout: 5000 });
      const b = spawnSync(FFPROBE, ['-hide_banner', '-version'], { timeout: 5000 });
      disponibleCache = a.status === 0 && b.status === 0;
    } catch (err) {
      disponibleCache = false;
    }
  }
  return disponibleCache;
}
const subtitulosAuto = () => !!process.env.OPENAI_API_KEY;

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS ediciones_reel (
    id TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    estado TEXT NOT NULL,            -- en_cola | procesando | lista | error
    opciones TEXT NOT NULL,
    entrada TEXT NOT NULL,           -- archivo de video de origen
    error TEXT,
    creado_el TEXT NOT NULL,
    terminado_el TEXT
  );
`);
store.registrarLimpieza((negocioId) => {
  for (const f of db.prepare('SELECT id FROM ediciones_reel WHERE negocio_id = ?').all(negocioId)) fs.rmSync(path.join(TRABAJOS_DIR, f.id), { recursive: true, force: true });
  db.prepare('DELETE FROM ediciones_reel WHERE negocio_id = ?').run(negocioId);
});
const sql = {
  crear: db.prepare('INSERT INTO ediciones_reel (id, negocio_id, item_id, estado, opciones, entrada, creado_el) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  siguiente: db.prepare("SELECT * FROM ediciones_reel WHERE estado = 'en_cola' ORDER BY creado_el LIMIT 1"),
  estado: db.prepare('UPDATE ediciones_reel SET estado = ?, error = ?, terminado_el = ? WHERE id = ?'),
  reanudar: db.prepare("UPDATE ediciones_reel SET estado = 'en_cola' WHERE estado = 'procesando'"),
  delItem: db.prepare("SELECT 1 FROM ediciones_reel WHERE negocio_id = ? AND item_id = ? AND estado IN ('en_cola', 'procesando')"),
};

// ---------- opciones ----------
const COLORES = {
  original: '',
  calido: 'eq=saturation=1.2:contrast=1.05,colorbalance=rs=0.06:bs=-0.05',
  contraste: 'eq=contrast=1.2:saturation=1.1',
  bn: 'hue=s=0,eq=contrast=1.1',
};
function normalizarOpciones(b) {
  const o = b || {};
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const duracion = [15, 30, 60].includes(Number(o.duracion)) ? Number(o.duracion) : 0;
  return {
    duracion,
    cortarSilencios: o.cortarSilencios !== false,
    ini: Math.max(0, num(o.ini, 0)),
    fin: o.fin == null ? null : Math.max(0, num(o.fin, 0)),
    subtitulos: ['auto', 'manual'].includes(o.subtitulos) ? o.subtitulos : 'no',
    guion: String(o.guion || '').slice(0, 1500),
    silenciar: o.silenciar === true,
    velocidad: [1, 1.25, 1.5].includes(Number(o.velocidad)) ? Number(o.velocidad) : 1,
    color: COLORES[o.color] !== undefined ? o.color : 'original',
    zoom: o.zoom !== false,
    colorMarca: /^#[0-9a-f]{6}$/i.test(o.colorMarca || '') ? o.colorMarca : '#ff4d94',
  };
}

// ---------- utilidades de ffmpeg ----------
function correr(bin, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '', out = '';
    p.stdout.on('data', (d) => { out += d; if (out.length > 2e6) out = out.slice(-1e6); });
    p.stderr.on('data', (d) => { err += d; if (err.length > 2e6) err = err.slice(-1e6); });
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('La edición tardó demasiado')); }, TIMEOUT_MS);
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) resolve({ out, err });
      else reject(new Error(`ffmpeg terminó con código ${code}: ${err.split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 400)}`));
    });
  });
}

async function medir(archivo) {
  const { out } = await correr(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', archivo]);
  const j = JSON.parse(out);
  return {
    duracion: Number(j.format && j.format.duration) || 0,
    audio: (j.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

async function detectarSilencios(archivo) {
  const { err } = await correr(FFMPEG, ['-hide_banner', '-nostats', '-i', archivo, '-af', 'silencedetect=noise=-35dB:d=0.6', '-f', 'null', '-']);
  const out = [];
  let inicio = null;
  for (const linea of err.split('\n')) {
    const a = /silence_start: (-?[\d.]+)/.exec(linea);
    const b = /silence_end: ([\d.]+)/.exec(linea);
    if (a) inicio = Math.max(0, Number(a[1]));
    if (b && inicio !== null) { out.push([inicio, Number(b[1])]); inicio = null; }
  }
  if (inicio !== null) out.push([inicio, Infinity]);
  return out;
}

// Tramos que quedan: dentro del recorte, sin silencios, hasta la duración pedida.
function tramos({ duracionTotal, silencios, o }) {
  const fin = o.fin && o.fin > o.ini ? Math.min(o.fin, duracionTotal) : duracionTotal;
  let segs = [[Math.min(o.ini, duracionTotal), fin]];
  if (o.cortarSilencios) {
    for (const [a, b] of silencios) {
      // Se deja un respiro de 0,15 s a cada lado para no cortar palabras.
      const a2 = a + 0.15, b2 = b - 0.15;
      if (b2 <= a2) continue;
      segs = segs.flatMap(([s, e]) => {
        if (b2 <= s || a2 >= e) return [[s, e]];
        const r = [];
        if (a2 > s) r.push([s, a2]);
        if (b2 < e) r.push([b2, e]);
        return r;
      });
    }
  }
  segs = segs.filter(([s, e]) => e - s >= 0.3);
  const max = Math.min(o.duracion || MAX_SALIDA_SEG, MAX_SALIDA_SEG) * o.velocidad;
  const out = [];
  let acc = 0;
  for (const [s, e] of segs) {
    if (acc >= max) break;
    const largo = Math.min(e - s, max - acc);
    out.push([s, s + largo]);
    acc += largo;
  }
  return out.map(([s, e]) => [Math.round(s * 1000) / 1000, Math.round(e * 1000) / 1000]);
}

// ---------- subtítulos (ASS) ----------
function assHora(t) {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
const assColor = (hex) => `&H00${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}&`.toUpperCase();
const assTexto = (t) => String(t).replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim();

// palabras: [{ texto, ini, fin }] en el tiempo del reel final.
function construirASS(palabras, colorMarca) {
  const grupos = [];
  let g = [];
  palabras.forEach((p, i) => {
    const pausa = i > 0 && p.ini - palabras[i - 1].fin > 0.6;
    if (g.length && (g.length >= 4 || pausa)) { grupos.push(g); g = []; }
    g.push(p);
  });
  if (g.length) grupos.push(g);
  const resaltado = assColor(colorMarca);
  const eventos = [];
  grupos.forEach((grupo) => {
    grupo.forEach((p, i) => {
      const fin = i < grupo.length - 1 ? grupo[i + 1].ini : p.fin;
      if (fin <= p.ini) return;
      const texto = grupo.map((q, k) => (k === i ? `{\\c${resaltado}}${assTexto(q.texto)}{\\c&H00FFFFFF&}` : assTexto(q.texto))).join(' ');
      eventos.push(`Dialogue: 0,${assHora(p.ini)},${assHora(fin)},Sub,,0,0,0,,${texto}`);
    });
  });
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${ANCHO}
PlayResY: ${ALTO}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,DejaVu Sans,70,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,-1,0,0,0,100,100,0,0,1,5,2,2,90,90,430,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${eventos.join('\n')}
`;
}

// El texto que escribió el dueño, repartido en la duración del reel.
function palabrasManuales(guion, duracion) {
  const frases = String(guion || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!frases.length || duracion <= 0) return [];
  const porFrase = duracion / frases.length;
  const out = [];
  frases.forEach((f, i) => {
    const ps = f.split(/\s+/);
    const porPalabra = porFrase / ps.length;
    ps.forEach((p, k) => out.push({ texto: p, ini: i * porFrase + k * porPalabra, fin: i * porFrase + (k + 1) * porPalabra }));
  });
  return out;
}

async function transcribir(archivoAudio) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(archivoAudio)], { type: 'audio/mp4' }), 'audio.m4a');
  form.append('model', process.env.OPENAI_TRANSCRIPCION_MODEL || 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('language', 'es');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: form, signal: AbortSignal.timeout(120000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || `La transcripción respondió ${res.status}`);
  return (data.words || []).map((w) => ({ texto: w.word, ini: Number(w.start), fin: Number(w.end) })).filter((w) => w.texto && w.fin > w.ini);
}

// ---------- un trabajo completo ----------
async function editar(trabajo, { alCosto } = {}) {
  const dir = path.join(TRABAJOS_DIR, trabajo.id);
  const o = JSON.parse(trabajo.opciones);
  const entrada = store.videoAbsolutePath(trabajo.negocio_id, trabajo.entrada);
  if (!fs.existsSync(entrada)) throw new Error('El video original ya no está');
  const info = await medir(entrada);
  if (!info.duracion) throw new Error('No se pudo leer el video');
  if (info.duracion > MAX_ENTRADA_SEG + 1) throw new Error(`El video dura más de ${MAX_ENTRADA_SEG / 60} minutos`);
  const silencios = o.cortarSilencios && info.audio ? await detectarSilencios(entrada) : [];
  const segs = tramos({ duracionTotal: info.duracion, silencios, o });
  if (!segs.length) throw new Error('No quedó nada del video después de cortar: revisa el recorte');

  // Primera pasada: cortar, unir y velocidad.
  const partes = [];
  const etiquetas = [];
  segs.forEach(([s, e], i) => {
    partes.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`);
    if (info.audio) partes.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
    etiquetas.push(info.audio ? `[v${i}][a${i}]` : `[v${i}]`);
  });
  partes.push(`${etiquetas.join('')}concat=n=${segs.length}:v=1:a=${info.audio ? 1 : 0}[vc]${info.audio ? '[ac]' : ''}`);
  partes.push(`[vc]setpts=PTS/${o.velocidad}[vo]`);
  if (info.audio) partes.push(`[ac]atempo=${o.velocidad}[ao]`);
  const corte = path.join(dir, 'corte.mp4');
  await correr(FFMPEG, ['-y', '-hide_banner', '-i', entrada, '-filter_complex', partes.join(';'), '-map', '[vo]', ...(info.audio ? ['-map', '[ao]', '-c:a', 'aac', '-b:a', '160k'] : []),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', corte]);
  const duracion = Math.min(MAX_SALIDA_SEG, segs.reduce((t, [s, e]) => t + (e - s), 0) / o.velocidad);

  // Subtítulos.
  let conSubs = false;
  if (o.subtitulos !== 'no') {
    let palabras = [];
    if (o.subtitulos === 'auto' && subtitulosAuto() && info.audio) {
      const audio = path.join(dir, 'voz.m4a');
      await correr(FFMPEG, ['-y', '-hide_banner', '-i', corte, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'aac', '-b:a', '64k', audio]);
      palabras = await transcribir(audio);
      if (alCosto) alCosto(duracion);
    } else if (o.subtitulos === 'manual') {
      palabras = palabrasManuales(o.guion, duracion);
    }
    if (palabras.length) {
      fs.writeFileSync(path.join(dir, 'subs.ass'), construirASS(palabras, o.colorMarca));
      conSubs = true;
    }
  }

  // Segunda pasada: formato, efectos, subtítulos y capas.
  const capas = ['gancho', 'cta', 'logo'].filter((c) => fs.existsSync(path.join(dir, c + '.png')));
  const entradas = ['-i', 'corte.mp4'];
  capas.forEach((c) => entradas.push('-loop', '1', '-i', c + '.png'));
  let cadena = `[0:v]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=increase,crop=${ANCHO}:${ALTO},setsar=1,fps=30`;
  if (o.zoom) cadena += `,zoompan=z='min(zoom+0.0005,1.08)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${ANCHO}x${ALTO}:fps=30`;
  if (COLORES[o.color]) cadena += ',' + COLORES[o.color];
  if (conSubs) cadena += ',ass=subs.ass';
  cadena += '[b0]';
  const filtros = [cadena];
  capas.forEach((c, i) => {
    const cuando = c === 'gancho' ? ":enable='lt(t,2.2)'" : c === 'cta' ? `:enable='gte(t,${Math.max(0, duracion - 3).toFixed(2)})'` : '';
    filtros.push(`[b${i}][${i + 1}:v]overlay=0:0${cuando}[b${i + 1}]`);
  });
  const salida = path.join(dir, 'final.mp4');
  await correr(FFMPEG, ['-y', '-hide_banner', ...entradas, '-filter_complex', filtros.join(';'), '-map', `[b${capas.length}]`,
    ...(info.audio && !o.silenciar ? ['-map', '0:a', '-c:a', 'aac', '-b:a', '128k'] : ['-an']),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', '-t', duracion.toFixed(2), 'final.mp4'], { cwd: dir });
  return { archivo: salida, duracion, tramos: segs.length, silencios: silencios.length, subtitulos: conSubs };
}

// ---------- cola ----------
let alTerminar = null;
let alCosto = null;
let activos = 0;

function iniciar(opciones) {
  alTerminar = opciones.alTerminar;
  alCosto = opciones.alCosto;
  sql.reanudar.run(); // lo que quedó a medias al reiniciar vuelve a la cola
  setImmediate(siguiente);
}

function enProceso(negocioId, itemId) {
  return !!sql.delItem.get(negocioId, itemId);
}

// capas: { gancho, cta, logo } en base64 (PNG 1080×1920 transparente). Devuelve { id } o { error }.
function encolar({ negocioId, itemId, entrada, opciones, capas }) {
  if (!disponible()) return { error: 'La edición de reels no está disponible en este servidor' };
  if (enProceso(negocioId, itemId)) return { error: 'Este reel ya se está editando' };
  const id = 'ed_' + crypto.randomBytes(8).toString('hex');
  const dir = path.join(TRABAJOS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  for (const c of ['gancho', 'cta', 'logo']) {
    const b64 = capas && capas[c] ? String(capas[c]).replace(/^data:[^,]+,/, '') : '';
    if (!b64) continue;
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > 4 * 1024 * 1024 || buf.readUInt32BE(0) !== 0x89504e47) {
      fs.rmSync(dir, { recursive: true, force: true });
      return { error: 'Una de las capas no es una imagen PNG válida' };
    }
    fs.writeFileSync(path.join(dir, c + '.png'), buf);
  }
  sql.crear.run(id, negocioId, itemId, 'en_cola', JSON.stringify(normalizarOpciones(opciones)), entrada, new Date().toISOString());
  setImmediate(siguiente);
  return { id };
}

async function siguiente() {
  if (activos >= CONCURRENCIA) return;
  const t = sql.siguiente.get();
  if (!t) return;
  activos += 1;
  sql.estado.run('procesando', null, null, t.id);
  try {
    const r = await editar(t, { alCosto: (seg) => alCosto && alCosto(t.negocio_id, seg) });
    sql.estado.run('lista', null, new Date().toISOString(), t.id);
    if (alTerminar) await alTerminar({ negocioId: t.negocio_id, itemId: t.item_id, ok: true, archivoTemporal: r.archivo, info: r });
  } catch (err) {
    console.log(`Edición ${t.id} falló: ${err.message}`);
    sql.estado.run('error', err.message.slice(0, 500), new Date().toISOString(), t.id);
    if (alTerminar) await alTerminar({ negocioId: t.negocio_id, itemId: t.item_id, ok: false, error: err.message }).catch(() => {});
  } finally {
    fs.rmSync(path.join(TRABAJOS_DIR, t.id), { recursive: true, force: true });
    activos -= 1;
    setImmediate(siguiente);
  }
}

module.exports = {
  disponible, subtitulosAuto, iniciar, encolar, enProceso, normalizarOpciones, tramos, construirASS, palabrasManuales,
  MAX_ENTRADA_SEG, MAX_SALIDA_SEG,
};
