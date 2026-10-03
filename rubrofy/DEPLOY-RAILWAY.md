# Deploy de Rubrofy en Railway

Guía paso a paso para dejar Rubrofy funcionando en Railway con el dominio
rubrofy.com. El código ya viene preparado; lo que queda es configuración
en el panel de Railway (unos 20 minutos) y en el DNS del dominio.

## Lo que ya viene listo en el código

| Pieza | Dónde | Para qué |
|---|---|---|
| `railway.json` | `rubrofy/railway.json` | Builder Railpack, comando de inicio, healthcheck en `/api/salud`, reinicio automático si se cae |
| `.nvmrc` = 22 | `rubrofy/.nvmrc` | Node 22 (Rubrofy necesita 22.13+ por la base SQLite integrada) |
| `/api/salud` | `server/server.js` | Railway confirma que el servidor y la base responden antes de dar el deploy por bueno |
| Cierre ordenado | `server/server.js` | Ante cada redeploy (SIGTERM) deja de tomar trabajos y cierra la base; lo que quedó a medio publicar se retoma al arrancar, sin duplicar |
| Carpeta de datos configurable | `server/datos.js` | `RUBROFY_DATA_DIR` apunta al Volume |
| Clave de sesión persistente | `server/auth.js` | Si no defines `SESSION_SECRET`, se genera una y se guarda en el Volume: las sesiones sobreviven a los redeploys |
| IP real detrás del proxy | `server/limites.js` | En Railway se detecta solo (límites de intentos de login y registro) |

## 1. Crear el servicio

1. En Railway: **New Project → Deploy from GitHub repo** → elige
   `Gabrielo28/SesionesCode`.
2. Entra al servicio → **Settings → Source**:
   - **Root Directory:** `rubrofy`
   - **Branch:** `claude/strategy-content-generator-yvx3rx` (o `main`, si
     antes fusionas esa rama).
   - **Watch Paths:** `/rubrofy/**`, para que los cambios en otras carpetas
     del repositorio no provoquen un redeploy de Rubrofy.
3. Si Railway no detecta la configuración sola, en **Settings → Config-as-code**
   indica `rubrofy/railway.json`.
4. **Replicas: 1.** Rubrofy corre el publicador y las sincronizaciones dentro
   del mismo proceso, y Railway no permite réplicas con un Volume.

## 2. Volume (sin esto se pierde todo en cada deploy)

1. En el servicio: **clic derecho → Attach Volume** (o desde el lienzo del
   proyecto, "+ New → Volume").
2. **Mount path:** `/data`
3. En **Variables**, agrega `RUBROFY_DATA_DIR=/data`.

Ahí viven la base (`rubrofy.db`), las fotos, los videos, los ejemplos de
"Mi estilo" y la clave de sesión. Activa los **backups del Volume** en
Railway si tu plan los incluye. Si al arrancar aparecen errores de permisos
sobre `/data`, agrega `RAILWAY_RUN_UID=0` (la imagen no está corriendo
como root).

## 3. Variables de entorno

Se cargan en el servicio → **Variables** (se puede pegar un bloque con
"Raw Editor"). Ninguna clave va en el código ni en el repositorio.

**Para el primer deploy**

| Variable | Valor | Nota |
|---|---|---|
| `RUBROFY_DATA_DIR` | `/data` | la ruta del Volume |
| `PUBLIC_URL` | `https://<tu-servicio>.up.railway.app` | cámbiala a `https://rubrofy.com` cuando el dominio funcione (paso 5) |
| `SESSION_SECRET` | una cadena larga al azar | opcional: si no la pones, se genera y se guarda en el Volume |

**Para activar cada parte** (se pueden agregar después; sin ellas esa parte
queda apagada y el resto funciona igual)

