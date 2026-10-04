// Mi cuenta: perfil y acceso (correo, cambiar la clave), créditos (saldo,
// en qué se usaron, invitar), pagos (cobros del plan y compras de créditos)
// y sesión (cerrar sesión, cerrarla en todos lados, eliminar la cuenta).
// La tarjeta del plan (#plan-card) la dibuja app.js. Ver server/server.js:
// /api/negocios/:id/cuenta y /creditos.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clp = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
  // Acepta '2026-10-04' (día, sin hora) o una fecha ISO completa.
  const aFecha = (f) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f || ''));
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(f);
    return isNaN(d) ? null : d;
  };
  const dia = (f, conAno = true) => { const d = aFecha(f); return d ? d.toLocaleDateString('es-CL', Object.assign({ day: 'numeric', month: 'short' }, conAno ? { year: 'numeric' } : {})) : ''; };
  const ESTADOS = { pagado: ['Pagado', 'ok'], pendiente: ['Pendiente', 'pend'], anulado: ['Anulado', 'nulo'], simulada: ['Prueba, sin cobro', 'nulo'] };

  let ctx = null;
  let cuenta = null;
  let creditos = null;
  let claveAbierta = false;

  const n = () => ctx.negocio;
  const $ = (s) => document.querySelector(s);

  async function render(c) {
    ctx = c;
    activar();
    pintarPerfil();
    pintarCreditos();
    pintarPagos();
    const [a, b] = await Promise.all([
      ctx.api(`/api/negocios/${n().id}/cuenta`).catch(() => null),
      ctx.api(`/api/negocios/${n().id}/creditos`).catch(() => null),
    ]);
    cuenta = a || { error: true };
    creditos = b || { error: true };
    pintarPerfil();
    pintarCreditos();
    pintarPagos();
  }

  // --- Perfil y acceso ---
  function pintarPerfil() {
    const cont = $('#cuenta-perfil');
    if (!cont) return;
    const neg = n();
    const plan = (ctx.planes || []).find((p) => p.id === (neg.plan || 'gratis'));
    const iniciales = (neg.nombre || '??').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
    const desde = aFecha(neg.creadoEl);
    const contacto = cuenta && cuenta.contacto;
    cont.innerHTML = `
      <div class="cta-quien">
        <div class="cta-avatar" aria-hidden="true">${esc(iniciales)}</div>
        <div class="cta-id">
          <b>${esc(neg.nombre || 'Tu negocio')}</b>
          <span>${esc(neg.email || '')}</span>
          <small>${[desde ? `En Rubrofy desde ${desde.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}` : '', plan && !neg.sinPlan ? `Plan ${esc(plan.nombre)}` : 'Sin plan activo'].filter(Boolean).join(' · ')}</small>
        </div>
      </div>
      <div class="cta-fila">
        <span><b>Correo para entrar</b><small>${esc(neg.email || '')}${contacto ? ` · Para cambiarlo, escríbenos a <a href="mailto:${esc(contacto)}">${esc(contacto)}</a>` : ''}</small></span>
      </div>
      <div class="cta-fila">
        <span><b>Clave</b><small>Úsala con tu correo para entrar a Rubrofy.</small></span>
        <button type="button" class="btn-ghost" data-cta-clave aria-expanded="${claveAbierta}">Cambiar clave</button>
      </div>
      <form class="cta-clave" data-cta-clave-form ${claveAbierta ? '' : 'hidden'}>
        <label>Clave actual<input type="password" name="actual" autocomplete="current-password" required></label>
        <label>Clave nueva <span class="opc">mínimo 8 caracteres</span><input type="password" name="nueva" autocomplete="new-password" minlength="8" required></label>
        <label>Repite la clave nueva<input type="password" name="repite" autocomplete="new-password" minlength="8" required></label>
        <p class="config-error" data-cta-clave-error hidden></p>
        <div class="config-actions"><button type="button" class="btn-ghost" data-cta-clave-cancelar>Cancelar</button><button type="submit" class="btn-approve">Guardar clave</button></div>
      </form>
      <p class="config-ok" data-cta-clave-ok hidden></p>
      <div class="cta-fila">
        <span><b>Datos del negocio</b><small>Nombre, rubro, lo que vendes, precios y logo.</small></span>
        <button type="button" class="btn-ghost" data-cta-ir="cfg-perfil">Editar</button>
      </div>`;
  }

  // --- Créditos ---
  function pintarCreditos() {
    const cont = $('#cuenta-creditos');
    if (!cont) return;
    const info = creditos;
    if (!info) { cont.innerHTML = '<p class="sub cta-cargando">Cargando tus créditos…</p>'; return; }
    if (info.error) { cont.innerHTML = '<p class="sub">No se pudieron cargar tus créditos. Recarga la página para intentar de nuevo.</p>'; return; }
    const minimo = (lista) => Math.min(...(lista || []).map((o) => o.creditos).filter((x) => x > 0));
    const foto = minimo(info.opciones && info.opciones.foto);
    const video = minimo(info.opciones && info.opciones.video);
    const usos = [isFinite(foto) ? `una foto desde ${foto} ⚡` : '', isFinite(video) ? `un video de 5 segundos desde ${video} ⚡` : ''].filter(Boolean);
    const movs = info.movimientos || [];
    cont.innerHTML = `
      <div class="cta-cr">
        <div class="cta-cr-saldo"><b>${info.saldo}</b><span>créditos ⚡<br>disponibles</span></div>
        <ul class="cr-desglose">
          <li><span>Del plan (se renuevan el 1 de cada mes)</span><b>${info.plan} de ${info.planMes}</b></li>
          <li><span>De packs y regalos (duran 12 meses)</span><b>${info.packs}</b></li>
        </ul>
      </div>
      ${usos.length ? `<p class="sub">Con IA, ${usos.join(' y ')}. Antes de crear siempre ves cuánto usa.</p>` : ''}
      ${info.pausa ? '<p class="cr-nota">La creación con IA está en pausa por unos minutos. Tus créditos no se pierden.</p>' : ''}
      <div class="config-actions cta-acciones-izq"><button type="button" class="btn-approve" data-cta-comprar>⚡ Comprar créditos</button></div>
      ${info.referido && info.referido.creditos ? `<div class="cr-ref"><b>🤝 Invita y gana</b><p class="sub">Cuando otro negocio se suscribe con tu enlace, ustedes dos reciben <b>${info.referido.creditos} ⚡</b>.</p>
        <div class="cr-ref-link"><input readonly value="${esc(info.referido.enlace)}" aria-label="Tu enlace para invitar" data-cta-ref><button type="button" class="btn-ghost" data-cta-copiar>Copiar</button></div></div>` : ''}
      <h3 class="cta-sub">Últimos movimientos</h3>
      ${movs.length
        ? `<ul class="cta-movs">${movs.slice(0, 12).map((m) => `<li><span>${esc(m.detalle)}<small>${dia(m.fecha)}</small></span><b class="${m.cantidad > 0 ? 'mas' : 'menos'}">${m.cantidad > 0 ? '+' : '−'}${Math.abs(m.cantidad)} ⚡</b></li>`).join('')}</ul>`
        : '<p class="sub">Todavía no usas créditos. Cuando crees una foto o un video con IA, aparece aquí.</p>'}`;
  }

  // --- Pagos ---
  function pintarPagos() {
    const cont = $('#cuenta-pagos');
    if (!cont) return;
    if (!cuenta) { cont.innerHTML = '<p class="sub cta-cargando">Cargando tus pagos…</p>'; return; }
    if (cuenta.error) { cont.innerHTML = '<p class="sub">No se pudieron cargar tus pagos. Recarga la página para intentar de nuevo.</p>'; return; }
    const pagos = cuenta.pagos || [];
    const t = (n().pagos || {}).tarjeta;
    const tarjeta = t && t.ultimos4 ? `<p class="sub">Tu plan se cobra con ${esc(t.tipo || 'tu tarjeta')} terminada en ${esc(t.ultimos4)}. Para cambiarla, usa "Cambiar tarjeta" en <a href="#cta-plan">Plan y pago</a>.</p>` : '';
    const pendiente = pagos.find((p) => p.estado === 'pendiente' && p.enlacePago);
    cont.innerHTML = `
      ${pendiente ? `<div class="cta-alerta"><span><b>Tienes un cobro pendiente de ${clp(pendiente.montoClp)}.</b> Págalo para que tu plan siga activo.</span><a class="btn-approve" href="${esc(pendiente.enlacePago)}" rel="noopener">Pagar ahora</a></div>` : ''}
      ${tarjeta}
      ${pagos.length
        ? `<ul class="cta-pagos">${pagos.map((p) => {
          const [txt, clase] = ESTADOS[p.estado] || [p.estado, 'nulo'];
          const periodo = p.periodo ? `${dia(p.periodo.desde, false)} al ${dia(p.periodo.hasta)}` : '';
          return `<li>
            <span class="cta-pago-fecha">${dia(p.fecha)}</span>
            <span class="cta-pago-det">${esc(p.detalle)}${periodo ? `<small>${periodo}</small>` : ''}</span>
            <b class="cta-pago-monto">${clp(p.montoClp)}</b>
            <span class="cta-estado ${clase}">${txt}</span>
            ${p.enlacePago ? `<a class="btn-approve cta-pagar" href="${esc(p.enlacePago)}" rel="noopener">Pagar</a>` : ''}
          </li>`;
        }).join('')}</ul>`
        : '<p class="sub">Todavía no hay pagos. Cuando pagues tu plan o compres créditos, cada pago queda registrado aquí.</p>'}
      <p class="cta-nota">Los precios incluyen IVA.${cuenta.contacto ? ` ¿Necesitas tu boleta o una factura? Escríbenos a <a href="mailto:${esc(cuenta.contacto)}">${esc(cuenta.contacto)}</a>.` : ''}</p>`;
  }

  // Un solo manejador para toda la vista (las tarjetas se redibujan).
  function activar() {
    const vista = $('#view-cuenta');
    if (!vista || vista.dataset.listo) return;
    vista.dataset.listo = '1';
    vista.addEventListener('click', async (e) => {
      const ir = e.target.closest('[data-cta-ir]');
      if (ir) return ctx.irA('config', null, ir.dataset.ctaIr);
      if (e.target.closest('[data-cta-clave]')) {
        claveAbierta = !claveAbierta;
        pintarPerfil();
        if (claveAbierta) vista.querySelector('[data-cta-clave-form] input').focus();
        return;
      }
      if (e.target.closest('[data-cta-clave-cancelar]')) { claveAbierta = false; return pintarPerfil(); }
      if (e.target.closest('[data-cta-comprar]') && window.RubrofyCreditos) return window.RubrofyCreditos.abrirComprar();
      const copiar = e.target.closest('[data-cta-copiar]');
      if (copiar) {
        const inp = vista.querySelector('[data-cta-ref]');
        try { await navigator.clipboard.writeText(inp.value); copiar.textContent = 'Copiado'; } catch (err) { inp.select(); }
        return;
      }
      const todas = e.target.closest('[data-cta-cerrar-todas]');
      if (todas) {
        if (!confirm('¿Cerrar tu sesión en todos los demás dispositivos? Aquí sigues conectado.')) return;
        todas.disabled = true;
        const ok = vista.querySelector('[data-cta-sesion-ok]');
        try {
          await ctx.api(`/api/negocios/${n().id}/cuenta/cerrar-sesiones`, { method: 'POST', body: '{}' });
          ok.textContent = 'Listo. Se cerró tu sesión en los demás dispositivos.';
          ok.hidden = false;
        } catch (err) { alert(err.mensaje || 'No se pudo. Intenta de nuevo.'); }
        todas.disabled = false;
      }
    });
    vista.addEventListener('submit', async (e) => {
      const form = e.target.closest('[data-cta-clave-form]');
      if (!form) return;
      e.preventDefault();
      const error = form.querySelector('[data-cta-clave-error]');
      error.hidden = true;
      if (form.nueva.value !== form.repite.value) {
        error.textContent = 'Las dos claves nuevas no son iguales.';
        error.hidden = false;
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await ctx.api(`/api/negocios/${n().id}/cuenta/clave`, { method: 'POST', body: JSON.stringify({ actual: form.actual.value, nueva: form.nueva.value }) });
        claveAbierta = false;
        pintarPerfil();
        const ok = vista.querySelector('[data-cta-clave-ok]');
        ok.textContent = 'Listo, cambiaste tu clave. Por seguridad, se cerró tu sesión en los demás dispositivos.';
        ok.hidden = false;
      } catch (err) {
        error.textContent = err.mensaje || 'No se pudo cambiar la clave.';
        error.hidden = false;
        btn.disabled = false;
      }
    });
  }

  window.RubrofyCuenta = { render };
})();
