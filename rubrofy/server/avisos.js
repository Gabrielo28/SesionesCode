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
function construir({ negocio, ruta, contenido, urlPanel, urlBaja, ahora = Date.now(), forzar = false }) {
  const tareas = ruta.siguientes || [];
  const proximas = proximasDeLaSemana(contenido, ahora);
  if (!tareas.length && !proximas.length && !forzar) return null;
  const pendientes = contenido.filter((i) => i.status === 'pendiente').length;
  const asunto = pendientes
    ? `Tu semana en Rubrofy: ${pendientes} ${pendientes === 1 ? 'publicación espera' : 'publicaciones esperan'} tu aprobación`
    : tareas.length ? `Tu semana en Rubrofy: ${tareas[0].titulo.charAt(0).toLowerCase() + tareas[0].titulo.slice(1)}` : 'Tu semana en Rubrofy';

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
      <p style="margin:0 0 14px;color:#6f6152">${tareas.length ? 'Esto es lo que te toca esta semana:' : 'Estás al día. Esto es lo que se publica esta semana.'}</p>
    </td></tr>
    ${tareas.length ? `<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listaTareas}</table></td></tr>` : ''}
    <tr><td style="padding:18px 28px 6px"><a href="${esc(urlPanel)}" style="display:inline-block;background:#ffac2b;color:#17110a;font:700 14px Arial,sans-serif;text-decoration:none;padding:12px 22px;border-radius:9px">Abrir mi panel</a></td></tr>
    ${proximas.length ? `<tr><td style="padding:18px 28px 4px;font:700 14px Arial,sans-serif;color:#17110a">Se publica en los próximos 7 días (${proximas.length})</td></tr>
    <tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${listaProximas}</table></td></tr>` : ''}
    ${negocio.instagramConectado ? '' : '<tr><td style="padding:12px 28px 0;font:13px Arial,sans-serif;color:#b3412a">Instagram no está conectado: lo que apruebes no se publica hasta que lo conectes.</td></tr>'}
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
    `Abrir mi panel: ${urlPanel}`,
    `No quiero recibirlo más: ${urlBaja}`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

  return { asunto, html, texto };
}

// --- correos puntuales (mismo diseño que el resumen) ---

function plantilla({ titulo, parrafos, boton, pie }) {
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f7f1e8;padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #eee3d3">
    <tr><td style="padding:24px 28px 8px;font:700 18px Arial,sans-serif;color:#111014">rubrofy</td></tr>
    <tr><td style="padding:0 28px;font:15px/1.55 Arial,sans-serif;color:#2b2118">
      <p style="margin:8px 0 12px;font-size:20px;font-weight:700">${esc(titulo)}</p>
      ${parrafos.map((p) => `<p style="margin:0 0 12px;color:#4a4050">${esc(p)}</p>`).join('')}
    </td></tr>
    ${boton ? `<tr><td style="padding:10px 28px 6px"><a href="${esc(boton.url)}" style="display:inline-block;background:#111014;color:#ff4d94;font:700 14px Arial,sans-serif;text-decoration:none;padding:12px 22px;border-radius:9px">${esc(boton.texto)}</a></td></tr>` : ''}
    <tr><td style="padding:22px 28px 24px;font:11.5px/1.5 Arial,sans-serif;color:#8f8578">${esc(pie || 'Recibes este correo porque tienes una cuenta en Rubrofy.')}</td></tr>
  </table></body></html>`;
  const texto = [titulo, '', ...parrafos, '', boton ? `${boton.texto}: ${boton.url}` : '', '', pie || ''].join('\n').replace(/\n{3,}/g, '\n\n').trim();
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

function correoBienvenida({ negocio, urlPanel }) {
  const { html, texto } = plantilla({
    titulo: `Bienvenido a Rubrofy, ${negocio.nombre}`,
    parrafos: ['Tu cuenta está lista. Al entrar al panel, la bienvenida te pregunta tu objetivo, a quién le hablas y cuánto quieres publicar, y con eso arma tu estrategia y tu primera semana de contenido.',
      'Después conecta Instagram: lo que apruebes se publica solo, en su fecha y hora. Nada sale sin tu visto bueno.'],
    boton: { texto: 'Ir a mi panel', url: urlPanel },
  });
  return { para: negocio.email, asunto: 'Tu cuenta de Rubrofy está lista', html, texto };
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
        const mail = construir({ negocio: d.negocioPublico, ruta: d.ruta, contenido: d.contenido, urlPanel: base + '/app', urlBaja: base + deps.enlaceBaja(negocio.id), ahora: ahoraDate.getTime() });
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

module.exports = { construir, crearAvisador, semanaISO, correoClave, correoBienvenida, correoReconectar };
