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
| [06-escaner-y-codigos.md](06-escaner-y-codigos.md) | **El escáner**: cómo funciona, los 8 sistemas, el catálogo de 40 códigos de falla con síntoma, causa y reparación, y qué sensor dispara cada uno. Se genera desde `escaner/codigos.js` |
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
reparación rápida, reparación en taller, quién y qué sensor lo detectó).

Botones: WhatsApp con los códigos críticos ya escritos, imprimir informe, copiar el
link del escaneo (reabre el resultado), borrar códigos.

```bash
cd escaner
node imprimir.js ejemplo-minimarket.json    # escaneo-minimarket-don-lucho.pdf sin abrir el navegador
node codigos-a-md.js > ../06-escaner-y-codigos.md   # regenerar el catálogo en markdown
```

El catálogo completo (sistemas, códigos, lecturas y señales) vive en
`escaner/codigos.js`. Para agregar un código: una línea en `CODIGOS` y un sensor que
lo dispare.

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

