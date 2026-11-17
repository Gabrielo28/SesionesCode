/*
 * Impulz Gym El Quisco — página de reservas y panel de comisiones.
 * Railway lo levanta con `node server.js` (ver railway.json). En tu PC: `npm start`.
 *
 *   /              sitio oficial del gimnasio (dominio propio, ej. impulzgym.cl)
 *   /reserva       página corta de reservas para anuncios (mismo dominio del gimnasio)
 *   /panel         panel de comisiones (usuario y clave: ver lib/sesiones.js)
 *   /api/...       API del panel y de las reservas
 *
 * Sin dependencias externas. Los datos viven en DATA_DIR (ver lib/datos.js).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const datos = require('./lib/datos');
const ses = require('./lib/sesiones');
const R = require('./public/reglas.js');

const PUERTO = process.env.PORT || 5190;
const PUBLICO = path.join(__dirname, 'public');
const PIXEL = (process.env.META_PIXEL_ID || '').replace(/\D/g, '');
// Si se define PANEL_HOST (ej. impulz.entrenachile.cl), el panel y su API solo responden en ese dominio,
// y el sitio del gimnasio solo en los demás. Sin PANEL_HOST todo responde en cualquier dominio (uso local).
const PANEL_HOST = (process.env.PANEL_HOST || '').trim().toLowerCase();
const hostDe = req => String(req.headers['x-forwarded-host'] || req.headers.host || '').split(':')[0].toLowerCase();

/* ---------- utilidades ---------- */
const hoy = () => { const d = new Date(Date.now() - 3 * 3600 * 1000); return d.toISOString().slice(0, 10); }; // hora de Chile aprox. (UTC-3)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const texto = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const soloDigitos = v => String(v || '').replace(/\D/g, '');
// Si la reserva viene reenviada por un sitio de confianza (entrenachile.cl) con la clave ORIGEN_CLAVE,
// se usa la IP del visitante que ese sitio informa; si no, la de la conexión.
const ORIGEN_CLAVE = process.env.ORIGEN_CLAVE || '';
const ipDe = req => {
  if (ORIGEN_CLAVE && req.headers['x-origen-clave'] === ORIGEN_CLAVE && req.headers['x-cliente-ip']) return String(req.headers['x-cliente-ip']).slice(0, 60);
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
};

function json(res, estado, cuerpo, extra = {}) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(cuerpo));
}
const error = (res, estado, mensaje) => json(res, estado, { error: mensaje });

function leerCuerpo(req) {
  return new Promise((ok, mal) => {
    let t = '';
    req.on('data', c => { t += c; if (t.length > 50000) { mal(new Error('grande')); req.destroy(); } });
    req.on('end', () => { try { ok(t ? JSON.parse(t) : {}); } catch (e) { mal(new Error('json')); } });
    req.on('error', mal);
  });
}

// Límite simple de intentos por IP (reservas y logins), en memoria.
const intentos = new Map();
function permitido(clave, max, ventanaMs) {
  const ahora = Date.now();
  const lista = (intentos.get(clave) || []).filter(t => ahora - t < ventanaMs);
  if (lista.length >= max) { intentos.set(clave, lista); return false; }
  lista.push(ahora); intentos.set(clave, lista); return true;
}
setInterval(() => { const a = Date.now(); for (const [k, v] of intentos) if (!v.some(t => a - t < 3600e3)) intentos.delete(k); }, 600e3).unref();

/* ---------- páginas ---------- */
function pagina(res, archivo, reemplazos = {}) {
  let html = fs.readFileSync(path.join(PUBLICO, archivo), 'utf8');
  for (const [k, v] of Object.entries(reemplazos)) html = html.split('{{' + k + '}}').join(v);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(html);
}

function pixelHead() {
  if (!PIXEL) return '';
  return `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');</script>`;
}


