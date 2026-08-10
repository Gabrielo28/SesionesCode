/*
 * Kit de video — Influence Chile
 * Tareas mecánicas de edición, por lote y sin abrir ningún programa.
 *
 *   node video.js formatos   <video>              → 9:16, 4:5, 1:1, 16:9
 *   node video.js reel       <video>              → solo 9:16 (1080x1920)
 *   node video.js feed       <video>              → solo 4:5  (1080x1350)
 *   node video.js blur       <video>              → 9:16 con fondo borroso (no recorta)
 *   node video.js subtitulos <video> <archivo.srt>→ quema subtítulos con estilo de marca
 *   node video.js logo       <video> [logo.png]   → marca de agua
 *   node video.js cortar     <video> 00:05 00:35  → recorta ese tramo
 *   node video.js portada    <video> [segundo]    → extrae frame PNG para portada
 *   node video.js optimizar  <video>              → comprime a specs de Instagram
 *   node video.js info       <video>              → muestra specs del archivo
 *   node video.js lote       <carpeta> <comando>  → aplica el comando a toda la carpeta
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------- localizar ffmpeg ----------
function buscarBinario(nombre) {
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  const candidatos = [];
  (function escanear(dir, prof) {
    if (prof > 4 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) escanear(p, prof + 1);
      else if (e.name.toLowerCase() === nombre) candidatos.push(p);
    }
  })(base, 0);
  if (candidatos.length) return candidatos[0];
  try { execFileSync(nombre, ['-version'], { stdio: 'pipe' }); return nombre; } catch { }
  throw new Error(`No encuentro ${nombre}. Reinicia la terminal o reinstala con: winget install Gyan.FFmpeg`);
}

const FFMPEG = buscarBinario('ffmpeg.exe');
const FFPROBE = (() => { try { return buscarBinario('ffprobe.exe'); } catch { return null; } })();

const LOGO_DEFECTO = path.join(__dirname, '..', '..', 'web-influence', 'assets', 'logo-white.png');

// ---------- utilidades ----------
const ff = args => {
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('  ⚠ ffmpeg falló:', String(e.stderr || e.message).trim().split('\n').slice(-3).join(' '));
    return false;
  }
};

const salida = (entrada, sufijo, ext) => {
  const dir = path.join(path.dirname(entrada), 'EXPORT');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const base = path.basename(entrada, path.extname(entrada));
  return path.join(dir, `${base}-${sufijo}${ext || path.extname(entrada)}`);
};

function specs(video) {
  if (!FFPROBE) return null;
  try {
    const j = JSON.parse(execFileSync(FFPROBE, ['-v', 'quiet', '-print_format', 'json',
      '-show_format', '-show_streams', video], { stdio: 'pipe' }).toString());
    const v = j.streams.find(s => s.codec_type === 'video') || {};
    const a = j.streams.find(s => s.codec_type === 'audio');
    return {
      ancho: v.width, alto: v.height,
      fps: v.r_frame_rate ? Math.round(eval(v.r_frame_rate)) : null,
      duracion: parseFloat(j.format.duration || 0),
      peso_mb: (parseInt(j.format.size || 0) / 1048576).toFixed(1),
      video: v.codec_name, audio: a ? a.codec_name : 'sin audio'
    };
  } catch { return null; }
}

// Escala y recorta al centro, manteniendo el encuadre principal
const recorteCentrado = (w, h) =>
  `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;

const CALIDAD = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '128k', '-ar', '44100'];

const FORMATOS = {
  '9-16-reel':   [1080, 1920, 'Reels / Stories / TikTok'],
  '4-5-feed':    [1080, 1350, 'Feed vertical (el que más ocupa pantalla)'],
  '1-1-cuadrado':[1080, 1080, 'Feed cuadrado'],
  '16-9-yt':     [1920, 1080, 'YouTube / web / horizontal']
};

// ---------- comandos ----------
const cmd = {};

cmd.info = v => {
  const s = specs(v);
  if (!s) return console.log('No pude leer las specs.');
  console.log(`\n  ${path.basename(v)}`);
  console.log(`  Resolución : ${s.ancho}x${s.alto}  (${(s.ancho / s.alto).toFixed(2)}:1)`);
  console.log(`  Duración   : ${s.duracion.toFixed(1)}s`);
  console.log(`  FPS        : ${s.fps}`);
  console.log(`  Peso       : ${s.peso_mb} MB`);
  console.log(`  Códecs     : ${s.video} / ${s.audio}\n`);
  if (s.duracion > 90) console.log('  ℹ Dura más de 90s — para Reels conviene cortarlo.');
  if (s.ancho < 1080) console.log('  ⚠ Menos de 1080px de ancho: Instagram lo va a ver borroso.');
};

cmd.formatos = v => {
  console.log(`\n  Exportando ${path.basename(v)} en 4 formatos...\n`);
  for (const [clave, [w, h, desc]] of Object.entries(FORMATOS)) {
    const out = salida(v, clave, '.mp4');
    process.stdout.write(`  ${clave.padEnd(14)} ${String(w + 'x' + h).padEnd(10)} ${desc} ... `);
    console.log(ff(['-i', v, '-vf', recorteCentrado(w, h), ...CALIDAD, out]) ? '✓' : '✗');
  }
  console.log(`\n  → ${path.join(path.dirname(v), 'EXPORT')}\n`);
};

cmd.reel = v => {
  const out = salida(v, '9-16-reel', '.mp4');
  console.log('  Exportando a 1080x1920 ...');
  if (ff(['-i', v, '-vf', recorteCentrado(1080, 1920), ...CALIDAD, out])) console.log('  ✓', out);
};

cmd.feed = v => {
  const out = salida(v, '4-5-feed', '.mp4');
  console.log('  Exportando a 1080x1350 ...');
  if (ff(['-i', v, '-vf', recorteCentrado(1080, 1350), ...CALIDAD, out])) console.log('  ✓', out);
};

// Vertical sin recortar: el video entero al centro sobre su propio fondo borroso
cmd.blur = v => {
  const out = salida(v, '9-16-blur', '.mp4');
  console.log('  Exportando 1080x1920 con fondo borroso (no recorta la imagen) ...');
  const filtro =
    '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=28[bg];' +
    '[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];' +
    '[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1';
  if (ff(['-i', v, '-filter_complex', filtro, ...CALIDAD, out])) console.log('  ✓', out);
};

cmd.subtitulos = (v, srt) => {
  if (!srt || !fs.existsSync(srt)) return console.log('  Falta el .srt: node video.js subtitulos video.mp4 subtitulos.srt');
  const out = salida(v, 'subtitulado', '.mp4');
  // Estilo: Montserrat bold, blanco con borde negro grueso, abajo — legible sin sonido
  const estilo = "FontName=Montserrat,FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF," +
                 "OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV=60";
  const ruta = srt.replace(/\\/g, '/').replace(/:/g, '\\:');
  console.log('  Quemando subtítulos ...');
  if (ff(['-i', v, '-vf', `subtitles='${ruta}':force_style='${estilo}'`, ...CALIDAD, out]))
    console.log('  ✓', out);
};

cmd.logo = (v, logo) => {
  const L = logo || LOGO_DEFECTO;
  if (!fs.existsSync(L)) return console.log('  No encuentro el logo:', L);
  const out = salida(v, 'con-logo', '.mp4');
  console.log('  Aplicando marca de agua ...');
  // Logo al 18% del ancho, esquina inferior derecha, semitransparente
  const filtro = '[1:v]scale=iw*0.18:-1,format=rgba,colorchannelmixer=aa=0.75[lg];' +
                 '[0:v][lg]overlay=W-w-40:H-h-40';
  if (ff(['-i', v, '-i', L, '-filter_complex', filtro, ...CALIDAD, out])) console.log('  ✓', out);
};

cmd.cortar = (v, ini, fin) => {
  if (!ini || !fin) return console.log('  Uso: node video.js cortar video.mp4 00:05 00:35');
  const out = salida(v, 'cortado', '.mp4');
  console.log(`  Cortando de ${ini} a ${fin} ...`);
  if (ff(['-i', v, '-ss', ini, '-to', fin, ...CALIDAD, out])) console.log('  ✓', out);
};

cmd.portada = (v, seg) => {
  const t = seg || '1';
  const out = salida(v, 'portada', '.png');
  console.log(`  Extrayendo frame del segundo ${t} ...`);
  if (ff(['-ss', String(t), '-i', v, '-frames:v', '1', '-vf', 'scale=1080:-1', out]))
    console.log('  ✓', out);
};

cmd.optimizar = v => {
  const out = salida(v, 'optimizado', '.mp4');
  const antes = specs(v);
  console.log('  Comprimiendo para Instagram ...');
  if (ff(['-i', v, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', out])) {
    const despues = specs(out);
    console.log(`  ✓ ${antes ? antes.peso_mb : '?'} MB → ${despues ? despues.peso_mb : '?'} MB`);
    console.log('   ', out);
  }
};

cmd.lote = (carpeta, sub, ...resto) => {
  if (!sub || !cmd[sub] || sub === 'lote') return console.log('  Uso: node video.js lote C:\\ruta\\carpeta formatos');
  const videos = fs.readdirSync(carpeta)
    .filter(f => /\.(mp4|mov|avi|mkv|m4v|webm)$/i.test(f))
    .map(f => path.join(carpeta, f));
  if (!videos.length) return console.log('  No hay videos en esa carpeta.');
  console.log(`\n  ${videos.length} videos · aplicando "${sub}"\n`);
  videos.forEach((v, i) => {
    console.log(`  [${i + 1}/${videos.length}] ${path.basename(v)}`);
    cmd[sub](v, ...resto);
  });
  console.log('\n  Listo.\n');
};

// ---------- entrada ----------
const [, , comando, ...args] = process.argv;

if (!comando || !cmd[comando]) {
  console.log(`
  Kit de video — Influence Chile          (ffmpeg ${FFMPEG.includes('WinGet') ? 'OK' : 'OK'})

  node video.js info       video.mp4              specs del archivo
  node video.js formatos   video.mp4              exporta en los 4 formatos
  node video.js reel       video.mp4              solo 9:16 (1080x1920)
  node video.js feed       video.mp4              solo 4:5  (1080x1350)
  node video.js blur       video.mp4              9:16 con fondo borroso, sin recortar
  node video.js subtitulos video.mp4 subs.srt     quema subtítulos
  node video.js logo       video.mp4 [logo.png]   marca de agua
  node video.js cortar     video.mp4 00:05 00:35  recorta ese tramo
  node video.js portada    video.mp4 [segundo]    frame PNG para portada
  node video.js optimizar  video.mp4              comprime para Instagram
  node video.js lote       C:\\carpeta formatos     aplica a toda una carpeta

  Todo sale en una subcarpeta EXPORT junto al video original.
`);
  process.exit(0);
}

const archivo = args[0];
if (comando !== 'lote' && (!archivo || !fs.existsSync(archivo))) {
  console.log('  No encuentro el archivo:', archivo || '(ninguno)');
  process.exit(1);
}

cmd[comando](...args);
