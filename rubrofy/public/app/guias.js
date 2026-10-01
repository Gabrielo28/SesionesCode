// Guías del panel: en cada pantalla un banner que explica en 3 pasos qué se
// hace ahí, un recorrido con carteles que ilumina los botones uno a uno, un
// consejo corto cuando se cierra el banner, el avance de la ruta en el menú y
// el botón "¿Cómo se usa esto?". Lo cerrado se recuerda en este navegador.
// Se apaga para todos con GUIAS=no en el servidor, o por cuenta en
// Conexiones y ajustes → Guías y consejos.
(function () {
  'use strict';

  const GUIAS = {
    inicio: {
      ilu: '⌂', titulo: 'Tu punto de partida',
      texto: 'Aquí Rubrofy te dice qué hacer hoy. Si sigues los pasos en orden, no te pierdes nada.',
      pasos: [['Mira “Qué hacer ahora”', 'Tus tareas de hoy, de la más importante a la menos.'], ['Toca el botón de cada tarea', 'Te lleva directo a la pantalla donde se hace.'], ['Sigue tu ruta', 'Configuras una vez; después solo revisas cada semana y mides cada mes.']],
      pista: 'Si no sabes qué hacer, vuelve a Inicio: siempre te muestra el siguiente paso.',
      tour: [
        { sel: '#view-inicio .ru-ahora', t: 'Qué hacer ahora', d: 'Empieza por la primera tarea. Cada una tiene un botón que te lleva donde se hace.' },
        { sel: '#view-inicio .ru-etapas', t: 'Tu ruta en 4 etapas', d: 'Configura, Crea cada semana, Mide y Mejora cada mes. Toca una etapa para ver sus pasos.' },
        { sel: '#btn-generar', t: 'Genera tu semana', d: 'Una vez por semana, este botón crea todas tus publicaciones según tu estrategia.' },
        { sel: '.rail', t: 'El menú sigue el mismo orden', d: 'Arriba lo que configuras una vez; luego lo de cada semana, lo que mides y el informe del mes.' },
      ],
    },
    estrategia: {
      ilu: '◎', titulo: 'Tu estrategia: de qué hablar',
      texto: 'Rubrofy decide qué publicar según lo que pongas aquí. Lo llenas una vez y lo cambias cuando quieras.',
      pasos: [['Cuenta qué quieres lograr', 'Vender más, recibir consultas, ganar seguidores…'], ['Elige cuánto publicar', 'Un ritmo sugerido o tu propia cantidad por semana.'], ['Guarda', 'Desde la próxima semana tu contenido sigue este plan.']],
      pista: 'Si no sabes qué poner, toca “Proponer otra con IA” y después cambia lo que no te guste.',
      tour: [
        { sel: '#view-estrategia [data-seccion="plan"]', t: 'Tu negocio y tu objetivo', d: 'Cuéntale a Rubrofy qué vendes, a quién y qué te hace distinto. Elige hasta 2 objetivos.' },
        { sel: '#view-estrategia [data-seccion="ritmo"]', t: 'Cuánto publicar', d: 'Elige uno de los ritmos sugeridos o ajusta la cantidad de cada formato.' },
        { sel: '#view-estrategia [data-est-accion="proponer"]', t: 'Pídele ayuda a la IA', d: 'Rubrofy te propone una estrategia completa. Puedes editarla antes de guardarla.' },
        { sel: '#view-estrategia [data-est-accion="guardar-plan"]', t: 'No olvides guardar', d: 'Los cambios se usan desde la próxima vez que generes la semana.' },
      ],
    },
    voz: {
      ilu: '♪', titulo: 'Cómo habla tu marca',
      texto: 'Con esto Rubrofy escribe como tú y no como un robot.',
      pasos: [['Completa tu ficha', 'O toca “Completar con IA” y revisa lo que propone.'], ['Escribe con tu voz', 'Pide cualquier texto: una respuesta, una descripción, un aviso.'], ['Prueba un texto', 'Pega un texto y Rubrofy te dice qué tan “tuyo” suena.']],
      pista: 'Agrega 2 o 3 frases que digas siempre en tu negocio. Es lo que más ayuda a que suene a ti.',
      tour: [
        { sel: '#voz .voz-kpis', t: 'Qué tan fiel es tu voz', d: 'Rubrofy mide si lo que escribe suena como tu marca.' },
        { sel: '#voz .pestanas', t: 'Tres herramientas', d: 'Tu ficha de voz, escribir cualquier texto con tu voz y probar un texto que ya tengas.' },
        { sel: '#voz [data-sugerir]', t: 'Que la IA lo complete', d: 'Si no sabes qué escribir, Rubrofy llena la ficha y tú solo la revisas.' },
      ],
    },
    fotos: {
      ilu: '▦', titulo: 'Tu galería de fotos',
      texto: 'Mientras más fotos reales subas, mejor se ven tus publicaciones.',
      pasos: [['Sube tus fotos', 'Desde el celular o el computador: productos, local, equipo.'], ['O créalas con IA', 'Describe lo que quieres y elige la que más te guste.'], ['Rubrofy las usa', 'Elige la mejor foto para cada publicación. Tú puedes cambiarla.']],
      pista: 'Las fotos con personas reciben más “me gusta”. Sube alguna tuya o de tu equipo.',
      tour: [
        { sel: '#view-fotos .gl-subir', t: 'Sube tus fotos', d: 'Elige varias a la vez desde tu celular o computador. También puedes arrastrarlas.' },
        { sel: '#view-fotos [data-gl-abrir-ia]', t: 'Crea fotos con IA', d: 'Describe lo que quieres (“pan amasado recién salido del horno”) y elige la mejor.' },
        { sel: '#view-fotos .gl-filtros', t: 'Todo ordenado', d: 'Filtra por producto, local, equipo o las fotos creadas con IA.' },
      ],
    },
    estilo: {
      ilu: '★', titulo: 'Muéstrale tu estilo',
      texto: 'Pega publicaciones que ya hiciste y Rubrofy aprende a hacer contenido parecido.',
      pasos: [['Agrega ejemplos', 'Copia el texto de 3 a 5 publicaciones tuyas que te gusten.'], ['Analiza con IA', 'Rubrofy escribe una guía de tu estilo.'], ['Ajusta la guía', 'Cambia lo que quieras: es tu manual de estilo.']],
      pista: 'Usa las publicaciones que mejor te funcionaron: Rubrofy aprende de ellas.',
      tour: [
        { sel: '#estilo form[data-form="referencia"]', t: 'Agrega un ejemplo', d: 'Elige el formato, pega el texto y, si quieres, el enlace y cómo le fue.' },
        { sel: '#estilo [data-estilo="analizar"]', t: 'Analiza tu estilo', d: 'Con algunos ejemplos, Rubrofy escribe la guía por ti.' },
        { sel: '#estilo .res-grid .res-card', t: 'Tu guía de estilo', d: 'Lo que Rubrofy sigue al escribir. Puedes editarla cuando quieras.' },
      ],
    },
    contexto: {
      ilu: '☰', titulo: 'Instrucciones para la IA',
      texto: 'Opcional. Aquí escribes cosas que la IA siempre debe tener en cuenta.',
      pasos: [['Escríbelo simple', 'Ej: “nunca digas barato”, “siempre menciona el delivery”.'], ['Por sección', 'General, textos, cada formato, fotos y videos.'], ['Guarda', 'Se aplica la próxima vez que Rubrofy cree contenido.']],
      pista: 'No es obligatorio. Si te gusta lo que Rubrofy escribe, puedes saltarte esta sección.',
      tour: [
        { sel: '#contexto .ctx-grupo', t: 'Lo general', d: 'Lo que vale para todo: cómo es tu negocio y qué evitar.' },
        { sel: '#contexto .ctx-pie', t: 'Guarda', d: 'Un solo botón guarda todas las secciones.' },
      ],
    },
    cola: {
      ilu: '▤', titulo: 'Así funciona tu semana',
      texto: 'Rubrofy prepara tus publicaciones. Tú solo revisas, completas lo que falte y apruebas.',
      pasos: [['Genera la semana', 'Rubrofy escribe los textos según tu negocio.'], ['Completa lo que falta', 'Si una tarjeta pide foto o video, agrégalo ahí mismo.'], ['Aprueba', 'Se publica sola en la fecha indicada. Nada sale sin tu aprobación.']],
      pista: 'Las tarjetas con fondo rayado necesitan una foto o un video. Las demás solo esperan tu aprobación.',
      tour: [
        { sel: '#btn-generar', t: 'Empieza aquí', d: 'Una vez por semana, toca este botón y Rubrofy crea todas las publicaciones de la semana.' },
        { sel: '#cola-grid .card', t: 'Cada tarjeta es una publicación', d: 'Así se verá en Instagram, con su día, hora y formato.' },
        { sel: '#cola-grid .card-vacia', t: '¿Falta la foto o el video?', d: 'Elígela de tu galería, súbela desde el celular o pídele a la IA que la cree.' },
        { sel: '#cola-grid .card-date-btn', t: 'Cambia el día', d: 'Toca la fecha para mover la publicación a otro día u hora.' },
        { sel: '#cola-grid .card-actions', t: 'Aprueba y listo', d: '“Aprobar” la deja programada. Si no te convence, pide “Otra versión” o un cambio puntual.' },
        { sel: '.rail-btn[data-view="reels"]', t: 'Tus videos, aquí', d: 'En Estudio de reels subes un video y Rubrofy lo edita por ti.' },
      ],
    },
    reels: {
      ilu: '▶', titulo: 'Cómo hacer un reel',
      texto: 'No necesitas saber editar. Graba con tu celular y Rubrofy hace el resto.',
      pasos: [['Sube tu video', 'Unos 30 segundos, grabado con el celular.'], ['Elige qué arreglar', 'Ya vienen marcadas las mejores opciones.'], ['Míralo y úsalo', 'Revisa cómo quedó y apruébalo como cualquier publicación.']],
      pista: 'Graba en vertical y con buena luz. No importa si te equivocas: Rubrofy corta las pausas.',
      tour: [
        { sel: '#reels-estudio .rs-pasos', t: 'Lo que hace Rubrofy', d: 'Corta silencios, pone subtítulos, tu gancho, tu logo y el llamado a la acción.' },
        { sel: '#reels-estudio .rs-item', t: 'Tus reels de la semana', d: 'Cada reel de tu semana aparece aquí con su idea de grabación.' },
        { sel: '#reels-estudio .rs-acc', t: 'Sube el video', d: 'Toca aquí, elige el video y Rubrofy abre el editor.' },
      ],
    },
    calendario: {
      ilu: '▭', titulo: 'Tu mes de un vistazo',
      texto: 'Cada publicación aparece en su día. Toca una para ver el detalle.',
      pasos: [['Mira el mes', 'Ves de un vistazo qué días tienen publicación.'], ['Toca una publicación', 'Al lado ves su texto e imagen.'], ['¿Otro día?', 'Cámbialo desde la tarjeta en Por aprobar, tocando la fecha.']],
      pista: 'Lo aprobado se publica solo a su hora si Instagram está conectado.',
      tour: [
        { sel: '#cal-grid', t: 'Tu mes', d: 'Cada cuadro es un día. Las publicaciones aparecen en su fecha.' },
        { sel: '#cal-grid .cal-chip', t: 'Una publicación', d: 'Tócala para ver el detalle.' },
        { sel: '#cal-detail', t: 'El detalle', d: 'Aquí aparece el texto, la imagen y el estado de la publicación que elijas.' },
      ],
    },
    'res-instagram': {
      ilu: '↗', titulo: 'Cómo le va a tu Instagram',
      texto: 'Rubrofy mide tus publicaciones y aprende qué te funciona.',
      pasos: [['Conecta Instagram', 'Sin conexión no hay datos que mostrar.'], ['Mira lo importante', 'Cuántas personas te vieron y qué publicación funcionó mejor.'], ['Rubrofy aprende solo', 'Usa estos datos para mejorar la semana siguiente.']],
      pista: 'Revisa esta pantalla una vez a la semana; no hace falta más.',
      tour: [
        { sel: '#resultados-pestanas', t: 'Elige qué mirar', d: 'Tu Instagram, tu publicidad en Meta o Google, o tu competencia.' },
        { sel: '#resultados', t: 'Tus números', d: 'Lo más importante arriba. Rubrofy te explica qué significa cada cosa.' },
      ],
    },
    'res-publicidad': {
      ilu: '◁', titulo: 'Tu publicidad, en simple',
      texto: 'Si pagas anuncios en Instagram, Facebook o Google, aquí ves si están funcionando.',
      pasos: [['Conecta tu cuenta de anuncios', 'Se hace en Conexiones y ajustes.'], ['Mira cuánto gastas y qué logras', 'Comparado con el período anterior.'], ['Lee el diagnóstico', 'Rubrofy te dice en palabras simples qué mejorar.']],
      pista: 'Si no haces publicidad pagada, puedes ignorar esta pantalla.',
      tour: [
        { sel: '#resultados-pestanas', t: 'Meta o Google', d: 'Cambia entre tus anuncios de Instagram/Facebook y los de Google.' },
        { sel: '#resultados', t: 'Tus anuncios', d: 'Gasto, resultados y costo de cada resultado, con un diagnóstico al final.' },
      ],
    },
    'res-competencia': {
      ilu: '◑', titulo: 'Mira a tu competencia',
      texto: 'Compara tu Instagram con el de negocios parecidos al tuyo.',
      pasos: [['Agrega cuentas', 'Instagram de negocios parecidos al tuyo.'], ['Compara', 'Qué publican, cada cuánto y qué les funciona.'], ['Inspírate', 'Rubrofy te sugiere ideas a partir de lo que ve.']],
      pista: 'Con 3 a 5 cuentas parecidas a la tuya es suficiente.',
      tour: [
        { sel: '#resultados', t: 'Tu competencia', d: 'Agrega cuentas y Rubrofy las analiza por ti.' },
      ],
    },
    config: {
      ilu: '⚙', titulo: 'Tus ajustes',
      texto: 'Aquí conectas Instagram, subes tu logo y administras tu plan.',
      pasos: [['Conecta Instagram', 'Es lo más importante: sin esto, nada se publica solo.'], ['Sube tu logo y colores', 'En Kit de marca. Rubrofy los usa en tus diseños.'], ['Revisa tu plan', 'Al final de la página: plan, pago y recargas.']],
      pista: 'Usa el índice de arriba para saltar directo a cada parte.',
      tour: [
        { sel: '#view-config .cfg-indice', t: 'Índice', d: 'Toca una parte para ir directo a ella.' },
        { sel: '#ig-card', t: 'Conecta Instagram', d: 'Inicias sesión en Instagram y aceptas los permisos. Solo se hace una vez.' },
        { sel: '#marca-card', t: 'Tu Kit de marca', d: 'Logo, colores y letra. Rubrofy los pone en tus diseños y reels.' },
        { sel: '#plan-card', t: 'Plan y pago', d: 'Tu plan, cómo pagas y las recargas si necesitas más.' },
      ],
    },
  };

  let ctx = null, clave = null, estado = { off: false, cerradas: [] };
  let ruta = null, rutaPedidaEl = 0;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const llave = () => 'rubrofy-guias:' + (ctx && ctx.negocio ? ctx.negocio.id : '');
  function cargar() {
    estado = { off: false, cerradas: [] };
    try { Object.assign(estado, JSON.parse(localStorage.getItem(llave())) || {}); } catch { /* sin almacenamiento: todo visible */ }
  }
  function guardar() { try { localStorage.setItem(llave(), JSON.stringify(estado)); } catch { /* sin almacenamiento */ } }
  const habilitadas = () => !!(ctx && ctx.negocio && ctx.negocio.guias !== false);
  const activas = () => habilitadas() && !estado.off;
  const cerrada = (k) => estado.cerradas.includes(k);
  function cerrar(k) { if (!cerrada(k)) estado.cerradas.push(k); guardar(); pintar(); }

  // clave de la guía según la vista (y la pestaña de Resultados)
  function claveDe(vista, tab) {
    if (vista !== 'resultados') return vista;
    return tab === 'competencia' ? 'res-competencia' : tab === 'meta' || tab === 'google' ? 'res-publicidad' : 'res-instagram';
  }

  function contenedor(vista) {
    const sec = document.getElementById('view-' + vista);
    if (!sec) return null;
    let el = sec.querySelector(':scope > .guia-zona');
    if (!el) {
      el = document.createElement('div'); el.className = 'guia-zona';
      el.innerHTML = '<div class="guia" role="note"></div><div class="guia-pista" role="note"></div>';
      // Inicio se pinta entero dentro de #inicio: la guía va antes.
      if (vista === 'inicio') sec.prepend(el); else sec.firstElementChild.after(el);
    }
    return el;
  }

  function pintar() {
    document.querySelectorAll('.guia-zona').forEach((z) => { z.hidden = true; });
    pintarAvance();
    const flot = document.getElementById('guias-ayuda');
    if (flot) flot.hidden = !habilitadas();
    if (!clave || !activas() || !GUIAS[clave]) return;
    const g = GUIAS[clave], zona = contenedor(ctx.vista);
    if (!zona) return;
    zona.hidden = false;
    const banner = zona.querySelector('.guia'), pista = zona.querySelector('.guia-pista');
    banner.hidden = cerrada(clave);
    pista.hidden = !cerrada(clave) || cerrada(clave + ':pista');
    banner.innerHTML = `<div class="guia-ilu" aria-hidden="true">${g.ilu}</div>
      <div class="guia-cuerpo"><h2>${esc(g.titulo)}</h2><p>${esc(g.texto)}</p>
        <ol>${g.pasos.map(([b, s], i) => `<li><span class="guia-n">${i + 1}</span><span><b>${esc(b)}</b><small>${esc(s)}</small></span></li>`).join('')}</ol>
        <div class="guia-acc"><button type="button" class="btn-approve" data-guia-tour>▶ Muéstrame cómo</button><button type="button" class="btn-ghost" data-guia-cerrar="${clave}">Entendido</button></div>
      </div>
      <button type="button" class="guia-x" data-guia-cerrar="${clave}" aria-label="Cerrar guía">×</button>`;
    pista.innerHTML = `<span aria-hidden="true">💡</span><span><b>Consejo:</b> ${esc(g.pista)}</span><button type="button" class="guia-x" data-guia-cerrar="${clave}:pista" aria-label="Cerrar consejo">×</button>`;
  }

  // Avance de la ruta (server/ruta.js) en el menú: cuánto falta y el siguiente paso.
  function pintarAvance() {
    const el = document.getElementById('rail-avance');
    if (!el) return;
    if (!activas() || !ruta || !ruta.siguientes || !ruta.siguientes.length) { el.hidden = true; return; }
    const etapas = ruta.etapas || [];
    const hechos = etapas.reduce((s, e) => s + (e.hechos || 0), 0), total = etapas.reduce((s, e) => s + (e.total || 0), 0);
    if (!total) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<span class="ra-t">Tu avance <em>${hechos} de ${total}</em></span><span class="ra-barra"><i style="width:${Math.round(hechos / total * 100)}%"></i></span>
      <span class="ra-sig">Siguiente: <b>${esc(ruta.siguientes[0].titulo)}</b></span>`;
  }
  function pedirRuta(forzar) {
    if (!ctx || !ctx.api || !ctx.negocio || !activas()) return;
    if (!forzar && Date.now() - rutaPedidaEl < 20000) return;
    rutaPedidaEl = Date.now();
    ctx.api(`/api/negocios/${ctx.negocio.id}/ruta`).then((r) => { ruta = r; pintarAvance(); }).catch(() => {});
  }

  // --- recorrido con carteles ---
  let tour = null, paso = 0;
  const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
  function iniciarTour(pasos) {
    const validos = (pasos || []).filter((s) => visible(document.querySelector(s.sel)));
    if (!validos.length) return;
    cerrarTour(); tour = validos; paso = 0; mostrarPaso();
  }
  function cerrarTour() {
    tour = null;
    ['guia-foco', 'guia-cartel'].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
  }
  function mostrarPaso() {
    const s = tour[paso], el = document.querySelector(s.sel);
    if (!visible(el)) { cerrarTour(); return; }
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    let foco = document.getElementById('guia-foco'), c = document.getElementById('guia-cartel');
    if (!foco) { foco = document.createElement('div'); foco.id = 'guia-foco'; document.body.append(foco); }
    if (!c) { c = document.createElement('div'); c.id = 'guia-cartel'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-live', 'polite'); document.body.append(c); }
    const ult = paso === tour.length - 1;
    c.innerHTML = `${tour.length > 1 ? `<div class="gc-cuenta">Paso ${paso + 1} de ${tour.length}</div>` : ''}<h3>${esc(s.t)}</h3><p>${esc(s.d)}</p>
      <div class="gc-pie">${tour.length > 1 && !ult ? '<button type="button" class="gc-saltar" data-gc="fin">Saltar</button>' : '<span class="gc-esp"></span>'}${paso > 0 ? '<button type="button" class="btn-ghost" data-gc="ant">Anterior</button>' : ''}<button type="button" class="btn-approve" data-gc="${ult ? 'fin' : 'sig'}">${ult ? 'Entendido' : 'Siguiente'}</button></div>`;
    colocar(); setTimeout(colocar, 400);
    c.querySelector('.btn-approve').focus({ preventScroll: true });
  }
  function colocar() {
    if (!tour) return;
    const el = document.querySelector(tour[paso].sel), foco = document.getElementById('guia-foco'), c = document.getElementById('guia-cartel');
    if (!el || !foco || !c) return;
    const r = el.getBoundingClientRect(), m = 6, vw = document.documentElement.clientWidth, vh = innerHeight;
    // un bloque más alto que la pantalla se ilumina solo en su parte visible
    const top = Math.max(r.top, 8), bottom = Math.min(r.bottom, vh - 8);
    Object.assign(foco.style, { left: r.left - m + 'px', top: top - m + 'px', width: r.width + m * 2 + 'px', height: Math.max(bottom - top, 0) + m * 2 + 'px' });
    const w = c.offsetWidth, h = c.offsetHeight;
    let abajo = bottom + h + 24 < vh, arriba = top - h - 24 > 0, lado = null;
    let left = Math.min(Math.max(r.left + r.width / 2 - w / 2, 16), vw - w - 16), y;
    if (abajo) y = bottom + 16;
    else if (arriba) y = top - h - 16;
    else if (r.right + w + 32 < vw) { lado = 'der'; left = r.right + 16; y = Math.min(Math.max(top, 16), vh - h - 16); }
    else { y = vh - h - 16; }
    c.className = lado ? 'gc-lado' : abajo ? 'gc-abajo' : arriba ? 'gc-arriba' : 'gc-libre';
    c.style.left = left + 'px'; c.style.top = y + 'px';
    c.style.setProperty('--gc-flecha', Math.min(Math.max(r.left + r.width / 2 - left, 20), w - 20) + 'px');
  }
  addEventListener('resize', colocar);
  addEventListener('scroll', colocar, { passive: true, capture: true });
  addEventListener('keydown', (e) => {
    if (!tour) return;
    if (e.key === 'Escape') cerrarTour();
    else if (e.key === 'ArrowRight' && paso < tour.length - 1) { paso++; mostrarPaso(); }
    else if (e.key === 'ArrowLeft' && paso > 0) { paso--; mostrarPaso(); }
  });

  document.addEventListener('click', (e) => {
    const gc = e.target.closest('#guia-cartel [data-gc]');
    if (gc) {
      if (gc.dataset.gc === 'fin') cerrarTour();
      else { paso += gc.dataset.gc === 'sig' ? 1 : -1; mostrarPaso(); }
      return;
    }
    const c = e.target.closest('[data-guia-cerrar]');
    if (c) return cerrar(c.dataset.guiaCerrar);
    if (e.target.closest('[data-guia-tour]') || e.target.closest('#guias-ayuda')) return clave && GUIAS[clave] && iniciarTour(GUIAS[clave].tour);
    if (e.target.closest('#rail-avance') && ctx) return ctx.irA('inicio');
  });

  // Lo llama el panel cada vez que pinta una vista (es idempotente).
  function mostrar(vista, tab, contexto) {
    const antes = ctx && ctx.negocio && ctx.negocio.id;
    ctx = Object.assign({}, contexto, { vista });
    if (antes !== (ctx.negocio && ctx.negocio.id)) { cargar(); ruta = null; rutaPedidaEl = 0; }
    const nueva = claveDe(vista, tab);
    if (nueva !== clave) { cerrarTour(); clave = nueva; pedirRuta(); }
    pintar();
  }

  // Interruptor en Conexiones y ajustes.
  function ajustes() {
    return { habilitadas: habilitadas(), activas: !estado.off, cerradas: estado.cerradas.length };
  }
  function activar(si) { estado.off = !si; guardar(); if (si) pedirRuta(true); else cerrarTour(); pintar(); }
  function reiniciar() { estado = { off: false, cerradas: [] }; guardar(); pedirRuta(true); pintar(); }

  window.RubrofyGuias = { mostrar, ajustes, activar, reiniciar, refrescarRuta: () => pedirRuta(true), GUIAS };
})();