/* ---------- sitio público ---------- */
const origen = req => ((req.headers['x-forwarded-proto'] || 'http').split(',')[0]) + '://' + (req.headers['x-forwarded-host'] || req.headers.host || 'localhost');
// SEO: códigos de verificación de buscadores (Search Console y Bing) y una sola dirección oficial (sin www).
const GOOGLE_VERIFICACION = (process.env.GOOGLE_VERIFICACION || '').trim();
const INDEXNOW_KEY = /^[a-zA-Z0-9-]{8,128}$/.test(process.env.INDEXNOW_KEY || '') ? process.env.INDEXNOW_KEY : '';
const BING_VERIFICACION = (process.env.BING_VERIFICACION || '').trim();
const verificacionHead = () =>
  (GOOGLE_VERIFICACION ? '<meta name="google-site-verification" content="' + esc(GOOGLE_VERIFICACION) + '">' : '') +
  (BING_VERIFICACION ? '<meta name="msvalidate.01" content="' + esc(BING_VERIFICACION) + '">' : '');
const PLANES = [
  ['Plan Básico', 30000, 'Mensual. Full acceso, sin restricciones.'],
  ['Plan Clase', 42000, 'Mensual. Un profesional acompaña los entrenamientos.'],
  ['Plan Estudiante', 25000, 'Mensual. Con credencial o comprobante de estudios vigente.'],
  ['Plan Full trimestral', 84000, '3 meses continuos. Congelamiento de 7 días.'],
  ['Plan Full semestral', 170000, '6 meses continuos. Congelamiento de 14 días.'],
  ['Plan Full anual', 300000, '12 meses continuos. Congelamiento de 30 días.']
];
// GEO: resumen en texto plano para buscadores con IA (ChatGPT, Gemini, Perplexity, Claude). Ver llmstxt.org.
function llmsTxt(cfg, o) {
  const l = ['# Impulz Gym El Quisco', '',
    '> Gimnasio en El Quisco, litoral central de la Región de Valparaíso, Chile. Sala de máquinas, peso libre, cardio y entrenamiento personalizado. Clase de prueba con reserva en línea.', '',
    '## Datos', '',
    '- Nombre: Impulz Gym El Quisco (antes World Fit)',
    '- Ciudad: El Quisco, Región de Valparaíso, Chile' + (cfg.direccion ? ' · Dirección: ' + cfg.direccion : ''),
    '- Atiende también a: Algarrobo, El Tabo, Isla Negra y Punta de Tralca',
    '- Horario: lunes a viernes de 5:00 a 22:00; sábado de 8:00 a 14:00; domingo cerrado',
    ...(cfg.whatsapp ? ['- WhatsApp: +' + cfg.whatsapp] : []),
    '- Instagram: https://www.instagram.com/' + (cfg.instagram || 'impulzgym.elquisco'),
    '- Reserva de clase de prueba: ' + o + '/#reserva', '',
    '## Planes (pesos chilenos)', '',
    ...PLANES.map(([n, p, d]) => '- ' + n + ': $' + p.toLocaleString('es-CL') + (n.includes('Full') ? '' : ' al mes') + '. ' + d), '',
    '## Preguntas frecuentes', '',
    ...preguntas().flatMap(q => ['### ' + q.name, q.acceptedAnswer.text, '']),
    '## Páginas', '', '- [Sitio oficial](' + o + '/)', '- [Impulz en EntrenaCL](https://entrenachile.cl/gimnasios/impulz)'];
  return l.join('\n') + '\n';
}
const sinEtiquetas = t => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// Las preguntas frecuentes se leen del propio sitio para que los datos estructurados nunca digan otra cosa.
function preguntas() {
  const html = fs.readFileSync(path.join(PUBLICO, 'sitio.html'), 'utf8');
  return [...html.matchAll(/<details><summary>(.*?)<\/summary><p>(.*?)<\/p><\/details>/g)].map(m => ({ '@type': 'Question', name: sinEtiquetas(m[1]), acceptedAnswer: { '@type': 'Answer', text: sinEtiquetas(m[2]) } }));
}
const SITIO_CLAVES = ['whatsapp', 'beneficio', 'promo', 'direccion', 'mapsUrl', 'instagram', 'precioMensual', 'precioPareja', 'precioMatricula', 'coachNombre', 'coachPerfil', 'resenasUrl', 'pruebaGratis'];
// Solo sale al público lo que es del sitio. Nunca los porcentajes del acuerdo.
const sitioPublico = cfg => JSON.stringify(Object.fromEntries(SITIO_CLAVES.map(k => [k, cfg[k] ?? '']))).replace(/</g, '\\u003c');
function jsonLd(cfg, req) {
  const o = origen(req);
  const d = {
    '@context': 'https://schema.org', '@type': 'ExerciseGym', '@id': o + '/#gimnasio', name: 'Impulz Gym El Quisco', url: o + '/',
    image: [o + '/fotos/ia-fachada.jpg', o + '/fotos/ia-sala.jpg', o + '/fotos/ia-peso-libre.jpg'], logo: o + '/favicon.svg',
    priceRange: '$25.000 - $42.000 al mes', currenciesAccepted: 'CLP',
    makesOffer: PLANES.map(([name, price, description]) => ({ '@type': 'Offer', name, description, price, priceCurrency: 'CLP' })),
    description: 'Gimnasio y entrenamiento personalizado en El Quisco, litoral central.',
    address: { '@type': 'PostalAddress', ...(cfg.direccion ? { streetAddress: cfg.direccion } : {}), addressLocality: 'El Quisco', addressRegion: 'Valparaíso', addressCountry: 'CL' },
    areaServed: ['El Quisco', 'Algarrobo', 'El Tabo', 'Isla Negra'],
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '05:00', closes: '22:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '08:00', closes: '14:00' }
    ],
    ...(cfg.whatsapp ? { telephone: '+' + cfg.whatsapp } : {}),
    ...(cfg.instagram ? { sameAs: ['https://www.instagram.com/' + cfg.instagram] } : {}),
    ...(cfg.mapsUrl ? { hasMap: cfg.mapsUrl } : {})
  };
  const sitio = { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Impulz Gym El Quisco', url: o + '/', inLanguage: 'es-CL' };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: preguntas() };
  return [d, sitio, faq].map(x => '<script type="application/ld+json">' + JSON.stringify(x).replace(/</g, '\\u003c') + '</script>').join('\n');
}

