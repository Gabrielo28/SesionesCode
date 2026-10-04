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
    const CR = window.RubrofyCreditos;
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
      ${CR ? `<div class="gl-campo"><span>Calidad</span>${CR.opcionesHTML('foto')}</div>` : ''}
      <div class="gl-ia-pie" data-gl-pie></div>
      <p class="config-error" data-gl-error hidden></p>
      <div class="gl-resultados" data-gl-resultados></div>
    </form>`;
  }

  // Pie del formulario: cuánto usa la foto elegida y el botón (o comprar créditos).
  function pintarPie(form, textoBoton) {
    const CR = window.RubrofyCreditos;
    const pie = form.querySelector('[data-gl-pie]');
    if (!pie || !CR) return;
    if (n().sinPlan) {
      pie.innerHTML = '<span class="gl-cupo">Elige un plan para crear fotos con IA.</span>';
      return;
    }
    const costo = CR.costoDe(form, 'foto');
    const alcanza = CR.disponible('foto') >= costo.creditos && !(n().creditos && n().creditos.pausa);
    pie.innerHTML = `<span class="gl-cupo">${CR.resumenHTML('foto', costo)}</span>${alcanza ? '' : '<button type="button" class="btn-ghost" data-gl-recargar>⚡ Comprar créditos</button>'}
      <button type="submit" class="btn-ia"${alcanza ? '' : ' disabled'}>${textoBoton || '✨ Crear foto'}</button>`;
  }

  // Activa el formulario. alCrear({ categoria, archivo }) se llama con cada foto nueva.
  function activarFormIA(raiz, { item, alCrear }) {
    const form = raiz.querySelector('[data-gl-ia]');
    if (!form) return;
    pintarPie(form);
    form.addEventListener('change', (e) => { if (e.target.name === 'calidad') pintarPie(form); });
    form.addEventListener('click', (e) => {
      const idea = e.target.closest('[data-gl-idea]');
      if (idea) form.texto.value = idea.dataset.glIdea;
      const nueva = e.target.closest('[data-gl-ver-nueva]');
      if (nueva) verFotos([{ categoria: nueva.dataset.glVerNuevaCat, archivo: nueva.dataset.glVerNueva, url: url(nueva.dataset.glVerNuevaCat, nueva.dataset.glVerNueva), ia: true }], 0);
      if (e.target.closest('[data-gl-recargar]') && window.RubrofyRecargas) {
        const dlg = document.getElementById('dlg-galeria');
        if (dlg && dlg.open) dlg.close();
        window.RubrofyRecargas.abrir('creditos');
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
          body: JSON.stringify({ texto: form.texto.value, estilo: form.estilo.value, formato: form.formato.value, calidad: (form.querySelector('input[name="calidad"]:checked') || {}).value, itemId: item ? item.id : undefined }),
        });
        ctx.setFotos(r.fotos);
        if (r.negocio) ctx.setNegocio(r.negocio);
        espera.className = 'gl-res';
        espera.classList.add('gl-ver');
        espera.dataset.glVerNuevaCat = r.categoria;
        espera.dataset.glVerNueva = r.archivo;
        espera.title = 'Ver en grande';
        espera.innerHTML = `<img src="${esc(url(r.categoria, r.archivo))}" alt="Foto creada con IA"><span class="gl-ia-tag">✨ IA</span>`;
        if (window.RubrofyCreditos) window.RubrofyCreditos.pintarChip();
        if (alCrear) await alCrear({ categoria: r.categoria, archivo: r.archivo });
      } catch (e2) {
        espera.remove();
        err.textContent = e2.mensaje || 'No se pudo crear la foto. Intenta de nuevo.';
        err.hidden = false;
      } finally {
        pintarPie(form, '✨ Crear otra');
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
        ? `<div class="gl-grid">${visibles.map((f, i) => `<figure class="gl-foto gl-ver" data-gl-ver="${i}" tabindex="0" role="button" aria-label="Ver en grande: ${esc(f.categoria)}"><img src="${esc(f.url)}" alt="" loading="lazy">${f.ia ? '<span class="gl-ia-tag">✨ IA</span>' : ''}<figcaption>${esc(f.categoria)}</figcaption><button type="button" class="gl-borrar" data-gl-borrar-cat="${esc(f.categoria)}" data-gl-borrar="${esc(f.archivo)}" title="Eliminar foto" aria-label="Eliminar foto">×</button></figure>`).join('')}</div>`
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
        return;
      }
      const v = e.target.closest('[data-gl-ver]');
      if (v) abrirEnGrande(Number(v.dataset.glVer));
      // Al cerrar el panel de IA con fotos nuevas, la cuadrícula se actualiza.
    };
    const abrirEnGrande = (i) => verFotos(visibles, i, {
      alBorrar: async (f) => { await ctx.borrarFoto(f.categoria, f.archivo); renderVista(cont); },
    });
    cont.onkeydown = (e) => {
      const v = (e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-gl-ver]') ? e.target : null;
      if (v) { e.preventDefault(); abrirEnGrande(Number(v.dataset.glVer)); }
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

  // --- Visor: la foto en grande, con flechas (o deslizando) para pasar a la
  // siguiente. opciones.alBorrar(foto) agrega el botón Eliminar.
  let pasoVisor = null;
  function verFotos(fotos, inicio, opciones) {
    const op = opciones || {};
    const fs = fotos.slice();
    if (!fs.length) return;
    let i = Math.max(0, Math.min(Number(inicio) || 0, fs.length - 1));
    let dlg = document.getElementById('dlg-visor');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-visor';
      dlg.className = 'gl-visor';
      dlg.setAttribute('aria-label', 'Foto en grande');
      document.body.appendChild(dlg);
      // Flechas del teclado, aunque el foco haya quedado fuera de un botón.
      document.addEventListener('keydown', (e) => {
        if (!dlg.open || !pasoVisor || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
        e.preventDefault();
        pasoVisor(e.key === 'ArrowRight' ? 1 : -1);
      });
      dlg.addEventListener('close', () => { dlg.querySelector('[data-v-img]')?.removeAttribute('src'); });
    }
    dlg.innerHTML = `<div class="gl-visor-caja">
      <div class="gl-visor-cab"><span class="gl-visor-info" data-v-info></span><button type="button" class="gl-visor-x" data-v-cerrar aria-label="Cerrar">×</button></div>
      <div class="gl-visor-escena" data-v-escena>
        <img data-v-img alt="">
        <button type="button" class="gl-visor-nav gl-visor-ant" data-v-paso="-1" aria-label="Foto anterior">‹</button>
        <button type="button" class="gl-visor-nav gl-visor-sig" data-v-paso="1" aria-label="Foto siguiente">›</button>
      </div>
      <div class="gl-visor-pie">
        <a class="gl-visor-btn" data-v-bajar>⬇ Descargar</a>
        ${op.alBorrar ? '<button type="button" class="gl-visor-btn gl-visor-peligro" data-v-borrar>Eliminar</button>' : ''}
      </div></div>`;
    const el = (s) => dlg.querySelector(s);
    const mostrar = () => {
      const f = fs[i];
      const varias = fs.length > 1;
      el('[data-v-img]').src = f.url;
      el('[data-v-img]').alt = `Foto: ${f.categoria}`;
      el('[data-v-info]').innerHTML = `${f.ia ? '<span class="gl-ia-tag">✨ IA</span>' : ''}<b>${esc(f.categoria)}</b>${varias ? `<small>${i + 1} de ${fs.length}</small>` : ''}`;
      el('[data-v-bajar]').href = f.url;
      el('[data-v-bajar]').download = f.archivo;
      dlg.querySelectorAll('[data-v-paso]').forEach((b) => { b.hidden = !varias; });
      // Precarga las vecinas para que pasar de foto sea instantáneo.
      if (varias) [1, -1].forEach((d) => { new Image().src = fs[(i + d + fs.length) % fs.length].url; });
    };
    pasoVisor = (d) => { if (fs.length > 1) { i = (i + d + fs.length) % fs.length; mostrar(); } };
    dlg.onclick = async (e) => {
      if (e.target === dlg || e.target.matches('[data-v-escena]') || e.target.closest('[data-v-cerrar]')) { dlg.close(); return; }
      const p = e.target.closest('[data-v-paso]');
      if (p) { pasoVisor(Number(p.dataset.vPaso)); return; }
      const b = e.target.closest('[data-v-borrar]');
      if (b) {
        if (!confirm('¿Eliminar esta foto de tu galería?')) return;
        b.disabled = true;
        try { await op.alBorrar(fs[i]); } catch (err) { alert('No se pudo borrar: ' + (err.mensaje || err.message)); b.disabled = false; return; }
        b.disabled = false;
        fs.splice(i, 1);
        if (!fs.length) { dlg.close(); return; }
        i = Math.min(i, fs.length - 1);
        mostrar();
      }
    };
    // En el celular: deslizar hacia los lados para pasar de foto.
    let x0 = null;
    dlg.ontouchstart = (e) => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; };
    dlg.ontouchend = (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) pasoVisor(dx < 0 ? 1 : -1);
    };
    mostrar();
    if (!dlg.open) dlg.showModal();
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
          ? `<p class="gl-ayuda">Toca una foto para usarla en esta publicación.</p><div class="gl-grid gl-grid-chica">${fotos.map((f, i) => `<div class="gl-foto gl-elegible-caja"><button type="button" class="gl-elegible" data-gl-usar-cat="${esc(f.categoria)}" data-gl-usar="${esc(f.archivo)}" aria-label="Usar esta foto"><img src="${esc(f.url)}" alt="" loading="lazy"></button>${f.ia ? '<span class="gl-ia-tag">✨ IA</span>' : ''}<button type="button" class="gl-lupa" data-gl-lupa="${i}" title="Ver en grande" aria-label="Ver en grande">⤢</button></div>`).join('')}</div>`
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
      const l = e.target.closest('[data-gl-lupa]');
      if (l) { verFotos(lista(), Number(l.dataset.glLupa)); return; }
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

  window.RubrofyGaleria = { iniciar, renderVista, abrirSelector, subirParaPieza, verFotos };
})();
