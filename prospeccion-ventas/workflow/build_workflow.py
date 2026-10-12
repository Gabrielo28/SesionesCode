# Genera prospeccion-ventas/workflow/workflow-prospeccion.html (4 páginas A4 horizontal)
import html
TEAL='#12959C'; CORAL='#FF7B7B'; DARK='#123638'; LIGHT='#e6f1f1'; GREY='#5f7a7a'; AUTO='#123638'
W,H=1123,794

def esc(s): return html.escape(s)

def box(x,y,w,h,lines,fill='#fff',stroke=TEAL,text=DARK,title=None,r=8,fs=12.5,bold_first=True):
    out=[f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>']
    lh=fs*1.35; n=len(lines)+(1 if title else 0)
    y0=y+h/2-(n-1)*lh/2
    i=0
    if title:
        out.append(f'<text x="{x+w/2}" y="{y0+4}" text-anchor="middle" font-size="{fs+1}" font-weight="800" fill="{text}">{esc(title)}</text>'); i=1
    for j,l in enumerate(lines):
        fw='700' if (bold_first and j==0 and not title) else '500'
        out.append(f'<text x="{x+w/2}" y="{y0+4+(i+j)*lh}" text-anchor="middle" font-size="{fs}" font-weight="{fw}" fill="{text}">{esc(l)}</text>')
    return '\n'.join(out)

def arrow(x1,y1,x2,y2,label=None,color=TEAL,dashed=False,curve=None,lx=None,ly=None):
    d=f'M{x1},{y1} '
    if curve: d+=f'Q{curve[0]},{curve[1]} {x2},{y2}'
    else: d+=f'L{x2},{y2}'
    dash=' stroke-dasharray="6,5"' if dashed else ''
    out=[f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2.2"{dash} marker-end="url(#ah-{ "coral" if color==CORAL else "teal" if color==TEAL else "dark"})"/>']
    if label:
        mx=lx if lx is not None else (x1+x2)/2; my=ly if ly is not None else (y1+y2)/2-6
        tw=len(label)*6.4+10
        out.append(f'<rect x="{mx-tw/2}" y="{my-10}" width="{tw}" height="16" rx="4" fill="#fff"/>')
        out.append(f'<text x="{mx}" y="{my+2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="{color}">{esc(label)}</text>')
    return '\n'.join(out)

DEFS=f'''<defs>
<marker id="ah-teal" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{TEAL}"/></marker>
<marker id="ah-coral" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{CORAL}"/></marker>
<marker id="ah-dark" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="{DARK}"/></marker>
</defs>'''

def header(title,sub,n):
    return f'''<div class="hd"><div><div class="k">Workflow de prospección · Influence Chile · {n}/4</div><h1>{esc(title)}</h1><p>{esc(sub)}</p></div><img src="../propuesta/assets/logo-influence.png" alt="Influence"></div>'''

# ---------- Página 1: carriles ----------
def page1():
    s=[f'<svg viewBox="0 0 1043 620" width="1043" height="620" font-family="Montserrat, sans-serif">',DEFS]
    lanes=[('ENTRANTES','test web · Instagram · correo',CORAL),('AUTOMÁTICO','rutina · lunes 10:00',AUTO),('ASISTENTE','verifica · redacta · prepara · registra',TEAL),('GABRIEL','aprueba · envía · conversa · cierra',CORAL)]
    LH=150; top=20
    cols=['Captar','Verificar','Preparar','Contactar','Seguir','Reunir','Cerrar']
    cw=(1043-120)/7; x0=120
    # column headers
    for i,c in enumerate(cols):
        s.append(f'<text x="{x0+i*cw+cw/2}" y="12" text-anchor="middle" font-size="11" font-weight="800" letter-spacing="2" fill="{GREY}">{c.upper()}</text>')
    for i,(name,sub,col) in enumerate(lanes):
        y=top+i*LH
        s.append(f'<rect x="0" y="{y}" width="1043" height="{LH-6}" rx="10" fill="{"#f6fbfb" if i%2 else "#fff"}" stroke="{LIGHT}"/>')
        s.append(f'<rect x="0" y="{y}" width="110" height="{LH-6}" rx="10" fill="{col}"/>')
        s.append(f'<text x="55" y="{y+LH/2-14}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" letter-spacing="1">{name}</text>')
        for k,l in enumerate(sub.split(' · ')):
            s.append(f'<text x="55" y="{y+LH/2+2+k*12}" text-anchor="middle" font-size="9" fill="#fff" opacity=".9">{esc(l)}</text>')
    def cell(lane,col,w=116,h=82):
        cx=x0+col*cw+cw/2; cy=top+lane*LH+(LH-6)/2
        return cx-w/2,cy-h/2,w,h
    B={}
    def put(key,lane,col,lines,**kw):
        x,y,w,h=cell(lane,col); B[key]=(x,y,w,h); s.append(box(x,y,w,h,lines,**kw))
    put('E0',0,0,['Entrante','test web · DM IG','correo'],stroke=CORAL)
    put('E3',0,3,['Responder < 2 h','una meta: agendar','pide @ o web','2 horarios · sin precio'],stroke=CORAL,fs=10.5)
    put('A0',1,0,['Lunes 10:00','busca 8-10 nuevas','otro ángulo','cada semana'],stroke=AUTO,fs=10.8)
    put('S1',2,1,['Verificar','web real · equipo','sin IA ni agenda','regla Auditron'],fs=10.8)
    put('S2',2,2,['Decisor + canal','+ mensaje 5 partes','→ por_contactar'],fs=10.8)
    put('S4',2,4,['Preparar','auditoría express','o mapa de proceso','antes de la reunión'],fs=10.8)
    put('S5',2,5,['Propuesta','el mismo día','2 opciones · neto+IVA','sin permanencia'],fs=10.8)
    put('S6',2,6,['Registro (vie)','números semana','dormidos → 90 días'],fs=10.8)
    put('G2',3,2,['Aprueba lote','10 empresas','5 A + 5 B · 20 min'],stroke=CORAL,fs=10.8)
    put('G3',3,3,['Envía a mano (mar)','WhatsApp 10-13','email 9-11 · llamada'],stroke=CORAL,fs=10.8)
    put('G4',3,4,['Seguimiento (jue)','día 4 · día 10','después: se deja'],stroke=CORAL,fs=10.8)
    put('G5',3,5,['Reunión 30 min','jue / vie','agenda del prospecto'],stroke=CORAL,fs=10.8)
    put('G6',3,6,['Cierre','ganado / perdido','motivo en notas'],stroke=CORAL,fs=10.8)
    def R(k): return B[k]
    def right(k): x,y,w,h=R(k); return x+w,y+h/2
    def left(k): x,y,w,h=R(k); return x,y+h/2
    def bottom(k): x,y,w,h=R(k); return x+w/2,y+h
    def topc(k): x,y,w,h=R(k); return x+w/2,y
    # arrows
    s.append(arrow(*right('A0'),*left('S1'),color=AUTO))            # auto -> verificar (diag)
    s.append(arrow(*right('S1'),*left('S2')))
    s.append(arrow(*bottom('S2'),*topc('G2'),color=CORAL))
    s.append(arrow(*right('G2'),*left('G3'),color=CORAL))
    x1,y1=right('G3'); x2,y2=left('G4'); s.append(arrow(x1,y1,x2,y2,label='sin respuesta',color=CORAL,lx=(x1+x2)/2,ly=B['G3'][1]+B['G3'][3]+16))
    x1,y1=topc('G3'); x2,y2=bottom('S4')
    s.append(arrow(x1+30,y1,x2-20,y2,label='respondió',curve=(x1+60,y1-40),lx=x1+75,ly=y1-42))
    s.append(arrow(*right('E0'),*left('E3'),color=CORAL))
    s.append(arrow(*bottom('E3'),*topc('S4'),label='entra como respondió',color=CORAL,curve=(B['E3'][0]+B['E3'][2]/2+40,B['S4'][1]-60),lx=B['E3'][0]+B['E3'][2]/2+78,ly=B['E3'][1]+B['E3'][3]+22))
    s.append(arrow(*bottom('S4'),*topc('G5'),color=CORAL))
    s.append(arrow(*topc('G5'),*bottom('S5')))
    s.append(arrow(*bottom('S5'),*topc('G6'),color=CORAL))
    x1,y1=right('G4'); x2,y2=left('G5'); s.append(arrow(x1,y1,x2,y2,label='si contesta',color=CORAL,lx=(x1+x2)/2,ly=B['G4'][1]+B['G4'][3]+16))
    # G4 -> S6 (sin respuesta -> dormido)
    x1,y1=topc('G4'); x6,y6=bottom('S6'); ym=(B['S4'][1]+B['S4'][3]+B['G4'][1])/2
    s.append(f'<path d="M{x1+40},{y1} L{x1+40},{ym} L{x6},{ym} L{x6},{y6+2}" fill="none" stroke="{TEAL}" stroke-width="2.2" stroke-dasharray="6,5" marker-end="url(#ah-teal)"/>')
    s.append(f'<rect x="{x6-62}" y="{ym-9}" width="72" height="16" rx="4" fill="#fff"/><text x="{x6-26}" y="{ym+3}" text-anchor="middle" font-size="10.5" font-weight="700" fill="{TEAL}">→ dormido</text>')
    # S6 loop back to S2 (otro ángulo)
    x1,y1=topc('S6'); x2,y2=topc('S2')
    s.append(f'<path d="M{x1},{y1} C{x1},{y1-60} {x2},{y2-60} {x2+30},{y2}" fill="none" stroke="{TEAL}" stroke-width="2" stroke-dasharray="6,5" marker-end="url(#ah-teal)"/>')
    mx=x2+150; my=y1-50
    s.append(f'<rect x="{mx-92}" y="{my-10}" width="184" height="16" rx="4" fill="#fff"/><text x="{mx}" y="{my+2}" text-anchor="middle" font-size="10.5" font-weight="700" fill="{TEAL}">a los 90 días, otro ángulo</text>')
    s.append('</svg>')
    return '\n'.join(s)

# ---------- Página 3: estados ----------
def page3():
    s=[f'<svg viewBox="0 0 1043 285" width="1043" height="285" font-family="Montserrat, sans-serif">',DEFS]
    chain=[('por_verificar','sin confirmar'),('por_identificar_decisor','calza, falta nombre'),('por_contactar','COLA DE GABRIEL'),('contactado','fecha en el CSV'),('respondio','cualquier respuesta'),('reunion_agendada','fecha en notas'),('propuesta_enviada','fecha y monto'),('cerrado_ganado','')]
    n=len(chain); gap=12; w=(1043-gap*(n-1))/n; y=22; h=74
    pos={}
    for i,(k,d) in enumerate(chain):
        x=i*(w+gap); pos[k]=(x,y,w,h)
        fill='#fff'; stroke=TEAL; tc=DARK
        if k=='por_contactar': fill=CORAL; stroke=CORAL; tc='#fff'
        if k=='cerrado_ganado': fill=TEAL; tc='#fff'
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}" stroke="{stroke}" stroke-width="2"/>')
        us=[i for i,ch in enumerate(k) if ch=='_']; cut=min(us,key=lambda i:abs(i-len(k)/2)) if us else 0
        parts=[k] if len(k)<=16 else [k[:cut+1], k[cut+1:]]
        for j,pt in enumerate(parts):
            s.append(f'<text x="{x+w/2}" y="{y+(26 if len(parts)==1 else 22)+j*13}" text-anchor="middle" font-size="10" font-weight="800" fill="{tc}" font-family="monospace">{pt}</text>')
        if d: s.append(f'<text x="{x+w/2}" y="{y+(48 if len(parts)==1 else 56)}" text-anchor="middle" font-size="9" fill="{tc}" opacity=".9">{esc(d)}</text>')
        if i<n-1: s.append(arrow(x+w,y+h/2,x+w+gap-1,y+h/2))
    # ramas
    def under(k,label,desc,dy=88,color=CORAL):
        x,y0,w,h=pos[k]; s.append(arrow(x+w/2,y0+h,x+w/2,y0+dy-2,color=color))
        s.append(f'<rect x="{x}" y="{y0+dy}" width="{w}" height="56" rx="9" fill="#fff" stroke="{color}" stroke-width="2"/>')
        s.append(f'<text x="{x+w/2}" y="{y0+dy+24}" text-anchor="middle" font-size="10" font-weight="800" fill="{DARK}" font-family="monospace">{label}</text>')
        s.append(f'<text x="{x+w/2}" y="{y0+dy+41}" text-anchor="middle" font-size="9" fill="{DARK}">{esc(desc)}</text>')
        return x+w/2,y0+dy+56
    bx,by=under('contactado','sin_respuesta','tras día 4 y día 10')
    x,y0,w,h=pos['contactado']
    s.append(arrow(bx,by,bx,by+28,color=CORAL))
    s.append(f'<rect x="{x}" y="{by+30}" width="{w}" height="56" rx="9" fill="#f6fbfb" stroke="{TEAL}" stroke-width="2" stroke-dasharray="6,5"/>')
    s.append(f'<text x="{x+w/2}" y="{by+54}" text-anchor="middle" font-size="10" font-weight="800" fill="{DARK}" font-family="monospace">dormido</text>')
    s.append(f'<text x="{x+w/2}" y="{by+71}" text-anchor="middle" font-size="9" fill="{DARK}">90 días · otro ángulo</text>')
    under('propuesta_enviada','cerrado_perdido','motivo en notas')
    under('por_verificar','descartada_*','icp · sin fuente',color=GREY)
    bx2,by2=under('respondio','entrantes','web · IG · correo',color=CORAL)
    s.append('</svg>')
    return '\n'.join(s)

CSS=f'''
@font-face {{ font-family:'Montserrat'; font-weight:400 800; src:url('../situ/fonts/montserrat.woff2') format('woff2'); }}
@page {{ size: A4 landscape; margin:0; }}
* {{ box-sizing:border-box; margin:0; padding:0; }}
body {{ font-family:Montserrat,sans-serif; color:{DARK}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }}
.page {{ width:297mm; height:210mm; padding:10mm 11mm 9mm; page-break-after:always; position:relative; background:#fff; overflow:hidden; }}
.page:last-child {{ page-break-after:auto; }}
.hd {{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid {CORAL}; padding-bottom:2.5mm; margin-bottom:4mm; }}
.hd .k {{ font-size:8.5pt; letter-spacing:.18em; text-transform:uppercase; color:{GREY}; font-weight:700; margin-bottom:1.5mm; }}
.hd h1 {{ font-size:19pt; color:{TEAL}; font-weight:800; line-height:1.1; }}
.hd p {{ font-size:9.5pt; color:{GREY}; margin-top:1mm; }}
.hd img {{ height:14mm; }}
.foot {{ position:absolute; bottom:5mm; left:11mm; right:11mm; display:flex; justify-content:space-between; font-size:8pt; color:{GREY}; }}
/* semana */
.week {{ display:grid; grid-template-columns:34mm repeat(5,1fr); gap:2.5mm; }}
.week .day {{ background:{TEAL}; color:#fff; border-radius:6px; padding:2.5mm; text-align:center; font-weight:800; font-size:11pt; }}
.week .day small {{ display:block; font-weight:500; font-size:8pt; opacity:.9; margin-top:.5mm; }}
.week .lane {{ background:{DARK}; color:#fff; border-radius:6px; padding:2.5mm; font-weight:800; font-size:9.5pt; display:flex; align-items:center; }}
.week .lane.s {{ background:{TEAL}; }} .week .lane.g {{ background:{CORAL}; }}
.week .c {{ border:1.5px solid {LIGHT}; border-radius:6px; padding:2mm 2.5mm; font-size:8.6pt; line-height:1.3; min-height:18mm; background:#fff; }}
.week .c.auto {{ border-color:{DARK}; background:#f3f6f6; }} .week .c.s {{ border-color:{TEAL}; }} .week .c.g {{ border-color:{CORAL}; background:#fff8f8; }}
.week .c b {{ display:block; margin-bottom:1mm; }} .week .c .t {{ color:{GREY}; font-size:8pt; font-weight:700; }}
.week .c.empty {{ border-style:dashed; color:#b7c9c9; display:flex; align-items:center; justify-content:center; font-size:8.5pt; }}
.funnel {{ display:flex; gap:0; margin-top:4mm; align-items:stretch; }}
.funnel div {{ flex:1; background:{LIGHT}; padding:2.5mm 4mm 2.5mm 8mm; clip-path:polygon(0 0,calc(100% - 6mm) 0,100% 50%,calc(100% - 6mm) 100%,0 100%,6mm 50%); text-align:center; }}
.funnel div:first-child {{ clip-path:polygon(0 0,calc(100% - 6mm) 0,100% 50%,calc(100% - 6mm) 100%,0 100%); }}
.funnel div:nth-child(odd) {{ background:#d6ecec; }}
.funnel b {{ display:block; font-size:14pt; color:{TEAL}; }} .funnel span {{ font-size:8.5pt; color:{GREY}; }}
/* reglas */
.rules {{ display:grid; grid-template-columns:repeat(4,1fr); gap:2.5mm; margin-bottom:3.5mm; }}
.rule {{ border-left:4px solid {CORAL}; background:#fff7f7; border-radius:0 6px 6px 0; padding:2.2mm 3mm; font-size:8.5pt; line-height:1.3; }}
.rule b {{ display:block; color:{DARK}; margin-bottom:1mm; font-size:9.5pt; }}
.two {{ display:grid; grid-template-columns:1.15fr 1fr; gap:6mm; }}
h2 {{ font-size:11.5pt; color:{TEAL}; font-weight:800; margin-bottom:2mm; }}
table {{ width:100%; border-collapse:collapse; font-size:8.2pt; }}
th {{ background:{TEAL}; color:#fff; text-align:left; padding:1.5mm 2.5mm; font-size:8.3pt; }}
td {{ padding:0.9mm 2.5mm; border-bottom:1px solid {LIGHT}; vertical-align:top; }}
td code {{ font-family:monospace; font-size:8.5pt; color:{TEAL}; font-weight:700; }}
.steps {{ display:flex; gap:2mm; margin-top:3mm; }}
.steps div {{ flex:1; border:1.5px solid {TEAL}; border-radius:6px; padding:2mm 2.5mm; font-size:8.3pt; line-height:1.3; }}
.steps div b {{ display:block; color:{TEAL}; font-size:10pt; margin-bottom:1mm; }}
.legend {{ display:flex; gap:5mm; font-size:8.5pt; color:{GREY}; margin-top:2mm; }}
.legend i {{ display:inline-block; width:3.5mm; height:3.5mm; border-radius:1mm; vertical-align:middle; margin-right:1.5mm; }}
'''

def page2():
    def c(cls,title,body,t=None):
        tt=f'<div class="t">{esc(t)}</div>' if t else ''
        return f'<div class="c {cls}"><b>{esc(title)}</b>{esc(body)}{tt}</div>'
    e='<div class="c empty">—</div>'
    days=[('Lunes','abastecer'),('Martes','contactar'),('Miércoles','preparar'),('Jueves','seguir'),('Viernes','cerrar y medir')]
    g='<div class="week"><div></div>'+''.join(f'<div class="day">{d}<small>{s}</small></div>' for d,s in days)
    g+='<div class="lane">AUTOMÁTICO</div>'+c('auto','Rutina 10:00','Busca 8-10 empresas nuevas con otro ángulo, verifica, carga al CSV y al pipeline como B, manda resumen.','sin intervención')+e+e+e+e
    g+='<div class="lane s">ASISTENTE</div>'+c('s','Lote de la semana','10 en por_contactar con mensaje por canal. 5 A + 5 B. Si faltan, busca decisores; no baja la vara.','30 min')+c('s','A demanda','Mueve a contactado lo que Gabriel reporte. Responde dudas de tono.','10 min')+c('s','Preparar lo que respondió','Redes: auditoría express (8 min). Automatización: mapa del proceso visto desde afuera + pregunta de diagnóstico.','por respuesta')+c('s','Entrantes','Mensaje listo para pegar en minutos cuando llega un pantallazo. Cualquier día.','< 2 h')+c('s','Propuesta y registro','Propuesta el mismo día de la reunión. Registro semanal. Dormidos a 90 días.','30 min')
    g+='<div class="lane g">GABRIEL</div>'+c('g','Aprobar el lote','Lee los 10 mensajes, corrige tono, descarta la que no cierre.','20 min')+c('g','Enviar a mano','WhatsApp 10:00-13:00 · email 9:00-11:00 (+ invitación LinkedIn) · llamada para pedir correo. Reporta: "contacté a X, Y, Z".','60-90 min')+c('g','Responder','Lo que contestó: una línea si es no; agendar si es sí. Anota la objeción.','15 min')+c('g','Seguimiento día 4 y día 10','Una línea nueva, no el mismo mensaje. Reuniones de 30 min jue/vie.','30 min')+c('g','Reunión → decisión','Reunión, aprobar propuesta, marcar ganado/perdido con motivo. Elegir ángulo del lunes.','30 min + reuniones')
    g+='</div>'
    f='<div class="funnel"><div><b>10</b><span>contactos en frío + todos los entrantes</span></div><div><b>3</b><span>respuestas</span></div><div><b>1-2</b><span>reuniones</span></div><div><b>1</b><span>propuesta</span></div><div><b>1 / mes</b><span>cierre (meta inicial)</span></div></div>'
    leg=f'<div class="legend"><span><i style="background:{DARK}"></i>automático</span><span><i style="background:{TEAL}"></i>asistente</span><span><i style="background:{CORAL}"></i>Gabriel</span><span>Horario Chile. La meta se recalibra con 4 semanas de datos reales.</span></div>'
    return g+f+leg

def page4():
    rules=[('Verificar antes de escribir','Lo que no se vio con los propios ojos no se afirma. Un dato inventado cuesta la cuenta (lección Auditron).'),
           ('El clic de enviar es de Gabriel','Se automatiza buscar, verificar, redactar y registrar. Nunca el envío por LinkedIn, Instagram o WhatsApp.'),
           ('Precios solo en reunión o propuesta','En frío y en el primer mensaje a un entrante, nunca. Excepción: los planes públicos de la web si insisten.'),
           ('Día 4, día 10, y se deja','Volver a los 90 días con otro ángulo es válido. Escribir cinco veces, no.'),
           ('Lo que no gestionamos se cobra','LinkedIn, grabación presencial, Google Ads. La propuesta no regala servicios.'),
           ('Responder lo que pidieron, en su orden','Si pidieron 9 puntos, son 9. Propuesta con 2 opciones máximo, neto + IVA, sin permanencia.'),
           ('Un entrante vale cinco fríos','Respuesta antes de 2 horas, una sola meta: agendar. Todo entrante se registra, prospere o no.'),
           ('Nada de clientes sin preguntar','No se tocan automatizaciones de clientes ni se gastan créditos de Apollo sin aviso.')]
    r='<div class="rules">'+''.join(f'<div class="rule"><b>{esc(a)}</b>{esc(b)}</div>' for a,b in rules)+'</div>'
    steps=[('1 · Verificar','¿Empresa real? ¿Web o fuente pública? ¿Equipo? ¿Ya usa IA o agenda real? → descartada_icp'),('2 · Decisor','Nombre + cargo + dónde se vio. Sin nombre no se escribe.'),('3 · Canal','Inmobiliaria → WhatsApp · legal/contable/RR.HH. → email + LinkedIn · estudio chico → llamada'),('4 · Mensaje','Quién soy · qué vi en SU web · qué suele costar · qué hacemos · una pregunta fácil. ≤ 6 líneas, sin precio.'),('5 · Registrar','Fila completa en el pipeline, estado por_contactar.')]
    st='<h2>Un prospecto en frío, de principio a fin (15 minutos del asistente)</h2><div class="steps">'+''.join(f'<div><b>{esc(a)}</b>{esc(b)}</div>' for a,b in steps)+'</div>'
    phr=[('lote de la semana','10 en por_contactar, mensajes por canal, 5 A + 5 B'),('contacté a X, Y, Z','Mueve a contactado con fecha de hoy'),('respondió X: [texto]','Clasifica, propone respuesta, prepara auditoría'),('auditoría express @cuenta','3 observaciones para abrir la reunión'),('responde este lead','Mensaje listo para pegar, con horarios'),('propuesta para X','Carpeta propia con PDF y correo (estándar situ/)'),('registra','Pipeline y registro semanal al día'),('números de la semana','Tabla + lectura de qué cambiar'),('la rutina que busque [X]','Cambia el ángulo del lunes')]
    t='<h2>Frases que disparan cada tarea</h2><table><tr><th>Dices</th><th>El asistente hace</th></tr>'+''.join(f'<tr><td><code>{esc(a)}</code></td><td>{esc(b)}</td></tr>' for a,b in phr)+'</table>'
    files=[('00-workflow-prospeccion.md','este flujo, en texto'),('pipeline-automatizacion.csv','74 empresas, un estado por fila'),('mensajes-por-canal.md','mensajes listos por canal'),('03-auditoria-express.md','las 5 secciones de la auditoría'),('04-seguimiento-y-objeciones.md','qué decir cuando responden'),('propuesta/ · situ/','generador y plantilla a medida'),('registro-semanal.md','los números, cada viernes')]
    fl='<h2>Dónde vive cada pieza</h2><table><tr><th>Archivo</th><th>Para qué</th></tr>'+''.join(f'<tr><td><code>{esc(a)}</code></td><td>{esc(b)}</td></tr>' for a,b in files)+'</table>'
    return r+st+f'<div class="two" style="margin-top:3.5mm"><div>{t}</div><div>{fl}</div></div>'

def states_table():
    rows=[('por_verificar','entró a la lista, pero el sitio no se pudo leer o falta confirmar equipo','asistente'),('por_confirmar_tamano · por_confirmar_decisor','verificada; falta saber si tiene equipo o quién decide','asistente (LinkedIn, búsqueda)'),('por_identificar_decisor','calza con el ICP; falta nombre y cargo','asistente'),('por_contactar','decisor, canal y mensaje listos. La cola de trabajo de Gabriel','asistente deja · Gabriel saca'),('contactado','mensaje 1 enviado; fecha en fecha_contacto','Gabriel, al enviar'),('sin_respuesta','día 4 y día 10 enviados, nada','Gabriel'),('dormido','descansa 90 días; vuelve a por_contactar con otro ángulo','asistente, el viernes'),('respondio','cualquier respuesta, incluso "no ahora". Los entrantes entran aquí','Gabriel'),('reunion_agendada','fecha en notas','Gabriel'),('propuesta_enviada','fecha y monto en notas','asistente, al enviar'),('cerrado_ganado · cerrado_perdido','motivo en notas; lo perdido dice qué objeción no supimos responder','Gabriel'),('descartada_icp · descartada_sin_fuente','no calza o no se pudo verificar; no se borra, evita reencontrarla','asistente')]
    return '<table style="margin-top:2mm"><tr><th style="width:30%">Estado</th><th>Significa</th><th style="width:22%">Lo mueve</th></tr>'+''.join(f'<tr><td><code>{esc(a)}</code></td><td>{esc(b)}</td><td>{esc(c)}</td></tr>' for a,b,c in rows)+'</table>'

foot='<div class="foot"><span>Influence Chile · prospección redes + automatización · versión 12-oct-2026</span><span>Fuente: prospeccion-ventas/00-workflow-prospeccion.md</span></div>'
pages=[
 header('El flujo completo, por carriles','Dos fuentes (frío y entrantes), tres responsables, un solo pipeline. Teal = asistente · coral = Gabriel · oscuro = automático. Línea punteada = reciclaje.',1)+page1()+foot,
 header('La semana, día por día','Horario Chile. Cada tarjeta dice qué se hace, quién y cuánto toma. Abajo, la meta semanal mientras no haya datos reales.',2)+page2()+foot,
 header('Estados del pipeline','Cada empresa está en exactamente un estado. Solo avanza; si retrocede, se anota por qué en notas. Coral = cola de trabajo de Gabriel.',3)+page3()+states_table()+foot,
 header('Reglas, el prospecto paso a paso y cómo pedir','Lo que no se negocia, el proceso de 15 minutos por empresa, y las frases que disparan cada tarea del asistente.',4)+page4()+foot,
]
doc='<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Workflow de prospección · Influence Chile</title><style>'+CSS+'</style></head><body>'+''.join(f'<section class="page">{p}</section>' for p in pages)+'</body></html>'
open('prospeccion-ventas/workflow/workflow-prospeccion.html','w',encoding='utf-8').write(doc)
print('html ok', len(doc))