/* ---------- API pública: reservas ---------- */
async function reservar(req, res) {
  if (!permitido('r:' + ipDe(req), 8, 3600e3)) return error(res, 429, 'Demasiadas reservas desde esta conexión. Intenta más tarde o escríbenos por WhatsApp.');
  let b; try { b = await leerCuerpo(req); } catch (e) { return error(res, 400, 'Datos inválidos'); }
  if (b.web) return json(res, 200, { codigo: 'IMP-0000' }); // campo trampa para bots
  const nombre = texto(b.nombre, 80), telefono = soloDigitos(b.telefono);
  if (nombre.length < 2) return error(res, 400, 'Escribe tu nombre.');
  if (telefono.length < 8 || telefono.length > 15) return error(res, 400, 'Revisa tu número de teléfono (ej: 9 1234 5678).');
  if (!b.acepta) return error(res, 400, 'Necesitamos tu autorización para contactarte por WhatsApp.');
  const cfg = datos.config();
  const fin = telefono.slice(-8);

  // Si el mismo teléfono ya reservó en los últimos 60 días, se devuelve su código (no se duplica).
  const limite = Date.now() - 60 * 864e5;
  let l = datos.listaLeads().find(x => soloDigitos(x.telefono).slice(-8) === fin && Date.parse(x.creadoEn) > limite);
  if (l) {
    datos.registrar({ usuario: 'web', rol: 'publico', accion: 'reserva repetida', leadId: l.id, codigo: l.codigo });
  } else {
    l = datos.guardarLead({
      id: datos.nuevoId(), codigo: datos.nuevoCodigo(), origen: 'reserva',
      nombre, telefono: '+' + (telefono.length === 9 ? '56' + telefono : telefono),
      canal: R.canalDesdeParametro(b.c), campana: texto(b.utm_campaign, 80), anuncio: texto(b.utm_content, 80),
      fuente: texto(b.utm_source, 40), objetivo: texto(b.objetivo, 60), horario: texto(b.horario, 40),
      etapa: 'Contacto', plan: '', monto: +cfg.mensualidad, fechaContacto: hoy(), fechaInscripcion: '', pagos: [], notas: '',
      creadoEn: new Date().toISOString(), creadoPor: 'web'
    });
    datos.registrar({ usuario: 'web', rol: 'publico', accion: 'reserva', leadId: l.id, codigo: l.codigo, detalle: R.canal(l.canal).nombre + (l.campana ? ' · ' + l.campana : '') });
  }
  const numero = soloDigitos(cfg.whatsapp);
  const mensaje = `Hola, quiero reservar mi clase de prueba en Impulz Gym. Soy ${l.nombre} y mi código es ${l.codigo}.`;
  json(res, 200, { codigo: l.codigo, beneficio: cfg.beneficio, whatsapp: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : '' });
}

