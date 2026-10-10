(function () {
  'use strict';

  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  let negocioActual = null;
  let nichoActual = null; // estrategia de contenido del negocio actual (enfoques, categoriasFoto)
  let contenido = [];
  let fotos = {}; // { categoria: [nombresDeArchivo] }
  let planesInfo = []; // catálogo de planes (ver /api/planes) — precios y disponibilidad
  let codigoDescuento = null; // código revisado y todavía no usado: { codigo, descripcion, planes, precios }
  let vistaActual = 'inicio';
  const editingIds = new Set();
  const fechaEditIds = new Set(); // piezas con el selector de fecha abierto
  const pedirCambioIds = new Set(); // piezas con el campo "Pedir cambio" abierto

  const $ = (sel) => document.querySelector(sel);
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign(
      { 'content-type': 'application/json', 'x-rubrofy-panel': '1' },
      opts.headers
    );
    let res;
    try {
      res = await fetch(path, Object.assign({}, opts, { headers }));
    } catch (e) {
      if (window.RubrofySoporte) window.RubrofySoporte.registrar({ que: `${opts.method || 'GET'} ${path}`, mensaje: 'Sin conexión: ' + e.message });
      const err = new Error('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.');
      err.mensaje = err.message;
      throw err;
    }
    if (!res.ok) {
      // El servidor explica el motivo en { error } (cuota agotada, demasiados
      // intentos, etc.); se guarda aparte para mostrárselo al usuario.
      let mensaje = null;
      let campo = null;
      let recargar = null;
      try {
        const data = await res.json();
        mensaje = data && typeof data.error === 'string' ? data.error : null;
        campo = data && data.campo;
        recargar = data && data.recargar;
      } catch (e) { /* respuesta sin JSON */ }
      const err = new Error(mensaje || ('Error de API (' + res.status + ') en ' + path));
      err.status = res.status;
      err.mensaje = mensaje;
      err.campo = campo;
      err.recargar = recargar;
      // Queda registrado por si el cliente reporta un problema (Ayuda y soporte).
      if (window.RubrofySoporte && negocioActual) window.RubrofySoporte.registrar({ que: `${opts.method || 'GET'} ${path}`, estado: res.status, mensaje });
      // La sesión se cerró (cambio de clave o "cerrar en todos lados" desde
      // otro dispositivo): de vuelta a la pantalla para entrar.
      if (res.status === 401 && negocioActual && !/^\/api\/auth\//.test(path)) mostrarLogin('Tu sesión se cerró. Vuelve a entrar.');
      // Se acabó un cupo (piezas, fotos, videos o reels): se ofrece cargar más.
      if (res.status === 403 && recargar && window.RubrofyRecargas) window.RubrofyRecargas.abrir(recargar);
      throw err;
    }
    return res.json();
  }

  function statusMeta(status) {
    if (status === 'aprobado') return { color: 'var(--green)', label: 'Aprobado' };
    if (status === 'rechazado') return { color: 'var(--coral)', label: 'Rechazado' };
    return { color: 'var(--amber)', label: 'Pendiente' };
  }

  // Fecha/hora en la zona del negocio (la misma que usa el servidor para
  // publicar), no la del navegador.
  function partesEnZona(iso) {
    const formato = new Intl.DateTimeFormat('en-US', {
      timeZone: (negocioActual && negocioActual.zonaHoraria) || 'America/Santiago', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const p = {};
    formato.formatToParts(new Date(iso)).forEach(({ type, value }) => { p[type] = value; });
    return p;
  }

  function fechaCorta(iso) {
    const p = partesEnZona(iso);
    return `${p.day} ${MESES[Number(p.month) - 1]} ${p.hour}:${p.minute}`;
  }

  function horaCorta(iso) {
    const p = partesEnZona(iso);
    return `${p.hour}:${p.minute}`;
  }

  // Valor para <input type="datetime-local">: "2026-09-28T09:00".
  function valorInputFecha(iso) {
    const p = partesEnZona(iso);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  }

  // Qué mostrar en la tarjeta ya decidida: si quedó programada, se está
  // publicando, se publicó, o por qué no se pudo publicar.
  function notaAprobacion(item) {
    if (item.status !== 'aprobado') return { color: 'var(--coral)', texto: 'No se publicará' };
    const dateShort = item.date.split(' - ').slice(0, 2).join(' - ');
    const pub = item.publicacion;
    const ig = item.instagram;
    if ((pub && pub.estado === 'publicada') || (ig && ig.ok)) {
      const conFoto = (pub && pub.generadaPorIA) || (ig && ig.generadaPorIA) ? ' (foto generada por IA)' : '';
      const cuando = (pub && pub.publicadoEl) || (ig && ig.publicadoEl);
      return { color: 'var(--green)', texto: 'Publicado en Instagram' + conFoto + (cuando ? ' &middot; ' + escapeHtml(fechaCorta(cuando)) : '') };
    }
    if (!pub) {
      const sinIG = negocioActual.instagramConectado ? '' : ' (Instagram no conectado)';
      return { color: 'var(--ink-faint)', texto: 'Aprobado &middot; ' + escapeHtml(dateShort) + sinIG };
    }
    if (pub.estado === 'publicando') return { color: 'var(--amber)', texto: 'Publicando en Instagram&hellip;' };
    if (pub.estado === 'programada' && pub.procesando) return { color: 'var(--amber)', texto: 'Instagram está procesando el video&hellip;' };
    if (pub.estado === 'fallida') return { color: 'var(--coral)', texto: 'No se publicó: ' + escapeHtml(pub.motivo || 'error desconocido') };
    if (negocioActual.instagramEstado === 'reconectar') {
      return { color: 'var(--coral)', texto: 'En espera: reconecta Instagram en Conexiones y ajustes' };
    }
    if (pub.intentos) {
      return { color: 'var(--amber)', texto: `Reintento ${pub.intentos} a las ${escapeHtml(horaCorta(pub.proximoIntento))} &middot; ${escapeHtml(pub.ultimoError || '')}` };
    }
    return { color: 'var(--ink-faint)', texto: 'Programada &middot; ' + escapeHtml(fechaCorta(item.publicarEl || pub.proximoIntento)) };
  }

  // ---------- render: stats ----------
  function renderStats() {
    const pendientes = contenido.filter((i) => i.status === 'pendiente').length;
    const aprobados = contenido.filter((i) => i.status === 'aprobado').length;
    $('#stat-pendientes').textContent = pendientes;
    $('#stat-aprobados').textContent = aprobados;
    $('#stat-total').textContent = contenido.length;
    if (window.RubrofyCreditos) window.RubrofyCreditos.pintarChip();
  }

  // ---------- render: cola ----------
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  // Reparte las piezas entre las fotos disponibles de su categoría en vez de
  // repetir siempre la primera (candado anti-repetición simple).
  function pickFotoFilename(categoria, itemId) {
    const arr = fotos[categoria];
    if (!arr || !arr.length) return null;
    return arr[hashString(itemId) % arr.length];
  }

  function drawCardCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const headline = canvas.dataset.headline || '';
    const inicial = canvas.dataset.inicial || '?';

    const img = new Image();
    img.onload = () => {
      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

      const grad = ctx.createLinearGradient(0, h * 0.35, 0, h);
      grad.addColorStop(0, 'rgba(10,9,7,0)');
      grad.addColorStop(1, 'rgba(10,9,7,0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.35, w, h * 0.65);

      ctx.beginPath();
      ctx.arc(30, 30, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#f3ede1';
      ctx.fill();
      ctx.fillStyle = '#161310';
      ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(inicial, 30, 31);

      ctx.fillStyle = '#f8f4ea';
      ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const lines = headline.split('\n');
      const lineHeight = 30;
      const baseY = h - 22 - (lines.length - 1) * lineHeight;
      lines.forEach((line, i) => ctx.fillText(line, 18, baseY + i * lineHeight));
    };
    img.onerror = () => {
      ctx.fillStyle = '#201c17';
      ctx.fillRect(0, 0, w, h);
    };
    img.src = canvas.dataset.src;
  }

  const FORMATOS = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };

  function formatoDe(item) {
    if (item.formato && FORMATOS[item.formato]) return item.formato;
    return item.aspect && item.aspect.trim().startsWith('9') ? 'historia' : 'post';
  }

  async function subirVideo(id, file) {
    const res = await fetch(`/api/negocios/${negocioActual.id}/contenido/${id}/video`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'video/mp4', 'x-rubrofy-panel': '1', 'x-nombre': encodeURIComponent(file.name || 'Video') },
      body: file,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo subir el video');
    }
  }

  // Edición de reels (public/app/reels.js): estado y botones en la tarjeta.
  function edicionHTML(item) {
    const ed = item.edicion || {};
    const er = negocioActual.edicionReels || {};
    if (ed.estado === 'editando') return '<span class="card-video-ok card-video-ia">Editando tu reel… suele tardar 1 o 2 minutos</span>';
    const partes = [];
    if (item.video.editado) partes.push(`<span class="card-video-ok card-editado">Reel editado${ed.duracion ? ` · ${String(ed.duracion).replace('.', ',')} s` : ''}</span><a class="btn-text" href="/videos/${negocioActual.id}/${escapeHtml(item.video.archivo)}" target="_blank" rel="noopener">Ver</a>`);
    if (er.disponible) partes.push(`<button class="btn-text" data-action="editar-reel" data-id="${item.id}">${item.videoOriginal ? 'Editar de nuevo' : 'Editar con Rubrofy'}</button>${AY('editar-reel')}`);
    if (item.videoOriginal) partes.push(`<button class="btn-text" data-action="video-original" data-id="${item.id}">Volver al original</button>`);
    if (ed.estado === 'error') partes.push(`<span class="card-video-error">La edición falló: ${escapeHtml(ed.error || '')}</span>`);
    return partes.join('');
  }

  // La foto de la Galería de la pieza: la que el negocio eligió o una de su categoría.
  function fotoGaleriaDe(item) {
    const fe = item.fotoElegida && (fotos[item.fotoElegida.categoria] || []).includes(item.fotoElegida.archivo) ? item.fotoElegida : null;
    const categoria = fe ? fe.categoria : item.categoriaFoto;
    const archivo = fe ? fe.archivo : (item.categoriaFoto ? pickFotoFilename(item.categoriaFoto, item.id) : null);
    return archivo ? { categoria, archivo } : null;
  }

  // La foto de la pieza: de la Galería o, si no hay, la creada con IA.
  function fotoDe(item) {
    const g = fotoGaleriaDe(item);
    if (g) return `/fotos/${negocioActual.id}/${encodeURIComponent(g.categoria)}/${encodeURIComponent(g.archivo)}`;
    return item.imagenIA ? `/fotos/${negocioActual.id}/_ia/${item.id}.png${item.imagenIAVersion ? '?v=' + item.imagenIAVersion : ''}` : null;
  }

  // La imagen diseñada con el kit de marca, si la tiene.
  function disenoDe(item) {
    return item.diseno ? `/fotos/${negocioActual.id}/_marca/${encodeURIComponent(item.diseno.archivo)}` : null;
  }

  function cardHTML(item) {
    const meta = statusMeta(item.status);
    const caption = item.variants[item.variantIndex];
    const isPost = item.aspect.trim().startsWith('4');
    const isPending = item.status === 'pendiente';
    const isEditing = editingIds.has(item.id);
    const pub = item.publicacion;
    const publicada = (pub && pub.estado === 'publicada') || !!(item.instagram && item.instagram.ok);
    const publicando = !!(pub && pub.estado === 'publicando');
    const puedeCambiarFecha = !publicada && !publicando && item.status !== 'rechazado';
    const formato = formatoDe(item);
    const conVideo = formato === 'reel' || formato === 'historia';
    const inicial = escapeHtml((negocioActual.nombre || '?').charAt(0).toUpperCase());

    const fotoUrl = fotoDe(item);
    // Diseño con la marca: la tarjeta muestra la imagen diseñada.
    const disenoUrl = disenoDe(item);
    const puedeDisenar = !!fotoUrl && !publicada && (formato === 'post' || formato === 'carrusel' || (formato === 'historia' && !item.video));
    // Lo que le falta para publicarse, a la vista en la imagen de la tarjeta.
    const uniendoClips = !!(item.union && item.union.estado === 'uniendo');
    const faltaVideo = !publicada && formato === 'reel' && !item.video && !(item.videoIA && item.videoIA.estado === 'generando') && !uniendoClips;
    const faltaFoto = !publicada && !disenoUrl && !fotoUrl && !item.video && formato !== 'reel';
    const mediosIA = negocioActual.mediosIA || {};
    const videoIA = item.videoIA || null;
    const canvasW = 480;
    const canvasH = isPost ? 600 : 854;

    return `
      <div class="card" id="card-${item.id}">
        <div class="card-media ${isPost ? 'post' : 'historia'}" ${fotoUrl ? '' : `style="background:linear-gradient(160deg, ${item.hueFrom}, ${item.hueTo})"`}>
          ${uniendoClips
            ? `<div class="card-vacia"><div class="card-vacia-ic">⧉</div><b>Uniendo ${item.union.clips || ''} clips…</b><p>Suele tardar menos de un minuto. Después lo puedes editar en Estudio de reels.</p></div>`
            : disenoUrl
            ? `<img class="card-diseno" src="${escapeHtml(disenoUrl)}" alt="Diseño con tu marca" loading="lazy"><span class="card-diseno-tag">Con tu marca</span>`
            : faltaVideo
            ? `<div class="card-vacia"><div class="card-vacia-ic">🎬</div><b>Sube el video de este reel</b><p>Grábalo con tu celular. Rubrofy corta los silencios y le pone subtítulos, gancho y tu logo.</p><button class="btn-approve card-vacia-btn" data-action="elegir-video" data-id="${item.id}">🎬 Elegir video</button></div>`
            : fotoUrl
            ? `<canvas class="card-canvas" width="${canvasW}" height="${canvasH}" data-src="${escapeHtml(fotoUrl)}" data-headline="${escapeHtml(item.headline)}" data-inicial="${inicial}"></canvas>`
            : faltaFoto
            ? `<div class="card-vacia"><div class="card-vacia-ic">🖼</div><b>Elige la foto de esta publicación</b><div class="card-vacia-acc"><button class="btn-ghost card-vacia-btn" data-action="elegir-foto" data-pest="galeria" data-id="${item.id}">▦ De mi galería</button><button class="btn-ia card-vacia-btn" data-action="elegir-foto" data-pest="ia" data-id="${item.id}">✨ Crear con IA</button><label class="btn-ghost card-vacia-btn">⬆ Subir foto<input type="file" accept="image/*" data-foto-item="${item.id}" hidden></label></div>${item.idea ? `<p class="card-vacia-idea">Idea: ${escapeHtml(item.idea)}</p>` : ''}</div>`
            : `<div class="card-texture"></div><div class="card-logo">${inicial}</div><div class="card-headline">${escapeHtml(item.headline)}</div>`}
          ${conVideo && item.video && !item.video.editado && !publicada && (negocioActual.edicionReels || {}).disponible && !(item.edicion && item.edicion.estado === 'editando') ? `<button class="card-editar-reel" data-action="editar-reel" data-id="${item.id}">✂ Editar video con Rubrofy</button>` : ''}
          <div class="card-network"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f3ede1" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6" fill="#f3ede1" stroke="none"/></svg></div>
          <div class="card-status"><span class="dot" style="background:${meta.color}"></span><span class="label" style="color:#f3ede1">${meta.label}</span></div>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-tag">${escapeHtml(item.tag)}</span>${item.briefPunto ? `<span class="card-tag card-tag-brief" title="Responde al brief de la semana">📝 ${escapeHtml(item.briefPunto)}</span>` : ''}${item.sugeridaPorAnuncios ? `<span class="card-tag card-tag-brief" title="Pensada para ${escapeHtml(item.sugeridaPorAnuncios)}, donde tus anuncios rinden más">📣 Sugerida por tus anuncios</span>` : ''}
            ${fechaEditIds.has(item.id)
              ? `<input type="datetime-local" class="card-date-input" data-fecha-id="${item.id}" value="${item.publicarEl ? valorInputFecha(item.publicarEl) : ''}">`
              : (puedeCambiarFecha
                ? `<button class="card-date card-date-btn" data-action="fecha" data-id="${item.id}" title="Cambiar fecha y hora">${escapeHtml(item.date)}</button>`
                : `<span class="card-date">${escapeHtml(item.date)}</span>`)}
          </div>
          ${puedeCambiarFecha ? `
            <div class="card-formato">
              <select data-formato-id="${item.id}" aria-label="Formato de publicación">
                ${Object.keys(FORMATOS).map((f) => `<option value="${f}"${f === formato ? ' selected' : ''}>${FORMATOS[f]}</option>`).join('')}
              </select>
              ${AY('pieza-formato')}
              ${conVideo ? (videoIA && videoIA.estado === 'generando'
                ? `<span class="card-video-ok card-video-ia">Generando video con IA… suele tardar 1 a 3 minutos</span>`
                : (item.video
                  ? `<span class="card-video-ok">${item.video.generadoIA ? 'Video con IA' : 'Video cargado'} (${(item.video.bytes / 1048576).toFixed(1)} MB)</span>${item.video.generadoIA ? `<a class="btn-text" href="/videos/${negocioActual.id}/${escapeHtml(item.video.archivo)}" target="_blank" rel="noopener">Ver</a>` : ''}<button class="btn-text" data-action="quitar-video" data-id="${item.id}">Quitar</button>`
                  : `<label class="btn-text card-video-subir">${formato === 'reel' ? 'Subir video (obligatorio)' : 'Subir video (opcional)'}<input type="file" accept="video/mp4,video/quicktime" data-video-id="${item.id}" hidden></label>${mediosIA.video && !negocioActual.sinPlan ? `<button class="btn-text" data-action="video-ia" data-id="${item.id}">o generarlo con IA</button>${AY('video-ia')}` : ''}`)) : ''}
              ${conVideo && videoIA && videoIA.estado === 'error' ? `<span class="card-video-error">El video con IA falló: ${escapeHtml(videoIA.error || '')}</span>` : ''}
              ${conVideo && item.video ? edicionHTML(item) : ''}
              ${formato === 'carrusel' ? `<span class="card-video-ok">${Math.min((fotos[item.categoriaFoto] || []).length, 10)} fotos de "${escapeHtml(item.categoriaFoto || '')}"</span>` : ''}
            </div>` : ''}
          ${item.gancho && !isEditing ? `<p class="card-gancho"><span>${formato === 'reel' ? 'Gancho · primeros 2 segundos' : formato === 'historia' ? 'Gancho' : 'Gancho · primera línea'}</span>${escapeHtml(item.gancho)}</p>` : ''}
          ${isEditing
            ? `<textarea class="card-textarea" data-id="${item.id}">${escapeHtml(caption)}</textarea>
               <label class="card-hashtags-edit">Hashtags<input data-hashtags-id="${item.id}" value="${escapeHtml((item.hashtags || []).join(' '))}" placeholder="#tunegocio #tuciudad"></label>`
            : `<p class="card-caption" data-action="expandir" title="Toca para ver el texto completo">${escapeHtml(caption)}</p>`}
          ${!isEditing && item.hashtags && item.hashtags.length ? `<div class="card-hashtags">${item.hashtags.map((h) => `<span>${escapeHtml(h)}</span>`).join('')}</div>` : ''}
          ${!isEditing ? `<button class="btn-text card-copiar" data-action="copiar" data-id="${item.id}" title="Copia el texto y los hashtags tal como se publican">Copiar texto${item.hashtags && item.hashtags.length ? ' y hashtags' : ''}</button>` : ''}
          ${item.prueba ? `<p class="card-prueba"><b>Reel de prueba</b> · se muestra primero a quienes no te siguen${item.prueba.origen && item.prueba.origen.permalink ? ` · <a href="${escapeHtml(item.prueba.origen.permalink)}" target="_blank" rel="noopener">ver el original</a>` : ''} ${AY('reels-prueba')}</p>` : ''}
          ${item.idea && !publicada ? `<p class="card-idea"><b>Idea:</b> ${escapeHtml(item.idea)}</p>` : ''}
          ${!publicada && item.voz ? `<div class="card-voz">${window.RubrofyVoz.insignia(item.voz)}<span>${escapeHtml((item.voz.notas.find((n) => n.tipo === 'mal') || item.voz.notas[0] || { texto: 'Calza con tu voz de marca' }).texto)}</span>${AY('voz-puntaje')}</div>` : ''}
          ${isPending && pedirCambioIds.has(item.id) ? `<form class="card-pedir" data-pedir-id="${item.id}"><input name="indicacion" maxlength="500" placeholder="Ej: más corto, menciona el despacho gratis" required><button class="btn-approve">Pedir</button><button type="button" class="btn-text" data-action="cancelar-pedir" data-id="${item.id}">Cancelar</button></form>` : ''}
          ${!publicada && item.alertas && item.alertas.length ? `<ul class="card-alertas" aria-label="Qué verificar">${item.alertas.map((a) => `<li class="alerta-${escapeHtml(a.tipo)}"><span aria-hidden="true">⚠</span> ${escapeHtml(a.texto)}</li>`).join('')}<li class="alerta-ayuda">Qué hacer ${AY('alertas')}</li></ul>` : ''}
          ${isPending ? `
            <div class="card-actions">
              <button class="btn-approve" data-action="approve" data-id="${item.id}">Aprobar</button>
              <button class="btn-ghost" data-action="regenerate" data-id="${item.id}">Otra versión</button>
              <button class="btn-ghost" data-action="pedir" data-id="${item.id}" title="Pídele un cambio a la IA">Pedir cambio</button>
              ${!fotoGaleriaDe(item) && item.imagenIA && mediosIA.imagen ? `<button class="btn-ghost" data-action="imagen-otra" data-id="${item.id}">Otra foto con IA</button>` : ''}
              ${puedeDisenar ? `<button class="btn-ghost" data-action="disenar" data-id="${item.id}" data-foto="${escapeHtml(fotoUrl)}">${item.diseno ? 'Cambiar diseño' : '✦ Diseñar con mi marca'}</button>` : ''}
              ${fotoUrl && !publicada && formato !== 'reel' ? `<button class="btn-ghost" data-action="elegir-foto" data-pest="galeria" data-id="${item.id}">⇄ Cambiar foto</button>` : ''}
              <button class="btn-text" data-action="toggle-edit" data-id="${item.id}">${isEditing ? 'Guardar' : 'Editar'}</button>
              <button class="btn-x" data-action="reject" data-id="${item.id}" title="Rechazar">&times;</button>
              ${AY('pieza-acciones')}
            </div>
          ` : `
            <div class="card-note">
              <span class="note-text" style="color:${notaAprobacion(item).color}">${notaAprobacion(item).texto}</span>
              <span class="note-actions">
                ${pub && pub.estado === 'programada' && !publicada && negocioActual.instagramEstado === 'ok' ? `<button data-action="publish-now" data-id="${item.id}">Publicar ahora</button>` : ''}
                ${pub && pub.estado === 'fallida' ? `<button data-action="retry" data-id="${item.id}">Reintentar</button>` : ''}
                ${publicando ? '' : `<button data-action="undo" data-id="${item.id}">Deshacer</button>`}
                ${AY('pieza-acciones')}
              </span>
            </div>
          `}
        </div>
      </div>
    `;
  }

  let ctxColaListo = false;
  function renderCola() {
    if (!ctxColaListo) {
      ctxColaListo = true;
      window.RubrofyPWA.aviso($('#push-aviso'), ctxPanel());
      window.RubrofyContexto.editor($('#ctx-cola'), ctxPanel(), ['copys', 'post', 'carrusel', 'reel', 'historia'], 'textos y formatos');
    }
    vigilarVideos();
    if (window.RubrofyBrief) window.RubrofyBrief.pintarCola($('#cola-brief'));
    const grid = $('#cola-grid');
    if (!contenido.length) {
      grid.innerHTML = '<p class="empty-state">Sin contenido todavía. Usa "Generar más contenido" para crear el primer lote.</p>';
      return;
    }
    grid.innerHTML = contenido.map(cardHTML).join('');
    grid.querySelectorAll('.card-canvas').forEach(drawCardCanvas);
  }

  // ---------- render: calendario ----------
  // Semana o mes, y mover publicaciones de día: public/app/calendario.js.
  function renderCalendario() {
    window.RubrofyCalendario.render($('#calendario'), Object.assign(ctxPanel(), {
      partesEnZona, escapeHtml, formatoDe, FORMATOS,
      miniatura: (it) => disenoDe(it) || fotoDe(it),
      refrescar: () => refreshContenido().catch(() => {}),
    }));
  }

  // ---------- render: fotos ----------
  function renderFotos() {
    window.RubrofyContexto.editor($('#ctx-fotos'), ctxPanel(), ['imagen', 'video'], 'imágenes y videos con IA');
    const cont = $('#fotos-categorias');
    if (!nichoActual) { cont.innerHTML = ''; return; }
    window.RubrofyGaleria.renderVista(cont);
  }

  // Estudio de reels (public/app/videos.js): Reels por publicar y Mis videos.
  function renderEstudioReels() {
    vigilarVideos();
    window.RubrofyVideos.renderEstudio($('#reels-estudio'));
  }

  // "Tu negocio" en Conexiones y ajustes: el mismo perfil de la bienvenida.
  function renderPerfil() {
    const cont = $('#perfil-card');
    if (!cont) return;
    const P = window.RubrofyPlan;
    const ctx = Object.assign({}, ctxPanel(), { negocio: () => negocioActual });
    const n = negocioActual;
    cont.innerHTML = `<div class="ig-card-head"><h2>Perfil del negocio${window.Ayuda ? window.Ayuda.boton('perfil') : ''}</h2><span class="ig-estado ${n.perfilCompleto ? 'conectado' : ''}">${n.perfilCompleto ? 'Completo' : 'Falta completar'}</span></div>
      <p class="sub">Toda la IA usa esto: estrategia, publicaciones, voz y anuncios.</p>
      <div data-perfil>${P.camposPerfil(n, { leerWeb: n.usaIA && n.iaConfigurada })}
        <label class="pf-productos">¿Qué ofreces? <span class="opc">productos o servicios</span><textarea data-pf="productos" rows="2" maxlength="800" placeholder="Tus productos o servicios principales">${escapeHtml((n.perfil && n.perfil.productos) || '')}</textarea></label></div>
      <p class="config-ok" data-perfil-ok hidden></p>
      <div class="config-actions"><button type="button" class="btn-approve" data-perfil-guardar>Guardar perfil</button></div>`;
    const cuerpo = cont.querySelector('[data-perfil]');
    P.activar(cuerpo, 14);
    P.activarPerfil(cuerpo, ctx);
    cont.querySelector('[data-perfil-guardar]').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try {
        negocioActual = await api(`/api/negocios/${n.id}/perfil`, { method: 'PUT', body: JSON.stringify(P.leerPerfil(cuerpo)) });
        window.RubrofyInicio.invalidar();
        renderPerfil();
        const ok = $('#perfil-card [data-perfil-ok]');
        ok.textContent = 'Guardado. La IA lo usa desde ahora.';
        ok.hidden = false;
      } catch (err) {
        alert(err.mensaje || 'No se pudo guardar el perfil.');
        ev.target.disabled = false;
      }
    });
  }

  function renderConfig() {
    if (!negocioActual) return;
    renderPerfil();
    window.RubrofyPWA.renderTarjeta($('#push-card'), ctxPanel());
    $('#config-nombre').value = negocioActual.nombre || '';
    $('#config-precio').value = (negocioActual.datos && negocioActual.datos.precioDesde) || '';
    $('#config-unidad').value = (negocioActual.datos && negocioActual.datos.unidad) || '';
    $('#config-promo').value = (negocioActual.datos && negocioActual.datos.promo) || '';
    $('#config-producto').value = (negocioActual.datos && negocioActual.datos.productoDestacado) || '';
    $('#config-estilo-imagen').value = negocioActual.estiloImagen || 'limpia';
    $('#config-error').hidden = true;
    $('#config-ok').hidden = true;

    const conectado = !!negocioActual.instagramConectado;
    const reconectar = negocioActual.instagramEstado === 'reconectar';
    $('#ig-estado').textContent = reconectar ? 'Reconectar' : (conectado ? 'Conectado' : 'Sin conectar');
    $('#ig-estado').classList.toggle('conectado', conectado && !reconectar);
    $('#ig-estado').classList.toggle('reconectar', reconectar);
    // Con el token vencido se muestra el formulario para pegar uno nuevo; las
    // publicaciones programadas esperan y salen solas al reconectar.
    $('#form-instagram').hidden = conectado && !reconectar;
    $('#btn-desconectar-ig').hidden = !conectado;
    $('#ig-error').hidden = true;
    const aviso = $('#ig-aviso');
    if (reconectar) {
      aviso.textContent = 'Instagram rechazó el token (' + (negocioActual.instagramMotivoReconexion || 'venció o fue revocado') + '). Pega un token nuevo: las publicaciones programadas se publicarán solas al reconectar.';
    } else if (conectado && negocioActual.instagramVenceEl) {
      aviso.textContent = 'El token se renueva solo. Vence el ' + fechaCorta(negocioActual.instagramVenceEl) + ' si no se pudiera renovar.';
    } else {
      aviso.textContent = '';
    }
    aviso.hidden = !aviso.textContent;
    aviso.style.color = reconectar ? 'var(--coral)' : '';

    // "Conectar con Instagram" si el servidor lo tiene configurado; si no,
    // solo el formulario de ID y token (con su ayuda).
    const login = !!negocioActual.instagramLoginDisponible;
    const necesitaConectar = !conectado || reconectar;
    $('#ig-login').hidden = !(login && necesitaConectar);
    $('#btn-ig-login').href = `/api/negocios/${negocioActual.id}/instagram/conectar`;
    $('#btn-ig-login-txt').textContent = reconectar ? 'Reconectar con Instagram' : 'Conectar con Instagram';
    // Con "Conectar con Instagram" disponible, pegar el ID y el token es cosa
    // técnica: solo lo ve quien administra (por si el inicio de sesión falla).
    $('#ig-manual').hidden = !necesitaConectar || (login && !negocioActual.esAdmin);
    $('#ig-manual').open = !login;
    $('#ig-manual-titulo').hidden = !login;
    $('#ig-cuenta').hidden = !(conectado && negocioActual.instagramUsuario);
    $('#ig-cuenta').textContent = negocioActual.instagramUsuario ? 'Cuenta: @' + negocioActual.instagramUsuario : '';

    renderAvisos();

    renderMeta();
    renderGoogle();
  }

  // Google Ads: se conecta con "Iniciar sesión con Google" (redirige a
  // Google y vuelve a /app?google=...), luego se elige la cuenta. En pausa
  // mientras el servidor no lo active (GOOGLE_ADS_ACTIVO): no se muestra.
  function renderGoogle() {
    const cont = $('#google-card');
    cont.hidden = !negocioActual.googleActivo;
    if (cont.hidden) return;
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    const g = negocioActual.googleConexion;
    const cabecera = `<div class="ig-card-head"><h2>Conexión con Google Ads${AY('google')}</h2>
      <span class="ig-estado ${g && g.customerId ? (g.estado === 'reconectar' ? 'reconectar' : 'conectado') : ''}">${g && g.customerId ? (g.estado === 'reconectar' ? 'Reconectar' : 'Conectado') : 'Sin conectar'}</span></div>`;
    if (!plan.ads) {
      cont.innerHTML = cabecera + '<p class="sub">Para ver tus campañas de Google junto a tu Instagram. Disponible en el plan Estudio.</p>';
      return;
    }
    if (!negocioActual.googleConfigurado) {
      cont.innerHTML = cabecera + '<p class="sub">Google Ads todavía no está configurado en este servidor.</p>';
      return;
    }
    const conectar = `<a class="btn-approve estilo-btn" href="/api/negocios/${encodeURIComponent(negocioActual.id)}/google/conectar">${g ? 'Volver a conectar con Google' : 'Conectar con Google'}</a>`;
    if (g && g.customerId && g.estado !== 'reconectar') {
      cont.innerHTML = cabecera + `<p class="sub">Cuenta: <b>${escapeHtml(g.nombre || g.customerId)}</b> (${escapeHtml(g.moneda || '')}) · solo lectura.</p>
        <button type="button" class="btn-danger" data-google="desconectar">Desconectar Google Ads</button>`;
    } else if (g && g.opciones && g.opciones.length) {
      cont.innerHTML = cabecera + `<form class="config-form" data-google="elegir">
          <label>¿Qué cuenta de Google Ads quieres ver?<select name="customerId">${g.opciones.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.nombre)} · ${escapeHtml(o.moneda || '')}${o.via ? ' (vía ' + escapeHtml(o.via) + ')' : ''}</option>`).join('')}</select></label>
          <div class="config-actions"><button type="submit" class="btn-approve">Usar esta cuenta</button></div>
        </form>`;
    } else {
      cont.innerHTML = cabecera + `<p class="sub">${g && g.estado === 'reconectar' ? 'Google revocó el permiso o venció. ' : ''}Inicia sesión con la cuenta de Google que administra tus anuncios. Rubrofy solo lee los datos, no modifica campañas.</p>${conectar}`;
    }
  }

  async function accionGoogle(e) {
    const btn = e.target.closest('[data-google="desconectar"]');
    if (!btn) return;
    if (!confirm('¿Desconectar Google Ads?')) return;
    negocioActual = await api(`/api/negocios/${negocioActual.id}/google`, { method: 'DELETE' });
    renderGoogle();
  }

  async function elegirCuentaGoogle(e) {
    e.preventDefault();
    try {
      negocioActual = await api(`/api/negocios/${negocioActual.id}/google`, { method: 'PUT', body: JSON.stringify({ customerId: e.target.customerId.value }) });
      renderGoogle();
    } catch (err) {
      alert(err.mensaje || 'No se pudo elegir la cuenta.');
    }
  }

  // Conexión con Meta (Ads y competencia): token → elegir cuentas → conectar.
  function renderMeta() {
    const cont = $('#meta-card');
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    const c = negocioActual.metaConexion;
    const cabecera = `<div class="ig-card-head"><h2>Conexión con Meta (Ads y competencia)${AY('meta')}</h2>
      <span class="ig-estado ${c ? (c.estado === 'reconectar' ? 'reconectar' : 'conectado') : negocioActual.metaElegir ? 'reconectar' : ''}">${c ? (c.estado === 'reconectar' ? 'Reconectar' : 'Conectado') : negocioActual.metaElegir ? 'Falta elegir' : 'Sin conectar'}</span></div>`;
    if (negocioActual.metaAbierto === false) {
      // Meta Ads y Competencia esperan la aprobación de Meta.
      cont.innerHTML = `<div class="ig-card-head"><h2>Conexión con Meta (Ads y competencia)${AY('meta')}</h2><span class="ig-estado pronto">Próximamente</span></div>
        <p class="sub">Muy pronto vas a poder conectar tu Facebook para ver tu publicidad en Meta y seguir a tu competencia, en el plan Estudio.</p>`;
      return;
    }
    if (!plan.ads && !plan.competencia) {
      cont.innerHTML = cabecera + '<p class="sub">Para ver tu publicidad en Meta y seguir a tu competencia. Disponible en el plan Estudio.</p>';
      return;
    }
    // Vuelta de "Conectar con Facebook" con varias cuentas: elegir cuáles usar.
    const elegir = negocioActual.metaElegir;
    if (elegir) {
      const opAds = elegir.cuentasPublicitarias.map((x, i) => `<option value="${escapeHtml(x.id)}"${i === 0 ? ' selected' : ''}>${escapeHtml(x.nombre)} · ${escapeHtml(x.moneda || '')}${x.activa ? '' : ' (inactiva)'}</option>`).join('');
      const opIg = elegir.cuentasInstagram.map((x, i) => `<option value="${escapeHtml(x.id)}"${i === 0 ? ' selected' : ''}>@${escapeHtml(x.username)} · ${escapeHtml(x.pagina)}</option>`).join('');
      cont.innerHTML = cabecera + `
        <p class="sub">Tu Facebook administra varias cuentas. Elige cuáles quieres ver en Rubrofy:</p>
        <form class="config-form" data-meta="elegir">
          <label>Cuenta publicitaria<select name="adAccountId"><option value="">(ninguna)</option>${opAds}</select></label>
          <label>Tu cuenta de Instagram (para comparar con tu competencia)<select name="igUserId"><option value="">(ninguna)</option>${opIg}</select></label>
          <p class="config-error" data-meta="error" hidden></p>
          <div class="config-actions"><button type="submit" class="btn-approve">Usar estas cuentas</button></div>
        </form>`;
      return;
    }
    if (c && c.estado !== 'reconectar') {
      cont.innerHTML = cabecera + `
        <p class="sub">${c.cuentaNombre ? `Cuenta publicitaria: <b>${escapeHtml(c.cuentaNombre)}</b> (${escapeHtml(c.moneda || '')})` : 'Sin cuenta publicitaria'}<br>
        ${c.igUsername ? `Instagram para competencia: <b>@${escapeHtml(c.igUsername)}</b>` : 'Sin cuenta de Instagram para competencia'}
        ${c.venceEl ? `<br>La conexión vence el ${fechaCorta(c.venceEl)}${negocioActual.metaLoginDisponible ? ': antes de esa fecha, vuelve a pulsar "Conectar con Facebook".' : '.'}` : ''}</p>
        <div class="config-actions cta-acciones-izq">
          ${negocioActual.metaLoginDisponible ? `<a class="btn-ghost estilo-btn" href="/api/negocios/${encodeURIComponent(negocioActual.id)}/meta/conectar">Cambiar de cuenta</a>` : ''}
          <button type="button" class="btn-danger" data-meta="desconectar">Desconectar Meta</button>
        </div>`;
      return;
    }
    const formToken = `
        <p class="sub">Pega un token de Meta con los permisos <code>ads_read</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>instagram_basic</code> e <code>instagram_manage_insights</code>. Lo más cómodo es un token de "usuario del sistema" de tu Business Manager, que no vence.</p>
        <form class="config-form" data-meta="form">
          <label>Token de acceso de Meta<input type="password" name="token" required></label>
          <div data-meta="opciones" hidden>
            <label>Cuenta publicitaria<select name="adAccountId"></select></label>
            <label>Cuenta de Instagram (para competencia)<select name="igUserId"></select></label>
          </div>
          <p class="config-error" data-meta="error" hidden></p>
          <div class="config-actions">
            <button type="button" class="btn-ghost" data-meta="buscar">Buscar mis cuentas</button>
            <button type="submit" class="btn-approve" data-meta="conectar" hidden>Conectar</button>
          </div>
        </form>`;
    const aviso = c && c.estado === 'reconectar' ? '<p class="sub"><b>Meta pidió volver a conectar.</b> Mientras tanto, tus anuncios y tu competencia no se actualizan.</p>' : '';
    if (!negocioActual.metaLoginDisponible) {
      cont.innerHTML = cabecera + aviso + formToken;
      return;
    }
    cont.innerHTML = cabecera + aviso + `
      <div class="ig-login">
        <a class="btn-fb" href="/api/negocios/${encodeURIComponent(negocioActual.id)}/meta/conectar"><span class="fb-f" aria-hidden="true">f</span>${c ? 'Volver a conectar con Facebook' : 'Conectar con Facebook'}</a>
        <p class="sub">Entra con la cuenta de Facebook que administra tus anuncios y la página de tu negocio, y acepta los permisos. Rubrofy solo lee: no crea ni cambia anuncios.</p>
      </div>
      <details class="ig-manual"><summary>Conectar con un token (avanzado)</summary>${formToken}</details>`;
  }

  async function accionMeta(e) {
    const cont = $('#meta-card');
    const btn = e.target.closest('[data-meta]');
    if (!btn) return;
    const error = cont.querySelector('[data-meta="error"]');
    const mostrarError = (m) => { if (error) { error.textContent = m; error.hidden = false; } else alert(m); };
    if (btn.dataset.meta === 'desconectar') {
      if (!confirm('¿Desconectar Meta? Se dejan de actualizar tus anuncios y competidores.')) return;
      negocioActual = await api(`/api/negocios/${negocioActual.id}/meta`, { method: 'DELETE' });
      return renderMeta();
    }
    if (btn.dataset.meta === 'buscar') {
      const form = cont.querySelector('[data-meta="form"]');
      btn.disabled = true;
      try {
        const r = await api(`/api/negocios/${negocioActual.id}/meta/cuentas`, { method: 'POST', body: JSON.stringify({ accessToken: form.token.value }) });
        form.adAccountId.innerHTML = '<option value="">(ninguna)</option>' + r.cuentasPublicitarias.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nombre)} · ${escapeHtml(c.moneda)}${c.activa ? '' : ' (inactiva)'}</option>`).join('');
        form.igUserId.innerHTML = '<option value="">(ninguna)</option>' + r.cuentasInstagram.map((c) => `<option value="${escapeHtml(c.id)}">@${escapeHtml(c.username)} · ${escapeHtml(c.pagina)}</option>`).join('');
        if (r.cuentasPublicitarias.length) form.adAccountId.selectedIndex = 1;
        if (r.cuentasInstagram.length) form.igUserId.selectedIndex = 1;
        cont.querySelector('[data-meta="opciones"]').hidden = false;
        cont.querySelector('[data-meta="conectar"]').hidden = false;
        if (error) error.hidden = true;
      } catch (err) {
        mostrarError(err.mensaje || 'No se pudo leer tus cuentas.');
      }
      btn.disabled = false;
    }
  }

  async function conectarMeta(e) {
    e.preventDefault();
    const form = e.target;
    // "elegir": después de "Conectar con Facebook" (el token quedó en el servidor).
    const datos = { adAccountId: form.adAccountId.value || null, igUserId: form.igUserId.value || null };
    if (form.dataset.meta !== 'elegir') datos.accessToken = form.token.value;
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      negocioActual = await api(`/api/negocios/${negocioActual.id}/meta`, { method: 'PUT', body: JSON.stringify(datos) });
      renderMeta();
    } catch (err) {
      const error = $('#meta-card [data-meta="error"]');
      error.textContent = err.mensaje || 'No se pudo conectar.';
      error.hidden = false;
      if (btn) btn.disabled = false;
    }
  }

  function renderAvisos() {
    renderGuiasAjustes();
    const activo = !!negocioActual.avisosSemanal;
    const config = !!negocioActual.correoConfigurado;
    $('#avisos-semanal').checked = activo;
    $('#avisos-email').textContent = negocioActual.email || '';
    $('#avisos-estado').textContent = !config ? 'No disponible' : activo ? 'Activo' : 'Apagado';
    $('#avisos-estado').classList.toggle('conectado', config && activo);
    $('#avisos-no-config').hidden = config;
    $('#btn-avisos-prueba').hidden = !config;
    $('#avisos-error').hidden = true;
  }

  function formatoCLP(monto) {
    return monto ? '$' + monto.toLocaleString('es-CL') + '/mes' : 'Gratis';
  }

  // Botones para pagar un plan (aviso de arriba y bienvenida).
  function botonesPago() {
    return planesInfo.map((p) => (p.disponible
      ? `<button type="button" class="${p.id === 'pro' ? 'btn-approve' : 'btn-ghost'}" data-checkout-plan="${p.id}">${escapeHtml(p.nombre)} · ${formatoCLP(p.precioClp)}</button>`
      : `<button type="button" class="btn-ghost" disabled title="Los pagos todavía no están habilitados">${escapeHtml(p.nombre)} · pronto</button>`)).join('');
  }

  function fechaLarga(iso) {
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  }
  const nombrePlan = (id) => (planesInfo.find((p) => p.id === id) || {}).nombre || id;

  // Aviso bajo la barra: prueba gratis disponible, prueba en curso o sin plan.
  // Cuenta nueva sin el correo confirmado: aviso chico con "Reenviar" y
  // "Cambiar correo" (por si se escribió mal). Las cuentas antiguas no lo ven.
  function renderAvisoCorreo() {
    const cont = $('#aviso-correo');
    if (!cont || !negocioActual) return;
    cont.hidden = negocioActual.emailVerificado !== false;
    if (cont.hidden) return;
    cont.innerHTML = `<span class="aviso-correo-txt">📧 <b>Confirma tu correo:</b> te enviamos un enlace a <b>${escapeHtml(negocioActual.email || '')}</b>. Así puedes recuperar tu clave y te llegan los avisos de cobros y publicaciones.</span>
      <span class="aviso-correo-acc"><button type="button" class="btn-ghost" data-correo-reenviar>Reenviar enlace</button><button type="button" class="btn-text" data-correo-cambiar>¿Está mal escrito?</button></span>`;
  }

  // Vuelta del enlace "Confirmar mi correo" (/app?correo=verificado|vencido).
  async function avisarRetornoCorreo() {
    const r = new URLSearchParams(window.location.search).get('correo');
    if (!r) return;
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    if (r === 'verificado') {
      try { negocioActual = await api('/api/me'); } catch (e) { /* sigue */ }
      render();
      alert('¡Listo! Confirmaste tu correo.');
    } else {
      alert('Ese enlace venció o ya no es válido. Te podemos enviar uno nuevo desde el aviso de arriba o desde Mi cuenta.');
    }
  }

  function renderAvisoPlan() {
    const cont = $('#aviso-plan');
    if (!cont || !negocioActual) return;
    const pr = negocioActual.prueba || {};
    if (negocioActual.sinPlan && pr.disponible) {
      cont.className = 'aviso-plan aviso-sinplan aviso-regalo';
      cont.innerHTML = `<div class="aviso-texto"><b>🎁 ${pr.dias} días gratis del plan ${escapeHtml(nombrePlan(pr.plan))}</b>
          <span>Déjanos tu nombre, correo y teléfono, y empieza hoy, sin tarjeta: estrategia y publicaciones completas con gancho, texto y hashtags.</span></div>
        <div class="aviso-botones"><button type="button" class="btn-approve" data-abrir-prueba>Quiero mis ${pr.dias} días gratis</button><button type="button" class="btn-text" data-ir-plan>o elige un plan</button></div>`;
      cont.hidden = false;
    } else if (negocioActual.sinPlan) {
      cont.className = 'aviso-plan aviso-sinplan';
      cont.innerHTML = `<div class="aviso-texto"><b>${pr.hasta ? 'Terminó tu prueba gratis: elige tu plan para seguir' : 'Elige tu plan para crear contenido'}</b>
          <span>${pr.hasta ? 'Todo lo que armaste sigue aquí. ' : ''}Estrategia, publicaciones completas con gancho, texto y hashtags, y publicación en Instagram con tu aprobación. Sin permanencia: cancelas cuando quieras.</span></div>
        <div class="aviso-botones">${botonesPago()}<button type="button" class="btn-text" data-ir-plan>Comparar planes</button></div>
        <p class="config-error" data-pago-error hidden></p>`;
      cont.hidden = false;
    } else if (quedanPocas()) {
      const q = window.RubrofyRecargas.quedan(negocioActual, 'piezas');
      cont.className = 'aviso-plan aviso-prueba termina';
      cont.innerHTML = `<div class="aviso-texto"><b>${q ? `Te quedan ${q} piezas con IA este mes` : 'Se acabaron tus piezas con IA de este mes'}</b>
          <span>Se renuevan el día 1. Si necesitas más antes, carga un paquete: no vence a fin de mes.</span></div>
        <div class="aviso-botones"><button type="button" class="btn-approve" data-recargar>Cargar más</button><button type="button" class="btn-text" data-ocultar-pocas>Ahora no</button></div>`;
      cont.hidden = false;
    } else if (pr.vigente && !negocioActual.tieneSuscripcion) {
      cont.className = 'aviso-plan aviso-prueba' + (pr.diasRestantes <= 2 ? ' termina' : '');
      cont.innerHTML = `<div class="aviso-texto"><b>Prueba gratis del plan ${escapeHtml(nombrePlan(pr.plan))}</b>
          <span>${pr.diasRestantes === 1 ? 'Queda 1 día' : `Quedan ${pr.diasRestantes} días`} (hasta el ${fechaLarga(pr.hasta)}). Elige tu plan antes y no se corta nada.</span></div>
        <div class="aviso-botones"><button type="button" class="btn-ghost" data-ir-plan>Elegir plan</button></div>`;
      cont.hidden = false;
    } else {
      cont.hidden = true;
      cont.innerHTML = '';
    }
  }

  // Aviso de "quedan pocas piezas": con 15 o menos entre cupo y saldo, hasta que lo cierre.
  let pocasOcultas = false;
  try { pocasOcultas = sessionStorage.getItem('rubrofy-pocas') === '1'; } catch (e) { pocasOcultas = false; }
  function quedanPocas() {
    if (pocasOcultas || !window.RubrofyRecargas || negocioActual.sinPlan) return false;
    const c = (negocioActual.cupos || {}).piezas || {};
    return !!c.cupo && window.RubrofyRecargas.quedan(negocioActual, 'piezas') <= 15;
  }

  // Formulario de la prueba gratis (public/app/prueba-form.js) en un diálogo.
  async function abrirPrueba() {
    let dlg = $('#dlg-prueba');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-prueba';
      dlg.className = 'dlg dlg-prueba';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) dlg.close(); });
      dlg.addEventListener('submit', (e) => { e.preventDefault(); activarPrueba(dlg); });
    }
    const cat = await window.RubrofyPrueba.cargar();
    const perfil = negocioActual.perfil || {};
    dlg.innerHTML = `<form method="dialog" class="dlg-caja">
        <h2>🎁 ${cat.dias} días gratis del plan ${escapeHtml(nombrePlan(cat.plan))}</h2>
        <p class="sub">Déjanos tu nombre, correo y teléfono, y la prueba se activa al instante, sin tarjeta. Al terminar, tu contenido queda guardado y eliges si seguir.</p>
        ${window.RubrofyPrueba.campos(cat, { email: negocioActual.email, telefono: perfil.whatsapp })}
        <p class="config-error" data-prueba-error hidden></p>
        <div class="dlg-acciones"><button type="button" class="btn-ghost" data-cerrar>Ahora no</button><button class="btn-approve">Activar mi prueba</button></div>
      </form>`;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  async function activarPrueba(dlg) {
    const form = dlg.querySelector('form');
    const btn = form.querySelector('.btn-approve');
    const errorEl = form.querySelector('[data-prueba-error]');
    window.RubrofyPrueba.limpiarErrores(form);
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Activando…';
    try {
      negocioActual = await api(`/api/negocios/${negocioActual.id}/prueba`, { method: 'POST', body: JSON.stringify(window.RubrofyPrueba.leer(form)) });
      dlg.close();
      render();
      const pr = negocioActual.prueba;
      if (negocioActual.bienvenidaCompletada && !contenido.length) {
        try { await generarSemana(); irAVista('cola'); } catch (err) { /* se genera con el botón */ }
      }
      alert(`¡Listo! Tienes el plan ${nombrePlan(pr.plan)} gratis hasta el ${fechaLarga(pr.hasta)}.`);
    } catch (err) {
      const msg = err.mensaje || 'No se pudo activar la prueba. Intenta de nuevo.';
      if (!window.RubrofyPrueba.marcarError(form, err.campo, msg)) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }
      btn.disabled = false;
      btn.textContent = 'Activar mi prueba';
    }
  }

  const conFlow = () => !!(negocioActual.pagos && negocioActual.pagos.proveedor === 'flow');

  // Abre la página de pago (Stripe Checkout o la inscripción de tarjeta en
  // Flow) o cambia el plan de una suscripción activa.
  async function pagarPlan(btn, errorEl) {
    const planId = btn.dataset.checkoutPlan;
    if (negocioActual.tieneSuscripcion && !negocioActual.sinPlan) {
      const destino = planesInfo.find((p) => p.id === planId);
      const nombre = destino ? destino.nombre : 'el nuevo plan';
      if (!confirm(conFlow()
        ? (periodoPlan === 'anual' ? `Tu suscripción pasará a ${nombre} con pago anual desde hoy (12 meses por el precio de 10). Flow ajusta el cobro según lo que ya pagaste.` : `Tu suscripción pasará a ${nombre} desde hoy. Flow ajusta el cobro según los días que quedan del mes.`)
        : `Tu suscripción pasará a ${nombre} ahora mismo. La diferencia proporcional a los días que quedan se cobra en tu próxima factura.`)) return;
    }
    if (errorEl) errorEl.hidden = true;
    btn.disabled = true;
    try {
      const codigo = codigoDescuento && codigoDescuento.planes.includes(planId) ? codigoDescuento.codigo : undefined;
      const resultado = await api(`/api/negocios/${negocioActual.id}/checkout`, { method: 'POST', body: JSON.stringify({ plan: planId, codigo, periodo: periodoPlan || 'mensual' }) });
      if (codigo) codigoDescuento = null;
      if (resultado.url) {
        window.location.href = resultado.url;
        return;
      }
      // Cambio de plan sobre la suscripción existente: no hay página de pago.
      negocioActual = resultado.negocio;
      render();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.';
        errorEl.hidden = false;
      } else alert(err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.');
      btn.disabled = false;
    }
  }

  // Diálogo al tocar "Cancelar": pausar un mes (recomendado) o cancelar.
  // Resuelve 'pausar', 'cancelar' o null.
  function preguntarPausa() {
    return new Promise((resolve) => {
      let dlg = document.getElementById('dlg-pausa');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'dlg-pausa';
        dlg.className = 'dlg';
        document.body.appendChild(dlg);
      }
      const fin = negocioActual.pagos && negocioActual.pagos.periodoFin ? fechaLarga(negocioActual.pagos.periodoFin) : 'el fin del período que pagaste';
      dlg.innerHTML = `<div class="dlg-caja">
        <h2>¿Prefieres pausar un mes?</h2>
        <p class="sub">Tu plan sigue hasta ${escapeHtml(fin)}. Después, <b>un mes sin cobro</b>: tu estrategia, tus fotos, tus videos y tu contenido quedan guardados tal cual. Se reanuda solo y te avisamos 3 días antes.</p>
        <div class="pausa-opciones">
          <button type="button" class="pausa-op recomendada" data-pausa="pausar"><b>⏸ Pausar 1 mes</b><span>Sin cobro, sin perder nada. Vuelves cuando quieras.</span><em>Recomendado</em></button>
          <button type="button" class="pausa-op" data-pausa="cancelar"><b>Cancelar de todos modos</b><span>Tu plan termina ${escapeHtml(fin)} y no se vuelve a cobrar.</span></button>
        </div>
        <div class="dlg-acciones"><button type="button" class="btn-ghost" data-pausa="">Volver</button></div>
      </div>`;
      const cerrar = (valor) => { dlg.close(); resolve(valor || null); };
      dlg.onclick = (e) => { const b = e.target.closest('[data-pausa]'); if (b) cerrar(b.dataset.pausa); else if (e.target === dlg) cerrar(null); };
      dlg.addEventListener('cancel', () => resolve(null), { once: true });
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    });
  }

  // Estado de la suscripción y lo que se puede hacer con ella.
  function gestionSuscripcion() {
    const pg = negocioActual.pagos || {};
    if (!negocioActual.tieneSuscripcion) return '';
    if (pg.proveedor !== 'flow') return '<button type="button" class="btn-ghost" data-action="portal">Gestionar suscripción</button>';
    const t = pg.tarjeta;
    const tarjeta = t && t.ultimos4 ? `${escapeHtml(t.tipo || 'Tarjeta')} terminada en ${escapeHtml(t.ultimos4)}` : 'tu tarjeta';
    const fin = pg.periodoFin ? fechaLarga(pg.periodoFin) : '';
    let linea = '';
    if (pg.estado === 'past_due') linea = `No pudimos cobrar con ${tarjeta}. Cambia la tarjeta para seguir con tu plan.`;
    else if (pg.estado === 'canceled') linea = 'Tu suscripción está cancelada. Elige un plan para volver.';
    else if (negocioActual.pausa && negocioActual.pausa.reanudadaPorDueno) linea = `Tu plan se reanuda solo el ${fechaLarga(negocioActual.pausa.hasta)}, cuando termina lo que ya pagaste. No se cobra antes.`;
    else if (negocioActual.pausa && negocioActual.pausa.hasta) linea = `Tu plan está en pausa: sigue ${fin ? `hasta el ${fin}` : 'hasta el fin del período pagado'}, después no se cobra, y se reanuda solo el ${fechaLarga(negocioActual.pausa.hasta)}. Todo queda guardado.`;
    else if (pg.cancelaAlFinal) linea = `Cancelaste tu suscripción: tu plan sigue ${fin ? `hasta el ${fin}` : 'hasta el fin del período pagado'} y no se vuelve a cobrar.`;
    else if (pg.suscripcion) linea = `Se cobra cada ${pg.periodo === 'anual' ? 'año' : 'mes'} con ${tarjeta}${fin ? `. Próximo cobro: ${fin}` : ''}.`;
    const enPausa = !!(negocioActual.pausa && negocioActual.pausa.hasta && !negocioActual.pausa.reanudadaPorDueno);
    const vigente = pg.suscripcion && !['canceled', 'incomplete'].includes(pg.estado) && !pg.cancelaAlFinal;
    return `${linea ? `<p class="plan-estado">${linea}</p>` : ''}
      <div class="plan-acciones">
        <button type="button" class="btn-ghost" data-action="flow-tarjeta">Cambiar tarjeta</button>
        ${enPausa ? '<button type="button" class="btn-approve" data-action="flow-reanudar">Reanudar mi plan</button>' : ''}
        ${vigente ? '<button type="button" class="btn-ghost" data-action="flow-cancelar">Cancelar suscripción</button>' : ''}
      </div>`;
  }

  // Mensual o anual (2 meses gratis). Parte en lo que ya paga el negocio.
  let periodoPlan = null;
  function renderPlan() {
    const cont = $('#plan-card');
    if (!cont || !negocioActual) return;
    const planActualId = negocioActual.plan || 'gratis';
    const indiceActual = planesInfo.findIndex((p) => p.id === planActualId);
    const pgPeriodo = (negocioActual.pagos && negocioActual.pagos.periodo) || 'mensual';
    if (!periodoPlan) periodoPlan = pgPeriodo;
    const anual = periodoPlan === 'anual';
    const conAnual = conFlow() && planesInfo.some((p) => p.precioAnualClp);
    const mesesGratis = (planesInfo.find((p) => p.mesesGratisAnual) || {}).mesesGratisAnual || 2;

    const filas = planesInfo.map((p, i) => {
      const esActual = p.id === planActualId;
      let boton = '';
      if (esActual && conAnual && negocioActual.tieneSuscripcion && !negocioActual.sinPlan && pgPeriodo !== periodoPlan) {
        boton = `<button type="button" class="btn-approve" data-checkout-plan="${p.id}">Pasar a ${anual ? 'anual' : 'mensual'}</button>`;
      } else if (esActual) {
        boton = `<span class="ig-estado conectado">Plan actual${negocioActual.tieneSuscripcion && pgPeriodo === 'anual' ? ' · anual' : ''}</span>`;
      } else if (i < indiceActual && !(conFlow() && negocioActual.tieneSuscripcion && !negocioActual.sinPlan)) {
        // Con Stripe, bajar de plan se hace desde "Gestionar suscripción" (Billing Portal).
        boton = '';
      } else if (i < indiceActual) {
        boton = `<button type="button" class="btn-ghost" data-checkout-plan="${p.id}">Cambiar a ${escapeHtml(p.nombre)}</button>`;
      } else if (!p.disponible) {
        boton = '<button type="button" class="btn-ghost" disabled title="Todavía no configurado">Próximamente</button>';
      } else {
        boton = `<button type="button" class="btn-approve" data-checkout-plan="${p.id}">${negocioActual.sinPlan ? 'Elegir' : 'Actualizar a'} ${escapeHtml(p.nombre)}</button>`;
      }
      const detalle = [
        `${p.cuotaTextosIA} piezas con IA`,
        p.creditosMes ? `${p.creditosMes} créditos ⚡ para fotos y videos` : '',
        p.cuotaReelsEditados ? `${p.cuotaReelsEditados} reels editados` : '',
      ].filter(Boolean).join(' · ') + ' al mes';
      const clp = (m) => '$' + Number(m).toLocaleString('es-CL');
      const precio = anual && p.precioAnualClp
        ? `<b class="plan-precio-desc">${clp(p.precioAnualClp)} al año</b> · equivale a ${clp(Math.round(p.precioAnualClp / 12))}/mes`
        : (codigoDescuento && codigoDescuento.precios[p.id] ? `<s>${formatoCLP(p.precioClp)}</s> <b class="plan-precio-desc">${formatoCLP(codigoDescuento.precios[p.id].ahora)}</b>` : formatoCLP(p.precioClp));
      return `
        <div class="plan-row${esActual ? ' plan-row-actual' : ''}">
          <div>
            <strong>${escapeHtml(p.nombre)}</strong>
            <span class="sub">${detalle} · ${precio}</span>
          </div>
          ${boton}
        </div>
      `;
    }).join('');
    const selectorPeriodo = conAnual && !negocioActual.regalo && !negocioActual.cortesia
      ? `<div class="plan-periodo" role="radiogroup" aria-label="Cómo pagar">
          <button type="button" class="${anual ? '' : 'on'}" data-periodo="mensual" aria-checked="${!anual}" role="radio">Mensual</button>
          <button type="button" class="${anual ? 'on' : ''}" data-periodo="anual" aria-checked="${anual}" role="radio">Anual <em>${mesesGratis} meses gratis</em></button>
        </div>` : '';

    const pr = negocioActual.prueba || {};
    const estadoPlan = negocioActual.sinPlan && pr.disponible
      ? `<div class="plan-prueba"><p class="plan-estado">Tu cuenta no tiene un plan activo. Prueba el plan ${escapeHtml(nombrePlan(pr.plan))} ${pr.dias} días gratis dejando tu nombre, correo y teléfono, o elige un plan.</p><button type="button" class="btn-approve" data-abrir-prueba>Quiero mis ${pr.dias} días gratis</button></div>`
      : negocioActual.sinPlan
      ? `<p class="plan-estado">${pr.hasta ? 'Terminó tu prueba gratis. ' : ''}Tu cuenta no tiene un plan activo. Elige uno para crear contenido: pagas con tarjeta${negocioActual.pagos && negocioActual.pagos.nombre ? ` en ${escapeHtml(negocioActual.pagos.nombre)}` : ''} y cancelas cuando quieras.</p>`
      : pr.vigente && !negocioActual.tieneSuscripcion
        ? `<p class="plan-estado">Estás en tu prueba gratis hasta el ${fechaLarga(pr.hasta)} (${pr.diasRestantes === 1 ? 'queda 1 día' : `quedan ${pr.diasRestantes} días`}). Elige tu plan antes y no se corta nada.</p>`
      : negocioActual.regalo
        ? `<p class="plan-estado plan-regalo">🎁 Tienes el plan ${escapeHtml(nombrePlan(negocioActual.regalo.plan))} de regalo${negocioActual.regalo.hasta ? ` hasta el ${fechaLarga(negocioActual.regalo.hasta)}` : ''}. No se cobra${negocioActual.regalo.hasta ? '; después eliges si seguir con un plan' : ''}.</p>`
      : negocioActual.cortesia
        ? '<p class="plan-estado">Plan de cortesía para la cuenta administradora: no se cobra.</p>'
        : '';
    const pg = negocioActual.pagos || {};
    const cajaCodigo = pg.proveedor === 'flow' && !negocioActual.regalo && !negocioActual.cortesia
      ? `<div class="plan-codigo">
          ${codigoDescuento ? `<p class="plan-codigo-ok">Código <b>${escapeHtml(codigoDescuento.codigo)}</b>: ${escapeHtml(codigoDescuento.descripcion)}. Se aplica al elegir tu plan.</p>` : ''}
          <form data-codigo-form class="plan-codigo-form">
            <input name="codigo" placeholder="¿Tienes un código de descuento?" maxlength="24" autocomplete="off" aria-label="Código de descuento">
            <button type="submit" class="btn-ghost">Aplicar</button>
          </form>
        </div>`
      : '';

    cont.innerHTML = `
      <div class="ig-card-head"><h2>Plan</h2></div>
      ${estadoPlan}
      ${selectorPeriodo}${filas}
      ${cajaCodigo}
      <div class="rc-uso-caja" id="plan-uso"></div>
      <p class="config-error" id="plan-error" hidden></p>
      ${gestionSuscripcion()}
    `;
    if (window.RubrofyRecargas) window.RubrofyRecargas.renderUso($('#plan-uso'));
  }

  // Resultados tiene pestañas: Instagram, Meta Ads y Competencia (y Google
  // Ads, solo si el servidor lo tiene activo).
  let tabResultados = 'instagram';
  function renderResultados() {
    const tabGoogle = document.querySelector('#resultados-pestanas [data-tab="google"]');
    if (tabGoogle) tabGoogle.hidden = !negocioActual.googleActivo;
    if (tabResultados === 'google' && !negocioActual.googleActivo) tabResultados = 'meta';
    document.querySelectorAll('#resultados-pestanas [data-tab]').forEach((b) => b.classList.toggle('activa', b.dataset.tab === tabResultados));
    const ctx = { api, negocio: negocioActual, planes: planesInfo, irA: irAVista, recargarContenido: ctxPanel().recargarContenido };
    const cont = $('#resultados');
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    if (tabResultados === 'instagram') return window.RubrofyResultados.render(cont, ctx);
    if (negocioActual.metaAbierto === false && (tabResultados === 'meta' || tabResultados === 'competencia')) {
      cont.innerHTML = tabResultados === 'competencia'
        ? `<div class="res-pronto"><span class="pronto">Próximamente</span><h2>Tu competencia, en Rubrofy</h2>
            <p>Sigue hasta 5 cuentas de Instagram de tu competencia y descubre qué publican, cuándo y qué les funciona, comparado contigo.</p>
            <p class="sub">Llega pronto al plan Estudio. Mientras tanto, tus resultados de Instagram están en la pestaña Instagram.</p></div>`
        : `<div class="res-pronto"><span class="pronto">Próximamente</span><h2>Meta Ads, en Rubrofy</h2>
            <p>Verás cuánto inviertes en Instagram y Facebook, qué te trae cada anuncio y qué cambiar, en palabras simples. Rubrofy también aprenderá de tus anuncios para escribir mejor tus publicaciones.</p>
            <p class="sub">Llega pronto al plan Estudio. Mientras tanto, tus resultados de Instagram están en la pestaña Instagram.</p></div>`;
      return;
    }
    const clave = tabResultados === 'competencia' ? 'competencia' : 'ads';
    if (!plan[clave]) {
      cont.innerHTML = `<div class="res-aviso">${tabResultados === 'competencia'
        ? 'Sigue a tus competidores en Instagram (seguidores, frecuencia e interacción) y compáralos contigo.'
        : 'Ve tu inversión en publicidad, los resultados y el costo de cada uno junto a tu Instagram.'}${AY(tabResultados === 'competencia' ? 'competencia' : 'publicidad')} Está disponible en el plan <b>Estudio</b>. <button class="btn-approve estilo-btn" data-ir="cuenta">Ver planes</button></div>`;
      cont.querySelector('[data-ir]').addEventListener('click', () => irAVista('cuenta', null, 'cta-plan'));
      return;
    }
    if (tabResultados === 'competencia') return window.RubrofyCompetencia && window.RubrofyCompetencia.render(cont, ctx);
    return window.RubrofyAds.render(cont, ctx, tabResultados);
  }

  const VISTAS = ['inicio', 'estrategia', 'marca', 'contexto', 'cola', 'reels', 'calendario', 'fotos', 'resultados', 'config', 'cuenta', 'soporte'];
  // Voz de marca, Mi estilo y el Kit de marca ahora son pestañas de "Tu marca":
  // los enlaces antiguos (avisos, ruta de Inicio, /app#voz) siguen sirviendo.
  const ALIAS_MARCA = { voz: 'voz', estilo: 'ejemplos', kit: 'kit' };
  let tabMarca = 'voz';

  // El menú lateral tiene entradas que abren Resultados en una pestaña
  // (Publicidad, Competencia): la marcada es la que coincide en vista y pestaña.
  function marcarMenu() {
    document.querySelectorAll('.rail-btn[data-view]').forEach((b) => b.classList.toggle('active',
      b.dataset.view === vistaActual && (!b.dataset.tab || vistaActual !== 'resultados' || b.dataset.tab === tabMenu())));
  }
  function tabMenu() { return tabResultados === 'google' ? 'meta' : tabResultados; }

  // ancla: id de una sección dentro de la vista (ej: 'cta-plan').
  let vistaPrevia = 'inicio'; // para saber desde qué pantalla se pide ayuda
  // "Tu marca": cómo hablas (voz.js), tus ejemplos (estilo.js) y cómo se ve
  // (Kit de marca, diseno.js). Arriba, un resumen de lo que ya sabe Rubrofy.
  function renderMarca() {
    const n = negocioActual;
    const v = n.voz || {};
    const vozLista = !!(v.quienesSomos || (v.personalidad || []).length || (v.palabrasNo || []).length || (v.ejemplos || []).length);
    const estiloListo = !!(n.estilo && (n.estilo.general || n.estilo.post || n.estilo.reel));
    const logo = !!(n.marca && n.marca.logo);
    const item = (ok, si, no, tab) => `<button type="button" class="marca-res ${ok ? 'ok' : 'falta'}" data-marca-tab="${tab}"><i aria-hidden="true">${ok ? '✓' : '○'}</i>${escapeHtml(ok ? si : no)}</button>`;
    $('#marca-resumen').innerHTML = `<span class="marca-res-tit">Lo que Rubrofy ya sabe de tu marca:</span>
      ${item(vozLista, 'Conoce tu forma de hablar', 'Falta tu forma de hablar', 'voz')}
      ${item(estiloListo, 'Aprendió de tus ejemplos', 'Faltan ejemplos de lo que te gusta', 'ejemplos')}
      ${item(logo, 'Tiene tu logo y colores', 'Falta tu logo', 'kit')}`;
    document.querySelectorAll('#view-marca [role="tab"][data-marca-tab]').forEach((b) => {
      const on = b.dataset.marcaTab === tabMarca;
      b.classList.toggle('activa', on);
      b.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('#view-marca [data-marca-panel]').forEach((p) => { p.hidden = p.dataset.marcaPanel !== tabMarca; });
    if (tabMarca === 'voz') window.RubrofyVoz.render($('#voz'), ctxPanel());
    else if (tabMarca === 'ejemplos') window.RubrofyEstilo.render($('#estilo'), { api, negocio: negocioActual });
    else if (window.RubrofyDiseno) {
      if (window.RubrofyDisenoIA) {
        window.RubrofyDisenoIA.render($('#marca-ia'), Object.assign(ctxPanel(), {
          negocio: () => negocioActual,
          alAplicar: () => renderMarca(),
        }));
      }
      window.RubrofyDiseno.renderKit($('#marca-card'));
    }
  }

  // Menú por etapas (1 Configura, 2 Cada semana, 3 Mide, 4 Cada mes): cada
  // una se abre y se cierra, y se recuerda en este navegador. Si se va a una
  // pantalla de una etapa cerrada, esa etapa se abre sola.
  const LLAVE_MENU = 'rubrofy-menu-cerrados';
  let gruposCerrados = [];
  try { gruposCerrados = JSON.parse(localStorage.getItem(LLAVE_MENU) || '[]'); } catch (e) { gruposCerrados = []; }
  function pintarGrupos() {
    document.querySelectorAll('.rail-grupo[data-grupo]').forEach((b) => {
      const cerrado = gruposCerrados.includes(b.dataset.grupo);
      b.setAttribute('aria-expanded', String(!cerrado));
      const items = document.querySelector(`[data-grupo-items="${b.dataset.grupo}"]`);
      if (items) items.classList.toggle('cerrado', cerrado);
    });
  }
  function alternarGrupo(grupo, abrir) {
    const cerrado = gruposCerrados.includes(grupo);
    const cerrar = abrir === undefined ? !cerrado : !abrir;
    gruposCerrados = gruposCerrados.filter((g) => g !== grupo).concat(cerrar ? [grupo] : []);
    try { localStorage.setItem(LLAVE_MENU, JSON.stringify(gruposCerrados)); } catch (e) { /* sin almacenamiento */ }
    pintarGrupos();
  }
  function abrirGrupoDe(vista) {
    const b = document.querySelector(`.rail-grupo-items .rail-btn[data-view="${vista}"]`);
    const g = b && b.closest('[data-grupo-items]');
    if (g && gruposCerrados.includes(g.dataset.grupoItems)) alternarGrupo(g.dataset.grupoItems, true);
  }

  function irAVista(vista, tab, ancla) {
    if (ALIAS_MARCA[vista]) { tab = ALIAS_MARCA[vista]; vista = 'marca'; }
    if (vista === 'config' && ancla === 'cfg-marca') { vista = 'marca'; tab = 'kit'; ancla = null; }
    if (vista === 'soporte' && vistaActual !== 'soporte') vistaPrevia = vistaActual;
    vistaActual = vista;
    if (vista === 'marca') { if (tab) tabMarca = tab; } else if (tab) tabResultados = tab;
    abrirGrupoDe(vista);
    marcarMenu();
    for (const v of VISTAS) $('#view-' + v).hidden = v !== vista;
    render();
    const destino = ancla && document.getElementById(ancla);
    if (destino) destino.scrollIntoView({ block: 'start' });
    else $('#view-' + vista).scrollTop = 0;
  }

  // Etiquetas del menú: pendientes por aprobar y qué plan pide cada sección.
  function renderMenu() {
    if (!negocioActual) return;
    const pendientes = contenido.filter((i) => i.status === 'pendiente').length;
    const num = $('#rail-pendientes');
    num.textContent = pendientes; num.hidden = !pendientes;
    const respuestas = negocioActual.soporteSinLeer || 0;
    const numSop = $('#rail-soporte');
    numSop.textContent = respuestas; numSop.hidden = !respuestas;
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    // Meta Ads y Competencia dicen "Pronto" hasta que Meta apruebe la app.
    const metaPronto = negocioActual.metaAbierto === false;
    document.querySelectorAll('[data-plan-req]').forEach((el) => {
      const deMeta = el.dataset.planReq === 'ads' || el.dataset.planReq === 'competencia';
      el.hidden = (deMeta && metaPronto) || !!plan[el.dataset.planReq] || !planesInfo.length;
    });
    document.querySelectorAll('[data-meta-pronto]').forEach((el) => { el.hidden = !metaPronto; });
    const enlaceAdmin = $('#rail-admin');
    enlaceAdmin.hidden = !negocioActual.esAdmin;
    // "Vincular cuentas": un punto si Instagram no está conectado o pide reconectar.
    const igFalta = !negocioActual.instagramConectado || negocioActual.instagramEstado === 'reconectar';
    $('#rail-vincular-punto').hidden = !igFalta;
    $('#rail-vincular').title = igFalta ? (negocioActual.instagramEstado === 'reconectar' ? 'Instagram pide reconectar' : 'Instagram no está conectado') : (negocioActual.googleActivo ? 'Vincular Instagram, Meta y Google' : 'Vincular Instagram y Meta');
    const actual = $('#rail-planactual');
    actual.hidden = !plan.nombre;
    actual.innerHTML = plan.nombre ? `Plan <b>${escapeHtml(plan.nombre)}</b>` : '';
  }

  function render() {
    renderStats();
    renderMenu();
    renderAvisoPlan();
    renderAvisoCorreo();
    mostrarGuias();
    if (vistaActual === 'cola') renderCola();
    else if (vistaActual === 'calendario') renderCalendario();
    else if (vistaActual === 'fotos') renderFotos();
    else if (vistaActual === 'reels') renderEstudioReels();
    else if (vistaActual === 'config') renderConfig();
    else if (vistaActual === 'soporte') {
      window.RubrofySoporte.render(Object.assign(ctxPanel(), {
        vista: vistaPrevia,
        alLeer: () => { if (negocioActual) { negocioActual.soporteSinLeer = 0; renderMenu(); } },
      })).catch(() => {});
    }
    else if (vistaActual === 'cuenta') {
      renderPlan();
      window.RubrofyCuenta.render(Object.assign(ctxPanel(), { alCambiar: () => { renderAvisoCorreo(); actualizarSwitcher(); } })).catch(() => {});
    }
    else if (vistaActual === 'marca') renderMarca();
    else if (vistaActual === 'resultados') renderResultados();
    else if (vistaActual === 'inicio') window.RubrofyInicio.render($('#inicio'), ctxPanel()).catch(() => {});
    else if (vistaActual === 'estrategia') {
      window.RubrofyPlan.renderVista($('#estrategia'), ctxPanel()).catch(() => {});
      window.RubrofyContexto.editor($('#ctx-estrategia'), ctxPanel(), ['estrategia'], 'estrategia');
    }
    else if (vistaActual === 'contexto') window.RubrofyContexto.render($('#contexto'), ctxPanel());
  }

  // Guías de cada pantalla (guias.js); se apagan con GUIAS=no en el servidor.
  function mostrarGuias() {
    if (window.RubrofyGuias && negocioActual) window.RubrofyGuias.mostrar(vistaActual, tabResultados, ctxPanel());
  }
  function renderGuiasAjustes() {
    if (!window.RubrofyGuias) return;
    const a = window.RubrofyGuias.ajustes();
    $('#guias-card').hidden = !a.habilitadas;
    $('#guias-activas').checked = a.activas;
    $('#guias-estado').textContent = a.activas ? 'Activas' : 'Apagadas';
    $('#guias-estado').classList.toggle('conectado', a.activas);
    $('#btn-guias-reiniciar').hidden = !a.activas || !a.cerradas;
  }

  // Lo que necesitan Inicio, Estrategia y la bienvenida del resto del panel.
  function ctxPanel() {
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    return {
      api,
      negocio: negocioActual,
      contenido,
      fotos,
      estrategia: nichoActual,
      planActual: negocioActual.planContenido || null,
      planIncluye: (clave) => !!plan[clave],
      planes: planesInfo,
      fechaCorta,
      irA: irAVista,
      abrirBienvenida,
      abrirGenerar,
      guardarDatos: (datos) => guardarConfig({ nombre: negocioActual.nombre, datos, estiloImagen: negocioActual.estiloImagen }),
      setNegocio: (n) => { negocioActual = n; actualizarSwitcher(); },
      setEstrategia: (e) => { nichoActual = e; negocioActual.estrategia = e; },
      recargarContenido: () => api('/api/negocios/' + negocioActual.id + '/contenido').then((c) => { contenido = c; renderStats(); renderMenu(); }).catch(() => {}),
    };
  }

  // Bienvenida: se abre sola mientras el negocio no la termine.
  // Sin la bienvenida hecha: completa. Hecha pero sin perfil (cuentas de
  // antes): solo "Tu negocio" y "Lo que vendes".
  function abrirBienvenida() {
    const base = ctxPanel();
    const soloPerfil = !!negocioActual.bienvenidaCompletada && !negocioActual.perfilCompleto;
    window.RubrofyBienvenida.abrir(Object.assign({}, base, {
      negocio: () => negocioActual,
      estrategia: () => nichoActual,
      generarSemana: () => generarSemana(),
      alTerminar: (generado) => { window.RubrofyInicio.invalidar(); irAVista(generado ? 'cola' : (soloPerfil ? vistaActual : 'inicio')); },
    }), { soloPerfil }).catch(() => {});
  }

  // "Generar semana": muestra qué se va a crear según el plan y lo genera.
  function abrirGenerar() {
    if (negocioActual.sinPlan) {
      // Sin plan no se genera: se destaca el aviso para elegir uno.
      renderAvisoPlan();
      const aviso = $('#aviso-plan');
      aviso.classList.remove('destello');
      void aviso.offsetWidth;
      aviso.classList.add('destello');
      aviso.scrollIntoView({ block: 'nearest' });
      return;
    }
    const dlg = $('#dlg-generar');
    const pc = negocioActual.planContenido;
    const total = pc ? Object.values(pc.semanal).reduce((a, b) => a + b, 0) : 6;
    $('#dlg-generar-texto').innerHTML = pc
      ? window.RubrofyPlan.textoTotal(pc.semanal) + (total > 12 ? '. Se crean 12 por vez: vuelve a generar para completar la semana.' : '.')
      : 'Se crearán 6 publicaciones. Define tu plan en <b>Estrategia</b> para elegir cuántos posts, carruseles, reels e historias quieres.';
    $('#dlg-generar-fechas').textContent = 'Siguen después de lo que ya tienes programado y llegan a Por aprobar.';
    $('#dlg-generar-error').hidden = true;
    $('#dlg-generar-indicaciones').value = '';
    $('#dlg-generar-ok').textContent = 'Generar';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (window.RubrofyBrief) window.RubrofyBrief.cargarParaGenerar($('#dlg-generar-brief'));
  }

  async function generarSemana(brief) {
    contenido = await api(`/api/negocios/${negocioActual.id}/generar`, {
      method: 'POST',
      body: JSON.stringify(Object.assign(negocioActual.planContenido ? { segunPlan: true } : { cantidad: 6 }, { indicaciones: ($('#dlg-generar-indicaciones') || {}).value || '', brief })),
    });
    render();
  }

  function leerArchivoComoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // La foto se prepara en el navegador (imagen.js): JPEG de hasta 2048 px,
  // derecha y en un formato que se ve en todos lados (las del iPhone vienen en HEIC).
  async function subirFoto(categoria, original) {
    const file = window.RubrofyImagen ? await window.RubrofyImagen.preparar(original) : original;
    const dataBase64 = await leerArchivoComoBase64(file);
    fotos = await api(`/api/negocios/${negocioActual.id}/fotos`, {
      method: 'POST',
      body: JSON.stringify({ categoria, filename: file.name, dataBase64 }),
    });
  }

  // Sube el video elegido en un input[data-video-id] (tarjeta o Estudio de
  // reels). Con data-video-editar, al terminar abre el editor de Rubrofy.
  async function subirVideoDesde(el) {
    const inputVideo = el.closest && el.closest('input[data-video-id]');
    if (!inputVideo || !inputVideo.files[0]) return false;
    const id = inputVideo.dataset.videoId;
    const etiqueta = inputVideo.closest('label');
    if (etiqueta) etiqueta.firstChild.textContent = 'Subiendo video…';
    let ok = false;
    try {
      await subirVideo(id, inputVideo.files[0]);
      ok = true;
    } catch (err) {
      alert(err.message);
    }
    await refreshContenido().catch(() => {});
    const er = negocioActual.edicionReels || {};
    if (ok && inputVideo.dataset.videoEditar && er.disponible) {
      const it = contenido.find((x) => x.id === id);
      if (it && it.video) window.RubrofyReels.abrir(it);
    }
    return true;
  }

  async function borrarFoto(categoria, archivo) {
    fotos = await api(`/api/negocios/${negocioActual.id}/fotos/${encodeURIComponent(categoria)}/${encodeURIComponent(archivo)}`, { method: 'DELETE' });
  }

  function actualizarSwitcher() {
    $('#switcher-badge').textContent = (negocioActual.nombre || '??').slice(0, 2).toUpperCase();
    $('#switcher-nombre').textContent = negocioActual.nombre || '-';
    const rubro = negocioActual.estrategia && negocioActual.estrategia.rubro;
    $('#switcher-niche').textContent = (rubro || '').toUpperCase();
  }

  async function guardarConfig(datos) {
    negocioActual = await api(`/api/negocios/${negocioActual.id}`, { method: 'PUT', body: JSON.stringify(datos) });
    actualizarSwitcher();
  }

  async function eliminarNegocioActual() {
    await api(`/api/negocios/${negocioActual.id}`, { method: 'DELETE' });
    mostrarLogin();
  }

  // ---------- acciones ----------
  // Mientras haya videos con IA generándose, la cola se refresca sola.
  let vigilancia = null;
  function vigilarVideos() {
    const hay = contenido.some((i) => (i.videoIA && i.videoIA.estado === 'generando') || (i.edicion && i.edicion.estado === 'editando') || (i.union && i.union.estado === 'uniendo'));
    if (hay && !vigilancia) {
      vigilancia = setInterval(() => {
        if ((vistaActual !== 'cola' && vistaActual !== 'reels') || document.hidden) return;
        refreshContenido().catch(() => {});
      }, 10000);
    } else if (!hay && vigilancia) {
      clearInterval(vigilancia);
      vigilancia = null;
    }
  }

  // Vuelve a leer el negocio (saldo de créditos, cupos) sin recargar la página.
  async function refrescarNegocio() {
    negocioActual = await api('/api/me');
    if (window.RubrofyCreditos) window.RubrofyCreditos.pintarChip();
  }

  async function refreshContenido() {
    contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
    render();
  }

  async function accionSimple(accion, id) {
    await api(`/api/negocios/${negocioActual.id}/contenido/${id}/${accion}`, { method: 'POST' });
    await refreshContenido();
  }

  // Igual que accionSimple, pero avisa si falla. Un 409 en "aprobar" es un
  // doble clic mientras la pieza se publica: no es un error, solo se refresca.
  async function accionConAviso(accion, id) {
    try {
      await accionSimple(accion, id);
    } catch (err) {
      if (err.status === 409) return refreshContenido();
      alert(err.mensaje || 'No se pudo completar la acción. Intenta de nuevo.');
      refreshContenido().catch(() => {}); // re-renderiza y vuelve a habilitar los botones
    }
  }

  async function guardarEdicion(id, caption, hashtags) {
    await api(`/api/negocios/${negocioActual.id}/contenido/${id}/editar`, {
      method: 'PUT',
      body: JSON.stringify(hashtags === undefined ? { caption } : { caption, hashtags }),
    });
    editingIds.delete(id);
    await refreshContenido();
  }

  async function generarMas() {
    const btn = $('#dlg-generar-ok');
    const btnTop = $('#btn-generar');
    btn.disabled = true; btnTop.disabled = true;
    btn.textContent = 'Generando…';
    let revisar = false;
    try {
      // Con brief escrito: primero se ordena y se muestra cómo lo entendió
      // Rubrofy; el segundo clic genera con ese brief.
      let brief;
      if (window.RubrofyBrief) {
        btn.textContent = 'Ordenando el brief…';
        const r = await window.RubrofyBrief.antesDeGenerar($('#dlg-generar-brief'));
        if (!r.listo) {
          revisar = true;
          if (r.total) $('#dlg-generar-texto').innerHTML = `Según tu brief se crearán <b>${r.total}</b> publicaciones esta semana.`;
          return;
        }
        brief = r.brief;
        btn.textContent = 'Generando…';
      }
      await generarSemana(brief);
      $('#dlg-generar').close();
      irAVista('cola');
    } catch (err) {
      if (err.status === 402) {
        $('#dlg-generar').close();
        negocioActual.sinPlan = true;
        return abrirGenerar();
      }
      $('#dlg-generar-error').textContent = err.mensaje || 'No se pudo generar contenido. Intenta de nuevo.';
      $('#dlg-generar-error').hidden = false;
    } finally {
      btn.disabled = false; btnTop.disabled = false;
      btn.textContent = revisar ? 'Generar con este brief' : 'Generar';
    }
  }

  // ---------- login / sesión ----------
  function mostrarLogin(mensaje) {
    negocioActual = null;
    if (window.RubrofyVideos) window.RubrofyVideos.olvidar();
    $('#view-app').hidden = true;
    $('#view-login').hidden = false;
    $('#login-error').hidden = !mensaje;
    if (mensaje) $('#login-error').textContent = mensaje;
    $('#login-email').focus();
  }

  async function mostrarApp() {
    const [contenidoData, estrategiaData, fotosData, planesData] = await Promise.all([
      api('/api/negocios/' + negocioActual.id + '/contenido'),
      api('/api/negocios/' + negocioActual.id + '/estrategia'),
      api('/api/negocios/' + negocioActual.id + '/fotos'),
      api('/api/planes'),
    ]);
    contenido = contenidoData;
    nichoActual = estrategiaData;
    if (window.RubrofyDiseno) {
      window.RubrofyDiseno.iniciar({
        api,
        negocio: () => negocioActual,
        setNegocio: (n) => { negocioActual = n; },
        irA: irAVista,
        recargarContenido: async () => { contenido = await api('/api/negocios/' + negocioActual.id + '/contenido'); render(); },
      });
    }
    if (window.RubrofyVideos) {
      window.RubrofyVideos.iniciar({
        api,
        negocio: () => negocioActual,
        contenido: () => contenido,
        formatoDe,
        irAVista,
        recargar: async () => {
          negocioActual = await api('/api/me');
          contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
          render();
        },
      });
    }
    if (window.RubrofyBrief) {
      window.RubrofyBrief.iniciar({
        api,
        negocio: () => negocioActual,
        contenido: () => contenido,
        setContenido: (c) => { contenido = c; },
        irAVista,
        ayuda: (k) => (window.Ayuda ? window.Ayuda.boton(k) : ''),
        cerrarGenerar: () => $('#dlg-generar').close(),
        recargar: async () => {
          negocioActual = await api('/api/me');
          contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
          render();
        },
      });
    }
    if (window.RubrofyReels) {
      window.RubrofyReels.iniciar({
        api,
        negocio: () => negocioActual,
        recargar: async () => {
          negocioActual = await api('/api/me');
          contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
          render();
        },
      });
    }
    if (window.RubrofyGaleria) {
      window.RubrofyGaleria.iniciar({
        api,
        negocio: () => negocioActual,
        setNegocio: (n) => { negocioActual = n; },
        fotos: () => fotos,
        setFotos: (f) => { fotos = f; },
        subirFoto,
        borrarFoto,
        refrescar: async () => {
          negocioActual = await api('/api/me');
          contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
          render();
        },
      });
    }
    if (window.RubrofyRecargas) {
      window.RubrofyRecargas.iniciar({
        api,
        negocio: () => negocioActual,
        setNegocio: (n) => { negocioActual = n; },
        irA: irAVista,
        alCerrar: () => render(),
      });
      if (window.RubrofyCreditos) window.RubrofyCreditos.iniciar({
        api,
        negocio: () => negocioActual,
        setNegocio: (n) => { negocioActual = n; },
        irA: irAVista,
        alCerrar: () => refrescarNegocio().then(render).catch(() => render()),
      });
    }
    fotos = fotosData;
    planesInfo = planesData;
    editingIds.clear();
    if (window.RubrofyCalendario) window.RubrofyCalendario.reiniciar();
    actualizarSwitcher();
    $('#view-login').hidden = true;
    $('#view-app').hidden = false;
    vistaActual = 'inicio';
    // Enlaces de las notificaciones: /app#cola, /app#config…
    const destino = window.location.hash.slice(1);
    irAVista(VISTAS.includes(destino) || ALIAS_MARCA[destino] ? destino : 'inicio');
    if (destino) history.replaceState(null, '', window.location.pathname + window.location.search);
    const volvioDeOAuth = /[?&](google|instagram|meta)=/.test(window.location.search);
    avisarRetornoCorreo();
    avisarRetornoCheckout();
    avisarRetornoRecarga();
    avisarRetornoGoogle();
    avisarRetornoInstagram();
    avisarRetornoMeta();
    let yaPregunto = false;
    try { yaPregunto = sessionStorage.getItem('rubrofy-perfil-' + negocioActual.id) === '1'; sessionStorage.setItem('rubrofy-perfil-' + negocioActual.id, '1'); } catch (err) { yaPregunto = false; }
    if (!volvioDeOAuth && (!negocioActual.bienvenidaCompletada || (!negocioActual.perfilCompleto && !yaPregunto))) abrirBienvenida();
  }

  // Vuelta de "Conectar con Instagram": avisa si falló y abre Conexiones.
  function avisarRetornoInstagram() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('instagram');
    if (!r) return false;
    history.replaceState(null, '', '/app');
    if (r === 'error') alert(params.get('motivo') || 'No se pudo conectar Instagram.');
    irAVista(r === 'ok' ? 'inicio' : 'config');
    return true;
  }

  // Vuelta de "Conectar con Facebook" (Meta Ads y competencia).
  function avisarRetornoMeta() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('meta');
    if (!r) return;
    history.replaceState(null, '', '/app');
    if (r === 'error') alert(params.get('motivo') || 'No se pudo conectar con Meta.');
    const c = negocioActual.metaConexion;
    if (r === 'ok' && c && c.adAccountId) return irAVista('resultados', 'meta');
    irAVista('config', null, 'meta-card');
  }

  // Vuelta de "Iniciar sesión con Google": avisa el resultado y abre Configuración.
  function avisarRetornoGoogle() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('google');
    if (!r) return;
    history.replaceState(null, '', '/app');
    if (r === 'error') alert(params.get('motivo') || 'No se pudo conectar Google Ads.');
    if (r === 'sin-cuentas') alert('Esa cuenta de Google no tiene cuentas de Google Ads que Rubrofy pueda leer.');
    irAVista('config');
  }

  // Tras volver de Stripe Checkout (éxito o cancelado), refresca el negocio
  // por si el webhook ya actualizó el plan, avisa, y limpia la URL.
  // Vuelta de pagar una recarga: el webhook de Stripe la acredita en segundos.
  async function avisarRetornoRecarga() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('recarga');
    if (!r) return;
    history.replaceState(null, '', window.location.pathname);
    if (r !== 'exito') return;
    const antes = JSON.stringify(negocioActual.saldos || {});
    for (let i = 0; i < 10; i++) {
      negocioActual = await api('/api/me');
      if (JSON.stringify(negocioActual.saldos || {}) !== antes) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
    render();
    alert(JSON.stringify(negocioActual.saldos || {}) !== antes
      ? '¡Listo! Tu recarga ya está disponible.'
      : 'Recibimos tu pago. La recarga aparecerá en unos segundos: recarga la página si no la ves.');
  }

  async function avisarRetornoCheckout() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('brief')) { history.replaceState(null, '', window.location.pathname + window.location.hash); setTimeout(abrirGenerar, 400); }
    const resultado = params.get('checkout');
    if (!resultado) return;
    history.replaceState(null, '', window.location.pathname);
    if (resultado === 'tarjeta') { alert('No se pudo inscribir la tarjeta. Intenta de nuevo o usa otra tarjeta.'); return; }
    if (resultado === 'error') { alert('No pudimos confirmar tu suscripción. Recarga la página en unos minutos; si no se activa tu plan, escríbenos.'); return; }
    if (resultado === 'tarjeta-ok') { negocioActual = await api('/api/me'); render(); alert('Listo, tu tarjeta quedó registrada.'); return; }
    if (resultado !== 'exito') return;
    // El aviso del pago puede tardar unos segundos en activar el plan.
    for (let i = 0; i < 10; i++) {
      negocioActual = await api('/api/me');
      if (!negocioActual.sinPlan) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    render();
    if (negocioActual.sinPlan) {
      alert('Recibimos tu pago. Tu plan se activará en unos segundos: recarga la página si no lo ves.');
      return;
    }
    const plan = planesInfo.find((p) => p.id === negocioActual.plan) || {};
    // Recién suscrito después de la bienvenida: se crea la primera semana.
    if (negocioActual.bienvenidaCompletada && !contenido.length) {
      try {
        await generarSemana();
        irAVista('cola');
        alert(`¡Listo! Tu plan ${plan.nombre || ''} está activo y tu primera semana está en Por aprobar.`);
        return;
      } catch (err) { /* se genera después con el botón */ }
    }
    alert(`¡Listo! Tu plan ${plan.nombre || ''} está activo.`);
  }

  async function iniciarSesion(email, password) {
    negocioActual = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await mostrarApp();
  }

  async function cerrarSesion() {
    await api('/api/auth/logout', { method: 'POST' });
    mostrarLogin();
  }

  async function init() {
    $('#btn-instalar').addEventListener('click', () => window.RubrofyPWA.instalar());
    window.RubrofyPWA.mostrarBotonInstalar();
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn-login');
      btn.disabled = true;
      try {
        await iniciarSesion($('#login-email').value.trim(), $('#login-password').value);
      } catch (err) {
        mostrarLogin(err.status === 401 ? 'Email o clave incorrectos.'
          : err.status === 429 || err.status === 403 ? err.mensaje
          : 'No se pudo iniciar sesión.');
      } finally {
        btn.disabled = false;
      }
    });
    $('#btn-logout').addEventListener('click', () => {
      cerrarSesion().catch((err) => alert('No se pudo cerrar sesión: ' + err.message));
    });
    pintarGrupos();
    $('#rail-vincular').addEventListener('click', () => { if (negocioActual) irAVista('config', null, 'cfg-conexiones'); });
    document.querySelectorAll('.rail-grupo[data-grupo]').forEach((b) => b.addEventListener('click', () => alternarGrupo(b.dataset.grupo)));
    $('#view-marca').addEventListener('click', (e) => {
      const t = e.target.closest('[data-marca-tab]');
      if (!t) return;
      tabMarca = t.dataset.marcaTab;
      renderMarca();
    });
    $('#btn-logout-cuenta').addEventListener('click', () => {
      cerrarSesion().catch((err) => alert('No se pudo cerrar sesión: ' + err.message));
    });

    // Mi cuenta: desde el nombre del negocio (arriba), el plan del menú y
    // los enlaces "Plan y pagos" de Conexiones y ajustes.
    const irACuenta = () => { if (negocioActual) irAVista('cuenta'); };
    $('#switcher').addEventListener('click', irACuenta);
    $('#switcher').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irACuenta(); } });
    $('#rail-planactual').addEventListener('click', () => { if (negocioActual) irAVista('cuenta', null, 'cta-plan'); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-ir-cuenta]')) return;
      e.preventDefault();
      irAVista('cuenta', null, 'cta-plan');
    });

    // conexión con Meta (delegación: el contenido de la tarjeta se redibuja)
    $('#meta-card').addEventListener('click', (e) => { accionMeta(e).catch((err) => alert(err.mensaje || err.message)); });
    $('#meta-card').addEventListener('submit', conectarMeta);

    $('#google-card').addEventListener('click', (e) => { accionGoogle(e).catch((err) => alert(err.mensaje || err.message)); });
    $('#google-card').addEventListener('submit', elegirCuentaGoogle);

    // saldo de créditos ⚡ arriba: abre la compra
    $('#creditos-chip').addEventListener('click', () => window.RubrofyCreditos && window.RubrofyCreditos.abrirComprar());

    // pestañas de Resultados
    document.querySelectorAll('#resultados-pestanas [data-tab]').forEach((b) => b.addEventListener('click', () => {
      tabResultados = b.dataset.tab;
      marcarMenu();
      renderResultados();
      mostrarGuias();
    }));

    // navegación entre vistas
    document.querySelectorAll('.rail-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => irAVista(btn.dataset.view, btn.dataset.tab));
    });

    // Tablet y celular: el menú es solo íconos; "☰" lo despliega con los
    // nombres y se cierra al elegir una sección, al tocar fuera o con Esc.
    const menuDesplegado = (abrir) => {
      $('#view-app').classList.toggle('menu-abierto', abrir);
      $('#rail-abrir').setAttribute('aria-expanded', String(abrir));
      $('#rail-abrir').setAttribute('aria-label', abrir ? 'Cerrar el menú' : 'Ver los nombres del menú');
      if (abrir) $('.rail').scrollTop = 0;
    };
    $('#rail-abrir').addEventListener('click', () => menuDesplegado(!$('#view-app').classList.contains('menu-abierto')));
    $('#rail-velo').addEventListener('click', () => menuDesplegado(false));
    $('.rail').addEventListener('click', (e) => {
      if (e.target.closest('.rail-btn, .rail-avance, .rail-planactual')) menuDesplegado(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#view-app').classList.contains('menu-abierto')) { menuDesplegado(false); $('#rail-abrir').focus(); }
    });

    // fotos: subir y borrar (delegación)

    // conexión con Instagram
    $('#form-instagram').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      $('#ig-error').hidden = true;
      btn.disabled = true;
      try {
        negocioActual = await api(`/api/negocios/${negocioActual.id}/instagram`, {
          method: 'PUT',
          body: JSON.stringify({ userId: $('#ig-user-id').value.trim(), accessToken: $('#ig-token').value.trim() }),
        });
        renderConfig();
      } catch (err) {
        $('#ig-error').textContent = 'No se pudo conectar: revisa el ID y el token.';
        $('#ig-error').hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
    $('#guias-activas').addEventListener('change', (e) => { window.RubrofyGuias.activar(e.target.checked); renderGuiasAjustes(); });
    $('#btn-guias-reiniciar').addEventListener('click', () => { window.RubrofyGuias.reiniciar(); renderGuiasAjustes(); });
    $('#avisos-semanal').addEventListener('change', async (e) => {
      try {
        negocioActual = await api(`/api/negocios/${negocioActual.id}/avisos`, { method: 'PUT', body: JSON.stringify({ semanal: e.target.checked }) });
        renderAvisos();
      } catch (err) {
        e.target.checked = !e.target.checked;
        $('#avisos-error').textContent = err.mensaje || 'No se pudo guardar.';
        $('#avisos-error').hidden = false;
      }
    });
    $('#btn-avisos-prueba').addEventListener('click', async (e) => {
      const b = e.target;
      b.disabled = true;
      $('#avisos-error').hidden = true;
      $('#avisos-ok').hidden = true;
      try {
        const r = await api(`/api/negocios/${negocioActual.id}/avisos/prueba`, { method: 'POST' });
        $('#avisos-ok').textContent = 'Enviado a ' + r.para + '. Revisa también la carpeta de spam.';
        $('#avisos-ok').hidden = false;
      } catch (err) {
        $('#avisos-error').textContent = err.mensaje || 'No se pudo enviar.';
        $('#avisos-error').hidden = false;
      } finally {
        b.disabled = false;
      }
    });

    $('#btn-desconectar-ig').addEventListener('click', async () => {
      if (!confirm('¿Desconectar Instagram? Las próximas aprobaciones no se publicarán solas.')) return;
      negocioActual = await api(`/api/negocios/${negocioActual.id}/instagram`, { method: 'DELETE' });
      renderConfig();
    });

    // plan: subir de plan (Stripe Checkout) o gestionar la suscripción (Billing Portal)
    // Código de descuento: con suscripción vigente se aplica al tiro; si no,
    // se revisa y se usa al elegir el plan.
    $('#plan-card').addEventListener('submit', async (e) => {
      const form = e.target.closest('[data-codigo-form]');
      if (!form) return;
      e.preventDefault();
      const errorEl = $('#plan-error');
      errorEl.hidden = true;
      const codigo = form.codigo.value.trim();
      if (!codigo) return;
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        const r = await api(`/api/negocios/${negocioActual.id}/codigo`, { method: 'POST', body: JSON.stringify({ codigo }) });
        if (r.aplicado) {
          negocioActual = r.negocio;
          codigoDescuento = null;
          render();
          alert('Listo, el descuento quedó aplicado a tu suscripción.');
          return;
        }
        codigoDescuento = r;
        renderPlan();
      } catch (err) {
        errorEl.textContent = err.mensaje || 'No se pudo revisar el código.';
        errorEl.hidden = false;
        btn.disabled = false;
      }
    });

    $('#plan-card').addEventListener('click', async (e) => {
      if (e.target.closest('[data-abrir-prueba]')) return abrirPrueba();
      const per = e.target.closest('[data-periodo]');
      if (per) { periodoPlan = per.dataset.periodo; return renderPlan(); }
      const btnCheckout = e.target.closest('[data-checkout-plan]');
      if (btnCheckout) return pagarPlan(btnCheckout, $('#plan-error'));
      const btnFlow = e.target.closest('[data-action="flow-tarjeta"], [data-action="flow-cancelar"], [data-action="flow-reanudar"]');
      if (btnFlow) {
        let accion = btnFlow.dataset.action.replace('flow-', '');
        if (accion === 'cancelar') {
          // Antes de cancelar: pausar un mes sin cobro.
          const eleccion = await preguntarPausa();
          if (!eleccion) return;
          accion = eleccion;
        }
        if (accion === 'reanudar' && !confirm('¿Reanudar tu plan ahora? Si el período que pagaste todavía no termina, se reanuda justo cuando termine; si ya terminó, se cobra ahora con tu tarjeta.')) return;
        const errorEl = $('#plan-error');
        errorEl.hidden = true;
        btnFlow.disabled = true;
        try {
          const r = await api(`/api/negocios/${negocioActual.id}/suscripcion/${accion}`, { method: 'POST', body: accion === 'pausar' ? JSON.stringify({ meses: 1 }) : undefined });
          if (r.url) { window.location.href = r.url; return; }
          negocioActual = r.negocio;
          render();
        } catch (err) {
          errorEl.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.';
          errorEl.hidden = false;
          btnFlow.disabled = false;
        }
        return;
      }
      const btnPortal = e.target.closest('[data-action="portal"]');
      if (!btnPortal) return;
      const errorEl = $('#plan-error');
      errorEl.hidden = true;
      btnPortal.disabled = true;
      try {
        const resultado = await api(`/api/negocios/${negocioActual.id}/portal`, { method: 'POST' });
        if (resultado.url) window.location.href = resultado.url;
      } catch (err) {
        errorEl.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.';
        errorEl.hidden = false;
        btnPortal.disabled = false;
      }
    });

    // configuración: guardar cambios / eliminar negocio
    $('#form-config').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#config-error').hidden = true;
      $('#config-ok').hidden = true;
      try {
        await guardarConfig({
          nombre: $('#config-nombre').value,
          datos: {
            precioDesde: $('#config-precio').value,
            unidad: $('#config-unidad').value,
            promo: $('#config-promo').value,
            productoDestacado: $('#config-producto').value,
          },
          estiloImagen: $('#config-estilo-imagen').value,
        });
        $('#config-ok').hidden = false;
      } catch (err) {
        $('#config-error').textContent = err.message;
        $('#config-error').hidden = false;
      }
    });
    $('#btn-eliminar-negocio').addEventListener('click', () => {
      if (!negocioActual) return;
      const confirmado = confirm(`¿Eliminar "${negocioActual.nombre}"? Se borra tu cuenta, tu contenido, tus fotos y los créditos que te queden. Esta acción no se puede deshacer.`);
      if (confirmado) eliminarNegocioActual().catch((err) => alert('No se pudo eliminar: ' + err.message));
    });

    $('#btn-generar').addEventListener('click', abrirGenerar);
    $('#aviso-correo').addEventListener('click', async (e) => {
      const re = e.target.closest('[data-correo-reenviar]');
      if (re) {
        re.disabled = true;
        try {
          await api(`/api/negocios/${negocioActual.id}/cuenta/verificar`, { method: 'POST', body: '{}' });
          re.textContent = 'Enviado ✓ (revisa también spam)';
        } catch (err) { alert(err.mensaje || 'No se pudo enviar.'); re.disabled = false; }
        return;
      }
      if (e.target.closest('[data-correo-cambiar]')) {
        irAVista('cuenta', null, 'cta-perfil');
        if (window.RubrofyCuenta) window.RubrofyCuenta.abrirCambioCorreo();
      }
    });
    $('#aviso-plan').addEventListener('click', (e) => {
      if (e.target.closest('[data-ir-plan]')) return irAVista('cuenta', null, 'cta-plan');
      if (e.target.closest('[data-abrir-prueba]')) return abrirPrueba();
      if (e.target.closest('[data-recargar]')) return window.RubrofyRecargas.abrir('piezas');
      if (e.target.closest('[data-ocultar-pocas]')) {
        pocasOcultas = true;
        try { sessionStorage.setItem('rubrofy-pocas', '1'); } catch (err) { /* sin almacenamiento */ }
        return renderAvisoPlan();
      }
      const btn = e.target.closest('[data-checkout-plan]');
      if (btn) pagarPlan(btn, $('#aviso-plan [data-pago-error]'));
    });
    $('#dlg-generar-ok').addEventListener('click', generarMas);
    $('#dlg-generar-cancelar').addEventListener('click', () => $('#dlg-generar').close());
    $('#dlg-generar-plan').addEventListener('click', () => { $('#dlg-generar').close(); irAVista('estrategia'); });

    // delegación de eventos en la cola
    $('#cola-grid').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const accion = btn.dataset.action;

      if (accion === 'toggle-edit') {
        if (editingIds.has(id)) {
          const textarea = document.querySelector(`textarea[data-id="${id}"]`);
          const tags = document.querySelector(`input[data-hashtags-id="${id}"]`);
          await guardarEdicion(id, textarea ? textarea.value : '', tags ? tags.value : undefined);
        } else {
          editingIds.add(id);
          renderCola();
        }
        return;
      }
      if (accion === 'expandir') return btn.classList.toggle('abierta');
      if (accion === 'elegir-video') {
        const it = contenido.find((x) => x.id === id);
        if (it) window.RubrofyVideos.elegirParaReel(it);
        return;
      }
      if (accion === 'editar-reel') {
        const it = contenido.find((x) => x.id === id);
        if (it) window.RubrofyReels.abrir(it);
        return;
      }
      if (accion === 'elegir-foto') {
        const it = contenido.find((x) => x.id === id);
        if (it) window.RubrofyGaleria.abrirSelector(it, btn.dataset.pest);
        return;
      }
      if (accion === 'video-original') {
        btn.disabled = true;
        try { await api(`/api/negocios/${negocioActual.id}/contenido/${id}/video-original`, { method: 'POST' }); await refreshContenido(); }
        catch (err) { alert(err.mensaje || 'No se pudo volver al original.'); btn.disabled = false; }
        return;
      }
      if (accion === 'disenar') {
        const it = contenido.find((x) => x.id === id);
        if (it) window.RubrofyDiseno.abrirEditor(it, btn.dataset.foto, formatoDe(it));
        return;
      }
      if (accion === 'copiar') {
        // El mismo texto que se publica: la versión elegida más sus hashtags.
        const it = contenido.find((x) => x.id === id);
        if (!it) return;
        const base = it.variants[it.variantIndex] || '';
        const tags = (it.hashtags || []).filter((h) => !base.toLowerCase().includes(h.toLowerCase()));
        const texto = tags.length ? base + '\n\n' + tags.join(' ') : base;
        try {
          await navigator.clipboard.writeText(texto);
          btn.textContent = 'Copiado ✓';
        } catch (err) {
          prompt('Copia el texto:', texto);
        }
        return;
      }
      if (accion === 'approve') {
        btn.disabled = true; // la publicación en Instagram puede tardar unos segundos
        return accionConAviso('aprobar', id);
      }
      if (accion === 'reject') return accionConAviso('rechazar', id);
      if (accion === 'publish-now') {
        btn.disabled = true;
        return accionConAviso('publicar-ahora', id);
      }
      if (accion === 'retry') {
        btn.disabled = true;
        return accionConAviso('reintentar', id);
      }
      if (accion === 'quitar-video') {
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${id}/video`, { method: 'DELETE' });
          await refreshContenido();
        } catch (err) {
          alert(err.mensaje || 'No se pudo quitar el video.');
        }
        return;
      }
      if (accion === 'fecha') {
        fechaEditIds.add(id);
        renderCola();
        const input = document.querySelector(`input[data-fecha-id="${id}"]`);
        if (input) input.focus();
        return;
      }
      if (accion === 'undo') {
        const item = contenido.find((i) => i.id === id);
        if (item && item.instagram && item.instagram.ok) {
          const seguir = confirm('Esta pieza ya está publicada en Instagram. Deshacer la devuelve a pendiente en Rubrofy, pero NO la borra de Instagram (eso se hace desde la app de Instagram). Si la vuelves a aprobar, no se publicará de nuevo.');
          if (!seguir) return;
        }
        return accionConAviso('deshacer', id);
      }
      if (accion === 'regenerate') return accionConAviso('regenerar', id);
      if (accion === 'pedir' || accion === 'cancelar-pedir') {
        if (accion === 'pedir') pedirCambioIds.add(id); else pedirCambioIds.delete(id);
        renderCola();
        const input = document.querySelector(`form[data-pedir-id="${id}"] input`);
        if (input) input.focus();
        return;
      }
      if (accion === 'video-ia') {
        // Primero se elige calidad y duración (con su costo en créditos ⚡).
        const eleccion = window.RubrofyCreditos ? await window.RubrofyCreditos.elegir({ tipo: 'video' }) : { calidad: 'recomendada', segundos: 5 };
        if (!eleccion) return;
        const textoAntes = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Iniciando…';
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${id}/video-ia`, { method: 'POST', body: JSON.stringify(eleccion) });
          await refrescarNegocio();
          await refreshContenido();
        } catch (err) {
          if (!err.recargar) alert(err.mensaje || 'No se pudo iniciar el video con IA.');
          btn.disabled = false;
          btn.textContent = textoAntes;
        }
        return;
      }
      if (accion === 'imagen-otra') {
        btn.disabled = true;
        btn.textContent = 'Generando…';
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${id}/imagen`, { method: 'POST', body: JSON.stringify({ rehacer: true }) });
          await refreshContenido();
        } catch (err) {
          alert(err.mensaje || 'No se pudo generar otra imagen.');
          btn.disabled = false;
          btn.textContent = 'Otra foto con IA';
        }
        return;
      }
      if (accion === 'imagen') {
        const textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Generando...';
        try {
          await accionSimple('imagen', id);
        } catch (err) {
          alert(err.status === 400
            ? 'La generación de imágenes con IA no está configurada en este servidor.'
            : (err.mensaje || 'No se pudo generar la imagen con IA. Intenta de nuevo.'));
          btn.disabled = false;
          btn.textContent = textoOriginal;
        }
        return;
      }
    });

    // "Pedir cambio": otra versión con una indicación para la IA
    $('#cola-grid').addEventListener('submit', async (e) => {
      const form = e.target.closest('form[data-pedir-id]');
      if (!form) return;
      e.preventDefault();
      const id = form.dataset.pedirId;
      const boton = form.querySelector('.btn-approve');
      boton.disabled = true;
      boton.textContent = 'Escribiendo…';
      try {
        await api(`/api/negocios/${negocioActual.id}/contenido/${id}/regenerar`, { method: 'POST', body: JSON.stringify({ indicacion: form.indicacion.value }) });
        pedirCambioIds.delete(id);
        await refreshContenido();
      } catch (err) {
        alert(err.mensaje || 'No se pudo pedir el cambio.');
        boton.disabled = false;
        boton.textContent = 'Pedir';
      }
    });

    // cambio de fecha y hora de una pieza (selector abierto desde la tarjeta)
    $('#cola-grid').addEventListener('change', async (e) => {
      const selFormato = e.target.closest('select[data-formato-id]');
      if (selFormato) {
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${selFormato.dataset.formatoId}/formato`, {
            method: 'PUT',
            body: JSON.stringify({ formato: selFormato.value }),
          });
        } catch (err) {
          alert(err.mensaje || 'No se pudo cambiar el formato.');
        }
        await refreshContenido().catch(() => {});
        return;
      }
      const inputFoto = e.target.closest('input[data-foto-item]');
      if (inputFoto && inputFoto.files[0]) {
        const it = contenido.find((x) => x.id === inputFoto.dataset.fotoItem);
        const etiqueta = inputFoto.closest('label');
        if (etiqueta) etiqueta.firstChild.textContent = 'Subiendo foto…';
        try { if (it) await window.RubrofyGaleria.subirParaPieza(it, inputFoto.files[0]); } catch (err) { alert('No se pudo subir la foto: ' + (err.mensaje || err.message)); }
        await refreshContenido().catch(() => {});
        return;
      }
      if (await subirVideoDesde(e.target)) return;
      const input = e.target.closest('input[data-fecha-id]');
      if (!input || !input.value) return;
      const id = input.dataset.fechaId;
      try {
        await api(`/api/negocios/${negocioActual.id}/contenido/${id}/reprogramar`, {
          method: 'PUT',
          body: JSON.stringify({ fecha: input.value }),
        });
        fechaEditIds.delete(id);
        await refreshContenido();
      } catch (err) {
        alert(err.mensaje || 'No se pudo cambiar la fecha.');
      }
    });
    $('#cola-grid').addEventListener('focusout', (e) => {
      const input = e.target.closest('input[data-fecha-id]');
      if (!input) return;
      // Si se sale sin elegir una fecha nueva, se cierra el selector.
      setTimeout(() => {
        if (fechaEditIds.has(input.dataset.fechaId) && document.activeElement !== input) {
          fechaEditIds.delete(input.dataset.fechaId);
          renderCola();
        }
      }, 200);
    });

    // Mientras haya piezas programadas o publicándose, refresca la cola cada
    // 30 s para mostrar el resultado del publicador (sin pisar una edición).
    setInterval(async () => {
      if (!negocioActual || document.hidden) return;
      if (vistaActual !== 'cola' && vistaActual !== 'calendario') return;
      if (editingIds.size || fechaEditIds.size) return;
      const pendientes = contenido.some((i) => i.publicacion && ['programada', 'publicando'].includes(i.publicacion.estado));
      if (!pendientes) return;
      try { await refreshContenido(); } catch (err) { /* reintenta en la próxima vuelta */ }
    }, 30000);

    try {
      negocioActual = await api('/api/me');
      await mostrarApp();
    } catch (err) {
      mostrarLogin();
    }
  }

  init().catch((err) => {
    console.error(err);
    document.body.innerHTML = '<p style="color:#dd6a52; font-family:sans-serif; padding:24px;">Error cargando el panel: ' + escapeHtml(err.message) + '</p>';
  });
})();
