(function () {
  'use strict';

  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const MESES_LARGO = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  let negocioActual = null;
  let nichoActual = null; // estrategia de contenido del negocio actual (enfoques, categoriasFoto)
  let contenido = [];
  let fotos = {}; // { categoria: [nombresDeArchivo] }
  let planesInfo = []; // catálogo de planes (ver /api/planes) — precios y disponibilidad
  let vistaActual = 'inicio';
  let calSelectedId = null;
  const editingIds = new Set();
  const fechaEditIds = new Set(); // piezas con el selector de fecha abierto

  const $ = (sel) => document.querySelector(sel);

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
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    if (!res.ok) {
      // El servidor explica el motivo en { error } (cuota agotada, demasiados
      // intentos, etc.); se guarda aparte para mostrárselo al usuario.
      let mensaje = null;
      try {
        const data = await res.json();
        mensaje = data && typeof data.error === 'string' ? data.error : null;
      } catch (e) { /* respuesta sin JSON */ }
      const err = new Error(mensaje || ('Error de API (' + res.status + ') en ' + path));
      err.status = res.status;
      err.mensaje = mensaje;
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

  function parseItemDate(dateStr) {
    const [ddMes, hora] = dateStr.split(' - ');
    const [ddStr, mes] = ddMes.split(' ');
    return { day: parseInt(ddStr, 10), monthIndex: MESES.indexOf(mes), hora: hora };
  }

  // ---------- render: stats ----------
  function renderStats() {
    const pendientes = contenido.filter((i) => i.status === 'pendiente').length;
    const aprobados = contenido.filter((i) => i.status === 'aprobado').length;
    $('#stat-pendientes').textContent = pendientes;
    $('#stat-aprobados').textContent = aprobados;
    $('#stat-total').textContent = contenido.length;
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
      headers: { 'content-type': file.type || 'video/mp4', 'x-rubrofy-panel': '1' },
      body: file,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo subir el video');
    }
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

    const fotoNombre = item.categoriaFoto ? pickFotoFilename(item.categoriaFoto, item.id) : null;
    const fotoUrl = fotoNombre
      ? `/fotos/${negocioActual.id}/${item.categoriaFoto}/${fotoNombre}`
      : (item.imagenIA ? `/fotos/${negocioActual.id}/_ia/${item.id}.png` : null);
    const canvasW = 480;
    const canvasH = isPost ? 600 : 854;

    return `
      <div class="card">
        <div class="card-media ${isPost ? 'post' : 'historia'}" ${fotoUrl ? '' : `style="background:linear-gradient(160deg, ${item.hueFrom}, ${item.hueTo})"`}>
          ${fotoUrl
            ? `<canvas class="card-canvas" width="${canvasW}" height="${canvasH}" data-src="${escapeHtml(fotoUrl)}" data-headline="${escapeHtml(item.headline)}" data-inicial="${inicial}"></canvas>`
            : `<div class="card-texture"></div><div class="card-logo">${inicial}</div><div class="card-headline">${escapeHtml(item.headline)}</div>`}
          <div class="card-network"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f3ede1" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6" fill="#f3ede1" stroke="none"/></svg></div>
          <div class="card-status"><span class="dot" style="background:${meta.color}"></span><span class="label" style="color:#f3ede1">${meta.label}</span></div>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="card-tag">${escapeHtml(item.tag)}</span>
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
              ${conVideo ? (item.video
                ? `<span class="card-video-ok">Video cargado (${(item.video.bytes / 1048576).toFixed(1)} MB)</span><button class="btn-text" data-action="quitar-video" data-id="${item.id}">Quitar</button>`
                : `<label class="btn-text card-video-subir">${formato === 'reel' ? 'Subir video (obligatorio)' : 'Subir video (opcional)'}<input type="file" accept="video/mp4,video/quicktime" data-video-id="${item.id}" hidden></label>`) : ''}
              ${formato === 'carrusel' ? `<span class="card-video-ok">${Math.min((fotos[item.categoriaFoto] || []).length, 10)} fotos de "${escapeHtml(item.categoriaFoto || '')}"</span>` : ''}
            </div>` : ''}
          ${isEditing
            ? `<textarea class="card-textarea" data-id="${item.id}">${escapeHtml(caption)}</textarea>`
            : `<p class="card-caption">${escapeHtml(caption)}</p>`}
          ${item.idea && !publicada ? `<p class="card-idea"><b>Idea:</b> ${escapeHtml(item.idea)}</p>` : ''}
          ${!publicada && item.alertas && item.alertas.length ? `<ul class="card-alertas" aria-label="Qué verificar">${item.alertas.map((a) => `<li class="alerta-${escapeHtml(a.tipo)}"><span aria-hidden="true">⚠</span> ${escapeHtml(a.texto)}</li>`).join('')}</ul>` : ''}
          ${isPending ? `
            <div class="card-actions">
              <button class="btn-approve" data-action="approve" data-id="${item.id}">Aprobar</button>
              <button class="btn-ghost" data-action="regenerate" data-id="${item.id}">Otra versión</button>
              ${!fotoUrl ? `<button class="btn-ghost" data-action="imagen" data-id="${item.id}">Generar foto con IA</button>` : ''}
              <button class="btn-text" data-action="toggle-edit" data-id="${item.id}">${isEditing ? 'Guardar' : 'Editar'}</button>
              <button class="btn-x" data-action="reject" data-id="${item.id}" title="Rechazar">&times;</button>
            </div>
          ` : `
            <div class="card-note">
              <span class="note-text" style="color:${notaAprobacion(item).color}">${notaAprobacion(item).texto}</span>
              <span class="note-actions">
                ${pub && pub.estado === 'programada' && !publicada && negocioActual.instagramEstado === 'ok' ? `<button data-action="publish-now" data-id="${item.id}">Publicar ahora</button>` : ''}
                ${pub && pub.estado === 'fallida' ? `<button data-action="retry" data-id="${item.id}">Reintentar</button>` : ''}
                ${publicando ? '' : `<button data-action="undo" data-id="${item.id}">Deshacer</button>`}
              </span>
            </div>
          `}
        </div>
      </div>
    `;
  }

  function renderCola() {
    const grid = $('#cola-grid');
    if (!contenido.length) {
      grid.innerHTML = '<p class="empty-state">Sin contenido todavía. Usa "Generar más contenido" para crear el primer lote.</p>';
      return;
    }
    grid.innerHTML = contenido.map(cardHTML).join('');
    grid.querySelectorAll('.card-canvas').forEach(drawCardCanvas);
  }

  // ---------- render: calendario ----------
  function startOfWeekMonday(date) {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const d = new Date(date);
    d.setDate(d.getDate() + diff);
    return d;
  }

  function buildCalendarDays(year, month) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const start = startOfWeekMonday(first);
    const lastWeekStart = startOfWeekMonday(last);
    const end = new Date(lastWeekStart);
    end.setDate(end.getDate() + 6);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dd = new Date(d);
      days.push({ date: dd, inMonth: dd.getMonth() === month, isToday: dd.getTime() === today.getTime() });
    }
    return days;
  }

  function renderCalDetail() {
    const detail = $('#cal-detail');
    const item = contenido.find((it) => it.id === calSelectedId);
    if (!item) {
      detail.innerHTML = '<span class="kicker">Detalle</span><p class="empty">Selecciona una publicación del calendario para ver su detalle.</p>';
      return;
    }
    const meta = statusMeta(item.status);
    const p = parseItemDate(item.date);
    detail.innerHTML = `
      <span class="kicker">Detalle</span>
      <div class="row"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:${meta.color}"></span><span style="font-family:'JetBrains Mono',monospace;font-size:11.5px;">${meta.label}</span></div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-faint);">${p.day} ${MESES[p.monthIndex]} &middot; ${p.hora}</span>
      <span class="tagpill">${escapeHtml(item.tag)}</span>
      <p class="detail-text">${escapeHtml(item.variants[item.variantIndex])}</p>
    `;
  }

  function renderCalendario() {
    const now = new Date();
    $('#cal-month').textContent = MESES_LARGO[now.getMonth()] + ' ' + now.getFullYear();

    const days = buildCalendarDays(now.getFullYear(), now.getMonth());
    const grid = $('#cal-grid');
    grid.innerHTML = '';

    days.forEach((day) => {
      const cellItems = contenido.filter((it) => {
        const p = parseItemDate(it.date);
        return p.monthIndex === day.date.getMonth() && p.day === day.date.getDate();
      });

      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (day.inMonth ? '' : ' out') + (day.isToday ? ' today' : '');

      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(day.date.getDate());
      cell.appendChild(num);

      cellItems.forEach((it) => {
        const meta = statusMeta(it.status);
        const p = parseItemDate(it.date);
        const chip = document.createElement('div');
        chip.className = 'cal-chip' + (it.id === calSelectedId ? ' selected' : '');
        chip.dataset.id = it.id;
        chip.innerHTML = `<span class="dot" style="background:${meta.color}"></span><span class="txt">${p.hora} ${escapeHtml(it.tag)}</span>`;
        cell.appendChild(chip);
      });

      grid.appendChild(cell);
    });

    renderCalDetail();
  }

  // ---------- render: fotos ----------
  function fotoCategoriaHTML(categoria) {
    const archivos = fotos[categoria] || [];
    const thumbs = archivos.map((archivo) => `
      <div class="foto-thumb">
        <img src="/fotos/${negocioActual.id}/${categoria}/${archivo}" alt="">
        <button data-borrar-categoria="${categoria}" data-borrar-archivo="${archivo}" title="Eliminar">&times;</button>
      </div>
    `).join('');

    return `
      <div class="foto-cat">
        <h2>${escapeHtml(categoria)}</h2>
        <p class="foto-cat-sub">${archivos.length} foto${archivos.length === 1 ? '' : 's'}</p>
        <div class="foto-strip">
          ${thumbs}
          <label class="foto-add">
            <span>+ Subir</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" data-subir-categoria="${categoria}">
          </label>
        </div>
      </div>
    `;
  }

  function renderFotos() {
    const cont = $('#fotos-categorias');
    if (!nichoActual) { cont.innerHTML = ''; return; }
    cont.innerHTML = nichoActual.categoriasFoto.map(fotoCategoriaHTML).join('');
  }

  function renderConfig() {
    if (!negocioActual) return;
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
    $('#ig-manual').hidden = !necesitaConectar;
    $('#ig-manual').open = !login;
    $('#ig-manual-titulo').hidden = !login;
    $('#ig-cuenta').hidden = !(conectado && negocioActual.instagramUsuario);
    $('#ig-cuenta').textContent = negocioActual.instagramUsuario ? 'Cuenta: @' + negocioActual.instagramUsuario : '';

    renderAvisos();

    renderPlan();
    renderMeta();
    renderGoogle();
  }

  // Google Ads: se conecta con "Iniciar sesión con Google" (redirige a
  // Google y vuelve a /app?google=...), luego se elige la cuenta.
  function renderGoogle() {
    const cont = $('#google-card');
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    const g = negocioActual.googleConexion;
    const cabecera = `<div class="ig-card-head"><h2>Conexión con Google Ads</h2>
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
    const cabecera = `<div class="ig-card-head"><h2>Conexión con Meta (Ads y competencia)</h2>
      <span class="ig-estado ${c ? (c.estado === 'reconectar' ? 'reconectar' : 'conectado') : ''}">${c ? (c.estado === 'reconectar' ? 'Reconectar' : 'Conectado') : 'Sin conectar'}</span></div>`;
    if (!plan.ads && !plan.competencia) {
      cont.innerHTML = cabecera + '<p class="sub">Para ver tu publicidad en Meta y seguir a tu competencia. Disponible en el plan Estudio.</p>';
      return;
    }
    if (c && c.estado !== 'reconectar') {
      cont.innerHTML = cabecera + `
        <p class="sub">${c.cuentaNombre ? `Cuenta publicitaria: <b>${escapeHtml(c.cuentaNombre)}</b> (${escapeHtml(c.moneda || '')})` : 'Sin cuenta publicitaria'}<br>
        ${c.igUsername ? `Instagram para competencia: <b>@${escapeHtml(c.igUsername)}</b>` : 'Sin cuenta de Instagram para competencia'}
        ${c.venceEl ? `<br>El token vence el ${fechaCorta(c.venceEl)}.` : ''}</p>
        <button type="button" class="btn-danger" data-meta="desconectar">Desconectar Meta</button>`;
    } else {
      cont.innerHTML = cabecera + `
        <p class="sub">Pega un token de Meta con los permisos <code>ads_read</code>, <code>pages_show_list</code>, <code>pages_read_engagement</code> e <code>instagram_basic</code>. Lo más cómodo es un token de "usuario del sistema" de tu Business Manager, que no vence.</p>
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
    }
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
    try {
      negocioActual = await api(`/api/negocios/${negocioActual.id}/meta`, {
        method: 'PUT',
        body: JSON.stringify({ accessToken: form.token.value, adAccountId: form.adAccountId.value || null, igUserId: form.igUserId.value || null }),
      });
      renderMeta();
    } catch (err) {
      const error = $('#meta-card [data-meta="error"]');
      error.textContent = err.mensaje || 'No se pudo conectar.';
      error.hidden = false;
    }
  }

  function renderAvisos() {
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

  function renderPlan() {
    const cont = $('#plan-card');
    if (!cont || !negocioActual) return;
    const planActualId = negocioActual.plan || 'gratis';
    const indiceActual = planesInfo.findIndex((p) => p.id === planActualId);

    const filas = planesInfo.map((p, i) => {
      const esActual = p.id === planActualId;
      let boton = '';
      if (esActual) {
        boton = '<span class="ig-estado conectado">Plan actual</span>';
      } else if (i < indiceActual) {
        // Bajar de plan se hace desde "Gestionar suscripción" (Billing Portal), no con un checkout nuevo.
        boton = '';
      } else if (!p.disponible) {
        boton = '<button type="button" class="btn-ghost" disabled title="Todavía no configurado">Próximamente</button>';
      } else {
        boton = `<button type="button" class="btn-approve" data-checkout-plan="${p.id}">Actualizar a ${escapeHtml(p.nombre)}</button>`;
      }
      const detalle = p.usaIA
        ? (p.cuotaFotosIA ? `Texto con IA + ${p.cuotaFotosIA} fotos con IA/mes` : 'Texto con IA')
        : 'Plantillas, sin IA';
      return `
        <div class="plan-row${esActual ? ' plan-row-actual' : ''}">
          <div>
            <strong>${escapeHtml(p.nombre)}</strong>
            <span class="sub">${detalle} · ${formatoCLP(p.precioClp)}</span>
          </div>
          ${boton}
        </div>
      `;
    }).join('');

    const cuota = planesInfo.find((p) => p.id === planActualId);
    const usoTextos = cuota && cuota.cuotaTextosIA
      ? `<p class="sub">Piezas con IA disponibles este mes: ${negocioActual.textosIADisponibles} de ${cuota.cuotaTextosIA}.</p>`
      : '';
    const usoFotos = cuota && cuota.cuotaFotosIA
      ? `<p class="sub">Fotos con IA disponibles este mes: ${negocioActual.fotosIADisponibles} de ${cuota.cuotaFotosIA}.</p>`
      : '';

    cont.innerHTML = `
      <div class="ig-card-head"><h2>Plan</h2></div>
      ${filas}
      ${usoTextos}
      ${usoFotos}
      <p class="config-error" id="plan-error" hidden></p>
      ${negocioActual.tieneSuscripcionStripe ? '<button type="button" class="btn-ghost" data-action="portal">Gestionar suscripción</button>' : ''}
    `;
  }

  // Resultados tiene pestañas: Instagram, Meta Ads, Google Ads y Competencia.
  let tabResultados = 'instagram';
  function renderResultados() {
    document.querySelectorAll('#resultados-pestanas [data-tab]').forEach((b) => b.classList.toggle('activa', b.dataset.tab === tabResultados));
    const ctx = { api, negocio: negocioActual, planes: planesInfo, irA: irAVista };
    const cont = $('#resultados');
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    if (tabResultados === 'instagram') return window.RubrofyResultados.render(cont, ctx);
    const clave = tabResultados === 'competencia' ? 'competencia' : 'ads';
    if (!plan[clave]) {
      cont.innerHTML = `<div class="res-aviso">${tabResultados === 'competencia'
        ? 'Sigue a tus competidores en Instagram (seguidores, frecuencia e interacción) y compáralos contigo.'
        : 'Ve tu inversión en publicidad, los resultados y el costo de cada uno junto a tu Instagram.'} Está disponible en el plan <b>Estudio</b>. <button class="btn-approve estilo-btn" data-ir="config">Ver planes</button></div>`;
      cont.querySelector('[data-ir]').addEventListener('click', () => irAVista('config'));
      return;
    }
    if (tabResultados === 'competencia') return window.RubrofyCompetencia && window.RubrofyCompetencia.render(cont, ctx);
    return window.RubrofyAds.render(cont, ctx, tabResultados);
  }

  const VISTAS = ['inicio', 'estrategia', 'cola', 'calendario', 'fotos', 'estilo', 'resultados', 'config'];

  // El menú lateral tiene entradas que abren Resultados en una pestaña
  // (Publicidad, Competencia): la marcada es la que coincide en vista y pestaña.
  function marcarMenu() {
    document.querySelectorAll('.rail-btn[data-view]').forEach((b) => b.classList.toggle('active',
      b.dataset.view === vistaActual && (!b.dataset.tab || vistaActual !== 'resultados' || b.dataset.tab === tabMenu())));
  }
  function tabMenu() { return tabResultados === 'google' ? 'meta' : tabResultados; }

  // ancla: id de una sección dentro de la vista (ej: 'cfg-plan').
  function irAVista(vista, tab, ancla) {
    vistaActual = vista;
    if (tab) tabResultados = tab;
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
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    document.querySelectorAll('[data-plan-req]').forEach((el) => { el.hidden = !!plan[el.dataset.planReq] || !planesInfo.length; });
    const actual = $('#rail-planactual');
    actual.hidden = !plan.nombre;
    actual.innerHTML = plan.nombre ? `Plan <b>${escapeHtml(plan.nombre)}</b>` : '';
  }

  function render() {
    renderStats();
    renderMenu();
    if (vistaActual === 'cola') renderCola();
    else if (vistaActual === 'calendario') renderCalendario();
    else if (vistaActual === 'fotos') renderFotos();
    else if (vistaActual === 'config') renderConfig();
    else if (vistaActual === 'estilo') {
      window.RubrofyEstilo.render($('#estilo'), { api, negocio: negocioActual });
    }
    else if (vistaActual === 'resultados') renderResultados();
    else if (vistaActual === 'inicio') window.RubrofyInicio.render($('#inicio'), ctxPanel()).catch(() => {});
    else if (vistaActual === 'estrategia') window.RubrofyPlan.renderVista($('#estrategia'), ctxPanel()).catch(() => {});
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
      fechaCorta,
      irA: irAVista,
      abrirBienvenida,
      abrirGenerar,
      guardarDatos: (datos) => guardarConfig({ nombre: negocioActual.nombre, datos, estiloImagen: negocioActual.estiloImagen }),
      setNegocio: (n) => { negocioActual = n; actualizarSwitcher(); },
      setEstrategia: (e) => { nichoActual = e; negocioActual.estrategia = e; },
    };
  }

  // Bienvenida: se abre sola mientras el negocio no la termine.
  function abrirBienvenida() {
    const base = ctxPanel();
    window.RubrofyBienvenida.abrir(Object.assign({}, base, {
      negocio: () => negocioActual,
      estrategia: () => nichoActual,
      generarSemana: () => generarSemana(),
      alTerminar: (generado) => { window.RubrofyInicio.invalidar(); irAVista(generado ? 'cola' : 'inicio'); },
    })).catch(() => {});
  }

  // "Generar semana": muestra qué se va a crear según el plan y lo genera.
  function abrirGenerar() {
    const dlg = $('#dlg-generar');
    const pc = negocioActual.planContenido;
    const total = pc ? Object.values(pc.semanal).reduce((a, b) => a + b, 0) : 6;
    $('#dlg-generar-texto').innerHTML = pc
      ? window.RubrofyPlan.textoTotal(pc.semanal) + (total > 12 ? '. Se crean 12 por vez: vuelve a generar para completar la semana.' : '.')
      : 'Se crearán 6 publicaciones. Define tu plan en <b>Estrategia</b> para elegir cuántos posts, carruseles, reels e historias quieres.';
    $('#dlg-generar-fechas').textContent = 'Siguen después de lo que ya tienes programado y llegan a Por aprobar.';
    $('#dlg-generar-error').hidden = true;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  async function generarSemana() {
    contenido = await api(`/api/negocios/${negocioActual.id}/generar`, {
      method: 'POST',
      body: JSON.stringify(negocioActual.planContenido ? { segunPlan: true } : { cantidad: 6 }),
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

  async function subirFoto(categoria, file) {
    const dataBase64 = await leerArchivoComoBase64(file);
    fotos = await api(`/api/negocios/${negocioActual.id}/fotos`, {
      method: 'POST',
      body: JSON.stringify({ categoria, filename: file.name, dataBase64 }),
    });
    renderFotos();
  }

  async function borrarFoto(categoria, archivo) {
    fotos = await api(`/api/negocios/${negocioActual.id}/fotos/${categoria}/${archivo}`, { method: 'DELETE' });
    renderFotos();
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

  async function guardarEdicion(id, caption) {
    await api(`/api/negocios/${negocioActual.id}/contenido/${id}/editar`, {
      method: 'PUT',
      body: JSON.stringify({ caption: caption }),
    });
    editingIds.delete(id);
    await refreshContenido();
  }

  async function generarMas() {
    const btn = $('#dlg-generar-ok');
    const btnTop = $('#btn-generar');
    btn.disabled = true; btnTop.disabled = true;
    btn.textContent = 'Generando…';
    try {
      await generarSemana();
      $('#dlg-generar').close();
      irAVista('cola');
    } catch (err) {
      $('#dlg-generar-error').textContent = err.mensaje || 'No se pudo generar contenido. Intenta de nuevo.';
      $('#dlg-generar-error').hidden = false;
    } finally {
      btn.disabled = false; btnTop.disabled = false;
      btn.textContent = 'Generar';
    }
  }

  // ---------- login / sesión ----------
  function mostrarLogin(mensaje) {
    negocioActual = null;
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
    fotos = fotosData;
    planesInfo = planesData;
    editingIds.clear();
    calSelectedId = null;
    actualizarSwitcher();
    $('#view-login').hidden = true;
    $('#view-app').hidden = false;
    vistaActual = 'inicio';
    irAVista('inicio');
    const volvioDeOAuth = /[?&](google|instagram)=/.test(window.location.search);
    avisarRetornoCheckout();
    avisarRetornoGoogle();
    avisarRetornoInstagram();
    if (!negocioActual.bienvenidaCompletada && !volvioDeOAuth) abrirBienvenida();
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
  async function avisarRetornoCheckout() {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get('checkout');
    if (!resultado) return;
    history.replaceState(null, '', window.location.pathname);
    if (resultado === 'exito') {
      negocioActual = await api('/api/me');
      render();
      alert('¡Listo! Tu plan es ' + (negocioActual.plan || 'gratis') + '.');
    }
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
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn-login');
      btn.disabled = true;
      try {
        await iniciarSesion($('#login-email').value.trim(), $('#login-password').value);
      } catch (err) {
        mostrarLogin(err.status === 401 ? 'Email o clave incorrectos.'
          : err.status === 429 ? err.mensaje
          : 'No se pudo iniciar sesión.');
      } finally {
        btn.disabled = false;
      }
    });
    $('#btn-logout').addEventListener('click', () => {
      cerrarSesion().catch((err) => alert('No se pudo cerrar sesión: ' + err.message));
    });

    // conexión con Meta (delegación: el contenido de la tarjeta se redibuja)
    $('#meta-card').addEventListener('click', (e) => { accionMeta(e).catch((err) => alert(err.mensaje || err.message)); });
    $('#meta-card').addEventListener('submit', conectarMeta);

    $('#google-card').addEventListener('click', (e) => { accionGoogle(e).catch((err) => alert(err.mensaje || err.message)); });
    $('#google-card').addEventListener('submit', elegirCuentaGoogle);

    // pestañas de Resultados
    document.querySelectorAll('#resultados-pestanas [data-tab]').forEach((b) => b.addEventListener('click', () => {
      tabResultados = b.dataset.tab;
      marcarMenu();
      renderResultados();
    }));

    // navegación entre vistas
    document.querySelectorAll('.rail-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => irAVista(btn.dataset.view, btn.dataset.tab));
    });

    // fotos: subir y borrar (delegación)
    $('#fotos-categorias').addEventListener('change', (e) => {
      const input = e.target.closest('input[data-subir-categoria]');
      if (!input || !input.files[0]) return;
      const categoria = input.dataset.subirCategoria;
      subirFoto(categoria, input.files[0]).catch((err) => alert('No se pudo subir la foto: ' + err.message));
    });
    $('#fotos-categorias').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-borrar-categoria]');
      if (!btn) return;
      borrarFoto(btn.dataset.borrarCategoria, btn.dataset.borrarArchivo).catch((err) => alert('No se pudo borrar: ' + err.message));
    });

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
    $('#plan-card').addEventListener('click', async (e) => {
      const btnCheckout = e.target.closest('[data-checkout-plan]');
      const btnPortal = e.target.closest('[data-action="portal"]');
      if (!btnCheckout && !btnPortal) return;
      const btn = btnCheckout || btnPortal;
      const errorEl = $('#plan-error');

      // Con una suscripción activa, subir de plan cambia esa misma
      // suscripción (no abre un pago nuevo): se avisa antes del cobro.
      if (btnCheckout && negocioActual.tieneSuscripcionStripe) {
        const destino = planesInfo.find((p) => p.id === btnCheckout.dataset.checkoutPlan);
        const seguir = confirm(`Tu suscripción pasará a ${destino ? destino.nombre : 'el nuevo plan'} ahora mismo. La diferencia proporcional a los días que quedan se cobra en tu próxima factura.`);
        if (!seguir) return;
      }

      errorEl.hidden = true;
      btn.disabled = true;
      try {
        const resultado = btnCheckout
          ? await api(`/api/negocios/${negocioActual.id}/checkout`, { method: 'POST', body: JSON.stringify({ plan: btnCheckout.dataset.checkoutPlan }) })
          : await api(`/api/negocios/${negocioActual.id}/portal`, { method: 'POST' });
        if (resultado.url) {
          window.location.href = resultado.url;
          return;
        }
        // Cambio de plan sobre la suscripción existente: no hay página de pago.
        negocioActual = resultado.negocio;
        renderPlan();
      } catch (err) {
        errorEl.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.';
        errorEl.hidden = false;
        btn.disabled = false;
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
      const confirmado = confirm(`¿Eliminar "${negocioActual.nombre}"? Se borra tu cuenta, tu contenido y tus fotos. Esta acción no se puede deshacer.`);
      if (confirmado) eliminarNegocioActual().catch((err) => alert('No se pudo eliminar: ' + err.message));
    });

    $('#btn-generar').addEventListener('click', abrirGenerar);
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
          await guardarEdicion(id, textarea ? textarea.value : '');
        } else {
          editingIds.add(id);
          renderCola();
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
      const inputVideo = e.target.closest('input[data-video-id]');
      if (inputVideo && inputVideo.files[0]) {
        const etiqueta = inputVideo.closest('label');
        if (etiqueta) etiqueta.firstChild.textContent = 'Subiendo video…';
        try {
          await subirVideo(inputVideo.dataset.videoId, inputVideo.files[0]);
        } catch (err) {
          alert(err.message);
        }
        await refreshContenido().catch(() => {});
        return;
      }
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

    // delegación de eventos en el calendario
    $('#cal-grid').addEventListener('click', (e) => {
      const chip = e.target.closest('.cal-chip');
      if (!chip) return;
      calSelectedId = chip.dataset.id;
      renderCalendario();
    });

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
