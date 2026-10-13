/*
 * Generador de propuesta + contrato — Influence Fit
 *
 *   node generar.js                     usa cliente.yaml
 *   node generar.js otro.yaml           otro prospecto (YAML o JSON)
 *   node generar.js --consentimiento    además genera el consentimiento informado con los datos del coach
 *
 * Salida en propuesta/salida/: propuesta-<slug>.html/.pdf, contrato-<slug>.html/.pdf
 */
const fs = require('fs');
const path = require('path');
const { leerDatos, clp, esc, slug, fechaLarga, escribirHtmlYPdf } = require('../lib/comun');

// ---------- Datos de la agencia (ajustar) ----------
const AGENCIA = {
  nombre: 'Influence Chile SpA', rut: '77.XXX.XXX-X', representante: 'Gabriel Meza',
  domicilio: 'El Tabo, Región de Valparaíso', ciudad: 'El Tabo', jurisdiccion: 'San Antonio',
  whatsapp: '+56 9 6545 0723', web: 'influencechile.cl', instagram: '@influence.chile'
};

// ---------- Escalera de servicios (precios de referencia 2026, sin IVA) ----------
const NIVELES = {
  1: {
    nombre: 'Sistema de Clientes', tipo: 'unico', bajada: 'Ordena la entrada de clientes en 7 días.',
    precios: { baja: 490000, media: 690000, alta: 890000 },
    incluye: [
      'Formulario de onboarding (anamnesis, lesiones, objetivos, disponibilidad) conectado a tu base de datos',
      'Agente de WhatsApp: responde preguntas frecuentes, califica leads y agenda la evaluación',
      'Recordatorios automáticos de sesión y de cobro',
      'Plantilla de contrato, consentimiento informado y política de cancelación',
      'Panel simple de clientes (Google Sheets o Airtable)',
      'Capacitación de 1 hora'
    ],
    roadmap: [
      { periodo: 'Día 1–2', hitos: ['Reunión de levantamiento: servicios, precios, horarios, FAQ', 'Accesos a WhatsApp Business, Google y redes'] },
      { periodo: 'Día 3–5', hitos: ['Formulario de onboarding y base de datos operativos', 'Agente de WhatsApp configurado con tu FAQ y agenda'] },
      { periodo: 'Día 6–7', hitos: ['Recordatorios y cobros automatizados', 'Contrato y consentimiento entregados', 'Capacitación y puesta en marcha'] }
    ]
  },
  2: {
    nombre: 'Clientes Nuevos', tipo: 'mensual', bajada: 'Adquisición predecible todos los meses.', minimo_meses: 3,
    precios: { baja: 350000, media: 475000, alta: 600000 },
    incluye: [
      'Meta Ads (Instagram y Facebook) con creativos producidos por la agencia',
      'Landing o perfil optimizado para convertir',
      'Agente de WhatsApp conectado a los anuncios',
      'Reporte mensual: leads, costo por lead, evaluaciones agendadas, cierres'
    ],
    roadmap: [
      { periodo: 'Semana 1', hitos: ['Oferta de entrada definida (evaluación inicial como producto)', 'Perfil o landing optimizados', 'Agente de WhatsApp conectado'] },
      { periodo: 'Semana 2–4', hitos: ['Producción de 6 creativos (3 reels, 3 estáticos)', 'Campaña activa con 2 públicos y test de creativos', 'Primer reporte de costo por evaluación'] },
      { periodo: 'Mes 2', hitos: ['Optimización por costo por evaluación agendada', 'Nuevos creativos según lo que convirtió', 'Ajuste del guion del agente con objeciones reales'] },
      { periodo: 'Mes 3', hitos: ['Escalado del público ganador', 'Reporte trimestral con cierres y proyección', 'Decisión: mantener, escalar o sumar retención (Nivel 3)'] }
    ]
  },
  3: {
    nombre: 'Marca + Retención', tipo: 'mensual', bajada: 'Crecer y que los clientes se queden.', minimo_meses: 3,
    precios: { baja: 750000, media: 1075000, alta: 1400000 },
    incluye: [
      'Todo el Nivel 2 (adquisición)',
      '12 a 16 piezas de contenido al mes (reels, carruseles, guiones) con enfoque técnico supervisado por un coach',
      'Secuencia de retención: check-ins automáticos en semanas 2, 6 y 10, encuesta de satisfacción y oferta de renovación',
      'Programa de referidos',
      'Newsletter o canal de WhatsApp Comunidad'
    ],
    roadmap: [
      { periodo: 'Semana 1–2', hitos: ['Todo el arranque del Nivel 2', 'Pilares de contenido y calendario del mes', 'Secuencia de retención cargada con tus clientes actuales'] },
      { periodo: 'Mes 1', hitos: ['12 piezas publicadas', 'Campaña de adquisición activa', 'Primeros check-ins de semana 2 enviados'] },
      { periodo: 'Mes 2', hitos: ['Programa de referidos lanzado', 'Canal de comunidad activo', 'Reporte con retención y costo por evaluación'] },
      { periodo: 'Mes 3', hitos: ['Encuesta de mes 3 y renovaciones', 'Caso de estudio con tus números', 'Plan del siguiente trimestre'] }
    ]
  }
};

