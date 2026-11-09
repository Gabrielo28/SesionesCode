# Propuesta "Sistema de captación con Meta Ads": implementación única (landing + píxel + API de conversiones +
# armado) y gestión mensual en una de dos opciones (Gestión Meta Ads $150.000 o Plan Crecimiento $450.000).
# Versión explicada: resumen, recorrido de ejemplo, glosario, por qué cuesta lo que cuesta,
# gasto total con pauta, qué esperar, FAQ. Máximo dos opciones. Sin mencionar accesos/contraseñas ("se coordina en la reunión de la semana 1").
#   python3 prospeccion-ventas/propuesta/captacion-meta/generar.py prospeccion-ventas/propuesta/captacion-meta/cliente-tierraceno.json
#   NODE_PATH=/opt/node22/lib/node_modules node prospeccion-ventas/propuesta/captacion-meta/render.js <archivo>
import html, datetime, sys, json, os
CLIENTE={"nombre":"[Nombre del cliente]","contacto":"","instagram":"","archivo":"propuesta-captacion",
         "implementacion":350000,"gestion":150000,"plan":450000,"pauta_min":300000,"pauta_reco":400000,
         "contexto":"","vimos":[],"campanas":[],"nota_cliente":"","fecha":datetime.date.today().strftime("%-d de %B de %Y")}
MESES={'January':'enero','February':'febrero','March':'marzo','April':'abril','May':'mayo','June':'junio','July':'julio','August':'agosto','September':'septiembre','October':'octubre','November':'noviembre','December':'diciembre'}
for en,es in MESES.items(): CLIENTE['fecha']=CLIENTE['fecha'].replace(en,es)
if len(sys.argv)>1 and os.path.exists(sys.argv[1]): CLIENTE.update(json.load(open(sys.argv[1],encoding='utf-8')))
C=CLIENTE  # los textos del JSON pueden traer <strong>; se escriben a mano, no vienen de terceros
f=lambda n: "$"+f"{round(n):,}".replace(",",".")
iva=lambda n: round(n*1.19)
I,G,PL=C['implementacion'],C['gestion'],C['plan']
ig=f' ({C["instagram"]})' if C["instagram"] else ''
para=(f'{C["contacto"]}<br>' if C["contacto"] else '')+f'{C["nombre"]}{ig}'
saludo=(C['contacto'].split()[0]+', n') if C['contacto'] else 'N'
vimos=''.join(f'<li>{v}</li>' for v in C['vimos'])
def _paso(i,p):
    px='<div class="px">'+p['medicion']+'</div>' if p.get('medicion') else ''
    return f'<div class="paso"><div class="num">{i+1}</div><div><strong>{p["titulo"]}</strong><br>{p["texto"]}{px}</div></div>'
recorrido=''.join(_paso(i,p) for i,p in enumerate(C.get('recorrido',[])))
RECO=' class="reco"'
camp=''.join(f'<div{RECO if i==1 else ""}><div class="k">Campaña {i+1}</div><h4>{c["titulo"]}</h4><p style="margin:1.5mm 0">{c["texto"]}</p><div class="s"><strong>Cómo sabemos si funciona:</strong> {c["mide"]}</div></div>' for i,c in enumerate(C['campanas']))
nota=(f'<div class="nota"><strong>En tu caso:</strong> {C["nota_cliente"]}</div>' if C["nota_cliente"] else '')
PA=C['pauta_min']
m1o1=iva(I+G); m2o1=iva(G); m1o2=iva(I+PL); m2o2=iva(PL)

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
</head><body>

<section class="portada">
  <div class="marca"><img src="../assets/logo-influence.png" alt="Influence · Agencia de Marketing"></div>
  <div>
    <div class="kicker">Propuesta · {C["fecha"]}</div>
    <h1>Sistema de captación con Meta Ads</h1>
    <p class="sub">Qué haríamos, cómo funciona, cuánto cuesta y cuánto gastarías en total, explicado sin tecnicismos.</p>
  </div>
  <div class="para">
    <div><strong>Para</strong>{para}</div>
    <div style="text-align:right"><strong>De</strong>Gabriel Meza · Influence Chile<br>influencechile.cl · @influence.chile</div>
  </div>
