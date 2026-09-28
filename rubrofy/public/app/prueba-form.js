// Formulario de la prueba gratis (server/prueba-gratis.js). Lo usan el
// registro del sitio y el panel, para que las preguntas sean las mismas.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let catalogo = null;
  async function cargar() {
    if (!catalogo) catalogo = fetch('/api/prueba-gratis').then((r) => r.json()).catch((err) => { catalogo = null; throw err; });
    return catalogo;
  }

  function opciones(mapa, vacio) {
    return `<option value="">${esc(vacio)}</option>` + Object.entries(mapa).map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  }

  // valores: lo que ya se sabe (ciudad, instagram…) para no preguntarlo de nuevo.
  function campos(cat, valores) {
    const v = valores || {};
    const o = cat.opciones;
    const campo = (id, etiqueta, control) => `<label class="pg-campo" data-pg-campo="${id}">${etiqueta}${control}<span class="pg-error" data-pg-error="${id}" hidden></span></label>`;
    return `<div class="pg-campos">
      ${campo('nombre', 'Tu nombre y apellido', `<input data-pg="nombre" autocomplete="name" maxlength="100" value="${esc(v.nombre)}" required>`)}
      ${campo('telefono', 'Teléfono o WhatsApp', `<input data-pg="telefono" type="tel" autocomplete="tel" maxlength="30" placeholder="+56 9 1234 5678" value="${esc(v.telefono)}" required>`)}
      <div class="pg-fila">
        ${campo('cargo', 'Tu rol en el negocio', `<select data-pg="cargo" required>${opciones(o.cargo, 'Elige una opción')}</select>`)}
        ${campo('tamano', 'Tamaño del equipo', `<select data-pg="tamano" required>${opciones(o.tamano, 'Elige una opción')}</select>`)}
      </div>
      <div class="pg-fila">
        ${campo('ciudad', 'Ciudad o comuna', `<input data-pg="ciudad" autocomplete="address-level2" maxlength="120" value="${esc(v.ciudad)}" required>`)}
        ${campo('instagram', 'Instagram del negocio (opcional)', `<input data-pg="instagram" maxlength="60" placeholder="@tunegocio" value="${esc(v.instagram)}">`)}
      </div>
      ${campo('objetivo', '¿Qué quieres lograr con Rubrofy?', `<select data-pg="objetivo" required>${opciones(o.objetivo, 'Elige una opción')}</select>`)}
      <div class="pg-fila">
        ${campo('fuente', '¿Cómo nos conociste?', `<select data-pg="fuente" required>${opciones(o.fuente, 'Elige una opción')}</select>`)}
        ${campo('publicidad', '¿Inviertes en publicidad? (opcional)', `<select data-pg="publicidad">${opciones(o.publicidad, 'Prefiero no decir')}</select>`)}
      </div>
      ${campo('comentario', '¿Algo que quieras contarnos? (opcional)', '<textarea data-pg="comentario" rows="2" maxlength="500"></textarea>')}
      <label class="pg-acepto" data-pg-campo="aceptoContacto"><input type="checkbox" data-pg="aceptoContacto"> <span>Acepto que Rubrofy me contacte por WhatsApp o email para ayudarme con mi prueba.</span><span class="pg-error" data-pg-error="aceptoContacto" hidden></span></label>
    </div>`;
  }

  function leer(raiz) {
    const val = (k) => { const el = raiz.querySelector(`[data-pg="${k}"]`); return el ? el.value : ''; };
    return {
      nombre: val('nombre'), telefono: val('telefono'), cargo: val('cargo'), tamano: val('tamano'), ciudad: val('ciudad'),
      instagram: val('instagram'), objetivo: val('objetivo'), fuente: val('fuente'), publicidad: val('publicidad'),
      comentario: val('comentario'), aceptoContacto: !!(raiz.querySelector('[data-pg="aceptoContacto"]') || {}).checked,
    };
  }

  function limpiarErrores(raiz) {
    raiz.querySelectorAll('[data-pg-error]').forEach((e) => { e.hidden = true; e.textContent = ''; });
  }

  // Muestra el error del servidor junto al campo. Devuelve true si encontró el campo.
  function marcarError(raiz, campo, mensaje) {
    const el = campo && raiz.querySelector(`[data-pg-error="${campo}"]`);
    if (!el) return false;
    el.textContent = mensaje;
    el.hidden = false;
    const input = raiz.querySelector(`[data-pg="${campo}"]`);
    if (input) input.focus();
    return true;
  }

  window.RubrofyPrueba = { cargar, campos, leer, limpiarErrores, marcarError };
})();
