# Influence Fit — Vertical fitness de Influence Chile

Herramientas para lanzar y operar la vertical de agencia para coaches, gimnasios boutique y
profesionales del movimiento. Implementa las tareas T1–T6 del brief estratégico
(`brief-influence-fit.md`). La T7 (programación asistida) **no se construye** hasta cumplir
los criterios de la sección 8 del brief: 10 coaches pagando ≥ 2 meses, 5 pidiendo herramienta,
flujo documentado sin Gabriel y diferencial claro frente a TrueCoach / Trainerize / Hevy / Harbiz.

## Qué hay acá

| Carpeta | Tarea | Qué es | Estado |
|---|---|---|---|
| [landing/](landing/) | T1 | Página única "Influence Fit" con formulario de diagnóstico → webhook → WhatsApp | Lista para publicar |
| [onboarding/](onboarding/) | T2 | Ficha de onboarding para clientes de coaches (5 pasos) → JSON + Google Sheets | Lista |
| [agente-whatsapp/](agente-whatsapp/) | T3 | Prompt del agente, FAQ por coach, reglas de calificación, agendador en Google Calendar | Lista |
| [retencion/](retencion/) | T4 | Secuencia de check-ins (sem 2, 6, 10, mes 3), automatización diaria, encuesta mes 3 | Lista |
| [propuesta/](propuesta/) | T5 | Generador de propuesta + contrato + consentimiento informado desde un YAML | Lista |
| [reporte-mensual/](reporte-mensual/) | T6 | Reporte PDF/HTML desde export de Meta Ads + CRM con los KPI de la sección 6 | Lista |
| [lib/](lib/) | — | Utilidades compartidas (YAML, CLP, HTML → PDF) | — |

Requisitos: Node 18+. Una sola vez: `cd influence-fit && npm install`.
Para PDF: Chrome instalado (se detecta solo) o `npm run pdf:instalar` (Playwright).

---

## T1 · Landing

`landing/index.html` es estática: HTML, CSS y JS en un archivo. Español de Chile, responsive, Montserrat
y la paleta de Influence Chile (teal `#12959C`, coral `#FF7B7B`).

Secciones: hero con promesa · 3 dolores · escalera Niveles 1–3 (+ Nivel 0 gratis) · caso propio ·
5 cupos fundadores con garantía · formulario de diagnóstico · FAQ · botón flotante de WhatsApp.

**Antes de publicar, editar en el `<script>` del final:**
1. `CONFIG.WEBHOOK_URL`: URL del webhook de Make ("Webhooks > Custom webhook") o de SendPulse
   (Automation 360 > Evento externo). El JSON que llega tiene: `nombre, whatsapp (569XXXXXXXX), tipo,
   clientes, instagram, dolor, comuna, nivel, mensaje, origen, pagina, fecha, utm_*`.
   En Make: Webhook → WhatsApp (SendPulse o Business API) a Gabriel → fila en Google Sheets / CRM.
   Si queda vacío, el formulario abre WhatsApp con el resumen ya escrito (funciona igual, sin registro).
2. `CONFIG.WHATSAPP`: número de Gabriel (viene `56965450723`).
3. Las 4 cifras del bloque "Prueba viva" (`data-value=…`) con los números reales de los canales propios.
   Están en "—" a propósito: no publicar cifras inventadas.
4. `data-cupos-tomados` en la sección fundadores: cuántos cupos ya se vendieron (0–5).
5. Pegar el píxel de Meta donde indica el comentario final; el evento `Lead` ya se dispara.

**Publicar:** arrastrar la carpeta `landing/` a Netlify Drop, o `vercel landing` / `netlify deploy --dir=landing`.
Local: `npm run landing` → http://localhost:5560.

## T2 · Onboarding

`onboarding/index.html`: 5 pasos (datos, objetivo/experiencia, lesiones/salud, disponibilidad/equipamiento,
preferencias). Guarda borrador en el navegador; al enviar produce el JSON de `schema.json`, lo manda al
webhook y, si no hay webhook, lo deja descargable y abre WhatsApp del coach.

**Instalar por coach:**
1. Google Sheets nueva → Extensiones > Apps Script → pegar `apps-script.gs` → poner `SHEET_ID` →
   Implementar como aplicación web (ejecutar como yo, acceso: cualquiera) → copiar URL `/exec`.
2. En `index.html`: `CONFIG.WEBHOOK_URL` = esa URL y agregar el coach en `CONFIG.COACHES` (`slug: {nombre, whatsapp}`).
3. Link para mandar por WhatsApp: `https://TU-DOMINIO/onboarding/?coach=slug&nombre=Camila`
   Versión embebida: `<iframe src="https://TU-DOMINIO/onboarding/?coach=slug&embed=1" style="width:100%;height:900px;border:0"></iframe>`

El Apps Script crea una pestaña por coach con las columnas de `schema.json`, y opcionalmente avisa por correo.
Para Airtable: reemplazar el webhook por un escenario de Make (Webhook → Airtable "Create record") con el mismo JSON.

## T3 · Agente de WhatsApp

