# Propuesta de UN plan: Plan Presencia sin reels a $250.000 neto/mes, para leads con ese presupuesto.
# Reglas: una sola opción (los clientes se enredan con varias) y sin prometer nada sobre accesos o contraseñas. Precios espejo de influencechile.cl.
#   python3 prospeccion-ventas/propuesta/opciones-250k/generar.py prospeccion-ventas/propuesta/opciones-250k/cliente.json
#   NODE_PATH=/opt/node22/lib/node_modules node prospeccion-ventas/propuesta/opciones-250k/render.js
import html, datetime, sys, json, os
CLIENTE = {"nombre": "[Nombre del cliente]", "contacto": "", "instagram": "", "nota_camino1": "", "archivo": "propuesta-presencia-250k",
           "presupuesto": 250000, "fecha": datetime.date.today().strftime("%-d de %B de %Y")}
MESES={'January':'enero','February':'febrero','March':'marzo','April':'abril','May':'mayo','June':'junio','July':'julio','August':'agosto','September':'septiembre','October':'octubre','November':'noviembre','December':'diciembre'}
for en,es in MESES.items(): CLIENTE['fecha']=CLIENTE['fecha'].replace(en,es)
if len(sys.argv)>1 and os.path.exists(sys.argv[1]): CLIENTE.update(json.load(open(sys.argv[1],encoding='utf-8')))
C={k:(html.escape(v) if isinstance(v,str) else v) for k,v in CLIENTE.items()}
f=lambda n: "$"+f"{round(n):,}".replace(",",".")
iva=lambda n: round(n*1.19)
B=C["presupuesto"]
# Catálogo de la web (neto)
PRESENCIA=350000; RECO=250000; CE=69990; INF=99990; META_ARMADO=150000; LANDING=250000; COTIZ=250000
ig=f' ({C["instagram"]})' if C["instagram"] else ''
para=(f'{C["contacto"]}<br>' if C["contacto"] else '')+f'{C["nombre"]}{ig}'
nota1=(f'<div class="nota"><strong>En tu caso:</strong> {C["nota_camino1"]}</div>' if C["nota_camino1"] else '')

def si(x): return f'<td class="c si">{x}</td>'
def no(x): return f'<td class="c no">{x}</td>'

