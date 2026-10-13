/*
 * Reporte mensual automático — Influence Fit
 *
 *   node generar-reporte.js                 usa cliente.yaml (+ los CSV que indica)
 *   node generar-reporte.js otro.yaml       otro cliente
 *
 * Entrada:  export CSV de Meta Ads Manager + export CSV del CRM (SendPulse / hoja de leads)
 * Salida:   salida/reporte-<cliente>-<mes>.html y .pdf con los KPI de la sección 6 del brief
 */
const fs = require('fs');
const path = require('path');
const { leerDatos, clp, pct, num, esc, slug, escribirHtmlYPdf } = require('../lib/comun');

const archivo = process.argv[2] || 'cliente.yaml';
const base = path.isAbsolute(archivo) ? path.dirname(archivo) : __dirname;
const cfg = leerDatos(path.join(base, archivo));
const mes = cfg.mes || new Date().toISOString().slice(0, 7);
const [anio, mesN] = mes.split('-').map(Number);
const nombreMes = new Date(anio, mesN - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

// ---------- CSV ----------
function leerCsv(ruta) {
  let txt = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  const primera = txt.split(/\r?\n/)[0];
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = []; let fila = [], campo = '', enComillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (enComillas) { if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') enComillas = false; else campo += c; }
    else if (c === '"') enComillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = filas.shift().map(s => s.trim());
  return filas.filter(f => f.some(x => x && x.trim())).map(f => Object.fromEntries(cab.map((k, i) => [k, (f[i] || '').trim()])));
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function columna(fila, candidatos) {
  const claves = Object.keys(fila);
  for (const c of candidatos) { const k = claves.find(x => norm(x) === norm(c)); if (k) return k; }
  for (const c of candidatos) { const k = claves.find(x => norm(x).includes(norm(c))); if (k) return k; }
  return null;
}
function numero(v) {
  if (v == null || v === '') return 0;
  let s = String(v).replace(/[^\d,.\-]/g, '');
  if (/,\d{1,2}$/.test(s) && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else s = s.replace(/,/g, '');                                                                  // 1,234.56
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
}
function fechaDe(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s); return isNaN(d) ? null : d;
}
const enMes = d => d && d.getFullYear() === anio && d.getMonth() === mesN - 1;

// ---------- Meta Ads ----------
const rutaMeta = path.join(base, cfg.archivos.meta_ads);
const metaRaw = fs.existsSync(rutaMeta) ? leerCsv(rutaMeta) : [];
const cm = cfg.columnas_meta;
let meta = { gasto: 0, impresiones: 0, alcance: 0, clics: 0, resultados: 0, campanas: {}, porSemana: {} };
if (metaRaw.length) {
  const k = Object.fromEntries(Object.entries(cm).map(([key, cands]) => [key, columna(metaRaw[0], cands)]));
  for (const f of metaRaw) {
    const fecha = k.fecha ? fechaDe(f[k.fecha]) : null;
    if (k.fecha && fecha && !enMes(fecha)) continue;
    const g = numero(f[k.gasto]), imp = numero(f[k.impresiones]), alc = numero(f[k.alcance]), cl = numero(f[k.clics]), res = numero(f[k.resultados]);
    meta.gasto += g; meta.impresiones += imp; meta.alcance += alc; meta.clics += cl; meta.resultados += res;
    const nombre = k.campana ? f[k.campana] : 'Campaña';
    const c = meta.campanas[nombre] = meta.campanas[nombre] || { gasto: 0, impresiones: 0, clics: 0, resultados: 0 };
    c.gasto += g; c.impresiones += imp; c.clics += cl; c.resultados += res;
    if (fecha) { const w = semanaDe(fecha); meta.porSemana[w] = (meta.porSemana[w] || 0) + g; }
  }
}
function semanaDe(d) { const dia = d.getDate(); return Math.min(5, Math.ceil(dia / 7)); }

// ---------- CRM ----------
const rutaCrm = path.join(base, cfg.archivos.crm);
const crmRaw = fs.existsSync(rutaCrm) ? leerCsv(rutaCrm) : [];
const cc = cfg.columnas_crm;
const est = cfg.estados;
const esEstado = (v, lista) => lista.map(norm).includes(norm(v));
let leads = [];
if (crmRaw.length) {
  const k = Object.fromEntries(Object.entries(cc).map(([key, cands]) => [key, columna(crmRaw[0], cands)]));
  for (const f of crmRaw) {
    const fecha = k.fecha ? fechaDe(f[k.fecha]) : null;
    if (k.fecha && fecha && !enMes(fecha)) continue;
    const estado = k.estado ? f[k.estado] : '';
    leads.push({
      fecha, semana: fecha ? semanaDe(fecha) : 1, origen: norm(k.origen ? f[k.origen] : '') || 'sin dato',
      calificacion: (k.calificacion ? f[k.calificacion] : '').toUpperCase().trim() || '—', estado,
      agendada: esEstado(estado, [...est.agendada, ...est.realizada, ...est.cliente]),
      realizada: esEstado(estado, [...est.realizada, ...est.cliente]),
      cliente: esEstado(estado, est.cliente), perdido: esEstado(estado, est.perdido),
      valor: k.valor ? numero(f[k.valor]) : 0
    });
  }
}
const m = cfg.manual || {}, metas = cfg.metas || {}, ant = cfg.anterior || {};
const n = {
  leads: leads.length,
  agendadas: leads.filter(l => l.agendada).length,
  realizadas: leads.filter(l => l.realizada).length,
  cierres: leads.filter(l => l.cliente).length,
  perdidos: leads.filter(l => l.perdido).length
};
const ingresos = leads.filter(l => l.cliente).reduce((s, l) => s + (l.valor || m.valor_mensual_promedio || 0), 0);
const kpi = {
  inversion: meta.gasto,
  cpl: n.leads ? meta.gasto / n.leads : null,
  cpe: n.agendadas ? meta.gasto / n.agendadas : null,
  tasaAgenda: n.leads ? n.agendadas / n.leads : null,
  tasaAsistencia: n.agendadas ? n.realizadas / n.agendadas : null,
  tasaCierre: n.realizadas ? n.cierres / n.realizadas : null,
  ctr: meta.impresiones ? meta.clics / meta.impresiones : null,
  ingresos, roas: meta.gasto ? ingresos / meta.gasto : null,
  cac: n.cierres ? meta.gasto / n.cierres : null
};
const semanas = [1, 2, 3, 4, 5].map(w => ({ w, leads: leads.filter(l => l.semana === w).length, agendadas: leads.filter(l => l.semana === w && l.agendada).length, gasto: meta.porSemana[w] || 0 })).filter(s => s.leads || s.gasto);
const porCalif = ['A', 'B', 'C'].map(c => ({ c, n: leads.filter(l => l.calificacion === c).length, agendadas: leads.filter(l => l.calificacion === c && l.agendada).length }));
const porOrigen = Object.entries(leads.reduce((a, l) => { (a[l.origen] = a[l.origen] || { leads: 0, agendadas: 0, cierres: 0 }); a[l.origen].leads++; if (l.agendada) a[l.origen].agendadas++; if (l.cliente) a[l.origen].cierres++; return a; }, {})).sort((a, b) => b[1].leads - a[1].leads);

// ---------- Gráficos (SVG inline, una serie, color de marca) ----------
const TEAL = '#12959C', TEAL_LIGHT = '#8ED0D3', INK = '#123638', MUTED = '#6B8B8C', GRID = '#E6F1F1';
function barras(datos, { ancho = 560, alto = 200, etiqueta = d => d.label, valor = d => d.v, formato = v => num(v), color = () => TEAL } = {}) {
  const padL = 8, padR = 8, padT = 24, padB = 28, maxV = Math.max(...datos.map(valor), 1);
  const w = (ancho - padL - padR) / datos.length, bw = Math.min(44, w * 0.6);
  const y = v => padT + (alto - padT - padB) * (1 - v / maxV);
  const ticks = [0, 0.5, 1].map(t => Math.round(maxV * t));
  return `<svg viewBox="0 0 ${ancho} ${alto}" width="100%" role="img" aria-label="Gráfico de barras" font-family="Montserrat, sans-serif" font-size="11">
    ${ticks.map(t => `<line x1="${padL}" x2="${ancho - padR}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}" stroke-width="1"/>`).join('')}
    ${datos.map((d, i) => { const v = valor(d), x = padL + w * i + (w - bw) / 2, h = Math.max(0, y(0) - y(v)); return `<g><title>${esc(etiqueta(d))}: ${esc(formato(v))}</title>
      <path d="M${x} ${y(0)} V${y(v) + 4} a4 4 0 0 1 4 -4 H${x + bw - 4} a4 4 0 0 1 4 4 V${y(0)} Z" fill="${color(d)}"${h < 4 ? ` transform="translate(0,${4 - h})"` : ''}/>
      <text x="${x + bw / 2}" y="${y(v) - 6}" text-anchor="middle" fill="${INK}" font-weight="600">${esc(formato(v))}</text>
      <text x="${x + bw / 2}" y="${alto - 8}" text-anchor="middle" fill="${MUTED}">${esc(etiqueta(d))}</text></g>`; }).join('')}
  </svg>`;
}
function embudo(pasos) {
  const max = Math.max(pasos[0].v, 1), ancho = 560, altoFila = 34, alto = pasos.length * altoFila + 6, labelW = 170;
  return `<svg viewBox="0 0 ${ancho} ${alto}" width="100%" role="img" aria-label="Embudo" font-family="Montserrat, sans-serif" font-size="12">
    ${pasos.map((p, i) => { const y = i * altoFila + 3, w = Math.max(4, (ancho - labelW - 70) * p.v / max); return `<g><title>${esc(p.label)}: ${p.v}</title>
      <text x="0" y="${y + 20}" fill="${INK}" font-weight="600">${esc(p.label)}</text>
      <path d="M${labelW} ${y + 4} H${labelW + w - 4} a4 4 0 0 1 4 4 V${y + 24} a4 4 0 0 1 -4 4 H${labelW} Z" fill="${TEAL}"/>
      <text x="${labelW + w + 8}" y="${y + 20}" fill="${INK}" font-weight="700">${p.v}</text>
      ${i > 0 && pasos[i - 1].v ? `<text x="${labelW + w + 8 + String(p.v).length * 8 + 6}" y="${y + 20}" fill="${MUTED}">${pct(p.v / pasos[i - 1].v)} del paso anterior</text>` : ''}</g>`; }).join('')}
  </svg>`;
}
const delta = (actual, anterior, invertido = false, fmt = num, neutral = false) => {
  if (anterior == null || actual == null || anterior === '') return '';
  const d = anterior ? (actual - anterior) / anterior : null; if (d == null) return '';
  const bueno = invertido ? d < 0 : d > 0;
  return `<span class="delta ${neutral ? '' : bueno ? 'up' : 'down'}">${d > 0 ? '+' : ''}${pct(d)} vs. mes anterior (${fmt(anterior)})</span>`;
};
const meta_ = (real, meta, invertido = false, fmt = num) => meta == null || meta === '' ? '' : `<span class="meta ${real == null ? '' : (invertido ? real <= meta : real >= meta) ? 'ok' : 'no'}">Meta: ${fmt(meta)}</span>`;
const tile = (label, valor, extra = '') => `<div class="tile"><span class="label">${label}</span><b>${valor}</b>${extra}</div>`;

// ---------- HTML ----------
const s = slug(cfg.cliente);
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte ${esc(cfg.cliente)} — ${esc(nombreMes)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet"><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Montserrat', 'Segoe UI', system-ui, sans-serif; color: ${INK}; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pagina { width: 210mm; min-height: 297mm; padding: 16mm 16mm; page-break-after: always; position: relative; margin: 0 auto; }
  .pagina:last-child { page-break-after: auto; }
  .cab { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid ${TEAL}; padding-bottom: 4mm; margin-bottom: 8mm; }
  .cab .marca { font-weight: 800; font-size: 14pt; } .cab .marca span { color: ${TEAL}; }
  .cab .mes { text-align: right; font-size: 9.5pt; color: ${MUTED}; } .cab .mes b { display: block; color: ${INK}; font-size: 12pt; }
  h1 { font-size: 22pt; font-weight: 800; line-height: 1.15; margin-bottom: 2mm; } .sub { color: ${MUTED}; font-size: 10.5pt; margin-bottom: 8mm; }
  h2 { font-size: 14pt; color: ${TEAL}; margin: 8mm 0 4mm; font-weight: 800; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  .tile { border: 1.5px solid #d7ebeb; border-radius: 5px; padding: 4mm 5mm; }
  .tile .label { display: block; font-size: 8.5pt; color: ${MUTED}; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; margin-bottom: 1.5mm; }
  .tile b { display: block; font-size: 19pt; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }
  .tile.hero { grid-column: span 3; background: linear-gradient(135deg, ${INK}, ${TEAL}); color: #fff; border: 0; } .tile.hero .label { color: rgba(255,255,255,.75); } .tile.hero b { font-size: 30pt; }
  .delta, .meta { display: block; font-size: 8.5pt; margin-top: 1.5mm; color: ${MUTED}; }
  .delta.up { color: #176A3D; } .delta.down { color: #B12851; } .hero .delta.up { color: #9FE8B5; } .hero .delta.down { color: #FFB3C1; } .hero .meta { color: rgba(255,255,255,.8); }
  .meta.ok::before { content: '✓ '; color: #176A3D; } .meta.no::before { content: '○ '; }
  .resumen { background: #e6f1f1; border-radius: 5px; padding: 5mm 6mm; font-size: 10.5pt; line-height: 1.6; margin-top: 6mm; }
  .fig { border: 1.5px solid #d7ebeb; border-radius: 5px; padding: 4mm; margin-bottom: 4mm; } .fig h3 { font-size: 10.5pt; margin-bottom: 1mm; } .fig p { font-size: 8.5pt; color: ${MUTED}; margin-bottom: 3mm; }
  .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 4mm; } th { background: ${TEAL}; color: #fff; padding: 2.5mm; text-align: left; font-size: 8.5pt; } td { padding: 2.5mm; border-bottom: 1px solid #d7ebeb; } td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  ul.pasos { list-style: none; font-size: 10.5pt; line-height: 1.7; } ul.pasos li::before { content: '→'; color: #FF7B7B; margin-right: 2.5mm; }
  .pie { position: absolute; bottom: 9mm; left: 16mm; right: 16mm; font-size: 8pt; color: #9ab5b6; display: flex; justify-content: space-between; }
  .nota { font-size: 8.5pt; color: ${MUTED}; margin-top: 3mm; }
</style></head><body>

<section class="pagina">
  <div class="cab"><div class="marca">influence<span>fit</span></div><div class="mes">Reporte mensual<b>${esc(nombreMes)}</b></div></div>
  <h1>${esc(cfg.cliente)}</h1>
  <div class="sub">Nivel ${esc(cfg.nivel || '')} · preparado para ${esc(cfg.contacto || '')} · ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</div>

  <div class="tiles">
    ${tile('Evaluaciones agendadas', num(n.agendadas), delta(n.agendadas, ant.evaluaciones_agendadas) + meta_(n.agendadas, metas.evaluaciones_agendadas)).replace('class="tile"', 'class="tile hero"')}
    ${tile('Costo por evaluación agendada', clp(kpi.cpe), delta(kpi.cpe, ant.inversion && ant.evaluaciones_agendadas ? ant.inversion / ant.evaluaciones_agendadas : null, true, clp) + meta_(kpi.cpe, metas.costo_por_evaluacion, true, clp))}
    ${tile('Cierres (clientes nuevos)', num(n.cierres), delta(n.cierres, ant.cierres) + meta_(n.cierres, metas.cierres))}
    ${tile('Inversión en medios', clp(kpi.inversion), delta(kpi.inversion, ant.inversion, false, clp, true))}
    ${tile('Leads', num(n.leads), delta(n.leads, ant.leads))}
    ${tile('Costo por lead', clp(kpi.cpl), delta(kpi.cpl, ant.inversion && ant.leads ? ant.inversion / ant.leads : null, true, clp))}
    ${tile('Tasa de cierre', pct(kpi.tasaCierre), '<span class="meta">cierres / evaluaciones realizadas</span>')}
    ${tile('Ingreso mensual nuevo', clp(kpi.ingresos), `<span class="meta">retorno sobre inversión: ${kpi.roas == null ? '—' : kpi.roas.toFixed(1).replace('.', ',') + 'x'} · costo por cliente ${clp(kpi.cac)}</span>`)}
    ${tile('Horas admin / semana', m.horas_admin_semana_ahora != null && m.horas_admin_semana_ahora !== '' ? String(m.horas_admin_semana_ahora).replace('.', ',') : '—', m.horas_admin_semana_antes != null && m.horas_admin_semana_antes !== '' ? `<span class="meta">antes del sistema: ${String(m.horas_admin_semana_antes).replace('.', ',')} h</span>` : '')}
  </div>
  ${cfg.resumen ? `<div class="resumen"><strong>Lectura del mes.</strong> ${esc(cfg.resumen)}</div>` : ''}
  <div class="pie"><span>Influence Fit · ${esc(cfg.cliente)} · ${esc(nombreMes)}</span><span>1</span></div>
</section>

<section class="pagina">
  <div class="cab"><div class="marca">influence<span>fit</span></div><div class="mes">Adquisición<b>${esc(nombreMes)}</b></div></div>
  <div class="fig"><h3>Embudo del mes</h3><p>De lead a cliente. El porcentaje es respecto del paso anterior.</p>
    ${embudo([{ label: 'Leads', v: n.leads }, { label: 'Evaluaciones agendadas', v: n.agendadas }, { label: 'Evaluaciones realizadas', v: n.realizadas }, { label: 'Clientes', v: n.cierres }])}</div>
  <div class="dos">
    <div class="fig"><h3>Leads por semana</h3><p>Semanas del mes (1 = días 1–7).</p>${semanas.length ? barras(semanas, { etiqueta: d => 'Sem ' + d.w, valor: d => d.leads, alto: 150, ancho: 270 }) : '<p>Sin datos de fecha en el CRM.</p>'}</div>
    <div class="fig"><h3>Leads por calificación</h3><p>A caliente · B tibio · C frío. Dentro de cada barra, cuántos agendaron.</p>${barras(porCalif, { etiqueta: d => d.c, valor: d => d.n, alto: 150, ancho: 270, formato: v => String(v), color: d => d.c === 'A' ? TEAL : d.c === 'B' ? '#4FB3B8' : TEAL_LIGHT })}
      <p class="nota">Agendaron: A ${porCalif[0].agendadas}/${porCalif[0].n} · B ${porCalif[1].agendadas}/${porCalif[1].n} · C ${porCalif[2].agendadas}/${porCalif[2].n}</p></div>
  </div>
  <h2>Por campaña</h2>
  <table><tr><th>Campaña</th><th class="n">Gasto</th><th class="n">Impresiones</th><th class="n">Clics</th><th class="n">CTR</th><th class="n">Resultados</th><th class="n">Costo / resultado</th></tr>
    ${Object.entries(meta.campanas).sort((a, b) => b[1].gasto - a[1].gasto).map(([k, c]) => `<tr><td>${esc(k)}</td><td class="n">${clp(c.gasto)}</td><td class="n">${num(c.impresiones)}</td><td class="n">${num(c.clics)}</td><td class="n">${pct(c.impresiones ? c.clics / c.impresiones : null, 2)}</td><td class="n">${num(c.resultados)}</td><td class="n">${clp(c.resultados ? c.gasto / c.resultados : null)}</td></tr>`).join('') || '<tr><td colspan="7">Sin datos de Meta Ads para el mes.</td></tr>'}
    <tr><td><strong>Total</strong></td><td class="n"><strong>${clp(meta.gasto)}</strong></td><td class="n">${num(meta.impresiones)}</td><td class="n">${num(meta.clics)}</td><td class="n">${pct(kpi.ctr, 2)}</td><td class="n">${num(meta.resultados)}</td><td class="n">${clp(meta.resultados ? meta.gasto / meta.resultados : null)}</td></tr>
  </table>
  <p class="nota">"Resultados" es lo que Meta reporta (normalmente conversaciones iniciadas). Los leads del CRM son los que realmente conversaron con el agente; la diferencia son contactos que escribieron y no respondieron.</p>
  <h2>Por origen</h2>
  <table><tr><th>Origen</th><th class="n">Leads</th><th class="n">Agendaron</th><th class="n">% agenda</th><th class="n">Clientes</th></tr>
    ${porOrigen.map(([o, v]) => `<tr><td>${esc(o)}</td><td class="n">${v.leads}</td><td class="n">${v.agendadas}</td><td class="n">${pct(v.leads ? v.agendadas / v.leads : null)}</td><td class="n">${v.cierres}</td></tr>`).join('') || '<tr><td colspan="5">Sin leads en el mes.</td></tr>'}
  </table>
  <div class="pie"><span>Influence Fit · ${esc(cfg.cliente)} · ${esc(nombreMes)}</span><span>2</span></div>
</section>

<section class="pagina">
  <div class="cab"><div class="marca">influence<span>fit</span></div><div class="mes">Retención y operación<b>${esc(nombreMes)}</b></div></div>
  <div class="tiles">
    ${tile('Renovación al mes 3', m.renovacion_mes3 != null && m.renovacion_mes3 !== '' ? pct(m.renovacion_mes3) : '—', '<span class="meta">clientes que siguen después del primer ciclo</span>')}
    ${tile('Renovación al mes 6', m.renovacion_mes6 != null && m.renovacion_mes6 !== '' ? pct(m.renovacion_mes6) : '—', '')}
    ${tile('Leads perdidos', num(n.perdidos), `<span class="meta">${pct(n.leads ? n.perdidos / n.leads : null)} de los leads</span>`)}
    ${tile('Piezas publicadas', m.piezas_publicadas != null && m.piezas_publicadas !== '' ? num(m.piezas_publicadas) : '—', cfg.nivel == 3 ? '<span class="meta">Meta Nivel 3: 12–16 / mes</span>' : '')}
    ${tile('Alcance orgánico', m.alcance_organico != null && m.alcance_organico !== '' ? num(m.alcance_organico) : '—', '')}
    ${tile('Alcance pagado', num(meta.alcance), '')}
  </div>
  <h2>Próximos pasos</h2>
  <ul class="pasos">${(cfg.proximos_pasos || []).map(p => `<li>${esc(p)}</li>`).join('') || '<li>—</li>'}</ul>
  <h2>Cómo leer este reporte</h2>
  <table>
    <tr><th>KPI</th><th>Cómo se calcula</th><th>Por qué importa</th></tr>
    <tr><td>Costo por evaluación agendada</td><td>Inversión en medios ÷ evaluaciones agendadas</td><td>Es el número que manda: dice cuánto cuesta sentar a alguien frente al coach.</td></tr>
    <tr><td>Tasa de cierre</td><td>Clientes ÷ evaluaciones realizadas</td><td>Si es baja, el problema está en la evaluación o en la oferta, no en los anuncios.</td></tr>
    <tr><td>Renovación mes 3 y 6</td><td>Clientes que renuevan ÷ clientes que llegaron a ese mes</td><td>Retener cuesta 5 veces menos que captar. Aquí se juega el margen.</td></tr>
    <tr><td>Horas admin / semana</td><td>Declarado por el coach, antes y después del sistema</td><td>Horas que vuelven a entrenar gente o a descansar.</td></tr>
  </table>
  <div class="pie"><span>Influence Fit · ${esc(cfg.cliente)} · ${esc(nombreMes)}</span><span>3</span></div>
</section>
</body></html>`;

const outDir = path.join(__dirname, 'salida');
fs.mkdirSync(outDir, { recursive: true });
console.log(`Mes ${mes}: ${n.leads} leads · ${n.agendadas} agendadas · ${n.realizadas} realizadas · ${n.cierres} cierres · inversión ${clp(meta.gasto)} · CPE ${clp(kpi.cpe)}`);
escribirHtmlYPdf(outDir, `reporte-${s}-${mes}`, html);
