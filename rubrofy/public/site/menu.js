// Menú del teléfono. En pantallas angostas la cabecera esconde las secciones
// (y "Entra"); este botón abre una hoja que sube desde abajo con ellas. Fuera
// de la portada, las secciones llevan a la portada.
(function () {
  var cabecera = document.querySelector('header.top');
  var fila = cabecera && cabecera.querySelector('.topinner');
  if (!fila) return;

  var SECCIONES = [
    ['como-funciona', 'Cómo funciona'],
    ['que-recibes', 'Qué recibes'],
    ['diferencias', 'Por qué Rubrofy'],
    ['precios', 'Precios'],
    ['preguntas', 'Preguntas'],
  ];
  var enPortada = location.pathname === '/' || location.pathname === '/index.html';

  var boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'menu-btn';
  boton.setAttribute('aria-controls', 'menu-movil');
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-label', 'Abrir menú');
  boton.innerHTML = '<span></span><span></span><span></span>';

  var panel = document.createElement('nav');
  panel.id = 'menu-movil';
  panel.className = 'menu-movil';
  panel.setAttribute('aria-label', 'Menú');
  panel.hidden = true;
  panel.innerHTML = '<span class="menu-asa" aria-hidden="true"></span>' +
    '<p class="menu-tit">Ir a</p>' +
    '<div class="menu-chips">' + SECCIONES.map(function (s) {
      return '<a class="menu-link" href="' + (enPortada ? '#' : '/#') + s[0] + '">' + s[1] + '</a>';
    }).join('') + '</div>' +
    '<div class="menu-ctas">' +
    '<a class="btn btn-negro" href="/registro.html">Prueba 7 días gratis</a>' +
    '<a class="btn btn-borde" href="/app">Entra a tu cuenta</a>' +
    '</div>';

  var fondo = document.createElement('div');
  fondo.className = 'menu-fondo';
  fondo.hidden = true;

  var ctas = fila.querySelector('.top-ctas');
  (ctas || fila).appendChild(boton);
  cabecera.appendChild(panel);
  document.body.appendChild(fondo);

  function abrir(si) {
    // La hoja nunca tapa la cabecera, para que la ✕ siga a mano.
    if (si) panel.style.maxHeight = Math.max(240, window.innerHeight - cabecera.getBoundingClientRect().bottom - 12) + 'px';
    panel.style.transform = '';
    panel.hidden = !si;
    fondo.hidden = !si;
    boton.setAttribute('aria-expanded', si ? 'true' : 'false');
    boton.setAttribute('aria-label', si ? 'Cerrar menú' : 'Abrir menú');
    document.documentElement.classList.toggle('menu-abierto', si);
  }

  boton.addEventListener('click', function () { abrir(panel.hidden); });
  fondo.addEventListener('click', function () { abrir(false); });
  panel.addEventListener('click', function (e) { if (e.target.closest('a')) abrir(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) { abrir(false); boton.focus(); }
  });

  // Deslizar la hoja hacia abajo la cierra, como en las apps.
  var inicioY = null;
  panel.addEventListener('touchstart', function (e) {
    inicioY = panel.scrollTop <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  panel.addEventListener('touchmove', function (e) {
    if (inicioY === null) return;
    var dy = e.touches[0].clientY - inicioY;
    panel.style.transform = dy > 0 ? 'translateY(' + dy + 'px)' : '';
  }, { passive: true });
  panel.addEventListener('touchend', function (e) {
    if (inicioY === null) return;
    var dy = e.changedTouches[0].clientY - inicioY;
    inicioY = null;
    if (dy > 70) abrir(false);
    else panel.style.transform = '';
  });

  // Si la ventana se agranda (girar el teléfono, por ejemplo), el menú de
  // escritorio vuelve a verse y esta hoja sobra.
  window.matchMedia('(min-width: 821px)').addEventListener('change', function (m) { if (m.matches) abrir(false); });
})();
