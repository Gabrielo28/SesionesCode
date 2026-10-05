// Brief de la semana y plan de marketing: lo que el dueño le dice a Rubrofy
// para que la semana salga como él quiere.
//
//   - Plan de marketing (negocio.planMarketing): un texto largo (o un
//     archivo .docx/.pdf/.txt) con la estrategia completa. La IA lo resume
//     en una ficha (promesa, voz, campañas con fechas, pilares) y eso es lo
//     que acompaña cada pedido; el documento entero no viaja a la IA.
//   - Brief de la semana (tabla briefs): texto libre por semana. La IA lo
//     ordena en qué comunicar, publicaciones obligatorias (formato, día e
//     idea), qué evitar y, si lo pide, cuántas publicaciones de cada
//     formato. Manda sobre el plan si se contradicen.
//
// Sin Claude (o si falla), el orden sale de reglas simples sobre el texto.

const zlib = require('zlib');
const store = require('./store');
const claude = require('./claude');
const programacion = require('./programacion');
const { semanaISO } = require('./avisos');

const MAX_BRIEF = 5000;
const MAX_PLAN = 20000;
const MAX_ARCHIVO = 8 * 1024 * 1024;
const FORMATOS = ['post', 'carrusel', 'reel', 'historia'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS briefs (
    negocio_id TEXT NOT NULL,
    semana TEXT NOT NULL,            -- AAAA-Www (semana ISO en la zona del negocio)
    texto TEXT NOT NULL,
    estructurado TEXT NOT NULL,      -- JSON: comunicar, obligatorias, evitar, ritmo
    creado_el TEXT NOT NULL,
    actualizado_el TEXT NOT NULL,
    PRIMARY KEY (negocio_id, semana)
  );
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM briefs WHERE negocio_id = ?').run(negocioId));
const sql = {
  get: db.prepare('SELECT * FROM briefs WHERE negocio_id = ? AND semana = ?'),
  guardar: db.prepare(`INSERT INTO briefs (negocio_id, semana, texto, estructurado, creado_el, actualizado_el) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (negocio_id, semana) DO UPDATE SET texto = excluded.texto, estructurado = excluded.estructurado, actualizado_el = excluded.actualizado_el`),
  lista: db.prepare('SELECT * FROM briefs WHERE negocio_id = ? ORDER BY semana DESC LIMIT ?'),
  anterior: db.prepare('SELECT * FROM briefs WHERE negocio_id = ? AND semana < ? ORDER BY semana DESC LIMIT 1'),
};

const limpiar = (t, max) => String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

// ---------- semanas ----------

// La semana (y sus fechas) que parte en `diaInicio` días desde hoy.
function semanaDesde(diaInicio = 1, ahora = new Date()) {
  const iso = programacion.fechaProgramada(diaInicio, '12:00', ahora);
  const p = programacion.partesEnZona(new Date(iso));
  const semana = semanaISO(p);
  const d = new Date(Date.UTC(p.anio, p.mes - 1, p.dia));
  const lunes = new Date(d); lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay() || 7) - 1));
  const domingo = new Date(lunes); domingo.setUTCDate(lunes.getUTCDate() + 6);
  const f = (x) => x.toISOString().slice(0, 10);
  return { semana, desde: f(lunes), hasta: f(domingo) };
}

function fechasDeSemana(semana) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(semana || ''));
  if (!m) return null;
  // Jueves de la semana ISO → lunes.
  const simple = new Date(Date.UTC(Number(m[1]), 0, 4));
  const lunes = new Date(simple); lunes.setUTCDate(simple.getUTCDate() - ((simple.getUTCDay() || 7) - 1) + (Number(m[2]) - 1) * 7);
  const domingo = new Date(lunes); domingo.setUTCDate(lunes.getUTCDate() + 6);
  const f = (x) => x.toISOString().slice(0, 10);
  return { semana, desde: f(lunes), hasta: f(domingo) };
}
const semanaValida = (s) => /^\d{4}-W\d{2}$/.test(String(s || ''));
const semanaDeFecha = (iso) => semanaISO(programacion.partesEnZona(new Date(iso)));

// ---------- ordenar el brief ----------