</section>

<section class="seccion primera">
  <h2>Qué te proponemos</h2>
  <div class="linea"></div>
  <p>{saludo}os contaste {C["contexto"]}</p>
  <p>Para lograrlo te proponemos tres cosas, que en las páginas siguientes explicamos una por una, con lo que cuestan y por qué:</p>
  <div class="breve"><ul>
    <li><strong>Una página de venta en tu web (landing).</strong> Es la página a la que llega la persona cuando toca un anuncio. Está hecha para una sola cosa: que se inscriba al curso, pague la consulta o te escriba. Hoy tus anuncios no tendrían un lugar así donde aterrizar.</li>
    <li><strong>Conectar tu web con Meta (píxel y API de conversiones).</strong> Meta es la empresa dueña de Instagram y Facebook. Esta conexión le avisa cada vez que alguien que vio tu anuncio se inscribe o paga. Con eso Meta aprende qué tipo de persona te compra y le muestra tus anuncios a más gente parecida. Sin esta conexión, los anuncios funcionan a ciegas.</li>
    <li><strong>Hacer y administrar tus anuncios todos los meses.</strong> Diseñamos los anuncios con tus fotos y videos, los publicamos, los revisamos cada semana, apagamos los que no venden y hacemos nuevos para que no se gasten. Cada mes te mostramos cuánto costó cada inscripción y cada venta.</li>
  </ul></div>
  <p>Las dos primeras se hacen una sola vez, con un pago único de {f(I)} + IVA. La tercera es mensual: {f(G)} + IVA, o {f(PL)} + IVA si además quieres que nos hagamos cargo de tu contenido de Instagram. Aparte está el dinero de los anuncios, que pagas tú directo a Meta (recomendamos partir con {f(PA)} al mes); nosotros no recibimos nada de ese dinero. Los anuncios quedan publicados en la tercera semana, y no hay permanencia: puedes terminar avisando con un mes.</p>
  <h3>Lo que vimos en tu web</h3>
  <ul>{vimos}</ul>
  {nota}
</section>

<section class="seccion">
  <h2>Cómo funciona, paso a paso</h2>
  <div class="linea"></div>
  <p>Un ejemplo con una persona cualquiera, para que veas el recorrido completo:</p>
  {recorrido}
  <div class="nota"><strong>Lo importante:</strong> cada vez que alguien se inscribe o paga, Meta se entera gracias al píxel y la API de conversiones. Con esa información aprende qué tipo de persona te compra y busca más personas parecidas. Sin esa conexión, Meta solo puede optimizar por clics o "me gusta", que no te pagan las cuentas.</div>
</section>

<section class="seccion">
  <h2>Las tres campañas</h2>
  <div class="linea"></div>
  <p>Una campaña es un grupo de anuncios con un solo objetivo. Tus servicios ya forman una escalera (curso gratis, consulta, asesoría, proyecto), así que armamos una campaña para cada escalón:</p>
  <div class="caminos">{camp}</div>
  <p>Del total de pauta, al principio la mayor parte va a la campaña 2, porque es la que genera ventas en el corto plazo. La repartición se ajusta cada semana según los resultados.</p>
  <h2 style="margin-top:6mm">Palabras que vas a escuchar</h2>
  <div class="linea"></div>
  <div class="glos">
    <div><h4>Landing</h4>Una página de tu web hecha para una sola cosa: que la persona se inscriba, pague o te escriba. Sin menús ni distracciones.<div class="ej">Ejemplo: tierraceno.cl/consulta</div></div>
    <div><h4>Pauta</h4>El dinero que se le paga a Meta para que muestre tus anuncios. Lo pagas tú, con tu tarjeta, directo a Meta.<div class="ej">Ejemplo: {f(PA)} al mes</div></div>
    <div><h4>Píxel de Meta</h4>Un código que se instala en tu web y le avisa a Meta lo que hace cada visita que llegó desde un anuncio: si se inscribió, si pagó o si te escribió.</div>
    <div><h4>API de conversiones</h4>La misma información del píxel, pero enviada desde el servidor de tu web. Sirve cuando el navegador bloquea el píxel, como pasa en muchos iPhone. Juntos, no se pierden ventas en la medición.</div>
    <div><h4>Creatividad</h4>La pieza que la gente ve: una imagen, un carrusel o un video corto, con su texto.</div>
    <div><h4>Remarketing</h4>Mostrarle anuncios a quien ya te conoce: visitó tu web, se inscribió al curso o compró una consulta.</div>
    <div><h4>Evento o conversión</h4>Cada acción que medimos: inscripción, pago, mensaje de WhatsApp.</div>
    <div><h4>Costo por resultado</h4>Cuánto te costó en pauta cada inscripción o cada venta. Es el número que miramos para decidir qué anuncio sigue y cuál se apaga.</div>
  </div>
