// Rubrofy como app instalable (PWA) y notificaciones push en este
// dispositivo. Registra el service worker, ofrece "Instalar Rubrofy" (en
// iPhone explica cómo agregarlo a la pantalla de inicio, que es requisito
// para recibir notificaciones ahí) y activa o desactiva las notificaciones.
(function () {
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let eventoInstalar = null;
  let registro = null;

  const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const soportaPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function dispositivo() {
    const ua = navigator.userAgent;
    const so = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /mac os/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'Computador';
    const nav = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Navegador';
    return `${so} · ${nav}${instalada() ? ' (app)' : ''}`;
  }

  function claveABytes(b64) {
    const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  async function iniciar() {
    if ('serviceWorker' in navigator) {
      try { registro = await navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }); } catch (err) { registro = null; }
    }
    window.addEventListener('beforeinstallprompt', (ev) => {
      ev.preventDefault();
      eventoInstalar = ev;
      mostrarBotonInstalar();
    });
    window.addEventListener('appinstalled', () => { eventoInstalar = null; mostrarBotonInstalar(); });
    mostrarBotonInstalar();
  }

  function mostrarBotonInstalar() {
    const b = document.getElementById('btn-instalar');
    if (!b) return;
    b.hidden = instalada() || !(eventoInstalar || esIOS());
  }

  async function instalar() {
    if (eventoInstalar) {
      eventoInstalar.prompt();
      await eventoInstalar.userChoice.catch(() => null);
      eventoInstalar = null;
      mostrarBotonInstalar();
      return;
    }
    const dlg = document.getElementById('dlg-instalar');
    if (dlg && dlg.showModal) dlg.showModal();
  }

  async function suscripcionActual() {
    if (!soportaPush()) return null;
    const reg = registro || await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  // Tarjeta "Notificaciones en este dispositivo" (Conexiones y ajustes).
  async function renderTarjeta(cont, ctx) {
    if (!cont) return;
    const titulo = '<div class="ig-card-head"><h2>Notificaciones en este dispositivo' + (window.Ayuda ? window.Ayuda.boton('notificaciones') : '') + '</h2><span class="ig-estado" data-push-estado></span></div>';
    const intro = '<p class="sub">Te avisamos cuando se publica algo, si una publicación falla, cuando tu video con IA está listo o un Reel tuyo destaca, y cada lunes lo que tienes por aprobar.</p>';
    if (!soportaPush()) {
      cont.innerHTML = titulo + intro + (esIOS() && !instalada()
        ? '<p class="sub">En iPhone, primero instala Rubrofy en tu pantalla de inicio (botón <b>Instalar Rubrofy</b>) y activa las notificaciones desde ahí.</p>'
        : '<p class="sub">Este navegador no permite notificaciones. Prueba con Chrome, Edge, Firefox o Safari actualizados.</p>');
      return;
    }
    const sub = await suscripcionActual().catch(() => null);
    let lista = [];
    try { lista = (await ctx.api(`/api/negocios/${ctx.negocio.id}/push`)).dispositivos; } catch (err) { lista = []; }
    const activa = !!(sub && lista.some((d) => d.endpoint === sub.endpoint));
    const bloqueadas = Notification.permission === 'denied';
    cont.innerHTML = titulo + intro + `
      ${bloqueadas ? '<p class="config-error">Bloqueaste las notificaciones de Rubrofy en este navegador. Permítelas en la configuración del sitio y vuelve a intentar.</p>' : ''}
      ${lista.length ? `<p class="sub">Dispositivos activos: ${lista.map((d) => `<b>${e(d.dispositivo || 'Dispositivo')}</b>`).join(', ')}.</p>` : ''}
      <p class="config-error" data-push-error hidden></p>
      <div class="config-actions">
        ${activa ? '<button type="button" class="btn-ghost" data-push="prueba">Enviarme una de prueba</button><button type="button" class="btn-text" data-push="apagar">Desactivar en este dispositivo</button>'
          : `<button type="button" class="btn-approve" data-push="activar" ${bloqueadas ? 'disabled' : ''}>Activar notificaciones</button>`}
      </div>`;
    const estado = cont.querySelector('[data-push-estado]');
    estado.textContent = activa ? 'Activas' : 'Apagadas';
    estado.classList.toggle('conectado', activa);
    const error = cont.querySelector('[data-push-error]');
    const fallo = (m) => { error.textContent = m; error.hidden = false; };
    const b = (k) => cont.querySelector(`[data-push="${k}"]`);
    if (b('activar')) b('activar').addEventListener('click', async () => {
      try {
        await activar(ctx);
        renderTarjeta(cont, ctx);
      } catch (err) {
        fallo(err.mensaje || err.message || 'No se pudieron activar las notificaciones.');
      }
    });
    if (b('apagar')) b('apagar').addEventListener('click', async () => {
      await ctx.api(`/api/negocios/${ctx.negocio.id}/push`, { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
      renderTarjeta(cont, ctx);
    });
    if (b('prueba')) b('prueba').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try {
        const r = await ctx.api(`/api/negocios/${ctx.negocio.id}/push/prueba`, { method: 'POST' });
        ev.target.textContent = r.enviados ? 'Enviada: revisa tus notificaciones' : 'No llegó: desactiva y vuelve a activar';
      } catch (err) {
        fallo(err.mensaje || 'No se pudo enviar.');
      }
    });
  }

  async function activar(ctx) {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') throw new Error('No diste permiso para mostrar notificaciones.');
    const { clave } = await ctx.api('/api/push/clave');
    const reg = registro || await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(clave) });
    await ctx.api(`/api/negocios/${ctx.negocio.id}/push`, { method: 'POST', body: JSON.stringify({ suscripcion: sub.toJSON(), dispositivo: dispositivo() }) });
    try { localStorage.setItem('rubrofy-push-aviso', 'visto'); } catch (err) { /* sin almacenamiento */ }
  }

  // Aviso chico en Por aprobar para quien todavía no activa las notificaciones.
  async function aviso(cont, ctx) {
    if (!cont) return;
    cont.innerHTML = '';
    let visto = null;
    try { visto = localStorage.getItem('rubrofy-push-aviso'); } catch (err) { visto = 'visto'; }
    if (visto || !soportaPush() || Notification.permission === 'denied') return;
    const sub = await suscripcionActual().catch(() => null);
    if (sub) return;
    cont.innerHTML = `<div class="res-aviso push-aviso"><span>🔔 Activa las notificaciones y te avisamos cuando tengas contenido por aprobar o algo necesite tu atención.</span>
      <button type="button" class="btn-approve" data-push-si>Activar</button><button type="button" class="btn-text" data-push-no>Ahora no</button></div>`;
    cont.querySelector('[data-push-si]').addEventListener('click', async () => {
      try { await activar(ctx); cont.innerHTML = '<div class="res-aviso push-aviso"><span>Listo: te avisaremos en este dispositivo.</span></div>'; } catch (err) { cont.innerHTML = `<div class="res-aviso error">${e(err.mensaje || err.message)}</div>`; }
    });
    cont.querySelector('[data-push-no]').addEventListener('click', () => {
      try { localStorage.setItem('rubrofy-push-aviso', 'visto'); } catch (err) { /* nada */ }
      cont.innerHTML = '';
    });
  }

  window.RubrofyPWA = { iniciar, instalar, renderTarjeta, aviso, mostrarBotonInstalar };
  iniciar();

  // Versión nueva: si se publicó una actualización mientras la app estaba
  // abierta (o instalada en el celular), se ofrece recargar.
  (function vigilarVersion() {
    // Todos los archivos del panel llevan la misma versión (?v=N).
    const propio = document.currentScript || document.querySelector('script[src*="/app/pwa.js?v="]');
    const mia = propio && (/[?&]v=(\d+)/.exec(propio.getAttribute('src')) || [])[1];
    if (!mia) return;
    let ultima = 0;
    const revisar = async () => {
      if (document.hidden || Date.now() - ultima < 60 * 1000 || document.getElementById('aviso-version')) return;
      ultima = Date.now();
      try {
        const html = await (await fetch('/app/', { cache: 'no-store' })).text();
        const nueva = (/\/app\/app\.js\?v=(\d+)/.exec(html) || [])[1];
        if (!nueva || nueva === mia) return;
        const aviso = document.createElement('div');
        aviso.id = 'aviso-version';
        aviso.className = 'aviso-version';
        aviso.setAttribute('role', 'status');
        aviso.innerHTML = '<span>Hay una versión nueva de Rubrofy.</span><button type="button" class="btn-approve">Actualizar</button>';
        aviso.querySelector('button').onclick = () => location.reload();
        document.body.appendChild(aviso);
      } catch (err) { /* sin conexión: se revisa después */ }
    };
    document.addEventListener('visibilitychange', revisar);
    window.addEventListener('focus', revisar);
    setInterval(revisar, 10 * 60 * 1000);
    setTimeout(revisar, 5000);
  })();
})();
