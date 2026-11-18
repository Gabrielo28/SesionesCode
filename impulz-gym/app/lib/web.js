/*
 * Datos editables de la web de Impulz (panel → Web): planes, horario semanal y días especiales.
 * De aquí salen las tarjetas de planes, la tabla del Plan Full, los textos de horario, los datos para Google
 * (JSON-LD), el llms.txt y el estado "abierto / cerrado" de la portada.
 */

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_SCHEMA = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Fotos que se pueden usar en las tarjetas de planes (y reemplazar desde el panel).
const FOTOS = ['ia-fachada', 'ia-fachada-tarde', 'ia-fachada-noche', 'ia-letrero', 'ia-letrero-tarde', 'ia-letrero-noche', 'ia-letrero-ancho', 'ia-letrero-ancho-tarde', 'ia-letrero-ancho-noche', 'ia-sala', 'ia-maquinas-de-fuerza', 'ia-peso-libre', 'ia-poleas-y-discos', 'ia-mancuernas', 'ia-cardio',
  'p-principiante', 'p-madrugador', 'p-coach-sesion', 'p-coach-plan', 'p-pareja', 'p-verano'];

const PLANES_INICIALES = [
  { nombre: 'Básico', precio: 30000, grupo: 'mensual', detalle: 'Full acceso, sin restricciones\nPara quienes ya tienen experiencia y saben usar las máquinas\nEntrenas a tu ritmo', foto: 'ia-sala', etiqueta: '' },
  { nombre: 'Plan Clase', precio: 42000, grupo: 'mensual', detalle: 'Full acceso, sin restricciones\nUn profesional acompaña tus entrenamientos\nAprendes máquinas, técnica, posturas y cargas', foto: 'p-coach-sesion', etiqueta: 'Con acompañamiento' },
  { nombre: 'Estudiante', precio: 25000, grupo: 'mensual', detalle: 'Full acceso, sin restricciones\nPrecio especial para estudiantes\nPresenta tu credencial o comprobante de estudios vigente', foto: 'p-principiante', etiqueta: '' },
  { nombre: 'Trimestral', precio: 84000, grupo: 'full', meses: 3, congela: 7 },
  { nombre: 'Semestral', precio: 170000, grupo: 'full', meses: 6, congela: 14 },
  { nombre: 'Anual', precio: 300000, grupo: 'full', meses: 12, congela: 30 },
];

// Lunes a domingo: [abre, cierra] en "HH:MM", o null si cierra ese día.
const HORARIO_INICIAL = [['05:00', '22:00'], ['05:00', '22:00'], ['05:00', '22:00'], ['05:00', '22:00'], ['05:00', '22:00'], ['08:00', '14:00'], null];

const texto = (v, max) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, max);
const hhmm = v => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : '');
const minutos = h => +h.slice(0, 2) * 60 + +h.slice(3);
const hora = h => String(+h.slice(0, 2)) + ':' + h.slice(3); // "05:00" → "5:00"
const clp = n => '$' + Math.round(n || 0).toLocaleString('es-CL');

function limpiarPlanes(lista) {
  if (!Array.isArray(lista)) return null;
  const r = lista.slice(0, 12).map(p => {
    const grupo = p && p.grupo === 'full' ? 'full' : 'mensual';
    const base = { nombre: texto(p && p.nombre, 40), precio: Math.max(0, Math.min(10e6, Math.round(+(p && p.precio) || 0))), grupo };
    if (grupo === 'full') return { ...base, meses: Math.max(1, Math.min(24, Math.round(+p.meses || 1))), congela: Math.max(0, Math.min(90, Math.round(+p.congela || 0))) };
    return { ...base, detalle: texto(p.detalle, 400).split('\n').map(l => l.trim()).filter(Boolean).slice(0, 5).join('\n'), foto: FOTOS.includes(p.foto) ? p.foto : 'ia-sala', etiqueta: texto(p.etiqueta, 30) };
  }).filter(p => p.nombre);
  return r;
}

