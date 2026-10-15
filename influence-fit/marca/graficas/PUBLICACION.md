# Influence Fit — Qué es cada pieza y con qué texto sale

Las 14 imágenes están en `png/`. Los textos están escritos en primera persona de Gabriel, así que sirven
igual en su cuenta de coach o en @influence.chile.

**Cómo leer cada ficha**
- **Hook:** lo primero que se ve o se lee. En posts es la primera línea del texto (lo que aparece antes del
  "más"). En historias y anuncios verticales es el titular de la imagen.
- **Texto:** el copy completo, listo para pegar.
- **Hashtags:** van al final del texto, separados por un salto de línea.

---

## Resumen

| Archivo | Tipo | Formato | Estado |
|---|---|---|---|
| `ad-01-chat.png` | Anuncio | Feed 4:5 (1080×1350) | Listo. Cambiar los precios del chat por los reales. |
| `ad-02-coach.png` | Anuncio | Feed 1:1 (1080×1080) | Listo |
| `ad-03-story.png` | Anuncio | Historias y Reels 9:16 (1080×1920) | Listo |
| `feed-01-presentacion.png` | Post | Imagen única 4:5 | Listo. Fijar en el perfil. |
| `carrusel-01` a `carrusel-05` | Post | Carrusel de 5, 4:5 | Listo |
| `feed-02-fundadores.png` | Post | Imagen única 4:5 | Listo. Fijar en el perfil. |
| `story-01-diagnostico.png` | Historia | 9:16 | Agregar sticker de enlace |
| `story-02-cupos.png` | Historia | 9:16 | Agregar sticker de enlace |
| `story-03-encuesta.png` | Historia | 9:16 | Agregar sticker de encuesta |
| `story-04-prueba.png` | Historia | 9:16 | Falta la captura real |

Los contadores de cupos fundadores parten en **5 de 5 disponibles**. Cada vez que se cierre uno, se actualiza
el gráfico (clase `taken` en el HTML) y el texto. Nunca mostrar cupos tomados que no existen.

---

## ANUNCIOS

Configuración común en Meta Ads:
- **Objetivo:** Mensajes, con destino WhatsApp. Alternativa: Tráfico a la landing (`#diagnostico`).
- **Mensaje precargado:** "Hola Gabriel, quiero el diagnóstico gratis."
- **Público inicial:** Chile, 24 a 50 años, intereses entrenamiento personal, CrossFit, personal trainer,
  nutrición deportiva, administración de gimnasios. Para Litoral Central y Valparaíso, segmentar por radio.
- **Sin hashtags.** En un anuncio cada hashtag es un enlace que saca a la persona del anuncio antes de que
  llegue a WhatsApp.

### ad-01-chat · Anuncio feed 4:5

**Hook:** ¿Cuántos de los que te preguntaron precio este mes terminaron agendando?

**Texto principal:**
```
¿Cuántos de los que te preguntaron precio este mes terminaron agendando?

Si respondes tarde, ya le escribieron a otro coach. Si respondes solo con el precio, se enfría.

Lo que ves en la imagen es lo que armo para coaches: un asistente de WhatsApp que responde en minutos, pregunta qué quiere lograr la persona y le ofrece horarios reales de tu agenda. Tú llegas a la evaluación, no al chat.

Te hago un diagnóstico gratis de 20 minutos y te muestro dónde se te están yendo los clientes. Escríbeme "DIAGNÓSTICO".
```
**Título:** Que tus anuncios terminen en una evaluación agendada
**Descripción:** Diagnóstico gratis · 20 min
**Botón:** Enviar mensaje

### ad-02-coach · Anuncio feed 1:1

**Hook:** Llevo 15 años entrenando gente. Sé lo que es tener la agenda llena un mes y con huecos al siguiente.

