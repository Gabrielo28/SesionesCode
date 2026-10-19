/*
 * Lego System — Marketing Machine de Influence Chile
 * Una grabación real → piezas etiquetadas → muchos anuncios combinados.
 * No es IA: son tomas reales cortadas y pegadas por ffmpeg.
 *
 *   node lego.js cortar <grabacion.mp4> <cortes.json>   → piezas/<rol>-<nombre>.mp4
 *   node lego.js armar  <carpeta-piezas> [--max 12] [--tanda S43] → anuncios/*.mp4 + manifiesto.csv
 *   node lego.js piezas <carpeta-piezas>                → lista piezas y combinaciones posibles
 *
 * Roles de pieza (prefijo del nombre del archivo):
 *   gancho-*   los primeros 2-4 segundos, lo que detiene el scroll
 *   cuerpo-*   el problema, la prueba o la explicación
 *   cta-*      el cierre: "escríbenos por WhatsApp"
 * Cada anuncio = 1 gancho + 1 cuerpo + 1 cta, siempre en 9:16 (1080x1920).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ---------- localizar ffmpeg (Windows con winget, o en el PATH) ----------
function buscarBinario(nombre) {
  const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  const candidatos = [];
  (function escanear(dir, prof) {
    if (prof > 4 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) escanear(p, prof + 1);
      else if (e.name.toLowerCase() === nombre + '.exe') candidatos.push(p);
    }
  })(base, 0);
  if (candidatos.length) return candidatos[0];
  try { execFileSync(nombre, ['-version'], { stdio: 'pipe' }); return nombre; } catch { }
  throw new Error(`No encuentro ${nombre}. Instálalo con: winget install Gyan.FFmpeg`);
}

const FFMPEG = buscarBinario('ffmpeg');

const ff = args => {
  try {
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('  ⚠ ffmpeg falló:', String(e.stderr || e.message).trim().split('\n').slice(-3).join(' '));
    return false;
  }
};

// Todo sale con el mismo formato para que el concat no falle
const NORMALIZAR = [
  '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2'
];

const ROLES = ['gancho', 'cuerpo', 'cta'];
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- cortar: una grabación → piezas ----------
// cortes.json: [{ "rol": "gancho", "nombre": "redes-dar-mas", "desde": "00:01.2", "hasta": "00:04.8", "texto": "¿Sientes que..." }]
function cortar(grabacion, archivoCortes) {
  const cortes = JSON.parse(fs.readFileSync(archivoCortes, 'utf8'));
  const dir = path.join(path.dirname(grabacion), 'piezas');
  fs.mkdirSync(dir, { recursive: true });
  let ok = 0;
  for (const c of cortes) {
    if (!ROLES.includes(c.rol)) { console.error(`  ⚠ rol desconocido "${c.rol}" en ${c.nombre}`); continue; }
    const destino = path.join(dir, `${c.rol}-${slug(c.nombre)}.mp4`);
    console.log(`  ✂ ${c.rol.padEnd(6)} ${c.desde} → ${c.hasta}  ${path.basename(destino)}`);
    if (ff(['-ss', c.desde, '-to', c.hasta, '-i', grabacion, ...NORMALIZAR, destino])) ok++;
  }
  fs.writeFileSync(path.join(dir, 'cortes.json'), JSON.stringify(cortes, null, 2));
  console.log(`\n${ok}/${cortes.length} piezas en ${dir}`);
}

// ---------- leer piezas de una carpeta ----------
function leerPiezas(dir) {
  const piezas = { gancho: [], cuerpo: [], cta: [] };
  for (const f of fs.readdirSync(dir).sort()) {
    if (!/\.(mp4|mov)$/i.test(f)) continue;
    const rol = f.split('-')[0].toLowerCase();
    if (piezas[rol]) piezas[rol].push(path.join(dir, f));
  }
  return piezas;
}

const etiqueta = archivo => path.basename(archivo, path.extname(archivo)).split('-').slice(1).join('-');

function listar(dir) {
  const p = leerPiezas(dir);
  for (const r of ROLES) console.log(`${r.padEnd(7)} ${p[r].length}  ${p[r].map(etiqueta).join(', ')}`);
  console.log(`\nCombinaciones posibles: ${p.gancho.length * p.cuerpo.length * p.cta.length}`);
}

// ---------- armar: piezas → anuncios ----------
// Recorre las combinaciones priorizando variar el gancho, que es lo que más mueve el resultado.
function armar(dir, max, tanda) {
  const p = leerPiezas(dir);
  const faltan = ROLES.filter(r => !p[r].length);
  if (faltan.length) throw new Error(`Faltan piezas de: ${faltan.join(', ')} (nombra los archivos gancho-*.mp4, cuerpo-*.mp4, cta-*.mp4)`);

  const combos = [];
  for (let k = 0; k < p.cta.length; k++)
    for (let j = 0; j < p.cuerpo.length; j++)
      for (let i = 0; i < p.gancho.length; i++)
        combos.push([p.gancho[i], p.cuerpo[j], p.cta[k]]);
  const elegidos = combos.slice(0, max || combos.length);

  const out = path.join(path.dirname(path.resolve(dir)), 'anuncios');
  fs.mkdirSync(out, { recursive: true });
  const filas = [['archivo', 'gancho', 'cuerpo', 'cta', 'nombre_anuncio']];

  elegidos.forEach((combo, n) => {
    const [g, c, a] = combo.map(etiqueta);
    const nombre = `LEGO-${String(n + 1).padStart(2, '0')}-${g}`;
    const destino = path.join(out, `${nombre}.mp4`);
    const lista = path.join(out, `.${nombre}.txt`);
    fs.writeFileSync(lista, combo.map(f => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`).join('\n'));
    console.log(`  ▶ ${nombre}   [${g} + ${c} + ${a}]`);
    // Las piezas ya vienen normalizadas: re-codificar igual por si alguna se agregó a mano
    ff(['-f', 'concat', '-safe', '0', '-i', lista, ...NORMALIZAR, '-movflags', '+faststart', destino]);
    fs.unlinkSync(lista);
    filas.push([path.basename(destino), g, c, a, `${tanda} · Lego · ${g} · ${c}+${a}`]);
  });

  fs.writeFileSync(path.join(out, 'manifiesto.csv'), filas.map(f => f.map(x => `"${x}"`).join(',')).join('\n'));
  console.log(`\n${elegidos.length} anuncios en ${out} (de ${combos.length} combinaciones posibles)`);
  console.log('manifiesto.csv tiene el nombre que cada anuncio debe llevar en Meta.');
}

// ---------- CLI ----------
const [cmd, a1, a2] = process.argv.slice(2);
const flag = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
try {
  if (cmd === 'cortar' && a1 && a2) cortar(a1, a2);
  else if (cmd === 'armar' && a1) armar(a1, Number(flag('--max', 12)), flag('--tanda', 'S??'));
  else if (cmd === 'piezas' && a1) listar(a1);
  else console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
} catch (e) {
  console.error('✖', e.message);
  process.exit(1);
}
