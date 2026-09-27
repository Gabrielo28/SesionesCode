// "Contexto para la IA": lo que el negocio quiere que la IA sepa, por
// sección (general, voz, estrategia, copys, cada formato, imágenes y
// videos). Se usa como vista completa y como editor chico dentro de otras
// vistas (Estrategia, Por aprobar, Fotos, Voz de marca). Datos de
// /api/negocios/:id/contexto-ia.
(function () {
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EJEMPLOS = {
    general: 'Ej: Somos una panadería familiar de Ñuñoa desde 1998. Nunca hablamos de la competencia ni de política. Despacho solo en la comuna.',
    voz: 'Ej: A los clientes les decimos "vecinos". Si hay un reclamo, respondemos con nombre y pidiendo disculpas.',
    estrategia: 'Ej: En octubre lanzamos tortas por encargo. Queremos más pedidos por WhatsApp los fines de semana.',
    copys: 'Ej: Máximo 3 hashtags. Siempre termina invitando a escribir por WhatsApp. Precios con punto de miles.',
    post: 'Ej: Una sola idea por post, el producto en primer plano.',
    carrusel: 'Ej: Portada con pregunta, 4 láminas, la última con el precio y cómo pedir.',
    reel: 'Ej: El producto aparece en el primer segundo. Máximo 15 segundos. Música tranquila.',
    historia: 'Ej: Una encuesta por semana. Los viernes, cuenta regresiva para la promo.',
    imagen: 'Ej: Luz natural cálida, mesones de madera, sin personas, sin texto sobre la foto.',
    video: 'Ej: Cámara lenta, primeros planos del producto, sin personas hablando.',
  };

  async function cargar(ctx) {
    return ctx.api(`/api/negocios/${ctx.negocio.id}/contexto-ia`);
  }

  function campo(sec, valor, regla, filas) {
    return `<label class="ctx-campo">
      <span class="ctx-nombre">${e(sec.nombre)}</span>
      <span class="ctx-ayuda">${e(sec.ayuda)}</span>
      ${regla ? `<span class="ctx-regla" title="La define el administrador de Rubrofy y vale para todos los negocios">Regla de la plataforma: ${e(regla)}</span>` : ''}
      <textarea data-ctx="${sec.id}" rows="${filas || 3}" maxlength="${sec.maximo}" placeholder="${e(EJEMPLOS[sec.id] || '')}">${e(valor || '')}</textarea>
    </label>`;
  }

  async function guardar(cont, ctx, msg) {
    const body = {};
    cont.querySelectorAll('[data-ctx]').forEach((t) => { body[t.dataset.ctx] = t.value; });
    msg.textContent = 'Guardando…';
    try {
      await ctx.api(`/api/negocios/${ctx.negocio.id}/contexto-ia`, { method: 'PUT', body: JSON.stringify(body) });
      msg.textContent = 'Guardado. La IA lo usará desde el próximo pedido.';
    } catch (err) {
      msg.textContent = err.mensaje || 'No se pudo guardar.';
    }
  }

  // Vista completa: todas las secciones, agrupadas.
  async function render(cont, ctx) {
    cont.innerHTML = '<p class="sub">Cargando…</p>';
    let d;
    try {
      d = await cargar(ctx);
    } catch (err) {
      cont.innerHTML = `<div class="res-aviso error">${e(err.mensaje || 'No se pudo cargar.')}</div>`;
      return;
    }
    const por = Object.fromEntries(d.secciones.map((s) => [s.id, s]));
    const grupo = (titulo, ids, ayuda) => `<div class="res-card ctx-grupo"><h2>${titulo}${AY(ayuda)}</h2>
      ${ids.map((id) => campo(por[id], d.contexto[id], d.plataforma[id], id === 'general' ? 5 : 3)).join('')}</div>`;
    cont.innerHTML = `
      <div class="res-aviso"><span>Lo que escribas aquí se suma a tu estrategia y tu voz de marca cada vez que la IA trabaja para ti. Escribe como se lo dirías a alguien nuevo en tu equipo. Si algo se contradice, manda lo más específico: la indicación que das al pedir un texto, después esto y al final las reglas de la plataforma.</span></div>
      ${grupo('Siempre', ['general', 'voz'], 'contexto-general')}
      ${grupo('Estrategia y textos', ['estrategia', 'copys'], 'contexto-textos')}
      ${grupo('Por formato', ['post', 'carrusel', 'reel', 'historia'], 'contexto-formatos')}
      ${grupo('Imágenes y videos con IA', ['imagen', 'video'], 'contexto-medios')}
      <div class="estilo-acciones ctx-pie"><button class="btn-approve estilo-btn" data-ctx-guardar>Guardar contexto</button><span class="res-estado" data-ctx-msg></span></div>`;
    cont.querySelector('[data-ctx-guardar]').addEventListener('click', () => guardar(cont, ctx, cont.querySelector('[data-ctx-msg]')));
  }

  // Editor chico, plegable, para una o varias secciones dentro de otra vista.
  async function editor(cont, ctx, ids, titulo) {
    if (!cont) return;
    let d;
    try {
      d = await cargar(ctx);
    } catch (err) {
      cont.innerHTML = '';
      return;
    }
    const por = Object.fromEntries(d.secciones.map((s) => [s.id, s]));
    const llenas = ids.filter((id) => d.contexto[id]).length;
    cont.innerHTML = `<details class="ctx-mini">
      <summary>Contexto para la IA · ${e(titulo)} <em>${llenas ? `${llenas} de ${ids.length} con indicaciones` : 'sin indicaciones'}</em>${AY('contexto')}</summary>
      <div class="ctx-mini-cuerpo">
        ${ids.map((id) => campo(por[id], d.contexto[id], d.plataforma[id], 2)).join('')}
        <div class="estilo-acciones"><button class="btn-approve estilo-btn" data-ctx-guardar>Guardar</button>
        <button class="btn-text" data-ctx-todo>Ver todas las secciones</button><span class="res-estado" data-ctx-msg></span></div>
      </div>
    </details>`;
    cont.querySelector('[data-ctx-guardar]').addEventListener('click', async () => {
      await guardar(cont, ctx, cont.querySelector('[data-ctx-msg]'));
      const n = [...cont.querySelectorAll('[data-ctx]')].filter((t) => t.value.trim()).length;
      cont.querySelector('summary em').textContent = n ? `${n} de ${ids.length} con indicaciones` : 'sin indicaciones';
    });
    cont.querySelector('[data-ctx-todo]').addEventListener('click', () => ctx.irA('contexto'));
  }

  window.RubrofyContexto = { render, editor };
})();