**Texto principal:**
```
Llevo 15 años entrenando gente. Sé lo que es tener la agenda llena un mes y con huecos al siguiente.

Ahora instalo en el negocio de otros coaches el mismo sistema que uso yo:

Anuncios que llevan a una evaluación agendada, no a "info por DM".
Un asistente de WhatsApp que responde, califica y agenda solo.
Mensajes en las semanas 2, 6 y 10, que es cuando la gente abandona.

No vendo "redes sociales". Vendo evaluaciones agendadas y clientes que renuevan, y te muestro el número cada mes.

Diagnóstico gratis de 20 minutos. Escríbeme "DIAGNÓSTICO".
```
**Título:** Hecho por un coach, para coaches
**Descripción:** 5 cupos fundadores
**Botón:** Enviar mensaje

### ad-03-story · Anuncio Historias y Reels 9:16

**Hook:** ¿Cuántos te preguntaron precio este mes y cuántos agendaste? (es el titular de la imagen; se lee en el primer segundo)

**Texto principal** (en historias casi no se ve, por eso es corto):
```
Si no sabes la respuesta, ahí está la plata que se te va. Diagnóstico gratis de 20 minutos para coaches.
```
**Título:** Diagnóstico gratis para coaches
**Botón:** Enviar mensaje
**Ubicaciones:** solo Historias y Reels de Instagram y Facebook. El borde inferior ya viene libre para que el
botón del anuncio no tape el texto.

---

## POSTS

Hashtags: entre 5 y 8 por post, mezclando el nicho (coaches), el tema y la zona. Más que eso no suma alcance
y se ve desesperado.

### feed-01-presentacion · Post de presentación (fijar 1.º)

**Hook:** Más clientes, menos administración y que no se te vayan al tercer mes.

**Texto:**
```
Más clientes, menos administración y que no se te vayan al tercer mes.

Llevo 15 años entrenando gente y conozco las tres fugas de este negocio: la agenda que sube y baja, las horas contestando WhatsApp y el cliente que se va justo antes de ver resultados.

Influence Fit es lo que armé para tapar esas fugas en mi propio negocio. Ahora lo instalo en el de otros coaches y gimnasios: anuncios que terminan en evaluaciones agendadas, un asistente de WhatsApp que responde y agenda solo, y seguimiento en las semanas en que la gente abandona.

Hecho por un coach.

Si quieres saber cuál de las tres te está costando más, escríbeme "DIAGNÓSTICO". Son 20 minutos y es gratis.
```
**Hashtags:**
```
#entrenadorpersonal #coachfitness #entrenadorpersonalchile #negociofitness #marketingparacoaches #gimnasiochile #litoralcentral
```

### carrusel-01 a carrusel-05 · Carrusel "Tres cosas que te están costando clientes"

Orden: 01 portada, 02 clientes inestables, 03 administración por WhatsApp, 04 se van al tercer mes, 05 cierre.

**Hook:** Ninguna de las tres se arregla publicando más. (la portada hace el resto: "Tres cosas que te están costando clientes")

**Texto:**
```
Ninguna de las tres se arregla publicando más.

01. Clientes inestables. Un mes lleno y el siguiente con huecos. Se arregla con anuncios que terminan en una evaluación agendada y con alguien que responda en 2 minutos, no en 20 horas.

02. Administración por WhatsApp. Cobros, recordatorios, cambios de hora, fichas de lesiones. Se arregla con una ficha de onboarding que llega sola a tu planilla y recordatorios que salen solos.

03. Se van al tercer mes. Entran motivados, el resultado tarda y nadie les habla. Se arregla con un mensaje tuyo en la semana 2, 6 y 10, justo cuando suelen abandonar.

¿Cuál es la tuya? Te leo en los comentarios.

Si no lo tienes claro, escríbeme "DIAGNÓSTICO" y lo vemos en 20 minutos. Guárdalo para la próxima vez que revises tu negocio.
```
**Hashtags:**
```
#entrenadorpersonal #personaltrainer #coachonline #negociofitness #retenciondeclientes #crossfitchile #entrenadorpersonalchile #marketingfitness
```

### feed-02-fundadores · Post cupos fundadores (fijar 2.º)

