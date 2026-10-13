# Secuencia de retención — tono de coach, no de empresa

Objetivo: que el cliente llegue al mes 3 y renueve. Los puntos de fuga típicos son la semana 2
(no ve resultados, le duele todo), la semana 6 (se aburre, baja la adherencia) y la semana 10
(ya no viene, hay que renovar). La encuesta del mes 3 mide y abre la renovación.

Reglas:
- Lo manda "el coach", en primera persona. Nunca "el equipo de…".
- Máximo 4 líneas. Una pregunta al final. Nada de links en el primer mensaje de cada check-in.
- Si el cliente responde, el coach contesta a mano. La automatización solo abre la conversación.
- Si no responde en 48 h, un "empujón" corto. Después, silencio hasta el siguiente hito.
- `{{nombre}}` = nombre de pila. `{{coach}}` = nombre del coach. `{{meta}}` = objetivo declarado en el onboarding.

---

## Día 1 · Bienvenida (se envía el día que parte)

> {{nombre}}, bienvenido/a. Ya tengo tu ficha y tu programa está armado para {{meta}}.
> Las primeras dos semanas son de técnica y adaptación: vas a terminar con energía, no destruido/a. Eso es a propósito.
> ¿Alguna duda antes de la primera sesión?

## Semana 2 · Check-in de adaptación (día 14)

> {{nombre}}, van dos semanas. Por lo general aquí aparecen dos cosas: dolor muscular raro y la sensación de que "esto es muy poco".
> Las dos son normales. El volumen sube desde la semana 3.
> Del 1 al 10, ¿cómo te has sentido en las sesiones?

Empujón (día 16 si no respondió):
> Un número nomás, {{nombre}}: del 1 al 10 cómo vas. Con eso ajusto la semana que viene.

## Semana 6 · Check-in de progreso (día 42)

> {{nombre}}, mes y medio. Revisé tus registros: {{dato_progreso}}.
> Esta semana cambiamos ejercicios para que no se vuelva rutina. Si hay alguno que odias, es el momento de decirlo.
> ¿Qué ejercicio te está costando más?

> `{{dato_progreso}}` lo escribe el coach antes del envío (ej. "subiste 12 kg en sentadilla y tu RPE en press bajó de 9 a 7"). Si no hay dato, el sistema deja el mensaje en "Pendientes" y no lo manda solo.

Empujón (día 44):
> {{nombre}}, ¿seguimos con el mismo horario esta semana? Te dejo la sesión del martes lista.

## Semana 10 · Pre-renovación (día 70)

> {{nombre}}, quedan dos semanas del primer ciclo. Antes de que se acabe quiero mostrarte dónde partiste y dónde estás.
> ¿Te acomoda 15 minutos esta semana para revisarlo juntos? Es por videollamada o al final de una sesión.

Empujón (día 72):
> {{nombre}}, ¿jueves o viernes para revisar tus avances? Son 15 minutos.

## Mes 3 · Encuesta + oferta de renovación (día 84)

> {{nombre}}, se cumplen 3 meses. Te pido 2 minutos para responder 5 preguntas, es lo que uso para mejorar el programa: {{link_encuesta}}
> Y lo importante: si renuevas antes del {{fecha_limite}}, {{oferta_renovacion}}.

> `{{oferta_renovacion}}` sugerida: "mantienes el precio actual por 6 meses más" o "la evaluación de progreso con mediciones va sin costo". Nunca descuento directo: baja el valor percibido.

Empujón (día 87):
> {{nombre}}, ¿pudiste ver la encuesta? Es corta de verdad. Y me dices si seguimos.

## Referidos (día 90, solo si renovó)

> {{nombre}}, gracias por seguir. Una cosa: si conoces a alguien que quiera partir, por cada persona que entre con tu nombre {{beneficio_referido}}.
> No necesitas vender nada, solo pásale mi número.

> `{{beneficio_referido}}` sugerido: "te regalo una semana" o "los dos tienen la evaluación gratis".

---

## Si deja de ir (sin registro de sesión 7 días seguidos, en cualquier momento)

> {{nombre}}, no te he visto esta semana. Sin reproches: ¿pasó algo o se desordenó la semana?
> Si quieres, bajamos a 2 días por un tiempo. Mejor eso que cero.

## Encuesta mes 3 (5 preguntas, archivo `encuesta-mes-3.html`)
1. ¿Qué tan cerca sientes que estás de {{meta}}? (0–10)
2. ¿Qué tan probable es que recomiendes a {{coach}}? (0–10, NPS)
3. ¿Qué fue lo que más te sirvió?
4. ¿Qué cambiarías?
5. ¿Quieres seguir? Sí / Sí pero con cambios / Todavía no sé / No

## Qué se mide
- % de respuesta a cada check-in.
- % de renovación al mes 3 y al mes 6 (KPI del brief).
- NPS promedio.
- Referidos que llegaron con nombre de cliente.
