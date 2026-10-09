// "Descubre tu diseño con IA" (Tu marca → Cómo se ve, server/diseno-ia.js):
// la IA mira tu Instagram y tu web y propone colores, letra, qué fotos te
// funcionan y los pasos para llegar al diseño que buscas. Nada cambia solo:
// "Aplicar a mi kit de marca" (o "Editar antes de aplicar") lo deja en el kit
// y desde ahí guía las fotos con IA. La vista previa usa el mismo dibujo que
// los diseños de las publicaciones (diseno.js).
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FUENTES = { 'Plus Jakarta Sans': 'Moderna', Oswald: 'Impacto', 'Playfair Display': 'Elegante', Caveat: 'Manuscrita' };
  const POSICIONES = { si: 'Arriba izquierda', sd: 'Arriba derecha', ii: 'Abajo izquierda', id: 'Abajo derecha' };
  const ORIGEN = { web: 'tu web', instagram: 'tu Instagram', logo: 'tu logo', ambos: 'web e Instagram' };
  const ROL = { principal: 'Principal', apoyo: 'De apoyo', fondo: 'Fondo', texto: 'Textos', acento: 'Acento' };
  const RESPALDO = { 'Playfair Display': 'serif', Caveat: 'cursive', Oswald: 'sans-serif', 'Plus Jakarta Sans': 'sans-serif' };

  let ctx = null;
  let cont = null;
  let info = null; // respuesta de GET /diseno-ia
  let editando = false;
  let analizando = false;
  let eleccion = null; // lo que se aplicará: { color, color2, fuente, posLogo, usarLogoWeb, usarEnImagenes }

  const n = () => ctx.negocio();
  const base = () => `/api/negocios/${n().id}/diseno-ia`;

  async function render(contenedor, contexto) {
    cont = contenedor;
    ctx = contexto;
    if (!cont) return;
    cont.innerHTML = '<p class="sub">Cargando…</p>';
    try {
      info = await ctx.api(base());
    } catch (err) {
      cont.innerHTML = `<p class="sub">${esc(err.mensaje || 'No se pudo cargar.')}</p>`;
      return;
    }
    eleccion = null;
    editando = false;
    pintar();
  }

  function eleccionInicial(d) {
    const p = (rol) => (d.paleta.find((c) => c.rol === rol) || {}).hex;
    const kit = window.RubrofyDiseno.kitDe(n());
    return {
      color: p('principal') || kit.color, color2: p('apoyo') || kit.color2, fuente: d.letra.fuente, posLogo: d.posLogo,
      usarLogoWeb: !!d.logoWeb && !(n().marca && n().marca.logo), usarEnImagenes: true,
    };
  }

  function fuentesHTML() {
    const ig = info.instagram;
    const web = info.web;
    const igTxt = ig.importadas ? `${ig.importadas} publicaciones importadas` : ig.conectado ? 'Se importan tus publicaciones al analizar' : 'No está conectado';
    const dominio = web ? web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';
    return `<div class="dia-fuentes">
        <div class="dia-fuente"><i class="dia-ic ig" aria-hidden="true"></i><div><b>Tu Instagram</b><span>${esc(igTxt)}</span></div>
          ${ig.conectado || ig.importadas ? '<em class="ok">✓ Listo</em>' : '<button type="button" class="btn-text" data-dia-ir="config">Conectar</button>'}</div>
        <div class="dia-fuente"><i class="dia-ic web" aria-hidden="true">🌐</i><div><b>Tu web</b><span>${web ? `${esc(dominio)} · colores, letras, logo e imágenes` : 'No tienes web en tu perfil'}</span></div>
          ${web ? '<em class="ok">✓ Listo</em>' : '<button type="button" class="btn-text" data-dia-ir="config">Agregar</button>'}</div>
      </div>`;
  }

  function pintar() {
    const d = info.diseno;
    if (d && !eleccion) eleccion = eleccionInicial(d);
    const sinFuentes = !info.instagram.conectado && !info.instagram.importadas && !info.web;
    cont.innerHTML = `
      <div class="dia-cab"><h2>Descubre tu diseño con IA</h2><span class="dia-nuevo">Nuevo</span></div>
      <p class="sub">Rubrofy mira tus publicaciones de Instagram y tu web: colores, letras, fotos y lo que funciona. Te dice cómo llegar al diseño que buscas y lo aplica a tu kit con un clic.</p>
      ${fuentesHTML()}
      ${info.disponible ? `
        <label class="dia-deseo">¿Cómo quieres que se vea tu marca? <i>(opcional)</i>
          <input type="text" maxlength="200" data-dia-deseo placeholder="Ej: más artesanal y cálida, como una panadería de campo" value="${esc(d && d.deseo || '')}"></label>
        <div class="dia-acciones">
          <button type="button" class="btn-approve" data-dia-analizar${analizando || sinFuentes ? ' disabled' : ''}>${analizando ? 'Mirando tu Instagram y tu web…' : d ? '✨ Analizar de nuevo' : '✨ Analizar mi diseño con IA'}</button>
          <span class="sub">${analizando ? 'Puede tardar hasta un minuto.' : sinFuentes ? 'Conecta tu Instagram o agrega tu web para empezar.' : 'Usa 1 pieza con IA de tu plan.'}</span>
        </div>
        <p class="dia-error" data-dia-error role="alert"></p>`
        : `<div class="dia-plan"><b>Disponible en los planes Pro y Estudio.</b> <button type="button" class="btn-text" data-dia-ir="cuenta">Ver planes →</button></div>`}
      ${d ? resultadoHTML(d) : ''}`;
    if (d) dibujarVista();
  }

  function resultadoHTML(d) {
    const e = eleccion;
    const fecha = new Date(d.aplicadoEl || d.generadoEl).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
    const ejemplo = (x) => `<figure class="dia-foto"><img src="/referencias/${esc(n().id)}/${esc(x.imagen)}" alt="" loading="lazy" onerror="this.parentNode.remove()"><figcaption class="${x.bien ? 'bien' : 'mal'}">${x.bien ? '✓' : '✗'} ${esc(x.etiqueta)}</figcaption></figure>`;
    const logoWebUrl = d.logoWeb ? `/fotos/${esc(n().id)}/_marca/${esc(d.logoWeb)}` : null;
    return `
      <div class="dia-res">
        <div class="dia-col">
          ${d.resumen ? `<p class="dia-resumen">${esc(d.resumen)}</p>` : ''}
          <section class="dia-bloque"><h3>Tus colores</h3>
            <div class="dia-paleta">${d.paleta.map((c) => `<div class="dia-color"><span style="background:${esc(c.hex)}"></span><b>${esc(c.nombre)}</b><small>${esc(c.hex.toUpperCase())} · ${esc(ROL[c.rol] || '')}${c.origen ? ` · ${esc(ORIGEN[c.origen] || c.origen)}` : ''}</small></div>`).join('')}</div>
            ${d.aviso ? `<p class="dia-aviso">${esc(d.aviso)}</p>` : ''}
          </section>
          <section class="dia-bloque"><h3>Tu letra</h3>
            <div class="dia-letra"><span style="font-family:'${esc(d.letra.fuente)}', ${RESPALDO[d.letra.fuente] || 'sans-serif'}">${esc(muestra())}</span><p>${esc(d.letra.porque || '')} → <b>${esc(FUENTES[d.letra.fuente] || d.letra.fuente)}</b></p></div>
          </section>
          ${d.fotos.ejemplos.length || d.fotos.funciona.length || d.fotos.evitar.length ? `<section class="dia-bloque"><h3>Tus fotos</h3>
            ${d.fotos.ejemplos.length ? `<div class="dia-fotos">${d.fotos.ejemplos.map(ejemplo).join('')}</div>` : ''}
            <ul class="dia-lista">
              ${d.fotos.funciona.map((t) => `<li><b>Te funciona:</b> ${esc(t)}</li>`).join('')}
              ${d.fotos.evitar.map((t) => `<li><b>Evita:</b> ${esc(t)}</li>`).join('')}
            </ul></section>` : ''}
        </div>
        <div class="dia-col">
          ${d.pasos.length ? `<section class="dia-bloque"><h3>${d.deseo ? 'Para llegar al diseño que buscas' : 'Para que tu marca se vea mejor'}</h3>
            <ol class="dia-pasos">${d.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></section>` : ''}
          <section class="dia-bloque"><h3>Así se verían tus publicaciones</h3>
            <canvas class="dia-vista" data-dia-vista width="540" height="675" aria-label="Vista previa de una publicación con este diseño"></canvas></section>
          ${editando ? `<div class="dia-editar">
              <label>Color principal<input type="color" data-dia-e="color" value="${esc(e.color)}"></label>
              <label>Color de apoyo<input type="color" data-dia-e="color2" value="${esc(e.color2)}"></label>
              <label>Tipografía<select data-dia-e="fuente">${Object.entries(FUENTES).map(([f, t]) => `<option value="${esc(f)}"${f === e.fuente ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
              <label>Dónde va el logo<select data-dia-e="posLogo">${Object.entries(POSICIONES).map(([p, t]) => `<option value="${p}"${p === e.posLogo ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
            </div>` : ''}
          ${logoWebUrl ? `<label class="dia-check"><input type="checkbox" data-dia-e="usarLogoWeb"${e.usarLogoWeb ? ' checked' : ''}><img src="${logoWebUrl}" alt="" onerror="this.remove()"> Usar el logo de mi web${n().marca && n().marca.logo ? ' (reemplaza el actual)' : ''}</label>` : ''}
          <label class="dia-check"><input type="checkbox" data-dia-e="usarEnImagenes"${e.usarEnImagenes ? ' checked' : ''}> Usar esta guía al crear fotos con IA</label>
          <div class="dia-botones">
            <button type="button" class="btn-approve" data-dia-aplicar>${d.aplicadoEl ? 'Aplicar de nuevo a mi kit' : 'Aplicar a mi kit de marca'}</button>
            ${editando ? '' : '<button type="button" class="btn-ghost" data-dia-editar>Editar antes de aplicar</button>'}
          </div>
          <p class="dia-estado" data-dia-estado role="status">${d.aplicadoEl ? `✓ Aplicado a tu kit el ${esc(fecha)}.` : `Análisis del ${esc(fecha)}, basado en ${d.basadoEn.instagram} publicaciones${d.basadoEn.web ? ' y tu web' : ''}.`}</p>
        </div>
      </div>`;
  }

  function muestra() {
    const e = n().estrategia || {};
    return ((e.enfoques || [])[0] || {}).label || n().nombre || 'Tu marca';
  }

  // Vista previa con el mismo dibujo de los diseños (diseno.js).
  let dibujo = 0;
  async function dibujarVista() {
    const canvas = cont.querySelector('[data-dia-vista]');
    const D = window.RubrofyDiseno;
    if (!canvas || !D) return;
    const turno = ++dibujo;
    const d = info.diseno;
    const e = eleccion;
    const kit = Object.assign({}, D.kitDe(n()), { color: e.color, color2: e.color2, fuente: e.fuente, posLogo: e.posLogo });
    const buena = d.fotos.ejemplos.find((x) => x.bien) || d.fotos.ejemplos[0];
    let foto = null;
    if (buena) foto = await D.cargarImagen(`/referencias/${n().id}/${encodeURIComponent(buena.imagen)}`).catch(() => null);
    if (!foto) {
      foto = document.createElement('canvas');
      foto.width = 1080; foto.height = 1350;
      const g = foto.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 1080, 1350);
      gr.addColorStop(0, e.color2); gr.addColorStop(1, e.color);
      g.fillStyle = gr; g.fillRect(0, 0, 1080, 1350);
    }
    const logoUrl = e.usarLogoWeb && d.logoWeb ? `/fotos/${n().id}/_marca/${encodeURIComponent(d.logoWeb)}` : D.urlLogo(n());
    const logo = logoUrl ? await D.cargarImagen(logoUrl).catch(() => null) : null;
    await D.cargarFuentes(kit.fuente);
    if (turno !== dibujo) return; // llegó otro cambio mientras cargaba
    const datos = n().datos || {};
    D.dibujar(canvas, {
      foto, plantilla: d.plantilla === 'precio' && !datos.precioDesde ? 'titular' : d.plantilla, ancho: 1080, alto: 1350,
      gancho: muestra(), precio: datos.precioDesde || '', cta: kit.cta || 'Escríbenos', nombre: n().nombre, kit, logo,
    });
  }

  function enlazar(contenedor) {
    contenedor.addEventListener('click', async (ev) => {
      const ir = ev.target.closest('[data-dia-ir]');
      if (ir) return ctx.irA(ir.dataset.diaIr);
      if (ev.target.closest('[data-dia-editar]')) { editando = true; pintar(); return; }
      if (ev.target.closest('[data-dia-analizar]')) return analizar();
      if (ev.target.closest('[data-dia-aplicar]')) return aplicar(ev.target.closest('[data-dia-aplicar]'));
    });
    contenedor.addEventListener('input', (ev) => {
      const el = ev.target.closest('[data-dia-e]');
      if (!el || !eleccion) return;
      eleccion[el.dataset.diaE] = el.type === 'checkbox' ? el.checked : el.value;
      dibujarVista();
    });
    contenedor.addEventListener('change', (ev) => {
      const el = ev.target.closest('[data-dia-e]');
      if (!el || !eleccion) return;
      eleccion[el.dataset.diaE] = el.type === 'checkbox' ? el.checked : el.value;
      dibujarVista();
    });
    contenedor.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target.matches('[data-dia-deseo]')) { ev.preventDefault(); analizar(); }
    });
  }

  async function analizar() {
    if (analizando) return;
    const campo = cont.querySelector('[data-dia-deseo]');
    const deseo = campo ? campo.value : '';
    analizando = true;
    pintar();
    const campo2 = cont.querySelector('[data-dia-deseo]');
    if (campo2) campo2.value = deseo;
    try {
      const r = await ctx.api(base() + '/analizar', { method: 'POST', body: JSON.stringify({ deseo }) });
      ctx.setNegocio(r.negocio);
      info = await ctx.api(base());
      eleccion = null;
      editando = false;
      analizando = false;
      pintar();
      const res = cont.querySelector('.dia-res');
      if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      analizando = false;
      pintar();
      const c = cont.querySelector('[data-dia-deseo]');
      if (c) c.value = deseo;
      const el = cont.querySelector('[data-dia-error]');
      if (el) el.textContent = err.mensaje || 'No se pudo analizar tu diseño.';
    }
  }

  async function aplicar(btn) {
    btn.disabled = true;
    const estado = cont.querySelector('[data-dia-estado]');
    if (estado) estado.textContent = 'Aplicando…';
    try {
      const r = await ctx.api(base() + '/aplicar', { method: 'POST', body: JSON.stringify(eleccion) });
      ctx.setNegocio(r.negocio);
      info.diseno = r.diseno;
      editando = false;
      pintar();
      if (ctx.alAplicar) ctx.alAplicar();
    } catch (err) {
      btn.disabled = false;
      if (estado) estado.textContent = err.mensaje || 'No se pudo aplicar.';
    }
  }

  window.RubrofyDisenoIA = {
    render(contenedor, contexto) {
      if (contenedor && !contenedor.dataset.enlazado) { enlazar(contenedor); contenedor.dataset.enlazado = '1'; }
      return render(contenedor, contexto);
    },
  };
})();
