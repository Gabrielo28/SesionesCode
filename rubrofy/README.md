# Rubrofy

Motor de generación y aprobación de contenido para redes sociales: genera un
banco de publicaciones con datos reales del negocio, el dueño aprueba (o pide
otra versión, o edita el texto a mano), y si el negocio conectó su Instagram,
al aprobar se publica de verdad. La aprobación humana (**Capa A**) funciona
sin depender de nada externo; la publicación real (**Capa B**) usa la API de
Instagram y hoy está probada con cuentas agregadas como tester en la app de
Meta — abrirla a cualquier negocio sin agregarlo a mano requiere que Meta
apruebe la app (App Review + Business Verification).

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

Definir también `PUBLIC_URL` (ej. `https://rubrofy.com`) para que el enlace
temporal que se le manda a Instagram para descargar cada foto apunte al
dominio público real y no a la URL interna del servidor. Sin esta variable,
la usa deducida del request — funciona igual en producción normalmente, pero
`PUBLIC_URL` es más confiable detrás de balanceadores/proxies.

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
- **Conexión con Instagram y publicación real** — cada negocio conecta su
  cuenta (ID de usuario + token, obtenidos desde su app de Meta) en
  Configuración. Al aprobar una pieza que tiene una foto real asignada, se
  publica de verdad vía la Instagram Graph API; si falla, la pieza queda
  igual como aprobada y el error se muestra en la tarjeta, sin bloquear el
  flujo. Sin conexión, o sin foto real, aprobar solo marca la pieza como
  aprobada (como antes).

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
  auth.js       Contraseñas (scrypt), sesiones firmadas y token temporal de foto
  instagram.js  Publicación real vía Instagram Graph API
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

- **Capa B** — la publicación real a Instagram ya funciona (probada de punta
  a punta), pero conectar la cuenta hoy es manual: el negocio pide su ID y
  token siguiendo los pasos de Meta (agregar la app como tester, generar el
  token) y los pega en Configuración. Para que cualquier negocio conecte su
  Instagram con un botón (sin pasar por el panel de Meta) hace falta App
  Review + Business Verification, y armar el flujo de login con Instagram
  (OAuth) en vez del campo manual.
- **Capa C** — autoservicio de cobro (Stripe). El login self-service por
  negocio ya está — falta cobrar por la suscripción.

Ver el documento de arquitectura y el prototipo visual compartidos en la
conversación para el detalle completo de estas capas.
