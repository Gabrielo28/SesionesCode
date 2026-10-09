// Calendario: la semana (con la foto de cada publicación) o el mes, y el
// detalle de la que se elija. Las publicaciones por aprobar y aprobadas se
// cambian de día arrastrándolas (computador) o con "Mover" (celular, o el
// botón del detalle); mantienen su hora salvo que el dueño la cambie. Usa la
// misma ruta que el cambio de fecha en Por aprobar (PUT …/reprogramar): si
// ya estaba aprobada, el servidor la reprograma sola.
(function () {
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_ETIQUETA = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const DIA_MS = 86400000;
  const CLAVE_MODO = 'rubrofy-cal-modo';

  let ctx = null;
  let cont = null;
  let modo = leerModo();
  let ancla = null; // día (número de días desde 1970, en la zona del negocio) que define lo que se ve
  let seleccion = null; // id de la publicación abierta en el detalle
  let arrastrando = null; // id de la publicación que se está arrastrando
  let avisoTimer = null;

  function leerModo() {
    try { return localStorage.getItem(CLAVE_MODO) === 'mes' ? 'mes' : 'semana'; } catch (e) { return 'semana'; }
  }
  function guardarModo() {
    try { localStorage.setItem(CLAVE_MODO, modo); } catch (e) { /* sin almacenamiento: no se recuerda */ }
  }

  // ---------- días ----------
  // Un día es un número entero (días desde 1970) de la fecha en la zona del
  // negocio: así semana, mes y "hoy" no dependen de la zona del navegador.
  const clave = (anio, mes, dia) => Math.round(Date.UTC(anio, mes - 1, dia) / DIA_MS);
  const fechaDe = (c) => new Date(c * DIA_MS);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (c) => { const d = fechaDe(c); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const diaSemana = (c) => (fechaDe(c).getUTCDay() + 6) % 7; // 0 = lunes
  const lunesDe = (c) => c - diaSemana(c);
  const numDia = (c) => fechaDe(c).getUTCDate();
  const mesDe = (c) => fechaDe(c).getUTCMonth();
  const anioDe = (c) => fechaDe(c).getUTCFullYear();

  function ahora() {
    const p = ctx.partesEnZona(new Date().toISOString());
    return { dia: clave(+p.year, +p.month, +p.day), hora: `${p.hour}:${p.minute}` };
  }

  // Día y hora de una publicación. Las antiguas sin `publicarEl` solo traen
  // la etiqueta ("11 OCT - 09:00 - Post"): se elige el año más cercano a hoy.
  function cuandoDe(it) {
    if (it.publicarEl) {
      const p = ctx.partesEnZona(it.publicarEl);
      return { dia: clave(+p.year, +p.month, +p.day), hora: `${p.hour}:${p.minute}` };
    }
    const m = /^(\d{1,2}) ([A-Z]{3}) - (\d{2}:\d{2})/.exec(it.date || '');
    if (!m) return null;
    const mes = MESES_ETIQUETA.indexOf(m[2]) + 1;
    if (!mes) return null;
    const hoy = ahora().dia;
    const anio = anioDe(hoy);
    const opciones = [anio - 1, anio, anio + 1].map((a) => clave(a, mes, +m[1]));
    const dia = opciones.reduce((a, b) => (Math.abs(b - hoy) < Math.abs(a - hoy) ? b : a));
    return { dia, hora: m[3] };
  }

  // ---------- publicaciones ----------
  const publicada = (it) => !!((it.publicacion && it.publicacion.estado === 'publicada') || (it.instagram && it.instagram.ok));
  const publicando = (it) => !!(it.publicacion && it.publicacion.estado === 'publicando');
  const movible = (it) => (it.status === 'pendiente' || it.status === 'aprobado') && !publicada(it) && !publicando(it);

  function titulo(it) {
    const t = String(it.headline || '').replace(/\s*\n\s*/g, ' ').trim();
    if (!t) return it.tag || 'Publicación';
    const bajo = t.toLocaleLowerCase('es');
    return bajo.charAt(0).toLocaleUpperCase('es') + bajo.slice(1);
  }

  function estado(it) {
    if (publicada(it)) return { clase: 'publicada', texto: '🔒 Publicada', color: 'var(--ink-faint)' };
    if (publicando(it)) return { clase: 'publicando', texto: 'Publicando…', color: 'var(--amber)' };
    if (it.status === 'aprobado') return { clase: 'aprobada', texto: 'Aprobada', color: 'var(--green)' };
    return { clase: 'pendiente', texto: 'Por aprobar', color: 'var(--amber)' };
  }

  // Lo que se ve en el calendario: todo menos lo rechazado (no se publica).
  function piezas() {
    return ctx.contenido.filter((it) => it.status !== 'rechazado')
      .map((it) => ({ it, cuando: cuandoDe(it) }))
      .filter((x) => x.cuando)
      .sort((a, b) => a.cuando.dia - b.cuando.dia || a.cuando.hora.localeCompare(b.cuando.hora));
  }
  const delDia = (lista, dia) => lista.filter((x) => x.cuando.dia === dia);

  // ---------- pintar ----------
  function render(contenedor, contexto) {
    cont = contenedor;
    ctx = contexto;
    if (ancla === null) ancla = ahora().dia;
    if (seleccion && !ctx.contenido.some((it) => it.id === seleccion)) seleccion = null;
    const lista = piezas();
    cont.className = 'calendario ' + modo;
    cont.innerHTML = `
      <div class="cal-barra">
        <div class="cal-modo" role="group" aria-label="Ver por">
          <button type="button" data-cal-modo="semana" class="${modo === 'semana' ? 'on' : ''}" aria-pressed="${modo === 'semana'}">Semana</button>
          <button type="button" data-cal-modo="mes" class="${modo === 'mes' ? 'on' : ''}" aria-pressed="${modo === 'mes'}">Mes</button>
        </div>
        <div class="cal-nav">
          <button type="button" data-cal-nav="-1" aria-label="${modo === 'semana' ? 'Semana anterior' : 'Mes anterior'}">‹</button>
          <b id="cal-titulo">${tituloPeriodo()}</b>
          <button type="button" data-cal-nav="1" aria-label="${modo === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}">›</button>
          <button type="button" class="cal-hoy" data-cal-nav="0">Hoy</button>
        </div>
        <div class="cal-leyenda"><span><i style="background:var(--amber)"></i>Por aprobar</span><span><i style="background:var(--green)"></i>Aprobada</span><span>🔒 Publicada (no se mueve)</span></div>
      </div>
      <p class="cal-tip"><b>Para cambiar de día:</b> <span class="cal-tip-pc">arrastra la publicación a otro día.</span><span class="cal-tip-movil">toca "↔ Mover" y elige el día.</span> Mantiene su hora; si ya estaba aprobada, se reprograma sola.</p>
      <div class="cal-body">
        <div class="cal-main">${modo === 'semana' ? semanaHTML(lista) : mesHTML(lista)}</div>
        <aside class="cal-detail" id="cal-detail" aria-live="polite">${detalleHTML()}</aside>
      </div>
      <div class="cal-aviso" role="status" hidden></div>`;
  }

  function tituloPeriodo() {
    const hoy = ahora().dia;
    if (modo === 'mes') {
      const a = anioDe(ancla);
      return `${MESES_LARGO[mesDe(ancla)]}${a !== anioDe(hoy) ? ' ' + a : ''}`.replace(/^./, (c) => c.toUpperCase());
    }
    const ini = lunesDe(ancla);
    const fin = ini + 6;
    const anio = anioDe(fin) !== anioDe(hoy) ? ' ' + anioDe(fin) : '';
    if (mesDe(ini) === mesDe(fin)) return `${numDia(ini)} – ${numDia(fin)} de ${MESES_LARGO[mesDe(fin)]}${anio}`;
    return `${numDia(ini)} ${MESES[mesDe(ini)]} – ${numDia(fin)} ${MESES[mesDe(fin)]}${anio}`;
  }

  function semanaHTML(lista) {
    const hoy = ahora().dia;
    const ini = lunesDe(ancla);
    let html = '<div class="cal-semana" id="cal-grid">';
    for (let i = 0; i < 7; i++) {
      const dia = ini + i;
      const delD = delDia(lista, dia);
      html += `<section class="cal-dia${dia < hoy ? ' pasado' : ''}${dia === hoy ? ' hoy' : ''}" data-dia="${dia}">
          <h3><span>${DIAS[i]}${dia === hoy ? ' · hoy' : ''}</span><b>${numDia(dia)}</b></h3>
          ${delD.map((x) => tarjetaHTML(x)).join('') || '<p class="cal-vacio">Sin publicaciones</p>'}
          <p class="cal-soltar" aria-hidden="true"></p>
        </section>`;
    }
    return html + '</div>';
  }

  function tarjetaHTML({ it, cuando }) {
    const e = estado(it);
    const mov = movible(it);
    const img = ctx.miniatura(it);
    const formato = ctx.FORMATOS[ctx.formatoDe(it)] || 'Post';
    const fondo = img ? '' : ` style="background:linear-gradient(160deg, ${ctx.escapeHtml(it.hueFrom || '#3a2a33')}, ${ctx.escapeHtml(it.hueTo || '#19181c')})"`;
    return `<article class="cal-pz ${e.clase}${it.id === seleccion ? ' selected' : ''}" data-id="${it.id}" draggable="${mov}" tabindex="0" aria-label="${ctx.escapeHtml(`${titulo(it)}, ${cuando.hora}, ${formato}, ${e.texto.replace('🔒 ', '')}`)}">
        <div class="cal-pz-img"${fondo}>${img ? `<img src="${ctx.escapeHtml(img)}" alt="" loading="lazy" draggable="false">` : `<span class="cal-pz-cartel">${ctx.escapeHtml(String(it.headline || it.tag || formato).replace(/\s*\n\s*/g, ' '))}</span>`}${mov ? '<i class="cal-asa" aria-hidden="true">⠿</i>' : ''}</div>
        <div class="cal-pz-info">
          <span class="cal-pz-hora">${cuando.hora} · ${formato}</span>
          <b>${ctx.escapeHtml(titulo(it))}</b>
          <span class="cal-pz-est">${e.clase === 'publicada' ? '' : `<i style="background:${e.color}"></i>`}${e.texto}</span>
        </div>
        ${mov ? `<button type="button" class="cal-mover" data-cal-mover="${it.id}">↔ Mover</button>` : ''}
      </article>`;
  }

  function mesHTML(lista) {
    const hoy = ahora().dia;
    const primero = clave(anioDe(ancla), mesDe(ancla) + 1, 1);
    const ultimo = clave(anioDe(ancla), mesDe(ancla) + 2, 0);
    const ini = lunesDe(primero);
    const fin = lunesDe(ultimo) + 6;
    let html = `<div class="cal-weekdays">${DIAS.map((d) => `<span>${d}</span>`).join('')}</div><div class="cal-grid" id="cal-grid">`;
    for (let dia = ini; dia <= fin; dia++) {
      const fuera = dia < primero || dia > ultimo;
      html += `<div class="cal-cell${fuera ? ' out' : ''}${dia === hoy ? ' today' : ''}${dia < hoy ? ' pasado' : ''}" data-dia="${dia}"><span class="num">${numDia(dia)}</span>`;
      delDia(lista, dia).forEach(({ it, cuando }) => {
        const e = estado(it);
        html += `<div class="cal-chip${it.id === seleccion ? ' selected' : ''}" data-id="${it.id}" draggable="${movible(it)}" tabindex="0"><span class="dot" style="background:${e.color}"></span><span class="txt">${cuando.hora} ${ctx.escapeHtml(titulo(it))}</span></div>`;
      });
      html += '</div>';
    }
    return html + '</div>';
  }

  function detalleHTML() {
    const it = ctx.contenido.find((x) => x.id === seleccion);
    if (!it) return '<span class="kicker">Detalle</span><p class="empty">Toca una publicación para ver su texto e imagen.</p>';
    const c = cuandoDe(it);
    const e = estado(it);
    const img = ctx.miniatura(it);
    const formato = ctx.FORMATOS[ctx.formatoDe(it)] || 'Post';
    const d = fechaDe(c.dia);
    return `
      <span class="kicker">Detalle</span>
      <div class="row">${e.clase === 'publicada' ? '' : `<span class="dot" style="width:8px;height:8px;border-radius:50%;background:${e.color}"></span>`}<span class="cal-det-estado">${e.texto}</span></div>
      <span class="cal-det-fecha">${DIAS_LARGO[diaSemana(c.dia)]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]} · ${c.hora} · ${formato}</span>
      ${img ? `<img class="cal-det-img" src="${ctx.escapeHtml(img)}" alt="">` : ''}
      ${it.tag ? `<span class="tagpill">${ctx.escapeHtml(it.tag)}</span>` : ''}
      ${it.gancho ? `<p class="card-gancho"><span>Gancho</span>${ctx.escapeHtml(it.gancho)}</p>` : ''}
      <p class="detail-text">${ctx.escapeHtml(it.variants[it.variantIndex] || '')}</p>
      ${it.hashtags && it.hashtags.length ? `<div class="card-hashtags">${it.hashtags.map((h) => `<span>${ctx.escapeHtml(h)}</span>`).join('')}</div>` : ''}
      ${movible(it) ? `<button type="button" class="btn-ghost cal-det-mover" data-cal-mover="${it.id}">↔ Mover a otro día</button>` : ''}
      ${it.status === 'pendiente' ? '<button type="button" class="btn-text cal-det-ir" data-cal-ir="cola">Revisar en Por aprobar →</button>' : ''}`;
  }

  // ---------- mover ----------
  // ¿El día está en la semana o el mes que se ve?
  const enVista = (dia) => (modo === 'semana'
    ? dia >= lunesDe(ancla) && dia <= lunesDe(ancla) + 6
    : mesDe(dia) === mesDe(ancla) && anioDe(dia) === anioDe(ancla));

  // `seguir`: si el día nuevo queda fuera de lo que se ve, el calendario va ahí.
  async function mover(id, dia, hora, conDeshacer = true, seguir = false) {
    const it = ctx.contenido.find((x) => x.id === id);
    if (!it) return false;
    const antes = cuandoDe(it);
    hora = hora || antes.hora;
    if (antes && dia === antes.dia && hora === antes.hora) return true;
    const ya = ahora();
    if (dia < ya.dia || (dia === ya.dia && hora <= ya.hora)) {
      aviso('Ese día u hora ya pasó. Elige uno que venga.', null, true);
      return false;
    }
    try {
      await ctx.api(`/api/negocios/${ctx.negocio.id}/contenido/${id}/reprogramar`, { method: 'PUT', body: JSON.stringify({ fecha: `${ymd(dia)}T${hora}` }) });
    } catch (err) {
      aviso(err.mensaje || 'No se pudo cambiar la fecha.', null, true);
      return false;
    }
    seleccion = id;
    if (seguir && !enVista(dia)) ancla = dia;
    await ctx.refrescar();
    const d = fechaDe(dia);
    aviso(`"${titulo(it)}" pasó al ${DIAS_LARGO[diaSemana(dia)]} ${d.getUTCDate()}, ${hora}`,
      conDeshacer && antes ? () => mover(id, antes.dia, antes.hora, false) : null);
    return true;
  }

  function aviso(texto, deshacer, error) {
    const el = cont && cont.querySelector('.cal-aviso');
    if (!el) return;
    clearTimeout(avisoTimer);
    el.className = 'cal-aviso' + (error ? ' error' : '');
    el.innerHTML = `<span>${error ? '' : '✓ '}${ctx.escapeHtml(texto)}</span>${deshacer ? '<button type="button" data-cal-deshacer>Deshacer</button>' : ''}`;
    el.hidden = false;
    const btn = el.querySelector('[data-cal-deshacer]');
    if (btn) btn.addEventListener('click', () => { el.hidden = true; deshacer(); });
    avisoTimer = setTimeout(() => { el.hidden = true; }, deshacer ? 8000 : 5000);
  }

  // Hoja para elegir el día (celular, o "Mover a otro día" del detalle).
  function abrirHoja(id) {
    const it = ctx.contenido.find((x) => x.id === id);
    if (!it || !movible(it)) return;
    const desde = cuandoDe(it);
    let semana = lunesDe(desde.dia);
    let elegido = null;
    const capa = document.createElement('div');
    capa.className = 'cal-hoja-capa';
    document.body.appendChild(capa);
    const cerrar = () => { capa.remove(); document.removeEventListener('keydown', alTeclado); };
    const alTeclado = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', alTeclado);

    function pintar() {
      const hoy = ahora().dia;
      const lista = piezas();
      const fin = semana + 6;
      const rango = mesDe(semana) === mesDe(fin) ? `${numDia(semana)} – ${numDia(fin)} ${MESES[mesDe(fin)]}` : `${numDia(semana)} ${MESES[mesDe(semana)]} – ${numDia(fin)} ${MESES[mesDe(fin)]}`;
      const horaActual = (capa.querySelector('[data-hoja-hora]') || {}).value || desde.hora;
      let dias = '';
      for (let i = 0; i < 7; i++) {
        const dia = semana + i;
        const n = delDia(lista, dia).filter((x) => x.it.id !== id).length;
        dias += `<button type="button" data-hoja-dia="${dia}" class="${dia === elegido ? 'elegido' : ''}${dia === desde.dia ? ' actual' : ''}"${dia < hoy ? ' disabled' : ''} aria-label="${DIAS_LARGO[i]} ${numDia(dia)}${n ? `, ${n} publicación${n > 1 ? 'es' : ''}` : ''}">
          ${DIAS[i]}<b>${numDia(dia)}</b><i>${dia === desde.dia ? 'ahora' : '•'.repeat(Math.min(n, 3)) || '&nbsp;'}</i></button>`;
      }
      const d = elegido !== null ? fechaDe(elegido) : null;
      capa.innerHTML = `<div class="cal-hoja" role="dialog" aria-modal="true" aria-labelledby="cal-hoja-t">
          <div class="cal-hoja-agarre" aria-hidden="true"></div>
          <h2 id="cal-hoja-t">Mover "${ctx.escapeHtml(titulo(it))}"</h2>
          <p>Elige el día. Los puntos muestran cuántas publicaciones ya tiene cada uno.</p>
          <div class="cal-hoja-sem"><button type="button" data-hoja-sem="-7"${semana - 7 + 6 < hoy ? ' disabled' : ''}>‹ Anterior</button><b>${rango}</b><button type="button" data-hoja-sem="7">Siguiente ›</button></div>
          <div class="cal-hoja-dias">${dias}</div>
          <label class="cal-hoja-hora">Hora <input type="time" data-hoja-hora value="${horaActual}" step="300"></label>
          <button type="button" class="btn-approve cal-hoja-ok" data-hoja-ok${elegido === null ? ' disabled' : ''}>${d ? `Mover al ${DIAS_LARGO[diaSemana(elegido)]} ${d.getUTCDate()}` : 'Elige un día'}</button>
          <button type="button" class="btn-ghost cal-hoja-no" data-hoja-cerrar>Cancelar</button>
        </div>`;
    }
    pintar();
    capa.addEventListener('click', async (e) => {
      if (e.target === capa || e.target.closest('[data-hoja-cerrar]')) return cerrar();
      const sem = e.target.closest('[data-hoja-sem]');
      if (sem) { semana += Number(sem.dataset.hojaSem); return pintar(); }
      const dia = e.target.closest('[data-hoja-dia]');
      if (dia) { elegido = Number(dia.dataset.hojaDia); return pintar(); }
      const ok = e.target.closest('[data-hoja-ok]');
      if (ok && elegido !== null) {
        ok.disabled = true;
        const hora = capa.querySelector('[data-hoja-hora]').value || desde.hora;
        cerrar();
        await mover(id, elegido, hora, true, true);
      }
    });
    const primero = capa.querySelector('[data-hoja-dia]:not([disabled])');
    if (primero) primero.focus();
  }

  // ---------- eventos (una sola vez, por delegación) ----------
  function enlazar(contenedor) {
    contenedor.addEventListener('click', (e) => {
      if (!ctx) return;
      const m = e.target.closest('[data-cal-modo]');
      if (m) { modo = m.dataset.calModo; guardarModo(); return render(cont, ctx); }
      const nav = e.target.closest('[data-cal-nav]');
      if (nav) {
        const paso = Number(nav.dataset.calNav);
        if (!paso) ancla = ahora().dia;
        else if (modo === 'semana') ancla += 7 * paso;
        else ancla = clave(anioDe(ancla), mesDe(ancla) + 1 + paso, 1);
        return render(cont, ctx);
      }
      const mv = e.target.closest('[data-cal-mover]');
      if (mv) return abrirHoja(mv.dataset.calMover);
      const ir = e.target.closest('[data-cal-ir]');
      if (ir) return ctx.irA(ir.dataset.calIr);
      const pz = e.target.closest('.cal-pz, .cal-chip');
      if (pz) {
        seleccion = pz.dataset.id;
        render(cont, ctx);
        // Si el detalle quedó debajo (celular, o la semana en pantallas medianas), se lleva a la vista.
        const det = cont.querySelector('#cal-detail');
        if (det && det.getBoundingClientRect().top > window.innerHeight - 120) det.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    contenedor.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const pz = e.target.closest('.cal-pz, .cal-chip');
      if (!pz || e.target.closest('button')) return;
      e.preventDefault();
      seleccion = pz.dataset.id;
      render(cont, ctx);
      const foco = cont.querySelector(`[data-id="${pz.dataset.id}"]`);
      if (foco) foco.focus();
    });

    // Arrastrar y soltar (computador).
    const limpiar = () => contenedor.querySelectorAll('.destino').forEach((x) => { x.classList.remove('destino'); });
    contenedor.addEventListener('dragstart', (e) => {
      const pz = e.target.closest('[draggable="true"][data-id]');
      if (!pz) return;
      arrastrando = pz.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', arrastrando);
      requestAnimationFrame(() => pz.classList.add('arrastrada'));
    });
    contenedor.addEventListener('dragend', (e) => {
      const pz = e.target.closest('[data-id]');
      if (pz) pz.classList.remove('arrastrada');
      arrastrando = null;
      limpiar();
    });
    contenedor.addEventListener('dragover', (e) => {
      if (!arrastrando) return;
      const celda = e.target.closest('[data-dia]');
      if (!celda || celda.classList.contains('pasado')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (celda.classList.contains('destino')) return;
      limpiar();
      celda.classList.add('destino');
      const it = ctx.contenido.find((x) => x.id === arrastrando);
      const c = it && cuandoDe(it);
      const dia = Number(celda.dataset.dia);
      const soltar = celda.querySelector('.cal-soltar');
      if (soltar && c) soltar.textContent = `Soltar aquí · ${DIAS[diaSemana(dia)].toLowerCase()} ${numDia(dia)}, ${c.hora}`;
    });
    contenedor.addEventListener('dragleave', (e) => {
      const celda = e.target.closest('[data-dia]');
      if (celda && !celda.contains(e.relatedTarget)) celda.classList.remove('destino');
    });
    contenedor.addEventListener('drop', (e) => {
      const celda = e.target.closest('[data-dia]');
      const id = arrastrando || e.dataTransfer.getData('text/plain');
      limpiar();
      arrastrando = null;
      if (!celda || !id) return;
      e.preventDefault();
      mover(id, Number(celda.dataset.dia));
    });
  }

  window.RubrofyCalendario = {
    render(contenedor, contexto) {
      if (!contenedor.dataset.enlazado) { enlazar(contenedor); contenedor.dataset.enlazado = '1'; }
      render(contenedor, contexto);
    },
    // Al cambiar de negocio, se vuelve a la semana de hoy.
    reiniciar() { ancla = null; seleccion = null; },
  };
})();