function normalizarEstructurado(e, textoOriginal) {
  const o = e && typeof e === 'object' ? e : {};
  const lista = (v, max, largo) => (Array.isArray(v) ? v : []).map((x) => limpiar(typeof x === 'string' ? x : (x && x.texto) || '', largo)).filter(Boolean).slice(0, max);
  const obligatorias = (Array.isArray(o.obligatorias) ? o.obligatorias : []).map((x) => {
    if (!x || typeof x !== 'object') return null;
    const formato = FORMATOS.includes(x.formato) ? x.formato : 'post';
    const dia = Number.isInteger(Number(x.dia)) && Number(x.dia) >= 0 && Number(x.dia) <= 6 ? Number(x.dia) : null;
    const idea = limpiar(x.idea, 300);
    return idea ? { formato, dia, idea } : null;
  }).filter(Boolean).slice(0, 14);
  let ritmo = null;
  if (o.ritmo && typeof o.ritmo === 'object') {
    ritmo = {};
    for (const f of FORMATOS) { const n = Math.floor(Number(o.ritmo[f])); ritmo[f] = Number.isFinite(n) ? Math.min(Math.max(n, 0), 14) : 0; }
    if (!FORMATOS.some((f) => ritmo[f] > 0)) ritmo = null;
  }
  // Las obligatorias no pueden exceder el ritmo pedido.
  if (ritmo) for (const f of FORMATOS) { const n = obligatorias.filter((x) => x.formato === f).length; if (n > ritmo[f]) ritmo[f] = n; }
  return {
    comunicar: lista(o.comunicar, 8, 200),
    obligatorias,
    evitar: lista(o.evitar, 6, 160),
    ritmo,
    resumen: limpiar(o.resumen, 160) || lista(o.comunicar, 1, 160)[0] || limpiar(textoOriginal, 160),
  };
}

