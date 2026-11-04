# Genera envios/cola-de-envio.md desde mensajes-por-canal.md + pipeline-automatizacion.csv.
# Uso: python3 prospeccion-ventas/envios/generar_cola.py
import re, csv, os, urllib.parse, datetime
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(os.path.join(BASE,'mensajes-por-canal.md'),encoding='utf-8').read().split('\n')
pipe=list(csv.DictReader(open(os.path.join(BASE,'pipeline-automatizacion.csv'),encoding='utf-8')))

def norm(s): return re.sub(r'[^a-z0-9áéíóúñü ]',' ',s.lower())
STOP=set('propiedades propiedad corredora corredores corretaje inmobiliaria inmobiliario consultores consultora consultoría abogados abogado estudio jurídico juridico centro de del la el los las y spa ltda limitada contadores contable contabilidad gestión gestion grupo asociados asesorías asesorias bienes raíces raices administración administracion edificios clínica clinica salud seguros chile cía cia s a sa'.split())
def toks(s): return {t for t in norm(s).split() if t not in STOP and len(t)>1}
def find_pipe(name):
    base=name.split(' — ')[0]
    nb=' '.join(norm(base).split())
    for r in pipe:
        ne=' '.join(norm(r['empresa']).split())
        if ne==nb or ne.startswith(nb) or nb.startswith(ne): return r
    tn=toks(base); best=None; bs=0
    for r in pipe:
        te=toks(r['empresa'])
        sc=len(tn & te)
        if sc>bs: best,bs=r,sc
    return best if bs>0 else None

entries=[]; sec=''; sub=''; cur=None; i=0
SKIP_HDR=('Guion','Invitación','WhatsApp, día','Email, día','Firma')
while i<len(src):
    l=src[i]
    if l.startswith('## '): sec=l[3:]; sub=''; cur=None
    elif l.startswith('### '): sub=l[4:]; cur=None
    elif l.startswith('**') and not any(l.startswith('**'+s) for s in SKIP_HDR) and sec.split(' ')[0] in ('WHATSAPP','EMAIL','LLAMADA','LINKEDIN','NUEVAS','Verificar'):
        cur={'hdr':l,'sec':sec,'sub':sub,'blocks':[],'labels':[],'pre':[]}; entries.append(cur)
    elif l.startswith('```') and cur is not None:
        label=src[i-1].strip() if i>0 else ''
        j=i+1; body=[]
        while j<len(src) and not src[j].startswith('```'): body.append(src[j]); j+=1
        cur['blocks'].append('\n'.join(body)); cur['labels'].append(label); i=j
    elif cur is not None and l.strip() and not l.startswith('---'):
        cur['pre'].append(l.strip())
    i+=1

items=[]
for e in entries:
    h=e['hdr']; name=re.match(r'\*\*(.+?)\*\*',h).group(1)
    if name.startswith('Administración de Edificios Santiago') and not e['blocks']: 
        e['blocks']=None
    note=' '.join(re.findall(r'\*([^*]+)\*',h[len(name)+4:])).strip(' —')
    sec=e['sec']; sub=e['sub']
    has_asunto=any(lb.startswith('Asunto') for lb in e['labels'])
    if sec.startswith('LLAMADA'): canal='llamada'
    elif sec.startswith('LINKEDIN'): canal='linkedin'
    elif sec.startswith('Verificar'): canal='verificar'
    elif has_asunto: canal='email'
    else: canal='whatsapp'
    pr='A' if (re.search(r'prioridad A|Prioridad A',sub) or re.search(r'— A\b|\(A\b|\(A,',h)) else 'B'
    phone=re.search(r'\+56 ?9 ?\d{4} ?\d{4}',h)
    phone=phone.group(0) if phone else None
    fijo=re.search(r'(\+56 \d{1,2} \d{3,4} \d{4}|\(2\) \d{4} \d{4}|\b32 \d{3} \d{4})',h)
    mail=re.search(r'[\w.\-]+@[\w.\-]+\.\w+',h)
    p=find_pipe(name)
    items.append(dict(name=name,hdr=h,note=note,canal=canal,pr=pr,phone=phone,fijo=fijo.group(0) if fijo else None,
        mail=mail.group(0) if mail else None,blocks=e['blocks'] or [],labels=e['labels'],pre=e['pre'],pipe=p))

