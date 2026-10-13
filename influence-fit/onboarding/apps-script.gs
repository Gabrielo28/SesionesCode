/**
 * Influence Fit — Receptor del formulario de onboarding (Google Apps Script)
 *
 * Qué hace: recibe el JSON del formulario (onboarding/index.html) y lo agrega como
 * fila en una hoja de Google Sheets. Una pestaña por coach si se quiere (ver POR_COACH).
 *
 * Instalación (5 minutos):
 *  1. Crea una hoja en Google Sheets (ej. "Clientes — Coach X").
 *  2. Extensiones > Apps Script. Borra lo que haya y pega este archivo.
 *  3. Cambia SHEET_ID por el ID de tu hoja (está en la URL: /spreadsheets/d/<ID>/edit).
 *  4. Implementar > Nueva implementación > Tipo: Aplicación web.
 *     - Ejecutar como: Yo.  - Quién tiene acceso: Cualquier persona.
 *  5. Copia la URL que termina en /exec y pégala en CONFIG.WEBHOOK_URL de onboarding/index.html.
 *
 * Opcional: NOTIFICAR_EMAIL avisa al coach por correo con cada onboarding nuevo.
 */

var SHEET_ID = 'PEGA_AQUI_EL_ID_DE_TU_HOJA';
var POR_COACH = true;               // true = una pestaña por coach (campo "coach"); false = todo en "Onboarding"
var NOTIFICAR_EMAIL = '';           // ej. 'coach@gmail.com' (vacío = no avisa)

var COLUMNAS = [
  'fecha','coach','nombre','edad','sexo','whatsapp','email','comuna',
  'altura_cm','peso_kg',
  'objetivo','objetivo_detalle','plazo',
  'experiencia_nivel','experiencia_anios','entreno_actual',
  'lesiones_zonas','lesiones_detalle','condiciones_medicas','medicamentos','cirugias',
  'dias_semana','minutos_sesion','horario','modalidad',
  'equipamiento','equipamiento_detalle',
  'gustan','no_gustan','sueno_horas','estres','nutricion',
  'como_llego','consentimiento','origen','version'
];

function doPost(e) {
  try {
    var datos = JSON.parse(e.postData.contents);
    var hoja = obtenerHoja_(datos.coach || 'Onboarding');
    var fila = COLUMNAS.map(function (k) {
      var v = datos[k];
      if (Array.isArray(v)) return v.join(', ');
      if (v === undefined || v === null) return '';
      return v;
    });
    hoja.appendRow(fila);
    if (NOTIFICAR_EMAIL) notificar_(datos);
    return respuesta_({ ok: true, fila: hoja.getLastRow() });
  } catch (err) {
    return respuesta_({ ok: false, error: String(err) });
  }
}

// GET sirve para probar que la implementación está viva.
function doGet() {
  return respuesta_({ ok: true, servicio: 'onboarding-influence-fit', columnas: COLUMNAS.length });
}

function obtenerHoja_(nombre) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var nombreHoja = POR_COACH ? String(nombre).slice(0, 90) : 'Onboarding';
  var hoja = ss.getSheetByName(nombreHoja);
  if (!hoja) {
    hoja = ss.insertSheet(nombreHoja);
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold').setBackground('#12959C').setFontColor('#FFFFFF');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function notificar_(d) {
  var asunto = 'Nuevo onboarding: ' + d.nombre + ' (' + d.objetivo + ')';
  var cuerpo = [
    'Nombre: ' + d.nombre,
    'WhatsApp: https://wa.me/' + d.whatsapp,
    'Objetivo: ' + d.objetivo + (d.objetivo_detalle ? ' — ' + d.objetivo_detalle : ''),
    'Experiencia: ' + d.experiencia_nivel,
    'Lesiones: ' + ((d.lesiones_zonas || []).join(', ') || 'ninguna declarada') + (d.lesiones_detalle ? ' — ' + d.lesiones_detalle : ''),
    'Condiciones médicas: ' + (d.condiciones_medicas || 'ninguna declarada'),
    'Disponibilidad: ' + d.dias_semana + ' días/sem, ' + d.minutos_sesion + ' min, ' + (d.horario || ''),
    'Equipamiento: ' + d.equipamiento,
    '',
    'Hoja: https://docs.google.com/spreadsheets/d/' + SHEET_ID
  ].join('\n');
  MailApp.sendEmail(NOTIFICAR_EMAIL, asunto, cuerpo);
}

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Prueba manual desde el editor: Ejecutar > probar
function probar() {
  var e = { postData: { contents: JSON.stringify({ coach: 'demo', nombre: 'Prueba', whatsapp: '56912345678', objetivo: 'Fuerza', experiencia_nivel: 'Intermedio (1 a 3 años)', dias_semana: 3, minutos_sesion: 60, equipamiento: 'Gimnasio completo', lesiones_zonas: ['Hombro'], consentimiento: true, fecha: new Date().toISOString() }) } };
  Logger.log(doPost(e).getContent());
}
