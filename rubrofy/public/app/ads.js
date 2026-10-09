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

  // --- publicidad que aprende (ver server/aprendizaje-ads.js) ---
  const fechaCorta = (f) => (f ? new Date(f.length === 10 ? f + 'T12:00:00' : f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '');
  const signo = (v) => (v == null ? '' : `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} %`);
  const numDia = (v) => (v == null ? '–' : v.toLocaleString('es-CL', { maximumFractionDigits: 1 }));
  // Cómo supo Rubrofy que el cambio se hizo.
  const COMO = {
    dueno: 'Marcaste que lo hiciste', apagada: 'Rubrofy vio que pausaste la campaña', objetivo: 'Rubrofy vio que cambiaste el objetivo',
    sinGasto: 'Rubrofy vio que dejó de gastar', presupuesto: 'Rubrofy vio que cambiaste el presupuesto', reparto: 'Rubrofy vio que moviste el presupuesto',
    anuncioNuevo: 'Rubrofy vio un anuncio nuevo', anuncioApagado: 'Rubrofy vio que apagaste el anuncio', masGasto: 'Rubrofy vio que subiste la inversión',
  };
  // "costo −36 %", "clics +40 %"…: lo que mejoró la vez que funcionó.
  function textoMejora(x) {
    if (x.variacion == null) return 'funcionó';
    return { cpr: 'costo', ctr: 'clics', roas: 'retorno', resultados: 'resultados', escala: 'resultados' }[x.metrica] + ' ' + signo(x.variacion);
  }
  // Lo que pasó la última vez que no funcionó.
  function textoPrevio(x) {
    const cuanto = x.variacion == null ? '' : ` (${signo(x.variacion)})`;
    const que = { cpr: 'el costo por resultado', ctr: 'los clics', roas: 'el retorno', resultados: 'los resultados', escala: 'el costo por resultado' }[x.metrica] || 'el resultado';
    if (x.resultado === 'empeoro') return x.metrica === 'cpr' || x.metrica === 'escala' ? `${que} subió${cuanto}` : `${que} bajaron${cuanto}`;
    return x.metrica === 'cpr' || x.metrica === 'escala' ? `${que} no bajó` : `${que} no subieron`;
  }

  function itemHallazgo(h, e) {
    const icono = { alerta: '!', idea: '→', bien: '✓' };
    const s = h.seguimiento;
    let pie = '';
    if (h.enlace) {
      if (s && s.estado === 'midiendo') {
        pie = `<span class="diag-seg diag-seg-hecho">✓ ${e(COMO[s.como] || 'Lo hiciste')} el ${fechaCorta(s.hechoEl)}. Rubrofy está midiendo si funcionó: lo verás en "Tus cambios" el ${fechaCorta(s.resultadoEl)}.</span>`;
      } else {
        pie = `<span class="diag-ir"><a class="btn-meta-cambio" href="${e(h.enlace)}" target="_blank" rel="noopener" data-abrir="${e(h.clave || '')}">Hacer este cambio en Meta <span aria-hidden="true">↗</span></a>
            ${h.pieza ? `<button type="button" class="btn-ghost btn-pieza" data-pieza="${e(h.clave)}">Crear esta pieza en Rubrofy</button>` : ''}
            <small>Abre ${e(h.destino.que)} en el Administrador de anuncios de Meta.</small></span>
          ${h.clave ? `<span class="diag-seg">${s && s.estado === 'abierto' ? `Lo abriste en Meta el ${fechaCorta(s.abiertoEl)}. ¿Ya lo hiciste? ` : ''}<button type="button" class="link-btn" data-hecho="${e(h.clave)}">Ya lo hice</button> · <button type="button" class="link-btn" data-descartar="${e(h.clave)}">No me sirve</button></span>` : ''}`;
      }
    }
    return `<li class="diag-${h.nivel}" data-clave="${e(h.clave || '')}">
        <span class="diag-icono" aria-hidden="true">${icono[h.nivel]}</span>
        <div><b>${e(h.titulo)}</b>${h.funciono ? `<span class="diag-funciono">Te funcionó antes: ${e(textoMejora(h.funciono))}</span>` : ''}<span>${e(h.detalle)}</span>
          ${h.previo ? `<span class="diag-previo">La última vez que lo hiciste (${fechaCorta(h.previo.hechoEl)}) ${e(textoPrevio(h.previo))}, así que esta vez te proponemos otra cosa.</span>` : ''}
          ${h.accion ? `<span class="diag-accion">${e(h.accion)}</span>` : ''}
          ${pie}</div>
      </li>`;
  }

  function notaOcultas(n) {
    return n ? `<p class="diag-nota diag-ocultas">${n === 1 ? 'Ocultamos 1 recomendación que marcaste' : `Ocultamos ${n} recomendaciones que marcaste`} como "No me sirve". <button type="button" class="link-btn" data-mostrar-ocultas>Volver a mostrarlas</button></p>` : '';
  }

  function hallazgos(lista, e, ocultas) {
    if ((!lista || !lista.length) && !ocultas) return '';
    return `<div class="res-card diag">
      <h2>Diagnóstico${AY('diagnostico')}</h2>
      ${lista && lista.length ? `<ul class="diag-lista">${lista.map((h) => itemHallazgo(h, e)).join('')}</ul>` : '<p class="sub vacio">No hay recomendaciones nuevas.</p>'}
      ${(lista || []).some((h) => h.enlace) ? '<p class="diag-nota">Rubrofy no cambia tus anuncios: el botón te lleva al lugar exacto en Meta para que lo hagas tú. Después Rubrofy detecta el cambio y mide si funcionó.</p>' : ''}
      ${notaOcultas(ocultas)}
    </div>`;
  }

  // Lo que mostró la medición de un cambio.
  function medida(c, moneda) {
    const a = c.antes || {};
    const d = c.despues || {};
    if (c.resultado === 'sin_datos') return 'No hubo inversión suficiente antes o después del cambio para comparar.';
    if (c.metrica === 'cpr') {
      if (a.valor == null && d.valor != null) return `Antes no había resultados; después, ${dinero(d.valor, moneda)} por resultado.`;
      if (d.valor == null) return 'Después del cambio no hubo resultados.';
      return `Costo por resultado: ${dinero(a.valor, moneda)} → ${dinero(d.valor, moneda)} (${signo(c.variacion)})`;
    }
    if (c.metrica === 'ctr') return `CTR: ${pct(a.valor)} → ${pct(d.valor)}${c.variacion == null ? '' : ` (${signo(c.variacion)})`}`;
    if (c.metrica === 'roas') return `Retorno: ${veces(a.valor)} → ${veces(d.valor)}${c.variacion == null ? '' : ` (${signo(c.variacion)})`}`;
    if (c.metrica === 'escala') {
      return `Resultados por día: ${numDia(a.valor)} → ${numDia(d.valor)}${c.variacion == null ? '' : ` (${signo(c.variacion)})`}`
        + (a.costo != null && d.costo != null ? ` · costo por resultado ${dinero(a.costo, moneda)} → ${dinero(d.costo, moneda)}` : '');
    }
    return `Resultados por día: ${numDia(a.valor)} → ${numDia(d.valor)}${c.variacion == null ? '' : ` (${signo(c.variacion)})`}`;
  }

  function cambiosHtml(d, e, moneda) {
    const lista = d.cambios || [];
    const r = d.resumenCambios || { medidos: 0, funcionaron: 0 };
    if (!lista.length && !r.medidos) return '';
    const NOMBRE = { mejoro: 'Funcionó', empeoro: 'No mejoró', igual: 'Sin cambio claro', sin_datos: 'Sin datos suficientes' };
    const ICONO = { mejoro: '✓', empeoro: '✗', igual: '=', sin_datos: '?' };
    const item = (c) => {
      let clase = 'cambio-espera';
      let icono = '…';
      let estado;
      let detalle = '';
      let acciones = '';
      if (c.estado === 'abierto') {
        estado = `Lo abriste en Meta el ${fechaCorta(c.abiertoEl)}. Rubrofy detecta solo si lo hiciste; si no, márcalo tú.`;
        acciones = `<span class="cambio-acciones">${c.enlace ? `<a href="${e(c.enlace)}" target="_blank" rel="noopener">Abrir en Meta ↗</a> · ` : ''}<button type="button" class="link-btn" data-cambio="${c.id}" data-accion="hecho">Ya lo hice</button> · <button type="button" class="link-btn" data-cambio="${c.id}" data-accion="descartar">No me sirve</button></span>`;
      } else if (!c.resultado) {
        estado = `${COMO[c.como] || 'Lo hiciste'} el ${fechaCorta(c.hechoEl)}. El resultado estará el ${fechaCorta(c.resultadoEl)}.`;
      } else if (!c.cerrado) {
        estado = `${COMO[c.como] || 'Lo hiciste'} el ${fechaCorta(c.hechoEl)}. Hasta ahora (${c.dias} días):`;
        detalle = medida(c, moneda);
        detalle += `. Resultado final el ${fechaCorta(c.resultadoEl)}.`;
      } else {
        clase = 'cambio-' + c.resultado;
        icono = ICONO[c.resultado] || '?';
        estado = `<b class="cambio-veredicto">${NOMBRE[c.resultado] || ''}</b> · ${e(COMO[c.como] || 'Lo hiciste')} el ${fechaCorta(c.hechoEl)}`;
        detalle = medida(c, moneda);
      }
      return `<li class="${clase}">
        <span class="cambio-icono" aria-hidden="true">${icono}</span>
        <div><b>${e(c.titulo)}</b><span>${c.cerrado ? estado : e(estado)}</span>${detalle ? `<span class="cambio-medida">${e(detalle)}</span>` : ''}${acciones}</div>
      </li>`;
    };
    return `<div class="res-card cambios">
      <h2>Tus cambios${AY('ads-cambios')}</h2>
      <p class="sub">${r.medidos ? `De ${r.medidos} ${r.medidos === 1 ? 'cambio medido' : 'cambios medidos'}, ${r.funcionaron} ${r.funcionaron === 1 ? 'funcionó' : 'funcionaron'}. Rubrofy usa esto para ordenar tus próximas recomendaciones.`
        : 'Rubrofy compara los 7 días antes de cada cambio con los 7 días después y te dice si funcionó.'}</p>
      ${lista.length ? `<ul class="cambios-lista">${lista.map(item).join('')}</ul>` : ''}
    </div>`;
  }

  function aprendidoHtml(a, e) {
    if (!a || !a.frases || !a.frases.length) return '';
    return `<div class="res-card aprendido">
      <h2>Lo que Rubrofy aprendió de tus anuncios${AY('ads-aprendido')}</h2>
      <ul class="aprendido-lista">${a.frases.map((f) => `<li>${e(f)}</li>`).join('')}</ul>
      <p class="sub">${a.usaIA ? 'Rubrofy ya usa esto al escribir tus publicaciones. ' : ''}Con datos de los últimos 60 días.</p>
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
      ${hallazgos(d.diagnostico, g.escapar, d.ocultas)}
      ${cambiosHtml(d, g.escapar, moneda)}
      ${aprendidoHtml(d.aprendido, g.escapar)}
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
    conectarAprendizaje(cont, d, ctx, fuente);
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

  // Botones de la publicidad que aprende: abrir en Meta (queda registrado),
  // "Ya lo hice", "No me sirve", "Crear esta pieza en Rubrofy" y "Tus cambios".
  function conectarAprendizaje(cont, d, ctx, fuente) {
    const f = FUENTES[fuente];
    const ruta = `/api/negocios/${ctx.negocio.id}/${f.ruta}`;
    const e = G().escapar;
    const enviar = (body) => ctx.api(`${ruta}/cambios`, { method: 'POST', body: JSON.stringify(Object.assign({ dias: dias[fuente] }, body)) });
    const reemplazar = (li, h) => {
      if (!li) return;
      if (!h) { li.remove(); return; }
      const tmp = document.createElement('ul');
      tmp.innerHTML = itemHallazgo(h, e);
      li.replaceWith(tmp.firstElementChild);
    };
    const diag = cont.querySelector('.diag');
    if (diag) {
      diag.addEventListener('click', async (ev) => {
        const abrir = ev.target.closest('[data-abrir]');
        if (abrir) {
          // El enlace se abre igual; en paralelo queda registrado que lo abrió.
          if (!abrir.dataset.abrir) return;
          const li = abrir.closest('li');
          enviar({ clave: abrir.dataset.abrir, accion: 'abrir' }).then((r) => reemplazar(li, r.hallazgo)).catch(() => {});
          return;
        }
        const hecho = ev.target.closest('[data-hecho]');
        const descartar = ev.target.closest('[data-descartar]');
        if (hecho || descartar) {
          const b = hecho || descartar;
          const li = b.closest('li');
          b.disabled = true;
          try {
            const r = await enviar({ clave: b.dataset.hecho || b.dataset.descartar, accion: hecho ? 'hecho' : 'descartar' });
            if (descartar) {
              li.remove();
              const nota = diag.querySelector('.diag-ocultas');
              const nueva = document.createElement('div');
              nueva.innerHTML = notaOcultas(r.ocultas);
              if (nota) nota.replaceWith(nueva.firstElementChild || document.createTextNode(''));
              else if (nueva.firstElementChild) diag.appendChild(nueva.firstElementChild);
            } else {
              reemplazar(li, r.hallazgo);
            }
          } catch (err) {
            b.disabled = false;
            alert(err.mensaje || 'No se pudo guardar.');
          }
          return;
        }
        const pieza = ev.target.closest('[data-pieza]');
        if (pieza) {
          pieza.disabled = true;
          pieza.textContent = 'Creando…';
          try {
            await ctx.api(`${ruta}/pieza`, { method: 'POST', body: JSON.stringify({ clave: pieza.dataset.pieza, dias: dias[fuente] }) });
            const aviso = document.createElement('span');
            aviso.className = 'pieza-lista';
            aviso.innerHTML = 'Listo: la pieza quedó en Por aprobar. <button type="button" class="link-btn">Verla</button>';
            aviso.querySelector('button').addEventListener('click', () => ctx.irA('cola'));
            pieza.replaceWith(aviso);
            if (ctx.recargarContenido) ctx.recargarContenido();
          } catch (err) {
            pieza.disabled = false;
            pieza.textContent = 'Crear esta pieza en Rubrofy';
            alert(err.mensaje || 'No se pudo crear la pieza.');
          }
          return;
        }
        if (ev.target.closest('[data-mostrar-ocultas]')) {
          await enviar({ accion: 'mostrar-ocultas' }).catch(() => {});
          render(cont, ctx, fuente);
        }
      });
    }
    const cambios = cont.querySelector('.cambios');
    if (cambios) {
      cambios.addEventListener('click', async (ev) => {
        const b = ev.target.closest('[data-cambio]');
        if (!b) return;
        b.disabled = true;
        try {
          await enviar({ id: Number(b.dataset.cambio), accion: b.dataset.accion });
        } catch (err) {
          alert(err.mensaje || 'No se pudo guardar.');
        }
        render(cont, ctx, fuente);
      });
    }
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
