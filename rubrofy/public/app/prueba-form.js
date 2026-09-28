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

  // valores: lo que ya se sabe (correo de la cuenta, WhatsApp del perfil).
  // opciones.sinCorreo: en el registro el correo es el de la cuenta.
  function campos(cat, valores, opciones) {
    const v = valores || {};
    const o = opciones || {};
    const campo = (id, etiqueta, control) => `<label class="pg-campo" data-pg-campo="${id}">${etiqueta}${control}<span class="pg-error" data-pg-error="${id}" hidden></span></label>`;
    return `<div class="pg-campos">
      ${campo('nombre', 'Nombre', `<input data-pg="nombre" autocomplete="name" maxlength="100" value="${esc(v.nombre)}" required>`)}
      ${o.sinCorreo ? '' : campo('email', 'Correo', `<input data-pg="email" type="email" autocomplete="email" maxlength="200" value="${esc(v.email)}" required>`)}
      ${campo('telefono', 'Número de teléfono', `<input data-pg="telefono" type="tel" autocomplete="tel" maxlength="30" placeholder="+56 9 1234 5678" value="${esc(v.telefono)}" required>`)}
      <label class="pg-acepta"><input type="checkbox" data-pg="contacto"${v.contacto ? ' checked' : ''}> <span>Acepto que Rubrofy me escriba por WhatsApp o correo para ayudarme con la prueba (opcional).</span></label>
      <p class="pg-nota">Tu teléfono sirve para que la prueba se use una vez por número. Si no marcas la casilla, no te escribiremos por él.</p>
    </div>`;
  }

  function leer(raiz) {
    const val = (k) => { const el = raiz.querySelector(`[data-pg="${k}"]`); return el ? el.value : undefined; };
    const c = raiz.querySelector('[data-pg="contacto"]');
    return { nombre: val('nombre'), email: val('email'), telefono: val('telefono'), contacto: !!(c && c.checked) };
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