function limpiarHorario(h) {
  if (!Array.isArray(h) || h.length !== 7) return null;
  return h.map(d => {
    if (!Array.isArray(d)) return null;
    const a = hhmm(d[0]), c = hhmm(d[1]);
    return a && c && minutos(c) > minutos(a) ? [a, c] : null;
  });
}

// Días especiales: feriados o cambios puntuales. Sin horas = cerrado ese día.
function limpiarCierres(lista) {
  if (!Array.isArray(lista)) return null;
  return lista.slice(0, 40).map(x => {
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(x && x.fecha) ? x.fecha : '';
    const a = hhmm(x && x.abre), c = hhmm(x && x.cierra);
    const horas = a && c && minutos(c) > minutos(a) ? { abre: a, cierra: c } : {};
    return fecha ? { fecha, nota: texto(x.nota, 60), ...horas } : null;
  }).filter(Boolean).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/* ---------- textos de horario ---------- */

// Agrupa días seguidos con el mismo horario: [[desde, hasta, [abre, cierra] | null], ...]
function tramos(h) {
  const r = [];
  h.forEach((d, i) => {
    const ult = r[r.length - 1];
    if (ult && JSON.stringify(ult[2]) === JSON.stringify(d)) ult[1] = i; else r.push([i, i, d]);
  });
  return r;
}
const rango = (a, b, nombres) => (a === b ? nombres[a] : nombres[a] + (b === a + 1 ? ' y ' : ' a ') + nombres[b].toLowerCase());

// "Lun a vie 5:00 – 22:00 · Sáb 8:00 – 14:00"
function horarioCorto(h) {
  return tramos(h).filter(t => t[2]).map(([a, b, d]) => rango(a, b, DIAS_CORTOS) + ' ' + hora(d[0]) + ' – ' + hora(d[1])).join(' · ');
}
// "Lunes a viernes de 5:00 a 22:00 y sábado de 8:00 a 14:00. Domingo cerrado."
function horarioLargo(h) {
  const t = tramos(h);
  const abiertos = t.filter(x => x[2]).map(([a, b, d], i) => {
    const r = rango(a, b, DIAS);
    return (i ? r.toLowerCase() : r) + ' de ' + hora(d[0]) + ' a ' + hora(d[1]);
  });
  const cerrados = t.filter(x => !x[2]).map(([a, b]) => rango(a, b, DIAS));
  const txt = abiertos.length ? abiertos.slice(0, -1).join(', ') + (abiertos.length > 1 ? ' y ' : '') + abiertos[abiertos.length - 1] + '.' : 'Horario por confirmar.';
  return txt + (cerrados.length ? ' ' + cerrados.join(' y ') + ' cerrado.' : '');
}

function resumenSemana(h) {
  const abiertos = h.filter(Boolean);
  const total = abiertos.reduce((s, d) => s + (minutos(d[1]) - minutos(d[0])) / 60, 0);
  const abre = abiertos.length ? abiertos.map(d => d[0]).sort()[0] : '';
  const cierra = abiertos.length ? abiertos.map(d => d[1]).sort().slice(-1)[0] : '';
  return { abre: abre ? hora(abre) : '', cierra: cierra ? hora(cierra) : '', dias: abiertos.length, horas: Math.round(total) };
}

const precioDesde = planes => {
  const m = planes.filter(p => p.grupo === 'mensual' && p.precio > 0).map(p => p.precio);
  return m.length ? clp(Math.min(...m)) : '';
};

function openingHours(h) {
  return tramos(h).filter(t => t[2]).map(([a, b, d]) => ({
    '@type': 'OpeningHoursSpecification', dayOfWeek: DIAS_SCHEMA.slice(a, b + 1), opens: d[0], closes: d[1]
  }));
}

/* ---------- HTML del sitio ---------- */

function planesHtml(planes, esc) {
  return planes.filter(p => p.grupo === 'mensual').map(p => {
    const lis = (p.detalle || '').split('\n').filter(Boolean).map(l => `<li>${esc(l)}</li>`).join('');
    const precio = p.precio ? `${clp(p.precio)}<small> / mes</small>` : 'Consulta';
    return `<div class="plan${p.etiqueta ? ' top' : ''}"><img class="ph" src="/fotos/${p.foto}.jpg" alt="${esc(p.nombre)} en Impulz Gym" loading="lazy" width="960" height="540">` +
      (p.etiqueta ? `<span class="tag">${esc(p.etiqueta)}</span>` : '') +
      `<h3>${esc(p.nombre)}</h3><div class="price">${precio}</div><ul>${lis}</ul>` +
      `<a class="btn${p.etiqueta ? '' : ' ghost'}" href="#reserva" data-plan="${esc(p.nombre)}">Partir con clase de prueba</a></div>`;
  }).join('\n    ');
}

function fullHtml(planes, esc) {
  const full = planes.filter(p => p.grupo === 'full');
  if (!full.length) return '';
  const filas = full.map(p => `<tr><td><b>${esc(p.nombre)}</b></td><td>${p.meses} ${p.meses === 1 ? 'mes' : 'meses'} continuos</td><td>${p.congela ? p.congela + ' días' : 'No incluye'}</td><td class="num"><b>${p.precio ? clp(p.precio) : 'Consulta'}</b></td><td class="num">${p.precio ? clp(p.precio / p.meses) : '—'}</td></tr>`).join('\n      ');
  return `<div class="head" style="margin:44px 0 20px"><span class="eyebrow">Plan Full</span><h3 style="font-size:34px">Paga por adelantado y ahorra</h3><p>Ingresos y tiempo de entrenamiento ilimitados.</p></div>
  <div class="tablewrap"><table class="full">
    <thead><tr><th>Plan</th><th>Duración</th><th>Congelamiento</th><th class="num">Valor</th><th class="num">Equivale al mes</th></tr></thead>
    <tbody>
      ${filas}
    </tbody>
  </table></div>`;
}

const chipsHorario = (h, esc) => tramos(h).filter(t => t[2]).map(([a, b, d]) => `<span class="chip">${esc(rango(a, b, DIAS_CORTOS) + ' ' + hora(d[0]) + ' – ' + hora(d[1]))}</span>`).join('');

/** Todos los reemplazos {{...}} de horario y planes para sitio.html y reserva.html. */
function reemplazos(cfg, esc) {
  const h = cfg.horario, s = resumenSemana(h), desde = precioDesde(cfg.planes);
  return {
    HORARIO_CORTO: esc(horarioCorto(h)),
    HORARIO_LARGO: esc(horarioLargo(h)),
    HORARIO_CHIPS: chipsHorario(h, esc),
    PRECIO_DESDE_TITULO: desde ? ' desde ' + desde + ' al mes' : '',
    PRECIO_DESDE_TXT: desde ? 'Planes desde ' + desde + ' al mes, ' : '',
    ABRE_DESDE: esc(s.abre),
    STATS: [
      [s.abre, 'abrimos desde las'], [s.cierra, 'cerramos a las'], [s.dias + ' días', 'abierto a la semana'], [s.horas + ' h', 'para entrenar cada semana']
    ].filter(x => x[0]).map(([b, t]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(t)}</span></div>`).join('\n    '),
    PLANES_HTML: planesHtml(cfg.planes, esc),
    FULL_HTML: fullHtml(cfg.planes, esc),
  };
}

module.exports = {
  DIAS, FOTOS, PLANES_INICIALES, HORARIO_INICIAL, clp,
  limpiarPlanes, limpiarHorario, limpiarCierres,
  horarioCorto, horarioLargo, resumenSemana, precioDesde, openingHours, reemplazos,
};
