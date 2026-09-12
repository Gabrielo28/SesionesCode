# Investigación de mercado — oportunidades de producto digital

> Rol: investigación continua de problemas reales (pymes, población, mercado) que se puedan
> resolver con una solución digital construida con Claude Code / Codex. Filtro: complejidad
> baja-media salvo que el revenue potencial justifique más esfuerzo.
>
> Última actualización: 12 de septiembre de 2026.

## 1. Marco de evaluación

Cada oportunidad se puntúa en 4 ejes:

| Eje | Qué mide |
|---|---|
| **Dolor** | ¿Es una tarea recurrente, molesta y ligada a plata/tiempo? (no "nice to have") |
| **Complejidad de build** | Bajo = CRUD + WhatsApp/email/pagos con APIs conocidas, 1-3 semanas. Medio = integra 2-3 sistemas externos o requiere IA aplicada. Alto = requiere compliance, infraestructura pesada o red de dos lados (marketplace).|
| **Monetización** | Cómo cobra: suscripción mensual, % por transacción, setup fee, licencia por sede. |
| **Encaje** | Si ya tenemos activos (clientes, código, dominio de conocimiento) que aceleren el build o la venta. |

Se priorizan ideas con **Encaje alto**, porque ya hay canal de venta (clientes actuales de la
agencia) y código reusable.

## 2. Activos que ya tenemos (punto de partida real, no teórico)

- **Tienda Yolé**: catálogo + carrito + Webpay + transferencia + panel admin sin código,
  server Node vanilla. → base reusable para *cualquier* pyme que venda pocos SKUs físicos.
- **Página de marcas/sponsors de Curacaví FC**: cards de patrocinadores editables. → germen de
  un producto de gestión de sponsors para clubes amateurs.
- **Sistema de leads de Influence Chile** (`sistema-leads-influence-chile.html`): tracking de
  prospectos para agencia de contenido. → germen de un mini-CRM vertical.
- **Tracker de contenido** (`tracker-contenido-influence/`): seguimiento de piezas/entregables.
- **Automatización en Make (Integromat)**: embudo real en producción para un cliente —
  anuncio (Meta Ads) → deriva a encuesta → evalúa condición de la respuesta → si cumple, dispara
  un WhatsApp automático al lead. Esto es un activo aparte de los anteriores: no es código propio,
  es know-how de **orquestación con herramientas no-code/low-code** (Make + Meta Ads + WhatsApp),
  que es exactamente el patrón que la investigación de micro-SaaS 2026 identifica como el más
  replicable ("combinar no-code con APIs permite montar en días lo que antes tomaba meses").

Estos activos ya resuelven un problema real para un cliente pagante. La oportunidad más barata
no es "inventar" un producto nuevo, es **empaquetar y generalizar lo que ya funciona** para
venderlo a más clientes del mismo tipo — y ahora eso aplica tanto a código propio (Yolé,
Curacaví, leads) como a flujos de Make (calificación automática de leads).

## 3. Oportunidades priorizadas

### 🟢 Quick wins (complejidad baja, encaje alto — construibles ahora)

**3.1 — Embudo de calificación de leads (Ads → encuesta → condición → WhatsApp) como servicio replicable**
- **Dolor**: negocios que pagan pauta (Meta Ads) reciben leads sin calificar y su equipo de
  ventas pierde horas llamando/escribiendo a gente que no cumple el perfil, o responde tarde y
  el lead se enfría. Esto pasa en casi cualquier rubro con ticket medio-alto: inmobiliarias,
  clínicas dentales/estéticas, cursos y capacitaciones, seguros, colegios, gimnasios.
- **Solución**: ya está construido y funcionando para un cliente en Make — anuncio → encuesta →
  evaluación de condición → WhatsApp automático solo a los leads que califican. La oportunidad es
  **empaquetar ese flujo como plantilla de Make reutilizable** (cambiando solo la encuesta, la
  condición y el mensaje por vertical) y venderlo a otros negocios que ya invierten en Ads pero
  califican leads a mano.
- **Complejidad**: baja — es reconfigurar un escenario de Make ya probado, no construir de cero.
  El esfuerzo real está en levantar los requisitos de calificación de cada cliente nuevo (2-3
  preguntas + condición), no en la automatización en sí.
- **Monetización**: setup fee ($100-250 USD por escenario adaptado) + mensualidad de
  mantenimiento ($30-50 USD, o incluida en el retainer de marketing si es cliente de la agencia).
- **Por qué es el más fuerte de esta lista**: es el único ítem con un cliente real ya pagando por
  exactamente este flujo — no hay que validar demanda, solo replicar la venta.

