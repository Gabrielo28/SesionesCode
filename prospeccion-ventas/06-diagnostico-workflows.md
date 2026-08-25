# Diagnóstico de Workflows — el arma para vender automatización con IA

Es la versión "operaciones" de la [auditoría express](03-auditoria-express.md). La auditoría mira
redes sociales desde afuera, sin permiso, en 8 minutos. Esta **no se puede hacer desde afuera**:
hay que preguntarle al dueño cómo funciona su negocio por dentro. A cambio, el hallazgo pega más
fuerte porque toca plata y horas perdidas, no likes.

Sirve para dos cosas: **upsell** a clientes de redes que ya confían en ti, y **nueva puerta de
entrada** para PyMEs que no necesitan más contenido pero sí necesitan dejar de operar a mano.

---

## Cuándo se usa

- **Cliente de redes actual** → en la reunión mensual de resultados, después de mostrar métricas:
  "Aparte de esto, ¿cómo manejan hoy [las consultas por WhatsApp / las cotizaciones / los leads
  que llegan por Instagram]?" — la mayoría de las PyME no tiene ese proceso resuelto.
- **Prospecto nuevo sin ángulo de redes** → rubros con operación repetitiva y buen ticket
  (clínicas, inmobiliarias, estudios profesionales, ecommerce con volumen, talleres, agencias de
  viaje) donde el dolor no es "no nos ven", es "no damos abasto".
- **Formulario web** (`diagnostico-workflows.html`) como imán de leads: el prospecto se
  autodiagnostica en 2 minutos y el resultado ya viene calificado para ti.

No reemplaza la auditoría de redes — son dos productos que se ofrecen juntos o por separado.

---

## Las 6 áreas que se revisan (siempre en este orden)

### 1. Atención al cliente
¿Quién responde WhatsApp/Instagram/mail? ¿En horario laboral solo, o también fuera de horario?
¿Cuánto tarda en responder un mensaje nuevo? ¿Se repiten las mismas 5 preguntas todo el día
(precio, horario, ubicación, disponibilidad)?

### 2. Captación y seguimiento de ventas
¿Dónde caen los leads (WhatsApp, formulario web, Instagram, llamada)? ¿Quedan en un chat o van a
algún lado (planilla, CRM, papel)? ¿Alguien vuelve a escribirle al que preguntó y no compró?
¿Cuánto tiempo pasa entre que preguntan y alguien responde con una cotización?

### 3. Agendamiento y reservas
¿Cómo se agenda hoy (llamada, WhatsApp manual, Calendly, papel)? ¿Se pisan horarios? ¿Hay
recordatorio de la cita o dependen de que el cliente se acuerde? ¿Cuántas inasistencias al mes?

### 4. Cotizaciones y documentos
¿Cuánto tiempo toma armar una cotización desde que la piden? ¿Se arma a mano cada vez o hay
plantilla? ¿Quién factura y cómo (manual, sistema, contador externo con delay)?

### 5. Reportería y control
¿Cómo sabe el dueño cómo va el mes — mira un Excel, pregunta al equipo, no lo sabe hasta cierre?
¿Cuánto tiempo se pierde armando ese reporte a mano cada semana/mes?

### 6. Gestión interna
¿Cuántas veces se traspasa la misma información de una persona a otra (de venta a producción,
de recepción a caja)? ¿Hay tareas que hace una persona con estudios/sueldo alto y que son
puramente repetitivas (copiar datos, responder lo mismo, ordenar una planilla)?

---

## Preguntas de la llamada (20 minutos)

No se preguntan las 6 áreas completas — se prioriza. Abrir siempre así:

> "Contame un día normal en la operación: llega un cliente nuevo por WhatsApp, ¿qué pasa desde
> ahí hasta que compra?"

Esa sola pregunta, bien escuchada, revela 3 o 4 cuellos de botella sin tener que interrogar. De
ahí se repregunta puntual en el área que más dolió:

- "¿Cuántas veces al día responden lo mismo?"
- "¿Cuánta gente se pierde entre que pregunta y que compra?"
- "¿Si tuvieran que armar el reporte del mes hoy mismo, cuánto se demoran?"
- "¿Qué tarea odia hacer el equipo porque es puro copiar y pegar?"

