// Inicio: primeros pasos (qué falta configurar y dónde), lo que espera tu
// aprobación, lo próximo que se publica y un resumen de tu estrategia.
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let referenciasCache = { id: null, n: 0 };

  async function render(cont, ctx) {
    const n = ctx.negocio;
    const contenido = ctx.contenido;
    const plan = ctx.planActual;
    const cat = await window.RubrofyPlan.catalogo(ctx.api);
    if (referenciasCache.id !== n.id) {
      try {
        const e = await ctx.api(`/api/negocios/${n.id}/estilo`);
        referenciasCache = { id: n.id, n: (e.referencias || []).length };
      } catch (err) {
        referenciasCache = { id: n.id, n: 0 };
      }
    }
    const totalFotos = Object.values(ctx.fotos || {}).reduce((s, l) => s + l.length, 0);
    const pendientes = contenido.filter((i) => i.status === 'pendiente');
    const aprobadas = contenido.filter((i) => i.status === 'aprobado');
    const proximas = aprobadas
      .filter((i) => !(i.publicacion && i.publicacion.estado === 'publicada') && i.publicarEl)
      .sort((a, b) => Date.parse(a.publicarEl) - Date.parse(b.publicarEl))
      .slice(0, 4);

    const pasos = [
      { ok: !!n.bienvenidaCompletada, titulo: 'Cuéntanos de tu negocio y tu objetivo', detalle: 'Público, qué te hace distinto y cuánto quieres publicar.', ir: 'bienvenida', boton: 'Empezar' },
      { ok: !!n.bienvenidaCompletada && !!(ctx.estrategia && ctx.estrategia.resumen), titulo: 'Revisa tu estrategia', detalle: 'Tono y temas que se van turnando en tus publicaciones.', ir: 'estrategia', boton: 'Ver estrategia' },
      { ok: aprobadas.length > 0, titulo: 'Aprueba tu primera publicación', detalle: 'Edita, pide otra versión o aprueba.', ir: 'cola', boton: 'Ir a Por aprobar' },
      { ok: !!n.instagramConectado && n.instagramEstado !== 'reconectar', titulo: n.instagramEstado === 'reconectar' ? 'Reconecta Instagram' : 'Conecta Instagram', detalle: 'Para que lo aprobado se publique solo, en su fecha.', ir: 'config', boton: 'Conectar' },
      { ok: totalFotos > 0, titulo: 'Sube fotos de tu negocio', detalle: 'Tus publicaciones usan tus fotos reales.', ir: 'fotos', boton: 'Subir fotos' },
      { ok: referenciasCache.n >= 5, titulo: 'Muéstrale tu estilo', detalle: 'Sube o importa 5 publicaciones tuyas para que escriba como tú.', ir: 'estilo', boton: 'Ir a Mi estilo' },
    ];
    if (ctx.planIncluye('ads')) {
      pasos.push({ ok: !!(n.metaConexion || n.googleConexion), titulo: 'Conecta tu publicidad', detalle: 'Meta Ads y Google Ads, junto a tu Instagram.', ir: 'config', boton: 'Conectar' });
    }
    const hechos = pasos.filter((p) => p.ok).length;
    const pc = window.RubrofyPlan.resumenPlan(plan, cat);

    cont.innerHTML = `
      <div class="ini-head">
        <div>
          <h1>Hola, ${esc(n.nombre)}</h1>
          <p class="sub">${pendientes.length ? `Tienes <b>${pendientes.length}</b> publicaciones esperando tu aprobación.` : 'No tienes publicaciones pendientes. Genera la próxima semana cuando quieras.'}</p>
        </div>
        <div class="ini-acciones">
          ${pendientes.length ? '<button type="button" class="btn-approve" data-ir="cola">Revisar pendientes</button>' : ''}
          <button type="button" class="btn-ghost" data-generar-semana>+ Generar semana</button>
        </div>
      </div>

      ${hechos < pasos.length ? `
      <section class="ig-card ini-pasos">
        <div class="ig-card-head"><h2>Primeros pasos</h2><span class="ini-prog-txt">${hechos} de ${pasos.length}</span></div>
        <div class="ini-prog"><i style="width:${Math.round((hechos / pasos.length) * 100)}%"></i></div>
        <ol>
          ${pasos.map((p) => `
            <li class="${p.ok ? 'ok' : ''}">
              <span class="ini-check">${p.ok ? '✓' : ''}</span>
              <div><b>${esc(p.titulo)}</b><span>${esc(p.detalle)}</span></div>
              ${p.ok ? '' : `<button type="button" class="btn-ghost" data-ir="${p.ir}">${esc(p.boton)}</button>`}
            </li>`).join('')}
        </ol>
      </section>` : ''}

      <div class="ini-grid">
        <section class="ig-card">
          <div class="ig-card-head"><h2>Próximas publicaciones</h2><button type="button" class="ini-link" data-ir="calendario">Ver calendario</button></div>
          ${proximas.length ? `<ul class="ini-lista">${proximas.map((i) => `
            <li><span class="ini-fecha">${esc(ctx.fechaCorta(i.publicarEl))}</span><span class="ini-fmt">${esc(window.RubrofyPlan.SINGULAR[i.formato] || 'Post')}</span><span class="ini-txt">${esc((i.variants && i.variants[i.variantIndex || 0]) || i.headline)}</span></li>`).join('')}</ul>`
            : `<p class="sub">Todavía no hay publicaciones aprobadas. Lo que apruebes aparece aquí con su fecha.</p>`}
          ${n.instagramConectado ? '' : '<p class="ini-aviso">Instagram no está conectado: lo aprobado queda guardado pero no se publica. <button type="button" class="ini-link" data-ir="config">Conectar</button></p>'}
        </section>

        <section class="ig-card">
          <div class="ig-card-head"><h2>Tu plan</h2><button type="button" class="ini-link" data-ir="estrategia">Cambiar</button></div>
          ${plan ? `
            <dl class="ini-dl">
              <dt>Objetivo</dt><dd>${esc(pc.objetivos.join(' · ') || '—')}</dd>
              <dt>Tono</dt><dd>${esc(pc.tono || (ctx.estrategia && ctx.estrategia.tono) || '—')}</dd>
              <dt>Por semana</dt><dd>${pc.total}</dd>
            </dl>` : '<p class="sub">Todavía no eliges tu objetivo ni cuánto publicar.</p>'}
          ${ctx.estrategia && ctx.estrategia.enfoques ? `<div class="ini-chips">${ctx.estrategia.enfoques.map((e) => `<span>${esc(e.label)}</span>`).join('')}</div>` : ''}
        </section>
      </div>`;

    cont.onclick = (e) => {
      const ir = e.target.closest('[data-ir]');
      if (ir) return ir.dataset.ir === 'bienvenida' ? ctx.abrirBienvenida() : ctx.irA(ir.dataset.ir);
      if (e.target.closest('[data-generar-semana]')) ctx.abrirGenerar();
    };
  }

  function invalidar() { referenciasCache = { id: null, n: 0 }; }

  window.RubrofyInicio = { render, invalidar };
})();
