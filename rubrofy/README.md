# Rubrofy

Motor de generación y aprobación de contenido para redes sociales: genera un
banco de publicaciones con datos reales del negocio, el dueño aprueba (o pide
otra versión, o edita el texto a mano), y si el negocio conectó su Instagram,
lo aprobado se publica solo en su fecha y hora. La aprobación humana (**Capa A**) funciona
sin depender de nada externo; la publicación real (**Capa B**) usa la API de
Instagram y hoy está probada con cuentas agregadas como tester en la app de
Meta — abrirla a cualquier negocio sin agregarlo a mano requiere que Meta
apruebe la app (App Review + Business Verification).

No está atada a un rubro: al registrarse, cada negocio describe con sus
propias palabras a qué se dedica, y Claude genera su estrategia de
contenido (tono, enfoques y categorías de foto) a la medida — no hay una
lista fija de rubros ni una plantilla que tocar para sumar uno nuevo.

**Dominio:** rubrofy.com (comprado). Falta apuntarlo al hosting cuando el
proyecto se despliegue en Railway.

**Marca:** logo e ícono ya aplicados — el monograma "R" con la franja de
"rubricación" dentro de un marco tipo cámara, guiño sutil a Instagram sin
copiar su marca.

**Sitio y panel son cosas separadas:** `rubrofy.com` (público) es la landing
de marketing; `rubrofy.com/app` es el panel. Es self-service: cada negocio
crea su propia cuenta en `rubrofy.com/registro.html` (nombre, una
descripción libre de su rubro, email y clave) y solo ve su propio
contenido — no hay una clave maestra que vea todos los negocios juntos.

**Modelo de negocio:** freemium por niveles, por negocio. El plan Gratis usa
solo plantillas (sin IA, sin costo) y sirve de puerta de entrada; los planes
Pro y Estudio agregan generación con Claude y, en Estudio, una cuota de
fotos generadas por IA — ver `server/planes.js` y la sección de Stripe más
abajo.

## Cómo correrlo

Requiere Node 22.13+ (usa `fetch` nativo y la base de datos SQLite que
trae Node, `node:sqlite`). Sin dependencias externas.

```bash
cd rubrofy
npm run dev
```

