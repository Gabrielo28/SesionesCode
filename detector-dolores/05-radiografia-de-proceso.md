# Radiografía de proceso — dónde se frena y cuánto cuesta

El mapa de dolores dice **en qué área** está la tranca. La radiografía de proceso dice
**en qué paso exacto** y **cuánto tiempo y plata se van ahí**. Es la herramienta para
cualquier cosa que avance por pasos: una cotización, un pedido, un paciente, un post, un
mueble, una factura por cobrar.

Herramienta: `proceso/index.html` (se usa en vivo con el dueño, en un notebook o
tablet). Resultado al instante; PDF con `Imprimir / PDF` o `node proceso/imprimir.js`.

---

## La idea en tres frases

1. Una unidad (cotización, pedido, paciente) pasa por pasos. En cada paso **trabaja
   alguien unos minutos** y, antes, **espera unas horas** (en una bandeja, a una
   aprobación, al cliente, al proveedor).
2. Hay un paso al que le llega más trabajo del que puede hacer: **ese es el cuello de
   botella**, y define cuánto puede vender o producir la empresa entera. Mejorar
   cualquier otro paso no cambia nada.
3. Lo que cuesta se mide en tres cosas: **unidades que se caen** en el camino,
   **horas que se hacen dos veces** (retrabajo) y **unidades que no se alcanzan a
   procesar** en el cuello. Todo eso se convierte a pesos por semana y por mes.

---

## Qué se pregunta en cada paso (las 5 preguntas)

Para cada paso, en orden, con el dueño al lado:

| Pregunta | Campo en la herramienta | Cómo preguntarlo |
|---|---|---|
| ¿Qué se hace y quién? | Paso / Quién / Personas | "Después de eso, ¿qué pasa? ¿Quién lo hace?" |
| ¿Cuánto trabajo real tiene? | Trabajo (min por unidad) | "Si te sientas a hacerlo sin interrupciones, ¿cuánto demora uno?" |
| ¿Cuánto espera antes? | Espera antes (horas) | "Desde que termina el paso anterior hasta que alguien toma este, ¿cuánto pasa? Un día normal, no el mejor." |
| ¿Cuántas veces se repite? | Se repite (%) | "De cada 10, ¿cuántos hay que volver a hacer porque faltó algo o estaba mal?" |
| ¿Cuántos se caen aquí? | Se pierde (%) | "De cada 10 que llegan a este paso, ¿cuántos no siguen? ¿No responden, se rechazan, se botan?" |

Y tres datos del proceso completo:

- **Cuántas unidades entran por semana** (consultas, pedidos, pacientes nuevos).
- **Valor de una unidad perdida.** En producción, el margen de la unidad. En ventas,
  el margen de un cierre × la probabilidad de cerrar (si cierran 3 de cada 10
  cotizaciones y cada cierre deja $180.000, una cotización perdida vale $54.000).
  Si se pone el margen completo, las fugas se inflan y el dueño no lo cree.
- **Costo hora del equipo.** Sueldo más imposiciones dividido por las horas del mes.

**Regla de oro de la entrevista:** preguntar por **un día normal**, no por el mejor ni
por el peor. Si el dueño duda entre dos números, poner el más conservador. Los números
los acepta él; la herramienta solo los multiplica.

---

## Cómo leer el resultado

**Cuello de botella** (tarjeta roja): el paso con más carga, es decir, horas que le
llegan por semana contra horas que tiene quien lo hace.
- Sobre 100%: no da abasto. Todo lo que entra de más se atrasa o se pierde, y todos
  los pasos siguientes esperan. Ahí está la tranca, sin discusión.
- Entre 85 y 100%: alcanza, pero sin holgura. Una semana fuerte lo desborda.
- Bajo 85%: la capacidad no es el problema. El freno está en las esperas o las fugas.

**Una unidad demora X, de las cuales Y son trabajo real.** Casi siempre el trabajo
real es menos del 5% del tiempo total. Lo demás es espera. Es el dato que más
sorprende al dueño y el que abre la conversación: "una cotización demora 11 días y
tiene 2,7 horas de trabajo".

