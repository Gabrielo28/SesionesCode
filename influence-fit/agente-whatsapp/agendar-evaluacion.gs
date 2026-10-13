/**
 * Influence Fit — Agendador de evaluaciones (Google Apps Script)
 *
 * Expone dos cosas al agente de WhatsApp (SendPulse / Make):
 *   GET  ?action=slots&dias=7   → horarios libres del coach en los próximos N días
 *   POST {nombre, telefono, fecha, hora, objetivo, calificacion, modalidad, notas}
 *        → crea el evento en Google Calendar, registra en Sheets y avisa al coach
 *
 * Instalación:
 *  1. Apps Script nuevo (script.google.com) o dentro de la hoja de clientes.
 *  2. Pega este archivo. Ajusta CONFIG.
 *  3. Implementar > Aplicación web > Ejecutar como: Yo · Acceso: Cualquier persona.
 *  4. La URL /exec es {{WEBHOOK_URL}} en prompt-agente.md.
 */

var CONFIG = {
  CALENDAR_ID: 'primary',                 // o el ID del calendario "Evaluaciones"
  SHEET_ID: '',                           // opcional: hoja donde registrar (vacío = no registra)
  SHEET_TAB: 'Evaluaciones',
  COACH_EMAIL: '',                        // aviso por correo (vacío = no avisa)
  COACH_WHATSAPP: '56965450723',          // solo para armar el link en el aviso
  ZONA_HORARIA: 'America/Santiago',
  DURACION_MIN: 45,
  BUFFER_MIN: 15,                         // espacio entre evaluaciones
  ANTICIPACION_MIN_HORAS: 12,             // no ofrecer horas antes de esto
  // Ventanas de atención por día (0 = domingo … 6 = sábado). Formato "HH:MM-HH:MM".
  HORARIOS: {
    1: ['07:00-11:00', '17:00-20:30'],
    2: ['07:00-11:00', '17:00-20:30'],
    3: ['07:00-11:00', '17:00-20:30'],
    4: ['07:00-11:00', '17:00-20:30'],
    5: ['07:00-11:00', '17:00-19:00'],
    6: ['09:00-12:00']
  },
  LUGAR_PRESENCIAL: 'El Tabo (dirección exacta se envía por WhatsApp)',
  LINK_ONLINE: 'https://meet.google.com/nuevo'
};

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'slots') return json_({ ok: true, slots: horariosLibres_(Number(p.dias) || 7, Number(p.max) || 6) });
  return json_({ ok: true, servicio: 'agendar-evaluacion', uso: '?action=slots&dias=7' });
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    ['nombre', 'telefono', 'fecha', 'hora'].forEach(function (k) { if (!d[k]) throw new Error('Falta ' + k); });
    var inicio = fechaHora_(d.fecha, d.hora);
    var fin = new Date(inicio.getTime() + CONFIG.DURACION_MIN * 60000);
    var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
    if (cal.getEvents(inicio, fin).length) return json_({ ok: false, error: 'ocupado', slots: horariosLibres_(7, 3) });

    var online = /online|video/i.test(d.modalidad || '');
    var titulo = 'Evaluación · ' + d.nombre + (d.calificacion ? ' (' + d.calificacion + ')' : '');
    var desc = [
      'WhatsApp: https://wa.me/' + String(d.telefono).replace(/\D/g, ''),
      'Objetivo: ' + (d.objetivo || '-'),
      'Calificación: ' + (d.calificacion || '-'),
      'Modalidad: ' + (d.modalidad || '-'),
      'Notas: ' + (d.notas || '-'),
      'Origen: agente WhatsApp'
    ].join('\n');
    var ev = cal.createEvent(titulo, inicio, fin, { description: desc, location: online ? CONFIG.LINK_ONLINE : CONFIG.LUGAR_PRESENCIAL });
    ev.addPopupReminder(60);

    if (CONFIG.SHEET_ID) registrar_(d, inicio, ev.getId());
    if (CONFIG.COACH_EMAIL) MailApp.sendEmail(CONFIG.COACH_EMAIL, 'Evaluación agendada: ' + d.nombre, desc + '\n\nCuándo: ' + formato_(inicio));

    return json_({ ok: true, evento_id: ev.getId(), cuando: formato_(inicio), lugar: online ? CONFIG.LINK_ONLINE : CONFIG.LUGAR_PRESENCIAL });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---- horarios libres ----
