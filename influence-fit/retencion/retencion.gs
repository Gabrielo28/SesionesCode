/**
 * Influence Fit — Secuencia de retención (Google Apps Script)
 *
 * Todos los días a las 9:00 revisa la pestaña "Clientes" y, según los días desde fecha_inicio,
 * arma los mensajes de secuencia.json. Dos modos:
 *   MODO = 'manual'    → deja cada mensaje en la pestaña "Pendientes hoy" con un link wa.me
 *                         ya escrito. El coach abre la hoja y manda cada uno con un clic (2 min/día).
 *   MODO = 'sendpulse' → envía solo por la API de WhatsApp de SendPulse usando una plantilla
 *                         aprobada (fuera de la ventana de 24 h Meta exige plantilla).
 * Los pasos marcados manual:true en secuencia.json SIEMPRE quedan en Pendientes.
 *
 * Pestaña "Clientes" (crea estas columnas en la fila 1):
 *   nombre | whatsapp | fecha_inicio | meta | estado | ultima_sesion | ultima_respuesta | coach
 *   estado: activo | renovado | pausado | baja
 *
 * Instalación:
 *  1. Apps Script dentro de la hoja de clientes. Pega este archivo y pega el contenido de
 *     secuencia.json en la constante SECUENCIA (o súbelo como archivo y léelo con DriveApp).
 *  2. Ejecuta instalar() una vez: crea las pestañas y el disparador diario.
 *  3. (Opcional) Implementar como Aplicación web para recibir la encuesta (encuesta-mes-3.html).
 */

var MODO = 'manual';
var COACH_NOMBRE = 'Gabriel';
var TAB_CLIENTES = 'Clientes', TAB_PENDIENTES = 'Pendientes hoy', TAB_LOG = 'Enviados', TAB_ENCUESTA = 'Encuesta mes 3';
var HORA_ENVIO = 9;

var SENDPULSE = { CLIENT_ID: '', CLIENT_SECRET: '', BOT_ID: '', TEMPLATE: 'checkin_coach', LANG: 'es' };

// Pega aquí el contenido de secuencia.json
var SECUENCIA = null;

function instalar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(TAB_CLIENTES)) {
    var c = ss.insertSheet(TAB_CLIENTES);
    c.appendRow(['nombre', 'whatsapp', 'fecha_inicio', 'meta', 'estado', 'ultima_sesion', 'ultima_respuesta', 'coach']);
    c.setFrozenRows(1);
  }
  if (!ss.getSheetByName(TAB_PENDIENTES)) ss.insertSheet(TAB_PENDIENTES).appendRow(['fecha', 'cliente', 'paso', 'mensaje', 'enviar (clic)', 'listo']);
  if (!ss.getSheetByName(TAB_LOG)) ss.insertSheet(TAB_LOG).appendRow(['fecha', 'cliente', 'whatsapp', 'paso', 'modo', 'resultado']);
  if (!ss.getSheetByName(TAB_ENCUESTA)) ss.insertSheet(TAB_ENCUESTA).appendRow(['fecha', 'coach', 'nombre', 'cerca_meta', 'nps', 'mas_sirvio', 'cambiaria', 'seguir', 'comentario']);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'correrDiario') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('correrDiario').timeBased().atHour(HORA_ENVIO).everyDays(1).create();
  Logger.log('Listo. Disparador diario a las ' + HORA_ENVIO + ':00.');
}

function correrDiario() {
  var seq = cargarSecuencia_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(TAB_CLIENTES);
  var filas = hoja.getDataRange().getValues();
  var cab = filas.shift();
  var col = function (n) { return cab.indexOf(n); };
  var hoy = inicioDia_(new Date());
  var enviadosHoy = 0;

  filas.forEach(function (f, idx) {
    var estado = String(f[col('estado')] || '').toLowerCase();
    if (!f[col('nombre')] || !f[col('fecha_inicio')] || estado === 'baja' || estado === 'pausado') return;
    var dias = Math.round((hoy - inicioDia_(new Date(f[col('fecha_inicio')]))) / 86400000);
    var cliente = {
      fila: idx + 2, nombre: String(f[col('nombre')]).split(' ')[0], nombreCompleto: f[col('nombre')],
      whatsapp: String(f[col('whatsapp')]).replace(/\D/g, ''), meta: f[col('meta')] || 'tu objetivo', estado: estado,
      ultimaSesion: f[col('ultima_sesion')] ? new Date(f[col('ultima_sesion')]) : null,
      ultimaRespuesta: f[col('ultima_respuesta')] ? new Date(f[col('ultima_respuesta')]) : null
    };

    seq.pasos.forEach(function (p) {
      if (p.dia !== dias) return;
      if (p.solo_si_estado && p.solo_si_estado !== estado) return;
      if (p.solo_si_no_respondio && respondioDespuesDe_(cliente, p, seq)) return;
      if (yaEnviado_(cliente, p.id)) return;
      procesar_(cliente, p, seq) && enviadosHoy++;
    });

    // Inactividad: X días sin sesión registrada
    var inact = seq.inactividad;
    if (inact && cliente.ultimaSesion && dias > 3) {
      var sinSesion = Math.round((hoy - inicioDia_(cliente.ultimaSesion)) / 86400000);
      if (sinSesion === inact.dias_sin_sesion && !yaEnviado_(cliente, 'inactividad_' + fmt_(hoy))) {
        procesar_(cliente, { id: 'inactividad_' + fmt_(hoy), texto: inact.texto, manual: false }, seq) && enviadosHoy++;
      }
    }
  });
  Logger.log('Procesados: ' + enviadosHoy);
}