</section>

<section class="seccion">
  <h2>1. Implementación (pago único)</h2>
  <div class="linea"></div>
  <p>Se hace una sola vez, en las primeras tres semanas, y queda funcionando en tu web y en tu cuenta.</p>
  <table>
    <tr><th>Qué recibes</th><th style="width:20%;text-align:center">Valor</th></tr>
    <tr><td><strong>Landing de captación en tierraceno.cl.</strong> Diseño y textos pensados para vender, con una versión para cada campaña (curso gratuito, consulta y asesoría). Incluye la inscripción conectada, el pago de la consulta en línea con el carrito que ya tienes, un botón de WhatsApp con mensaje según el servicio, y que cargue rápido en celular.</td><td class="n"><strong>{f(I)}</strong></td></tr>
    <tr><td><strong>Píxel de Meta y API de conversiones.</strong> Instalación y configuración de los eventos (inscripción, contacto por WhatsApp, inicio de pago y compra), probados uno por uno antes de publicar anuncios.</td><td class="inc">Incluido</td></tr>
    <tr><td><strong>Armado de las tres campañas.</strong> Objetivos, públicos, estructura y primeros anuncios. Precio de lista {f(150000)}; no se cobra porque luego administramos las campañas cada mes.</td><td class="bon">Sin costo</td></tr>
  </table>
  <h3>Por qué cuesta {f(I)}</h3>
  <p>En nuestra web las landings van de {f(250000)} a {f(450000)}, según su complejidad. La tuya queda al medio: lleva tres versiones, pago en línea y la conexión con el píxel. El armado de campañas ({f(150000)}) no se cobra.</p>
  <h3>Regalos al confirmar</h3>
  <div class="bonus">
    <div><span class="badge">Regalo 1</span><h4>Arreglamos tus páginas sin terminar</h4>Dejamos con contenido real las páginas <em>Servicios</em> y <em>Cursos</em>, para que nadie que llegue desde un anuncio las vea a medio hacer.</div>
    <div><span class="badge">Regalo 2</span><h4>Perfil de Instagram listo para recibir visitas</h4>Biografía, enlace y destacadas ordenados según tus servicios, porque mucha gente revisa tu perfil antes de escribirte.</div>
    <div><span class="badge">Regalo 3</span><h4>Respuestas listas</h4>Textos para contestar por WhatsApp las consultas más comunes que lleguen de los anuncios.</div>
  </div>
  <div class="total">
    <div class="l">Pago único<strong>Implementación del sistema de captación</strong></div>
    <div class="r"><div class="neto">{f(I)}</div><div class="iva">netos · {f(iva(I))} con IVA</div></div>
  </div>
  <p style="font-size:9pt;color:#4a6a6a">La forma de pago de la implementación se acuerda al confirmar.</p>
</section>