/* ---------- API del panel ---------- */
const CAMPOS_DUENO = ['nombre', 'telefono', 'etapa', 'plan', 'monto', 'fechaInscripcion', 'pagos', 'notas'];
const CAMPOS_ADMIN = [...CAMPOS_DUENO, 'canal', 'fechaContacto', 'campana', 'anuncio'];

function limpiarCampos(b) {
  const o = {};
  if ('nombre' in b) o.nombre = texto(b.nombre, 80);
  if ('telefono' in b) o.telefono = texto(b.telefono, 30);
  if ('canal' in b) o.canal = R.canal(b.canal).id;
  if ('etapa' in b) o.etapa = R.ETAPAS.includes(b.etapa) ? b.etapa : 'Contacto';
  if ('plan' in b) o.plan = texto(b.plan, 60);
  if ('monto' in b) o.monto = Math.max(0, Math.round(+b.monto || 0));
  if ('fechaContacto' in b) o.fechaContacto = /^\d{4}-\d{2}-\d{2}$/.test(b.fechaContacto) ? b.fechaContacto : hoy();
  if ('fechaInscripcion' in b) o.fechaInscripcion = /^\d{4}-\d{2}-\d{2}$/.test(b.fechaInscripcion) ? b.fechaInscripcion : '';
  if ('notas' in b) o.notas = texto(b.notas, 500);
  if ('campana' in b) o.campana = texto(b.campana, 80);
  if ('anuncio' in b) o.anuncio = texto(b.anuncio, 80);
  if ('pagos' in b) {
    const vistos = new Set();
    o.pagos = (Array.isArray(b.pagos) ? b.pagos : []).filter(p => p && /^\d{4}-\d{2}$/.test(p.mes) && !vistos.has(p.mes) && vistos.add(p.mes))
      .slice(0, 60).map(p => ({ mes: p.mes, monto: Math.max(0, Math.round(+p.monto || 0)) }));
  }
  return o;
}

function resumenCambios(antes, despues) {
  const partes = [];
  for (const k of ['nombre', 'telefono', 'canal', 'etapa', 'plan', 'monto', 'fechaContacto', 'fechaInscripcion', 'notas']) {
    if (k in despues && String(antes[k] ?? '') !== String(despues[k] ?? '')) partes.push(k === 'canal' ? `canal: ${R.canal(antes.canal).nombre} → ${R.canal(despues.canal).nombre}` : `${k}: ${antes[k] || '—'} → ${despues[k] || '—'}`);
  }
  if ('pagos' in despues) {
    const a = (antes.pagos || []).map(p => p.mes).join(','), d = (despues.pagos || []).map(p => p.mes).join(',');
    if (a !== d) partes.push(`pagos: ${a || '—'} → ${d || '—'}`);
  }
  return partes.join(' · ');
}

function csv(lista, cfg) {
  const fila = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const enc = ['codigo', 'nombre', 'telefono', 'canal', 'atribucion', 'campana', 'etapa', 'plan', 'monto', 'fecha_contacto', 'fecha_inscripcion', 'pagos', 'comision_total'];
  const filas = lista.map(l => {
    const det = R.detallePagos(l, cfg);
    return [l.codigo, l.nombre, l.telefono, R.canal(l.canal).nombre, R.esGestion(l) ? 'Gestión redes' : 'Gimnasio', l.campana, l.etapa, l.plan, l.monto, l.fechaContacto, l.fechaInscripcion,
      det.map(p => `${p.mes} ${p.monto}`).join(' | '), det.reduce((s, p) => s + p.valor, 0)].map(fila).join(',');
  });
  return '﻿' + enc.join(',') + '\n' + filas.join('\n');
}