| Parte | Variables |
|---|---|
| IA de textos y estilo | `ANTHROPIC_API_KEY` (opcional `ANTHROPIC_MODEL`) |
| Imágenes y videos con IA | `HIGGSFIELD_API_KEY` (la llave completa, tal como se copia de open.higgsfield.ai/api-keys; preferido) u `OPENAI_API_KEY`. Opcionales: `HIGGSFIELD_MODELO_IMAGEN`, `HIGGSFIELD_MODELO_VIDEO`, `OPENAI_IMAGE_MODEL`, `OPENAI_VIDEO_MODEL`, `VIDEO_IA_SEGUNDOS`, `VIDEO_IA_AUDIO` |
| Notificaciones push | Nada: las claves VAPID se generan solas. Opcional fijarlas con `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` |
| Cobro (**obligatorio**: el servicio es solo de pago) | Con **Flow** (recomendado en Chile): `FLOW_API_KEY`, `FLOW_SECRET_KEY` y, mientras pruebas, `FLOW_SANDBOX=1`. Los planes se crean solos en Flow. Con Stripe (alternativa): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ESTUDIO`. Si están las de Flow, se usa Flow. Sin ninguna, nadie puede pagar ni crear contenido. |
| Meta (Ads y competencia) | `META_APP_ID`, `META_APP_SECRET` (opcional `META_GRAPH_VERSION`) |
| Google Ads | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (opcionales `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_API_VERSION`) |
| "Conectar con Instagram" | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` (sin ellas, Instagram se conecta pegando ID y token) |
| Páginas legales | `CONTACTO_EMAIL` (el correo que aparece en privacidad, términos y eliminación de datos; si falta, se usa el de `EMAIL_FROM`) |
| Panel de administración (`/admin`) | `ADMIN_EMAILS` (emails de las cuentas administradoras, separados por coma). La cuenta tiene que existir antes: un email listado no se puede registrar. |
| Resumen semanal por correo | `RESEND_API_KEY`, `EMAIL_FROM` (ej: `Rubrofy <avisos@rubrofy.com>`; opcional `AVISOS_HORA`, por defecto 8) |
| Edición de reels | Nada que configurar: `railpack.json` instala `ffmpeg` y `fonts-dejavu-core` al desplegar. Si `/api/salud` dice `"edicionReels": false`, agrega la variable `RAILPACK_DEPLOY_APT_PACKAGES` = `ffmpeg fonts-dejavu-core` y vuelve a desplegar. Opcional: `OPENAI_API_KEY` para subtítulos automáticos (sin ella, el dueño escribe el texto), `EDICION_CONCURRENCIA` (1), `EDICION_TIMEOUT_SEG` (360). |
| Ajustes | `RUBROFY_TZ` (por defecto `America/Santiago`), `PUBLICADOR_INTERVALO_SEG` (30), `MAX_VIDEO_MB` (100) |

## 4. Primer deploy y verificación

1. Railway construye y arranca solo al conectar el repositorio.
2. En **Settings → Networking → Generate Domain** obtén la URL
   `*.up.railway.app` y ponla en `PUBLIC_URL`.
3. Verifica:
   - `https://<tu-servicio>.up.railway.app/api/salud` responde `{"ok":true,...}`.
   - En **Deploy Logs** aparece `Rubrofy corriendo ... · datos en /data`.
     Si dice otra ruta, el Volume o `RUBROFY_DATA_DIR` no están bien.
4. Crea tu cuenta en `/registro.html`. En producción no se cargan los
   negocios de ejemplo (eso es solo `npm run dev`).
5. **Prueba de persistencia:** haz un redeploy (Deployments → Redeploy) y
   comprueba que sigues con la sesión iniciada y que tu cuenta sigue ahí.

## 5. Dominio rubrofy.com

1. En el servicio → **Settings → Networking → Custom Domain**, agrega
   `rubrofy.com` y también `www.rubrofy.com`.
2. Railway muestra los registros DNS exactos que hay que crear (un CNAME
   hacia su dominio y un TXT de verificación). Créalos tal cual en el
   panel de DNS de donde compraste el dominio.
3. **Dominio raíz** (`rubrofy.com` sin `www`): un CNAME en la raíz solo
   funciona si tu proveedor de DNS soporta "CNAME flattening" o registros
   ALIAS/ANAME. Si no lo soporta, lo más simple es mover el DNS a
   Cloudflare (gratis), que sí lo hace. Si usas el proxy de Cloudflare
   (nube naranja), pon el modo SSL en **Full**.
4. Cuando Railway marque el dominio como activo (el certificado HTTPS se
   emite solo), cambia `PUBLIC_URL=https://rubrofy.com`.

## 6. Integraciones que dependen de la URL pública