<section class="seccion">
  <h2>2. Gestión mensual: elige una</h2>
  <div class="linea"></div>
  <p>Después de la implementación, alguien tiene que mirar los anuncios cada semana, cambiar lo que no funciona y hacer anuncios nuevos para que no se gasten. Eso es la gestión mensual. La única diferencia entre las dos opciones es si también nos hacemos cargo de tu Instagram.</p>
  <div class="op">
    <div class="reco"><span class="badge">Recomendada para partir</span><div class="k">Opción 1</div><h4>Gestión Meta Ads</h4><div class="v">{f(G)} <small>/mes + IVA · {f(iva(G))} con IVA</small></div>
      <ul><li>Revisión y ajuste semanal de las tres campañas</li><li>2 a 3 creatividades nuevas al mes, hechas con tus fotos y videos</li><li>Pruebas de públicos y mensajes</li><li>Saber qué anuncio trajo cada conversación de WhatsApp</li><li>Informe mensual de una página</li></ul>
      <div class="para-quien"><strong>Para ti si:</strong> quieres concentrar la plata en anuncios y seguir publicando tú en Instagram.</div></div>
    <div><div class="k">Opción 2</div><h4>Plan Crecimiento</h4><div class="v">{f(PL)} <small>/mes + IVA · {f(iva(PL))} con IVA</small></div>
      <ul><li><strong>Todo lo de la opción 1, más:</strong></li><li>8 reels, 8 publicaciones y 12 historias al mes para tu Instagram (también los usamos como anuncios)</li><li>Estrategia y calendario de contenido</li><li>Monitoreo y respuesta de comentarios</li><li>Una campaña con influencers</li></ul>
      <div class="para-quien"><strong>Para ti si:</strong> no tienes tiempo para tu Instagram y quieres que todo salga de un solo lugar.</div></div>
  </div>
  <h3>Por qué estos precios</h3>
  <ul>
    <li><strong>Opción 1:</strong> en nuestra web la gestión de Meta Ads parte en {f(250000)}, pero ese valor es para pautas sobre {f(700000)} al mes. Para pautas menores, como la tuya al partir, cobramos {f(G)}.</li>
    <li><strong>Opción 2:</strong> es el precio publicado del Plan Crecimiento, el mismo para todos los clientes.</li>
    <li>Puedes pasar de una opción a la otra avisando antes de que empiece el mes siguiente.</li>
  </ul>
</section>

<section class="seccion">
  <h2>Cuánto gastarías en total</h2>
  <div class="linea"></div>
  <p>Todo el dinero que saldría de tu bolsillo, con IVA, separado por quién lo recibe. La pauta es la recomendada para partir ({f(PA)}); la decides tú y la puedes cambiar cuando quieras.</p>
  <table>
    <tr><th>Concepto</th><th>Quién lo recibe</th><th style="width:16%;text-align:right">Opción 1</th><th style="width:16%;text-align:right">Opción 2</th></tr>
    <tr><td colspan="4"><strong>Primer mes</strong></td></tr>
    <tr><td>Implementación (una sola vez)</td><td>Influence</td><td class="n">{f(iva(I))}</td><td class="n">{f(iva(I))}</td></tr>
    <tr><td>Gestión del primer mes</td><td>Influence</td><td class="n">{f(iva(G))}</td><td class="n">{f(iva(PL))}</td></tr>
    <tr><td>Pauta de anuncios</td><td>Meta, directo</td><td class="n">{f(PA)}</td><td class="n">{f(PA)}</td></tr>
    <tr><td class="total-fila">Total primer mes</td><td class="total-fila"></td><td class="n total-fila">{f(m1o1+PA)}</td><td class="n total-fila">{f(m1o2+PA)}</td></tr>
    <tr><td colspan="4"><strong>Desde el segundo mes</strong></td></tr>
    <tr><td>Gestión mensual</td><td>Influence</td><td class="n">{f(m2o1)}</td><td class="n">{f(m2o2)}</td></tr>
    <tr><td>Pauta de anuncios</td><td>Meta, directo</td><td class="n">{f(PA)}</td><td class="n">{f(PA)}</td></tr>
    <tr><td class="total-fila">Total mensual</td><td class="total-fila"></td><td class="n total-fila">{f(m2o1+PA)}</td><td class="n total-fila">{f(m2o2+PA)}</td></tr>
  </table>
  <p style="font-size:9pt;color:#4a6a6a">Los valores de Influence se facturan netos más IVA; arriba ya está sumado. Meta puede agregar impuestos a la pauta según cómo esté configurada tu cuenta; lo revisamos juntos en la semana 1. No hay costos escondidos: grabación, Google Ads y el asistente de WhatsApp no están incluidos, y si algún día los quieres, se cotizan antes.</p>
  <div class="nota"><strong>Una cuenta para dimensionar (ejemplo, no promesa):</strong> {C["equilibrio"]}</div>