function horariosLibres_(dias, max) {
  var cal = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var ahora = new Date();
  var desde = new Date(ahora.getTime() + CONFIG.ANTICIPACION_MIN_HORAS * 3600000);
  var hasta = new Date(ahora.getTime() + dias * 86400000);
  var ocupados = cal.getEvents(desde, hasta).map(function (ev) { return [ev.getStartTime().getTime(), ev.getEndTime().getTime()]; });
  var paso = (CONFIG.DURACION_MIN + CONFIG.BUFFER_MIN) * 60000;
  var out = [];

  for (var dia = new Date(desde); dia <= hasta && out.length < max; dia.setDate(dia.getDate() + 1)) {
    var ymd = Utilities.formatDate(dia, CONFIG.ZONA_HORARIA, 'yyyy-MM-dd');
    var dow = Number(Utilities.formatDate(dia, CONFIG.ZONA_HORARIA, 'u')) % 7; // 1=lun..7=dom → 0=dom
    var ventanas = CONFIG.HORARIOS[dow] || [];
    for (var v = 0; v < ventanas.length && out.length < max; v++) {
      var partes = ventanas[v].split('-');
      var t = fechaHora_(ymd, partes[0]);
      var limite = fechaHora_(ymd, partes[1]);
      for (; t.getTime() + CONFIG.DURACION_MIN * 60000 <= limite.getTime() && out.length < max; t = new Date(t.getTime() + paso)) {
        if (t < desde) continue;
        var tFin = t.getTime() + CONFIG.DURACION_MIN * 60000;
        var choca = ocupados.some(function (o) { return t.getTime() < o[1] && tFin > o[0]; });
        if (!choca) out.push({ fecha: ymd, hora: Utilities.formatDate(t, CONFIG.ZONA_HORARIA, 'HH:mm'), texto: formato_(t) });
      }
    }
  }
  return out;
}

function fechaHora_(ymd, hm) {
  // Interpreta "2026-10-20" + "18:00" en la zona horaria de Chile.
  var iso = ymd + 'T' + hm + ':00';
  var offset = Utilities.formatDate(new Date(iso), CONFIG.ZONA_HORARIA, 'XXX'); // ej. -03:00
  return new Date(iso + offset);
}

function formato_(d) {
  var dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var dow = Number(Utilities.formatDate(d, CONFIG.ZONA_HORARIA, 'u')) % 7;
  return dias[dow] + ' ' + Utilities.formatDate(d, CONFIG.ZONA_HORARIA, 'd/M') + ' ' + Utilities.formatDate(d, CONFIG.ZONA_HORARIA, 'HH:mm');
}

function registrar_(d, inicio, id) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var h = ss.getSheetByName(CONFIG.SHEET_TAB) || ss.insertSheet(CONFIG.SHEET_TAB);
  if (h.getLastRow() === 0) h.appendRow(['creado', 'fecha_evaluacion', 'nombre', 'telefono', 'objetivo', 'calificacion', 'modalidad', 'notas', 'estado', 'evento_id']);
  h.appendRow([new Date(), inicio, d.nombre, "'" + d.telefono, d.objetivo || '', d.calificacion || '', d.modalidad || '', d.notas || '', 'agendada', id]);
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Pruebas desde el editor
function probarSlots() { Logger.log(JSON.stringify(horariosLibres_(7, 6), null, 2)); }
function probarAgendar() {
  var s = horariosLibres_(7, 1)[0];
  Logger.log(doPost({ postData: { contents: JSON.stringify({ nombre: 'Prueba Agente', telefono: '56912345678', fecha: s.fecha, hora: s.hora, objetivo: 'Fuerza', calificacion: 'A', modalidad: 'Presencial' }) } }).getContent());
}
