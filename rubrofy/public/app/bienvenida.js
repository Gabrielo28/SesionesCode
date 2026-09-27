// Bienvenida: la primera vez que un negocio entra al panel le pregunta lo
// necesario para armar su estrategia (datos, objetivo, tono y cuánto
// publicar), le muestra la estrategia para que la ajuste, le explica dónde
// conectar sus cuentas y genera su primera semana de contenido.
(function () {
  'use strict';
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');

  const P = () => window.RubrofyPlan;
  const PASOS = ['Tu negocio', 'Objetivo', 'Cuánto publicar', 'Tu estrategia', 'Conexiones'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function abrir(ctx) {
    const cat = await P().catalogo(ctx.api);
    let paso = 0;
    let plan = Object.assign({}, ctx.negocio().planContenido || {});
    let datos = Object.assign({}, ctx.negocio().datos || {});

    const capa = document.createElement('div');
    capa.className = 'bv-capa';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-label', 'Bienvenida a Rubrofy');
    document.body.appendChild(capa);

    const cerrar = () => capa.remove();

    function progreso() {
      return `<ol class="bv-pasos">${PASOS.map((p, i) => `<li class="${i < paso ? 'hecho' : i === paso ? 'actual' : ''}"><span>${i < paso ? '✓' : i + 1}</span>${esc(p)}</li>`).join('')}</ol>`;
    }

    function cuerpoPaso() {
      const n = Object.assign({}, ctx.negocio(), { datos, planContenido: plan });
      if (paso === 0) {
        return `<h2>Hola, ${esc(n.nombre)} 👋${AY('bv-negocio')}</h2>
          <p class="bv-lead">Antes de crear tu contenido, cuéntanos un poco de tu negocio. Con esto Rubrofy arma tu estrategia y escribe con tus datos reales. Toma unos 3 minutos.</p>
          ${P().camposNegocio(n)}`;
      }
      if (paso === 1) return `<h2>Tu objetivo${AY('bv-objetivo')}</h2>` + P().camposObjetivo(plan, cat);
      if (paso === 2) {
        return `<h2>Cuánto publicar${AY('bv-ritmo')}</h2>${P().camposRitmo(plan, cat)}
          <p class="bv-nota">Puedes cambiarlo cuando quieras desde <b>Estrategia</b>. Cada vez que pulses <b>Generar semana</b>, Rubrofy crea esta mezcla y la reparte en la semana.</p>`;
      }
      if (paso === 3) {
        return `<h2>Tu estrategia de contenido${AY('bv-estrategia')}</h2>
          <p class="bv-lead">La armamos con lo que nos contaste. Ajusta lo que quieras: el resumen, el tono y los temas que se van turnando.</p>
          <div data-bv-est>${P().estrategiaEditable(ctx.estrategia())}</div>
          <button type="button" class="btn-ghost bv-proponer" data-bv="proponer">Proponer otra con IA</button>`;
      }
      const neg = ctx.negocio();
      const estado = (ok, txtOk, txtNo) => `<span class="bv-estado ${ok ? 'ok' : ''}">${ok ? txtOk : txtNo}</span>`;
      return `<h2>Conecta tus cuentas${AY('bv-conexiones')}</h2>
        <p class="bv-lead">Puedes hacerlo ahora o después. Todas se conectan desde <b>Conexiones</b>, abajo a la izquierda del menú.</p>
        <div class="bv-conexiones">
          <div class="bv-con"><i class="c-ig"></i><div><b>Instagram</b><span>Para publicar solo lo que apruebes, en su fecha y hora.</span></div>${!neg.instagramConectado && neg.instagramLoginDisponible
            ? '<button type="button" class="btn-ig bv-ig" data-bv="conectar-ig">Conectar ahora</button>'
            : estado(neg.instagramConectado, 'Conectado', 'Sin conectar')}</div>
          <div class="bv-con"><i class="c-meta"></i><div><b>Meta Ads</b><span>Tu inversión y resultados en Facebook e Instagram. Plan Estudio.</span></div>${estado(!!neg.metaConexion, 'Conectado', 'Opcional')}</div>
          <div class="bv-con"><i class="c-g"></i><div><b>Google Ads</b><span>Tus campañas de Google junto a tu Instagram. Plan Estudio.</span></div>${estado(!!neg.googleConexion, 'Conectado', 'Opcional')}</div>
        </div>
        <div class="bv-final">
          <b>Último paso: tu primera semana</b>
          <p>${P().textoTotal(plan.semanal || {})}. Llegan a <b>Por aprobar</b>; nada se publica hasta que tú lo apruebes.</p>
        </div>`;
    }

    function pintar(error) {
      const ultimo = paso === PASOS.length - 1;
      capa.innerHTML = `
        <div class="bv-caja">
          <header class="bv-top">
            <img src="/app/icon-192.png" width="30" height="30" alt="">
            ${progreso()}
            <button type="button" class="bv-saltar" data-bv="saltar">Saltar por ahora</button>
          </header>
          <div class="bv-cuerpo" data-bv-cuerpo>${cuerpoPaso()}</div>
          <p class="config-error bv-error" ${error ? '' : 'hidden'}>${esc(error || '')}</p>
          <footer class="bv-pie">
            ${paso > 0 ? '<button type="button" class="btn-ghost" data-bv="atras">Atrás</button>' : '<span></span>'}
            <button type="button" class="btn-approve" data-bv="siguiente">${ultimo ? 'Generar mi primera semana' : paso === 2 ? 'Crear mi estrategia' : 'Continuar'}</button>
          </footer>
        </div>`;
      const cuerpo = capa.querySelector('[data-bv-cuerpo]');
      delete cuerpo.dataset.pcActivo;
      P().activar(cuerpo, cat.maxPorFormato);
      if (paso === 3) P().activarEstrategia(cuerpo);
      const primero = cuerpo.querySelector('input, textarea');
      if (primero && paso === 0) primero.focus();
    }

    function ocupado(btn, texto) {
      btn.disabled = true;
      btn.textContent = texto;
    }

    // Guarda lo del paso actual antes de avanzar.
    async function guardarPaso(btn) {
      const cuerpo = capa.querySelector('[data-bv-cuerpo]');
      if (paso === 0) {
        datos = P().leerDatos(cuerpo, { datos });
        plan = P().leerPlan(cuerpo, plan);
        await ctx.guardarDatos(datos);
      } else if (paso === 1) {
        plan = P().leerPlan(cuerpo, plan);
        if (!plan.objetivos || !plan.objetivos.length) throw new Error('Elige al menos un objetivo.');
      } else if (paso === 2) {
        plan = P().leerPlan(cuerpo, plan);
        ocupado(btn, 'Creando tu estrategia…');
        ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/plan-contenido`, { method: 'PUT', body: JSON.stringify(plan) }));
        try {
          ctx.setEstrategia(await ctx.api(`/api/negocios/${ctx.negocio().id}/estrategia/generar`, { method: 'POST' }));
        } catch (err) {
          // Sin IA disponible se sigue con la estrategia que ya tenía.
        }
      } else if (paso === 3) {
        ctx.setEstrategia(await ctx.api(`/api/negocios/${ctx.negocio().id}/estrategia`, { method: 'PUT', body: JSON.stringify(P().leerEstrategia(cuerpo)) }));
      } else if (paso === 4) {
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
      if (accion === 'saltar') {
        if (!confirm('¿Saltar la bienvenida? Usaremos un plan recomendado y podrás cambiarlo en Estrategia.')) return;
        try {
          ctx.setNegocio(await ctx.api(`/api/negocios/${ctx.negocio().id}/bienvenida`, { method: 'POST', body: JSON.stringify({ reemplazar: false }) }));
        } catch (err) { /* igual se cierra */ }
        cerrar();
        return ctx.alTerminar(false);
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
          return ctx.alTerminar(true);
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