</section>

<section class="seccion">
  <h2>Qué puedes esperar (y qué no)</h2>
  <div class="linea"></div>
  <div class="dos">
    <div class="bueno"><h4>Lo que sí puedes esperar</h4><ul>
      <li>Anuncios publicados en la semana 3, con el píxel midiendo desde el primer día.</li>
      <li>Inscritos al curso gratuito desde el primer mes, que quedan en tu base.</li>
      <li>Ventas de consultas y asesorías que suben a medida que Meta aprende, normalmente más estables desde el segundo mes.</li>
      <li>Saber cada mes cuánto te costó cada inscripción y cada venta.</li>
      <li>Que te digamos claro si algo no está funcionando y qué vamos a cambiar.</li></ul></div>
    <div class="malo"><h4>Lo que no te vamos a prometer</h4><ul>
      <li>Una cantidad fija de ventas: depende de la pauta, del precio y de cómo se atienden las consultas.</li>
      <li>Casas cerradas en el primer trimestre: los proyectos grandes tardan meses en decidirse. Las campañas los alimentan, pero ese ciclo no lo acortamos nosotros.</li>
      <li>Resultados de la primera semana: Meta necesita algunas semanas de datos para aprender.</li></ul></div>
  </div>
  <div class="nota coral"><strong>Sobre la pauta:</strong> con {f(PA)} al mes se puede partir bien con la consulta y el curso. Para escalar recomendamos {f(C["pauta_reco"])}. Con menos de {f(PA)}, los anuncios se ven, pero Meta tarda mucho más en aprender quién compra.</div>
  <h3>Qué trae el informe de cada mes</h3>
  <table>
    <tr><th style="width:50%">Números</th><th>Explicación</th></tr>
    <tr><td>Pauta gastada y personas alcanzadas</td><td>Qué anuncios funcionaron mejor y por qué</td></tr>
    <tr><td>Inscritos al curso y costo por inscrito</td><td>Qué apagamos y qué probamos el mes siguiente</td></tr>
    <tr><td>Consultas y asesorías vendidas, y costo por venta</td><td>Recomendación de pauta para el mes siguiente</td></tr>
    <tr><td>Conversaciones de WhatsApp y qué anuncio las trajo</td><td>Qué necesitamos de ti (fotos, videos, novedades)</td></tr>
  </table>
</section>

<section class="seccion">
  <h2>Cómo trabajamos</h2>
  <div class="linea"></div>
  <ul>
    <li><strong>Semana 1:</strong> reunión de 45 minutos para definir qué servicios empujar primero, precios, zona y público. Ahí mismo coordinamos lo necesario para trabajar en tu web y en tu cuenta publicitaria.</li>
    <li><strong>Semana 2:</strong> píxel y API de conversiones funcionando, y primera versión de la landing para que la revises.</li>
    <li><strong>Semana 3:</strong> landing aprobada y campañas publicadas con las primeras creatividades.</li>
    <li><strong>Cada semana:</strong> revisión de resultados y ajustes. <strong>Primeros 5 días de cada mes:</strong> informe y plan del mes siguiente.</li>
  </ul>
  <h3>Qué necesitamos de ti</h3>
  <table>
    <tr><th style="width:50%">Al comenzar</th><th>Cada mes</th></tr>
    <tr><td>Una reunión de 45 minutos</td><td>Fotos y videos de obras, talleres y procesos (de celular sirven)</td></tr>
    <tr><td>Tu cuenta publicitaria de Meta con un medio de pago a tu nombre</td><td>Aprobar creatividades y contenidos en 48 horas</td></tr>
    <tr><td>Qué servicios y precios quieres empujar primero</td><td>Responder rápido las consultas que lleguen: es donde se cierra la venta</td></tr>
  </table>
  <h2 style="margin-top:7mm">Condiciones</h2>
  <div class="linea"></div>
  <ul>
    <li><strong>Sin permanencia mínima</strong> en la gestión mensual: solo aviso de término con un mes de anticipación. Recomendamos evaluar a los 90 días.</li>
    <li><strong>Todo queda a tu nombre:</strong> la landing, el píxel, la cuenta publicitaria, los públicos y los anuncios. Si algún día dejas de trabajar con nosotros, sigues con todo.</li>
    <li><strong>Inicio:</strong> 10 días hábiles después de la confirmación.</li>
    <li><strong>No incluido:</strong> pauta (se paga a Meta), grabación (opcional: jornada de 3 horas en Santiago por {f(90000)}), respuesta de mensajes, Google Ads y automatizaciones.</li>
  </ul>
