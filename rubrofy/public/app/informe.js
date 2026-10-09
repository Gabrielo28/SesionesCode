// Informe mensual imprimible. Dos modos:
//   - dueño con sesión (/app/informe.html?mes=AAAA-MM): puede generar la
//     conclusión y copiar un enlace para compartir;
//   - enlace compartido (?n=negocio&mes=...&t=firma): solo lectura.
(function () {
  const G = window.RubrofyGraficos;
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const token = params.get('t');
  const compartido = !!token;
  let negocioId = params.get('n');
  let mes = params.get('mes');
  const RAMPA_CLARA = ['#fbe3ee', '#f5b3cf', '#e56d9f', '#c2185b', '#7f0f3c']; // un tono, L 0.94 → 0.39
  const DIAS = [
    { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' }, { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' }, { id: 6, label: 'Sábado' }, { id: 0, label: 'Domingo' },
  ];
  const FRANJAS = [{ id: 'manana', label: 'mañana' }, { id: 'tarde', label: 'tarde' }, { id: 'noche', label: 'noche' }];
  const FORMATOS = { post: 'Posts', carrusel: 'Carruseles', reel: 'Reels', historia: 'Historias' };
  const e = G.escapar;
  const n = G.numero;

  async function api(ruta, opciones) {
    const res = await fetch(ruta, Object.assign({ headers: { 'x-rubrofy-panel': '1', 'content-type': 'application/json' } }, opciones));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error ' + res.status);
    return data;
  }

  function variacionHTML(v, mesPrevio) {
    if (v == null) return 'sin datos del mes anterior';
    return `<span class="${v >= 0 ? 'sube' : 'baja'}">${v >= 0 ? '▲ +' : '▼ '}${v}%</span> vs ${e(mesPrevio)}`;
  }

  function kpi(label, valor, extra) {
    return `<div class="kpi"><span class="kpi-label">${label}</span><b class="kpi-valor">${valor}</b><span class="kpi-extra">${extra || ''}</span></div>`;
  }

  // Conclusión: texto con títulos y viñetas "- " → títulos y listas.
  function conclusionHTML(c) {
    const titulos = ['Qué pasó', 'Qué funcionó', 'Qué haremos el próximo mes'];
    let html = '';
    let enLista = false;
    for (const cruda of String(c.texto).split('\n')) {
      const linea = cruda.trim().replace(/^\*\*|\*\*$/g, '');
      if (!linea) continue;
      const titulo = linea.replace(/:$/, '').replace(/^#+\s*/, '');
      if (titulos.includes(titulo)) {
        if (enLista) { html += '</ul>'; enLista = false; }
        html += `<h3>${e(titulo)}</h3>`;
      } else if (/^[-•*]\s+/.test(linea)) {
        if (!enLista) { html += '<ul>'; enLista = true; }
        html += `<li>${e(linea.replace(/^[-•*]\s+/, ''))}</li>`;
      } else {
        if (enLista) { html += '</ul>'; enLista = false; }
        html += `<p>${e(linea)}</p>`;
      }
    }
    return html + (enLista ? '</ul>' : '');
  }

  // Secciones de otras fuentes (Meta Ads, Google Ads, competencia): cada
  // una registra su propio dibujo en RubrofyInforme.secciones.
  const secciones = {};

  function pintar(d) {
    const r = d.resumen;
    const c = d.comparacion;
    document.title = `Informe ${d.etiquetaMes} · ${d.negocio.nombre}`;
    const main = $('#informe');
    main.innerHTML = `
      <header class="portada">
        <div>
          <h1>Informe de ${e(d.etiquetaMes)}${window.Ayuda && !d.compartido ? window.Ayuda.boton('informe') : ''}</h1>
          <p class="sub">${e(d.negocio.nombre)}${d.negocio.rubro ? ' · ' + e(d.negocio.rubro) : ''}${d.completo ? '' : ' · mes en curso, datos hasta hoy'}</p>
        </div>
        <div class="marca">Rubrofy<br>Instagram · resultados del mes</div>
      </header>

      <section class="card">
        <h2>Conclusión</h2>
        ${d.conclusion
          ? `<div class="conclusion">${conclusionHTML(d.conclusion)}</div>
             <p class="origen">${d.conclusion.origen === 'ia' ? 'Escrita con IA a partir de los datos del informe' : 'Resumen automático a partir de los datos'} · ${new Date(d.conclusion.generadoEl).toLocaleDateString('es-CL')}</p>`
          : `<p class="vacio">${compartido ? 'Este informe todavía no tiene conclusión.' : 'Todavía no hay conclusión para este mes. Usa "Generar conclusión" arriba.'}</p>`}
      </section>

      <section class="kpis">
        ${kpi('Seguidores', n(r.seguidores), r.seguidoresDelta == null ? '' : `${r.seguidoresDelta >= 0 ? '+' : ''}${n(r.seguidoresDelta)} en el mes`)}
        ${kpi('Alcance', n(r.alcance), variacionHTML(c.alcance, c.mes))}
        ${kpi('Interacciones', n(r.interacciones), variacionHTML(c.interacciones, c.mes))}
        ${kpi('Tasa de interacción', r.tasaInteraccion == null ? '–' : (r.tasaInteraccion * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '%', 'interacciones sobre alcance')}
        ${kpi('Publicado con Rubrofy', n(d.publicadas.total), Object.entries(d.publicadas.porFormato).map(([f, k]) => `${k} ${(FORMATOS[f] || f).toLowerCase()}`).join(', ') || 'nada publicado este mes')}
      </section>

      <section class="dos">
        <div class="card"><h2>Alcance diario</h2><div data-graf="alcance"></div></div>
        <div class="card"><h2>Interacciones diarias</h2><div data-graf="interacciones"></div></div>
      </section>

      <section class="dos">
        <div class="card">
          <h2>Qué enfoques funcionaron</h2>
          <p class="nota">Interacciones promedio por publicación.</p>
          <div data-graf="enfoques"></div>
        </div>
        <div class="card">
          <h2>Cuándo publicar</h2>
          <p class="nota" data-texto="horario"></p>
          <div data-graf="horario"></div>
        </div>
      </section>

      <section class="card">
        <h2>Las publicaciones del mes con más interacción</h2>
        ${r.topPosts.length ? r.topPosts.map((p) => `
          <div class="post">
            <span class="meta">${G.fechaCorta(p.publicado_el.slice(0, 10))}${p.permalink ? ` · <a href="${e(p.permalink)}">${e(p.permalink)}</a>` : ''}</span>
            <p>${e((p.caption || '(sin texto)').slice(0, 220))}</p>
            <span class="cifras"><span><b>${n(p.interacciones)}</b> interacciones</span><span><b>${n(p.alcance)}</b> alcance</span><span><b>${n(p.guardados)}</b> guardados</span><span><b>${n(p.compartidos)}</b> compartidos</span></span>
          </div>`).join('') : '<p class="vacio">No hay publicaciones con métricas este mes.</p>'}
      </section>

      <section class="card">
        <h2>Aprobación del contenido</h2>
        <p class="nota">Cuánto de lo que propone la IA se aprueba sin cambios: mientras más alto, más aprendió la voz de la marca.</p>
        <table class="tabla">
          <thead><tr><th>Piezas decididas en el mes</th><th>Aprobadas sin cambios</th><th>Aprobadas con edición</th><th>Rechazadas</th><th>% sin cambios</th></tr></thead>
          <tbody><tr><td>${n(d.aprobacion.aprobadas + d.aprobacion.rechazadas)}</td><td>${n(d.aprobacion.sinCambios)}</td><td>${n(d.aprobacion.editadas)}</td><td>${n(d.aprobacion.rechazadas)}</td><td>${d.aprobacion.porcentajeSinCambios == null ? '–' : d.aprobacion.porcentajeSinCambios + '%'}</td></tr></tbody>
        </table>
      </section>

      <div id="secciones-extra"></div>

      <details class="card no-imprimir">
        <summary>Datos diarios en tabla</summary>
        <table class="tabla">
          <thead><tr><th>Fecha</th><th>Seguidores</th><th>Alcance</th><th>Interacciones</th><th>Vistas</th></tr></thead>
          <tbody>${r.serie.map((f) => `<tr><td>${G.fechaCorta(f.fecha)}</td><td>${n(f.seguidores)}</td><td>${n(f.alcance)}</td><td>${n(f.interacciones)}</td><td>${n(f.vistas)}</td></tr>`).join('')}</tbody>
        </table>
      </details>
      <p class="pie">Generado por Rubrofy · alcance = suma de las cuentas alcanzadas cada día · Instagram entrega las métricas con hasta 48 horas de atraso</p>
    `;

    const fechas = [];
    const [a, m, dd] = d.desde.split('-').map(Number);
    for (let i = 0; ; i++) {
      const f = new Date(Date.UTC(a, m - 1, dd + i)).toISOString().slice(0, 10);
      if (f > d.hasta) break;
      fechas.push(f);
    }
    const porFecha = new Map(r.serie.map((f) => [f.fecha, f]));
    const serie = (campo) => fechas.map((f) => ({ fecha: f, valor: porFecha.has(f) ? porFecha.get(f)[campo] : null }));
    main.querySelector('[data-graf="alcance"]').appendChild(G.serieTemporal(serie('alcance'), { etiqueta: 'Alcance', alto: 180 }));
    main.querySelector('[data-graf="interacciones"]').appendChild(G.serieTemporal(serie('interacciones'), { etiqueta: 'Interacciones', tipo: 'columnas', alto: 180 }));

    const enf = main.querySelector('[data-graf="enfoques"]');
    if (r.porEnfoque.length) {
      enf.appendChild(G.barras(r.porEnfoque.map((x) => ({ label: x.label, valor: x.promedioInteracciones, detalle: `${x.posts} publicaciones` }))));
    } else {
      enf.innerHTML = '<p class="vacio">Sin publicaciones de Rubrofy con métricas este mes.</p>';
    }
    const h = d.horario;
    main.querySelector('[data-texto="horario"]').innerHTML = h.mejor
      ? `El <b>${h.mejor.diaLabel} en la ${h.mejor.franjaLabel}</b> logra ${h.mejor.factor.toLocaleString('es-CL')}× la interacción promedio (últimos 90 días).`
      : 'Todavía no hay un horario que destaque (se necesitan al menos 8 publicaciones).';
    if (h.postsAnalizados) main.querySelector('[data-graf="horario"]').appendChild(G.mapaCalor(h.celdas, DIAS, FRANJAS, RAMPA_CLARA));

    const extra = main.querySelector('#secciones-extra');
    for (const [nombre, datos] of Object.entries(d.secciones || {})) {
      if (secciones[nombre]) extra.appendChild(secciones[nombre](datos, d));
    }
  }

  async function cargar() {
    $('#informe').innerHTML = '<p class="cargando">Cargando informe…</p>';
    try {
      if (!negocioId) negocioId = (await api('/api/me')).id;
      const qs = new URLSearchParams({ mes });
      if (token) qs.set('t', token);
      pintar(await api(`/api/negocios/${encodeURIComponent(negocioId)}/informe?${qs}`));
    } catch (err) {
      $('#informe').innerHTML = `<p class="error">${e(err.message)}${compartido ? '' : ' · <a href="/app">Ir al panel</a>'}</p>`;
    }
  }

  function mesActual() {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
    return `${p.find((x) => x.type === 'year').value}-${p.find((x) => x.type === 'month').value}`;
  }

  function iniciar() {
    if (!mes) mes = mesActual();
    const sel = $('#mes');
    const [a, m] = mesActual().split('-').map(Number);
    const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(a, m - 1 - i, 1));
      const v = d.toISOString().slice(0, 7);
      sel.insertAdjacentHTML('beforeend', `<option value="${v}"${v === mes ? ' selected' : ''}>${nombres[d.getUTCMonth()]} ${d.getUTCFullYear()}</option>`);
    }
    if (compartido) {
      sel.closest('label').hidden = true;
      document.querySelector('.volver').hidden = true;
    } else {
      $('#btn-conclusion').hidden = false;
      $('#btn-enlace').hidden = false;
    }
    sel.addEventListener('change', () => {
      mes = sel.value;
      history.replaceState(null, '', `?mes=${mes}`);
      cargar();
    });
    $('#btn-imprimir').addEventListener('click', () => window.print());
    $('#btn-conclusion').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      $('#barra-msg').textContent = 'Escribiendo la conclusión…';
      try {
        pintar(await api(`/api/negocios/${encodeURIComponent(negocioId)}/informe/conclusion`, { method: 'POST', body: JSON.stringify({ mes }) }));
        $('#barra-msg').textContent = '';
      } catch (err) {
        $('#barra-msg').textContent = err.message;
      }
      ev.target.disabled = false;
    });
    $('#btn-enlace').addEventListener('click', async () => {
      try {
        const r = await api(`/api/negocios/${encodeURIComponent(negocioId)}/informe/enlace`, { method: 'POST', body: JSON.stringify({ mes }) });
        await navigator.clipboard.writeText(r.url).catch(() => prompt('Copia este enlace:', r.url));
        $('#barra-msg').textContent = `Enlace copiado · válido hasta el ${new Date(r.venceEl).toLocaleDateString('es-CL')}`;
      } catch (err) {
        $('#barra-msg').textContent = err.message;
      }
    });
    cargar();
  }

  // --- secciones de publicidad (Meta Ads y Google Ads comparten forma) ---
  function dinero(v, moneda) {
    if (v == null) return '–';
    try {
      return Number(v).toLocaleString('es-CL', { style: 'currency', currency: moneda || 'CLP', maximumFractionDigits: (moneda || 'CLP') === 'CLP' ? 0 : 2 });
    } catch (err) {
      return Math.round(v).toLocaleString('es-CL');
    }
  }
  function seccionAds(titulo, textoResultados) {
    return (datos) => {
      const div = document.createElement('section');
      div.className = 'card';
      const t = datos.total;
      const m = datos.moneda;
      const pct = (v) => (v == null ? '–' : (v * 100).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + '%');
      div.innerHTML = `
        <h2>${titulo}${datos.cuenta ? ` · ${e(datos.cuenta)}` : ''}</h2>
        <div class="kpis">
          ${kpi('Inversión', dinero(t.gasto, m), n(t.impresiones) + ' impresiones')}
          ${kpi('Resultados', n(t.resultados), textoResultados)}
          ${kpi('Costo por resultado', dinero(t.costoPorResultado, m), '')}
          ${kpi('Clics', n(t.clics), 'CTR ' + pct(t.ctr))}
          ${kpi('Retorno (ROAS)', t.roas == null ? '–' : t.roas.toLocaleString('es-CL', { maximumFractionDigits: 2 }) + '×', t.valorCompras ? dinero(t.valorCompras, m) + ' en ventas' : '')}
        </div>
        ${datos.campanas.length ? `<table class="tabla" style="margin-top:12px">
          <thead><tr><th>Campaña</th><th>Inversión</th><th>Clics</th><th>Resultados</th><th>Costo / resultado</th></tr></thead>
          <tbody>${datos.campanas.slice(0, 8).map((c) => `<tr><td>${e(c.nombre || c.id)}</td><td>${dinero(c.gasto, m)}</td><td>${n(c.clics)}</td><td>${n(c.resultados)}</td><td>${dinero(c.costoPorResultado, m)}</td></tr>`).join('')}</tbody>
        </table>` : '<p class="vacio">Sin campañas con actividad este mes.</p>'}
        ${cambiosDelMes(datos.cambios, m)}
        ${datos.aprendido && datos.aprendido.length ? `<h3 class="sub-h">Lo que aprendimos de tus anuncios</h3><ul class="lista-aprendido">${datos.aprendido.map((f) => `<li>${e(f)}</li>`).join('')}</ul>` : ''}`;
      return div;
    };
  }
  // Cambios que el dueño hizo en Meta este mes (publicidad que aprende) y si funcionaron.
  function cambiosDelMes(cambios, m) {
    if (!cambios || !cambios.length) return '';
    const veredicto = { mejoro: 'Funcionó', empeoro: 'No mejoró', igual: 'Sin cambio claro', sin_datos: 'Sin datos suficientes' };
    const signo = (v) => (v == null ? '' : ` (${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} %)`);
    const fila = (c) => {
      let r = c.resultado ? veredicto[c.resultado] : 'Midiendo';
      if (c.resultado && c.resultado !== 'sin_datos' && c.metrica === 'cpr' && c.antes && c.despues && c.antes.valor != null && c.despues.valor != null) {
        r += `: ${dinero(c.antes.valor, m)} → ${dinero(c.despues.valor, m)} por resultado${signo(c.variacion)}`;
      } else if (c.resultado && c.resultado !== 'sin_datos' && c.variacion != null) r += signo(c.variacion);
      return `<tr><td>${e(c.titulo)}</td><td>${new Date(c.hechoEl + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</td><td>${e(r)}</td></tr>`;
    };
    return `<h3 class="sub-h">Cambios que hiciste este mes</h3>
      <table class="tabla"><thead><tr><th>Recomendación</th><th>Hecho</th><th>Resultado (7 días antes y después)</th></tr></thead>
      <tbody>${cambios.map(fila).join('')}</tbody></table>`;
  }
  secciones.metaAds = seccionAds('Publicidad en Meta', 'compras, formularios y conversaciones');
  secciones.googleAds = seccionAds('Publicidad en Google', 'conversiones');

  secciones.competencia = (datos) => {
    const div = document.createElement('section');
    div.className = 'card';
    div.innerHTML = `<h2>Tu cuenta frente a la competencia</h2>
      <p class="nota">Datos públicos de Instagram. Interacción = me gusta + comentarios promedio de las últimas 12 publicaciones.</p>
      <table class="tabla"><thead><tr><th>Cuenta</th><th>Seguidores</th><th>Variación 30 días</th><th>Posts 30 días</th><th>Interacción / post</th></tr></thead>
      <tbody>${datos.filas.map((f) => `<tr><td>${f.propio ? '<b>Tú</b>' : '@' + e(f.username)}</td><td>${n(f.seguidores)}</td>
        <td>${f.variacionSeguidores == null ? '–' : (f.variacionSeguidores > 0 ? '+' : '') + n(f.variacionSeguidores)}</td>
        <td>${f.posts30d == null ? '–' : f.posts30d}</td><td>${n(f.interaccionPromedio)}</td></tr>`).join('')}</tbody></table>`;
    return div;
  };

  window.RubrofyInforme = { secciones, kpi, variacionHTML };
  iniciar();
})();
