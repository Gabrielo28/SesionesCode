# Rubrofy — Plan ajustado a lo que ya está construido

> Complementa [PROPUESTA.md](PROPUESTA.md). Esa propuesta partía de cero; este documento parte
> de Rubrofy (rama `claude/strategy-content-generator-yvx3rx`, carpeta `rubrofy/`), revisado
> en el commit `f2e0888` ("Agrega cobro real con Stripe").
>
> Septiembre 2026.

---

## 1. Veredicto

**Rubrofy ya es el núcleo de la propuesta**, y en un punto fue más lejos: publica de verdad
en Instagram. La tesis es la misma: IA que produce y una persona que aprueba antes de
publicar. El giro de "3 nichos fijos" a "el negocio describe su rubro y Claude le diseña la
estrategia" es exactamente lo que hacía falta para escalar a cualquier pyme.

| Módulo de la propuesta | En Rubrofy | Estado |
|---|---|---|
| Tablero de aprobación | Cola con aprobar, rechazar, editar, deshacer y "otra versión", más calendario | ✅ Hecho |
| Generador de contenido | `generator.js`, con Claude en planes pagados y plantillas en el Gratis | ✅ Hecho |
| Publicación | Publicación real vía Graph API al aprobar | ✅ Más allá de la propuesta |
| Fotos | Fotos reales por categoría, o foto generada con IA como respaldo | ✅ Más allá de la propuesta |
| Cobro | Freemium con Stripe y cuotas | ✅ Hecho (con bloqueantes, ver §2) |
| ADN de marca | Rubro en texto libre de hasta 300 caracteres, más tono y 4 enfoques | 🟡 Liviano: faltan ejemplos reales, claims prohibidos y variante de español |
| Aprendizaje de correcciones | Las ediciones y rechazos se guardan, pero no vuelven al generador | ❌ Falta, y es lo que más diferencia al producto |
| Guardián de marca | — | ❌ Falta |
| Métrica "% aprobado sin cambios" | Los datos existen (estado de cada pieza), pero no se mide | ❌ Falta |

---

## 2. Bloqueantes antes de cobrar a alguien real

Salen de la revisión del código. Los dos primeros cuestan plata o reputación desde el
primer cliente.

### 2.1 Doble cobro al subir de Pro a Estudio ✅ corregido (`5e82a81`)

`public/app/app.js:356` muestra "Actualizar a Estudio" a un negocio que ya está en Pro, y
`POST /api/negocios/:id/checkout` (`server/server.js:454`) crea un Checkout nuevo sin revisar
si ya existe una suscripción activa. Resultado: **dos suscripciones cobrando en paralelo**.
El webhook sobrescribe `subscriptionId` con la nueva, así que la vieja queda huérfana. Al
eliminar la cuenta solo se cancela la nueva, y la vieja sigue cobrando para siempre. Además,
los eventos de la suscripción vieja se encuentran por `customerId` y pueden devolver el plan
a Pro.

**Arreglo:** si el negocio ya tiene una suscripción activa, el cambio de plan se hace
actualizando esa misma suscripción (`POST /v1/subscriptions/:id` con el nuevo precio y
prorrateo) o mandándolo al Billing Portal con el cambio de plan habilitado. El endpoint de
checkout debe rechazar el caso con un 409.

### 2.2 Doble publicación en Instagram ✅ corregido (`5e82a81`)

`aprobar` (`server/server.js:551`) no revisa el estado previo de la pieza. Un doble toque,
un reintento del navegador, o la secuencia "deshacer → aprobar", **publica el mismo post dos
veces**. Es justo el fallo que el informe reporta de Metricool ("contenido duplicado").

**Arreglo:** si `item.instagram.ok` ya es verdadero, no se vuelve a publicar. Además hay que
marcar la pieza como "publicando" antes de llamar a la API, para cortar dobles clics
concurrentes. Y "deshacer" sobre una pieza ya publicada debe avisar que eso no la borra de
Instagram.

### 2.3 Costo de IA sin techo en el plan Pro ✅ corregido (`5e82a81`)

- `POST /generar` acepta cualquier `cantidad` sin tope: el bucle crea N piezas y pide
  `max_tokens: 200 × N`.
- "Otra versión" llama a Claude sin límite.
- Un script puede llamar a ambos sin parar. A $19.990 al mes, **un solo usuario abusivo
  puede costar más de lo que paga**.

**Arreglo:** poner `cantidad` entre 1 y 12, y una cuota mensual de generaciones por plan en
`planes.js`, con el mismo mecanismo que ya existe para las fotos (`usoFotosIA` por mes).