Una vez que `https://rubrofy.com` funcione:

- **Stripe** → Developers → Webhooks → endpoint
  `https://rubrofy.com/api/stripe/webhook` con los eventos
  `checkout.session.completed`, `customer.subscription.updated` y
  `customer.subscription.deleted`. Copia el "Signing secret" a
  `STRIPE_WEBHOOK_SECRET`. Antes, corre una vez
  `STRIPE_SECRET_KEY=... node scripts/setup-stripe.js` (en tu computador)
  para crear los precios y copia los IDs a `STRIPE_PRICE_PRO` y
  `STRIPE_PRICE_ESTUDIO`.
- **Google Ads** → en el cliente OAuth de Google Cloud, URI de redirección
  autorizada: `https://rubrofy.com/api/google/callback`.
- **Meta** → en la app de Meta (Configuración → Básica): dominio de la app
  `rubrofy.com`, URL de la política de privacidad
  `https://rubrofy.com/privacidad.html`, URL de las condiciones del servicio
  `https://rubrofy.com/terminos.html` y, en "Eliminación de datos", la URL de
  instrucciones `https://rubrofy.com/eliminar-datos.html`. Revisa el texto de
  esas páginas con un abogado antes de lanzar.
- **Instagram**: Meta descarga las fotos y videos desde `PUBLIC_URL` con
  enlaces firmados temporales.
- **"Conectar con Instagram"** (para que el cliente inicie sesión en vez de
  pegar ID y token):
  1. En [developers.facebook.com/apps](https://developers.facebook.com/apps),
     en tu app (tipo Empresa), agrega el producto **Instagram** →
     **API con inicio de sesión de Instagram**.
  2. En **Configurar el inicio de sesión para empresas** (Business login
     settings), en "URI de redireccionamiento de OAuth", agrega
     `https://rubrofy.com/api/instagram/callback`.
  3. Copia el **ID de la app de Instagram** y la **clave secreta de la app
     de Instagram** (aparecen en esa misma sección; no son el ID y la clave
     de la app de Meta) a `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`.
  4. Mientras la app esté en modo desarrollo, solo pueden conectarse las
     cuentas de Instagram agregadas como evaluadoras (Roles de la app →
     Evaluadores de Instagram, y aceptar la invitación en Instagram →
     Configuración → Apps y sitios web). Para abrirlo a todos los clientes,
     pide en App Review los permisos `instagram_business_basic`,
     `instagram_business_content_publish` e
     `instagram_business_manage_insights`.
- **Resumen semanal por correo** (Resend):
  1. Crea una cuenta en [resend.com](https://resend.com) → Domains → Add
     domain → `rubrofy.com`.
  2. Resend muestra registros DNS (MX y TXT de SPF/DKIM). Agrégalos en
     Cloudflare → DNS, todos en **DNS only** (nube gris). Espera a que
     Resend marque el dominio como verificado.
  3. En Resend → API Keys, crea una con permiso de envío y cópiala a
     `RESEND_API_KEY`. Pon `EMAIL_FROM` = `Rubrofy <avisos@rubrofy.com>`.
  4. En el panel, Conexiones y ajustes → Avisos por correo → "Enviarme uno
     ahora" para probar. Los resúmenes salen solos los lunes desde las 8:00.

## 7. Problemas comunes

| Síntoma | Causa probable |
|---|---|
| El deploy falla en el healthcheck | Mira los Deploy Logs; si menciona `node:sqlite`, la versión de Node es menor que 22.13 |
| Después de cada deploy se cierran las sesiones o desaparecen datos | El Volume no está montado en `/data` o falta `RUBROFY_DATA_DIR=/data` |
| Instagram responde que no pudo descargar la imagen | `PUBLIC_URL` no coincide con el dominio público real |
| Errores de permiso al escribir en `/data` | Agrega `RAILWAY_RUN_UID=0` |
| El webhook de Stripe responde "Firma inválida" | `STRIPE_WEBHOOK_SECRET` no corresponde a ese endpoint (cada endpoint tiene el suyo) |
| Google vuelve con "la conexión venció o no corresponde a tu sesión" | La URI de redirección no es exactamente `PUBLIC_URL` + `/api/google/callback`, o se inició la conexión desde otro dominio |
