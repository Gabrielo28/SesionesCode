// Gráficos en SVG sin librerías, compartidos por Resultados, Ads y el
// informe mensual. Criterios (ver guía de visualización del proyecto):
// un solo eje por gráfico, marcas finas (línea de 2px, columnas de 24px como
// máximo con punta redondeada de 4px y separación de 2px), un único color de
// acento validado contra la superficie oscura (--viz-acento) y gris para lo
// secundario, grilla de 1px apenas visible, y tooltip al pasar el mouse.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function numero(v) {
    if (v == null || Number.isNaN(v)) return '–';
    const abs = Math.abs(v);
    if (abs >= 1e6) return (v / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' M';
    if (abs >= 1e4) return (v / 1e3).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' mil';
    return Math.round(v).toLocaleString('es-CL');
  }

  function fechaCorta(fecha) {
    const [, m, d] = fecha.split('-').map(Number);
    return `${d} ${MESES[m - 1]}`;
  }

  function escapar(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Máximo "redondo" del eje y sus marcas (0, 500, 1.000...).
  function escala(maximo) {
    if (!maximo || maximo <= 0) return { max: 1, marcas: [0, 1] };
    const potencia = Math.pow(10, Math.floor(Math.log10(maximo)));
    const paso = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => maximo / p <= 4) || potencia * 10;
    const max = Math.ceil(maximo / paso) * paso;
    const marcas = [];
    for (let v = 0; v <= max + 1e-9; v += paso) marcas.push(v);
    return { max, marcas };
  }

  function el(tag, attrs, padre) {
    const nodo = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) nodo.setAttribute(k, v);
    if (padre) padre.appendChild(nodo);
    return nodo;
  }

  function contenedor(alto) {
    const div = document.createElement('div');
    div.className = 'viz';
    div.style.height = alto + 'px';
    const tip = document.createElement('div');
    tip.className = 'viz-tip';
    tip.hidden = true;
    div.appendChild(tip);
    return { div, tip };
  }

  function mostrarTip(div, tip, html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const ancho = div.clientWidth;
    const izquierda = Math.min(Math.max(x + 12, 4), ancho - tip.offsetWidth - 4);
    tip.style.left = izquierda + 'px';
    tip.style.top = Math.max(y - tip.offsetHeight - 10, 0) + 'px';
  }

  // Serie temporal: línea (con relleno suave si area) o columnas.
  // puntos: [{ fecha: 'AAAA-MM-DD', valor }], valores nulos = sin dato.
  function serieTemporal(puntos, opciones) {
    const o = Object.assign({ alto: 200, tipo: 'linea', etiqueta: 'Valor', formato: numero }, opciones);
    const { div, tip } = contenedor(o.alto);
    const svg = el('svg', { width: '100%', height: o.alto, role: 'img', 'aria-label': o.etiqueta });
    div.insertBefore(svg, tip);
    const dibujar = () => {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const W = div.clientWidth || 600;
      const H = o.alto;
      const m = { t: 12, r: 12, b: 26, l: 46 };
      const iw = W - m.l - m.r;
      const ih = H - m.t - m.b;
      const valores = puntos.map((p) => p.valor).filter((v) => v != null);
      const { max, marcas } = escala(Math.max(0, ...valores));
      const y = (v) => m.t + ih - (v / max) * ih;
      const paso = puntos.length > 1 ? iw / (puntos.length - (o.tipo === 'columnas' ? 0 : 1)) : iw;
      const x = (i) => m.l + (o.tipo === 'columnas' ? paso * i + paso / 2 : paso * i);

      for (const v of marcas) {
        el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'viz-grid' }, svg);
        el('text', { x: m.l - 8, y: y(v) + 4, class: 'viz-eje', 'text-anchor': 'end' }, svg).textContent = numero(v);
      }
      const etiquetasX = [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1].filter((v, i, a) => a.indexOf(v) === i);
      for (const i of etiquetasX) {
        if (!puntos[i]) continue;
        el('text', { x: x(i), y: H - 6, class: 'viz-eje', 'text-anchor': i === 0 ? 'start' : (i === puntos.length - 1 ? 'end' : 'middle') }, svg)
          .textContent = fechaCorta(puntos[i].fecha);
      }

      if (o.tipo === 'columnas') {
        const ancho = Math.max(2, Math.min(24, paso - 2));
        puntos.forEach((p, i) => {
          if (p.valor == null || p.valor <= 0) return;
          const alto = Math.max(1, ih - (y(p.valor) - m.t));
          const x0 = x(i) - ancho / 2;
          const y0 = y(p.valor);
          const r = Math.min(4, ancho / 2, alto);
          // punta redondeada, base recta
          el('path', {
            class: 'viz-col',
            d: `M${x0},${y0 + alto} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + ancho - r} Q${x0 + ancho},${y0} ${x0 + ancho},${y0 + r} V${y0 + alto} Z`,
          }, svg);
        });
      } else {
        let d = '';
        let area = '';
        let tramo = [];
        const cerrar = () => {
          if (tramo.length) {
            area += `M${tramo[0][0]},${m.t + ih} ` + tramo.map(([a, b]) => `L${a},${b}`).join(' ') + ` L${tramo[tramo.length - 1][0]},${m.t + ih} Z `;
          }
          tramo = [];
        };
        puntos.forEach((p, i) => {
          if (p.valor == null) { cerrar(); return; }
          d += (tramo.length ? 'L' : 'M') + x(i) + ',' + y(p.valor) + ' ';
          tramo.push([x(i), y(p.valor)]);
        });
        cerrar();
        el('path', { d: area, class: 'viz-area' }, svg);
        el('path', { d, class: 'viz-linea' }, svg);
        const ultimo = puntos.map((p, i) => [p, i]).filter(([p]) => p.valor != null).pop();
        if (ultimo) el('circle', { cx: x(ultimo[1]), cy: y(ultimo[0].valor), r: 4, class: 'viz-punto' }, svg);
      }

      // capa de hover: crosshair + tooltip con la fecha y el valor
      const guia = el('line', { y1: m.t, y2: m.t + ih, class: 'viz-guia', visibility: 'hidden' }, svg);
      const captura = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, svg);
      captura.addEventListener('mousemove', (ev) => {
        const caja = svg.getBoundingClientRect();
        const px = ev.clientX - caja.left;
        const i = Math.max(0, Math.min(puntos.length - 1, Math.round((px - m.l - (o.tipo === 'columnas' ? paso / 2 : 0)) / paso)));
        const p = puntos[i];
        guia.setAttribute('x1', x(i));
        guia.setAttribute('x2', x(i));
        guia.setAttribute('visibility', 'visible');
        mostrarTip(div, tip, `<span>${fechaCorta(p.fecha)}</span><b>${p.valor == null ? 'sin dato' : o.formato(p.valor)}</b> ${escapar(o.etiqueta.toLowerCase())}`, x(i), p.valor == null ? m.t + ih / 2 : y(p.valor));
      });
      captura.addEventListener('mouseleave', () => { tip.hidden = true; guia.setAttribute('visibility', 'hidden'); });
    };
    requestAnimationFrame(dibujar);
    if (window.ResizeObserver) new ResizeObserver(() => dibujar()).observe(div);
    return div;
  }

  // Barras horizontales: comparar magnitudes entre categorías. La mejor en
  // acento y el resto en gris (énfasis), valor en la punta de cada barra.
  function barras(filas, opciones) {
    const o = Object.assign({ formato: numero, sufijo: '' }, opciones);
    const div = document.createElement('div');
    div.className = 'viz-barras';
    const max = Math.max(1, ...filas.map((f) => f.valor || 0));
    div.innerHTML = filas.map((f, i) => `
      <div class="viz-barra-fila" title="${escapar(f.label)}: ${o.formato(f.valor)}${escapar(o.sufijo)}${f.detalle ? ' · ' + escapar(f.detalle) : ''}">
        <span class="viz-barra-label">${escapar(f.label)}</span>
        <span class="viz-barra-pista"><span class="viz-barra ${i === 0 ? 'destacada' : ''}" style="width:${Math.max(2, (f.valor / max) * 100)}%"></span></span>
        <span class="viz-barra-valor">${o.formato(f.valor)}${escapar(o.sufijo)}</span>
      </div>`).join('');
    return div;
  }

  // Mapa de calor día × franja: más interacción = más claro (en fondo oscuro
  // la escala secuencial se invierte). Celdas sin posts quedan vacías.
  const RAMPA = ['#3b2a17', '#6a4a1b', '#9a6619', '#cc7f14', '#f3a33a'];
  function mapaCalor(celdas, filas, columnas) {
    const div = document.createElement('div');
    div.className = 'viz-calor';
    const valores = celdas.filter((c) => c.promedio != null).map((c) => c.promedio);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const tono = (v) => {
      if (v == null) return null;
      if (max === min) return RAMPA[2];
      return RAMPA[Math.min(RAMPA.length - 1, Math.floor(((v - min) / (max - min)) * RAMPA.length))];
    };
    let html = '<span></span>' + columnas.map((c) => `<span class="viz-calor-col">${escapar(c.label)}</span>`).join('');
    for (const f of filas) {
      html += `<span class="viz-calor-fila">${escapar(f.label)}</span>`;
      for (const c of columnas) {
        const celda = celdas.find((x) => x.dia === f.id && x.franja === c.id);
        const color = celda && tono(celda.promedio);
        const texto = celda && celda.posts
          ? `${f.label} en la ${c.label}: ${numero(celda.promedio)} interacciones promedio (${celda.posts} post${celda.posts === 1 ? '' : 's'})`
          : `${f.label} en la ${c.label}: sin publicaciones`;
        html += `<span class="viz-calor-celda${color ? '' : ' vacia'}" style="${color ? 'background:' + color : ''}" title="${escapar(texto)}"></span>`;
      }
    }
    div.innerHTML = html;
    return div;
  }

  window.RubrofyGraficos = { serieTemporal, barras, mapaCalor, numero, fechaCorta, escapar };
})();
