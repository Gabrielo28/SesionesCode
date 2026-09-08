# Agente Multi-Nicho — Capa A

Motor de generación y aprobación de contenido para redes sociales: genera un
banco de publicaciones con datos reales del negocio, el dueño aprueba (o pide
otra versión, o edita el texto a mano), y queda listo para publicar. Esta es
la **Capa A** del producto — no depende de la API de Meta ni de ninguna
aprobación externa, por eso ya es una app que corre y se puede probar hoy.

No está atada a un rubro: agregar un nicho nuevo es escribir su plantilla en
`server/nichos.js` (calendario, enfoques, tono), no tocar el motor.

## Cómo correrlo

Requiere Node 18+ (usa `fetch` nativo). Sin dependencias externas.

```bash
cd agente-multi-nicho
npm start
```

Esto siembra 3 negocios de ejemplo (uno por nicho: turismo, panadería,
clínica dental) la primera vez, y levanta el servidor en
[http://localhost:5180](http://localhost:5180).

Para volver a sembrar sin levantar el servidor: `npm run seed`.

## Qué incluye

- **Cola de aprobación** — tarjetas con el diseño del post (foto real del
  negocio + texto encima, aquí simulado con un degradé mientras no hay carga
  de fotos), su enfoque, fecha programada y estado. Aprobar, rechazar,
  deshacer, pedir otra versión y editar el texto a mano funcionan de verdad
  contra la API.
- **Calendario** — las mismas publicaciones ubicadas en su fecha, con un
  panel de detalle al hacer clic.
- **Selector de negocio** — cambia entre negocios de nichos distintos sin
  recargar la página; cada uno tiene su propio banco de contenido.

## Cómo genera el contenido

Por defecto usa plantillas de texto con los datos reales del negocio
(`server/generator.js`) — costo $0, sin llamadas externas. Si se define la
variable de entorno `ANTHROPIC_API_KEY`, el botón "Otra versión" puede
pedirle a Claude una variante nueva una vez que se agotan las precalculadas;
sin la key, simplemente vuelve a rotar entre las que ya existen.

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

## Estructura

```
server/
  server.js     API REST + servidor estático (Node puro, sin dependencias)
  store.js      Persistencia en JSON (negocios y contenido) — swap a Postgres futuro
  nichos.js     Plantillas por nicho: calendario, enfoques, tono
  generator.js  Genera el banco de contenido (plantillas + hook a Claude)
  seed.js       Crea los negocios de ejemplo
public/
  index.html, app.js, styles.css   El panel (cola + calendario)
data/
  negocios/, contenido/            JSON generado en tiempo de ejecución (no se sube)
```

## Qué falta (siguientes capas)

- **Capa B** — conectores de publicación automática (Instagram vía Graph API
  de Meta, sujeto a App Review y Business Verification; luego otras redes).
- **Capa C** — autoservicio de alta de negocio y cobro (Stripe).
- Subida real de fotos y composición del diseño final en canvas (hoy la
  vista previa usa un degradé de marcador de posición).

Ver el documento de arquitectura y el prototipo visual compartidos en la
conversación para el detalle completo de estas capas.
