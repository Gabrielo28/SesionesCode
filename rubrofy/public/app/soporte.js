// Ayuda y soporte: buscador (ayudas de cada pantalla y preguntas
// frecuentes), revisión rápida de la cuenta, formulario para escribirle al
// equipo (con captura y detalles técnicos opcionales) y "Mis solicitudes"
// con las respuestas. Ver server/soporte.js y /api/negocios/:id/soporte.
//
// También guarda los últimos errores del panel (pedidos que fallaron y
// errores de JavaScript) para adjuntarlos si el cliente reporta un problema.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinTildes = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const $ = (s) => document.querySelector(s);

  // --- Errores recientes (solo en memoria, se borran al recargar) ---
  const errores = [];
  function registrar(e) {
    errores.push({ cuando: new Date().toISOString(), que: String(e.que || '').replace(/\?.*$/, '').slice(0, 120), estado: e.estado, mensaje: String(e.mensaje || '').slice(0, 300) });
    if (errores.length > 8) errores.shift();
  }
  window.addEventListener('error', (e) => registrar({ que: 'error de la página', mensaje: e.message }));
  window.addEventListener('unhandledrejection', (e) => registrar({ que: 'error de la página', mensaje: e.reason && (e.reason.mensaje || e.reason.message) }));

  const TIPOS = [
    ['problema', 'Algo no funciona', '⚠'],
    ['consulta', 'Tengo una consulta', '?'],
    ['pagos', 'Pagos y facturación', '$'],
    ['sugerencia', 'Una sugerencia', '★'],
  ];
  const VACIAS = new Set(['de', 'la', 'el', 'en', 'mi', 'mis', 'un', 'una', 'que', 'por', 'con', 'los', 'las', 'se', 'no', 'me', 'como', 'para', 'es', 'lo', 'al', 'del', 'y', 'o']);
  const ESTADOS = { abierta: ['Esperando respuesta', 'pend'], respondida: ['Respondida', 'ok'], cerrada: ['Resuelta', 'nulo'] };

  // Preguntas frecuentes. ir: [vista, pestaña, ancla] para el botón.
  function preguntas(n) {
    const op = (n.creditos && n.creditos.opciones) || {};
    const min = (l) => Math.min(...(l || []).map((o) => o.creditos).filter((x) => x > 0));
    const foto = min(op.foto);
    const video = min(op.video);
    return [
      { q: '¿Por qué no se publicó mi publicación?', a: 'Rubrofy publica solo lo que apruebas, en su fecha y hora, y solo si Instagram está conectado. Si una publicación falla, queda en Por aprobar con el motivo y un botón "Reintentar".', ir: ['cola'], b: 'Ir a Por aprobar' },
      { q: 'Instagram dice "Reconectar"', a: 'Instagram pide volver a iniciar sesión cada cierto tiempo o si cambiaste tu clave. Ve a Conexiones y ajustes y pulsa "Reconectar con Instagram". Lo programado se publica solo al reconectar.', ir: ['config', null, 'cfg-conexiones'], b: 'Ir a Conexiones' },
      { q: 'Subí fotos desde el celular y no se ven', a: 'Recarga la página para tener la versión nueva del panel: ahora convierte las fotos del iPhone (HEIC) y las muy pesadas antes de subirlas. Si una foto antigua dice "No se puede mostrar", bórrala y vuelve a subirla.', ir: ['fotos'], b: 'Ir a Galería' },
      { q: 'Una foto o un video con IA falló. ¿Pierdo mis créditos?', a: 'No. Si una creación falla, los créditos se devuelven solos. Puedes ver cada movimiento en Mi cuenta → Créditos.', ir: ['cuenta', null, 'cta-creditos'], b: 'Ver mis créditos' },
      { q: '¿Cuántos créditos usa una foto o un video?', a: `Antes de crear siempre ves cuánto usa.${isFinite(foto) ? ` Una foto usa desde ${foto} ⚡` : ''}${isFinite(video) ? ` y un video de 5 segundos desde ${video} ⚡` : ''}. Tu plan trae créditos cada mes y puedes comprar más.`, ir: ['cuenta', null, 'cta-creditos'], b: 'Ver mis créditos' },
      { q: '¿Cómo cambio el texto o la foto de una publicación?', a: 'En Por aprobar, cada tarjeta tiene "Editar" para el texto y opciones para la foto: elegirla de tu galería, subir una o crearla con IA. Nada se publica sin tu aprobación.', ir: ['cola'], b: 'Ir a Por aprobar' },
      { q: '¿Cómo cancelo o cambio mi plan?', a: 'En Mi cuenta → Plan y pago. Si cancelas, tu plan sigue hasta el fin del período que pagaste y no se vuelve a cobrar.', ir: ['cuenta', null, 'cta-plan'], b: 'Ir a Plan y pago' },
      { q: '¿Cómo cambio mi tarjeta?', a: 'En Mi cuenta → Plan y pago, pulsa "Cambiar tarjeta". Te lleva a Flow para registrar la nueva.', ir: ['cuenta', null, 'cta-plan'], b: 'Ir a Plan y pago' },
      { q: '¿Cómo obtengo mi boleta o factura?', a: 'La boleta electrónica de cada pago te llega por correo desde Flow, al correo con que pagaste (revisa también spam). Si necesitas factura, escríbenos con el formulario de abajo eligiendo "Pagos y facturación" e incluye el RUT, la razón social y el giro.', escribir: 'pagos', b: 'Pedir una factura' },
      { q: 'Olvidé mi clave', a: 'En la pantalla para entrar, pulsa "¿Olvidaste tu clave?" y te llega un enlace a tu correo. Si ya estás dentro, cámbiala en Mi cuenta → Perfil.', ir: ['cuenta', null, 'cta-perfil'], b: 'Ir a Mi cuenta' },
      { q: '¿Puedo cambiar el correo de mi cuenta?', a: 'Sí. Escríbenos con el formulario de abajo desde tu cuenta, indicando el correo nuevo, y lo cambiamos.', escribir: 'consulta', b: 'Escribir' },
      { q: '¿Cómo instalo Rubrofy en mi celular?', a: 'En Android, abre rubrofy.com/app en Chrome y usa "Instalar Rubrofy" en el menú. En iPhone, ábrelo en Safari, toca Compartir y luego "Agregar a inicio".' },
    ];
  }

  // Revisión rápida: lo más común que hace que algo "no funcione".
  function revision(ctx) {
    const n = ctx.negocio;
    const filas = [];
    const ig = n.instagramConectado ? (n.instagramEstado === 'reconectar' ? 'reconectar' : 'ok') : 'no';
    filas.push(ig === 'ok'
      ? { ok: true, t: `Instagram conectado${n.instagramUsuario ? ` (@${esc(n.instagramUsuario)})` : ''}` }
      : { ok: false, t: ig === 'reconectar' ? 'Instagram pide que lo vuelvas a conectar' : 'Instagram no está conectado', d: 'Sin esto, nada se publica solo.', ir: ['config', null, 'cfg-conexiones'], b: ig === 'reconectar' ? 'Reconectar' : 'Conectar' });
    const pg = n.pagos || {};
    if (pg.estado === 'past_due') filas.push({ ok: false, t: 'No pudimos cobrar tu plan', d: 'Cambia la tarjeta para seguir creando contenido.', ir: ['cuenta', null, 'cta-plan'], b: 'Revisar pago' });
    else if (n.sinPlan) filas.push({ ok: false, t: 'No tienes un plan activo', d: 'Elige un plan para crear contenido.', ir: ['cuenta', null, 'cta-plan'], b: 'Ver planes' });
    else filas.push({ ok: true, t: `Plan ${esc((ctx.planes.find((p) => p.id === n.plan) || {}).nombre || n.plan)} activo` });
    const fallidas = (ctx.contenido || []).filter((i) => i.publicacion && i.publicacion.estado === 'fallida').length;
    filas.push(fallidas
      ? { ok: false, t: fallidas === 1 ? '1 publicación no se pudo publicar' : `${fallidas} publicaciones no se pudieron publicar`, d: 'Ahí ves el motivo y puedes reintentar.', ir: ['cola'], b: 'Ver en Por aprobar' }
      : { ok: true, t: 'Ninguna publicación con error' });
    const cr = n.creditos || {};
    filas.push(cr.pausa
      ? { ok: false, t: 'La creación con IA está en pausa por unos minutos', d: 'Ya estamos al tanto. Tus créditos no se pierden.' }
      : { ok: true, t: `Creación con IA disponible${cr.saldo != null ? ` (${cr.saldo} créditos)` : ''}` });
    return filas;
  }

  let ctx = null;
  let solicitudes = null;
  let contacto = null;
  let abierta = null; // id de la solicitud desplegada
  let tipoElegido = 'problema';
  let busqueda = '';

  async function render(c) {
    ctx = c;
    const cont = $('#soporte');
    if (!cont) return;
    if (!cont.dataset.listo) { cont.dataset.listo = '1'; activar(cont); cont.innerHTML = esqueleto(); }
    pintarBuscador();
    pintarRevision();
    pintarPreguntas();
    pintarForm();
    pintarSolicitudes();
    try {
      const r = await ctx.api(`/api/negocios/${ctx.negocio.id}/soporte`);
      solicitudes = r.solicitudes;
      contacto = r.contacto;
      if (ctx.alLeer) ctx.alLeer();
    } catch (e) { if (!solicitudes) solicitudes = []; }
    pintarSolicitudes();
    pintarForm();
  }

  function esqueleto() {
    return `
      <nav class="cfg-indice" aria-label="Secciones de ayuda">
        <a href="#sop-buscar">Buscar</a><a href="#sop-revision">Revisión rápida</a><a href="#sop-preguntas">Preguntas frecuentes</a><a href="#sop-escribir">Escríbenos</a><a href="#sop-mias">Mis solicitudes</a>
      </nav>
      <div class="ig-card sop-buscar" id="sop-buscar">
        <label class="sop-buscar-caja"><span aria-hidden="true">⌕</span><input type="search" data-sop-buscar placeholder="Busca tu duda: publicar, Instagram, créditos, pagos…" aria-label="Buscar en la ayuda" autocomplete="off"></label>
        <div data-sop-resultados></div>
      </div>
      <h2 class="cfg-titulo" id="sop-revision">Revisión rápida de tu cuenta</h2>
      <div class="ig-card" data-sop-revision></div>
      <h2 class="cfg-titulo" id="sop-preguntas">Preguntas frecuentes</h2>
      <div class="ig-card sop-faq" data-sop-preguntas></div>
      <h2 class="cfg-titulo" id="sop-escribir">Escríbenos</h2>
      <div class="ig-card" data-sop-form></div>
      <h2 class="cfg-titulo" id="sop-mias">Mis solicitudes</h2>
      <div class="ig-card" data-sop-mias></div>`;
  }

  function pintarBuscador() {
    const res = $('#soporte [data-sop-resultados]');
    if (!res) return;
    // Se compara por la raíz de cada palabra: "cancelar" encuentra "cancelo" y "cancelas".
    const raiz = (p) => (p.length > 5 ? p.slice(0, Math.max(5, p.length - 2)) : p);
    const palabras = sinTildes(busqueda).split(/[^a-z0-9ñ]+/).filter((p) => p.length > 1 && !VACIAS.has(p)).map(raiz);
    if (!palabras.length) { res.innerHTML = ''; return; }
    const faq = preguntas(ctx.negocio).map((p) => ({ t: p.q, d: p.a, p: [], ir: p.ir, b: p.b, escribir: p.escribir }));
    // Sin la ayuda de Google Ads mientras esté en pausa en el servidor.
    const ayudas = Object.entries((window.Ayuda && window.Ayuda.textos) || {})
      .filter(([k, a]) => !/^admin|^adm-/.test(a.t || '') && (k !== 'google' || ctx.negocio.googleActivo)).map(([, a]) => a);
    const todo = [...faq, ...ayudas.map((a) => ({ t: a.t, d: a.d, p: a.p || [], n: a.n }))];
    // Primero lo que coincide en el título.
    const hallados = todo.map((a) => {
      const txt = sinTildes([a.t, a.d, ...(a.p || []), a.n].join(' '));
      const titulo = sinTildes(a.t);
      return { a, ok: palabras.every((p) => txt.includes(p)), puntos: palabras.filter((p) => titulo.includes(p)).length };
    }).filter((x) => x.ok).sort((x, y) => y.puntos - x.puntos).slice(0, 6).map((x) => x.a);
    res.innerHTML = hallados.length
      ? `<ul class="sop-res">${hallados.map((a, i) => `<li><details${i === 0 ? ' open' : ''}><summary>${esc(a.t)}</summary><p>${esc(a.d)}</p>${a.p && a.p.length ? `<ol>${a.p.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${a.n ? `<p class="sop-nota">${esc(a.n)}</p>` : ''}${botonIr(a)}</details></li>`).join('')}</ul>`
      : `<p class="sub">No encontramos nada con "${esc(busqueda)}". <a href="#sop-escribir" data-sop-escribir="consulta">Escríbenos</a> y te ayudamos.</p>`;
  }

  function botonIr(a) {
    if (a.ir) return `<button type="button" class="btn-ghost sop-ir" data-sop-ir="${esc(a.ir.join('|'))}">${esc(a.b || 'Ir')}</button>`;
    if (a.escribir) return `<button type="button" class="btn-ghost sop-ir" data-sop-escribir="${esc(a.escribir)}">${esc(a.b || 'Escribir')}</button>`;
    return '';
  }

  function pintarRevision() {
    const cont = $('#soporte [data-sop-revision]');
    if (!cont) return;
    const filas = revision(ctx);
    const malas = filas.filter((f) => !f.ok).length;
    cont.innerHTML = `<p class="sub">${malas ? `Encontramos ${malas === 1 ? 'una cosa' : `${malas} cosas`} para revisar:` : 'Todo se ve bien en tu cuenta.'}</p>
      <ul class="sop-rev">${filas.map((f) => `<li class="${f.ok ? 'ok' : 'mal'}"><span class="sop-rev-ic" aria-hidden="true">${f.ok ? '✓' : '!'}</span><span><b>${f.t}</b>${f.d ? `<small>${esc(f.d)}</small>` : ''}</span>${f.ir ? `<button type="button" class="btn-ghost" data-sop-ir="${esc(f.ir.join('|'))}">${esc(f.b)}</button>` : ''}</li>`).join('')}</ul>`;
  }

  function pintarPreguntas() {
    const cont = $('#soporte [data-sop-preguntas]');
    if (!cont) return;
    cont.innerHTML = preguntas(ctx.negocio).map((p) => `<details class="sop-q"><summary>${esc(p.q)}</summary><p>${esc(p.a)}</p>${botonIr(p)}</details>`).join('');
  }

  function detallesTecnicos() {
    return {
      pantalla: ctx.vista || '',
      navegador: navigator.userAgent,
      ventana: `${window.innerWidth}x${window.innerHeight}`,
      version: ((document.querySelector('script[src*="soporte.js"]') || {}).src || '').split('v=')[1] || '',
      errores: errores.slice(),
    };
  }

  function pintarForm() {
    const cont = $('#soporte [data-sop-form]');
    if (!cont) return;
    if (cont.querySelector('form')) { // no se borra lo que ya escribió
      const nota = cont.querySelector('[data-sop-errores]');
      if (nota) nota.textContent = errores.length ? `Incluye ${errores.length === 1 ? 'el último error' : `los últimos ${errores.length} errores`} que vimos en tu panel.` : 'Pantalla y navegador; no incluye tus publicaciones ni tus fotos.';
      const c = cont.querySelector('[data-sop-contacto]');
      if (c && contacto) { c.innerHTML = `¿Prefieres el correo? Escríbenos a <a href="mailto:${esc(contacto)}">${esc(contacto)}</a>.`; c.hidden = false; }
      return;
    }
    cont.innerHTML = `
      <p class="sub">Cuéntanos qué pasó o qué necesitas. Lo lee una persona del equipo de Rubrofy y te responde aquí y por correo (días hábiles).</p>
      <form class="sop-form" data-sop-enviar>
        <div class="sop-tipos" role="radiogroup" aria-label="¿De qué se trata?">${TIPOS.map(([id, t, ic]) => `<label class="sop-tipo"><input type="radio" name="tipo" value="${id}"${id === tipoElegido ? ' checked' : ''}><span><i aria-hidden="true">${ic}</i>${t}</span></label>`).join('')}</div>
        <label>Asunto<input name="asunto" maxlength="120" required placeholder="Ej: No se publicó mi post del martes"></label>
        <label>Cuéntanos<textarea name="texto" rows="5" maxlength="4000" required placeholder="Qué intentabas hacer, qué pasó y qué esperabas que pasara. Si ves un mensaje de error, cópialo aquí."></textarea></label>
        <div class="sop-adjuntar">
          <label class="btn-ghost sop-adj-btn">📎 Adjuntar captura<input type="file" accept="image/*" name="adjunto" hidden></label>
          <span class="sop-adj-nombre" data-sop-adj-nombre>Opcional: una captura de pantalla ayuda mucho.</span>
        </div>
        <label class="switch sop-tecnico"><input type="checkbox" name="tecnico" checked> <span>Incluir detalles técnicos <small data-sop-errores></small></span></label>
        <p class="config-error" data-sop-error hidden></p>
        <div class="config-actions"><button type="submit" class="btn-approve">Enviar</button></div>
      </form>
      <p class="config-ok" data-sop-ok hidden></p>
      <p class="sop-nota" data-sop-contacto hidden></p>`;
    pintarForm();
  }

  function pintarSolicitudes() {
    const cont = $('#soporte [data-sop-mias]');
    if (!cont) return;
    if (!solicitudes) { cont.innerHTML = '<p class="sub">Cargando…</p>'; return; }
    if (!solicitudes.length) { cont.innerHTML = '<p class="sub">Todavía no nos has escrito. Cuando lo hagas, aquí ves cada solicitud y nuestras respuestas.</p>'; return; }
    const base = `/api/negocios/${ctx.negocio.id}/soporte`;
    cont.innerHTML = `<ul class="sop-mias">${solicitudes.map((s) => {
      const [txt, clase] = ESTADOS[s.estado] || [s.estado, 'nulo'];
      const abiertaAhora = abierta === s.id;
      return `<li class="${s.sinLeer ? 'nueva' : ''}">
        <button type="button" class="sop-sol-cab" data-sop-abrir="${s.id}" aria-expanded="${abiertaAhora}">
          <span><b>#${s.id} · ${esc(s.asunto)}</b><small>${esc(s.tipoNombre)} · ${new Date(s.actualizadoEl).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}${s.sinLeer ? ' · <em>Respuesta nueva</em>' : ''}</small></span>
          <span class="cta-estado ${clase}">${txt}</span>
        </button>
        ${abiertaAhora ? `<div class="sop-hilo">
          ${s.mensajes.map((m) => `<div class="sop-msj ${m.autor === 'equipo' ? 'equipo' : 'yo'}"><small>${m.autor === 'equipo' ? 'Equipo Rubrofy' : 'Tú'} · ${new Date(m.creadoEl).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small><p>${esc(m.texto)}</p>${m.adjunto ? `<a href="${base}/${s.id}/adjunto/${encodeURIComponent(m.adjunto)}" target="_blank" rel="noopener"><img src="${base}/${s.id}/adjunto/${encodeURIComponent(m.adjunto)}" alt="Captura adjunta" loading="lazy"></a>` : ''}</div>`).join('')}
          <form class="sop-responder" data-sop-responder="${s.id}">
            <textarea name="texto" rows="3" maxlength="4000" required placeholder="${s.estado === 'cerrada' ? 'Escribe aquí para abrirla de nuevo' : 'Escribe tu respuesta'}"></textarea>
            <p class="config-error" data-sop-error hidden></p>
            <div class="config-actions">${s.estado !== 'cerrada' ? `<button type="button" class="btn-ghost" data-sop-cerrar="${s.id}">Ya se resolvió</button>` : ''}<button type="submit" class="btn-approve">Responder</button></div>
          </form>
        </div>` : ''}
      </li>`;
    }).join('')}</ul>`;
  }

  function ir(destino) {
    const [vista, tab, ancla] = destino.split('|');
    ctx.irA(vista, tab || null, ancla || undefined);
  }

  function activar(cont) {
    let temporizador = null;
    cont.addEventListener('input', (e) => {
      if (!e.target.matches('[data-sop-buscar]')) return;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { busqueda = e.target.value; pintarBuscador(); }, 150);
    });
    cont.addEventListener('change', (e) => {
      if (e.target.name === 'tipo') tipoElegido = e.target.value;
      if (e.target.name === 'adjunto') {
        const f = e.target.files[0];
        cont.querySelector('[data-sop-adj-nombre]').textContent = f ? `📷 ${f.name}` : 'Opcional: una captura de pantalla ayuda mucho.';
      }
    });
    cont.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-sop-ir]');
      if (d) return ir(d.dataset.sopIr);
      const w = e.target.closest('[data-sop-escribir]');
      if (w) {
        e.preventDefault();
        tipoElegido = w.dataset.sopEscribir;
        const radio = cont.querySelector(`input[name="tipo"][value="${tipoElegido}"]`);
        if (radio) radio.checked = true;
        document.getElementById('sop-escribir').scrollIntoView({ block: 'start', behavior: 'smooth' });
        const asunto = cont.querySelector('[data-sop-enviar] [name="asunto"]');
        if (asunto) setTimeout(() => asunto.focus({ preventScroll: true }), 300);
        return;
      }
      const a = e.target.closest('[data-sop-abrir]');
      if (a) { const id = Number(a.dataset.sopAbrir); abierta = abierta === id ? null : id; return pintarSolicitudes(); }
      const c = e.target.closest('[data-sop-cerrar]');
      if (c) {
        c.disabled = true;
        try { await ctx.api(`/api/negocios/${ctx.negocio.id}/soporte/${c.dataset.sopCerrar}/cerrar`, { method: 'POST', body: '{}' }); await recargar(); } catch (err) { alert(err.mensaje || 'No se pudo.'); c.disabled = false; }
      }
    });
    cont.addEventListener('submit', async (e) => {
      const nueva = e.target.closest('[data-sop-enviar]');
      const resp = e.target.closest('[data-sop-responder]');
      if (!nueva && !resp) return;
      e.preventDefault();
      const form = nueva || resp;
      const error = form.querySelector('[data-sop-error]');
      const btn = form.querySelector('button[type="submit"]');
      error.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      try {
        if (nueva) {
          const cuerpo = { tipo: form.tipo.value, asunto: form.asunto.value, texto: form.texto.value };
          if (form.tecnico.checked) cuerpo.contexto = detallesTecnicos();
          const f = form.adjunto.files[0];
          if (f) {
            const lista = window.RubrofyImagen ? await window.RubrofyImagen.preparar(f, { maxLado: 1800 }) : f;
            cuerpo.adjunto = { dataBase64: window.RubrofyImagen ? await window.RubrofyImagen.aBase64(lista) : '' };
          }
          const r = await ctx.api(`/api/negocios/${ctx.negocio.id}/soporte`, { method: 'POST', body: JSON.stringify(cuerpo) });
          form.reset();
          tipoElegido = 'problema';
          cont.querySelector('[data-sop-adj-nombre]').textContent = 'Opcional: una captura de pantalla ayuda mucho.';
          const ok = cont.querySelector('[data-sop-ok]');
          ok.textContent = `Listo, recibimos tu solicitud #${r.solicitud.id}. Te respondemos aquí y por correo.`;
          ok.hidden = false;
          abierta = r.solicitud.id;
          await recargar();
          document.getElementById('sop-mias').scrollIntoView({ block: 'start', behavior: 'smooth' });
        } else {
          await ctx.api(`/api/negocios/${ctx.negocio.id}/soporte/${resp.dataset.sopResponder}/mensajes`, { method: 'POST', body: JSON.stringify({ texto: resp.texto.value }) });
          await recargar();
        }
      } catch (err) {
        error.textContent = err.mensaje || 'No se pudo enviar. Intenta de nuevo.';
        error.hidden = false;
      } finally {
        if (btn.isConnected) { btn.disabled = false; btn.textContent = nueva ? 'Enviar' : 'Responder'; }
      }
    });
  }

  async function recargar() {
    const r = await ctx.api(`/api/negocios/${ctx.negocio.id}/soporte`);
    solicitudes = r.solicitudes;
    pintarSolicitudes();
    if (ctx.alLeer) ctx.alLeer();
  }

  window.RubrofySoporte = { render, registrar };
})();
