// Perfil del negocio: la introducción que Rubrofy necesita antes de crear
// cualquier cosa. Qué hace el negocio, dónde está, cómo vende, qué vende y
// dónde existe en internet (Instagram, Facebook, TikTok, web, WhatsApp).
// Entra en todos los pedidos a la IA (vía server/contexto-ia.js).
//
// "Leer mi web con IA": se descarga la página del negocio y Claude propone
// la descripción, los productos, el público y el diferenciador. Para no
// convertir el servidor en un proxy hacia redes internas, solo se aceptan
// URL https públicas: se resuelve el dominio y se rechazan IP privadas,
// de loopback o link-local, también en cada redirección.

const dns = require('dns').promises;
const net = require('net');
const claude = require('./claude');

const CANALES = {
  local: 'Local físico',
  online: 'Tienda online',
  domicilio: 'Despacho a domicilio',
  whatsapp: 'Pedidos por WhatsApp o DM',
  agenda: 'Reservas o agenda',
  eventos: 'Ferias o eventos',
};

const txt = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
function usuarioRed(v) {
  const s = txt(v, 200).replace(/^https?:\/\/(www\.)?(instagram|facebook|tiktok)\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
  return /^[A-Za-z0-9._-]{1,60}$/.test(s) ? s : '';
}
function urlWeb(v) {
  let s = txt(v, 300);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : '';
  } catch (err) {
    return '';
  }
}
const telefono = (v) => txt(v, 30).replace(/[^\d+ ]/g, '').trim();

// Solo se tocan los campos que vienen en el cuerpo.
function normalizar(body, actual) {
  const b = body || {};
  const a = actual || {};
  const tomar = (k, f) => (b[k] === undefined ? a[k] : f(b[k]));
  return {
    descripcion: tomar('descripcion', (v) => txt(v, 800)) || '',
    ciudad: tomar('ciudad', (v) => txt(v, 120)) || '',
    canales: tomar('canales', (v) => (Array.isArray(v) ? v.filter((c) => CANALES[c]) : [])) || [],
    productos: tomar('productos', (v) => txt(v, 800)) || '',
    // productos | servicios | ambos (el paso "Lo que ofreces" de la bienvenida)
    tipoOferta: tomar('tipoOferta', (v) => (['productos', 'servicios', 'ambos'].includes(v) ? v : '')) || '',
    instagram: tomar('instagram', usuarioRed) || '',
    facebook: tomar('facebook', usuarioRed) || '',
    tiktok: tomar('tiktok', usuarioRed) || '',
    web: tomar('web', urlWeb) || '',
    whatsapp: tomar('whatsapp', telefono) || '',
    actualizadoEl: new Date().toISOString(),
  };
}

function completo(negocio) {
  const p = negocio && negocio.perfil;
  return !!(p && p.descripcion && p.descripcion.length >= 10);
}

function textoParaPrompt(negocio) {
  const p = negocio && negocio.perfil;
  if (!p) return '';
  const l = [];
  if (p.descripcion) l.push(`Qué es: ${p.descripcion}`);
  if (p.ciudad) l.push(`Dónde está: ${p.ciudad}`);
  if (p.canales && p.canales.length) l.push(`Cómo vende: ${p.canales.map((c) => CANALES[c]).join(', ')}`);
  const OFERTA = { productos: 'Vende productos', servicios: 'Ofrece servicios (no productos): habla de lo que hace por sus clientes, no de stock ni despachos', ambos: 'Ofrece servicios y vende productos' };
  if (p.tipoOferta) l.push(OFERTA[p.tipoOferta]);
  if (p.productos) l.push(`${p.tipoOferta === 'servicios' ? 'Servicios' : p.tipoOferta === 'productos' ? 'Productos' : 'Productos o servicios'}: ${p.productos}`);
  const redes = [p.instagram && `Instagram @${p.instagram}`, p.facebook && `Facebook ${p.facebook}`, p.tiktok && `TikTok @${p.tiktok}`, p.web && `web ${p.web}`, p.whatsapp && `WhatsApp ${p.whatsapp}`].filter(Boolean);
  if (redes.length) l.push(`Dónde encontrarlo: ${redes.join(' · ')} (menciona solo estos canales, no inventes otros)`);
  return l.length ? 'Perfil del negocio:\n- ' + l.join('\n- ') : '';
}

// --- leer la web del negocio ---

function ipPrivada(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const s = ip.toLowerCase();
  if (s.startsWith('::ffff:')) return ipPrivada(s.slice(7));
  return s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb');
}

