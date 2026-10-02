// Recargas (server/recargas.js): la ventana "Cargar más" y el uso de IA en
// Plan y pago. La ventana se abre sola cuando el servidor responde 403 con
// { recargar: 'piezas' | 'reels' | 'creditos' } (ver api() en app.js). Las fotos
// y videos con IA se pagan con créditos ⚡: esa ventana está en creditos.js.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clp = (n) => '$' + Math.round(n).toLocaleString('es-CL');
  const TITULOS = {
    piezas: 'piezas con IA',
    reels: 'reels editados',
  };
  let ctx = null;
  let catalogo = null;

  async function cargarCatalogo() {
    if (!catalogo) catalogo = await ctx.api('/api/recargas');
    return catalogo;
  }

  function iniciar(contexto) { ctx = contexto; }

  function mesSiguiente() {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  }

  // Lo que queda (cupo del mes + saldo) de un tipo.
  function quedan(n, tipo) {
    const c = (n.cupos || {})[tipo] || { usado: 0, cupo: 0 };
    return Math.max(0, c.cupo - c.usado) + ((n.saldos || {})[tipo] || 0);
  }

  async function abrir(tipo) {
    if (!ctx) return;
    if (['creditos', 'fotos', 'videos'].includes(tipo) && window.RubrofyCreditos) return window.RubrofyCreditos.abrirComprar();
    const n = ctx.negocio();
    const cat = await cargarCatalogo().catch(() => null);
    if (!cat) return;
    let dlg = document.getElementById('dlg-recarga');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-recarga';
      dlg.className = 'dlg dlg-recarga';
      document.body.appendChild(dlg);
    }
    let tipoSel = TITULOS[tipo] ? tipo : 'piezas';
    let paqueteSel = null;

    function pintar(mensaje) {
      const paquetes = cat.paquetes.filter((p) => p.tipo === tipoSel);
      if (!paqueteSel || paqueteSel.tipo !== tipoSel) paqueteSel = paquetes.find((p) => p.destacado) || paquetes[0];
      const c = (n.cupos || {})[tipoSel] || { usado: 0, cupo: 0 };
      const agotado = quedan(n, tipoSel) <= 0;
      const titulo = agotado
        ? (c.cupo ? `Se acabaron tus ${TITULOS[tipoSel]} de este mes` : `Carga ${TITULOS[tipoSel]}`)
        : `Cargar más ${TITULOS[tipoSel]}`;
      const sub = c.cupo
        ? `Tu plan trae ${c.cupo} al mes y llevas ${Math.min(c.usado, c.cupo)}. Lo que cargues se usa cuando se acabe el cupo y dura ${cat.vigenciaMeses} meses.`
        : `Tu plan no las incluye cada mes: con un paquete las tienes igual. Duran ${cat.vigenciaMeses} meses.`;
      const r = n.recargas || {};
      let acciones;
      if (!r.puede) {
        acciones = `<p class="config-error">${esc(r.motivo || 'No puedes cargar más por ahora.')}</p><div class="dlg-acciones"><button type="button" class="btn-ghost" data-cerrar>Cerrar</button><button type="button" class="btn-approve" data-ver-planes>Ver planes</button></div>`;
      } else {
        acciones = `<div class="dlg-acciones">
            <button type="button" class="btn-ghost" data-cerrar>${agotado && c.cupo ? `Esperar al ${mesSiguiente()}` : 'Ahora no'}</button>
            ${r.simular ? `<button type="button" class="btn-ghost" data-simular title="Solo cuentas administradoras: carga sin cobrar, para probar">Simular compra</button>` : ''}
            <button type="button" class="btn-approve" data-pagar ${r.pago ? '' : 'disabled title="Los pagos todavía no están habilitados"'}>${r.pago ? `Pagar ${clp(paqueteSel.precioClp)}` : 'Pagos pronto'}</button>
          </div>`;
      }
      dlg.innerHTML = `<div class="dlg-caja">
          <h2>${esc(titulo)}</h2>
          <p class="sub">${esc(sub)}</p>
          <div class="rc-tipos" role="group" aria-label="Qué quieres cargar">${Object.keys(TITULOS).map((t) => `<button type="button" class="rc-tipo${t === tipoSel ? ' activo' : ''}" data-tipo="${t}" aria-pressed="${t === tipoSel}">${esc(TITULOS[t].replace(' con IA', ''))}</button>`).join('')}<button type="button" class="rc-tipo" data-creditos>créditos ⚡</button></div>
          <div class="rc-packs">${paquetes.map((p) => `<button type="button" class="rc-pack" data-paquete="${p.id}" aria-pressed="${p === paqueteSel}">
              <b>${p.cantidad} ${esc(TITULOS[p.tipo])}</b><span class="rc-precio">${clp(p.precioClp)}</span>
              <small>${clp(p.precioClp / p.cantidad)} c/u</small>${p.destacado ? '<span class="rc-tag">Más conveniente</span>' : '<span></span>'}</button>`).join('')}</div>
          <p class="rc-nota">Pago único, IVA incluido. No es una suscripción.</p>
          ${mensaje ? `<p class="rc-ok">${mensaje}</p>` : ''}
          ${acciones}
          ${n.plan === 'pro' ? '<p class="rc-alt">¿Te pasa todos los meses? El plan <b>Estudio</b> trae 300 piezas, 30 reels editados y más créditos ⚡ para fotos y videos.</p>' : ''}
        </div>`;
    }

    dlg.onclick = async (e) => {
      if (e.target.closest('[data-creditos]')) { dlg.close(); return window.RubrofyCreditos && window.RubrofyCreditos.abrirComprar(); }
      const t = e.target.closest('[data-tipo]');
      if (t) { tipoSel = t.dataset.tipo; return pintar(); }
      const p = e.target.closest('[data-paquete]');
      if (p) { paqueteSel = cat.paquetes.find((x) => x.id === p.dataset.paquete); return pintar(); }
      if (e.target.closest('[data-cerrar]')) return dlg.close();
      if (e.target.closest('[data-ver-planes]')) { dlg.close(); return ctx.irA('config', null, 'cfg-plan'); }
      const pagar = e.target.closest('[data-pagar]');
      const simular = e.target.closest('[data-simular]');
      if (!pagar && !simular) return;
      const btn = pagar || simular;
      btn.disabled = true;
      const texto = btn.textContent;
      btn.textContent = pagar ? 'Abriendo el pago…' : 'Cargando…';
      try {
        const r = await ctx.api(`/api/negocios/${n.id}/recargas${simular ? '/simular' : ''}`, { method: 'POST', body: JSON.stringify({ paquete: paqueteSel.id }) });
        if (r.url) { window.location.href = r.url; return; }
        if (r.negocio) { ctx.setNegocio(r.negocio); Object.assign(n, r.negocio); }
        pintar(`Listo: se cargaron ${paqueteSel.cantidad} ${esc(TITULOS[paqueteSel.tipo])} (simulado, sin cobro).`);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = texto;
        pintar(null);
        const e2 = document.createElement('p');
        e2.className = 'config-error';
        e2.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo.';
        dlg.querySelector('.dlg-caja').appendChild(e2);
      }
    };
    dlg.addEventListener('close', () => { if (ctx.alCerrar) ctx.alCerrar(); }, { once: true });
    pintar();
    if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
  }

  // Uso de IA en Plan y pago: barras del mes, saldo cargado e historial.
  async function renderUso(cont) {
    if (!ctx || !cont) return;
    const n = ctx.negocio();
    if ((n.plan || 'gratis') === 'gratis') { cont.innerHTML = ''; return; }
    const filas = Object.keys(TITULOS).map((t) => {
      const c = (n.cupos || {})[t] || { usado: 0, cupo: 0 };
      const saldo = (n.saldos || {})[t] || 0;
      if (!c.cupo && !saldo) return '';
      const pct = c.cupo ? Math.min(100, (c.usado / c.cupo) * 100) : 100;
      return `<div class="rc-uso">
          <div class="rc-fila"><span>${esc(TITULOS[t][0].toUpperCase() + TITULOS[t].slice(1))} del mes</span><b>${c.cupo ? `${Math.min(c.usado, c.cupo)} de ${c.cupo}` : 'no incluidas'}</b></div>
          ${c.cupo ? `<div class="rc-barra"><i style="width:${pct}%"></i></div>` : ''}
          ${saldo ? `<div class="rc-saldo">Saldo cargado: <b>${saldo}</b></div>` : ''}
        </div>`;
    }).join('');
    const cr = n.creditos;
    const filaCreditos = cr ? `<div class="rc-uso">
          <div class="rc-fila"><span>Créditos ⚡ para fotos y videos</span><b>${cr.saldo}</b></div>
          <div class="rc-saldo">${cr.plan} de ${cr.planMes} del plan este mes · ${cr.packs} de packs y regalos <button type="button" class="btn-text" data-recargar="creditos">Comprar créditos</button></div>
        </div>` : '';
    cont.innerHTML = `<div class="rc-uso-cab"><span class="sub">Tu uso de IA</span><button type="button" class="btn-text" data-recargar="piezas">Cargar más</button></div>${filaCreditos}${filas}<div class="rc-hist" data-hist></div>`;
    cont.querySelectorAll('[data-recargar]').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.recargar)));
    try {
      const r = await ctx.api(`/api/negocios/${n.id}/recargas`);
      if (r.historial.length) {
        cont.querySelector('[data-hist]').innerHTML = '<span class="sub">Recargas</span>' + r.historial.slice(0, 5).map((h) => `<span>${new Date(h.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} · ${h.cantidad} ${esc(h.nombre)} · ${clp(h.precioClp)}${h.simulada ? ' (simulada)' : ''} · quedan ${h.restante}</span>`).join('');
      }
    } catch (err) { /* sin historial */ }
  }

  window.RubrofyRecargas = { iniciar, abrir, renderUso, quedan };
})();
