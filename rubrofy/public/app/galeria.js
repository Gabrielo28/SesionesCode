// Galería del negocio: todas sus fotos (por categoría), las generadas con
// IA y el selector "Foto para la publicación" de cada tarjeta (elegir de la
// galería, subir o generar con IA). Ver server/server.js: /fotos,
// /galeria/ia y /contenido/:item/foto.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let ctx = null;
  let filtro = 'todas';

  const ESTILOS = [
    ['realista', 'Foto real', 'Luz natural, como de fotógrafo'],
    ['producto', 'Producto en estudio', 'Fondo limpio, el producto al centro'],
    ['personas', 'Con personas', 'Gente real, ambiente cálido'],
    ['minimalista', 'Minimalista', 'Pocos elementos, colores suaves'],
  ];

  function iniciar(c) { ctx = c; }
  const n = () => ctx.negocio();
  const categorias = () => ((n().estrategia && n().estrategia.categoriasFoto) || []);
  const url = (cat, archivo) => `/fotos/${n().id}/${encodeURIComponent(cat)}/${encodeURIComponent(archivo)}`;
  const esIA = (archivo) => /^ia-/.test(archivo);

  // Todas las fotos como una lista: [{ categoria, archivo, url, ia }].
  function lista() {
    const f = ctx.fotos();
    const out = [];
    for (const cat of categorias()) for (const a of (f[cat] || [])) out.push({ categoria: cat, archivo: a, url: url(cat, a), ia: esIA(a) });
    // Las más nuevas primero (el nombre empieza con la fecha de subida).
    return out.sort((x, y) => String(y.archivo.replace(/^ia-/, '')).localeCompare(String(x.archivo.replace(/^ia-/, ''))));
  }

  // Sube varias fotos a una categoría. Devuelve los nombres nuevos.
  async function subir(categoria, archivos) {
    const antes = new Set(ctx.fotos()[categoria] || []);
    for (const file of archivos) {
      if (!/^image\//.test(file.type)) continue;
      await ctx.subirFoto(categoria, file);
    }
    return (ctx.fotos()[categoria] || []).filter((a) => !antes.has(a));
  }

  async function usarEnPieza(item, categoria, archivo) {
    await ctx.api(`/api/negocios/${n().id}/contenido/${item.id}/foto`, { method: 'PUT', body: JSON.stringify({ categoria, archivo }) });
    await ctx.refrescar();
  }

  // --- Generar con IA (formulario compartido por la Galería y el selector) ---
  function formIAHTML(texto) {
    const neg = n();
    const quedan = neg.fotosIADisponibles || 0;
    const activo = !!(neg.mediosIA && neg.mediosIA.imagen);
    const ideas = ((neg.estrategia && neg.estrategia.enfoques) || []).slice(0, 4);
    if (!activo) {
      return `<div class="gl-aviso"><b>La creación de fotos con IA todavía no está activa.</b><p>Mientras tanto, sube tus fotos o elige una de tu galería. Las fotos reales de tu negocio suelen funcionar muy bien.</p></div>`;
    }
    return `<form class="gl-ia" data-gl-ia>
      <label class="gl-campo"><span>¿Qué quieres que muestre la foto?</span>
        <textarea name="texto" rows="3" maxlength="800" required placeholder="Ej: una taza de café con arte latte sobre una mesa de madera, luz de mañana">${esc(texto || '')}</textarea></label>
      ${ideas.length ? `<div class="gl-campo"><span>Ideas desde tu estrategia</span><div class="gl-ideas">${ideas.map((e) => `<button type="button" class="gl-idea" data-gl-idea="${esc(`${e.label}: ${e.pista}`)}">${esc(e.label)}</button>`).join('')}</div></div>` : ''}
      <div class="gl-campo"><span>Estilo</span><div class="gl-estilos">${ESTILOS.map(([id, t, d], i) => `<label class="gl-estilo"><input type="radio" name="estilo" value="${id}"${i === 0 ? ' checked' : ''}><b>${t}</b><small>${d}</small></label>`).join('')}</div></div>
      <div class="gl-campo"><span>Formato</span><div class="gl-formatos">
        <label class="gl-formato"><input type="radio" name="formato" value="cuadrado" checked><i class="gl-f-cuadrado"></i>Post (cuadrado)</label>
        <label class="gl-formato"><input type="radio" name="formato" value="vertical"><i class="gl-f-vertical"></i>Historia o reel</label>
      </div></div>
      <div class="gl-ia-pie">${quedan > 0
        ? `<span class="gl-cupo">Te quedan <b>${quedan}</b> foto${quedan === 1 ? '' : 's'} con IA este mes. Cada foto usa 1.</span>`
        : `<span class="gl-cupo">${neg.plan === 'estudio' ? 'Ya usaste tus fotos con IA de este mes.' : 'Las fotos con IA vienen en el plan Estudio.'} Puedes cargar un paquete sin cambiar de plan.</span><button type="button" class="btn-ghost" data-gl-recargar>Cargar fotos con IA</button>`}
        <button type="submit" class="btn-ia"${quedan > 0 ? '' : ' disabled'}>✨ Crear foto</button></div>
      <p class="config-error" data-gl-error hidden></p>
      <div class="gl-resultados" data-gl-resultados></div>
    </form>`;
  }

  // Activa el formulario. alCrear({ categoria, archivo }) se llama con cada foto nueva.
  function activarFormIA(raiz, { item, alCrear }) {
    const form = raiz.querySelector('[data-gl-ia]');
    if (!form) return;
    form.addEventListener('click', (e) => {
      const idea = e.target.closest('[data-gl-idea]');
      if (idea) form.texto.value = idea.dataset.glIdea;
      if (e.target.closest('[data-gl-recargar]') && window.RubrofyRecargas) {
        const dlg = document.getElementById('dlg-galeria');
        if (dlg && dlg.open) dlg.close();
        window.RubrofyRecargas.abrir('fotos');
      }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('[data-gl-error]');
      err.hidden = true;
      const btn = form.querySelector('button[type="submit"]');
      const res = form.querySelector('[data-gl-resultados]');
      btn.disabled = true;
      btn.textContent = 'Creando tu foto…';
      const espera = document.createElement('div');
      espera.className = 'gl-res gl-cargando';
      espera.innerHTML = '<span>Creando… suele tardar entre 10 y 40 segundos</span>';
      res.prepend(espera);
      try {
        const r = await ctx.api(`/api/negocios/${n().id}/galeria/ia`, {
          method: 'POST',
          body: JSON.stringify({ texto: form.texto.value, estilo: form.estilo.value, formato: form.formato.value, itemId: item ? item.id : undefined }),
        });
        ctx.setFotos(r.fotos);
        if (r.negocio) ctx.setNegocio(r.negocio);
        espera.className = 'gl-res';
        espera.innerHTML = `<img src="${esc(url(r.categoria, r.archivo))}" alt="Foto creada con IA"><span class="gl-ia-tag">✨ IA</span>`;
        const cupo = form.querySelector('.gl-cupo b');
        if (cupo) cupo.textContent = n().fotosIADisponibles || 0;
        if (alCrear) await alCrear({ categoria: r.categoria, archivo: r.archivo });
      } catch (e2) {
        espera.remove();
        err.textContent = e2.mensaje || 'No se pudo crear la foto. Intenta de nuevo.';
        err.hidden = false;
      } finally {
        btn.disabled = (n().fotosIADisponibles || 0) <= 0;
        btn.textContent = '✨ Crear otra';
      }
    });
  }

  // --- Vista Galería ---
  function renderVista(cont) {
    const cats = categorias();
    const todas = lista();
    const filtros = [['todas', 'Todas'], ...cats.map((c) => [c, c]), ['ia', '✨ Creadas con IA']];
    const visibles = todas.filter((f) => filtro === 'todas' || (filtro === 'ia' ? f.ia : f.categoria === filtro));
    cont.innerHTML = `
      <div class="gl-acciones">
        <label class="btn-approve gl-subir">⬆ Subir fotos<input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden data-gl-subir></label>
        <button type="button" class="btn-ia" data-gl-abrir-ia>✨ Crear con IA</button>
      </div>
      <label class="gl-drop" data-gl-drop>
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden data-gl-subir>
        <span class="gl-drop-ic">⇪</span>
        <span><b>Arrastra aquí tus fotos</b> o haz clic para elegirlas desde tu computador o celular</span>
        <span class="gl-drop-cat">Guardar en: <select data-gl-cat aria-label="Categoría">${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select></span>
      </label>
      <div class="gl-panel-ia" data-gl-panel-ia hidden>${formIAHTML('')}</div>
      <div class="gl-filtros">${filtros.map(([id, t]) => `<button type="button" class="gl-chip${filtro === id ? ' on' : ''}" data-gl-filtro="${esc(id)}">${esc(t)}</button>`).join('')}<span class="gl-total">${todas.length} foto${todas.length === 1 ? '' : 's'}</span></div>
      ${visibles.length
        ? `<div class="gl-grid">${visibles.map((f) => `<figure class="gl-foto"><img src="${esc(f.url)}" alt="" loading="lazy">${f.ia ? '<span class="gl-ia-tag">✨ IA</span>' : ''}<figcaption>${esc(f.categoria)}</figcaption><button type="button" class="gl-borrar" data-gl-borrar-cat="${esc(f.categoria)}" data-gl-borrar="${esc(f.archivo)}" title="Eliminar foto" aria-label="Eliminar foto">×</button></figure>`).join('')}</div>`
        : `<div class="gl-vacia"><b>${todas.length ? 'No hay fotos en esta categoría' : 'Tu galería está vacía'}</b><p>Sube fotos reales de tu negocio (tu local, tus productos, tu equipo) o créalas con IA. Rubrofy las usa en tus publicaciones.</p></div>`}`;
    const panel = cont.querySelector('[data-gl-panel-ia]');
    activarFormIA(panel, { alCrear: () => { filtro = 'todas'; } });
    cont.onclick = async (e) => {
      if (e.target.closest('[data-gl-abrir-ia]')) { panel.hidden = !panel.hidden; if (!panel.hidden) panel.scrollIntoView({ block: 'nearest' }); return; }
      const f = e.target.closest('[data-gl-filtro]');
      if (f) { filtro = f.dataset.glFiltro; renderVista(cont); return; }
      const b = e.target.closest('[data-gl-borrar]');
      if (b) {
        if (!confirm('¿Eliminar esta foto de tu galería?')) return;
        await ctx.borrarFoto(b.dataset.glBorrarCat, b.dataset.glBorrar).catch((err) => alert('No se pudo borrar: ' + err.message));
        renderVista(cont);
      }
      // Al cerrar el panel de IA con fotos nuevas, la cuadrícula se actualiza.
    };
    const subirArchivos = async (files) => {
      const cat = cont.querySelector('[data-gl-cat]').value;
      if (!files.length) return;
      try { await subir(cat, files); } catch (err) { alert('No se pudo subir: ' + (err.mensaje || err.message)); }
      filtro = 'todas';
      renderVista(cont);
    };
    cont.querySelectorAll('[data-gl-subir]').forEach((inp) => inp.addEventListener('change', () => subirArchivos([...inp.files])));
    const drop = cont.querySelector('[data-gl-drop]');
    drop.querySelector('select').addEventListener('click', (e) => e.preventDefault(), true);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('sobre'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault(); drop.classList.remove('sobre');
      if (ev === 'drop') subirArchivos([...e.dataTransfer.files]);
    }));
  }

  // --- Selector "Foto para la publicación" ---
  function abrirSelector(item, pestana) {
    let dlg = document.getElementById('dlg-galeria');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-galeria';
      dlg.className = 'dlg dlg-galeria';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    }
    let pest = pestana || 'galeria';
    const pintar = () => {
      const fotos = lista();
      let cuerpo;
      if (pest === 'galeria') {
        cuerpo = fotos.length
          ? `<p class="gl-ayuda">Toca una foto para usarla en esta publicación.</p><div class="gl-grid gl-grid-chica">${fotos.map((f) => `<button type="button" class="gl-foto gl-elegible" data-gl-usar-cat="${esc(f.categoria)}" data-gl-usar="${esc(f.archivo)}"><img src="${esc(f.url)}" alt="" loading="lazy">${f.ia ? '<span class="gl-ia-tag">✨ IA</span>' : ''}</button>`).join('')}</div>`
          : `<div class="gl-vacia"><b>Tu galería está vacía</b><p>Sube una foto o créala con IA desde las otras pestañas.</p></div>`;
      } else if (pest === 'subir') {
        cuerpo = `<label class="gl-drop gl-drop-grande"><input type="file" accept="image/png,image/jpeg,image/webp" hidden data-gl-subir-pieza><span class="gl-drop-ic">⇪</span><span><b>Elige una foto</b> desde tu computador o celular</span><span class="gl-drop-cat">Se guarda también en tu galería</span></label>`;
      } else {
        cuerpo = formIAHTML(item.idea || '');
      }
      dlg.innerHTML = `<div class="dlg-caja gl-dlg">
        <div class="gl-dlg-cab"><h2>Foto para la publicación</h2><button type="button" class="gl-x" data-gl-cerrar aria-label="Cerrar">×</button></div>
        <div class="gl-pestanas" role="tablist">${[['galeria', '▦ Mi galería'], ['subir', '⬆ Subir'], ['ia', '✨ Crear con IA']].map(([id, t]) => `<button type="button" role="tab" class="gl-pest${pest === id ? ' on' : ''}" data-gl-pest="${id}" aria-selected="${pest === id}">${t}</button>`).join('')}</div>
        <div class="gl-dlg-cuerpo">${cuerpo}</div></div>`;
      if (pest === 'ia') activarFormIA(dlg, { item, alCrear: async () => { await ctx.refrescar(); setTimeout(() => dlg.close(), 900); } });
    };
    dlg.onclick = async (e) => {
      if (e.target === dlg || e.target.closest('[data-gl-cerrar]')) { dlg.close(); return; }
      const p = e.target.closest('[data-gl-pest]');
      if (p) { pest = p.dataset.glPest; pintar(); return; }
      const u = e.target.closest('[data-gl-usar]');
      if (u) {
        u.disabled = true;
        try { await usarEnPieza(item, u.dataset.glUsarCat, u.dataset.glUsar); dlg.close(); } catch (err) { alert(err.mensaje || 'No se pudo usar esa foto.'); u.disabled = false; }
      }
    };
    dlg.onchange = async (e) => {
      const inp = e.target.closest('[data-gl-subir-pieza]');
      if (!inp || !inp.files[0]) return;
      const cat = categorias().includes(item.categoriaFoto) ? item.categoriaFoto : categorias()[0];
      inp.closest('label').querySelector('b').textContent = 'Subiendo…';
      try {
        const nuevas = await subir(cat, [inp.files[0]]);
        if (nuevas[0]) await usarEnPieza(item, cat, nuevas[0]);
        dlg.close();
      } catch (err) { alert('No se pudo subir: ' + (err.mensaje || err.message)); }
    };
    pintar();
    if (!dlg.open) dlg.showModal();
  }

  // Sube una foto desde la tarjeta y la deja como la foto de esa publicación.
  async function subirParaPieza(item, file) {
    const cat = categorias().includes(item.categoriaFoto) ? item.categoriaFoto : categorias()[0];
    const nuevas = await subir(cat, [file]);
    if (nuevas[0]) await usarEnPieza(item, cat, nuevas[0]);
  }

  window.RubrofyGaleria = { iniciar, renderVista, abrirSelector, subirParaPieza };
})();