async function api(req, res, ruta, metodo) {
  if (ruta === '/api/reservas' && metodo === 'POST') return reservar(req, res);

  if (ruta === '/api/login' && metodo === 'POST') {
    if (!ses.usuarios().length) return error(res, 503, 'El panel aún no tiene usuarios. Configura ADMIN_USUARIO y ADMIN_CLAVE en Railway.');
    if (!permitido('l:' + ipDe(req), 10, 900e3)) return error(res, 429, 'Demasiados intentos. Espera 15 minutos.');
    let b; try { b = await leerCuerpo(req); } catch (e) { return error(res, 400, 'Datos inválidos'); }
    const s = ses.verificarClave(b.usuario, b.clave);
    if (!s) return error(res, 401, 'Usuario o clave incorrectos.');
    datos.registrar({ usuario: s.usuario, rol: s.rol, accion: 'ingreso al panel' });
    return json(res, 200, s, { 'Set-Cookie': ses.crearCookie(s, req) });
  }
  if (ruta === '/api/logout' && metodo === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': ses.borrarCookie() });

  const s = ses.leerSesion(req);
  if (!s) return error(res, 401, 'Inicia sesión para continuar.');
  const admin = s.rol === 'admin';
  const quien = { usuario: s.usuario, rol: s.rol };

  if (ruta === '/api/yo') return json(res, 200, s);
  if (ruta === '/api/leads' && metodo === 'GET') return json(res, 200, datos.listaLeads());
  if (ruta === '/api/config' && metodo === 'GET') return json(res, 200, datos.config());
  if (ruta === '/api/historial' && metodo === 'GET') {
    const h = datos.historial(400).filter(e => admin || e.accion !== 'inversión');
    return json(res, 200, h);
  }
  if (ruta === '/api/exportar.csv' && metodo === 'GET') {
    datos.registrar({ ...quien, accion: 'exportó contactos' });
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="impulz-contactos-${hoy()}.csv"`, 'Cache-Control': 'no-store' });
    return res.end(csv(datos.listaLeads(), datos.config()));
  }

  if (ruta === '/api/leads' && metodo === 'POST') {
    let b; try { b = await leerCuerpo(req); } catch (e) { return error(res, 400, 'Datos inválidos'); }
    const c = limpiarCampos(b);
    if (!c.nombre) return error(res, 400, 'Falta el nombre.');
    c.canal = c.canal || (admin ? 'reserva_web' : 'meson');
    if (!admin && R.canal(c.canal).g) return error(res, 403, 'Los canales de gestión de redes los registra el coach. Elige un canal del gimnasio.');
    const cfg = datos.config();
    const l = datos.guardarLead(R.conInscripcion({
      id: datos.nuevoId(), codigo: datos.nuevoCodigo(), origen: 'manual', etapa: 'Contacto', plan: '', monto: +cfg.mensualidad,
      fechaContacto: hoy(), fechaInscripcion: '', pagos: [], notas: '', campana: '', anuncio: '', ...c,
      creadoEn: new Date().toISOString(), creadoPor: s.usuario
    }, cfg, hoy()));
    datos.registrar({ ...quien, accion: 'creó contacto', leadId: l.id, codigo: l.codigo, detalle: `${l.nombre} · ${R.canal(l.canal).nombre} · ${l.etapa}` });
    return json(res, 201, l);
  }

  const m = ruta.match(/^\/api\/leads\/([\w-]{8,40})$/);
  if (m) {
    const actual = datos.lead(m[1]);
    if (!actual) return error(res, 404, 'Ese contacto ya no existe.');
    if (metodo === 'DELETE') {
      if (!admin) return error(res, 403, 'Solo el coach puede eliminar contactos.');
      datos.borrarLead(actual.id);
      datos.registrar({ ...quien, accion: 'eliminó contacto', leadId: actual.id, codigo: actual.codigo, detalle: actual.nombre });
      return json(res, 200, { ok: true });
    }
    if (metodo === 'PATCH') {
      let b; try { b = await leerCuerpo(req); } catch (e) { return error(res, 400, 'Datos inválidos'); }
      const permitidos = admin ? CAMPOS_ADMIN : CAMPOS_DUENO;
      const prohibido = Object.keys(b).find(k => !permitidos.includes(k));
      if (prohibido) return error(res, 403, prohibido === 'canal' ? 'El canal de origen solo lo cambia el coach.' : 'No puedes cambiar ese dato.');
      const cambios = limpiarCampos(b);
      const nuevo = R.conInscripcion({ ...actual, ...cambios, actualizadoEn: new Date().toISOString() }, datos.config(), hoy());
      const detalle = resumenCambios(actual, nuevo);
      datos.guardarLead(nuevo);
      if (detalle) datos.registrar({ ...quien, accion: 'editó contacto', leadId: nuevo.id, codigo: nuevo.codigo, detalle: nuevo.nombre + ' · ' + detalle });
      return json(res, 200, nuevo);
    }
  }

  if (ruta === '/api/config' && metodo === 'PUT') {
    if (!admin) return error(res, 403, 'Solo el coach puede cambiar el acuerdo.');
    let b; try { b = await leerCuerpo(req); } catch (e) { return error(res, 400, 'Datos inválidos'); }
    const c = {};
    for (const k of ['pctPrimer', 'pctRecurrente', 'mesesRecurrente', 'pctPase', 'mensualidad']) if (k in b) c[k] = Math.max(0, Math.min(k === 'mensualidad' ? 10e6 : 100, +b[k] || 0));
    if ('inicio' in b) c.inicio = /^\d{4}-\d{2}-\d{2}$/.test(b.inicio) ? b.inicio : '';
    if ('whatsapp' in b) c.whatsapp = soloDigitos(b.whatsapp).slice(0, 15);
    if ('beneficio' in b) c.beneficio = texto(b.beneficio, 120);
    if ('promo' in b) c.promo = texto(b.promo, 160);
    for (const k of ['precioMensual', 'precioPareja', 'precioMatricula']) if (k in b) c[k] = Math.max(0, Math.min(10e6, Math.round(+b[k] || 0)));
    if ('direccion' in b) c.direccion = texto(b.direccion, 120);
    if ('coachNombre' in b) c.coachNombre = texto(b.coachNombre, 60);
    if ('instagram' in b) c.instagram = texto(b.instagram, 40).replace(/[^\w.]/g, '');
    if ('pruebaGratis' in b) c.pruebaGratis = +b.pruebaGratis ? 1 : 0;
    for (const k of ['mapsUrl', 'coachPerfil', 'resenasUrl']) if (k in b) { const u = texto(b[k], 300); c[k] = /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ''; }
    const antes = datos.config(), nuevo = datos.guardarConfig(c);
    const det = Object.keys(c).filter(k => String(antes[k]) !== String(nuevo[k])).map(k => `${k}: ${antes[k] || '—'} → ${nuevo[k] || '—'}`).join(' · ');
    if (det) datos.registrar({ ...quien, accion: 'cambió el acuerdo', detalle: det });
    return json(res, 200, nuevo);
  }

  if (ruta === '/api/inversion' && metodo === 'GET') return admin ? json(res, 200, datos.inversion()) : error(res, 403, 'No disponible.');
  const mi = ruta.match(/^\/api\/inversion\/(\d{4}-\d{2})$/);
  if (mi && metodo === 'PUT') {
    if (!admin) return error(res, 403, 'No disponible.');
    let b; try { b = await leerCuerpo(req); } catch (e) { return error(res, 400, 'Datos inválidos'); }
    const r = datos.guardarInversion(mi[1], Math.max(0, Math.round(+b.monto || 0)));
    datos.registrar({ ...quien, accion: 'inversión', detalle: mi[1] });
    return json(res, 200, r);
  }

  return error(res, 404, 'No encontrado');
}

/* ---------- servidor ---------- */
const ESTATICOS = { '/reglas.js': 'application/javascript; charset=utf-8', '/favicon.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  let ruta;
  try { ruta = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  const metodo = req.method || 'GET';
  try {
    if (PANEL_HOST) {
      const enPanel = hostDe(req) === PANEL_HOST;
      const esPublico = ruta === '/api/reservas' || ruta === '/salud' || ESTATICOS[ruta] || ruta === '/robots.txt' || ruta === '/llms.txt';
      // La dirección del panel no debe aparecer en buscadores.
      if (enPanel) { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); if (ruta === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('User-agent: *\nDisallow: /\n'); } }
      if (enPanel && !ruta.startsWith('/api/') && !ruta.startsWith('/panel') && !esPublico) { res.writeHead(302, { Location: '/panel' }); return res.end(); }
      if (!enPanel && (ruta.startsWith('/panel') || (ruta.startsWith('/api/') && ruta !== '/api/reservas'))) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    }
    // Una sola dirección oficial: www.dominio → dominio (evita contenido duplicado en buscadores).
    if (hostDe(req).startsWith('www.') && metodo === 'GET') { res.writeHead(301, { Location: 'https://' + hostDe(req).slice(4) + (req.url || '/') }); return res.end(); }
    if (ruta.startsWith('/api/')) return await api(req, res, ruta, metodo);
    if (ruta === '/' || ruta === '/reserva') {
      const cfg = datos.config();
      const base = { PIXEL: pixelHead(), PIXEL_ACTIVO: PIXEL ? '1' : '', ORIGEN: origen(req), VERIFICACION: verificacionHead() };
      // "/" es el sitio completo del gimnasio; "/reserva" es la página corta para anuncios.
      if (ruta === '/') return pagina(res, 'sitio.html', { ...base, JSONLD: jsonLd(cfg, req), SITIO_JSON: sitioPublico(cfg) });
      return pagina(res, 'reserva.html', { ...base, BENEFICIO: esc(cfg.beneficio || ''), PROMO: esc(cfg.promo || ''), PROMO_OCULTA: cfg.promo ? '' : 'hidden' });
    }
    if (ruta === '/sitemap.xml') {
      const o = origen(req);
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${o}/</loc><lastmod>${fs.statSync(path.join(PUBLICO, 'sitio.html')).mtime.toISOString().slice(0, 10)}</lastmod></url></urlset>`);
    }
    if (ruta === '/panel' || ruta === '/panel/') {
      res.setHeader('X-Robots-Tag', 'noindex');
      return pagina(res, 'panel.html');
    }
    if (ruta === '/robots.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(['User-agent: *', 'Allow: /', 'Disallow: /panel', 'Disallow: /api/', '',
      '# Buscadores con IA: bienvenidos (GEO)', ...['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Bingbot'].map(b => 'User-agent: ' + b + '\nAllow: /\nDisallow: /panel\nDisallow: /api/\n'),
      'Sitemap: ' + origen(req) + '/sitemap.xml', ''].join('\n')); }
    if (ruta === '/llms.txt') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }); return res.end(llmsTxt(datos.config(), origen(req))); }
    // IndexNow (Bing, Yandex, Seznam, Naver): avisa al instante cuando el sitio cambia. Ver scripts/indexnow.js.
    if (INDEXNOW_KEY && ruta === '/' + INDEXNOW_KEY + '.txt') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(INDEXNOW_KEY); }
    if (ruta === '/salud') return json(res, 200, { ok: true });
    if (/^\/fotos\/[a-z0-9-]+\.jpg$/.test(ruta)) {
      const f = path.join(PUBLICO, ruta);
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=604800' });
      return fs.createReadStream(f).pipe(res);
    }
    if (ESTATICOS[ruta]) {
      res.writeHead(200, { 'Content-Type': ESTATICOS[ruta], 'Cache-Control': 'public, max-age=600' });
      return fs.createReadStream(path.join(PUBLICO, ruta)).pipe(res);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No encontrado');
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Error interno'); }
  }
}).listen(PUERTO, () => {
  console.log('Impulz: reservas en http://localhost:' + PUERTO + '  ·  panel en /panel');
  console.log('Datos en ' + datos.DIR + (ses.usuarios().length ? '' : '  ·  AVISO: no hay usuarios (ADMIN_USUARIO / ADMIN_CLAVE)'));
  if (!PIXEL) console.log('Píxel de Meta desactivado (META_PIXEL_ID)');
});
