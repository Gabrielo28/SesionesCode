(function () {
  'use strict';

  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const MESES_LARGO = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  let nichosMap = {};
  let negocios = [];
  let negocioActual = null;
  let nichoActual = null; // plantilla completa del nicho del negocio actual (enfoques, categoriasFoto)
  let contenido = [];
  let fotos = {}; // { categoria: [nombresDeArchivo] }
  let vistaActual = 'cola';
  let calSelectedId = null;
  const editingIds = new Set();

  const $ = (sel) => document.querySelector(sel);

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function api(path, opts) {
    const res = await fetch(path, Object.assign({ headers: { 'content-type': 'application/json' } }, opts));
    if (!res.ok) throw new Error('Error de API (' + res.status + ') en ' + path);
    return res.json();
  }

  function statusMeta(status) {
    if (status === 'aprobado') return { color: 'var(--green)', label: 'Aprobado' };
    if (status === 'rechazado') return { color: 'var(--coral)', label: 'Rechazado' };
    return { color: 'var(--amber)', label: 'Pendiente' };
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
  function pickFotoFilename(categoria) {
    const arr = fotos[categoria];
    return arr && arr.length ? arr[0] : null;
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
      ctx.font = '700 15px "Instrument Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(inicial, 30, 31);

      ctx.fillStyle = '#f8f4ea';
      ctx.font = '700 26px "Instrument Sans", sans-serif';
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

  function cardHTML(item) {
    const meta = statusMeta(item.status);
    const caption = item.variants[item.variantIndex];
    const isPost = item.aspect.trim().startsWith('4');
    const isPending = item.status === 'pendiente';
    const isEditing = editingIds.has(item.id);
    const dateShort = item.date.split(' - ').slice(0, 2).join(' - ');
    const inicial = escapeHtml((negocioActual.nombre || '?').charAt(0).toUpperCase());

    const fotoNombre = item.categoriaFoto ? pickFotoFilename(item.categoriaFoto) : null;
    const fotoUrl = fotoNombre ? `/fotos/${negocioActual.id}/${item.categoriaFoto}/${fotoNombre}` : null;
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
            <span class="card-date">${escapeHtml(item.date)}</span>
          </div>
          ${isEditing
            ? `<textarea class="card-textarea" data-id="${item.id}">${escapeHtml(caption)}</textarea>`
            : `<p class="card-caption">${escapeHtml(caption)}</p>`}
          ${isPending ? `
            <div class="card-actions">
              <button class="btn-approve" data-action="approve" data-id="${item.id}">Aprobar</button>
              <button class="btn-ghost" data-action="regenerate" data-id="${item.id}">Otra versión</button>
              <button class="btn-text" data-action="toggle-edit" data-id="${item.id}">${isEditing ? 'Guardar' : 'Editar'}</button>
              <button class="btn-x" data-action="reject" data-id="${item.id}" title="Rechazar">&times;</button>
            </div>
          ` : `
            <div class="card-note">
              <span class="note-text" style="color:${meta.color}">${item.status === 'aprobado' ? 'Se publica automático &middot; ' + escapeHtml(dateShort) : 'No se publicará'}</span>
              <button data-action="undo" data-id="${item.id}">Deshacer</button>
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

  function render() {
    renderStats();
    if (vistaActual === 'cola') renderCola();
    else if (vistaActual === 'calendario') renderCalendario();
    else if (vistaActual === 'fotos') renderFotos();
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

  // ---------- acciones ----------
  async function refreshContenido() {
    contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
    render();
  }

  async function accionSimple(accion, id) {
    await api(`/api/negocios/${negocioActual.id}/contenido/${id}/${accion}`, { method: 'POST' });
    await refreshContenido();
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
    const btn = $('#btn-generar');
    btn.disabled = true;
    btn.textContent = 'Generando...';
    try {
      contenido = await api(`/api/negocios/${negocioActual.id}/generar`, {
        method: 'POST',
        body: JSON.stringify({ cantidad: 6 }),
      });
      render();
    } finally {
      btn.disabled = false;
      btn.textContent = '+ Generar más contenido';
    }
  }

  // ---------- negocio / init ----------
  async function loadNegocio(id) {
    negocioActual = await api('/api/negocios/' + id);
    const [contenidoData, nichoData, fotosData] = await Promise.all([
      api('/api/negocios/' + id + '/contenido'),
      api('/api/negocios/' + id + '/nicho'),
      api('/api/negocios/' + id + '/fotos'),
    ]);
    contenido = contenidoData;
    nichoActual = nichoData;
    fotos = fotosData;
    editingIds.clear();
    calSelectedId = null;
    $('#negocio-select').value = id;
    $('#switcher-badge').textContent = (negocioActual.nombre || '??').slice(0, 2).toUpperCase();
    $('#switcher-niche').textContent = (nichosMap[negocioActual.nicho] || negocioActual.nicho).toUpperCase();
    render();
  }

  async function crearNegocio(datos) {
    const nuevo = await api('/api/negocios', { method: 'POST', body: JSON.stringify(datos) });
    negocios = await api('/api/negocios');
    $('#negocio-select').innerHTML = negocios.map((n) => `<option value="${n.id}">${escapeHtml(n.nombre)}</option>`).join('');
    await loadNegocio(nuevo.id);
  }

  async function init() {
    const [nichos, listaNegocios] = await Promise.all([api('/api/nichos'), api('/api/negocios')]);
    nichosMap = Object.fromEntries(nichos.map((n) => [n.id, n.nombre]));
    negocios = listaNegocios;

    const select = $('#negocio-select');
    select.innerHTML = negocios.map((n) => `<option value="${n.id}">${escapeHtml(n.nombre)}</option>`).join('');
    select.addEventListener('change', () => loadNegocio(select.value));

    if (negocios.length) await loadNegocio(negocios[0].id);

    // navegación entre vistas
    document.querySelectorAll('.rail-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.rail-btn[data-view]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        vistaActual = btn.dataset.view;
        $('#view-cola').hidden = vistaActual !== 'cola';
        $('#view-calendario').hidden = vistaActual !== 'calendario';
        $('#view-fotos').hidden = vistaActual !== 'fotos';
        render();
      });
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

    // diálogo: nuevo negocio
    const dialog = $('#dialog-nuevo-negocio');
    $('#btn-nuevo-negocio').addEventListener('click', () => {
      $('#form-nuevo-negocio').reset();
      $('#dialog-error').hidden = true;
      $('#input-nicho').innerHTML = nichos.map((n) => `<option value="${n.id}">${escapeHtml(n.nombre)}</option>`).join('');
      dialog.showModal();
    });
    $('#btn-cancelar-negocio').addEventListener('click', () => dialog.close());
    $('#form-nuevo-negocio').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn-crear-negocio');
      btn.disabled = true;
      try {
        await crearNegocio({
          nombre: $('#input-nombre').value,
          nicho: $('#input-nicho').value,
          datos: {
            precioDesde: $('#input-precio').value,
            unidad: $('#input-unidad').value,
            promo: $('#input-promo').value,
            productoDestacado: $('#input-producto').value,
          },
        });
        dialog.close();
      } catch (err) {
        $('#dialog-error').textContent = err.message;
        $('#dialog-error').hidden = false;
      } finally {
        btn.disabled = false;
      }
    });

    $('#btn-generar').addEventListener('click', generarMas);

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
      if (accion === 'approve') return accionSimple('aprobar', id);
      if (accion === 'reject') return accionSimple('rechazar', id);
      if (accion === 'undo') return accionSimple('deshacer', id);
      if (accion === 'regenerate') return accionSimple('regenerar', id);
    });

    // delegación de eventos en el calendario
    $('#cal-grid').addEventListener('click', (e) => {
      const chip = e.target.closest('.cal-chip');
      if (!chip) return;
      calSelectedId = chip.dataset.id;
      renderCalendario();
    });
  }

  init().catch((err) => {
    console.error(err);
    document.body.innerHTML = '<p style="color:#dd6a52; font-family:sans-serif; padding:24px;">Error cargando el panel: ' + escapeHtml(err.message) + '</p>';
  });
})();