### 2.4 Endpoints públicos sin límite de intentos ✅ corregido (`5e82a81`)

- `POST /api/auth/registro` llama a Claude (`generarEstrategia`) en cada registro, incluso
  en el plan Gratis y sin sesión. Un bot que cree cuentas consume la key de Anthropic.
- `POST /api/auth/login` no limita intentos. Scrypt frena la fuerza bruta, pero no la impide.

**Arreglo:** un limitador en memoria por IP (por ejemplo 5 registros por hora y 10 logins
por cada 15 minutos). Son unas 20 líneas, sin dependencias.

### 2.5 Tokens de Instagram que vencen en silencio 🟠

Los tokens de larga duración de Instagram duran **60 días**. No hay renovación
(`GET graph.instagram.com/refresh_access_token`), así que a los dos meses la publicación deja
de funcionar sin aviso. Es otro dolor que el informe atribuye a la competencia ("errores de
desconexión de tokens").

**Arreglo:** renovar el token cuando le queden menos de 15 días al usarlo, y mostrar un
aviso en el panel si la publicación falla por autenticación. Guardar la fecha de
vencimiento al conectar.

### 2.6 Datos que se pierden en Railway 🟠

Todo vive en `data/` (JSON, fotos, fotos IA). El sistema de archivos de Railway **se borra
en cada deploy** si no hay un Volume montado. Antes del primer usuario real hay que montar
un Volume en la ruta de `data/` y probar un redeploy.

### 2.7 Detalles de cobro a decidir 🟡

- Cuando la suscripción queda `past_due`, el negocio baja a Gratis en el acto. Stripe
  reintenta el cobro durante días, así que conviene dar unos días de gracia antes de quitar
  la IA.
- El webhook no es idempotente ni tolera el desorden de eventos: un
  `checkout.session.completed` reintentado después de un `subscription.deleted` reactiva el
  plan. **Arreglo:** decidir siempre por el estado de la suscripción (`sub.status`) y no por
  el evento de checkout.
- **Confirmar que se puede abrir una cuenta de Stripe como empresa chilena.** Si no, las
  alternativas locales con suscripciones son **Flow** y **Mercado Pago**. `planes.js` ya
  separa bien el catálogo de precios del proveedor de pago, así que cambiar de proveedor
  estaría acotado a `stripe.js` y al webhook.

Lo que ya está bien: la verificación HMAC del webhook, el manejo del CLP como moneda sin
decimales en `setup-stripe.js` y la cancelación de la suscripción al borrar la cuenta.

---

## 3. Ajustes de estrategia

### 3.1 El diferenciador que falta: aprender de las correcciones

Hoy Rubrofy genera bien desde el día 1, pero no mejora con el uso. La competencia genérica
(ChatGPT, Predis) tampoco lo hace, y esa es la oportunidad de la **Ventana 2** del informe.

Rubrofy ya guarda todo lo necesario: qué se aprobó tal cual, qué se editó (antes y después) y
qué se rechazó. El paso siguiente:

1. Al generar, incluir en el prompt los **últimos 5 a 10 captions aprobados** del negocio
   como ejemplos de voz, y las **ediciones** como pares "así lo escribió la IA → así lo quiso
   el dueño".
2. Mostrar en el panel **"% aprobado sin cambios"** por mes. Para el dueño es la prueba de
   que la herramienta aprende su voz; para ti es la métrica del producto.

Es barato de construir (prompts y un contador) y es lo que hace difícil que un cliente se
cambie a otra herramienta después de tres meses.

### 3.2 Guardián de marca, empezando por los rubros regulados

Como el rubro es libre, cualquier clínica, suplemento o centro estético puede registrarse, y
Claude puede prometer resultados de salud o inventar una promo. Un paso de revisión antes de
mostrar la pieza (con el mismo modelo) puede marcar tres cosas: **claims de salud o
resultados**, **precios o promociones que no están en `negocio.datos`** y **fechas
inventadas**. Se muestra como una etiqueta en la tarjeta, sin bloquear la pieza.

### 3.3 BYOK: todavía no

Traer la propia key de Anthropic u OpenAI tiene sentido para agencias grandes, no para una
pyme que paga $19.990. Hoy agrega soporte (keys inválidas, sin facturación, como ya te pasó),
complejidad de seguridad (guardar secretos de terceros) y le quita valor al plan Estudio. El
costo de IA por negocio es bajo **una vez que existen los topes de §2.3**. Se puede retomar
cuando un cliente real lo pida.

### 3.4 Meta App Review: empezar ya, en paralelo

Es el verdadero cuello de botella para crecer: sin el botón "Conectar Instagram", cada
cliente tiene que conseguir su ID y su token a mano, y eso no es autoservicio. El proceso
toma semanas y pide sitio público, **política de privacidad, URL de eliminación de datos**,
verificación de la empresa y un video mostrando el flujo. Nada de eso depende del código, así
que conviene iniciarlo ahora, mientras se corrigen los bloqueantes.

### 3.5 Los precios

- **Pro a $19.990** compite con "uso ChatGPT gratis y publico yo". La diferencia tiene que
  ser visible en la página de precios: *"aprueba y se publica solo"* y *"aprende cómo
  escribes"* (lo segundo, después de §3.1).
- Agregar un **plan anual** (dos meses gratis) mejora la caja y reduce las bajas.
- El sitio público necesita la **página de precios** (`public/site/`). Hoy los planes solo
  se ven con sesión iniciada, y nadie paga lo que no ve antes de registrarse.

### 3.6 Canal agencia (a futuro, respetando la decisión actual)

Se mantiene la decisión de **no tener una clave maestra de plataforma**. Aparte de eso, una
agencia que maneja 10 negocios hoy necesitaría 10 logins. Un futuro "plan Agencia" (una
cuenta dueña de varios negocios propios, sin ver los ajenos) es compatible con esa
decisión, pero cambia el modelo de cuentas, así que queda como pregunta abierta y no como
tarea.

---

## 4. Orden de trabajo propuesto

| Semana | Qué | Por qué primero |
|---|---|---|
| 1 | ✅ Bloqueantes 2.1 a 2.4 corregidos en `5e82a81` (rama de Rubrofy) | Sin esto, cobrar cuesta plata o reputación |
| 1 (paralelo) | Iniciar Meta App Review y Business Verification. Escribir la política de privacidad y la URL de eliminación de datos | Toma semanas y no depende del código |
| 2 | Deploy en Railway con Volume, dominio rubrofy.com y Stripe en modo test de punta a punta. Confirmar Stripe Chile o cambiar a Flow/Mercado Pago | Primer entorno real |
| 2 | Página de precios en el sitio público | Nadie paga lo que no ve |
| 3 | Renovación de tokens de Instagram (2.5) y reglas de cobro (2.7) | Evita fallos silenciosos en el mes 2 |
| 3-4 | Aprendizaje de correcciones y métrica "% aprobado sin cambios" (3.1) | El diferenciador |
| 5-6 | Guardián de marca (3.2) | Habilita los rubros regulados con seguridad |
| 6+ | Piloto: 10 negocios de la lista de leads de Influence, empezando por los de prioridad B y C (los que no pagan $290.000 de agencia) | Validar el precio con clientes reales |

Después de todo eso, una segunda revisión de seguridad del flujo completo (registro → cobro
→ publicación), como ya estaba previsto.

---

## 5. Estado al 26 de septiembre de 2026

Todo lo de este plan y del análisis de plataformas (Metricool) está
construido en la rama `claude/strategy-content-generator-yvx3rx`, con una
regresión automatizada de 50 escenarios (Instagram, Meta y Google
simulados) en verde:

| Pieza | Commit |
|---|---|
| Bloqueantes de cobro y publicación (§2.1 a 2.4) | `5e82a81` |
| Publicación programada, reintentos, renovación del token (§2.5) | `84f4a2f` |
| Carruseles, Reels e historias | `74d91b8` |
| Base de datos SQLite (en vez de JSON) | `7d4face` |
| Resultados de Instagram + IA que aprende (§3.1) | `e051e2b` |
| Informe mensual con conclusión escrita por IA | `43a8398` |
| Mi estilo: el negocio muestra su contenido y la IA lo imita | `af5aec4` |
| Meta Ads (solo lectura) | `0e087e7` |
| Google Ads (solo lectura) | `3fcf33e` |
| Competencia en Instagram | `c72cd96` |
| Página de precios pública y guardián de marca (§3.2, §3.5) | `3c5b86c` |

**Lo que no depende del código y sigue pendiente:** deploy en Railway con
Volume en `data/` y `PUBLIC_URL`; Meta App Review + Business Verification
(publicar, métricas, `ads_read`, páginas); proyecto de Google Cloud con
acceso a la API de Google Ads y verificación del permiso `adwords`; cuenta
de Stripe (o Flow/Mercado Pago) y las claves de IA. También quedan
decisiones de producto: plan anual, un plan Agencia (varios negocios por
cuenta) y si Ads y competencia se quedan en Estudio.
