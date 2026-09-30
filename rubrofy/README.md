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

**Modelo de negocio:** solo de pago, por negocio: sin plan gratis. La
puerta de entrada es una **prueba gratis de 7 días del plan Pro** que se
activa dejando nombre, correo y teléfono (ver "Solo de
pago y prueba gratis" más abajo). Pro genera con Claude
(piezas completas: gancho, texto con llamado a la acción y hashtags) y
Estudio agrega fotos y videos con IA — ver `server/planes.js` y la sección
de Stripe más abajo.

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
- `demo-clinica@rubrofy.com` — sin plan (muestra el aviso para elegir un plan)

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
  si Instagram está conectado). Requiere `HIGGSFIELD_API_KEY` u `OPENAI_API_KEY` y el plan
  Estudio; sin ellos, la pieza sigue mostrando el degradé de marcador de
  siempre. En Configuración, cada negocio elige si esa foto generada debe
  quedar limpia (sin texto) o con el titular incrustado como una gráfica de
  marketing — nunca reemplaza una foto real ya subida.
- **Plan y cobro** — en Configuración, cada negocio ve su plan actual, sube
  a Pro o Estudio (Stripe Checkout) o gestiona su suscripción (Billing
  Portal). Sin plan no se crea contenido
  nuevo; Pro y Estudio habilitan la IA de texto (con un techo mensual de
  piezas, contra el abuso), y Estudio agrega fotos y videos con IA.
- **Publicación sin duplicados** — cada pieza se publica una sola vez: un
  doble clic mientras se publica se ignora, y una pieza ya publicada que se
  deshace y se vuelve a aprobar no se publica de nuevo (deshacer no la
  borra de Instagram; el panel lo advierte).

## Ayuda contextual (public/app/ayuda.js)

Cada sección y proceso del panel, la bienvenida, la administración, el
registro y los precios tiene un "?". Al pasar el mouse, tocarlo en el
celular o llegar con Tab, muestra qué es y los pasos para hacerlo (Esc
cierra). Todos los textos están en `AYUDA` dentro de `ayuda.js`; para
agregar uno: una clave nueva con `t` (título), `d` (qué es), `p` (pasos) y
`n` (nota), y `Ayuda.boton('clave')` donde se quiera mostrar.

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
y `/api/admin/*` responden 404, y también para cualquier otra cuenta. Como
los emails no se verifican al registrarse, un email de `ADMIN_EMAILS` no se
puede registrar: la cuenta administradora se crea antes de listarla.

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

**Desgloses** (mismo permiso `ads_read`, tabla `meta_ads_desglose`): por
anuncio (con su miniatura, tabla `meta_anuncios`), por edad y sexo, y por
ubicación (plataforma y posición: Feed, Historias, Reels…). Se guardan por
día, así que siguen el selector de 7, 30 o 90 días. Si Meta no entrega uno
de ellos, el resumen por campaña igual se actualiza.

## Análisis de publicidad (server/analisis-ads.js)

Común a Meta Ads y Google Ads, con reglas explicables (sin IA):

- **Variación contra el período anterior** del mismo largo en inversión,
  resultados, costo por resultado, clics y ROAS. Solo se muestra si hay
  datos de todo el período anterior (una cuenta recién conectada no tiene
  con qué compararse).
- **Diagnóstico** con "qué hacer": campañas o anuncios que gastan sin
  resultados, diferencia de costo por resultado entre campañas, CTR bajo,
  ventas que no cubren la inversión, costo que subió o bajó contra el
  período anterior y, en Meta, el público (edad y sexo) y la ubicación con
  resultados más baratos.

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

Con las mismas 25 publicaciones recientes de cada cuenta (sin llamadas
extra) y las de la cuenta propia, se analiza con la misma vara: **tasa de
interacción** (interacción por post ÷ seguidores), **publicaciones por
semana**, **mezcla de formatos** (videos y reels, carruseles, fotos) con la
interacción de cada uno, **día y franja** en que más publican, **hashtags**
más usados y sus **3 mejores publicaciones**. De ahí salen conclusiones con
"qué hacer": el formato que más rinde en el rubro, si publicas menos que
ellos, quién tiene mejor tasa, cuándo publican, quién crece más rápido y
qué hashtags usan que tú no.

## Perfil del negocio y bienvenida (server/perfil.js, public/app/bienvenida.js)