**Anota tiempo y frecuencia siempre que puedas** — es lo que después se convierte en el número
que vende ("2 horas diarias" → "40 horas al mes" → "un sueldo completo perdido en tareas que no
requieren pensar").

---

## Matriz de priorización

Cada hallazgo se ubica en dos ejes. Solo se proponen soluciones para lo que cae arriba a la
derecha — ahí está la plata.

```
                    Fácil de resolver          Difícil de resolver
                    (sin cambiar sistemas)     (requiere integrar/migrar)
Impacto alto    →   PRIORIDAD 1                PRIORIDAD 2
(plata/horas        (primera propuesta,        (fase 2, después de
 grandes)            resultado en 2-4 sem.)      ganar confianza)

Impacto bajo    →   PRIORIDAD 3                No se propone
                    (add-on, no abre reunión)   (no vale el esfuerzo hoy)
```

"Impacto alto" = algo que cuesta horas todos los días, o que hace perder ventas directamente
(leads sin seguimiento, cotizaciones lentas). "Fácil" = conectar herramientas que ya usan
(WhatsApp, Instagram, Google Sheets/Calendar) vs. tener que reemplazar un sistema instalado.

---

## Catálogo de soluciones (mapeo dolor → solución)

| Dolor detectado | Solución de IA/automatización | Qué hace |
|---|---|---|
| Responden lo mismo todo el día, fuera de horario nadie contesta | **Agente de WhatsApp/Instagram con IA** | Responde preguntas frecuentes 24/7, deriva a un humano solo cuando hace falta, agenda directo en el chat |
| Leads se pierden, nadie vuelve a escribirle al que no respondió | **Automatización de seguimiento** | Detecta el lead nuevo, lo registra, dispara recordatorios automáticos a los 1, 3 y 7 días si no hay respuesta |
| Cotizaciones lentas, armadas a mano cada vez | **Generador automático de cotizaciones** | Arma y envía la cotización desde una plantilla con los datos del cliente, en minutos en vez de horas |
| Agendamiento manual, se pisan horarios, inasistencias | **Agente de agendamiento** | Ofrece horarios disponibles, confirma, manda recordatorio automático 24h antes |
| El dueño no sabe cómo va el mes sin preguntar/armar Excel | **Dashboard/reporte automático** | Junta los datos que ya existen (ventas, redes, caja) y entrega un resumen semanal sin que nadie lo arme a mano |
| Tareas repetitivas de traspaso de información entre áreas | **Automatización de procesos internos** | Conecta las herramientas que ya usan para que el dato se mueva solo (ej. venta cerrada → entra a producción → avisa a despacho) |

Este catálogo se actualiza a medida que se cierran proyectos — cada solución nueva que se
construye para un cliente entra aquí como oferta repetible para el siguiente.

---

## Formato de entrega

Documento de diagnóstico (PDF/HTML, mismo criterio que la auditoría de redes — se genera con
[`propuesta/generar-diagnostico.js`](propuesta/generar-diagnostico.js)):

```
1. Portada — Diagnóstico de Workflows: [Empresa]

2. Lo que ya funciona bien
   2 puntos reales. Igual que en la auditoría de redes: sin esto se lee como
   crítica y el prospecto se cierra.

3. Los cuellos de botella
   Cada uno: qué pasa hoy → cuánto cuesta (horas/plata) → con qué se resuelve
   Ejemplo: "Cada cotización toma 40 min armarla a mano → son ~13 horas al mes
   solo en cotizar → generador automático la arma en 2 minutos"

4. Soluciones recomendadas, priorizadas
   Prioridad 1 primero (impacto alto + fácil), con qué incluye cada una

5. Los primeros 60-90 días
   Qué se construye mes 1, mes 2, mes 3, en viñetas
   CTA: "¿Lo conversamos? 30 minutos, sin compromiso"
```

---

## Reglas que hacen que funcione

1. **Siempre partir con lo positivo** — mismas reglas que la auditoría de redes: dos cosas
   que ya hacen bien, específicas, antes de tocar los dolores.

2. **Todo hallazgo con número.** "Pierden tiempo cotizando" no vende. "40 minutos por
   cotización, 20 cotizaciones al mes, son 13 horas — más de un día y medio de trabajo
   completo, todos los meses, en algo que un sistema hace en minutos" sí vende.

3. **Traducir horas a plata cuando se pueda.** Horas de una persona con sueldo conocido son
   el argumento más fácil de defender frente al dueño: "esto le cuesta $X al mes hoy, aunque
   nadie lo vea en una factura".

4. **Entregar la solución, no esconderla** — igual que en redes. El diagnóstico dice *qué*
   se necesita; la propuesta comercial es *quién* lo construye y lo mantiene.

5. **Cero precios en el diagnóstico.** El precio va en la reunión, después de que el
   problema esté instalado con números propios del cliente.

6. **No prometer una IA que reemplaza personas.** Se vende tiempo devuelto al equipo, no
   despidos — es el argumento que cierra, y además es verdad: el foco es sacar lo repetitivo,
   no sacar gente.

---

## Cómo escala

El cuestionario web (`diagnostico-workflows.html`) hace el primer filtro sin que tú muevas un
dedo: el prospecto responde, ve su propio resultado al instante, y te llega calificado con las
áreas de dolor ya identificadas. Tu llamada de 20 minutos ya no parte de cero — parte de
confirmar y profundizar lo que el cuestionario detectó. De ahí sale el JSON para el generador
y el diagnóstico se produce en el mismo formato que las propuestas de redes.
