/*
 * Generador de Diagnóstico de Workflows — Influence Chile
 *
 *   node generar-diagnostico.js                    usa cliente-workflows.json
 *   node generar-diagnostico.js otro.json           usa otro archivo de datos
 *
 * Metodología: ../06-diagnostico-workflows.md
 * Produce: diagnostico-<empresa>.html  y  diagnostico-<empresa>.pdf
 *
 * Sin precios (regla 5 de la metodología): el precio va en la reunión, no en el diagnóstico.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOGO = path.join(__dirname, '..', '..', 'web-influence', 'assets', 'logo-teal.png');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const archivo = process.argv[2] || 'cliente-workflows.json';
const d = JSON.parse(fs.readFileSync(path.join(__dirname, archivo), 'utf8'));

const logo64 = fs.existsSync(LOGO)
  ? 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64')
  : '';

const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long' });

const PRIORIDAD_LABEL = { 1: 'Prioridad 1 — hacer primero', 2: 'Prioridad 2 — fase 2', 3: 'Add-on' };

const cuellos = [...(d.cuellos_botella || [])].sort((a, b) => (a.prioridad || 9) - (b.prioridad || 9));
const soluciones = [...(d.soluciones || [])].sort((a, b) => (a.prioridad || 9) - (b.prioridad || 9));

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Diagnóstico de Workflows — ${esc(d.empresa)} — Influence Chile</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #123638; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pagina { width: 210mm; min-height: 297mm; padding: 18mm 16mm; page-break-after: always; position: relative; }
  .pagina:last-child { page-break-after: auto; }

  .portada { background: linear-gradient(155deg, #123638 0%, #12959C 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; }
  .portada img { width: 52mm; margin-bottom: 16mm; filter: brightness(0) invert(1); }
  .portada .kicker { text-transform: uppercase; letter-spacing: .28em; font-size: 9pt; opacity: .75; margin-bottom: 6mm; }
  .portada h1 { font-size: 30pt; line-height: 1.15; font-weight: 700; margin-bottom: 4mm; }
  .portada h2 { font-size: 14pt; font-weight: 400; opacity: .9; margin-bottom: 14mm; }
  .portada .meta { font-size: 10pt; opacity: .8; line-height: 1.9; border-top: 1px solid rgba(255,255,255,.25); padding-top: 6mm; }

  h3.seccion { font-size: 20pt; color: #12959C; margin-bottom: 3mm; }
  h3.seccion + .linea { width: 18mm; height: 3px; background: #FF7B7B; margin-bottom: 8mm; }
  p.intro { font-size: 11pt; line-height: 1.65; color: #2c4a4c; margin-bottom: 8mm; }

  .fortaleza { display: flex; gap: 4mm; align-items: flex-start; margin-bottom: 5mm; font-size: 11pt; line-height: 1.6; color: #2c4a4c; }
  .fortaleza .check { flex: 0 0 6mm; color: #12959C; font-weight: 700; }

  .hallazgo { border-left: 3px solid #FF7B7B; padding: 0 0 0 6mm; margin-bottom: 7mm; }
  .hallazgo .tag { display: inline-block; font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color: #c0392b; background: #ffeaea; padding: 1mm 2.5mm; border-radius: 3px; margin-bottom: 2mm; }
  .hallazgo h4 { font-size: 12.5pt; margin-bottom: 2mm; }
  .hallazgo p { font-size: 10.5pt; line-height: 1.6; color: #2c4a4c; }
  .hallazgo .costo { display: inline-block; margin-top: 3mm; font-size: 9.5pt; background: #fff1f1; color: #c0392b; padding: 1.5mm 3mm; border-radius: 3px; font-weight: 600; }

  .solucion { border: 1.5px solid #d7ebeb; border-radius: 6px; padding: 5mm 6mm; margin-bottom: 5mm; }
  .solucion.p1 { border-color: #12959C; border-width: 2px; background: #f4fbfb; }
  .solucion .badge { display: inline-block; font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; color: #fff; background: #12959C; padding: 1mm 2.5mm; border-radius: 3px; margin-bottom: 2mm; }
  .solucion h4 { font-size: 12.5pt; color: #123638; margin-bottom: 2mm; }
  .solucion p.detalle { font-size: 10.5pt; line-height: 1.6; color: #2c4a4c; margin-bottom: 2mm; }
  .solucion ul { list-style: none; font-size: 9.5pt; line-height: 1.6; color: #2c4a4c; }
  .solucion li::before { content: '▪'; color: #12959C; margin-right: 2mm; }

  .fase { display: flex; gap: 5mm; margin-bottom: 6mm; }
  .fase .periodo { flex: 0 0 32mm; font-weight: 700; color: #12959C; font-size: 10.5pt; padding-top: 1mm; }
  .fase ul { flex: 1; list-style: none; font-size: 10.5pt; line-height: 1.7; color: #2c4a4c; }
  .fase li::before { content: '→'; color: #FF7B7B; margin-right: 2.5mm; }

  .cta { text-align: center; padding: 6mm 0 0; }
  .cta h3 { font-size: 20pt; color: #12959C; margin-bottom: 3mm; }
  .cta p { font-size: 11pt; color: #2c4a4c; line-height: 1.7; margin-bottom: 6mm; }
  .cta .boton { display: inline-block; background: #FF7B7B; color: #fff; padding: 4mm 10mm; border-radius: 40px; font-size: 12pt; font-weight: 600; }
  .firma { margin-top: 9mm; padding-top: 5mm; border-top: 1px solid #d7ebeb; font-size: 10pt; color: #2c4a4c; line-height: 1.8; text-align: center; }
  .pie { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; font-size: 8pt; color: #9ab5b6; display: flex; justify-content: space-between; }
</style></head><body>

<section class="pagina portada">
  ${logo64 ? `<img src="${logo64}" alt="Influence Chile">` : '<div style="font-size:26pt;font-weight:700;margin-bottom:16mm">influence</div>'}
  <div class="kicker">Diagnóstico de workflows</div>
  <h1>${esc(d.empresa)}</h1>
  <h2>${esc(d.objetivo)}</h2>
  <div class="meta">
    Preparado para ${esc(d.contacto)}${d.cargo ? ', ' + esc(d.cargo) : ''}<br>
    ${esc(d.rubro)}${d.ciudad ? ' · ' + esc(d.ciudad) : ''}${d.segmento ? ' · ' + esc(d.segmento) : ''}<br>
    ${fecha}
  </div>
</section>

<section class="pagina">
  <h3 class="seccion">Lo que ya funciona bien</h3><div class="linea"></div>
  <p class="intro">Antes de los cuellos de botella, esto es lo que ${esc(d.empresa)} ya tiene resuelto.</p>
  ${(d.fortalezas || []).map(f => `<div class="fortaleza"><span class="check">✓</span><span>${esc(f)}</span></div>`).join('')}
  <div class="pie"><span>Influence Chile · Diagnóstico para ${esc(d.empresa)}</span><span>2</span></div>
</section>

<section class="pagina">
  <h3 class="seccion">Los cuellos de botella</h3><div class="linea"></div>
  <p class="intro">Esto es lo que hoy le cuesta tiempo y plata a ${esc(d.empresa)}, ordenado por lo que más pesa.</p>
  ${cuellos.map((h, i) => `
    <div class="hallazgo">
      ${h.prioridad ? `<div class="tag">${esc(PRIORIDAD_LABEL[h.prioridad] || 'Hallazgo')}</div>` : ''}
      <h4>${i + 1}. ${esc(h.titulo)}</h4>
      <p>${esc(h.detalle)}</p>
      ${h.costo ? `<span class="costo">${esc(h.costo)}</span>` : ''}
    </div>`).join('')}
  <div class="pie"><span>Influence Chile · Diagnóstico para ${esc(d.empresa)}</span><span>3</span></div>
</section>

<section class="pagina">
  <h3 class="seccion">Soluciones recomendadas</h3><div class="linea"></div>
  <p class="intro">Priorizadas por impacto y facilidad de implementación — la 1 se resuelve primero.</p>
  ${soluciones.map(s => `
    <div class="solucion ${s.prioridad === 1 ? 'p1' : ''}">
      ${s.prioridad ? `<div class="badge">${esc(PRIORIDAD_LABEL[s.prioridad] || '')}</div>` : ''}
      <h4>${esc(s.nombre)}</h4>
      <p class="detalle">${esc(s.detalle)}</p>
      ${(s.incluye || []).length ? `<ul>${s.incluye.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </div>`).join('')}
  <div class="pie"><span>Influence Chile · Diagnóstico para ${esc(d.empresa)}</span><span>4</span></div>
</section>

<section class="pagina">
  <h3 class="seccion">Los primeros 60-90 días</h3><div class="linea"></div>
  <p class="intro">Trabajo por fases, con entregables concretos en cada mes.</p>
  ${(d.roadmap || []).map(f => `
    <div class="fase">
      <div class="periodo">${esc(f.periodo)}</div>
      <ul>${f.hitos.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
    </div>`).join('')}
  <div class="cta">
    <h3>¿Lo conversamos?</h3>
    <p>30 minutos, sin compromiso, para revisar esto juntos y definir por dónde partir.</p>
    <div class="boton">+56 9 6545 0723</div>
    <div class="firma">
      <strong>Gabriel Meza</strong> · Influence Chile<br>
      influencechile.cl · +56 9 6545 0723<br>
      Instagram: @influence.chile
    </div>
  </div>
  <div class="pie"><span>Influence Chile · Diagnóstico para ${esc(d.empresa)}</span><span>5</span></div>
</section>

</body></html>`;

const slug = d.empresa.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const htmlPath = path.join(__dirname, `diagnostico-${slug}.html`);
const pdfPath = path.join(__dirname, `diagnostico-${slug}.pdf`);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('HTML  ->', htmlPath);

try {
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`, 'file:///' + htmlPath.replace(/\\/g, '/')
  ], { stdio: 'pipe' });
  console.log('PDF   ->', pdfPath);
} catch (e) {
  console.error('No se pudo generar el PDF. Abre el HTML en Chrome e imprime a PDF.');
  console.error(String(e.stderr || e.message).slice(0, 400));
}
