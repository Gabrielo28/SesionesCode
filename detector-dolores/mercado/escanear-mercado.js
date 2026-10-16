/*
 * Escáner de mercado — Influence Chile (herramienta interna)
 *
 * Escanea muchos negocios desde afuera, detecta sus fallas con el mismo catálogo de
 * códigos del Escáner de Negocio, ordena las soluciones y te dice a quién escribir
 * primero y con qué mensaje. Además resume qué falla más en el rubro completo, para
 * saber qué servicio empaquetar.
 *
 *   node escanear-mercado.js lista.csv [--rubro "Odontología"] [--max 50] [--nombre dentistas-rm]
 *
 * La lista es un CSV con al menos una columna de nombre y una de web. Reconoce:
 *   nombre | name | empresa · web | website | url | sitio · rubro | industria
 *   instagram · ciudad | comuna · prioridad · puntaje · empleados · notas
 * También acepta un .txt con una URL por línea.
 *
 * Produce en resultados/:
 *   <nombre>.json        todo el detalle (lo lee el tablero)
 *   <nombre>.csv         para abrir en Excel
 *   <nombre>.html        el tablero: abrir con doble clic
 *
 * Qué revisa de cada web (una sola visita a la página principal, sin molestar):
 *   carga y https · tiempo de carga y peso · adaptación al celular · WhatsApp directo ·
 *   precios visibles · camino de compra o reserva · prueba social · píxel y analytics ·
 *   año del pie de página · links a Instagram · captura de datos · plataforma usada
 * Lo que no se ve desde la web (Google Maps, Instagram, comprador misterioso) se marca
 * después a mano en el tablero, en el modo taller de cada negocio.
 */
const fs = require('fs');
const path = require('path');
const C = require('../escaner/codigos.js');

// ---------- argumentos ----------
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const entrada = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--rubro' && args[args.indexOf(a) - 1] !== '--max' && args[args.indexOf(a) - 1] !== '--nombre');
if (!entrada) { console.error('Uso: node escanear-mercado.js lista.csv [--rubro "Rubro"] [--max 50] [--nombre salida]'); process.exit(1); }
const FILTRO_RUBRO = opt('rubro');
const MAX = parseInt(opt('max', '0'), 10) || 0;
const NOMBRE = opt('nombre', path.basename(entrada).replace(/\.[^.]+$/, '') + (FILTRO_RUBRO ? '-' + slug(FILTRO_RUBRO) : ''));
const PARALELO = 4, TIMEOUT = 15000, AÑO = new Date().getFullYear();

// Navegador real (opcional pero recomendado): carga las webs hechas con JavaScript igual que un
// visitante. Usa el Chrome que ya tienes instalado. En tu PC: `npm install` dentro de esta carpeta.
const CHROME_CANDIDATOS = [process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome']
  // En Railway (Nixpacks) Chromium queda en el PATH
  .concat(String(process.env.PATH || '').split(path.delimiter).filter(Boolean).flatMap(d => ['chromium', 'chromium-browser', 'google-chrome'].map(x => path.join(d, x)))).filter(Boolean);
let navegador = null;
async function abrirNavegador() {
  if (args.includes('--sin-navegador')) return null;
  let pw = null; for (const m of ['playwright-core', 'playwright']) { try { pw = require(m); break; } catch (e) {} }
  if (!pw) { console.log('Aviso: sin navegador real (npm install en esta carpeta). Las webs hechas con JavaScript se revisarán a mano.'); return null; }
  const exe = CHROME_CANDIDATOS.find(p => fs.existsSync(p));
  try { return await pw.chromium.launch(Object.assign({ args: ['--no-sandbox'] }, exe ? { executablePath: exe } : {})); }
  catch (e) { console.log('Aviso: no se pudo abrir Chrome (' + e.message.split('\n')[0] + '). Sigo sin navegador.'); return null; }
}
async function renderizar(url) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36', locale: 'es-CL' });
  const pag = await ctx.newPage(); const t0 = Date.now();
  try {
    const r = await pag.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const msDom = Date.now() - t0;
    await pag.waitForTimeout(3500); // widgets de WhatsApp, reseñas y píxeles que se cargan después
    const visible = () => pag.evaluate(() => ({ t: document.title || '', txt: document.body ? document.body.innerText.replace(/\s+/g, ' ').trim() : '' })).catch(() => ({ t: '', txt: '' }));
    let vis = await visible();
    if (vis.txt.length < 300) { await pag.waitForTimeout(5000); vis = await visible(); }
    const html = await pag.content();
    return { ok: !!r && r.status() < 400, status: r ? r.status() : 0, urlFinal: pag.url(), ms: msDom, kb: Math.round(Buffer.byteLength(html) / 1024), html, renderizado: true, titulo: vis.t, visible: vis.txt };
  } catch (e) { return null; } finally { await ctx.close(); }
}

