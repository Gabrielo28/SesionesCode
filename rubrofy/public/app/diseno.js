// Diseño con la marca (server/marca.js): el Kit de marca en Configuración y
// el editor que arma la imagen de una pieza con una plantilla. La imagen se
// dibuja en un canvas (sin costo de IA) y se sube como JPEG; al publicar, la
// pieza usa ese diseño y la foto original queda intacta.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FUENTES = { 'Plus Jakarta Sans': 'Moderna', Oswald: 'Impacto', 'Playfair Display': 'Elegante', Caveat: 'Manuscrita' };
  const POSICIONES = { si: 'Arriba izq.', sd: 'Arriba der.', ii: 'Abajo izq.', id: 'Abajo der.' };
  const PLANTILLAS = { titular: 'Titular grande', precio: 'Precio o promo', frase: 'Frase', logo: 'Solo logo', historia: 'Historia con llamado' };
  const KIT_BASE = { color: '#ff4d94', color2: '#141217', fuente: 'Plus Jakarta Sans', posLogo: 'sd', cta: '' };
  let ctx = null;

  function iniciar(contexto) { ctx = contexto; }
  function kitDe(n) { return Object.assign({}, KIT_BASE, n.marca || {}); }
  function urlLogo(n) { const k = n.marca || {}; return k.logo ? `/fotos/${n.id}/_marca/${encodeURIComponent(k.logo)}` : null; }

  function cargarImagen(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = src;
    });
  }
  function cargarFuentes(fuente) {
    return Promise.all([
      document.fonts.load(`700 40px '${fuente}'`), document.fonts.load("800 40px 'Plus Jakarta Sans'"),
      document.fonts.load("italic 600 40px 'Playfair Display'"), document.fonts.load("700 40px 'Playfair Display'"),
    ]).catch(() => {});
  }
  function tintaSobre(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#140a10' : '#ffffff';
  }
  function iniciales(nombre) {
    return String(nombre || 'R').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }

  // ---------- el dibujo (mismo motor que el prototipo aprobado) ----------
  // d: { foto, plantilla, ancho, alto, gancho, precio, cta, nombre, kit, logo }
  function dibujar(canvas, d) {
    const w = d.ancho, h = d.alto;
    canvas.width = w; canvas.height = h;
    const cx = canvas.getContext('2d');
    const k = d.kit;
    const m = w * 0.075;
    const lineas = (texto, max) => {
      const out = []; let l = '';
      String(texto || '').split(/\s+/).filter(Boolean).forEach((p) => {
        const prueba = l ? l + ' ' + p : p;
        if (cx.measureText(prueba).width > max && l) { out.push(l); l = p; } else l = prueba;
      });
      if (l) out.push(l);
      return out;
    };
    const fuente = (peso, tam) => {
      const p = k.fuente === 'Caveat' || k.fuente === 'Oswald' ? 700 : peso;
      const t = k.fuente === 'Caveat' ? tam * 1.25 : k.fuente === 'Oswald' ? tam * 1.05 : tam;
      return { css: `${p} ${t}px '${k.fuente}', 'Plus Jakarta Sans', sans-serif`, tam: t };
    };
    const pastilla = (texto, xc, y, tl, fondo, tinta) => {
      cx.font = `800 ${tl}px 'Plus Jakarta Sans', sans-serif`;
      const an = cx.measureText(texto).width + tl * 1.6, al = tl * 2;
      cx.fillStyle = fondo; cx.beginPath();
      if (cx.roundRect) cx.roundRect(xc - an / 2, y, an, al, al / 2); else cx.rect(xc - an / 2, y, an, al);
      cx.fill();
      cx.fillStyle = tinta; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(texto, xc, y + al / 2 + 1);
      cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    };
    // foto cubriendo el lienzo
    const iw = d.foto.naturalWidth || d.foto.width, ih = d.foto.naturalHeight || d.foto.height;
    const s = Math.max(w / iw, h / ih);
    cx.drawImage(d.foto, (w - iw * s) / 2, (h - ih * s) / 2, iw * s, ih * s);

    if (d.plantilla === 'titular') {
      const g = cx.createLinearGradient(0, h * 0.45, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
      cx.fillStyle = g; cx.fillRect(0, 0, w, h);
      const f = fuente(800, w * 0.085); cx.font = f.css;
      const ls = lineas(d.gancho, w - m * 2), lh = f.tam * 1.08;
      const y = h - m - ls.length * lh;
      cx.fillStyle = k.color; cx.fillRect(m, y - lh * 0.55, w * 0.12, w * 0.012);
      cx.fillStyle = '#ffffff'; ls.forEach((l, i) => cx.fillText(l, m, y + lh * 0.72 + i * lh));
    } else if (d.plantilla === 'precio') {
      const g = cx.createLinearGradient(0, 0, 0, h * 0.5);
      g.addColorStop(0, 'rgba(0,0,0,0.65)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.fillRect(0, 0, w, h);
      const f = fuente(800, w * 0.07); cx.font = f.css;
      const ls = lineas(d.gancho, w * 0.62), lh = f.tam * 1.1;
      cx.fillStyle = '#ffffff'; ls.forEach((l, i) => cx.fillText(l, m, m + f.tam + i * lh));
      if (d.precio) {
        const r = w * 0.2, bx = w - m - r, by = h - m - r - w * 0.12;
        cx.fillStyle = k.color; cx.beginPath(); cx.arc(bx, by, r, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = tintaSobre(k.color); cx.textAlign = 'center';
        const fp = fuente(800, w * 0.055); cx.font = fp.css;
        const lp = lineas(d.precio, r * 1.6);
        lp.forEach((l, i) => cx.fillText(l, bx, by + fp.tam * 0.35 - (lp.length - 1) * fp.tam * 0.55 + i * fp.tam * 1.1));
        cx.textAlign = 'left';
      }
      if (d.cta) pastilla(d.cta, w / 2, h - m - w * 0.09, w * 0.04, k.color2, tintaSobre(k.color2));
    } else if (d.plantilla === 'frase') {
      cx.fillStyle = 'rgba(0,0,0,0.55)'; cx.fillRect(0, 0, w, h);
      cx.fillStyle = k.color; cx.font = `700 ${w * 0.3}px 'Playfair Display', serif`; cx.fillText('“', m, h * 0.4);
      cx.font = k.fuente === 'Plus Jakarta Sans' ? `italic 600 ${w * 0.07}px 'Playfair Display', serif` : fuente(700, w * 0.07).css;
      const ls = lineas(d.gancho, w - m * 2), lh = w * 0.085;
      cx.fillStyle = '#ffffff'; ls.forEach((l, i) => cx.fillText(l, m, h * 0.45 + i * lh));
      cx.fillStyle = k.color; cx.font = `700 ${w * 0.034}px 'Plus Jakarta Sans', sans-serif`;
      cx.fillText('— ' + (d.nombre || ''), m, h * 0.45 + ls.length * lh + w * 0.04);
    } else if (d.plantilla === 'historia') {
      const g = cx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.3, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      cx.fillStyle = g; cx.fillRect(0, 0, w, h);
      const f = fuente(800, w * 0.08); cx.font = f.css;
      const ls = lineas(d.gancho, w - m * 2), lh = f.tam * 1.1;
      cx.textAlign = 'center'; cx.fillStyle = '#ffffff';
      ls.forEach((l, i) => cx.fillText(l, w / 2, h * 0.16 + i * lh));
      cx.textAlign = 'left';
      if (d.cta) pastilla(d.cta + '  →', w / 2, h * 0.8, w * 0.05, k.color, tintaSobre(k.color));
    }
    // logo
    const tam = Math.round(w * 0.15), ml = Math.round(w * 0.045);
    const x = k.posLogo[1] === 'd' ? w - ml - tam : ml;
    const y = k.posLogo[0] === 's' ? ml : h - ml - tam;
    if (d.logo) {
      const lw = d.logo.naturalWidth, lhh = d.logo.naturalHeight, sc = Math.min(tam / lw, tam / lhh);
      cx.drawImage(d.logo, x + (tam - lw * sc) / 2, y + (tam - lhh * sc) / 2, lw * sc, lhh * sc);
    } else {
      cx.fillStyle = k.color; cx.beginPath(); cx.arc(x + tam / 2, y + tam / 2, tam / 2, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = tintaSobre(k.color); cx.font = `800 ${tam * 0.36}px 'Plus Jakarta Sans', sans-serif`;
      cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(iniciales(d.nombre), x + tam / 2, y + tam / 2 + 2);
      cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    }
  }

  // ---------- editor de una pieza ----------
  // item: la pieza; fotoUrl: la foto que muestra su tarjeta; formato: post|carrusel|historia
  async function abrirEditor(item, fotoUrl, formato) {
    const n = ctx.negocio();
    let dlg = document.getElementById('dlg-diseno');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-diseno';
      dlg.className = 'dlg dlg-diseno';
      document.body.appendChild(dlg);
    }
    const kit = kitDe(n);
    const esHistoria = formato === 'historia';
    const datos = n.datos || {};
    const precioBase = datos.precioDesde ? `${datos.precioDesde}${datos.unidad ? ' ' + datos.unidad : ''}` : '';
    const est = {
      plantilla: (item.diseno && item.diseno.plantilla) || (esHistoria ? 'historia' : 'titular'),
      tam: esHistoria ? '1080x1920' : '1080x1350',
      gancho: item.gancho || String(item.headline || '').replace(/\n/g, ' '),
      precio: precioBase,
      cta: kit.cta || 'Escríbenos por WhatsApp',
    };
    dlg.innerHTML = `<div class="dlg-caja dz-caja">
        <h2>Diseñar con mi marca</h2>
        <div class="dz-grid">
          <div class="dz-lienzo"><canvas data-dz-canvas aria-label="Vista previa del diseño"></canvas><p class="sub" data-dz-pie>Cargando la foto…</p></div>
          <div class="dz-ctrl">
            <div class="dz-grupo"><b>Plantilla</b><div class="dz-chips">${Object.entries(PLANTILLAS).map(([id, t]) => `<button type="button" class="rc-tipo" data-pl="${id}">${esc(t)}</button>`).join('')}</div></div>
            ${esHistoria ? '' : `<div class="dz-grupo"><b>Formato</b><div class="dz-chips"><button type="button" class="rc-tipo" data-tam="1080x1080">Cuadrado</button><button type="button" class="rc-tipo" data-tam="1080x1350">Vertical 4:5</button></div></div>`}
            <label class="estilo-campo">Gancho<input data-dz="gancho" maxlength="150" value="${esc(est.gancho)}"></label>
            <label class="estilo-campo">Precio (plantilla de precio)<input data-dz="precio" maxlength="40" value="${esc(est.precio)}"></label>
            <label class="estilo-campo">Llamado a la acción<input data-dz="cta" maxlength="60" value="${esc(est.cta)}"></label>
            <p class="sub">Colores, tipografía y logo salen de tu <a href="#cfg-marca" data-dz-kit>Kit de marca</a>.${formato === 'carrusel' ? ' En un carrusel, el diseño va en la portada.' : ''}</p>
          </div>
        </div>
        <p class="config-error" data-dz-error hidden></p>
        <div class="dlg-acciones">
          ${item.diseno ? '<button type="button" class="btn-ghost" data-dz-quitar>Quitar diseño</button>' : ''}
          <button type="button" class="btn-ghost" data-dz-cerrar>Cancelar</button>
          <button type="button" class="btn-approve" data-dz-usar disabled>Usar este diseño</button>
        </div>
      </div>`;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    const canvas = dlg.querySelector('[data-dz-canvas]');
    const errorEl = dlg.querySelector('[data-dz-error]');
    let foto = null, logo = null;
    try {
      [foto, logo] = await Promise.all([cargarImagen(fotoUrl), urlLogo(n) ? cargarImagen(urlLogo(n)).catch(() => null) : Promise.resolve(null)]);
      await cargarFuentes(kit.fuente);
    } catch (err) {
      errorEl.textContent = 'No se pudo cargar la foto de esta pieza.';
      errorEl.hidden = false;
      return;
    }
    function pintar() {
      const plantilla = est.plantilla === 'historia' && !esHistoria ? 'historia' : est.plantilla;
      const [ancho, alto] = (plantilla === 'historia' ? '1080x1920' : est.tam).split('x').map(Number);
      dibujar(canvas, { foto, logo, plantilla, ancho, alto, gancho: est.gancho, precio: est.precio, cta: est.cta, nombre: n.nombre, kit });
      dlg.querySelectorAll('[data-pl]').forEach((b) => b.classList.toggle('activo', b.dataset.pl === est.plantilla));
      dlg.querySelectorAll('[data-tam]').forEach((b) => b.classList.toggle('activo', b.dataset.tam === est.tam));
      dlg.querySelector('[data-dz-pie]').textContent = `${ancho} × ${alto} px · la foto original se guarda`;
      dlg.querySelector('[data-dz-usar]').disabled = false;
    }
    pintar();
    dlg.oninput = (e) => { const k = e.target.dataset.dz; if (k) { est[k] = e.target.value; pintar(); } };
    dlg.onclick = async (e) => {
      const pl = e.target.closest('[data-pl]'); if (pl) { est.plantilla = pl.dataset.pl; return pintar(); }
      const tm = e.target.closest('[data-tam]'); if (tm) { est.tam = tm.dataset.tam; return pintar(); }
      if (e.target.closest('[data-dz-cerrar]')) return dlg.close();
      if (e.target.closest('[data-dz-kit]')) { e.preventDefault(); dlg.close(); return ctx.irA('config', null, 'cfg-marca'); }
      const quitar = e.target.closest('[data-dz-quitar]');
      const usar = e.target.closest('[data-dz-usar]');
      if (!quitar && !usar) return;
      const btn = quitar || usar;
      btn.disabled = true;
      errorEl.hidden = true;
      try {
        if (quitar) {
          await ctx.api(`/api/negocios/${n.id}/contenido/${item.id}/diseno`, { method: 'DELETE' });
        } else {
          const dataBase64 = canvas.toDataURL('image/jpeg', 0.9);
          await ctx.api(`/api/negocios/${n.id}/contenido/${item.id}/diseno`, { method: 'POST', body: JSON.stringify({ dataBase64, plantilla: est.plantilla }) });
        }
        dlg.close();
        await ctx.recargarContenido();
      } catch (err) {
        errorEl.textContent = err.mensaje || 'No se pudo guardar el diseño.';
        errorEl.hidden = false;
        btn.disabled = false;
      }
    };
  }

  // ---------- Kit de marca (Configuración) ----------
  function renderKit(cont) {
    if (!ctx || !cont) return;
    const n = ctx.negocio();
    const k = kitDe(n);
    const logo = urlLogo(n);
    cont.innerHTML = `
      <p class="sub">Se usa en los diseños de tus publicaciones y en tus reels editados.</p>
      <div class="kit-grid">
        <div class="kit-logo">${logo ? `<img src="${esc(logo)}" alt="Tu logo">` : `<span style="background:${esc(k.color)}; color:${tintaSobre(k.color)}">${esc(iniciales(n.nombre))}</span>`}</div>
        <div class="kit-acciones">
          <label class="btn-ghost kit-subir">${logo ? 'Cambiar logo' : 'Subir logo'}<input type="file" accept="image/png,image/jpeg,image/webp" data-kit-logo hidden></label>
          ${logo ? '<button type="button" class="btn-text" data-kit-quitar>Quitar logo</button>' : ''}
          <span class="sub">PNG con fondo transparente queda mejor. Máximo 2 MB.</span>
        </div>
      </div>
      <div class="kit-campos">
        <label class="estilo-campo">Color principal<input type="color" data-kit="color" value="${esc(k.color)}"></label>
        <label class="estilo-campo">Color de apoyo<input type="color" data-kit="color2" value="${esc(k.color2)}"></label>
        <label class="estilo-campo">Tipografía<select data-kit="fuente">${Object.entries(FUENTES).map(([f, t]) => `<option value="${esc(f)}"${f === k.fuente ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="estilo-campo">Dónde va el logo<select data-kit="posLogo">${Object.entries(POSICIONES).map(([p, t]) => `<option value="${p}"${p === k.posLogo ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label class="estilo-campo kit-cta">Llamado a la acción por defecto<input data-kit="cta" maxlength="60" placeholder="Ej: Reserva por WhatsApp" value="${esc(k.cta)}"></label>
      </div>
      <div class="estilo-acciones"><button type="button" class="btn-approve estilo-btn" data-kit-guardar>Guardar Kit de marca</button><span class="res-estado" data-kit-msg></span></div>`;
    const msg = cont.querySelector('[data-kit-msg]');
    cont.querySelector('[data-kit-guardar]').onclick = async (e) => {
      const body = {};
      cont.querySelectorAll('[data-kit]').forEach((el) => { body[el.dataset.kit] = el.value; });
      e.target.disabled = true; msg.textContent = 'Guardando…';
      try { ctx.setNegocio(await ctx.api(`/api/negocios/${n.id}/marca`, { method: 'PUT', body: JSON.stringify(body) })); msg.textContent = 'Guardado.'; renderKit(cont); }
      catch (err) { msg.textContent = err.mensaje || 'No se pudo guardar.'; e.target.disabled = false; }
    };
    cont.querySelector('[data-kit-logo]').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 2 * 1024 * 1024) { msg.textContent = 'El logo pesa más de 2 MB.'; return; }
      const r = new FileReader();
      r.onload = async () => {
        msg.textContent = 'Subiendo…';
        try { ctx.setNegocio(await ctx.api(`/api/negocios/${n.id}/marca/logo`, { method: 'POST', body: JSON.stringify({ dataBase64: r.result }) })); renderKit(cont); }
        catch (err) { msg.textContent = err.mensaje || 'No se pudo subir el logo.'; }
      };
      r.readAsDataURL(f);
    };
    const quitar = cont.querySelector('[data-kit-quitar]');
    if (quitar) quitar.onclick = async () => {
      try { ctx.setNegocio(await ctx.api(`/api/negocios/${n.id}/marca/logo`, { method: 'DELETE' })); renderKit(cont); }
      catch (err) { msg.textContent = err.mensaje || 'No se pudo quitar.'; }
    };
  }

  window.RubrofyDiseno = { iniciar, abrirEditor, renderKit, dibujar, kitDe, urlLogo, tintaSobre, iniciales, cargarImagen, cargarFuentes };
})();
