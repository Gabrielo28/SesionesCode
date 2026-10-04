// Panel de administración (/admin): métricas de la plataforma, embudo,
// visitas, salud y lista de negocios SIN su contenido (ver server/admin.js).
(function () {
  'use strict';
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');

  const G = window.RubrofyGraficos;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => (n == null ? '—' : Number(n).toLocaleString('es-CL'));
  const clp = (n) => '$' + Number(n || 0).toLocaleString('es-CL');
  const pct = (x) => (x == null ? '—' : (x * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '%');
  const ETAPAS = { configura: '1 · Configura', crea: '2 · Crea', mide: '3 · Mide', mejora: '4 · Mejora' };
  const PLANES = { gratis: 'Sin plan', pro: 'Pro', estudio: 'Estudio' };

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
        <div><h1>Resumen de la plataforma${AY('adm-kpis')}</h1>
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
        <div class="ig-card"><div class="ig-card-head"><h2>Visitas al sitio por día${AY('adm-series')}</h2></div><div data-g="visitas"></div>
          <p class="adm-nota">${num(k.visitasRegistro)} vistas de la página de registro en el periodo.</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Registros por día${AY('adm-series')}</h2></div><div data-g="registros"></div></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Publicaciones por día${AY('adm-series')}</h2></div><div data-g="publicaciones"></div></div>
      </section>

      <section class="adm-grid tres">
        <div class="ig-card"><div class="ig-card-head"><h2>Embudo${AY('adm-embudo')}</h2><span class="adm-ayuda">todos los negocios</span></div><div data-g="embudo"></div></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Etapa de la ruta${AY('adm-etapas')}</h2></div><div data-g="etapas"></div>
          <p class="adm-nota">Dónde está cada negocio hoy según su Inicio.</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Planes${AY('adm-planes')}</h2></div><div data-g="planes"></div></div>
      </section>

      <section class="adm-grid tres">
        <div class="ig-card"><div class="ig-card-head"><h2>De dónde llegan${AY('adm-referentes')}</h2></div>
          ${r.referentes.length ? `<ul class="adm-lista">${r.referentes.map((x) => `<li><span>${esc(x.dominio)}</span><b>${num(x.n)}</b></li>`).join('')}</ul>`
            : '<p class="sub">Todavía no hay visitas desde otros sitios en el periodo.</p>'}
          <p class="adm-nota">Sin cookies ni IP: solo el dominio desde el que llegan.</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Uso de IA este mes${AY('adm-ia')}</h2></div>
          <ul class="adm-lista"><li><span>Textos escritos con IA</span><b>${num(k.iaTextosMes)}</b></li><li><span>Fotos generadas con IA</span><b>${num(k.iaFotosMes)}</b></li></ul></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Sistema${AY('adm-sistema')}</h2><span class="adm-ayuda">v${esc(r.sistema.version)}</span></div>
          <ul class="adm-lista adm-config">${Object.entries(r.sistema.config).map(([n, ok]) => `<li><span>${esc(n)}</span><b class="${ok ? 'ok' : 'no'}">${ok ? 'Activo' : 'Falta configurar'}</b></li>`).join('')}</ul>
          <p class="adm-nota">Encendido ${esc(hace(r.sistema.encendidoDesde))} · base de datos ${esc(bytes(r.sistema.tamanoDb))} · zona ${esc(r.sistema.zona)}</p></div>
      </section>

      <section class="ig-card adm-negocios">
        <div class="ig-card-head"><h2>Negocios${AY('adm-negocios')}</h2>
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

  // Reglas de la plataforma para la IA: valen para todos los negocios.
  // Son criterios de calidad; el administrador no ve el contexto de nadie.
  async function pintarIA() {
    let d;
    try { d = await api('/api/admin/contexto-ia'); } catch (err) { return; }
    const sec = document.createElement('section');
    sec.className = 'adm-bloque';
    const prov = d.proveedores;
    const fila = (k, v) => `<tr><td>${k}</td><td>${v ? `<b>${esc(v)}</b>` : '<span class="adm-no">No configurado</span>'}</td></tr>`;
    sec.innerHTML = `
      <div class="adm-bloque-cab"><h2>IA de la plataforma${window.Ayuda ? window.Ayuda.boton('admin-ia') : ''}</h2></div>
      <div class="res-grid">
        <div class="res-card">
          <h2>Proveedores</h2>
          <table class="tabla-ads"><tbody>
            ${fila('Textos (Anthropic)', prov.textos)}
            ${fila('Imágenes', prov.imagen ? `${prov.imagen} · ${prov.modeloImagen}` : null)}
            ${fila('Videos', prov.video ? `${prov.video} · ${prov.modeloVideo}` : null)}
          </tbody></table>
          <p class="sub">Imágenes y videos: <code>HIGGSFIELD_API_KEY</code> (preferido) u <code>OPENAI_API_KEY</code> en Railway.</p>
        </div>
        <div class="res-card">
          <h2>Cómo funcionan las reglas</h2>
          <p class="sub">Lo que escribas aquí se agrega a cada pedido a la IA de todos los negocios, en la sección que corresponda. Úsalo para criterios de calidad (por ejemplo "sin anglicismos", "no prometer resultados de salud"), no para datos de un negocio. Cada negocio ve estas reglas en su "Contexto para la IA".</p>
        </div>
      </div>
      <form class="res-card adm-reglas" data-reglas>
        ${d.secciones.map((x) => `<label class="ctx-campo"><span class="ctx-nombre">${esc(x.nombre)}</span>
          <textarea name="${x.id}" rows="2" maxlength="${x.maximo}">${esc(d.contexto[x.id] || '')}</textarea></label>`).join('')}
        <div class="estilo-acciones"><button class="btn-approve estilo-btn">Guardar reglas</button><span class="res-estado" data-msg></span></div>
      </form>`;
    $('#adm').appendChild(sec);
    sec.querySelector('[data-reglas]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const body = Object.fromEntries(new FormData(ev.target).entries());
      const msg = sec.querySelector('[data-msg]');
      msg.textContent = 'Guardando…';
      const res = await fetch('/api/admin/contexto-ia', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-rubrofy-panel': '1' }, body: JSON.stringify(body) });
      msg.textContent = res.ok ? 'Guardado. Se aplica desde el próximo pedido a la IA.' : 'No se pudo guardar.';
    });
  }

  // Costo de IA de la plataforma: lo que se paga a Anthropic, Higgsfield u
  // OpenAI, contra lo que pagan los planes. Solo cifras de uso.
  async function pintarCostos() {
    let c;
    try { c = await api('/api/admin/costos?dias=' + dias); } catch (err) { return; }
    const usd = (v) => 'US$' + (v || 0).toLocaleString('es-CL', { minimumFractionDigits: v && v < 10 ? 2 : 0, maximumFractionDigits: 2 });
    const clp = (v) => '$' + Math.round((v || 0) * c.dolarClp).toLocaleString('es-CL');
    const pctTxt = (v) => (v == null ? '–' : Math.round(v * 100) + ' %');
    const tipo = (k) => c.porTipo[k] || { costo: 0, llamadas: 0, cantidad: 0, entrada: 0, salida: 0 };
    const sec = document.createElement('section');
    sec.className = 'adm-bloque';
    sec.innerHTML = `
      <div class="adm-bloque-cab"><h2>Costo de IA${AY('admin-costos')}</h2></div>
      <section class="adm-kpis">
        ${tile('Gasto del periodo', usd(c.totalUsd), `${clp(c.totalUsd)} · ${num(c.llamadas)} llamadas`)}
        ${tile('Este mes', usd(c.mesUsd), `proyección a fin de mes: ${usd(c.proyeccionMesUsd)}`)}
        ${tile('Ingresos de planes', usd(c.ingresosUsd), `${clp(c.ingresosUsd)} en el periodo (precio de lista)`)}
        ${tile('Margen sobre la IA', pctTxt(c.margen), 'ingresos menos gasto en IA', c.margen != null && c.margen < 0.6)}
      </section>
      <section class="adm-grid tres">
        <div class="ig-card"><div class="ig-card-head"><h2>Gasto por día</h2></div><div data-g="costo-dia"></div></div>
        <div class="ig-card"><div class="ig-card-head"><h2>En qué se gasta</h2></div><div data-g="costo-uso"></div>
          <p class="adm-nota">Textos: ${num(tipo('textos').entrada)} tokens de entrada y ${num(tipo('textos').salida)} de salida · Imágenes: ${num(tipo('imagen').cantidad)} · Videos: ${num(tipo('video').cantidad)} s</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Costo promedio por negocio</h2></div><div data-g="costo-plan"></div>
          <p class="adm-nota">En el periodo, según el plan.</p></div>
      </section>
      <div class="ig-card">
        <div class="ig-card-head"><h2>Por negocio</h2><span class="adm-ayuda">los que más gastan primero</span></div>
        <div class="adm-tabla-scroll"><table class="adm-tabla">
          <thead><tr><th>Negocio</th><th>Plan</th><th>Gasto IA</th><th>Llamadas</th><th>Paga en el periodo</th><th>Margen</th></tr></thead>
          <tbody>${c.negocios.length ? c.negocios.map((n) => `<tr><td>${esc(n.nombre)}</td><td>${esc(PLANES[n.plan] || n.plan)}</td><td>${usd(n.costoUsd)}</td><td>${num(n.llamadas)}</td><td>${usd(n.ingresoUsd)}</td>
            <td class="${n.margen != null && n.margen < 0.5 ? 'adm-alerta' : ''}">${pctTxt(n.margen)}</td></tr>`).join('') : '<tr><td colspan="6">Todavía no hay gasto de IA en el periodo.</td></tr>'}</tbody>
        </table></div>
        <p class="adm-nota">Textos: tokens reales que informa Claude. Imágenes (US$${c.tarifas.imagen.higgsfield} Higgsfield / US$${c.tarifas.imagen.openai} OpenAI) y videos (US$${c.tarifas.videoSegundo.higgsfield} por segundo en Higgsfield) son tarifas estimadas: ajústalas con variables de entorno si cambian. Dólar a $${num(c.dolarClp)} (DOLAR_CLP).${c.sinNegocioUsd ? ` Incluye ${usd(c.sinNegocioUsd)} de negocios ya eliminados.` : ''}</p>
      </div>`;
    const ancla = $('#adm').querySelector('.adm-bloque');
    if (ancla) $('#adm').insertBefore(sec, ancla); else $('#adm').appendChild(sec);
    const desde = new Date(c.desde);
    const porDia = new Map(c.serie.map((f) => [f.dia, f.costo]));
    const serie = [];
    for (let i = 1; i <= c.dias; i++) {
      const f = new Date(desde.getTime() + i * 86400000).toISOString().slice(0, 10);
      serie.push({ fecha: f, valor: porDia.get(f) || 0 });
    }
    sec.querySelector('[data-g="costo-dia"]').appendChild(G.serieTemporal(serie, { alto: 170, tipo: 'columnas', etiqueta: 'Gasto por día', formato: usd }));
    const usos = c.porUso.map((u) => ({ label: u.uso.charAt(0).toUpperCase() + u.uso.slice(1), valor: u.costo, detalle: `${num(u.llamadas)} llamadas` }));
    sec.querySelector('[data-g="costo-uso"]').appendChild(usos.length ? G.barras(usos, { formato: usd, todasEnAcento: true }) : Object.assign(document.createElement('p'), { className: 'adm-nota', textContent: 'Sin gasto en el periodo.' }));
    const planes = ['gratis', 'pro', 'estudio'].filter((p) => c.porPlan[p]).map((p) => ({ label: PLANES[p], valor: c.porPlan[p].promedioUsd, detalle: `${c.porPlan[p].negocios} negocios` }));
    sec.querySelector('[data-g="costo-plan"]').appendChild(planes.length ? G.barras(planes, { formato: usd, todasEnAcento: true }) : Object.assign(document.createElement('p'), { className: 'adm-nota', textContent: 'Sin datos.' }));
  }

  // Pruebas gratis: los datos que dejó cada negocio en el formulario para
  // activar sus días gratis, y si terminó pagando. Solo datos de contacto.
  async function pintarPruebas() {
    let d;
    try { d = await api('/api/admin/pruebas'); } catch (err) { return; }
    const sec = document.createElement('section');
    sec.className = 'adm-bloque';
    sec.id = 'adm-pruebas';
    const conv = d.pagando + d.sinPagar ? pct(d.pagando / (d.pagando + d.sinPagar)) : '—';
    const COLS = [['fecha', 'Fecha'], ['nombre', 'Nombre'], ['email', 'Correo'], ['telefono', 'Teléfono'], ['contacto', 'Acepta contacto'], ['negocio', 'Negocio'], ['estado', 'Estado']];
    const celda = (p, k) => {
      if (k === 'fecha') return esc(fecha(p.fecha));
      if (k === 'contacto') return p.contacto ? 'Sí' : 'No';
      // Solo se ofrece escribir por WhatsApp a quien lo autorizó.
      if (k === 'telefono') { const t = String(p.telefono).replace(/\D/g, ''); return p.contacto ? `<a href="https://wa.me/${t}" target="_blank" rel="noopener">${esc(p.telefono)}</a>` : esc(p.telefono); }
      if (k === 'email') return p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '—';
      if (k === 'estado') return `<span class="adm-est adm-est-${esc(p.estado.replace(/\s+/g, '-'))}">${esc(p.estado)}</span>`;
      return esc(p[k] || '—');
    };
    sec.innerHTML = `
      <div class="adm-bloque-cab"><h2>Pruebas gratis${AY('admin-pruebas')}</h2><button type="button" class="btn-ghost" data-csv ${d.total ? '' : 'disabled'}>Descargar CSV</button></div>
      <section class="adm-kpis">
        ${tile('Formularios', num(d.total), `${d.catalogo.dias} días del plan ${esc(PLANES[d.catalogo.plan] || d.catalogo.plan)}`)}
        ${tile('En prueba ahora', num(d.enPrueba), '')}
        ${tile('Pasaron a pagar', num(d.pagando), '')}
        ${tile('Conversión', conv, `de las pruebas terminadas (${num(d.sinPagar)} sin pagar)`)}
      </section>
      <div class="ig-card"><div class="adm-tabla-scroll"><table class="adm-tabla adm-tabla-pruebas">
        <thead><tr>${COLS.map((c) => `<th>${c[1]}</th>`).join('')}</tr></thead>
        <tbody>${d.prospectos.length ? d.prospectos.map((p) => `<tr>${COLS.map((c) => `<td>${celda(p, c[0])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${COLS.length}">Todavía nadie ha pedido su prueba gratis.</td></tr>`}</tbody>
      </table></div>
      <p class="adm-nota">Son los datos que cada persona dejó para activar su prueba. Escríbele solo si en «Acepta contacto» dice Sí. No incluyen nada del contenido de su negocio.</p></div>`;
    const ancla = $('#adm').querySelectorAll('.adm-bloque')[1];
    if (ancla) $('#adm').insertBefore(sec, ancla); else $('#adm').appendChild(sec);
    sec.querySelector('[data-csv]').addEventListener('click', () => {
      const q = (v) => '"' + String(v == null ? '' : v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""') + '"';
      const filas = d.prospectos.map((p) => COLS.map((c) => q(c[0] === 'contacto' ? (p.contacto ? 'Sí' : 'No') : p[c[0]])).join(','));
      const blob = new Blob(['\ufeff' + [COLS.map((c) => q(c[1])).join(',')].concat(filas).join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rubrofy-pruebas-gratis-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  // Recargas: paquetes que los negocios compran cuando se les acaba el cupo.
  async function enviar(ruta, cuerpo) {
    const res = await fetch(ruta, { method: 'POST', headers: { 'x-rubrofy-panel': '1', 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(d.error || 'No se pudo guardar'); e.campo = d.campo; throw e; }
    return d;
  }

  // Beneficios: planes de regalo y códigos de descuento que tú otorgas.
  async function pintarBeneficios(datos) {
    let d = datos;
    if (!d) { try { d = await api('/api/admin/beneficios'); } catch (err) { return; } }
    let sec = $('#adm-beneficios');
    if (!sec) {
      sec = document.createElement('section');
      sec.className = 'adm-bloque';
      sec.id = 'adm-beneficios';
      const ancla = $('#adm').querySelectorAll('.adm-bloque')[1];
      if (ancla) $('#adm').insertBefore(sec, ancla); else $('#adm').appendChild(sec);
    }
    const cuentas = d.cuentas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const opcionCuenta = (c) => `<option value="${esc(c.id)}"${c.paga ? ' disabled' : ''}>${esc(c.nombre)} · ${esc(c.email)} · ${esc(PLANES[c.plan] || c.plan)}${c.paga ? ' (ya paga)' : c.regalo ? ' (con regalo)' : ''}</option>`;
    const ESTADOS = { vigente: 'Vigente', vencio: 'Venció', revocado: 'Revocado', suscripcion: 'Pasó a pagar', reemplazado: 'Reemplazado', eliminada: 'Cuenta eliminada' };
    const descuento = (c) => (c.tipo === 'porcentaje' ? `${String(c.valor).replace('.', ',')}%` : `${clp(c.valor)} al mes`);
    const duracion = (m) => (m === 0 ? 'Siempre' : m === 1 ? '1 mes' : `${m} meses`);
    sec.innerHTML = `
      <div class="adm-bloque-cab"><h2>Beneficios${AY('admin-beneficios')}</h2></div>
      <section class="adm-grid">
        <div class="ig-card"><div class="ig-card-head"><h2>Regalar un plan</h2></div>
          <form id="f-regalo" class="adm-form">
            <label class="ancho">Cuenta<select name="negocioId" required><option value="">Elige una cuenta…</option>${cuentas.map(opcionCuenta).join('')}</select></label>
            <label>Plan<select name="plan"><option value="pro">Pro</option><option value="estudio">Estudio</option></select></label>
            <label>Duración<select name="meses"><option value="1">1 mes</option><option value="3" selected>3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option><option value="0">Sin límite</option></select></label>
            <label class="ancho">Motivo <small>(solo lo ves tú)</small><input name="motivo" maxlength="200" placeholder="Ej: cliente fundador, alianza, compensación"></label>
            <div class="ancho adm-form-pie"><button type="submit" class="btn-approve">Regalar plan</button><p class="config-error" hidden></p></div>
          </form>
          <p class="adm-nota">Sin costo ni tarjeta. No cuenta como ingreso. Al terminar, la cuenta queda sin plan y elige si pagar. A una cuenta que ya paga, dale mejor un código.</p>
          <div class="adm-tabla-scroll"><table class="adm-tabla adm-tabla-chica">
            <thead><tr><th>Negocio</th><th>Plan</th><th>Desde</th><th>Hasta</th><th>Motivo</th><th>Estado</th><th></th></tr></thead>
            <tbody>${d.regalos.length ? d.regalos.map((r) => `<tr><td>${esc(r.negocio)}<small>${esc(r.email)}</small></td><td>${esc(PLANES[r.plan] || r.plan)}</td><td>${esc(fecha(r.desde))}</td><td>${r.hasta ? esc(fecha(r.hasta)) : 'Sin límite'}</td><td>${esc(r.motivo || '—')}</td><td>${esc(ESTADOS[r.estado] || r.estado)}</td><td>${r.estado === 'vigente' ? `<button type="button" class="btn-ghost" data-revocar="${esc(r.negocioId)}">Revocar</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="7">Todavía no regalas planes.</td></tr>'}</tbody>
          </table></div>
        </div>
        <div class="ig-card"><div class="ig-card-head"><h2>Códigos de descuento</h2></div>
          ${d.codigosConFlow ? '' : '<p class="adm-nota adm-aviso">Los códigos se cobran como cupones de Flow: funcionan cuando Flow esté configurado. Puedes crearlos desde ya.</p>'}
          <form id="f-codigo" class="adm-form">
            <label>Código<input name="codigo" maxlength="24" placeholder="AMIGO20" required class="adm-mayus"></label>
            <label>Tipo<select name="tipo"><option value="porcentaje">Porcentaje</option><option value="monto">Monto en pesos</option></select></label>
            <label>Descuento<input name="valor" inputmode="decimal" placeholder="20" required></label>
            <label>Planes<select name="planes"><option value="pro,estudio">Pro y Estudio</option><option value="pro">Solo Pro</option><option value="estudio">Solo Estudio</option></select></label>
            <label>Duración<select name="meses"><option value="1">1 mes</option><option value="3" selected>3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option><option value="0">Siempre</option></select></label>
            <label>Máximo de usos <small>(opcional)</small><input name="maxUsos" inputmode="numeric" placeholder="Sin límite"></label>
            <label>Vence <small>(opcional)</small><input name="venceEl" type="date"></label>
            <label>Nota <small>(solo la ves tú)</small><input name="nota" maxlength="200" placeholder="Ej: campaña de octubre"></label>
            <div class="ancho adm-form-pie"><button type="submit" class="btn-approve">Crear código</button><p class="config-error" hidden></p></div>
          </form>
          <div class="adm-tabla-scroll"><table class="adm-tabla adm-tabla-chica">
            <thead><tr><th>Código</th><th>Descuento</th><th>Planes</th><th>Duración</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
            <tbody>${d.codigos.length ? d.codigos.map((c) => `<tr><td><b>${esc(c.codigo)}</b>${c.nota ? `<small>${esc(c.nota)}</small>` : ''}</td><td>${esc(descuento(c))}</td><td>${c.planes.map((p) => esc(PLANES[p] || p)).join(' y ')}</td><td>${esc(duracion(c.meses))}</td><td>${num(c.usos)}${c.maxUsos ? ' / ' + num(c.maxUsos) : ''}</td><td>${c.venceEl ? esc(fecha(c.venceEl)) : '—'}</td><td>${c.activo ? 'Activo' : 'Desactivado'}</td><td><button type="button" class="btn-ghost" data-codigo-estado="${esc(c.codigo)}" data-activo="${c.activo ? 0 : 1}">${c.activo ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('') : '<tr><td colspan="8">Todavía no creas códigos.</td></tr>'}</tbody>
          </table></div>
          <p class="adm-nota">El cliente lo escribe en Plan al elegir su plan (o ya suscrito, para su suscripción). Cada cuenta puede usar un código una vez.</p>
        </div>
      </section>`;
    const formulario = (id, ruta, preparar, confirmar) => {
      const f = sec.querySelector(id);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = f.querySelector('.config-error');
        err.hidden = true;
        const datosForm = Object.fromEntries(new FormData(f));
        if (confirmar && !confirm(confirmar(datosForm))) return;
        f.querySelector('button[type="submit"]').disabled = true;
        try {
          pintarBeneficios(await enviar(ruta, preparar(datosForm)));
        } catch (e2) {
          err.textContent = e2.message;
          err.hidden = false;
          f.querySelector('button[type="submit"]').disabled = false;
          if (e2.campo && f[e2.campo]) f[e2.campo].focus();
        }
      });
    };
    formulario('#f-regalo', '/api/admin/beneficios/regalo', (x) => ({ negocioId: x.negocioId, plan: x.plan, meses: Number(x.meses), motivo: x.motivo }),
      (x) => {
        const c = cuentas.find((k) => k.id === x.negocioId);
        return `¿Regalar el plan ${PLANES[x.plan]} ${Number(x.meses) ? `por ${duracion(Number(x.meses))}` : 'sin límite'} a ${c ? c.nombre : 'esta cuenta'}?`;
      });
    formulario('#f-codigo', '/api/admin/beneficios/codigo', (x) => ({
      codigo: x.codigo, tipo: x.tipo, valor: Number(String(x.valor).replace(',', '.')), planes: x.planes.split(','), meses: Number(x.meses),
      maxUsos: x.maxUsos ? Number(x.maxUsos) : null, venceEl: x.venceEl || null, nota: x.nota,
    }));
    sec.querySelectorAll('[data-revocar]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('¿Revocar este plan de regalo? La cuenta queda sin plan desde ahora.')) return;
      b.disabled = true;
      try { pintarBeneficios(await enviar('/api/admin/beneficios/regalo/revocar', { negocioId: b.dataset.revocar })); } catch (e) { alert(e.message); b.disabled = false; }
    }));
    sec.querySelectorAll('[data-codigo-estado]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { pintarBeneficios(await enviar('/api/admin/beneficios/codigo/estado', { codigo: b.dataset.codigoEstado, activo: b.dataset.activo === '1' })); } catch (e) { alert(e.message); b.disabled = false; }
    }));
  }

  async function guardarCreditos(cuerpo) {
    const res = await fetch('/api/admin/creditos', { method: 'PUT', headers: { 'x-rubrofy-panel': '1', 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || 'No se pudo guardar');
    return d;
  }

  // Créditos ⚡: comisión, modelos y su costo real, packs, créditos por plan y
  // promociones. Rubrofy calcula cuántos créditos cobra cada creación.
  async function pintarCreditos(datos) {
    let d = datos;
    if (!d) { try { d = await api('/api/admin/creditos'); } catch (err) { return; } }
    let sec = $('#adm-creditos');
    if (!sec) {
      sec = document.createElement('section');
      sec.className = 'adm-bloque';
      sec.id = 'adm-creditos';
      const ancla = $('#adm').querySelectorAll('.adm-bloque')[1];
      if (ancla) $('#adm').insertBefore(sec, ancla); else $('#adm').appendChild(sec);
    }
    const c = d.config, p = c.parametros;
    const CAL = d.calidades;
    const usdTxt = (m) => (m.tipo === 'video' ? 'por segundo' : 'por imagen');
    sec.innerHTML = `
      <div class="adm-bloque-cab"><h2>Créditos y modelos de IA${AY('admin-creditos')}</h2></div>
      ${d.pausa ? `<div class="ig-card adm-pausa"><b>⏸ Fotos y videos con IA en pausa</b><p class="sub">Higgsfield respondió que no hay saldo (${esc(d.pausa.motivo || '')}) el ${esc(fecha(d.pausa.desde))}. Carga saldo en open.higgsfield.ai y reanuda. A los clientes no se les cobró.</p><button type="button" class="btn-approve" data-cr-reanudar>Reanudar ahora</button></div>` : ''}
      <section class="adm-kpis">
        ${tile('Créditos usados este mes', num(d.usoMes.creditos), `${num(d.usoMes.creaciones)} ${d.usoMes.creaciones === 1 ? 'creación' : 'creaciones'}`)}
        ${tile('Costo máximo de 1 ⚡', clp(d.costoCreditoMax), 'si se gasta en el modelo que más te cuesta')}
        ${tile('Valor de 1 ⚡ para ti', clp(p.valorCredito), 'sin IVA ni comisión de pago')}
      </section>
      <form class="ig-card adm-cr" id="f-creditos">
        <div class="ig-card-head"><h2>Cómo se calculan</h2></div>
        <div class="adm-cr-params">
          <label>Tu comisión (%)<input name="comision" type="number" min="0" max="300" step="1" value="${p.comision}"><small>Sobre el costo real de la IA</small></label>
          <label>Dólar (CLP)<input name="dolar" type="number" min="300" step="10" value="${p.dolar}"><small>Pon uno algo más alto que el real, como colchón</small></label>
          <label>Valor de 1 ⚡ (CLP)<input name="valorCredito" type="number" min="5" step="1" value="${p.valorCredito}"><small>Lo que te queda por crédito vendido</small></label>
          <label>Comisión de Flow (%)<input name="flow" type="number" min="0" step="0.1" value="${p.flow}"><small>Para calcular la ganancia</small></label>
        </div>
        <label class="switch"><input type="checkbox" name="videosSoloConPacks"${p.videosSoloConPacks ? ' checked' : ''}> <span>Los videos solo se pagan con créditos de packs (los del plan quedan para fotos)</span></label>
        <p class="adm-nota">Créditos de una creación = costo real × dólar × (1 + comisión) ÷ valor de 1 ⚡, hacia arriba. Videos: por cada 5 segundos.</p>

        <h3 class="adm-cr-t">Modelos</h3>
        <div class="adm-tabla-scroll"><table class="adm-tabla">
          <thead><tr><th>Activo</th><th>Modelo</th><th>Tipo</th><th>Calidad</th><th>Costo real (USD)</th><th>Costo</th><th>Cobra</th></tr></thead>
          <tbody>${d.modelos.map((m) => `<tr>
            <td><input type="checkbox" data-m-activo="${esc(m.id)}"${m.activo ? ' checked' : ''} aria-label="Activar ${esc(m.nombre)}"></td>
            <td><b>${esc(m.nombre)}</b><small>${esc(m.proveedor)} · ${esc(m.ruta)}</small></td>
            <td>${m.tipo === 'foto' ? 'Foto' : 'Video'}</td>
            <td><select data-m-calidad="${esc(m.id)}" aria-label="Calidad de ${esc(m.nombre)}">${Object.entries(CAL).map(([k, q]) => `<option value="${k}"${k === m.calidad ? ' selected' : ''}>${esc(q.nombre)}</option>`).join('')}</select></td>
            <td><input type="number" step="0.0001" min="0" value="${m.usd}" data-m-usd="${esc(m.id)}" aria-label="Costo de ${esc(m.nombre)}"><small>${usdTxt(m)}</small></td>
            <td>${clp(m.costoClp)}<small>${m.tipo === 'video' ? 'cada 5 s' : 'cada foto'}</small></td>
            <td><b>${m.creditos} ⚡</b><small>${clp(m.creditos * p.valorCredito)}</small></td></tr>`).join('')}</tbody>
        </table></div>
        <p class="adm-nota">Precios de open.higgsfield.ai/pricing sin descuentos. En cada tipo y calidad queda activo uno solo; si una calidad no tiene modelo activo, el cliente no la ve.</p>

        <div class="adm-grid">
          <div><h3 class="adm-cr-t">Packs de créditos</h3>
            <div class="adm-tabla-scroll"><table class="adm-tabla adm-tabla-chica">
              <thead><tr><th>Créditos</th><th>Precio (con IVA)</th><th>Te queda</th><th>Ganancia mínima</th><th>Destacado</th></tr></thead>
              <tbody>${d.packs.map((x, i) => `<tr><td><input type="number" min="1" step="1" value="${x.creditos}" data-p-creditos="${i}" aria-label="Créditos del pack"></td><td><input type="number" min="500" step="1000" value="${x.precioClp}" data-p-precio="${i}" aria-label="Precio del pack"></td><td>${clp(x.neto)}</td><td class="${x.ganancia < 0 ? 'adm-neg' : ''}">${clp(x.ganancia)}${x.neto ? ` (${Math.round(x.ganancia / x.neto * 100)}%)` : ''}</td><td><input type="radio" name="destacado" value="${i}"${x.destacado ? ' checked' : ''} aria-label="Pack destacado"></td></tr>`).join('')}</tbody>
            </table></div>
            <p class="adm-nota">Ganancia mínima: si el cliente gasta todo en el modelo que más te cuesta por crédito.</p></div>
          <div><h3 class="adm-cr-t">Créditos de cada plan al mes</h3>
            <div class="adm-cr-params dos">
              <label>Pro<input name="plan_pro" type="number" min="0" step="5" value="${c.planes.pro}"></label>
              <label>Estudio<input name="plan_estudio" type="number" min="0" step="5" value="${c.planes.estudio}"></label>
            </div>
            <h3 class="adm-cr-t">Promociones</h3>
            <div class="adm-cr-params">
              <label>Bono primera compra (%)<input name="bono" type="number" min="0" max="200" step="5" value="${c.promo.bono}"></label>
              <label>Créditos en la prueba gratis<input name="prueba" type="number" min="0" step="5" value="${c.promo.prueba}"><small>Reemplazan a los del plan mientras dura</small></label>
              <label>Por invitación, a cada uno<input name="referido" type="number" min="0" step="5" value="${c.promo.referido}"><small>Cuando el invitado paga su plan</small></label>
            </div></div>
        </div>
        <div class="adm-form-pie"><button type="submit" class="btn-approve">Guardar créditos</button><span class="config-ok" hidden>Guardado.</span><p class="config-error" hidden></p></div>
      </form>`;
    const f = sec.querySelector('#f-creditos');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = f.querySelector('.config-error'), ok = f.querySelector('.config-ok');
      err.hidden = true; ok.hidden = true;
      const v = (n) => Number(f.elements[n].value);
      const destacado = (f.querySelector('input[name="destacado"]:checked') || {}).value;
      const cuerpo = {
        parametros: { comision: v('comision'), dolar: v('dolar'), valorCredito: v('valorCredito'), flow: v('flow'), videosSoloConPacks: f.elements.videosSoloConPacks.checked },
        modelos: d.modelos.map((m) => ({
          id: m.id,
          activo: f.querySelector(`[data-m-activo="${m.id}"]`).checked,
          calidad: f.querySelector(`[data-m-calidad="${m.id}"]`).value,
          usd: Number(f.querySelector(`[data-m-usd="${m.id}"]`).value),
        })),
        packs: d.packs.map((x, i) => ({ creditos: Number(f.querySelector(`[data-p-creditos="${i}"]`).value), precioClp: Number(f.querySelector(`[data-p-precio="${i}"]`).value), destacado: String(i) === destacado })),
        planes: { pro: v('plan_pro'), estudio: v('plan_estudio') },
        promo: { bono: v('bono'), prueba: v('prueba'), referido: v('referido') },
      };
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await pintarCreditos(await guardarCreditos(cuerpo));
        const ok2 = sec.querySelector('#f-creditos .config-ok');
        if (ok2) ok2.hidden = false;
      } catch (e2) {
        err.textContent = e2.message;
        err.hidden = false;
        btn.disabled = false;
      }
    });
    const re = sec.querySelector('[data-cr-reanudar]');
    if (re) re.addEventListener('click', async () => {
      re.disabled = true;
      try { pintarCreditos(await enviar('/api/admin/creditos/reanudar', {})); } catch (e) { alert(e.message); re.disabled = false; }
    });
  }

  async function pintarRecargas() {
    let d;
    try { d = await api('/api/admin/recargas?dias=' + dias); } catch (err) { return; }
    const sec = document.createElement('section');
    sec.className = 'adm-bloque';
    sec.innerHTML = `
      <div class="adm-bloque-cab"><h2>Recargas${AY('admin-recargas')}</h2></div>
      <section class="adm-kpis">
        ${tile('Ventas del periodo', num(d.ventas), 'sin contar las simuladas')}
        ${tile('Ingresos', clp(d.ingresosClp), 'con IVA')}
        ${tile('Tu ganancia estimada', clp(d.gananciaClp), 'después de IVA, comisión de pago e IA')}
      </section>
      <section class="adm-grid">
        <div class="ig-card"><div class="ig-card-head"><h2>Paquetes y ganancia por venta</h2></div>
          <div class="adm-tabla-scroll"><table class="adm-tabla">
            <thead><tr><th>Paquete</th><th>Precio</th><th>IVA</th><th>Comisión ~4%</th><th>IA (peor caso)</th><th>Ganancia</th></tr></thead>
            <tbody>${d.paquetes.map((p) => `<tr><td>${esc(p.nombre)}</td><td>${clp(p.precioClp)}</td><td>${clp(p.iva)}</td><td>${clp(p.comision)}</td><td>${clp(p.ia)}</td><td><b>${clp(p.ganancia)}</b></td></tr>`).join('')}</tbody>
          </table></div>
          <p class="adm-nota">Piezas y reels: precios en server/recargas.js. Packs de créditos: se editan en "Créditos y modelos de IA".</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Últimas recargas</h2></div>
          <div class="adm-tabla-scroll"><table class="adm-tabla">
            <thead><tr><th>Fecha</th><th>Negocio</th><th>Paquete</th><th>Precio</th></tr></thead>
            <tbody>${d.lista.length ? d.lista.map((v) => `<tr><td>${esc(fecha(v.fecha))}</td><td>${esc(v.negocio)}</td><td>${esc(v.nombre)}${v.simulada ? ' <small>simulada</small>' : ''}</td><td>${clp(v.precioClp)}</td></tr>`).join('') : '<tr><td colspan="4">Todavía no hay recargas.</td></tr>'}</tbody>
          </table></div></div>
      </section>`;
    const ancla = $('#adm').querySelectorAll('.adm-bloque')[1];
    if (ancla) $('#adm').insertBefore(sec, ancla); else $('#adm').appendChild(sec);
  }

  // Soporte: lo que los clientes escriben desde "Ayuda y soporte". Es lo
  // único de cada negocio que se lee aquí, porque te lo mandan a ti.
  let sopEstado = 'abiertas';
  let sopSel = null;
  const SOP_ESTADOS = { abierta: ['Por responder', 'pend'], respondida: ['Respondida', 'ok'], cerrada: ['Resuelta', 'nulo'] };
  async function pintarSoporte() {
    let d;
    try { d = await api('/api/admin/soporte?estado=' + sopEstado); } catch (err) { return; }
    let sec = $('#adm-soporte');
    if (!sec) {
      sec = document.createElement('section');
      sec.className = 'adm-bloque';
      sec.id = 'adm-soporte';
      const kpis = $('#adm .adm-kpis');
      if (kpis) kpis.after(sec); else $('#adm').appendChild(sec);
      sec.addEventListener('click', clicSoporte);
      sec.addEventListener('submit', responderSoporte);
    }
    const c = d.conteo;
    sec.innerHTML = `
      <div class="adm-bloque-cab"><h2>Soporte${AY('adm-soporte')}</h2>
        <p class="sub">Lo que los clientes te escriben desde "Ayuda y soporte". Solo ves lo que ellos te mandaron.</p></div>
      <div class="adm-sop-barra">
        <div class="pestanas"><button type="button" data-sop-estado="abiertas" class="${sopEstado === 'abiertas' ? 'activa' : ''}">Por responder (${num(c.abiertas)})</button><button type="button" data-sop-estado="todas" class="${sopEstado === 'todas' ? 'activa' : ''}">Todas</button></div>
        ${c.nuevas ? `<span class="adm-sop-nuevas">${num(c.nuevas)} sin leer</span>` : ''}
      </div>
      <div class="adm-sop">
        <ul class="adm-sop-lista">${d.solicitudes.length ? d.solicitudes.map((s) => {
          const [txt, clase] = SOP_ESTADOS[s.estado] || [s.estado, 'nulo'];
          return `<li><button type="button" data-sop-ver="${s.id}" class="${s.id === sopSel ? 'activa' : ''}${s.nueva ? ' nueva' : ''}">
            <span class="adm-sop-l1"><b>#${s.id} · ${esc(s.asunto)}</b><span class="cta-estado ${clase}">${txt}</span></span>
            <span class="adm-sop-l2">${esc(s.negocio.nombre)} · ${esc(s.tipoNombre)} · ${hace(s.actualizadoEl)}</span>
            ${s.ultimo ? `<span class="adm-sop-l3">${s.ultimo.autor === 'equipo' ? 'Tú: ' : ''}${esc(s.ultimo.texto)}</span>` : ''}
          </button></li>`;
        }).join('') : `<li class="adm-sop-vacia">${sopEstado === 'abiertas' ? 'No hay nada por responder. 🎉' : 'Todavía no hay solicitudes.'}</li>`}</ul>
        <div class="adm-sop-detalle" data-sop-detalle>${sopSel ? '<p class="sub">Cargando…</p>' : '<p class="sub">Elige una solicitud para verla y responder.</p>'}</div>
      </div>`;
    if (sopSel) await verSolicitud(sopSel);
  }

  async function verSolicitud(id) {
    const caja = $('#adm-soporte [data-sop-detalle]');
    let s;
    try { s = await api('/api/admin/soporte/' + id); } catch (err) { caja.innerHTML = '<p class="sub">No se encontró esa solicitud.</p>'; return; }
    sopSel = s.id;
    const [txt, clase] = SOP_ESTADOS[s.estado] || [s.estado, 'nulo'];
    const cx = s.contexto || {};
    const base = '/api/admin/soporte/' + s.id + '/adjunto/';
    caja.innerHTML = `
      <div class="adm-sop-cab"><div><h3>#${s.id} · ${esc(s.asunto)}</h3>
        <p class="sub">${esc(s.negocio.nombre)} · ${s.negocio.email ? `<a href="mailto:${esc(s.negocio.email)}">${esc(s.negocio.email)}</a>` : 'sin correo'} · ${esc(s.negocio.plan || '')}<br>${esc(s.tipoNombre)} · creada ${esc(fecha(s.creadoEl))}</p></div>
        <span class="cta-estado ${clase}">${txt}</span></div>
      ${s.contexto ? `<details class="adm-sop-ctx"><summary>Detalles técnicos${cx.errores && cx.errores.length ? ` · ${cx.errores.length} error${cx.errores.length === 1 ? '' : 'es'}` : ''}</summary>
        <dl><dt>Pantalla</dt><dd>${esc(cx.pantalla || '—')}</dd><dt>Navegador</dt><dd>${esc(cx.navegador || '—')}</dd><dt>Ventana</dt><dd>${esc(cx.ventana || '—')}</dd><dt>Versión</dt><dd>${esc(cx.version || '—')}</dd></dl>
        ${cx.errores && cx.errores.length ? `<ul>${cx.errores.map((e) => `<li><code>${esc(e.que)}${e.estado ? ` → ${esc(e.estado)}` : ''}</code> ${esc(e.mensaje || '')} <small>${esc(hace(e.cuando))}</small></li>`).join('')}</ul>` : '<p class="sub">Sin errores registrados.</p>'}
      </details>` : ''}
      <div class="sop-hilo adm-sop-hilo">${s.mensajes.map((m) => `<div class="sop-msj ${m.autor === 'equipo' ? 'yo' : 'equipo'}"><small>${m.autor === 'equipo' ? 'Tú (equipo)' : esc(s.negocio.nombre)} · ${esc(new Date(m.creadoEl).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</small><p>${esc(m.texto)}</p>${m.adjunto ? `<a href="${base}${encodeURIComponent(m.adjunto)}" target="_blank" rel="noopener"><img src="${base}${encodeURIComponent(m.adjunto)}" alt="Captura adjunta" loading="lazy"></a>` : ''}</div>`).join('')}</div>
      <form class="adm-sop-resp" data-sop-responder="${s.id}">
        <textarea name="texto" rows="4" maxlength="4000" required placeholder="Escribe tu respuesta. Le llega por correo y la ve en su panel."></textarea>
        <p class="config-error" data-sop-error hidden></p>
        <div class="config-actions">
          ${s.estado === 'cerrada' ? `<button type="button" class="btn-ghost" data-sop-marcar="abierta">Reabrir</button>` : `<button type="button" class="btn-ghost" data-sop-marcar="cerrada">Cerrar sin responder</button>`}
          <button type="submit" class="btn-ghost" data-cerrar="1">Responder y cerrar</button>
          <button type="submit" class="btn-approve">Responder</button>
        </div>
      </form>`;
    $('#adm-soporte').querySelectorAll('[data-sop-ver]').forEach((b) => { b.classList.toggle('activa', Number(b.dataset.sopVer) === s.id); if (Number(b.dataset.sopVer) === s.id) b.classList.remove('nueva'); });
  }

  async function clicSoporte(e) {
    const est = e.target.closest('[data-sop-estado]');
    if (est) { sopEstado = est.dataset.sopEstado; return pintarSoporte(); }
    const ver = e.target.closest('[data-sop-ver]');
    if (ver) {
      await verSolicitud(Number(ver.dataset.sopVer));
      if (window.innerWidth < 900) $('#adm-soporte [data-sop-detalle]').scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    const marcar = e.target.closest('[data-sop-marcar]');
    if (marcar && sopSel) {
      try { await enviar('/api/admin/soporte/' + sopSel + '/estado', { estado: marcar.dataset.sopMarcar }); } catch (err) { alert(err.message); return; }
      return pintarSoporte();
    }
  }

  async function responderSoporte(e) {
    const form = e.target.closest('[data-sop-responder]');
    if (!form) return;
    e.preventDefault();
    const cerrar = !!(e.submitter && e.submitter.dataset.cerrar);
    const error = form.querySelector('[data-sop-error]');
    error.hidden = true;
    form.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      await enviar('/api/admin/soporte/' + form.dataset.sopResponder + '/responder', { texto: form.texto.value, cerrar });
      await pintarSoporte();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      form.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  }

  async function cargar() {
    try {
      const [r, n] = await Promise.all([api('/api/admin/resumen?dias=' + dias), api('/api/admin/negocios')]);
      negocios = n;
      pintar(r);
      // /admin#soporte-12 (el enlace del correo) abre esa solicitud.
      const m = /^#soporte-(\d+)$/.exec(window.location.hash);
      if (m) sopSel = Number(m[1]);
      await pintarSoporte();
      if (m || window.location.hash === '#soporte') $('#adm-soporte').scrollIntoView({ block: 'start' });
      await pintarCostos();
      await pintarPruebas();
      await pintarRecargas();
      await pintarCreditos();
      await pintarBeneficios();
      pintarIA();
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
