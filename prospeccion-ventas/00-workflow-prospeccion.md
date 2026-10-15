# Workflow de prospección — Influence Chile

El documento que se abre el lunes. Une las dos líneas (redes y automatización), las dos
fuentes (frío y entrante) y reparte el trabajo entre Gabriel y el asistente. Todo lo demás de
esta carpeta son piezas de este flujo; este es el orden en que se usan.

**Meta semanal mientras no haya datos reales:** 10 contactos nuevos en frío + todos los entrantes
respondidos el mismo día → 3 respuestas → 1-2 reuniones → 1 propuesta. Con 4 semanas de datos se
reajusta.

---

## 1. Las piezas y dónde viven

| Qué | Archivo | Quién lo toca |
|---|---|---|
| A quién vendemos redes | `01-icp-y-scoring.md` | se lee, no se edita |
| A quién vendemos automatización | `07-icp-automatizacion.md` | se lee, no se edita |
| Candidatos de automatización (fuente) | `leads-automatizacion-chile.csv` | asistente (rutina de los lunes) |
| Candidatos de redes (fuente) | `leads-chile-132-empresas.csv` | asistente |
| **El pipeline de trabajo** | `pipeline-automatizacion.csv` | asistente escribe, Gabriel decide |
| Mensajes vigentes por empresa y por canal | `mensajes-por-canal.md` (versión 3: contexto, qué hacemos, una pregunta) | asistente genera, Gabriel envía |
| Cómo se verifica antes de escribir | `08-prospeccion-automatizacion.md` §Frío · `03-auditoria-express.md` | asistente |
| Qué decir cuando responden / objeciones | `04-seguimiento-y-objeciones.md` · `08` §Objeciones | Gabriel |
| Propuestas | `propuesta/generar.js` (redes, PDF) · `situ/propuesta-situ.html` (plantilla a medida) | asistente arma, Gabriel aprueba |
| Casos entrantes abiertos | `situ/` (y una carpeta por cada entrante que pida propuesta) | ambos |
| Registro semanal de números | `registro-semanal.md` | asistente, los viernes |

---

## 2. Estados del pipeline (columna `estado`)

Cada empresa está en exactamente uno. Solo se avanza hacia adelante; si retrocede, se anota en `notas` por qué.

```
por_verificar ──► por_identificar_decisor ──► por_contactar ──► contactado ──► respondio
                                                                    │             │
                                                                    ▼             ▼
                                                                sin_respuesta   reunion_agendada ──► propuesta_enviada ──► cerrado_ganado
                                                                    │                                      │
                                                                    ▼                                      ▼
                                                                 dormido                            cerrado_perdido
```

| Estado | Significa | Lo mueve |
|---|---|---|
| `por_verificar` | Entró a la lista pero el sitio no se pudo leer o falta confirmar que es empresa real con equipo | asistente, al verificar |
| `por_confirmar_tamano` / `por_confirmar_decisor` | Verificada, pero no sabemos si tiene equipo o quién decide | asistente, con búsqueda o LinkedIn |
| `por_identificar_decisor` | Sabemos que calza; falta nombre y cargo | asistente |
| `por_contactar` | Decisor, canal y mensaje listos. **Es la cola de trabajo de Gabriel** | asistente deja, Gabriel saca |
| `contactado` | Mensaje 1 enviado. Se escribe la fecha en `fecha_contacto` | Gabriel, al enviar |
| `sin_respuesta` | Día 4 y día 10 enviados, nada | Gabriel |
| `dormido` | Se deja descansar 90 días; vuelve a `por_contactar` con otro ángulo | asistente, el viernes |
| `respondio` | Cualquier respuesta, incluso un "no ahora" | Gabriel |
| `reunion_agendada` | Fecha en `notas` | Gabriel |
| `propuesta_enviada` | Fecha y monto en `notas` | asistente, al enviar |
| `cerrado_ganado` / `cerrado_perdido` | Motivo en `notas`. Lo perdido también sirve: dice qué objeción no supimos responder | Gabriel |
| `descartada_icp` / `descartada_sin_fuente` | No calza o no se pudo verificar. No se borra: evita volver a encontrarla | asistente |

**Entrantes** (test de la web, Instagram, correo) entran directo en `respondio` con `notas = "entrante <canal> <fecha>"`.
Nunca pasan por la cola de frío.

---

## 3. La semana

Horario Chile. La rutina automática corre los lunes a las 10:00.

### Lunes · abastecer (asistente 30 min · Gabriel 20 min)

1. **10:00, automático.** La rutina semanal busca 8-10 empresas nuevas con otro ángulo
   (ciudad, sub-rubro, fuente), verifica que sean reales, las agrega al CSV fuente y al
   pipeline como **B**, y manda el resumen.