**3.2 — Gestión de patrocinadores para clubes amateurs**
- **Dolor**: clubes de barrio (fútbol, básquetbol) manejan sponsors en WhatsApp y Excel — pierden
  contratos, no saben qué logo va en qué categoría (Main/Gold/Silver), no tienen forma de mostrarle
  al sponsor "esto es lo que generó tu logo" (visitas, clics).
- **Solución**: generalizar la página de marcas de Curacaví FC en un producto: panel donde el
  club sube logo + tier + link, genera la página pública, y un reporte mensual automático
  (visitas, clics) para justificarle la renovación al sponsor.
- **Complejidad**: baja. Ya existe el 70% del código.
- **Monetización**: $15.000–30.000 CLP/mes por club, o setup fee único + hosting.
- **Mercado**: cientos de clubes amateurs de fútbol/básquetbol/rugby en Chile, ligas vecinales,
  clubes de colegio.

**3.3 — "Tienda en una caja" con WhatsApp para pymes de pocos productos**
- **Dolor**: negocios chicos (colchonerías, muebles, ferreterías, indumentaria) toman pedidos por
  Instagram DM/WhatsApp manualmente, sin catálogo online ni cobro con tarjeta.
- **Solución**: empaquetar el motor de Yolé (catálogo editable sin código + Webpay + transferencia
  + admin panel) como plantilla replicable para otros rubros de pocos SKUs.
- **Complejidad**: baja-media (adaptar catálogo/branding por cliente; Webpay ya integrado).
- **Monetización**: setup ($150-300 USD) + mensualidad ($30-60 USD) o % sobre ventas.
- **Riesgo a vigilar**: cada cliente nuevo exige soporte de Webpay/SII — validar cuánto tiempo
  humano consume antes de escalar a muchos clientes.

**3.4 — Mini-CRM de leads para agencias de marketing/influencers chicas**
- **Dolor**: agencias boutique (como Influence Chile) y freelancers de marketing pierden
  seguimiento de prospectos en hojas de cálculo o notas sueltas.
- **Solución**: productizar `sistema-leads-influence-chile.html` — pipeline visual, recordatorios
  de seguimiento, link directo a WhatsApp por lead.
- **Complejidad**: baja. Ya existe el HTML base.
- **Monetización**: $20-40 USD/mes por agencia (mercado de nicho pero fácil de vender vía
  contactos existentes de la agencia).

### 🟡 Media complejidad, revenue mayor

**3.5 — Automatización de WhatsApp Business API para confirmación/cobro de pedidos**
- **Dolor confirmado por la investigación**: "la adopción de WhatsApp en pymes chilenas es
  masiva, pero el uso es básico" — casi todas responden manual, sin recordatorios automáticos
  ni recuperación de carritos abandonados.
- **Solución**: capa de automatización sobre WhatsApp Business API (confirmar pedido, avisar
  despacho, recordar pago pendiente, recuperar carrito) conectada al panel tipo Yolé.
- **Complejidad**: media — requiere integrar WhatsApp Business API (Meta) o un proveedor (Twilio,
  360dialog), manejo de plantillas aprobadas y costos por mensaje.
- **Monetización**: mensualidad + margen sobre mensajes, o tramo por volumen de conversaciones.
- **Por qué vale el esfuerzo extra**: es el problema #1 mencionado explícitamente en la
  investigación de pymes chilenas 2026 — alta disposición a pagar porque toca ventas directas.

*(Nota: 3.1 califica leads antes de la venta vía Ads; esta 3.5 automatiza WhatsApp después de
la venta, dentro del checkout tipo Yolé. Son el mismo canal, dos momentos distintos del embudo —
se pueden vender por separado o como combo "Ads a cobro" a un mismo cliente.)*

**3.6 — Reportería automática simple para pymes sin CRM**
- **Dolor**: 67% de pymes gestiona procesos críticos manualmente (fuente: investigación pymes
  Chile 2026); no tienen visibilidad de ventas/stock sin pagar un ERP caro.
- **Solución**: dashboard liviano que lee las mismas fuentes que ya usan (planilla de pedidos,
  panel tipo Yolé, WhatsApp) y arma un reporte semanal automático (ventas, productos que se
  agotan, clientes que no vuelven).
- **Complejidad**: media (requiere normalizar datos de fuentes distintas).
- **Monetización**: add-on de $15-25 USD/mes sobre el producto base (Yolé-like o CRM).

### 🔴 Vigilar, no construir todavía

