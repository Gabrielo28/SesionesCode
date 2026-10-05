// Brief de la semana y plan de marketing (server/brief.js): lo que el dueño
// le dice a Rubrofy para que la semana salga como quiere. Se usa al generar
// la semana (dlg-generar), en Por aprobar ("Esta semana…") y en Estrategia
// (tarjeta "Plan de marketing").
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ETQ = { post: 'Posts', carrusel: 'Carruseles', reel: 'Reels', historia: 'Historias' };
  const SING = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };
  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  let ctx = null;
  let actual = null;      // lo que devolvió GET /brief para la semana que se va a generar
  let estructurado = null; // vista previa ordenada del texto escrito
  let textoOrdenado = '';  // el texto al que corresponde esa vista previa

  function iniciar(c) { ctx = c; }
  const n = () => ctx.negocio();
  const fechaCorta = (iso) => { const [a, m, d] = iso.split('-').map(Number); return `${d}/${m}`; };

  // ---------- resumen de un brief ordenado ----------
  function resumenHTML(e) {
    if (!e) return '';
    const ritmo = e.ritmo ? Object.keys(ETQ).filter((f) => e.ritmo[f]).map((f) => `${e.ritmo[f]} ${(e.ritmo[f] === 1 ? SING[f] : ETQ[f]).toLowerCase()}`).join(', ') : '';
    return `<div class="br-resumen">
      ${e.comunicar.length ? `<div class="br-bloque"><b>Comunicar</b><ul>${e.comunicar.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
      ${e.obligatorias.length ? `<div class="br-bloque"><b>No pueden faltar</b><ul>${e.obligatorias.map((o) => `<li><span class="br-fmt">${esc(SING[o.formato])}${o.dia != null ? ' · ' + DIAS[o.dia] : ''}</span> ${esc(o.idea)}</li>`).join('')}</ul></div>` : ''}
      ${e.evitar.length ? `<div class="br-bloque"><b>Evitar</b><ul>${e.evitar.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}
      ${ritmo ? `<p class="br-ritmo">📅 Esta semana: <b>${esc(ritmo)}</b> (cambia el ritmo de tu plan solo por esta semana).</p>` : ''}
    </div>`;
  }

  // ---------- al generar la semana (dlg-generar) ----------
  async function cargarParaGenerar(cont) {
    actual = null; estructurado = null; textoOrdenado = '';
    try { actual = await ctx.api(`/api/negocios/${n().id}/brief`); } catch (err) { actual = null; }
    pintarGenerar(cont);
  }

  function pintarGenerar(cont) {
    const a = actual || {};
    const guardado = a.brief;
    const fechas = a.desde ? `del ${fechaCorta(a.desde)} al ${fechaCorta(a.hasta)}` : '';
    cont.innerHTML = `
      <label class="br-campo"><span class="br-etq">¿Qué quieres comunicar esta semana ${esc(fechas)}?${ctx.ayuda ? ctx.ayuda('brief') : ''}</span>
        <textarea data-br-texto rows="5" maxlength="5000" placeholder="Cuéntaselo como a tu redactor: qué pasa esta semana, qué publicaciones no pueden faltar (formato y día), cuántas quieres de cada tipo y qué evitar.&#10;Ej: Lanzamos el combo mañanero. Quiero 3 reels, 1 post y 2 historias. Un reel el jueves del horno a las 6 am. No mencionar el 2x1 anterior.">${esc(guardado ? guardado.texto : '')}</textarea>
      </label>
      <div class="br-acciones">
        ${a.anterior ? '<button type="button" class="btn-text" data-br-anterior>Usar el de la semana pasada</button>' : ''}
        ${a.tienePlan ? '<button type="button" class="btn-text" data-br-proponer>✨ Proponer desde mi plan</button>' : '<button type="button" class="btn-text" data-br-plan>Guardar un plan de marketing</button>'}
        <span class="br-contador" data-br-contador></span>
      </div>
      <div data-br-vista>${guardado && !estructurado ? resumenHTML(guardado.estructurado) : ''}</div>`;
    const ta = cont.querySelector('[data-br-texto]');
    const contador = cont.querySelector('[data-br-contador]');
    const cuenta = () => { contador.textContent = ta.value.length > 4000 ? `${ta.value.length} / 5000` : ''; };
    ta.oninput = () => { cuenta(); if (ta.value.trim() !== textoOrdenado) { estructurado = null; cont.querySelector('[data-br-vista]').innerHTML = ''; } };
    cuenta();
    cont.onclick = async (e) => {
      if (e.target.closest('[data-br-anterior]')) { ta.value = a.anterior.texto; ta.dispatchEvent(new Event('input')); return; }
      if (e.target.closest('[data-br-plan]')) { ctx.cerrarGenerar(); return ctx.irAVista('estrategia'); }
      const b = e.target.closest('[data-br-proponer]');
      if (b) {
        b.disabled = true; b.textContent = 'Pensando…';
        try {
          const r = await ctx.api(`/api/negocios/${n().id}/brief/proponer`, { method: 'POST', body: JSON.stringify({ semana: a.semana }) });
          ta.value = r.texto || ''; ta.dispatchEvent(new Event('input'));
        } catch (err) { alert(err.mensaje || 'No se pudo proponer el brief.'); }
        b.disabled = false; b.textContent = '✨ Proponer desde mi plan';
      }
    };
  }

  // Antes de generar: si hay texto y todavía no se ordenó, se ordena y se
  // muestra la vista previa; devuelve false para que el dueño la revise.
  // Devuelve { brief } con lo que hay que mandar al generar.
  async function antesDeGenerar(cont) {
    const ta = cont.querySelector('[data-br-texto]');
    const texto = ta ? ta.value.trim() : '';
    if (!texto) return { brief: actual && actual.brief ? undefined : null, listo: true };
    if (estructurado && textoOrdenado === texto) return { brief: texto, listo: true };
    const r = await ctx.api(`/api/negocios/${n().id}/brief/estructurar`, { method: 'POST', body: JSON.stringify({ texto }) });
    estructurado = r.estructurado; textoOrdenado = texto;
    cont.querySelector('[data-br-vista]').innerHTML = `<p class="br-revisa">Así entendió Rubrofy tu brief. Si está bien, toca <b>Generar con este brief</b>; si no, corrige el texto.</p>${resumenHTML(estructurado)}`;
    return { listo: false, total: estructurado.ritmo ? Object.values(estructurado.ritmo).reduce((s, x) => s + x, 0) : null };
  }

  // ---------- Por aprobar: "Esta semana…" ----------
  async function pintarCola(cont) {
    if (!cont) return;
    const contenido = ctx.contenido();
    const semanas = [...new Set(contenido.filter((i) => i.status === 'pendiente' && i.briefSemana).map((i) => i.briefSemana))].sort();
    if (!semanas.length) { cont.innerHTML = ''; cont.hidden = true; return; }
    cont.hidden = false;
    let datos;
    try { datos = await ctx.api(`/api/negocios/${n().id}/brief?semana=${encodeURIComponent(semanas[0])}`); } catch (err) { cont.innerHTML = ''; return; }
    if (!datos.brief) { cont.innerHTML = ''; cont.hidden = true; return; }
    const e = datos.brief.estructurado;
    cont.innerHTML = `<div class="br-cola">
      <div class="br-cola-txt"><b>📝 Esta semana (${esc(fechaCorta(datos.desde))} al ${esc(fechaCorta(datos.hasta))}):</b> ${esc(e.resumen || e.comunicar[0] || datos.brief.texto.slice(0, 120))}${e.comunicar.length > 1 ? ` <button type="button" class="btn-text" data-br-ver>ver todo</button>` : ''}</div>
      <div class="br-cola-acc"><button type="button" class="btn-ghost" data-br-editar>Cambiar el brief</button></div>
      <div class="br-cola-detalle" data-br-detalle hidden>${resumenHTML(e)}</div>
    </div>`;
    cont.onclick = (ev) => {
      if (ev.target.closest('[data-br-ver]')) { const d = cont.querySelector('[data-br-detalle]'); d.hidden = !d.hidden; return; }
      if (ev.target.closest('[data-br-editar]')) editarSemana(datos, cont);
    };
  }

  function editarSemana(datos, cont) {
    let dlg = document.getElementById('dlg-brief');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-brief';
      dlg.className = 'dlg dlg-brief';
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = `<div class="dlg-caja">
      <h2>El brief de esta semana</h2>
      <p class="sub">Del ${esc(fechaCorta(datos.desde))} al ${esc(fechaCorta(datos.hasta))}. ${datos.pendientesEnSemana ? `${datos.pendientesEnSemana} publicaciones pendientes se pueden rehacer con el brief nuevo; las aprobadas no se tocan.` : ''}</p>
      <textarea data-br-texto rows="7" maxlength="5000">${esc(datos.brief.texto)}</textarea>
      <p class="config-error" data-br-error hidden></p>
      <div class="dlg-acciones">
        <button type="button" class="btn-ghost" data-br-cerrar>Cancelar</button>
        <button type="button" class="btn-ghost" data-br-guardar>Solo guardar</button>
        <button type="button" class="btn-approve" data-br-rehacer>Rehacer la semana con este brief</button>
      </div>
    </div>`;
    const error = (t) => { const el = dlg.querySelector('[data-br-error]'); el.textContent = t; el.hidden = false; };
    dlg.onclick = async (e) => {
      if (e.target === dlg || e.target.closest('[data-br-cerrar]')) return dlg.close();
      const guardar = e.target.closest('[data-br-guardar]'), rehacer = e.target.closest('[data-br-rehacer]');
      if (!guardar && !rehacer) return;
      const b = guardar || rehacer;
      b.disabled = true; b.textContent = rehacer ? 'Rehaciendo… suele tardar un minuto' : 'Guardando…';
      try {
        await ctx.api(`/api/negocios/${n().id}/brief`, { method: 'PUT', body: JSON.stringify({ semana: datos.semana, texto: dlg.querySelector('[data-br-texto]').value }) });
        if (rehacer) {
          const r = await ctx.api(`/api/negocios/${n().id}/brief/rehacer`, { method: 'POST', body: JSON.stringify({ semana: datos.semana }) });
          ctx.setContenido(r.contenido);
        }
        dlg.close();
        await ctx.recargar();
      } catch (err) {
        error(err.mensaje || 'No se pudo guardar el brief.');
        b.disabled = false; b.textContent = rehacer ? 'Rehacer la semana con este brief' : 'Solo guardar';
      }
    };
    if (!dlg.open) dlg.showModal();
  }

  // ---------- Estrategia: plan de marketing ----------
  function tarjetaPlanHTML(editando) {
    const pm = n().planMarketing;
    const r = pm && pm.resumen;
    if (editando) {
      return `<div class="br-plan-edit">
        <p class="sub">Pega tu estrategia completa o sube el archivo (.docx, .pdf o .txt). Rubrofy la resume en una ficha y la usa en cada semana; el brief de cada semana manda si se contradicen.</p>
        <label class="gl-drop br-drop" data-br-drop><input type="file" accept=".docx,.pdf,.txt,.md" hidden data-br-archivo><span class="gl-drop-ic">⇪</span><span><b>Subir archivo</b> · .docx, .pdf o .txt, hasta 8 MB</span></label>
        <textarea data-br-plan rows="12" maxlength="20000" placeholder="Promesa de marca, cómo hablas, campañas o fases con sus fechas, pilares de contenido, lo que nunca dices…">${esc(pm ? pm.texto : '')}</textarea>
        <span class="br-contador" data-br-contador-plan></span>
      </div>`;
    }
    if (!pm) return '<p class="es-vacio">Sin plan todavía. Pega tu estrategia o sube un documento y Rubrofy la seguirá cada semana.</p>';
    const hoy = new Date().toISOString().slice(0, 10);
    const estadoC = (c) => (c.hasta && c.hasta < hoy ? 'pasada' : c.desde && c.desde > hoy ? 'proxima' : 'activa');
    return `<div class="br-plan">
      ${r.promesa ? `<p class="br-promesa">“${esc(r.promesa)}”</p>` : ''}
      ${r.voz ? `<p class="sub">${esc(r.voz)}</p>` : ''}
      ${r.campanas.length ? `<div class="br-campanas">${r.campanas.map((c) => `<div class="br-campana ${estadoC(c)}"><b>${esc(c.nombre)}</b><small>${c.desde || c.hasta ? `${c.desde ? fechaCorta(c.desde) : '…'} → ${c.hasta ? fechaCorta(c.hasta) : '…'}` : 'sin fechas'}${estadoC(c) === 'activa' ? ' · activa' : ''}</small>${c.objetivo ? `<span>${esc(c.objetivo)}</span>` : ''}</div>`).join('')}</div>` : ''}
      ${r.pilares.length ? `<div class="es-chips">${r.pilares.map((p) => `<span class="es-chip">${esc(p)}</span>`).join('')}</div>` : ''}
      <p class="br-plan-meta">${pm.nombreArchivo ? `Desde ${esc(pm.nombreArchivo)} · ` : ''}${pm.texto.length.toLocaleString('es-CL')} caracteres · actualizado ${esc(new Date(pm.actualizadoEl).toLocaleDateString('es-CL'))}</p>
    </div>`;
  }

  // Maneja el archivo y el contador dentro de la tarjeta en edición.
  function activarPlan(card) {
    const ta = card.querySelector('[data-br-plan]');
    const contador = card.querySelector('[data-br-contador-plan]');
    if (!ta) return;
    const cuenta = () => { contador.textContent = `${ta.value.length.toLocaleString('es-CL')} / 20.000`; };
    ta.addEventListener('input', cuenta); cuenta();
    const leer = async (file) => {
      const b = card.querySelector('[data-br-drop] b');
      if (b) b.textContent = 'Leyendo…';
      try {
        const base64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = no; r.readAsDataURL(file); });
        const r = await ctx.api(`/api/negocios/${n().id}/plan-marketing/archivo`, { method: 'POST', body: JSON.stringify({ nombre: file.name, dataBase64: base64 }) });
        ta.value = r.texto; ta.dataset.archivo = file.name; cuenta();
        if (b) b.textContent = `Leído: ${file.name}${r.recortado ? ' (se recortó a 20.000 caracteres)' : ''}`;
      } catch (err) { alert(err.mensaje || 'No se pudo leer el archivo.'); if (b) b.textContent = 'Subir archivo'; }
    };
    card.addEventListener('change', (e) => { const inp = e.target.closest('[data-br-archivo]'); if (inp && inp.files[0]) leer(inp.files[0]); });
    card.addEventListener('dragover', (e) => { if (e.target.closest('[data-br-drop]')) { e.preventDefault(); e.target.closest('[data-br-drop]').classList.add('sobre'); } });
    card.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-br-drop]'); if (z) z.classList.remove('sobre'); });
    card.addEventListener('drop', (e) => { const z = e.target.closest('[data-br-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('sobre'); if (e.dataTransfer.files[0]) leer(e.dataTransfer.files[0]); });
  }

  async function guardarPlan(card) {
    const ta = card.querySelector('[data-br-plan]');
    return ctx.api(`/api/negocios/${n().id}/plan-marketing`, { method: 'PUT', body: JSON.stringify({ texto: ta.value, nombreArchivo: ta.dataset.archivo || (n().planMarketing || {}).nombreArchivo || null }) });
  }

  window.RubrofyBrief = { iniciar, cargarParaGenerar, antesDeGenerar, pintarCola, tarjetaPlanHTML, activarPlan, guardarPlan, resumenHTML };
})();