**Llegan al final N de M.** Cuántas unidades sobreviven el proceso. Y en qué paso se
caen más.

**Se pierde al mes.** La suma de fugas, retrabajo y lo que el cuello no alcanza a
procesar, en pesos. Es el número que va en la propuesta frente al precio.

**Las dos gráficas.** La primera muestra, por paso, el trabajo (teal) contra la espera
(ocre): donde la barra ocre es larga, la unidad está parada. La segunda muestra la
carga de cada paso contra la línea de 100%: el que la cruza es el cuello.

**Dónde se frena y qué hacer primero.** Hallazgos ordenados: primero el cuello,
después la espera más larga, la fuga más grande y el retrabajo más caro. Cada uno con
su primer paso de arreglo.

---

## Las 7 fugas de tiempo (para reconocerlas cuando aparezcan)

Al mapear, el dueño va a describir cosas que suenan normales. Son fugas con nombre:

| Fuga | Cómo suena | Dónde aparece en la herramienta |
|---|---|---|
| **Espera** | "ahí queda hasta que yo pueda", "se lo mando y me responde cuando puede" | Espera antes (horas) |
| **Aprobación** | "tiene que verlo el dueño / el cliente / el jefe" | Espera larga en un paso de 5 minutos de trabajo |
| **Retrabajo** | "casi siempre hay que corregir algo", "me lo devuelven" | Se repite (%) |
| **Búsqueda de información** | "tengo que buscar el precio / la medida / el correo" | Minutos de trabajo inflados; preguntar cuánto es buscar |
| **Traspaso** | "se lo paso a X por WhatsApp / en un papel" | Espera + retrabajo en el paso siguiente |
| **Interrupción** | "lo hago entre medio de atender" | Trabajo que debería tomar 20 min y toma 60 |
| **Paso que no agrega nada** | "lo anotamos en el cuaderno y después en el Excel" | Un paso con trabajo y sin valor: candidato a eliminar |

---

## Las 4 jugadas para destrabar el cuello (en este orden)

Es la receta de la teoría de restricciones, en castellano. El orden importa: las tres
primeras no cuestan plata.

1. **Exprimir.** Que el cuello haga solo lo que únicamente él puede hacer. Si el
   dueño mide, cotiza y hace seguimiento, y el cuello es "cotizar", el seguimiento lo
   hace otro, con un mensaje escrito. Que nunca le falte trabajo listo para empezar.
2. **Limpiar lo que le entra.** El retrabajo del cuello casi siempre nace un paso
   antes (llegó incompleto). Una lista de requisitos a la entrada: "no se cotiza sin
   medidas, fotos y plazo".
3. **Subordinar.** Los demás pasos trabajan al ritmo del cuello, no más rápido. Meter
   40 cotizaciones a un paso que hace 29 no sirve: se atrasan todas. Mejor filtrar
   antes (calificar la consulta) para que lleguen 29 buenas.
4. **Elevar.** Recién ahora: otra persona, una plantilla, una automatización, un
   software. Es lo primero que el dueño quiere comprar y lo último que conviene hacer.

Cuando el cuello se destraba, aparece otro. Es normal: se repite la radiografía.

---

## Ejemplo resuelto: Muebles Araya (ventas)

`proceso/ejemplo-muebles.json`. Fábrica de muebles a medida, 40 consultas semanales,
el dueño hace casi todo.

| Paso | Quién | Trabajo | Espera antes | Se repite | Se pierde |
|---|---|---|---|---|---|
| Responder la consulta | Dueño | 5 min | 6 h | 0% | 15% |
| Visita y medición | Dueño | 90 min | 2 días | 5% | 20% |
| Armar la cotización | Dueño | 45 min | 3 días | 30% | 10% |
| Seguimiento | Nadie fijo | 10 min | 5 días | 0% | 35% |
| Cierre y anticipo | Dueño | 15 min | 1 día | 0% | 5% |

