// Bienvenida: la primera vez que un negocio entra al panel, Rubrofy lo
// conoce con una pregunta por pantalla (botones grandes; las de una sola
// respuesta avanzan solas) y pantallas cortas que explican qué hace Rubrofy.
// El orden es el de Rubrofy: el negocio (su web, qué es, qué ofrece, a quién,
// por qué lo eligen, cómo le compran y dónde lo encuentran), qué quiere
// lograr en Instagram, cómo sonar y cuánto publicar; con eso arma su
// estrategia, conecta su Instagram y crea su primera semana. Guarda los
// mismos datos que la vista Estrategia (perfil, datos, plan de contenido).
//
// Cuentas que ya habían pasado la bienvenida antes de que existiera el
// perfil ven solo las preguntas del negocio (modo "perfil").
(function () {
  'use strict';
  const P = () => window.RubrofyPlan;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const sinHtml = (t) => String(t || '').replace(/<[^>]+>/g, '');

  // Cómo suena cada tono (ejemplos genéricos, para elegir con un vistazo).
  const EJEMPLO_TONO = {
    cercano: '"¡Hola! Te contamos lo nuevo de esta semana 😊"',
    profesional: '"Te explicamos en 3 pasos cómo elegir lo que necesitas."',
    divertido: '"Spoiler: esta semana te vas a tentar 🤭"',
    inspirador: '"Todo empezó con una idea simple: hacerlo bien."',
    premium: '"Pocas piezas. Hechas con calma. Para quien nota la diferencia."',
  };

  // Cintas del fondo: colores planos de Rubrofy (rosado, rosado suave y negro).
  const CINTAS = `<svg class="bv2-cintas" viewBox="0 0 400 520" preserveAspectRatio="none" aria-hidden="true">
    <path class="c1" d="M-60 120 C 40 40, 150 40, 230 120 S 390 230, 470 150 L 470 230 C 380 300, 290 250, 220 200 S 40 170, -60 240 Z"/>
    <path class="c2" d="M-60 230 C 60 160, 150 180, 235 245 S 380 330, 470 255 L 470 330 C 370 395, 280 350, 205 300 S 50 285, -60 345 Z"/>
    <path class="c3" d="M-60 330 C 70 280, 170 305, 245 360 S 380 425, 470 360 L 470 405 C 370 465, 270 425, 200 385 S 40 370, -60 420 Z"/>
    <path class="c4" d="M-60 300 C 70 250, 170 275, 245 330 S 380 395, 470 330 L 470 338 C 380 403, 270 360, 200 322 S 50 300, -60 312 Z"/>
  </svg>`;

  // opciones.soloPerfil: completar solo las preguntas del negocio.
  async function abrir(ctx, opciones = {}) {
    const cat = await P().catalogo(ctx.api);
    const n0 = ctx.negocio();
    // Rubrofy es solo de pago: sin plan, después de conectar viene elegir
    // plan o activar la prueba; la primera semana se crea al volver del pago.
    const sinPlan = !!n0.sinPlan;
    const pr0 = n0.prueba || {};
    const catPrueba = sinPlan && pr0.disponible && window.RubrofyPrueba ? await window.RubrofyPrueba.cargar().catch(() => null) : null;
    const conIA = !!(n0.usaIA && n0.iaConfigurada);
    const solo = !!opciones.soloPerfil;

    // Las respuestas, sobre lo que el negocio ya tenía guardado.
    const r = {
      perfil: Object.assign({}, n0.perfil || {}),
      datos: Object.assign({}, n0.datos || {}),
      plan: Object.assign({}, n0.planContenido || {}),
    };
    if (!r.perfil.descripcion && n0.estrategia && n0.estrategia.rubro) r.perfil.descripcion = n0.estrategia.rubro;
    let leido = null; // lo que la IA encontró en su web
    let estrategiaLista = null; // la promesa de "Crear mi estrategia"

    // Las pantallas, en el orden de Rubrofy. sec: tramo de la barra de progreso.
    const E = [];
    if (!solo) E.push({ id: 'hola', sec: 0 });
    if (conIA) E.push({ id: 'web', sec: 0 });
    E.push({ id: 'descripcion', sec: 0 }, { id: 'oferta', sec: 0, auto: true }, { id: 'productos', sec: 0 }, { id: 'publico', sec: 0 },
      { id: 'diferenciador', sec: 0 }, { id: 'canales', sec: 0 }, { id: 'donde', sec: 0 });
    if (!solo) {
      E.push({ id: 'aprobar', sec: 1 }, { id: 'objetivos', sec: 1 }, { id: 'tono', sec: 1, auto: true }, { id: 'ritmo', sec: 1, auto: true },
        { id: 'aprende', sec: 2 }, { id: 'estrategia', sec: 2 }, { id: 'conexiones', sec: 3 });
      if (sinPlan) E.push({ id: 'plan', sec: 3 });
    }
    const TRAMOS = solo ? 1 : 4;
    let i = 0;
    const actual = () => E[i].id;

    const capa = document.createElement('div');
    capa.className = 'bv-capa bv2';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-label', 'Bienvenida a Rubrofy');
    document.body.appendChild(capa);
    const cerrar = () => capa.remove();

    function progreso() {
      const tramos = [];
      for (let t = 0; t < TRAMOS; t++) {
        const deTramo = E.filter((x) => x.sec === t);
        const pos = deTramo.indexOf(E[i]);
        const lleno = E[i].sec > t ? 1 : E[i].sec < t ? 0 : (pos + 1) / (deTramo.length + 1);
        tramos.push(`<span><i style="width:${Math.round(lleno * 100)}%"></i></span>`);
      }
      return `<div class="bv2-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${E.length}" aria-valuenow="${i + 1}">${tramos.join('')}</div>`;
    }

    const opcion = (valor, titulo, detalle, on, extra) => `<button type="button" class="bv2-op${on ? ' on' : ''}" data-op="${esc(valor)}" aria-pressed="${on ? 'true' : 'false'}">
        <span class="bv2-op-txt"><b>${esc(titulo)}</b>${detalle ? `<small>${esc(detalle)}</small>` : ''}${extra || ''}</span><span class="bv2-marca-op" aria-hidden="true"></span></button>`;
    const tipoOferta = () => (P().OFERTA[r.perfil.tipoOferta] ? r.perfil.tipoOferta : 'ambos');
    const textoOferta = () => P().OFERTA[tipoOferta()];

    // Cada pantalla: título, bajada, contenido y botón (sin botón: avanza al elegir).
    function pantalla() {
      const n = ctx.negocio();
      const id = actual();
      if (id === 'hola') {
        return {
          valor: true,
          titulo: `Hola, ${esc(n.nombre)} 👋<br>Tu Instagram, listo cada semana`,
          lead: 'Rubrofy escribe y diseña tus publicaciones, tú las apruebas y se publican solas. Y cada semana aprende de lo que te funciona.',
          cuerpo: `<div class="bv2-comparar">
              <div class="bv2-sin"><b>Sin Rubrofy <em>a mano</em></b>
                <div><span>Pensar qué publicar</span><span>cada semana desde cero</span></div>
                <div><span>Escribir y diseñar</span><span>horas que no tienes</span></div>
                <div><span>Publicar</span><span>cuando te acuerdas</span></div>
                <div><span>Saber qué funciona</span><span>adivinando</span></div></div>
              <div class="bv2-con"><b>Con Rubrofy <em>en piloto automático</em></b>
                <div><span>Tu semana</span><span>lista para aprobar</span></div>
                <div><span>Textos y diseños</span><span>con tu voz y tu marca</span></div>
                <div><span>Publica</span><span>sola, en tu mejor horario</span></div>
                <div><span>Cada semana</span><span>aprende y mejora</span></div></div>
            </div>`,
          boton: 'Empezar · unos 2 minutos',
        };
      }
      if (id === 'web') {
        return {
          titulo: '¿Tu negocio tiene sitio web?',
          lead: 'Rubrofy lo lee y completa por ti lo que vendes, a quién y qué te hace distinto. Tú solo revisas.',
          cuerpo: `<div class="bv2-fila-web"><input type="url" class="bv2-input" data-r="web" value="${esc(r.perfil.web)}" placeholder="tunegocio.cl" autocapitalize="off" inputmode="url">
              <button type="button" class="bv2-sec" data-bv="leer-web">Leer mi web</button></div>
            ${leido ? `<div class="bv2-leido">${leido.length ? leido.map((t) => `<div>${esc(t)}</div>`).join('') : '<p>Leímos tu web, pero no encontramos datos nuevos. Los completas en las siguientes preguntas.</p>'}</div>` : ''}`,
          boton: leido ? 'Está bien, continuar' : 'Continuar',
          alt: r.perfil.web ? '' : '<button type="button" class="bv2-link" data-bv="siguiente">No tengo web</button>',
        };
      }
      if (id === 'descripcion') {
        return {
          titulo: solo ? 'Cuéntanos de tu negocio: ¿qué es y qué hace?' : '¿Qué es tu negocio y qué hace?',
          lead: 'En tus palabras, como se lo contarías a un cliente nuevo. Toda la IA de Rubrofy parte de aquí.',
          cuerpo: `<textarea class="bv2-input" data-r="descripcion" rows="4" maxlength="800" placeholder="Ej: Panadería familiar de barrio en Ñuñoa. Hacemos pan de masa madre, pasteles y tortas por encargo desde 1998.">${esc(r.perfil.descripcion)}</textarea>`,
          boton: 'Continuar',
        };
      }
      if (id === 'oferta') {
        return {
          titulo: '¿Qué ofreces?',
          lead: 'Así Rubrofy sabe cómo hablar de lo tuyo.',
          cuerpo: `<div class="bv2-ops">${P().TIPOS_OFERTA.map(([v, l, ej]) => opcion(v, l, ej, r.perfil.tipoOferta === v)).join('')}</div>`,
        };
      }
      if (id === 'productos') {
        const t = textoOferta();
        return {
          titulo: esc(t.que),
          lead: `${esc(t.queAyuda)}. Rubrofy solo usa lo que escribas aquí: no inventa productos, precios ni promociones.`,
          cuerpo: `<textarea class="bv2-input" data-r="productos" rows="3" maxlength="800" placeholder="${esc(t.quePh)}">${esc(r.perfil.productos)}</textarea>
            <label class="bv2-etq">${esc(t.estrella)} <span>(opcional)</span><input class="bv2-input" data-r="productoDestacado" value="${esc(r.datos.productoDestacado)}" placeholder="${esc(t.estrellaPh)}" maxlength="120"></label>`,
          boton: 'Continuar',
        };
      }
      if (id === 'publico') {
        const t = textoOferta();
        return {
          titulo: esc(t.quien),
          lead: 'Tu cliente ideal. Rubrofy escribe pensando en esa persona.',
          cuerpo: `<textarea class="bv2-input" data-r="publico" rows="3" maxlength="300" placeholder="${esc(t.quienPh)}">${esc(r.plan.publico)}</textarea>`,
          boton: 'Continuar',
        };
      }
      if (id === 'diferenciador') {
        return {
          titulo: '¿Por qué te eligen a ti?',
          lead: 'Lo que te hace distinto. Es lo que Rubrofy va a destacar en tus publicaciones.',
          cuerpo: `<textarea class="bv2-input" data-r="diferenciador" rows="3" maxlength="300" placeholder="${esc(textoOferta().por)}">${esc(r.plan.diferenciador)}</textarea>`,
          boton: 'Continuar',
        };
      }
      if (id === 'canales') {
        const on = new Set(r.perfil.canales || []);
        return {
          titulo: '¿Cómo te compran?',
          lead: 'Elige todas las que correspondan. Así cada publicación termina con el llamado a la acción correcto.',
          cuerpo: `<div class="bv2-ops multi">${P().CANALES.map(([v, l]) => opcion(v, l, '', on.has(v))).join('')}</div>`,
          boton: 'Continuar',
        };
      }
      if (id === 'donde') {
        return {
          titulo: '¿Dónde te encuentran?',
          lead: 'Rubrofy usa estos datos en tus publicaciones: "escríbenos", "pasa al local", "visita la web".',
          cuerpo: `<label class="bv2-etq">Ciudad o zona<input class="bv2-input" data-r="ciudad" value="${esc(r.perfil.ciudad)}" placeholder="Ej: Ñuñoa, Santiago" maxlength="120"></label>
            <label class="bv2-etq">Instagram<input class="bv2-input" data-r="instagram" value="${esc(r.perfil.instagram ? '@' + r.perfil.instagram : '')}" placeholder="@tunegocio" autocapitalize="off"></label>
            <label class="bv2-etq">WhatsApp<input class="bv2-input" type="tel" data-r="whatsapp" value="${esc(r.perfil.whatsapp)}" placeholder="+56 9 1234 5678"></label>
            ${conIA ? '' : `<label class="bv2-etq">Sitio web <span>(opcional)</span><input class="bv2-input" type="url" data-r="web" value="${esc(r.perfil.web)}" placeholder="tunegocio.cl" autocapitalize="off"></label>`}`,
          boton: solo ? 'Guardar' : 'Continuar',
        };
      }
      if (id === 'aprobar') {
        const destacado = r.datos.productoDestacado || (r.perfil.productos || '').split(',')[0].trim() || n.nombre;
        return {
          valor: true,
          titulo: 'Tú apruebas. Rubrofy publica.',
          lead: 'Nada sale sin tu visto bueno. Revisas desde el celular, apruebas en un toque y se publica solo, en su fecha y hora.',
          cuerpo: `<div class="bv2-aprob" aria-hidden="true"><div class="bv2-foto"></div><div>
              <small>Ejemplo · Jueves 09:00 · Post</small><p>${esc(destacado)}: gancho, texto y hashtags escritos con tu voz.</p>
              <div class="bv2-bts"><span>Aprobar</span><span>Otra versión</span></div></div></div>`,
          boton: 'Continuar',
        };
      }
      if (id === 'objetivos') {
        const on = new Set(r.plan.objetivos || []);
        return {
          titulo: '¿Qué quieres lograr con Instagram?',
          lead: 'Elige uno o dos. Rubrofy arma tu estrategia para eso.',
          cuerpo: `<div class="bv2-ops multi" data-max="2">${cat.objetivos.map((o) => opcion(o.id, o.label, o.detalle, on.has(o.id))).join('')}</div>`,
          boton: 'Continuar',
        };
      }
      if (id === 'tono') {
        return {
          titulo: '¿Cómo quieres sonar?',
          lead: 'Así va a escribir Rubrofy. Lo puedes cambiar cuando quieras.',
          cuerpo: `<div class="bv2-ops">${cat.tonos.map((t) => opcion(t.id, t.label, t.detalle, r.plan.tono === t.id, EJEMPLO_TONO[t.id] ? `<i>${esc(EJEMPLO_TONO[t.id])}</i>` : '')).join('')}</div>`,
        };
      }
      if (id === 'ritmo') {
        const igual = (a, b) => a && b && Object.keys(b).every((f) => (a[f] || 0) === b[f]);
        return {
          titulo: '¿Cuánto quieres publicar por semana?',
          lead: 'Puedes cambiarlo cuando quieras en Estrategia.',
          cuerpo: `<div class="bv2-ops">${cat.ritmos.map((x) => opcion(x.id, `${x.label} · ${x.detalle}`, sinHtml(P().textoTotal(x.semanal)), igual(r.plan.semanal, x.semanal))).join('')}</div>`,
        };
      }
      if (id === 'aprende') {
        return {
          valor: true,
          titulo: 'Rubrofy aprende de tus resultados',
          lead: 'Cada semana mira qué publicaciones te traen más interacción y a qué hora te va mejor, y con eso escribe la siguiente. Mientras más lo usas, mejor te conoce.',
          cuerpo: `<div class="bv2-mini" aria-hidden="true"><div class="bv2-mini-cab"><span>Interacción por tema</span><em>aprendiendo</em></div>
              <div class="bv2-barras"><i style="height:42%"></i><i class="top" style="height:94%"></i><i style="height:58%"></i><i style="height:30%"></i></div>
              <div class="bv2-leyenda"><span>Promos</span><span>Detrás de escena</span><span>Clientes</span><span>Consejos</span></div></div>
            <p class="bv2-nota">Ejemplo ilustrativo.</p>
            <p class="bv2-estado" data-bv-est-estado>${estrategiaLista && estrategiaLista.lista ? '✓ Tu estrategia está lista.' : 'Mientras tanto, estamos armando tu estrategia…'}</p>`,
          boton: 'Ver mi estrategia',
        };
      }
      if (id === 'estrategia') {
        const est = ctx.estrategia() || {};
        return {
          titulo: 'Tu estrategia de contenido',
          lead: 'La armamos con lo que nos contaste. Estos temas se van turnando en tus publicaciones; los ajustas cuando quieras en Estrategia.',
          cuerpo: `${est.resumen ? `<p class="bv2-resumen">${esc(est.resumen)}</p>` : ''}
            <ol class="bv2-temas">${(est.enfoques || []).map((e) => `<li><b>${esc(e.label)}</b><span>${esc(e.pista)}</span></li>`).join('')}</ol>
            ${conIA ? '<button type="button" class="bv2-link" data-bv="proponer">Proponer otra con IA</button>' : ''}`,
          boton: 'Me gusta, continuar',
        };
      }
      if (id === 'conexiones') {
        const conectado = !!n.instagramConectado;
        return {
          titulo: 'Conecta tu Instagram',
          lead: 'Para publicar solo lo que apruebes, en su fecha y hora. Puedes hacerlo ahora o después desde Conexiones y ajustes.',
          cuerpo: `<div class="bv2-cuentas">
              <div class="bv2-cuenta"><i class="c-ig" aria-hidden="true"></i><div><b>Instagram${r.perfil.instagram ? ` @${esc(r.perfil.instagram)}` : ''}</b><span>Publica lo que apruebes.</span></div>
                ${conectado ? '<em class="bv2-ok">Conectado</em>' : n.instagramLoginDisponible ? '<button type="button" class="bv2-ig" data-bv="conectar-ig">Conectar</button>' : '<em>Después</em>'}</div>
              ${!conectado && n.instagramEnRevision ? '<p class="bv2-nota-ig">¿Instagram te muestra "Rol de desarrollador insuficiente"? Estamos terminando la aprobación de Rubrofy en Meta: sigue sin conectar y escríbenos tu usuario en <b>Ayuda y soporte</b>; te habilitamos el mismo día.</p>' : ''}
              <div class="bv2-cuenta"><i class="c-meta" aria-hidden="true"></i><div><b>Meta Ads</b><span>Tu publicidad en Facebook e Instagram. Plan Estudio.</span></div>
                ${n.metaAbierto === false ? '<em class="bv2-pronto">Próximamente</em>' : n.metaConexion ? '<em class="bv2-ok">Conectado</em>' : '<em>Opcional</em>'}</div>
            </div>
            <p class="bv2-final">${sinPlan ? 'Después: eliges tu plan (o tu prueba gratis) y creamos tu primera semana.'
              : `Tu primera semana: ${P().textoTotal(r.plan.semanal || {})}. Llegan a <b>Por aprobar</b>; nada se publica hasta que tú lo apruebes.`}</p>`,
          boton: sinPlan ? 'Continuar' : 'Crear mi primera semana',
        };
      }
      if (id === 'plan') {
        const fmt = (x) => '$' + Number(x).toLocaleString('es-CL');
        const DETALLE = {
          pro: ['Publicaciones completas: gancho, texto y hashtags', 'La IA escribe con tu voz y aprende de tus resultados', 'Resultados de Instagram e informe mensual'],
          estudio: ['Todo lo de Pro', 'Más fotos y videos con IA', n.metaAbierto === false ? 'Meta Ads y competencia (próximamente)' : 'Meta Ads y competencia'],
        };
        const nombre = (pid) => ((ctx.planes || []).find((x) => x.id === pid) || {}).nombre || pid;
        const prueba = catPrueba ? `<div class="bv2-prueba" data-bv-prueba>
            <h3>🎁 Prueba ${catPrueba.dias} días gratis el plan ${esc(nombre(catPrueba.plan))}</h3>
            <p>Sin tarjeta. Déjanos tu nombre, correo y teléfono, y creamos tu primera semana ahora mismo.</p>
            ${window.RubrofyPrueba.campos(catPrueba, { email: n.email, telefono: r.perfil.whatsapp })}
            <button type="button" class="bv2-btn" data-bv="activar-prueba">Activar mis ${catPrueba.dias} días y crear mi semana</button>
          </div><p class="bv2-o">o elige un plan</p>` : '';
        return {
          titulo: catPrueba ? 'Empieza gratis o elige tu plan' : 'Elige tu plan',
          lead: 'Tu estrategia está lista. Los planes se pagan en una página segura (Rubrofy no ve ni guarda tu tarjeta) y se cancelan cuando quieras.',
          cuerpo: `${prueba}<div class="bv2-planes">${(ctx.planes || []).map((p) => `
              <div class="bv2-plan${p.id === 'pro' ? ' destacado' : ''}">
                <div class="bv2-plan-cab"><b>${esc(p.nombre)}</b><span>${fmt(p.precioClp)}<small>/mes</small></span></div>
                <ul>${(DETALLE[p.id] || []).map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
                ${p.disponible ? `<button type="button" class="${p.id === 'pro' ? 'bv2-btn' : 'bv2-btn claro'}" data-bv="pagar" data-plan="${p.id}">Elegir ${esc(p.nombre)}</button>`
                  : '<button type="button" class="bv2-btn claro" disabled>Pagos habilitados pronto</button>'}
              </div>`).join('')}</div>
            <p class="bv2-nota">Al pagar vuelves a Rubrofy y tu primera semana se crea sola.</p>`,
          alt: '<button type="button" class="bv2-link" data-bv="despues">Elegir después</button>',
        };
      }
      return { titulo: '', cuerpo: '' };
    }

    function pintar(error, atras) {
      const s = pantalla();
      const id = actual();
      capa.innerHTML = `${CINTAS}
        <header class="bv2-top">
          <div class="bv2-barra">
            ${i > 0 ? '<button type="button" class="bv2-atras" data-bv="atras" aria-label="Atrás">‹</button>' : '<span class="bv2-atras"></span>'}
            <div class="bv2-logo"><img src="/app/icon-192.png" width="26" height="26" alt=""><b>Rubrofy</b></div>
            <button type="button" class="bv2-saltar" data-bv="saltar">${solo ? 'Ahora no' : 'Saltar'}</button>
          </div>
          ${progreso()}
        </header>
        <section class="bv2-card ${atras ? 'desde-atras' : 'desde-adelante'}${s.valor ? ' valor' : ''}" data-bv-cuerpo data-pantalla="${id}">
          <h2>${s.titulo}</h2>
          ${s.lead ? `<p class="bv2-lead">${s.lead}</p>` : ''}
          ${s.cuerpo}
          <p class="bv2-error" ${error ? '' : 'hidden'} role="alert">${esc(error || '')}</p>
          ${s.boton ? `<button type="button" class="bv2-btn" data-bv="siguiente">${esc(s.boton)} <span aria-hidden="true">→</span></button>` : ''}
          ${s.alt || ''}
        </section>`;
      const card = capa.querySelector('.bv2-card');
      card.scrollTop = 0;
      const primero = card.querySelector('textarea, input');
      if (primero && window.matchMedia('(min-width: 700px)').matches) primero.focus();
      if (id === 'aprende' && estrategiaLista) {
        estrategiaLista.promesa.then(() => {
          const el = capa.querySelector('[data-bv-est-estado]');
          if (el) el.textContent = '✓ Tu estrategia está lista.';
        });
      }
    }

    const usuarioIg = (v) => String(v).trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@+/, '').replace(/[/?#].*$/, '');

    // Lo escrito en la pantalla actual pasa a las respuestas.
    function leerPantalla() {
      const val = (k) => { const el = capa.querySelector(`[data-r="${k}"]`); return el ? el.value : undefined; };
      ['descripcion', 'productos', 'ciudad', 'instagram', 'whatsapp', 'web'].forEach((k) => { const v = val(k); if (v !== undefined) r.perfil[k] = v.trim(); });
      // Igual que el servidor (perfil.js): sin @ ni URL, para no mostrar "@@cuenta".
      if (r.perfil.instagram) r.perfil.instagram = usuarioIg(r.perfil.instagram);
      ['publico', 'diferenciador'].forEach((k) => { const v = val(k); if (v !== undefined) r.plan[k] = v.trim(); });
      const d = val('productoDestacado');
      if (d !== undefined) r.datos.productoDestacado = d.trim();
      const multi = capa.querySelector('.bv2-ops.multi');
      if (multi) {
        const on = [...multi.querySelectorAll('.bv2-op.on')].map((b) => b.dataset.op);
        if (actual() === 'canales') r.perfil.canales = on;
        if (actual() === 'objetivos') r.plan.objetivos = on;
      }
    }

    async function guardarNegocio() {
      const perfil = {
        descripcion: r.perfil.descripcion, productos: r.perfil.productos, tipoOferta: r.perfil.tipoOferta || '', canales: r.perfil.canales || [],
        ciudad: r.perfil.ciudad, instagram: r.perfil.instagram, whatsapp: r.perfil.whatsapp, web: r.perfil.web,
      };
      ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/perfil`, { method: 'PUT', body: JSON.stringify(perfil) }));
      await ctx.guardarDatos(r.datos);
      if (solo && r.plan.objetivos && r.plan.objetivos.length) {
        ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/plan-contenido`, { method: 'PUT', body: JSON.stringify(r.plan) }));
      }
    }

    // Guarda el plan de contenido y pide la estrategia a la IA en segundo plano
    // (mientras el negocio lee "Rubrofy aprende de tus resultados").
    async function crearEstrategia() {
      if (!r.plan.semanal) r.plan.semanal = cat.ritmos[1].semanal;
      if (!r.plan.hora) r.plan.hora = '09:00';
      ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/plan-contenido`, { method: 'PUT', body: JSON.stringify(r.plan) }));
      const e = { lista: false };
      e.promesa = ctx.api(`/api/negocios/${ctx.negocio().id}/estrategia/generar`, { method: 'POST' })
        .then((est) => { ctx.setEstrategia(est); })
        .catch(() => { /* sin IA disponible se sigue con la estrategia que ya tenía */ })
        .then(() => { e.lista = true; });
      estrategiaLista = e;
    }

    // Valida y guarda lo de la pantalla antes de avanzar.
    async function alSalir() {
      const id = actual();
      if (id === 'descripcion' && (!r.perfil.descripcion || r.perfil.descripcion.length < 10)) throw new Error('Cuéntanos en una o dos frases qué es tu negocio.');
      if (id === 'donde') await guardarNegocio();
      if (id === 'objetivos' && !(r.plan.objetivos && r.plan.objetivos.length)) throw new Error('Elige al menos un objetivo.');
      if (id === 'ritmo') await crearEstrategia();
      if (id === 'aprende' && estrategiaLista) await estrategiaLista.promesa;
      if (id === 'conexiones') {
        ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/bienvenida`, { method: 'POST', body: JSON.stringify({ reemplazar: true }) }));
      }
    }

    // "Creando tu primera semana…": pasos animados mientras se genera.
    async function crearPrimeraSemana() {
      capa.querySelector('.bv2-card').outerHTML = `<section class="bv2-card desde-adelante" data-pantalla="creando">
          <h2>Creando tu primera semana…</h2><p class="bv2-lead">Con todo lo que nos contaste.</p>
          <ol class="bv2-pasos">
            <li class="ok">Leímos tu negocio</li><li class="ok">Elegimos tus temas y tu tono</li>
            <li class="ahora" data-c="1">Escribiendo tus publicaciones</li><li data-c="2">Programándolas en tu horario</li>
          </ol></section>`;
      capa.querySelector('.bv2-top .bv2-atras').style.visibility = 'hidden';
      const t = setTimeout(() => {
        const a = capa.querySelector('[data-c="1"]'); const b = capa.querySelector('[data-c="2"]');
        if (a && b) { a.className = 'ok'; b.className = 'ahora'; }
      }, 9000);
      try {
        await ctx.generarSemana();
      } catch (err) { /* se genera después con el botón "Generar semana" */ }
      clearTimeout(t);
      capa.querySelectorAll('.bv2-pasos li').forEach((li) => { li.className = 'ok'; });
      await new Promise((ok) => setTimeout(ok, 700));
      cerrar();
      ctx.alTerminar(true);
    }

    async function avanzar(btn) {
      leerPantalla();
      const texto = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = actual() === 'aprende' ? 'Armando tu estrategia…' : 'Guardando…'; }
      try {
        await alSalir();
      } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = texto; }
        return pintar(err.mensaje || err.message || 'No se pudo guardar.');
      }
      const id = actual();
      if (solo && id === 'donde') { cerrar(); return ctx.alTerminar(false); }
      if (id === 'conexiones' && !sinPlan) return crearPrimeraSemana();
      if (i === E.length - 1) { cerrar(); return ctx.alTerminar(false); }
      i += 1;
      pintar();
    }

    capa.addEventListener('click', async (e) => {
      const op = e.target.closest('.bv2-op');
      if (op) {
        const grupo = op.closest('.bv2-ops');
        if (grupo.classList.contains('multi')) {
          const max = Number(grupo.dataset.max || 99);
          if (!op.classList.contains('on') && grupo.querySelectorAll('.bv2-op.on').length >= max) grupo.querySelector('.bv2-op.on').classList.remove('on');
          op.classList.toggle('on');
          grupo.querySelectorAll('.bv2-op').forEach((b) => b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false'));
          return;
        }
        // Una sola respuesta: se marca y avanza sola.
        grupo.querySelectorAll('.bv2-op').forEach((b) => { b.classList.toggle('on', b === op); b.setAttribute('aria-pressed', b === op ? 'true' : 'false'); });
        const id = actual();
        if (id === 'oferta') r.perfil.tipoOferta = op.dataset.op;
        if (id === 'tono') r.plan.tono = op.dataset.op;
        if (id === 'ritmo') r.plan.semanal = Object.assign({}, (cat.ritmos.find((x) => x.id === op.dataset.op) || cat.ritmos[1]).semanal);
        grupo.classList.add('elegido');
        await new Promise((ok) => setTimeout(ok, 280));
        return avanzar(null);
      }
      const b = e.target.closest('[data-bv]');
      if (!b) return;
      const accion = b.dataset.bv;
      if (accion === 'atras') { leerPantalla(); i = Math.max(0, i - 1); return pintar(null, true); }
      if (accion === 'siguiente') return avanzar(b);
      if (accion === 'despues') { cerrar(); return ctx.alTerminar(false); }
      if (accion === 'saltar') {
        if (solo) { cerrar(); return ctx.alTerminar(false); }
        if (!confirm('¿Saltar la bienvenida? Usaremos un plan recomendado y podrás cambiarlo en Estrategia.')) return;
        try {
          ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/bienvenida`, { method: 'POST', body: JSON.stringify({ reemplazar: false }) }));
        } catch (err) { /* igual se cierra */ }
        cerrar();
        return ctx.alTerminar(false);
      }
      if (accion === 'leer-web') {
        const web = (capa.querySelector('[data-r="web"]').value || '').trim();
        if (!web) return pintar('Escribe primero la dirección de tu sitio web.');
        r.perfil.web = web;
        b.disabled = true;
        b.textContent = 'Leyendo…';
        try {
          const res = await ctx.api(`/api/negocios/${ctx.negocio().id}/perfil/leer-web`, { method: 'POST', body: JSON.stringify({ url: web }) });
          const pr = res.propuesta || {};
          // Completa solo lo que esté vacío; el negocio lo revisa en las preguntas siguientes.
          const llenar = (obj, k, v) => { if (v && !(obj[k] || '').trim()) { obj[k] = v; return true; } return false; };
          leido = [];
          if (llenar(r.perfil, 'descripcion', pr.descripcion)) leido.push(pr.descripcion);
          if (llenar(r.perfil, 'productos', pr.productos)) leido.push(pr.productos);
          if (llenar(r.plan, 'publico', pr.publico)) leido.push(pr.publico);
          if (llenar(r.plan, 'diferenciador', pr.diferenciador)) leido.push(pr.diferenciador);
          if (llenar(r.perfil, 'ciudad', pr.ciudad)) leido.push(pr.ciudad);
          llenar(r.perfil, 'instagram', pr.instagram && usuarioIg(pr.instagram));
          llenar(r.perfil, 'whatsapp', pr.whatsapp);
          return pintar();
        } catch (err) {
          return pintar(err.mensaje || 'No pudimos leer tu web. Sigue y completa los datos a mano.');
        }
      }
      if (accion === 'proponer') {
        b.disabled = true;
        b.textContent = 'Pensando…';
        try {
          ctx.setEstrategia(await ctx.api(`/api/negocios/${ctx.negocio().id}/estrategia/generar`, { method: 'POST' }));
          return pintar();
        } catch (err) {
          return pintar(err.mensaje || 'No se pudo proponer otra estrategia.');
        }
      }
      if (accion === 'conectar-ig') {
        // Termina la bienvenida (y crea la primera semana si ya tiene plan) antes de ir a Instagram.
        b.disabled = true;
        b.textContent = 'Un momento…';
        try {
          await alSalir();
          if (!sinPlan) await ctx.generarSemana().catch(() => {});
        } catch (err) {
          return pintar(err.mensaje || err.message || 'No se pudo guardar.');
        }
        window.location.href = `/api/negocios/${ctx.negocio().id}/instagram/conectar`;
        return;
      }
      if (accion === 'activar-prueba') {
        const caja = capa.querySelector('[data-bv-prueba]');
        window.RubrofyPrueba.limpiarErrores(caja);
        const texto = b.textContent;
        b.disabled = true;
        b.textContent = 'Activando…';
        try {
          ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/prueba`, { method: 'POST', body: JSON.stringify(window.RubrofyPrueba.leer(caja)) }));
        } catch (err) {
          b.disabled = false;
          b.textContent = texto;
          if (!window.RubrofyPrueba.marcarError(caja, err.campo, err.mensaje || 'No se pudo activar la prueba.')) {
            const el = capa.querySelector('.bv2-error');
            el.textContent = err.mensaje || 'No se pudo activar la prueba.';
            el.hidden = false;
          }
          return;
        }
        return crearPrimeraSemana();
      }
      if (accion === 'pagar') {
        b.disabled = true;
        b.textContent = 'Abriendo el pago…';
        try {
          const res = await ctx.api(`/api/negocios/${ctx.negocio().id}/checkout`, { method: 'POST', body: JSON.stringify({ plan: b.dataset.plan }) });
          if (res.url) { window.location.href = res.url; return; }
          if (res.negocio) ctx.setNegocio(res.negocio);
          cerrar();
          return ctx.alTerminar(false);
        } catch (err) {
          return pintar(err.mensaje || 'No se pudo abrir el pago. Intenta de nuevo.');
        }
      }
    });

    // Enter en un campo de una línea = Continuar.
    capa.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.target.tagName !== 'INPUT' || e.target.closest('[data-bv-prueba]')) return;
      e.preventDefault();
      if (e.target.dataset.r === 'web' && conIA && !leido) { const l = capa.querySelector('[data-bv="leer-web"]'); if (l) return l.click(); }
      const b = capa.querySelector('[data-bv="siguiente"]');
      if (b) b.click();
    });

    pintar();
  }

  window.RubrofyBienvenida = { abrir };
})();
