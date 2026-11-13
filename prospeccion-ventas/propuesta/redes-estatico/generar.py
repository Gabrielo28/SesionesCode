# Propuesta "Redes con diseño estático + Meta Ads": 8 o 12 publicaciones estáticas al mes (Instagram y Facebook)
# y gestión de Meta Ads. Dos opciones. Precio transparente: valor por publicación + gestión de Meta Ads ($150.000,
# tramo para pautas bajo $700.000, con armado incluido). Sin grabación. Sin mencionar accesos/contraseñas.
#   python3 prospeccion-ventas/propuesta/redes-estatico/generar.py prospeccion-ventas/propuesta/redes-estatico/cliente-camila.json
#   NODE_PATH=/opt/node22/lib/node_modules node prospeccion-ventas/propuesta/redes-estatico/render.js <archivo>
import datetime, sys, json, os
C={"nombre":"[Cliente]","contacto":"","instagram":"","archivo":"propuesta-redes-estatico","usd":980,
   "por_post":15000,"meta":150000,"meta_armado":150000,"posts_a":8,"posts_b":12,"pauta_usd":300,
   "contexto":"","nota_cliente":"","fecha":datetime.date.today().strftime("%-d de %B de %Y")}
MESES={'January':'enero','February':'febrero','March':'marzo','April':'abril','May':'mayo','June':'junio','July':'julio','August':'agosto','September':'septiembre','October':'octubre','November':'noviembre','December':'diciembre'}
for en,es in MESES.items(): C['fecha']=C['fecha'].replace(en,es)
if len(sys.argv)>1 and os.path.exists(sys.argv[1]): C.update(json.load(open(sys.argv[1],encoding='utf-8')))
f=lambda n: "$"+f"{round(n):,}".replace(",",".")
u=lambda n: "US$"+f"{round(n/C['usd']/10)*10:,}".replace(",",".")
PP,ME,MA,NA,NB=C['por_post'],C['meta'],C['meta_armado'],C['posts_a'],C['posts_b']
DA,DB=PP*NA,PP*NB; TA,TB=DA+ME,DB+ME
PU=C['pauta_usd']; PCLP=PU*C['usd']
ig=f' ({C["instagram"]})' if C["instagram"] else ''
para=(f'{C["contacto"]}<br>' if C["contacto"] else '')+(C["nombre"]+ig if C["nombre"] else '')
saludo=(C['contacto'].split()[0]+', n') if C['contacto'] else 'N'
nota=(f'<div class="nota"><strong>En tu caso:</strong> {C["nota_cliente"]}</div>' if C["nota_cliente"] else '')

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
</style>
<style>
  .caminos .s {{ font-size:8.4pt; color:#4a6a6a; }}
  .op {{ display:grid; grid-template-columns:1fr 1fr; gap:5mm; margin:4mm 0 5mm; page-break-inside:avoid; }}
  .op > div {{ border:1.5px solid #d7eaea; border-radius:6px; padding:4.5mm; font-size:9pt; }}
  .op > div.reco {{ border:2.5px solid #FF7B7B; background:#fffafa; }}
  .op .badge {{ display:inline-block; background:#FF7B7B; color:#fff; font-size:7.5pt; padding:.8mm 2.5mm; border-radius:3px; text-transform:uppercase; letter-spacing:.1em; margin-bottom:2mm; font-weight:700; }}
  .op .k {{ font-size:8pt; text-transform:uppercase; letter-spacing:.12em; color:#12959C; font-weight:700; }}
  .op h4 {{ font-size:13pt; margin:1mm 0 1.5mm; }} .op .v {{ font-size:17pt; font-weight:800; margin:1mm 0 2mm; }} .op .v small {{ font-size:8.5pt; font-weight:500; color:#4a6a6a; }}
  .op li {{ margin-bottom:1.2mm; }}
</style>
<style>
  .paso {{ display:flex; gap:4mm; align-items:flex-start; border:1.5px solid #d7eaea; border-radius:6px; padding:3mm 4mm; margin-bottom:2.6mm; page-break-inside:avoid; }}
  .paso .num {{ flex:0 0 8mm; height:8mm; border-radius:50%; background:#12959C; color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center; font-size:10.5pt; }}
  .paso .px {{ margin-top:1.4mm; font-size:8.6pt; color:#e05c5c; font-weight:600; }}
  .glos {{ display:grid; grid-template-columns:1fr 1fr; gap:3.5mm; margin:4mm 0; }}
  .glos > div {{ border:1.5px solid #d7eaea; border-radius:6px; padding:3.2mm 4mm; font-size:9pt; page-break-inside:avoid; }}
  .glos h4 {{ font-size:11pt; color:#12959C; margin-bottom:1mm; }}
  .glos .ej {{ color:#4a6a6a; font-size:8.5pt; margin-top:1mm; }}
  .op {{ display:grid; grid-template-columns:1fr 1fr; gap:5mm; margin:4mm 0 5mm; page-break-inside:avoid; }}
  .op > div {{ border:1.5px solid #d7eaea; border-radius:6px; padding:4.5mm; font-size:9pt; }}
  .op > div.reco {{ border:2.5px solid #FF7B7B; background:#fffafa; }}
  .op .badge {{ display:inline-block; background:#FF7B7B; color:#fff; font-size:7.5pt; padding:.8mm 2.5mm; border-radius:3px; text-transform:uppercase; letter-spacing:.1em; margin-bottom:2mm; font-weight:700; }}
  .op .k {{ font-size:8pt; text-transform:uppercase; letter-spacing:.12em; color:#12959C; font-weight:700; }}
  .op h4 {{ font-size:13pt; margin:1mm 0 1.5mm; }} .op .v {{ font-size:17pt; font-weight:800; margin:1mm 0 2mm; }} .op .v small {{ font-size:8.5pt; font-weight:500; color:#4a6a6a; }}
  .op li {{ margin-bottom:1.2mm; }} .op .para-quien {{ margin-top:2.5mm; font-size:8.6pt; color:#4a6a6a; border-top:1px dashed #d7eaea; padding-top:2mm; }}
  .caminos .s {{ font-size:8.4pt; color:#4a6a6a; }}
  .breve {{ border:2px solid #12959C; border-radius:8px; padding:5mm 6mm; margin:3mm 0 5mm; }}
  .breve li {{ margin-bottom:2.4mm; }}
  .faq h4 {{ font-size:10.5pt; color:#123638; margin:3.6mm 0 1mm; }} .faq p {{ margin-bottom:1mm; }}
  .dos {{ display:grid; grid-template-columns:1fr 1fr; gap:5mm; }}
  .dos .bueno h4 {{ color:#12959C; }} .dos .malo h4 {{ color:#e05c5c; }}
  .dos > div {{ border:1.5px solid #d7eaea; border-radius:6px; padding:4mm; font-size:9pt; page-break-inside:avoid; }}
  .dos h4 {{ font-size:11pt; margin-bottom:2mm; }}
  td.total-fila {{ font-weight:800; background:#e6f1f1 !important; }}
</style>
<style>
  td.sub {{ background:#e6f1f1 !important; font-weight:700; }}
  .calc {{ font-size:9.2pt; }}
</style>
</head><body>

<section class="portada">
  <div class="marca"><img src="../assets/logo-influence.png" alt="Influence · Agencia de Marketing"></div>
  <div>
    <div class="kicker">Propuesta · {C["fecha"]}</div>
    <h1>Gestión de redes con diseño estático y publicidad en Meta</h1>
    <p class="sub">Instagram y Facebook: publicaciones diseñadas, programadas y publicadas cada mes, y campañas pagadas en Meta gestionadas por el mismo equipo.</p>
  </div>
  <div class="para">
    <div><strong>Para</strong>{para}</div>
    <div style="text-align:right"><strong>De</strong>Gabriel Meza · Influence Chile<br>influencechile.cl · @influence.chile</div>
  </div>
</section>

<section class="seccion primera">
  <h2>Nuestra propuesta</h2>
  <div class="linea"></div>
  <p>{saludo}os contaste {C["contexto"]}</p>
  <p>Te proponemos hacernos cargo de las dos cosas como un solo servicio: diseñamos y publicamos tus publicaciones de cada mes, y con ese mismo material armamos y administramos tus anuncios en Instagram y Facebook. Así la publicidad y el contenido se ven de la misma marca y dicen lo mismo.</p>
  <div class="resumen">
    <div><div class="k">Opción 1</div><div class="v">{f(TA)}</div><div class="s">al mes, neto · {NA} publicaciones + Meta Ads · aprox. {u(TA)}</div></div>
    <div><div class="k">Opción 2</div><div class="v">{f(TB)}</div><div class="s">al mes, neto · {NB} publicaciones + Meta Ads · aprox. {u(TB)}</div></div>
    <div><div class="k">Compromiso</div><div class="v">Sin permanencia</div><div class="s">aviso de término con un mes · inicio en 10 días hábiles</div></div>
  </div>
  <h3>Lo que pediste y cómo lo resolvemos</h3>
  <table>
    <tr><th>Lo que pediste</th><th>Cómo lo hacemos</th></tr>
    <tr><td>Diseño estático, 8 o 12 publicaciones al mes</td><td>Dos opciones: {NA} o {NB} publicaciones (post o carrusel), con diseño, texto y publicación incluidos</td></tr>
    <tr><td>Gestión de las redes</td><td>Calendario mensual, programación y publicación en Instagram y Facebook</td></tr>
    <tr><td>Social media paid (publicidad paga en Meta)</td><td>Armado, revisión semanal y optimización de tus campañas, con creatividades propias</td></tr>
    <tr><td>Solo Instagram y Facebook por ahora</td><td>Trabajamos solo esas dos redes; si más adelante quieres sumar otra, lo conversamos</td></tr>
  </table>
  {nota}
</section>

<section class="seccion">
  <h2>Qué incluye cada opción</h2>
  <div class="linea"></div>
  <table>
    <tr><th>Concepto</th><th style="width:16%;text-align:center">Opción 1</th><th style="width:16%;text-align:center">Opción 2</th></tr>
    <tr><td colspan="3" class="sub">Gestión de redes (Instagram y Facebook)</td></tr>
    <tr><td><strong>Publicaciones con diseño estático</strong> (post o carrusel de hasta 5 imágenes), con la línea gráfica de tu marca.</td><td class="c"><strong>{NA}</strong></td><td class="c"><strong>{NB}</strong></td></tr>
    <tr><td><strong>Texto de cada publicación</strong> (caption) con llamado a la acción y hashtags.</td><td class="inc">Incluido</td><td class="inc">Incluido</td></tr>
    <tr><td><strong>Calendario mensual</strong> para tu aprobación antes de publicar, con fechas y temas de cada publicación.</td><td class="inc">Incluido</td><td class="inc">Incluido</td></tr>
    <tr><td><strong>Programación y publicación</strong> en Instagram y Facebook en los mejores horarios.</td><td class="inc">Incluida</td><td class="inc">Incluida</td></tr>
    <tr><td><strong>Una ronda de ajustes</strong> por pieza antes de publicar.</td><td class="inc">Incluida</td><td class="inc">Incluida</td></tr>
    <tr><td colspan="3" class="sub">Publicidad en Meta (Social media paid)</td></tr>
    <tr><td><strong>Armado de campañas</strong> (primer mes): objetivo, públicos, estructura y anuncios. Precio de lista {f(MA)}.</td><td class="bon">Sin costo</td><td class="bon">Sin costo</td></tr>
    <tr><td><strong>Revisión y optimización semanal:</strong> reparto del presupuesto, públicos y anuncios; pausamos lo que no rinde.</td><td class="inc">Incluida</td><td class="inc">Incluida</td></tr>
    <tr><td><strong>2 a 3 creatividades nuevas al mes para anuncios,</strong> adaptadas de tus publicaciones para que los anuncios no se desgasten.</td><td class="inc">Incluidas</td><td class="inc">Incluidas</td></tr>
    <tr><td><strong>Atribución de mensajes:</strong> sabemos qué anuncio trajo cada mensaje o contacto.</td><td class="inc">Incluida</td><td class="inc">Incluida</td></tr>
    <tr><td colspan="3" class="sub">Seguimiento</td></tr>
    <tr><td><strong>Informe mensual</strong> de una página: alcance, interacción, seguidores nuevos, inversión en anuncios, resultados y costo por resultado, y qué ajustaremos el mes siguiente.</td><td class="inc">Incluido</td><td class="inc">Incluido</td></tr>
  </table>
  <h3>Cómo se calcula el precio</h3>
  <table class="calc">
    <tr><th>Parte</th><th style="width:16%;text-align:right">Opción 1</th><th style="width:16%;text-align:right">Opción 2</th></tr>
    <tr><td>Diseño y gestión de publicaciones: {f(PP)} por publicación</td><td class="n">{NA} × {f(PP)} = {f(DA)}</td><td class="n">{NB} × {f(PP)} = {f(DB)}</td></tr>
    <tr><td>Gestión de Meta Ads (valor para pautas menores a {f(700000)} al mes)</td><td class="n">{f(ME)}</td><td class="n">{f(ME)}</td></tr>
    <tr><td><strong>Total mensual, neto</strong></td><td class="n"><strong>{f(TA)}</strong></td><td class="n"><strong>{f(TB)}</strong></td></tr>
    <tr><td>Referencia en dólares</td><td class="n">{u(TA)}</td><td class="n">{u(TB)}</td></tr>
  </table>
</section>

<section class="seccion">
  <h2>Cómo funciona la publicidad en Meta</h2>
  <div class="linea"></div>
  <p>Meta es la empresa dueña de Instagram y Facebook. Cuando pagas por publicidad, Meta muestra tus anuncios a personas que todavía no te siguen, según la zona, la edad y los intereses que definimos juntos. Nuestro trabajo es decidir a quién mostrárselos, con qué anuncio y con qué presupuesto, y revisar cada semana qué funciona para poner ahí la plata.</p>
  <h3>Hay dos dineros distintos</h3>
  <table>
    <tr><th style="width:30%">Concepto</th><th>Qué es</th><th style="width:22%">Quién lo recibe</th></tr>
    <tr><td><strong>Gestión</strong></td><td>Nuestro trabajo: armar, revisar y mejorar las campañas, y hacer las creatividades. Está dentro del precio mensual de esta propuesta.</td><td>Influence</td></tr>
    <tr><td><strong>Pauta</strong></td><td>El dinero que se le paga a Meta para que muestre los anuncios. Lo pagas tú, con tu tarjeta, directo a Meta y en la moneda de tu cuenta publicitaria.</td><td>Meta, directo</td></tr>
  </table>
  <div class="nota coral"><strong>Cuánta pauta recomendamos:</strong> partir con al menos {"US$"+str(PU)} al mes. Con ese monto, el objetivo realista es ganar visibilidad y generar mensajes de clientes nuevos. Con menos se puede partir, pero los resultados son más lentos. La pauta la decides tú y la puedes cambiar cuando quieras.</div>
  <h3>Qué puedes esperar (y qué no)</h3>
  <div class="dos">
    <div class="bueno"><h4>Lo que sí</h4><ul>
      <li>Publicaciones constantes y con la misma línea gráfica todo el mes.</li>
      <li>Anuncios publicados desde la segunda semana.</li>
      <li>Saber cada mes cuánto invertiste en anuncios y cuánto te costó cada resultado.</li>
      <li>Que te digamos claro qué funcionó y qué vamos a cambiar.</li></ul></div>
    <div class="malo"><h4>Lo que no vamos a prometer</h4><ul>
      <li>Una cantidad fija de seguidores o ventas: depende de la pauta, la oferta y cómo se atienden los mensajes.</li>
      <li>Resultados en la primera semana: Meta necesita algunas semanas de datos para aprender.</li></ul></div>
  </div>
</section>

<section class="seccion">
  <h2>Cómo trabajamos</h2>
  <div class="linea"></div>
  <ul>
    <li><strong>Semana 1:</strong> reunión de 45 minutos por videollamada para conocer tu marca, tus servicios o productos, tu público y tus objetivos. Ahí coordinamos lo necesario para trabajar en tus cuentas.</li>
    <li><strong>Semana 2:</strong> línea gráfica y primer calendario para tu aprobación; campañas de Meta armadas y publicadas.</li>
    <li><strong>Cada mes:</strong> calendario del mes siguiente listo el día 20 para tu aprobación; revisión semanal de los anuncios; informe en los primeros 5 días hábiles.</li>
  </ul>
  <h3>Qué necesitamos de ti</h3>
  <table>
    <tr><th style="width:50%">Al comenzar</th><th>Cada mes</th></tr>
    <tr><td>Logo, colores y tipografías de tu marca (si los tienes)</td><td>Fotos de tus productos o servicios, novedades y promociones</td></tr>
    <tr><td>Tu cuenta publicitaria de Meta con un medio de pago a tu nombre</td><td>Aprobar el calendario y las piezas en 48 horas</td></tr>
    <tr><td>Una persona de contacto que apruebe</td><td>Responder tú los mensajes y comentarios que lleguen</td></tr>
  </table>
  <h2 style="margin-top:6mm">Condiciones</h2>
  <div class="linea"></div>
  <ul>
    <li><strong>Sin permanencia mínima:</strong> solo aviso de término con un mes de anticipación. Recomendamos evaluar a los 90 días.</li>
    <li><strong>Puedes cambiar de opción</strong> (de {NA} a {NB} publicaciones o al revés) avisando antes de que empiece el mes siguiente.</li>
    <li><strong>Todo queda a tu nombre:</strong> cuentas, diseños y campañas. Si algún día dejas de trabajar con nosotros, te quedas con todo.</li>
    <li><strong>Inicio:</strong> 10 días hábiles después de la confirmación.</li>
    <li><strong>Moneda e impuestos:</strong> valores en pesos chilenos, netos; la referencia en dólares usa el dólar a {f(C["usd"])}. Al ser un cliente fuera de Chile, el tratamiento de impuestos y la forma de pago los confirmamos antes de la primera factura.</li>
    <li><strong>No incluido:</strong> la pauta (se paga a Meta), respuesta de comentarios y mensajes, reels o videos, historias, y otras redes. <strong>No hacemos el servicio de grabación ni de fotografía:</strong> diseñamos con tus fotos, y si no tienes, con imágenes de bancos libres de derechos.</li>
  </ul>
</section>

<section class="seccion">
  <h2>Preguntas frecuentes</h2>
  <div class="linea"></div>
  <div class="faq">
    <h4>¿Qué es un carrusel?</h4><p>Una publicación con varias imágenes que se deslizan hacia el lado. Cuenta como una publicación, con hasta 5 imágenes.</p>
    <h4>¿Puedo trabajar con ustedes desde Argentina?</h4><p>Sí: todo nuestro trabajo es remoto y las reuniones son por videollamada.</p>
    <h4>¿Los anuncios pueden apuntar solo a mi ciudad o país?</h4><p>Sí. Definimos juntos la zona, la edad y los intereses del público, y lo ajustamos según los resultados.</p>
    <h4>¿Quién responde los mensajes que lleguen de los anuncios?</h4><p>Tú, porque ahí se cierra la venta. Si más adelante quieres que lo hagamos nosotros, lo cotizamos aparte.</p>
    <h4>¿Puedo subir o bajar la pauta?</h4><p>Sí, cuando quieras: la pagas directo a Meta. Nuestro precio de gestión no cambia mientras la pauta sea menor a {f(700000)} al mes (unos {u(700000)}).</p>
    <h4>¿Qué pasa si a los tres meses no me convence?</h4><p>Lo vemos con los números del informe. Si no te convence, terminas con un mes de aviso, sin multas, y todo queda a tu nombre.</p>
  </div>
</section>

<section class="seccion">
  <div class="cta">
    <div class="marca-pie"><img src="../assets/logo-influence.png" alt="Influence · Agencia de Marketing"></div>
    <h2>¿Partimos?</h2>
    <p>Si te hace sentido, dime qué opción prefieres por WhatsApp o correo y agendamos la reunión de arranque. Si tienes cualquier duda sobre un número, pregúntame: prefiero que lo tengas todo claro antes de partir. <strong>Dime el día y la hora que te acomoden y me ajusto.</strong></p>
    <div class="boton">Confirmar por WhatsApp o correo</div>
    <div class="firma">
      <strong>Gabriel Meza</strong><br>
      Influence Chile · Agencia de marketing y automatización con IA<br>
      +56 9 6545 0723 · <a href="https://influencechile.cl">influencechile.cl</a> · Instagram <a href="https://www.instagram.com/influence.chile">@influence.chile</a>
    </div>
    <p class="pie">Propuesta válida por 30 días desde el {C["fecha"]}. Valores en pesos chilenos, netos; referencia en dólares con el dólar a {f(C["usd"])}.</p>
  </div>
</section>
</body></html>'''
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),C['archivo']+'.html')
open(out,'w',encoding='utf-8').write(HTML); print('ok ->',out)
