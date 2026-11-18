# Semana 1 · lista para publicar

Formato: los reels van verticales (1080×1920) **sin música** y el carrusel en 4:5 (1080×1350).
Al subir cada reel:
- elige un audio en tendencia dentro de Instagram o TikTok, con el volumen bajo si grabas voz;
- activa la etiqueta **"Creado con IA"** en los reels de lunes, martes, viernes y sábado (jueves es una grabación de pantalla y no la necesita).

Regla de cuentas (la acordada):
- Las piezas de **Impulz** van al Instagram y al Facebook del gimnasio, con impulzgym.cl en la bio. Lo que llegue por ahí es del gimnasio.
- Las piezas del **coach** van a tu cuenta personal, con `entrenachile.cl/gimnasios/impulz` en la bio. Eso es lo que cuenta como comisión.

| Día | Cuenta | Archivo | Hora sugerida |
|---|---|---|---|
| Lun | Impulz | lun-reel-impulz-a-toda-hora.mp4 (15 s) | 19:30 |
| Mar | Coach | mar-reel-coach-3-errores-prensa.mp4 (18 s) | 20:00 |
| Mié | Impulz | mie-carrusel-1…6.png | 13:00 |
| Jue | Coach | jue-reel-coach-generador-rutina.mp4 (24 s) | 20:00 |
| Vie | Impulz | vie-reel-impulz-abrimos-5am.mp4 (16 s) | 07:00 |
| Sáb | Coach | sab-reel-coach-mejor-hora.mp4 (15 s) | 11:00 |

---

## Lunes · Impulz · "Tu gimnasio a toda hora"
**Texto:**
De día, al atardecer o de noche: Impulz te espera 💪
Lunes a viernes de 5:00 a 22:00 · Sábado de 8:00 a 14:00.
Reserva tu clase de prueba en el link de la bio.
📍 El Quisco
#ElQuisco #Gimnasio #LitoralCentral #ImpulzGym #Entrenamiento

## Martes · Coach · "3 errores en la prensa de piernas"
**Voz (opcional, la grabas tú, unos 15 s):**
"Tres errores en la prensa que veo todas las semanas. Uno: bajar tanto que se te despega la cadera. Dos: trabar las rodillas arriba. Tres: rodillas hacia adentro. Guárdalo para tu próximo día de pierna."

**Texto:**
¿Cuál de los 3 cometes tú? 👇
1️⃣ Despegar la cadera al bajar
2️⃣ Bloquear las rodillas arriba
3️⃣ Rodillas hacia adentro
Si quieres una rutina armada para ti, el link está en mi perfil.
#PrensaDePiernas #DiaDePierna #TecnicaGym #EntrenadorPersonal #ElQuisco

## Miércoles · Impulz · Carrusel "Así es Impulz por dentro"
**Texto:**
Así es Impulz por dentro 👀 Desliza →
Peso libre, máquinas de fuerza, poleas y cardio con vista.
Ven a conocerlo: reserva tu clase de prueba en el link de la bio.
#ElQuisco #Gimnasio #ImpulzGym #LitoralCentral

## Jueves · Coach · "Tu rutina en 30 segundos"
**Voz (opcional, unos 20 s):**
"¿No sabes qué hacer en el gimnasio? Eliges tu objetivo, tu nivel y cuántos días puedes ir, y en segundos tienes tu rutina con foto y explicación de cada ejercicio. Es gratis: link en mi perfil."

**Texto:**
Tu rutina de gimnasio en 30 segundos, gratis ⏱️
Elige objetivo, nivel y días → recibe tu plan de 4 semanas.
Link en mi perfil.
#RutinaGym #Principiantes #EntrenadorPersonal #ElQuisco

## Viernes · Impulz · "5:00 y ya estamos abiertos"
**Texto:**
5:00 de la mañana y ya estamos abiertos ⏰
Entrena antes del trabajo y empieza el día con todo.
Lun a vie de 5:00 a 22:00 · Sáb de 8:00 a 14:00.
Clase de prueba en el link de la bio.
#ElQuisco #Gimnasio #ImpulzGym #EntrenaTemprano

## Sábado · Coach · "¿Cuál es la mejor hora para entrenar?"
**Voz (opcional, unos 12 s):**
"¿Cuál es la mejor hora para entrenar? Mañana, tarde o noche… la que puedas repetir tres veces por semana. Lo que te cambia el cuerpo es la constancia, no la hora."

**Texto:**
La mejor hora para entrenar es la que puedes repetir 💯
¿Tú a qué hora vas? Mañana ☀️ tarde 🌅 noche 🌙
Link en mi perfil para tu rutina gratis.
#Constancia #Gimnasio #EntrenadorPersonal #ElQuisco

---

## Cómo se hizo (para repetirlo)
- Clips generados con IA en ElevenLabs (kling-2.5-turbo):
  - letrero de noche encendiéndose;
  - letrero al amanecer;
  - recorrido por la sala;
  - prensa de piernas con técnica correcta.
- Imágenes de la sala al atardecer y de noche editadas desde `ia-sala.jpg`.
- `plantillas/reels.html` tiene los textos en pantalla y `node plantillas/render-reels.js <capas>` los pasa a PNG.
- `plantillas/grabar-generador.js` graba el generador de entrenachile.cl sin enviar reservas.
- `plantillas/armar-reels.sh <clips> <capas> <grabación.webm> <salida>` arma los 5 reels con ffmpeg.
