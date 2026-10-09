// "Descubre tu diseño con IA" (Tu marca → Cómo se ve): Claude mira las
// publicaciones importadas del Instagram del negocio ("Mi estilo") y su web
// (colores y tipografías del CSS, logo e imagen principal) y propone su
// diseño: paleta, tipografía, qué fotos le funcionan y cuáles no, y los pasos
// para llegar al diseño que el dueño dice que busca. Nada se cambia solo: el
// dueño revisa y pulsa "Aplicar a mi kit" (colores, tipografía, posición y,
// si quiere, el logo de su web). Aplicado, la guía visual también entra en
// las fotos con IA y en la "idea" de cada pieza.
//
// Se guarda en negocio.disenoIA. Las imágenes se mandan a Claude como
// bloques de imagen (visión); la web se lee con las mismas protecciones que
// "Leer mi web con IA" (perfil.descargarBytes).

const fs = require('fs');
const path = require('path');
const store = require('./store');
const claude = require('./claude');
const perfil = require('./perfil');
const marca = require('./marca');
const estilo = require('./estilo');

const MAX_IG = 9; // imágenes de Instagram que ve Claude
const MAX_IMAGEN = 3.5 * 1024 * 1024;
const MAX_TOTAL_IG = 14 * 1024 * 1024; // el pedido a Claude tiene un tope (las imágenes van en base64)
const MAX_CSS = 300000;
const ROLES = ['principal', 'apoyo', 'fondo', 'texto', 'acento'];
const ORIGENES = ['web', 'instagram', 'logo', 'ambos'];
const PLANTILLAS = ['titular', 'precio', 'frase'];
const MEDIA = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
// Hojas de estilo de librerías: sus colores no son de la marca.
const CSS_GENERICO = /bootstrap|font-?awesome|fonts\.googleapis|jquery|swiper|slick|animate(\.min)?\.css|normalize|tailwind|bulma|foundation|dashicons|elementor-icons|woocommerce-(layout|smallscreen)/i;
const FUENTES_GENERICAS = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|blinkmacsystemfont|inherit|initial|unset|ui-sans-serif|ui-serif|ui-monospace|segoe ui|helvetica neue|helvetica|arial|roboto|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|var\(.*|.*awesome.*|dashicons|icomoon|eicons|.*icons?)$/i;

const txt = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const hex6 = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : null);

// ---------- la web ----------

function hexDe(r, g, b) {
  return '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
}
function rgb(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
function neutro(hex) {
  const [r, g, b] = rgb(hex);
  return Math.max(r, g, b) - Math.min(r, g, b) < 24;
}

// Colores más usados en el CSS, juntando los casi iguales.
function coloresDeCss(css) {
  const cuenta = new Map();
  const sumar = (h) => cuenta.set(h, (cuenta.get(h) || 0) + 1);
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z_-])/gi)) {
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    sumar('#' + h.toLowerCase());
  }
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*([\d.]+%?))?/gi)) {
    if (m[4] !== undefined && parseFloat(m[4]) < (m[4].endsWith('%') ? 50 : 0.5)) continue; // casi transparente
    sumar(hexDe(+m[1], +m[2], +m[3]));
  }
  const grupos = [];
  for (const [h, n] of [...cuenta].sort((a, b) => b[1] - a[1])) {
    const c = rgb(h);
    const g = grupos.find((x) => { const d = rgb(x.hex); return Math.hypot(d[0] - c[0], d[1] - c[1], d[2] - c[2]) < 20; });
    if (g) g.veces += n; else grupos.push({ hex: h, veces: n });
  }
  const conColor = grupos.filter((g) => !neutro(g.hex)).slice(0, 8);
  const neutros = grupos.filter((g) => neutro(g.hex)).slice(0, 3);
  return conColor.concat(neutros).sort((a, b) => b.veces - a.veces);
}