2. **Asistente arma el lote de la semana:** 10 empresas en `por_contactar` con mensaje listo
   en el formato del canal. Regla de mezcla: 5 de prioridad A, 5 de B. Si no hay 10 listas,
   el asistente sube las que falten desde `por_identificar_decisor` buscando el decisor, y
   solo entonces completa el lote. **No se baja la vara para llenar el número.**
3. **Gabriel revisa el lote** en 20 minutos: lee los 10 mensajes, corrige tono si hace falta,
   descarta la que no le cierre. Lo que apruebe queda para el martes.

### Martes · contactar (Gabriel 60-90 min)

4. Enviar los 10 mensajes 1, uno por uno, **a mano**. Nada de herramientas que manden solas
   por LinkedIn, Instagram o WhatsApp: es riesgo de cuenta y se nota.
   - **WhatsApp** (inmobiliarias): entre 10:00 y 13:00. Mensaje corto, sin link.
   - **Email** (legal, contable, RR.HH., seguros): entre 9:00 y 11:00. Con asunto del
     archivo por canal. Si tiene LinkedIn, se manda la invitación el mismo día.
   - **Llamada** (estudios chicos sin correo visible): pedir el correo del socio, no vender.
   - **LinkedIn** solo como refuerzo: invitación de 300 caracteres máximo, sin pitch.
5. Después de cada envío: `estado = contactado`, `fecha_contacto = hoy`. Lo escribe Gabriel en
   el CSV o se lo dicta al asistente en un mensaje ("contacté a X, Y y Z").

### Miércoles · preparar lo que respondió (asistente, a demanda)

6. Por cada `respondio`, el asistente prepara **antes de la reunión**:
   - Redes: auditoría express del Instagram (8 minutos, `03-auditoria-express.md`), 3
     observaciones concretas para abrir la conversación.
   - Automatización: mapa del proceso que vimos desde afuera (qué entra por WhatsApp, qué por
     formulario, qué se hace a mano) y la pregunta de diagnóstico que lo confirma.
7. Si la respuesta fue un "no" o un "ahora no": se contesta con una línea, se anota la
   objeción en `notas` y pasa a `dormido`. No se insiste.

### Jueves · seguimiento (Gabriel 30 min)

8. Seguimiento **día 4** a los `contactado` de la semana anterior sin respuesta: mensaje de
   seguimiento del archivo por canal (una línea nueva, no el mismo mensaje). Seguimiento
   **día 10** a los que ya recibieron el de día 4. Después del día 10 → `sin_respuesta`.
9. Reuniones agendadas se concentran jueves y viernes, de 30 minutos, por videollamada.
   Si el prospecto propone otro día, se toma; la agenda es de él.

### Viernes · cerrar y medir (ambos 30 min)

10. **Propuesta el mismo día de la reunión**, nunca después de 48 horas. Redes: generador
    `propuesta/`. Automatización o caso especial: carpeta propia con PDF y correo, como `situ/`.
    Toda propuesta lleva: dos opciones como máximo, valores netos con IVA al lado, sin
    permanencia con aviso de un mes, inicio en 10 días hábiles, y un siguiente paso concreto.
11. Asistente actualiza `registro-semanal.md` con los números de la semana y marca `dormido`
    lo que lleva más de 10 días en `sin_respuesta`.
12. Gabriel decide el ángulo de la rutina del lunes siguiente si quiere forzar uno (una
    ciudad, un rubro). Si no dice nada, el asistente lo varía solo.

---

## 4. Entrantes: el flujo que más plata deja

Un entrante vale cinco contactos en frío. Reglas:

1. **Responder el mismo día, antes de 2 horas en horario hábil.** Si Gabriel no puede, le
   manda el pantallazo al asistente y recibe el mensaje listo para pegar en minutos.
2. **El primer mensaje tiene una sola meta: agendar.** Y una sola pregunta: el Instagram o
   la web, para llegar con la auditoría hecha. Dos horarios concretos. Sin precios.
3. **Si piden cotización primero** (como el lead de VE Estética Facial): "va a depender de lo
   que encontremos; te doy un número cerrado en la reunión". Si insisten dos veces, se les
   manda el rango de la web (los planes están publicados) y se insiste en la reunión.
4. **Si piden propuesta formal por correo** (como Situ): se revisa su web y sus redes antes de
   escribir una línea; se responde punto por punto en el orden que pidieron; PDF + correo
   corto; se registra en el pipeline como `propuesta_enviada`; seguimiento a los 5 días
   hábiles con algo nuevo (la pieza de muestra, una observación), nunca "¿lo vieron?".
