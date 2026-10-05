// Inicio: la ruta del cliente (server/ruta.js). Qué hacer ahora, en qué
// etapa va (Configura → Crea cada semana → Mide → Mejora cada mes), lo
// próximo que se publica y su plan.
(function () {
  'use strict';
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const ICONOS = {
    configura: '<path d="M12 3.5 V6 M12 18 V20.5 M3.5 12 H6 M18 12 H20.5"/><circle cx="12" cy="12" r="4"/>',
    crea: '<path d="M5 19 L5 15 L15 5 L19 9 L9 19 Z"/><path d="M13 7 L17 11"/>',
    mide: '<path d="M4 20 H20"/><path d="M7 16 V11"/><path d="M12 16 V6"/><path d="M17 16 V9"/>',
    mejora: '<path d="M4 16 L10 10 L13 13 L20 6"/><path d="M15 6 H20 V11"/>',
  };
  const icono = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[id]}</svg>`;

  let etapaAbierta = null; // la que el usuario eligió mirar; si no, la actual

  function marcaEstado(p) {
    if (p.estado === 'hecho') return '<span class="ru-est hecho" aria-label="Hecho">✓</span>';
    if (p.estado === 'bloqueado') return '<span class="ru-est bloq" aria-label="Bloqueado"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11 V8.5 a3 3 0 0 1 6 0 V11"/></svg></span>';
    if (p.estado === 'proximo') return '<span class="ru-est prox" aria-label="Más adelante">…</span>';
    return '<span class="ru-est pend" aria-label="Pendiente"></span>';
  }

  function botonPaso(p, clase) {
    if (p.estado === 'bloqueado') return `<button type="button" class="btn-ghost ${clase || ''}" data-planes>Plan ${esc(p.requierePlan)}</button>`;
    if (p.estado === 'proximo') return '';
    if (p.estado === 'hecho') {
      return p.botonHecho ? `<button type="button" class="ini-link" data-accion='${esc(JSON.stringify(p.accion))}'>${esc(p.botonHecho)}</button>` : '';
    }
    return `<button type="button" class="btn-ghost ${clase || ''}" data-accion='${esc(JSON.stringify(p.accion))}'>${esc(p.boton)}</button>`;
  }

  // "Lo que lograste este mes": publicaciones, alcance, horas ahorradas, racha y referidos.
  function logrosHTML(l, n) {
    const num = (x) => Number(x || 0).toLocaleString('es-CL');
    const horas = l.horasAhorradas >= 1 ? `${String(l.horasAhorradas).replace('.', ',')} h` : `${Math.round(l.horasAhorradas * 60)} min`;
    const racha = l.racha >= 2
      ? `<span class="ini-racha">🔥 ${l.racha} semanas seguidas publicando${l.proximoHito && l.premioRacha ? ` · a las ${l.proximoHito}, ${l.premioRacha} créditos ⚡ de regalo` : ''}</span>`
      : (l.premioRacha ? `<span class="ini-racha apagada">🔥 Publica 2 semanas seguidas y empieza tu racha${l.premioRacha ? ` (a las 4, ${l.premioRacha} créditos ⚡)` : ''}</span>` : '');
    return `<section class="ig-card ini-logros">
      <div class="ig-card-head"><h2>Lo que lograste este mes con Rubrofy${AY('logros')}</h2><button type="button" class="ini-link" data-accion='{"tipo":"vista","vista":"resultados"}'>Ver resultados</button></div>
      <div class="ini-logros-grid">
        <div class="ini-logro"><b>${num(l.publicacionesMes)}</b><span>publicaciones este mes</span><small>${num(l.publicacionesTotal)} desde que empezaste</small></div>
        ${l.alcance ? `<div class="ini-logro"><b>${num(l.alcance)}</b><span>personas vieron tu contenido</span><small>${num(l.interacciones)} interacciones</small></div>` : (n.instagramConectado ? '' : `<div class="ini-logro apagado"><b>—</b><span>alcance en Instagram</span><small>conecta Instagram para verlo</small></div>`)}
        <div class="ini-logro"><b>${horas}</b><span>que no pasaste escribiendo</span><small>a 20 min por publicación</small></div>
      </div>
      ${racha}
      ${l.referido && l.referido.enlace ? `<p class="ini-ref">🤝 ¿Conoces otro negocio al que le serviría? Si se suscribe con tu enlace, <b>ustedes dos ganan ${l.referido.creditos} créditos ⚡</b>. <button type="button" class="ini-link" data-copiar-ref="${esc(l.referido.enlace)}">Copiar mi enlace</button></p>` : ''}
    </section>`;
  }

  async function render(cont, ctx) {
    const n = ctx.negocio;
    const [r, cat, lg] = await Promise.all([
      ctx.api(`/api/negocios/${n.id}/ruta`),
      window.RubrofyPlan.catalogo(ctx.api),
      ctx.api(`/api/negocios/${n.id}/logros`).catch(() => null),
    ]);
    const plan = ctx.planActual;
    const pc = window.RubrofyPlan.resumenPlan(plan, cat);
    const abierta = r.etapas.find((e) => e.id === (etapaAbierta || r.etapaActual)) || r.etapas[0];
    const proximas = ctx.contenido
      .filter((i) => i.status === 'aprobado' && !(i.publicacion && i.publicacion.estado === 'publicada') && i.publicarEl)
      .sort((a, b) => Date.parse(a.publicarEl) - Date.parse(b.publicarEl))
      .slice(0, 4);
    const pendientes = ctx.contenido.filter((i) => i.status === 'pendiente').length;
    const nombreEtapa = (id) => (r.etapas.find((e) => e.id === id) || {}).titulo;

    cont.innerHTML = `
      <div class="ini-head">
        <div>
          <h1>Hola, ${esc(n.nombre)}${AY('inicio')}</h1>
          <p class="sub">${r.siguientes.length ? `Estás en <b>${esc(nombreEtapa(r.etapaActual))}</b>. Esto es lo que te toca ahora.` : 'Estás al día. Rubrofy sigue publicando y midiendo por ti.'}</p>
        </div>
        <div class="ini-acciones">
          ${pendientes ? `<button type="button" class="btn-approve" data-accion='{"tipo":"vista","vista":"cola"}'>Revisar pendientes (${pendientes})</button>` : ''}
          <button type="button" class="btn-ghost" data-accion='{"tipo":"generar"}'>+ Generar semana</button>
        </div>
      </div>

      ${r.siguientes.length ? `
      <h2 class="ru-ahora-t">Qué hacer ahora${AY('que-hacer')}</h2>
      <section class="ru-ahora" aria-label="Qué hacer ahora">
        ${r.siguientes.map((p, i) => `
          <article class="ru-accion${i === 0 ? ' primera' : ''}">
            <span class="ru-num">${i + 1}</span>
            <div class="ru-accion-txt">
              <span class="ru-etapa-chip">${esc(nombreEtapa(p.etapa))}</span>
              <b>${esc(p.titulo)}</b>
              <p>${esc(p.detalle)}</p>
            </div>
            ${botonPaso(p, i === 0 ? 'ru-btn-principal' : '')}
          </article>`).join('')}
      </section>` : ''}

      <section class="ig-card ru-ruta">
        <div class="ig-card-head"><h2>Tu ruta en Rubrofy${AY('ruta')}</h2><span class="ru-ayuda">Configura una vez; después, un ciclo semanal y uno mensual.</span></div>
        <div class="ru-etapas" role="tablist">
          ${r.etapas.map((e, i) => {
            const completa = e.total && e.hechos === e.total;
            return `<button type="button" role="tab" class="ru-etapa${e.id === abierta.id ? ' abierta' : ''}${e.id === r.etapaActual ? ' actual' : ''}${completa ? ' completa' : ''}" data-etapa="${e.id}" aria-selected="${e.id === abierta.id}">
              <span class="ru-ic">${icono(e.id)}</span>
              <span class="ru-e-txt"><b>${i + 1}. ${esc(e.titulo)}</b><em>${esc(e.cuando)}</em></span>
              <span class="ru-e-prog">${e.total ? `${e.hechos}/${e.total}` : ''}${e.bloqueados ? ' <i class="ru-lock-mini" title="Hay pasos de otro plan">+</i>' : ''}</span>
              ${e.id === r.etapaActual ? '<span class="ru-aqui">Estás aquí</span>' : ''}
            </button>`;
          }).join('')}
        </div>
        <div class="ru-panel" role="tabpanel">
          <p class="ru-resumen">${esc(abierta.resumen)}</p>
          <ol class="ru-pasos">
            ${abierta.pasos.map((p) => `
              <li class="${p.estado}">
                ${marcaEstado(p)}
                <div><b>${esc(p.titulo)}</b>${p.requierePlan ? `<span class="rail-plan">${esc(p.requierePlan)}</span>` : ''}<span>${esc(p.detalle)}</span></div>
                ${botonPaso(p)}
              </li>`).join('')}
          </ol>
        </div>
      </section>

      ${lg && (lg.publicacionesTotal || lg.racha) ? logrosHTML(lg, n) : ''}

      <div class="ini-grid">
        <section class="ig-card">
          <div class="ig-card-head"><h2>Próximas publicaciones${AY('proximas')}</h2><button type="button" class="ini-link" data-accion='{"tipo":"vista","vista":"calendario"}'>Ver calendario</button></div>
          ${proximas.length ? `<ul class="ini-lista">${proximas.map((i) => `
            <li><span class="ini-fecha">${esc(ctx.fechaCorta(i.publicarEl))}</span><span class="ini-fmt">${esc(window.RubrofyPlan.SINGULAR[i.formato] || 'Post')}</span><span class="ini-txt">${esc((i.variants && i.variants[i.variantIndex || 0]) || i.headline)}</span></li>`).join('')}</ul>`
            : '<p class="sub">Todavía no hay publicaciones aprobadas. Lo que apruebes aparece aquí con su fecha.</p>'}
          ${n.instagramConectado ? '' : '<p class="ini-aviso">Instagram no está conectado: lo aprobado queda guardado pero no se publica. <button type="button" class="ini-link" data-accion=\'{"tipo":"vista","vista":"config"}\'>Conectar</button></p>'}
        </section>

        <section class="ig-card">
          <div class="ig-card-head"><h2>Tu plan de contenido${AY('plan-inicio')}</h2><button type="button" class="ini-link" data-accion='{"tipo":"vista","vista":"estrategia"}'>Cambiar</button></div>
          ${plan ? `
            <dl class="ini-dl">
              <dt>Objetivo</dt><dd>${esc(pc.objetivos.join(' · ') || '—')}</dd>
              <dt>Tono</dt><dd>${esc(pc.tono || (ctx.estrategia && ctx.estrategia.tono) || '—')}</dd>
              <dt>Por semana</dt><dd>${pc.total}</dd>
            </dl>` : '<p class="sub">Todavía no eliges tu objetivo ni cuánto publicar.</p>'}
          ${ctx.estrategia && ctx.estrategia.enfoques ? `<div class="ini-chips">${ctx.estrategia.enfoques.map((e) => `<span>${esc(e.label)}</span>`).join('')}</div>` : ''}
        </section>
      </div>`;

    cont.onclick = async (e) => {
      const ref = e.target.closest('[data-copiar-ref]');
      if (ref) {
        try { await navigator.clipboard.writeText(ref.dataset.copiarRef); ref.textContent = '¡Copiado!'; setTimeout(() => { ref.textContent = 'Copiar mi enlace'; }, 2000); }
        catch (err) { prompt('Copia tu enlace:', ref.dataset.copiarRef); }
        return;
      }
      const etapa = e.target.closest('[data-etapa]');
      if (etapa) {
        etapaAbierta = etapa.dataset.etapa;
        return render(cont, ctx);
      }
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

  function invalidar() { etapaAbierta = null; }

  window.RubrofyInicio = { render, invalidar };
})();
