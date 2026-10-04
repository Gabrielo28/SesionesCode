// Estudio de reels: "Mis videos" (la galería de videos del negocio) y
// "Reels por publicar" (cada reel con su avance: video → edición → aprobado).
// Ver server/videos.js y las rutas /api/negocios/:id/videos en server.js.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAX_BYTES = 100 * 1024 * 1024;
  let ctx = null;
  let datos = null;        // { videos, max } de la última carga
  let cargando = null;     // promesa en curso
  let pestana = 'reels';   // reels | videos
  let subidas = [];        // [{ nombre, pct }] mientras se suben
  let resaltar = null;     // id del reel recién tocado
  let sondeo = null;

  try { pestana = localStorage.getItem('rubrofy-reels-pestana') === 'videos' ? 'videos' : 'reels'; } catch (e) { /* sin almacenamiento */ }

  function iniciar(c) { ctx = c; }
  const n = () => ctx.negocio();
  const urlDe = (v) => `/videos/${n().id}/${encodeURIComponent(v.archivo)}`;
  const esVideo = (f) => /^video\//.test(f.type) || /\.(mp4|mov|m4v)$/i.test(f.name || '');
  const tipoDe = (f) => (/quicktime/.test(f.type) || /\.mov$/i.test(f.name || '') ? 'video/quicktime' : 'video/mp4');
  const fmtDur = (s) => { if (!s) return ''; const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const fmtMB = (b) => `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  const titulo = (it) => String(it.gancho || it.headline || 'Reel').replace(/\n/g, ' ');
  const edicionLista = () => !!(n().edicionReels && n().edicionReels.disponible);

  function estadoDe(v) {
    if (v.editando) return ['editando', 'Editando…'];
    if (v.enReels.some((r) => r.publicado)) return ['reel', 'Publicado'];
    if (v.enReels.length) return ['reel', 'En un reel'];
    if (v.origen === 'editado') return ['editado', 'Editado'];
    return ['sin', 'Sin editar'];
  }

  // Los reels que todavía se pueden cambiar (ni publicados ni publicándose).
  function reelsAbiertos() {
    return ctx.contenido()
      .filter((i) => ctx.formatoDe(i) === 'reel' && i.status !== 'rechazado' && !(i.instagram && i.instagram.ok)
        && !(i.publicacion && ['publicando', 'publicada'].includes(i.publicacion.estado)))
      .sort((a, b) => String(a.publicarEl || '').localeCompare(String(b.publicarEl || '')));
  }

  // ---------- datos ----------
  async function cargar() {
    if (!cargando) {
      cargando = ctx.api(`/api/negocios/${n().id}/videos`)
        .then((r) => { datos = r; return r; })
        .finally(() => { cargando = null; });
    }
    return cargando;
  }

  // Duración leída del archivo en el navegador (null si no se puede).
  function duracionDe(file) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      const url = URL.createObjectURL(file);
      const fin = (d) => { URL.revokeObjectURL(url); resolve(Number.isFinite(d) && d > 0 ? d : null); };
      const t = setTimeout(() => fin(null), 6000);
      v.preload = 'metadata';
      v.onloadedmetadata = () => { clearTimeout(t); fin(v.duration); };
      v.onerror = () => { clearTimeout(t); fin(null); };
      v.src = url;
    });
  }

  function subirUno(file, alAvanzar) {
    return duracionDe(file).then((dur) => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/negocios/${n().id}/videos`);
      xhr.setRequestHeader('content-type', tipoDe(file));
      xhr.setRequestHeader('x-rubrofy-panel', '1');
      xhr.setRequestHeader('x-nombre', encodeURIComponent(file.name || 'Video'));
      if (dur) xhr.setRequestHeader('x-duracion', String(Math.round(dur * 10) / 10));
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && alAvanzar) alAvanzar(Math.round(e.loaded / e.total * 100)); };
      xhr.onload = () => {
        let r = {};
        try { r = JSON.parse(xhr.responseText); } catch (e) { /* respuesta vacía */ }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(r.video);
        const err = new Error(r.error || 'No se pudo subir el video');
        err.mensaje = err.message;
        reject(err);
      };
      xhr.onerror = () => { const err = new Error('Se cortó la conexión mientras se subía el video.'); err.mensaje = err.message; reject(err); };
      xhr.send(file);
    }));
  }

  // Sube varios videos a "Mis videos", uno tras otro. Devuelve los subidos.
  async function subir(archivos, alCambiar) {
    const lista = Array.from(archivos || []);
    const malos = lista.filter((f) => !esVideo(f));
    const grandes = lista.filter((f) => esVideo(f) && f.size > MAX_BYTES);
    const buenos = lista.filter((f) => esVideo(f) && f.size <= MAX_BYTES);
    const errores = [];
    if (malos.length) errores.push(`${malos.length === 1 ? `"${malos[0].name}" no es un video` : `${malos.length} archivos no son videos`} (usa MP4 o MOV).`);
    grandes.forEach((f) => errores.push(`"${f.name}" pesa ${fmtMB(f.size)}; el máximo es 100 MB.`));
    const hechos = [];
    subidas = buenos.map((f) => ({ nombre: f.name, pct: 0 }));
    if (alCambiar) alCambiar();
    for (let i = 0; i < buenos.length; i++) {
      try {
        hechos.push(await subirUno(buenos[i], (pct) => { subidas[i].pct = pct; if (alCambiar) alCambiar(); }));
      } catch (err) {
        errores.push(`"${buenos[i].name}": ${err.mensaje}`);
      }
      subidas[i].pct = 100;
      subidas[i].listo = true;
      if (alCambiar) alCambiar();
    }
    subidas = [];
    if (hechos.length) await cargar().catch(() => {});
    if (errores.length) alert(errores.join('\n'));
    return hechos;
  }

  // ---------- el Estudio ----------
  function renderEstudio(cont, opciones) {
    if (opciones && opciones.pestana) pestana = opciones.pestana;
    const reels = reelsAbiertos();
    const sinVideo = reels.filter((i) => !i.video).length;
    const nVideos = datos ? datos.videos.length : null;
    cont.innerHTML = `<div class="pestanas vd-pestanas" role="tablist" aria-label="Estudio de reels">
        <button type="button" role="tab" data-vd-pest="reels" class="${pestana === 'reels' ? 'activa' : ''}" aria-selected="${pestana === 'reels'}">📋 Reels por publicar <span class="vd-num${sinVideo ? ' falta' : ''}">${reels.length}</span></button>
        <button type="button" role="tab" data-vd-pest="videos" class="${pestana === 'videos' ? 'activa' : ''}" aria-selected="${pestana === 'videos'}">🎞 Mis videos${nVideos !== null ? ` <span class="vd-num">${nVideos}</span>` : ''}</button>
      </div>
      <div data-vd-cuerpo></div>`;
    const cuerpo = cont.querySelector('[data-vd-cuerpo]');
    if (pestana === 'reels') pintarReels(cuerpo, reels);
    else pintarVideos(cuerpo);
    cont.onclick = (e) => {
      const p = e.target.closest('[data-vd-pest]');
      if (p) {
        pestana = p.dataset.vdPest;
        try { localStorage.setItem('rubrofy-reels-pestana', pestana); } catch (err) { /* sin almacenamiento */ }
        return renderEstudio(cont);
      }
      return (pestana === 'reels' ? clicReels : clicVideos)(e, cont);
    };
    cont.onchange = (e) => {
      const inp = e.target.closest('[data-vd-subir]');
      if (inp && inp.files.length) subirDesdeEstudio(cont, inp.files);
    };
    // Arrastrar y soltar videos sobre la zona de subida.
    cont.ondragover = (e) => { const z = e.target.closest('[data-vd-drop]'); if (!z) return; e.preventDefault(); z.classList.add('sobre'); };
    cont.ondragleave = (e) => { const z = e.target.closest('[data-vd-drop]'); if (z) z.classList.remove('sobre'); };
    cont.ondrop = (e) => {
      const z = e.target.closest('[data-vd-drop]');
      if (!z) return;
      e.preventDefault();
      z.classList.remove('sobre');
      if (e.dataTransfer.files.length) subirDesdeEstudio(cont, e.dataTransfer.files);
    };
    if (!datos) cargar().then(() => { if (cont.isConnected) renderEstudio(cont); }).catch(() => {});
    vigilar(cont);
  }

  // Mientras un video de la galería se edita, se vuelve a consultar.
  function vigilar(cont) {
    clearTimeout(sondeo);
    if (!datos || !datos.videos.some((v) => v.editando)) return;
    sondeo = setTimeout(async () => {
      if (!cont.isConnected || cont.closest('[hidden]')) return;
      if (!document.hidden) await cargar().catch(() => {});
      if (cont.isConnected && !cont.closest('[hidden]')) renderEstudio(cont);
    }, 8000);
  }

  async function subirDesdeEstudio(cont, files) {
    pestana = 'videos';
    renderEstudio(cont);
    await subir(files, () => { const z = cont.querySelector('[data-vd-subidas]'); if (z) z.innerHTML = htmlSubidas(); });
    if (cont.isConnected) renderEstudio(cont);
  }

  // ---------- pestaña: Reels por publicar ----------
  function pasos(it) {
    const v = it.video, ed = it.edicion || {};
    const aprobado = it.status === 'aprobado';
    const paso = (clase, texto) => `<li class="${clase}">${texto}</li>`;
    const p1 = v ? paso('hecho', 'Video') : paso('actual', 'Video');
    let p2;
    if (ed.estado === 'editando') p2 = paso('actual en-curso', 'Edición');
    else if (v && v.editado) p2 = paso('hecho', 'Edición');
    else if (aprobado && v) p2 = paso('omitido', 'Sin edición');
    else p2 = paso(v ? 'actual' : '', 'Edición');
    const p3 = aprobado ? paso('hecho', 'Aprobado') : paso(v && (v.editado || !edicionLista()) && ed.estado !== 'editando' ? 'actual' : '', 'Aprobado');
    return `<ol class="rs-progreso" aria-label="Avance del reel">${p1}${p2}${p3}</ol>`;
  }

  function filaReel(it) {
    const v = it.video, ed = it.edicion || {}, ia = it.videoIA || {};
    const aprobado = it.status === 'aprobado';
    let estado = '', principal = '', extras = [];
    if (!v && ia.estado === 'generando') {
      estado = '<span class="rs-estado rs-editando">Creando el video con IA… suele tardar 1 a 3 minutos</span>';
    } else if (!v) {
      estado = it.idea ? `<span class="rs-idea">Qué grabar: ${esc(it.idea)}</span>` : '<span class="rs-estado rs-falta">Falta el video</span>';
      principal = `<button type="button" class="btn-approve" data-rs="elegir" data-id="${it.id}">🎬 Elegir video</button>`;
    } else if (ed.estado === 'editando') {
      estado = '<span class="rs-estado rs-editando">Editando… suele tardar 1 o 2 minutos</span>';
    } else if (aprobado) {
      estado = `<span class="rs-estado rs-listo">✓ Aprobado${it.date ? ` · se publica ${esc(it.date)}` : ''}</span>`;
      extras.push(`<button type="button" class="btn-text" data-rs="elegir" data-id="${it.id}">Cambiar video</button>`);
    } else if (!v.editado && edicionLista()) {
      estado = '<span class="rs-estado">Video listo, sin editar</span>';
      principal = `<button type="button" class="btn-approve" data-rs="editar" data-id="${it.id}">✂ Editar con Rubrofy</button>`;
      extras.push(`<button type="button" class="btn-text" data-rs="aprobar" data-id="${it.id}">Aprobar sin editar</button>`, `<button type="button" class="btn-text" data-rs="elegir" data-id="${it.id}">Cambiar video</button>`);
    } else {
      estado = v.editado ? `<span class="rs-estado rs-listo">✓ Editado${ed.duracion ? ` · ${String(ed.duracion).replace('.', ',')} s` : ''}</span>` : '<span class="rs-estado">Video listo</span>';
      principal = `<button type="button" class="btn-approve" data-rs="aprobar" data-id="${it.id}">✓ Revisar y aprobar</button>`;
      if (edicionLista()) extras.push(`<button type="button" class="btn-text" data-rs="editar" data-id="${it.id}">Editar de nuevo</button>`);
      if (it.videoOriginal) extras.push(`<button type="button" class="btn-text" data-rs="original" data-id="${it.id}">Volver al original</button>`);
      extras.push(`<button type="button" class="btn-text" data-rs="elegir" data-id="${it.id}">Cambiar video</button>`);
    }
    if (ed.estado === 'error') estado += `<span class="rs-estado rs-falta">La edición falló: ${esc(ed.error || '')}</span>`;
    if (ia.estado === 'error' && !v) estado += `<span class="rs-estado rs-falta">El video con IA falló: ${esc(ia.error || '')}</span>`;
    const src = v ? urlDe(v) : null;
    return `<article class="rs-item${resaltar === it.id ? ' resaltado' : ''}" id="rs-${esc(it.id)}">
      ${src ? `<button type="button" class="rs-thumb" data-rs="ver" data-id="${it.id}" aria-label="Ver el video"><video src="${esc(src)}#t=0.5" muted playsinline preload="metadata"></video><span class="rs-play">▶</span></button>` : '<div class="rs-thumb"><span>🎬</span></div>'}
      <div class="rs-info"><b>${esc(titulo(it))}</b><span class="rs-fecha">${esc(it.date || '')}</span>${pasos(it)}${estado}</div>
      <div class="rs-acc">${principal}${extras.length ? `<div class="rs-extras">${extras.join('')}</div>` : ''}</div>
    </article>`;
  }

  function pintarReels(cuerpo, reels) {
    const er = n().edicionReels || {};
    cuerpo.innerHTML = `${er.disponible ? '' : '<p class="rs-nota">La edición automática se está activando en el servidor. Mientras tanto puedes subir tus videos.</p>'}
      ${reels.length ? `<div class="rs-lista">${reels.map(filaReel).join('')}</div>`
        : `<div class="gl-vacia"><b>No tienes reels por publicar</b><p>Sube un video en <b>Mis videos</b> y toca <b>Usar en un reel</b>: Rubrofy le escribe el gancho y el texto. También puedes pedir más reels en <b>Estrategia → Cuánto publicar</b>.</p><button type="button" class="btn-approve" data-vd-pest="videos">🎞 Ir a Mis videos</button></div>`}`;
    if (resaltar) {
      const el = cuerpo.querySelector(`#rs-${CSS.escape(resaltar)}`);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      resaltar = null;
    }
  }

  async function clicReels(e, cont) {
    const b = e.target.closest('[data-rs]');
    if (!b) return;
    const it = ctx.contenido().find((x) => x.id === b.dataset.id);
    if (!it) return;
    const accion = b.dataset.rs;
    if (accion === 'ver') {
      const caja = b;
      if (caja.classList.contains('grande')) return;
      caja.classList.add('grande');
      const v = caja.querySelector('video');
      v.controls = true; v.muted = false;
      caja.querySelector('.rs-play')?.remove();
      v.play().catch(() => {});
      return;
    }
    if (accion === 'elegir') return elegirParaReel(it);
    if (accion === 'editar') return window.RubrofyReels.abrir(it);
    if (accion === 'aprobar') return ctx.irAVista('cola', null, 'card-' + it.id);
    if (accion === 'original') {
      b.disabled = true;
      try { await ctx.api(`/api/negocios/${n().id}/contenido/${it.id}/video-original`, { method: 'POST' }); await ctx.recargar(); }
      catch (err) { alert(err.mensaje || 'No se pudo volver al original.'); b.disabled = false; }
    }
  }

  // ---------- pestaña: Mis videos ----------
  function tarjeta(v) {
    const [clase, texto] = estadoDe(v);
    return `<div class="vd-card">
      <button type="button" class="vd-thumb" data-vd-ver="${v.id}" aria-label="Ver ${esc(v.nombre)}">
        <video data-src="${esc(urlDe(v))}#t=0.5" muted playsinline preload="none"></video>
        ${v.duracion ? `<span class="vd-dur">${fmtDur(v.duracion)}</span>` : ''}
        ${v.origen === 'ia' ? '<span class="gl-ia-tag">✨ IA</span>' : ''}
        <span class="vd-estado vd-e-${clase}">${texto}</span>
      </button>
      <span class="vd-nombre" title="${esc(v.nombre)}">${esc(v.nombre)}</span>
    </div>`;
  }

  function htmlSubidas() {
    if (!subidas.length) return '';
    const listos = subidas.filter((s) => s.listo).length;
    return `<div class="vd-subidas">${subidas.map((s) => `<div class="vd-subida"><span>${esc(s.nombre)}</span><span class="vd-barra"><i style="width:${s.pct}%"></i></span><small>${s.listo ? 'Listo' : `${s.pct}%`}</small></div>`).join('')}<p class="sub">Subiendo ${Math.min(listos + 1, subidas.length)} de ${subidas.length}… no cierres esta pestaña.</p></div>`;
  }

  function pintarVideos(cuerpo) {
    const zona = `<label class="gl-drop vd-drop" data-vd-drop>
        <input type="file" accept="video/mp4,video/quicktime,.mov,.mp4,.m4v" multiple hidden data-vd-subir>
        <span class="gl-drop-ic">⇪</span>
        <span><b>Sube tus videos</b> · arrástralos aquí o elige desde tu celular o computador</span>
        <span class="gl-drop-cat">MP4 o MOV, hasta 100 MB cada uno. Puedes elegir varios.</span>
      </label>`;
    const progreso = `<div data-vd-subidas>${htmlSubidas()}</div>`;
    if (!datos) { cuerpo.innerHTML = zona + progreso + '<p class="sub">Cargando tus videos…</p>'; return; }
    const lista = datos.videos;
    cuerpo.innerHTML = zona + progreso + (lista.length
      ? `<p class="gl-ayuda">Toca un video para verlo, editarlo o usarlo en un reel. ${lista.length} de ${datos.max}.</p><div class="vd-grid">${lista.map(tarjeta).join('')}</div>`
      : `<div class="gl-vacia"><b>Aún no tienes videos</b><p>Sube los videos que grabaste. Aquí también quedan los que crees con IA y los que edite Rubrofy.</p></div>`);
    // Las miniaturas se cargan solo cuando se ven.
    const vids = cuerpo.querySelectorAll('video[data-src]');
    const cargarMini = (el) => { el.preload = 'metadata'; el.src = el.dataset.src; el.removeAttribute('data-src'); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entradas) => entradas.forEach((en) => { if (en.isIntersecting) { cargarMini(en.target); io.unobserve(en.target); } }), { rootMargin: '200px' });
      vids.forEach((el) => io.observe(el));
    } else vids.forEach(cargarMini);
  }

  function clicVideos(e, cont) {
    const ver = e.target.closest('[data-vd-ver]');
    if (ver) {
      const v = datos && datos.videos.find((x) => String(x.id) === ver.dataset.vdVer);
      if (v) verVideo(v, cont);
    }
  }

  // ---------- visor de un video ----------
  function verVideo(v, cont) {
    let dlg = document.getElementById('dlg-video');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-video';
      dlg.className = 'gl-visor vd-visor';
      dlg.setAttribute('aria-label', 'Video en grande');
      document.body.appendChild(dlg);
      dlg.addEventListener('close', () => { const el = dlg.querySelector('video'); if (el) { el.pause(); el.removeAttribute('src'); el.load(); } });
    }
    const [clase, texto] = estadoDe(v);
    const quedan = n().reelsEditadosDisponibles || 0;
    const fecha = v.creadoEl ? new Date(v.creadoEl).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '';
    dlg.innerHTML = `<div class="gl-visor-caja">
      <div class="gl-visor-cab"><span class="gl-visor-info"><b>${esc(v.nombre)}</b><small>${[fmtDur(v.duracion), v.bytes ? fmtMB(v.bytes) : '', fecha].filter(Boolean).join(' · ')}</small><span class="vd-estado vd-e-${clase}">${texto}</span></span><button type="button" class="gl-visor-x" data-v-cerrar aria-label="Cerrar">×</button></div>
      <div class="gl-visor-escena vd-escena"><video src="${esc(urlDe(v))}" controls playsinline autoplay></video></div>
      ${v.enReels.length ? `<p class="vd-en-reels">En: ${v.enReels.map((r) => esc(r.titulo) + (r.publicado ? ' (publicado)' : '')).join(' · ')}</p>` : ''}
      <div class="gl-visor-pie vd-pie">
        ${edicionLista() && !v.editando ? `<button type="button" class="gl-visor-btn gl-visor-ia" data-v-editar title="Te quedan ${quedan} ediciones este mes">✂ Editar</button>` : ''}
        ${v.editando ? '<span class="vd-editando">Editando… el resultado aparece como un video nuevo</span>' : ''}
        <button type="button" class="gl-visor-btn" data-v-usar>🎬 Usar en un reel</button>
        <a class="gl-visor-btn" data-v-bajar href="${esc(urlDe(v))}" download="${esc(v.nombre)}">⬇ Descargar</a>
        ${v.editando ? '' : '<button type="button" class="gl-visor-btn vd-borrar" data-v-borrar>🗑 Eliminar</button>'}
      </div></div>`;
    dlg.onclick = async (e) => {
      if (e.target.closest('[data-v-cerrar]')) return dlg.close();
      if (e.target.closest('[data-v-editar]')) { dlg.close(); return editarVideo(v, cont); }
      if (e.target.closest('[data-v-usar]')) { dlg.close(); return usarEnReel(v, cont); }
      const borrar = e.target.closest('[data-v-borrar]');
      if (borrar) {
        const aviso = v.enReels.length ? '\n\nLos reels que ya lo usan conservan su copia.' : '';
        if (!confirm(`¿Eliminar "${v.nombre}" de Mis videos?${aviso}`)) return;
        borrar.disabled = true;
        try {
          await ctx.api(`/api/negocios/${n().id}/videos/${v.id}`, { method: 'DELETE' });
          dlg.close();
          await cargar();
          if (cont && cont.isConnected) renderEstudio(cont);
        } catch (err) { alert(err.mensaje || 'No se pudo eliminar.'); borrar.disabled = false; }
      }
    };
    if (!dlg.open) dlg.showModal();
  }

  function editarVideo(v, cont) {
    window.RubrofyReels.abrir({ id: 'lib-' + v.id, video: { archivo: v.archivo }, gancho: '' }, {
      biblioteca: v,
      alEnviar: async () => {
        await cargar().catch(() => {});
        if (cont && cont.isConnected) renderEstudio(cont);
      },
    });
  }

  // ---------- diálogo genérico (cabecera, pestañas, cuerpo) ----------
  function dialogo() {
    let dlg = document.getElementById('dlg-videos');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-videos';
      dlg.className = 'dlg dlg-galeria';
      document.body.appendChild(dlg);
    }
    return dlg;
  }

  // "Usar en un reel": en uno pendiente o en un reel nuevo.
  function usarEnReel(v, cont) {
    const dlg = dialogo();
    const reels = reelsAbiertos().filter((i) => !(i.edicion && i.edicion.estado === 'editando'));
    dlg.innerHTML = `<div class="dlg-caja gl-dlg">
      <div class="gl-dlg-cab"><h2>Usar en un reel</h2><button type="button" class="gl-x" data-vd-cerrar aria-label="Cerrar">×</button></div>
      <div class="gl-dlg-cuerpo">
        <div class="vd-nuevo">
          <b>✨ Crear un reel nuevo con este video</b>
          <p class="sub">Rubrofy escribe el gancho, el texto y los hashtags. Usa 1 pieza con IA de tu plan.</p>
          <textarea data-vd-desc rows="2" maxlength="300" placeholder="¿De qué trata el video? (opcional) Ej: muestro cómo preparamos el pan de masa madre"></textarea>
          <button type="button" class="btn-approve" data-vd-nuevo>Crear reel</button>
        </div>
        ${reels.length ? `<p class="gl-ayuda vd-o">o úsalo en un reel que ya tienes:</p><div class="vd-reels">${reels.map((it) => `<button type="button" class="vd-reel" data-vd-en="${esc(it.id)}"><b>${esc(titulo(it))}</b><small>${esc(it.date || '')}${it.video ? ' · ya tiene video, se reemplaza' : ' · falta el video'}</small></button>`).join('')}</div>` : ''}
        <p class="config-error" data-vd-error hidden></p>
      </div></div>`;
    const error = (t) => { const el = dlg.querySelector('[data-vd-error]'); el.textContent = t; el.hidden = false; };
    const terminar = async (itemId) => {
      dlg.close();
      await Promise.all([ctx.recargar(), cargar()]).catch(() => {});
      resaltar = itemId;
      pestana = 'reels';
      if (cont && cont.isConnected) renderEstudio(cont);
      else ctx.irAVista('reels');
    };
    dlg.onclick = async (e) => {
      if (e.target === dlg || e.target.closest('[data-vd-cerrar]')) return dlg.close();
      const en = e.target.closest('[data-vd-en]');
      if (en) {
        const it = reels.find((x) => x.id === en.dataset.vdEn);
        if (it && it.video && !confirm('Este reel ya tiene un video. ¿Reemplazarlo?')) return;
        en.disabled = true;
        try { await ctx.api(`/api/negocios/${n().id}/videos/${v.id}/usar`, { method: 'POST', body: JSON.stringify({ itemId: en.dataset.vdEn }) }); await terminar(en.dataset.vdEn); }
        catch (err) { error(err.mensaje || 'No se pudo usar el video.'); en.disabled = false; }
        return;
      }
      const nuevo = e.target.closest('[data-vd-nuevo]');
      if (nuevo) {
        nuevo.disabled = true; nuevo.textContent = 'Escribiendo el reel…';
        try {
          const r = await ctx.api(`/api/negocios/${n().id}/videos/${v.id}/reel-nuevo`, { method: 'POST', body: JSON.stringify({ descripcion: dlg.querySelector('[data-vd-desc]').value }) });
          await terminar(r.item && r.item.id);
        } catch (err) { error(err.mensaje || 'No se pudo crear el reel.'); nuevo.disabled = false; nuevo.textContent = 'Crear reel'; }
      }
    };
    if (!dlg.open) dlg.showModal();
  }

  // "Elegir video" de un reel: de Mis videos, subir uno o crearlo con IA.
  async function elegirParaReel(item, inicial) {
    const dlg = dialogo();
    let pest = inicial || 'mis';
    const mediosIA = n().mediosIA || {};
    const conIA = !!mediosIA.video && !n().sinPlan;
    const usar = async (vid) => {
      await ctx.api(`/api/negocios/${n().id}/videos/${vid}/usar`, { method: 'POST', body: JSON.stringify({ itemId: item.id }) });
      dlg.close();
      resaltar = item.id;
      await Promise.all([ctx.recargar(), cargar()]).catch(() => {});
      // Recién elegido el video, el siguiente paso es editarlo.
      const it = ctx.contenido().find((x) => x.id === item.id);
      if (it && it.video && !it.video.editado && edicionLista() && confirm('Listo, el video quedó en tu reel. ¿Lo editas ahora con Rubrofy (cortes, subtítulos, gancho y logo)?')) window.RubrofyReels.abrir(it);
    };
    const pintar = () => {
      let cuerpo;
      if (pest === 'mis') {
        const lista = datos ? datos.videos : null;
        cuerpo = !lista ? '<p class="sub">Cargando tus videos…</p>'
          : lista.length ? `<p class="gl-ayuda">Toca un video para usarlo en este reel.</p><div class="vd-grid vd-grid-chica">${lista.map((v) => `<div class="vd-card"><button type="button" class="vd-thumb" data-vd-elegir="${v.id}" aria-label="Usar ${esc(v.nombre)}"><video src="${esc(urlDe(v))}#t=0.5" muted playsinline preload="metadata"></video>${v.duracion ? `<span class="vd-dur">${fmtDur(v.duracion)}</span>` : ''}${v.origen === 'editado' ? '<span class="vd-estado vd-e-editado">Editado</span>' : ''}</button><span class="vd-nombre">${esc(v.nombre)}</span></div>`).join('')}</div>`
            : '<div class="gl-vacia"><b>Aún no tienes videos</b><p>Súbelo desde la pestaña <b>Subir</b>; queda guardado en Mis videos.</p></div>';
      } else if (pest === 'subir') {
        cuerpo = `<label class="gl-drop gl-drop-grande" data-vd-drop><input type="file" accept="video/mp4,video/quicktime,.mov,.mp4,.m4v" hidden data-vd-subir-uno><span class="gl-drop-ic">⇪</span><span><b>Elige un video</b> desde tu celular o computador</span><span class="gl-drop-cat">MP4 o MOV, hasta 100 MB. Se guarda también en Mis videos.</span></label>${item.idea ? `<p class="rs-idea">Qué grabar: ${esc(item.idea)}</p>` : ''}`;
      } else {
        cuerpo = `<div class="vd-ia"><p>Rubrofy crea un video corto a partir de la idea de este reel${item.idea ? `: <i>${esc(item.idea)}</i>` : ''}.</p><p class="sub">Primero eliges calidad y duración, con su costo en créditos ⚡. Tarda 1 a 3 minutos.</p><button type="button" class="btn-approve" data-vd-ia>✨ Crear video con IA</button></div>`;
      }
      const pestanas = [['mis', '🎞 Mis videos'], ['subir', '⬆ Subir']].concat(conIA ? [['ia', '✨ Crear con IA']] : []);
      dlg.innerHTML = `<div class="dlg-caja gl-dlg">
        <div class="gl-dlg-cab"><h2>Video para el reel</h2><button type="button" class="gl-x" data-vd-cerrar aria-label="Cerrar">×</button></div>
        <p class="vd-para">${esc(titulo(item))}</p>
        <div class="gl-pestanas" role="tablist">${pestanas.map(([id, t]) => `<button type="button" role="tab" class="gl-pest${pest === id ? ' on' : ''}" data-vd-p="${id}" aria-selected="${pest === id}">${t}</button>`).join('')}</div>
        <div class="gl-dlg-cuerpo">${cuerpo}<p class="config-error" data-vd-error hidden></p></div></div>`;
    };
    const error = (t) => { const el = dlg.querySelector('[data-vd-error]'); if (el) { el.textContent = t; el.hidden = false; } };
    dlg.onclick = async (e) => {
      if (e.target === dlg || e.target.closest('[data-vd-cerrar]')) return dlg.close();
      const p = e.target.closest('[data-vd-p]');
      if (p) { pest = p.dataset.vdP; return pintar(); }
      const el = e.target.closest('[data-vd-elegir]');
      if (el) {
        el.disabled = true;
        try { await usar(el.dataset.vdElegir); } catch (err) { error(err.mensaje || 'No se pudo usar ese video.'); el.disabled = false; }
        return;
      }
      const ia = e.target.closest('[data-vd-ia]');
      if (ia) {
        const eleccion = window.RubrofyCreditos ? await window.RubrofyCreditos.elegir({ tipo: 'video' }) : { calidad: 'recomendada', segundos: 5 };
        if (!eleccion) return;
        ia.disabled = true; ia.textContent = 'Iniciando…';
        try {
          await ctx.api(`/api/negocios/${n().id}/contenido/${item.id}/video-ia`, { method: 'POST', body: JSON.stringify(eleccion) });
          dlg.close();
          resaltar = item.id;
          await ctx.recargar();
        } catch (err) { if (!err.recargar) error(err.mensaje || 'No se pudo iniciar el video con IA.'); ia.disabled = false; ia.textContent = '✨ Crear video con IA'; }
      }
    };
    const subirArchivo = async (file) => {
      const b = dlg.querySelector('[data-vd-drop] b');
      const hechos = await subir([file], () => { if (b && subidas[0]) b.textContent = `Subiendo… ${subidas[0].pct}%`; });
      if (!hechos[0]) { if (b) b.textContent = 'Elige un video'; return; }
      if (b) b.textContent = 'Poniéndolo en el reel…';
      try { await usar(hechos[0].id); } catch (err) { error(err.mensaje || 'Se subió a Mis videos, pero no se pudo poner en el reel.'); }
    };
    dlg.onchange = (e) => { const inp = e.target.closest('[data-vd-subir-uno]'); if (inp && inp.files[0]) subirArchivo(inp.files[0]); };
    dlg.ondragover = (e) => { const z = e.target.closest('[data-vd-drop]'); if (z) { e.preventDefault(); z.classList.add('sobre'); } };
    dlg.ondragleave = (e) => { const z = e.target.closest('[data-vd-drop]'); if (z) z.classList.remove('sobre'); };
    dlg.ondrop = (e) => { const z = e.target.closest('[data-vd-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('sobre'); if (e.dataTransfer.files[0]) subirArchivo(e.dataTransfer.files[0]); };
    pintar();
    if (!dlg.open) dlg.showModal();
    if (!datos) { await cargar().catch(() => {}); if (dlg.open && pest === 'mis') pintar(); }
  }

  // Al cambiar de negocio se olvida la galería cargada.
  function olvidar() { datos = null; }

  window.RubrofyVideos = { iniciar, renderEstudio, elegirParaReel, subir, cargar, olvidar };
})();
