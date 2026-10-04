// Editor de reels (server/edicion-reels.js). Muestra una vista previa en el
// navegador (recorte, silencios, gancho, subtítulos, llamado a la acción,
// logo, color, zoom y velocidad) y al confirmar le pide al servidor el reel
// final. Las capas de texto y logo se dibujan aquí con la tipografía de la
// marca y viajan como PNG transparentes de 1080×1920.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtS = (s) => s.toFixed(1).replace('.', ',') + ' s';
  const FILTROS = { original: 'none', calido: 'saturate(1.2) sepia(.15) contrast(1.05)', contraste: 'contrast(1.2) saturate(1.1)', bn: 'grayscale(1) contrast(1.1)' };
  const MAX_ANALISIS_BYTES = 60 * 1024 * 1024;
  let ctx = null;

  function iniciar(c) { ctx = c; }

  // ---------- capas PNG (mismas posiciones que la vista previa) ----------
  function lineas(cx, texto, max) {
    const out = []; let l = '';
    String(texto || '').split(/\s+/).filter(Boolean).forEach((p) => {
      const prueba = l ? l + ' ' + p : p;
      if (cx.measureText(prueba).width > max && l) { out.push(l); l = p; } else l = prueba;
    });
    if (l) out.push(l);
    return out;
  }
  function lienzo() { const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; return c; }

  function capaGancho(texto, kit) {
    const c = lienzo(), cx = c.getContext('2d');
    const D = window.RubrofyDiseno;
    const tam = kit.fuente === 'Caveat' ? 92 : 74;
    cx.font = `${kit.fuente === 'Plus Jakarta Sans' ? 800 : 700} ${tam}px '${kit.fuente}', 'Plus Jakarta Sans', sans-serif`;
    const ls = lineas(cx, texto, 1080 * 0.8);
    const lh = tam * 1.25;
    let y = 1920 * 0.14;
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    ls.forEach((l) => {
      const w = cx.measureText(l).width + tam * 0.6;
      cx.fillStyle = kit.color;
      cx.beginPath();
      if (cx.roundRect) cx.roundRect(540 - w / 2, y, w, tam * 1.15, 14); else cx.rect(540 - w / 2, y, w, tam * 1.15);
      cx.fill();
      cx.fillStyle = D.tintaSobre(kit.color);
      cx.fillText(l, 540, y + tam * 0.6);
      y += lh;
    });
    return c.toDataURL('image/png');
  }
  function capaCta(texto, kit) {
    const c = lienzo(), cx = c.getContext('2d');
    const tam = 54;
    cx.font = `800 ${tam}px 'Plus Jakarta Sans', sans-serif`;
    const w = cx.measureText(texto).width + tam * 1.6, h = tam * 2;
    const y = 1920 * 0.92 - h;
    cx.fillStyle = kit.color; cx.beginPath();
    if (cx.roundRect) cx.roundRect(540 - w / 2, y, w, h, h / 2); else cx.rect(540 - w / 2, y, w, h);
    cx.fill();
    cx.fillStyle = window.RubrofyDiseno.tintaSobre(kit.color); cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(texto, 540, y + h / 2 + 2);
    return c.toDataURL('image/png');
  }
  function capaLogo(logoImg, kit, nombre) {
    const c = lienzo(), cx = c.getContext('2d');
    const tam = Math.round(1080 * 0.18), mx = Math.round(1080 * 0.04), my = Math.round(1920 * 0.03);
    const x = kit.posLogo[1] === 'd' ? 1080 - mx - tam : mx;
    const y = kit.posLogo[0] === 's' ? my : 1920 - my - tam;
    if (logoImg) {
      const s = Math.min(tam / logoImg.naturalWidth, tam / logoImg.naturalHeight);
      cx.drawImage(logoImg, x + (tam - logoImg.naturalWidth * s) / 2, y + (tam - logoImg.naturalHeight * s) / 2, logoImg.naturalWidth * s, logoImg.naturalHeight * s);
    } else {
      cx.fillStyle = kit.color; cx.beginPath(); cx.arc(x + tam / 2, y + tam / 2, tam / 2, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = window.RubrofyDiseno.tintaSobre(kit.color); cx.font = `800 ${tam * 0.36}px 'Plus Jakarta Sans', sans-serif`;
      cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(window.RubrofyDiseno.iniciales(nombre), x + tam / 2, y + tam / 2 + 2);
    }
    return c.toDataURL('image/png');
  }

  // ---------- silencios (vista previa) ----------
  async function detectarSilencios(url) {
    const res = await fetch(url);
    const largo = Number(res.headers.get('content-length')) || 0;
    if (largo > MAX_ANALISIS_BYTES) throw new Error('grande');
    const buf = await res.arrayBuffer();
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const audio = await new Ctx(1, 44100, 44100).decodeAudioData(buf);
    const datos = audio.getChannelData(0), paso = Math.floor(audio.sampleRate * 0.1), rms = [];
    for (let i = 0; i < datos.length; i += paso) {
      let s = 0; const fin = Math.min(datos.length, i + paso);
      for (let k = i; k < fin; k++) s += datos[k] * datos[k];
      rms.push(Math.sqrt(s / (fin - i)));
    }
    const umbral = 0.0178; // ≈ -35 dB, el mismo del servidor
    const out = []; let ini = null;
    rms.forEach((v, i) => {
      if (v < umbral) { if (ini === null) ini = i; } else if (ini !== null) { if (i - ini >= 6) out.push([ini / 10, i / 10]); ini = null; }
    });
    if (ini !== null && rms.length - ini >= 6) out.push([ini / 10, rms.length / 10]);
    return out;
  }

  // ---------- el editor ----------
  // opciones.biblioteca: un video de "Mis videos" (el resultado queda como
  // un video nuevo en la galería); opciones.alEnviar se llama al encolarlo.
  async function abrir(item, opciones) {
    const op0 = opciones || {};
    const lib = op0.biblioteca || null;
    const n = ctx.negocio();
    const D = window.RubrofyDiseno;
    const kit = D.kitDe(n);
    const base = lib ? { archivo: lib.archivo } : (item.videoOriginal || item.video);
    if (!base) return;
    const src = `/videos/${n.id}/${encodeURIComponent(base.archivo)}`;
    const auto = !!(n.edicionReels && n.edicionReels.subtitulosAuto);
    let dlg = document.getElementById('dlg-reel');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-reel';
      dlg.className = 'dlg dlg-reel';
      document.body.appendChild(dlg);
    }
    const quedan = n.reelsEditadosDisponibles || 0;
    const ganchoInicial = lib ? '' : (item.gancho || String(item.headline || '').replace(/\n/g, ' '));
    dlg.innerHTML = `<div class="dlg-caja modo-auto">
      <h2>${lib ? `Editar “${esc(lib.nombre)}”` : 'Editar con Rubrofy'}</h2>
      <div class="rl-grid">
        <div class="rl-vista">
          <div class="rl-tel" style="--c1:${esc(kit.color)}; --c1-ink:${D.tintaSobre(kit.color)}">
            <video data-rl-video playsinline preload="auto" src="${esc(src)}"></video>
            <div class="rl-gancho" data-rl-gancho><span>${esc(ganchoInicial)}</span></div>
            <div class="rl-sub" data-rl-sub></div>
            <div class="rl-cta" data-rl-cta>${esc(kit.cta || 'Escríbenos por WhatsApp')}</div>
            <div class="rl-logo" data-rl-logo></div>
          </div>
          <div class="rl-barra" data-rl-barra></div>
          <div class="rl-tiempos"><span data-rl-t>0,0 s</span><span data-rl-total></span></div>
          <div class="rl-leyenda"><span><i class="rl-l-sil"></i>Silencio: se corta</span><span><i class="rl-l-fuera"></i>Fuera del recorte</span></div>
          <div class="fila-botones"><button type="button" class="btn-approve" data-rl-play>Reproducir</button><button type="button" class="btn-ghost" data-rl-inicio>Desde el inicio</button></div>
        </div>
        <div class="rl-ctrl">
          <div class="rl-modos" role="radiogroup" aria-label="Tipo de edición">
            <button type="button" class="rl-modo activo" role="radio" aria-checked="true" data-rl-modo="auto"><b>✨ Automático</b><small>Corta silencios y pone subtítulos, gancho, logo y llamado a la acción</small><em>Recomendado</em></button>
            <button type="button" class="rl-modo" role="radio" aria-checked="false" data-rl-modo="subs"><b>💬 Solo subtítulos</b><small>Tu video tal cual, con subtítulos</small></button>
            <button type="button" class="rl-modo" role="radio" aria-checked="false" data-rl-modo="pers"><b>⚙ Personalizado</b><small>Tú eliges cada opción</small></button>
          </div>
          <p class="rl-quedan">Te quedan <b>${quedan}</b> ediciones este mes${lib ? ' · el resultado queda como un video nuevo en Mis videos' : ''}.</p>
          <div class="dz-grupo rl-pers"><b>Duración máxima</b><div class="dz-chips">${[['15', '15 s'], ['30', '30 s'], ['60', '60 s'], ['0', 'Completo']].map(([v, t]) => `<button type="button" class="rc-tipo${v === '30' ? ' activo' : ''}" data-rl-dur="${v}">${t}</button>`).join('')}</div></div>
          <label class="rl-check rl-pers"><input type="checkbox" data-rl="cortarSilencios" checked> Cortar silencios y partes muertas <small data-rl-sil-estado>Buscando silencios…</small></label>
          <div class="rl-rango rl-pers"><label>Empieza en <b data-rl-ini-v>0,0 s</b><input type="range" data-rl-ini min="0" step="0.1" value="0"></label><label>Termina en <b data-rl-fin-v>—</b><input type="range" data-rl-fin min="0" step="0.1" value="0"></label></div>
          <div class="dz-grupo rl-no-subs"><b>Textos en pantalla</b>
            <label class="rl-check rl-pers"><input type="checkbox" data-rl="gancho" checked> Gancho en los primeros 2 s</label>
            <input data-rl-texto="gancho" maxlength="120" value="${esc(ganchoInicial)}" placeholder="Gancho de los primeros 2 s (opcional)" aria-label="Gancho">
            <label class="rl-check rl-pers"><input type="checkbox" data-rl="cta" checked> Llamado a la acción al final</label>
            <input data-rl-texto="cta" maxlength="50" value="${esc(kit.cta || 'Escríbenos por WhatsApp')}" placeholder="Llamado a la acción" aria-label="Llamado a la acción">
            <label class="rl-check rl-pers"><input type="checkbox" data-rl="logo" checked> Logo</label>
          </div>
          <div class="dz-grupo"><b>Subtítulos</b>
            <select data-rl-subs>${auto ? '<option value="auto">Automáticos (se transcribe tu voz)</option>' : ''}<option value="manual">Los escribo yo</option><option value="no">Sin subtítulos</option></select>
            <textarea data-rl-guion rows="3" placeholder="Lo que dices en el video, una frase por línea" ${auto ? 'hidden' : ''}></textarea>
          </div>
          <div class="dz-grupo rl-pers"><b>Audio y efectos</b>
            <label class="rl-check"><input type="checkbox" data-rl="silenciar"> Silenciar el audio</label>
            <label class="rl-check"><input type="checkbox" data-rl="zoom" checked> Zoom suave</label>
            <div class="rl-selects">
              <label>Velocidad<select data-rl-vel><option value="1">Normal</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option></select></label>
              <label>Color<select data-rl-color><option value="original">Original</option><option value="calido">Cálido</option><option value="contraste">Contraste</option><option value="bn">Blanco y negro</option></select></label>
            </div>
          </div>
          <p class="sub">Música: próximamente. ${lib ? 'Tu video original no cambia.' : item.videoOriginal ? 'Se edita a partir de tu video original.' : 'Tu video original se guarda.'}</p>
        </div>
      </div>
      <p class="config-error" data-rl-error hidden></p>
      <div class="dlg-acciones"><button type="button" class="btn-ghost" data-rl-cerrar>Cancelar</button><button type="button" class="btn-approve" data-rl-crear>${lib ? 'Crear video editado' : 'Crear reel editado'}</button></div>
    </div>`;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');

    const $ = (s) => dlg.querySelector(s);
    const vid = $('[data-rl-video]');
    const est = { dur: 30, ini: 0, fin: 0, total: 0, silencios: [], jugando: false };
    let logoImg = null;
    if (D.urlLogo(n)) logoImg = await D.cargarImagen(D.urlLogo(n)).catch(() => null);
    D.cargarFuentes(kit.fuente);
    const logoEl = $('[data-rl-logo]');
    logoEl.classList.add('pos-' + kit.posLogo);
    if (logoImg) logoEl.innerHTML = `<img src="${esc(logoImg.src)}" alt="">`;
    else logoEl.innerHTML = `<b style="background:${esc(kit.color)}; color:${D.tintaSobre(kit.color)}">${esc(D.iniciales(n.nombre))}</b>`;
    $('[data-rl-gancho]').style.fontFamily = `'${kit.fuente}', 'Plus Jakarta Sans', sans-serif`;
    $('[data-rl-sub]').style.fontFamily = `'${kit.fuente}', 'Plus Jakarta Sans', sans-serif`;

    const op = (k) => { const el = dlg.querySelector(`[data-rl="${k}"]`); return el ? el.checked : false; };
    function segmentos() {
      let segs = [[est.ini, est.fin]];
      if (op('cortarSilencios')) {
        est.silencios.forEach(([a0, b0]) => {
          const a = a0 + 0.15, b = b0 - 0.15;
          if (b <= a) return;
          segs = segs.flatMap(([s, e]) => (b <= s || a >= e ? [[s, e]] : [].concat(a > s ? [[s, a]] : [], b < e ? [[b, e]] : [])));
        });
      }
      segs = segs.filter(([s, e]) => e - s >= 0.3);
      const vel = Number($('[data-rl-vel]').value);
      const max = (est.dur || 90) * vel;
      const out = []; let acc = 0;
      for (const [s, e] of segs) { if (acc >= max) break; const l = Math.min(e - s, max - acc); out.push([s, s + l]); acc += l; }
      return out;
    }
    const durFinal = () => segmentos().reduce((t, [s, e]) => t + (e - s), 0) / Number($('[data-rl-vel]').value);
    function tiempoFinal(t) {
      let acc = 0;
      for (const [s, e] of segmentos()) { if (t >= e) acc += e - s; else if (t >= s) return (acc + (t - s)) / Number($('[data-rl-vel]').value); else break; }
      return acc / Number($('[data-rl-vel]').value);
    }
    function pintarBarra() {
      const b = $('[data-rl-barra]');
      if (!est.total) return;
      const pct = (x) => (x / est.total * 100) + '%';
      const add = (cls, a, e) => `<i class="${cls}" style="left:${pct(a)}; width:${pct(Math.max(0, e - a))}"></i>`;
      let html = add('fuera', 0, est.ini) + add('fuera', est.fin, est.total);
      if (op('cortarSilencios')) est.silencios.forEach(([a, e]) => { html += add('sil', Math.max(a, est.ini), Math.min(e, est.fin)); });
      const segs = segmentos();
      const ultimo = segs.length ? segs[segs.length - 1][1] : est.fin;
      if (ultimo < est.fin) html += add('fuera', ultimo, est.fin);
      b.innerHTML = html + '<span class="cabeza" data-rl-cabeza></span>';
      $('[data-rl-total]').textContent = 'Reel final: ' + fmtS(durFinal());
    }
    function capas() {
      const tf = tiempoFinal(vid.currentTime), total = durFinal();
      $('[data-rl-gancho]').classList.toggle('oculto', !(op('gancho') && tf < 2.2 && $('[data-rl-texto="gancho"]').value.trim()));
      $('[data-rl-cta]').classList.toggle('oculto', !(op('cta') && tf > total - 3));
      logoEl.classList.toggle('oculto', !op('logo'));
      const modo = $('[data-rl-subs]').value, sub = $('[data-rl-sub]');
      const frases = modo === 'manual' ? $('[data-rl-guion]').value.split('\n').map((l) => l.trim()).filter(Boolean) : [];
      if (modo === 'auto') sub.innerHTML = '<span class="rl-sub-nota">Los subtítulos se transcriben al crear el reel</span>';
      else if (frases.length && total > 0) {
        const tramo = total / frases.length, i = Math.min(frases.length - 1, Math.floor(tf / tramo));
        const ps = frases[i].split(/\s+/), activa = Math.min(ps.length - 1, Math.floor(((tf % tramo) / tramo) * ps.length));
        sub.innerHTML = ps.map((p, k) => (k === activa ? `<em>${esc(p)}</em>` : esc(p))).join(' ');
      } else sub.innerHTML = '';
      vid.style.filter = FILTROS[$('[data-rl-color]').value] || 'none';
      vid.style.transform = op('zoom') ? `scale(${1 + 0.08 * Math.min(1, tf / 10)})` : 'none';
      vid.muted = op('silenciar');
      const cab = $('[data-rl-cabeza]'); if (cab) cab.style.left = (vid.currentTime / est.total * 100) + '%';
      $('[data-rl-t]').textContent = fmtS(tf);
    }
    function bucle() {
      if (!est.jugando || !dlg.open) return;
      vid.playbackRate = Number($('[data-rl-vel]').value);
      const segs = segmentos();
      const t = vid.currentTime;
      if (!segs.some(([s, e]) => t >= s && t < e)) {
        const sig = segs.find(([s]) => s > t);
        vid.currentTime = sig ? sig[0] : (segs[0] ? segs[0][0] : est.ini);
      }
      capas();
      requestAnimationFrame(bucle);
    }
    function pausar() { est.jugando = false; vid.pause(); $('[data-rl-play]').textContent = 'Reproducir'; }

    function alCargar() {
      if (est.total || !vid.duration || !Number.isFinite(vid.duration)) return;
      est.total = vid.duration; est.fin = est.total;
      ['[data-rl-ini]', '[data-rl-fin]'].forEach((s) => { $(s).max = est.total; });
      $('[data-rl-fin]').value = est.total; $('[data-rl-fin-v]').textContent = fmtS(est.total);
      pintarBarra(); capas();
    }
    vid.addEventListener('loadedmetadata', alCargar);
    vid.addEventListener('error', () => { $('[data-rl-fin-v]').textContent = 'todo el video'; $('[data-rl-total]').textContent = 'Vista previa no disponible en este navegador'; });
    if (vid.readyState >= 1) alCargar(); // ya cargó mientras se preparaba el logo
    detectarSilencios(src).then((s) => {
      est.silencios = s;
      $('[data-rl-sil-estado]').textContent = s.length ? `${s.length} silencio${s.length === 1 ? '' : 's'} encontrado${s.length === 1 ? '' : 's'}` : 'Sin silencios largos';
      pintarBarra(); capas();
    }).catch(() => { $('[data-rl-sil-estado]').textContent = 'Se detectan al crear el reel'; });

    dlg.oninput = (e) => {
      if (e.target.matches('[data-rl-ini], [data-rl-fin]')) {
        let a = Number($('[data-rl-ini]').value), b = Number($('[data-rl-fin]').value);
        if (b - a < 1) { if (e.target.matches('[data-rl-ini]')) a = b - 1; else b = a + 1; }
        est.ini = Math.max(0, a); est.fin = Math.min(est.total, b);
        $('[data-rl-ini]').value = est.ini; $('[data-rl-fin]').value = est.fin;
        $('[data-rl-ini-v]').textContent = fmtS(est.ini); $('[data-rl-fin-v]').textContent = fmtS(est.fin);
      }
      if (e.target.matches('[data-rl-texto="gancho"]')) $('[data-rl-gancho] span').textContent = e.target.value;
      if (e.target.matches('[data-rl-texto="cta"]')) $('[data-rl-cta]').textContent = e.target.value;
      pintarBarra(); capas();
    };
    dlg.onchange = (e) => {
      if (e.target.matches('[data-rl-subs]')) $('[data-rl-guion]').hidden = e.target.value !== 'manual';
      pintarBarra(); capas();
    };
    // Los modos: Automático y Solo subtítulos fijan las opciones; Personalizado las muestra todas.
    const caja = $('.dlg-caja');
    function aplicarModo(m) {
      caja.classList.remove('modo-auto', 'modo-subs', 'modo-pers');
      caja.classList.add('modo-' + m);
      dlg.querySelectorAll('[data-rl-modo]').forEach((b) => { const on = b.dataset.rlModo === m; b.classList.toggle('activo', on); b.setAttribute('aria-checked', String(on)); });
      if (m === 'pers') return;
      const auto = m === 'auto';
      const marcar = (k, v) => { const el = dlg.querySelector(`[data-rl="${k}"]`); if (el) el.checked = v; };
      ['cortarSilencios', 'gancho', 'cta', 'logo', 'zoom'].forEach((k) => marcar(k, auto));
      marcar('silenciar', false);
      const subs = $('[data-rl-subs]');
      subs.value = subs.querySelector('option[value="auto"]') ? 'auto' : 'manual';
      $('[data-rl-guion]').hidden = subs.value !== 'manual';
      $('[data-rl-vel]').value = '1';
      $('[data-rl-color]').value = 'original';
      est.dur = auto ? 30 : 0;
      dlg.querySelectorAll('[data-rl-dur]').forEach((b) => b.classList.toggle('activo', Number(b.dataset.rlDur) === est.dur));
      if (est.total) {
        est.ini = 0; est.fin = est.total;
        $('[data-rl-ini]').value = 0; $('[data-rl-fin]').value = est.total;
        $('[data-rl-ini-v]').textContent = fmtS(0); $('[data-rl-fin-v]').textContent = fmtS(est.total);
      }
      pintarBarra(); capas();
    }
    aplicarModo('auto');

    dlg.addEventListener('close', () => { est.jugando = false; vid.pause(); }, { once: true });
    dlg.onclick = async (e) => {
      const modo = e.target.closest('[data-rl-modo]');
      if (modo) return aplicarModo(modo.dataset.rlModo);
      const d = e.target.closest('[data-rl-dur]');
      if (d) { est.dur = Number(d.dataset.rlDur); dlg.querySelectorAll('[data-rl-dur]').forEach((b) => b.classList.toggle('activo', b === d)); pintarBarra(); return capas(); }
      if (e.target.closest('[data-rl-play]')) {
        if (est.jugando) return pausar();
        est.jugando = true; e.target.closest('[data-rl-play]').textContent = 'Pausar';
        vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
        return requestAnimationFrame(bucle);
      }
      if (e.target.closest('[data-rl-inicio]')) { const s = segmentos(); vid.currentTime = s.length ? s[0][0] : est.ini; return capas(); }
      if (e.target.closest('[data-rl-cerrar]')) return dlg.close();
      const crear = e.target.closest('[data-rl-crear]');
      if (!crear) return;
      pausar();
      const errorEl = $('[data-rl-error]');
      errorEl.hidden = true;
      // Si la vista previa no pudo leer el video, el servidor decide con el video completo.
      if (est.total && !segmentos().length) { errorEl.textContent = 'Con este recorte no queda video. Amplía el inicio o el final.'; errorEl.hidden = false; return; }
      crear.disabled = true; crear.textContent = 'Enviando…';
      await D.cargarFuentes(kit.fuente);
      const capasPng = {};
      const texto = (k) => $(`[data-rl-texto="${k}"]`).value.trim();
      if (op('gancho') && texto('gancho')) capasPng.gancho = capaGancho(texto('gancho'), kit);
      if (op('cta') && texto('cta')) capasPng.cta = capaCta(texto('cta'), kit);
      if (op('logo')) capasPng.logo = capaLogo(logoImg, kit, n.nombre);
      const opciones = {
        duracion: est.dur, cortarSilencios: op('cortarSilencios'), ini: est.ini, fin: !est.total || est.fin >= est.total - 0.05 ? null : est.fin,
        subtitulos: $('[data-rl-subs]').value, guion: $('[data-rl-guion]').value, silenciar: op('silenciar'),
        velocidad: Number($('[data-rl-vel]').value), color: $('[data-rl-color]').value, zoom: op('zoom'), colorMarca: kit.color,
      };
      try {
        const ruta = lib ? `/api/negocios/${n.id}/videos/${lib.id}/editar` : `/api/negocios/${n.id}/contenido/${item.id}/editar-reel`;
        await ctx.api(ruta, { method: 'POST', body: JSON.stringify({ opciones, capas: capasPng }) });
        dlg.close();
        await ctx.recargar();
        if (op0.alEnviar) await op0.alEnviar();
      } catch (err) {
        errorEl.textContent = err.mensaje || 'No se pudo enviar el reel a edición.';
        errorEl.hidden = false;
        crear.disabled = false; crear.textContent = lib ? 'Crear video editado' : 'Crear reel editado';
      }
    };
  }

  window.RubrofyReels = { iniciar, abrir };
})();
