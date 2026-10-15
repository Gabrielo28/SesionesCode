/*
 * Medición de influencechile.cl — un solo lugar para los IDs.
 *
 * 1. Pega aquí tu ID de Google Analytics 4 (G-XXXXXXX) y/o de tu píxel de Meta.
 * 2. Sube el sitio a Netlify. Listo: ambos se cargan en todas las páginas.
 *
 * Eventos que se registran solos:
 *   ClicWhatsApp       cualquier link o botón que abra WhatsApp (dice desde qué sección)
 *   EscanerInicio      alguien empezó el escáner
 *   EscanerCompleto    alguien terminó el escáner (con cantidad de códigos y críticos)
 *   EscanerWhatsApp    alguien escribió desde el resultado del escáner
 * En Meta, ClicWhatsApp también se envía como "Contact" para optimizar campañas.
 */
window.INFLUENCE_MEDICION = {
  GA4_ID: '',          // ej: 'G-ABC123XYZ'
  META_PIXEL_ID: ''    // ej: '123456789012345'
};

(function () {
  var cfg = window.INFLUENCE_MEDICION || {};
  if (cfg.GA4_ID) {
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + cfg.GA4_ID; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', cfg.GA4_ID);
  }
  if (cfg.META_PIXEL_ID) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', cfg.META_PIXEL_ID); window.fbq('track', 'PageView');
  }

  // Clics a WhatsApp: links wa.me y botones que abren WhatsApp con window.open
  function seccion(el) { var s = el && el.closest && el.closest('section[id]'); return s ? s.id : (el && el.closest && el.closest('footer') ? 'footer' : 'otra'); }
  function registrar(origen) {
    try { if (window.gtag) window.gtag('event', 'ClicWhatsApp', { seccion: origen }); } catch (e) {}
    try { if (window.fbq) { window.fbq('track', 'Contact', { content_name: origen }); window.fbq('trackCustom', 'ClicWhatsApp', { seccion: origen }); } } catch (e) {}
  }
  var ultimo = 'otra';
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('a,button') : null; if (!el) return;
    ultimo = seccion(el);
    var href = el.getAttribute('href') || '';
    if (/wa\.me|api\.whatsapp\.com/.test(href)) registrar(ultimo);
  }, true);
  var abrir = window.open;
  window.open = function (url) { try { if (/wa\.me|api\.whatsapp\.com/.test(String(url))) registrar(ultimo); } catch (e) {} return abrir.apply(window, arguments); };
})();
