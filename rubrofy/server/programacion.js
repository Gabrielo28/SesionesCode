// Fechas de publicación en la hora del negocio, no la del servidor. En
// Railway el servidor corre en UTC: sin esto, "09:00" se publicaría a las
// 06:00 de Chile. Todo se guarda como ISO UTC (`publicarEl`) y se muestra y
// se ingresa en la zona del negocio (por ahora una sola, configurable).
// Sin dependencias: usa Intl, que trae las reglas de horario de verano.

const ZONA = process.env.RUBROFY_TZ || 'America/Santiago';
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

function partesEnZona(date, zona = ZONA) {
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of formato.formatToParts(date)) p[type] = value;
  return { anio: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, minuto: +p.minute, segundo: +p.second };
}

// Minutos que la zona está adelantada respecto de UTC en ese instante
// (negativo en Chile: -180 o -240 según el horario de verano).
function desfaseMinutos(date, zona) {
  const p = partesEnZona(date, zona);
  const comoUTC = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return (comoUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

// "Día y hora de reloj en la zona" -> ISO UTC. Dos pasadas por si el cambio
// de horario cae entre la estimación y el resultado.
function isoDesdeZona(anio, mes, dia, hora, minuto, zona = ZONA) {
  const ingenuo = Date.UTC(anio, mes - 1, dia, hora, minuto);
  let t = ingenuo - desfaseMinutos(new Date(ingenuo), zona) * 60000;
  t = ingenuo - desfaseMinutos(new Date(t), zona) * 60000;
  return new Date(t).toISOString();
}

// Fecha a N días de hoy (en la zona), a la hora "HH:MM" de la zona.
function fechaProgramada(diasDesdeHoy, horaMinuto, ahora = new Date()) {
  const hoy = partesEnZona(ahora);
  const destino = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia + diasDesdeHoy));
  const [hora, minuto] = horaMinuto.split(':').map(Number);
  return isoDesdeZona(destino.getUTCFullYear(), destino.getUTCMonth() + 1, destino.getUTCDate(), hora, minuto);
}

function tipoDeEtiqueta(etiqueta) {
  const partes = String(etiqueta || '').split(' - ');
  return partes[2] || 'Post';
}

// Etiqueta que muestra el panel y que usa el calendario: "28 SEP - 09:00 - Post".
function etiquetaFecha(publicarEl, tipo) {
  const p = partesEnZona(new Date(publicarEl));
  return `${pad2(p.dia)} ${MESES[p.mes - 1]} - ${pad2(p.hora)}:${pad2(p.minuto)} - ${tipo}`;
}

// Piezas creadas antes de que existiera `publicarEl` solo tienen la etiqueta,
// sin año: se elige el año que deja la fecha más cerca de hoy.
function publicarElDesdeEtiqueta(etiqueta, ahora = new Date()) {
  const m = /^(\d{1,2}) ([A-Z]{3}) - (\d{2}):(\d{2})/.exec(String(etiqueta || ''));
  if (!m) return null;
  const mes = MESES.indexOf(m[2]) + 1;
  if (!mes) return null;
  const anioActual = partesEnZona(ahora).anio;
  let mejor = null;
  for (const anio of [anioActual - 1, anioActual, anioActual + 1]) {
    const iso = isoDesdeZona(anio, mes, +m[1], +m[3], +m[4]);
    if (!mejor || Math.abs(Date.parse(iso) - ahora) < Math.abs(Date.parse(mejor) - ahora)) mejor = iso;
  }
  return mejor;
}

// Completa `publicarEl` en una pieza vieja que solo tiene etiqueta.
function asegurarPublicarEl(item) {
  if (!item.publicarEl) item.publicarEl = publicarElDesdeEtiqueta(item.date) || new Date().toISOString();
  return item.publicarEl;
}

// Cambia la fecha de una pieza manteniendo la etiqueta sincronizada.
function fijarPublicarEl(item, iso) {
  item.publicarEl = iso;
  item.date = etiquetaFecha(iso, tipoDeEtiqueta(item.date));
}

// Valor de un <input type="datetime-local"> ("2026-09-28T09:00"),
// interpretado en la zona del negocio. null si el formato no es válido.
function isoDesdeInputLocal(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(valor || ''));
  if (!m) return null;
  const [anio, mes, dia, hora, minuto] = m.slice(1).map(Number);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hora > 23 || minuto > 59) return null;
  return isoDesdeZona(anio, mes, dia, hora, minuto);
}

module.exports = {
  ZONA, fechaProgramada, etiquetaFecha, asegurarPublicarEl, fijarPublicarEl, isoDesdeInputLocal,
  partesEnZona, isoDesdeZona,
};