VIDEOS={1:'Video 1 · Asistente de WhatsApp que responde y agenda',2:'Video 2 · Cotización por WhatsApp',3:'Video 3 · Recordatorios y recepción de documentos',4:'Video 4 · Qué hace Influence (para alianzas)'}
def video(it):
    t=' '.join(it['blocks']).lower()
    if 'complementamos' in t: return 4
    if 'cotización' in t or 'valor del plan' in t: return 2
    if ('recordatorio' in t and ('documentos' in t or 'novedades' in t)) or any(k in t for k in ('candidato','vencimientos','novedades','avisos de pago','deudores')): return 3
    return 1
for _it in items: _it['video']=video(_it)
hold=lambda it: it['canal']=='verificar' or 'verificar antes' in it['hdr'].lower() or 'verificar el sitio' in it['hdr'].lower()
named=lambda it: ' — ' in it['name'] or (it['pipe'] and it['pipe']['estado'] in ('por_contactar',))
def bucket(it):
    if hold(it): return 6
    if it['canal']=='whatsapp' and (it['pr']=='A' or 'candidata a A' in it['hdr']): return 1
    if it['canal']=='email' and it['pr']=='A': return 2
    if it['canal'] in ('llamada','linkedin') and it['pr']=='A': return 3
    if named(it): return 4
    return 5
for it in items: it['b']=bucket(it)
TIT={1:'Bloque 1 · Prioridad A por WhatsApp',2:'Bloque 2 · Prioridad A por correo',3:'Bloque 3 · Prioridad A por llamada o LinkedIn',
     4:'Bloque 4 · Prioridad B con persona identificada',5:'Bloque 5 · Prioridad B (hay que ubicar a quién escribirle)',6:'No enviar todavía · verificar primero'}
CANAL={'whatsapp':'WhatsApp','email':'Correo','llamada':'Llamada y luego correo','linkedin':'LinkedIn','verificar':'Verificar sitio'}
COMO={'whatsapp':'Envíalo de lunes a viernes entre 10:00 y 13:00. Toca el enlace: abre WhatsApp con el mensaje ya escrito. Revisa que esté completo y envía.',
      'email':'Envíalo entre 9:00 y 11:00. El enlace abre tu correo con el asunto y el cuerpo listos. Si la persona tiene LinkedIn, manda la invitación el día anterior.',
      'llamada':'Llama en horario de oficina. Di el guion de la llamada (al inicio de este documento) con el servicio de abajo y pide el correo de quien ve el tema. Después envía el correo.',
      'linkedin':'Envía la invitación de LinkedIn (texto al inicio de este documento). Cuando acepte, envía el mensaje de abajo.',
      'verificar':'Abre el sitio en el navegador antes de escribir.'}
def wa_link(phone,text):
    d=re.sub(r'\D','',phone); return f'https://wa.me/{d}?text={urllib.parse.quote(text)}'
def mailto(addr,subj,body):
    return f'mailto:{addr}?subject={urllib.parse.quote(subj)}&body={urllib.parse.quote(body)}'

out=[]
hoy=datetime.date.today().strftime('%d-%m-%Y')
cnt={b:sum(1 for it in items if it['b']==b) for b in TIT}
out.append(f'''# Cola de envío — uno por uno

Generada el {hoy} desde `mensajes-por-canal.md` y `pipeline-automatizacion.csv`. Para regenerarla:
`python3 prospeccion-ventas/envios/generar_cola.py`

**Cómo usarla:** ve en orden. En cada tarjeta toca el enlace (abre WhatsApp o tu correo con el mensaje
escrito), revisa y envía tú. Marca la casilla y anota la fecha. Al terminar el día, dime
"contacté a X, Y, Z" y los paso a `contactado` en el pipeline.

**Ritmo:** 10 por día como máximo, para que las respuestas te alcancen a atender el mismo día.

**Si dice que sí:** mándale el video que indica su tarjeta (son 4 videos de 2 minutos, uno por tipo
de solución; tienen que estar grabados antes de empezar a enviar). Si después pregunta precio o
quiere avanzar, ahí propones una llamada corta y me mandas su respuesta ("respondió X: …").

**Si no responde:** seguimiento el día 4 y el día 10 (textos abajo). Después, se deja.

| Bloque | Contactos |
|---|---|
''' + '\n'.join(f'| {TIT[b]} | {cnt[b]} |' for b in TIT) + f'\n| **Total** | **{len(items)}** |\n')

