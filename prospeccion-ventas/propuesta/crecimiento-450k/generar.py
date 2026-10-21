# Propuesta Plan Crecimiento $450.000 neto/mes + bonus de arranque (perfil, destacadas, orden de publicaciones).
# Una sola opción. Sin mencionar accesos/contraseñas. Inclusiones espejo de influencechile.cl.
#   python3 prospeccion-ventas/propuesta/crecimiento-450k/generar.py prospeccion-ventas/propuesta/crecimiento-450k/cliente-itata.json
#   NODE_PATH=/opt/node22/lib/node_modules node prospeccion-ventas/propuesta/crecimiento-450k/render.js propuesta-itata-travel
import html, datetime, sys, json, os
CLIENTE={"nombre":"[Nombre del cliente]","contacto":"","instagram":"","archivo":"propuesta-crecimiento-450k",
         "sub":"", "por_que":[], "observaciones":[], "necesitamos_mes":[], "fecha": datetime.date.today().strftime("%-d de %B de %Y")}
MESES={'January':'enero','February':'febrero','March':'marzo','April':'abril','May':'mayo','June':'junio','July':'julio','August':'agosto','September':'septiembre','October':'octubre','November':'noviembre','December':'diciembre'}
for en,es in MESES.items(): CLIENTE['fecha']=CLIENTE['fecha'].replace(en,es)
if len(sys.argv)>1 and os.path.exists(sys.argv[1]): CLIENTE.update(json.load(open(sys.argv[1],encoding='utf-8')))
C={k:(html.escape(v) if isinstance(v,str) else v) for k,v in CLIENTE.items()}
f=lambda n: "$"+f"{round(n):,}".replace(",",".")
iva=lambda n: round(n*1.19)
PLAN=450000
ig=f' ({C["instagram"]})' if C["instagram"] else ''
para=(f'{C["contacto"]}<br>' if C["contacto"] else '')+f'{C["nombre"]}{ig}'
saludo=(C['contacto'].split()[0]+', l') if C['contacto'] else 'L'
li=lambda items: ''.join(f'<li><strong>{html.escape(a)}</strong> {html.escape(b)}</li>' for a,b in items)
por_que=li(CLIENTE['por_que'] or [("Más contenido, mejor hecho.","8 reels, 8 publicaciones y 12 historias al mes, con línea gráfica propia."),("Conversación.","Respondemos los comentarios para que nadie quede sin respuesta."),("Alcance nuevo.","Gestión de anuncios en Meta y campañas con influencers incluidas.")])
obs=CLIENTE['observaciones']
obs_html=(f'<div class="nota"><strong>Lo que ya vimos en {C["instagram"] or "tu cuenta"}:</strong><ul style="margin:2mm 0 0">'+''.join(f'<li>{html.escape(x)}</li>' for x in obs)+'</ul></div>') if obs else ''
nec_mes=CLIENTE['necesitamos_mes'] or ["Aprobar el calendario en 48 horas","Fotos y videos nuevos (de celular sirven; les damos una pauta)","Avisarnos novedades con una semana de anticipación"]
nec_rows=''.join(f'<tr><td>{a}</td><td>{html.escape(b)}</td></tr>' for a,b in zip(["Acceso a sus cuentas de Instagram y Facebook para publicar (lo coordinamos en la reunión de la semana 1)","Logo, colores y fotos que ya tengan","Una reunión de 60 minutos para definir pilares, tono y prioridades"],nec_mes))

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
</style>
<style>
  .resumen {{ display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; margin:5mm 0 6mm; page-break-inside:avoid; }}
  .resumen > div {{ border:1.5px solid #d7eaea; border-radius:6px; padding:4mm; }}
  .resumen .k {{ font-size:8pt; text-transform:uppercase; letter-spacing:.12em; color:#12959C; font-weight:700; margin-bottom:1.5mm; }}
  .resumen .v {{ font-size:15pt; font-weight:800; line-height:1.15; }} .resumen .s {{ font-size:8.6pt; color:#4a6a6a; margin-top:1mm; }}
  .bonus {{ display:grid; grid-template-columns:repeat(3,1fr); gap:4mm; margin:4mm 0 5mm; page-break-inside:avoid; }}
  .bonus > div {{ border:2px solid #FF7B7B; background:#fffafa; border-radius:6px; padding:4mm; font-size:9pt; }}
  .bonus .badge {{ display:inline-block; background:#FF7B7B; color:#fff; font-size:7.5pt; padding:.8mm 2.5mm; border-radius:3px; text-transform:uppercase; letter-spacing:.1em; margin-bottom:2mm; font-weight:700; }}
  .bonus h4 {{ font-size:11.5pt; color:#123638; margin-bottom:1.5mm; line-height:1.2; }}
  td.inc {{ color:#12959C; font-weight:800; white-space:nowrap; text-align:center; }}
  td.bon {{ color:#e05c5c; font-weight:800; white-space:nowrap; text-align:center; }}
</style></head><body>

<section class="portada">
  <div class="marca"><img src="../assets/logo-influence.png" alt="Influence · Agencia de Marketing"></div>
  <div>
    <div class="kicker">Propuesta · {C["fecha"]}</div>
    <h1>Gestión de redes para {C["nombre"]}</h1>
    <p class="sub">{C["sub"] or "Plan Crecimiento: contenido, comunidad, anuncios e influencers, con la cuenta optimizada desde el primer día."}</p>
  </div>
  <div class="para">
    <div><strong>Para</strong>{para}</div>
    <div style="text-align:right"><strong>De</strong>Gabriel Meza · Influence Chile<br>influencechile.cl · @influence.chile</div>
  </div>
</section>

<section class="seccion primera">
  <h2>Nuestra propuesta</h2>
  <div class="linea"></div>
  <p>{saludo}es proponemos nuestro <strong>Plan Crecimiento</strong>, el más elegido de la agencia, y para partir le sumamos <strong>sin costo</strong> la puesta a punto completa de su cuenta: perfil, historias destacadas y orden de publicaciones.</p>
  <div class="resumen">
    <div><div class="k">Plan</div><div class="v">Crecimiento</div><div class="s">+ bonus de arranque sin costo</div></div>
    <div><div class="k">Inversión mensual</div><div class="v">{f(PLAN)}</div><div class="s">neto + IVA · {f(iva(PLAN))} con IVA</div></div>
    <div><div class="k">Compromiso</div><div class="v">Sin permanencia</div><div class="s">aviso de término con un mes · inicio en 10 días hábiles</div></div>
  </div>
  <h3>Por qué este plan</h3>
  <ul>{por_que}</ul>
</section>

<section class="seccion">
  <h2>Bonus de arranque, sin costo</h2>
  <div class="linea"></div>
  <p>Antes de la primera publicación dejamos la cuenta lista para vender. Es lo que ve quien llega a su perfil, y decide en segundos si sigue mirando o reserva.</p>
  <div class="bonus">
    <div><div class="badge">Bonus 1</div><h4>Perfil optimizado</h4>Nombre con las palabras que la gente busca, biografía que dice qué ofrecen, para quién y cómo se reserva, y un enlace que lleva directo a reservar.</div>
    <div><div class="badge">Bonus 2</div><h4>Destacadas que venden</h4>Ordenadas por lo que pregunta un cliente antes de comprar, con nombres cortos y portadas de la misma línea gráfica.</div>
    <div><div class="badge">Bonus 3</div><h4>Orden de publicaciones</h4>Fijamos arriba lo que más vende, archivamos (sin borrar) lo que ya venció y dejamos la grilla con una línea visual coherente.</div>
  </div>
  {obs_html}
</section>

<section class="seccion">
  <h2>Qué incluye</h2>
  <div class="linea"></div>
  <table>
    <tr><th>Concepto</th><th style="width:20%;text-align:center">Plan Crecimiento</th></tr>
    <tr><td><strong>Bonus de arranque:</strong> perfil, biografía y enlace optimizados; historias destacadas con portadas propias; orden de la grilla y publicaciones fijadas.</td><td class="bon">Sin costo</td></tr>
    <tr><td><strong>Estrategia y planificación mensual.</strong> Calendario con cada pieza definida, entregado el día 20 del mes anterior. Lo aprueban en 48 horas, una ronda de cambios incluida.</td><td class="inc">Incluido</td></tr>
    <tr><td><strong>8 reels al mes</strong> con guion, edición, subtítulos y portada.</td><td class="inc">8</td></tr>
    <tr><td><strong>8 publicaciones al mes</strong> (posts o carruseles) con diseño, copy y caption.</td><td class="inc">8</td></tr>
    <tr><td><strong>12 historias al mes</strong> para novedades, cupos, recordatorios y preguntas frecuentes.</td><td class="inc">12</td></tr>
    <tr><td><strong>Edición profesional y diseño avanzado</strong> con una línea gráfica propia, para que cada pieza se reconozca como de ustedes.</td><td class="inc">Incluido</td></tr>
    <tr><td><strong>Monitoreo y respuesta de comentarios.</strong></td><td class="inc">Incluido</td></tr>
    <tr><td><strong>Gestión de Meta Ads</strong> con creatividades propias (la inversión en pauta se paga directo a Meta, aparte).</td><td class="inc">Incluida</td></tr>
    <tr><td><strong>Campañas con influencers.</strong> Coordinamos a las creadoras y respondemos por el cumplimiento; el canje lo aportan ustedes.</td><td class="inc">Incluidas</td></tr>
    <tr><td><strong>Informe mensual</strong> de una página: qué funcionó y qué hacer el mes siguiente.</td><td class="inc">Incluido</td></tr>
  </table>
  <div class="total">
    <div class="l">Total mensual<strong>Plan Crecimiento + bonus de arranque</strong></div>
    <div class="r"><div class="neto">{f(PLAN)}</div><div class="iva">netos · {f(iva(PLAN))} con IVA</div></div>
  </div>
  <p style="font-size:9pt;color:#4a6a6a">Valores en pesos chilenos, netos, con el IVA indicado aparte. Facturación mensual. Sin costo de puesta en marcha.</p>
</section>

<section class="seccion">
  <h2>Cómo trabajamos</h2>
  <div class="linea"></div>
  <ul>
    <li><strong>Semana 1:</strong> reunión de 60 minutos para definir pilares, tono e identidad gráfica, y aplicamos el bonus de arranque: perfil, destacadas y orden de la grilla.</li>
    <li><strong>Semana 2:</strong> primer calendario aprobado y primeras publicaciones. Desde ahí, calendario mensual el día 20 del mes anterior.</li>
    <li><strong>Cada mes:</strong> 8 reels, 8 publicaciones y 12 historias publicadas, comentarios respondidos y anuncios gestionados si hay pauta.</li>
    <li><strong>Los primeros 5 días de cada mes:</strong> informe de una página con lo que funcionó y una recomendación concreta.</li>
  </ul>
  <h3>Qué necesitamos de ustedes</h3>
  <table>
    <tr><th style="width:50%">Al comenzar</th><th>Cada mes</th></tr>
    {nec_rows}
  </table>
  <h2 style="margin-top:7mm">Condiciones</h2>
  <div class="linea"></div>
  <ul>
    <li><strong>Sin permanencia mínima.</strong> Solo pedimos aviso de término con un mes de anticipación, para cerrar el calendario en curso y entregarles todo el material producido. Recomendamos evaluar a los 90 días.</li>
    <li><strong>Inicio:</strong> 10 días hábiles después de la confirmación.</li>
    <li><strong>No incluido:</strong> inversión en pauta (se paga directo a Meta; recomendamos desde $200.000 al mes para ganar visibilidad), grabación en terreno por parte nuestra (se cotiza aparte), respuesta a mensajes directos y Google Ads.</li>
  </ul>
</section>

<section class="seccion">
  <div class="cta">
    <div class="marca-pie"><img src="../assets/logo-influence.png" alt="Influence · Agencia de Marketing"></div>
    <h2>¿Partimos?</h2>
    <p>Si les hace sentido, confírmenme por WhatsApp o correo y agendamos la reunión de la semana 1. <strong>Díganme el día y la hora que les acomoden y me ajusto.</strong></p>
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