`dev` siembra 3 negocios de ejemplo (uno por rubro: turismo, panadería,
clínica dental) y levanta el servidor en
[http://localhost:5180](http://localhost:5180). La clave de los 3 es
`rubrofy123` — entra en `/app` con cualquiera de estos emails. Cada uno
queda a propósito en un plan distinto, para ver los tres niveles sin tocar
Stripe:

- `demo-turismo@rubrofy.com` — plan Estudio (texto + fotos con IA)
- `demo-panaderia@rubrofy.com` — plan Pro (solo texto con IA)
- `demo-clinica@rubrofy.com` — plan Gratis (plantillas, sin IA)

Para un servidor real (sin negocios de ejemplo falsos) usar `npm start`,
que no siembra nada — cada negocio se crea desde `/registro.html`.

Para sembrar los ejemplos sin levantar el servidor: `npm run seed`.

## Antes de ponerlo en un servidor público

**Paso a paso para Railway: [DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md)** (Volume,
variables, dominio rubrofy.com y URLs de Stripe, Google y Meta).

**Datos persistentes:** todo vive en una carpeta de datos — la base
`rubrofy.db` (negocios, colas de contenido, métricas), las fotos, los videos
y los ejemplos de "Mi estilo". Por defecto es `rubrofy/data`; en producción
se apunta a un disco persistente con `RUBROFY_DATA_DIR` (en Railway, un
Volume montado en `/data`). Si hay datos de una versión anterior en
archivos JSON (`negocios/`, `contenido/`), se migran solos a la base la
primera vez que arranca y las carpetas viejas quedan como respaldo
(`*.migrado-<fecha>`).

**Sesiones:** se firman con `SESSION_SECRET`. Si no la defines, Rubrofy
genera una y la guarda en la carpeta de datos (`.session-secret`), así que
las sesiones sobreviven a los reinicios siempre que esa carpeta sea
persistente.

Las contraseñas se guardan con `scrypt` (costoso de romper por fuerza
bruta), nunca en texto plano.

Registro y login tienen límite de intentos por IP (5 registros por hora,
10 logins fallidos cada 15 minutos; ver `server/limites.js`). El registro
llama a Claude para diseñar la estrategia, así que sin este límite un bot
podría gastar la key creando cuentas. Detrás de un proxy, la IP real se lee
de `X-Forwarded-For`: en Railway se detecta solo; en otro hosting con proxy
hay que definir `TRUST_PROXY=1`. Sin proxy no se debe definir, porque ese
header lo podría escribir cualquiera para esquivar el límite.

Definir también `PUBLIC_URL` (ej. `https://rubrofy.com`) para que el enlace
temporal que se le manda a Instagram para descargar cada foto apunte al
dominio público real y no a la URL interna del servidor. Sin esta variable,
el publicador usa la URL desde la que se aprobó cada pieza — funciona, pero
`PUBLIC_URL` es más confiable detrás de balanceadores/proxies.

Opcionales: `META_GRAPH_VERSION` (versión de la Graph API de Meta, por
defecto `v25.0`), `RUBROFY_TZ` (zona horaria de las fechas de
publicación, por defecto `America/Santiago`) y `PUBLICADOR_INTERVALO_SEG`
(cada cuántos segundos revisa lo programado, por defecto 30).

## Qué incluye

- **Cola de aprobación** — tarjetas con el diseño real del post: si hay una
  foto cargada para su categoría, un `<canvas>` la compone con logo y texto
  encima (igual que el programa original); si no, muestra un degradé de
  marcador. Aprobar, rechazar, deshacer, pedir otra versión y editar el
  texto a mano funcionan de verdad contra la API.
- **Calendario** — las mismas publicaciones ubicadas en su fecha, con un
  panel de detalle al hacer clic.
- **Fotos del negocio** — subir y borrar fotos por categoría (las categorías
  las define la estrategia del negocio); el contenido las usa automáticamente
  según el enfoque de cada pieza. Si una pieza no tiene foto real todavía,
  se puede generar una con IA como respaldo (ver más abajo).
- **Registro self-service** — cada negocio crea su cuenta en `/registro.html`
  (nombre, una descripción libre de su rubro, email, clave y sus datos
  reales), sin tocar código ni scripts. Al crear la cuenta, Claude genera
  su estrategia de contenido a la medida (ver más abajo).
- **Configuración** — editar el nombre y los datos del negocio, o eliminar
  la cuenta (borra también su contenido, sus fotos y cierra la sesión). El
  rubro y su estrategia de contenido no se pueden cambiar una vez creados.
- **Conexión con Instagram y publicación programada** — cada negocio conecta
  su cuenta (ID de usuario + token, obtenidos desde su app de Meta) en
  Configuración. Aprobar deja la pieza **programada** para su fecha y hora
  (hora de Chile, no la del servidor); el publicador la publica solo cuando
  llega el momento, con su foto real o una generada por IA como respaldo.
  Ver "Cómo publica" más abajo. Sin Instagram conectado, aprobar solo marca
  la pieza como aprobada.
- **Formatos** — cada pieza puede ser Post (una foto), Carrusel (de 2 a
  10 fotos de su categoría), Reel (video 9:16 subido a la tarjeta,
  obligatorio) o Historia (foto, o video si se sube uno). El formato se
  elige en la tarjeta; los videos pesan hasta 100 MB (`MAX_VIDEO_MB`) y
  se guardan en `data/videos/`. Meta procesa los videos unos minutos antes
  de poder publicarlos: el publicador consulta el estado cada minuto sin
  gastar reintentos.
- **Fecha y hora editables** — se cambian tocando la fecha en la tarjeta.
  "Publicar ahora" adelanta una programada; "Reintentar" vuelve a intentar
  una que falló.
- **Fotos generadas por IA** — cuando una pieza no tiene una foto real
  subida para su categoría, se puede pedir una foto generada por IA
  (botón "Generar foto con IA" en la tarjeta, o automáticamente al aprobar
  si Instagram está conectado). Requiere `OPENAI_API_KEY` y el plan
  Estudio; sin ellos, la pieza sigue mostrando el degradé de marcador de
  siempre. En Configuración, cada negocio elige si esa foto generada debe
  quedar limpia (sin texto) o con el titular incrustado como una gráfica de
  marketing — nunca reemplaza una foto real ya subida.
- **Plan y cobro** — en Configuración, cada negocio ve su plan actual, sube
  a Pro o Estudio (Stripe Checkout) o gestiona su suscripción (Billing
  Portal). El plan Gratis usa solo plantillas; Pro y Estudio habilitan la
  IA de texto (con un techo mensual de piezas, contra el abuso), y Estudio
  agrega una cuota mensual de fotos con IA.
- **Publicación sin duplicados** — cada pieza se publica una sola vez: un
  doble clic mientras se publica se ignora, y una pieza ya publicada que se
  deshace y se vuelve a aprobar no se publica de nuevo (deshacer no la
  borra de Instagram; el panel lo advierte).

## Cuenta: recuperar clave y correos del servicio

- **Olvidé mi clave** (`/app/recuperar.html`): `POST /api/auth/recuperar
  { email }` responde lo mismo exista o no la cuenta (y sin esperar el envío,
  para que el tiempo tampoco lo delate; 5 por hora por conexión). Manda un
  enlace a `/app/restablecer.html` que vale 30 minutos y sirve una vez (va
  ligado a la clave actual). `POST /api/auth/restablecer` guarda la clave
  nueva y cierra las sesiones abiertas antes (`sesionesDesde`).
- **Correos** (con `RESEND_API_KEY` y `EMAIL_FROM`, ver server/avisos.js):
  bienvenida al registrarse, enlace para cambiar la clave, aviso inmediato
  cuando Instagram deja de aceptar la conexión (una vez por desconexión) y
  el resumen semanal de los lunes.
- **Legal**: `/privacidad.html`, `/terminos.html` y `/eliminar-datos.html`
  (email de contacto desde `CONTACTO_EMAIL`). Registrarse exige aceptarlos.

## Panel de administración (server/admin.js, /admin)

Para quien administra la plataforma. Se activa con `ADMIN_EMAILS` (emails
separados por coma de cuentas de Rubrofy); esas cuentas ven el enlace
"Administración" en su menú y entran a `/admin`. Sin la variable, `/admin`
y `/api/admin/*` responden 404, y también para cualquier otra cuenta.

Muestra **métricas y estado, no el contenido de cada negocio** (decisión
explícita: no hay acceso total): negocios, activos en 7 días, cuántos pagan
y el ingreso mensual (MRR), visitas al sitio y conversión a registro,
publicaciones y aprobaciones por día, lo que está por resolver (fallidas,
Instagram por reconectar), el embudo (registro → bienvenida → primera
aprobación → Instagram → primera publicación → pago), la etapa de la ruta de
cada negocio, planes, de dónde llegan las visitas, uso de IA del mes y qué
integraciones están configuradas. La lista de negocios trae nombre, email,
plan, alta, última actividad, etapa, estado de Instagram y conteos de
piezas; se puede buscar, ordenar y descargar en CSV. Nunca incluye textos,
fotos, estrategias, datos, resultados ni tokens.

Visitas: se cuentan en el servidor por día y página (`/` y `/registro.html`),
sin cookies ni IP y sin bots; el origen se guarda solo como dominio.

## Conectar con Instagram y resumen semanal (server/instagram.js, server/avisos.js, server/correo.js)

**Conectar con Instagram**: con `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`,
el panel muestra el botón "Conectar con Instagram" (también en el último
paso de la bienvenida). El dueño inicia sesión en Instagram y acepta los
permisos `instagram_business_basic`, `instagram_business_content_publish` e
`instagram_business_manage_insights`. `GET /api/negocios/:id/instagram/conectar`
redirige con un state firmado y ligado a la sesión (igual que Google);
`GET /api/instagram/callback` canjea el código, lo cambia por un token de 60
días (que el publicador renueva solo), lee el ID de la cuenta profesional y
el @usuario, y programa lo aprobado que estaba esperando. Sin esas
variables se sigue conectando pegando ID y token.

**Resumen semanal**: con `RESEND_API_KEY` y `EMAIL_FROM`, cada lunes desde
las 8:00 (hora del negocio) llega un correo con las 3 tareas de la ruta y
lo que se publica en los próximos 7 días. Una vez por semana ISO, solo a
quien terminó la bienvenida y solo si hay algo que contar. Se apaga desde
Conexiones y ajustes (`PUT /api/negocios/:id/avisos`) o con el enlace
firmado del correo (`GET /api/avisos/baja`, también en `List-Unsubscribe`).
`POST /api/negocios/:id/avisos/prueba` lo manda en el momento (3 por hora).

## La ruta del cliente (server/ruta.js, public/app/inicio.js)

El panel y el sitio siguen la misma ruta de cuatro etapas:

| Etapa | Cuándo | Pasos |
|---|---|---|
| 1. Configura | Una vez | Bienvenida (datos, objetivo, tono, cuánto publicar, estrategia), conectar Instagram, fotos en cada categoría, 5 ejemplos en Mi estilo |
| 2. Crea | Cada semana | Tener lista la próxima semana (según el plan), aprobar, subir videos de reels y fotos que faltan, corregir lo que no se pudo publicar |
| 3. Mide | Automático | Resultados (Pro), publicidad con Meta/Google Ads (Estudio), competencia (Estudio) |
| 4. Mejora | Cada mes | Leer el informe del mes anterior (Pro) y ajustar la estrategia |

`GET /api/negocios/:id/ruta` calcula el estado de cada paso con los datos
reales (hecho, pendiente, bloqueado por plan o próximo), la etapa en que va
el negocio y las 3 acciones más urgentes ("Qué hacer ahora" en Inicio). Lo
urgente primero: publicaciones fallidas, Instagram por reconectar, lo que
sale en los próximos 3 días sin aprobar o sin video/foto. El menú del panel
está agrupado por estas etapas. `POST /api/negocios/:id/ruta/informe-visto`
marca el informe del mes como leído.

## Bienvenida, estrategia y plan semanal (server/plan-contenido.js, public/app/bienvenida.js)

Al registrarse ya no se genera contenido de inmediato. La primera vez que el
negocio entra al panel, una **bienvenida** de 5 pasos le pregunta:

1. **Tu negocio**: precio, unidad, producto destacado, promoción, a quién le
   habla y qué lo hace distinto.
2. **Objetivo y tono**: vender más, más reservas o consultas, ganar
   seguidores, fidelizar o dar a conocer la marca (uno o dos), y cómo quiere
   sonar.
3. **Cuánto publicar**: posts, carruseles, reels e historias por semana (con
   ritmos sugeridos) y la hora de los posts.
4. **Tu estrategia**: Claude la propone con todo lo anterior (resumen, tono y
   enfoques) y el dueño la ajusta a mano.
5. **Conexiones**: dónde conectar Instagram, Meta Ads y Google Ads. Termina
   generando la primera semana según el plan.

Después todo se cambia en **Estrategia**. **Generar semana** crea exactamente
la mezcla del plan (máximo 12 por vez) y la reparte en la semana, después de
lo que ya está programado: las piezas del feed parejas en los 7 días y las
historias aparte, a las 18:30. **Inicio** muestra los primeros pasos
pendientes (conectar Instagram, subir fotos, Mi estilo...), lo próximo que
se publica y el plan.

API: `GET /api/plan-contenido` (opciones), `PUT /api/negocios/:id/plan-contenido`,
`PUT /api/negocios/:id/estrategia`, `POST /api/negocios/:id/estrategia/generar`
(mantiene las categorías de foto; máx. 10 por hora), `POST /api/negocios/:id/bienvenida`
y `POST /api/negocios/:id/generar { segunPlan: true }`.

## Resultados y aprendizaje (server/analitica.js, server/aprendizaje.js)

En los planes Pro y Estudio, con Instagram conectado, Rubrofy sincroniza
cada 12 horas las métricas de la cuenta (seguidores, alcance, vistas,
interacciones) y de cada post de los últimos 30 días, y las guarda en la
base. La vista **Resultados** muestra:

- seguidores, alcance, interacciones, tasa de interacción y **% de piezas
  aprobadas sin cambios** (qué tanto la IA ya escribe como el dueño);
- alcance e interacciones por día, con los datos también como tabla;
- **qué enfoques funcionan** (interacción promedio de los posts hechos con
  cada enfoque de la estrategia);
- **cuándo publicar**: mapa de día × franja con la interacción promedio;
- las mejores publicaciones del período.

La IA usa todo eso al generar: textos que el dueño aprobó tal cual, cómo
corrige los de la IA, qué rechazó, y los enfoques y posts con mejores
resultados. El enfoque ganador sale más seguido y, si hay datos suficientes
(8+ posts y una franja clara), los posts se programan a la hora que mejor
le funciona a esa cuenta.

Requiere que el token de Instagram tenga el permiso
`instagram_business_manage_insights`; si no lo tiene, Resultados lo avisa y
la publicación sigue funcionando igual. Una sincronización usa unas 30 a 45
llamadas (el límite de Meta es ~200 por hora por cuenta).

## Meta Ads (server/meta.js)

En el plan Estudio, Resultados → **Meta Ads** muestra la inversión, los
resultados (compras, formularios y conversaciones iniciadas por WhatsApp,
Messenger o Instagram Direct), el costo por resultado, CTR, CPC, ROAS y una
tabla por campaña, también como sección del informe mensual. Es **solo
lectura**: Rubrofy no crea ni modifica campañas. Si hay inversión y ningún
resultado, avisa que puede faltar configurar las conversiones.

**Conexión con Meta** (Configuración): es distinta de la de Instagram y
sirve también para la competencia. Se pega un token de Meta con los
permisos `ads_read`, `pages_show_list`, `pages_read_engagement` e
`instagram_basic`; Rubrofy lista las cuentas publicitarias y las cuentas de
Instagram a las que tiene acceso y el negocio elige. Lo más práctico es un
token de **usuario del sistema** de Business Manager, que no vence. Con
`META_APP_ID` y `META_APP_SECRET` configurados, un token de usuario se
canjea por uno de larga duración (~60 días). Si Meta lo rechaza, la
conexión queda en "Reconectar" sin afectar la publicación en Instagram.

Se sincroniza cada 12 h: la primera vez 30 días, después los últimos 3
(Meta sigue atribuyendo conversiones a días anteriores).

## Google Ads (server/google.js)

En el plan Estudio, Resultados → **Google Ads** muestra inversión, clics,
conversiones, costo por conversión, ROAS y campañas (mismo panel que Meta
Ads), y se suma al informe mensual. **Solo lectura.**

- **Conexión**: en Configuración, "Conectar con Google" abre el inicio de
  sesión de Google (permiso `adwords`, acceso sin conexión) y vuelve a
  `/api/google/callback`. El parámetro `state` va firmado, dura 15 minutos
  y tiene que coincidir con la sesión, así nadie puede enganchar su cuenta
  de Google a la de otro. Si la cuenta es administradora (MCC), se listan
  sus clientes y se consulta con `login-customer-id`.
- **Sincronización** con GAQL (`searchStream`, 1 operación por consulta):
  30 días la primera vez, después los últimos 7 (Google sigue atribuyendo
  conversiones). Performance Max entrega menos detalle que Búsqueda.
- **Configurar**: crear en Google Cloud un proyecto con la API de Google
  Ads habilitada y el acceso solicitado (Explorer alcanza para empezar),
  un cliente OAuth de tipo "aplicación web" con la URI de redirección
  `https://<tu dominio>/api/google/callback`, y definir `GOOGLE_CLIENT_ID`
  y `GOOGLE_CLIENT_SECRET`. Opcionales: `GOOGLE_ADS_DEVELOPER_TOKEN` (si el
  proyecto todavía usa uno) y `GOOGLE_ADS_API_VERSION` (por defecto `v25`).
  El permiso `adwords` es "sensible": hasta que Google verifique la app,
  admite 100 usuarios y muestra la pantalla de "app no verificada".

## Competencia (server/competencia.js)

En el plan Estudio, Resultados → **Competencia** compara la cuenta del
negocio con hasta 5 competidores: seguidores y su variación en 30 días,
publicaciones de los últimos 30 días, interacción promedio por post (me
gusta + comentarios de los últimos 12), su mejor post reciente y un enlace
a sus anuncios activos en la Biblioteca de Anuncios de Meta. También va en
el informe mensual.

Usa Business Discovery, que solo existe en la API de Instagram con inicio
de sesión de **Facebook**: por eso depende de la conexión con Meta (y de
elegir ahí la cuenta de Instagram del negocio). Solo funciona con cuentas
profesionales y entrega datos públicos (no el alcance de otros). Los
anuncios de la competencia no se leen por API porque, en Chile, la API de
la Biblioteca de Anuncios solo incluye anuncios políticos; se enlaza la
búsqueda pública. Una foto por competidor al día (1 llamada cada uno).

## Mi estilo (server/estilo.js)

El negocio le muestra a Rubrofy el contenido que ya hace para que la IA
aprenda su estilo:

- **Importar de Instagram**: trae de un clic las últimas 30 publicaciones
  y las historias activas (texto, formato e imagen o portada), sin
  duplicar lo ya importado.
- **Agregar a mano**: formato (post, carrusel, reel o historia), texto,
  captura opcional y una nota ("así hacemos las promos de los viernes").
  Hasta 60 ejemplos por negocio.
- **Guía de estilo**: en Pro y Estudio, "Analizar mi estilo con IA" hace
  que Claude estudie los ejemplos (incluidas hasta 6 imágenes) y escriba
  una guía general y por formato (usa 1 de la cuota mensual). El dueño la
  puede corregir y su versión manda.

El generador usa la guía y 2 ejemplos reales del mismo formato en cada
lote, reparte los formatos en la misma proporción que muestran los
ejemplos (con 5 o más) y propone para cada pieza la **idea** de qué
mostrar (la foto de un post, las láminas de un carrusel, las tomas de un
reel, el sticker de una historia), que se ve en la tarjeta.

## Informe mensual (server/informe.js, /app/informe.html)

Desde Resultados, "Informe mensual" abre una página lista para imprimir o
guardar como PDF (A4, fondo claro): conclusión, indicadores con la
variación frente al mes anterior, alcance e interacciones diarias, qué
enfoques funcionaron, cuándo publicar, las publicaciones con más
interacción, lo publicado con Rubrofy y cuánto se aprobó sin cambios.

- **Conclusión** ("Qué pasó / Qué funcionó / Qué haremos el próximo mes"):
  la escribe Claude a partir de los datos del informe (usa 1 de la cuota
  mensual de piezas con IA) y se guarda; sin IA, o si Claude no responde,
  queda un resumen automático armado con reglas.
- **Compartir**: "Copiar enlace" genera un enlace firmado de solo lectura
  para ese mes, válido 30 días, que se abre sin iniciar sesión (para el
  cliente de una agencia o un socio).
- Otros módulos agregan sus secciones con `informe.registrarSeccion()`.

## Guardián de marca (server/guardian.js)

Cada pieza llega a la cola con una lista de **qué verificar** antes de
aprobarla (se ve en la tarjeta; no bloquea nada):

- promesas de salud o de resultados ("garantizado", "cura", "sin dolor",
  "resultados inmediatos"...), delicadas en clínicas, estética o
  suplementos;
- precios, porcentajes de descuento o fechas que no están en los datos del
  negocio (la IA pudo inventarlos);
- frases de plantilla que suenan a texto genérico de IA.

Se recalcula al editar, al pedir otra versión y al cambiar los datos del
negocio. Sin IA ni dependencias: funciona en todos los planes.

## Sitio público

La sección **Precios** del sitio lee `/api/planes`, la misma tabla que usa
el cobro (`server/planes.js`): cambiar un precio o una cuota ahí actualiza
el sitio, el panel y Stripe a la vez.

## Cómo publica (server/publicador.js)

Un proceso dentro del mismo servidor revisa cada 30 segundos las piezas
aprobadas cuya hora ya llegó y las publica en dos pasos (crear el contenedor
en Instagram, luego publicarlo). Lo que hace ante cada problema:

| Situación | Qué pasa |
|---|---|
| Error pasajero de Instagram o de red | Reintenta a los 1, 5, 15, 60 y 180 minutos; después queda "No se publicó" con el motivo y el botón "Reintentar" |
| Meta dice "límite de llamadas" | Igual, pero espera al menos 15 minutos |
| Falló al publicar un contenedor ya creado | El reintento publica **ese mismo** contenedor (no crea otro post) |
| El servidor se cae a mitad de una publicación | Al arrancar, la pieza vuelve a programada y se retoma con su contenedor |
| Token vencido o revocado | El negocio queda en "Reconectar" (aviso en Configuración y en las tarjetas); sus piezas esperan sin gastar reintentos y se publican solas al pegar un token nuevo |
| Contenido inválido (ej. texto demasiado largo) o pieza sin foto | "No se publicó" con el motivo, sin reintentos automáticos |
| Reel o historia con video en proceso | Consulta el estado cada minuto (hasta 15 veces) sin gastar reintentos |
| Meta no pudo procesar el video | "No se publicó" con el detalle de Meta; al reintentar se crea un contenedor nuevo con el video actual |
| Un reintento encuentra que el post ya se había publicado | Se marca publicada, sin publicar de nuevo |

El token de Instagram (dura 60 días) se renueva solo: el primero a las
24 horas de conectado y después cada 7 días.

Corre en un solo proceso, sin colas externas: suficiente para una
instancia. Con varias instancias habría que mover el bloqueo a la base de
datos (parte del paso a Postgres).

## Cómo genera el contenido

La IA es el cerebro: al registrarse, cada negocio escribe con sus propias
palabras a qué se dedica, y `server/estrategia.js` le pide a Claude que
diseñe su estrategia de contenido (tono, 4 enfoques con su intención, y
las categorías de foto que tiene sentido que ese negocio suba) — así se
adapta a cualquier rubro, no solo a una lista fija de nichos.

Con esa estrategia, `server/generator.js` le pide a Claude que escriba los
titulares y captions reales del banco inicial (una sola llamada por lote).
El botón "Otra versión" también le pide a Claude una variante nueva una vez
que se agotan las precalculadas.

Sin `ANTHROPIC_API_KEY` configurada, todo esto cae a un modo genérico sin
costo ni llamadas externas: una estrategia de respaldo razonable (enfoques
de producto/precio/urgencia/detrás de escena) y captions con plantillas de
texto que usan los datos reales del negocio.

Por defecto usa Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — rápido y
barato, pensado para textos cortos. Se puede cambiar por otro modelo con
`ANTHROPIC_MODEL` (por ejemplo un Sonnet u Opus, si se prefiere mejor
calidad de escritura a cambio de más costo por llamada):

```bash
ANTHROPIC_API_KEY=sk-ant-... ANTHROPIC_MODEL=claude-sonnet-5 npm start
```

## Cómo genera las fotos por IA

Es un proveedor separado (OpenAI) con su propio costo, aparte del de
Claude — por eso es una variable de entorno distinta. Sin `OPENAI_API_KEY`
configurada, esta función queda desactivada por completo (el botón
"Generar foto con IA" muestra un error, y al aprobar sin foto real sigue
funcionando igual que siempre, sin publicar).

```bash
OPENAI_API_KEY=sk-... npm start
```

Por defecto usa `gpt-image-1`; se puede cambiar con `OPENAI_IMAGE_MODEL`.

## Planes y cobro (Stripe)

Todo negocio nace en el plan **Gratis** (sin tarjeta, como dice el
formulario de registro). Para subir a **Pro** o **Estudio** desde
Configuración, el panel abre una sesión de Stripe Checkout; Stripe cobra la
suscripción y avisa al servidor por webhook cuándo se activó, canceló o
falló el pago — el servidor nunca ve ni guarda el número de tarjeta.
"Gestionar suscripción" (cambiar tarjeta, cancelar) abre el Billing Portal
de Stripe, así que tampoco hace falta construir esa pantalla.

Los precios y cuotas están en `server/planes.js` — cambiarlos ahí no
requiere tocar Stripe ni el resto del código, salvo que cambie qué plan
corresponde a qué precio (ver más abajo). Las cuotas de IA (piezas de texto
y fotos por mes) se reinician solas el día 1 de cada mes.

**Cambio de plan con una suscripción activa** (por ejemplo, de Pro a
Estudio): no se abre un Checkout nuevo, porque crearía una segunda
suscripción cobrando en paralelo. El servidor cambia el precio de la misma
suscripción, con prorrateo: la diferencia se cobra en la próxima factura.
Bajar de plan o cancelar se hace desde "Gestionar suscripción". Si igual
llegaran a pagarse dos Checkouts (dos pestañas abiertas a la vez), el
webhook cancela la suscripción anterior y deja solo la nueva.

Para activarlo:

1. Crear una cuenta de Stripe (modo de prueba sirve para no cobrar de
   verdad todavía) y conseguir la clave secreta en el Dashboard.
2. Correr el script que crea los dos planes pagados como productos/precios
   de Stripe:
   ```bash
   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.js
   ```
   Imprime los IDs de precio (`price_...`) para las variables de abajo.
3. En el Dashboard de Stripe, agregar un endpoint de webhook apuntando a
   `https://tu-dominio.com/api/stripe/webhook`, con los eventos
   `checkout.session.completed`, `customer.subscription.updated` y
   `customer.subscription.deleted`. Copiar el "Signing secret" que muestra.
4. Arrancar el servidor con todo junto:
   ```bash
   STRIPE_SECRET_KEY=sk_test_... \
   STRIPE_WEBHOOK_SECRET=whsec_... \
   STRIPE_PRICE_PRO=price_... \
   STRIPE_PRICE_ESTUDIO=price_... \
   npm start
   ```

Sin `STRIPE_SECRET_KEY`, todos los negocios quedan en el plan Gratis y los
botones de "Actualizar" muestran "Próximamente" — no rompe nada, solo no
se puede cobrar todavía.

## Estructura

```
server/
  server.js     API REST + servidor estático (Node puro, sin dependencias)
  auth.js       Contraseñas (scrypt), sesiones firmadas y token temporal de foto
  instagram.js  Cliente de la Instagram Graph API (contenedor, publicación, renovación de token)
  publicador.js Proceso de fondo: publica lo programado, reintenta y renueva tokens
  analitica.js  Sincroniza métricas de Instagram y calcula Resultados (resumen, enfoques, mejor horario)
  aprendizaje.js Lo que la IA aprende de cada negocio (aprobaciones, correcciones, resultados)
  informe.js    Datos del informe mensual y su conclusión (Claude o automática)
  estilo.js     "Mi estilo": ejemplos del negocio, importación desde Instagram y guía de estilo con IA
  meta.js       Conexión con Meta (lado Facebook) y Meta Ads de solo lectura
  google.js     Google Ads de solo lectura (OAuth con Google, GAQL)
  competencia.js Seguimiento de competidores en Instagram (Business Discovery)
  guardian.js   Qué verificar en cada texto antes de aprobarlo (promesas, datos inventados, frases genéricas)
  programacion.js Fechas de publicación en la zona horaria del negocio
  imagenes.js   Genera fotos de respaldo con IA (OpenAI) para piezas sin foto real
  datos.js      Carpeta de datos (RUBROFY_DATA_DIR / Volume de Railway)
  store.js      Persistencia: SQLite (node:sqlite) para negocios, contenido y métricas; fotos y videos en disco
  estrategia.js Genera con Claude la estrategia de contenido de cada negocio (tono, enfoques, categorías de foto) a partir de su rubro
  generator.js  Genera el banco de contenido (titulares + captions vía Claude, con respaldo genérico)
  planes.js     Definición de los planes (precio, cuotas) — la única tabla que hay que tocar para cambiar precios
  stripe.js     Cliente mínimo de Stripe por REST (checkout, billing portal, verificación de webhook)
  limites.js    Límite de intentos por IP para registro y login
  seed.js       Crea los negocios de ejemplo (con estrategias ya escritas a mano)
scripts/
  setup-stripe.js  Crea los productos/precios de los planes pagados en Stripe (correr una vez)
public/
  site/         Landing pública (rubrofy.com) — marketing + registro, sin sesión
  app/          El panel (rubrofy.com/app) — login, cola, calendario, fotos, config, plan
data/
  negocios/, contenido/, fotos/, fotos-ia/    Datos y fotos en tiempo de ejecución (no se sube)
```

## Qué falta (siguientes capas)

- **Capa B** — la publicación real a Instagram ya funciona (probada de punta
  a punta), pero conectar la cuenta hoy es manual: el negocio pide su ID y
  token siguiendo los pasos de Meta (agregar la app como tester, generar el
  token) y los pega en Configuración. Para que cualquier negocio conecte su
  Instagram con un botón (sin pasar por el panel de Meta) hace falta App
  Review + Business Verification, y armar el flujo de login con Instagram
  (OAuth) en vez del campo manual.
- **Capa C** — el cobro ya funciona (Checkout + Billing Portal + webhook,
  ver la sección de Stripe más arriba); falta correr `setup-stripe.js` y
  configurar las variables de entorno en el servidor real para activarlo en
  producción, y decidir si BYOK (que un negocio use su propia key de
  Anthropic/OpenAI para saltarse la cuota) vale la pena construir.

Ver el documento de arquitectura y el prototipo visual compartidos en la
conversación para el detalle completo de estas capas.