**Hook:** Estoy partiendo Influence Fit con 5 coaches. Solo 5.

**Texto:**
```
Estoy partiendo Influence Fit con 5 coaches. Solo 5.

Los que entren ahora tienen:

El sistema de clientes completo incluido gratis: ficha de onboarding, asistente de WhatsApp, recordatorios, contrato y consentimiento. Vale desde $490.000.

Una garantía por escrito: si en 60 días no tienes al menos 15 evaluaciones agendadas, el mes siguiente de gestión corre por mi cuenta.

Trato directo conmigo. Sin ejecutivo de cuentas.

A cambio te pido un testimonio en video y poder mostrar tus números como caso de estudio.

Cuando se llenen los 5, se cierra. Escríbeme "FUNDADOR".
```
**Hashtags:**
```
#entrenadorpersonal #coachfitness #gimnasioboutique #crossfitchile #entrenadorpersonalchile #negociofitness #valparaiso
```

---

## HISTORIAS

Las historias no llevan texto aparte: todo va en la imagen y en los stickers que se agregan en Instagram.
Los hashtags casi no dan alcance en historias. Sirve más el **sticker de ubicación** (El Tabo, Viña del Mar o
Valparaíso) y, como mucho, un hashtag chico escondido detrás de un sticker.

### story-01-diagnostico · Historia con enlace

**Hook:** Diagnóstico gratis de 20 min
**Sticker de enlace:** a la landing (`…/#diagnostico`) o a `wa.me/56965450723`, con el texto "QUIERO EL DIAGNÓSTICO".
Va en el espacio libre de abajo, sobre la zona segura.
**Ubicación:** El Tabo
**Hashtag:** #entrenadorpersonal

### story-02-cupos · Historia de cupos fundadores

**Hook:** Quedan 5 de 5 cupos
**Sticker de enlace:** `wa.me/56965450723?text=FUNDADOR`, texto "QUIERO UN CUPO".
**Ubicación:** El Tabo
**Hashtag:** #coachfitness
Actualizar el número grande y los círculos cada vez que se cierre un cupo.

### story-03-encuesta · Historia de interacción

**Hook:** ¿Cuántas horas a la semana pierdes contestando WhatsApp?
**Sticker de encuesta** (en el espacio libre de abajo), con estas opciones:
- Menos de 3
- 3 a 7
- Más de 7 (y me da vergüenza)

**Al día siguiente:** una historia con el resultado y esta frase: "La mayoría respondió X. Eso son X horas al
mes que no entrenan a nadie. Te muestro cómo las recupero yo", con el sticker de enlace al diagnóstico.
Responde por mensaje directo a cada coach que votó "más de 7".
**Hashtag:** #entrenadorpersonalchile

### story-04-prueba · Historia "Esto es lo que hago yo"

**No publicar todavía.** El recuadro central es para una captura real: el reporte mensual de los canales
propios o la agenda de evaluaciones de la semana, con nombres de clientes tapados. Sin esa captura la pieza
no tiene sentido.
**Hook:** Esto es lo que hago yo.
**Sticker de texto opcional sobre la captura:** "Esta semana: X evaluaciones agendadas"
**Hashtag:** ninguno; esta historia es para quien ya te sigue.

---

## Orden sugerido para las dos primeras semanas

| Día | Feed | Historias |
|---|---|---|
| Lunes 1 | `feed-01-presentacion` (fijar) | `story-03-encuesta` |
| Martes 1 | | Resultado de la encuesta + enlace |
| Miércoles 1 | Carrusel "Tres cosas" | `story-01-diagnostico` |
| Viernes 1 | `feed-02-fundadores` (fijar) | `story-02-cupos` |
| Lunes 2 | | `story-04-prueba` (cuando esté la captura) |
| Martes 2 | Se encienden los 3 anuncios | |

Los anuncios parten cuando el perfil ya tiene estos tres posts: quien haga clic y revise la cuenta tiene que
encontrar algo coherente, no un perfil vacío.
