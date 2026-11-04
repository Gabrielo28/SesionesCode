# Genera envios/cola-envio.html (página para el teléfono) desde los mismos datos que generar_cola.py
import importlib.util, io, contextlib, json, os, re, datetime
HERE=os.path.dirname(os.path.abspath(__file__))
spec=importlib.util.spec_from_file_location('g',os.path.join(HERE,'generar_cola.py')); g=importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(g)
order=sorted(g.items,key=lambda it: it['b'])
data=[]
for n,it in enumerate(order,1):
    p=it['pipe'] or {}
    msgs=[]
    for lb,bk in zip(it['labels'],it['blocks']):
        kind='asunto' if lb.startswith('Asunto') else ('cuerpo' if lb.startswith('Cuerpo') else 'mensaje')
        msgs.append({'k':kind,'t':bk})
    extra=[x for x in it['pre'] if x.startswith(('Servicio','Es el número'))]
    contacto_alt = p.get('canal','') if not (it['phone'] or it['mail']) else ''
    data.append({'n':n,'b':it['b'],'name':it['name'],'pr':it['pr'],'canal':it['canal'],
        'rubro':p.get('rubro',''),'ciudad':p.get('ciudad',''),'phone':it['phone'] or '',
        'fijo':(it['fijo'] if it['fijo'] and not it['fijo'].startswith('+56 9') else ''),
        'mail':it['mail'] or '','alt':contacto_alt,'web':p.get('web',''),'note':it['note'],
        'gap':p.get('gap_verificado',''),'video':g.VIDEOS[it['video']],'oferta':p.get('solucion_sugerida',''),'extra':extra,'msgs':msgs})
txt='\n'.join(g.src)
def grab(pat):
    m=re.search(pat,txt,re.S); return m.group(1).strip() if m else ''
seg=[('WhatsApp · día 4',grab(r'\*\*WhatsApp, día 4\*\*\n```\n(.+?)\n```')),('WhatsApp · día 10',grab(r'\*\*WhatsApp, día 10\*\*\n```\n(.+?)\n```')),
     ('Correo · día 4',grab(r'\*\*Email, día 4\*\*[^\n]*\n```\n(.+?)\n```')),('Correo · día 10',grab(r'\*\*Email, día 10\*\*\n```\n(.+?)\n```'))]
guion=grab(r'\*\*Guion \(se dice, no se copia\)\*\*\n(.+?)\n')
inv=grab(r'\*\*Invitación \(máximo 300 caracteres\), para todas\.\*\*[^\n]*\n```\n(.+?)\n```')
TIT={1:'Prioridad A · WhatsApp',2:'Prioridad A · Correo',3:'Prioridad A · Llamada o LinkedIn',4:'Prioridad B · Persona identificada',5:'Prioridad B · Ubicar a quién escribir',6:'No enviar todavía'}
from collections import Counter
vc=Counter(it['video'] for it in order if it['b']!=6)
vids=[[g.VIDEOS[k],vc.get(k,0)] for k in sorted(g.VIDEOS)]
payload=json.dumps({'items':data,'vids':vids,'seg':seg,'guion':guion,'inv':inv,'tit':TIT,'fecha':datetime.date.today().strftime('%d-%m-%Y')},ensure_ascii=False).replace('</','<\\/')
html=open(os.path.join(HERE,'plantilla.html'),encoding='utf-8').read().replace('/*DATA*/null',payload)
open(os.path.join(HERE,'cola-envio.html'),'w',encoding='utf-8').write(html)
print('ok',len(data))