function slug(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

// ---------- lectura ----------
function parseCSV(txt) {
  const filas = []; let fila = [], campo = '', q = false;
  txt = txt.replace(/^﻿/, '');
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === ';') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = filas.shift().map(h => slug(h).replace(/-/g, '_'));
  return filas.filter(f => f.some(x => x.trim())).map(f => Object.fromEntries(cab.map((h, i) => [h, (f[i] || '').trim()])));
}
const pick = (o, ks) => { for (const k of ks) if (o[k]) return o[k]; return ''; };
function leerLista(archivo) {
  const txt = fs.readFileSync(archivo, 'utf8');
  if (/\.txt$/i.test(archivo)) return txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(u => ({ nombre: u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], web: u }));
  return parseCSV(txt).map(o => ({
    nombre: pick(o, ['nombre', 'name', 'empresa', 'negocio']),
    web: pick(o, ['web', 'website', 'url', 'sitio', 'sitio_web']),
    rubro: pick(o, ['rubro', 'industria', 'industry', 'categoria']),
    ciudad: pick(o, ['ciudad', 'comuna', 'city']),
    instagram: pick(o, ['instagram', 'ig']),
    prioridad: pick(o, ['prioridad']), puntaje: pick(o, ['puntaje', 'score']),
    empleados: pick(o, ['empleados', 'employees']), notas: pick(o, ['notas']),
    descripcion: pick(o, ['descripcion', 'description']).slice(0, 220),
    linkedin: pick(o, ['linkedin']), ads: pick(o, ['biblioteca_anuncios'])
  })).filter(x => x.nombre);
}

// ---------- visita a la web ----------
async function visitar(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const t0 = Date.now();
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36 InfluenceScanner/1.0', 'Accept-Language': 'es-CL,es;q=0.9' } });
    const html = await r.text();
    return { ok: r.ok, status: r.status, urlFinal: r.url, ms: Date.now() - t0, kb: Math.round(Buffer.byteLength(html) / 1024), html };
  } catch (e) {
    // si https falla, probar http (para detectar "sin candado")
    if (url.startsWith('https://')) {
      try {
        const r2 = await fetch(url.replace('https://', 'http://'), { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT) });
        const html = await r2.text();
        return { ok: r2.ok, status: r2.status, urlFinal: r2.url, ms: Date.now() - t0, kb: Math.round(Buffer.byteLength(html) / 1024), html, soloHttp: true };
      } catch (e2) {}
    }
    return { ok: false, error: e.name === 'AbortError' ? 'no respondió en 15 s' : (e.cause && e.cause.code) || e.message, ms: Date.now() - t0 };
  } finally { clearTimeout(to); }
}

