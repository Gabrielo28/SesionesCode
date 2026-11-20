// Inicio: una sola tarea a la vez (la más urgente de la ruta del cliente,
// server/ruta.js) y lo próximo que se publica. El resto del avance queda
// plegado más abajo.
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const accion = (a) => `data-accion='${esc(JSON.stringify(a))}'`;
  let avanceAbierto = false;

  // Lo que se logró este mes, en una línea.
  function logrosHTML(l) {
    const num = (x) => Number(x || 0).toLocaleString('es-CL');
    const partes = [`<b>${num(l.publicacionesMes)}</b> ${l.publicacionesMes === 1 ? 'publicación' : 'publicaciones'} este mes`];
    if (l.alcance) partes.push(`<b>${num(l.alcance)}</b> personas te vieron`);
    if (l.racha >= 2) partes.push(`🔥 <b>${l.racha}</b> semanas seguidas`);
    return `<button type="button" class="ini-logros" ${accion({ tipo: 'vista', vista: 'resultados' })}>${partes.map((p) => `<span>${p}</span>`).join('')}<em aria-hidden="true">›</em></button>`;
  }

  function tareaHTML(p, ctx) {
    if (!p) {
      return `<section class="ini-tarea al-dia">
        <b>Estás al día</b>
        <p>No tienes nada pendiente. Rubrofy publica por ti lo que ya aprobaste.</p>
        <button type="button" class="btn-ghost" data-crear>Crear algo nuevo</button>
      </section>`;
    }
    return `<section class="ini-tarea">
      <b>${esc(p.titulo)}</b>
      <p>${esc(p.detalle)}</p>
      <button type="button" class="btn-approve" ${accion(p.accion)}>${esc(p.boton)}</button>
    </section>`;
  }

  async function render(cont, ctx) {
    const n = ctx.negocio;
    const [r, lg] = await Promise.all([
      ctx.api(`/api/negocios/${n.id}/ruta`),
      ctx.api(`/api/negocios/${n.id}/logros`).catch(() => null),
    ]);
    const proximas = ctx.contenido
      .filter((i) => i.status === 'aprobado' && !(i.publicacion && i.publicacion.estado === 'publicada') && !(i.instagram && i.instagram.ok) && i.publicarEl)
      .sort((a, b) => Date.parse(a.publicarEl) - Date.parse(b.publicarEl))
      .slice(0, 4);
    const [primera, ...despues] = r.siguientes;
    const hechos = r.etapas.reduce((s, e) => s + (e.hechos || 0), 0);
    const total = r.etapas.reduce((s, e) => s + (e.total || 0), 0);
    const FORMATO = window.RubrofyPlan.SINGULAR;

    cont.innerHTML = `
      <div class="ini">
        <h2 class="ini-hola">Hola 👋</h2>
        <p class="ini-sub">${primera ? 'Esto es lo que toca ahora.' : 'Todo en orden por hoy.'}</p>
        ${tareaHTML(primera, ctx)}
        ${despues.length ? `<div class="ini-despues"><span>Después</span>${despues.map((p) => `<button type="button" ${accion(p.accion)}>${esc(p.titulo)}<em aria-hidden="true">›</em></button>`).join('')}</div>` : ''}

        <h3 class="ini-tit">Próximas</h3>
        ${proximas.length ? `<div class="ini-prox">${proximas.map((i) => {
          const mini = ctx.miniatura(i);
          return `<button type="button" class="ini-p" ${accion({ tipo: 'vista', vista: 'cola', ancla: 'card-' + i.id })}>
            ${mini ? `<img src="${esc(mini)}" alt="" loading="lazy">` : `<span class="ini-p-sin" aria-hidden="true">${esc((FORMATO[ctx.formatoDe(i)] || 'Post').charAt(0))}</span>`}
            <span class="ini-p-txt"><b>${esc(ctx.fechaAmigable(i.publicarEl))}</b><small>${esc(FORMATO[ctx.formatoDe(i)] || 'Post')} · ${esc(i.headline || (i.variants && i.variants[i.variantIndex || 0]) || '')}</small></span>
            <span class="pz-red ig" title="Instagram">IG</span>
          </button>`;
        }).join('')}</div>`
          : '<p class="ini-vacio">Lo que apruebes aparece aquí con su fecha.</p>'}
        ${n.instagramConectado ? '' : `<p class="ini-aviso">Instagram no está conectado: lo aprobado queda guardado, pero no se publica. <button type="button" class="ini-link" ${accion({ tipo: 'vista', vista: 'config' })}>Conectar</button></p>`}

        ${lg && lg.publicacionesMes ? logrosHTML(lg) : ''}

        <details class="ini-avance"${avanceAbierto ? ' open' : ''}>
          <summary><span>Tu avance</span><em>${hechos} de ${total} pasos</em></summary>
          ${r.etapas.map((e) => `<div class="ini-etapa">
            <h4>${esc(e.titulo)} <small>${esc(e.cuando)}</small></h4>
            <ul>${e.pasos.map((p) => `<li class="${p.estado}">
              <i aria-hidden="true">${p.estado === 'hecho' ? '✓' : p.estado === 'bloqueado' ? '🔒' : p.estado === 'proximo' ? '…' : ''}</i>
              <span>${esc(p.titulo)}${p.requierePlan ? ` <small>Plan ${esc(p.requierePlan)}</small>` : ''}</span>
              ${p.estado === 'pendiente' ? `<button type="button" class="ini-link" ${accion(p.accion)}>${esc(p.boton)}</button>`
                : p.estado === 'bloqueado' ? '<button type="button" class="ini-link" data-planes>Ver planes</button>'
                : p.estado === 'hecho' && p.botonHecho ? `<button type="button" class="ini-link" ${accion(p.accion)}>${esc(p.botonHecho)}</button>` : ''}
            </li>`).join('')}</ul>
          </div>`).join('')}
          ${lg && lg.referido && lg.referido.enlace ? `<p class="ini-ref">🤝 ¿Conoces otro negocio al que le serviría? Si se suscribe con tu enlace, <b>ustedes dos ganan ${lg.referido.creditos} créditos ⚡</b>. <button type="button" class="ini-link" data-copiar-ref="${esc(lg.referido.enlace)}">Copiar mi enlace</button></p>` : ''}
        </details>
      </div>`;

    cont.querySelector('.ini-avance').addEventListener('toggle', (e) => { avanceAbierto = e.target.open; });
    cont.onclick = async (e) => {
      const ref = e.target.closest('[data-copiar-ref]');
      if (ref) {
        try { await navigator.clipboard.writeText(ref.dataset.copiarRef); ref.textContent = '¡Copiado!'; setTimeout(() => { ref.textContent = 'Copiar mi enlace'; }, 2000); }
        catch (err) { prompt('Copia tu enlace:', ref.dataset.copiarRef); }
        return;
      }
      if (e.target.closest('[data-crear]')) return ctx.abrirCrear();
      if (e.target.closest('[data-planes]')) return ctx.irA('cuenta', null, 'cta-plan');
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      const a = JSON.parse(b.dataset.accion);
      if (a.tipo === 'vista') return ctx.irA(a.vista, a.tab, a.ancla);
      if (a.tipo === 'bienvenida') return ctx.abrirBienvenida();
      if (a.tipo === 'generar') return ctx.abrirGenerar();
      if (a.tipo === 'informe') {
        window.open(`/app/informe.html?mes=${encodeURIComponent(a.mes)}`, '_blank', 'noopener');
        await ctx.api(`/api/negocios/${n.id}/ruta/informe-visto`, { method: 'POST', body: JSON.stringify({ mes: a.mes }) }).catch(() => {});
        return render(cont, ctx);
      }
    };
  }

  function invalidar() { avanceAbierto = false; }

  window.RubrofyInicio = { render, invalidar };
})();