// Reglas simples cuando no hay IA: frases como puntos, "3 reels" como ritmo,
// "un reel el jueves sobre X" como obligatoria.
function estructurarSimple(texto) {
  const frases = texto.split(/\n+|(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 3);
  const ritmo = {};
  let hayRitmo = false;
  for (const f of FORMATOS) {
    const re = new RegExp(`(\\d+)\\s*${f === 'historia' ? 'historias?' : f === 'carrusel' ? 'carrusel(?:es)?' : f + 's?'}`, 'i');
    const m = re.exec(texto);
    if (m) { ritmo[f] = Number(m[1]); hayRitmo = true; } else ritmo[f] = 0;
  }
  const obligatorias = [];
  for (const s of frases) {
    const mf = /\b(reel|post|carrusel|historia)\b/i.exec(s);
    const md = new RegExp(`\\b(${DIAS.join('|')}|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\\b`, 'i').exec(s);
    if (mf && (md || /\b(sobre|de|del|con)\b/i.test(s))) {
      const dia = md ? DIAS.findIndex((d) => d.normalize('NFD').replace(/\p{M}/gu, '') === md[1].toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')) : null;
      obligatorias.push({ formato: mf[1].toLowerCase(), dia: dia >= 0 ? dia : null, idea: s.slice(0, 300) });
    }
  }
  const evitar = frases.filter((s) => /^(no |nunca |evita|sin mencionar)/i.test(s));
  const comunicar = frases.filter((s) => !evitar.includes(s)).slice(0, 6);
  return normalizarEstructurado({ comunicar, obligatorias, evitar, ritmo: hayRitmo ? ritmo : null, resumen: comunicar[0] }, texto);
}

async function estructurar(negocio, textoBruto) {
  const texto = limpiar(textoBruto, MAX_BRIEF);
  if (!texto) return null;
  if (!claude.configurado() || negocio.plan === 'gratis') return estructurarSimple(texto);
  const prompt = `Ordena este brief semanal de "${negocio.nombre}" (${(negocio.estrategia || {}).rubro || 'negocio'}) para que un redactor de Instagram lo siga. ` +
    'Responde SOLO con un JSON: {"resumen": "una frase de máximo 120 caracteres con lo central de la semana", ' +
    '"comunicar": ["hasta 6 puntos concretos que deben aparecer en las publicaciones, en orden de importancia"], ' +
    '"obligatorias": [{"formato": "post|carrusel|reel|historia", "dia": 0-6 o null (0 lunes … 6 domingo, solo si el brief fija el día), "idea": "qué debe tratar esa publicación"}] (solo las que el brief pide explícitamente, vacío si no pide ninguna), ' +
    '"evitar": ["lo que no hay que decir o hacer"], ' +
    '"ritmo": {"post": n, "carrusel": n, "reel": n, "historia": n} solo si el brief dice cuántas publicaciones de cada tipo quiere esta semana; si no, null. ' +
    'No inventes nada que no esté en el brief.\n\nBRIEF:\n<<<' + texto + '>>>';
  try {
    const r = await claude.llamar({ maxTokens: 900, content: prompt, negocioId: negocio.id, uso: 'brief' });
    const j = r.texto ? claude.extraerJSON(r.texto) : null;
    if (j) return normalizarEstructurado(j, texto);
  } catch (err) { /* reglas simples */ }
  return estructurarSimple(texto);
}

// ---------- guardar y leer ----------

function publico(fila) {
  if (!fila) return null;
  let e = {};
  try { e = JSON.parse(fila.estructurado); } catch (err) { e = {}; }
  return Object.assign({ semana: fila.semana, texto: fila.texto, actualizadoEl: fila.actualizado_el }, fechasDeSemana(fila.semana), { estructurado: normalizarEstructurado(e, fila.texto) });
}

function obtener(negocioId, semana) {
  return publico(sql.get.get(negocioId, semana));
}

async function guardar(negocio, semana, textoBruto) {
  if (!semanaValida(semana)) return { error: 'Semana inválida' };
  const texto = limpiar(textoBruto, MAX_BRIEF);
  if (!texto) return { error: 'Escribe qué quieres comunicar esta semana' };
  const estructurado = await estructurar(negocio, texto);
  const ahora = new Date().toISOString();
  sql.guardar.run(negocio.id, semana, texto, JSON.stringify(estructurado), ahora, ahora);
  return { brief: obtener(negocio.id, semana) };
}

function historial(negocioId, limite = 12) {
  return sql.lista.all(negocioId, limite).map(publico);
}

function anterior(negocioId, semana) {
  return publico(sql.anterior.get(negocioId, semana));
}

// ---------- plan de marketing ----------

function normalizarResumenPlan(r) {
  const o = r && typeof r === 'object' ? r : {};
  const lista = (v, max, largo) => (Array.isArray(v) ? v : []).map((x) => limpiar(typeof x === 'string' ? x : '', largo)).filter(Boolean).slice(0, max);
  const fecha = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
  const campanas = (Array.isArray(o.campanas) ? o.campanas : []).map((c) => (c && typeof c === 'object' && limpiar(c.nombre, 80) ? {
    nombre: limpiar(c.nombre, 80), desde: fecha(c.desde), hasta: fecha(c.hasta), objetivo: limpiar(c.objetivo, 160), mensajes: lista(c.mensajes, 5, 160),
  } : null)).filter(Boolean).slice(0, 12);
  return { promesa: limpiar(o.promesa, 160), voz: limpiar(o.voz, 300), evitar: lista(o.evitar, 8, 120), pilares: lista(o.pilares, 8, 120), campanas };
}

function resumirSimple(texto) {
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  return normalizarResumenPlan({ promesa: lineas[0] || '', pilares: lineas.filter((l) => /^[-•*]\s/.test(l)).map((l) => l.replace(/^[-•*]\s/, '')).slice(0, 8) });
}

async function resumirPlan(negocio, texto, ahora = new Date()) {
  if (!claude.configurado() || negocio.plan === 'gratis') return resumirSimple(texto);
  const hoy = ahora.toISOString().slice(0, 10);
  const prompt = `Este es el plan de marketing de "${negocio.nombre}" (${(negocio.estrategia || {}).rubro || 'negocio'}). Hoy es ${hoy}. ` +
    'Resúmelo en una ficha para el redactor de sus publicaciones de Instagram. Responde SOLO con un JSON: ' +
    '{"promesa": "la promesa central de la marca en una frase", "voz": "cómo habla y a quién, en una o dos frases", ' +
    '"evitar": ["lo que la marca no dice o no hace"], "pilares": ["temas fijos de contenido"], ' +
    '"campanas": [{"nombre": "...", "desde": "AAAA-MM-DD" o null, "hasta": "AAAA-MM-DD" o null, "objetivo": "...", "mensajes": ["mensajes clave"]}]} ' +
    '(las campañas o fases con sus fechas reales si el plan las da; si habla de semanas desde el lanzamiento y no hay fecha, usa null). ' +
    'No inventes nada.\n\nPLAN:\n<<<' + texto.slice(0, MAX_PLAN) + '>>>';
  try {
    const r = await claude.llamar({ maxTokens: 1500, content: prompt, negocioId: negocio.id, uso: 'brief' });
    const j = r.texto ? claude.extraerJSON(r.texto) : null;
    if (j) return normalizarResumenPlan(j);
  } catch (err) { /* reglas simples */ }
  return resumirSimple(texto);
}

async function guardarPlan(negocio, textoBruto, nombreArchivo) {
  const texto = limpiar(textoBruto, MAX_PLAN);
  const fresco = store.getNegocio(negocio.id);
  if (!texto) { delete fresco.planMarketing; store.saveNegocio(fresco); return { negocio: fresco }; }
  const resumen = await resumirPlan(fresco, texto);
  fresco.planMarketing = { texto, resumen, nombreArchivo: limpiar(nombreArchivo, 120) || null, actualizadoEl: new Date().toISOString() };
  store.saveNegocio(fresco);
  return { negocio: fresco };
}

function campanasActivas(negocio, desde, hasta) {
  const r = negocio.planMarketing && negocio.planMarketing.resumen;
  if (!r) return [];
  return (r.campanas || []).filter((c) => (!c.desde || c.desde <= hasta) && (!c.hasta || c.hasta >= desde));
}

// Brief sugerido para una semana a partir del plan (campañas activas).
async function proponer(negocio, semana) {
  const f = fechasDeSemana(semana);
  const pm = negocio.planMarketing;
  if (!f || !pm) return { error: 'Primero guarda tu plan de marketing en Estrategia', status: 400 };
  const activas = campanasActivas(negocio, f.desde, f.hasta);
  const simple = () => {
    const partes = [];
    if (activas.length) for (const c of activas) partes.push(`${c.nombre}${c.objetivo ? ': ' + c.objetivo : ''}${c.mensajes.length ? '. ' + c.mensajes.join('. ') : ''}`);
    else if (pm.resumen.pilares.length) partes.push('Esta semana, los pilares de siempre: ' + pm.resumen.pilares.join(', ') + '.');
    if (pm.resumen.promesa) partes.push('Recuerda la promesa: ' + pm.resumen.promesa);
    return partes.join('\n');
  };
  if (!claude.configurado() || negocio.plan === 'gratis') return { texto: simple() };
  const prompt = `Escribe el brief de la semana del ${f.desde} al ${f.hasta} para las publicaciones de Instagram de "${negocio.nombre}", a partir de su plan de marketing. ` +
    'Máximo 900 caracteres, en segunda persona como si el dueño se lo dictara a su redactor: qué comunicar esta semana, qué publicaciones no pueden faltar (formato y tema) y qué evitar. ' +
    'Usa solo lo que dice el plan; si una campaña está activa en estas fechas, la semana gira en torno a ella.\n\n' +
    `FICHA DEL PLAN: ${JSON.stringify(pm.resumen)}\nCAMPAÑAS ACTIVAS ESTA SEMANA: ${JSON.stringify(activas)}\n\nResponde solo con el brief, sin títulos.`;
  try {
    const r = await claude.llamar({ maxTokens: 600, content: prompt, negocioId: negocio.id, uso: 'brief' });
    if (r.texto) return { texto: limpiar(r.texto, MAX_BRIEF) };
  } catch (err) { /* simple */ }
  return { texto: simple() };
}

// ---------- lo que viaja a la IA ----------

// Bloque para los prompts de contenido: ficha del plan (campañas activas en
// esas fechas) y el brief de la semana. El brief manda.
function textoParaPrompt(negocio, brief, fechas) {
  const partes = [];
  const pm = negocio.planMarketing && negocio.planMarketing.resumen;
  if (pm) {
    const activas = fechas ? campanasActivas(negocio, fechas.desde, fechas.hasta) : [];
    partes.push('PLAN DE MARKETING DEL NEGOCIO (síguelo siempre):' +
      (pm.promesa ? ` Promesa de marca: "${pm.promesa}".` : '') + (pm.voz ? ` Voz: ${pm.voz}` : '') +
      (pm.pilares.length ? ` Pilares de contenido: ${pm.pilares.join('; ')}.` : '') +
      (pm.evitar.length ? ` Nunca: ${pm.evitar.join('; ')}.` : '') +
      (activas.length ? ` Campañas activas estas fechas: ${activas.map((c) => `"${c.nombre}"${c.objetivo ? ' (' + c.objetivo + ')' : ''}${c.mensajes.length ? ': ' + c.mensajes.join('; ') : ''}`).join(' | ')}.` : ''));
  }
  const e = brief && brief.estructurado;
  if (e) {
    partes.push('BRIEF DE ESTA SEMANA (manda sobre todo lo demás):' +
      (e.comunicar.length ? ` Comunicar: ${e.comunicar.map((c, i) => `${i + 1}) ${c}`).join(' ')}` : '') +
      (e.evitar.length ? ` Evitar: ${e.evitar.join('; ')}.` : '') +
      ` Texto original del dueño: <<<${brief.texto}>>>`);
  }
  return partes.length ? '\n\n' + partes.join('\n') : '';
}

// ---------- archivos: .docx, .pdf, .txt ----------

// Lee las entradas de un ZIP (central directory) y devuelve el contenido de una.
function entradaZip(buf, nombre) {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) return null;
  const n = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const metodo = buf.readUInt16LE(p + 10), tam = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombreEntrada = buf.toString('utf8', p + 46, p + 46 + nl);
    if (nombreEntrada === nombre) {
      const nl2 = buf.readUInt16LE(local + 26), el2 = buf.readUInt16LE(local + 28);
      const datos = buf.subarray(local + 30 + nl2 + el2, local + 30 + nl2 + el2 + tam);
      return metodo === 8 ? zlib.inflateRawSync(datos) : Buffer.from(datos);
    }
    p += 46 + nl + el + cl;
  }
  return null;
}