</section>

<section class="seccion">
  <h2>Preguntas frecuentes</h2>
  <div class="linea"></div>
  <div class="faq">
    <h4>¿Qué pasa si a los tres meses no funciona?</h4><p>Lo vemos con los números del informe. Si no te convence, terminas con un mes de aviso, sin multas, y la landing y el píxel quedan en tu web.</p>
    <h4>¿Puedo subir o bajar la pauta?</h4><p>Sí, cuando quieras; la pagas tú directo a Meta. Te recomendamos no bajar de {f(PA)} para que Meta siga aprendiendo.</p>
    <h4>¿Tengo que aparecer en los videos?</h4><p>No es obligatorio. Con fotos y videos de tus obras, talleres y procesos funciona. Si quieres aparecer, mejor: genera más confianza.</p>
    <h4>¿Quién responde los mensajes que lleguen?</h4><p>Tú o tu equipo, porque ahí se cierra la venta. Te dejamos textos de respuesta listos (regalo 3). Más adelante, un asistente de WhatsApp puede responder lo frecuente por ti.</p>
    <h4>¿Por qué no Google Ads desde el principio?</h4><p>Para no repartir una pauta chica en dos plataformas. Con los datos de Meta sabremos qué servicios y mensajes funcionan, y con eso armamos Google Ads.</p>
    <h4>¿Puedo cambiar de la opción 1 a la 2?</h4><p>Sí, avisando antes de que empiece el mes siguiente. También al revés.</p>
  </div>
  <h3>Más adelante, cuando las campañas estén estables (desde el mes 3)</h3>
  <ul>
    <li><strong>Asistente de WhatsApp que responde y agenda:</strong> contesta las preguntas frecuentes de cada servicio a cualquier hora y deja agendada la consulta. {f(350000)} de implementación + {f(80000)} al mes.</li>
    <li><strong>Google Ads:</strong> para quienes ya buscan bioconstrucción o diseño sustentable en Google. Lo cotizamos con palabras clave reales cuando tengamos los datos de Meta.</li>
  </ul>
</section>

<section class="seccion">
  <div class="cta">
    <div class="marca-pie"><img src="../assets/logo-influence.png" alt="Influence · Agencia de Marketing"></div>
    <h2>¿Partimos?</h2>
    <p>Si te hace sentido, dime qué opción prefieres por WhatsApp o correo y agendamos la reunión de arranque. Si tienes cualquier duda sobre un número o un término, pregúntame: prefiero que lo tengas todo claro antes de partir. <strong>Dime el día y la hora que te acomoden y me ajusto.</strong></p>
    <div class="boton">Confirmar por WhatsApp o correo</div>
    <div class="firma">
      <strong>Gabriel Meza</strong><br>
      Influence Chile · Agencia de marketing y automatización con IA<br>
      +56 9 6545 0723 · <a href="https://influencechile.cl">influencechile.cl</a> · Instagram <a href="https://www.instagram.com/influence.chile">@influence.chile</a>
    </div>
    <p class="pie">Propuesta válida por 30 días desde el {C["fecha"]}. Valores en pesos chilenos, netos, IVA indicado aparte salvo donde se indica "con IVA".</p>
  </div>
</section>
</body></html>'''
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),C['archivo']+'.html')
open(out,'w',encoding='utf-8').write(HTML); print('ok ->',out)