5. **Todo entrante se registra**, aunque no prospere: nombre, canal, fecha, qué pidió, qué
   pasó. Es la única fuente de verdad sobre qué está trayendo la web.

---

## 5. Un prospecto en frío, de principio a fin (15 minutos del asistente)

```
1. Verificar      ¿Es empresa real? ¿Tiene web o fuente pública? ¿Tiene equipo?
                  ¿Ya usa IA / agenda online real / portal? → si sí, descartada_icp.
                  Regla Auditron: lo que no se vio con los propios ojos no se afirma.
2. Decisor        Nombre + cargo + dónde se vio (sitio, LinkedIn, directorio). Sin nombre,
                  no se escribe: va a por_identificar_decisor.
3. Canal          Lo que la empresa publica como canal principal manda:
                  inmobiliaria → WhatsApp · legal/contable/RR.HH./seguros → email
                  (+ LinkedIn) · estudio chico sin correo → llamada.
4. Mensaje        3 partes, ≤ 6 líneas: contexto (quién soy y por qué le escribo, con un
                  dato público y neutro de ellos) · qué hacemos en una frase · una pregunta
                  de sí o no. Sin suponer sus problemas, sin cifras de su equipo, sin
                  "trabajo con…" si no hay clientes que mostrar. Sin precios ni adjuntos.
5. Registrar      Fila completa en el pipeline, estado por_contactar.
```

---

## 6. Reglas que no se negocian

- **No se envía nada que no se haya verificado.** Un dato inventado cuesta la cuenta y la
  reputación (lección Auditron).
- **No se automatiza el envío** por LinkedIn, Instagram ni WhatsApp. Se automatiza la
  búsqueda, la verificación, la redacción y el registro. El clic de enviar es de Gabriel.
- **Precios solo en reunión o en propuesta.** En frío y en el primer mensaje a un entrante,
  nunca. Los planes públicos de la web son la excepción cuando el prospecto insiste.
- **Un seguimiento el día 4, otro el día 10, y se deja.** Volver a los 90 días con otro
  ángulo es válido; escribir cinco veces, no.
- **Lo que no gestionamos habitualmente se cobra aparte** (LinkedIn, grabación presencial,
  Google Ads). Está en la auditoría de oferta; la propuesta no regala servicios.
- **Toda propuesta responde lo que pidieron, en el orden que lo pidieron.** Si pidieron 9
  puntos, son 9, no 10.
- **Una opción por propuesta; dos como máximo, con una marcada como recomendada.** Con más, el
  cliente se enreda y no decide. Nada de catálogos ni menús de combinaciones.
- **En propuestas no se promete nada sobre accesos o contraseñas.** Cómo se comparten las cuentas
  se coordina en la reunión de la semana 1, según lo que use cada cliente.
- **No se toca una automatización de cliente ni se gastan créditos de Apollo sin preguntar.**

---

## 7. Cómo pedirle cosas al asistente (frases que disparan el flujo)

| Dices | El asistente hace |
|---|---|
| "lote de la semana" | 10 empresas en `por_contactar` con mensajes por canal, 5 A + 5 B |
| "contacté a X, Y, Z" | Mueve a `contactado` con fecha de hoy |
| "respondió X: [texto]" | Clasifica la respuesta, propone la contestación, prepara la auditoría o el mapa de proceso |
| "auditoría express @cuenta" | Las 5 secciones de `03` en 3 observaciones para abrir la reunión |
| "responde este lead" + pantallazo | Mensaje listo para pegar, en el formato del canal, con horarios |
| "propuesta para X" + lo que pidieron | Carpeta propia con PDF y correo, siguiendo el estándar de `situ/` |
| "registra" | Actualiza pipeline y registro semanal con lo que le cuentes |
| "números de la semana" | Tabla del registro semanal con la lectura de qué cambiar |
| "la rutina del lunes que busque [ciudad/rubro]" | Ajusta el ángulo de la búsqueda semanal |

---

## 8. Lo que falta para que esto corra solo (pendiente, en orden)

1. Que la rutina del lunes **también escriba las nuevas en el pipeline** (hoy lo hace el
   asistente a mano después de la rutina). Es un cambio al texto de la rutina.
2. Un `CLAUDE.md` en la raíz del repo que fije el rol del asistente y estas reglas, para que
   cualquier sesión nueva arranque sabiendo esto.
3. Normalizar la columna `estado` del pipeline a los valores de la sección 2 (hoy hay
   variantes escritas distinto).
4. Agregar LinkedIn y jornada de grabación como servicios con precio en la web, para que las
   propuestas no los improvisen.
