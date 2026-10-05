// Resumen semanal por correo: cada lunes desde las 8:00 (hora del negocio)
// le dice a cada dueño qué le toca esa semana según su ruta (server/ruta.js)
// y qué se publica en los próximos 7 días. Se manda una vez por semana
// ISO, solo si hay algo que decir, y cada correo trae un enlace para darse
// de baja. Sin correo configurado (server/correo.js) no hace nada.

const programacion = require('./programacion');
const correo = require('./correo');

const HORA_ENVIO = Number(process.env.AVISOS_HORA || 8);
const SINGULAR = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// "2026-W40" para la fecha local (año, mes, día).
function semanaISO({ anio, mes, dia }) {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicio) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

function diaDeSemana({ anio, mes, dia }) {
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

function fechaCorta(iso) {
  const p = programacion.partesEnZona(new Date(iso));
  return `${DIAS[diaDeSemana(p)]} ${p.dia} ${MESES[p.mes - 1]} · ${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`;
}

function proximasDeLaSemana(contenido, ahora) {
  return contenido
    .filter((i) => i.status === 'aprobado' && !(i.publicacion && i.publicacion.estado === 'publicada') && i.publicarEl)
    .filter((i) => { const t = Date.parse(i.publicarEl); return t >= ahora && t <= ahora + 7 * 86400000; })
    .sort((a, b) => Date.parse(a.publicarEl) - Date.parse(b.publicarEl));
}

// Arma el correo. Devuelve null si no hay nada que contar.
// extra (opcional): { dato, faltan, urlAprobarTodo, racha, referido: { enlace, creditos } }
// (server/fidelizacion.js): el dato de la semana pasada, lo que falta,
// "Aprobar todo" sin entrar al panel y la racha.
function construir({ negocio, ruta, contenido, urlPanel, urlBaja, ahora = Date.now(), forzar = false, extra = {} }) {
  const tareas = ruta.siguientes || [];
  const proximas = proximasDeLaSemana(contenido, ahora);
  if (!tareas.length && !proximas.length && !forzar) return null;
  const pendientes = contenido.filter((i) => i.status === 'pendiente').length;
  const asunto = pendientes
    ? `Tu semana en Rubrofy está lista: ${pendientes} ${pendientes === 1 ? 'publicación espera' : 'publicaciones esperan'} tu aprobación`
    : tareas.length ? `Tu semana en Rubrofy: ${tareas[0].titulo.charAt(0).toLowerCase() + tareas[0].titulo.slice(1)}` : 'Tu semana en Rubrofy';
  const d = extra.dato;
  const datoHtml = d ? `<tr><td style="padding:14px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4f8;border:1px solid #ffd0e2;border-radius:10px"><tr><td style="padding:12px 14px;font:14px/1.5 Arial,sans-serif;color:#2b2118">
      <b>📈 Tu ${esc(d.formato)} que mejor anduvo la semana pasada</b><br>${d.texto ? `<span style="color:#6f6152">“${esc(d.texto)}”</span><br>` : ''}
      <b>${d.alcance.toLocaleString('es-CL')}</b> personas la vieron${d.interacciones ? ` · <b>${d.interacciones.toLocaleString('es-CL')}</b> interacciones` : ''}${d.permalink ? ` · <a href="${esc(d.permalink)}" style="color:#b3412a">verla</a>` : ''}
    </td></tr></table></td></tr>` : '';
  const f = extra.faltan || {};
  const faltaHtml = f.reelsSinVideo ? `<tr><td style="padding:12px 28px 0;font:13.5px/1.5 Arial,sans-serif;color:#b3412a">🎬 ${f.reelsSinVideo === 1 ? '1 reel espera su video' : `${f.reelsSinVideo} reels esperan su video`}: súbelo desde el celular en Estudio de reels.</td></tr>` : '';
  const briefHtml = extra.urlBrief ? `<tr><td style="padding:12px 28px 0;font:13.5px/1.5 Arial,sans-serif;color:#6f6152">📝 ¿Algo especial esta semana (una promo, un lanzamiento, un tema)? <a href="${esc(extra.urlBrief)}" style="color:#b3412a;font-weight:700">Cuéntaselo a Rubrofy</a> antes de generar y la semana sale así.</td></tr>` : '';
  const rachaHtml = extra.racha >= 2 ? `<tr><td style="padding:12px 28px 0;font:13.5px Arial,sans-serif;color:#6f6152">🔥 Llevas <b style="color:#2b2118">${extra.racha} semanas seguidas</b> publicando. Aprueba esta semana y la racha sigue.</td></tr>` : '';
  const aprobarHtml = pendientes && extra.urlAprobarTodo ? `<a href="${esc(extra.urlAprobarTodo)}" style="display:inline-block;margin-left:10px;color:#2b2118;font:700 14px Arial,sans-serif;text-decoration:underline;padding:12px 0">Aprobar todo sin entrar</a>` : '';
  const ref = extra.referido;
  const refHtml = ref && ref.enlace && d ? `<tr><td style="padding:14px 28px 0;font:12.5px/1.5 Arial,sans-serif;color:#6f6152">¿Conoces otro negocio al que le serviría? Si se suscribe con tu enlace, <b>ustedes dos ganan ${ref.creditos} créditos ⚡</b>: <a href="${esc(ref.enlace)}" style="color:#b3412a">${esc(ref.enlace)}</a></td></tr>` : '';

  const listaTareas = tareas.map((t, i) => `
    <tr><td style="padding:10px 0;border-top:1px solid #eee3d3;vertical-align:top;width:28px">
      <span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:${i === 0 ? '#ffac2b' : '#f3eadc'};color:#17110a;font:700 12px/22px Arial,sans-serif;text-align:center">${i + 1}</span></td>
      <td style="padding:10px 0 10px 8px;border-top:1px solid #eee3d3;font:14px/1.45 Arial,sans-serif;color:#2b2118">
      <b>${esc(t.titulo)}</b><br><span style="color:#6f6152">${esc(t.detalle)}</span></td></tr>`).join('');
  const listaProximas = proximas.slice(0, 8).map((i) => `
    <tr><td style="padding:6px 0;font:12px Arial,sans-serif;color:#6f6152;white-space:nowrap;vertical-align:top">${esc(fechaCorta(i.publicarEl))}</td>
      <td style="padding:6px 8px;font:700 11px Arial,sans-serif;color:#b86e0c;vertical-align:top">${esc(SINGULAR[i.formato] || 'Post')}</td>
      <td style="padding:6px 0;font:13px Arial,sans-serif;color:#2b2118">${esc(((i.variants && i.variants[i.variantIndex || 0]) || i.headline || '').slice(0, 90))}</td></tr>`).join('');

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f7f1e8;padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #eee3d3">
    <tr><td style="padding:24px 28px 8px;font:700 18px Arial,sans-serif;color:#17110a">Rubrofy</td></tr>
    <tr><td style="padding:0 28px;font:15px/1.5 Arial,sans-serif;color:#2b2118">
      <p style="margin:8px 0 4px;font-size:20px;font-weight:700">Hola, ${esc(negocio.nombre)}</p>
      <p style="margin:0 0 14px;color:#6f6152">${pendientes ? `Rubrofy te preparó ${pendientes === 1 ? '1 publicación' : `${pendientes} publicaciones`}. Aprobarlas te toma unos 5 minutos.` : tareas.length ? 'Esto es lo que te toca esta semana:' : 'Estás al día. Esto es lo que se publica esta semana.'}</p>
    </td></tr>
    ${tareas.length ? `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listaTareas}</table></td></tr>` : ''}
    <tr><td style="padding:18px 28px 6px"><a href="${esc(pendientes ? urlPanel + '#cola' : urlPanel)}" style="display:inline-block;background:#ffac2b;color:#17110a;font:700 14px Arial,sans-serif;text-decoration:none;padding:12px 22px;border-radius:9px">${pendientes ? 'Revisar y aprobar' : 'Abrir mi panel'}</a>${aprobarHtml}</td></tr>
    ${datoHtml}${faltaHtml}${rachaHtml}${briefHtml}
    ${proximas.length ? `<tr><td style="padding:18px 28px 4px;font:700 14px Arial,sans-serif;color:#17110a">Se publica en los próximos 7 días (${proximas.length})</td></tr>
    <tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listaProximas}</table></td></tr>` : ''}
    ${negocio.instagramConectado ? '' : '<tr><td style="padding:12px 28px 0;font:13px Arial,sans-serif;color:#b3412a">Instagram no está conectado: lo que apruebes no se publica hasta que lo conectes.</td></tr>'}
    ${refHtml}
    <tr><td style="padding:22px 28px 24px;font:11.5px/1.5 Arial,sans-serif;color:#8f8578">Recibes este resumen los lunes porque tienes una cuenta en Rubrofy.
      <a href="${esc(urlBaja)}" style="color:#8f8578">No quiero recibirlo más</a>.</td></tr>
  </table></body></html>`;

  const texto = [
    `Hola, ${negocio.nombre}`,
    tareas.length ? 'Esto es lo que te toca esta semana:' : 'Estás al día.',
    ...tareas.map((t, i) => `${i + 1}. ${t.titulo}: ${t.detalle}`),
    '',
    proximas.length ? `Se publica en los próximos 7 días (${proximas.length}):` : '',
    ...proximas.slice(0, 8).map((i) => `- ${fechaCorta(i.publicarEl)} · ${SINGULAR[i.formato] || 'Post'}`),
    '',
    d ? `Tu ${d.formato} que mejor anduvo: ${d.alcance} personas la vieron${d.interacciones ? `, ${d.interacciones} interacciones` : ''}.` : '',
    f.reelsSinVideo ? `${f.reelsSinVideo} reel(s) esperan su video.` : '',
    extra.racha >= 2 ? `Llevas ${extra.racha} semanas seguidas publicando.` : '',
    `Abrir mi panel: ${urlPanel}`,
    pendientes && extra.urlAprobarTodo ? `Aprobar todo sin entrar: ${extra.urlAprobarTodo}` : '',
    `No quiero recibirlo más: ${urlBaja}`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  return { asunto, html, texto };
}

// --- correos puntuales (mismo diseño que el resumen) ---

function plantilla({ titulo, parrafos, boton, pie, enlace }) {
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f7f1e8;padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #eee3d3">
    <tr><td style="padding:24px 28px 8px;font:700 18px Arial,sans-serif;color:#111014">Rubrofy</td></tr>
    <tr><td style="padding:0 28px;font:15px/1.55 Arial,sans-serif;color:#2b2118">
      <p style="margin:8px 0 12px;font-size:20px;font-weight:700">${esc(titulo)}</p>
      ${parrafos.map((p) => `<p style="margin:0 0 12px;color:#4a4050">${esc(p)}</p>`).join('')}
    </td></tr>
    ${boton ? `<tr><td style="padding:10px 28px 6px"><a href="${esc(boton.url)}" style="display:inline-block;background:#111014;color:#ff4d94;font:700 14px Arial,sans-serif;text-decoration:none;padding:12px 22px;border-radius:9px">${esc(boton.texto)}</a>${enlace ? `<a href="${esc(enlace.url)}" style="display:inline-block;margin-left:12px;color:#2b2118;font:700 14px Arial,sans-serif;text-decoration:underline;padding:12px 0">${esc(enlace.texto)}</a>` : ''}</td></tr>` : ''}
    <tr><td style="padding:22px 28px 24px;font:11.5px/1.5 Arial,sans-serif;color:#8f8578">${esc(pie || 'Recibes este correo porque tienes una cuenta en Rubrofy.')}</td></tr>
  </table></body></html>`;
  const texto = [titulo, '', ...parrafos, '', boton ? `${boton.texto}: ${boton.url}` : '', enlace ? `${enlace.texto}: ${enlace.url}` : '', '', pie || ''].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { html, texto };
}

function correoClave({ negocio, enlace }) {
  const { html, texto } = plantilla({
    titulo: 'Elige una clave nueva',
    parrafos: [`Alguien pidió cambiar la clave de ${negocio.nombre} en Rubrofy. Si fuiste tú, usa el botón: el enlace vale 30 minutos y sirve una sola vez.`,
      'Si no lo pediste, ignora este correo: tu clave sigue igual.'],
    boton: { texto: 'Elegir clave nueva', url: enlace },
    pie: 'Por seguridad, al cambiar la clave se cierran las sesiones abiertas en otros dispositivos.',
  });
  return { para: negocio.email, asunto: 'Cambia tu clave de Rubrofy', html, texto };
}

// enlaceVerificar: confirma el correo y entra al panel (cuentas nuevas).
function correoBienvenida({ negocio, urlPanel, enlaceVerificar }) {
  const { html, texto } = plantilla({
    titulo: `Bienvenido a Rubrofy, ${negocio.nombre}`,
    parrafos: [...(enlaceVerificar ? ['Primero, confirma que este es tu correo con el botón de abajo: así puedes recuperar tu clave y te llegan los avisos importantes.'] : []),
      'Tu cuenta está lista. Al entrar al panel, la bienvenida te pregunta tu objetivo, a quién le hablas y cuánto quieres publicar, y con eso arma tu estrategia y tu primera semana de contenido.',
      'Después conecta Instagram: lo que apruebes se publica solo, en su fecha y hora. Nada sale sin tu visto bueno.',
      ...(enlaceVerificar && urlPanel ? [`Tu panel: ${urlPanel}`] : [])],
    boton: enlaceVerificar ? { texto: 'Confirmar mi correo', url: enlaceVerificar } : { texto: 'Ir a mi panel', url: urlPanel },
    pie: enlaceVerificar ? 'El enlace vale 7 días. Si no creaste esta cuenta, ignora este correo.' : undefined,
  });
  return { para: negocio.email, asunto: 'Tu cuenta de Rubrofy está lista', html, texto };
}

function correoVerificar({ negocio, enlace }) {
  const { html, texto } = plantilla({
    titulo: 'Confirma tu correo',
    parrafos: [`Confirma que ${negocio.email} es el correo de ${negocio.nombre} en Rubrofy. Así puedes recuperar tu clave y te llegan los avisos importantes (cobros, publicaciones que fallan).`],
    boton: { texto: 'Confirmar mi correo', url: enlace },
    pie: 'El enlace vale 7 días. Si no lo pediste, ignora este correo.',
  });
  return { para: negocio.email, asunto: 'Confirma tu correo en Rubrofy', html, texto };
}

// Al correo anterior, por seguridad, cuando la cuenta cambia de correo.
function correoEmailCambiado({ negocio, anterior, nuevo, porEquipo }) {
  const { html, texto } = plantilla({
    titulo: 'Cambió el correo de tu cuenta',
    parrafos: [`El correo para entrar a ${negocio.nombre} en Rubrofy cambió de ${anterior} a ${nuevo}${porEquipo ? ', a pedido tuyo, por el equipo de Rubrofy' : ''}.`, 'Si no fuiste tú, responde a soporte de inmediato para recuperar tu cuenta.'],
    pie: 'Te escribimos a este correo porque era el de tu cuenta.',
  });
  return { para: anterior, asunto: 'Cambió el correo de tu cuenta de Rubrofy', html, texto };
}

function correoReconectar({ negocio, urlPanel, motivo }) {
  const { html, texto } = plantilla({
    titulo: 'Reconecta tu Instagram',
    parrafos: [`Instagram dejó de aceptar la conexión de ${negocio.nombre}${motivo ? ` (${motivo})` : ''}. Lo que tienes programado está en espera: no se pierde, pero no se publicará hasta que reconectes.`,
      'Entra a Conexiones y ajustes y vuelve a conectar Instagram. Lo programado sale solo al reconectar.'],
    boton: { texto: 'Reconectar Instagram', url: urlPanel },
  });
  return { para: negocio.email, asunto: 'Tu Instagram se desconectó de Rubrofy', html, texto };
}

// --- Correos de la cuenta: prueba, plan, cobros y publicaciones ---
// urlPanel puede faltar (sin PUBLIC_URL): el correo va sin botón.
const clp = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
const boton = (texto, url) => (url ? { texto, url } : null);
const fechaLarga = (iso) => (iso ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

function correoPrueba({ negocio, urlPanel, termino }) {
  const { html, texto } = plantilla({
    titulo: termino ? 'Terminó tu prueba gratis' : 'Tu prueba gratis termina en 2 días',
    parrafos: termino
      ? [`La prueba gratis de ${negocio.nombre} en Rubrofy terminó. Todo lo que armaste sigue guardado: tu estrategia, tus publicaciones y tus fotos.`, 'Elige un plan para seguir creando y publicando. Pagas con tarjeta y cancelas cuando quieras.']
      : [`A la prueba gratis de ${negocio.nombre} le quedan 2 días.`, 'Si eliges tu plan antes, no se corta nada: tus publicaciones programadas siguen saliendo solas.'],
    boton: boton('Elegir mi plan', urlPanel),
  });
  return { para: negocio.email, asunto: termino ? 'Terminó tu prueba gratis de Rubrofy' : 'Tu prueba gratis de Rubrofy termina en 2 días', html, texto };
}

function correoRegaloTermino({ negocio, urlPanel }) {
  const { html, texto } = plantilla({
    titulo: 'Terminó tu plan de regalo',
    parrafos: [`El plan de regalo de ${negocio.nombre} en Rubrofy terminó. Todo lo que armaste sigue guardado.`, 'Elige un plan para seguir creando y publicando.'],
    boton: boton('Elegir mi plan', urlPanel),
  });
  return { para: negocio.email, asunto: 'Terminó tu plan de regalo en Rubrofy', html, texto };
}

function correoCobroFallido({ negocio, urlPanel, tarjeta }) {
  const { html, texto } = plantilla({
    titulo: 'No pudimos cobrar tu plan',
    parrafos: [`Intentamos cobrar el plan de ${negocio.nombre} ${tarjeta ? `con ${tarjeta}` : 'con tu tarjeta'} y no se pudo.`, 'Mientras tanto, la creación de contenido queda en pausa. Cambia la tarjeta en Mi cuenta → Plan y pago y todo vuelve a funcionar.'],
    boton: boton('Revisar mi pago', urlPanel),
    pie: 'Si ya lo resolviste, ignora este correo.',
  });
  return { para: negocio.email, asunto: 'No pudimos cobrar tu plan de Rubrofy', html, texto };
}

// detalle: "Plan Pro" o "150 créditos para fotos y videos con IA".
function correoRecibo({ negocio, urlPanel, montoClp, detalle, periodo, fecha }) {
  const { html, texto } = plantilla({
    titulo: 'Recibimos tu pago',
    parrafos: [`Gracias. Recibimos ${clp(montoClp)} (IVA incluido) de ${negocio.nombre}.`, `Detalle: ${detalle}${periodo ? `, del ${fechaLarga(periodo.desde)} al ${fechaLarga(periodo.hasta)}` : ''}. Fecha: ${fechaLarga(fecha || new Date().toISOString())}.`,
      'La boleta electrónica te llega aparte, por correo desde Flow. Ves todos tus pagos en Mi cuenta → Pagos y facturación; si necesitas factura, escríbenos desde Ayuda y soporte.'],
    boton: boton('Ver mis pagos', urlPanel),
    pie: 'Este correo es un comprobante de pago; la boleta electrónica la envía Flow.',
  });
  return { para: negocio.email, asunto: `Recibimos tu pago de ${clp(montoClp)} · Rubrofy`, html, texto };
}

function correoCancelacion({ negocio, urlPanel, hasta }) {
  const { html, texto } = plantilla({
    titulo: 'Cancelaste tu suscripción',
    parrafos: [`La suscripción de ${negocio.nombre} quedó cancelada. ${hasta ? `Tu plan sigue funcionando hasta el ${fechaLarga(hasta)}` : 'Tu plan sigue funcionando hasta el fin del período que pagaste'} y no se vuelve a cobrar.`, 'Si cambias de opinión, elige un plan de nuevo cuando quieras: todo lo que armaste sigue guardado.'],
    boton: boton('Ir a mi cuenta', urlPanel),
  });
  return { para: negocio.email, asunto: 'Cancelaste tu suscripción de Rubrofy', html, texto };
}

function correoPublicacionFallida({ negocio, urlPanel, formato, motivo }) {
  const { html, texto } = plantilla({
    titulo: `No se pudo publicar tu ${formato}`,
    parrafos: [`Instagram no aceptó una publicación de ${negocio.nombre}${motivo ? `: ${motivo}` : '.'}`, 'Entra a Por aprobar: ahí ves el motivo y puedes pulsar "Reintentar" cuando esté resuelto.'],
    boton: boton('Revisar la publicación', urlPanel),
  });
  return { para: negocio.email, asunto: `No se pudo publicar tu ${formato} en Instagram`, html, texto };
}

// --- fidelización (server/fidelizacion.js) ---

function correoRescate({ negocio, urlPanel, urlAprobarTodo, dias, pendientes }) {
  const { html, texto } = plantilla({
    titulo: `${pendientes === 1 ? 'Tienes 1 publicación esperando' : `Tienes ${pendientes} publicaciones esperando`}`,
    parrafos: [`Hace ${dias} días que no entras a Rubrofy y ${negocio.nombre} tiene contenido listo que no se publica hasta que lo apruebes.`,
      'Si te parece bien como está, apruébalo todo con un clic y se publica solo en su fecha. Si prefieres revisarlo, entra al panel: te toma unos 5 minutos.'],
    boton: boton('Aprobar todo ahora', urlAprobarTodo),
    enlace: boton('Revisarlo en el panel', urlPanel),
    pie: 'Te escribimos porque tienes contenido esperando. Si ya no quieres publicar, puedes pausar tu plan desde Mi cuenta.',
  });
  return { para: negocio.email, asunto: `${negocio.nombre}: ${pendientes === 1 ? 'una publicación' : `${pendientes} publicaciones`} esperan tu visto bueno`, html, texto };
}

// Personal, desde el equipo (responder llega a CONTACTO_EMAIL).
function correoRiesgo({ negocio, urlPanel, urlPausa, dias, contacto }) {
  const { html, texto } = plantilla({
    titulo: `¿Cómo va ${negocio.nombre}?`,
    parrafos: [`Vi que hace ${dias} días que no entras a Rubrofy y quería preguntarte directamente: ¿pasó algo? ¿Hay algo que no te esté funcionando o que te esté costando?`,
      'Responde a este correo y te leo yo. Si es un mes complicado, puedes pausar tu plan sin costo y volver cuando quieras; todo queda guardado.',
      'Y si ya no lo necesitas, también sirve saberlo: me ayuda a mejorar Rubrofy.'],
    boton: boton('Abrir Rubrofy', urlPanel),
    enlace: boton('Pausar mi plan un mes', urlPausa),
    pie: contacto ? `Puedes responder a este correo o escribir a ${contacto}.` : 'Puedes responder a este correo.',
  });
  return { para: negocio.email, asunto: `¿Cómo va ${negocio.nombre}?`, html, texto, responderA: contacto || undefined };
}

function correoPausa({ negocio, urlPanel, finPagado, hasta }) {
  const { html, texto } = plantilla({
    titulo: 'Tu plan queda en pausa',
    parrafos: [`${negocio.nombre} sigue con todo hasta el ${fechaLarga(finPagado)} (lo que ya pagaste). Después no se cobra nada durante la pausa.`,
      `El ${fechaLarga(hasta)} tu plan se reanuda solo con la misma tarjeta y te avisamos 3 días antes. Si quieres volver antes, en Mi cuenta hay un botón para reanudar.`,
      'Tu estrategia, tus fotos, tus videos y tu contenido quedan guardados tal cual.'],
    boton: boton('Ir a mi cuenta', urlPanel),
  });
  return { para: negocio.email, asunto: 'Tu plan de Rubrofy queda en pausa', html, texto };
}

function correoPausaTermina({ negocio, urlPanel, hasta }) {
  const { html, texto } = plantilla({
    titulo: 'Tu pausa termina en 3 días',
    parrafos: [`El ${fechaLarga(hasta)} se reanuda el plan de ${negocio.nombre} y se cobra con la tarjeta que tienes inscrita.`,
      'Si necesitas más tiempo, en Mi cuenta puedes cancelar antes de esa fecha y no se cobra nada.'],
    boton: boton('Ir a mi cuenta', urlPanel),
  });
  return { para: negocio.email, asunto: 'Tu pausa en Rubrofy termina en 3 días', html, texto };
}

function correoPausaFallo({ negocio, urlPanel, error }) {
  const { html, texto } = plantilla({
    titulo: 'No pudimos reanudar tu plan',
    parrafos: [`Terminó la pausa de ${negocio.nombre}, pero no se pudo volver a activar el plan${error ? `: ${error}` : '.'}`, 'Entra a Mi cuenta y elige tu plan de nuevo; todo lo tuyo sigue guardado.'],
    boton: boton('Elegir mi plan', urlPanel),
  });
  return { para: negocio.email, asunto: 'No pudimos reanudar tu plan de Rubrofy', html, texto };
}

function correoReanudada({ negocio, urlPanel }) {
  const { html, texto } = plantilla({
    titulo: 'Tu plan se reanudó',
    parrafos: [`Bienvenido de vuelta. ${negocio.nombre} ya tiene su plan activo otra vez: genera tu semana cuando quieras y Rubrofy la deja lista para aprobar.`],
    boton: boton('Generar mi semana', urlPanel),
  });
  return { para: negocio.email, asunto: 'Tu plan de Rubrofy se reanudó', html, texto };
}

function correoAniversario({ negocio, urlPanel, logros, premio, referido }) {
  const l = logros || {};
  const parrafos = [`Hace 3 meses que ${negocio.nombre} publica con Rubrofy. Un resumen de lo que lograste:`,
    `· ${l.publicacionesTotal || 0} publicaciones en Instagram sin tener que sentarte a escribirlas.`,
    l.alcance ? `· Solo este mes, ${Number(l.alcance).toLocaleString('es-CL')} personas vieron tu contenido.` : '· Conecta Instagram y en el próximo resumen te contamos a cuánta gente llegas.',
    l.racha >= 2 ? `· Llevas ${l.racha} semanas seguidas publicando.` : '',
    premio ? `Para celebrarlo te regalamos ${premio} créditos ⚡: úsalos en fotos o videos con IA.` : '',
    referido && referido.enlace ? `Y si conoces otro negocio al que le serviría, con tu enlace ustedes dos ganan ${referido.creditos} créditos: ${referido.enlace}` : ''].filter(Boolean);
  const { html, texto } = plantilla({ titulo: '3 meses con Rubrofy 🎉', parrafos, boton: boton('Ver mis resultados', urlPanel) });
  return { para: negocio.email, asunto: `3 meses con Rubrofy: lo que logró ${negocio.nombre}`, html, texto };
}

// deps: { listarNegocios(), datosDe(negocio) → { negocioPublico, ruta, contenido },
//         urlPublica() → string|null, enlaceBaja(negocioId) → path, guardarEnvio(negocioId, semana), log }
function crearAvisador(deps) {
  const log = deps.log || console.log;
  let timer = null;
  let corriendo = false;

  // Aviso inmediato (cualquier día) cuando Instagram deja de aceptar la
  // conexión: una vez por desconexión; al reconectar se reinicia solo.
  async function reconexiones(base) {
    let enviados = 0;
    for (const negocio of deps.listarNegocios()) {
      const ig = negocio.instagram;
      if (!negocio.email || !ig || ig.estado !== 'reconectar' || ig.avisoReconectarEl) continue;
      deps.guardarAvisoReconectar(negocio.id);
      const r = await correo.enviar(correoReconectar({ negocio, urlPanel: base + '/app', motivo: ig.motivoReconexion }));
      if (r.ok) enviados += 1;
      else log(`Aviso de reconexión de ${negocio.id} no enviado: ${r.error}`);
    }
    return enviados;
  }

  async function revisar(ahoraDate = new Date()) {
    if (corriendo || !correo.configurado()) return { enviados: 0 };
    const base = deps.urlPublica();
    if (!base) return { enviados: 0 };
    corriendo = true;
    let avisosReconexion = 0;
    try { avisosReconexion = await reconexiones(base); } finally { corriendo = false; }
    const resultado = await resumenesSemanales(base, ahoraDate);
    return Object.assign(resultado, { reconexiones: avisosReconexion });
  }

  async function resumenesSemanales(base, ahoraDate) {
    if (corriendo) return { enviados: 0 };
    const p = programacion.partesEnZona(ahoraDate);
    if (diaDeSemana(p) !== 1 || p.hora < HORA_ENVIO) return { enviados: 0 };
    const semana = semanaISO(p);
    corriendo = true;
    let enviados = 0;
    try {
      for (const negocio of deps.listarNegocios()) {
        const avisos = negocio.avisos || {};
        if (!negocio.email || !negocio.bienvenidaCompletada || avisos.semanal === false || avisos.ultimaSemana === semana) continue;
        // Se marca antes de enviar: si el envío falla no se reintenta en bucle esa semana.
        deps.guardarEnvio(negocio.id, semana);
        const d = deps.datosDe(negocio);
        const mail = construir({ negocio: d.negocioPublico, ruta: d.ruta, contenido: d.contenido, urlPanel: base + '/app', urlBaja: base + deps.enlaceBaja(negocio.id), ahora: ahoraDate.getTime(), extra: deps.extraDe ? deps.extraDe(negocio, base) : {} });
        if (!mail) continue;
        const r = await correo.enviar({ para: negocio.email, asunto: mail.asunto, html: mail.html, texto: mail.texto, encabezados: { 'List-Unsubscribe': `<${base + deps.enlaceBaja(negocio.id)}>` } });
        if (r.ok) enviados += 1;
        else log(`Resumen semanal de ${negocio.id} no enviado: ${r.error}`);
      }
    } finally {
      corriendo = false;
    }
    return { enviados, semana };
  }

  return {
    revisar,
    iniciar() {
      if (timer) return;
      const tick = () => revisar().catch((err) => log('Error en resúmenes semanales: ' + err.message));
      timer = setInterval(tick, Number(process.env.AVISOS_INTERVALO_SEG || 600) * 1000);
      timer.unref();
      tick();
    },
    detener() { clearInterval(timer); timer = null; },
  };
}

module.exports = {
  construir, crearAvisador, semanaISO, correoClave, correoBienvenida, correoReconectar, plantilla,
  correoVerificar, correoEmailCambiado, correoPrueba, correoRegaloTermino, correoCobroFallido, correoRecibo, correoCancelacion, correoPublicacionFallida,
  correoRescate, correoRiesgo, correoPausa, correoPausaTermina, correoPausaFallo, correoReanudada, correoAniversario,
};