function textoDeDocx(buf) {
  const xml = entradaZip(buf, 'word/document.xml');
  if (!xml) throw new Error('No parece un archivo de Word (.docx)');
  return xml.toString('utf8')
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// PDF: el texto de los operadores Tj/TJ de cada stream (sirve para PDFs
// hechos desde Word, Docs o Canva; no para escaneados).
function textoDePdf(buf) {
  const s = buf.toString('latin1');
  const trozos = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(s))) {
    let contenido;
    try { contenido = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch (err) { contenido = m[1]; }
    const textos = [];
    const rt = /\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^)\\]|\\.)*)\)\s*Tj/g;
    let t;
    while ((t = rt.exec(contenido))) {
      if (t[1] != null) {
        const partes = []; const rp = /\(((?:[^)\\]|\\.)*)\)|(-?\d+\.?\d*)/g; let q;
        while ((q = rp.exec(t[1]))) { if (q[1] != null) partes.push(q[1]); else if (Number(q[2]) < -200) partes.push(' '); }
        textos.push(partes.join(''));
      } else textos.push(t[2]);
    }
    if (textos.length) trozos.push(textos.join(' ').replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\'));
    if (/\bT\*|\bTd\b|\bTD\b/.test(contenido)) trozos.push('\n');
  }
  return Buffer.from(trozos.join(' '), 'latin1').toString('utf8').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// { nombre, dataBase64 } → { texto } o { error }.
