/**
 * Aviso automático por WhatsApp de clientes atrasados en su plan de contenido.
 * Lee "Dashboard Semanal" y "Dashboard Mensual" del tracker y envía un
 * mensaje de plantilla de WhatsApp (vía SendPulse) por cada cliente/tipo
 * de contenido que esté por debajo de lo pactado.
 *
 * INSTALACIÓN:
 * 1. Abre tu Google Sheet del tracker → Extensiones → Apps Script.
 * 2. Borra el contenido de Code.gs y pega este archivo completo.
 * 3. Ve a Configuración del proyecto (ícono de engranaje) → Propiedades
 *    del script → agrega estas 6 propiedades con tus valores reales:
 *      SENDPULSE_CLIENT_ID
 *      SENDPULSE_CLIENT_SECRET
 *      SENDPULSE_BOT_ID          (id de tu bot de WhatsApp en SendPulse)
 *      SENDPULSE_TEMPLATE_NAME   (nombre exacto de la plantilla aprobada)
 *      SENDPULSE_TEMPLATE_LANG   (ej: "es")
 *      MI_TELEFONO               (tu número en formato internacional sin +, ej: "56912345678")
 * 4. Guarda, selecciona la función "avisarAtrasos" en el menú de arriba y
 *    presiona Ejecutar una vez para autorizar el script (pide permiso
 *    para leer tu Sheet y hacer llamadas externas — es normal, es tu propio script).
 * 5. Ve a Triggers (ícono de reloj) → Add Trigger → función "avisarAtrasos",
 *    tipo "Time-driven", elige por ejemplo "Week timer, every Monday, 9am–10am".
 *
 * A partir de ahí corre solo: cada semana revisa el tracker y te avisa por
 * WhatsApp qué cliente(s) están atrasados.
 */

const DASHBOARD_SHEET = 'Dashboard Semanal'; // cambia a 'Dashboard Mensual' si prefieres el aviso mensual
const FIRST_ROW = 5;
const LAST_ROW = 24;
// Columnas del dashboard: A Cliente | B/C/D Posts | E/F/G Reels | H/I/J Historias
const TIPOS = [
  { label: 'Posts', pactadoCol: 2, publicadoCol: 3 },
  { label: 'Reels', pactadoCol: 5, publicadoCol: 6 },
  { label: 'Historias', pactadoCol: 8, publicadoCol: 9 },
];

function avisarAtrasos() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('SENDPULSE_CLIENT_ID');
  const clientSecret = props.getProperty('SENDPULSE_CLIENT_SECRET');
  const botId = props.getProperty('SENDPULSE_BOT_ID');
  const templateName = props.getProperty('SENDPULSE_TEMPLATE_NAME');
  const templateLang = props.getProperty('SENDPULSE_TEMPLATE_LANG') || 'es';
  const miTelefono = props.getProperty('MI_TELEFONO');

  if (!clientId || !clientSecret || !botId || !templateName || !miTelefono) {
    throw new Error('Faltan Propiedades del script. Revisa el paso 3 de las instrucciones.');
  }

  const atrasos = detectarAtrasos_();
  if (atrasos.length === 0) {
    Logger.log('Sin atrasos esta semana. No se envía nada.');
    return;
  }

  const token = obtenerTokenSendPulse_(clientId, clientSecret);
  atrasos.forEach((a) => {
    enviarPlantillaWhatsApp_(token, botId, templateName, templateLang, miTelefono, a);
    Utilities.sleep(500); // margen entre envíos
  });
  Logger.log(`Avisos enviados: ${atrasos.length}`);
}

function detectarAtrasos_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DASHBOARD_SHEET);
  const data = sheet.getRange(FIRST_ROW, 1, LAST_ROW - FIRST_ROW + 1, 10).getValues();

  const atrasos = [];
  data.forEach((row) => {
    const cliente = row[0];
    if (!cliente) return;
    TIPOS.forEach((t) => {
      const pactado = row[t.pactadoCol - 1];
      const publicado = row[t.publicadoCol - 1];
      if (typeof pactado === 'number' && pactado > 0 && publicado < pactado) {
        atrasos.push({ cliente, tipo: t.label, publicado, pactado });
      }
    });
  });
  return atrasos;
}

function obtenerTokenSendPulse_(clientId, clientSecret) {
  const res = UrlFetchApp.fetch('https://api.sendpulse.com/oauth/access_token', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText());
  if (!body.access_token) throw new Error('No se pudo obtener token de SendPulse: ' + res.getContentText());
  return body.access_token;
}

function enviarPlantillaWhatsApp_(token, botId, templateName, lang, phone, atraso) {
  const payload = {
    bot_id: botId,
    phone: phone,
    template: {
      name: templateName,
      language: { code: lang },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(atraso.cliente) },
            { type: 'text', text: String(atraso.publicado) },
            { type: 'text', text: String(atraso.pactado) },
            { type: 'text', text: String(atraso.tipo) },
          ],
        },
      ],
    },
  };

  const res = UrlFetchApp.fetch('https://api.sendpulse.com/whatsapp/contacts/sendTemplateByPhone', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  Logger.log(`${atraso.cliente} (${atraso.tipo}): ${res.getResponseCode()} ${res.getContentText()}`);
}
