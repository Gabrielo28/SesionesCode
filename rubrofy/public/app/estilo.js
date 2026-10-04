// Vista "Mi estilo": el negocio le muestra a Rubrofy el contenido que ya
// hace (importado de Instagram o agregado a mano) y revisa la guía de
// estilo que la IA aprende de eso. Datos de /api/negocios/:id/estilo.
(function () {
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');
  const FORMATOS = [
    { id: 'post', label: 'Post', plural: 'posts' }, { id: 'carrusel', label: 'Carrusel', plural: 'carruseles' },
    { id: 'reel', label: 'Reel', plural: 'reels' }, { id: 'historia', label: 'Historia', plural: 'historias' },
  ];
  let filtro = 'todos';
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function leerBase64(file) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = reject;
      lector.readAsDataURL(file);
    });
  }

  async function render(cont, ctx) {
    cont.innerHTML = '<p class="sub">Cargando…</p>';
    try {
      pintar(cont, await ctx.api(`/api/negocios/${ctx.negocio.id}/estilo`), ctx);
    } catch (err) {
      cont.innerHTML = `<div class="res-aviso error">${e(err.mensaje || 'No se pudo cargar tu estilo.')}</div>`;
    }
  }

  function pintar(cont, d, ctx) {
    const refs = d.referencias;
    const g = d.estilo || { general: '', porFormato: {} };
    const visibles = filtro === 'todos' ? refs : refs.filter((r) => r.formato === filtro);
    const mezcla = d.mezcla
      ? `<span>Tu mezcla: ${FORMATOS.filter((f) => d.mezcla[f.id]).map((f) => `<b>${f.plural} ${d.mezcla[f.id]}%</b>`).join(' · ')}. Rubrofy propone tu contenido en esa proporción.</span>`
      : `<span>Con 5 o más ejemplos, Rubrofy propone tu contenido en la misma mezcla de formatos que usas (llevas ${refs.length}).</span>`;
    const origenGuia = g.editadoEl ? `Editada por ti el ${new Date(g.editadoEl).toLocaleDateString('es-CL')}`
      : (g.generadoEl ? `Aprendida por la IA de ${g.basadoEn} ejemplos el ${new Date(g.generadoEl).toLocaleDateString('es-CL')}` : 'Todavía no hay guía.');

    cont.innerHTML = `
      <div class="res-controles">
        ${d.instagramConectado
          ? '<button class="btn-approve estilo-btn" data-estilo="importar">Importar mis publicaciones de Instagram</button>'
          : '<span class="res-estado">Conecta Instagram en Conexiones y ajustes para importar tus publicaciones de un clic.</span>'}
        <span class="res-estado" data-msg></span>
      </div>
      <div class="res-aviso">${mezcla}</div>

      <div class="res-grid">
        <div class="res-card">
          <h2>Tu guía de estilo${AY('estilo-guia')}</h2>
          <p class="sub">La IA la sigue al escribir tu contenido. Puedes corregirla: lo que escribas aquí manda.</p>
          <label class="estilo-campo">General
            <textarea data-guia="general" rows="3" placeholder="Ej: cercano, tuteo, frases cortas, 1-2 emojis, siempre cierra invitando a escribir por WhatsApp">${e(g.general)}</textarea>
          </label>
          ${FORMATOS.map((f) => `
            <label class="estilo-campo">${f.label}
              <textarea data-guia="${f.id}" rows="2" placeholder="Cómo son tus ${f.plural}">${e((g.porFormato || {})[f.id])}</textarea>
            </label>`).join('')}
          <div class="estilo-acciones">
            <button class="btn-approve estilo-btn" data-estilo="guardar">Guardar guía</button>
            ${d.puedeAnalizar
              ? `<button class="btn-ghost" data-estilo="analizar" ${refs.length < 3 || !d.iaConfigurada ? 'disabled' : ''}>Analizar mi estilo con IA</button>`
              : '<span class="res-estado">El análisis con IA está en los planes Pro y Estudio.</span>'}
          </div>
          <span class="res-estado">${e(origenGuia)}</span>
        </div>

        <form class="res-card" data-form="referencia">
          <h2>Agregar un ejemplo${AY('estilo-agregar')}</h2>
          <p class="sub">Pega el texto de una publicación, sube una captura, o ambas. La nota le explica a la IA qué es (ej: "así hacemos las promos de los viernes").</p>
          <label class="estilo-campo">Formato
            <select name="formato">${FORMATOS.map((f) => `<option value="${f.id}">${f.label}</option>`).join('')}</select>
          </label>
          <label class="estilo-campo">Texto de la publicación
            <textarea name="texto" rows="4"></textarea>
          </label>
          <label class="estilo-campo">Nota (opcional)
            <input name="nota" type="text" maxlength="300">
          </label>
          <label class="estilo-campo">Captura o imagen (opcional)
            <input name="imagen" type="file" accept="image/*">
          </label>
          <div class="estilo-acciones"><button class="btn-approve estilo-btn" type="submit">Agregar ejemplo</button></div>
        </form>
      </div>

      <div class="res-card">
        <div class="estilo-cabecera">
          <h2>Tus ejemplos (${refs.length})${AY('estilo-ejemplos')}</h2>
          <div class="segmentado">
            ${[{ id: 'todos', label: 'Todos' }, ...FORMATOS].map((f) => `<button data-filtro="${f.id}" class="${filtro === f.id ? 'activo' : ''}">${f.label}</button>`).join('')}
          </div>
        </div>
        ${visibles.length ? `<div class="estilo-refs">${visibles.map((r) => `
          <div class="estilo-ref">
            ${r.imagen ? `<img src="/referencias/${e(ctx.negocio.id)}/${e(r.imagen)}" alt="" loading="lazy">` : '<div class="estilo-ref-sinimg">Sin imagen</div>'}
            <div class="estilo-ref-cuerpo">
              <span class="estilo-ref-meta">${FORMATOS.find((f) => f.id === r.formato).label} · ${r.origen === 'instagram' ? 'de tu Instagram' : 'agregado a mano'}</span>
              ${r.nota ? `<span class="estilo-ref-nota">${e(r.nota)}</span>` : ''}
              <p>${e((r.texto || '').slice(0, 220))}</p>
              <div class="estilo-ref-pie">
                ${r.permalink ? `<a href="${e(r.permalink)}" target="_blank" rel="noopener">Ver</a>` : '<span></span>'}
                <button class="btn-text" data-borrar="${e(r.id)}">Quitar</button>
              </div>
            </div>
          </div>`).join('')}</div>` : '<p class="sub vacio">Todavía no hay ejemplos de este tipo.</p>'}
      </div>
    `;

    const msg = cont.querySelector('[data-msg]');
    const api = (ruta, op) => ctx.api(`/api/negocios/${ctx.negocio.id}/estilo${ruta}`, op);
    const recargar = (datos) => pintar(cont, datos, ctx);

    const btnImportar = cont.querySelector('[data-estilo="importar"]');
    if (btnImportar) btnImportar.addEventListener('click', async () => {
      btnImportar.disabled = true;
      msg.textContent = 'Importando tus publicaciones…';
      try {
        const r = await api('/importar', { method: 'POST' });
        recargar(r);
        cont.querySelector('[data-msg]').textContent = r.importadas ? `Se importaron ${r.importadas} publicaciones.` : 'No había publicaciones nuevas para importar.';
      } catch (err) {
        msg.textContent = err.mensaje || 'No se pudo importar.';
        btnImportar.disabled = false;
      }
    });

    cont.querySelector('[data-estilo="guardar"]').addEventListener('click', async () => {
      const guia = { general: cont.querySelector('[data-guia="general"]').value, porFormato: {} };
      for (const f of FORMATOS) guia.porFormato[f.id] = cont.querySelector(`[data-guia="${f.id}"]`).value;
      try {
        recargar(await api('', { method: 'PUT', body: JSON.stringify(guia) }));
        cont.querySelector('[data-msg]').textContent = 'Guía guardada.';
      } catch (err) {
        msg.textContent = err.mensaje || 'No se pudo guardar.';
      }
    });

    const btnAnalizar = cont.querySelector('[data-estilo="analizar"]');
    if (btnAnalizar) btnAnalizar.addEventListener('click', async () => {
      btnAnalizar.disabled = true;
      msg.textContent = 'La IA está estudiando tus ejemplos…';
      try {
        recargar(await api('/analizar', { method: 'POST' }));
        cont.querySelector('[data-msg]').textContent = 'Guía actualizada. Revísala y corrige lo que no te represente.';
      } catch (err) {
        msg.textContent = err.mensaje || 'No se pudo analizar.';
        btnAnalizar.disabled = false;
      }
    });

    cont.querySelector('[data-form="referencia"]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const form = ev.target;
      const archivo = form.imagen.files[0];
      const datos = { formato: form.formato.value, texto: form.texto.value, nota: form.nota.value };
      if (archivo) {
        let lista = archivo;
        try { if (window.RubrofyImagen) lista = await window.RubrofyImagen.preparar(archivo); } catch (err) { alert(err.mensaje || err.message); return; }
        datos.imagenBase64 = await leerBase64(lista);
        datos.filename = lista.name;
      }
      try {
        recargar(await api('/referencias', { method: 'POST', body: JSON.stringify(datos) }));
        cont.querySelector('[data-msg]').textContent = 'Ejemplo agregado.';
      } catch (err) {
        msg.textContent = err.mensaje || 'No se pudo agregar.';
      }
    });

    cont.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => {
      filtro = b.dataset.filtro;
      recargar(d);
    }));
    cont.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
      try {
        recargar(await api(`/referencias/${b.dataset.borrar}`, { method: 'DELETE' }));
      } catch (err) {
        msg.textContent = err.mensaje || 'No se pudo quitar.';
      }
    }));
  }

  window.RubrofyEstilo = { render };
})();
