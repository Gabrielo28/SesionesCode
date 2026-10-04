// Respaldos fuera de Railway, en un bucket compatible con S3 (Cloudflare R2
// recomendado: 10 GB gratis y sin costo por descargar). Sin dependencias: la
// firma SigV4 se arma con node:crypto.
//
// - Base de datos: una copia al día (desde RESPALDO_HORA, hora de Chile),
//   comprimida y, si hay RESPALDO_CLAVE, cifrada (AES-256-GCM). Se guardan
//   7 diarias que se van pisando (base/rubrofy-lunes.db.gz…) y una por mes
//   (base/mensual/rubrofy-AAAA-MM.db.gz).
// - Fotos, videos, logos y capturas: copia incremental (solo lo nuevo o
//   cambiado), por tandas, en archivos/<ruta dentro de data>. Lo que se
//   borra en Rubrofy no se borra del respaldo.
//
// Variables: RESPALDO_S3_ENDPOINT (ej. https://<cuenta>.r2.cloudflarestorage.com),
// RESPALDO_S3_BUCKET, RESPALDO_S3_KEY_ID, RESPALDO_S3_SECRET,
// RESPALDO_S3_REGION (R2: auto), RESPALDO_CLAVE (opcional), RESPALDO_HORA (4).
// Para restaurar: scripts/restaurar-respaldo.js.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const store = require('./store');
const { DATA_DIR } = require('./datos');

const MAX_ARCHIVO = 200 * 1024 * 1024;
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const cfg = () => ({
  endpoint: String(process.env.RESPALDO_S3_ENDPOINT || '').replace(/\/$/, ''),
  bucket: process.env.RESPALDO_S3_BUCKET || '',
  keyId: process.env.RESPALDO_S3_KEY_ID || '',
  secreto: process.env.RESPALDO_S3_SECRET || '',
  region: process.env.RESPALDO_S3_REGION || 'auto',
});
function configurado() {
  const c = cfg();
  return !!(c.endpoint && c.bucket && c.keyId && c.secreto);
}

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS respaldos_archivos (ruta TEXT PRIMARY KEY, tamano INTEGER NOT NULL, mtime INTEGER NOT NULL, subido_el TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS respaldos_estado (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
`);
const sql = {
  archivo: db.prepare('SELECT tamano, mtime FROM respaldos_archivos WHERE ruta = ?'),
  marcar: db.prepare('INSERT INTO respaldos_archivos (ruta, tamano, mtime, subido_el) VALUES (?, ?, ?, ?) ON CONFLICT(ruta) DO UPDATE SET tamano = excluded.tamano, mtime = excluded.mtime, subido_el = excluded.subido_el'),
  cuantos: db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(tamano), 0) AS bytes FROM respaldos_archivos'),
  getEstado: db.prepare('SELECT valor FROM respaldos_estado WHERE clave = ?'),
  setEstado: db.prepare('INSERT INTO respaldos_estado (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'),
};
const leerEstado = (k) => { try { return JSON.parse((sql.getEstado.get(k) || {}).valor || 'null'); } catch (e) { return null; } };
const guardarEstado = (k, v) => sql.setEstado.run(k, JSON.stringify(v));

// --- Firma AWS SigV4 (S3) ---
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
// Cada tramo de la ruta codificado como pide S3 (RFC 3986; "/" se mantiene).
const codificarRuta = (ruta) => ruta.split('/').map((p) => encodeURIComponent(p).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('/');

// Devuelve la cabecera Authorization. headers: en minúsculas, incluye host,
// x-amz-date y x-amz-content-sha256.
function firmar({ metodo, ruta, query = '', headers, payloadHash, keyId, secreto, region, fecha }) {
  const nombres = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const canonHeaders = nombres.map((h) => `${h}:${String(headers[h]).trim()}\n`).join('');
  const firmados = nombres.join(';');
  const canonica = [metodo, codificarRuta(ruta), query, canonHeaders, firmados, payloadHash].join('\n');
  const dia = fecha.slice(0, 8);
  const alcance = `${dia}/${region}/s3/aws4_request`;
  const aFirmar = ['AWS4-HMAC-SHA256', fecha, alcance, sha256(canonica)].join('\n');
  const clave = hmac(hmac(hmac(hmac('AWS4' + secreto, dia), region), 's3'), 'aws4_request');
  const firma = crypto.createHmac('sha256', clave).update(aFirmar).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${keyId}/${alcance}, SignedHeaders=${firmados}, Signature=${firma}`;
}

async function subir(clave, cuerpo, tipo = 'application/octet-stream') {
  const c = cfg();
  const u = new URL(c.endpoint);
  const ruta = `/${c.bucket}/${clave}`;
  const fecha = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const payloadHash = sha256(cuerpo);
  const headers = { host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': fecha };
  const authorization = firmar({ metodo: 'PUT', ruta, headers, payloadHash, keyId: c.keyId, secreto: c.secreto, region: c.region, fecha });
  const res = await fetch(`${u.origin}${codificarRuta(ruta)}`, {
    method: 'PUT',
    headers: { 'x-amz-content-sha256': payloadHash, 'x-amz-date': fecha, authorization, 'content-type': tipo },
    body: cuerpo,
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => '');
    const codigo = (/<Code>([^<]+)<\/Code>/.exec(texto) || [])[1];
    throw new Error(`El bucket respondió ${res.status}${codigo ? ' (' + codigo + ')' : ''} al subir ${clave}`);
  }
}

const { cifrar, descifrar } = require('./respaldos-cifrado');

// Fecha y día de la semana en Chile.
function hoyChile(ahora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(ahora).map((x) => [x.type, x.value]));
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { fecha: `${p.year}-${p.month}-${p.day}`, mes: `${p.year}-${p.month}`, dia: Number(p.day), hora: Number(p.hour), semana: dias[p.weekday] };
}

// Copia consistente de la base (aunque esté en uso) en un archivo temporal.
async function copiaDeLaBase() {
  const tmp = path.join(DATA_DIR, `.respaldo-${Date.now()}.db`);
  const sqlite = require('node:sqlite');
  if (typeof sqlite.backup === 'function') await sqlite.backup(db, tmp);
  else db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  try { return fs.readFileSync(tmp); } finally { fs.rmSync(tmp, { force: true }); }
}

async function respaldarBase(ahora = new Date()) {
  const h = hoyChile(ahora);
  const comprimida = zlib.gzipSync(await copiaDeLaBase(), { level: 9 });
  const { buf, ext } = cifrar(comprimida);
  await subir(`base/rubrofy-${DIAS[h.semana]}.db.gz${ext}`, buf);
  if (leerEstado('mensual') !== h.mes) { // la primera del mes queda como mensual
    await subir(`base/mensual/rubrofy-${h.mes}.db.gz${ext}`, buf);
    guardarEstado('mensual', h.mes);
  }
  return { bytes: buf.length, cifrado: !!ext };
}

// Archivos de data/ que van al respaldo: todo menos la base (va aparte) y
// temporales.
function* recorrer(dir, rel = '') {
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entradas) {
    if (e.name.startsWith('.') || e.name === 'tmp') continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) yield* recorrer(path.join(dir, e.name), r);
    else if (e.isFile() && !/\.db(-wal|-shm|-journal)?$/.test(e.name)) yield r;
  }
}

