/*
 * Generador de propuestas personalizadas — Influence Chile
 *
 *   node generar.js                  usa cliente.json
 *   node generar.js otro.json        usa otro archivo de datos
 *
 * Produce: propuesta-<empresa>.html  y  propuesta-<empresa>.pdf
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOGO = path.join(__dirname, '..', '..', 'web-influence', 'assets', 'logo-teal.png');

const PLANES = {
  presencia: {
    nombre: 'Presencia',
    precio: 290000,
    bajada: 'Para ordenar la casa y publicar con constancia.',
    incluye: [
      '8 publicaciones mensuales',
      'Historias 3 veces por semana',
      'Diseño gráfico y edición de video',
      'Calendario de contenido mensual',
      'Community management (respuesta de comentarios y DMs)',
      'Meta Ads básico (hasta 2 campañas)',
      'Reporte mensual de métricas'
    ]
  },
  crecimiento: {
    nombre: 'Crecimiento',
    precio: 450000,
    bajada: 'Para crecer en serio: más contenido, pauta e influencers.',
    incluye: [
      '12 publicaciones mensuales',
      'Historias diarias',
      '4 reels mensuales con edición avanzada',
      'Diseño gráfico y edición de video',
      'Calendario de contenido y estrategia mensual',
      'Community management',
      'Meta Ads básico (hasta 2 campañas)',
      'Campañas con influencers sin costo adicional',
      'Reporte mensual + reunión de estrategia'
    ]
  },
  autoridad: {
    nombre: 'Autoridad',
    precio: 749990,
    bajada: 'Para marcas que quieren liderar su categoría.',
    incluye: [
      '20 publicaciones mensuales',
      'Historias diarias con producción',
      '8 reels mensuales con edición avanzada',
      'Producción audiovisual en terreno',
      'Estrategia de contenido y de marca',
      'Community management prioritario',
      'Meta Ads básico (hasta 2 campañas)',
      'Campañas con influencers sin costo adicional',
      'Gestión de TikTok Ads y Google Ads',
      'Reporte quincenal + reunión de estrategia'
    ]
  }
};

const ADDONS = {
  meta_ads:    { nombre: 'Gestión avanzada de Meta Ads', min: 150000, max: 300000, detalle: 'Sobre las 2 campañas incluidas: estructura completa, públicos, testeo de creativos y optimización semanal.' },
  contenido:   { nombre: 'Contenido Estratégico',        min: 69990,                detalle: 'Sesión de producción adicional en terreno: fotos y video para alimentar el mes completo.' },
  influencers: { nombre: 'Campaña de Influencers',       min: 99990,                detalle: 'Casting, negociación, brief, seguimiento y reporte de la campaña completa.' }
};

const clp = n => '$' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const archivo = process.argv[2] || 'cliente.json';
const d = JSON.parse(fs.readFileSync(path.join(__dirname, archivo), 'utf8'));

const logo64 = fs.existsSync(LOGO)
  ? 'data:image/png;base64,' + fs.readFileSync(LOGO).toString('base64')
  : '';

const recomendado = PLANES[d.plan_recomendado];
if (!recomendado) throw new Error('plan_recomendado debe ser: presencia, crecimiento o autoridad');

const addonsSel = (d.addons || []).map(k => ADDONS[k]).filter(Boolean);
const precioAddon = a => a.max ? `${clp(a.min)} – ${clp(a.max)}` : clp(a.min);
const totalMin = recomendado.precio + addonsSel.reduce((s, a) => s + a.min, 0);
const totalMax = recomendado.precio + addonsSel.reduce((s, a) => s + (a.max || a.min), 0);
const totalTexto = totalMax > totalMin ? `${clp(totalMin)} – ${clp(totalMax)}` : clp(totalMin);
const fecha = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long' });

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Propuesta ${esc(d.empresa)} — Influence Chile</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #123638; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pagina { width: 210mm; min-height: 297mm; padding: 18mm 16mm; page-break-after: always; position: relative; }
  .pagina:last-child { page-break-after: auto; }

  .portada { background: linear-gradient(155deg, #123638 0%, #12959C 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; }
  .portada img { width: 52mm; margin-bottom: 16mm; filter: brightness(0) invert(1); }
  .portada .kicker { text-transform: uppercase; letter-spacing: .28em; font-size: 9pt; opacity: .75; margin-bottom: 6mm; }
  .portada h1 { font-size: 34pt; line-height: 1.1; font-weight: 700; margin-bottom: 4mm; }
  .portada h2 { font-size: 15pt; font-weight: 400; opacity: .9; margin-bottom: 14mm; }
  .portada .meta { font-size: 10pt; opacity: .8; line-height: 1.9; border-top: 1px solid rgba(255,255,255,.25); padding-top: 6mm; }

  h3.seccion { font-size: 20pt; color: #12959C; margin-bottom: 3mm; }
  h3.seccion + .linea { width: 18mm; height: 3px; background: #FF7B7B; margin-bottom: 8mm; }
  p.intro { font-size: 11pt; line-height: 1.65; color: #2c4a4c; margin-bottom: 8mm; }

  .hallazgo { border-left: 3px solid #FF7B7B; padding: 0 0 0 6mm; margin-bottom: 7mm; }
  .hallazgo h4 { font-size: 12.5pt; margin-bottom: 2mm; }
  .hallazgo p { font-size: 10.5pt; line-height: 1.6; color: #2c4a4c; }
  .hallazgo .impacto { display: inline-block; margin-top: 3mm; font-size: 9.5pt; background: #ffeaea; color: #c0392b; padding: 1.5mm 3mm; border-radius: 3px; }

  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 8mm; }
  th { background: #12959C; color: #fff; padding: 3mm; text-align: left; font-weight: 600; font-size: 9.5pt; }
  td { padding: 3mm; border-bottom: 1px solid #d7ebeb; }
  tr.destacado td { background: #fff1f1; font-weight: 600; }

  .planes { display: flex; gap: 4mm; margin-bottom: 8mm; }
  .plan { flex: 1; border: 1.5px solid #d7ebeb; border-radius: 5px; padding: 5mm; }
  .plan.rec { border-color: #FF7B7B; border-width: 2.5px; background: #fffafa; }
  .plan .badge { display: inline-block; background: #FF7B7B; color: #fff; font-size: 7.5pt; padding: 1mm 2.5mm; border-radius: 3px; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 2mm; }
  .plan h4 { font-size: 13pt; color: #12959C; }
  .plan .precio { font-size: 17pt; font-weight: 700; margin: 1mm 0 3mm; }
  .plan .precio small { font-size: 8.5pt; font-weight: 400; color: #6b8b8c; }
  .plan ul { list-style: none; font-size: 8.5pt; line-height: 1.65; color: #2c4a4c; }
  .plan li::before { content: '▪'; color: #12959C; margin-right: 2mm; }

  .nota { background: #e6f1f1; border-radius: 5px; padding: 5mm 6mm; font-size: 10.5pt; line-height: 1.6; margin-bottom: 8mm; }
  .nota strong { color: #12959C; }

  .fase { display: flex; gap: 5mm; margin-bottom: 6mm; }
  .fase .periodo { flex: 0 0 32mm; font-weight: 700; color: #12959C; font-size: 10.5pt; padding-top: 1mm; }
  .fase ul { flex: 1; list-style: none; font-size: 10.5pt; line-height: 1.7; color: #2c4a4c; }
  .fase li::before { content: '→'; color: #FF7B7B; margin-right: 2.5mm; }

  .total { background: linear-gradient(135deg, #123638, #12959C); color: #fff; border-radius: 6px; padding: 8mm; margin-bottom: 8mm; }
  .total .fila { display: flex; justify-content: space-between; padding: 2.5mm 0; font-size: 11pt; border-bottom: 1px solid rgba(255,255,255,.18); }
  .total .fila:last-child { border: 0; padding-top: 5mm; font-size: 15pt; font-weight: 700; }

  .cta { text-align: center; padding: 6mm 0 0; }
  .cta h3 { font-size: 20pt; color: #12959C; margin-bottom: 3mm; }
  .cta p { font-size: 11pt; color: #2c4a4c; line-height: 1.7; margin-bottom: 6mm; }
  .cta .boton { display: inline-block; background: #FF7B7B; color: #fff; padding: 4mm 10mm; border-radius: 40px; font-size: 12pt; font-weight: 600; }
  .firma { margin-top: 9mm; padding-top: 5mm; border-top: 1px solid #d7ebeb; font-size: 10pt; color: #2c4a4c; line-height: 1.8; text-align: center; }
  .pie { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; font-size: 8pt; color: #9ab5b6; display: flex; justify-content: space-between; }
</style></head><body>

<section class="pagina portada">
  ${logo64 ? `<img src="${logo64}" alt="Influence Chile">` : '<div style="font-size:26pt;font-weight:700;margin-bottom:16mm">influence</div>'}
  <div class="kicker">Propuesta de servicios</div>
  <h1>${esc(d.empresa)}</h1>
  <h2>${esc(d.objetivo)}</h2>
  <div class="meta">
    Preparada para ${esc(d.contacto)}${d.cargo ? ', ' + esc(d.cargo) : ''}<br>
    ${esc(d.rubro)}${d.ciudad ? ' · ' + esc(d.ciudad) : ''}<br>
    ${fecha}
  </div>
</section>

<section class="pagina">
  <h3 class="seccion">Qué encontramos</h3><div class="linea"></div>
  <p class="intro">Revisamos ${d.instagram ? esc(d.instagram) + ' y ' : ''}la presencia digital de ${esc(d.empresa)}. Estos son los tres puntos que hoy están costando clientes.</p>
  ${d.diagnostico.map((h, i) => `
    <div class="hallazgo">
      <h4>${i + 1}. ${esc(h.titulo)}</h4>
      <p>${esc(h.detalle)}</p>
      ${h.impacto ? `<span class="impacto">${esc(h.impacto)}</span>` : ''}
    </div>`).join('')}
  ${d.competencia && d.competencia.length ? `
  <h3 class="seccion" style="font-size:15pt;margin-top:10mm">Cómo se ven frente a la competencia</h3><div class="linea"></div>
  <table>
    <tr><th>Cuenta</th><th>Seguidores</th><th>Posts/mes</th><th>Reels/mes</th><th>Pauta activa</th></tr>
    ${d.competencia.map((c, i) => `<tr class="${i === 0 ? 'destacado' : ''}"><td>${esc(c.nombre)}</td><td>${esc(c.seguidores)}</td><td>${esc(c.posts_mes)}</td><td>${esc(c.reels_mes)}</td><td>${esc(c.pauta)}</td></tr>`).join('')}
  </table>` : ''}
  <div class="pie"><span>Influence Chile · Propuesta para ${esc(d.empresa)}</span><span>2</span></div>
</section>

<section class="pagina">
  <h3 class="seccion">Los planes</h3><div class="linea"></div>
  <p class="intro">Tres niveles de trabajo. Marcamos el que recomendamos para ${esc(d.empresa)}.</p>
  <div class="planes">
    ${Object.entries(PLANES).map(([k, p]) => `
      <div class="plan ${k === d.plan_recomendado ? 'rec' : ''}">
        ${k === d.plan_recomendado ? '<div class="badge">Recomendado</div>' : ''}
        <h4>${p.nombre}</h4>
        <div class="precio">${clp(p.precio)}<small> / mes</small></div>
        <ul>${p.incluye.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>`).join('')}
  </div>
  ${d.porque_este_plan ? `<div class="nota"><strong>Por qué el plan ${recomendado.nombre}:</strong> ${esc(d.porque_este_plan)}</div>` : ''}
  ${addonsSel.length ? `
    <h3 class="seccion" style="font-size:15pt">Servicios adicionales sugeridos</h3><div class="linea"></div>
    <table>
      <tr><th>Servicio</th><th>Valor</th><th>Qué incluye</th></tr>
      ${addonsSel.map(a => `<tr><td><strong>${esc(a.nombre)}</strong></td><td>${precioAddon(a)}</td><td>${esc(a.detalle)}</td></tr>`).join('')}
    </table>` : ''}
  <div class="pie"><span>Influence Chile · Propuesta para ${esc(d.empresa)}</span><span>3</span></div>
</section>

<section class="pagina">
  <h3 class="seccion">Cómo lo hacemos</h3><div class="linea"></div>
  <p class="intro">Trabajo por fases. Nada de "vamos viendo": cada mes tiene entregables definidos.</p>
  ${d.roadmap.map(f => `
    <div class="fase">
      <div class="periodo">${esc(f.periodo)}</div>
      <ul>${f.hitos.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
    </div>`).join('')}
  <div class="pie"><span>Influence Chile · Propuesta para ${esc(d.empresa)}</span><span>4</span></div>
</section>

<section class="pagina">
  <h3 class="seccion">La inversión</h3><div class="linea"></div>
  <div class="total">
    <div class="fila"><span>Plan ${recomendado.nombre}</span><span>${clp(recomendado.precio)} / mes</span></div>
    ${addonsSel.map(a => `<div class="fila"><span>${esc(a.nombre)}</span><span>${precioAddon(a)}</span></div>`).join('')}
    <div class="fila"><span>Fee mensual Influence Chile</span><span>${totalTexto}</span></div>
  </div>
  <div class="nota">
    ${d.presupuesto_pauta ? `<strong>Aparte del fee — presupuesto de pauta:</strong> ${esc(d.presupuesto_pauta)}. Este dinero se paga directamente a la plataforma publicitaria y no pasa por nosotros.<br><br>` : ''}
    <strong>Condiciones:</strong> facturación mensual, sin permanencia mínima obligatoria.
    Recomendamos evaluar resultados a los 90 días, que es cuando el trabajo de contenido empieza a madurar.
  </div>
  <div class="cta">
    <h3>¿Partimos?</h3>
    <p>
      El siguiente paso es una reunión de 30 minutos para afinar el plan<br>
      y definir la fecha de inicio.
    </p>
    <div class="boton">+56 9 6545 0723</div>
    <div class="firma">
      <strong>Gabriel Meza</strong> · Influence Chile<br>
      influencechile.cl · +56 9 6545 0723<br>
      Instagram: @influence.chile
    </div>
  </div>
  <div class="pie"><span>Influence Chile · Propuesta para ${esc(d.empresa)}</span><span>5</span></div>
</section>

</body></html>`;

const slug = d.empresa.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const htmlPath = path.join(__dirname, `propuesta-${slug}.html`);
const pdfPath = path.join(__dirname, `propuesta-${slug}.pdf`);

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