Lo que sale:
- **Cuello: "Visita y medición" al 119%.** Le llegan 34 visitas a la semana y el dueño
  alcanza 29. Cinco se atrasan cada semana, y el atraso se acumula.
- **Una cotización demora 11,4 días y tiene 2,7 horas de trabajo real** (1%).
- **De 40 consultas llegan 15 al final.** La fuga más grande es el seguimiento: 35% se
  pierde en el paso que nadie tiene asignado.
- **El 30% de las cotizaciones se rehace** porque la visita no trajo todas las medidas.
- **Se pierden $7.400.000 al mes** (fugas valoradas a $54.000 por cotización, que es
  el margen de $180.000 por el 30% de cierre).

Lo que se propone, en orden:
1. Calificar la consulta antes de visitar (fotos, medidas aproximadas, presupuesto):
   menos visitas, mejores. Descarga el cuello.
2. Lista de medición para que la cotización no se rehaga.
3. Seguimiento con dueño y mensaje fijo a las 48 horas: la fuga más barata de tapar.
4. Recién después: un ayudante que mida.

Nada de eso es marketing. Y aun así el cliente lo paga, porque le mostraron $7 millones
al mes con sus propios números. La parte digital (formulario de calificación, mensajes
automáticos de seguimiento) la hace Influence.

---

## El servicio express: "Radiografía de proceso en 90 minutos"

Es lo que se ofrece a la empresa. Un formato fijo para que sea rápido de vender,
rápido de hacer y siempre igual de bueno.

**Promesa:** "En 90 minutos te muestro en qué paso exacto se frena tu [venta /
producción / atención], cuánto tiempo se pierde ahí y cuánto te cuesta al mes. Con
tus números, no los míos. Te llevas un informe de 4 páginas."

**Agenda:**

```
 0-10 min   Elegir el proceso. "¿Qué es lo que más te cuesta sacar adelante?"
            Uno solo. El que más duele (ver 01-mapa-de-dolores.md).
10-55 min   Mapear paso a paso en la herramienta, con el dueño mirando la pantalla.
            Las 5 preguntas por paso. Un día normal.
55-70 min   Ver el resultado juntos. Dejar que el dueño reaccione al número de
            "demora X días, trabajo real Y horas" y al cuello de botella.
            Ajustar lo que él corrija.
70-85 min   Las 4 jugadas aplicadas a su cuello. Qué se puede hacer esta semana
            sin gastar, qué requiere a Influence, qué se deriva.
85-90 min   Imprimir el PDF, mandárselo, agendar el siguiente paso.
```

**Entregable:** el PDF de la radiografía (flujo, tiempos, carga, hallazgos, detalle) y,
si corresponde, el diagnóstico de dolores completo (`diagnostico/`).

**Cómo se ofrece** (DM, WhatsApp o en persona, después del comprador misterioso):

> Hola [Nombre], soy Gabriel de Influence. Les escribí el [día] pidiendo una cotización
> y me respondieron a las [X horas]. No es un reclamo: es lo normal cuando el dueño
> hace todo. Hago una cosa que se llama radiografía de proceso: en 90 minutos, con tus
> números, te muestro en qué paso se te van las ventas y cuánto cuesta al mes.
> ¿Te sirve el [día] a las [hora]?

**Precio:** gratis como puerta de entrada cuando el negocio calza con el perfil
(`prospeccion-ventas/01-icp-y-scoring.md`), o con un valor fijo cuando se vende solo
como servicio. En ambos casos el PDF lleva el número de pesos al mes, y la propuesta
que sigue (`prospeccion-ventas/propuesta/`) se compara contra ese número.

**Qué sigue:** la radiografía dice qué arreglar. La oferta sale de
`04-de-dolor-a-oferta.md`: lo digital lo hace Influence (calificación de consultas,
flujo de WhatsApp, seguimiento automático, pedidos online, agenda); lo de capacidad,
costos o personas se deriva con nombre y teléfono.
