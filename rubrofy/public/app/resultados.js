// Vista "Resultados": métricas de Instagram del período, qué enfoques y
// horarios funcionan, las mejores publicaciones y cuánto aprueba el dueño
// lo que propone la IA sin cambios. Los datos vienen de /api/negocios/:id/analitica.
(function () {
  const G = () => window.RubrofyGraficos;
  let dias = 30;

  const DIAS_SEMANA = [
    { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' }, { id: 3, label: 'Miércoles' }, { id: 4, label: 'Jueves' },
    { id: 5, label: 'Viernes' }, { id: 6, label: 'Sábado' }, { id: 0, label: 'Domingo' },
  ];
  const FRANJAS = [{ id: 'manana', label: 'mañana' }, { id: 'tarde', label: 'tarde' }, { id: 'noche', label: 'noche' }];
  const FORMATOS = { IMAGE: 'Foto', CAROUSEL_ALBUM: 'Carrusel', VIDEO: 'Video', REELS: 'Reel' };

  function hace(iso) {
    if (!iso) return 'nunca';
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (min < 1) return 'recién';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
  }

  function tile(label, valor, extra) {
    return `<div class="kpi"><span class="kpi-label">${label}</span><b class="kpi-valor">${valor}</b>${extra ? `<span class="kpi-extra">${extra}</span>` : ''}</div>`;
  }

  function delta(v) {
    if (v == null) return '';
    if (v === 0) return 'sin cambio en el período';
    return `<span class="${v > 0 ? 'sube' : 'baja'}">${v > 0 ? '▲ +' : '▼ '}${G().numero(v)}</span> en el período`;
  }

  function aviso(texto, clase) {
    return `<div class="res-aviso ${clase || ''}">${texto}</div>`;
  }

  async function render(cont, ctx) {
    const { api, negocio, planes, irA } = ctx;
    const plan = (planes || []).find((p) => p.id === (negocio.plan || 'gratis'));
    if (!plan || !plan.analitica) {
      cont.innerHTML = aviso('Resultados muestra el alcance, la interacción y qué publicaciones te funcionan mejor, y con eso la IA aprende a escribir lo que le sirve a tu negocio. Está disponible en los planes <b>Pro</b> y <b>Estudio</b>. <button class="btn-approve" data-res="plan">Ver planes</button>');
      cont.querySelector('[data-res="plan"]').addEventListener('click', () => irA('config'));
      return;
    }
    if (!negocio.instagramConectado) {
      cont.innerHTML = aviso('Conecta Instagram en Configuración para empezar a medir tus resultados. <button class="btn-approve" data-res="config">Conectar</button>');
      cont.querySelector('[data-res="config"]').addEventListener('click', () => irA('config'));
      return;
    }

    cont.innerHTML = '<p class="sub">Cargando resultados…</p>';
    let datos;
    try {
      datos = await api(`/api/negocios/${negocio.id}/analitica?dias=${dias}`);
    } catch (err) {
      cont.innerHTML = aviso(G().escapar(err.mensaje || 'No se pudieron cargar los resultados.'), 'error');
      return;
    }
    pintar(cont, datos, ctx);
  }

  function pintar(cont, datos, ctx) {
    const g = G();
    const r = datos.resumen;
    const sync = datos.sync;
    const sinDatos = !r.serie.length && !r.topPosts.length;

    let estado = `Actualizado ${hace(sync && sync.ultima_ok)}`;
    if (!sync) estado = 'Primera actualización en curso: los datos aparecen en unos minutos.';
    const errorSync = sync && sync.error
      ? aviso(g.escapar(sync.detalle || 'No se pudieron actualizar los datos.'), 'error') : '';

    const ap = datos.aprobacion;
    cont.innerHTML = `
      <div class="res-controles">
        <div class="segmentado" role="group" aria-label="Período">
          ${[7, 30, 90].map((d) => `<button data-dias="${d}" class="${d === dias ? 'activo' : ''}">${d} días</button>`).join('')}
        </div>
        <span class="res-estado">${estado}</span>
        <button class="btn-ghost" data-res="sync">Actualizar ahora</button>
      </div>
      ${errorSync}
      <div class="kpis">
        ${tile('Seguidores', g.numero(r.seguidores), delta(r.seguidoresDelta))}
        ${tile('Alcance', g.numero(r.alcance), 'cuentas alcanzadas, suma diaria')}
        ${tile('Interacciones', g.numero(r.interacciones), 'me gusta, comentarios, guardados y compartidos')}
        ${tile('Tasa de interacción', r.tasaInteraccion == null ? '–' : (r.tasaInteraccion * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '%', 'interacciones sobre alcance')}
        ${tile('Aprobado sin cambios', ap.porcentajeSinCambios == null ? '–' : ap.porcentajeSinCambios + '%', ap.aprobadas ? `${ap.sinCambios} de ${ap.aprobadas} piezas aprobadas` : 'aún no apruebas piezas en el período')}
      </div>
      ${sinDatos ? aviso('Todavía no hay datos de este período. Instagram entrega las métricas con hasta 48 horas de atraso.') : ''}
      <div class="res-grid">
        <div class="res-card"><h2>Alcance diario</h2><div data-graf="alcance"></div></div>
        <div class="res-card"><h2>Interacciones diarias</h2><div data-graf="interacciones"></div></div>
        <div class="res-card">
          <h2>Qué enfoques funcionan</h2>
          <p class="sub">Interacciones promedio por publicación, según el enfoque con que la escribió Rubrofy.</p>
          <div data-graf="enfoques"></div>
        </div>
        <div class="res-card">
          <h2>Cuándo publicar</h2>
          <p class="sub" data-texto="horario"></p>
          <div data-graf="horario"></div>
        </div>
      </div>
      <div class="res-card">
        <h2>Tus mejores publicaciones</h2>
        <div data-lista="top"></div>
      </div>
      <details class="res-tabla">
        <summary>Ver los datos diarios como tabla</summary>
        <table>
          <thead><tr><th>Fecha</th><th>Seguidores</th><th>Alcance</th><th>Interacciones</th><th>Vistas</th></tr></thead>
          <tbody>${r.serie.map((f) => `<tr><td>${g.fechaCorta(f.fecha)}</td><td>${g.numero(f.seguidores)}</td><td>${g.numero(f.alcance)}</td><td>${g.numero(f.interacciones)}</td><td>${g.numero(f.vistas)}</td></tr>`).join('')}</tbody>
        </table>
      </details>
    `;

    // series completas del período (días sin fila = sin dato)
    const fechas = [];
    const [a, m, d] = r.desde.split('-').map(Number);
    for (let i = 0; i < datos.dias; i++) fechas.push(new Date(Date.UTC(a, m - 1, d + i)).toISOString().slice(0, 10));
    const porFecha = new Map(r.serie.map((f) => [f.fecha, f]));
    const serie = (campo) => fechas.map((f) => ({ fecha: f, valor: porFecha.has(f) ? porFecha.get(f)[campo] : null }));
    cont.querySelector('[data-graf="alcance"]').appendChild(g.serieTemporal(serie('alcance'), { etiqueta: 'Alcance', tipo: 'linea' }));
    cont.querySelector('[data-graf="interacciones"]').appendChild(g.serieTemporal(serie('interacciones'), { etiqueta: 'Interacciones', tipo: 'columnas' }));

    const enfoques = cont.querySelector('[data-graf="enfoques"]');
    if (r.porEnfoque.length) {
      enfoques.appendChild(g.barras(r.porEnfoque.map((e) => ({
        label: e.label, valor: e.promedioInteracciones, detalle: `${e.posts} publicación${e.posts === 1 ? '' : 'es'}, alcance promedio ${g.numero(e.promedioAlcance)}`,
      }))));
    } else {
      enfoques.innerHTML = '<p class="sub vacio">Aparece cuando haya publicaciones hechas con Rubrofy y con métricas.</p>';
    }

    const h = datos.horario;
    const textoHorario = cont.querySelector('[data-texto="horario"]');
    if (h.mejor) {
      textoHorario.innerHTML = `Tus publicaciones del <b>${h.mejor.diaLabel} en la ${h.mejor.franjaLabel}</b> logran <b>${h.mejor.factor.toLocaleString('es-CL')}×</b> la interacción promedio. Rubrofy ya programa tus próximos posts a las ${h.mejor.hora}.`;
    } else if (h.postsAnalizados < 8) {
      textoHorario.textContent = `Con ${h.postsAnalizados} publicaciones analizadas todavía no hay una tendencia clara (se necesitan al menos 8).`;
    } else {
      textoHorario.textContent = 'Por ahora ningún horario destaca claramente sobre los demás.';
    }
    if (h.postsAnalizados) {
      cont.querySelector('[data-graf="horario"]').appendChild(g.mapaCalor(h.celdas, DIAS_SEMANA, FRANJAS));
    }

    const top = cont.querySelector('[data-lista="top"]');
    top.innerHTML = r.topPosts.length ? r.topPosts.map((p) => `
      <div class="top-post">
        <div class="top-post-meta">
          <span>${g.fechaCorta(p.publicado_el.slice(0, 10))} · ${FORMATOS[p.tipo === 'REELS' ? 'REELS' : p.formato] || 'Post'}</span>
          ${p.permalink ? `<a href="${g.escapar(p.permalink)}" target="_blank" rel="noopener">Ver en Instagram</a>` : ''}
        </div>
        <p>${g.escapar((p.caption || '(sin texto)').slice(0, 180))}</p>
        <div class="top-post-cifras">
          <span><b>${g.numero(p.interacciones)}</b> interacciones</span>
          <span><b>${g.numero(p.alcance)}</b> alcance</span>
          <span><b>${g.numero(p.guardados)}</b> guardados</span>
          <span><b>${g.numero(p.compartidos)}</b> compartidos</span>
        </div>
      </div>`).join('') : '<p class="sub vacio">Todavía no hay publicaciones con métricas en este período.</p>';

    cont.querySelectorAll('[data-dias]').forEach((b) => b.addEventListener('click', () => {
      dias = Number(b.dataset.dias);
      render(cont, ctx);
    }));
    cont.querySelector('[data-res="sync"]').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      ev.target.textContent = 'Actualizando…';
      try {
        await ctx.api(`/api/negocios/${ctx.negocio.id}/analitica/sincronizar`, { method: 'POST' });
      } catch (err) {
        alert(err.mensaje || 'No se pudo actualizar.');
      }
      render(cont, ctx);
    });
  }

  window.RubrofyResultados = { render };
})();