const args = process.argv.slice(2);
const archivo = args.find(a => !a.startsWith('--')) || 'cliente.yaml';
const conConsentimiento = args.includes('--consentimiento');
const d = leerDatos(path.isAbsolute(archivo) ? archivo : path.join(__dirname, archivo));

const nivel = NIVELES[d.nivel];
if (!nivel) throw new Error('nivel debe ser 1, 2 o 3');
const complejidad = d.complejidad || 'media';
if (!nivel.precios[complejidad]) throw new Error('complejidad debe ser baja, media o alta');
const precio = nivel.precios[complejidad];
const fundador = !!d.fundador && d.nivel >= 2;
const medios = d.medios_mensual || 200000;
const roadmap = d.roadmap || nivel.roadmap;
const fecha = fechaLarga();
const s = slug(d.empresa);
const outDir = path.join(__dirname, 'salida');
fs.mkdirSync(outDir, { recursive: true });

const precioTexto = nivel.tipo === 'unico' ? `${clp(precio)} pago único` : `${clp(precio)} / mes`;
const nivel1 = NIVELES[1];

// ---------- Propuesta ----------
const css = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Montserrat', 'Segoe UI', system-ui, sans-serif; color: #123638; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pagina { width: 210mm; min-height: 297mm; padding: 18mm 16mm; page-break-after: always; position: relative; }
  .pagina:last-child { page-break-after: auto; }
  .portada { background: linear-gradient(155deg, #123638 0%, #12959C 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; }
  .portada .marca { font-size: 22pt; font-weight: 800; margin-bottom: 18mm; letter-spacing: -.02em; } .portada .marca span { color: #33C7CE; }
  .portada .kicker { text-transform: uppercase; letter-spacing: .28em; font-size: 9pt; opacity: .75; margin-bottom: 6mm; }
  .portada h1 { font-size: 32pt; line-height: 1.1; font-weight: 800; margin-bottom: 4mm; }
  .portada h2 { font-size: 14pt; font-weight: 400; opacity: .9; margin-bottom: 14mm; line-height: 1.5; }
  .portada .meta { font-size: 10pt; opacity: .8; line-height: 1.9; border-top: 1px solid rgba(255,255,255,.25); padding-top: 6mm; }
  h3.seccion { font-size: 20pt; color: #12959C; margin-bottom: 3mm; font-weight: 800; }
  h3.seccion + .linea { width: 18mm; height: 3px; background: #FF7B7B; margin-bottom: 8mm; }
  p.intro { font-size: 11pt; line-height: 1.65; color: #2c4a4c; margin-bottom: 8mm; }
  .hallazgo { border-left: 3px solid #FF7B7B; padding: 0 0 0 6mm; margin-bottom: 7mm; }
  .hallazgo h4 { font-size: 12.5pt; margin-bottom: 2mm; } .hallazgo p { font-size: 10.5pt; line-height: 1.6; color: #2c4a4c; }
  .hallazgo .impacto { display: inline-block; margin-top: 3mm; font-size: 9.5pt; background: #ffeaea; color: #c0392b; padding: 1.5mm 3mm; border-radius: 3px; }
  .planes { display: flex; gap: 4mm; margin-bottom: 8mm; }
  .plan { flex: 1; border: 1.5px solid #d7ebeb; border-radius: 5px; padding: 5mm; }
  .plan.rec { border-color: #FF7B7B; border-width: 2.5px; background: #fffafa; }
  .plan .badge { display: inline-block; background: #FF7B7B; color: #fff; font-size: 7.5pt; padding: 1mm 2.5mm; border-radius: 3px; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 2mm; }
  .plan .lvl { font-size: 8pt; color: #12959C; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; }
  .plan h4 { font-size: 12.5pt; color: #123638; }
  .plan .precio { font-size: 13pt; font-weight: 800; margin: 1mm 0 3mm; } .plan .precio small { display:block; font-size: 8pt; font-weight: 400; color: #6b8b8c; }
  .plan ul { list-style: none; font-size: 8.5pt; line-height: 1.6; color: #2c4a4c; } .plan li::before { content: '▪'; color: #12959C; margin-right: 2mm; }
  .nota { background: #e6f1f1; border-radius: 5px; padding: 5mm 6mm; font-size: 10.5pt; line-height: 1.6; margin-bottom: 8mm; } .nota strong { color: #12959C; }
  .fundador { background: #fff1f1; border: 1.5px solid #FF7B7B; border-radius: 5px; padding: 5mm 6mm; font-size: 10.5pt; line-height: 1.6; margin-bottom: 8mm; }
  .fundador strong { color: #c0392b; }
  .fase { display: flex; gap: 5mm; margin-bottom: 6mm; } .fase .periodo { flex: 0 0 32mm; font-weight: 700; color: #12959C; font-size: 10.5pt; padding-top: 1mm; }
  .fase ul { flex: 1; list-style: none; font-size: 10.5pt; line-height: 1.7; color: #2c4a4c; } .fase li::before { content: '→'; color: #FF7B7B; margin-right: 2.5mm; }
  .total { background: linear-gradient(135deg, #123638, #12959C); color: #fff; border-radius: 6px; padding: 8mm; margin-bottom: 8mm; }
  .total .fila { display: flex; justify-content: space-between; padding: 2.5mm 0; font-size: 11pt; border-bottom: 1px solid rgba(255,255,255,.18); }
  .total .fila:last-child { border: 0; padding-top: 5mm; font-size: 15pt; font-weight: 700; }
  .total .fila.tachado span:last-child { text-decoration: line-through; opacity: .7; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; margin-bottom: 8mm; }
  .kpi { border: 1.5px solid #d7ebeb; border-radius: 5px; padding: 4mm; font-size: 9.5pt; color: #2c4a4c; } .kpi b { display: block; color: #12959C; font-size: 10.5pt; margin-bottom: 1mm; }
  .cta { text-align: center; padding: 6mm 0 0; } .cta h3 { font-size: 20pt; color: #12959C; margin-bottom: 3mm; } .cta p { font-size: 11pt; color: #2c4a4c; line-height: 1.7; margin-bottom: 6mm; }
  .cta .boton { display: inline-block; background: #FF7B7B; color: #fff; padding: 4mm 10mm; border-radius: 40px; font-size: 12pt; font-weight: 600; }
  .firma { margin-top: 9mm; padding-top: 5mm; border-top: 1px solid #d7ebeb; font-size: 10pt; color: #2c4a4c; line-height: 1.8; text-align: center; }
  .pie { position: absolute; bottom: 10mm; left: 16mm; right: 16mm; font-size: 8pt; color: #9ab5b6; display: flex; justify-content: space-between; }
`;
const pie = n => `<div class="pie"><span>Influence Fit · Propuesta para ${esc(d.empresa)}</span><span>${n}</span></div>`;

const propuesta = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Propuesta ${esc(d.empresa)} — Influence Fit</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet"><style>${css}</style></head><body>

<section class="pagina portada">
  <div class="marca">influence<span>fit</span></div>
  <div class="kicker">Propuesta de servicios</div>
  <h1>${esc(d.empresa)}</h1>
  <h2>${esc(d.objetivo)}</h2>
  <div class="meta">Preparada para ${esc(d.contacto)}${d.cargo ? ', ' + esc(d.cargo) : ''}<br>${esc(d.segmento)}${d.ciudad ? ' · ' + esc(d.ciudad) : ''}<br>${fecha}</div>
</section>

<section class="pagina">
  <h3 class="seccion">Qué encontramos</h3><div class="linea"></div>
  <p class="intro">Revisamos ${d.instagram ? esc(d.instagram) + ', ' : ''}la oferta, el funnel y la retención de ${esc(d.empresa)}. Estos son los tres puntos que hoy están costando clientes.</p>
  ${(d.diagnostico || []).map((h, i) => `<div class="hallazgo"><h4>${i + 1}. ${esc(h.titulo)}</h4><p>${esc(h.detalle)}</p>${h.impacto ? `<span class="impacto">${esc(h.impacto)}</span>` : ''}</div>`).join('')}
  <div class="nota"><strong>Por qué nosotros:</strong> la mayoría de las agencias que venden a coaches no entienden el negocio del entrenamiento. Influence Fit lo dirige un coach con 15 años en sala. Sabemos qué pregunta un cliente antes de pagar y por qué se va al tercer mes, y usamos este mismo sistema en nuestros propios canales.</div>
  ${pie(2)}
</section>

<section class="pagina">
  <h3 class="seccion">La escalera de servicios</h3><div class="linea"></div>
  <p class="intro">Tres niveles. Marcamos el que recomendamos para ${esc(d.empresa)}. Precios de referencia sin IVA; el valor de esta propuesta está en la última página.</p>
  <div class="planes">
    ${Object.entries(NIVELES).map(([k, n]) => `<div class="plan ${Number(k) === d.nivel ? 'rec' : ''}">
      ${Number(k) === d.nivel ? '<div class="badge">Recomendado</div>' : ''}
      <div class="lvl">Nivel ${k} · ${n.tipo === 'unico' ? 'pago único' : 'mensual'}</div><h4>${n.nombre}</h4>
      <div class="precio">${clp(n.precios.baja)} – ${clp(n.precios.alta)}<small>${n.tipo === 'unico' ? 'según complejidad' : 'por mes + medios'}</small></div>
      <ul>${n.incluye.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
  </div>
  ${d.porque_este_nivel ? `<div class="nota"><strong>Por qué el Nivel ${d.nivel} para ${esc(d.empresa)}:</strong> ${esc(d.porque_este_nivel)}</div>` : ''}
  ${fundador ? `<div class="fundador"><strong>Cupo fundador.</strong> ${esc(d.empresa)} entra como uno de los 5 primeros clientes de Influence Fit: el Nivel 1 (${nivel1.nombre}, valor ${clp(nivel1.precios.baja)} a ${clp(nivel1.precios.alta)}) va incluido sin costo, y si en 60 días no hay al menos 15 evaluaciones agendadas, el mes siguiente de gestión corre por nuestra cuenta. A cambio pedimos un testimonio en video y un caso de estudio con sus números.</div>` : ''}
  ${pie(3)}
</section>

<section class="pagina">
  <h3 class="seccion">Cómo lo hacemos</h3><div class="linea"></div>
  <p class="intro">Trabajo por fases con entregables definidos. Nada de "vamos viendo".</p>
  ${roadmap.map(f => `<div class="fase"><div class="periodo">${esc(f.periodo)}</div><ul>${f.hitos.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>`).join('')}
  <h3 class="seccion" style="font-size:15pt;margin-top:8mm">Qué vamos a medir</h3><div class="linea"></div>
  <div class="kpis">
    <div class="kpi"><b>Costo por evaluación agendada</b>Inversión en medios dividida por evaluaciones agendadas. El número que manda.</div>
    <div class="kpi"><b>Cierres y tasa de cierre</b>Evaluaciones que se convierten en cliente pagando.</div>
    <div class="kpi"><b>Horas de administración por semana</b>Antes y después del sistema de clientes.</div>
    ${d.nivel === 3 ? `<div class="kpi"><b>Renovación al mes 3 y 6</b>Porcentaje de clientes que siguen después del primer ciclo.</div><div class="kpi"><b>Piezas publicadas y alcance</b>Lo que salió y a cuánta gente llegó.</div><div class="kpi"><b>Referidos</b>Clientes nuevos que llegaron con nombre de un cliente actual.</div>` : ''}
  </div>
  ${pie(4)}
</section>

<section class="pagina">
  <h3 class="seccion">La inversión</h3><div class="linea"></div>
  <div class="total">
    <div class="fila"><span>Nivel ${d.nivel} · ${nivel.nombre}</span><span>${precioTexto}</span></div>
    ${fundador ? `<div class="fila tachado"><span>Nivel 1 · ${nivel1.nombre} (incluido por cupo fundador)</span><span>${clp(nivel1.precios[complejidad])}</span></div>` : ''}
    ${nivel.tipo === 'mensual' ? `<div class="fila"><span>Inversión en medios (se paga directo a Meta)</span><span>${clp(medios)} / mes</span></div>` : ''}
    <div class="fila"><span>Fee Influence Fit</span><span>${precioTexto}</span></div>
  </div>
  <div class="nota">
    <strong>Condiciones:</strong> valores sin IVA. ${nivel.tipo === 'unico' ? '50% al inicio y 50% a la entrega, dentro de 7 días.' : `Facturación mensual anticipada. Compromiso mínimo de ${nivel.minimo_meses} meses: es lo que tarda en estabilizarse el costo por evaluación.`}
    ${nivel.tipo === 'mensual' ? ' La inversión en medios no pasa por nosotros y se puede ajustar mes a mes.' : ''}
    Propuesta válida por 15 días.
  </div>
  <div class="cta">
    <h3>¿Partimos?</h3>
    <p>Confirmas por WhatsApp, te mandamos el contrato digital y en 7 días el sistema está operando.</p>
    <div class="boton">${AGENCIA.whatsapp}</div>
    <div class="firma"><strong>${AGENCIA.representante}</strong> · coach y fundador, Influence Chile<br>${AGENCIA.web} · ${AGENCIA.whatsapp}<br>Instagram: ${AGENCIA.instagram}</div>
  </div>
  ${pie(5)}
</section>
</body></html>`;

// ---------- Contrato (desde plantilla Markdown) ----------
const inicio = d.inicio instanceof Date ? d.inicio : d.inicio ? new Date(String(d.inicio).slice(0, 10) + 'T12:00:00') : new Date();
const meses = d.duracion_meses || nivel.minimo_meses || 1;
const clausulaPrecio = nivel.tipo === 'unico'
  ? `El precio del servicio es de **${clp(precio)}** (${numALetras(precio)} pesos) más IVA, pagadero 50% a la firma y 50% a la entrega.`
  : `El precio del servicio es de **${clp(precio)} mensuales** (${numALetras(precio)} pesos) más IVA.${fundador ? ` Por tratarse de un cupo fundador, el servicio Nivel 1 "${nivel1.nombre}" se incluye sin costo adicional, condicionado a la entrega por el Cliente de un testimonio en video y autorización para publicar un caso de estudio con sus resultados.` : ''}`;
const clausulaPlazo = nivel.tipo === 'unico'
  ? `El servicio se ejecuta en un plazo de 7 días hábiles desde la entrega de accesos, con inicio el ${fechaLarga(inicio)}.`
  : `El servicio comienza el ${fechaLarga(inicio)} con un plazo mínimo de **${meses} meses**. Cumplido el mínimo se renueva mes a mes automáticamente, salvo aviso escrito de cualquiera de las partes con 30 días de anticipación.`;
const clausulaGarantia = fundador
  ? `## QUINTO BIS · Garantía de cupo fundador\nSi transcurridos 60 días desde el inicio de la campaña publicitaria no se han agendado al menos 15 evaluaciones a través del sistema, la Agencia prestará el mes siguiente de gestión sin cobrar su fee. La garantía exige que el Cliente haya mantenido la inversión publicitaria mínima de ${clp(medios)} mensuales, entregado los accesos dentro del plazo y atendido los leads conforme a la cláusula cuarta.`
  : '';

const vars = {
  fecha, ciudad_agencia: AGENCIA.ciudad, rut_agencia: AGENCIA.rut, representante_agencia: AGENCIA.representante, domicilio_agencia: AGENCIA.domicilio,
  razon_social: d.razon_social || d.contacto, rut: d.rut || '____________', contacto: d.contacto, domicilio: d.domicilio || '____________________',
  servicio_nombre: nivel.nombre, nivel: d.nivel,
  servicio_incluye: nivel.incluye.map(x => `- ${x}`).concat(fundador ? nivel1.incluye.map(x => `- (Nivel 1 incluido) ${x}`) : []).join('\n'),
  clausula_precio: clausulaPrecio, dia_pago: d.dia_pago || 5, medios_mensual: clp(medios), clausula_plazo: clausulaPlazo, clausula_garantia: clausulaGarantia,
  ciudad_jurisdiccion: AGENCIA.jurisdiccion
};
const contratoMd = fs.readFileSync(path.join(__dirname, 'plantillas', 'contrato-servicios.md'), 'utf8')
  .replace(/^> Plantilla de referencia.*\n\n?/m, '')
  .replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] !== undefined ? String(vars[k]) : m);
const contratoHtml = docHtml(`Contrato ${d.empresa} — Influence Chile`, mdAHtml(contratoMd));

// ---------- Consentimiento informado (opcional) ----------
let consentimientoHtml = null;
if (conConsentimiento) {
  const c = d.coach || {};
  const cv = {
    coach_nombre: c.nombre || d.razon_social || d.empresa, coach_rut: c.rut || d.rut || '____________',
    coach_credencial: c.credencial ? ', ' + c.credencial : '', coach_nombre_corto: (c.nombre || d.contacto || '').split(' ')[0] || 'el coach',
    modalidades: c.modalidades || 'presencial y/o online', coach_contacto: c.contacto || d.email || d.whatsapp || '____________',
    horas_cancelacion: c.horas_cancelacion || 12, dias_pausa: c.dias_pausa || 14
  };
  const md = fs.readFileSync(path.join(__dirname, 'plantillas', 'consentimiento-informado.md'), 'utf8')
    .replace(/^> Plantilla que el coach.*\n\n?/m, '')
    .replace(/\{\{(\w+)\}\}/g, (m, k) => cv[k] !== undefined ? String(cv[k]) : m);
  consentimientoHtml = docHtml(`Consentimiento informado — ${cv.coach_nombre}`, mdAHtml(md));
}

// ---------- Salida ----------
(async () => {
  await escribirHtmlYPdf(outDir, `propuesta-${s}`, propuesta);
  await escribirHtmlYPdf(outDir, `contrato-${s}`, contratoHtml);
  if (consentimientoHtml) await escribirHtmlYPdf(outDir, `consentimiento-${s}`, consentimientoHtml);
})();

// ---------- helpers ----------
function docHtml(titulo, cuerpo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet"><style>
  @page { size: A4; margin: 20mm 18mm; }
  body { font-family: 'Montserrat', 'Segoe UI', system-ui, sans-serif; color: #123638; font-size: 10.5pt; line-height: 1.6; max-width: 174mm; margin: 0 auto; padding: 12mm 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-size: 16pt; color: #12959C; text-align: center; margin: 0 0 8mm; line-height: 1.3; }
  h2 { font-size: 11.5pt; margin: 7mm 0 2mm; color: #123638; text-transform: uppercase; letter-spacing: .04em; }
  p { margin: 0 0 3mm; text-align: justify; } ul, ol { margin: 0 0 3mm 6mm; } li { margin-bottom: 1mm; }
  table { width: 100%; border-collapse: collapse; margin: 8mm 0 4mm; } td, th { padding: 2.5mm; border: 1px solid #d7ebeb; vertical-align: top; text-align: left; }
  strong { color: #123638; } em { color: #6b8b8c; }
  .pie { margin-top: 10mm; font-size: 8pt; color: #9ab5b6; text-align: center; }
</style></head><body>${cuerpo}<div class="pie">Influence Chile SpA · ${esc(AGENCIA.web)} · Documento generado el ${fecha}</div></body></html>`;
}

// Markdown mínimo (títulos, listas, tablas, negritas, cursivas, checkboxes) → HTML
function mdAHtml(md) {
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/\[ \]/g, '☐').replace(/`(.+?)`/g, '$1');
  const lineas = md.split('\n'); const out = []; let lista = null, tabla = null;
  const cerrar = () => { if (lista) { out.push(`</${lista}>`); lista = null; } if (tabla) { out.push('</table>'); tabla = null; } };
  for (const l of lineas) {
    if (/^\|/.test(l)) {
      if (/^\|[\s\-|]+\|$/.test(l)) continue;
      if (!tabla) { cerrar(); out.push('<table>'); tabla = true; }
      out.push('<tr>' + l.split('|').slice(1, -1).map(c => `<td>${inline(c.trim())}</td>`).join('') + '</tr>'); continue;
    }
    if (tabla && !/^\|/.test(l)) cerrar();
    const h = l.match(/^(#{1,3}) (.*)/);
    if (h) { cerrar(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const li = l.match(/^(\d+)\. (.*)/) || l.match(/^- (.*)/);
    if (li) { const tipo = li.length === 3 ? 'ol' : 'ul'; if (lista !== tipo) { cerrar(); out.push(`<${tipo}>`); lista = tipo; } out.push(`<li>${inline(li[li.length - 1])}</li>`); continue; }
    if (!l.trim()) { cerrar(); continue; }
    cerrar(); out.push(`<p>${inline(l)}</p>`);
  }
  cerrar(); return out.join('\n');
}

function numALetras(n) {
  const u = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiún', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const dec = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const cen = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const tres = x => { if (x === 0) return ''; if (x === 100) return 'cien'; let s = cen[Math.floor(x / 100)]; const r = x % 100; if (r < 30) s += (s ? ' ' : '') + u[r]; else s += (s ? ' ' : '') + dec[Math.floor(r / 10)] + (r % 10 ? ' y ' + u[r % 10] : ''); return s.trim(); };
  const mill = Math.floor(n / 1000000), mil = Math.floor((n % 1000000) / 1000), resto = n % 1000;
  let s = '';
  if (mill) s += mill === 1 ? 'un millón' : tres(mill) + ' millones';
  if (mil) s += (s ? ' ' : '') + (mil === 1 ? 'mil' : tres(mil) + ' mil');
  if (resto) s += (s ? ' ' : '') + tres(resto);
  return s || 'cero';
}