function fuentesDe(html, css) {
  const cuenta = new Map();
  const sumar = (f, n = 1) => {
    const limpio = f.replace(/["']/g, '').trim();
    if (!limpio || limpio.length > 40 || FUENTES_GENERICAS.test(limpio)) return;
    cuenta.set(limpio, (cuenta.get(limpio) || 0) + n);
  };
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/gi)) {
    for (const fam of m[1].replace(/&amp;/g, '&').split('&').filter((x) => x.startsWith('family='))) {
      fam.slice(7).split('|').forEach((f) => sumar(decodeURIComponent(f.split(':')[0].replace(/\+/g, ' ')), 5));
    }
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) sumar(m[1].split(',')[0]);
  return [...cuenta].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => f);
}

function atributo(etiqueta, nombre) {
  const m = new RegExp(`\\s${nombre}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(etiqueta);
  return m ? (m[2] || m[3] || m[4] || '').replace(/&amp;/g, '&').trim() : '';
}

function absoluta(u, base) {
  try {
    const r = new URL(u, base);
    return /^https?:$/.test(r.protocol) ? r.href : null;
  } catch (err) {
    return null;
  }
}

// Logo e imagen principal de la página.
function imagenesDe(html, base) {
  let logo = null;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0];
    if (!/logo/i.test(atributo(t, 'src') + atributo(t, 'alt') + atributo(t, 'class') + atributo(t, 'id') + atributo(t, 'data-src'))) continue;
    const src = atributo(t, 'src') || atributo(t, 'data-src') || (atributo(t, 'srcset').split(/\s+/)[0] || '');
    if (src && !src.startsWith('data:')) { logo = absoluta(src, base); if (logo) break; }
  }
  let icono = null;
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/apple-touch-icon/i.test(atributo(m[0], 'rel'))) { icono = absoluta(atributo(m[0], 'href'), base); break; }
  }
  let portada = null;
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (/^(og:image|twitter:image)$/i.test(atributo(m[0], 'property') || atributo(m[0], 'name'))) { portada = absoluta(atributo(m[0], 'content'), base); if (portada) break; }
  }
  return { logo: logo || icono, logoEsSvg: /\.svg(\?|$)/i.test(logo || ''), portada };
}

async function bajarImagen(url) {
  if (!url || /\.svg(\?|$)/i.test(url)) return null;
  try {
    const r = await perfil.descargarBytes(url, { acepta: 'image/png,image/jpeg,image/webp,image/*', max: 2 * 1024 * 1024, tipos: /^image\//i, errorTipo: 'No es una imagen', entero: true });
    const tipo = marca.tipoImagen(r.buffer);
    return tipo ? { buffer: r.buffer, tipo } : null;
  } catch (err) {
    return null;
  }
}

// Lo que se puede saber del diseño de la web. Nunca lanza: { error } si no se pudo.
async function leerWebDiseno(url) {
  const limpia = perfil.urlWeb(url);
  if (!limpia) return { error: 'La dirección de tu web no es válida' };
  let html;
  let base = limpia;
  try {
    const r = await perfil.descargarBytes(limpia);
    html = r.buffer.toString('utf8');
    base = r.url;
  } catch (err) {
    return { error: err.name === 'TimeoutError' ? 'Tu web tardó demasiado en responder' : err.message };
  }
  const estilosEnLinea = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')
    + '\n' + [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(';');
  const hojas = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0])
    .filter((t) => /stylesheet/i.test(atributo(t, 'rel')))
    .map((t) => absoluta(atributo(t, 'href'), base))
    .filter((u) => u && !CSS_GENERICO.test(u))
    .slice(0, 4);
  const css = await Promise.all(hojas.map((u) => perfil.descargarBytes(u, { acepta: 'text/css,*/*;q=0.1', max: MAX_CSS, tipos: /css|text|octet/i, errorTipo: 'No es CSS' })
    .then((r) => r.buffer.toString('utf8')).catch(() => '')));
  const todoCss = estilosEnLinea + '\n' + css.join('\n');
  const themeColor = (() => {
    for (const m of html.matchAll(/<meta\b[^>]*>/gi)) if (/^theme-color$/i.test(atributo(m[0], 'name'))) return hex6(atributo(m[0], 'content'));
    return null;
  })();
  const img = imagenesDe(html, base);
  const [logo, portada] = await Promise.all([bajarImagen(img.logo), bajarImagen(img.portada)]);
  return {
    url: limpia,
    titulo: txt(((/<title[^>]*>([^<]*)/i.exec(html) || [])[1] || ''), 120),
    colores: coloresDeCss(todoCss),
    themeColor,
    fuentes: fuentesDe(html, todoCss),
    logo, logoEsSvg: img.logoEsSvg && !logo, portada,
  };
}

// ---------- Instagram ----------

// Publicaciones importadas con imagen, con su interacción si Rubrofy la midió.
function imagenesInstagram(negocioId) {
  const refs = estilo.listar(negocioId).filter((r) => r.imagen);
  const metricas = new Map(store.db.prepare('SELECT media_id, interacciones, me_gusta, comentarios, guardados, compartidos FROM ig_posts WHERE negocio_id = ?').all(negocioId)
    .map((m) => [m.media_id, m.interacciones != null ? m.interacciones : (m.me_gusta || 0) + (m.comentarios || 0) + (m.guardados || 0) + (m.compartidos || 0)]));
  const conDatos = refs.map((r) => {
    let buf = null;
    try {
      const archivo = estilo.imagenAbsoluta(negocioId, r.imagen);
      if (fs.statSync(archivo).size <= MAX_IMAGEN) buf = fs.readFileSync(archivo);
    } catch (err) { /* imagen perdida */ }
    const tipo = buf && marca.tipoImagen(buf);
    return tipo ? { ref: r, buffer: buf, tipo, interaccion: r.media_id && metricas.has(r.media_id) ? metricas.get(r.media_id) : null } : null;
  }).filter(Boolean);
  const instagram = conDatos.filter((x) => x.ref.origen === 'instagram');
  const base = instagram.length >= 3 ? instagram : conDatos;
  const medidas = base.filter((x) => x.interaccion != null).sort((a, b) => b.interaccion - a.interaccion);
  let elegidas;
  if (medidas.length >= 4) {
    // Las que mejor y peor funcionaron, y las más recientes.
    const extremos = medidas.slice(0, 4).concat(medidas.slice(-2));
    elegidas = extremos.concat(base.filter((x) => !extremos.includes(x))).slice(0, MAX_IG);
    const orden = medidas.map((x) => x.interaccion);
    const alto = orden[Math.floor(orden.length / 3)];
    const bajo = orden[Math.floor((orden.length * 2) / 3)];
    elegidas.forEach((x) => { if (x.interaccion != null) x.nivel = x.interaccion >= alto ? 'alta' : x.interaccion <= bajo ? 'baja' : 'media'; });
  } else {
    elegidas = base.slice(0, MAX_IG);
  }
  let total = 0;
  return elegidas.filter((x) => { total += x.buffer.length; return total <= MAX_TOTAL_IG; });
}

// ---------- análisis ----------

function prompt(negocio, web, ig, deseo, webError) {
  const k = marca.normalizar({}, negocio.marca);
  const e = negocio.estrategia || {};
  const partes = [
    `Eres director de arte de marcas pequeñas. Analiza cómo se ve hoy "${negocio.nombre}" (rubro: ${e.rubro || 'sin especificar'}) en su Instagram y en su web, y propón el diseño de su marca para Instagram.`,
    deseo ? `El dueño quiere que su marca se vea así: "${deseo}". Propón cómo llegar ahí desde lo que ves, sin perder lo que ya le funciona.`
      : 'El dueño no dijo cómo quiere verse: propón cómo hacer que su marca se vea más profesional y coherente, sin perder lo que ya le funciona.',
    ig.length ? `Viste ${ig.length} imágenes de su Instagram (numeradas "Instagram N"${ig.some((x) => x.nivel) ? '; cada una dice si tuvo interacción alta, media o baja' : ''}).` : 'No hay imágenes de su Instagram.',
  ];
  if (web) {
    partes.push(`Su web (${web.url}${web.titulo ? `, "${web.titulo}"` : ''}):`
      + (web.colores.length ? ` colores más usados en su CSS (hex y veces): ${web.colores.map((c) => `${c.hex} ×${c.veces}`).join(', ')}.` : ' no se encontraron colores en su CSS.')
      + (web.themeColor ? ` theme-color: ${web.themeColor}.` : '')
      + (web.fuentes.length ? ` Tipografías: ${web.fuentes.join(', ')}.` : '')
      + (web.logo ? ' Viste su logo ("Web: logo").' : web.logoEsSvg ? ' Su logo es SVG (no lo ves).' : '')
      + (web.portada ? ' Viste su imagen principal ("Web: imagen principal").' : ''));
  } else if (webError) {
    partes.push(`No se pudo leer su web (${webError}).`);
  }
  partes.push(`Su kit actual en Rubrofy: color principal ${k.color}, color de apoyo ${k.color2}, tipografía ${k.fuente}, ${k.logo ? 'con logo' : 'sin logo'}.`);
  const pf = perfil.textoParaPrompt(negocio);
  if (pf) partes.push(pf);
  partes.push(
    'Tipografías disponibles para sus diseños: "Plus Jakarta Sans" (moderna, sin serifa), "Oswald" (condensada, de impacto), "Playfair Display" (elegante, con serifa), "Caveat" (manuscrita). Elige la más cercana a su estilo.',
    'Responde SOLO con un JSON, sin texto fuera, con esta forma:',
    '{"resumen": "cómo se ve hoy y hacia dónde ir, en 1 o 2 frases", '
    + '"paleta": [{"hex": "#RRGGBB", "nombre": "nombre corto en español", "rol": "principal|apoyo|fondo|texto|acento", "origen": "web|instagram|logo|ambos"}], '
    + '"aviso": "", "letra": {"fuente": "una de las 4", "porque": "..."}, '
    + '"fotos": {"funciona": ["..."], "evitar": ["..."], "ejemplos": [{"imagen": 1, "etiqueta": "Luz natural", "bien": true}]}, '
    + '"pasos": ["..."], "posLogo": "si|sd|ii|id", "plantilla": "titular|precio|frase", "guiaImagen": "..."}',
    'Reglas: "paleta" de 3 a 5 colores que de verdad aparezcan (no inventes), con exactamente un "principal" y un "apoyo". '
    + '"aviso": una incoherencia entre su web y su Instagram en una frase, o "" si no hay. '
    + '"funciona" y "evitar": máximo 3 cada uno, concretos (luz, fondos, encuadre, personas, texto sobre la foto); si hay interacción, apóyate en ella. '
    + '"ejemplos": 3 a 6 imágenes de Instagram por su número, con una etiqueta de 1 a 3 palabras y si es un buen ejemplo ("bien": true) o algo a evitar (false). '
    + '"pasos": 3 a 5 pasos concretos para llegar al diseño que busca. '
    + '"posLogo": dónde va mejor su logo (si = arriba izquierda, sd = arriba derecha, ii = abajo izquierda, id = abajo derecha). '
    + '"guiaImagen": instrucciones visuales para un generador de fotos, máximo 450 caracteres: luz, fondos, encuadre, colores, ambiente y qué evitar. '
    + 'Todo en español de Chile, tuteando, sin tecnicismos.',
  );
  return partes.join('\n');
}

function normalizarResultado(r, ig) {
  if (!r || typeof r !== 'object') return null;
  const vistos = new Set();
  let paleta = (Array.isArray(r.paleta) ? r.paleta : []).map((c) => ({
    hex: hex6(c && c.hex), nombre: txt(c && c.nombre, 30) || 'Color', rol: ROLES.includes(c && c.rol) ? c.rol : 'acento', origen: ORIGENES.includes(c && c.origen) ? c.origen : 'instagram',
  })).filter((c) => c.hex && !vistos.has(c.hex) && vistos.add(c.hex)).slice(0, 5);
  if (paleta.length < 2) return null;
  // Exactamente un principal y un apoyo.
  ['principal', 'apoyo'].forEach((rol) => {
    const con = paleta.filter((c) => c.rol === rol);
    con.slice(1).forEach((c) => { c.rol = 'acento'; });
    if (!con.length) { const libre = paleta.find((c) => c.rol !== 'principal' && c.rol !== 'apoyo'); if (libre) libre.rol = rol; }
  });
  paleta = paleta.sort((a, b) => ROLES.indexOf(a.rol) - ROLES.indexOf(b.rol));
  const lista = (v, n, max) => (Array.isArray(v) ? v : []).map((x) => txt(x, max)).filter(Boolean).slice(0, n);
  const fotos = r.fotos || {};
  const ejemplos = (Array.isArray(fotos.ejemplos) ? fotos.ejemplos : []).map((x) => {
    const i = Number(x && x.imagen) - 1;
    const img = ig[i];
    return img ? { ref: img.ref.id, imagen: img.ref.imagen, etiqueta: txt(x.etiqueta, 24) || (x.bien ? 'Funciona' : 'Evitar'), bien: x.bien !== false } : null;
  }).filter((x, i, a) => x && a.findIndex((y) => y && y.ref === x.ref) === i).slice(0, 6);
  const letra = r.letra || {};
  return {
    resumen: txt(r.resumen, 300),
    paleta,
    aviso: txt(r.aviso, 240),
    letra: { fuente: marca.FUENTES.includes(letra.fuente) ? letra.fuente : 'Plus Jakarta Sans', porque: txt(letra.porque, 200) },
    fotos: { funciona: lista(fotos.funciona, 3, 160), evitar: lista(fotos.evitar, 3, 160), ejemplos },
    pasos: lista(r.pasos, 5, 180),
    posLogo: marca.POSICIONES.includes(r.posLogo) ? r.posLogo : 'id',
    plantilla: PLANTILLAS.includes(r.plantilla) ? r.plantilla : 'titular',
    guiaImagen: txt(r.guiaImagen, 500),
  };
}

// Devuelve { diseno } o { error }. Importa del Instagram si hace falta.
async function analizar(negocio, deseoTexto) {
  const deseo = txt(deseoTexto, 200);
  if (negocio.instagram && negocio.instagram.accessToken && estilo.listar(negocio.id).filter((r) => r.origen === 'instagram').length < 6) {
    await estilo.importarDeInstagram(negocio).catch(() => {});
  }
  const ig = imagenesInstagram(negocio.id);
  const urlWeb = negocio.perfil && negocio.perfil.web;
  let web = null;
  let webError = '';
  if (urlWeb) {
    const r = await leerWebDiseno(urlWeb);
    if (r.error) webError = r.error; else web = r;
  }
  const webUtil = web && (web.colores.length || web.fuentes.length || web.logo || web.portada);
  if (ig.length < 2 && !webUtil) {
    return { error: webError ? `No pudimos leer tu web (${webError}) y faltan publicaciones de Instagram. Conecta tu Instagram o importa tus publicaciones en "Tus ejemplos".`
      : 'Para analizar tu diseño necesitamos tu Instagram conectado (con publicaciones) o tu web en Conexiones y ajustes → Tu negocio.' };
  }

  const contenido = [];
  ig.forEach((x, i) => {
    contenido.push({ type: 'text', text: `Instagram ${i + 1}: ${estilo.ETIQUETAS[x.ref.formato] || 'Post'}${x.nivel ? ` — interacción ${x.nivel}` : ''}` });
    contenido.push({ type: 'image', source: { type: 'base64', media_type: MEDIA[x.tipo], data: x.buffer.toString('base64') } });
  });
  if (web && web.logo) {
    contenido.push({ type: 'text', text: 'Web: logo' });
    contenido.push({ type: 'image', source: { type: 'base64', media_type: MEDIA[web.logo.tipo], data: web.logo.buffer.toString('base64') } });
  }
  if (web && web.portada) {
    contenido.push({ type: 'text', text: 'Web: imagen principal' });
    contenido.push({ type: 'image', source: { type: 'base64', media_type: MEDIA[web.portada.tipo], data: web.portada.buffer.toString('base64') } });
  }
  contenido.push({ type: 'text', text: prompt(negocio, web, ig, deseo, webError) });

  const r = await claude.llamar({ maxTokens: 2000, content: contenido, negocioId: negocio.id, uso: 'diseno' });
  if (r.error === 'rechazo') return { error: 'No se pudo analizar tu diseño con estas imágenes' };
  if (r.error) return { error: 'No se pudo analizar tu diseño en este momento. Intenta de nuevo en unos minutos.' };
  const resultado = normalizarResultado(claude.extraerJSON(r.texto, 'objeto'), ig);
  if (!resultado) return { error: 'La IA no devolvió un diseño válido; intenta de nuevo' };

  // El logo de la web queda guardado aparte hasta que el dueño decida usarlo.
  const anterior = negocio.disenoIA && negocio.disenoIA.logoWeb;
  let logoWeb = null;
  if (web && web.logo) {
    const g = marca.guardarImagen(negocio.id, 'logo-web', web.logo.buffer, anterior);
    if (!g.error) logoWeb = g.archivo;
  } else if (anterior) {
    marca.borrar(negocio.id, anterior);
  }
  return {
    diseno: Object.assign(resultado, {
      logoWeb, deseo,
      basadoEn: { instagram: ig.length, web: web ? web.url : null, webError: webError || null, coloresWeb: web ? web.colores.slice(0, 6).map((c) => c.hex) : [], fuentesWeb: web ? web.fuentes : [] },
      generadoEl: new Date().toISOString(),
      aplicadoEl: null,
    }),
  };
}

// "Aplicar a mi kit": colores, tipografía y posición del logo (lo que el dueño
// dejó en la pantalla) y, si quiere, el logo de su web. Desde ahí, la guía
// visual entra en las fotos con IA. Devuelve { marca, disenoIA } o { error }.
function aplicar(negocio, body) {
  const d = negocio.disenoIA;
  if (!d) return { error: 'Primero analiza tu diseño' };
  const b = body || {};
  const kit = marca.normalizar({ color: b.color, color2: b.color2, fuente: b.fuente, posLogo: b.posLogo }, negocio.marca);
  let logo = (negocio.marca || {}).logo;
  if (b.usarLogoWeb && d.logoWeb) {
    let buf = null;
    try { buf = fs.readFileSync(marca.ruta(negocio.id, d.logoWeb)); } catch (err) { /* ya no está */ }
    if (buf) {
      const g = marca.guardarImagen(negocio.id, 'logo', buf, logo);
      if (g.error) return g;
      logo = g.archivo;
    }
  }
  if (logo) kit.logo = logo; else delete kit.logo;
  const disenoIA = Object.assign({}, d, { aplicadoEl: new Date().toISOString(), usarEnImagenes: b.usarEnImagenes !== false });
  return { marca: kit, disenoIA };
}

// Guía visual para las fotos con IA y para la "idea" de cada pieza (solo si
// el dueño la aplicó y no la desactivó).
function guiaVisual(negocio) {
  const d = negocio && negocio.disenoIA;
  if (!d || !d.aplicadoEl || d.usarEnImagenes === false || !d.guiaImagen) return '';
  const colores = (d.paleta || []).filter((c) => c.rol === 'principal' || c.rol === 'apoyo' || c.rol === 'fondo').map((c) => c.nombre.toLowerCase());
  return d.guiaImagen + (colores.length ? ` Colores de la marca: ${colores.join(', ')}.` : '');
}

module.exports = { analizar, aplicar, guiaVisual, leerWebDiseno, coloresDeCss, fuentesDe, imagenesDe, normalizarResultado };
