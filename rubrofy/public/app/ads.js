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
        <div class="kpi"><span class="kpi-label">Inversión</span><b class="kpi-valor">${dinero(t.gasto, moneda)}</b><span class="kpi-extra">${g.numero(t.impresiones)} impresiones</span></div>
        <div class="kpi"><span class="kpi-label">Resultados</span><b class="kpi-valor">${g.numero(t.resultados)}</b><span class="kpi-extra">${f.resultados}</span></div>
        <div class="kpi"><span class="kpi-label">Costo por resultado</span><b class="kpi-valor">${dinero(t.costoPorResultado, moneda)}</b><span class="kpi-extra">inversión / resultados</span></div>
        <div class="kpi"><span class="kpi-label">Clics</span><b class="kpi-valor">${g.numero(t.clics)}</b><span class="kpi-extra">CTR ${pct(t.ctr)} · CPC ${dinero(t.cpc, moneda)}</span></div>
        <div class="kpi"><span class="kpi-label">Retorno (ROAS)</span><b class="kpi-valor">${veces(t.roas)}</b><span class="kpi-extra">${t.valorCompras ? dinero(t.valorCompras, moneda) + ' en ventas atribuidas' : 'sin ventas atribuidas en el período'}</span></div>
      </div>
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
    `;

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

  window.RubrofyAds = { render, dinero };
})();