// ---------- sensores web ----------
function plataforma(h) {
  const P = [['Shopify', /cdn\.shopify\.com|Shopify\.theme/i], ['WooCommerce', /woocommerce/i], ['Jumpseller', /jumpseller/i], ['Wix', /wix\.com|_wixCIDX|wixstatic/i], ['Squarespace', /squarespace/i],
    ['VTEX', /vtex/i], ['Bsale', /bsale/i], ['WordPress', /wp-content|wp-includes/i], ['Webflow', /webflow/i], ['Tiendanube', /tiendanube|nuvemshop/i], ['Next.js', /__NEXT_DATA__|_next\/static/i]];
  const f = P.find(([, re]) => re.test(h)); return f ? f[0] : 'Otra';
}
function analizar(v) {
  const s = []; // { codigo, evidencia }
  const add = (codigo, evidencia) => s.push({ codigo, evidencia });
  const info = {};
  if (!v.ok) {
    // Solo es "web caída" cuando el dominio no existe o el servidor falla de verdad. Los bloqueos
    // a robots (403, 429, 503 de Cloudflare) y los tiempos agotados se revisan a mano.
    if (v.error === 'ENOTFOUND') add('CAP-06', 'El dominio de la web no existe o venció, así que quien la busca no encuentra nada. (Antes de escribir, confirma en Google o Instagram que ese sea su dominio actual.)');
    else if (v.status >= 500 && v.status !== 503) add('CAP-06', `La web responde con un error del servidor (${v.status}) y no muestra nada del negocio.`);
    else if (v.status === 404) add('CAP-06', 'La página principal de la web da error 404 y no muestra nada del negocio.');
    info.revisar = v.status ? (v.status === 403 || v.status === 429 || v.status === 503 ? 'la web bloquea revisiones automáticas (' + v.status + ')' : 'respuesta ' + v.status) : v.error;
    return { senales: s, info };
  }
  const h = v.html, hl = h.toLowerCase();
  const texto = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  info.plataforma = plataforma(h); info.ms = v.ms; info.kb = v.kb; info.url = v.urlFinal;
  // Sin candado: solo se afirma cuando el navegador real terminó en http:// (Node a veces falla
  // con certificados que Chrome sí acepta, así que esa falla sola no basta).
  if (v.renderizado && /^http:\/\//.test(v.urlFinal)) add('CAP-06', 'La web no tiene candado de seguridad (https), y el navegador la marca como "no segura".');
  info.renderizado = !!v.renderizado;
  const visible = v.visible != null ? v.visible : texto.trim();
  const cabeza = ((v.titulo || '') + ' ' + visible.slice(0, 400)).toLowerCase();
  if (/suspendedpage|account suspended|cuenta suspendida|sitio suspendido|this account has been suspended/.test(cabeza + ' ' + (v.urlFinal || ''))) {
    add('CAP-06', 'La web muestra "Account Suspended" porque el hosting está suspendido, y quien la visita no ve nada del negocio.'); return { senales: s, info };
  }
  if (/domain (is )?for sale|dominio (está )?a la venta|this domain is parked|parked domain|default web site page|apache2 .*default page|welcome to nginx|index of \//.test(cabeza)) {
    add('CAP-06', 'El dominio muestra una página por defecto o en venta, así que la web del negocio no está publicada.'); return { senales: s, info };
  }
  if (/access denied|just a moment|attention required|checking your browser|verificando|captcha|not available in your region|no disponible en tu (país|región)|selecciona tu país|desde dónde nos visitas|eres mayor de edad|age verification/.test(cabeza)) {
    info.revisar = 'la web muestra una pantalla previa (bloqueo, país o edad): revisar a mano'; return { senales: s, info };
  }
  if (visible.length < 300) {
    if (v.renderizado && visible.length < 120 && /en construcci[oó]n|coming soon|pr[oó]ximamente|mantenimiento|under construction/.test(cabeza)) add('CAP-06', 'La web dice "en construcción" o "próximamente", así que no hay nada que mostrarle a un cliente.');
    else { info.revisar = v.renderizado ? 'la página principal casi no tiene texto: revisar a mano' : 'la web se arma con JavaScript: revisar a mano o instalar el navegador'; }
    return { senales: s, info };
  }
  const movil = /<meta[^>]+name=["']viewport["']/i.test(h);
  if (!movil) add('CON-06', 'La web no está adaptada al celular (no declara versión móvil).');
  else if (v.ms > 4000) add('CON-06', `La página principal demoró ${(v.ms / 1000).toFixed(1)} segundos en empezar a cargar, y en el celular el cliente se va antes.`);
  else if (v.kb > 1500) add('CON-06', `La página principal pesa ${Math.round(v.kb / 1024 * 10) / 10} MB, así que carga lenta con datos móviles.`);
  const wa = /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/|web\.whatsapp\.com\/send|whatsapp/i.test(h);
  info.whatsapp = wa;
  if (!wa) add('CON-07', 'No hay botón ni link de WhatsApp en la web.');
  const precio = /\$\s?\d{1,3}(?:\.\d{3})+|\$\s?\d{4,}|clp\s?\d|\d{1,3}(?:\.\d{3})+\s?clp|precio/i.test(texto);
  info.precios = precio;
  if (!precio) add('CON-05', 'No se ve ningún precio ni rango en la página principal.');
  const tienda = /(add[-_ ]to[-_ ]cart|añadir al carro|agregar al carro|agregar al carrito|añadir al carrito|carrito|checkout|comprar ahora|cdn\.shopify|woocommerce|jumpseller|vtex|tiendanube)/i.test(h);
  const reserva = /(agendapro|reservo\.cl|calendly|doctoralia|encuadrado|medilink|dentalink|booksy|fresha|simplybook|setmore|reserva tu hora|agenda tu hora|agendar hora|reservar hora|reserva online|agenda online|pide tu hora|reserva aquí|agendar|reservar)/i.test(h);
  const formulario = /<form[\s>]/i.test(h);
  info.camino = tienda ? 'tienda' : reserva ? 'reserva' : formulario ? 'formulario' : 'ninguno';
  if (!tienda && !reserva && !formulario && !wa) add('CON-03', 'No hay forma de comprar, reservar ni escribir desde la web, solo información.');
  else if (!tienda && !reserva) add('CON-03', 'No se puede comprar ni reservar directo desde la web' + (formulario ? ', solo un formulario.' : '.'));
  const social = /(testimonio|rese[ñn]a|opiniones|lo que dicen|clientes dicen|nuestros clientes|casos de [ée]xito|google reviews|trustpilot|★|estrellas)/i.test(texto) || /(trustindex|elfsight|reviews-widget|judge\.me|yotpo|loox)/i.test(h);
  if (!social) add('CON-04', 'La web no muestra reseñas, testimonios ni casos.');
  const pixel = /connect\.facebook\.net|fbq\(/i.test(h), ga = /googletagmanager\.com|gtag\(|google-analytics\.com|GTM-[A-Z0-9]+/i.test(h);
  info.pixel = pixel; info.analytics = ga;
  if (!pixel && !ga) add('DAT-05', 'La web no tiene píxel de Meta ni Google Analytics, así que no saben cuántas visitas llegan ni qué trae cada campaña.');
  else if (!pixel) add('DAT-02', 'Tiene analytics pero no píxel de Meta, así que no pueden medir ni optimizar anuncios en Instagram.');
  const años = [...texto.matchAll(/(?:©|copyright|&copy;)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map(m => +m[1]);
  if (años.length) { info.año = Math.max(...años); if (info.año <= AÑO - 2) add('CAP-03', `El pie de página dice © ${info.año}, así que la web se ve abandonada.`); }
  const ig = /instagram\.com\//i.test(h); info.instagram = ig;
  if (!ig) add('CAP-02', 'La web no enlaza a Instagram ni a otras redes.');
  const captura = /(newsletter|suscr[ií]bete|suscribirse|type=["']email["']|mailchimp|klaviyo|club de|descuento en tu primera)/i.test(h);
  if (!captura && info.camino !== 'formulario') add('RET-01', 'La web no captura datos de visitantes (sin suscripción ni formulario).');
  return { senales: s, info };
}

// ---------- puntaje y mensaje ----------
function priorizar(n) {
  const det = {}; n.senales.forEach(x => { (det[x.codigo] = det[x.codigo] || []).push(x.evidencia); });
  const lista = Object.keys(det).map(id => ({ id, g: C.porId[id].g, nombre: C.porId[id].nombre, sistema: C.porId[id].sistema, evidencia: det[id] })).sort((a, b) => b.g - a.g || a.id.localeCompare(b.id));
  const soluciones = C.rankearSoluciones(det, 5).map(t => ({ id: t.s.id, nombre: t.s.nombre, quien: t.s.quien, esfuerzo: t.s.esfuerzo, repara: t.nuevos }));
  const dolor = lista.reduce((a, c) => a + c.g, 0);
  // Qué tan seguro es cada hallazgo visto solo desde la web (1 = se ve directo; menos = es un indicio)
  const CERTEZA = { 'CAP-06': 3, 'CON-07': 1, 'CON-03': 1, 'CON-06': 1, 'DAT-05': 1, 'CAP-03': .8, 'CON-05': .6, 'CON-04': .6, 'DAT-02': .6, 'CAP-02': .5, 'RET-01': .4, 'CAP-01': 1 };
  // Encaje con el cliente ideal: puntaje o prioridad del CSV si existen (0,6 a 1,0)
  const encaje = n.puntaje ? .6 + Math.min(+n.puntaje, 100) / 250 : ({ A: 1, B: .85, C: .7 }[n.prioridad] || .85);
  // Lo que se repara con servicios que vende Influence pesa el triple que el resto
  const reparables = new Set(); soluciones.filter(s => s.quien === 'influence').forEach(s => s.repara.forEach(id => reparables.add(id)));
  const bruto = lista.reduce((a, c) => a + c.g * (reparables.has(c.id) ? 3 : 1) * (CERTEZA[c.id] || 1), 0);
  const oportunidad = Math.round(Math.min(100, bruto * 3.2 * encaje));
  return { codigos: lista, soluciones, dolor, oportunidad, nivel: null };
}
// El gancho del mensaje es el hallazgo más concreto y fácil de verificar, no el más grave en teoría.
const GANCHO = ['CAP-06', 'CON-07', 'CON-03', 'CON-06', 'DAT-05', 'CAP-03', 'CON-05', 'CON-04', 'DAT-02', 'CAP-01', 'RET-01', 'CAP-02'];
const PLAZO = { 1: 'en una semana', 2: 'en 2 a 4 semanas', 3: 'en 1 a 3 meses' };
function mensaje(n) {
  if (!n.codigos.length) return '';
  const top = n.codigos.slice().sort((a, b) => (GANCHO.indexOf(a.id) + 99) % 99 - (GANCHO.indexOf(b.id) + 99) % 99)[0];
  const ev = top.evidencia[0].replace(/\s*\(Antes de escribir[^)]*\)/, '').replace(/\.$/, '');
  // Cómo se resuelve, con plazos reales de los servicios de Influence
  const ARREGLO = {
    'CAP-06': 'una landing nueva en su propio dominio, lista en 5 a 7 días',
    'CON-07': 'un botón y un asistente de WhatsApp que responde, califica y agenda, listo en una semana',
    'CON-03': 'una landing o agenda online donde se pueda reservar o comprar en dos toques, lista en 5 a 7 días',
    'CON-06': 'una landing liviana pensada para el celular, lista en 5 a 7 días',
    'DAT-05': 'dejar instalada la medición (píxel y analytics) en una semana, para que cada peso en publicidad se pueda medir',
    'CAP-01': 'una landing con su información, precios y WhatsApp, lista en 5 a 7 días'
  };
  const solCat = C.SOLUCIONES.filter(s => s.quien === 'influence' && s.codigos.includes(top.id)).sort((a, b) => a.esfuerzo - b.esfuerzo)[0];
  const arreglo = ARREGLO[top.id] || (solCat ? solCat.nombre.charAt(0).toLowerCase() + solCat.nombre.slice(1) + ' ' + PLAZO[solCat.esfuerzo] : '');
  const resto = n.codigos.length - 1;
  const nombre = n.nombre.length > 40 ? n.nombre.split(/[,(|-]/)[0].trim() : n.nombre;
  return `Hola, soy Gabriel de Influence Chile. Revisé la web de ${nombre} desde el celular y encontré algo que les puede estar costando clientes: ${ev.charAt(0).toLowerCase() + ev.slice(1)}.` +
    (resto ? ` Vi ${resto === 1 ? 'otra cosa' : resto + ' cosas más'} que se ${resto === 1 ? 'puede' : 'pueden'} mejorar.` : '') +
    (arreglo ? ` Se resuelve con ${arreglo}.` : '') +
    ` ¿Te mando el diagnóstico completo? Son 2 minutos de lectura, sin costo.`;
}

// ---------- mercado ----------
function resumenMercado(ns) {
  const ok = ns.filter(n => n.visita.ok && !n.info.sinWeb && !n.info.revisar);
  const freq = {}; ok.forEach(n => n.codigos.forEach(c => { freq[c.id] = (freq[c.id] || 0) + 1; }));
  const codigos = Object.entries(freq).map(([id, k]) => ({ id, nombre: C.porId[id].nombre, g: C.porId[id].g, negocios: k, pct: Math.round(k / Math.max(ok.length, 1) * 100) })).sort((a, b) => b.negocios - a.negocios || b.g - a.g);
  const sfreq = {}; ok.forEach(n => n.soluciones.slice(0, 3).forEach((s, i) => { sfreq[s.id] = sfreq[s.id] || { id: s.id, nombre: s.nombre, quien: s.quien, top1: 0, top3: 0 }; sfreq[s.id].top3++; if (i === 0) sfreq[s.id].top1++; }));
  const soluciones = Object.values(sfreq).sort((a, b) => b.top3 - a.top3 || b.top1 - a.top1);
  const plat = {}; ok.forEach(n => { const p = n.info.plataforma || 'Otra'; plat[p] = (plat[p] || 0) + 1; });
  return { escaneados: ns.length, cargaron: ok.length, renderizados: ok.filter(n => n.info.renderizado).length, codigos, soluciones, plataformas: plat,
    niveles: ['Escribir hoy', 'Esta semana', 'Nutrir', 'Revisar a mano'].map(k => ({ nivel: k, n: ns.filter(x => x.nivel === k).length })) };
}

// ---------- principal ----------
(async () => {
  let lista = leerLista(entrada);
  if (FILTRO_RUBRO) lista = lista.filter(n => slug(n.rubro).includes(slug(FILTRO_RUBRO)));
  if (MAX) lista = lista.slice(0, MAX);
  const conWeb = lista.filter(n => n.web), sinWeb = lista.filter(n => !n.web);
  navegador = await abrirNavegador();
  console.log(`Escaneando ${conWeb.length} webs${sinWeb.length ? ` (${sinWeb.length} sin web)` : ''}…`);
  const res = []; let i = 0, hechos = 0;
  async function trabajador() {
    while (i < conWeb.length) {
      const n = conWeb[i++];
      if (/^(https?:\/\/)?(wa\.me|api\.whatsapp\.com|(www\.)?instagram\.com|(www\.)?facebook\.com|linktr\.ee)/i.test(n.web)) { sinWeb.push(Object.assign(n, { usaComoWeb: n.web })); hechos++; continue; }
      let v = await visitar(n.web);
      if (navegador && (v.ok || [403, 429, 503].includes(v.status) || /15 s/.test(v.error || ''))) { const r = await renderizar(v.urlFinal || (/^https?:/.test(n.web) ? n.web : 'https://' + n.web)); if (r && (r.ok || !v.ok)) v = Object.assign({}, r, { soloHttp: v.soloHttp }); }
      const { senales, info } = analizar(v);
      const r = Object.assign({}, n, { visita: { ok: v.ok, status: v.status, error: v.error, ms: v.ms }, info, senales });
      Object.assign(r, priorizar(r)); r.mensaje = mensaje(r); res.push(r);
      hechos++; process.stdout.write(`\r  ${hechos}/${conWeb.length}  ${(n.nombre || '').slice(0, 40).padEnd(40)}`);
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabajador));
  if (navegador) await navegador.close();
  sinWeb.forEach(n => {
    const ev = n.usaComoWeb ? 'No tiene web propia, su "web" es un link de ' + (/wa\.me|whatsapp/i.test(n.usaComoWeb) ? 'WhatsApp' : 'redes sociales') + '.' : 'No tiene web propia y depende de redes o de terceros.';
    const r = Object.assign({}, n, { visita: { ok: true, error: 'sin web' }, info: { sinWeb: true }, senales: [{ codigo: 'CON-03', evidencia: ev + ' No hay dónde comprar, reservar ni ver precios.' }, { codigo: 'CAP-01', evidencia: 'Sin web, Google y los buscadores con IA casi no tienen de dónde sacar información del negocio.' }] });
    Object.assign(r, priorizar(r)); r.mensaje = mensaje(r); res.push(r); });
  res.sort((a, b) => b.oportunidad - a.oportunidad);
  // Niveles relativos: siempre hay una lista corta para hoy. Mínimos para no escribir por nada.
  const evaluables = res.filter(n => !n.nivel);
  evaluables.forEach((n, k) => {
    const criticos = n.codigos.filter(c => c.g === 3).length, medios = n.codigos.filter(c => c.g === 2).length;
    const fuertes = n.codigos.filter(c => ['CAP-06', 'CON-07', 'CON-03', 'CON-06', 'DAT-05'].includes(c.id));
    const fuerte = fuertes.some(c => c.id === 'CAP-06') || fuertes.length >= 2 || (criticos >= 1 && fuertes.length >= 1);
    const q = k / Math.max(evaluables.length, 1);
    n.nivel = n.info.revisar && !n.codigos.length ? 'Revisar a mano' : q < .15 && fuerte ? 'Escribir hoy' : q < .40 && (fuerte || medios >= 1) ? 'Esta semana' : 'Nutrir';
  });
  const mercado = resumenMercado(res);
  const salida = { generado: new Date().toISOString(), fuente: path.basename(entrada), rubro: FILTRO_RUBRO || 'Todos', mercado, negocios: res,
    catalogo: { SISTEMAS: C.SISTEMAS, CODIGOS: C.CODIGOS, SOLUCIONES: C.SOLUCIONES, SENALES: C.SENALES } };
  const dir = path.join(__dirname, 'resultados'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, NOMBRE + '.json'), JSON.stringify(salida, null, 1));
  const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
  const csv = [['nivel', 'oportunidad', 'nombre', 'rubro', 'ciudad', 'web', 'plataforma', 'codigos', 'criticos', 'falla_principal', 'solucion_top1', 'solucion_top2', 'mensaje'].join(',')]
    .concat(res.map(n => [n.nivel, n.oportunidad, n.nombre, n.rubro, n.ciudad, n.web, n.info.plataforma || '', n.codigos.map(c => c.id).join(' '), n.codigos.filter(c => c.g === 3).length,
      n.codigos[0] ? n.codigos[0].id + ' ' + n.codigos[0].nombre : '', n.soluciones[0] ? n.soluciones[0].nombre : '', n.soluciones[1] ? n.soluciones[1].nombre : '', n.mensaje].map(q).join(',')));
  fs.writeFileSync(path.join(dir, NOMBRE + '.csv'), '﻿' + csv.join('\n'));
  const plantilla = fs.readFileSync(path.join(__dirname, 'tablero.html'), 'utf8');
  fs.writeFileSync(path.join(dir, NOMBRE + '.html'), plantilla.replace('/*__DATOS__*/null', JSON.stringify(salida).replace(/</g, '\\u003c')));
  console.log(`\n\nListo. ${mercado.cargaron} de ${mercado.escaneados} webs cargaron.`);
  mercado.niveles.forEach(x => console.log(`  ${x.nivel.padEnd(15)} ${x.n}`));
  console.log('\nFallas más comunes del mercado:');
  mercado.codigos.slice(0, 6).forEach(c => console.log(`  ${c.id}  ${String(c.pct).padStart(3)}%  ${c.nombre}`));
  console.log('\nSoluciones que más se repiten en el Top 3:');
  mercado.soluciones.slice(0, 4).forEach(s => console.log(`  ${s.id}  ${String(s.top3).padStart(3)} negocios  ${s.nombre}`));
  console.log(`\nTablero: resultados/${NOMBRE}.html`);
})();
