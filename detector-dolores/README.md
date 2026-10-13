# Detector de Dolores — encontrar el cuello de botella de cualquier negocio

Un sistema para captar negocios, diagnosticar qué les duele (kiosco, restaurante,
clínica, tienda, servicio profesional, pyme B2B) y convertir ese dolor en una oferta
concreta. Complementa el sistema de prospección (`../prospeccion-ventas/`), que está
centrado en redes sociales: este mira el negocio completo.

**La idea central:** todo negocio es la misma cadena (se enteran → llegan → compran →
entregas → cobras → vuelven), sostenida por personas y datos. Siempre hay una tranca
más angosta que las otras. El detector la encuentra, le pone número en pesos y arma la
oferta que la destraba.

---

## Qué hay acá

| Archivo | Para qué |
|---|---|
| [01-mapa-de-dolores.md](01-mapa-de-dolores.md) | Las 8 áreas, cómo suena cada dolor, señales, preguntas, fórmula de costo, arreglo. Incluye el banco de frases (lo que dice el dueño → el dolor) |
| [02-senales-desde-afuera.md](02-senales-desde-afuera.md) | Diagnóstico de 15 min sin hablar con nadie: Google Maps, Instagram, web, Meta Ads, empleo, comprador misterioso. Checklists por rubro y ficha de observación |
| [03-entrevista-de-diagnostico.md](03-entrevista-de-diagnostico.md) | La conversación de 20 min: pregunta llave por área, 5 porqués, cómo cuantificar, ficha de entrevista |
| [04-de-dolor-a-oferta.md](04-de-dolor-a-oferta.md) | Catálogo de soluciones, matriz dolor → oferta de 30 días → estructural, priorización y cómo presentar |
| [diagnostico/](diagnostico/) | Generador del diagnóstico en PDF (`node generar.js negocio.json`) |
| [formulario/](formulario/) | Autodiagnóstico web: el dueño responde 16 preguntas y recibe su mapa + CTA a WhatsApp. Es el captador de leads |
| `.claude/skills/detector-dolores/` | Skill de Claude Code: `/detector-dolores` hace el análisis y produce el diagnóstico |

---

## El flujo

```
CAPTAR        El negocio llega por dos vías:
              a) tú lo eliges (CSV de leads, lo viste en la calle, te lo refirieron)
              b) él llega solo por el formulario web (formulario/index.html)

OBSERVAR      15 min con 02-senales-desde-afuera.md → ficha de observación
(sin hablar)  Comprador misterioso siempre. Hipótesis del cuello de botella.

CONVERSAR     20 min con 03-entrevista-de-diagnostico.md → ficha de entrevista
              Confirmar, cuantificar en pesos, agendar la revisión.

DIAGNOSTICAR  Llenar diagnostico/negocio.json → node generar.js
              Sale un PDF de 3 páginas: mapa de 8 áreas, el cuello de botella con
              número, plan de 30 días. Sin precios.

OFRECER       Con 04-de-dolor-a-oferta.md elegir la oferta.
              La propuesta con precios se genera con prospeccion-ventas/propuesta/.
```

Tiempo total por negocio: **40 minutos de trabajo y una espera de un día** (el
comprador misterioso necesita ver si hacen seguimiento).

---

## Usar el skill (Claude Code)

```
/detector-dolores Minimarket Don Lucho, Maipú. IG @donlucho.maipu, está en Google Maps.
Fui a comprar: solo efectivo, cuaderno de fiado, el dueño solo en caja.
```

O pegando las notas de una conversación, o las respuestas del formulario. El skill lee
los cuatro documentos, clasifica lo que encuentra por área con su evidencia, calcula el
costo con los datos que haya (marcando lo que es supuesto), escribe el `negocio.json`,
corre el generador y propone la oferta y el primer mensaje.

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
- `areas` — las 8, cada una con `estado` (`bien` / `alerta` / `critico`), `hallazgo`
  y `evidencia` (de dónde salió: reseña, comprador misterioso, lo que dijo el dueño).
- `cuellos` — el cuello de botella primero, después 2 dolores secundarios. Cada uno con
  `cuanto_cuesta` (el número que aceptó el dueño) y `como_se_arregla`.
- `plan_30_dias` — semana a semana, sin precios.
- `siguiente_paso` — una sola acción con fecha.

---

## El formulario de autodiagnóstico

`formulario/index.html` es una página estática: 16 preguntas (2 por área), scoring en
el navegador, resultado con el mapa de 8 áreas y los 3 cuellos de botella, y un botón
de WhatsApp con el resultado ya escrito en el mensaje. No necesita servidor: se sube a
cualquier hosting o se enlaza desde la bio de Instagram.

El mensaje de WhatsApp llega con el nombre del negocio, rubro y los 3 dolores. Es la
entrada perfecta para el comprador misterioso y la entrevista: el dueño ya levantó la
mano y ya dijo qué le duele.