Lo primero que hace un negocio nuevo es presentarse: **qué es y qué hace**,
ciudad, **cómo vende** (local, online, domicilio, WhatsApp, agenda, ferias),
**sus redes y su web** (Instagram, TikTok, Facebook, WhatsApp, sitio) y,
en el paso siguiente, **qué vende**, a quién y por qué lo eligen. Precio y
promoción quedan como opcionales. Después: objetivo, cuánto publicar,
estrategia, conexiones y primera semana.

- **Leer mi web con IA** (Pro y Estudio): descarga el sitio (solo URL
  públicas: se resuelve el dominio y se rechazan IP privadas, también en
  cada redirección; máximo 500 KB) y Claude propone descripción, productos,
  público, diferenciador, ciudad y WhatsApp. Completa solo lo vacío y no
  guarda hasta que el dueño continúa.
- El perfil entra en **todos** los pedidos a la IA (vía `contexto-ia.js`),
  y la IA solo menciona las redes y canales que el negocio escribió.
- Las cuentas que ya habían pasado la bienvenida ven una vez por sesión
  solo "Tu negocio" y "Lo que vendes" hasta completar el perfil. También se
  edita en Conexiones y ajustes → Tu negocio.

## Costo de IA (server/costos.js)

Cada llamada a Claude registra sus tokens reales (tabla `uso_ia`);
imágenes y videos, una tarifa por unidad ajustable (`COSTO_IMAGEN_HIGGSFIELD_USD`,
`COSTO_IMAGEN_OPENAI_USD`, `COSTO_VIDEO_SEG_HIGGSFIELD_USD`,
`COSTO_VIDEO_SEG_OPENAI_USD`; dólar con `DOLAR_CLP`). En `/admin`: gasto del
periodo y del mes con proyección, ingresos de planes y margen, en qué se
gasta, promedio por plan y gasto contra lo que paga cada negocio. Solo
cifras de uso.

## App instalable y notificaciones push (server/push.js, public/app/sw.js, pwa.js)

El panel se instala como app (PWA): ícono en la pantalla de inicio, abre a
pantalla completa y muestra una página propia sin conexión. Botón "Instalar
Rubrofy" en el menú (en iPhone explica cómo agregarlo desde Safari).

**Notificaciones push** (Web Push, sin dependencias: VAPID con ES256 y
contenido cifrado aes128gcm, todo con `node:crypto`). Cada dispositivo se
activa en Conexiones y ajustes → Avisos (o desde el aviso en Por aprobar).
Se avisa cuando:

- se publica una pieza, falla una publicación o Instagram se desconecta;
- un video con IA está listo o falló;
- un Reel destacado dejó listo su Reel de prueba;
- cada lunes desde las 9:00, cuántas piezas esperan aprobación.