function textoDeArchivo({ nombre, dataBase64 }) {
  const buf = Buffer.from(String(dataBase64 || '').replace(/^data:[^,]+,/, ''), 'base64');
  if (!buf.length) return { error: 'El archivo llegó vacío' };
  if (buf.length > MAX_ARCHIVO) return { error: 'El archivo pesa más de 8 MB' };
  const ext = (String(nombre || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  try {
    let texto;
    if (ext === 'docx' || (buf[0] === 0x50 && buf[1] === 0x4b)) texto = textoDeDocx(buf);
    else if (ext === 'pdf' || buf.subarray(0, 4).toString() === '%PDF') texto = textoDePdf(buf);
    else if (['txt', 'md', 'rtf', ''].includes(ext)) texto = buf.toString('utf8');
    else return { error: 'Sube un .docx, .pdf o .txt, o pega el texto' };
    texto = limpiar(texto, MAX_PLAN);
    if (texto.length < 40) return { error: ext === 'pdf' ? 'No pudimos leer el texto de este PDF (puede ser una imagen escaneada). Copia y pega el texto.' : 'No encontramos texto en el archivo. Copia y pega el texto.' };
    return { texto, recortado: texto.length === MAX_PLAN };
  } catch (err) {
    return { error: 'No pudimos leer el archivo: ' + err.message };
  }
}

module.exports = {
  MAX_BRIEF, MAX_PLAN, FORMATOS, semanaDesde, fechasDeSemana, semanaValida, semanaDeFecha,
  estructurar, estructurarSimple, obtener, guardar, historial, anterior,
  guardarPlan, resumirPlan, campanasActivas, proponer, textoParaPrompt, textoDeArchivo, textoDeDocx, textoDePdf,
};