async function urlSegura(u) {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('La dirección debe empezar con https://');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Esa dirección no está permitida');
  if (process.env.RUBROFY_LEER_WEB_SIN_DNS === '1') return; // solo para pruebas automáticas
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const ips = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!ips.length) throw new Error('No encontramos ese sitio. Revisa la dirección.');
  if (ips.some((i) => ipPrivada(i.address))) throw new Error('Esa dirección no está permitida');
}

// Descarga una dirección pública (nunca de la red interna: se revisa en cada
// redirección). Devuelve { buffer, tipo, url }. Con `entero`, si pesa más de
// `max` falla en vez de cortarla (para imágenes, que cortadas no sirven).
async function descargarBytes(url, { acepta = 'text/html,application/xhtml+xml', max = 500000, tipos = /html|text/i, errorTipo = 'Esa dirección no es una página web', entero = false } = {}) {
  let actual = new URL(url);
  for (let saltos = 0; saltos < 4; saltos++) {
    await urlSegura(actual);
    const res = await fetch(actual.href, {
      redirect: 'manual', signal: AbortSignal.timeout(9000),
      headers: { 'user-agent': 'RubrofyBot/1.0 (+https://rubrofy.com)', accept: acepta },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      actual = new URL(res.headers.get('location'), actual);
      continue;
    }
    if (!res.ok) throw new Error(`El sitio respondió ${res.status}`);
    const tipo = res.headers.get('content-type') || '';
    if (tipo && !tipos.test(tipo)) throw new Error(errorTipo);
    const lector = res.body.getReader();
    const partes = [];
    let total = 0;
    while (total < max) {
      const { done, value } = await lector.read();
      if (done) break;
      partes.push(Buffer.from(value));
      total += value.length;
    }
    lector.cancel().catch(() => {});
    if (entero && total >= max) throw new Error('El archivo es demasiado grande');
    return { buffer: Buffer.concat(partes), tipo, url: actual.href };
  }
  throw new Error('Demasiadas redirecciones');
}

async function descargar(url) {
  return (await descargarBytes(url)).buffer.toString('utf8');
}

function textoDeHtml(html) {
  const meta = (n) => ((new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*content=["']([^"']*)`, 'i').exec(html) || [])[1] || '');
  const titulo = ((/<title[^>]*>([^<]*)/i.exec(html) || [])[1] || '').trim();
  const cuerpo = html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return [titulo && `Título: ${titulo}`, meta('description') && `Descripción: ${meta('description')}`, meta('og:description') && `Resumen: ${meta('og:description')}`, cuerpo.slice(0, 7000)]
    .filter(Boolean).join('\n');
}

async function leerWeb(negocio, url) {
  const limpia = urlWeb(url);
  if (!limpia) return { error: 'Escribe la dirección de tu sitio web' };
  let html;
  try {
    html = await descargar(limpia);
  } catch (err) {
    return { error: err.name === 'TimeoutError' ? 'Tu sitio tardó demasiado en responder' : err.message };
  }
  const texto = textoDeHtml(html);
  if (texto.length < 40) return { error: 'No encontramos texto en esa página' };
  const prompt = `Este es el texto del sitio web de un negocio llamado "${negocio.nombre}". Extrae SOLO lo que el texto dice, sin inventar.\n\n`
    + `"""${texto}"""\n\n`
    + 'Responde SOLO con un JSON: {"descripcion": "qué es el negocio en 1 o 2 frases", "productos": "productos o servicios principales, separados por coma", '
    + '"publico": "a quién le habla, si se deduce", "diferenciador": "qué lo hace distinto, si lo dice", "ciudad": "ciudad o zona si aparece", '
    + '"instagram": "usuario si aparece", "whatsapp": "número si aparece"}. Usa "" en lo que el texto no diga.';
  const r = claude.extraerJSON(await claude.pedir({ prompt, maxTokens: 700, negocioId: negocio.id, uso: 'perfil' }));
  if (!r) return { error: 'No pudimos leer tu sitio con IA. Completa los datos a mano.' };
  const limpiar = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  return {
    propuesta: {
      descripcion: limpiar(r.descripcion, 800), productos: limpiar(r.productos, 800), publico: limpiar(r.publico, 300),
      diferenciador: limpiar(r.diferenciador, 300), ciudad: limpiar(r.ciudad, 120), instagram: usuarioRed(r.instagram), whatsapp: telefono(r.whatsapp),
    },
    web: limpia,
  };
}

module.exports = { normalizar, completo, textoParaPrompt, leerWeb, CANALES, ipPrivada, urlWeb, descargarBytes };