- `prompt-agente.md`: prompt de sistema con placeholders, flujo recomendado en SendPulse, variables y etapas del CRM.
- `faq.json`: datos de un coach (servicios, precios, FAQ). **Los valores incluidos son de ejemplo**; editar por cada cliente.
- `node armar-prompt.js faq.json` → `prompt-<coach>.txt` listo para pegar en el bloque IA de SendPulse.
- `calificacion.md`: puntaje 0–12 en objetivo, disponibilidad, urgencia y presupuesto → A/B/C y qué hace cada uno.
- `agendar-evaluacion.gs`: Apps Script que entrega horarios libres (`GET ?action=slots`) y crea la evaluación en
  Google Calendar (`POST`), registra en Sheets y avisa al coach. Configurar `CONFIG.HORARIOS` con la ventana
  de atención del coach. Su URL `/exec` es el `{{WEBHOOK_URL}}` del prompt.

## T4 · Retención

- `secuencia.md`: los mensajes (día 0, 14, 42, 70, 84, 90 + inactividad) en tono de coach, con empujones a 48 h.
- `secuencia.json`: lo mismo en formato máquina.
- `retencion.gs`: Apps Script con disparador diario. Lee la pestaña **Clientes** (`nombre, whatsapp, fecha_inicio,
  meta, estado, ultima_sesion, ultima_respuesta`) y, según los días transcurridos:
  - **modo manual** (por defecto): deja cada mensaje en "Pendientes hoy" con un link `wa.me` ya escrito. El coach
    manda todo en 2 minutos. Sin API, sin plantillas, sin costo.
  - **modo sendpulse**: envía solo con la API de WhatsApp de SendPulse usando una plantilla aprobada
    (`checkin_coach` con un parámetro). Requiere `CLIENT_ID`, `CLIENT_SECRET` y `BOT_ID`.
  El check-in de semana 6 siempre queda en Pendientes porque lleva un dato real de progreso que escribe el coach.
  Ejecutar `instalar()` una vez.
- `encuesta-mes-3.html`: 5 preguntas (cercanía a la meta, NPS, qué sirvió, qué cambiar, ¿seguimos?). Envía al
  `doPost` de `retencion.gs`, que guarda la respuesta y marca `renovado` si dijo que sí.

## T5 · Propuesta y contrato

```bash
npm run propuesta                            # usa propuesta/cliente.yaml
node propuesta/generar.js otro.yaml          # otro prospecto
node propuesta/generar.js --consentimiento   # además el consentimiento informado para los clientes del coach
```
Sale en `propuesta/salida/`: `propuesta-<slug>.html/.pdf` (5 páginas: portada, hallazgos, escalera, plan, inversión)
y `contrato-<slug>.html/.pdf` relleno desde `plantillas/contrato-servicios.md`.

Campos clave del YAML: `nivel` (1/2/3), `complejidad` (baja/media/alta → fija el precio dentro del rango del brief),
`fundador` (incluye Nivel 1 gratis y cláusula de garantía), `medios_mensual`, `diagnostico` (3 hallazgos),
`porque_este_nivel`, `inicio`, `duracion_meses`.

Precios y entregables de cada nivel están en `NIVELES` dentro de `generar.js`; datos de la agencia en `AGENCIA`
(**falta el RUT real de Influence Chile SpA**). Las plantillas legales son borradores: revisar con abogado antes del primer uso.

## T6 · Reporte mensual

```bash
npm run reporte                                   # usa reporte-mensual/cliente.yaml
node reporte-mensual/generar-reporte.js otro.yaml
```
Entradas:
- `datos/meta-ads.csv`: export de Meta Ads Manager (Informes → Exportar → CSV), con desglose por día o por campaña.
  Los nombres de columna se mapean en `columnas_meta` del YAML (acepta español e inglés).
- `datos/crm.csv`: export del CRM de SendPulse o de la hoja de leads: `fecha, nombre, origen, calificacion, estado, valor`.
  Qué estados cuentan como "agendada", "realizada", "cliente" y "perdido" se define en `estados`.
- KPIs que no salen de ningún sistema (horas de administración, renovación mes 3/6, piezas publicadas) van en `manual`.

Sale `salida/reporte-<cliente>-<mes>.html/.pdf` (3 páginas): KPIs con meta y variación vs. mes anterior,
embudo lead → agendada → realizada → cliente, leads por semana y por calificación, tabla por campaña y por
origen, retención y próximos pasos. Los datos incluidos son de ejemplo.

---

## Orden de implementación (plan 90 días del brief)

| Semana | Qué hacer con esto |
|---|---|
| 1–2 | Publicar landing con webhook real · instalar onboarding y agente para los canales propios de Gabriel · 30 DM con el guion de la sección 5 |
| 3–4 | Diagnósticos con `prospeccion-ventas/03-auditoria-express.md` · propuestas con `npm run propuesta` · 2 cierres fundadores |
| 5–8 | Onboarding de clientes (T2 + T3 por coach) · campañas · primer `npm run reporte` |
| 9–12 | Retención activa (T4) · caso de estudio con el reporte del mes 2 · llenar los 5 cupos |

## Marca y piezas para redes

`marca/` tiene la identidad completa: `identidad.md` (cualidades, logo, color, tipografía, voz, fotografía,
lo que no se hace), el logo en `marca/logo/` (SVG y PNG: isotipo, horizontal, inverso, vertical, monocromo)
y las plantillas de anuncios, feed e historias en `marca/graficas/plantillas/`.

```bash
node marca/graficas/build.js          # todas las piezas → marca/graficas/png/
node marca/graficas/build.js story    # solo las historias
```
Para cambiar textos se edita el HTML. Para poner fotos reales, dejar el archivo en `marca/graficas/fotos/`
y referenciarlo en el `style="background-image:url(...)"` del bloque `.foto`.
