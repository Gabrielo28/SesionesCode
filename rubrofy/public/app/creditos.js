// Créditos ⚡ (server/creditos.js) en el panel: el saldo arriba, la ventana
// para comprar packs (con el bono de primera compra, el enlace para invitar
// y los movimientos) y la elección de calidad y duración antes de crear una
// foto o un video con IA.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clp = (n) => '$' + Math.round(n).toLocaleString('es-CL');
  let ctx = null;

  function iniciar(c) { ctx = c; }
  const neg = () => (ctx ? ctx.negocio() : null);
  const datos = () => (neg() && neg().creditos) || null;

  // Saldo para gastar en un tipo (con "videos solo con packs", el plan no cuenta para videos).
  function disponible(tipo) {
    const c = datos();
    if (!c) return 0;
    return tipo === 'video' && c.videosSoloConPacks ? c.packs : c.saldo;
  }

  function dialogo(id, clase) {
    let dlg = document.getElementById(id);
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = id;
      dlg.className = 'dlg ' + (clase || '');
      document.body.appendChild(dlg);
    }
    return dlg;
  }
  function mostrar(dlg) { if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); } }

  // --- chip del saldo en la barra de arriba ---
  function pintarChip() {
    const chip = document.getElementById('creditos-chip');
    if (!chip) return;
    const n = neg(), c = datos();
    chip.hidden = !n || !c || n.sinPlan;
    if (chip.hidden) return;
    chip.querySelector('b').textContent = c.saldo;
    chip.classList.toggle('bajo', c.saldo < 5);
    chip.title = `${c.saldo} créditos ⚡: ${c.plan} del plan este mes y ${c.packs} de packs y regalos. Toca para comprar más.`;
  }

  // --- opciones de calidad (y duración) con su costo ---
  function opcionesHTML(tipo, { calidad = 'recomendada', segundos = 5, nombre = 'calidad' } = {}) {
    const c = datos();
    const ops = (c && c.opciones && c.opciones[tipo]) || [];
    if (!ops.length) return '';
    const sel = ops.some((o) => o.calidad === calidad) ? calidad : (ops.find((o) => o.calidad === 'recomendada') || ops[0]).calidad;
    return `<div class="cr-calidades" role="radiogroup" aria-label="Calidad">${ops.map((o) => `
      <label class="cr-cal"><input type="radio" name="${nombre}" value="${o.calidad}"${o.calidad === sel ? ' checked' : ''} data-cr-creditos="${o.creditos}">
        ${o.calidad === 'recomendada' ? '<span class="cr-reco">Recomendada</span>' : ''}
        <b>${esc(o.nombre)}</b><small>${esc(o.detalle)}</small><small class="cr-modelo">${esc(o.modelo)}</small>
        <span class="cr-costo">${o.creditos} ⚡${tipo === 'video' ? ' / 5 s' : ''}</span></label>`).join('')}</div>
      ${tipo === 'video' ? `<div class="cr-duraciones" role="radiogroup" aria-label="Duración">${(c.duraciones || [5, 10, 15]).map((d) => `
        <label class="cr-dur"><input type="radio" name="segundos" value="${d}"${d === segundos ? ' checked' : ''}><b>${d} segundos</b><small data-cr-dur="${d}"></small></label>`).join('')}</div>` : ''}`;
  }

  // Lo que cuesta lo marcado en un formulario con opcionesHTML.
  function costoDe(raiz, tipo) {
    const cal = raiz.querySelector('input[name="calidad"]:checked');
    const unidad = cal ? Number(cal.dataset.crCreditos) : 0;
    const seg = tipo === 'video' ? Number((raiz.querySelector('input[name="segundos"]:checked') || {}).value || 5) : 5;
    raiz.querySelectorAll('[data-cr-dur]').forEach((el) => { el.textContent = `${unidad * Number(el.dataset.crDur) / 5} ⚡`; });
    return { calidad: cal ? cal.value : 'recomendada', segundos: seg, creditos: tipo === 'video' ? unidad * seg / 5 : unidad };
  }

  // Línea "usa N ⚡ · te quedan M" o el aviso de que falta.
  function resumenHTML(tipo, costo) {
    const hay = disponible(tipo);
    const que = tipo === 'foto' ? 'Esta foto' : `Este video de ${costo.segundos} s`;
    if (datos() && datos().pausa) return '<span class="cr-falta">Las fotos y videos con IA están en pausa por unos minutos. No se descuentan créditos.</span>';
    return hay >= costo.creditos
      ? `<span>${que} usa <b>${costo.creditos} ⚡</b> · te quedan <b>${hay - costo.creditos}</b></span>`
      : `<span class="cr-falta">${que} usa ${costo.creditos} ⚡ y te quedan ${hay}.${tipo === 'video' && datos().videosSoloConPacks ? ' Los videos se pagan con créditos de packs.' : ''}</span>`;
  }

  // Ventana para elegir antes de crear un video (o una foto) desde una tarjeta.
  // Devuelve { calidad, segundos } o null si cancela.
  function elegir({ tipo, titulo }) {
    return new Promise((resolver) => {
      const dlg = dialogo('dlg-cr-elegir', 'dlg-cr');
      let respondido = false;
      const fin = (v) => { if (!respondido) { respondido = true; resolver(v); } if (dlg.open) dlg.close(); };
      dlg.innerHTML = `<form method="dialog" class="dlg-caja" data-cr-form>
          <h2>${esc(titulo || (tipo === 'video' ? 'Crear video con IA' : 'Crear foto con IA'))}</h2>
          <p class="sub">${tipo === 'video' ? 'Elige la calidad y cuánto dura. Si la publicación tiene foto, Rubrofy la anima.' : 'Elige la calidad de la foto.'}</p>
          ${opcionesHTML(tipo)}
          <div class="cr-resumen" data-cr-resumen></div>
          <div class="dlg-acciones"><button type="button" class="btn-ghost" data-cr-cancelar>Cancelar</button><span data-cr-accion></span></div>
        </form>`;
      const form = dlg.querySelector('[data-cr-form]');
      const pintar = () => {
        const c = costoDe(form, tipo);
        form.querySelector('[data-cr-resumen]').innerHTML = resumenHTML(tipo, c);
        const alcanza = disponible(tipo) >= c.creditos && !(datos() && datos().pausa);
        form.querySelector('[data-cr-accion]').innerHTML = alcanza
          ? `<button type="submit" class="btn-ia">✨ Crear ${tipo === 'video' ? 'video' : 'foto'}</button>`
          : `<button type="button" class="btn-approve" data-cr-comprar${datos() && datos().pausa ? ' disabled' : ''}>⚡ Comprar créditos</button>`;
      };
      form.addEventListener('change', pintar);
      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-cr-cancelar]')) fin(null);
        if (e.target.closest('[data-cr-comprar]')) { fin(null); abrirComprar(); }
      });
      form.addEventListener('submit', (e) => { e.preventDefault(); const c = costoDe(form, tipo); fin({ calidad: c.calidad, segundos: c.segundos }); });
      dlg.addEventListener('close', () => fin(null), { once: true });
      pintar();
      mostrar(dlg);
    });
  }

  // --- comprar créditos ---
  async function abrirComprar(mensaje) {
    if (!ctx) return;
    const n = neg();
    const dlg = dialogo('dlg-creditos', 'dlg-cr dlg-cr-comprar');
    let info;
    try {
      info = await ctx.api(`/api/negocios/${n.id}/creditos`);
    } catch (err) {
      return;
    }
    const r = n.recargas || {};
    let sel = (info.paquetes.find((p) => p.destacado) || info.paquetes[0] || {}).id;
    const fotoRec = (info.opciones.foto.find((o) => o.calidad === 'recomendada') || info.opciones.foto[0] || { creditos: 1 }).creditos;
    const videoRec = (info.opciones.video.find((o) => o.calidad === 'recomendada') || info.opciones.video[0] || { creditos: 10 }).creditos;
    const fecha = (f) => new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

    function pintar(aviso) {
      const p = info.paquetes.find((x) => x.id === sel);
      const bono = info.bonoPrimeraCompra;
      let acciones;
      if (!r.puede) {
        acciones = `<p class="config-error">${esc(r.motivo || 'No puedes comprar créditos por ahora.')}</p><div class="dlg-acciones"><button type="button" class="btn-ghost" data-cerrar>Cerrar</button><button type="button" class="btn-approve" data-ver-planes>Ver planes</button></div>`;
      } else {
        acciones = `<div class="dlg-acciones"><button type="button" class="btn-ghost" data-cerrar>Ahora no</button>
          ${r.simular ? '<button type="button" class="btn-ghost" data-simular title="Solo cuentas administradoras: carga sin cobrar, para probar">Simular compra</button>' : ''}
          <button type="button" class="btn-approve" data-pagar ${r.pago && p ? '' : 'disabled title="Los pagos todavía no están habilitados"'}>${r.pago && p ? `Pagar ${clp(p.precioClp)}` : 'Pagos pronto'}</button></div>`;
      }
      dlg.innerHTML = `<div class="dlg-caja">
        <div class="cr-cab"><div><h2>Créditos ⚡</h2><p class="sub">Un solo saldo para fotos y videos con IA. Antes de crear, ves cuánto usa cada cosa.</p></div>
          <div class="cr-saldo"><b>${info.saldo}</b><span>créditos</span></div></div>
        <ul class="cr-desglose"><li><span>Del plan (se renuevan el 1 de cada mes)</span><b>${info.plan} de ${info.planMes}</b></li><li><span>De packs y regalos (duran 12 meses)</span><b>${info.packs}</b></li></ul>
        ${info.videosSoloConPacks ? '<p class="cr-nota">Los videos se pagan con créditos de packs; los del plan sirven para fotos.</p>' : ''}
        ${bono ? `<div class="cr-promo">🎉 <span><b>+${bono}% de créditos en tu primera compra.</b> Se suman al pack que elijas.</span></div>` : ''}
        <div class="cr-packs">${info.paquetes.map((x) => `<button type="button" class="cr-pack${x.id === sel ? ' activo' : ''}" data-paquete="${x.id}" aria-pressed="${x.id === sel}">
            ${x.destacado ? '<span class="cr-tag">El más elegido</span>' : ''}
            <b class="cr-cant">${x.cantidad} <small>⚡</small></b>${bono ? `<span class="cr-bono">+${Math.round(x.cantidad * bono / 100)} de regalo</span>` : ''}
            <span class="cr-precio">${clp(x.precioClp)}</span><small>${clp(x.precioClp / x.cantidad)} por crédito</small>
            <small>≈ ${Math.floor(x.cantidad / fotoRec)} fotos o ${Math.floor(x.cantidad / videoRec)} videos de 5 s</small></button>`).join('')}</div>
        <p class="rc-nota">Pago único con IVA incluido. No es una suscripción.</p>
        ${aviso ? `<p class="rc-ok">${aviso}</p>` : ''}
        ${acciones}
        ${info.referido && info.referido.creditos ? `<div class="cr-ref"><b>🤝 Invita y gana</b><p class="sub">Cuando otro negocio se suscribe con tu enlace, ustedes dos reciben <b>${info.referido.creditos} ⚡</b>.</p>
          <div class="cr-ref-link"><input readonly value="${esc(info.referido.enlace)}" aria-label="Tu enlace para invitar" id="cr-ref-enlace"><button type="button" class="btn-ghost" data-copiar>Copiar</button></div></div>` : ''}
        ${info.movimientos.length ? `<details class="cr-movs"><summary>Movimientos</summary><ul>${info.movimientos.slice(0, 15).map((m) => `<li><span>${esc(m.detalle)}<small>${fecha(m.fecha)}</small></span><b class="${m.cantidad > 0 ? 'mas' : 'menos'}">${m.cantidad > 0 ? '+' : '−'}${Math.abs(m.cantidad)} ⚡</b></li>`).join('')}</ul></details>` : ''}
      </div>`;
    }

    dlg.onclick = async (e) => {
      const pk = e.target.closest('[data-paquete]');
      if (pk) { sel = pk.dataset.paquete; return pintar(); }
      if (e.target.closest('[data-cerrar]')) return dlg.close();
      if (e.target.closest('[data-ver-planes]')) { dlg.close(); return ctx.irA('cuenta', null, 'cta-plan'); }
      if (e.target.closest('[data-copiar]')) {
        const inp = dlg.querySelector('#cr-ref-enlace');
        const boton = e.target.closest('[data-copiar]');
        try { await navigator.clipboard.writeText(inp.value); boton.textContent = 'Copiado'; } catch (err) { inp.select(); }
        return;
      }
      const pagar = e.target.closest('[data-pagar]');
      const simular = e.target.closest('[data-simular]');
      if (!pagar && !simular) return;
      const btn = pagar || simular;
      btn.disabled = true;
      btn.textContent = pagar ? 'Abriendo el pago…' : 'Cargando…';
      try {
        const res = await ctx.api(`/api/negocios/${n.id}/recargas${simular ? '/simular' : ''}`, { method: 'POST', body: JSON.stringify({ paquete: sel }) });
        if (res.url) { window.location.href = res.url; return; }
        if (res.negocio) { ctx.setNegocio(res.negocio); Object.assign(n, res.negocio); }
        info = await ctx.api(`/api/negocios/${n.id}/creditos`);
        pintarChip();
        pintar('Listo: se cargaron los créditos (simulado, sin cobro).');
      } catch (err) {
        pintar(null);
        const e2 = document.createElement('p');
        e2.className = 'config-error';
        e2.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo.';
        dlg.querySelector('.dlg-caja').appendChild(e2);
      }
    };
    dlg.addEventListener('close', () => { if (ctx.alCerrar) ctx.alCerrar(); }, { once: true });
    pintar(mensaje);
    mostrar(dlg);
  }

  window.RubrofyCreditos = { iniciar, pintarChip, opcionesHTML, costoDe, resumenHTML, disponible, elegir, abrirComprar };
})();
