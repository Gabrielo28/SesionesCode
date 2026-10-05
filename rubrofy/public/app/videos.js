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
  let modoSel = false;     // Mis videos: seleccionando varios
  let selMis = [];         // ids elegidos en Mis videos, en orden
  const esperandoUnion = new Set(); // reels cuyos clips se están uniendo
  const MAX_CLIPS = 10, MAX_SEG = 180;

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

  // ---------- elegir varios clips ----------
  const videoDe = (id) => datos && datos.videos.find((v) => String(v.id) === String(id));
  const durTotal = (ids) => ids.reduce((t, id) => t + ((videoDe(id) || {}).duracion || 0), 0);

  // Marca o desmarca un clip; devuelve un aviso si no se puede.
  function alternar(sel, id) {
    const i = sel.indexOf(String(id));
    if (i >= 0) { sel.splice(i, 1); return null; }
    if (sel.length >= MAX_CLIPS) return `Puedes unir hasta ${MAX_CLIPS} clips.`;
    sel.push(String(id));
    return null;
  }

  function gridSeleccion(lista, sel, chica) {
    return `<div class="vd-grid${chica ? ' vd-grid-chica' : ''} vd-seleccionable">${lista.map((v) => {
      const orden = sel.indexOf(String(v.id)) + 1;
      return `<div class="vd-card${orden ? ' marcado' : ''}" data-vd-tarjeta>
        <button type="button" class="vd-thumb" data-vd-sel="${v.id}" aria-pressed="${!!orden}" aria-label="${orden ? 'Quitar' : 'Elegir'} ${esc(v.nombre)}">
          <video ${chica ? 'src' : 'data-src'}="${esc(urlDe(v))}#t=0.5" muted playsinline preload="${chica ? 'metadata' : 'none'}"></video>
          ${v.duracion ? `<span class="vd-dur">${fmtDur(v.duracion)}</span>` : ''}
          ${v.origen === 'editado' ? '<span class="vd-estado vd-e-editado">Editado</span>' : ''}
          <span class="vd-check">${orden || ''}</span>
        </button>
        <button type="button" class="vd-lupa" data-vd-lupa="${v.id}" title="Ver en grande" aria-label="Ver ${esc(v.nombre)} en grande">⤢</button>
        <span class="vd-nombre" title="${esc(v.nombre)}">${esc(v.nombre)}</span>
      </div>`;
    }).join('')}</div>`;
  }

  // El botón de marcar del clip tocado: en la miniatura o en cualquier parte de su tarjeta.
  const marcaDe = (e) => {
    const b = e.target.closest('[data-vd-sel]');
    if (b) return b;
    const t = e.target.closest('[data-vd-tarjeta]');
    return t ? t.querySelector('[data-vd-sel]') : null;
  };

  // Al marcar un clip solo cambian las marcas y la barra (las miniaturas no se recargan).
  function marcarEnSitio(root, sel, botones) {
    root.querySelectorAll('[data-vd-sel]').forEach((b) => {
      const orden = sel.indexOf(b.dataset.vdSel) + 1;
      b.closest('.vd-card').classList.toggle('marcado', !!orden);
      b.setAttribute('aria-pressed', String(!!orden));
      b.querySelector('.vd-check').textContent = orden || '';
    });
    const barra = root.querySelector('[data-vd-barra]');
    if (barra) barra.innerHTML = barraSeleccion(sel, botones);
  }

  function barraSeleccion(sel, botones) {
    if (!sel.length) return '';
    const total = durTotal(sel);
    const largo = total > MAX_SEG;
    return `<div class="vd-barra-sel">
      <span class="vd-barra-txt"><b>${sel.length} ${sel.length === 1 ? 'clip' : 'clips'}</b>${total ? ` · ${fmtDur(total)} en total` : ''}${largo ? ' <em>· pasa de 3 min</em>' : ''}</span>
      <span class="vd-barra-acc">${botones}</span>
    </div>`;
  }

  function listaOrden(sel) {
    return `<ol class="vd-orden">${sel.map((id, i) => {
      const v = videoDe(id) || { nombre: 'Video', archivo: '' };
      return `<li class="vd-orden-fila">
        <span class="vd-orden-n">${i + 1}</span>
        <video src="${esc(urlDe(v))}#t=0.5" muted playsinline preload="metadata"></video>
        <span class="vd-orden-info"><b>${esc(v.nombre)}</b><small>${fmtDur(v.duracion) || ''}</small></span>
        <span class="vd-orden-acc">
          <button type="button" data-vd-mover="-1" data-id="${id}" aria-label="Mover antes" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-vd-mover="1" data-id="${id}" aria-label="Mover después" ${i === sel.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-vd-quitar="${id}" aria-label="Quitar">×</button>
        </span>
      </li>`;
    }).join('')}</ol>
    <p class="vd-orden-total">${sel.length} clips · ${fmtDur(durTotal(sel)) || '—'} en total. Unir no descuenta ediciones.</p>`;
  }

  // Botones ↑ ↓ × de la lista de orden. Devuelve true si tocó uno.
  function clicOrden(e, sel) {
    const m = e.target.closest('[data-vd-mover]');
    if (m) {
      const i = sel.indexOf(m.dataset.id), j = i + Number(m.dataset.vdMover);
      if (i >= 0 && j >= 0 && j < sel.length) [sel[i], sel[j]] = [sel[j], sel[i]];
      return true;
    }
    const q = e.target.closest('[data-vd-quitar]');
    if (q) { const i = sel.indexOf(q.dataset.vdQuitar); if (i >= 0) sel.splice(i, 1); return true; }
    return false;
  }

  async function unirEn(ids, destino) {
    const r = await ctx.api(`/api/negocios/${n().id}/videos/unir`, { method: 'POST', body: JSON.stringify(Object.assign({ ids: ids.map(Number) }, destino)) });
    if (r.item) { esperandoUnion.add(r.item.id); resaltar = r.item.id; }
    return r;
  }

  // Cuando termina una unión que se pidió aquí, ofrece editar el reel.
  function revisarUniones(cont) {
    for (const id of [...esperandoUnion]) {
      const it = ctx.contenido().find((x) => x.id === id);
      if (!it || (it.union && it.union.estado === 'error')) { esperandoUnion.delete(id); continue; }
      if (it.union || !it.video) continue;
      esperandoUnion.delete(id);
      cargar().then(() => { if (cont.isConnected && pestana === 'videos') renderEstudio(cont); }).catch(() => {});
      if (edicionLista() && cont.isConnected && !cont.closest('[hidden]')) {
        setTimeout(() => { if (confirm('Tus clips ya están unidos en el reel. ¿Lo editas ahora con Rubrofy (cortes, subtítulos, gancho y logo)?')) window.RubrofyReels.abrir(it); }, 50);
      }
    }
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
    revisarUniones(cont);
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
    const uniendo = it.union && it.union.estado === 'uniendo';
    const p1 = uniendo ? paso('actual en-curso', 'Video') : v ? paso('hecho', 'Video') : paso('actual', 'Video');
    let p2;
    if (ed.estado === 'editando') p2 = paso('actual en-curso', 'Edición');
    else if (v && v.editado) p2 = paso('hecho', 'Edición');
    else if (aprobado && v) p2 = paso('omitido', 'Sin edición');
    else p2 = paso(v ? 'actual' : '', 'Edición');
    const p3 = aprobado ? paso('hecho', 'Aprobado') : paso(v && (v.editado || !edicionLista()) && ed.estado !== 'editando' ? 'actual' : '', 'Aprobado');
    return `<ol class="rs-progreso" aria-label="Avance del reel">${p1}${p2}${p3}</ol>`;
  }

  function filaReel(it) {
    const v = it.video, ed = it.edicion || {}, ia = it.videoIA || {}, un = it.union || {};
    const aprobado = it.status === 'aprobado';
    let estado = '', principal = '', extras = [];
    if (un.estado === 'uniendo') {
      estado = `<span class="rs-estado rs-editando">Uniendo ${un.clips || ''} clips… suele tardar menos de un minuto</span>`;
    } else if (!v && ia.estado === 'generando') {
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
    if (un.estado === 'error') estado += `<span class="rs-estado rs-falta">No se pudieron unir los clips: ${esc(un.error || '')}</span>`;
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

  const botonesMis = () => `${selMis.length > 1 ? '<button type="button" class="btn-approve" data-vd-accion="unir">⧉ Unir en un reel</button>' : ''}${selMis.length === 1 ? '<button type="button" class="btn-approve" data-vd-accion="usar">🎬 Usar en un reel</button>' : ''}<button type="button" class="btn-ghost" data-vd-accion="borrar">🗑 Eliminar</button>`;

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
    selMis = selMis.filter((id) => videoDe(id));
    const cabecera = modoSel
      ? `<div class="vd-herr"><p class="gl-ayuda">Toca los clips en el orden en que quieres unirlos.</p><button type="button" class="btn-ghost" data-vd-modo="salir">Cancelar</button></div>`
      : `<div class="vd-herr"><p class="gl-ayuda">Toca un video para verlo, editarlo o usarlo en un reel. ${lista.length} de ${datos.max}.</p>${lista.length > 1 ? '<button type="button" class="btn-ghost" data-vd-modo="sel">☑ Seleccionar varios</button>' : ''}</div>`;
    const botones = botonesMis();
    cuerpo.innerHTML = zona + progreso + (lista.length
      ? cabecera + (modoSel ? gridSeleccion(lista, selMis) + `<div data-vd-barra>${barraSeleccion(selMis, botones)}</div>` : `<div class="vd-grid">${lista.map(tarjeta).join('')}</div>`)
      : `<div class="gl-vacia"><b>Aún no tienes videos</b><p>Sube los videos que grabaste. Aquí también quedan los que crees con IA y los que edite Rubrofy.</p></div>`);
    // Las miniaturas se cargan solo cuando se ven.
    const vids = cuerpo.querySelectorAll('video[data-src]');
    const cargarMini = (el) => { el.preload = 'metadata'; el.src = el.dataset.src; el.removeAttribute('data-src'); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entradas) => entradas.forEach((en) => { if (en.isIntersecting) { cargarMini(en.target); io.unobserve(en.target); } }), { rootMargin: '200px' });
      vids.forEach((el) => io.observe(el));
    } else vids.forEach(cargarMini);
  }

  async function clicVideos(e, cont) {
    const modo = e.target.closest('[data-vd-modo]');
    if (modo) { modoSel = modo.dataset.vdModo === 'sel'; selMis = []; return renderEstudio(cont); }
    const lupa = e.target.closest('[data-vd-lupa]');
    if (lupa) { const v = videoDe(lupa.dataset.vdLupa); if (v) verVideo(v, cont, { soloVer: true }); return; }
    const marca = marcaDe(e);
    if (marca) {
      const aviso = alternar(selMis, marca.dataset.vdSel);
      if (aviso) alert(aviso);
      return marcarEnSitio(cont, selMis, botonesMis());
    }
    const acc = e.target.closest('[data-vd-accion]');
    if (acc) {
      const elegidos = selMis.map(videoDe).filter(Boolean);
      if (acc.dataset.vdAccion === 'unir' || acc.dataset.vdAccion === 'usar') return usarEnReel(elegidos.length === 1 ? elegidos[0] : elegidos, cont);
      if (acc.dataset.vdAccion === 'borrar') {
        const enReels = elegidos.some((v) => v.enReels.length);
        if (!confirm(`¿Eliminar ${elegidos.length === 1 ? `"${elegidos[0].nombre}"` : `estos ${elegidos.length} videos`} de Mis videos?${enReels ? '\n\nLos reels que ya los usan conservan su copia.' : ''}`)) return;
        acc.disabled = true;
        const errores = [];
        for (const v of elegidos) {
          try { await ctx.api(`/api/negocios/${n().id}/videos/${v.id}`, { method: 'DELETE' }); } catch (err) { errores.push(`"${v.nombre}": ${err.mensaje || 'no se pudo eliminar'}`); }
        }
        if (errores.length) alert(errores.join('\n'));
        selMis = []; modoSel = false;
        await cargar().catch(() => {});
        return renderEstudio(cont);
      }
    }
    const ver = e.target.closest('[data-vd-ver]');
    if (ver) {
      const v = videoDe(ver.dataset.vdVer);
      if (v) verVideo(v, cont);
    }
  }

  // ---------- visor de un video ----------
  function verVideo(v, cont, opciones) {
    const soloVer = !!(opciones && opciones.soloVer);
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
      <div class="gl-visor-pie vd-pie"${soloVer ? ' hidden' : ''}>
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

  // "Usar en un reel": en uno pendiente o en un reel nuevo. Con varios
  // videos (una lista) primero se ordenan y después se unen en ese reel.
  function usarEnReel(v, cont) {
    const dlg = dialogo();
    const varios = Array.isArray(v) ? v.map((x) => String(x.id)) : null;
    const reels = reelsAbiertos().filter((i) => !(i.edicion && i.edicion.estado === 'editando') && !(i.union && i.union.estado === 'uniendo'));
    const pintar = () => {
    dlg.innerHTML = `<div class="dlg-caja gl-dlg">
      <div class="gl-dlg-cab"><h2>${varios ? 'Unir en un reel' : 'Usar en un reel'}</h2><button type="button" class="gl-x" data-vd-cerrar aria-label="Cerrar">×</button></div>
      <div class="gl-dlg-cuerpo">
        ${varios ? `<p class="gl-ayuda">1. Ordena los clips</p>${listaOrden(varios)}<p class="gl-ayuda vd-o">2. Elige dónde van</p>` : ''}
        <div class="vd-nuevo">
          <b>✨ Crear un reel nuevo con ${varios ? 'estos clips' : 'este video'}</b>
          <p class="sub">Rubrofy escribe el gancho, el texto y los hashtags. Usa 1 pieza con IA de tu plan.</p>
          <textarea data-vd-desc rows="2" maxlength="300" placeholder="¿De qué trata el video? (opcional) Ej: muestro cómo preparamos el pan de masa madre"></textarea>
          <button type="button" class="btn-approve" data-vd-nuevo>Crear reel</button>
        </div>
        ${reels.length ? `<p class="gl-ayuda vd-o">o úsalo en un reel que ya tienes:</p><div class="vd-reels">${reels.map((it) => `<button type="button" class="vd-reel" data-vd-en="${esc(it.id)}"><b>${esc(titulo(it))}</b><small>${esc(it.date || '')}${it.video ? ' · ya tiene video, se reemplaza' : ' · falta el video'}</small></button>`).join('')}</div>` : ''}
        <p class="config-error" data-vd-error hidden></p>
      </div></div>`;
    };
    pintar();
    const error = (t) => { const el = dlg.querySelector('[data-vd-error]'); el.textContent = t; el.hidden = false; };
    const listos = () => {
      if (!varios) return true;
      if (varios.length < 2) { error('Deja al menos 2 clips para unir.'); return false; }
      if (durTotal(varios) > MAX_SEG) { error('Los clips suman más de 3 minutos. Quita alguno.'); return false; }
      return true;
    };
    const terminar = async (itemId) => {
      if (varios) { modoSel = false; selMis = []; }
      dlg.close();
      await Promise.all([ctx.recargar(), cargar()]).catch(() => {});
      resaltar = itemId;
      pestana = 'reels';
      if (cont && cont.isConnected) renderEstudio(cont);
      else ctx.irAVista('reels');
    };
    dlg.onclick = async (e) => {
      if (e.target === dlg || e.target.closest('[data-vd-cerrar]')) return dlg.close();
      if (varios && clicOrden(e, varios)) { const desc = dlg.querySelector('[data-vd-desc]').value; pintar(); dlg.querySelector('[data-vd-desc]').value = desc; return; }
      const en = e.target.closest('[data-vd-en]');
      if (en) {
        const it = reels.find((x) => x.id === en.dataset.vdEn);
        if (!listos()) return;
        if (it && it.video && !confirm('Este reel ya tiene un video. ¿Reemplazarlo?')) return;
        en.disabled = true;
        try {
          if (varios) await unirEn(varios, { itemId: en.dataset.vdEn });
          else await ctx.api(`/api/negocios/${n().id}/videos/${v.id}/usar`, { method: 'POST', body: JSON.stringify({ itemId: en.dataset.vdEn }) });
          await terminar(en.dataset.vdEn);
        }
        catch (err) { error(err.mensaje || 'No se pudo usar el video.'); en.disabled = false; }
        return;
      }
      const nuevo = e.target.closest('[data-vd-nuevo]');
      if (nuevo) {
        if (!listos()) return;
        nuevo.disabled = true; nuevo.textContent = 'Escribiendo el reel…';
        try {
          const descripcion = dlg.querySelector('[data-vd-desc]').value;
          const r = varios ? await unirEn(varios, { nuevo: true, descripcion })
            : await ctx.api(`/api/negocios/${n().id}/videos/${v.id}/reel-nuevo`, { method: 'POST', body: JSON.stringify({ descripcion }) });
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
    let paso = 'elegir'; // elegir | orden
    const sel = [];
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
    const botonesSel = () => (sel.length === 1 ? '<button type="button" class="btn-approve" data-vd-usar-sel>Usar este video</button>'
      : '<button type="button" class="btn-approve" data-vd-paso="orden">Continuar →</button>');
    const pintar = () => {
      let cuerpo;
      if (pest === 'mis' && paso === 'orden') {
        cuerpo = `<p class="gl-ayuda">Ordena los clips: se unen de arriba hacia abajo.</p>${listaOrden(sel)}
          <div class="vd-orden-pie"><button type="button" class="btn-ghost" data-vd-paso="elegir">← Volver</button><button type="button" class="btn-approve" data-vd-unir ${sel.length < 2 ? 'disabled' : ''}>⧉ Unir y usar en el reel</button></div>`;
      } else if (pest === 'mis') {
        const lista = datos ? datos.videos : null;
        const botones = botonesSel();
        cuerpo = !lista ? '<p class="sub">Cargando tus videos…</p>'
          : lista.length ? `<p class="gl-ayuda">Toca uno o varios clips, en el orden en que quieres verlos. Con varios, Rubrofy los une en un solo video.</p>${gridSeleccion(lista, sel, true)}<div data-vd-barra>${barraSeleccion(sel, botones)}</div>`
            : '<div class="gl-vacia"><b>Aún no tienes videos</b><p>Súbelos desde la pestaña <b>Subir</b>; quedan guardados en Mis videos.</p></div>';
      } else if (pest === 'subir') {
        cuerpo = `<label class="gl-drop gl-drop-grande" data-vd-drop><input type="file" accept="video/mp4,video/quicktime,.mov,.mp4,.m4v" multiple hidden data-vd-subir-uno><span class="gl-drop-ic">⇪</span><span><b>Elige uno o varios videos</b> desde tu celular o computador</span><span class="gl-drop-cat">MP4 o MOV, hasta 100 MB cada uno. Se guardan también en Mis videos.</span></label>${item.idea ? `<p class="rs-idea">Qué grabar: ${esc(item.idea)}</p>` : ''}`;
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
      if (p) { pest = p.dataset.vdP; paso = 'elegir'; return pintar(); }
      const lupa = e.target.closest('[data-vd-lupa]');
      if (lupa) { const v = videoDe(lupa.dataset.vdLupa); if (v) verVideo(v, null, { soloVer: true }); return; }
      const marca = marcaDe(e);
      if (marca) {
        const aviso = alternar(sel, marca.dataset.vdSel);
        marcarEnSitio(dlg, sel, botonesSel());
        const err = dlg.querySelector('[data-vd-error]');
        if (aviso) error(aviso); else if (err) err.hidden = true;
        return;
      }
      const ps = e.target.closest('[data-vd-paso]');
      if (ps) {
        if (ps.dataset.vdPaso === 'orden' && durTotal(sel) > MAX_SEG) return error('Los clips suman más de 3 minutos. Quita alguno.');
        paso = ps.dataset.vdPaso; return pintar();
      }
      if (paso === 'orden' && clicOrden(e, sel)) { if (sel.length < 2) paso = 'elegir'; return pintar(); }
      const us = e.target.closest('[data-vd-usar-sel]');
      if (us) {
        us.disabled = true;
        try { await usar(sel[0]); } catch (err) { error(err.mensaje || 'No se pudo usar ese video.'); us.disabled = false; }
        return;
      }
      const un = e.target.closest('[data-vd-unir]');
      if (un) {
        if (item.video && !confirm('Este reel ya tiene un video. ¿Reemplazarlo por la unión de los clips?')) return;
        un.disabled = true; un.textContent = 'Enviando…';
        try {
          await unirEn(sel, { itemId: item.id });
          dlg.close();
          await ctx.recargar();
        } catch (err) { error(err.mensaje || 'No se pudieron unir los clips.'); un.disabled = false; un.textContent = '⧉ Unir y usar en el reel'; }
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
    // Uno: va directo al reel. Varios: quedan elegidos en Mis videos para ordenarlos.
    const subirArchivos = async (files) => {
      const b = dlg.querySelector('[data-vd-drop] b');
      const hechos = await subir(files, () => {
        const actual = subidas.find((x) => !x.listo);
        if (b && actual) b.textContent = subidas.length > 1 ? `Subiendo ${subidas.indexOf(actual) + 1} de ${subidas.length}… ${actual.pct}%` : `Subiendo… ${actual.pct}%`;
      });
      if (!hechos.length) { if (b) b.textContent = 'Elige uno o varios videos'; return; }
      if (hechos.length === 1) {
        if (b) b.textContent = 'Poniéndolo en el reel…';
        try { await usar(hechos[0].id); } catch (err) { error(err.mensaje || 'Se subió a Mis videos, pero no se pudo poner en el reel.'); }
        return;
      }
      hechos.forEach((v) => { if (sel.length < MAX_CLIPS && !sel.includes(String(v.id))) sel.push(String(v.id)); });
      pest = 'mis'; paso = 'orden';
      pintar();
    };
    dlg.onchange = (e) => { const inp = e.target.closest('[data-vd-subir-uno]'); if (inp && inp.files.length) subirArchivos(Array.from(inp.files)); };
    dlg.ondragover = (e) => { const z = e.target.closest('[data-vd-drop]'); if (z) { e.preventDefault(); z.classList.add('sobre'); } };
    dlg.ondragleave = (e) => { const z = e.target.closest('[data-vd-drop]'); if (z) z.classList.remove('sobre'); };
    dlg.ondrop = (e) => { const z = e.target.closest('[data-vd-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('sobre'); if (e.dataTransfer.files.length) subirArchivos(Array.from(e.dataTransfer.files)); };
    pintar();
    if (!dlg.open) dlg.showModal();
    if (!datos) { await cargar().catch(() => {}); if (dlg.open && pest === 'mis') pintar(); }
  }

  // Al cambiar de negocio se olvida la galería cargada.
  function olvidar() { datos = null; }

  window.RubrofyVideos = { iniciar, renderEstudio, elegirParaReel, subir, cargar, olvidar };
})();
