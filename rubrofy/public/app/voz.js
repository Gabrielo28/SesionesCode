// Vista "Voz de marca": la ficha (ADN) de cómo habla el negocio, el
// redactor que escribe cualquier texto con esa voz y un probador que
// puntúa un texto propio. Datos de /api/negocios/:id/voz.
(function () {
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pestana = 'ficha';
  let borrador = null; // ficha propuesta por la IA, todavía sin guardar
  let ultimas = null; // últimas versiones del redactor

  function insignia(v, grande) {
    if (!v) return '';
    const notas = v.notas.map((n) => `${n.tipo === 'bien' ? '✓' : '✗'} ${n.texto}`).join('\n');
    return `<span class="voz-insignia voz-${v.nivel}${grande ? ' grande' : ''}" title="${e(notas || 'Sin observaciones')}">Voz ${v.puntaje}</span>`;
  }

  function notasHtml(v) {
    if (!v || !v.notas.length) return '<p class="sub">Sin observaciones: calza con tu ficha.</p>';
    return `<ul class="voz-notas">${v.notas.map((n) => `<li class="${n.tipo}">${n.tipo === 'bien' ? '✓' : '✗'} ${e(n.texto)}</li>`).join('')}</ul>`;
  }

  async function render(cont, ctx) {
    cont.innerHTML = '<p class="sub">Cargando…</p>';
    try {
      pintar(cont, await ctx.api(`/api/negocios/${ctx.negocio.id}/voz`), ctx);
    } catch (err) {
      cont.innerHTML = `<div class="res-aviso error">${e(err.mensaje || 'No se pudo cargar tu voz de marca.')}</div>`;
    }
  }

  function pintar(cont, d, ctx) {
    const f = borrador || d.ficha || {};
    const o = d.opciones;
    const sel = (nombre, opciones, valor) => `<select name="${nombre}">${Object.entries(opciones).map(([k, v]) => `<option value="${k}" ${k === valor ? 'selected' : ''}>${e(v)}</option>`).join('')}</select>`;
    const lineas = (arr) => e((arr || []).join('\n'));
    const kpi = (label, valor, extra) => `<div class="kpi"><span class="kpi-label">${label}</span><b class="kpi-valor">${valor}</b><span class="kpi-extra">${extra}</span></div>`;

    cont.innerHTML = `
      <div class="kpis voz-kpis">
        ${kpi('Fidelidad de lo pendiente', d.puntajeCola == null ? '–' : `${d.puntajeCola}/100`, d.tieneFicha ? 'promedio de las piezas por aprobar' : 'completa tu ficha para medirla')}
        ${kpi('Aprobado sin cambios', d.sinCambios == null ? '–' : `${d.sinCambios} %`, d.aprobadas ? `de ${d.aprobadas} pieza${d.aprobadas === 1 ? '' : 's'} aprobada${d.aprobadas === 1 ? '' : 's'}` : 'todavía no apruebas piezas')}
        ${kpi('Textos con IA disponibles', d.puedeIA ? d.textosIADisponibles : '–', d.puedeIA ? 'este mes' : 'en los planes Pro y Estudio')}
      </div>
      <div class="pestanas" role="tablist">
        ${[['ficha', 'Tu ficha de voz'], ['redactor', 'Escribir con mi voz'], ['probar', 'Probar un texto']].map(([k, l]) => `<button role="tab" data-pestana="${k}" class="${pestana === k ? 'activa' : ''}">${l}</button>`).join('')}
      </div>
      <div data-cuerpo></div>`;
    const cuerpo = cont.querySelector('[data-cuerpo]');
    cont.querySelectorAll('[data-pestana]').forEach((b) => b.addEventListener('click', () => { pestana = b.dataset.pestana; pintar(cont, d, ctx); }));

    if (pestana === 'ficha') {
      cuerpo.innerHTML = `
        ${borrador ? '<div class="res-aviso"><span>La IA propuso esta ficha a partir de tu estrategia, tu estilo y lo que has aprobado. Revísala y pulsa <b>Guardar ficha</b>.</span></div>' : ''}
        <form class="voz-ficha" data-form="ficha">
          <div class="res-card">
            <h2>Quién es tu marca${AY('voz-ficha')}</h2>
            <label class="estilo-campo">Quiénes somos<textarea name="quienesSomos" rows="3" maxlength="800" placeholder="Ej: Panadería familiar de barrio, con masa madre de 24 horas y horno a leña.">${e(f.quienesSomos)}</textarea></label>
            <label class="estilo-campo">A quién le hablamos<textarea name="publico" rows="2" maxlength="500" placeholder="Ej: Familias del barrio y oficinistas que pasan camino al trabajo.">${e(f.publico)}</textarea></label>
            <label class="estilo-campo">Personalidad (3 a 5 adjetivos, separados por coma)<input name="personalidad" value="${e((f.personalidad || []).join(', '))}" placeholder="cercana, cálida, honesta"></label>
          </div>
          <div class="res-card">
            <h2>Cómo habla${AY('voz-como')}</h2>
            <div class="voz-selects">
              <label class="estilo-campo">Trato${sel('trato', o.tratos, f.trato || 'tu')}</label>
              <label class="estilo-campo">Español${sel('variante', o.variantes, f.variante || 'chileno-cercano')}</label>
              <label class="estilo-campo">Emojis${sel('emojis', o.emojis, f.emojis || 'pocos')}</label>
              <label class="estilo-campo">Largo${sel('largo', o.largos, f.largo || 'medio')}</label>
            </div>
            <div class="res-grid">
              <label class="estilo-campo">Palabras y expresiones propias (una por línea)<textarea name="palabrasSi" rows="4" placeholder="masa madre&#10;recién salido&#10;vecinos">${lineas(f.palabrasSi)}</textarea></label>
              <label class="estilo-campo">Palabras que nunca usa (una por línea)<textarea name="palabrasNo" rows="4" placeholder="delicioso&#10;increíble&#10;low cost">${lineas(f.palabrasNo)}</textarea></label>
              <label class="estilo-campo">Frases de la marca (una por línea)<textarea name="frases" rows="3" placeholder="Pan de verdad, todos los días">${lineas(f.frases)}</textarea></label>
              <label class="estilo-campo">Prohibido prometer o mencionar (una por línea)<textarea name="prohibido" rows="3" placeholder="sin gluten&#10;envío gratis">${lineas(f.prohibido)}</textarea></label>
            </div>
          </div>
          <div class="res-card">
            <h2>Textos que "sí suenan a nosotros"${AY('voz-ejemplos')}</h2>
            <p class="sub">La IA los imita. Se agregan desde "Escribir con mi voz" con el botón "Así sí suena", o aquí, uno por bloque.</p>
            <div class="voz-ejemplos">${(f.ejemplos || []).map((x, i) => `<div class="voz-ejemplo"><p>${e(x)}</p><button type="button" class="btn-text" data-quitar-ej="${i}">Quitar</button></div>`).join('') || '<p class="sub vacio">Todavía no hay ejemplos.</p>'}</div>
            <label class="estilo-campo">Agregar un ejemplo<textarea data-nuevo-ej rows="2" placeholder="Pega un texto que te encante cómo quedó"></textarea></label>
          </div>
          <div class="estilo-acciones">
            <button class="btn-approve estilo-btn" type="submit">Guardar ficha</button>
            ${d.puedeIA ? `<button type="button" class="btn-ghost" data-sugerir ${d.iaConfigurada ? '' : 'disabled'}>${d.tieneFicha ? 'Proponer mejoras con IA' : 'Completar con IA'}</button>` : '<span class="res-estado">Completar con IA está en los planes Pro y Estudio.</span>'}
            ${borrador ? '<button type="button" class="btn-text" data-descartar>Descartar propuesta</button>' : ''}
            <span class="res-estado" data-msg>${d.ficha && d.ficha.actualizadoEl ? `Guardada el ${new Date(d.ficha.actualizadoEl).toLocaleDateString('es-CL')}` : 'Sin guardar todavía.'}</span>
          </div>
        </form>
        <div data-ctx-voz></div>`;
      const form = cuerpo.querySelector('[data-form="ficha"]');
      const msg = cuerpo.querySelector('[data-msg]');
      let ejemplos = (f.ejemplos || []).slice();
      cuerpo.querySelectorAll('[data-quitar-ej]').forEach((b) => b.addEventListener('click', () => {
        ejemplos.splice(Number(b.dataset.quitarEj), 1);
        b.closest('.voz-ejemplo').remove();
      }));
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const nuevo = cuerpo.querySelector('[data-nuevo-ej]').value.trim();
        if (nuevo) ejemplos = [nuevo, ...ejemplos];
        const fd = new FormData(form);
        const lista = (k) => String(fd.get(k) || '').split('\n').map((x) => x.trim()).filter(Boolean);
        const body = {
          quienesSomos: fd.get('quienesSomos'), publico: fd.get('publico'), personalidad: String(fd.get('personalidad') || '').split(',').map((x) => x.trim()).filter(Boolean),
          trato: fd.get('trato'), variante: fd.get('variante'), emojis: fd.get('emojis'), largo: fd.get('largo'),
          palabrasSi: lista('palabrasSi'), palabrasNo: lista('palabrasNo'), frases: lista('frases'), prohibido: lista('prohibido'), ejemplos,
        };
        msg.textContent = 'Guardando…';
        try {
          const r = await ctx.api(`/api/negocios/${ctx.negocio.id}/voz`, { method: 'PUT', body: JSON.stringify(body) });
          borrador = null;
          pintar(cont, r, ctx);
          cont.querySelector('[data-msg]').textContent = 'Guardada. Las piezas por aprobar ya tienen su puntaje de voz.';
          if (ctx.recargarContenido) ctx.recargarContenido();
        } catch (err) {
          msg.textContent = err.mensaje || 'No se pudo guardar.';
        }
      });
      const sug = cuerpo.querySelector('[data-sugerir]');
      if (sug) sug.addEventListener('click', async () => {
        sug.disabled = true;
        msg.textContent = 'La IA está leyendo tu estrategia, tu estilo y lo que has aprobado…';
        try {
          const r = await ctx.api(`/api/negocios/${ctx.negocio.id}/voz/sugerir`, { method: 'POST' });
          borrador = Object.assign({}, r.ficha, { ejemplos: (d.ficha && d.ficha.ejemplos) || [] });
          pintar(cont, d, ctx);
        } catch (err) {
          msg.textContent = err.mensaje || 'No se pudo completar con IA.';
          sug.disabled = false;
        }
      });
      const desc = cuerpo.querySelector('[data-descartar]');
      if (desc) desc.addEventListener('click', () => { borrador = null; pintar(cont, d, ctx); });
      if (window.RubrofyContexto) window.RubrofyContexto.editor(cuerpo.querySelector('[data-ctx-voz]'), ctx, ['general', 'voz'], 'lo que la IA debe saber siempre');
      return;
    }

    if (pestana === 'redactor') {
      const tipos = o.tiposRedaccion;
      cuerpo.innerHTML = `
        ${d.tieneFicha ? '' : '<div class="res-aviso"><span>Completa tu ficha de voz para que el redactor escriba como tu marca y puntúe cada versión.</span></div>'}
        <form class="res-card" data-form="redactar">
          <h2>Escribir con mi voz${AY('voz-redactor')}</h2>
          <p class="sub">Cualquier texto de tu negocio, no solo publicaciones. Cada pedido usa 1 texto con IA y trae 3 versiones.</p>
          <div class="voz-selects">
            <label class="estilo-campo">Qué necesitas<select name="tipo">${Object.entries(tipos).map(([k, v]) => `<option value="${k}">${e(v)}</option>`).join('')}</select></label>
          </div>
          <label class="estilo-campo">De qué trata<textarea name="tema" rows="3" maxlength="600" placeholder="Ej: promo de marraquetas para la once, 10 unidades a $2.500, solo este viernes" required></textarea></label>
          <label class="estilo-campo">Indicaciones (opcional)<input name="indicaciones" maxlength="500" placeholder="Ej: que suene urgente, menciona el despacho"></label>
          <div class="estilo-acciones">
            <button class="btn-approve estilo-btn" type="submit" ${d.puedeIA && d.iaConfigurada ? '' : 'disabled'}>Escribir 3 versiones</button>
            <span class="res-estado" data-msg>${d.puedeIA ? '' : 'Disponible en los planes Pro y Estudio.'}</span>
          </div>
        </form>
        <div data-versiones></div>`;
      const cont2 = cuerpo.querySelector('[data-versiones]');
      const pintarVersiones = () => {
        if (!ultimas) return;
        cont2.innerHTML = `<div class="voz-versiones">${ultimas.versiones.map((v, i) => `<article class="res-card voz-version">
          <div class="voz-version-cab">${insignia(v.voz)}<span class="tabla-sub">Versión ${i + 1}</span></div>
          ${v.titulo ? `<b class="voz-titulo">${e(v.titulo)}</b>` : ''}
          <p class="voz-texto">${e(v.texto)}</p>
          ${v.voz ? notasHtml(v.voz) : ''}
          <div class="estilo-acciones"><button class="btn-ghost" data-copiar="${i}">Copiar</button><button class="btn-text" data-suena="${i}">Así sí suena</button></div>
        </article>`).join('')}</div>`;
        cont2.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
          const v = ultimas.versiones[Number(b.dataset.copiar)];
          try { await navigator.clipboard.writeText((v.titulo ? v.titulo + '\n\n' : '') + v.texto); b.textContent = 'Copiado'; } catch (err) { b.textContent = 'No se pudo copiar'; }
        }));
        cont2.querySelectorAll('[data-suena]').forEach((b) => b.addEventListener('click', async () => {
          const v = ultimas.versiones[Number(b.dataset.suena)];
          b.disabled = true;
          try {
            d = await ctx.api(`/api/negocios/${ctx.negocio.id}/voz/ejemplos`, { method: 'POST', body: JSON.stringify({ texto: v.texto }) });
            b.textContent = 'Guardado como ejemplo';
          } catch (err) {
            b.textContent = err.mensaje || 'No se pudo guardar';
          }
        }));
      };
      pintarVersiones();
      cuerpo.querySelector('[data-form="redactar"]').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const msg = cuerpo.querySelector('[data-msg]');
        const btn = ev.target.querySelector('[type="submit"]');
        btn.disabled = true;
        msg.textContent = 'Escribiendo…';
        try {
          ultimas = await ctx.api(`/api/negocios/${ctx.negocio.id}/voz/redactar`, { method: 'POST', body: JSON.stringify({ tipo: fd.get('tipo'), tema: fd.get('tema'), indicaciones: fd.get('indicaciones') }) });
          d.textosIADisponibles = Math.max(0, d.textosIADisponibles - 1);
          msg.textContent = '';
          pintarVersiones();
        } catch (err) {
          msg.textContent = err.mensaje || 'No se pudo escribir.';
        }
        btn.disabled = false;
      });
      return;
    }

    // probar
    cuerpo.innerHTML = `
      <form class="res-card" data-form="probar">
        <h2>Probar un texto${AY('voz-probar')}</h2>
        <p class="sub">Pega un texto (tuyo, de tu equipo o de otra herramienta) y mira qué tan fiel es a tu voz. No usa IA ni descuenta nada.</p>
        <textarea name="texto" rows="5" placeholder="Pega aquí el texto"></textarea>
        <div class="estilo-acciones"><button class="btn-approve estilo-btn" type="submit" ${d.tieneFicha ? '' : 'disabled'}>Revisar</button>
        <span class="res-estado">${d.tieneFicha ? '' : 'Completa tu ficha de voz primero.'}</span></div>
        <div data-resultado></div>
      </form>`;
    cuerpo.querySelector('[data-form="probar"]').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const out = cuerpo.querySelector('[data-resultado]');
      try {
        const r = await ctx.api(`/api/negocios/${ctx.negocio.id}/voz/puntuar`, { method: 'POST', body: JSON.stringify({ texto: ev.target.texto.value }) });
        out.innerHTML = r.voz ? `<div class="voz-resultado">${insignia(r.voz, true)}${notasHtml(r.voz)}</div>` : '';
      } catch (err) {
        out.innerHTML = `<p class="sub">${e(err.mensaje || 'No se pudo revisar.')}</p>`;
      }
    });
  }

  window.RubrofyVoz = { render, insignia };
})();
