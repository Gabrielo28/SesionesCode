// Formularios del plan de contenido y de la estrategia. Los usan la
// bienvenida (bienvenida.js) y la vista "Estrategia" (este mismo archivo).
(function () {
  'use strict';
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');

  const ETIQUETAS = { post: 'Posts', carrusel: 'Carruseles', reel: 'Reels', historia: 'Historias' };
  const SINGULAR = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };
  const DETALLE_FORMATO = {
    post: 'Una foto con texto.',
    carrusel: 'Varias láminas deslizables.',
    reel: 'Video vertical corto.',
    historia: 'Dura 24 horas.',
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let catalogoCache = null;
  async function catalogo(api) {
    if (!catalogoCache) catalogoCache = await api('/api/plan-contenido');
    return catalogoCache;
  }

  // --- piezas de formulario ---

  function camposNegocio(negocio) {
    const d = negocio.datos || {};
    const p = negocio.planContenido || {};
    return `
      <div class="pc-campos">
        <div class="form-row">
          <label>Precio desde<input type="text" data-pc="precioDesde" value="${esc(d.precioDesde)}" placeholder="$XX.XXX"></label>
          <label>Unidad<input type="text" data-pc="unidad" value="${esc(d.unidad)}" placeholder="noche, combo, sesión..."></label>
        </div>
        <label>Producto o servicio destacado<input type="text" data-pc="productoDestacado" value="${esc(d.productoDestacado)}" placeholder="Ej: pan de masa madre"></label>
        <label>Promoción vigente <span class="opc">(opcional)</span><input type="text" data-pc="promo" value="${esc(d.promo)}" placeholder="Ej: 2x1 los miércoles"></label>
        <label>¿A quién le hablas? <span class="opc">Tu cliente ideal</span>
          <textarea data-pc="publico" rows="2" maxlength="300" placeholder="Ej: familias del barrio y oficinistas que pasan camino al trabajo">${esc(p.publico)}</textarea></label>
        <label>¿Qué te hace distinto? <span class="opc">Por qué te eligen a ti</span>
          <textarea data-pc="diferenciador" rows="2" maxlength="300" placeholder="Ej: fermentación de 24 horas y horno a leña">${esc(p.diferenciador)}</textarea></label>
      </div>`;
  }

  function camposObjetivo(plan, cat) {
    const elegidos = new Set((plan && plan.objetivos) || []);
    return `
      <h3 class="pc-sub">¿Qué quieres lograr con Instagram? <span class="opc">Elige uno o dos</span></h3>
      <div class="pc-opciones" data-pc-grupo="objetivos" data-max="2">
        ${cat.objetivos.map((o) => `<button type="button" class="pc-op${elegidos.has(o.id) ? ' on' : ''}" data-valor="${o.id}"><b>${esc(o.label)}</b><span>${esc(o.detalle)}</span></button>`).join('')}
      </div>
      <h3 class="pc-sub">¿Cómo quieres sonar?</h3>
      <div class="pc-opciones compactas" data-pc-grupo="tono" data-max="1">
        ${cat.tonos.map((t) => `<button type="button" class="pc-op${plan && plan.tono === t.id ? ' on' : ''}" data-valor="${t.id}"><b>${esc(t.label)}</b><span>${esc(t.detalle)}</span></button>`).join('')}
      </div>`;
  }

  function camposRitmo(plan, cat) {
    const semanal = (plan && plan.semanal) || cat.ritmos[1].semanal;
    return `
      <h3 class="pc-sub">¿Cuánto quieres publicar por semana?</h3>
      <div class="pc-ritmos">
        ${cat.ritmos.map((r) => `<button type="button" class="pc-ritmo" data-ritmo='${JSON.stringify(r.semanal)}'><b>${esc(r.label)}</b><span>${esc(r.detalle)}</span></button>`).join('')}
      </div>
      <div class="pc-steppers">
        ${cat.formatos.map((f) => `
          <div class="pc-stepper">
            <div><b>${ETIQUETAS[f]}</b><span>${DETALLE_FORMATO[f]}</span></div>
            <div class="pc-ctrl">
              <button type="button" data-paso="-1" data-formato="${f}" aria-label="Menos ${ETIQUETAS[f]}">−</button>
              <output data-semanal="${f}">${semanal[f] || 0}</output>
              <button type="button" data-paso="1" data-formato="${f}" aria-label="Más ${ETIQUETAS[f]}">+</button>
            </div>
          </div>`).join('')}
      </div>
      <p class="pc-total" data-pc-total></p>
      <label class="pc-hora">Hora preferida para los posts <span class="opc">(las historias salen a las 18:30)</span>
        <input type="time" data-pc="hora" value="${esc((plan && plan.hora) || '09:00')}"></label>`;
  }

  function textoTotal(semanal) {
    const total = Object.values(semanal).reduce((s, n) => s + n, 0);
    const partes = Object.keys(ETIQUETAS).filter((f) => semanal[f]).map((f) => `${semanal[f]} ${(semanal[f] === 1 ? SINGULAR[f] : ETIQUETAS[f]).toLowerCase()}`);
    return total ? `<b>${total} publicaciones por semana</b> · ${partes.join(', ')}` : 'Elige al menos una publicación por semana.';
  }

  // Botones de opciones, ritmos y +/−. Se puede llamar varias veces sobre
  // el mismo contenedor: los manejadores se instalan una sola vez.
  function activar(root, max) {
    const actualizarTotal = () => {
      const t = root.querySelector('[data-pc-total]');
      if (t) t.innerHTML = textoTotal(leerSemanal(root));
    };
    actualizarTotal();
    if (root.dataset.pcActivo) return;
    root.dataset.pcActivo = '1';
    root.addEventListener('click', (e) => {
      const op = e.target.closest('.pc-op');
      if (op) {
        const grupo = op.closest('[data-pc-grupo]');
        const tope = Number(grupo.dataset.max || 1);
        if (tope === 1) {
          const estaba = op.classList.contains('on');
          grupo.querySelectorAll('.pc-op').forEach((b) => b.classList.remove('on'));
          if (!estaba) op.classList.add('on');
        } else if (op.classList.contains('on')) {
          op.classList.remove('on');
        } else {
          const on = grupo.querySelectorAll('.pc-op.on');
          if (on.length >= tope) on[0].classList.remove('on');
          op.classList.add('on');
        }
        return;
      }
      const ritmo = e.target.closest('[data-ritmo]');
      if (ritmo) {
        const s = JSON.parse(ritmo.dataset.ritmo);
        Object.keys(s).forEach((f) => { const o = root.querySelector(`[data-semanal="${f}"]`); if (o) o.textContent = s[f]; });
        actualizarTotal();
        return;
      }
      const paso = e.target.closest('[data-paso]');
      if (paso) {
        const o = root.querySelector(`[data-semanal="${paso.dataset.formato}"]`);
        o.textContent = Math.min(Math.max(Number(o.textContent) + Number(paso.dataset.paso), 0), max || 14);
        actualizarTotal();
      }
    });
  }

  function leerSemanal(root) {
    const s = {};
    root.querySelectorAll('[data-semanal]').forEach((o) => { s[o.dataset.semanal] = Number(o.textContent) || 0; });
    return s;
  }

  function valor(root, campo) {
    const el = root.querySelector(`[data-pc="${campo}"]`);
    return el ? el.value : undefined;
  }

  // Lo que haya en pantalla, sobre lo que ya tenía guardado el negocio.
  function leerPlan(root, planPrevio) {
    const p = Object.assign({}, planPrevio || {});
    ['publico', 'diferenciador', 'hora'].forEach((c) => { const v = valor(root, c); if (v !== undefined) p[c] = v; });
    const obj = root.querySelector('[data-pc-grupo="objetivos"]');
    if (obj) p.objetivos = [...obj.querySelectorAll('.pc-op.on')].map((b) => b.dataset.valor);
    const tono = root.querySelector('[data-pc-grupo="tono"]');
    if (tono) {
      const on = tono.querySelector('.pc-op.on');
      p.tono = on ? on.dataset.valor : null;
    }
    if (root.querySelector('[data-semanal]')) p.semanal = leerSemanal(root);
    return p;
  }

  function leerDatos(root, negocio) {
    const d = Object.assign({}, negocio.datos || {});
    ['precioDesde', 'unidad', 'promo', 'productoDestacado'].forEach((c) => { const v = valor(root, c); if (v !== undefined) d[c] = v; });
    return d;
  }

  // --- estrategia ---

  function estrategiaEditable(est) {
    const cats = est.categoriasFoto || [];
    const fila = (e) => `
      <div class="pc-enfoque" data-enfoque-id="${esc(e.id || '')}">
        <input type="text" data-e="label" value="${esc(e.label)}" placeholder="Nombre del enfoque" maxlength="60">
        <textarea data-e="pista" rows="2" maxlength="300" placeholder="Qué debe transmitir">${esc(e.pista)}</textarea>
        <label class="pc-foto">Foto<select data-e="categoriaFoto">${cats.map((c) => `<option${c === e.categoriaFoto ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <button type="button" class="pc-quitar" data-quitar-enfoque title="Quitar enfoque" aria-label="Quitar enfoque">×</button>
      </div>`;
    return `
      <label class="pc-bloque">Resumen de la estrategia
        <textarea data-est="resumen" rows="3" maxlength="500" placeholder="Qué vas a comunicar y para qué">${esc(est.resumen || '')}</textarea></label>
      <label class="pc-bloque">Tono de voz
        <input type="text" data-est="tono" value="${esc(est.tono)}" maxlength="300"></label>
      <div class="pc-bloque">
        <span class="pc-etq">Enfoques de contenido ${AY('enfoques')} <span class="opc">Los temas que se van turnando en tus publicaciones</span></span>
        <div class="pc-enfoques" data-enfoques>${(est.enfoques || []).map(fila).join('')}</div>
        <button type="button" class="btn-ghost pc-agregar" data-agregar-enfoque>+ Agregar enfoque</button>
      </div>
      <template data-fila-enfoque>${fila({ label: '', pista: '', categoriaFoto: cats[0] })}</template>`;
  }

  function activarEstrategia(root) {
    if (root.dataset.estActivo) return;
    root.dataset.estActivo = '1';
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-quitar-enfoque]')) {
        const filas = root.querySelectorAll('.pc-enfoque');
        if (filas.length > 1) e.target.closest('.pc-enfoque').remove();
      }
      if (e.target.closest('[data-agregar-enfoque]')) {
        const cont = root.querySelector('[data-enfoques]');
        if (cont.children.length >= 8) return;
        cont.insertAdjacentHTML('beforeend', root.querySelector('[data-fila-enfoque]').innerHTML);
        cont.lastElementChild.querySelector('input').focus();
      }
    });
  }

  function leerEstrategia(root) {
    return {
      resumen: root.querySelector('[data-est="resumen"]').value,
      tono: root.querySelector('[data-est="tono"]').value,
      enfoques: [...root.querySelectorAll('.pc-enfoque')].map((f) => ({
        id: f.dataset.enfoqueId || undefined,
        label: f.querySelector('[data-e="label"]').value,
        pista: f.querySelector('[data-e="pista"]').value,
        categoriaFoto: f.querySelector('[data-e="categoriaFoto"]').value,
      })),
    };
  }

  function resumenPlan(plan, cat) {
    if (!plan) return 'Sin plan todavía.';
    const objetivos = (plan.objetivos || []).map((id) => (cat.objetivos.find((o) => o.id === id) || {}).label).filter(Boolean);
    const tono = cat.tonos.find((t) => t.id === plan.tono);
    return { objetivos, tono: tono ? tono.label : null, total: textoTotal(plan.semanal || {}) };
  }

  // --- vista "Estrategia" ---

  async function renderVista(cont, ctx) {
    const cat = await catalogo(ctx.api);
    const n = ctx.negocio;
    cont.innerHTML = `
      <div class="est-grid">
        <section class="ig-card est-card" data-seccion="estrategia">
          <div class="ig-card-head"><h2>Tu estrategia${AY('estrategia-editar')}</h2>
            <button type="button" class="btn-ghost" data-est-accion="proponer">Proponer otra con IA</button></div>
          <p class="sub">Rubrofy la usa para escribir cada publicación. Cámbiala cuando quieras.</p>
          <div data-est-form>${estrategiaEditable(ctx.estrategia)}</div>
          <p class="config-error" data-est-error hidden></p>
          <p class="config-ok" data-est-ok hidden>Guardado.</p>
          <div class="config-actions"><button type="button" class="btn-approve" data-est-accion="guardar-estrategia">Guardar estrategia</button></div>
        </section>
        <section class="ig-card est-card" data-seccion="plan">
          <div class="ig-card-head"><h2>Tu negocio y objetivo${AY('negocio-objetivo')}</h2></div>
          ${camposNegocio(n)}
          ${camposObjetivo(n.planContenido, cat)}
        </section>
        <section class="ig-card est-card" data-seccion="ritmo">
          <div class="ig-card-head"><h2>Cuánto publicar${AY('cuanto-publicar')}</h2></div>
          <p class="sub">"Generar semana" crea exactamente esta mezcla y la reparte en los días de la semana.</p>
          ${camposRitmo(n.planContenido, cat)}
          <p class="config-error" data-plan-error hidden></p>
          <p class="config-ok" data-plan-ok hidden>Guardado.</p>
          <div class="config-actions">
            <button type="button" class="btn-ghost" data-est-accion="repetir-bienvenida">Repetir la bienvenida</button>
            <button type="button" class="btn-approve" data-est-accion="guardar-plan">Guardar plan</button>
          </div>
        </section>
      </div>`;
    activar(cont, cat.maxPorFormato);
    activarEstrategia(cont.querySelector('[data-seccion="estrategia"]'));

    const aviso = (sel, texto, ok) => {
      cont.querySelectorAll('[data-est-error],[data-est-ok],[data-plan-error],[data-plan-ok]').forEach((x) => { x.hidden = true; });
      const el = cont.querySelector(sel);
      if (texto) el.textContent = texto;
      el.hidden = false;
      if (ok) setTimeout(() => { el.hidden = true; }, 2500);
    };

    cont.onclick = async (e) => {
      const b = e.target.closest('[data-est-accion]');
      if (!b) return;
      const accion = b.dataset.estAccion;
      b.disabled = true;
      try {
        if (accion === 'guardar-estrategia') {
          const est = await ctx.api(`/api/negocios/${n.id}/estrategia`, { method: 'PUT', body: JSON.stringify(leerEstrategia(cont)) });
          ctx.setEstrategia(est);
          aviso('[data-est-ok]', null, true);
        } else if (accion === 'proponer') {
          if (!confirm('La IA va a proponer una estrategia nueva con tu objetivo y plan actuales. Reemplaza la que tienes en pantalla. ¿Seguir?')) return;
          b.textContent = 'Pensando…';
          const est = await ctx.api(`/api/negocios/${n.id}/estrategia/generar`, { method: 'POST' });
          ctx.setEstrategia(est);
          cont.querySelector('[data-est-form]').innerHTML = estrategiaEditable(est);
          aviso('[data-est-ok]', 'Nueva estrategia lista. Revísala y guarda si quieres cambiar algo.', false);
        } else if (accion === 'guardar-plan') {
          await ctx.guardarDatos(leerDatos(cont, n));
          const neg = await ctx.api(`/api/negocios/${n.id}/plan-contenido`, { method: 'PUT', body: JSON.stringify(leerPlan(cont, n.planContenido)) });
          ctx.setNegocio(neg);
          aviso('[data-plan-ok]', null, true);
        } else if (accion === 'repetir-bienvenida') {
          ctx.abrirBienvenida();
        }
      } catch (err) {
        aviso(accion === 'guardar-plan' ? '[data-plan-error]' : '[data-est-error]', err.mensaje || 'No se pudo guardar.', false);
      } finally {
        b.disabled = false;
        if (accion === 'proponer') b.textContent = 'Proponer otra con IA';
      }
    };
  }

  window.RubrofyPlan = {
    catalogo, camposNegocio, camposObjetivo, camposRitmo, activar, leerPlan, leerDatos,
    estrategiaEditable, activarEstrategia, leerEstrategia, resumenPlan, textoTotal, renderVista, ETIQUETAS, SINGULAR,
  };
})();
