// Pestaña "Competencia": tu cuenta frente a hasta 5 competidores en
// Instagram (datos públicos vía Business Discovery) y enlace a sus anuncios
// en la Biblioteca de Anuncios de Meta.
(function () {
  const G = () => window.RubrofyGraficos;

  async function render(cont, ctx) {
    cont.innerHTML = '<p class="sub">Cargando…</p>';
    try {
      pintar(cont, await ctx.api(`/api/negocios/${ctx.negocio.id}/competencia`), ctx);
    } catch (err) {
      cont.innerHTML = `<div class="res-aviso ${err.status === 400 ? '' : 'error'}">${G().escapar(err.mensaje || 'No se pudo cargar.')}
        ${err.status === 400 ? '<button class="btn-approve estilo-btn" data-ir="config">Ir a Configuración</button>' : ''}</div>`;
      const b = cont.querySelector('[data-ir]');
      if (b) b.addEventListener('click', () => ctx.irA('config'));
    }
  }

  function signo(v) {
    if (v == null) return '–';
    const g = G();
    return `<span class="${v > 0 ? 'sube' : (v < 0 ? 'baja' : '')}">${v > 0 ? '+' : ''}${g.numero(v)}</span>`;
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
      ${competidores.length ? `
      <div class="res-card">
        <h2>Interacción promedio por publicación</h2>
        <p class="sub">Me gusta + comentarios de las últimas 12 publicaciones de cada cuenta.</p>
        <div data-graf="interaccion"></div>
      </div>` : ''}
      <div class="res-card">
        <h2>Comparación</h2>
        <div class="tabla-scroll"><table class="tabla-ads">
          <thead><tr><th>Cuenta</th><th>Seguidores</th><th>Variación 30 días</th><th>Posts 30 días</th><th>Interacción / post</th><th>Mejor post reciente</th><th></th></tr></thead>
          <tbody>${filas.map((f) => `<tr class="${f.propio ? 'comp-propio' : ''}">
            <td>${f.propio ? '<b>Tú</b> · ' : ''}${f.propio ? e(f.nombre) : `<a href="${e(f.perfil)}" target="_blank" rel="noopener">@${e(f.username)}</a>`}
              ${f.error ? `<span class="tabla-sub comp-error">${e(f.error)}</span>` : (f.nombre && !f.propio ? `<span class="tabla-sub">${e(f.nombre)}</span>` : '')}</td>
            <td>${g.numero(f.seguidores)}</td>
            <td>${signo(f.variacionSeguidores)}</td>
            <td>${f.posts30d == null ? '–' : f.posts30d}</td>
            <td>${g.numero(f.interaccionPromedio)}</td>
            <td>${f.mejorPost && f.mejorPost.permalink ? `<a href="${e(f.mejorPost.permalink)}" target="_blank" rel="noopener">${g.numero(f.mejorPost.interacciones)} interacciones</a>` : '–'}</td>
            <td><div class="comp-acciones"><a href="${e(f.anuncios)}" target="_blank" rel="noopener">Ver anuncios</a>
              ${f.propio ? '' : `<button class="btn-text" data-quitar="${e(f.username)}">Quitar</button>`}</div></td>
          </tr>`).join('')}</tbody>
        </table></div>
        ${competidores.length ? '' : '<p class="sub vacio">Agrega la cuenta de un competidor para empezar a compararte.</p>'}
      </div>
    `;

    if (competidores.length) {
      const orden = filas.filter((f) => f.interaccionPromedio != null).sort((a, b) => b.interaccionPromedio - a.interaccionPromedio);
      // Énfasis: tu cuenta en el color de acento, la competencia en gris.
      const barras = g.barras(orden.map((f) => ({ label: f.propio ? `Tú (@${f.username})` : `@${f.username}`, valor: f.interaccionPromedio, propio: f.propio })));
      barras.querySelectorAll('.viz-barra').forEach((b, i) => b.classList.toggle('destacada', !!orden[i].propio));
      cont.querySelector('[data-graf="interaccion"]').appendChild(barras);
    }

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