- **Marketplace de sponsors ↔ clubes deportivos** (conectar marcas que buscan visibilidad local
  con clubes amateurs): revenue potencial alto (comisión por match), pero complejidad alta
  (red de dos lados, requiere masa crítica de ambos lados antes de tener valor). Vale la pena
  solo después de validar 3.1 con varios clubes reales.
- **ERP/ CRM completo para pymes**: mercado saturado (ya hay decenas de jugadores, ver software
  de gestión para clubes deportivos como ejemplo de categoría madura) — competir de frente
  requiere mucho más que complejidad de build, requiere distribución. Mejor jugar en nichos
  desatendidos (3.1, 3.2, 3.3) que en la categoría genérica.

## 4. Checklist para replicar 3.1 (el embudo de Make) en un cliente nuevo

Lo único que cambia entre clientes es la encuesta, la condición y el mensaje. La estructura del
escenario de Make se copia tal cual. Antes de cotizar o construir, levantar esto con el cliente:

**A. Sobre el anuncio y el lead**
1. ¿Dónde corre la pauta hoy — Meta Ads, TikTok Ads, formulario propio en su web? (define el
   disparador del escenario: Lead Ads de Meta, webhook, Google Sheet, etc.)
2. ¿Cuántos leads reciben por semana hoy sin calificar? (sirve para dimensionar el ahorro de horas
   y justificar el precio frente al cliente).

**B. Sobre la encuesta de calificación**
3. ¿Cuál es el perfil de cliente que **sí** quieren atender? Pedir que lo digan en sus propias
   palabras (ej. "dueños de casa en la RM", "empresas de más de 10 empleados", "mujeres 25-45 con
   presupuesto sobre $X").
4. De ese perfil, ¿qué 2-3 preguntas cerradas (opción múltiple, no texto libre) permiten
   detectarlo? Texto libre complica la evaluación automática de la condición — evitarlo salvo que
   se sume clasificación con IA (eso sube la complejidad, cotizar aparte).
5. ¿Ya tienen una encuesta o formulario armado (Google Forms, Typeform, etc.) o hay que crearlo
   desde cero?

**C. Sobre la condición de calificación**
6. Traducir el perfil del punto 3 en una regla explícita y verificable con las respuestas del
   punto 4 (ej.: "califica si respuesta 1 = Sí Y respuesta 2 ∈ {opción A, opción B}"). Si el
   cliente no puede dar una regla clara, ese es el primer problema a resolver — sin regla clara no
   hay automatización posible.
7. ¿Qué pasa con los leads que **no** califican? (nada, van a una lista para nutrir después, o un
   mensaje distinto). Definirlo evita que se pierdan silenciosamente.

**D. Sobre el WhatsApp automático**
8. ¿Envían desde WhatsApp Business normal, o ya tienen (o están dispuestos a pagar) WhatsApp
   Business API vía un proveedor (Twilio, 360dialog, etc.)? Esto determina si el mensaje puede
   salir 100% automático o necesita un paso semi-manual.
9. Texto del mensaje: debe estar aprobado como plantilla si se usa la API — pedirlo con
   anticipación, la aprobación de Meta puede tardar días.
10. ¿Quién recibe la notificación interna cuando entra un lead calificado (vendedor, dueño)? El
    valor real del embudo es que alguien humano actúe rápido sobre el lead caliente — sin esto el
    automatismo no vende nada.

**E. Entregable y precio**
- Con las respuestas A-D se arma el escenario de Make (clonando el existente) y se cotiza:
  setup fee según cuántas preguntas/condiciones no triviales haya, más mensualidad de
  mantenimiento. Verticales con preguntas simples (2 preguntas, condición binaria) son casi
  copiar-pegar; verticales con reglas más finas (varias condiciones combinadas, distintos mensajes
  según segmento) suben el setup fee proporcionalmente.

## 5. Próximos pasos sugeridos

1. Usar la checklist de la sección 4 con el próximo prospecto que ya invierta en Ads, para
   convertir 3.1 en una oferta concreta (no solo una idea en el papel).
2. Validar 3.2 (sponsors) ofreciéndoselo a 1-2 clubes más además de Curacaví FC, para confirmar
   disposición a pagar antes de invertir en generalizar el código.
3. Si Colchones Yolé pasa a producción real (ver `RESUMEN-PROYECTO.md`), documentar cuánto
   esfuerzo tomó adaptarlo — eso da el costo real de replicar 3.3 para el siguiente cliente.
4. Mantener este documento como registro vivo: cada vez que se investigue un nuevo problema,
   agregarlo acá con el mismo formato (dolor / solución / complejidad / monetización / encaje).

---
*Este documento se actualiza en investigaciones sucesivas — no reemplazar, extender.*