async function sincronizarArchivos({ maxArchivos = 300, maxBytes = 400 * 1024 * 1024 } = {}) {
  let subidos = 0, bytes = 0, pendientes = 0, grandes = 0;
  for (const rel of recorrer(DATA_DIR)) {
    let st;
    try { st = fs.statSync(path.join(DATA_DIR, rel)); } catch (e) { continue; }
    const previo = sql.archivo.get(rel);
    if (previo && previo.tamano === st.size && previo.mtime === Math.floor(st.mtimeMs)) continue;
    if (st.size > MAX_ARCHIVO) { grandes += 1; continue; }
    if (subidos >= maxArchivos || bytes + st.size > maxBytes) { pendientes += 1; continue; }
    await subir(`archivos/${rel}`, fs.readFileSync(path.join(DATA_DIR, rel)));
    sql.marcar.run(rel, st.size, Math.floor(st.mtimeMs), new Date().toISOString());
    subidos += 1;
    bytes += st.size;
  }
  return { subidos, bytes, pendientes, grandes };
}

let corriendo = null;
// Un respaldo completo (base + archivos). Devuelve el estado guardado.
function respaldar({ motivo = 'automático' } = {}) {
  if (!configurado()) return Promise.resolve({ ok: false, error: 'Faltan las variables RESPALDO_S3_*' });
  if (corriendo) return corriendo;
  corriendo = (async () => {
    const inicio = Date.now();
    const estado = { cuando: new Date().toISOString(), motivo };
    try {
      const base = await respaldarBase();
      const archivos = await sincronizarArchivos();
      Object.assign(estado, { ok: true, base, archivos, segundos: Math.round((Date.now() - inicio) / 1000) });
      guardarEstado('ultimoBase', hoyChile().fecha);
    } catch (err) {
      Object.assign(estado, { ok: false, error: err.message });
      require('./alertas').alertar('respaldo', 'Falló el respaldo externo', `${err.message}. Revisa las variables RESPALDO_S3_* y el bucket.`);
    }
    guardarEstado('ultimo', estado);
    return estado;
  })().finally(() => { corriendo = null; });
  return corriendo;
}

// Cada 15 minutos: la base una vez al día desde RESPALDO_HORA, y si quedaron
// archivos pendientes (primer respaldo grande), otra tanda cada hora.
function iniciar() {
  const revisar = () => {
    if (!configurado() || corriendo) return;
    const h = hoyChile();
    const horaRespaldo = Number(process.env.RESPALDO_HORA) || 4;
    const u = leerEstado('ultimo');
    if (leerEstado('ultimoBase') !== h.fecha && h.hora >= horaRespaldo) return respaldar();
    if (u && u.ok && u.archivos && u.archivos.pendientes && Date.now() - Date.parse(u.cuando) > 3600 * 1000) {
      corriendo = sincronizarArchivos().then((a) => { guardarEstado('ultimo', Object.assign({}, u, { cuando: new Date().toISOString(), archivos: a, motivo: 'tanda pendiente' })); })
        .catch((err) => require('./alertas').alertar('respaldo', 'Falló el respaldo externo', err.message))
        .finally(() => { corriendo = null; });
    }
  };
  setTimeout(revisar, 2 * 60 * 1000).unref();
  setInterval(revisar, 15 * 60 * 1000).unref();
}

// Para /admin → Sistema.
function estado() {
  const t = sql.cuantos.get();
  return { configurado: configurado(), cifrado: !!process.env.RESPALDO_CLAVE, ultimo: leerEstado('ultimo'), archivos: t.n, bytesArchivos: t.bytes, corriendo: !!corriendo };
}

module.exports = { configurado, firmar, codificarRuta, subir, respaldar, respaldarBase, sincronizarArchivos, iniciar, estado, descifrar, hoyChile };
