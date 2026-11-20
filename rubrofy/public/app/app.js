(function () {
  'use strict';

  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  let negocioActual = null;
  let nichoActual = null; // estrategia de contenido del negocio actual (enfoques, categoriasFoto)
  let contenido = [];
  let fotos = {}; // { categoria: [nombresDeArchivo] }
  let planesInfo = []; // catálogo de planes (ver /api/planes) — precios y disponibilidad
  let codigoDescuento = null; // código revisado y todavía no usado: { codigo, descripcion, planes, precios }
  let vistaActual = 'inicio';
  const editingIds = new Set();
  const fechaEditIds = new Set(); // piezas con el selector de fecha abierto
  const pedirCambioIds = new Set(); // piezas con el campo "Pedir cambio" abierto
  let filtroCola = null; // 'pendientes' | 'programadas' | 'publicadas' | 'descartadas' (null: según lo que haya)
  let accionPieza = null; // acciones de una publicación (se define en init)

  const $ = (sel) => document.querySelector(sel);
  const AY = (k) => (window.Ayuda ? window.Ayuda.boton(k) : '');

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign(
      { 'content-type': 'application/json', 'x-rubrofy-panel': '1' },
      opts.headers
    );
    let res;
    try {
      res = await fetch(path, Object.assign({}, opts, { headers }));
    } catch (e) {
      if (window.RubrofySoporte) window.RubrofySoporte.registrar({ que: `${opts.method || 'GET'} ${path}`, mensaje: 'Sin conexión: ' + e.message });
      const err = new Error('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.');
      err.mensaje = err.message;
      throw err;
    }
    if (!res.ok) {
      // El servidor explica el motivo en { error } (cuota agotada, demasiados
      // intentos, etc.); se guarda aparte para mostrárselo al usuario.
      let mensaje = null;
      let campo = null;
      let recargar = null;
      try {
        const data = await res.json();
        mensaje = data && typeof data.error === 'string' ? data.error : null;
        campo = data && data.campo;
        recargar = data && data.recargar;
      } catch (e) { /* respuesta sin JSON */ }
      const err = new Error(mensaje || ('Error de API (' + res.status + ') en ' + path));
      err.status = res.status;
      err.mensaje = mensaje;
      err.campo = campo;
      err.recargar = recargar;
      // Queda registrado por si el cliente reporta un problema (Ayuda y soporte).
      if (window.RubrofySoporte && negocioActual) window.RubrofySoporte.registrar({ que: `${opts.method || 'GET'} ${path}`, estado: res.status, mensaje });
      // La sesión se cerró (cambio de clave o "cerrar en todos lados" desde
      // otro dispositivo): de vuelta a la pantalla para entrar.
      if (res.status === 401 && negocioActual && !/^\/api\/auth\//.test(path)) mostrarLogin('Tu sesión se cerró. Vuelve a entrar.');
      // Se acabó un cupo (piezas, fotos, videos o reels): se ofrece cargar más.
      if (res.status === 403 && recargar && window.RubrofyRecargas) window.RubrofyRecargas.abrir(recargar);
      throw err;
    }
    return res.json();
  }

  function statusMeta(status) {
    if (status === 'aprobado') return { color: 'var(--green)', label: 'Aprobado' };
    if (status === 'rechazado') return { color: 'var(--coral)', label: 'Rechazado' };
    return { color: 'var(--amber)', label: 'Pendiente' };
  }

  // Fecha/hora en la zona del negocio (la misma que usa el servidor para
  // publicar), no la del navegador.
  function partesEnZona(iso) {
    const formato = new Intl.DateTimeFormat('en-US', {
      timeZone: (negocioActual && negocioActual.zonaHoraria) || 'America/Santiago', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    const p = {};
    formato.formatToParts(new Date(iso)).forEach(({ type, value }) => { p[type] = value; });
    return p;
  }

  function fechaCorta(iso) {
    const p = partesEnZona(iso);
    return `${p.day} ${MESES[Number(p.month) - 1]} ${p.hour}:${p.minute}`;
  }

  function horaCorta(iso) {
    const p = partesEnZona(iso);
    return `${p.hour}:${p.minute}`;
  }

  // Valor para <input type="datetime-local">: "2026-09-28T09:00".
  function valorInputFecha(iso) {
    const p = partesEnZona(iso);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  }

  // Qué mostrar en la tarjeta ya decidida: si quedó programada, se está
  // publicando, se publicó, o por qué no se pudo publicar.
  function notaAprobacion(item) {
    if (item.status !== 'aprobado') return { color: 'var(--coral)', texto: 'No se publicará' };
    const dateShort = item.date.split(' - ').slice(0, 2).join(' - ');
    const pub = item.publicacion;
    const ig = item.instagram;
    if ((pub && pub.estado === 'publicada') || (ig && ig.ok)) {
      const conFoto = (pub && pub.generadaPorIA) || (ig && ig.generadaPorIA) ? ' (foto generada por IA)' : '';
      const cuando = (pub && pub.publicadoEl) || (ig && ig.publicadoEl);
      return { color: 'var(--green)', texto: 'Publicado en Instagram' + conFoto + (cuando ? ' &middot; ' + escapeHtml(fechaCorta(cuando)) : '') };
    }
    if (!pub) {
      const sinIG = negocioActual.instagramConectado ? '' : ' (Instagram no conectado)';
      return { color: 'var(--ink-faint)', texto: 'Aprobado &middot; ' + escapeHtml(dateShort) + sinIG };
    }
    if (pub.estado === 'publicando') return { color: 'var(--amber)', texto: 'Publicando en Instagram&hellip;' };
    if (pub.estado === 'programada' && pub.procesando) return { color: 'var(--amber)', texto: 'Instagram está procesando el video&hellip;' };
    if (pub.estado === 'fallida') return { color: 'var(--coral)', texto: 'No se publicó: ' + escapeHtml(pub.motivo || 'error desconocido') };
    if (negocioActual.instagramEstado === 'reconectar') {
      return { color: 'var(--coral)', texto: 'En espera: reconecta Instagram en Más → Cuentas conectadas' };
    }
    if (pub.intentos) {
      return { color: 'var(--amber)', texto: `Reintento ${pub.intentos} a las ${escapeHtml(horaCorta(pub.proximoIntento))} &middot; ${escapeHtml(pub.ultimoError || '')}` };
    }
    return { color: 'var(--ink-faint)', texto: 'Programada &middot; ' + escapeHtml(fechaCorta(item.publicarEl || pub.proximoIntento)) };
  }

  // ---------- render: stats ----------
  function renderStats() {
    if (window.RubrofyCreditos) window.RubrofyCreditos.pintarChip();
  }

  // ---------- render: cola ----------
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  // Reparte las piezas entre las fotos disponibles de su categoría en vez de
  // repetir siempre la primera (candado anti-repetición simple).
  function pickFotoFilename(categoria, itemId) {
    const arr = fotos[categoria];
    if (!arr || !arr.length) return null;
    return arr[hashString(itemId) % arr.length];
  }

  const FORMATOS = { post: 'Post', carrusel: 'Carrusel', reel: 'Reel', historia: 'Historia' };

  function formatoDe(item) {
    if (item.formato && FORMATOS[item.formato]) return item.formato;
    return item.aspect && item.aspect.trim().startsWith('9') ? 'historia' : 'post';
  }

  // Imagen o video (igual que el servidor): un Reel es video; una historia, lo
  // que el dueño elija; post y carrusel, imagen.
  function medioDe(item) {
    const f = formatoDe(item);
    if (f === 'reel') return 'video';
    if (f !== 'historia') return 'imagen';
    if (item.medio === 'imagen' || item.medio === 'video') return item.medio;
    return item.video ? 'video' : 'imagen';
  }

  async function subirVideo(id, file) {
    const res = await fetch(`/api/negocios/${negocioActual.id}/contenido/${id}/video`, {
      method: 'POST',
      headers: { 'content-type': file.type || 'video/mp4', 'x-rubrofy-panel': '1', 'x-nombre': encodeURIComponent(file.name || 'Video') },
      body: file,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'No se pudo subir el video');
    }
  }

  // La foto de la Galería de la pieza: la que el negocio eligió o una de su categoría.
  function fotoGaleriaDe(item) {
    const fe = item.fotoElegida && (fotos[item.fotoElegida.categoria] || []).includes(item.fotoElegida.archivo) ? item.fotoElegida : null;
    const categoria = fe ? fe.categoria : item.categoriaFoto;
    const archivo = fe ? fe.archivo : (item.categoriaFoto ? pickFotoFilename(item.categoriaFoto, item.id) : null);
    return archivo ? { categoria, archivo } : null;
  }

  const urlFoto = (f) => `/fotos/${negocioActual.id}/${encodeURIComponent(f.categoria)}/${encodeURIComponent(f.archivo)}`;

  // Las fotos de un carrusel, en orden: las que eligió el negocio o, si no
  // eligió, las de la categoría de la pieza (igual que el servidor al publicar).
  const MAX_FOTOS_CARRUSEL = 10;
  function fotosCarruselDe(item) {
    const elegidas = (item.fotosCarrusel || []).filter((f) => (fotos[f.categoria] || []).includes(f.archivo));
    if (elegidas.length >= 2) return elegidas.slice(0, MAX_FOTOS_CARRUSEL);
    const disponibles = fotos[item.categoriaFoto] || [];
    if (disponibles.length < 2) return [];
    const inicio = hashString(item.id) % disponibles.length;
    return disponibles.slice(inicio).concat(disponibles.slice(0, inicio)).slice(0, MAX_FOTOS_CARRUSEL)
      .map((archivo) => ({ categoria: item.categoriaFoto, archivo }));
  }

  // La foto de la pieza: de la Galería o, si no hay, la creada con IA.
  function fotoDe(item) {
    if (formatoDe(item) === 'carrusel') {
      const c = fotosCarruselDe(item);
      if (c.length) return urlFoto(c[0]);
    }
    const g = fotoGaleriaDe(item);
    if (g) return `/fotos/${negocioActual.id}/${encodeURIComponent(g.categoria)}/${encodeURIComponent(g.archivo)}`;
    return item.imagenIA ? `/fotos/${negocioActual.id}/_ia/${item.id}.png${item.imagenIAVersion ? '?v=' + item.imagenIAVersion : ''}` : null;
  }

  // La imagen diseñada con el kit de marca, si la tiene.
  function disenoDe(item) {
    return item.diseno ? `/fotos/${negocioActual.id}/_marca/${encodeURIComponent(item.diseno.archivo)}` : null;
  }

  // De dónde salió lo que se va a publicar: la IA, la plantilla de Rubrofy o el dueño.
  function origenTextoHTML(item) {
    const texto = item.editado ? 'escrito por ti' : item.generadoConIA ? 'de la IA' : 'de Rubrofy';
    const tags = item.hashtags && item.hashtags.length ? (item.hashtagsEditados ? 'tuyos' : item.generadoConIA ? 'de la IA' : 'de Rubrofy') : null;
    return `<p class="card-origen${item.editado || item.hashtagsEditados ? ' tuyo' : ''}"><span>Texto: <b>${texto}</b></span>${tags ? `<span>Hashtags: <b>${tags}</b></span>` : ''}</p>`;
  }

  // "Jueves 26 · 19:30" (o "Hoy", "Mañana"), en la zona del negocio.
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  function fechaAmigable(iso) {
    const p = partesEnZona(iso);
    const hoy = partesEnZona(new Date().toISOString());
    const dia = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
    const dif = Math.round((dia - Date.UTC(Number(hoy.year), Number(hoy.month) - 1, Number(hoy.day))) / 86400000);
    const nombre = dif === 0 ? 'Hoy' : dif === 1 ? 'Mañana'
      : `${DIAS[new Date(dia).getUTCDay()]} ${Number(p.day)}${p.month !== hoy.month ? ' ' + MESES[Number(p.month) - 1].toLowerCase() : ''}`;
    return `${nombre} · ${p.hour}:${p.minute}`;
  }
  const cuandoDe = (item) => (item.publicarEl ? fechaAmigable(item.publicarEl) : String(item.date || '').split(' - ').slice(0, 2).join(' · '));

  // Lo que pasa con el video de la pieza mientras se crea o se edita.
  function estadoVideoHTML(item) {
    const partes = [];
    const ed = item.edicion || {};
    const vi = item.videoIA || {};
    if (vi.estado === 'generando') partes.push('<span class="pz-aviso">Creando el video con IA… suele tardar 1 a 3 minutos</span>');
    if (ed.estado === 'editando') partes.push('<span class="pz-aviso">Editando tu reel… suele tardar 1 o 2 minutos</span>');
    if (vi.estado === 'error') partes.push(`<span class="pz-aviso mal">El video con IA falló: ${escapeHtml(vi.error || '')}</span>`);
    if (ed.estado === 'error') partes.push(`<span class="pz-aviso mal">La edición falló: ${escapeHtml(ed.error || '')}</span>`);
    return partes.join('');
  }

  const abiertasIds = new Set(); // piezas con el texto completo y sus detalles a la vista
  const RED_IG = '<span class="pz-red ig" title="Instagram">IG</span>';

  function cardHTML(item) {
    const caption = item.variants[item.variantIndex];
    const isPending = item.status === 'pendiente';
    const isEditing = editingIds.has(item.id);
    const pub = item.publicacion;
    const publicada = estaPublicada(item);
    const publicando = !!(pub && pub.estado === 'publicando');
    const puedeCambiarFecha = !publicada && !publicando && item.status !== 'rechazado';
    const formato = formatoDe(item);
    const medio = medioDe(item);
    const vertical = formato === 'reel' || formato === 'historia';
    const inicial = escapeHtml((negocioActual.nombre || '?').charAt(0).toUpperCase());
    const fotoUrl = fotoDe(item);
    const disenoUrl = disenoDe(item);
    const carrusel = formato === 'carrusel' ? fotosCarruselDe(item) : [];
    const uniendoClips = !!(item.union && item.union.estado === 'uniendo');
    const creandoVideo = !!(item.videoIA && item.videoIA.estado === 'generando');
    const faltaVideo = !publicada && medio === 'video' && !item.video && !creandoVideo && !uniendoClips;
    const faltanFotos = !publicada && formato === 'carrusel' && carrusel.length < 2;
    const faltaFoto = !publicada && formato !== 'carrusel' && !disenoUrl && !fotoUrl && medio === 'imagen';
    const conIAVideo = (negocioActual.mediosIA || {}).video && !negocioActual.sinPlan;
    const nota = isPending ? null : notaAprobacion(item);
    const fallida = !!(pub && pub.estado === 'fallida');

    let medioHTML;
    if (uniendoClips) {
      medioHTML = `<div class="card-vacia"><div class="card-vacia-ic">⧉</div><b>Uniendo ${item.union.clips || ''} clips…</b><p>Suele tardar menos de un minuto.</p></div>`;
    } else if (creandoVideo) {
      medioHTML = '<div class="card-vacia"><div class="card-vacia-ic">✨</div><b>Creando el video con IA…</b><p>Suele tardar 1 a 3 minutos. Puedes seguir con lo demás.</p></div>';
    } else if (faltaVideo) {
      medioHTML = `<div class="card-vacia"><div class="card-vacia-ic">🎬</div><b>Falta el video de ${formato === 'historia' ? 'esta historia' : 'este reel'}</b><div class="card-vacia-acc"><button class="btn-approve card-vacia-btn" data-action="elegir-video" data-id="${item.id}">Elegir video</button>${conIAVideo ? `<button class="btn-ia card-vacia-btn" data-action="video-ia" data-id="${item.id}">✨ Crear con IA</button>` : ''}</div></div>`;
    } else if (medio === 'video' && item.video) {
      medioHTML = `<video class="pz-video" src="/videos/${negocioActual.id}/${escapeHtml(item.video.archivo)}#t=0.1" preload="metadata" muted playsinline></video><button type="button" class="pz-play" data-action="play" data-id="${item.id}" aria-label="Reproducir el video">▶</button>`;
    } else if (faltanFotos) {
      medioHTML = `<div class="card-vacia"><div class="card-vacia-ic">▦</div><b>Elige las fotos del carrusel</b><p>De 2 a 10 fotos, en el orden que quieras.</p><div class="card-vacia-acc"><button class="btn-approve card-vacia-btn" data-action="elegir-foto" data-id="${item.id}">Elegir fotos</button></div></div>`;
    } else if (carrusel.length) {
      const urls = carrusel.map(urlFoto);
      if (disenoUrl) urls[0] = disenoUrl;
      medioHTML = `<img class="pz-img" src="${escapeHtml(urls[0])}" alt="" loading="lazy" data-carrusel='${escapeHtml(JSON.stringify(urls))}' data-i="0">
        <button type="button" class="pz-paso ant" data-action="carrusel-paso" data-paso="-1" data-id="${item.id}" aria-label="Foto anterior">‹</button>
        <button type="button" class="pz-paso sig" data-action="carrusel-paso" data-paso="1" data-id="${item.id}" aria-label="Foto siguiente">›</button>
        <span class="pz-puntos" aria-hidden="true">${urls.map((u, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</span>`;
    } else if (disenoUrl || fotoUrl) {
      medioHTML = `<img class="pz-img" src="${escapeHtml(disenoUrl || fotoUrl)}" alt="" loading="lazy">`;
    } else if (faltaFoto) {
      medioHTML = `<div class="card-vacia"><div class="card-vacia-ic">🖼</div><b>Falta la foto</b><div class="card-vacia-acc"><button class="btn-approve card-vacia-btn" data-action="elegir-foto" data-pest="galeria" data-id="${item.id}">Elegir de mi galería</button><button class="btn-ia card-vacia-btn" data-action="elegir-foto" data-pest="ia" data-id="${item.id}">✨ Crear con IA</button><label class="btn-ghost card-vacia-btn">Subir foto<input type="file" accept="image/*" data-foto-item="${item.id}" hidden></label></div></div>`;
    } else {
      medioHTML = `<div class="card-texture"></div><div class="card-logo">${inicial}</div><div class="card-headline">${escapeHtml(item.headline)}</div>`;
    }

    const chip = `${FORMATOS[formato]}${carrusel.length >= 2 ? ` · <span data-carrusel-n>1</span>/${carrusel.length}` : ''}`;
    const arriba = fechaEditIds.has(item.id)
      ? `<input type="datetime-local" class="card-date-input" data-fecha-id="${item.id}" value="${item.publicarEl ? valorInputFecha(item.publicarEl) : ''}">`
      : isPending
        ? `<button type="button" class="pz-cuando" data-action="fecha" data-id="${item.id}" title="Cambiar fecha y hora">${escapeHtml(cuandoDe(item))}</button>`
        : `<span class="pz-estado" style="color:${nota.color}">${nota.texto}</span>`;

    return `
      <article class="pz${vertical ? ' vertical' : ''}${abiertasIds.has(item.id) ? ' abierta' : ''}${isEditing ? ' editando' : ''}" id="card-${item.id}">
        <div class="pz-media"${fotoUrl || disenoUrl || carrusel.length ? '' : ` style="background:linear-gradient(160deg, ${item.hueFrom}, ${item.hueTo})"`}>
          ${medioHTML}
          <span class="pz-chip">${chip}</span>
          <span class="pz-redes">${RED_IG}</span>
        </div>
        <div class="pz-body">
          <div class="pz-linea">${arriba}${isPending ? '' : `<button type="button" class="pz-mas" data-action="mas" data-id="${item.id}" aria-label="Más opciones">⋯</button>`}</div>
          ${estadoVideoHTML(item)}
          ${isEditing
            ? `<textarea class="card-textarea" data-id="${item.id}">${escapeHtml(caption)}</textarea>
               <label class="card-hashtags-edit">Hashtags<input data-hashtags-id="${item.id}" value="${escapeHtml((item.hashtags || []).join(' '))}" placeholder="#tunegocio #tuciudad"></label>`
            : `<p class="pz-texto" data-action="expandir" data-id="${item.id}" title="Toca para ver todo">${escapeHtml(caption)}</p>
               <div class="pz-extra">
                 ${item.hashtags && item.hashtags.length ? `<div class="card-hashtags">${item.hashtags.map((h) => `<span>${escapeHtml(h)}</span>`).join('')}</div>` : ''}
                 ${item.idea && !publicada ? `<p class="card-idea"><b>Idea:</b> ${escapeHtml(item.idea)}</p>` : ''}
                 ${!publicada && item.voz ? `<div class="card-voz">${window.RubrofyVoz.insignia(item.voz)}<span>${escapeHtml((item.voz.notas.find((n) => n.tipo === 'mal') || item.voz.notas[0] || { texto: 'Calza con tu voz de marca' }).texto)}</span></div>` : ''}
                 ${item.prueba ? '<p class="card-prueba"><b>Reel de prueba</b> · se muestra primero a quienes no te siguen</p>' : ''}
                 ${origenTextoHTML(item)}
               </div>`}
          ${isPending && pedirCambioIds.has(item.id) ? `<form class="card-pedir" data-pedir-id="${item.id}"><input name="indicacion" maxlength="500" placeholder="Ej: más corto, menciona el despacho gratis" required><button class="btn-approve">Pedir</button><button type="button" class="btn-text" data-action="cancelar-pedir" data-id="${item.id}">Cancelar</button></form>` : ''}
          ${!publicada && !isEditing && item.alertas && item.alertas.length ? `<ul class="card-alertas" aria-label="Qué verificar">${item.alertas.map((a) => `<li class="alerta-${escapeHtml(a.tipo)}"><span aria-hidden="true">⚠</span> ${escapeHtml(a.texto)}</li>`).join('')}</ul>` : ''}
          ${isEditing ? `
            <div class="pz-acc">
              <button class="btn-approve" data-action="toggle-edit" data-id="${item.id}">Guardar</button>
              <button class="btn-ghost" data-action="cancelar-edit" data-id="${item.id}">Cancelar</button>
            </div>` : isPending ? `
            <div class="pz-acc">
              <button class="btn-approve" data-action="approve" data-id="${item.id}">Aprobar</button>
              <button class="pz-ic" data-action="toggle-edit" data-id="${item.id}" aria-label="Editar el texto" title="Editar el texto"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 L5 15 L15 5 L19 9 L9 19 Z"/><path d="M13 7 L17 11"/></svg></button>
              <button class="pz-ic" data-action="mas" data-id="${item.id}" aria-label="Más opciones" title="Más opciones">⋯</button>
            </div>` : fallida ? `
            <div class="pz-acc"><button class="btn-approve" data-action="retry" data-id="${item.id}">Reintentar</button></div>` : ''}
        </div>
      </article>
    `;
  }

  // Al editar: el cuadro de texto crece con lo escrito y queda arriba, a la
  // vista (en el teléfono la foto se pliega para dejarle el espacio).
  function ajustarAlto(t) {
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight + 4, Math.round(window.innerHeight * 0.7)) + 'px';
  }
  function enfocarEdicion(id) {
    const t = document.querySelector(`textarea[data-id="${id}"]`);
    if (!t) return;
    ajustarAlto(t);
    t.addEventListener('input', () => ajustarAlto(t));
    const tarjeta = t.closest('.pz');
    if (tarjeta) tarjeta.scrollIntoView({ block: 'start' });
    t.focus({ preventScroll: true });
    t.setSelectionRange(t.value.length, t.value.length);
  }

  // Todo lo que no es "Aprobar" ni "Editar" vive en el menú "⋯" de la pieza.
  function opcionesPieza(item) {
    const isPending = item.status === 'pendiente';
    const pub = item.publicacion;
    const publicada = estaPublicada(item);
    const publicando = !!(pub && pub.estado === 'publicando');
    const puedeCambiar = !publicada && !publicando && item.status !== 'rechazado';
    const formato = formatoDe(item);
    const medio = medioDe(item);
    const mediosIA = negocioActual.mediosIA || {};
    const er = negocioActual.edicionReels || {};
    const fotoUrl = fotoDe(item);
    const id = item.id;
    const op = (accion, icono, texto, extra) => `<button type="button" class="hoja-op${extra && extra.clase ? ' ' + extra.clase : ''}" data-action="${accion}" data-id="${id}"${extra && extra.attrs ? ' ' + extra.attrs : ''}><i aria-hidden="true">${icono}</i><span>${texto}${extra && extra.sub ? `<small>${extra.sub}</small>` : ''}</span></button>`;
    const partes = [];

    if (puedeCambiar && medio === 'imagen') {
      if (formato === 'carrusel') partes.push(op('elegir-foto', '▦', 'Elegir las fotos del carrusel', { sub: 'De 2 a 10, en el orden que quieras' }));
      else partes.push(op('elegir-foto', '⇄', fotoUrl ? 'Cambiar la foto' : 'Elegir la foto', { attrs: 'data-pest="galeria"' }));
      if (fotoUrl) partes.push(op('disenar', '✦', item.diseno ? 'Cambiar el diseño' : 'Diseñar con mi marca', { attrs: `data-foto="${escapeHtml(fotoUrl)}"`, sub: 'Tu logo, tus colores y el titular' }));
      if (isPending && formato !== 'carrusel' && !fotoGaleriaDe(item) && item.imagenIA && mediosIA.imagen) partes.push(op('imagen-otra', '✨', 'Otra foto con IA'));
    }
    if (puedeCambiar && medio === 'video') {
      if (item.video) {
        if (er.disponible && !(item.edicion && item.edicion.estado === 'editando')) partes.push(op('editar-reel', '✂', item.videoOriginal ? 'Editar el video de nuevo' : 'Editar el video con Rubrofy', { sub: 'Corta silencios y pone subtítulos' }));
        if (item.videoOriginal) partes.push(op('video-original', '↺', 'Volver al video original'));
        partes.push(op('quitar-video', '✕', 'Quitar el video'));
      } else {
        partes.push(op('elegir-video', '🎬', 'Elegir o subir el video'));
        if (mediosIA.video && !negocioActual.sinPlan) partes.push(op('video-ia', '✨', 'Crear el video con IA'));
      }
    }
    if (isPending) {
      partes.push(op('regenerate', '↻', 'Otra versión del texto'));
      partes.push(op('pedir', '💬', 'Pedirle un cambio a la IA', { sub: 'Ej: más corto, menciona el despacho' }));
    }
    if (item.status === 'aprobado' && !publicada && !publicando) partes.push(op('toggle-edit', '✎', 'Editar el texto'));
    if (puedeCambiar) partes.push(op('fecha', '🗓', 'Cambiar fecha y hora', { sub: escapeHtml(cuandoDe(item)) }));
    if (pub && pub.estado === 'programada' && !publicada && negocioActual.instagramEstado === 'ok') partes.push(op('publish-now', '➤', 'Publicar ahora'));
    if (pub && pub.estado === 'fallida') partes.push(op('retry', '↻', 'Reintentar la publicación'));
    partes.push(op('copiar', '⧉', 'Copiar el texto'));
    if (puedeCambiar) {
      partes.push(`<div class="hoja-grupo"><span>Formato</span><div class="hoja-chips">${Object.keys(FORMATOS).map((f) => `<button type="button" data-action="formato" data-formato="${f}" data-id="${id}" class="${f === formato ? 'on' : ''}" aria-pressed="${f === formato}">${FORMATOS[f]}</button>`).join('')}</div>
        ${formato === 'historia' ? `<div class="hoja-chips"><button type="button" data-action="medio" data-medio="imagen" data-id="${id}" class="${medio === 'imagen' ? 'on' : ''}" aria-pressed="${medio === 'imagen'}">Con imagen</button><button type="button" data-action="medio" data-medio="video" data-id="${id}" class="${medio === 'video' ? 'on' : ''}" aria-pressed="${medio === 'video'}">Con video</button></div>` : ''}</div>`);
    }
    if (isPending) partes.push(op('reject', '✕', 'Descartar esta publicación', { clase: 'peligro' }));
    else if (!publicando) partes.push(op('undo', '↩', item.status === 'rechazado' ? 'Recuperar esta publicación' : 'Volver a Por aprobar', { clase: item.status === 'rechazado' ? '' : 'peligro' }));
    return partes.join('');
  }

  // Hoja que sube desde abajo en el teléfono (y un cuadro al centro en el computador).
  function abrirHoja(titulo, html) {
    let dlg = $('#dlg-hoja');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-hoja';
      dlg.className = 'hoja';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-hoja-cerrar]')) dlg.close(); });
    }
    dlg.onclick = null;
    dlg.onchange = null;
    dlg.innerHTML = `<div class="hoja-caja"><span class="hoja-asa" aria-hidden="true"></span>
      <div class="hoja-cab"><h2>${escapeHtml(titulo)}</h2><button type="button" class="hoja-x" data-hoja-cerrar aria-label="Cerrar">×</button></div>
      <div class="hoja-cuerpo">${html}</div></div>`;
    if (!dlg.open) { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); }
    return dlg;
  }

  function abrirOpciones(item) {
    const dlg = abrirHoja(`${FORMATOS[formatoDe(item)]} · ${cuandoDe(item)}`, opcionesPieza(item));
    dlg.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'copiar') { accionPieza(btn); setTimeout(() => dlg.close(), 700); return; }
      dlg.close();
      accionPieza(btn);
    };
  }

  // "Crear": lo que se puede empezar desde cualquier pantalla.
  function abrirCrear() {
    if (!negocioActual) return;
    const dlg = abrirHoja('Crear', `
      <button type="button" class="hoja-op" data-crear="semana"><i aria-hidden="true">✨</i><span>Generar mi semana<small>Rubrofy escribe todas las publicaciones de la semana</small></span></button>
      <button type="button" class="hoja-op" data-crear="reels"><i aria-hidden="true">🎬</i><span>Hacer un reel con mi video<small>Sube tu video y Rubrofy lo corta y le pone subtítulos</small></span></button>
      <button type="button" class="hoja-op" data-crear="fotos"><i aria-hidden="true">🖼</i><span>Subir fotos<small>A tu galería, para usarlas en tus publicaciones</small></span></button>`);
    dlg.onclick = (e) => {
      const b = e.target.closest('[data-crear]');
      if (!b) return;
      dlg.close();
      if (b.dataset.crear === 'semana') abrirGenerar(); else irAVista(b.dataset.crear);
    };
  }

  function renderCola() {
    vigilarVideos();
    if (window.RubrofyBrief) window.RubrofyBrief.pintarCola($('#cola-brief'));
    const grid = $('#cola-grid');
    const filtros = $('#cola-filtros');
    if (!contenido.length) {
      filtros.innerHTML = '';
      grid.innerHTML = '<div class="vacio"><b>Todavía no tienes publicaciones</b><p>Rubrofy escribe tu semana completa. Tú la revisas y apruebas.</p><button type="button" class="btn-approve" data-action="generar">Generar mi semana</button></div>';
      return;
    }
    const n = {};
    Object.keys(FILTROS_COLA).forEach((f) => { n[f] = contenido.filter(FILTROS_COLA[f].incluye).length; });
    const filtro = filtroColaActual();
    filtros.innerHTML = Object.keys(FILTROS_COLA).filter((f) => !FILTROS_COLA[f].soloSiHay || n[f] || f === filtro)
      .map((f) => `<button type="button" role="tab" data-cola-filtro="${f}" aria-selected="${f === filtro}" class="${f === filtro ? 'on' : ''}">${FILTROS_COLA[f].nombre}${n[f] && !FILTROS_COLA[f].sinNumero ? ` <i>${n[f]}</i>` : ''}</button>`).join('');
    const lista = contenido.filter(FILTROS_COLA[filtro].incluye);
    if (FILTROS_COLA[filtro].recientes) lista.sort((a, b) => Date.parse(b.publicarEl || 0) - Date.parse(a.publicarEl || 0));
    grid.innerHTML = lista.length ? lista.map(cardHTML).join('') : `<div class="vacio"><p>${FILTROS_COLA[filtro].vacio}</p></div>`;
  }

  // Por aprobar, programadas (aprobadas que todavía no salen), publicadas y descartadas.
  const estaPublicada = (it) => !!((it.publicacion && it.publicacion.estado === 'publicada') || (it.instagram && it.instagram.ok));
  const FILTROS_COLA = {
    pendientes: { nombre: 'Por aprobar', incluye: (it) => it.status === 'pendiente', vacio: 'No tienes nada por aprobar. Con "Crear" generas tu próxima semana.' },
    programadas: { nombre: 'Programadas', incluye: (it) => it.status === 'aprobado' && !estaPublicada(it), vacio: 'No tienes publicaciones programadas. Lo que apruebes aparece aquí con su fecha.' },
    publicadas: { nombre: 'Publicadas', incluye: (it) => estaPublicada(it), vacio: 'Todavía no se publica nada. Lo que salga en Instagram queda aquí.', sinNumero: true, recientes: true },
    descartadas: { nombre: 'Descartadas', incluye: (it) => it.status === 'rechazado' && !estaPublicada(it), vacio: 'No tienes publicaciones descartadas.', soloSiHay: true, sinNumero: true },
  };
  function filtroColaActual() {
    if (filtroCola && FILTROS_COLA[filtroCola]) return filtroCola;
    if (contenido.some(FILTROS_COLA.pendientes.incluye)) return 'pendientes';
    return contenido.some(FILTROS_COLA.programadas.incluye) ? 'programadas' : 'publicadas';
  }
  function verCola(filtro) {
    filtroCola = filtro;
    if (vistaActual !== 'cola') irAVista('cola'); else renderCola();
  }

  // Aviso breve abajo (ej: "Aprobada ✓ · Ver aprobadas").
  let avisoColaTimer = null;
  function avisoCola(texto, boton, alPulsar) {
    const el = $('#cola-aviso');
    clearTimeout(avisoColaTimer);
    el.innerHTML = `<span>${escapeHtml(texto)}</span>${boton ? `<button type="button">${escapeHtml(boton)}</button>` : ''}`;
    el.hidden = false;
    const b = el.querySelector('button');
    if (b) b.onclick = () => { el.hidden = true; alPulsar(); };
    avisoColaTimer = setTimeout(() => { el.hidden = true; }, 7000);
  }

  // ---------- render: calendario ----------
  // Semana o mes, y mover publicaciones de día: public/app/calendario.js.
  function renderCalendario() {
    window.RubrofyCalendario.render($('#calendario'), Object.assign(ctxPanel(), {
      partesEnZona, escapeHtml, formatoDe, FORMATOS,
      miniatura: (it) => disenoDe(it) || fotoDe(it),
      refrescar: () => refreshContenido().catch(() => {}),
    }));
  }

  // ---------- render: fotos ----------
  function renderFotos() {
    const cont = $('#fotos-categorias');
    if (!nichoActual) { cont.innerHTML = ''; return; }
    window.RubrofyGaleria.renderVista(cont);
  }

  // Estudio de reels (public/app/videos.js): Reels por publicar y Mis videos.
  function renderEstudioReels() {
    vigilarVideos();
    window.RubrofyVideos.renderEstudio($('#reels-estudio'));
  }

  // Tu marca → Tu negocio: el mismo perfil de la bienvenida.
  function renderPerfil() {
    const cont = $('#perfil-card');
    if (!cont) return;
    const P = window.RubrofyPlan;
    const ctx = Object.assign({}, ctxPanel(), { negocio: () => negocioActual });
    const n = negocioActual;
    cont.innerHTML = `<div class="ig-card-head"><h2>Perfil del negocio${window.Ayuda ? window.Ayuda.boton('perfil') : ''}</h2><span class="ig-estado ${n.perfilCompleto ? 'conectado' : ''}">${n.perfilCompleto ? 'Completo' : 'Falta completar'}</span></div>
      <p class="sub">Toda la IA usa esto: tu estrategia, tus publicaciones y tu voz.</p>
      <div data-perfil>${P.camposPerfil(n, { leerWeb: n.usaIA && n.iaConfigurada })}
        <label class="pf-productos">¿Qué ofreces? <span class="opc">productos o servicios</span><textarea data-pf="productos" rows="2" maxlength="800" placeholder="Tus productos o servicios principales">${escapeHtml((n.perfil && n.perfil.productos) || '')}</textarea></label></div>
      <p class="config-ok" data-perfil-ok hidden></p>
      <div class="config-actions"><button type="button" class="btn-approve" data-perfil-guardar>Guardar perfil</button></div>`;
    const cuerpo = cont.querySelector('[data-perfil]');
    P.activar(cuerpo, 14);
    P.activarPerfil(cuerpo, ctx);
    cont.querySelector('[data-perfil-guardar]').addEventListener('click', async (ev) => {
      ev.target.disabled = true;
      try {
        negocioActual = await api(`/api/negocios/${n.id}/perfil`, { method: 'PUT', body: JSON.stringify(P.leerPerfil(cuerpo)) });
        window.RubrofyInicio.invalidar();
        renderPerfil();
        const ok = $('#perfil-card [data-perfil-ok]');
        ok.textContent = 'Guardado. La IA lo usa desde ahora.';
        ok.hidden = false;
      } catch (err) {
        alert(err.mensaje || 'No se pudo guardar el perfil.');
        ev.target.disabled = false;
      }
    });
  }

  // Tu marca → Tu negocio: el perfil y los datos que usa la IA tal cual.
  function renderNegocio() {
    if (!negocioActual) return;
    renderPerfil();
    $('#config-nombre').value = negocioActual.nombre || '';
    $('#config-precio').value = (negocioActual.datos && negocioActual.datos.precioDesde) || '';
    $('#config-unidad').value = (negocioActual.datos && negocioActual.datos.unidad) || '';
    $('#config-promo').value = (negocioActual.datos && negocioActual.datos.promo) || '';
    $('#config-producto').value = (negocioActual.datos && negocioActual.datos.productoDestacado) || '';
    $('#config-estilo-imagen').value = negocioActual.estiloImagen || 'limpia';
    $('#config-error').hidden = true;
    $('#config-ok').hidden = true;
  }

  // Cuentas conectadas: Instagram (y TikTok cuando esté listo).
  function renderConfig() {
    if (!negocioActual) return;
    const conectado = !!negocioActual.instagramConectado;
    const reconectar = negocioActual.instagramEstado === 'reconectar';
    $('#ig-estado').textContent = reconectar ? 'Reconectar' : (conectado ? 'Conectado' : 'Sin conectar');
    $('#ig-estado').classList.toggle('conectado', conectado && !reconectar);
    $('#ig-estado').classList.toggle('reconectar', reconectar);
    // Con el token vencido se muestra el formulario para pegar uno nuevo; las
    // publicaciones programadas esperan y salen solas al reconectar.
    $('#form-instagram').hidden = conectado && !reconectar;
    $('#btn-desconectar-ig').hidden = !conectado;
    $('#ig-error').hidden = true;
    const aviso = $('#ig-aviso');
    if (reconectar) {
      aviso.textContent = 'Instagram rechazó el token (' + (negocioActual.instagramMotivoReconexion || 'venció o fue revocado') + '). Pega un token nuevo: las publicaciones programadas se publicarán solas al reconectar.';
    } else if (conectado && negocioActual.instagramVenceEl) {
      aviso.textContent = 'El token se renueva solo. Vence el ' + fechaCorta(negocioActual.instagramVenceEl) + ' si no se pudiera renovar.';
    } else {
      aviso.textContent = '';
    }
    aviso.hidden = !aviso.textContent;
    aviso.style.color = reconectar ? 'var(--coral)' : '';

    // "Conectar con Instagram" si el servidor lo tiene configurado; si no,
    // solo el formulario de ID y token (con su ayuda).
    const login = !!negocioActual.instagramLoginDisponible;
    const necesitaConectar = !conectado || reconectar;
    $('#ig-login').hidden = !(login && necesitaConectar);
    $('#ig-revision').hidden = !(login && necesitaConectar && negocioActual.instagramEnRevision);
    $('#btn-ig-login').href = `/api/negocios/${negocioActual.id}/instagram/conectar`;
    $('#btn-ig-login-txt').textContent = reconectar ? 'Reconectar con Instagram' : 'Conectar con Instagram';
    // Con "Conectar con Instagram" disponible, pegar el ID y el token es cosa
    // técnica: solo lo ve quien administra (por si el inicio de sesión falla).
    $('#ig-manual').hidden = !necesitaConectar || (login && !negocioActual.esAdmin);
    $('#ig-manual').open = !login;
    $('#ig-manual-titulo').hidden = !login;
    $('#ig-cuenta').hidden = !(conectado && negocioActual.instagramUsuario);
    $('#ig-cuenta').textContent = negocioActual.instagramUsuario ? 'Cuenta: @' + negocioActual.instagramUsuario : '';
  }

  function renderAvisos() {
    const activo = !!negocioActual.avisosSemanal;
    const config = !!negocioActual.correoConfigurado;
    $('#avisos-semanal').checked = activo;
    $('#avisos-email').textContent = negocioActual.email || '';
    $('#avisos-estado').textContent = !config ? 'No disponible' : activo ? 'Activo' : 'Apagado';
    $('#avisos-estado').classList.toggle('conectado', config && activo);
    $('#avisos-no-config').hidden = config;
    $('#btn-avisos-prueba').hidden = !config;
    $('#avisos-error').hidden = true;
  }

  function formatoCLP(monto) {
    return monto ? '$' + monto.toLocaleString('es-CL') + '/mes' : 'Gratis';
  }

  // Botones para pagar un plan (aviso de arriba y bienvenida).
  function botonesPago() {
    return planesInfo.map((p) => (p.disponible
      ? `<button type="button" class="${p.id === 'pro' ? 'btn-approve' : 'btn-ghost'}" data-checkout-plan="${p.id}">${escapeHtml(p.nombre)} · ${formatoCLP(p.precioClp)}</button>`
      : `<button type="button" class="btn-ghost" disabled title="Los pagos todavía no están habilitados">${escapeHtml(p.nombre)} · pronto</button>`)).join('');
  }

  function fechaLarga(iso) {
    return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  }
  const nombrePlan = (id) => (planesInfo.find((p) => p.id === id) || {}).nombre || id;

  // Aviso bajo la barra: prueba gratis disponible, prueba en curso o sin plan.
  // Cuenta nueva sin el correo confirmado: aviso chico con "Reenviar" y
  // "Cambiar correo" (por si se escribió mal). Las cuentas antiguas no lo ven.
  function renderAvisoCorreo() {
    const cont = $('#aviso-correo');
    if (!cont || !negocioActual) return;
    // Sin envío de correos configurado no hay enlace que confirmar.
    cont.hidden = negocioActual.emailVerificado !== false || !negocioActual.correoConfigurado;
    if (cont.hidden) return;
    cont.innerHTML = `<span class="aviso-correo-txt">📧 <b>Confirma tu correo:</b> te enviamos un enlace a <b>${escapeHtml(negocioActual.email || '')}</b>. Así puedes recuperar tu clave y te llegan los avisos de cobros y publicaciones.</span>
      <span class="aviso-correo-acc"><button type="button" class="btn-ghost" data-correo-reenviar>Reenviar enlace</button><button type="button" class="btn-text" data-correo-cambiar>¿Está mal escrito?</button></span>`;
  }

  // Vuelta del enlace "Confirmar mi correo" (/app?correo=verificado|vencido).
  async function avisarRetornoCorreo() {
    const r = new URLSearchParams(window.location.search).get('correo');
    if (!r) return;
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    if (r === 'verificado') {
      try { negocioActual = await api('/api/me'); } catch (e) { /* sigue */ }
      render();
      alert('¡Listo! Confirmaste tu correo.');
    } else {
      alert('Ese enlace venció o ya no es válido. Te podemos enviar uno nuevo desde el aviso de arriba o desde Mi cuenta.');
    }
  }

  function renderAvisoPlan() {
    const cont = $('#aviso-plan');
    if (!cont || !negocioActual) return;
    const pr = negocioActual.prueba || {};
    if (negocioActual.sinPlan && pr.disponible) {
      cont.className = 'aviso-plan aviso-sinplan aviso-regalo';
      cont.innerHTML = `<div class="aviso-texto"><b>🎁 ${pr.dias} días gratis del plan ${escapeHtml(nombrePlan(pr.plan))}</b>
          <span>Déjanos tu nombre, correo y teléfono, y empieza hoy, sin tarjeta: estrategia y publicaciones completas con gancho, texto y hashtags.</span></div>
        <div class="aviso-botones"><button type="button" class="btn-approve" data-abrir-prueba>Quiero mis ${pr.dias} días gratis</button><button type="button" class="btn-text" data-ir-plan>o elige un plan</button></div>`;
      cont.hidden = false;
    } else if (negocioActual.sinPlan) {
      cont.className = 'aviso-plan aviso-sinplan';
      cont.innerHTML = `<div class="aviso-texto"><b>${pr.hasta ? 'Terminó tu prueba gratis: elige tu plan para seguir' : 'Elige tu plan para crear contenido'}</b>
          <span>${pr.hasta ? 'Todo lo que armaste sigue aquí. ' : ''}Estrategia, publicaciones completas con gancho, texto y hashtags, y publicación en Instagram con tu aprobación. Sin permanencia: cancelas cuando quieras.</span></div>
        <div class="aviso-botones">${botonesPago()}<button type="button" class="btn-text" data-ir-plan>Comparar planes</button></div>
        <p class="config-error" data-pago-error hidden></p>`;
      cont.hidden = false;
    } else if (quedanPocas()) {
      const q = window.RubrofyRecargas.quedan(negocioActual, 'piezas');
      cont.className = 'aviso-plan aviso-prueba termina';
      cont.innerHTML = `<div class="aviso-texto"><b>${q ? `Te quedan ${q} piezas con IA este mes` : 'Se acabaron tus piezas con IA de este mes'}</b>
          <span>Se renuevan el día 1. Si necesitas más antes, carga un paquete: no vence a fin de mes.</span></div>
        <div class="aviso-botones"><button type="button" class="btn-approve" data-recargar>Cargar más</button><button type="button" class="btn-text" data-ocultar-pocas>Ahora no</button></div>`;
      cont.hidden = false;
    } else if (pr.vigente && !negocioActual.tieneSuscripcion) {
      cont.className = 'aviso-plan aviso-prueba' + (pr.diasRestantes <= 2 ? ' termina' : '');
      cont.innerHTML = `<div class="aviso-texto"><b>Prueba gratis del plan ${escapeHtml(nombrePlan(pr.plan))}</b>
          <span>${pr.diasRestantes === 1 ? 'Queda 1 día' : `Quedan ${pr.diasRestantes} días`} (hasta el ${fechaLarga(pr.hasta)}). Elige tu plan antes y no se corta nada.</span></div>
        <div class="aviso-botones"><button type="button" class="btn-ghost" data-ir-plan>Elegir plan</button></div>`;
      cont.hidden = false;
    } else {
      cont.hidden = true;
      cont.innerHTML = '';
    }
  }

  // Aviso de "quedan pocas piezas": con 15 o menos entre cupo y saldo, hasta que lo cierre.
  let pocasOcultas = false;
  try { pocasOcultas = sessionStorage.getItem('rubrofy-pocas') === '1'; } catch (e) { pocasOcultas = false; }
  function quedanPocas() {
    if (pocasOcultas || !window.RubrofyRecargas || negocioActual.sinPlan) return false;
    const c = (negocioActual.cupos || {}).piezas || {};
    return !!c.cupo && window.RubrofyRecargas.quedan(negocioActual, 'piezas') <= 15;
  }

  // Formulario de la prueba gratis (public/app/prueba-form.js) en un diálogo.
  async function abrirPrueba() {
    let dlg = $('#dlg-prueba');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg-prueba';
      dlg.className = 'dlg dlg-prueba';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) dlg.close(); });
      dlg.addEventListener('submit', (e) => { e.preventDefault(); activarPrueba(dlg); });
    }
    const cat = await window.RubrofyPrueba.cargar();
    const perfil = negocioActual.perfil || {};
    dlg.innerHTML = `<form method="dialog" class="dlg-caja">
        <h2>🎁 ${cat.dias} días gratis del plan ${escapeHtml(nombrePlan(cat.plan))}</h2>
        <p class="sub">Déjanos tu nombre, correo y teléfono, y la prueba se activa al instante, sin tarjeta. Al terminar, tu contenido queda guardado y eliges si seguir.</p>
        ${window.RubrofyPrueba.campos(cat, { email: negocioActual.email, telefono: perfil.whatsapp })}
        <p class="config-error" data-prueba-error hidden></p>
        <div class="dlg-acciones"><button type="button" class="btn-ghost" data-cerrar>Ahora no</button><button class="btn-approve">Activar mi prueba</button></div>
      </form>`;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  async function activarPrueba(dlg) {
    const form = dlg.querySelector('form');
    const btn = form.querySelector('.btn-approve');
    const errorEl = form.querySelector('[data-prueba-error]');
    window.RubrofyPrueba.limpiarErrores(form);
    errorEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Activando…';
    try {
      negocioActual = await api(`/api/negocios/${negocioActual.id}/prueba`, { method: 'POST', body: JSON.stringify(window.RubrofyPrueba.leer(form)) });
      dlg.close();
      render();
      const pr = negocioActual.prueba;
      if (negocioActual.bienvenidaCompletada && !contenido.length) {
        try { await generarSemana(); irAVista('cola'); } catch (err) { /* se genera con el botón */ }
      }
      alert(`¡Listo! Tienes el plan ${nombrePlan(pr.plan)} gratis hasta el ${fechaLarga(pr.hasta)}.`);
    } catch (err) {
      const msg = err.mensaje || 'No se pudo activar la prueba. Intenta de nuevo.';
      if (!window.RubrofyPrueba.marcarError(form, err.campo, msg)) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }
      btn.disabled = false;
      btn.textContent = 'Activar mi prueba';
    }
  }

  // Cobra Rubrofy con Flow o Mercado Pago (no Stripe): hay pago anual,
  // códigos de descuento y la suscripción se gestiona desde el panel.
  const conCobroPropio = () => ['flow', 'mercadopago'].includes(negocioActual.pagos && negocioActual.pagos.proveedor);

  // "¿Cómo quieres pagar?": Flow (tarjeta) o Mercado Pago. Con un solo medio
  // disponible no pregunta. plan: true si es un plan (Mercado Pago pide el
  // correo con que paga). Resuelve { medio, emailPago } o null (volvió).
  function elegirMedio({ plan = false, detalle = '' } = {}) {
    const medios = (negocioActual.pagos && negocioActual.pagos.medios) || [];
    if (medios.length < 2) return Promise.resolve({ medio: medios[0] ? medios[0].id : undefined });
    return new Promise((resolve) => {
      let dlg = document.getElementById('dlg-medio');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'dlg-medio';
        dlg.className = 'dlg';
        document.body.appendChild(dlg);
      }
      let elegido = medios[0].id;
      const textos = {
        flow: { t: 'Tarjeta de crédito o débito', d: plan ? 'Pagas con Flow. Se cobra solo cada mes y cancelas cuando quieras.' : 'Pagas con Flow, con tu tarjeta.' },
        mercadopago: { t: 'Mercado Pago', d: plan ? 'Con tu cuenta de Mercado Pago o con tarjeta. Se cobra solo cada mes y cancelas cuando quieras.' : 'Con tu cuenta de Mercado Pago o con tarjeta.' },
      };
      dlg.innerHTML = `<div class="dlg-caja">
        <h2>¿Cómo quieres pagar?</h2>
        ${detalle ? `<p class="sub">${escapeHtml(detalle)}</p>` : ''}
        <div class="medio-opciones" role="radiogroup" aria-label="Medio de pago">
          ${medios.map((m) => `<button type="button" class="medio-op" data-medio="${escapeHtml(m.id)}" role="radio"><span class="medio-op-marca medio-${escapeHtml(m.id)}" aria-hidden="true"></span><span class="medio-op-txt"><b>${escapeHtml((textos[m.id] || { t: m.nombre }).t)}</b><span>${escapeHtml((textos[m.id] || { d: '' }).d)}</span></span></button>`).join('')}
        </div>
        ${plan ? `<label class="medio-email" hidden>Correo con el que pagas en Mercado Pago
          <input type="email" name="emailPago" maxlength="120" autocomplete="email" value="${escapeHtml(negocioActual.email || '')}">
          <small>Tiene que ser el mismo de tu cuenta de Mercado Pago (o el que escribas al pagar). Si no coincide, Mercado Pago rechaza el pago.</small>
        </label>` : ''}
        <p class="config-error" data-medio-error hidden></p>
        <div class="dlg-acciones"><button type="button" class="btn-ghost" data-medio-volver>Volver</button><button type="button" class="btn-approve" data-medio-seguir>Continuar</button></div>
      </div>`;
      const pintar = () => {
        dlg.querySelectorAll('[data-medio]').forEach((b) => { const on = b.dataset.medio === elegido; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
        const caja = dlg.querySelector('.medio-email');
        if (caja) caja.hidden = elegido !== 'mercadopago';
      };
      const cerrar = (valor) => { dlg.close(); resolve(valor); };
      dlg.onclick = (e) => {
        const op = e.target.closest('[data-medio]');
        if (op) { elegido = op.dataset.medio; return pintar(); }
        if (e.target.closest('[data-medio-volver]') || e.target === dlg) return cerrar(null);
        if (!e.target.closest('[data-medio-seguir]')) return;
        const input = dlg.querySelector('input[name="emailPago"]');
        const emailPago = plan && elegido === 'mercadopago' && input ? input.value.trim() : undefined;
        if (emailPago !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPago)) {
          const err = dlg.querySelector('[data-medio-error]');
          err.textContent = 'Escribe el correo con el que pagas en Mercado Pago.';
          err.hidden = false;
          input.focus();
          return;
        }
        cerrar({ medio: elegido, emailPago });
      };
      dlg.oninput = () => { const err = dlg.querySelector('[data-medio-error]'); if (err) err.hidden = true; };
      dlg.addEventListener('cancel', () => resolve(null), { once: true });
      pintar();
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    });
  }
  window.RubrofyPagos = { elegirMedio: (o) => elegirMedio(o) };

  // Abre la página de pago (Flow, Mercado Pago o Stripe Checkout) o cambia el
  // plan de una suscripción activa.
  async function pagarPlan(btn, errorEl) {
    const planId = btn.dataset.checkoutPlan;
    const destino = planesInfo.find((p) => p.id === planId);
    const cambia = negocioActual.tieneSuscripcion && !negocioActual.sinPlan;
    const prov = negocioActual.pagos && negocioActual.pagos.proveedor;
    if (cambia) {
      const nombre = destino ? destino.nombre : 'el nuevo plan';
      const anual = periodoPlan === 'anual';
      const mismoPeriodo = ((negocioActual.pagos && negocioActual.pagos.periodo) || 'mensual') === (periodoPlan || 'mensual');
      if (!confirm(prov === 'flow'
        ? (anual ? `Tu suscripción pasará a ${nombre} con pago anual desde hoy (12 meses por el precio de 10). Flow ajusta el cobro según lo que ya pagaste.` : `Tu suscripción pasará a ${nombre} desde hoy. Flow ajusta el cobro según los días que quedan del mes.`)
        : prov === 'mercadopago'
          ? (mismoPeriodo ? `Tu suscripción pasará a ${nombre} desde hoy. Mercado Pago cobra el precio nuevo desde tu próximo pago.` : `Para pagar ${anual ? 'anual' : 'mensual'}, Mercado Pago crea una suscripción nueva: la autorizas y empieza a cobrar cuando termine lo que ya pagaste.`)
          : `Tu suscripción pasará a ${nombre} ahora mismo. La diferencia proporcional a los días que quedan se cobra en tu próxima factura.`)) return;
    }
    let medio, emailPago;
    if (!cambia) {
      const precio = destino ? (periodoPlan === 'anual' && destino.precioAnualClp ? `$${destino.precioAnualClp.toLocaleString('es-CL')} al año` : `$${destino.precioClp.toLocaleString('es-CL')} al mes`) : '';
      const e = await elegirMedio({ plan: true, detalle: destino ? `Plan ${destino.nombre} · ${precio}.` : '' });
      if (!e) return;
      medio = e.medio;
      emailPago = e.emailPago;
    }
    if (errorEl) errorEl.hidden = true;
    btn.disabled = true;
    try {
      const codigo = codigoDescuento && codigoDescuento.planes.includes(planId) ? codigoDescuento.codigo : undefined;
      const resultado = await api(`/api/negocios/${negocioActual.id}/checkout`, { method: 'POST', body: JSON.stringify({ plan: planId, codigo, periodo: periodoPlan || 'mensual', medio, emailPago }) });
      if (codigo) codigoDescuento = null;
      if (resultado.url) {
        window.location.href = resultado.url;
        return;
      }
      // Cambio de plan sobre la suscripción existente: no hay página de pago.
      negocioActual = resultado.negocio;
      render();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.';
        errorEl.hidden = false;
      } else alert(err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.');
      btn.disabled = false;
    }
  }

  // Diálogo al tocar "Cancelar": pausar un mes (recomendado) o cancelar.
  // Resuelve 'pausar', 'cancelar' o null.
  function preguntarPausa() {
    return new Promise((resolve) => {
      let dlg = document.getElementById('dlg-pausa');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'dlg-pausa';
        dlg.className = 'dlg';
        document.body.appendChild(dlg);
      }
      const fin = negocioActual.pagos && negocioActual.pagos.periodoFin ? fechaLarga(negocioActual.pagos.periodoFin) : 'el fin del período que pagaste';
      dlg.innerHTML = `<div class="dlg-caja">
        <h2>¿Prefieres pausar un mes?</h2>
        <p class="sub">Tu plan sigue hasta ${escapeHtml(fin)}. Después, <b>un mes sin cobro</b>: tu estrategia, tus fotos, tus videos y tu contenido quedan guardados tal cual. Se reanuda solo y te avisamos 3 días antes.</p>
        <div class="pausa-opciones">
          <button type="button" class="pausa-op recomendada" data-pausa="pausar"><b>⏸ Pausar 1 mes</b><span>Sin cobro, sin perder nada. Vuelves cuando quieras.</span><em>Recomendado</em></button>
          <button type="button" class="pausa-op" data-pausa="cancelar"><b>Cancelar de todos modos</b><span>Tu plan termina ${escapeHtml(fin)} y no se vuelve a cobrar.</span></button>
        </div>
        <div class="dlg-acciones"><button type="button" class="btn-ghost" data-pausa="">Volver</button></div>
      </div>`;
      const cerrar = (valor) => { dlg.close(); resolve(valor || null); };
      dlg.onclick = (e) => { const b = e.target.closest('[data-pausa]'); if (b) cerrar(b.dataset.pausa); else if (e.target === dlg) cerrar(null); };
      dlg.addEventListener('cancel', () => resolve(null), { once: true });
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    });
  }

  // Estado de la suscripción y lo que se puede hacer con ella.
  function gestionSuscripcion() {
    const pg = negocioActual.pagos || {};
    if (!negocioActual.tieneSuscripcion) return '';
    if (pg.proveedor === 'stripe') return '<button type="button" class="btn-ghost" data-action="portal">Gestionar suscripción</button>';
    const conMp = pg.proveedor === 'mercadopago';
    const t = pg.tarjeta;
    const tarjeta = conMp ? `Mercado Pago${pg.emailPago ? ` (${escapeHtml(pg.emailPago)})` : ''}` : t && t.ultimos4 ? `${escapeHtml(t.tipo || 'Tarjeta')} terminada en ${escapeHtml(t.ultimos4)}` : 'tu tarjeta';
    const fin = pg.periodoFin ? fechaLarga(pg.periodoFin) : '';
    let linea = '';
    if (pg.estado === 'past_due') linea = `No pudimos cobrar con ${tarjeta}. ${conMp ? 'Cambia tu medio de pago' : 'Cambia la tarjeta'} para seguir con tu plan.`;
    else if (pg.estado === 'canceled') linea = 'Tu suscripción está cancelada. Elige un plan para volver.';
    else if (negocioActual.pausa && negocioActual.pausa.reanudadaPorDueno) linea = `Tu plan se reanuda solo el ${fechaLarga(negocioActual.pausa.hasta)}, cuando termina lo que ya pagaste. No se cobra antes.`;
    else if (negocioActual.pausa && negocioActual.pausa.hasta) linea = `Tu plan está en pausa: sigue ${fin ? `hasta el ${fin}` : 'hasta el fin del período pagado'}, después no se cobra, y se reanuda solo el ${fechaLarga(negocioActual.pausa.hasta)}. Todo queda guardado.`;
    else if (pg.cancelaAlFinal) linea = `Cancelaste tu suscripción: tu plan sigue ${fin ? `hasta el ${fin}` : 'hasta el fin del período pagado'} y no se vuelve a cobrar.`;
    else if (pg.suscripcion) linea = `Se cobra cada ${pg.periodo === 'anual' ? 'año' : 'mes'} con ${tarjeta}${fin ? `. Próximo cobro: ${fin}` : ''}.`;
    const enPausa = !!(negocioActual.pausa && negocioActual.pausa.hasta && !negocioActual.pausa.reanudadaPorDueno);
    const vigente = pg.suscripcion && !['canceled', 'incomplete'].includes(pg.estado) && !pg.cancelaAlFinal;
    return `${linea ? `<p class="plan-estado">${linea}</p>` : ''}
      <div class="plan-acciones">
        <button type="button" class="btn-ghost" data-action="flow-tarjeta">${conMp ? 'Cambiar medio de pago' : 'Cambiar tarjeta'}</button>
        ${enPausa ? '<button type="button" class="btn-approve" data-action="flow-reanudar">Reanudar mi plan</button>' : ''}
        ${vigente ? '<button type="button" class="btn-ghost" data-action="flow-cancelar">Cancelar suscripción</button>' : ''}
      </div>`;
  }

  // "pagas con tarjeta en Flow o con Mercado Pago" (según los medios disponibles).
  function medioTexto() {
    const ids = ((negocioActual.pagos && negocioActual.pagos.medios) || []).map((m) => m.id);
    if (ids.includes('flow') && ids.includes('mercadopago')) return 'pagas con tarjeta en Flow o con Mercado Pago';
    if (ids.includes('mercadopago')) return 'pagas con Mercado Pago';
    const nombre = negocioActual.pagos && negocioActual.pagos.nombre;
    return `pagas con tarjeta${nombre ? ` en ${escapeHtml(nombre)}` : ''}`;
  }

  // Mensual o anual (2 meses gratis). Parte en lo que ya paga el negocio.
  let periodoPlan = null;
  function renderPlan() {
    const cont = $('#plan-card');
    if (!cont || !negocioActual) return;
    const planActualId = negocioActual.plan || 'gratis';
    const indiceActual = planesInfo.findIndex((p) => p.id === planActualId);
    const pgPeriodo = (negocioActual.pagos && negocioActual.pagos.periodo) || 'mensual';
    if (!periodoPlan) periodoPlan = pgPeriodo;
    const anual = periodoPlan === 'anual';
    const conAnual = conCobroPropio() && planesInfo.some((p) => p.precioAnualClp);
    const mesesGratis = (planesInfo.find((p) => p.mesesGratisAnual) || {}).mesesGratisAnual || 2;

    const filas = planesInfo.map((p, i) => {
      const esActual = p.id === planActualId;
      let boton = '';
      if (esActual && conAnual && negocioActual.tieneSuscripcion && !negocioActual.sinPlan && pgPeriodo !== periodoPlan) {
        boton = `<button type="button" class="btn-approve" data-checkout-plan="${p.id}">Pasar a ${anual ? 'anual' : 'mensual'}</button>`;
      } else if (esActual) {
        boton = `<span class="ig-estado conectado">Plan actual${negocioActual.tieneSuscripcion && pgPeriodo === 'anual' ? ' · anual' : ''}</span>`;
      } else if (i < indiceActual && !(conCobroPropio() && negocioActual.tieneSuscripcion && !negocioActual.sinPlan)) {
        // Con Stripe, bajar de plan se hace desde "Gestionar suscripción" (Billing Portal).
        boton = '';
      } else if (i < indiceActual) {
        boton = `<button type="button" class="btn-ghost" data-checkout-plan="${p.id}">Cambiar a ${escapeHtml(p.nombre)}</button>`;
      } else if (!p.disponible) {
        boton = '<button type="button" class="btn-ghost" disabled title="Todavía no configurado">Próximamente</button>';
      } else {
        boton = `<button type="button" class="btn-approve" data-checkout-plan="${p.id}">${negocioActual.sinPlan ? 'Elegir' : 'Actualizar a'} ${escapeHtml(p.nombre)}</button>`;
      }
      const detalle = [
        `${p.cuotaTextosIA} piezas con IA`,
        p.creditosMes ? `${p.creditosMes} créditos ⚡ para fotos y videos` : '',
        p.cuotaReelsEditados ? `${p.cuotaReelsEditados} reels editados` : '',
      ].filter(Boolean).join(' · ') + ' al mes';
      const clp = (m) => '$' + Number(m).toLocaleString('es-CL');
      const precio = anual && p.precioAnualClp
        ? `<b class="plan-precio-desc">${clp(p.precioAnualClp)} al año</b> · equivale a ${clp(Math.round(p.precioAnualClp / 12))}/mes`
        : (codigoDescuento && codigoDescuento.precios[p.id] ? `<s>${formatoCLP(p.precioClp)}</s> <b class="plan-precio-desc">${formatoCLP(codigoDescuento.precios[p.id].ahora)}</b>` : formatoCLP(p.precioClp));
      return `
        <div class="plan-row${esActual ? ' plan-row-actual' : ''}">
          <div>
            <strong>${escapeHtml(p.nombre)}</strong>
            <span class="sub">${detalle} · ${precio}</span>
          </div>
          ${boton}
        </div>
      `;
    }).join('');
    const selectorPeriodo = conAnual && !negocioActual.regalo && !negocioActual.cortesia
      ? `<div class="plan-periodo" role="radiogroup" aria-label="Cómo pagar">
          <button type="button" class="${anual ? '' : 'on'}" data-periodo="mensual" aria-checked="${!anual}" role="radio">Mensual</button>
          <button type="button" class="${anual ? 'on' : ''}" data-periodo="anual" aria-checked="${anual}" role="radio">Anual <em>${mesesGratis} meses gratis</em></button>
        </div>` : '';

    const pr = negocioActual.prueba || {};
    const estadoPlan = negocioActual.sinPlan && pr.disponible
      ? `<div class="plan-prueba"><p class="plan-estado">Tu cuenta no tiene un plan activo. Prueba el plan ${escapeHtml(nombrePlan(pr.plan))} ${pr.dias} días gratis dejando tu nombre, correo y teléfono, o elige un plan.</p><button type="button" class="btn-approve" data-abrir-prueba>Quiero mis ${pr.dias} días gratis</button></div>`
      : negocioActual.sinPlan
      ? `<p class="plan-estado">${pr.hasta ? 'Terminó tu prueba gratis. ' : ''}Tu cuenta no tiene un plan activo. Elige uno para crear contenido: ${medioTexto()} y cancelas cuando quieras.</p>`
      : pr.vigente && !negocioActual.tieneSuscripcion
        ? `<p class="plan-estado">Estás en tu prueba gratis hasta el ${fechaLarga(pr.hasta)} (${pr.diasRestantes === 1 ? 'queda 1 día' : `quedan ${pr.diasRestantes} días`}). Elige tu plan antes y no se corta nada.</p>`
      : negocioActual.regalo
        ? `<p class="plan-estado plan-regalo">🎁 Tienes el plan ${escapeHtml(nombrePlan(negocioActual.regalo.plan))} de regalo${negocioActual.regalo.hasta ? ` hasta el ${fechaLarga(negocioActual.regalo.hasta)}` : ''}. No se cobra${negocioActual.regalo.hasta ? '; después eliges si seguir con un plan' : ''}.</p>`
      : negocioActual.cortesia
        ? '<p class="plan-estado">Plan de cortesía para la cuenta administradora: no se cobra.</p>'
        : '';
    const pg = negocioActual.pagos || {};
    const cajaCodigo = ['flow', 'mercadopago'].includes(pg.proveedor) && !negocioActual.regalo && !negocioActual.cortesia
      ? `<div class="plan-codigo">
          ${codigoDescuento ? `<p class="plan-codigo-ok">Código <b>${escapeHtml(codigoDescuento.codigo)}</b>: ${escapeHtml(codigoDescuento.descripcion)}. Se aplica al elegir tu plan.</p>` : ''}
          <form data-codigo-form class="plan-codigo-form">
            <input name="codigo" placeholder="¿Tienes un código de descuento?" maxlength="24" autocomplete="off" aria-label="Código de descuento">
            <button type="submit" class="btn-ghost">Aplicar</button>
          </form>
        </div>`
      : '';

    cont.innerHTML = `
      <div class="ig-card-head"><h2>Plan</h2></div>
      ${estadoPlan}
      ${selectorPeriodo}${filas}
      ${cajaCodigo}
      <div class="rc-uso-caja" id="plan-uso"></div>
      <p class="config-error" id="plan-error" hidden></p>
      ${gestionSuscripcion()}
    `;
    if (window.RubrofyRecargas) window.RubrofyRecargas.renderUso($('#plan-uso'));
  }

  function renderResultados() {
    const ctx = { api, negocio: negocioActual, planes: planesInfo, irA: irAVista, recargarContenido: ctxPanel().recargarContenido };
    return window.RubrofyResultados.render($('#resultados'), ctx);
  }

  // Lo de todos los días está en el menú (Inicio, Publicaciones, Calendario);
  // lo que se configura una vez queda en "Más".
  const VISTAS = ['inicio', 'cola', 'calendario', 'mas', 'marca', 'fotos', 'reels', 'resultados', 'config', 'cuenta', 'soporte'];
  const DE_MAS = ['marca', 'fotos', 'reels', 'resultados', 'config', 'cuenta', 'soporte'];
  const TITULOS = { cola: 'Publicaciones', calendario: 'Calendario', mas: 'Más', marca: 'Tu marca', fotos: 'Galería', reels: 'Estudio de reels', resultados: 'Resultados', config: 'Cuentas conectadas', cuenta: 'Mi cuenta', soporte: 'Ayuda' };
  const AYUDA_VISTA = { inicio: 'inicio', cola: 'cola', calendario: 'calendario', marca: 'marca', fotos: 'fotos', reels: 'editar-reel', resultados: 'resultados', config: 'instagram', cuenta: 'cuenta', soporte: 'soporte' };
  // "Tu marca" reúne lo que antes eran pantallas aparte (Estrategia, Voz,
  // Mi estilo, Kit de marca, Contexto): los enlaces antiguos siguen sirviendo.
  const ALIAS_MARCA = { voz: 'voz', estilo: 'ejemplos', kit: 'kit', estrategia: 'estrategia', contexto: 'contexto' };
  let tabMarca = 'negocio';

  // Marca la sección en el menú y pone el título (y la ayuda) arriba.
  function marcarMenu() {
    if (!negocioActual) return;
    const sub = DE_MAS.includes(vistaActual);
    const enMenu = sub ? 'mas' : vistaActual;
    document.querySelectorAll('.nav-btn[data-view]').forEach((b) => {
      const on = b.dataset.view === enMenu;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('#top-volver').hidden = !sub;
    $('#view-app').dataset.vista = vistaActual;
    $('#view-app').classList.toggle('en-sub', sub);
    $('#top-titulo').textContent = vistaActual === 'inicio' ? (negocioActual.nombre || 'Rubrofy') : TITULOS[vistaActual];
    $('#top-ayuda').innerHTML = AYUDA_VISTA[vistaActual] ? AY(AYUDA_VISTA[vistaActual]) : '';
  }

  // ancla: id de una sección dentro de la vista (ej: 'cta-plan').
  let vistaPrevia = 'inicio'; // para saber desde qué pantalla se pide ayuda
  // "Tu marca": tu negocio, la estrategia (plan.js), cómo hablas (voz.js), tus
  // ejemplos (estilo.js), cómo se ve (diseno.js) y el contexto para la IA.
  function renderMarca() {
    document.querySelectorAll('#view-marca [role="tab"][data-marca-tab]').forEach((b) => {
      const on = b.dataset.marcaTab === tabMarca;
      b.classList.toggle('activa', on);
      b.setAttribute('aria-selected', on);
      if (on && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    document.querySelectorAll('#view-marca [data-marca-panel]').forEach((p) => { p.hidden = p.dataset.marcaPanel !== tabMarca; });
    if (tabMarca === 'negocio') renderNegocio();
    else if (tabMarca === 'estrategia') {
      window.RubrofyPlan.renderVista($('#estrategia'), ctxPanel()).catch(() => {});
      window.RubrofyContexto.editor($('#ctx-estrategia'), ctxPanel(), ['estrategia'], 'estrategia');
    }
    else if (tabMarca === 'voz') window.RubrofyVoz.render($('#voz'), ctxPanel());
    else if (tabMarca === 'ejemplos') window.RubrofyEstilo.render($('#estilo'), { api, negocio: negocioActual });
    else if (tabMarca === 'contexto') window.RubrofyContexto.render($('#contexto'), ctxPanel());
    else if (window.RubrofyDiseno) {
      if (window.RubrofyDisenoIA) {
        window.RubrofyDisenoIA.render($('#marca-ia'), Object.assign(ctxPanel(), {
          negocio: () => negocioActual,
          alAplicar: () => renderMarca(),
        }));
      }
      window.RubrofyDiseno.renderKit($('#marca-card'));
    }
  }

  // "Más": todo lo que se configura una vez, fuera de la vista de todos los días.
  const ICONOS_MAS = {
    marca: '<path d="M12 3.5 L13.9 9.1 L19.5 9.3 L15 12.8 L16.6 18.5 L12 15.2 L7.4 18.5 L9 12.8 L4.5 9.3 L10.1 9.1 Z"/>',
    fotos: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16 L15 11 L6 19"/>',
    reels: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M10 9.2 V14.8 L14.8 12 Z"/>',
    resultados: '<path d="M4 20 H20"/><path d="M7 16 V11"/><path d="M12 16 V6"/><path d="M17 16 V9"/>',
    config: '<path d="M10 13.5 a4 4 0 0 0 5.7 0 l3 -3 a4 4 0 0 0 -5.7 -5.7 l-1.2 1.2"/><path d="M14 10.5 a4 4 0 0 0 -5.7 0 l-3 3 a4 4 0 0 0 5.7 5.7 l1.2 -1.2"/>',
    cuenta: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20 C5.7 16.2 8.5 14.2 12 14.2 S18.3 16.2 19.2 20"/>',
    soporte: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6 a2.5 2.5 0 1 1 3.4 2.3 c-.7.3-1 .8-1 1.6"/><circle cx="12" cy="16.6" r=".6" fill="currentColor" stroke="none"/>',
    admin: '<path d="M12 3.5 L19.5 6.5 V11.5 C19.5 16 16.3 19.3 12 20.5 C7.7 19.3 4.5 16 4.5 11.5 V6.5 Z"/><path d="M9 12 L11.2 14.2 L15.2 10"/>',
    instalar: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M12 7.5 V14.5 M9 11.5 L12 14.5 L15 11.5"/>',
  };
  function renderMas() {
    const n = negocioActual;
    const plan = planesInfo.find((p) => p.id === (n.plan || 'gratis')) || {};
    const reconectar = n.instagramEstado === 'reconectar';
    const totalFotos = Object.values(fotos || {}).reduce((s, a) => s + a.length, 0);
    const ig = reconectar ? '<b class="mas-falta">Instagram pide reconectar</b>'
      : n.instagramConectado ? `<b class="mas-ok">● Instagram${n.instagramUsuario ? ' @' + escapeHtml(n.instagramUsuario) : ''}</b>`
      : '<b class="mas-falta">Conectar Instagram</b>';
    const sinLeer = n.soporteSinLeer || 0;
    const fila = (clave, titulo, sub, attrs, extra) => `<${attrs.startsWith('href') ? 'a' : 'button type="button"'} class="mas-fila" ${attrs}>
        <i aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS_MAS[clave]}</svg></i>
        <span class="mas-txt"><b>${titulo}</b><small>${sub}</small></span>${extra || ''}<em aria-hidden="true">›</em>
      </${attrs.startsWith('href') ? 'a' : 'button'}>`;
    $('#mas').innerHTML = `<div class="mas-lista">
      ${fila('marca', 'Tu marca', 'Tu negocio, tu estrategia y tu estilo', 'data-ir="marca"')}
      ${fila('fotos', 'Galería', totalFotos ? `${totalFotos} foto${totalFotos === 1 ? '' : 's'}` : 'Sube las fotos de tu negocio', 'data-ir="fotos"')}
      ${fila('reels', 'Estudio de reels', 'Tus videos, cortados y con subtítulos', 'data-ir="reels"')}
      ${fila('resultados', 'Resultados', 'Cómo le va a tu Instagram', 'data-ir="resultados"', planesInfo.length && !plan.analitica ? '<span class="mas-plan">Pro</span>' : '')}
      ${fila('config', 'Cuentas conectadas', `${ig}<span>TikTok, próximamente</span>`, 'data-ir="config"')}
      ${fila('cuenta', 'Mi cuenta', `${plan.nombre ? `Plan ${escapeHtml(plan.nombre)} · ` : ''}créditos, pagos y avisos`, 'data-ir="cuenta"')}
      ${fila('soporte', 'Ayuda', 'Preguntas y soporte', 'data-ir="soporte"', sinLeer ? `<span class="nav-num" title="Respuestas nuevas">${sinLeer}</span>` : '')}
      ${n.esAdmin ? fila('admin', 'Administración', 'Clientes, pagos y soporte', 'href="/admin"') : ''}
      ${fila('instalar', 'Instalar Rubrofy', 'Ábrela como una app desde tu pantalla de inicio', 'id="btn-instalar" hidden')}
    </div>`;
    window.RubrofyPWA.mostrarBotonInstalar();
  }

  function irAVista(vista, tab, ancla) {
    if (ALIAS_MARCA[vista]) { tab = ALIAS_MARCA[vista]; vista = 'marca'; }
    // Lo que estaba en "Conexiones y ajustes" ahora vive en Tu marca y en Mi cuenta.
    if (vista === 'config' && ancla === 'cfg-marca') { vista = 'marca'; tab = 'kit'; ancla = null; }
    else if (vista === 'config' && (ancla === 'cfg-perfil' || ancla === 'cfg-datos')) { vista = 'marca'; tab = 'negocio'; if (ancla === 'cfg-perfil') ancla = null; }
    else if (vista === 'config' && ancla === 'cfg-avisos') { vista = 'cuenta'; ancla = 'cta-avisos'; }
    if (!VISTAS.includes(vista)) vista = 'inicio';
    if (vista === 'soporte' && vistaActual !== 'soporte') vistaPrevia = vistaActual;
    // Una pieza en particular: se abre el filtro donde está.
    if (vista === 'cola' && ancla && ancla.startsWith('card-')) {
      const it = contenido.find((x) => 'card-' + x.id === ancla);
      if (it) filtroCola = Object.keys(FILTROS_COLA).find((f) => FILTROS_COLA[f].incluye(it)) || filtroCola;
    }
    vistaActual = vista;
    if (vista === 'marca' && tab) tabMarca = tab;
    marcarMenu();
    for (const v of VISTAS) $('#view-' + v).hidden = v !== vista;
    render();
    const destino = ancla && document.getElementById(ancla);
    if (destino) destino.scrollIntoView({ block: 'start' });
    else $('#view-' + vista).scrollTop = 0;
  }

  // El menú: cuántas publicaciones esperan aprobación, un punto en "Más" si
  // falta conectar Instagram o hay una respuesta de soporte, y el plan.
  function renderMenu() {
    if (!negocioActual) return;
    const pendientes = contenido.filter((i) => i.status === 'pendiente').length;
    const num = $('#nav-pendientes');
    num.textContent = pendientes; num.hidden = !pendientes;
    const igFalta = !negocioActual.instagramConectado || negocioActual.instagramEstado === 'reconectar';
    $('#nav-mas-punto').hidden = !(igFalta || negocioActual.soporteSinLeer);
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    ['#nav-plan', '#top-plan'].forEach((sel) => {
      $(sel).hidden = !plan.nombre;
      $(sel).innerHTML = plan.nombre ? `Plan <b>${escapeHtml(plan.nombre)}</b>` : '';
    });
  }

  // Los avisos de arriba (plan y correo) solo en Inicio: en las demás
  // pantallas no tapan lo que se vino a hacer.
  function avisosSegunVista() {
    if (vistaActual !== 'inicio') $('#aviso-plan').hidden = true;
    if (vistaActual !== 'inicio' && vistaActual !== 'cuenta') $('#aviso-correo').hidden = true;
  }

  function render() {
    renderStats();
    renderMenu();
    renderAvisoPlan();
    renderAvisoCorreo();
    avisosSegunVista();
    if (vistaActual === 'cola') renderCola();
    else if (vistaActual === 'calendario') renderCalendario();
    else if (vistaActual === 'fotos') renderFotos();
    else if (vistaActual === 'reels') renderEstudioReels();
    else if (vistaActual === 'config') renderConfig();
    else if (vistaActual === 'mas') renderMas();
    else if (vistaActual === 'soporte') {
      window.RubrofySoporte.render(Object.assign(ctxPanel(), {
        vista: vistaPrevia,
        alLeer: () => { if (negocioActual) { negocioActual.soporteSinLeer = 0; renderMenu(); } },
      })).catch(() => {});
    }
    else if (vistaActual === 'cuenta') {
      renderPlan();
      renderAvisos();
      window.RubrofyPWA.renderTarjeta($('#push-card'), ctxPanel());
      window.RubrofyCuenta.render(Object.assign(ctxPanel(), { alCambiar: () => { renderAvisoCorreo(); avisosSegunVista(); actualizarSwitcher(); } })).catch(() => {});
    }
    else if (vistaActual === 'marca') renderMarca();
    else if (vistaActual === 'resultados') renderResultados();
    else if (vistaActual === 'inicio') window.RubrofyInicio.render($('#inicio'), ctxPanel()).catch(() => {});
  }

  // Lo que necesitan Inicio, Estrategia y la bienvenida del resto del panel.
  function ctxPanel() {
    const plan = planesInfo.find((p) => p.id === (negocioActual.plan || 'gratis')) || {};
    return {
      api,
      negocio: negocioActual,
      contenido,
      fotos,
      estrategia: nichoActual,
      planActual: negocioActual.planContenido || null,
      planIncluye: (clave) => !!plan[clave],
      planes: planesInfo,
      fechaCorta,
      fechaAmigable,
      formatoDe,
      miniatura: (it) => disenoDe(it) || fotoDe(it),
      abrirCrear,
      irA: irAVista,
      abrirBienvenida,
      abrirGenerar,
      guardarDatos: (datos) => guardarConfig({ nombre: negocioActual.nombre, datos, estiloImagen: negocioActual.estiloImagen }),
      setNegocio: (n) => { negocioActual = n; actualizarSwitcher(); },
      verCola,
      setEstrategia: (e) => { nichoActual = e; negocioActual.estrategia = e; },
      recargarContenido: () => api('/api/negocios/' + negocioActual.id + '/contenido').then((c) => { contenido = c; renderStats(); renderMenu(); }).catch(() => {}),
    };
  }

  // Bienvenida: se abre sola mientras el negocio no la termine.
  // Sin la bienvenida hecha: completa. Hecha pero sin perfil (cuentas de
  // antes): solo "Tu negocio" y "Lo que vendes".
  function abrirBienvenida() {
    const base = ctxPanel();
    const soloPerfil = !!negocioActual.bienvenidaCompletada && !negocioActual.perfilCompleto;
    window.RubrofyBienvenida.abrir(Object.assign({}, base, {
      negocio: () => negocioActual,
      estrategia: () => nichoActual,
      generarSemana: () => generarSemana(),
      alTerminar: (generado) => { window.RubrofyInicio.invalidar(); irAVista(generado ? 'cola' : (soloPerfil ? vistaActual : 'inicio')); },
    }), { soloPerfil }).catch(() => {});
  }

  // "Generar mi semana": muestra qué se va a crear según el plan y lo genera.
  function abrirGenerar() {
    if (negocioActual.sinPlan) {
      // Sin plan no se genera: se destaca el aviso (en Inicio) para elegir uno.
      if (vistaActual !== 'inicio') irAVista('inicio');
      renderAvisoPlan();
      const aviso = $('#aviso-plan');
      aviso.classList.remove('destello');
      void aviso.offsetWidth;
      aviso.classList.add('destello');
      aviso.scrollIntoView({ block: 'nearest' });
      return;
    }
    const dlg = $('#dlg-generar');
    const pc = negocioActual.planContenido;
    const total = pc ? Object.values(pc.semanal).reduce((a, b) => a + b, 0) : 6;
    $('#dlg-generar-texto').innerHTML = pc
      ? window.RubrofyPlan.textoTotal(pc.semanal) + (total > 12 ? '. Se crean 12 por vez: vuelve a generar para completar la semana.' : '.')
      : 'Se crearán 6 publicaciones. Define tu plan en <b>Más → Tu marca → Estrategia</b> para elegir cuántos posts, carruseles, reels e historias quieres.';
    $('#dlg-generar-fechas').textContent = 'Siguen después de lo que ya tienes programado y llegan a Publicaciones, para que las apruebes.';
    $('#dlg-generar-error').hidden = true;
    $('#dlg-generar-indicaciones').value = '';
    $('#dlg-generar-ok').textContent = 'Generar';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (window.RubrofyBrief) window.RubrofyBrief.cargarParaGenerar($('#dlg-generar-brief'));
  }

  async function generarSemana(brief) {
    contenido = await api(`/api/negocios/${negocioActual.id}/generar`, {
      method: 'POST',
      body: JSON.stringify(Object.assign(negocioActual.planContenido ? { segunPlan: true } : { cantidad: 6 }, { indicaciones: ($('#dlg-generar-indicaciones') || {}).value || '', brief })),
    });
    render();
  }

  function leerArchivoComoBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // La foto se prepara en el navegador (imagen.js): JPEG de hasta 2048 px,
  // derecha y en un formato que se ve en todos lados (las del iPhone vienen en HEIC).
  async function subirFoto(categoria, original) {
    const file = window.RubrofyImagen ? await window.RubrofyImagen.preparar(original) : original;
    const dataBase64 = await leerArchivoComoBase64(file);
    fotos = await api(`/api/negocios/${negocioActual.id}/fotos`, {
      method: 'POST',
      body: JSON.stringify({ categoria, filename: file.name, dataBase64 }),
    });
  }

  // Sube el video elegido en un input[data-video-id] (tarjeta o Estudio de
  // reels). Con data-video-editar, al terminar abre el editor de Rubrofy.
  async function subirVideoDesde(el) {
    const inputVideo = el.closest && el.closest('input[data-video-id]');
    if (!inputVideo || !inputVideo.files[0]) return false;
    const id = inputVideo.dataset.videoId;
    const etiqueta = inputVideo.closest('label');
    if (etiqueta) etiqueta.firstChild.textContent = 'Subiendo video…';
    let ok = false;
    try {
      await subirVideo(id, inputVideo.files[0]);
      ok = true;
    } catch (err) {
      alert(err.message);
    }
    await refreshContenido().catch(() => {});
    const er = negocioActual.edicionReels || {};
    if (ok && inputVideo.dataset.videoEditar && er.disponible) {
      const it = contenido.find((x) => x.id === id);
      if (it && it.video) window.RubrofyReels.abrir(it);
    }
    return true;
  }

  async function borrarFoto(categoria, archivo) {
    fotos = await api(`/api/negocios/${negocioActual.id}/fotos/${encodeURIComponent(categoria)}/${encodeURIComponent(archivo)}`, { method: 'DELETE' });
  }

  // El nombre del negocio es el título de Inicio.
  function actualizarSwitcher() { marcarMenu(); }

  async function guardarConfig(datos) {
    negocioActual = await api(`/api/negocios/${negocioActual.id}`, { method: 'PUT', body: JSON.stringify(datos) });
    actualizarSwitcher();
  }

  async function eliminarNegocioActual() {
    await api(`/api/negocios/${negocioActual.id}`, { method: 'DELETE' });
    mostrarLogin();
  }

  // ---------- acciones ----------
  // Mientras haya videos con IA generándose, la cola se refresca sola.
  let vigilancia = null;
  function vigilarVideos() {
    const hay = contenido.some((i) => (i.videoIA && i.videoIA.estado === 'generando') || (i.edicion && i.edicion.estado === 'editando') || (i.union && i.union.estado === 'uniendo'));
    if (hay && !vigilancia) {
      vigilancia = setInterval(() => {
        if ((vistaActual !== 'cola' && vistaActual !== 'reels') || document.hidden || colaOcupada()) return;
        refreshContenido().catch(() => {});
      }, 10000);
    } else if (!hay && vigilancia) {
      clearInterval(vigilancia);
      vigilancia = null;
    }
  }

  // Vuelve a leer el negocio (saldo de créditos, cupos) sin recargar la página.
  async function refrescarNegocio() {
    negocioActual = await api('/api/me');
    if (window.RubrofyCreditos) window.RubrofyCreditos.pintarChip();
  }

  async function refreshContenido() {
    contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
    render();
  }
  // Refrescar solo redibujaría las tarjetas: no se hace mientras se ve un
  // video o está abierto el menú de una pieza.
  const colaOcupada = () => [...document.querySelectorAll('#cola-grid video')].some((v) => !v.paused) || !!($('#dlg-hoja') && $('#dlg-hoja').open);

  async function accionSimple(accion, id) {
    await api(`/api/negocios/${negocioActual.id}/contenido/${id}/${accion}`, { method: 'POST' });
    await refreshContenido();
  }

  // Igual que accionSimple, pero avisa si falla. Un 409 en "aprobar" es un
  // doble clic mientras la pieza se publica: no es un error, solo se refresca.
  async function accionConAviso(accion, id) {
    try {
      await accionSimple(accion, id);
    } catch (err) {
      if (err.status === 409) return refreshContenido();
      alert(err.mensaje || 'No se pudo completar la acción. Intenta de nuevo.');
      refreshContenido().catch(() => {}); // re-renderiza y vuelve a habilitar los botones
    }
  }

  async function guardarEdicion(id, caption, hashtags) {
    await api(`/api/negocios/${negocioActual.id}/contenido/${id}/editar`, {
      method: 'PUT',
      body: JSON.stringify(hashtags === undefined ? { caption } : { caption, hashtags }),
    });
    editingIds.delete(id);
    await refreshContenido();
  }

  // Si la pieza está abierta en "Editar", guarda lo escrito antes de otra
  // acción (aprobar sin pulsar "Guardar" perdía lo editado). false si falló.
  async function guardarSiEdita(id) {
    if (!editingIds.has(id)) return true;
    const textarea = document.querySelector(`textarea[data-id="${id}"]`);
    const tags = document.querySelector(`input[data-hashtags-id="${id}"]`);
    if (!textarea) { editingIds.delete(id); return true; }
    try {
      await api(`/api/negocios/${negocioActual.id}/contenido/${id}/editar`, {
        method: 'PUT',
        body: JSON.stringify(tags ? { caption: textarea.value, hashtags: tags.value } : { caption: textarea.value }),
      });
      editingIds.delete(id);
      return true;
    } catch (err) {
      alert(err.mensaje || 'No se pudo guardar el texto. Revísalo y vuelve a intentar.');
      return false;
    }
  }

  async function generarMas() {
    const btn = $('#dlg-generar-ok');
    btn.disabled = true;
    btn.textContent = 'Generando…';
    let revisar = false;
    try {
      // Con brief escrito: primero se ordena y se muestra cómo lo entendió
      // Rubrofy; el segundo clic genera con ese brief.
      let brief;
      if (window.RubrofyBrief) {
        btn.textContent = 'Ordenando el brief…';
        const r = await window.RubrofyBrief.antesDeGenerar($('#dlg-generar-brief'));
        if (!r.listo) {
          revisar = true;
          if (r.total) $('#dlg-generar-texto').innerHTML = `Según tu brief se crearán <b>${r.total}</b> publicaciones esta semana.`;
          return;
        }
        brief = r.brief;
        btn.textContent = 'Generando…';
      }
      await generarSemana(brief);
      $('#dlg-generar').close();
      irAVista('cola');
    } catch (err) {
      if (err.status === 402) {
        $('#dlg-generar').close();
        negocioActual.sinPlan = true;
        return abrirGenerar();
      }
      $('#dlg-generar-error').textContent = err.mensaje || 'No se pudo generar contenido. Intenta de nuevo.';
      $('#dlg-generar-error').hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = revisar ? 'Generar con este brief' : 'Generar';
    }
  }

  // ---------- login / sesión ----------
  function mostrarLogin(mensaje) {
    negocioActual = null;
    if (window.RubrofyVideos) window.RubrofyVideos.olvidar();
    $('#view-app').hidden = true;
    $('#view-login').hidden = false;
    $('#login-error').hidden = !mensaje;
    if (mensaje) $('#login-error').textContent = mensaje;
    $('#login-email').focus();
  }

  async function mostrarApp() {
    const [contenidoData, estrategiaData, fotosData, planesData] = await Promise.all([
      api('/api/negocios/' + negocioActual.id + '/contenido'),
      api('/api/negocios/' + negocioActual.id + '/estrategia'),
      api('/api/negocios/' + negocioActual.id + '/fotos'),
      api('/api/planes'),
    ]);
    contenido = contenidoData;
    nichoActual = estrategiaData;
    if (window.RubrofyDiseno) {
      window.RubrofyDiseno.iniciar({
        api,
        negocio: () => negocioActual,
        setNegocio: (n) => { negocioActual = n; },
        irA: irAVista,
        recargarContenido: async () => { contenido = await api('/api/negocios/' + negocioActual.id + '/contenido'); render(); },
      });
    }
    if (window.RubrofyVideos) {
      window.RubrofyVideos.iniciar({
        api,
        negocio: () => negocioActual,
        contenido: () => contenido,
        formatoDe,
        irAVista,
        recargar: async () => {
          negocioActual = await api('/api/me');
          contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
          render();
        },
      });
    }
    if (window.RubrofyBrief) {
      window.RubrofyBrief.iniciar({
        api,
        negocio: () => negocioActual,
        contenido: () => contenido,
        setContenido: (c) => { contenido = c; },
        irAVista,
        ayuda: (k) => (window.Ayuda ? window.Ayuda.boton(k) : ''),
        cerrarGenerar: () => $('#dlg-generar').close(),
        recargar: async () => {
          negocioActual = await api('/api/me');
          contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
          render();
        },
      });
    }
    if (window.RubrofyReels) {
      window.RubrofyReels.iniciar({
        api,
        negocio: () => negocioActual,
        recargar: async () => {
          negocioActual = await api('/api/me');
          contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
          render();
        },
      });
    }
    if (window.RubrofyGaleria) {
      window.RubrofyGaleria.iniciar({
        api,
        negocio: () => negocioActual,
        setNegocio: (n) => { negocioActual = n; },
        fotos: () => fotos,
        setFotos: (f) => { fotos = f; },
        subirFoto,
        borrarFoto,
        refrescar: async () => {
          negocioActual = await api('/api/me');
          contenido = await api('/api/negocios/' + negocioActual.id + '/contenido');
          render();
        },
      });
    }
    if (window.RubrofyRecargas) {
      window.RubrofyRecargas.iniciar({
        api,
        negocio: () => negocioActual,
        setNegocio: (n) => { negocioActual = n; },
        irA: irAVista,
        alCerrar: () => render(),
      });
      if (window.RubrofyCreditos) window.RubrofyCreditos.iniciar({
        api,
        negocio: () => negocioActual,
        setNegocio: (n) => { negocioActual = n; },
        irA: irAVista,
        alCerrar: () => refrescarNegocio().then(render).catch(() => render()),
      });
    }
    fotos = fotosData;
    planesInfo = planesData;
    editingIds.clear();
    if (window.RubrofyCalendario) window.RubrofyCalendario.reiniciar();
    actualizarSwitcher();
    $('#view-login').hidden = true;
    $('#view-app').hidden = false;
    vistaActual = 'inicio';
    // Enlaces de las notificaciones y los correos: /app#cola, /app#cuenta…
    const destino = window.location.hash.slice(1);
    irAVista(VISTAS.includes(destino) || ALIAS_MARCA[destino] ? destino : 'inicio');
    if (destino) history.replaceState(null, '', window.location.pathname + window.location.search);
    const volvioDeOAuth = /[?&]instagram=/.test(window.location.search);
    avisarRetornoCorreo();
    avisarRetornoCheckout();
    avisarRetornoRecarga();
    avisarRetornoInstagram();
    let yaPregunto = false;
    try { yaPregunto = sessionStorage.getItem('rubrofy-perfil-' + negocioActual.id) === '1'; sessionStorage.setItem('rubrofy-perfil-' + negocioActual.id, '1'); } catch (err) { yaPregunto = false; }
    if (!volvioDeOAuth && (!negocioActual.bienvenidaCompletada || (!negocioActual.perfilCompleto && !yaPregunto))) abrirBienvenida();
  }

  // Vuelta de "Conectar con Instagram": avisa si falló y abre Cuentas conectadas.
  function avisarRetornoInstagram() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('instagram');
    if (!r) return false;
    history.replaceState(null, '', '/app');
    if (r === 'error') alert(params.get('motivo') || 'No se pudo conectar Instagram.');
    irAVista(r === 'ok' ? 'inicio' : 'config');
    return true;
  }

  // Tras volver de Stripe Checkout (éxito o cancelado), refresca el negocio
  // por si el webhook ya actualizó el plan, avisa, y limpia la URL.
  // Vuelta de pagar una recarga: el webhook de Stripe la acredita en segundos.
  async function avisarRetornoRecarga() {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('recarga');
    if (!r) return;
    history.replaceState(null, '', window.location.pathname);
    if (r !== 'exito') return;
    const antes = JSON.stringify(negocioActual.saldos || {});
    for (let i = 0; i < 10; i++) {
      negocioActual = await api('/api/me');
      if (JSON.stringify(negocioActual.saldos || {}) !== antes) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
    render();
    alert(JSON.stringify(negocioActual.saldos || {}) !== antes
      ? '¡Listo! Tu recarga ya está disponible.'
      : 'Recibimos tu pago. La recarga aparecerá en unos segundos: recarga la página si no la ves.');
  }

  async function avisarRetornoCheckout() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('brief')) { history.replaceState(null, '', window.location.pathname + window.location.hash); setTimeout(abrirGenerar, 400); }
    const resultado = params.get('checkout');
    if (!resultado) return;
    history.replaceState(null, '', window.location.pathname);
    if (resultado === 'tarjeta') { alert('No se pudo inscribir la tarjeta. Intenta de nuevo o usa otra tarjeta.'); return; }
    if (resultado === 'error') { alert('No pudimos confirmar tu suscripción. Recarga la página en unos minutos; si no se activa tu plan, escríbenos.'); return; }
    if (resultado === 'tarjeta-ok') { negocioActual = await api('/api/me'); render(); alert('Listo, tu tarjeta quedó registrada.'); return; }
    if (resultado === 'pendiente') { negocioActual = await api('/api/me'); render(); alert('Mercado Pago está confirmando tu suscripción. Tu plan se activa apenas la apruebe (suele tardar unos minutos): recarga la página en un rato.'); return; }
    if (resultado !== 'exito') return;
    // El aviso del pago puede tardar unos segundos en activar el plan.
    for (let i = 0; i < 10; i++) {
      negocioActual = await api('/api/me');
      if (!negocioActual.sinPlan) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    render();
    if (negocioActual.sinPlan) {
      alert('Recibimos tu pago. Tu plan se activará en unos segundos: recarga la página si no lo ves.');
      return;
    }
    const plan = planesInfo.find((p) => p.id === negocioActual.plan) || {};
    // Recién suscrito después de la bienvenida: se crea la primera semana.
    if (negocioActual.bienvenidaCompletada && !contenido.length) {
      try {
        await generarSemana();
        irAVista('cola');
        alert(`¡Listo! Tu plan ${plan.nombre || ''} está activo y tu primera semana te espera en Publicaciones.`);
        return;
      } catch (err) { /* se genera después con el botón */ }
    }
    alert(`¡Listo! Tu plan ${plan.nombre || ''} está activo.`);
  }

  async function iniciarSesion(email, password) {
    negocioActual = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await mostrarApp();
  }

  async function cerrarSesion() {
    await api('/api/auth/logout', { method: 'POST' });
    mostrarLogin();
  }

  async function init() {
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn-login');
      btn.disabled = true;
      try {
        await iniciarSesion($('#login-email').value.trim(), $('#login-password').value);
      } catch (err) {
        mostrarLogin(err.status === 401 ? 'Email o clave incorrectos.'
          : err.status === 429 || err.status === 403 ? err.mensaje
          : 'No se pudo iniciar sesión.');
      } finally {
        btn.disabled = false;
      }
    });
    $('#view-marca').addEventListener('click', (e) => {
      const t = e.target.closest('[data-marca-tab]');
      if (!t) return;
      tabMarca = t.dataset.marcaTab;
      renderMarca();
    });
    $('#btn-logout-cuenta').addEventListener('click', () => {
      cerrarSesion().catch((err) => alert('No se pudo cerrar sesión: ' + err.message));
    });

    // Mi cuenta: desde el plan (arriba o en el menú) y los enlaces "Plan y pagos".
    ['#top-plan', '#nav-plan'].forEach((sel) => $(sel).addEventListener('click', () => { if (negocioActual) irAVista('cuenta', null, 'cta-plan'); }));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-ir-cuenta]')) return;
      e.preventDefault();
      irAVista('cuenta', null, 'cta-plan');
    });

    // saldo de créditos ⚡ arriba: abre la compra
    $('#creditos-chip').addEventListener('click', () => window.RubrofyCreditos && window.RubrofyCreditos.abrirComprar());

    // Publicaciones: filtros (por aprobar, programadas, publicadas).
    $('#cola-filtros').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cola-filtro]');
      if (b) verCola(b.dataset.colaFiltro);
    });

    // navegación: el menú, "Crear", volver a "Más" y sus filas
    document.querySelectorAll('.nav-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => irAVista(btn.dataset.view));
    });
    $('#btn-crear').addEventListener('click', abrirCrear);
    // Un aviso o un correo abierto con el panel ya en pantalla solo cambia
    // el "#…" de la dirección: se va a esa pantalla igual.
    window.addEventListener('hashchange', () => {
      const destino = window.location.hash.slice(1);
      if (!negocioActual || !destino) return;
      history.replaceState(null, '', window.location.pathname + window.location.search);
      irAVista(destino);
    });
    $('#top-volver').addEventListener('click', () => irAVista('mas'));
    $('#mas').addEventListener('click', (e) => {
      if (e.target.closest('#btn-instalar')) return window.RubrofyPWA.instalar();
      const f = e.target.closest('[data-ir]');
      if (f) irAVista(f.dataset.ir);
    });

    // fotos: subir y borrar (delegación)

    // conexión con Instagram
    $('#form-instagram').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.submitter;
      $('#ig-error').hidden = true;
      btn.disabled = true;
      try {
        negocioActual = await api(`/api/negocios/${negocioActual.id}/instagram`, {
          method: 'PUT',
          body: JSON.stringify({ userId: $('#ig-user-id').value.trim(), accessToken: $('#ig-token').value.trim() }),
        });
        renderConfig();
      } catch (err) {
        $('#ig-error').textContent = 'No se pudo conectar: revisa el ID y el token.';
        $('#ig-error').hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
    $('#avisos-semanal').addEventListener('change', async (e) => {
      try {
        negocioActual = await api(`/api/negocios/${negocioActual.id}/avisos`, { method: 'PUT', body: JSON.stringify({ semanal: e.target.checked }) });
        renderAvisos();
      } catch (err) {
        e.target.checked = !e.target.checked;
        $('#avisos-error').textContent = err.mensaje || 'No se pudo guardar.';
        $('#avisos-error').hidden = false;
      }
    });
    $('#btn-avisos-prueba').addEventListener('click', async (e) => {
      const b = e.target;
      b.disabled = true;
      $('#avisos-error').hidden = true;
      $('#avisos-ok').hidden = true;
      try {
        const r = await api(`/api/negocios/${negocioActual.id}/avisos/prueba`, { method: 'POST' });
        $('#avisos-ok').textContent = 'Enviado a ' + r.para + '. Revisa también la carpeta de spam.';
        $('#avisos-ok').hidden = false;
      } catch (err) {
        $('#avisos-error').textContent = err.mensaje || 'No se pudo enviar.';
        $('#avisos-error').hidden = false;
      } finally {
        b.disabled = false;
      }
    });

    // "Rol de desarrollador insuficiente": la solicitud a soporte queda escrita.
    $('#btn-ig-revision').addEventListener('click', () => {
      const ig = (negocioActual.perfil || {}).instagram;
      window.RubrofySoporte.escribir({
        tipo: 'problema',
        asunto: 'Habilitar mi Instagram en Rubrofy',
        texto: `Al conectar Instagram me aparece "Rol de desarrollador insuficiente". Mi usuario de Instagram es: ${ig ? '@' + ig : '(escríbelo aquí)'}`,
      });
      irAVista('soporte');
    });

    $('#btn-desconectar-ig').addEventListener('click', async () => {
      if (!confirm('¿Desconectar Instagram? Las próximas aprobaciones no se publicarán solas.')) return;
      negocioActual = await api(`/api/negocios/${negocioActual.id}/instagram`, { method: 'DELETE' });
      renderConfig();
    });

    // plan: subir de plan (Stripe Checkout) o gestionar la suscripción (Billing Portal)
    // Código de descuento: con suscripción vigente se aplica al tiro; si no,
    // se revisa y se usa al elegir el plan.
    $('#plan-card').addEventListener('submit', async (e) => {
      const form = e.target.closest('[data-codigo-form]');
      if (!form) return;
      e.preventDefault();
      const errorEl = $('#plan-error');
      errorEl.hidden = true;
      const codigo = form.codigo.value.trim();
      if (!codigo) return;
      const btn = form.querySelector('button');
      btn.disabled = true;
      try {
        const r = await api(`/api/negocios/${negocioActual.id}/codigo`, { method: 'POST', body: JSON.stringify({ codigo }) });
        if (r.aplicado) {
          negocioActual = r.negocio;
          codigoDescuento = null;
          render();
          alert('Listo, el descuento quedó aplicado a tu suscripción.');
          return;
        }
        codigoDescuento = r;
        renderPlan();
      } catch (err) {
        errorEl.textContent = err.mensaje || 'No se pudo revisar el código.';
        errorEl.hidden = false;
        btn.disabled = false;
      }
    });

    $('#plan-card').addEventListener('click', async (e) => {
      if (e.target.closest('[data-abrir-prueba]')) return abrirPrueba();
      const per = e.target.closest('[data-periodo]');
      if (per) { periodoPlan = per.dataset.periodo; return renderPlan(); }
      const btnCheckout = e.target.closest('[data-checkout-plan]');
      if (btnCheckout) return pagarPlan(btnCheckout, $('#plan-error'));
      const btnFlow = e.target.closest('[data-action="flow-tarjeta"], [data-action="flow-cancelar"], [data-action="flow-reanudar"]');
      if (btnFlow) {
        let accion = btnFlow.dataset.action.replace('flow-', '');
        if (accion === 'cancelar') {
          // Antes de cancelar: pausar un mes sin cobro.
          const eleccion = await preguntarPausa();
          if (!eleccion) return;
          accion = eleccion;
        }
        if (accion === 'reanudar' && !confirm('¿Reanudar tu plan ahora? Si el período que pagaste todavía no termina, se reanuda justo cuando termine; si ya terminó, se cobra ahora con tu tarjeta.')) return;
        const errorEl = $('#plan-error');
        errorEl.hidden = true;
        btnFlow.disabled = true;
        try {
          const r = await api(`/api/negocios/${negocioActual.id}/suscripcion/${accion}`, { method: 'POST', body: accion === 'pausar' ? JSON.stringify({ meses: 1 }) : undefined });
          if (r.url) { window.location.href = r.url; return; }
          negocioActual = r.negocio;
          render();
        } catch (err) {
          errorEl.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.';
          errorEl.hidden = false;
          btnFlow.disabled = false;
        }
        return;
      }
      const btnPortal = e.target.closest('[data-action="portal"]');
      if (!btnPortal) return;
      const errorEl = $('#plan-error');
      errorEl.hidden = true;
      btnPortal.disabled = true;
      try {
        const resultado = await api(`/api/negocios/${negocioActual.id}/portal`, { method: 'POST' });
        if (resultado.url) window.location.href = resultado.url;
      } catch (err) {
        errorEl.textContent = err.mensaje || 'No se pudo continuar. Intenta de nuevo en un momento.';
        errorEl.hidden = false;
        btnPortal.disabled = false;
      }
    });

    // configuración: guardar cambios / eliminar negocio
    $('#form-config').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#config-error').hidden = true;
      $('#config-ok').hidden = true;
      try {
        await guardarConfig({
          nombre: $('#config-nombre').value,
          datos: {
            precioDesde: $('#config-precio').value,
            unidad: $('#config-unidad').value,
            promo: $('#config-promo').value,
            productoDestacado: $('#config-producto').value,
          },
          estiloImagen: $('#config-estilo-imagen').value,
        });
        $('#config-ok').hidden = false;
      } catch (err) {
        $('#config-error').textContent = err.message;
        $('#config-error').hidden = false;
      }
    });
    $('#btn-eliminar-negocio').addEventListener('click', () => {
      if (!negocioActual) return;
      const confirmado = confirm(`¿Eliminar "${negocioActual.nombre}"? Se borra tu cuenta, tu contenido, tus fotos y los créditos que te queden. Esta acción no se puede deshacer.`);
      if (confirmado) eliminarNegocioActual().catch((err) => alert('No se pudo eliminar: ' + err.message));
    });

    $('#aviso-correo').addEventListener('click', async (e) => {
      const re = e.target.closest('[data-correo-reenviar]');
      if (re) {
        re.disabled = true;
        try {
          await api(`/api/negocios/${negocioActual.id}/cuenta/verificar`, { method: 'POST', body: '{}' });
          re.textContent = 'Enviado ✓ (revisa también spam)';
        } catch (err) { alert(err.mensaje || 'No se pudo enviar.'); re.disabled = false; }
        return;
      }
      if (e.target.closest('[data-correo-cambiar]')) {
        irAVista('cuenta', null, 'cta-perfil');
        if (window.RubrofyCuenta) window.RubrofyCuenta.abrirCambioCorreo();
      }
    });
    $('#aviso-plan').addEventListener('click', (e) => {
      if (e.target.closest('[data-ir-plan]')) return irAVista('cuenta', null, 'cta-plan');
      if (e.target.closest('[data-abrir-prueba]')) return abrirPrueba();
      if (e.target.closest('[data-recargar]')) return window.RubrofyRecargas.abrir('piezas');
      if (e.target.closest('[data-ocultar-pocas]')) {
        pocasOcultas = true;
        try { sessionStorage.setItem('rubrofy-pocas', '1'); } catch (err) { /* sin almacenamiento */ }
        return renderAvisoPlan();
      }
      const btn = e.target.closest('[data-checkout-plan]');
      if (btn) pagarPlan(btn, $('#aviso-plan [data-pago-error]'));
    });
    $('#dlg-generar-ok').addEventListener('click', generarMas);
    $('#dlg-generar-cancelar').addEventListener('click', () => $('#dlg-generar').close());
    $('#dlg-generar-plan').addEventListener('click', () => { $('#dlg-generar').close(); irAVista('estrategia'); });

    // Acciones de una publicación: desde su tarjeta o desde su menú "⋯".
    accionPieza = async (btn) => {
      const id = btn.dataset.id;
      const accion = btn.dataset.action;

      if (accion === 'generar') return abrirGenerar();
      if (accion === 'mas') {
        const it = contenido.find((x) => x.id === id);
        if (it) abrirOpciones(it);
        return;
      }
      if (accion === 'cancelar-edit') { editingIds.delete(id); renderCola(); return; }
      if (accion === 'play') {
        const v = btn.parentElement.querySelector('video');
        if (v) { v.controls = true; v.muted = false; btn.hidden = true; v.play().catch(() => {}); }
        return;
      }
      if (accion === 'carrusel-paso') {
        const img = btn.parentElement.querySelector('img[data-carrusel]');
        if (!img) return;
        const urls = JSON.parse(img.dataset.carrusel);
        const i = (Number(img.dataset.i) + Number(btn.dataset.paso) + urls.length) % urls.length;
        img.dataset.i = i;
        img.src = urls[i];
        const tarjeta = btn.closest('.pz');
        tarjeta.querySelectorAll('.pz-puntos i').forEach((p, k) => p.classList.toggle('on', k === i));
        const n = tarjeta.querySelector('[data-carrusel-n]');
        if (n) n.textContent = i + 1;
        return;
      }
      if (accion === 'formato') {
        const it = contenido.find((x) => x.id === id);
        if (!it || formatoDe(it) === btn.dataset.formato) return;
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${id}/formato`, { method: 'PUT', body: JSON.stringify({ formato: btn.dataset.formato }) });
        } catch (err) {
          alert(err.mensaje || 'No se pudo cambiar el formato.');
        }
        await refreshContenido().catch(() => {});
        return;
      }

      if (accion === 'toggle-edit') {
        if (editingIds.has(id)) {
          const textarea = document.querySelector(`textarea[data-id="${id}"]`);
          const tags = document.querySelector(`input[data-hashtags-id="${id}"]`);
          await guardarEdicion(id, textarea ? textarea.value : '', tags ? tags.value : undefined);
        } else {
          editingIds.add(id);
          renderCola();
          enfocarEdicion(id);
        }
        return;
      }
      if (accion === 'expandir') {
        const abrir = !abiertasIds.has(id);
        if (abrir) abiertasIds.add(id); else abiertasIds.delete(id);
        const tarjeta = btn.closest('.pz');
        if (tarjeta) tarjeta.classList.toggle('abierta', abrir);
        return;
      }
      if (accion === 'medio') {
        const it = contenido.find((x) => x.id === id);
        const nuevo = btn.dataset.medio;
        if (!it || medioDe(it) === nuevo) return;
        const f = formatoDe(it);
        let ruta = 'medio';
        let cuerpo = { medio: nuevo };
        // Post y carrusel son de imagen y un Reel es video: se cambia el formato.
        if (f !== 'historia') {
          const msg = nuevo === 'video'
            ? `En Instagram, un video en el feed se publica como Reel. ¿Cambiar ${f === 'carrusel' ? 'este carrusel' : 'este post'} a Reel?`
            : 'Un Reel siempre es video. ¿Cambiarlo a Post con imagen?';
          if (!confirm(msg)) return;
          ruta = 'formato';
          cuerpo = { formato: nuevo === 'video' ? 'reel' : 'post' };
        }
        btn.disabled = true;
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${id}/${ruta}`, { method: 'PUT', body: JSON.stringify(cuerpo) });
        } catch (err) {
          alert(err.mensaje || 'No se pudo cambiar.');
        }
        await refreshContenido().catch(() => {});
        return;
      }
      if (accion === 'elegir-video') {
        const it = contenido.find((x) => x.id === id);
        if (it) window.RubrofyVideos.elegirParaReel(it);
        return;
      }
      if (accion === 'editar-reel') {
        const it = contenido.find((x) => x.id === id);
        if (it) window.RubrofyReels.abrir(it);
        return;
      }
      if (accion === 'elegir-foto') {
        const it = contenido.find((x) => x.id === id);
        if (!it) return;
        if (formatoDe(it) === 'carrusel') window.RubrofyGaleria.abrirCarrusel(it, (it.fotosCarrusel || []).length ? fotosCarruselDe(it) : []);
        else window.RubrofyGaleria.abrirSelector(it, btn.dataset.pest);
        return;
      }
      if (accion === 'video-original') {
        btn.disabled = true;
        try { await api(`/api/negocios/${negocioActual.id}/contenido/${id}/video-original`, { method: 'POST' }); await refreshContenido(); }
        catch (err) { alert(err.mensaje || 'No se pudo volver al original.'); btn.disabled = false; }
        return;
      }
      if (accion === 'disenar') {
        const it = contenido.find((x) => x.id === id);
        if (it) window.RubrofyDiseno.abrirEditor(it, btn.dataset.foto, formatoDe(it));
        return;
      }
      if (accion === 'copiar') {
        // El mismo texto que se publica: la versión elegida más sus hashtags.
        const it = contenido.find((x) => x.id === id);
        if (!it) return;
        const base = it.variants[it.variantIndex] || '';
        const tags = (it.hashtags || []).filter((h) => !base.toLowerCase().includes(h.toLowerCase()));
        const texto = tags.length ? base + '\n\n' + tags.join(' ') : base;
        try {
          await navigator.clipboard.writeText(texto);
          (btn.querySelector('span') || btn).textContent = 'Copiado ✓';
        } catch (err) {
          prompt('Copia el texto:', texto);
        }
        return;
      }
      if (['approve', 'publish-now', 'retry', 'undo'].includes(accion)) {
        btn.disabled = true;
        if (!(await guardarSiEdita(id))) { btn.disabled = false; return; }
      }
      if (accion === 'approve') {
        // la publicación en Instagram puede tardar unos segundos
        await accionConAviso('aprobar', id);
        const it = contenido.find((x) => x.id === id);
        if (it && it.status === 'aprobado' && filtroColaActual() === 'pendientes') {
          avisoCola(it.publicacion && it.publicacion.estado === 'programada' ? `Aprobada ✓ Se publica el ${fechaCorta(it.publicarEl || it.publicacion.proximoIntento)}.` : 'Aprobada ✓', 'Ver programadas', () => verCola('programadas'));
        }
        return;
      }
      if (accion === 'reject') return accionConAviso('rechazar', id);
      if (accion === 'publish-now') {
        btn.disabled = true;
        return accionConAviso('publicar-ahora', id);
      }
      if (accion === 'retry') {
        btn.disabled = true;
        return accionConAviso('reintentar', id);
      }
      if (accion === 'quitar-video') {
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${id}/video`, { method: 'DELETE' });
          await refreshContenido();
        } catch (err) {
          alert(err.mensaje || 'No se pudo quitar el video.');
        }
        return;
      }
      if (accion === 'fecha') {
        fechaEditIds.add(id);
        renderCola();
        const input = document.querySelector(`input[data-fecha-id="${id}"]`);
        if (input) input.focus();
        return;
      }
      if (accion === 'undo') {
        const item = contenido.find((i) => i.id === id);
        if (item && item.instagram && item.instagram.ok) {
          const seguir = confirm('Esta pieza ya está publicada en Instagram. Deshacer la devuelve a pendiente en Rubrofy, pero NO la borra de Instagram (eso se hace desde la app de Instagram). Si la vuelves a aprobar, no se publicará de nuevo.');
          if (!seguir) { btn.disabled = false; return; }
        }
        return accionConAviso('deshacer', id);
      }
      if (accion === 'regenerate') return accionConAviso('regenerar', id);
      if (accion === 'pedir' || accion === 'cancelar-pedir') {
        if (accion === 'pedir') pedirCambioIds.add(id); else pedirCambioIds.delete(id);
        renderCola();
        const input = document.querySelector(`form[data-pedir-id="${id}"] input`);
        if (input) input.focus();
        return;
      }
      if (accion === 'video-ia') {
        // Primero se elige calidad y duración (con su costo en créditos ⚡).
        const eleccion = window.RubrofyCreditos ? await window.RubrofyCreditos.elegir({ tipo: 'video' }) : { calidad: 'recomendada', segundos: 5 };
        if (!eleccion) return;
        const textoAntes = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Iniciando…';
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${id}/video-ia`, { method: 'POST', body: JSON.stringify(eleccion) });
          await refrescarNegocio();
          await refreshContenido();
        } catch (err) {
          if (!err.recargar) alert(err.mensaje || 'No se pudo iniciar el video con IA.');
          btn.disabled = false;
          btn.textContent = textoAntes;
        }
        return;
      }
      if (accion === 'imagen-otra') {
        btn.disabled = true;
        btn.textContent = 'Generando…';
        try {
          await api(`/api/negocios/${negocioActual.id}/contenido/${id}/imagen`, { method: 'POST', body: JSON.stringify({ rehacer: true }) });
          await refreshContenido();
        } catch (err) {
          alert(err.mensaje || 'No se pudo generar otra imagen.');
          btn.disabled = false;
          btn.textContent = 'Otra foto con IA';
        }
        return;
      }
      if (accion === 'imagen') {
        const textoOriginal = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Generando...';
        try {
          await accionSimple('imagen', id);
        } catch (err) {
          alert(err.status === 400
            ? 'La generación de imágenes con IA no está configurada en este servidor.'
            : (err.mensaje || 'No se pudo generar la imagen con IA. Intenta de nuevo.'));
          btn.disabled = false;
          btn.textContent = textoOriginal;
        }
        return;
      }
    };
    $('#cola-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) accionPieza(btn);
    });
    // Carrusel: en el teléfono se pasa de foto deslizando.
    let deslizaX = null;
    $('#cola-grid').addEventListener('touchstart', (e) => {
      deslizaX = e.touches.length === 1 && e.target.closest('.pz-media') && e.target.closest('.pz-media').querySelector('img[data-carrusel]') ? e.touches[0].clientX : null;
    }, { passive: true });
    $('#cola-grid').addEventListener('touchend', (e) => {
      if (deslizaX == null) return;
      const dx = e.changedTouches[0].clientX - deslizaX;
      deslizaX = null;
      const media = e.target.closest('.pz-media');
      const b = media && Math.abs(dx) > 40 && media.querySelector(`.pz-paso.${dx < 0 ? 'sig' : 'ant'}`);
      if (b) accionPieza(b);
    });

    // "Pedir cambio": otra versión con una indicación para la IA
    $('#cola-grid').addEventListener('submit', async (e) => {
      const form = e.target.closest('form[data-pedir-id]');
      if (!form) return;
      e.preventDefault();
      const id = form.dataset.pedirId;
      const boton = form.querySelector('.btn-approve');
      boton.disabled = true;
      boton.textContent = 'Escribiendo…';
      try {
        await api(`/api/negocios/${negocioActual.id}/contenido/${id}/regenerar`, { method: 'POST', body: JSON.stringify({ indicacion: form.indicacion.value }) });
        pedirCambioIds.delete(id);
        await refreshContenido();
      } catch (err) {
        alert(err.mensaje || 'No se pudo pedir el cambio.');
        boton.disabled = false;
        boton.textContent = 'Pedir';
      }
    });

    // foto o video subidos desde la tarjeta, y cambio de fecha y hora
    $('#cola-grid').addEventListener('change', async (e) => {
      const inputFoto = e.target.closest('input[data-foto-item]');
      if (inputFoto && inputFoto.files[0]) {
        const it = contenido.find((x) => x.id === inputFoto.dataset.fotoItem);
        const etiqueta = inputFoto.closest('label');
        if (etiqueta) etiqueta.firstChild.textContent = 'Subiendo foto…';
        try { if (it) await window.RubrofyGaleria.subirParaPieza(it, inputFoto.files[0]); } catch (err) { alert('No se pudo subir la foto: ' + (err.mensaje || err.message)); }
        await refreshContenido().catch(() => {});
        return;
      }
      if (await subirVideoDesde(e.target)) return;
      const input = e.target.closest('input[data-fecha-id]');
      if (!input || !input.value) return;
      const id = input.dataset.fechaId;
      try {
        await api(`/api/negocios/${negocioActual.id}/contenido/${id}/reprogramar`, {
          method: 'PUT',
          body: JSON.stringify({ fecha: input.value }),
        });
        fechaEditIds.delete(id);
        await refreshContenido();
      } catch (err) {
        alert(err.mensaje || 'No se pudo cambiar la fecha.');
      }
    });
    $('#cola-grid').addEventListener('focusout', (e) => {
      const input = e.target.closest('input[data-fecha-id]');
      if (!input) return;
      // Si se sale sin elegir una fecha nueva, se cierra el selector.
      setTimeout(() => {
        if (fechaEditIds.has(input.dataset.fechaId) && document.activeElement !== input) {
          fechaEditIds.delete(input.dataset.fechaId);
          renderCola();
        }
      }, 200);
    });

    // Mientras haya piezas programadas o publicándose, refresca la cola cada
    // 30 s para mostrar el resultado del publicador (sin pisar una edición).
    setInterval(async () => {
      if (!negocioActual || document.hidden) return;
      if (vistaActual !== 'cola' && vistaActual !== 'calendario') return;
      if (editingIds.size || fechaEditIds.size || pedirCambioIds.size || colaOcupada()) return;
      const pendientes = contenido.some((i) => i.publicacion && ['programada', 'publicando'].includes(i.publicacion.estado));
      if (!pendientes) return;
      try { await refreshContenido(); } catch (err) { /* reintenta en la próxima vuelta */ }
    }, 30000);

    try {
      negocioActual = await api('/api/me');
      await mostrarApp();
    } catch (err) {
      mostrarLogin();
    }
  }

  init().catch((err) => {
    console.error(err);
    document.body.innerHTML = '<p style="color:#dd6a52; font-family:sans-serif; padding:24px;">Error cargando el panel: ' + escapeHtml(err.message) + '</p>';
  });
})();
