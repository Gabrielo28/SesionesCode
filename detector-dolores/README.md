# Escáner de Negocio — el detector de dolores y cuellos de botella

Un sistema para captar negocios, detectar qué les falla (kiosco, restaurante, clínica,
tienda, servicio profesional, fábrica, pyme B2B) y convertir eso en una oferta
concreta. Complementa el sistema de prospección (`../prospeccion-ventas/`), que está
centrado en redes sociales: este mira el negocio completo.

**La metáfora que lo gobierna: el escáner de un auto.** Se conecta al negocio, lee los
8 sistemas y entrega **códigos de falla** con gravedad, síntoma, causa y reparación.
El escáner dice *qué* falla (3 minutos, gratis, desde el celular). El **taller** dice
*cuánto cuesta y cómo se repara* con los números del dueño: diagnóstico completo y
radiografía de proceso.

**La idea central:** todo negocio es la misma cadena (se enteran → llegan → compran →
entregas → cobras → vuelven), sostenida por personas y datos. Siempre hay una tranca
más angosta que las otras. El detector la encuentra en dos niveles: **el mapa de
dolores** dice en qué área está (captación, conversión, operación, caja…) y **la
radiografía de proceso** dice en qué paso exacto se pierde el tiempo o se caen las
ventas, y cuánto cuesta eso al mes con los números del propio dueño. De ahí sale la
oferta que la destraba.

---

## Qué hay acá

