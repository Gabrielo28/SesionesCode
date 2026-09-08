(function () {
  'use strict';

  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const MESES_LARGO = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

  let nichosMap = {};
  let negocios = [];
  let negocioActual = null;
  let contenido = [];
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
  function cardHTML(item) {
    const meta = statusMeta(item.status);
    const caption = item.variants[item.variantIndex];
    const isPost = item.aspect.trim().startsWith('4');
    const isPending = item.status === 'pendiente';
    const isEditing = editingIds.has(item.id);
    const dateShort = item.date.split(' - ').slice(0, 2).join(' - ');
    const inicial = escapeHtml((negocioActual.nombre || '?').charAt(0).toUpperCase());

    return `
      <div class="card">
        <div class="card-media ${isPost ? 'post' : 'historia'}" style="background:linear-gradient(160deg, ${item.hueFrom}, ${item.hueTo})">
          <div class="card-texture"></div>
          <div class="card-logo">${inicial}</div>
          <div class="card-network"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f3ede1" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.6" fill="#f3ede1" stroke="none"/></svg></div>
          <div class="card-status"><span class="dot" style="background:${meta.color}"></span><span class="label" style="color:#f3ede1">${meta.label}</span></div>
          <div class="card-headline">${escapeHtml(item.headline)}</div>
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

  function render() {
    renderStats();
    if (vistaActual === 'cola') renderCola();
    else renderCalendario();
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
    contenido = await api('/api/negocios/' + id + '/contenido');
    editingIds.clear();
    calSelectedId = null;
    $('#negocio-select').value = id;
    $('#switcher-badge').textContent = (negocioActual.nombre || '??').slice(0, 2).toUpperCase();
    $('#switcher-niche').textContent = (nichosMap[negocioActual.nicho] || negocioActual.nicho).toUpperCase();
    render();
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
        render();
      });
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
