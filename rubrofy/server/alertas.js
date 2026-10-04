// Alertas al equipo (ADMIN_EMAILS) cuando algo falla por detrás y los
// clientes no lo ven: Claude no responde (los textos salen de plantilla),
// Flow da error, el servidor tira un error interno, falla un respaldo o una
// publicación. Cada tipo manda como mucho un correo por hora
// (ALERTAS_CADA_MIN); si sigue fallando, el siguiente dice cuántas veces
// pasó. Las últimas se ven en /admin → Sistema.

const TOPE_MIN = () => Number(process.env.ALERTAS_CADA_MIN) || 60;
const estado = new Map(); // clave → { ultimoCorreo, veces }
const recientes = [];     // las últimas 30, para /admin

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Registra la alerta y, si corresponde, avisa por correo. conCorreo: false
// solo la deja en /admin (por ejemplo, cuando lo que falla es el correo).
function alertar(clave, asunto, detalle, { conCorreo = true } = {}) {
  const ahora = Date.now();
  const e = estado.get(clave) || { ultimoCorreo: 0, veces: 0 };
  e.veces += 1;
  estado.set(clave, e);
  const ultima = recientes[0];
  if (ultima && ultima.clave === clave && ultima.asunto === asunto) { ultima.veces += 1; ultima.cuando = new Date(ahora).toISOString(); ultima.detalle = String(detalle || '').slice(0, 300); }
  else {
    recientes.unshift({ clave, asunto, detalle: String(detalle || '').slice(0, 300), cuando: new Date(ahora).toISOString(), veces: 1 });
    if (recientes.length > 30) recientes.pop();
  }
  console.error(`Alerta [${clave}] ${asunto}${detalle ? ': ' + detalle : ''}`);
  if (!conCorreo || ahora - e.ultimoCorreo < TOPE_MIN() * 60000) return false;
  const veces = e.veces;
  e.ultimoCorreo = ahora;
  e.veces = 0;
  const correo = require('./correo');
  if (!correo.configurado()) return false;
  const texto = `${detalle || ''}${veces > 1 ? `\n\nPasó ${veces} veces desde el último aviso.` : ''}\n\nMás detalles en /admin → Sistema.`;
  for (const para of require('./admin').adminEmails()) {
    correo.enviar({ para, asunto: `Rubrofy · Alerta: ${asunto}`, texto, html: `<p>${esc(texto).replace(/\n/g, '<br>')}</p>` });
  }
  return true;
}

function ultimas() {
  return recientes.slice(0, 15);
}

module.exports = { alertar, ultimas };