HTML=f'''<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Propuesta {C["nombre"]} · Influence Chile</title>
<style>
  @font-face {{ font-family:'Montserrat'; font-style:normal; font-weight:400 800; src:url('../../situ/fonts/montserrat.woff2') format('woff2'); }}
  @page {{ size:A4; margin:13mm 16mm 13mm; }} @page portada {{ margin:0; }}
  * {{ box-sizing:border-box; margin:0; padding:0; }}
  body {{ font-family:'Montserrat','Segoe UI',system-ui,sans-serif; color:#123638; font-size:9.8pt; line-height:1.46; -webkit-print-color-adjust:exact; print-color-adjust:exact; }}
  a {{ color:#12959C; text-decoration:none; }}
  .portada {{ page:portada; width:210mm; height:297mm; padding:22mm 20mm; background:linear-gradient(155deg,#123638 0%,#12959C 100%); color:#fff; display:flex; flex-direction:column; justify-content:space-between; page-break-after:always; }}
  .marca img {{ height:30mm; width:auto; display:block; filter:brightness(0) invert(1); }}
  .portada .kicker {{ font-size:9.5pt; letter-spacing:.18em; text-transform:uppercase; opacity:.8; margin-bottom:5mm; }}
  .portada h1 {{ font-size:30pt; line-height:1.12; font-weight:800; margin-bottom:7mm; max-width:155mm; }}
  .portada .sub {{ font-size:12.5pt; font-weight:500; opacity:.92; max-width:145mm; line-height:1.45; }}
  .portada .para {{ border-top:1px solid rgba(255,255,255,.35); padding-top:6mm; display:flex; justify-content:space-between; font-size:9.5pt; line-height:1.6; }}
  .portada .para strong {{ display:block; font-size:10.5pt; }}
  .seccion {{ page-break-before:always; }} .seccion.primera {{ page-break-before:auto; }}
  h2 {{ font-size:19pt; color:#12959C; font-weight:800; line-height:1.2; margin-bottom:2.5mm; }}
  .linea {{ width:18mm; height:3px; background:#FF7B7B; margin-bottom:6mm; }}
  h3 {{ font-size:12pt; color:#12959C; font-weight:700; margin:6mm 0 2mm; }}
  p {{ margin-bottom:3.2mm; }} ul {{ margin:0 0 3.5mm; list-style:none; }}
  li {{ padding-left:5mm; position:relative; margin-bottom:1.8mm; }} li::before {{ content:'▪'; color:#12959C; position:absolute; left:0; }}
  table {{ width:100%; border-collapse:collapse; margin:3mm 0 4mm; font-size:9.1pt; page-break-inside:avoid; }}
  th {{ background:#12959C; color:#fff; padding:2.3mm 3mm; text-align:left; font-weight:600; font-size:8.9pt; }}
  td {{ padding:2.1mm 3mm; border-bottom:1px solid #e3eeee; vertical-align:top; }} tr:nth-child(even) td {{ background:#f6fbfb; }}
  td.n {{ white-space:nowrap; text-align:right; }} td.c {{ text-align:center; }}
  .si {{ color:#12959C; font-weight:800; }} .no {{ color:#FF7B7B; font-weight:800; }}
  .tag {{ display:inline-block; font-size:7.5pt; font-weight:700; padding:.6mm 2mm; border-radius:3px; background:#e6f1f1; color:#12959C; text-transform:uppercase; letter-spacing:.06em; }}
  .tag.unico {{ background:#fff0f0; color:#e05c5c; }}
  .nota {{ background:#f3f9f9; border-left:3px solid #12959C; padding:3.5mm 5mm; border-radius:0 4px 4px 0; margin:4mm 0 5mm; page-break-inside:avoid; }}
  .nota.coral {{ border-left-color:#FF7B7B; background:#fff7f7; }} .nota strong {{ color:#12959C; }} .nota.coral strong {{ color:#e05c5c; }}
  .caminos {{ display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; margin:4mm 0 6mm; page-break-inside:avoid; }}
  .caminos > div {{ border:1.5px solid #d7eaea; border-radius:6px; padding:4mm; font-size:9pt; }}
  .caminos > div.reco {{ border:2.5px solid #FF7B7B; background:#fffafa; }}
  .caminos .badge {{ display:inline-block; background:#FF7B7B; color:#fff; font-size:7.5pt; padding:.8mm 2.5mm; border-radius:3px; text-transform:uppercase; letter-spacing:.1em; margin-bottom:2mm; font-weight:700; }}
  .caminos .k {{ font-size:8pt; text-transform:uppercase; letter-spacing:.12em; color:#12959C; font-weight:700; margin-bottom:1mm; }}
  .caminos h4 {{ font-size:12pt; line-height:1.2; margin-bottom:1.5mm; }}
  .caminos .v {{ font-size:14pt; font-weight:800; margin:1.5mm 0; }} .caminos .v small {{ font-size:8.5pt; font-weight:500; color:#4a6a6a; }}
  .total {{ background:linear-gradient(135deg,#123638,#12959C); color:#fff; border-radius:6px; padding:5.5mm 7mm; margin:4mm 0 5mm; display:flex; justify-content:space-between; align-items:center; page-break-inside:avoid; }}
  .total .l {{ font-size:9.5pt; opacity:.9; }} .total .l strong {{ display:block; font-size:13pt; color:#fff; }}
  .total .r {{ text-align:right; }} .total .r .neto {{ font-size:22pt; font-weight:800; line-height:1; }} .total .r .iva {{ font-size:9.5pt; opacity:.9; margin-top:1.5mm; }}
  .combo {{ border:1.5px solid #d7eaea; border-radius:6px; padding:2.8mm 4.5mm; margin-bottom:2.8mm; page-break-inside:avoid; display:flex; gap:5mm; align-items:flex-start; }}
  .combo .izq {{ flex:1; }} .combo h4 {{ font-size:11pt; color:#12959C; margin-bottom:1mm; }}
  .combo .der {{ text-align:right; white-space:nowrap; }} .combo .der b {{ font-size:14pt; display:block; }} .combo .der small {{ color:#4a6a6a; font-size:8.5pt; }}
  .cta {{ text-align:center; padding:10mm 8mm; }} .cta h2 {{ font-size:26pt; margin-bottom:4mm; }} .cta p {{ max-width:140mm; margin:0 auto 4mm; }}
  .cta .boton {{ display:inline-block; background:#FF7B7B; color:#fff; padding:4mm 10mm; border-radius:40px; font-size:11.5pt; font-weight:700; margin:4mm 0 10mm; }}
  .cta .marca-pie img {{ height:22mm; width:auto; display:block; margin:0 auto 6mm; }}
  .firma {{ border-top:1px solid #d7eaea; padding-top:6mm; font-size:9.6pt; line-height:1.7; }} .firma strong {{ font-size:11pt; }}
  .pie {{ font-size:8.2pt; color:#6b8585; margin-top:8mm; }}
  .resumen {{ display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; margin:5mm 0 6mm; page-break-inside:avoid; }}
  .resumen > div {{ border:1.5px solid #d7eaea; border-radius:6px; padding:4mm; }}
  .resumen .k {{ font-size:8pt; text-transform:uppercase; letter-spacing:.12em; color:#12959C; font-weight:700; margin-bottom:1.5mm; }}
  .resumen .v {{ font-size:15pt; font-weight:800; line-height:1.15; }} .resumen .s {{ font-size:8.6pt; color:#4a6a6a; margin-top:1mm; }}
</style></head><body>

<section class="portada">
  <div class="marca"><img src="../assets/logo-influence.png" alt="Influence · Agencia de Marketing"></div>
  <div>
    <div class="kicker">Propuesta · {C["fecha"]}</div>
    <h1>Gestión de redes con {f(B)} al mes</h1>
    <p class="sub">Nuestro Plan Presencia ajustado a tu presupuesto: planificamos, diseñamos, publicamos y te reportamos cada mes.</p>
  </div>
  <div class="para">
    <div><strong>Para</strong>{para}</div>
    <div style="text-align:right"><strong>De</strong>Gabriel Meza · Influence Chile<br>influencechile.cl · @influence.chile</div>
  </div>
</section>

<section class="seccion primera">
  <h2>Nuestra propuesta</h2>
  <div class="linea"></div>
  <p>{(C['contacto'].split()[0]+', n') if C['contacto'] else 'N'}os pediste ver qué podemos hacer con un presupuesto de {f(B)}. Nuestra recomendación es una sola: <strong>el Plan Presencia, nuestro plan de entrada, con la única diferencia de que no incluye la producción de los 4 reels mensuales.</strong> Los reels son la parte que más tiempo de producción lleva, y por eso son lo que explica la diferencia con el valor del plan en la web ({f(PRESENCIA)}). Todo lo demás se mantiene igual.</p>
  <div class="resumen">
    <div><div class="k">Plan</div><div class="v">Presencia</div><div class="s">sin producción de reels</div></div>
    <div><div class="k">Inversión mensual</div><div class="v">{f(RECO)}</div><div class="s">neto + IVA · {f(iva(RECO))} con IVA</div></div>
    <div><div class="k">Compromiso</div><div class="v">Sin permanencia</div><div class="s">aviso de término con un mes · inicio en 10 días hábiles</div></div>
  </div>
  <h3>Por qué este plan</h3>
  <ul>
    <li><strong>Constancia sin depender de tu tiempo.</strong> Cada mes planificamos, diseñamos y publicamos nosotros. Tu cuenta se mantiene activa aunque tengas semanas complicadas.</li>
    <li><strong>Todo con la misma cara.</strong> Definimos tu identidad gráfica en la semana 1 y cada pieza sale con ella, para que la cuenta se vea de una sola marca.</li>
    <li><strong>Crece contigo.</strong> Cuando el presupuesto lo permita, se suman los reels y pasas al plan completo sin cambiar nada más.</li>
  </ul>
  {nota1}
</section>

<section class="seccion">
  <h2>Qué incluye</h2>
  <div class="linea"></div>
  <p>Mismo plan, misma forma de trabajar que el Plan Presencia de la web. La única fila que cambia es la de los reels.</p>
  <table>
    <tr><th>Concepto</th><th style="width:22%;text-align:center">Plan Presencia<br><span style="font-weight:400">{f(PRESENCIA)} neto</span></th><th style="width:22%;text-align:center">Esta propuesta<br><span style="font-weight:400">{f(RECO)} neto</span></th></tr>
    <tr><td><strong>Planificación y programación mensual.</strong> Calendario con cada pieza definida, entregado el día 20 del mes anterior. Lo apruebas en 48 horas, una ronda de cambios incluida.</td>{si("Sí")}{si("Sí")}</tr>
    <tr><td><strong>4 publicaciones al mes</strong> (posts o carruseles) con diseño, copy y caption.</td>{si("4")}{si("4")}</tr>
    <tr><td><strong>8 historias al mes.</strong> Si nos mandas videos cortos de tu celular, los subimos como historias con tu diseño.</td>{si("8")}{si("8")}</tr>
    <tr><td><strong>4 reels al mes</strong> (guion, edición, subtítulos, portada).</td>{si("4")}{no("No incluido")}</tr>
    <tr><td><strong>Diseño y edición profesional</strong> con plantillas y paleta definidas en la semana 1.</td>{si("Sí")}{si("Sí")}</tr>
    <tr><td><strong>Publicación en horario</strong> en Instagram y Facebook.</td>{si("Sí")}{si("Sí")}</tr>
    <tr><td><strong>Gestión de Meta Ads</strong> si decides invertir en pauta (la inversión se paga directo a Meta, aparte).</td>{si("Incluida")}{si("Incluida")}</tr>
    <tr><td><strong>Informe mensual</strong> de una página: qué funcionó y qué hacer el mes siguiente.</td>{si("Sí")}{si("Sí")}</tr>
    <tr><td>Respuesta a comentarios y mensajes.</td>{no("No")}{no("No")}</tr>
  </table>
  <div class="total">
    <div class="l">Total mensual<strong>Plan Presencia sin reels</strong></div>
    <div class="r"><div class="neto">{f(RECO)}</div><div class="iva">netos · {f(iva(RECO))} con IVA</div></div>
  </div>
  <p style="font-size:9pt;color:#4a6a6a">Valores en pesos chilenos, netos, con el IVA indicado aparte. Facturación mensual. Sin costo de puesta en marcha.</p>
</section>

<section class="seccion">
  <h2>Cómo trabajamos</h2>
  <div class="linea"></div>
  <ul>
    <li><strong>Semana 1:</strong> reunión de 60 minutos para definir pilares de contenido, tono e identidad gráfica (colores, tipografías, plantillas).</li>
    <li><strong>Semana 2:</strong> primer calendario aprobado y primeras publicaciones. Desde ahí, calendario mensual el día 20 del mes anterior.</li>
    <li><strong>Cada mes:</strong> 4 publicaciones y 8 historias diseñadas, publicadas y reportadas. Una ronda de ajustes por pieza.</li>
    <li><strong>Los primeros 5 días de cada mes:</strong> informe de una página con lo que funcionó y una recomendación concreta.</li>
  </ul>
  <h3>Qué necesitamos de ti</h3>
  <table>
    <tr><th style="width:50%">Al comenzar</th><th>Cada mes</th></tr>
    <tr><td>Acceso a tus cuentas de Instagram y Facebook para publicar (lo coordinamos en la reunión de la semana 1)</td><td>Aprobar el calendario en 48 horas</td></tr>
    <tr><td>Logo, colores y fotos que ya tengas, y piezas anteriores que te hayan gustado</td><td>Fotos de las prendas o productos nuevos, y avisos de promociones con una semana de anticipación</td></tr>
    <tr><td>Una reunión de 60 minutos para definir pilares y tono</td><td>Responder tú los mensajes y comentarios de clientes (no van en este plan)</td></tr>
  </table>
  <h2 style="margin-top:8mm">Condiciones</h2>
  <div class="linea"></div>
  <ul>
    <li><strong>Sin permanencia mínima.</strong> Solo pedimos aviso de término con un mes de anticipación, para cerrar el calendario en curso y entregarte todo el material producido. Recomendamos evaluar a los 90 días, porque antes el contenido no alcanza a madurar.</li>
    <li><strong>Inicio:</strong> 10 días hábiles después de la confirmación.</li>
    <li><strong>No incluido:</strong> inversión en pauta (se paga directo a Meta; la gestión sí va incluida), producción de reels, respuesta a mensajes y comentarios, y piezas fuera del calendario.</li>
  </ul>
</section>

<section class="seccion">
  <div class="cta">
    <div class="marca-pie"><img src="../assets/logo-influence.png" alt="Influence · Agencia de Marketing"></div>
    <h2>¿Partimos?</h2>
    <p>Si te hace sentido, confírmame por WhatsApp o correo y agendamos la reunión de la semana 1. <strong>Dime el día y la hora que te acomoden y me ajusto.</strong></p>
    <div class="boton">Confirmar por WhatsApp o correo</div>
    <div class="firma">
      <strong>Gabriel Meza</strong><br>
      Influence Chile · Agencia de marketing y desarrollo<br>
      +56 9 6545 0723 · <a href="https://influencechile.cl">influencechile.cl</a> · Instagram <a href="https://www.instagram.com/influence.chile">@influence.chile</a>
    </div>
    <p class="pie">Propuesta válida por 30 días desde el {C["fecha"]}. Valores en pesos chilenos, netos, IVA indicado aparte.</p>
  </div>
</section>
</body></html>'''
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),CLIENTE['archivo']+'.html')
open(out,'w',encoding='utf-8').write(HTML); print('ok ->',out)
