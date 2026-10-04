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
    const esImagen = window.RubrofyImagen ? window.RubrofyImagen.esImagen : (f) => /^image\//.test(f.type);
    const fotosElegidas = archivos.filter(esImagen);
    if (archivos.length && !fotosElegidas.length) { const e = new Error('Ese archivo no es una foto.'); e.mensaje = 'Ese archivo no es una foto. Elige una imagen de tu galería.'; throw e; }
    for (const file of fotosElegidas) await ctx.subirFoto(categoria, file);
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
        <label class="btn-approve gl-subir">⬆ Subir fotos<input type="file" accept="image/*" multiple hidden data-gl-subir></label>
        <button type="button" class="btn-ia" data-gl-abrir-ia>✨ Crear con IA</button>
      </div>
      <label class="gl-drop" data-gl-drop>
        <input type="file" accept="image/*" multiple hidden data-gl-subir>
        <span class="gl-drop-ic">⇪</span>
        <span><b>Arrastra aquí tus fotos</b> o haz clic para elegirlas desde tu computador o celular</span>
        <span class="gl-drop-cat">Guardar en: <select data-gl-cat aria-label="Categoría">${cats.map((c) => `<option>${esc(c)}</option>`).join('')}</select></span>
      </label>
      <div class="gl-panel-ia" data-gl-panel-ia hidden>${formIAHTML('')}</div>
      <div class="gl-filtros">${filtros.map(([id, t]) => `<button type="button" class="gl-chip${filtro === id ? ' on' : ''}" data-gl-filtro="${esc(id)}">${esc(t)}</button>`).join('')}<span class="gl-total">${todas.length} foto${todas.length === 1 ? '' : 's'}</span></div>
      ${visibles.length
        ? `<div class="gl-grid">${visibles.map((f, i) => `<figure class="gl-foto gl-ver" data-gl-ver="${i}" tabindex="0" role="button" aria-label="Ver en grande: ${esc(f.categoria)}"><img src="${esc(f.url)}" alt="" loading="lazy">${f.ia ? '<span class="gl-ia-tag">✨ IA</span>' : ''}<figcaption>${esc(f.categoria)}</figcaption><button type="button" class="gl-borrar" data-gl-borrar-cat="${esc(f.categoria)}" data-gl-borrar="${esc(f.archivo)}" title="Eliminar foto" aria-label="Eliminar foto">×</button></figure>`).join('')}</div>`
        : `<div class="gl-vacia"><b>${todas.length ? 'No hay fotos en esta categoría' : 'Tu galería está vacía'}</b><p>Sube fotos reales de tu negocio (tu local, tus productos, tu equipo) o créalas con IA. Rubrofy las usa en tus publicaciones.</p></div>`}`;
    // Una foto que el navegador no puede mostrar (por ejemplo, una HEIC
    // subida antes del arreglo) dice qué hacer en vez de quedar en negro.
    cont.querySelectorAll('.gl-grid img').forEach((img) => img.addEventListener('error', () => {
      const fig = img.closest('.gl-foto');
      if (fig) fig.classList.add('gl-rota');
    }, { once: true }));
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
      alEditar: (n().mediosIA || {}).edicion ? (f) => editarConIA(f, { alTerminar: () => { filtro = 'todas'; renderVista(cont); } }) : null,
    });
    cont.onkeydown = (e) => {
      const v = (e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-gl-ver]') ? e.target : null;
      if (v) { e.preventDefault(); abrirEnGrande(Number(v.dataset.glVer)); }
    };
    const subirArchivos = async (files) => {
      const cat = cont.querySelector('[data-gl-cat]').value;
      if (!files.length) return;
      // En el celular, preparar y subir varias fotos toma unos segundos: se avisa.
      const aviso = cont.querySelector('[data-gl-drop] b');
      const boton = cont.querySelector('.gl-subir');
      if (aviso) aviso.textContent = files.length > 1 ? `Subiendo ${files.length} fotos…` : 'Subiendo tu foto…';
      if (boton) { boton.classList.add('subiendo'); boton.firstChild.textContent = 'Subiendo…'; }
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
        <p class="gl-visor-rota" data-v-rota hidden>No se puede mostrar esta foto. Bórrala y vuelve a subirla desde el panel.</p>
        <button type="button" class="gl-visor-nav gl-visor-ant" data-v-paso="-1" aria-label="Foto anterior">‹</button>
        <button type="button" class="gl-visor-nav gl-visor-sig" data-v-paso="1" aria-label="Foto siguiente">›</button>
      </div>
      <div class="gl-visor-pie">
        <a class="gl-visor-btn" data-v-bajar>⬇ Descargar</a>
        ${op.alEditar ? '<button type="button" class="gl-visor-btn gl-visor-ia" data-v-editar>✨ Editar con IA</button>' : ''}
        ${op.alBorrar ? '<button type="button" class="gl-visor-btn gl-visor-peligro" data-v-borrar>Eliminar</button>' : ''}
      </div></div>`;
    const el = (s) => dlg.querySelector(s);
    const mostrar = () => {
      const f = fs[i];
      const varias = fs.length > 1;
      el('[data-v-img]').hidden = false;
      el('[data-v-rota]').hidden = true;
      el('[data-v-img]').onerror = () => { el('[data-v-img]').hidden = true; el('[data-v-rota]').hidden = false; };
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
      if (e.target.closest('[data-v-editar]')) { const f = fs[i]; dlg.close(); op.alEditar(f); return; }
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

  // --- Editar una foto con IA: el dueño escribe qué cambiar ---
  // La original no se toca: la editada queda como foto nueva (server/server.js:
  // /galeria/editar). Se puede seguir editando la nueva.
  function ideasEdicion() {
    const m = n().marca || {};
    return [
      ['Fondo blanco', 'Cambia el fondo por uno blanco y limpio'],
      ['Colores más cálidos', 'Haz los colores más cálidos y luminosos'],
      ['Agregar un texto', 'Agrega arriba el texto "Oferta 20%" en letras grandes y blancas'],
      ['Quitar lo que sobra', 'Quita del fondo los objetos que distraen'],
      ['Más luz', 'Dale más luz y nitidez, como una foto profesional'],
      ...(m.color ? [['Colores de mi marca', `Usa los colores de mi marca (${m.color}${m.color2 ? ' y ' + m.color2 : ''}) en el fondo y los detalles`]] : []),
    ];
  }

  function editarConIA(foto, { alTerminar } = {}) {
    const CR = window.RubrofyCreditos;
    let base = foto;
    let creadas = 0;
    let dlg = document.getElementById('dlg-editar-ia');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-editar-ia';
      dlg.className = 'dlg dlg-editar-ia';
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = `<div class="dlg-caja ed-caja">
      <div class="gl-dlg-cab"><h2>✨ Editar con IA${window.Ayuda ? window.Ayuda.boton('editar-ia') : ''}</h2><button type="button" class="gl-x" data-ed-cerrar aria-label="Cerrar">×</button></div>
      <div class="ed-cuerpo">
        <div class="ed-fotos">
          <figure class="ed-foto"><img data-ed-base src="${esc(base.url)}" alt="Foto a editar"><figcaption data-ed-base-txt>Original</figcaption></figure>
          <figure class="ed-foto ed-resultado" data-ed-resultado hidden><img alt="Foto editada"><figcaption>Editada ✨</figcaption>
            <div class="ed-res-acc"><button type="button" class="btn-ghost" data-ed-grande>Ver en grande</button><button type="button" class="btn-ghost" data-ed-seguir>Seguir editando esta</button></div></figure>
        </div>
        <form class="ed-form" data-ed-form>
          <label class="gl-campo"><span>¿Qué quieres cambiar?</span>
            <textarea name="instruccion" rows="3" maxlength="600" required placeholder='Ej: cambia el fondo a blanco y agrega arriba el texto "Oferta 20%"'></textarea></label>
          <div class="gl-ideas">${ideasEdicion().map(([t, d]) => `<button type="button" class="gl-idea" data-ed-idea="${esc(d)}">${esc(t)}</button>`).join('')}</div>
          <p class="ed-tip">Para agregar un texto, escríbelo entre comillas: así sale tal cual, con tildes.</p>
          ${CR ? `<div class="gl-campo"><span>Calidad</span>${CR.opcionesHTML('edicion')}</div>` : ''}
          <div class="gl-ia-pie" data-ed-pie></div>
          <p class="config-error" data-ed-error hidden></p>
          <p class="ed-nota">Tu foto original no cambia: la editada se guarda como una foto nueva en tu galería.</p>
        </form>
      </div></div>`;
    const form = dlg.querySelector('[data-ed-form]');
    const pie = () => {
      const p = form.querySelector('[data-ed-pie]');
      if (!CR) return;
      if (n().sinPlan) { p.innerHTML = '<span class="gl-cupo">Elige un plan para editar fotos con IA.</span>'; return; }
      const costo = CR.costoDe(form, 'edicion');
      const alcanza = CR.disponible('edicion') >= costo.creditos && !(n().creditos && n().creditos.pausa);
      p.innerHTML = `<span class="gl-cupo">${CR.resumenHTML('edicion', costo)}</span>${alcanza ? '' : '<button type="button" class="btn-ghost" data-ed-recargar>⚡ Comprar créditos</button>'}
        <button type="submit" class="btn-ia"${alcanza ? '' : ' disabled'}>${creadas ? '✨ Editar otra vez' : '✨ Editar foto'}</button>`;
    };
    let ultima = null;
    dlg.onclick = (e) => {
      if (e.target === dlg || e.target.closest('[data-ed-cerrar]')) { dlg.close(); return; }
      const idea = e.target.closest('[data-ed-idea]');
      if (idea) { form.instruccion.value = idea.dataset.edIdea; form.instruccion.focus(); return; }
      if (e.target.closest('[data-ed-recargar]') && window.RubrofyRecargas) { dlg.close(); window.RubrofyRecargas.abrir('creditos'); return; }
      if (e.target.closest('[data-ed-grande]') && ultima) { verFotos([ultima], 0); return; }
      if (e.target.closest('[data-ed-seguir]') && ultima) {
        base = ultima;
        dlg.querySelector('[data-ed-base]').src = base.url;
        dlg.querySelector('[data-ed-base-txt]').textContent = 'La que vas a editar';
        dlg.querySelector('[data-ed-resultado]').hidden = true;
        form.instruccion.value = '';
        form.instruccion.focus();
      }
    };
    form.addEventListener('change', (e) => { if (e.target.name === 'calidad') pie(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const error = form.querySelector('[data-ed-error]');
      const btn = form.querySelector('button[type="submit"]');
      const res = dlg.querySelector('[data-ed-resultado]');
      error.hidden = true;
      btn.disabled = true;
      btn.textContent = 'Editando… (10 a 40 segundos)';
      res.hidden = false;
      res.classList.add('cargando');
      res.querySelector('img').removeAttribute('src');
      try {
        const r = await ctx.api(`/api/negocios/${n().id}/galeria/editar`, {
          method: 'POST',
          body: JSON.stringify({ categoria: base.categoria, archivo: base.archivo, instruccion: form.instruccion.value, calidad: (form.querySelector('input[name="calidad"]:checked') || {}).value }),
        });
        ctx.setFotos(r.fotos);
        if (r.negocio) ctx.setNegocio(r.negocio);
        if (CR) CR.pintarChip();
        creadas += 1;
        ultima = { categoria: r.categoria, archivo: r.archivo, url: url(r.categoria, r.archivo), ia: true };
        res.querySelector('img').src = ultima.url;
      } catch (err) {
        res.hidden = true;
        error.textContent = err.mensaje || 'No se pudo editar la foto. Intenta de nuevo.';
        error.hidden = false;
      } finally {
        res.classList.remove('cargando');
        pie();
      }
    });
    dlg.addEventListener('close', () => { if (creadas && alTerminar) alTerminar(); }, { once: true });
    pie();
    if (!dlg.open) dlg.showModal();
    setTimeout(() => form.instruccion.focus(), 50);
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
        cuerpo = `<label class="gl-drop gl-drop-grande"><input type="file" accept="image/*" hidden data-gl-subir-pieza><span class="gl-drop-ic">⇪</span><span><b>Elige una foto</b> desde tu computador o celular</span><span class="gl-drop-cat">Se guarda también en tu galería</span></label>`;
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

  window.RubrofyGaleria = { iniciar, renderVista, abrirSelector, subirParaPieza, verFotos, editarConIA };
})();
