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
        ${tile('Tu ganancia estimada', clp(d.gananciaClp), 'después de IVA, Stripe e IA')}
      </section>
      <section class="adm-grid">
        <div class="ig-card"><div class="ig-card-head"><h2>Paquetes y ganancia por venta</h2></div>
          <div class="adm-tabla-scroll"><table class="adm-tabla">
            <thead><tr><th>Paquete</th><th>Precio</th><th>IVA</th><th>Stripe ~4%</th><th>IA (peor caso)</th><th>Ganancia</th></tr></thead>
            <tbody>${d.paquetes.map((p) => `<tr><td>${esc(p.nombre)}</td><td>${clp(p.precioClp)}</td><td>${clp(p.iva)}</td><td>${clp(p.comision)}</td><td>${clp(p.ia)}</td><td><b>${clp(p.ganancia)}</b></td></tr>`).join('')}</tbody>
          </table></div>
          <p class="adm-nota">Precios en server/recargas.js. Costo de IA en el peor caso con el dólar a $950.</p></div>
        <div class="ig-card"><div class="ig-card-head"><h2>Últimas recargas</h2></div>
          <div class="adm-tabla-scroll"><table class="adm-tabla">
            <thead><tr><th>Fecha</th><th>Negocio</th><th>Paquete</th><th>Precio</th></tr></thead>
            <tbody>${d.lista.length ? d.lista.map((v) => `<tr><td>${esc(fecha(v.fecha))}</td><td>${esc(v.negocio)}</td><td>${esc(v.nombre)}${v.simulada ? ' <small>simulada</small>' : ''}</td><td>${clp(v.precioClp)}</td></tr>`).join('') : '<tr><td colspan="4">Todavía no hay recargas.</td></tr>'}</tbody>
          </table></div></div>
      </section>`;
    const ancla = $('#adm').querySelectorAll('.adm-bloque')[1];
    if (ancla) $('#adm').insertBefore(sec, ancla); else $('#adm').appendChild(sec);
  }

  async function cargar() {
    try {
      const [r, n] = await Promise.all([api('/api/admin/resumen?dias=' + dias), api('/api/admin/negocios')]);
      negocios = n;
      pintar(r);
      await pintarCostos();
      await pintarPruebas();
      await pintarRecargas();
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
