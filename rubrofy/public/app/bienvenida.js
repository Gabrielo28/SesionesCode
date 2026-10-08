// Bienvenida: la primera vez que un negocio entra al panel, Rubrofy lo
// conoce antes de crear nada: qué es, dónde está, cómo vende, sus redes y
// su web (y puede leer su web con IA), qué vende y a quién. Después su
// objetivo, cuánto publicar, su estrategia (que puede ajustar), dónde
// conectar sus cuentas, y genera su primera semana.
//
// Cuentas que ya habían pasado la bienvenida antes de que existiera el
// perfil ven solo los dos primeros pasos (modo "perfil").
(function () {
  'use strict';
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');
  const P = () => window.RubrofyPlan;

  const TODOS = [
    { id: 'negocio', t: 'Tu negocio' },
    { id: 'venta', t: 'Lo que ofreces' },
    { id: 'objetivo', t: 'Objetivo' },
    { id: 'ritmo', t: 'Cuánto publicar' },
    { id: 'estrategia', t: 'Tu estrategia' },
    { id: 'conexiones', t: 'Conexiones' },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // opciones.soloPerfil: completar solo "Tu negocio" y "Lo que vendes".
  async function abrir(ctx, opciones = {}) {
    const cat = await P().catalogo(ctx.api);
    // Rubrofy es solo de pago: sin plan, el último paso es elegirlo y pagar.
    // La primera semana se crea al volver de Stripe (ver app.js).
    const sinPlan = !!ctx.negocio().sinPlan;
    const pr0 = ctx.negocio().prueba || {};
    const catPrueba = sinPlan && pr0.disponible && window.RubrofyPrueba ? await window.RubrofyPrueba.cargar().catch(() => null) : null;
    const PASOS = opciones.soloPerfil ? TODOS.slice(0, 2)
      : sinPlan ? TODOS.concat({ id: 'plan', t: 'Tu plan' }) : TODOS;
    let paso = 0;
    let plan = Object.assign({}, ctx.negocio().planContenido || {});
    let datos = Object.assign({}, ctx.negocio().datos || {});
    let perfil = Object.assign({}, ctx.negocio().perfil || {});
    let sugerido = null; // lo que la IA leyó de su web, para el paso "Lo que vendes"

    const capa = document.createElement('div');
    capa.className = 'bv-capa';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-label', 'Bienvenida a Rubrofy');
    document.body.appendChild(capa);
    const cerrar = () => capa.remove();
    const actual = () => PASOS[paso].id;

    function progreso() {
      return `<ol class="bv-pasos">${PASOS.map((p, i) => `<li class="${i < paso ? 'hecho' : i === paso ? 'actual' : ''}"><span>${i < paso ? '✓' : i + 1}</span>${esc(p.t)}</li>`).join('')}</ol>`;
    }

    function cuerpoPaso() {
      const n = Object.assign({}, ctx.negocio(), { datos, planContenido: plan, perfil });
      const id = actual();
      if (id === 'negocio') {
        return `<h2>${opciones.soloPerfil ? 'Cuéntanos de tu negocio' : `Hola, ${esc(n.nombre)} 👋`}${AY('bv-negocio')}</h2>
          <p class="bv-lead">${opciones.soloPerfil
            ? 'Rubrofy escribe mejor cuando conoce tu negocio. Completa esto una vez y toda la IA lo usa: estrategia, publicaciones, voz y anuncios.'
            : 'Antes de crear tu contenido, queremos conocer tu negocio. Con esto Rubrofy arma tu estrategia y escribe como tú. Toma unos 3 minutos.'}</p>
          ${P().camposPerfil(n, { leerWeb: n.usaIA && n.iaConfigurada })}`;
      }
      if (id === 'venta') {
        return `<h2>Lo que ofreces${AY('bv-venta')}</h2>
          <p class="bv-lead">Tus productos o servicios y a quién se los ofreces. La IA solo usa los datos que escribas aquí: no inventa precios ni promociones.</p>
          ${P().camposVenta(n, sugerido)}`;
      }
      if (id === 'objetivo') return `<h2>Tu objetivo${AY('bv-objetivo')}</h2>` + P().camposObjetivo(plan, cat);
      if (id === 'ritmo') {
        return `<h2>Cuánto publicar${AY('bv-ritmo')}</h2>${P().camposRitmo(plan, cat)}
          <p class="bv-nota">Puedes cambiarlo cuando quieras desde <b>Estrategia</b>. Cada vez que pulses <b>Generar semana</b>, Rubrofy crea esta mezcla y la reparte en la semana.</p>`;
      }
      if (id === 'estrategia') {
        return `<h2>Tu estrategia de contenido${AY('bv-estrategia')}</h2>
          <p class="bv-lead">La armamos con lo que nos contaste. Ajusta lo que quieras: el resumen, el tono y los temas que se van turnando.</p>
          <div data-bv-est>${P().estrategiaEditable(ctx.estrategia())}</div>
          <button type="button" class="btn-ghost bv-proponer" data-bv="proponer">Proponer otra con IA</button>`;
      }
      if (id === 'plan') {
        const fmt = (n) => '$' + Number(n).toLocaleString('es-CL');
        const DETALLE = {
          pro: ['Estrategia y publicaciones completas: gancho, texto y hashtags', 'La IA escribe con tu voz y aprende de tus correcciones', 'Resultados de Instagram e informe mensual'],
          estudio: ['Todo lo de Pro', 'Fotos y videos generados con IA', ctx.negocio().googleActivo ? 'Meta Ads, Google Ads y competencia' : 'Meta Ads y competencia'],
        };
        const nombre = (id) => ((ctx.planes || []).find((x) => x.id === id) || {}).nombre || id;
        const prueba = catPrueba ? `<div class="bv-prueba" data-bv-prueba>
            <h3>🎁 Prueba ${catPrueba.dias} días gratis el plan ${esc(nombre(catPrueba.plan))}</h3>
            <p>Sin tarjeta. Déjanos tu nombre, correo y teléfono, y creamos tu primera semana ahora mismo.</p>
            ${window.RubrofyPrueba.campos(catPrueba, { email: ctx.negocio().email, telefono: perfil.whatsapp })}
            <button type="button" class="btn-approve" data-bv="activar-prueba">Activar mis ${catPrueba.dias} días y crear mi semana</button>
          </div><p class="bv-o">o elige un plan pagado</p>` : '';
        return `<h2>${catPrueba ? 'Empieza gratis o elige tu plan' : 'Elige tu plan'}${AY('precios-comparar')}</h2>
          <p class="bv-lead">Tu estrategia está lista. ${catPrueba ? 'Activa tu prueba gratis o elige un plan' : 'Elige tu plan'} para crear tu primera semana. Los planes se pagan con tarjeta en una página segura de pago (Rubrofy no ve ni guarda tu tarjeta) y se cancelan cuando quieras.</p>
          ${prueba}
          <div class="bv-planes">${(ctx.planes || []).map((p) => `
            <div class="bv-plan${p.id === 'pro' ? ' destacado' : ''}">
              <div class="bv-plan-cab"><b>${esc(p.nombre)}</b><span>${fmt(p.precioClp)}<small>/mes</small></span></div>
              <ul>${(DETALLE[p.id] || []).map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
              ${p.disponible
                ? `<button type="button" class="${p.id === 'pro' ? 'btn-approve' : 'btn-ghost'}" data-bv="pagar" data-plan="${p.id}">Elegir ${esc(p.nombre)}</button>`
                : '<button type="button" class="btn-ghost" disabled>Pagos habilitados pronto</button>'}
            </div>`).join('')}</div>
          <p class="bv-nota">Al pagar vuelves a Rubrofy y tu primera semana se crea sola. Lo que armaste queda guardado.</p>`;
      }
      const neg = ctx.negocio();
      const estado = (ok, txtOk, txtNo) => `<span class="bv-estado ${ok ? 'ok' : ''}">${ok ? txtOk : txtNo}</span>`;
      return `<h2>Conecta tus cuentas${AY('bv-conexiones')}</h2>
        <p class="bv-lead">Puedes hacerlo ahora o después. Todas se conectan desde <b>Conexiones y ajustes</b>, abajo en el menú.</p>
        <div class="bv-conexiones">
          <div class="bv-con"><i class="c-ig"></i><div><b>Instagram${perfil.instagram ? ` @${esc(perfil.instagram)}` : ''}</b><span>Para publicar solo lo que apruebes, en su fecha y hora.</span></div>${!neg.instagramConectado && neg.instagramLoginDisponible
            ? '<button type="button" class="btn-ig bv-ig" data-bv="conectar-ig">Conectar ahora</button>'
            : estado(neg.instagramConectado, 'Conectado', 'Sin conectar')}</div>
          <div class="bv-con"><i class="c-meta"></i><div><b>Meta Ads</b><span>Tu inversión y resultados en Facebook e Instagram. Plan Estudio.</span></div>${estado(!!neg.metaConexion, 'Conectado', 'Opcional')}</div>
          ${neg.googleActivo ? `<div class="bv-con"><i class="c-g"></i><div><b>Google Ads</b><span>Tus campañas de Google junto a tu Instagram. Plan Estudio.</span></div>${estado(!!neg.googleConexion, 'Conectado', 'Opcional')}</div>` : ''}
        </div>
        <div class="bv-final">
          <b>${sinPlan ? 'Después: elige tu plan y creamos tu primera semana' : 'Último paso: tu primera semana'}</b>
          <p>${P().textoTotal(plan.semanal || {})}. Llegan a <b>Por aprobar</b>; nada se publica hasta que tú lo apruebes.</p>
        </div>`;
    }

    function textoBoton() {
      const id = actual();
      if (paso === PASOS.length - 1) return opciones.soloPerfil ? 'Guardar' : 'Generar mi primera semana';
      return id === 'ritmo' ? 'Crear mi estrategia' : 'Continuar';
    }

    function pintar(error) {
      capa.innerHTML = `
        <div class="bv-caja">
          <header class="bv-top">
            <img src="/app/icon-192.png" width="30" height="30" alt="">
            ${progreso()}
            <button type="button" class="bv-saltar" data-bv="saltar">${opciones.soloPerfil ? 'Ahora no' : 'Saltar por ahora'}</button>
          </header>
          <div class="bv-cuerpo" data-bv-cuerpo>${cuerpoPaso()}</div>
          <p class="config-error bv-error" ${error ? '' : 'hidden'}>${esc(error || '')}</p>
          <footer class="bv-pie">
            ${paso > 0 ? '<button type="button" class="btn-ghost" data-bv="atras">Atrás</button>' : '<span></span>'}
            ${actual() === 'plan' ? '<button type="button" class="btn-ghost" data-bv="despues">Elegir después</button>' : `<button type="button" class="btn-approve" data-bv="siguiente">${textoBoton()}</button>`}
          </footer>
        </div>`;
      const cuerpo = capa.querySelector('[data-bv-cuerpo]');
      delete cuerpo.dataset.pcActivo;
      P().activar(cuerpo, cat.maxPorFormato);
      if (actual() === 'negocio') P().activarPerfil(cuerpo, ctx, (propuesta) => { sugerido = propuesta; });
      if (actual() === 'estrategia') P().activarEstrategia(cuerpo);
      const primero = cuerpo.querySelector('textarea, input');
      if (primero && paso === 0 && window.matchMedia('(min-width: 700px)').matches) primero.focus();
    }

    function ocupado(btn, texto) {
      btn.disabled = true;
      btn.textContent = texto;
    }

    async function guardarPerfil(cuerpo) {
      const leido = P().leerPerfil(cuerpo);
      ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/perfil`, { method: 'PUT', body: JSON.stringify(leido) }));
      perfil = Object.assign({}, ctx.negocio().perfil || {});
    }

    // Guarda lo del paso actual antes de avanzar.
    async function guardarPaso(btn) {
      const cuerpo = capa.querySelector('[data-bv-cuerpo]');
      const id = actual();
      if (id === 'negocio') {
        const leido = P().leerPerfil(cuerpo);
        if (!leido.descripcion || leido.descripcion.trim().length < 10) throw new Error('Cuéntanos en una o dos frases qué es tu negocio.');
        await guardarPerfil(cuerpo);
      } else if (id === 'venta') {
        await guardarPerfil(cuerpo);
        datos = P().leerDatos(cuerpo, { datos });
        plan = P().leerPlan(cuerpo, plan);
        await ctx.guardarDatos(datos);
        if (opciones.soloPerfil && plan.objetivos && plan.objetivos.length) {
          ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/plan-contenido`, { method: 'PUT', body: JSON.stringify(plan) }));
        }
      } else if (id === 'objetivo') {
        plan = P().leerPlan(cuerpo, plan);
        if (!plan.objetivos || !plan.objetivos.length) throw new Error('Elige al menos un objetivo.');
      } else if (id === 'ritmo') {
        plan = P().leerPlan(cuerpo, plan);
        ocupado(btn, 'Creando tu estrategia…');
        ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/plan-contenido`, { method: 'PUT', body: JSON.stringify(plan) }));
        try {
          ctx.setEstrategia(await ctx.api(`/api/negocios/${ctx.negocio().id}/estrategia/generar`, { method: 'POST' }));
        } catch (err) {
          // Sin IA disponible se sigue con la estrategia que ya tenía.
        }
      } else if (id === 'estrategia') {
        ctx.setEstrategia(await ctx.api(`/api/negocios/${ctx.negocio().id}/estrategia`, { method: 'PUT', body: JSON.stringify(P().leerEstrategia(cuerpo)) }));
      } else if (id === 'conexiones' && sinPlan) {
        // Sin plan todavía: la bienvenida queda hecha y sigue "Elige tu plan".
        ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/bienvenida`, { method: 'POST', body: JSON.stringify({ reemplazar: true }) }));
      } else if (id === 'conexiones') {
        ocupado(btn, 'Creando tu primera semana…');
        ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/bienvenida`, { method: 'POST', body: JSON.stringify({ reemplazar: true }) }));
        await ctx.generarSemana();
      }
    }

    capa.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-bv]');
      if (!b) return;
      const accion = b.dataset.bv;
      if (accion === 'atras') { paso -= 1; return pintar(); }
      if (accion === 'despues') { cerrar(); return ctx.alTerminar(false); }
      if (accion === 'saltar') {
        if (opciones.soloPerfil) {
          cerrar();
          return ctx.alTerminar(false);
        }
        if (!confirm('¿Saltar la bienvenida? Usaremos un plan recomendado y podrás cambiarlo en Estrategia.')) return;
        try {
          ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/bienvenida`, { method: 'POST', body: JSON.stringify({ reemplazar: false }) }));
        } catch (err) { /* igual se cierra */ }
        cerrar();
        return ctx.alTerminar(false);
      }
      if (accion === 'activar-prueba') {
        const caja = capa.querySelector('[data-bv-prueba]');
        window.RubrofyPrueba.limpiarErrores(caja);
        ocupado(b, 'Activando…');
        try {
          ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/prueba`, { method: 'POST', body: JSON.stringify(window.RubrofyPrueba.leer(caja)) }));
        } catch (err) {
          b.disabled = false;
          b.textContent = `Activar mis ${catPrueba.dias} días y crear mi semana`;
          if (!window.RubrofyPrueba.marcarError(caja, err.campo, err.mensaje || 'No se pudo activar la prueba.')) {
            const e = capa.querySelector('.bv-error');
            e.textContent = err.mensaje || 'No se pudo activar la prueba.';
            e.hidden = false;
          }
          return;
        }
        ocupado(b, 'Creando tu primera semana…');
        try {
          await ctx.generarSemana();
        } catch (err) { /* se genera después con el botón */ }
        cerrar();
        return ctx.alTerminar(true);
      }
      if (accion === 'pagar') {
        ocupado(b, 'Abriendo el pago…');
        try {
          const r = await ctx.api(`/api/negocios/${ctx.negocio().id}/checkout`, { method: 'POST', body: JSON.stringify({ plan: b.dataset.plan }) });
          if (r.url) { window.location.href = r.url; return; }
          if (r.negocio) ctx.setNegocio(r.negocio);
          cerrar();
          return ctx.alTerminar(false);
        } catch (err) {
          return pintar(err.mensaje || 'No se pudo abrir el pago. Intenta de nuevo.');
        }
      }
      if (accion === 'conectar-ig') {
        // Termina la bienvenida (y crea la primera semana) antes de ir a Instagram.
        try {
          await guardarPaso(b);
        } catch (err) {
          return pintar(err.mensaje || err.message || 'No se pudo guardar.');
        }
        window.location.href = `/api/negocios/${ctx.negocio().id}/instagram/conectar`;
        return;
      }
      if (accion === 'proponer') {
        ocupado(b, 'Pensando…');
        try {
          const est = await ctx.api(`/api/negocios/${ctx.negocio().id}/estrategia/generar`, { method: 'POST' });
          ctx.setEstrategia(est);
          capa.querySelector('[data-bv-est]').innerHTML = P().estrategiaEditable(est);
        } catch (err) {
          alert(err.mensaje || 'No se pudo proponer otra estrategia.');
        }
        b.disabled = false;
        b.textContent = 'Proponer otra con IA';
        return;
      }
      if (accion === 'siguiente') {
        const texto = b.textContent;
        try {
          await guardarPaso(b);
        } catch (err) {
          b.disabled = false;
          b.textContent = texto;
          return pintar(err.mensaje || err.message || 'No se pudo guardar.');
        }
        if (paso === PASOS.length - 1) {
          cerrar();
          return ctx.alTerminar(!opciones.soloPerfil);
        }
        paso += 1;
        pintar();
        capa.querySelector('.bv-caja').scrollTop = 0;
      }
    });

    pintar();
  }

  window.RubrofyBienvenida = { abrir };
})();
