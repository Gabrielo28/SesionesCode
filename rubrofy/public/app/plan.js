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

  // --- perfil: qué es el negocio y dónde existe ---
  const CANALES = [
    ['local', 'Local físico'], ['online', 'Tienda online'], ['domicilio', 'Despacho a domicilio'],
    ['whatsapp', 'Pedidos por WhatsApp o DM'], ['agenda', 'Reservas o agenda'], ['eventos', 'Ferias o eventos'],
  ];

  // opciones.leerWeb: muestra "Leer mi web con IA".
  function camposPerfil(negocio, opciones) {
    const p = negocio.perfil || {};
    const o = opciones || {};
    const descripcion = p.descripcion || (negocio.estrategia && negocio.estrategia.rubro) || '';
    const canales = new Set(p.canales || []);
    return `
      <div class="pc-campos">
        <label>¿Qué es tu negocio y qué hace? <span class="opc">En tus palabras, como se lo contarías a un cliente nuevo</span>
          <textarea data-pf="descripcion" rows="3" maxlength="800" placeholder="Ej: Panadería familiar de barrio en Ñuñoa. Hacemos pan de masa madre, pasteles y tortas por encargo desde 1998.">${esc(descripcion)}</textarea></label>
        <label>Ciudad o zona<input type="text" data-pf="ciudad" value="${esc(p.ciudad)}" placeholder="Ej: Ñuñoa, Santiago" maxlength="120"></label>
        <h3 class="pc-sub">¿Cómo te compran? <span class="opc">Elige todas las que correspondan</span></h3>
        <div class="pc-opciones compactas" data-pc-grupo="canales" data-max="6">
          ${CANALES.map(([id, l]) => `<button type="button" class="pc-op${canales.has(id) ? ' on' : ''}" data-valor="${id}"><b>${esc(l)}</b></button>`).join('')}
        </div>
        <h3 class="pc-sub">¿Dónde te encuentran? <span class="opc">Tus redes, tu web y tu WhatsApp</span></h3>
        <div class="form-row">
          <label>Instagram<input type="text" data-pf="instagram" value="${esc(p.instagram ? '@' + p.instagram : '')}" placeholder="@tunegocio" autocapitalize="off"></label>
          <label>TikTok<input type="text" data-pf="tiktok" value="${esc(p.tiktok ? '@' + p.tiktok : '')}" placeholder="@tunegocio" autocapitalize="off"></label>
        </div>
        <div class="form-row">
          <label>Facebook<input type="text" data-pf="facebook" value="${esc(p.facebook)}" placeholder="tunegocio" autocapitalize="off"></label>
          <label>WhatsApp<input type="tel" data-pf="whatsapp" value="${esc(p.whatsapp)}" placeholder="+56 9 1234 5678"></label>
        </div>
        <label>Sitio web<span class="pf-web"><input type="url" data-pf="web" value="${esc(p.web)}" placeholder="tunegocio.cl" autocapitalize="off">
          ${o.leerWeb ? '<button type="button" class="btn-ghost" data-pf-leer>Leer mi web con IA</button>' : ''}</span></label>
        <p class="pf-msg" data-pf-msg hidden></p>
      </div>`;
  }

  // Lo que vende: productos, precio de referencia y promoción.
  // Textos de "Lo que ofreces" según si vende productos, servicios o ambos.
  const OFERTA = {
    productos: {
      que: '¿Qué productos vendes?', queAyuda: 'Tus productos principales', quePh: 'Ej: pan de masa madre, marraquetas, pasteles, tortas por encargo, café',
      estrella: 'Producto estrella', estrellaPh: 'Ej: pan de masa madre',
      quien: '¿A quién le vendes?', quienPh: 'Ej: familias del barrio y oficinistas que pasan camino al trabajo',
      por: 'Ej: fermentación de 24 horas y horno a leña', unidad: 'kilo, unidad, caja…',
    },
    servicios: {
      que: '¿Qué servicios ofreces?', queAyuda: 'Lo que haces por tus clientes', quePh: 'Ej: entrenamiento personalizado, planes online, clases grupales, evaluación física',
      estrella: 'Servicio estrella', estrellaPh: 'Ej: plan de entrenamiento personalizado de 12 semanas',
      quien: '¿A quién atiendes?', quienPh: 'Ej: mujeres de 25 a 45 años que quieren volver a entrenar sin lesionarse',
      por: 'Ej: planes hechos a tu medida y seguimiento por WhatsApp todas las semanas', unidad: 'sesión, clase, mes, plan…',
    },
    ambos: {
      que: '¿Qué ofreces?', queAyuda: 'Tus servicios y productos principales', quePh: 'Ej: clases de yoga y pilates, y venta de mats y ropa deportiva',
      estrella: 'Servicio o producto estrella', estrellaPh: 'Ej: clase de pilates reformer',
      quien: '¿A quién le vendes?', quienPh: 'Ej: personas del barrio que buscan moverse y sentirse mejor',
      por: 'Ej: grupos pequeños de máximo 6 personas', unidad: 'clase, mes, unidad…',
    },
  };
  const TIPOS_OFERTA = [['servicios', 'Servicios', 'Ej: entrenador, peluquería, dentista, agencia'], ['productos', 'Productos', 'Ej: panadería, tienda, florería'], ['ambos', 'Ambos', 'Ej: gimnasio que vende suplementos']];

  // Cambia etiquetas y ejemplos al elegir productos, servicios o ambos.
  function actualizarOferta(root) {
    const on = root.querySelector('[data-pc-grupo="tipoOferta"] .pc-op.on');
    const t = OFERTA[on ? on.dataset.valor : 'ambos'];
    const set = (sel, prop, v) => { const el = root.querySelector(sel); if (el) el[prop] = v; };
    set('[data-of="que"]', 'textContent', t.que);
    set('[data-of="queAyuda"]', 'textContent', t.queAyuda);
    set('[data-pf="productos"]', 'placeholder', t.quePh);
    set('[data-of="estrella"]', 'textContent', t.estrella);
    set('[data-pc="productoDestacado"]', 'placeholder', t.estrellaPh);
    set('[data-of="quien"]', 'textContent', t.quien);
    set('[data-pc="publico"]', 'placeholder', t.quienPh);
    set('[data-pc="diferenciador"]', 'placeholder', t.por);
    set('[data-pc="unidad"]', 'placeholder', t.unidad);
  }

  function camposVenta(negocio, sugerido) {
    const d = negocio.datos || {};
    const p = negocio.perfil || {};
    const pc = negocio.planContenido || {};
    const s = sugerido || {};
    const tipo = OFERTA[p.tipoOferta] ? p.tipoOferta : '';
    const t = OFERTA[tipo || 'ambos'];
    return `
      <div class="pc-campos">
        <h3 class="pc-sub">¿Qué ofreces?</h3>
        <div class="pc-opciones compactas" data-pc-grupo="tipoOferta" data-max="1">
          ${TIPOS_OFERTA.map(([id, l, ej]) => `<button type="button" class="pc-op${tipo === id ? ' on' : ''}" data-valor="${id}"><b>${esc(l)}</b><span>${esc(ej)}</span></button>`).join('')}
        </div>
        <label><span data-of="que">${esc(t.que)}</span> <span class="opc" data-of="queAyuda">${esc(t.queAyuda)}</span>
          <textarea data-pf="productos" rows="3" maxlength="800" placeholder="${esc(t.quePh)}">${esc(p.productos || s.productos)}</textarea></label>
        <label><span data-of="estrella">${esc(t.estrella)}</span><input type="text" data-pc="productoDestacado" value="${esc(d.productoDestacado)}" placeholder="${esc(t.estrellaPh)}"></label>
        <label><span data-of="quien">${esc(t.quien)}</span> <span class="opc">Tu cliente ideal</span>
          <textarea data-pc="publico" rows="2" maxlength="300" placeholder="${esc(t.quienPh)}">${esc(pc.publico || s.publico)}</textarea></label>
        <label>¿Por qué te eligen a ti? <span class="opc">Lo que te hace distinto</span>
          <textarea data-pc="diferenciador" rows="2" maxlength="300" placeholder="${esc(t.por)}">${esc(pc.diferenciador || s.diferenciador)}</textarea></label>
        <details class="pf-precio"${d.precioDesde || d.promo ? ' open' : ''}>
          <summary>Precios y promoción <span class="opc">(opcional: la IA solo menciona precios que tú escribas aquí)</span></summary>
          <div class="form-row">
            <label>Precio desde<input type="text" data-pc="precioDesde" value="${esc(d.precioDesde)}" placeholder="$2.500"></label>
            <label>Por<input type="text" data-pc="unidad" value="${esc(d.unidad)}" placeholder="${esc(t.unidad)}"></label>
          </div>
          <label>Promoción vigente<input type="text" data-pc="promo" value="${esc(d.promo)}" placeholder="Ej: 2x1 los miércoles"></label>
        </details>
      </div>`;
  }

  function leerPerfil(root) {
    const out = {};
    ['descripcion', 'ciudad', 'productos', 'instagram', 'tiktok', 'facebook', 'whatsapp', 'web'].forEach((c) => {
      const el = root.querySelector(`[data-pf="${c}"]`);
      if (el) out[c] = el.value;
    });
    const g = root.querySelector('[data-pc-grupo="canales"]');
    if (g) out.canales = [...g.querySelectorAll('.pc-op.on')].map((b) => b.dataset.valor);
    const o = root.querySelector('[data-pc-grupo="tipoOferta"]');
    if (o) { const on = o.querySelector('.pc-op.on'); out.tipoOferta = on ? on.dataset.valor : ''; }
    return out;
  }

  // "Leer mi web con IA": completa lo que esté vacío y avisa qué llenó.
  function activarPerfil(root, ctx, alSugerir) {
    const b = root.querySelector('[data-pf-leer]');
    if (!b) return;
    b.addEventListener('click', async () => {
      const msg = root.querySelector('[data-pf-msg]');
      const web = root.querySelector('[data-pf="web"]').value.trim();
      msg.hidden = false;
      if (!web) { msg.textContent = 'Escribe primero la dirección de tu sitio web.'; return; }
      b.disabled = true;
      b.textContent = 'Leyendo tu web…';
      try {
        const r = await ctx.api(`/api/negocios/${ctx.negocio().id}/perfil/leer-web`, { method: 'POST', body: JSON.stringify({ url: web }) });
        const llenados = [];
        for (const [campo, valorNuevo] of Object.entries(r.propuesta)) {
          const el = root.querySelector(`[data-pf="${campo}"]`);
          if (el && valorNuevo && !el.value.trim()) { el.value = campo === 'instagram' ? '@' + valorNuevo : valorNuevo; llenados.push(campo); }
        }
        if (alSugerir) alSugerir(r.propuesta);
        msg.textContent = llenados.length || r.propuesta.productos
          ? 'Listo: completamos lo que encontramos en tu web. Revísalo y corrige lo que haga falta.'
          : 'Leímos tu web, pero no encontramos datos nuevos para completar.';
      } catch (err) {
        msg.textContent = err.mensaje || 'No pudimos leer tu web. Completa los datos a mano.';
      }
      b.disabled = false;
      b.textContent = 'Leer mi web con IA';
    });
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
        if (grupo.dataset.pcGrupo === 'tipoOferta') actualizarOferta(root);
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
    camposPerfil, camposVenta, leerPerfil, activarPerfil,
    catalogo, camposNegocio, camposObjetivo, camposRitmo, activar, leerPlan, leerDatos,
    estrategiaEditable, activarEstrategia, leerEstrategia, resumenPlan, textoTotal, renderVista, ETIQUETAS, SINGULAR,
  };
})();
