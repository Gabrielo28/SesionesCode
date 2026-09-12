# Rubrofy — Capa A

Motor de generación y aprobación de contenido para redes sociales: genera un
banco de publicaciones con datos reales del negocio, el dueño aprueba (o pide
otra versión, o edita el texto a mano), y queda listo para publicar. Esta es
la **Capa A** del producto — no depende de la API de Meta ni de ninguna
aprobación externa, por eso ya es una app que corre y se puede probar hoy.

No está atada a un rubro: agregar un nicho nuevo es escribir su plantilla en
`server/nichos.js` (calendario, enfoques, tono), no tocar el motor.

**Dominio:** rubrofy.com (comprado). Falta apuntarlo al hosting cuando el
proyecto se despliegue en Railway.

**Marca:** logo e ícono ya aplicados — el monograma "R" con la franja de
"rubricación" dentro de un marco tipo cámara, guiño sutil a Instagram sin
copiar su marca.

**Sitio y panel son cosas separadas:** `rubrofy.com` (público) es la landing
de marketing; `rubrofy.com/app` es el panel. Es self-service: cada negocio
crea su propia cuenta en `rubrofy.com/registro.html` (nombre, rubro, email
y clave) y solo ve su propio contenido — no hay una clave maestra que vea
todos los negocios juntos.

## Cómo correrlo

Requiere Node 18+ (usa `fetch` nativo). Sin dependencias externas.

```bash
cd rubrofy
npm run dev
```

`dev` siembra 3 negocios de ejemplo (uno por nicho: turismo, panadería,
clínica dental) y levanta el servidor en
[http://localhost:5180](http://localhost:5180). La clave de los 3 es
`rubrofy123` — entra en `/app` con cualquiera de estos emails:

- `demo-turismo@rubrofy.com`
- `demo-panaderia@rubrofy.com`
- `demo-clinica@rubrofy.com`

Para un servidor real (sin negocios de ejemplo falsos) usar `npm start`,
que no siembra nada — cada negocio se crea desde `/registro.html`.

Para sembrar los ejemplos sin levantar el servidor: `npm run seed`.

## Antes de ponerlo en un servidor público

Definir `SESSION_SECRET` (una cadena larga y al azar) antes de arrancar en
producción:

```bash
SESSION_SECRET=una-cadena-larga-y-al-azar npm start
```

Sin `SESSION_SECRET`, el servidor genera una al azar en cada arranque —
funciona igual, pero todas las sesiones activas se cierran cada vez que el
proceso se reinicia (redeploy, crash, etc.). Con la variable fija, las
sesiones sobreviven un reinicio del servidor.

Las contraseñas se guardan con `scrypt` (costoso de romper por fuerza
bruta), nunca en texto plano.

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
- **Registro self-service** — cada negocio crea su cuenta en `/registro.html`
  (nombre, rubro, email, clave y sus datos reales), sin tocar código ni
  scripts.
- **Configuración** — editar el nombre y los datos del negocio, o eliminar
  la cuenta (borra también su contenido, sus fotos y cierra la sesión). El
  nicho no se puede cambiar una vez creado.

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
  auth.js       Contraseñas (scrypt) y sesiones firmadas (HMAC) por negocio
  store.js      Persistencia en JSON (negocios y contenido) — swap a Postgres futuro
  nichos.js     Plantillas por nicho: calendario, enfoques, tono
  generator.js  Genera el banco de contenido (plantillas + hook a Claude)
  seed.js       Crea los negocios de ejemplo
public/
  site/         Landing pública (rubrofy.com) — marketing + registro, sin sesión
  app/          El panel (rubrofy.com/app) — login, cola, calendario, fotos, config
data/
  negocios/, contenido/, fotos/    Datos y fotos en tiempo de ejecución (no se sube)
```

## Qué falta (siguientes capas)

- **Capa B** — conectores de publicación automática (Instagram vía Graph API
  de Meta, sujeto a App Review y Business Verification; luego otras redes).
- **Capa C** — autoservicio de cobro (Stripe). El login self-service por
  negocio ya está — falta cobrar por la suscripción.

Ver el documento de arquitectura y el prototipo visual compartidos en la
conversación para el detalle completo de estas capas.