| Archivo | Para qué |
|---|---|
| [01-mapa-de-dolores.md](01-mapa-de-dolores.md) | Las 8 áreas, cómo suena cada dolor, señales, preguntas, fórmula de costo, arreglo. Incluye el banco de frases (lo que dice el dueño → el dolor) |
| [02-senales-desde-afuera.md](02-senales-desde-afuera.md) | Diagnóstico de 15 min sin hablar con nadie: Google Maps, Instagram, web, Meta Ads, empleo, comprador misterioso. Checklists por rubro y ficha de observación |
| [03-entrevista-de-diagnostico.md](03-entrevista-de-diagnostico.md) | La conversación de 20 min: pregunta llave por área, 5 porqués, cómo cuantificar, ficha de entrevista |
| [04-de-dolor-a-oferta.md](04-de-dolor-a-oferta.md) | Catálogo de soluciones, matriz dolor → oferta de 30 días → estructural, priorización y cómo presentar |
| [07-plan-30-dias-clientes.md](07-plan-30-dias-clientes.md) | **El plan comercial**: posicionamiento por reparaciones (diagnóstico gratis, reparación a precio fijo, operación mensual), rutina semanal de mensajes y metas |
| [centro/](centro/) | **Centro de escaneo**: la app privada para trabajar todo desde una pantalla (Hoy, Negocios, Mercado, Escanear). Se usa **con Claude** (artifact en claude.ai: escribe análisis y mensajes a medida) y tiene una **versión de emergencia sin Claude** en `/centro` de tu servidor (`npm start` o Railway). Ver [Centro de escaneo: con y sin Claude](#centro-de-escaneo-con-y-sin-claude) |
| [mercado/](mercado/) | **Escáner de mercado (interno)**: escanea decenas de webs de un rubro, detecta fallas, ordena a quién escribir y con qué mensaje, y muestra qué servicio venderle a ese mercado. Ver su README |
| [06-escaner-y-codigos.md](06-escaner-y-codigos.md) | **El escáner**: cómo funciona, los 8 sistemas, el catálogo de 43 códigos de falla con síntoma, causa y reparación, y qué sensor dispara cada uno. Se genera desde `escaner/codigos.js` |
| [escaner/](escaner/) | **La app del escáner**: conectar → 16 lecturas (+ señales en modo taller) → escaneo por sistema → códigos de falla → informe imprimible y WhatsApp. Es la puerta de entrada y el captador de leads |
| [05-radiografia-de-proceso.md](05-radiografia-de-proceso.md) | Mapear un proceso paso a paso: las 5 preguntas, cómo leer el cuello de botella, las 7 fugas de tiempo, las 4 jugadas para destrabarlo, y el formato del servicio express de 90 minutos |
| [proceso/](proceso/) | **Radiografía de proceso**: herramienta web para mapear en vivo con el dueño y ver al instante el paso que frena, el tiempo perdido y los pesos al mes. Imprime a PDF |
| [diagnostico/](diagnostico/) | Generador del diagnóstico en PDF (`node generar.js negocio.json`) |
| `.claude/skills/detector-dolores/` | Skill de Claude Code: `/detector-dolores` lee códigos a partir de lo que le des y produce el diagnóstico |

---

## El flujo

```
ESCANEAR      El negocio pasa por el escáner (escaner/index.html):
              a) el dueño solo, en modo rápido: le llega el link, responde 16 lecturas
                 y manda sus códigos por WhatsApp (captación de leads)
              b) tú, en modo taller: 16 lecturas + las señales que observaste
                 (02-senales-desde-afuera.md, comprador misterioso siempre)
              Resultado: códigos de falla por sistema, con gravedad y reparación.

OBSERVAR      Si entró por (a), completar con 15 min de señales desde afuera y
(sin hablar)  reescanear en modo taller: los códigos "confirmados por 2 fuentes"
              son los que van en la conversación.

CONVERSAR     20 min con 03-entrevista-de-diagnostico.md → ficha de entrevista
              Confirmar, cuantificar en pesos, agendar la revisión.

RADIOGRAFIAR  Si la tranca está en un proceso (ventas, producción, atención, cobranza):
              90 minutos con el dueño mapeando paso a paso en proceso/index.html.
              Resultado en vivo: el paso que frena, tiempo perdido, pesos al mes. PDF.

DIAGNOSTICAR  Llenar diagnostico/negocio.json → node generar.js
              Sale un PDF de 3 páginas: mapa de 8 áreas, el cuello de botella con
              número, plan de 30 días. Sin precios.

OFRECER       Con 04-de-dolor-a-oferta.md elegir la oferta.
              La propuesta con precios se genera con prospeccion-ventas/propuesta/.
```

Tiempo total por negocio: **40 minutos de trabajo y una espera de un día** (el
comprador misterioso necesita ver si hacen seguimiento), más los 90 minutos de la
radiografía cuando el dolor está en un proceso.

---

## El escáner

`escaner/index.html` es una página estática (se sube a cualquier hosting o se enlaza
desde la bio). Cuatro pantallas: **Conectar** (negocio, rubro, modo), **Lectura** (16
preguntas, 2 por sistema, más la lista de señales observadas en modo taller),
**Escaneando** (la consola recorre los 8 sistemas) y **Códigos de falla** (ID de
escaneo, totales por gravedad, estado de los sistemas, cada código con síntoma, causa,
reparación rápida, reparación en taller, quién y qué sensor lo detectó, y las
**posibles soluciones de la Top 1 a la Top 5**, ordenadas de la mejor a la peor para ese
negocio según cuántos códigos repara cada una, qué tan graves son y qué tan rápido se hace).

Botones: WhatsApp con los códigos críticos ya escritos, imprimir informe, copiar el
link del escaneo (reabre el resultado), borrar códigos.

```bash
cd escaner
node imprimir.js ejemplo-minimarket.json    # escaneo-minimarket-don-lucho.pdf sin abrir el navegador
node codigos-a-md.js > ../06-escaner-y-codigos.md   # regenerar el catálogo en markdown
```

El catálogo completo (sistemas, códigos, lecturas, señales y soluciones) vive en
`escaner/codigos.js`. Para agregar un código: una línea en `CODIGOS`, un sensor que lo
dispare y una solución que lo repare.

## Publicarlo en influencechile.cl (Netlify)

La carpeta `influencechile-web/` (en la raíz del repo) es tu web publicada al 15 de
octubre de 2026 con estos cambios:

- **El escáner en /escaner/**, con ítem en el menú, link en el hero, un bloque antes del
  test de 5 preguntas y un link desde el resultado del test.
- **Página 8 veces más liviana**: las 11 imágenes que iban dentro del HTML ahora son
  archivos WebP en `img/`. El HTML baja de 810 KB a cerca de 100 KB.
- **Preguntas frecuentes** con datos estructurados (lo que más citan Google y las IA),
  ficha de empresa ampliada, `llms.txt` para buscadores con IA, `robots.txt` que les
  da la bienvenida y sitemap con la nueva página.
- **Medición lista** en `medicion.js`: pegas tu ID de Google Analytics y tu píxel de Meta
  y queda midiendo clics a WhatsApp y uso del escáner.
- **Modo taller oculto** al público: se abre con `influencechile.cl/escaner/?taller`.

Para publicar: Netlify → tu sitio → Deploys → arrastrar la carpeta `influencechile-web`.
Si tienes cambios en tu copia local de la web que no estén publicados, aplica estos
cambios sobre esa copia en vez de subir esta carpeta.

## Centro de escaneo: con y sin Claude

El Centro es una sola app con dos versiones:

| | **Con Claude** (la de todos los días) | **Sin Claude** (emergencia) |
|---|---|---|
| Dónde | El artifact en claude.ai | `npm start` → `localhost:5180/centro`, o Railway → `/centro` |
| Escaneo, prioridades, soluciones, primer mensaje | Sí | Sí, igual |
| "Otra versión" del mensaje | La escribe Claude | Alterna entre 4 versiones ya redactadas |
| Análisis a fondo por negocio (qué le cuesta, qué ofrecerle, objeción, qué confirmar) | Lo escribe Claude y queda guardado | Se ve el último que escribió Claude |
| Escanear la cola | Pidiéndolo en el chat | Botón "Escanear la cola ahora" |

**El puente es el respaldo.** En la versión con Claude, descarga un respaldo cada semana
(la pantalla Hoy te lo recuerda). Si se acaban los créditos, levanta la versión sin
Claude, importa ese archivo en Escanear → Importar archivo, y sigues con todos tus
negocios, el seguimiento y los análisis. Para volver, descarga un respaldo allá e
impórtalo en la versión con Claude. Al importar, de cada seguimiento gana el más reciente.

**En tu computador** (Windows, Mac o Linux, con Node 18+ y Chrome instalado):

```bash
cd detector-dolores
npm install        # una vez: instala el conector del navegador (usa tu Chrome)
npm start          # abre http://localhost:5180/centro
```

Sin contraseña, el Centro solo se abre desde ese mismo computador. Tus datos quedan en
`detector-dolores/datos/centro.json` (no se sube a GitHub).

Para que la versión sin Claude esté lista el día que la necesites:

**En Railway** queda en `https://<tu-dominio>/centro`, con contraseña. El script
`desplegar-railway.js` deja creado el disco persistente (`/data`), la variable
`DATA_DIR=/data` y la contraseña `CENTRO_CLAVE` (si no la defines, la genera; la ves en
Railway → servicio escaner → Variables). Chromium se instala solo (`nixpacks.toml`).

Qué se puede hacer desde la pantalla Escanear:

- **Escanear la cola ahora**: revisa cada web con un navegador real (unas 15 por minuto)
  y los resultados aparecen en Hoy y Negocios.
- **Descargar respaldo**: un `.json` con negocios, seguimiento y cola. Guárdalo de vez
  en cuando.
- **Importar archivo**: un respaldo del Centro, un resultado del escáner de mercado
  (`mercado/resultados/*.json`) o un tablero (`*.html`). Así pasas tus datos del artifact
  de claude.ai, del PC o de Railway a cualquiera de los otros.

## Publicarlo en Railway

La carpeta trae `server.js` (servidor Node), `package.json`, `railway.json` y
`nixpacks.toml`. Sirve el escáner en `/`, la radiografía de proceso en `/proceso` y el
Centro de escaneo en `/centro` (con contraseña). Solo se entregan los archivos públicos:
los datos del Centro y los resultados de escaneos nunca se sirven.

**Automático (un comando).** Con un token de Railway (Account Settings → Tokens):

```bash
cd detector-dolores
RAILWAY_API_TOKEN=... node desplegar-railway.js
```

Crea el proyecto `escaner-de-negocio`, el servicio con Root Directory
`/detector-dolores` conectado a `main`, el disco persistente y la contraseña del Centro,
genera el dominio, lanza el deploy, espera a que termine y prueba las rutas. Es
idempotente: correrlo dos veces no duplica nada. Para elegir tú la contraseña:
`CENTRO_CLAVE=tu-clave RAILWAY_API_TOKEN=... node desplegar-railway.js`.

**A mano**, si prefieres el panel:

1. Railway → **New Project → Deploy from GitHub repo** → `Gabrielo28/SesionesCode`.
2. En el servicio: **Settings → Source → Root Directory** = `detector-dolores`
   (el repo tiene varios proyectos; esto le dice a Railway cuál es).
3. **Settings → Networking → Generate Domain.** Listo: cada push a la rama
   configurada redespliega solo.
4. Para el Centro: en el servicio, **clic derecho → Attach Volume** con Mount Path
   `/data`, y en **Variables** agrega `DATA_DIR=/data` y `CENTRO_CLAVE=<tu contraseña>`.

Para probarlo en local:

```bash
cd detector-dolores
npm start          # http://localhost:5180, /proceso y /centro
```

El link que se manda a los dueños es el dominio de Railway tal cual (abre el escáner en
modo rápido). El link con `?d=` que genera "Copiar link del escaneo" reabre un
resultado puntual.

## Usar el skill (Claude Code)

```
/detector-dolores Minimarket Don Lucho, Maipú. IG @donlucho.maipu, está en Google Maps.
Fui a comprar: solo efectivo, cuaderno de fiado, el dueño solo en caja.
```

O pegando las notas de una conversación, o el link del escaneo. El skill lee los
documentos, traduce lo que encuentra a códigos de falla con su evidencia, elige el
cuello de botella, calcula el costo con los datos que haya (marcando lo que es
supuesto), escribe el `negocio.json`, corre el generador y propone la oferta y el
primer mensaje.

---

## Generar un diagnóstico a mano

```bash
cd diagnostico
node generar.js                 # usa negocio.json
node generar.js ejemplo-restaurante.json
```

Salen `diagnostico-<negocio>.html` y `diagnostico-<negocio>.pdf`. Para el PDF el
script busca Chrome en las rutas habituales (Windows, Mac, Linux); si no lo encuentra,
se abre el HTML en Chrome y se imprime a PDF.

**Campos del JSON:**
- `fortalezas` — 2 cosas que hacen bien, textuales. Obligatorio.
- `areas` — las 8, cada una con `estado` (`bien` / `alerta` / `critico`), `hallazgo`,
  `evidencia` (de dónde salió: reseña, comprador misterioso, lo que dijo el dueño) y
  opcionalmente `codigos` (los códigos de falla del escáner, ej. `["CAJ-01", "CAJ-02"]`).
- `cuellos` — el cuello de botella primero, después 2 dolores secundarios. Cada uno con
  `cuanto_cuesta` (el número que aceptó el dueño), `como_se_arregla` y opcionalmente
  `codigo`.
- `plan_30_dias` — semana a semana, sin precios.
- `siguiente_paso` — una sola acción con fecha.

---

## La radiografía de proceso

`proceso/index.html` se abre en el navegador (sin servidor) y se llena con el dueño al
lado: los pasos en orden, quién los hace, minutos de trabajo, horas de espera, % que
se repite y % que se pierde. Calcula capacidad y carga de cada paso, el cuello de
botella, el tiempo total contra el trabajo real, las fugas y los pesos por semana y
mes. Tiene tres ejemplos cargables (ventas, producción, creación de contenido),
guarda y abre JSON, e imprime a PDF.

```bash
cd proceso
node imprimir.js ejemplo-muebles.json     # radiografia-muebles-araya.pdf, sin abrir el navegador
```

El método completo y el formato del servicio de 90 minutos están en
`05-radiografia-de-proceso.md`.

