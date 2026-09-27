// Pestaña "Competencia": tu cuenta frente a hasta 5 competidores en
// Instagram (datos públicos vía Business Discovery) y enlace a sus anuncios
// en la Biblioteca de Anuncios de Meta.
(function () {
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');
  const G = () => window.RubrofyGraficos;

  async function render(cont, ctx) {
    cont.innerHTML = '<p class="sub">Cargando…</p>';
    try {
      pintar(cont, await ctx.api(`/api/negocios/${ctx.negocio.id}/competencia`), ctx);
    } catch (err) {
      cont.innerHTML = `<div class="res-aviso ${err.status === 400 ? '' : 'error'}">${G().escapar(err.mensaje || 'No se pudo cargar.')}
        ${err.status === 400 ? '<button class="btn-approve estilo-btn" data-ir="config">Ir a Conexiones</button>' : ''}</div>`;
      const b = cont.querySelector('[data-ir]');
      if (b) b.addEventListener('click', () => ctx.irA('config'));
    }
  }

  function signo(v) {
    if (v == null) return '–';
    const g = G();
    return `<span class="${v > 0 ? 'sube' : (v < 0 ? 'baja' : '')}">${v > 0 ? '+' : ''}${g.numero(v)}</span>`;
  }

  const pct = (v) => (v == null ? '–' : (v * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' %');
  const etiqueta = (f) => (f.propio ? 'Tú' : `@${f.username}`);
  const FORMATOS = ['video', 'carrusel', 'foto'];
  const SINGULAR = { video: 'Video', carrusel: 'Carrusel', foto: 'Foto' };

  function analisisHtml(c, g) {
    const e = g.escapar;
    const icono = { alerta: '!', idea: '→', bien: '✓' };
    const conDetalle = c.filas.filter((f) => f.detalle && f.detalle.postsAnalizados);
    const tops = c.filas.filter((f) => !f.propio && f.detalle).flatMap((f) => f.detalle.top.map((p) => Object.assign({ cuenta: f.username }, p)))
      .sort((a, b) => (b.tasa || 0) - (a.tasa || 0)).slice(0, 6);
    return `
      ${c.conclusiones && c.conclusiones.length ? `<div class="res-card diag">
        <h2>Lo que hace tu competencia${AY('comp-conclusiones')}</h2>
        <ul class="diag-lista">${c.conclusiones.map((h) => `<li class="diag-${h.nivel}">
          <span class="diag-icono" aria-hidden="true">${icono[h.nivel]}</span>
          <div><b>${e(h.titulo)}</b><span>${e(h.detalle)}</span>${h.accion ? `<span class="diag-accion">${e(h.accion)}</span>` : ''}</div>
        </li>`).join('')}</ul>
      </div>` : ''}
      <div class="res-grid">
        <div class="res-card"><h2>Tasa de interacción${AY('comp-tasa')}</h2>
          <p class="sub">Me gusta + comentarios por publicación, como % de los seguidores. Compara cuentas grandes y chicas con la misma vara.</p>
          <div data-graf="tasa"></div></div>
        <div class="res-card"><h2>Crecimiento de seguidores (30 días)${AY('comp-crecimiento')}</h2>
          <p class="sub">Variación porcentual; se completa a medida que pasan los días desde que empezaste a seguir cada cuenta.</p>
          <div data-graf="crecimiento"></div></div>
      </div>
      ${conDetalle.length ? `<div class="res-card"><h2>Qué publica cada uno${AY('comp-formatos')}</h2>
        <p class="sub">Mezcla de formatos de sus últimas publicaciones y la interacción promedio de cada formato.</p>
        <div class="mezcla-leyenda">${FORMATOS.map((k) => `<span><i class="mz-${k}"></i>${e(c.formatos[k])}</span>`).join('')}</div>
        <div class="mezcla">${conDetalle.map((f) => `<div class="mezcla-fila${f.propio ? ' propio' : ''}">
          <span class="mezcla-nombre">${e(etiqueta(f))}</span>
          <span class="mezcla-barra">${FORMATOS.filter((k) => f.detalle.formatos[k].posts).map((k) => {
            const x = f.detalle.formatos[k];
            return `<span class="mz-${k}" style="flex:${x.parte}" title="${e(c.formatos[k])}: ${Math.round(x.parte * 100)} % de sus posts · ${pct(x.tasa)} de interacción">${x.parte >= 0.15 ? Math.round(x.parte * 100) + ' %' : ''}</span>`;
          }).join('')}</span>
        </div>`).join('')}</div>
      </div>` : ''}
      ${tops.length ? `<div class="res-card"><h2>Lo que mejor le funciona a tu competencia${AY('comp-top')}</h2>
        <p class="sub">Sus publicaciones recientes con más interacción por seguidor. Ábrelas para ver cómo empiezan y qué piden al final.</p>
        <div class="comp-top">${tops.map((p) => `<a class="comp-post" href="${e(p.permalink)}" target="_blank" rel="noopener">
          <span class="comp-post-img">${p.imagen ? `<img src="${e(p.imagen)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<em>${e(SINGULAR[p.formato] || p.formato)}</em></span>
          <span class="comp-post-cuenta">@${e(p.cuenta)} · ${pct(p.tasa)}</span>
          <span class="comp-post-texto">${e(p.caption || 'Sin texto')}</span>
          <span class="comp-post-num">${g.numero(p.interacciones)} interacciones</span>
        </a>`).join('')}</div>
      </div>` : ''}
      ${conDetalle.some((f) => !f.propio && f.detalle.hashtags.length) ? `<div class="res-card"><h2>Hashtags que más usan${AY('comp-hashtags')}</h2>
        <div class="comp-tags">${c.filas.filter((f) => !f.propio && f.detalle && f.detalle.hashtags.length).map((f) => `<div><b>@${e(f.username)}</b> ${f.detalle.hashtags.slice(0, 6).map((h) => `<span class="tag">${e(h.tag)}</span>`).join('')}</div>`).join('')}</div>
      </div>` : ''}`;
  }

  function pintarAnalisis(cont, c, g) {
    // Énfasis: tu cuenta en el color de acento, la competencia en gris.
    const barrasDe = (filas, campo, formato) => {
      const orden = filas.filter((f) => campo(f) != null).sort((a, b) => campo(b) - campo(a));
      const b = g.barras(orden.map((f) => ({ label: etiqueta(f), valor: campo(f) })), { formato });
      b.querySelectorAll('.viz-barra').forEach((el, i) => el.classList.toggle('destacada', !!orden[i].propio));
      return orden.length ? b : Object.assign(document.createElement('p'), { className: 'sub vacio', textContent: 'Todavía sin datos suficientes.' });
    };
    cont.querySelector('[data-graf="tasa"]').appendChild(barrasDe(c.filas, (f) => f.detalle && f.detalle.tasaInteraccion, pct));
    const crec = c.filas.filter((f) => f.crecimiento != null);
    if (!crec.some((f) => !f.propio)) {
      cont.querySelector('[data-graf="crecimiento"]').innerHTML = '<p class="sub vacio">Se muestra desde mañana: necesitamos al menos dos días de datos de cada cuenta para medir su crecimiento.</p>';
      return;
    }
    const neg = crec.some((f) => f.crecimiento < 0);
    // Las barras no muestran negativos: con alguna cuenta a la baja se usa una tabla simple.
    const dest = cont.querySelector('[data-graf="crecimiento"]');
    if (neg) {
      dest.innerHTML = `<table class="tabla-ads">${crec.sort((a, b) => b.crecimiento - a.crecimiento).map((f) => `<tr class="${f.propio ? 'comp-propio' : ''}"><td>${g.escapar(etiqueta(f))}</td><td><span class="${f.crecimiento > 0 ? 'sube' : (f.crecimiento < 0 ? 'baja' : '')}">${f.crecimiento > 0 ? '+' : ''}${pct(f.crecimiento)}</span></td></tr>`).join('')}</table>`;
    } else {
      dest.appendChild(barrasDe(c.filas, (f) => f.crecimiento, (v) => '+' + pct(v)));
    }
  }

  function pintar(cont, d, ctx) {
    const g = G();
    const filas = d.comparacion.filas;
    const competidores = filas.filter((f) => !f.propio);
    const e = g.escapar;
    cont.innerHTML = `
      <div class="res-controles">
        <form data-comp="agregar" class="comp-agregar">
          <input name="username" placeholder="@cuenta de un competidor" autocomplete="off" ${competidores.length >= d.comparacion.maximo ? 'disabled' : ''}>
          <button class="btn-approve estilo-btn" ${competidores.length >= d.comparacion.maximo ? 'disabled' : ''}>Seguir</button>
        </form>
        <span class="res-estado" data-msg>${competidores.length}/${d.comparacion.maximo} competidores · se actualiza una vez al día</span>
        ${competidores.length ? '<button class="btn-ghost" data-comp="sync">Actualizar ahora</button>' : ''}
      </div>
      ${d.sync && d.sync.error ? `<div class="res-aviso error">${e(d.sync.detalle || 'No se pudo actualizar.')}</div>` : ''}
      <div class="res-aviso"><span>Solo se pueden seguir cuentas profesionales (empresa o creador). Instagram entrega sus datos públicos: seguidores, publicaciones y me gusta y comentarios; no su alcance.</span></div>
      ${competidores.length ? analisisHtml(d.comparacion, g) : ''}
      <div class="res-card">
        <h2>Comparación${AY('competencia')}</h2>
        <div class="tabla-scroll"><table class="tabla-ads">
          <thead><tr><th>Cuenta</th><th>Seguidores</th><th>Variación 30 días</th><th>Posts por semana</th><th>Interacción / post</th><th>Tasa de interacción</th><th>Publica más</th><th></th></tr></thead>
          <tbody>${filas.map((f) => `<tr class="${f.propio ? 'comp-propio' : ''}">
            <td>${f.propio ? '<b>Tú</b> · ' : ''}${f.propio ? e(f.nombre) : `<a href="${e(f.perfil)}" target="_blank" rel="noopener">@${e(f.username)}</a>`}
              ${f.error ? `<span class="tabla-sub comp-error">${e(f.error)}</span>` : (f.nombre && !f.propio ? `<span class="tabla-sub">${e(f.nombre)}</span>` : '')}</td>
            <td>${g.numero(f.seguidores)}</td>
            <td>${signo(f.variacionSeguidores)}</td>
            <td>${f.detalle && f.detalle.porSemana != null ? f.detalle.porSemana.toLocaleString('es-CL') : (f.posts30d == null ? '–' : (f.posts30d / 30 * 7).toLocaleString('es-CL', { maximumFractionDigits: 1 }))}</td>
            <td>${g.numero(f.interaccionPromedio)}</td>
            <td>${pct(f.detalle && f.detalle.tasaInteraccion)}</td>
            <td>${f.detalle && f.detalle.diaFrecuente ? `${e(f.detalle.diaFrecuente)}<span class="tabla-sub">${e(f.detalle.franjaFrecuente || '')}</span>` : '–'}</td>
            <td><div class="comp-acciones"><a href="${e(f.anuncios)}" target="_blank" rel="noopener">Ver anuncios</a>
              ${f.propio ? '' : `<button class="btn-text" data-quitar="${e(f.username)}">Quitar</button>`}</div></td>
          </tr>`).join('')}</tbody>
        </table></div>
        ${competidores.length ? '' : '<p class="sub vacio">Agrega la cuenta de un competidor para empezar a compararte.</p>'}
      </div>
    `;

    if (competidores.length) pintarAnalisis(cont, d.comparacion, g);

    const msg = cont.querySelector('[data-msg]');
    cont.querySelector('[data-comp="agregar"]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const input = ev.target.username;
      if (!input.value.trim()) return;
      msg.textContent = 'Buscando la cuenta…';
      try {
        pintar(cont, await ctx.api(`/api/negocios/${ctx.negocio.id}/competencia`, { method: 'POST', body: JSON.stringify({ username: input.value }) }), ctx);
      } catch (err) {
        msg.textContent = err.mensaje || 'No se pudo agregar.';
      }
    });
    const sync = cont.querySelector('[data-comp="sync"]');
    if (sync) sync.addEventListener('click', async () => {
      sync.disabled = true;
      try {
        pintar(cont, await ctx.api(`/api/negocios/${ctx.negocio.id}/competencia/sincronizar`, { method: 'POST' }), ctx);
      } catch (err) {
        msg.textContent = err.mensaje || 'No se pudo actualizar.';
        sync.disabled = false;
      }
    });
    cont.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`¿Dejar de seguir a @${b.dataset.quitar}?`)) return;
      pintar(cont, await ctx.api(`/api/negocios/${ctx.negocio.id}/competencia/${encodeURIComponent(b.dataset.quitar)}`, { method: 'DELETE' }), ctx);
    }));
  }

  window.RubrofyCompetencia = { render };
})();
