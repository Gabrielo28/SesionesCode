// Envío de correos con la API HTTP de Resend (https://resend.com), sin
// dependencias. Requiere RESEND_API_KEY y EMAIL_FROM (ej: "Rubrofy
// <avisos@rubrofy.com>", con el dominio verificado en Resend). Sin eso los
// correos simplemente no se envían.

function configurado() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

// Devuelve { ok, id } o { ok: false, error }.
async function enviar({ para, asunto, html, texto, encabezados }) {
  if (!configurado()) return { ok: false, error: 'El correo no está configurado en este servidor' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [para], subject: asunto, html, text: texto, headers: encabezados }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      require('./alertas').alertar('correo', 'No se pudo enviar un correo', `Resend respondió ${res.status}: ${data.message || ''}`, { conCorreo: false });
      return { ok: false, error: data.message || `Resend respondió ${res.status}` };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    require('./alertas').alertar('correo', 'No se pudo enviar un correo', err.message, { conCorreo: false });
    return { ok: false, error: 'Error de red al enviar el correo: ' + err.message };
  }
}

module.exports = { configurado, enviar };