Las claves VAPID se generan solas la primera vez y se guardan en la base;
se pueden fijar con `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (base64url).
Cambiarlas invalida las suscripciones. En iPhone requiere iOS 16.4+ y la
app instalada. Una suscripción que el navegador da de baja (404/410) se
borra sola.

## Reels de prueba (server/reels-prueba.js)

Un Reel de prueba (trial reel) se muestra primero solo a quienes no siguen
la cuenta. Rubrofy los usa para sacarle más provecho a lo que ya funcionó:

- **Destacados**: Reels de los últimos 60 días (con 2+ días publicados)
  cuyas vistas, o alcance, son al menos 1,5 veces la mediana de los Reels
  de la cuenta (se necesitan 3 o más). Se ven en Resultados → "Reels para
  volver a probar".
- **Enviar a Reel de prueba** crea una pieza en Por aprobar con el mismo
  video (el subido a Rubrofy o, si no, el que entrega Instagram; no lo
  entrega para Reels con música con derechos) y un texto nuevo escrito con
  IA para quien no conoce la marca (el original queda como otra versión).
- **Automático** (se puede apagar): tras cada sincronización, el Reel más
  destacado pasa solo a Por aprobar, máximo uno por semana. Nada se publica
  sin aprobación.
- Al publicar, el contenedor lleva `trial_params` con la graduación:
  `SS_PERFORMANCE` (Instagram lo comparte con los seguidores si le va bien)
  o `MANUAL` (lo decide el dueño en la app). Si la cuenta no puede publicar
  Reels de prueba, la pieza queda fallida con el motivo.
- Rechazar la pieza libera el Reel original para volver a intentarlo.

## Voz de marca (server/voz.js)

La ficha de cómo habla la marca ("ADN"): quiénes son, a quién le hablan,
personalidad, trato (tú o usted), variante del español, emojis, largo,
palabras propias y prohibidas, frases de marca, promesas o temas prohibidos
y ejemplos que "sí suenan a la marca". Vista **Voz de marca** del panel.

- **Completar con IA**: Claude propone la ficha a partir de la estrategia,
  el plan, "Mi estilo" y lo aprobado. No se guarda hasta que el dueño la
  revisa.
- **Puntaje de fidelidad** (0-100) en cada pieza y en cualquier texto, con
  reglas explicables y sin IA (palabras vetadas, promesas prohibidas, trato,
  emojis, chilenismos, frases de plantilla, palabras propias, largo). Se
  recalcula al editar, al pedir otra versión y al cambiar la ficha. El panel
  muestra el promedio de lo pendiente y el % aprobado sin cambios.
- **Escribir con mi voz**: anuncios de Meta Ads, correos, WhatsApp, fichas
  de producto, textos web, bio de Instagram o publicaciones, en 3 versiones
  puntuadas (1 texto de IA por pedido). "Así sí suena" guarda el texto como
  ejemplo de la ficha.
- La ficha entra en todos los prompts que escriben por el negocio.

## Contexto para la IA (server/contexto-ia.js)

Tres capas, de menos a más específica:

1. **Reglas de la plataforma** (administración, `/admin`): valen para todos
   los negocios. Son criterios de calidad; el administrador sigue sin ver el
   contenido de ningún negocio.
2. **Contexto del negocio** por sección: general, voz, estrategia, copys,
   post, carrusel, reel, historia, imágenes y videos. Vista **Contexto para
   la IA** y editores plegables en Estrategia, Por aprobar, Voz de marca y
   Fotos.
3. **Indicación del pedido**: al generar la semana ("esta semana es el
   aniversario") o con **Pedir cambio** en una pieza ("más corto").

Cada pedido recibe solo sus secciones: la estrategia, general + voz +
estrategia; los textos, general + voz + copys + su formato; imágenes y
videos, su sección visual.

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

Con esa estrategia, `server/generator.js` le pide a Claude que escriba las
piezas del lote (una sola llamada por lote). Cada pieza trae:

- **gancho**: la frase que detiene el scroll (máx. 90 caracteres). En posts
  y carruseles es la primera línea; en reels, lo que se dice o se ve en los
  primeros 2 segundos.
- **caption**: el texto completo (250 a 600 caracteres; 150 en historias),
  empezando por el gancho y terminando con un llamado a la acción, sin
  hashtags.
- **hashtags**: 5 a 10, mezclando nicho, zona y producto. Se limpian
  (`limpiarHashtags`: minúsculas, sin repetidos ni espacios) y se agregan
  al final del texto al publicar si el texto no los trae. El dueño los
  edita en la tarjeta, junto al texto.
- **idea**: qué mostrar en la foto, las láminas o las tomas.

El panel muestra el gancho destacado, el texto completo (se expande al
tocarlo), los hashtags y "Copiar texto y hashtags" con el texto final tal
como se publica.
El botón "Otra versión" también le pide a Claude una variante nueva una vez
que se agotan las precalculadas.

Sin `ANTHROPIC_API_KEY` configurada, todo esto cae a un modo genérico sin
costo ni llamadas externas: una estrategia de respaldo razonable (enfoques
de producto/precio/urgencia/detrás de escena) y captions con plantillas de
texto que usan los datos reales del negocio.

Por defecto usa **Claude Sonnet 5.5** (`claude-sonnet-5-5`): mejor escritura y
voz de marca que Haiku, a US$2 / US$10 por millón de tokens (el doble de
Haiku 4.5). Todas las llamadas pasan por `server/claude.js` (`llamar()`),
que arma la petición según el modelo:

- **Pensamiento adaptativo con esfuerzo `low`** (`ANTHROPIC_EFFORT`): para
  textos cortos piensa poco y solo cuando hace falta. El pensamiento cuenta
  dentro de `max_tokens`, así que se suma un margen de 4.000 tokens para que
  la respuesta no salga cortada. `ANTHROPIC_PENSAMIENTO=no` lo apaga del
  todo (`thinking: between_tools`, más barato y rápido).
- **Rechazos:** si el modelo rechaza una petición (`stop_reason: refusal`),
  Anthropic la reintenta en otro modelo (`fallbacks: "default"`); si igual
  se rechaza, el llamador usa su plan B. El texto se lee solo de los bloques
  de tipo `text` (la respuesta puede traer bloques de pensamiento antes).
- El costo se registra con el modelo que respondió de verdad.

Para volver a Haiku 4.5 (más barato): `ANTHROPIC_MODEL=claude-haiku-4-5`.

## Imágenes y videos con IA (server/medios.js)

Dos proveedores; si están los dos, se usa Higgsfield:

| Proveedor | Variable | Imágenes | Videos |
|---|---|---|---|
| Higgsfield | `HIGGSFIELD_API_KEY` = `id:secreto` (de cloud.higgsfield.ai) | Soul 2 (`HIGGSFIELD_MODELO_IMAGEN`) | Seedance 2.0 (`HIGGSFIELD_MODELO_VIDEO`) |
| OpenAI | `OPENAI_API_KEY` | gpt-image-1 (`OPENAI_IMAGE_MODEL`) | Sora 2 (`OPENAI_VIDEO_MODEL`) |

- **Imágenes**: botón "Generar foto con IA" (y "Otra foto con IA") en la
  tarjeta, o automáticamente al publicar una pieza sin foto real. Feed en
  1:1 e historias en 9:16. El pedido espera el resultado (segundos).
- **Videos** (Reels e historias): "o generarlo con IA" junto a "Subir
  video". Si la pieza tiene foto, Higgsfield la anima (image-to-video, por
  eso necesita `PUBLIC_URL`); si no, lo crea desde la idea de la pieza.
  Tarda minutos: queda en la tabla `trabajos_media` y un sondeo cada 15 s
  (`MEDIOS_INTERVALO_SEG`) lo baja y lo deja como video de la pieza, aunque
  el dueño haya cerrado el panel. Si falla, no se descuenta del cupo. Un
  video subido por el negocio nunca se reemplaza. Duración con
  `VIDEO_IA_SEGUNDOS` (5 por defecto) y audio con `VIDEO_IA_AUDIO=1`.
- **Prompts**: idea visual de la pieza, rubro y categoría de foto, más el
  contexto de "Imágenes con IA" / "Videos con IA" de la plataforma y del
  negocio.
- **Cupos por plan** (`server/planes.js`): Estudio, 20 imágenes y 6 videos
  al mes. Cada video de 5 s cuesta del orden de USD 0,5 a 1 en el proveedor.

## Solo de pago y prueba gratis

Rubrofy no tiene plan gratis: una cuenta nueva queda
**sin plan** (id interno `gratis`, nombre "Sin plan", no aparece en
`/api/planes`). Puede registrarse, contar de su negocio y armar su
estrategia, pero no crear contenido: `/generar` y "Otra versión"
responden 402 `sinPlan`.

- **Bienvenida**: sin plan, el último paso es "Elige tu plan", con los
  botones de pago (Stripe Checkout). Al volver del pago, el panel espera a
  que el webhook active el plan y crea la primera semana solo.
- **Panel**: mientras no tenga plan, un aviso arriba ofrece Pro y Estudio;
  "Generar semana" lleva a ese aviso.
- **Cuentas administradoras** (`ADMIN_EMAILS`): si no tienen plan, reciben
  Estudio de cortesía (`cortesia: true`), que en `/admin` no cuenta como
  ingreso. Si pagan un plan, manda el pagado. Es acceso al plan, no al
  contenido de otros negocios.
- **Prueba gratis** (`server/prueba-gratis.js`, formulario en
  `public/app/prueba-form.js`): 7 días del plan Pro a cambio de un
  formulario con **nombre, correo y número de teléfono** (en el registro el
  correo es el de la cuenta). Al activarla, la persona acepta que la
  contacten por WhatsApp o correo (el aviso está junto al botón).
  - Dónde se pide: en el registro (casilla marcada por defecto; el
    formulario se valida antes de crear la cuenta), en el último paso de la
    bienvenida ("Empieza gratis o elige tu plan", que además crea la
    primera semana), en el aviso de arriba del panel y en Configuración →
    Plan. El sitio lo anuncia con una franja arriba, el botón principal y
    un banner en Precios.
  - Una por negocio y por teléfono: los números usados quedan en
    `pruebas_usadas` aunque se elimine la cuenta (lo dice la política de
    privacidad). El teléfono completa el WhatsApp del perfil si estaba
    vacío.
  - Al terminar (se revisa cada `RECORDATORIOS_INTERVALO_SEG`, 1800 s) la
    cuenta vuelve a sin plan salvo que pague; con push, se avisa 2 días
    antes y el día que termina. Si paga durante la prueba, la prueba se
    cierra y manda la suscripción.
  - `/admin` → Pruebas gratis: nombre, correo y teléfono de cada uno, el
    estado (en prueba, pagando, terminó sin pagar), la conversión y
    "Descargar CSV". Son datos de contacto que la persona aceptó dar, no
    contenido de su negocio.
- Cuentas que tenían una prueba con código (versión anterior): al arrancar
  el servidor quedan sin plan, salvo que paguen o sean administradoras.

## Recargas (server/recargas.js, public/app/recargas.js)

Cuando a un negocio se le acaba el cupo del mes puede comprar un paquete con
un **pago único** (Stripe Checkout en modo `payment`, no una suscripción):

| Paquete | Precio (IVA incl.) |
|---|---|
| 50 piezas con IA | $3.990 |
| 150 piezas con IA | $9.990 |
| 10 fotos con IA | $2.990 |
| 3 videos con IA | $5.990 |
| 10 reels editados | $2.990 |

- Cada compra es un lote que dura **12 meses**; se usa solo después del cupo
  del mes (`registrarUsoIA` descuenta primero del mes y el resto del lote
  vigente más antiguo). Con un lote, Pro también puede usar fotos y videos
  con IA.
- Compran solo las cuentas con plan pagado (no en la prueba gratis ni sin
  plan). Las cuentas de `ADMIN_EMAILS` tienen "Simular compra" (sin cobro,
  no cuenta como ingreso) para probar.
- El lote nace pendiente y lo acredita el webhook `checkout.session.completed`
  (con `metadata.tipo = recarga`); un evento repetido no acredita dos veces.
- El panel ofrece la recarga sola: el servidor responde 403 con
  `{ recargar: 'piezas' | 'fotos' | 'videos' | 'reels' }` y se abre la
  ventana "Cargar más". Con 15 piezas o menos, un aviso arriba del panel.
- `/admin` → Recargas: ventas, ingresos y ganancia estimada por paquete
  (descuenta IVA, ~4% de Stripe y el costo de IA en el peor caso).

## Kit de marca y diseño de imágenes (server/marca.js, public/app/diseno.js)

- **Kit de marca** (Configuración): logo (PNG, JPG o WebP, máx. 2 MB,
  validado por sus bytes), color principal y de apoyo, tipografía (Moderna,
  Impacto, Elegante, Manuscrita), posición del logo y llamado a la acción
  por defecto.
- **Diseñar con mi marca** en cada tarjeta con foto (post, portada de
  carrusel, historia sin video): plantillas Titular grande, Precio o promo,
  Frase, Solo logo e Historia con llamado; formato cuadrado o 4:5 (9:16 en
  historias). Se dibuja en el navegador (sin costo de IA) y se guarda como
  JPEG en `data/marca/<negocio>/`. Al publicar, la pieza usa el diseño; la
  foto original no se toca.

## Edición de reels (server/edicion-reels.js, public/app/reels.js)

"Editar con Rubrofy" en un reel o historia con video. Con **ffmpeg** en el
servidor:

1. Mide el video (máx. 3 min) y detecta silencios (`silencedetect`, -35 dB).
2. Deja los tramos del recorte sin silencios, hasta 15, 30, 60 o 90 s, los
   une y ajusta la velocidad (1×, 1,25×, 1,5×).
3. Subtítulos palabra por palabra (la que suena, resaltada con el color de
   la marca): automáticos con OpenAI (`OPENAI_API_KEY`, ~USD 0,006/min,
   queda en Costo de IA) o con el texto que escribe el dueño.
4. 1080×1920, zoom suave, color (cálido, contraste, blanco y negro) y las
   capas del panel (gancho los primeros 2 s, llamado a la acción los últimos
   3, logo) como PNG transparentes dibujados con la tipografía de la marca.
   Opción de silenciar el audio. Música: pendiente.

- Cupos: Pro 10 y Estudio 30 reels editados al mes (más recargas). Una
  edición que falla no descuenta.
- Cola de a un trabajo (`EDICION_CONCURRENCIA`, `EDICION_TIMEOUT_SEG`): lo
  caro es la CPU. Lo que quedó a medias al reiniciar vuelve a la cola.
- El original se guarda (`videoOriginal`): "Volver al original" o "Editar de
  nuevo" parte siempre del original. Push cuando termina o falla.
- Sin ffmpeg el botón no aparece; `/api/salud` informa `edicionReels`.

## Cobro con Flow (recomendado en Chile)

Si están `FLOW_API_KEY` y `FLOW_SECRET_KEY`, Rubrofy cobra con **Flow**
(flow.cl) y Stripe queda sin usar. Código: `server/flow.js` (cliente de la
API) y `server/cobro-flow.js` (planes, recargas, avisos).

- **Planes:** al elegir Pro o Estudio el negocio pasa a ser un cliente de
  Flow, inscribe su tarjeta en la página de Flow y queda suscrito a un plan
  de Flow que cobra solo cada mes. Los planes de Flow se crean solos la
  primera vez (`rubrofy-pro-19990`, `rubrofy-estudio-39990`): si cambia el
  precio en `server/planes.js`, se crea un plan nuevo y los suscritos
  antiguos siguen con el anterior.
- **Cambiar de plan** (subir o bajar) cambia el plan de la misma suscripción
  desde hoy; Flow ajusta el cobro. **Cancelar** corta al terminar el período
  pagado. **Cambiar tarjeta** vuelve a la página de Flow. Todo desde Plan.
- **Recargas:** pago único en Flow (tarjeta, transferencia, etc.).
- **Avisos:** Flow no firma sus avisos, solo manda un token. Rubrofy nunca
  cambia un plan ni acredita una recarga por lo que diga un aviso: con el
  token consulta a Flow el estado real. Una recarga se acredita solo si Flow
  dice "pagada", una vez, y por el monto exacto del paquete. Además, cada 6
  horas revisa todas las suscripciones por si un aviso no llegó. Un cobro
  vencido deja la cuenta sin plan hasta que se pague.
- Rutas: `/api/flow/tarjeta` (vuelta de inscribir la tarjeta),
  `/api/flow/retorno` (vuelta de pagar una recarga), `/api/flow/confirmacion`
  (aviso de pago) y `/api/flow/plan` (aviso de cobro de suscripción). Van
  fuera del chequeo anti-CSRF porque las llama Flow o el navegador al volver.

Variables: `FLOW_API_KEY`, `FLOW_SECRET_KEY` (Flow → Mis datos → Seguridad)
y `FLOW_SANDBOX=1` mientras se prueba en sandbox.flow.cl (quitarla para
cobrar de verdad; las claves de sandbox y producción son distintas).
`PUBLIC_URL` tiene que estar puesta: Flow avisa a esa dirección.

## Planes y cobro (Stripe)

Todo negocio nace **sin plan**. Para pasar a **Pro** o **Estudio** desde
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

Sin `STRIPE_SECRET_KEY` y los precios, los botones de pago muestran
"pronto": solo se puede usar Rubrofy con la prueba gratis de 7 días (y las
cuentas administradoras). Para cobrar al terminar las pruebas, Stripe es
obligatorio.

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
  analisis-ads.js Variación contra el período anterior y diagnóstico de publicidad
  google.js     Google Ads de solo lectura (OAuth con Google, GAQL)
  competencia.js Seguimiento de competidores en Instagram (Business Discovery)
  guardian.js   Qué verificar en cada texto antes de aprobarlo (promesas, datos inventados, frases genéricas)
  programacion.js Fechas de publicación en la zona horaria del negocio
  medios.js     Imágenes y videos con IA (Higgsfield u OpenAI), videos en segundo plano
  perfil.js     Perfil del negocio (qué es, redes, web) y "Leer mi web con IA"
  costos.js     Registro del costo de IA por llamada y resumen para /admin
  push.js       Notificaciones push (Web Push: VAPID + aes128gcm) por dispositivo
  reels-prueba.js Reels destacados → Reel de prueba (trial reels) para público nuevo
  voz.js        Voz de marca: ficha, puntaje de fidelidad, completar con IA y redactor
  contexto-ia.js Contexto para la IA por capas: plataforma (admin), negocio y pedido
  claude.js     Cliente mínimo de la API de Claude para los módulos nuevos
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