function procesar_(c, paso, seq) {
  var vars = Object.assign({}, seq.variables_por_defecto || {}, {
    nombre: c.nombre, coach: COACH_NOMBRE, meta: c.meta,
    fecha_limite: fmt_(new Date(Date.now() + 7 * 86400000))
  });
  var texto = paso.texto.replace(/\{\{(\w+)\}\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
  var manual = MODO === 'manual' || paso.manual || /\{\{\w+\}\}/.test(texto);
  if (manual) { aPendientes_(c, paso.id, texto); log_(c, paso.id, 'pendiente', 'ok'); return true; }
  var r = enviarSendPulse_(c.whatsapp, texto);
  log_(c, paso.id, 'sendpulse', r);
  return true;
}

function aPendientes_(c, pasoId, texto) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_PENDIENTES);
  var link = 'https://wa.me/' + c.whatsapp + '?text=' + encodeURIComponent(texto);
  h.appendRow([new Date(), c.nombreCompleto, pasoId, texto, '', false]);
  var fila = h.getLastRow();
  h.getRange(fila, 5).setFormula('=HYPERLINK("' + link + '";"Enviar a ' + c.nombre + '")');
  h.getRange(fila, 6).insertCheckboxes();
}

function log_(c, pasoId, modo, resultado) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_LOG).appendRow([new Date(), c.nombreCompleto, c.whatsapp, pasoId, modo, String(resultado)]);
}

function yaEnviado_(c, pasoId) {
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_LOG);
  if (h.getLastRow() < 2) return false;
  return h.getRange(2, 2, h.getLastRow() - 1, 3).getValues().some(function (r) { return String(r[0]) === String(c.nombreCompleto) && r[2] === pasoId; });
}

function respondioDespuesDe_(c, paso, seq) {
  if (!c.ultimaRespuesta) return false;
  var base = seq.pasos.filter(function (p) { return p.id === paso.solo_si_no_respondio; })[0];
  if (!base) return false;
  var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_LOG);
  var envio = h.getRange(2, 1, Math.max(h.getLastRow() - 1, 1), 4).getValues().filter(function (r) { return String(r[1]) === String(c.nombreCompleto) && r[3] === base.id; })[0];
  return envio ? c.ultimaRespuesta >= new Date(envio[0]) : false;
}

// ---- SendPulse WhatsApp API ----
function tokenSendPulse_() {
  var r = UrlFetchApp.fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({ grant_type: 'client_credentials', client_id: SENDPULSE.CLIENT_ID, client_secret: SENDPULSE.CLIENT_SECRET })
  });
  return JSON.parse(r.getContentText()).access_token;
}

function enviarSendPulse_(telefono, texto) {
  // Fuera de la ventana de 24 h Meta exige plantilla aprobada. Se usa una plantilla con un solo
  // parámetro {{1}} que recibe el texto completo del check-in. Crea la plantilla "checkin_coach" en SendPulse.
  try {
    var r = UrlFetchApp.fetch('https://api.sendpulse.com/whatsapp/contacts/sendTemplateByPhone', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + tokenSendPulse_() },
      payload: JSON.stringify({
        bot_id: SENDPULSE.BOT_ID, phone: telefono,
        template: { name: SENDPULSE.TEMPLATE, language: { code: SENDPULSE.LANG },
          components: [{ type: 'body', parameters: [{ type: 'text', text: texto }] }] }
      })
    });
    return r.getResponseCode() + ' ' + r.getContentText().slice(0, 200);
  } catch (e) { return 'error ' + e; }
}

// ---- Encuesta mes 3 (recibe el POST de encuesta-mes-3.html) ----
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_ENCUESTA);
    h.appendRow([new Date(), d.coach || '', d.nombre || '', d.cerca_meta, d.nps, d.mas_sirvio || '', d.cambiaria || '', d.seguir || '', d.comentario || '']);
    // marca última respuesta en Clientes
    var c = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB_CLIENTES);
    var vals = c.getDataRange().getValues(); var cab = vals[0];
    for (var i = 1; i < vals.length; i++) if (String(vals[i][cab.indexOf('nombre')]).toLowerCase() === String(d.nombre || '').toLowerCase()) {
      c.getRange(i + 1, cab.indexOf('ultima_respuesta') + 1).setValue(new Date());
      if (/^s[ií]$/i.test(d.seguir || '')) c.getRange(i + 1, cab.indexOf('estado') + 1).setValue('renovado');
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function cargarSecuencia_() {
  if (SECUENCIA) return SECUENCIA;
  var files = DriveApp.getFilesByName('secuencia.json');
  if (files.hasNext()) return JSON.parse(files.next().getBlob().getDataAsString());
  throw new Error('Pega secuencia.json en la constante SECUENCIA o súbelo a Drive con ese nombre.');
}
function inicioDia_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function fmt_(d) { return Utilities.formatDate(d, 'America/Santiago', 'd/M'); }
