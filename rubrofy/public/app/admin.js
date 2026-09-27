// Panel de administración (/admin): métricas de la plataforma, embudo,
// visitas, salud y lista de negocios SIN su contenido (ver server/admin.js).
(function () {
  'use strict';

  const G = window.RubrofyGraficos;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'));
  const clp = (n) => '$' + Number(n || 0).toLocaleString('es-CL');
  const pct = (x) => (x == null ? '—' : (x * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '%');
  const ETAPAS = { configura: '1 · Configura', crea: '2 · Crea', mide: '3 · Mide', mejora: '4 · Mejora' };
  const PLANES = { gratis: 'Gratis', pro: 'Pro', estudio: 'Estudio' };

  let dias = 30;
  let negocios = [];
  let filtro = '';
  let orden = 'creadoEl';

  async function api(ruta) {
    const res = await fetch(ruta, { headers: { 'x-rubrofy-panel': '1' } });
    if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
    return res.json();
  }

  function fecha(iso) {
    if (!iso) return '—';
    // 'AAAA-MM-DD' es una fecha local del negocio: sin convertir de zona.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00-04:00') : new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'America/Santiago' });
  }
  function hace(iso) {
    if (!iso) return 'nunca';
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (min < 60) return 'hace ' + Math.max(1, min) + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return 'hace ' + h + ' h';
    const d = Math.round(h / 24);
    return 'hace ' + d + (d === 1 ? ' día' : ' días');
  }
  function bytes(b) {
    if (b == null) return '—';
    return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  }

  function tile(titulo, valor, detalle, alerta) {
    return `<div class="adm-kpi${alerta ? ' alerta' : ''}"><span>${esc(titulo)}</span><b>${valor}</b><em>${detalle || ''}</em></div>`;
  }

  function pintar(r) {
    const k = r.kpis;
    const main = $('#adm');
    main.innerHTML = `
      <div class="adm-cab">
        <div><h1>Resumen de la plataforma</h1>
        <p class="sub">${esc(fecha(r.periodo.desde))} – ${esc(fecha(r.periodo.hasta))}. Solo métricas y estado: aquí no se ven textos, fotos, estrategias ni resultados de cada negocio.</p></div>
      </div>

      <section class="adm-kpis">
        ${tile('Negocios', num(k.negocios), `+${num(k.nuevos)} en el periodo`)}
        ${tile('Pagan un plan', num(k.pagando), `${clp(k.mrr)} al mes (MRR)`)}
        ${tile('Activos 7 días', num(k.activos7), 'entraron al panel')}
        ${tile('Visitas al sitio', num(k.visitas), `conversión a registro ${pct(k.conversion)}`)}
        ${tile('Publicado en Instagram', num(k.publicaciones), `${num(k.aprobaciones)} aprobaciones`)}
        ${tile('Por resolver', num(k.fallidas + k.reconectar), `${num(k.fallidas)} fallidas · ${num(k.reconectar)} por reconectar`, k.fallidas + k.reconectar > 0)}
      </section>

      <section class="adm-grid tres">
        <div class="ig-card"><div class="ig-card-head"><h2>Visitas al sitio por día</h2></div><div data-g="visitas"></div>
          <p class="adm-nota">${num(k.visitasRegistro)} vistas de la página de registro en el periodo.</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Registros por día</h2></div><div data-g="registros"></div></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Publicaciones por día</h2></div><div data-g="publicaciones"></div></div>
      </section>

      <section class="adm-grid tres">
        <div class="ig-card"><div class="ig-card-head"><h2>Embudo</h2><span class="adm-ayuda">todos los negocios</span></div><div data-g="embudo"></div></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Etapa de la ruta</h2></div><div data-g="etapas"></div>
          <p class="adm-nota">Dónde está cada negocio hoy según su Inicio.</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Planes</h2></div><div data-g="planes"></div></div>
      </section>

      <section class="adm-grid tres">
        <div class="ig-card"><div class="ig-card-head"><h2>De dónde llegan</h2></div>
          ${r.referentes.length ? `<ul class="adm-lista">${r.referentes.map((x) => `<li><span>${esc(x.dominio)}</span><b>${num(x.n)}</b></li>`).join('')}</ul>`
            : '<p class="sub">Todavía no hay visitas desde otros sitios en el periodo.</p>'}
          <p class="adm-nota">Sin cookies ni IP: solo el dominio desde el que llegan.</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Uso de IA este mes</h2></div>
          <ul class="adm-lista"><li><span>Textos escritos con IA</span><b>${num(k.iaTextosMes)}</b></li><li><span>Fotos generadas con IA</span><b>${num(k.iaFotosMes)}</b></li></ul></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Sistema</h2><span class="adm-ayuda">v${esc(r.sistema.version)}</span></div>
          <ul class="adm-lista adm-config">${Object.entries(r.sistema.config).map(([n, ok]) => `<li><span>${esc(n)}</span><b class="${ok ? 'ok' : 'no'}">${ok ? 'Activo' : 'Falta configurar'}</b></li>`).join('')}</ul>
          <p class="adm-nota">Encendido ${esc(hace(r.sistema.encendidoDesde))} · base de datos ${esc(bytes(r.sistema.tamanoDb))} · zona ${esc(r.sistema.zona)}</p></div>
      </section>

      <section class="ig-card adm-negocios">
        <div class="ig-card-head"><h2>Negocios</h2>
          <div class="adm-filtros">
            <input type="search" id="adm-buscar" placeholder="Buscar por nombre o email" value="${esc(filtro)}" aria-label="Buscar negocio">
            <select id="adm-orden" aria-label="Ordenar por">
              <option value="creadoEl">Más nuevos</option><option value="ultimoAcceso">Última actividad</option>
              <option value="publicadas">Más publicaciones</option><option value="plan">Plan</option>
            </select>
            <button type="button" class="btn-ghost" id="adm-csv">Descargar CSV</button>
          </div>
        </div>
        <div class="adm-tabla-scroll"><table class="adm-tabla" id="adm-tabla"></table></div>
      </section>`;

    const serie = (clave, tipo, etiqueta) => G.serieTemporal(r.serie.map((d) => ({ fecha: d.fecha, valor: d[clave] })), { alto: 170, tipo, etiqueta });
    main.querySelector('[data-g="visitas"]').appendChild(serie('visitas', 'linea', 'Visitas por día'));
    main.querySelector('[data-g="registros"]').appendChild(serie('registros', 'columnas', 'Registros por día'));
    main.querySelector('[data-g="publicaciones"]').appendChild(serie('publicaciones', 'columnas', 'Publicaciones por día'));
    main.querySelector('[data-g="embudo"]').appendChild(G.barras(r.embudo.map((p, i) => ({
      label: p.label, valor: p.n,
      detalle: i && r.embudo[i - 1].n ? pct(p.n / r.embudo[i - 1].n) + ' del paso anterior' : '',
    })), { todasEnAcento: true }));
    main.querySelector('[data-g="etapas"]').appendChild(G.barras(Object.entries(r.porEtapa).map(([e, n]) => ({ label: ETAPAS[e], valor: n })), { todasEnAcento: true }));
    main.querySelector('[data-g="planes"]').appendChild(G.barras(['gratis', 'pro', 'estudio'].map((p) => ({ label: PLANES[p], valor: r.porPlan[p] || 0 })), { todasEnAcento: true }));

    $('#adm-orden').value = orden;
    $('#adm-buscar').addEventListener('input', (e) => { filtro = e.target.value; pintarTabla(); });
    $('#adm-orden').addEventListener('change', (e) => { orden = e.target.value; pintarTabla(); });
    $('#adm-csv').addEventListener('click', descargarCSV);
    pintarTabla();
  }

  function visibles() {
    const q = filtro.trim().toLowerCase();
    const lista = negocios.filter((n) => !q || (n.nombre + ' ' + (n.email || '')).toLowerCase().includes(q));
    const clave = {
      creadoEl: (n) => n.creadoEl || '',
      ultimoAcceso: (n) => n.ultimoAcceso || '',
      publicadas: (n) => String(n.piezas.publicadas).padStart(8, '0'),
      plan: (n) => String(n.precioClp).padStart(8, '0'),
    }[orden];
    return lista.sort((a, b) => clave(b).localeCompare(clave(a)));
  }

  function pintarTabla() {
    const t = $('#adm-tabla');
    const filas = visibles();
    const ig = { ok: '<span class="adm-ok">Conectado</span>', reconectar: '<span class="adm-mal">Reconectar</span>', no: '<span class="adm-no">No</span>' };
    t.innerHTML = `<thead><tr><th>Negocio</th><th>Plan</th><th>Alta</th><th>Última actividad</th><th>Etapa</th><th>Instagram</th>
      <th class="n">Pend.</th><th class="n">Aprob.</th><th class="n">Publ.</th><th class="n">Fallidas</th><th class="n">IA mes</th></tr></thead>
      <tbody>${filas.map((n) => `<tr>
        <td><b>${esc(n.nombre)}</b><small>${esc(n.email || '')}</small></td>
        <td><span class="adm-plan p-${esc(n.plan)}">${esc(PLANES[n.plan] || n.plan)}</span>${n.suscripcion && n.suscripcion !== 'active' ? `<small>${esc(n.suscripcion)}</small>` : ''}</td>
        <td>${esc(fecha(n.creadoEl))}</td>
        <td>${esc(hace(n.ultimoAcceso))}</td>
        <td>${n.bienvenida ? esc(ETAPAS[n.etapa] || '—') : '<span class="adm-no">Sin bienvenida</span>'}</td>
        <td>${ig[n.instagram]}</td>
        <td class="n">${num(n.piezas.pendientes)}</td><td class="n">${num(n.piezas.aprobadas)}</td>
        <td class="n">${num(n.piezas.publicadas)}</td><td class="n ${n.piezas.fallidas ? 'adm-mal' : ''}">${num(n.piezas.fallidas)}</td>
        <td class="n">${num(n.iaMes.textos)}${n.iaMes.fotos ? ' + ' + num(n.iaMes.fotos) + ' fotos' : ''}</td>
      </tr>`).join('') || '<tr><td colspan="11" class="adm-vacio">Sin resultados.</td></tr>'}</tbody>`;
  }

  function descargarCSV() {
    const cab = ['nombre', 'email', 'plan', 'alta', 'ultima_actividad', 'bienvenida', 'etapa', 'instagram', 'publicidad', 'resumen_semanal', 'por_semana', 'pendientes', 'aprobadas', 'publicadas', 'fallidas', 'ia_textos_mes', 'ia_fotos_mes'];
    // Comillas escapadas y sin fórmulas: un nombre que empiece con = + - @
    // se antepone con ' para que Excel no lo ejecute.
    const q = (v) => '"' + String(v == null ? '' : v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""') + '"';
    const filas = visibles().map((n) => [n.nombre, n.email, n.plan, n.creadoEl, n.ultimoAcceso, n.bienvenida ? 'si' : 'no', n.etapa, n.instagram, n.publicidad ? 'si' : 'no', n.avisos ? 'si' : 'no', n.semanal,
      n.piezas.pendientes, n.piezas.aprobadas, n.piezas.publicadas, n.piezas.fallidas, n.iaMes.textos, n.iaMes.fotos].map(q).join(','));
    const blob = new Blob(['﻿' + [cab.join(',')].concat(filas).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rubrofy-negocios-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function cargar() {
    try {
      const [r, n] = await Promise.all([api('/api/admin/resumen?dias=' + dias), api('/api/admin/negocios')]);
      negocios = n;
      pintar(r);
    } catch (err) {
      $('#adm').innerHTML = err.status === 404 || err.status === 401
        ? '<div class="ig-card adm-sin"><h2>No tienes acceso a la administración</h2><p class="sub">Entra en <a href="/app">tu panel</a> con una cuenta de administrador y vuelve a esta página.</p></div>'
        : '<div class="ig-card adm-sin"><h2>No se pudo cargar</h2><p class="sub">Intenta de nuevo en un momento.</p></div>';
    }
  }

  document.querySelectorAll('.adm-periodo [data-dias]').forEach((b) => b.addEventListener('click', () => {
    dias = Number(b.dataset.dias);
    document.querySelectorAll('.adm-periodo [data-dias]').forEach((x) => x.classList.toggle('activa', x === b));
    cargar();
  }));
  cargar();
})();
