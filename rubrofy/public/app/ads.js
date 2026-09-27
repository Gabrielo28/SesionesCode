// Panel de publicidad (solo lectura) compartido por Meta Ads y Google Ads:
// gasto, resultados, costo por resultado, gasto y resultados por día y una
// tabla por campaña. Las dos fuentes entregan la misma forma de datos.
(function () {
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');
  const G = () => window.RubrofyGraficos;
  const FUENTES = {
    meta: { ruta: 'ads', nombre: 'Meta Ads', resultados: 'compras, formularios y conversaciones iniciadas' },
    google: { ruta: 'google-ads', nombre: 'Google Ads', resultados: 'conversiones registradas en Google Ads' },
  };
  const dias = { meta: 30, google: 30 };

  function dinero(v, moneda) {
    if (v == null) return '–';
    try {
      return Number(v).toLocaleString('es-CL', { style: 'currency', currency: moneda || 'CLP', maximumFractionDigits: moneda === 'CLP' || !moneda ? 0 : 2 });
    } catch (err) {
      return Math.round(v).toLocaleString('es-CL');
    }
  }
  const pct = (v) => (v == null ? '–' : (v * 100).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + '%');
  const veces = (v) => (v == null ? '–' : v.toLocaleString('es-CL', { maximumFractionDigits: 2 }) + '×');

  // Variación contra el período anterior. menosEsMejor: costos (bajar es bueno).
  function delta(v, menosEsMejor, dias) {
    if (v == null || !isFinite(v)) return '';
    const bueno = menosEsMejor ? v < 0 : v > 0;
    const txt = `${v > 0 ? '▲' : (v < 0 ? '▼' : '=')} ${Math.abs(Math.round(v * 100))} %`;
    return ` <span class="delta ${Math.abs(v) < 0.005 ? '' : (bueno ? 'sube' : 'baja')}" title="Contra los ${dias} días anteriores">${txt}</span>`;
  }

  function hallazgos(lista, e) {
    if (!lista || !lista.length) return '';
    const icono = { alerta: '!', idea: '→', bien: '✓' };
    return `<div class="res-card diag">
      <h2>Diagnóstico${AY('diagnostico')}</h2>
      <ul class="diag-lista">${lista.map((h) => `<li class="diag-${h.nivel}">
        <span class="diag-icono" aria-hidden="true">${icono[h.nivel]}</span>
        <div><b>${e(h.titulo)}</b><span>${e(h.detalle)}</span>${h.accion ? `<span class="diag-accion">${e(h.accion)}</span>` : ''}</div>
      </li>`).join('')}</ul>
    </div>`;
  }

  function aviso(html, clase) {
    return `<div class="res-aviso ${clase || ''}">${html}</div>`;
  }

  async function render(cont, ctx, fuente) {
    const f = FUENTES[fuente];
    cont.innerHTML = '<p class="sub">Cargando…</p>';
    let d;
    try {
      d = await ctx.api(`/api/negocios/${ctx.negocio.id}/${f.ruta}?dias=${dias[fuente]}`);
    } catch (err) {
      const irConfig = err.status === 400;
      cont.innerHTML = aviso(`${G().escapar(err.mensaje || 'No se pudieron cargar los datos.')}${irConfig ? ' <button class="btn-approve estilo-btn" data-ir="config">Ir a Conexiones</button>' : ''}`, err.status === 403 ? '' : 'error');
      const b = cont.querySelector('[data-ir]');
      if (b) b.addEventListener('click', () => ctx.irA('config'));
      return;
    }
    pintar(cont, d, ctx, fuente);
  }

  function pintar(cont, d, ctx, fuente) {
    const g = G();
    const f = FUENTES[fuente];
    const t = d.resumen.total;
    const v = d.variacion || {};
    const dlt = (k, menos) => (v.hayBase ? delta(v[k], menos, d.dias) : '');
    const moneda = (d.conexion && d.conexion.moneda) || 'CLP';
    const sync = d.sync;
    const estado = sync && sync.ultima_ok ? `Actualizado ${new Date(sync.ultima_ok).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}` : 'Primera actualización en curso.';

    cont.innerHTML = `
      <div class="res-controles">
        <div class="segmentado" role="group" aria-label="Período">
          ${[7, 30, 90].map((x) => `<button data-dias="${x}" class="${x === dias[fuente] ? 'activo' : ''}">${x} días</button>`).join('')}
        </div>
        <span class="res-estado">${g.escapar(d.conexion && (d.conexion.cuentaNombre || d.conexion.nombre) || '')} · ${estado}</span>
        <button class="btn-ghost" data-sync>Actualizar ahora</button>
      </div>
      ${sync && sync.error ? aviso(g.escapar(sync.detalle || 'No se pudo actualizar.'), 'error') : ''}
      <p class="res-ayuda">Cómo leer estos números ${AY('ads-numeros')} · Qué es esta sección ${AY('publicidad')}</p>
      <div class="kpis">
        <div class="kpi"><span class="kpi-label">Inversión</span><b class="kpi-valor">${dinero(t.gasto, moneda)}${dlt('gasto')}</b><span class="kpi-extra">${g.numero(t.impresiones)} impresiones</span></div>
        <div class="kpi"><span class="kpi-label">Resultados</span><b class="kpi-valor">${g.numero(t.resultados)}${dlt('resultados')}</b><span class="kpi-extra">${f.resultados}</span></div>
        <div class="kpi"><span class="kpi-label">Costo por resultado</span><b class="kpi-valor">${dinero(t.costoPorResultado, moneda)}${dlt('costoPorResultado', true)}</b><span class="kpi-extra">inversión / resultados</span></div>
        <div class="kpi"><span class="kpi-label">Clics</span><b class="kpi-valor">${g.numero(t.clics)}${dlt('clics')}</b><span class="kpi-extra">CTR ${pct(t.ctr)} · CPC ${dinero(t.cpc, moneda)}</span></div>
        <div class="kpi"><span class="kpi-label">Retorno (ROAS)</span><b class="kpi-valor">${veces(t.roas)}${dlt('roas')}</b><span class="kpi-extra">${t.valorCompras ? dinero(t.valorCompras, moneda) + ' en ventas atribuidas' : 'sin ventas atribuidas en el período'}</span></div>
      </div>
      ${v.hayBase ? `<p class="res-ayuda">Las flechas comparan con los ${d.dias} días anteriores.</p>` : ''}
      ${hallazgos(d.diagnostico, g.escapar)}
      ${t.gasto > 0 && !t.resultados ? aviso(`Se invirtieron ${dinero(t.gasto, moneda)} y no hay resultados registrados. Puede que las conversiones no estén bien configuradas (píxel, API de conversiones o seguimiento de WhatsApp): vale la pena revisarlo antes de seguir invirtiendo.`, 'error') : ''}
      <div class="res-grid">
        <div class="res-card"><h2>Inversión diaria${AY('res-graficos')}</h2><div data-graf="gasto"></div></div>
        <div class="res-card"><h2>Resultados diarios${AY('res-graficos')}</h2><div data-graf="resultados"></div></div>
      </div>
      <div class="res-card">
        <h2>Campañas${AY('campanas')}</h2>
        ${d.resumen.campanas.length ? `
        <div class="tabla-scroll"><table class="tabla-ads">
          <thead><tr><th>Campaña</th><th>Inversión</th><th>Clics</th><th>CTR</th><th>Resultados</th><th>Costo / resultado</th><th>ROAS</th></tr></thead>
          <tbody>${d.resumen.campanas.map((c) => `<tr>
            <td>${g.escapar(c.nombre || c.id)}${c.objetivo ? `<span class="tabla-sub">${g.escapar(c.objetivo)}</span>` : ''}</td>
            <td>${dinero(c.gasto, moneda)}</td><td>${g.numero(c.clics)}</td><td>${pct(c.ctr)}</td>
            <td>${g.numero(c.resultados)}</td><td>${dinero(c.costoPorResultado, moneda)}</td><td>${veces(c.roas)}</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="sub vacio">No hay campañas con actividad en el período.</p>'}
      </div>
      ${d.desgloses ? desglosesHtml(d.desgloses, moneda, g) : ''}
    `;
    if (d.desgloses) pintarDesgloses(cont, d.desgloses, moneda, g);

    const fechas = [];
    const hasta = d.resumen.hasta;
    const [a, m, dd] = d.resumen.desde.split('-').map(Number);
    for (let i = 0; ; i++) {
      const x = new Date(Date.UTC(a, m - 1, dd + i)).toISOString().slice(0, 10);
      if (x > hasta) break;
      fechas.push(x);
    }
    const porFecha = new Map(d.resumen.serie.map((x) => [x.fecha, x]));
    const serie = (campo) => fechas.map((x) => ({ fecha: x, valor: porFecha.has(x) ? porFecha.get(x)[campo] : 0 }));
    cont.querySelector('[data-graf="gasto"]').appendChild(g.serieTemporal(serie('gasto'), { etiqueta: 'Inversión', tipo: 'columnas', formato: (v) => dinero(v, moneda) }));
    cont.querySelector('[data-graf="resultados"]').appendChild(g.serieTemporal(serie('resultados'), { etiqueta: 'Resultados' }));

    cont.querySelectorAll('[data-dias]').forEach((b) => b.addEventListener('click', () => {
      dias[fuente] = Number(b.dataset.dias);
      render(cont, ctx, fuente);
    }));
    cont.querySelector('[data-sync]').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      ev.target.textContent = 'Actualizando…';
      try {
        await ctx.api(`/api/negocios/${ctx.negocio.id}/${f.ruta}/sincronizar?dias=${dias[fuente]}`, { method: 'POST' });
      } catch (err) {
        alert(err.mensaje || 'No se pudo actualizar.');
      }
      render(cont, ctx, fuente);
    });
  }

  // --- desgloses de Meta: anuncios, edad y sexo, ubicaciones ---
  function desglosesHtml(ds, moneda, g) {
    const e = g.escapar;
    const anuncios = ds.anuncios.slice(0, 12);
    return `
      <div class="res-card">
        <h2>Tus anuncios${AY('ads-anuncios')}</h2>
        ${anuncios.length ? `<div class="ads-anuncios">${anuncios.map((a, i) => `<article class="ad-ficha ${!a.resultados ? 'ad-sin' : (i === mejorIndice(anuncios) ? 'ad-mejor' : '')}">
          <div class="ad-mini">${a.miniatura ? `<img src="${e(a.miniatura)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
          <div class="ad-datos">
            <b title="${e(a.nombre)}">${e(a.nombre)}</b>
            ${a.campana ? `<span class="tabla-sub">${e(a.campana)}</span>` : ''}
            <dl>
              <div><dt>Inversión</dt><dd>${dinero(a.gasto, moneda)}</dd></div>
              <div><dt>Resultados</dt><dd>${g.numero(a.resultados)}</dd></div>
              <div><dt>Costo c/u</dt><dd>${dinero(a.costoPorResultado, moneda)}</dd></div>
              <div><dt>CTR</dt><dd>${pct(a.ctr)}</dd></div>
            </dl>
            ${!a.resultados ? '<span class="ad-etiqueta">Sin resultados</span>' : (i === mejorIndice(anuncios) ? '<span class="ad-etiqueta ad-etiqueta-mejor">El más rentable</span>' : '')}
          </div>
        </article>`).join('')}</div>` : '<p class="sub vacio">Todavía no hay datos por anuncio. Aparecen en la próxima actualización.</p>'}
      </div>
      <div class="res-grid">
        <div class="res-card"><h2>Costo por resultado según edad y sexo${AY('ads-publico')}</h2>
          ${ds.edadSexo.length ? '<p class="sub">Más claro = resultados más baratos. Pasa el mouse para ver el detalle.</p><div data-graf="edad"></div>' : '<p class="sub vacio">Sin datos de edad y sexo en el período.</p>'}</div>
        <div class="res-card"><h2>Costo por resultado según ubicación${AY('ads-ubicacion')}</h2>
          ${ds.ubicaciones.length ? '<p class="sub">Dónde se mostró tu anuncio. La barra rosada es la más barata.</p><div data-graf="ubicacion"></div>' : '<p class="sub vacio">Sin datos de ubicación en el período.</p>'}</div>
      </div>`;
  }

  function mejorIndice(anuncios) {
    let mejor = -1;
    anuncios.forEach((a, i) => {
      if (a.resultados >= 2 && a.costoPorResultado != null && (mejor < 0 || a.costoPorResultado < anuncios[mejor].costoPorResultado)) mejor = i;
    });
    return mejor;
  }

  function pintarDesgloses(cont, ds, moneda, g) {
    const edad = cont.querySelector('[data-graf="edad"]');
    if (edad) {
      const sexos = [...new Set(ds.edadSexo.map((f) => f.sexo))].sort((a, b) => ['female', 'male', 'unknown'].indexOf(a) - ['female', 'male', 'unknown'].indexOf(b));
      const edades = ds.edades.filter((x) => ds.edadSexo.some((f) => f.edad === x));
      const nombreSexo = (s) => (ds.edadSexo.find((f) => f.sexo === s) || {}).sexoNombre || s;
      // El mapa de calor pinta "más = más claro": se usa resultados por peso invertido.
      const celdas = ds.edadSexo.map((f) => ({ dia: f.edad, franja: f.sexo, posts: f.resultados, promedio: f.costoPorResultado ? 1 / f.costoPorResultado : null,
        texto: f.resultados ? `${nombreSexo(f.sexo)} ${f.edad}: ${dinero(f.costoPorResultado, moneda)} por resultado (${g.numero(f.resultados)} resultados, ${dinero(f.gasto, moneda)} invertidos)`
          : `${nombreSexo(f.sexo)} ${f.edad}: ${dinero(f.gasto, moneda)} invertidos sin resultados` }));
      edad.appendChild(g.mapaCalor(celdas, edades.map((x) => ({ id: x, label: x })), sexos.map((x) => ({ id: x, label: nombreSexo(x) })), null, (c) => c.texto));
    }
    const ub = cont.querySelector('[data-graf="ubicacion"]');
    if (ub) {
      const filas = ds.ubicaciones.map((f) => ({ label: f.nombre, valor: f.costoPorResultado, detalle: `${g.numero(f.resultados)} resultados · ${dinero(f.gasto, moneda)}` }));
      const con = filas.filter((f) => f.valor != null).sort((a, b) => a.valor - b.valor);
      const sin = filas.filter((f) => f.valor == null);
      const barras = g.barras(con, { formato: (x) => dinero(x, moneda) });
      ub.appendChild(barras);
      if (sin.length) {
        const p = document.createElement('p');
        p.className = 'sub';
        p.textContent = `Sin resultados: ${sin.map((f) => `${f.label} (${f.detalle.split(' · ')[1]})`).join(', ')}.`;
        ub.appendChild(p);
      }
    }
  }

  window.RubrofyAds = { render, dinero };
})();
