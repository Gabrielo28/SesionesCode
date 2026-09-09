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
npm run dev
```

`dev` siembra 3 negocios de ejemplo (uno por nicho: turismo, panadería,
clínica dental) y levanta el servidor en
[http://localhost:5180](http://localhost:5180). Para un servidor real
(sin negocios de ejemplo falsos) usar `npm start`, que no siembra nada —
los negocios se crean desde el panel con el botón "+".

Para sembrar los ejemplos sin levantar el servidor: `npm run seed`.

## Antes de ponerlo en un servidor público

Por defecto el panel queda **abierto a cualquiera con el link** — no hay
usuarios ni contraseña. Definir `ACCESS_KEY` lo protege con una clave
única (mismo patrón que el `ADMIN_TOKEN` de Colchones Yolé): el navegador
pide usuario y contraseña, y solo importa la contraseña.

```bash
ACCESS_KEY=una-clave-larga-y-dificil-de-adivinar npm start
```

Sin `ACCESS_KEY`, el servidor arranca igual pero avisa en la consola que
quedó abierto — pensado solo para probar en el propio computador.

## Qué incluye

- **Cola de aprobación** — tarjetas con el diseño real del post: si hay una
  foto cargada para su categoría, un `<canvas>` la compone con logo y texto
  encima (igual que el programa original); si no, muestra un degradé de
  marcador. Aprobar, rechazar, deshacer, pedir otra versión y editar el
  texto a mano funcionan de verdad contra la API.
- **Calendario** — las mismas publicaciones ubicadas en su fecha, con un
  panel de detalle al hacer clic.
- **Fotos del negocio** — subir y borrar fotos por categoría (las categorías
  las define la plantilla del nicho); el contenido las usa automáticamente
  según el enfoque de cada pieza.
- **Nuevo negocio** — alta desde el panel (botón "+" junto al selector), sin
  tocar código ni scripts: nombre, nicho y los datos reales del negocio.
- **Configuración** — editar el nombre y los datos de un negocio existente,
  o eliminarlo (borra también su contenido y sus fotos). El nicho no se
  puede cambiar una vez creado.
- **Selector de negocio** — cambia entre negocios de nichos distintos sin
  recargar la página; cada uno tiene su propio banco de contenido y sus
  propias fotos.

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
  negocios/, contenido/, fotos/    Datos y fotos en tiempo de ejecución (no se sube)
```

## Qué falta (siguientes capas)

- **Capa B** — conectores de publicación automática (Instagram vía Graph API
  de Meta, sujeto a App Review y Business Verification; luego otras redes).
- **Capa C** — autoservicio de cobro (Stripe) y login propio por negocio
  (hoy cualquiera que abra el panel ve todos los negocios — no hay cuentas).

Ver el documento de arquitectura y el prototipo visual compartidos en la
conversación para el detalle completo de estas capas.