# seguimientos
seg_i=None
txt='\n'.join(src)
m=re.search(r'## Seguimientos.*?(?=\n---\n)',txt,re.S)
if m: out.append(m.group(0).replace('## Seguimientos (iguales para todos)','## Seguimientos (día 4 y día 10)')+'\n')
mg=re.search(r'\*\*Guion \(se dice, no se copia\)\*\*\n(.+?)\n',txt)
if mg: out.append('## Guion de llamada\n\n'+mg.group(1)+'\n')
mi=re.search(r'\*\*Invitación \(máximo 300 caracteres\), para todas\.\*\*[^\n]*\n```\n(.+?)\n```',txt,re.S)
if mi: out.append('## Invitación de LinkedIn\n\n```\n'+mi.group(1)+'\n```\n')

n=0
for b in TIT:
    group=[it for it in items if it['b']==b]
    if not group: continue
    out.append(f'\n---\n\n## {TIT[b]}\n')
    for it in group:
        n+=1
        p=it['pipe']
        out.append(f"### {n}. {it['name']}")
        info=[f"**Prioridad {it['pr']}** · **{CANAL[it['canal']]}**"]
        if p: info.append(f"{p['rubro']} · {p['ciudad']}")
        out.append(' · '.join(info)+'  ')
        contacto=[]
        if it['phone']: contacto.append(f"WhatsApp/celular: **{it['phone']}**")
        if it['fijo'] and not it['fijo'].startswith('+56 9'): contacto.append(f"Teléfono: **{it['fijo']}**")
        if it['mail']: contacto.append(f"Correo: **{it['mail']}**")
        if not contacto and p: contacto.append(f"Contacto: {p['canal']}")
        if p and p['web']: contacto.append(f"Web: {p['web']}")
        out.append(' · '.join(contacto)+'\n')
        como=[COMO[it['canal']]]
        if it['note']: como.append('Antes: '+it['note'].rstrip('.')+'.')
        if it['canal']=='whatsapp' and not it['phone']: como.append('No hay número publicado en el texto: abre su web y toca su botón de WhatsApp, luego pega el mensaje.')
        out.append('**Cómo abordarlo:** '+' '.join(como)+'  ')
        if p and p['gap_verificado']: out.append(f"**Lo que vimos de ellos:** {p['gap_verificado']}.  ")
        if p and p['solucion_sugerida']: out.append(f"**Qué les ofreces:** {p['solucion_sugerida']}.  ")
        out.append(f"**Video si dice que sí:** {VIDEOS[it['video']]}.  ")
        for pre in it['pre']:
            if pre.startswith(('Servicio','Es el número','Correo después','Correo si','Mensaje al aceptar')): out.append(pre+'  ')
        out.append('')
        # mensajes
        asunto=None
        for lb,bk in zip(it['labels'],it['blocks']):
            if lb.startswith('Asunto'): asunto=bk; out.append('Asunto:\n```\n'+bk+'\n```')
            elif lb.startswith('Cuerpo'):
                out.append('Cuerpo:\n```\n'+bk+'\n```')
                if it['mail'] and asunto: out.append(f"[✉️ Abrir correo con el mensaje listo]({mailto(it['mail'],asunto,bk)})")
            else:
                out.append('Mensaje:\n```\n'+bk+'\n```')
                if it['canal']=='whatsapp' and it['phone']: out.append(f"[💬 Abrir WhatsApp con el mensaje listo]({wa_link(it['phone'],bk)})")
        if not it['blocks'] and it['canal']!='verificar': out.append('_Usa el mismo correo de la empresa anterior del bloque (Admincondominios)._')
        out.append('\n☐ Enviado el ____ · ☐ Seguimiento día 4 · ☐ Seguimiento día 10\n')
open(os.path.join(BASE,'envios','cola-de-envio.md'),'w',encoding='utf-8').write('\n'.join(out))
print('tarjetas',n,cnt)
sin=[it['name'] for it in items if not it['pipe']]
print('sin match pipeline:',sin)
