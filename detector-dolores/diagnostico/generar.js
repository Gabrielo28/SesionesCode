/*
 * Generador de diagnósticos — Detector de Dolores · Influence Chile
 *
 *   node generar.js                      usa negocio.json
 *   node generar.js otro.json            usa otro archivo de datos
 *
 * Produce: diagnostico-<negocio>.html  y  diagnostico-<negocio>.pdf
 * Sin dependencias. El PDF se genera con Chrome en modo headless si está instalado.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const LOGO = path.join(__dirname, '..', '..', 'web-influence', 'assets', 'logo-teal.png');

// Rutas típicas de Chrome / Chromium. También se puede fijar con la variable CHROME.
const CHROME_CANDIDATOS = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
].filter(Boolean);

// Las 8 áreas, en el orden de la cadena del dinero.
const AREAS = {
  captacion:  { n: 1, nombre: 'Captación',        pregunta: '¿Llega suficiente gente?' },
  conversion: { n: 2, nombre: 'Conversión',       pregunta: '¿Los que llegan, compran?' },
  margen:     { n: 3, nombre: 'Ticket y margen',  pregunta: '¿Queda plata de cada venta?' },
  operacion:  { n: 4, nombre: 'Operación',        pregunta: '¿Se entrega bien y a tiempo?' },
  caja:       { n: 5, nombre: 'Caja y cobro',     pregunta: '¿La plata llega cuando debe?' },
  retencion:  { n: 6, nombre: 'Retención',        pregunta: '¿Vuelven a comprar?' },
  personas:   { n: 7, nombre: 'Personas y dueño', pregunta: '¿Funciona sin el dueño?' },
  datos:      { n: 8, nombre: 'Datos y control',  pregunta: '¿Se sabe cuánto se gana?' }
};

const ESTADOS = {
  bien:    { etiqueta: 'Bien',    color: '#2E9E6B', fondo: '#E6F5EC' },
  alerta:  { etiqueta: 'Alerta',  color: '#D98E04', fondo: '#FFF4DE' },
  critico: { etiqueta: 'Crítico', color: '#D64545', fondo: '#FDE8E8' }
};

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const archivo = process.argv[2] || 'negocio.json';
const d = JSON.parse(fs.readFileSync(path.resolve(__dirname, archivo), 'utf8'));

// Validaciones mínimas para no producir un PDF a medias.
if (!d.negocio) throw new Error('Falta "negocio"');
if (!Array.isArray(d.fortalezas) || d.fortalezas.length < 2) throw new Error('"fortalezas" necesita al menos 2 puntos: sin eso el diagnóstico se lee como ataque');
if (!Array.isArray(d.areas) || d.areas.length !== 8) throw new Error('"areas" debe tener las 8 áreas: ' + Object.keys(AREAS).join(', '));
for (const a of d.areas) {
  if (!AREAS[a.id]) throw new Error(`Área desconocida: "${a.id}". Válidas: ${Object.keys(AREAS).join(', ')}`);
  if (!ESTADOS[a.estado]) throw new Error(`Estado inválido en "${a.id}": "${a.estado}". Válidos: bien, alerta, critico`);
}
if (!Array.isArray(d.cuellos) || !d.cuellos.length) throw new Error('"cuellos" necesita al menos el cuello de botella principal');

const logo64 = fs.existsSync(LOGO) ? 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64') : '';
const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long' });
const areasOrdenadas = Object.keys(AREAS).map(id => d.areas.find(a => a.id === id));
const criticas = areasOrdenadas.filter(a => a.estado === 'critico').length;
const alertas = areasOrdenadas.filter(a => a.estado === 'alerta').length;
const totalPaginas = 3 + (d.plan_30_dias && d.plan_30_dias.length ? 1 : 0);

const pie = n => `<div class="pie"><span>Influence Chile · Diagnóstico de ${esc(d.negocio)} · confidencial</span><span>${n} / ${totalPaginas}</span></div>`;

const renderCuello = (c, i) => `
  <div class="cuello ${i === 0 ? 'principal' : 'sec'}">
    <span class="tag">${i === 0 ? 'Cuello de botella' : `Dolor secundario ${i}`}${c.area && AREAS[c.area] ? ' · ' + AREAS[c.area].nombre : ''}${c.codigo ? ' · ' + esc(c.codigo) : ''}</span>
    <h4>${esc(c.titulo)}</h4>
    <div class="fila"><div class="et">Qué pasa</div><p>${esc(c.que_pasa)}</p></div>
    <div class="fila"><div class="et">Cuánto cuesta</div><p><span class="costo">${esc(c.cuanto_cuesta)}${c.detalle_costo ? `<small>${esc(c.detalle_costo)}</small>` : ''}</span></p></div>
    <div class="fila"><div class="et">Cómo se arregla</div><p>${esc(c.como_se_arregla)}${c.plazo ? ` <span class="plazo">· ${esc(c.plazo)}</span>` : ''}</p></div>
  </div>`;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Diagnóstico ${esc(d.negocio)} — Influence Chile</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #123638; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pagina { width: 210mm; min-height: 297mm; padding: 18mm 16mm 22mm; page-break-after: always; position: relative; }
  .pagina:last-child { page-break-after: auto; }

  .portada { background: linear-gradient(155deg, #123638 0%, #12959C 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; }
  .portada img { width: 52mm; margin-bottom: 16mm; filter: brightness(0) invert(1); }
  .portada .marca { font-size: 26pt; font-weight: 700; margin-bottom: 16mm; letter-spacing: -.02em; }
  .portada .kicker { text-transform: uppercase; letter-spacing: .28em; font-size: 9pt; opacity: .75; margin-bottom: 6mm; }
  .portada h1 { font-size: 34pt; line-height: 1.1; font-weight: 700; margin-bottom: 6mm; }
  .portada h2 { font-size: 13.5pt; font-weight: 400; opacity: .92; line-height: 1.55; margin-bottom: 14mm; max-width: 150mm; }
  .portada .meta { font-size: 10pt; opacity: .8; line-height: 1.9; border-top: 1px solid rgba(255,255,255,.25); padding-top: 6mm; }

  h3.seccion { font-size: 20pt; color: #12959C; margin-bottom: 3mm; }
  h3.seccion + .linea { width: 18mm; height: 3px; background: #FF7B7B; margin-bottom: 7mm; }
  p.intro { font-size: 10.8pt; line-height: 1.6; color: #2c4a4c; margin-bottom: 6mm; }
  p.intro strong { color: #123638; }

  .fortalezas { background: #e6f1f1; border-radius: 5px; padding: 4mm 5mm; margin-bottom: 6mm; }
  .fortalezas h4 { font-size: 10pt; text-transform: uppercase; letter-spacing: .12em; color: #12959C; margin-bottom: 2.5mm; }
  .fortalezas li { font-size: 10pt; line-height: 1.6; color: #2c4a4c; list-style: none; padding-left: 5mm; position: relative; margin-bottom: 1.5mm; }
  .fortalezas li::before { content: '✓'; position: absolute; left: 0; color: #2E9E6B; font-weight: 700; }

  .mapa { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .area { border: 1.5px solid #d7ebeb; border-radius: 5px; padding: 3mm 3.5mm; border-left-width: 4px; }
  .area .cab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.5mm; }
  .area .num { font-size: 8pt; color: #9ab5b6; font-weight: 600; margin-right: 1.5mm; }
  .area h4 { font-size: 10.5pt; display: inline; }
  .area .estado { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; padding: .8mm 2.2mm; border-radius: 3px; }
  .area p { font-size: 8.6pt; line-height: 1.45; color: #2c4a4c; }
  .area .ev { font-size: 7.6pt; color: #6b8b8c; margin-top: 1.2mm; font-style: italic; }
  .chip { display: inline-block; font-family: Consolas, 'Courier New', monospace; font-size: 7.2pt; font-weight: 700; letter-spacing: .04em; padding: .5mm 1.6mm; border-radius: 2px; background: #e6f1f1; color: #12959C; margin-left: 1.2mm; vertical-align: 1.5px; }
  .area.critico .chip { background: #FDE8E8; color: #D64545; } .area.alerta .chip { background: #FFF4DE; color: #B06F00; }


  .cuello { border: 2px solid #d7ebeb; border-radius: 6px; padding: 5mm 6mm; margin-bottom: 5mm; page-break-inside: avoid; }
  .secundarios { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .cuello.sec { padding: 4mm 4.5mm; margin-bottom: 0; }
  .cuello.sec .fila { display: block; }
  .cuello.sec .fila .et { margin-bottom: .6mm; }
  .cuello.principal { border-color: #FF7B7B; background: #fffafa; }
  .cuello .tag { display: inline-block; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; padding: 1mm 2.5mm; border-radius: 3px; margin-bottom: 2.5mm; background: #e6f1f1; color: #12959C; }
  .cuello.principal .tag { background: #FF7B7B; color: #fff; }
  .cuello h4 { font-size: 13.5pt; line-height: 1.25; margin-bottom: 3mm; }
  .cuello.sec h4 { font-size: 11.5pt; margin-bottom: 2mm; }
  .cuello .fila { display: flex; gap: 5mm; margin-bottom: 2.5mm; }
  .cuello.sec .fila { margin-bottom: 1.8mm; }
  .cuello .fila .et { flex: 0 0 28mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .1em; color: #12959C; font-weight: 700; padding-top: .8mm; }
  .cuello .fila p { flex: 1; font-size: 9.8pt; line-height: 1.5; color: #2c4a4c; }
  .cuello.sec .fila p { font-size: 8.6pt; line-height: 1.42; }
  .cuello .costo { font-size: 16pt; font-weight: 700; color: #c0392b; }
  .cuello.sec .costo { font-size: 12pt; }
  .cuello .costo small { display: block; font-size: 8.3pt; font-weight: 400; color: #6b8b8c; line-height: 1.45; margin-top: 1mm; }
  .cuello.sec .costo small { font-size: 7.4pt; }
  .cuello .plazo { font-size: 9pt; color: #6b8b8c; }

  .fase { display: flex; gap: 5mm; margin-bottom: 4mm; }
  .fase .periodo { flex: 0 0 30mm; font-weight: 700; color: #12959C; font-size: 10.5pt; padding-top: 1mm; }
  .fase ul { flex: 1; list-style: none; font-size: 10.2pt; line-height: 1.6; color: #2c4a4c; }
  .fase li::before { content: '→'; color: #FF7B7B; margin-right: 2.5mm; }

  .nota { background: #e6f1f1; border-radius: 5px; padding: 5mm 6mm; font-size: 10.5pt; line-height: 1.6; margin-bottom: 8mm; }
  .nota strong { color: #12959C; }

  .cta { text-align: center; padding: 2mm 0 0; }
  .cta h3 { font-size: 18pt; color: #12959C; margin-bottom: 2mm; }
  .cta p { font-size: 10.5pt; color: #2c4a4c; line-height: 1.6; margin-bottom: 4mm; }
  .cta .boton { display: inline-block; background: #FF7B7B; color: #fff; padding: 4mm 10mm; border-radius: 40px; font-size: 12pt; font-weight: 600; }
  .firma { margin-top: 5mm; padding-top: 4mm; border-top: 1px solid #d7ebeb; font-size: 10pt; color: #2c4a4c; line-height: 1.8; text-align: center; }
  .pie { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; font-size: 8pt; color: #9ab5b6; display: flex; justify-content: space-between; }
</style></head><body>

<section class="pagina portada">
  ${logo64 ? `<img src="${logo64}" alt="Influence Chile">` : '<div class="marca">influence</div>'}
  <div class="kicker">Diagnóstico de negocio</div>
  <h1>${esc(d.negocio)}</h1>
  <h2>${esc(d.resumen)}</h2>
  <div class="meta">
    Preparado para ${esc(d.contacto)}${d.cargo ? ', ' + esc(d.cargo) : ''}<br>
    ${esc(d.rubro)}${d.ciudad ? ' · ' + esc(d.ciudad) : ''}<br>
    ${fecha}${d.fuentes && d.fuentes.length ? '<br><br>Fuentes: ' + d.fuentes.map(esc).join(' · ') : ''}
  </div>
</section>

<section class="pagina">
  <h3 class="seccion">El mapa del negocio</h3><div class="linea"></div>
  <p class="intro">Todo negocio es la misma cadena: alguien se entera, llega, compra, se le entrega, se cobra y vuelve. Revisamos las 8 áreas de ${esc(d.negocio)}. <strong>${criticas} en rojo, ${alertas} en amarillo.</strong> Pero primero, lo que funciona.</p>
  <div class="fortalezas">
    <h4>Lo que ${esc(d.negocio)} hace bien</h4>
    <ul>${d.fortalezas.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
  </div>
  <div class="mapa">
    ${areasOrdenadas.map(a => { const A = AREAS[a.id], E = ESTADOS[a.estado]; return `
    <div class="area ${a.estado}" style="border-left-color:${E.color}">
      <div class="cab"><div><span class="num">${A.n}</span><h4>${A.nombre}</h4>${a.codigos && a.codigos.length ? ' ' + a.codigos.map(c => `<span class="chip">${esc(c)}</span>`).join('') : ''}</div><span class="estado" style="background:${E.fondo};color:${E.color}">${E.etiqueta}</span></div>
      <p>${esc(a.hallazgo)}</p>
      ${a.evidencia ? `<div class="ev">${esc(a.evidencia)}</div>` : ''}
    </div>`; }).join('')}
  </div>
  ${pie(2)}
</section>

<section class="pagina">
  <h3 class="seccion">El cuello de botella</h3><div class="linea"></div>
  <p class="intro">De todo lo anterior, hay una tranca que limita más que las otras. Es por donde conviene partir: la que más cuesta hoy y la que se puede destrabar más rápido.</p>
  ${renderCuello(d.cuellos[0], 0)}
  ${d.cuellos.length > 1 ? `<div class="secundarios">${d.cuellos.slice(1).map((c, i) => renderCuello(c, i + 1)).join('')}</div>` : ''}
  ${pie(3)}
</section>

${d.plan_30_dias && d.plan_30_dias.length ? `
<section class="pagina">
  <h3 class="seccion">Los primeros 30 días</h3><div class="linea"></div>
  <p class="intro">Qué haríamos, semana a semana, para destrabar el cuello de botella. Sin precios: eso se conversa cuando el plan tenga sentido.</p>
  ${d.plan_30_dias.map(f => `
    <div class="fase">
      <div class="periodo">${esc(f.periodo)}</div>
      <ul>${f.acciones.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
    </div>`).join('')}
  ${d.siguiente_paso ? `<div class="nota" style="margin-top:4mm;margin-bottom:6mm"><strong>Siguiente paso:</strong> ${esc(d.siguiente_paso)}</div>` : ''}
  <div class="cta">
    <h3>¿Lo conversamos?</h3>
    <p>Este diagnóstico es gratis y es tuyo, lo trabajemos juntos o no.<br>Si tiene sentido, el siguiente paso son 30 minutos para definir cómo partimos.</p>
    <div class="boton">+56 9 6545 0723</div>
    <div class="firma">
      <strong>Gabriel Meza</strong> · Influence Chile<br>
      influencechile.cl · +56 9 6545 0723<br>
      Instagram: @influence.chile
    </div>
  </div>
  ${pie(4)}
</section>` : ''}

</body></html>`;

const slug = d.negocio.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const htmlPath = path.join(__dirname, `diagnostico-${slug}.html`);
const pdfPath = path.join(__dirname, `diagnostico-${slug}.pdf`);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML  ->', htmlPath);

const chrome = CHROME_CANDIDATOS.find(p => fs.existsSync(p));
if (!chrome) {
  console.error('No encontré Chrome. Abre el HTML en Chrome e imprime a PDF, o define la variable CHROME con la ruta del ejecutable.');
  process.exit(0);
}
try {
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`, 'file:///' + htmlPath.replace(/\\/g, '/').replace(/^\//, '')
  ], { stdio: 'pipe' });
  console.log('PDF   ->', pdfPath);
} catch (e) {
  console.error('No se pudo generar el PDF. Abre el HTML en Chrome e imprime a PDF.');
  console.error(String(e.stderr || e.message).slice(0, 400));
}
