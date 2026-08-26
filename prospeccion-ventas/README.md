# Sistema de Prospección y Ventas — Influence Chile

## Qué hay acá

| Archivo | Para qué |
|---|---|
| [01-icp-y-scoring.md](01-icp-y-scoring.md) | A quién vendemos, señales de compra, scoring 0-100 |
| [02-guiones-de-contacto.md](02-guiones-de-contacto.md) | Primer contacto: DM, email, WhatsApp, llamada |
| [03-auditoria-express.md](03-auditoria-express.md) | El proceso de auditoría que abre la conversación |
| [04-seguimiento-y-objeciones.md](04-seguimiento-y-objeciones.md) | Las 7 objeciones y las reglas de la reunión |
| [05-secuencias-completas.md](05-secuencias-completas.md) | Copy completo de las 3 secuencias de seguimiento |
| [06-diagnostico-workflows.md](06-diagnostico-workflows.md) | Diagnóstico de procesos internos para vender automatización con IA |
| [07-icp-automatizacion.md](07-icp-automatizacion.md) | A quién vendemos automatización con IA — distinto del ICP de redes, 100% remoto |
| [leads-chile-132-empresas.csv](leads-chile-132-empresas.csv) | 132 empresas chilenas calificadas para redes (39 de salud sirven también para automatización) |
| [leads-automatizacion-chile.csv](leads-automatizacion-chile.csv) | 21 empresas nuevas (inmobiliaria + servicios profesionales B2B) para automatización, con fuente pública de cada señal |
| [propuesta/](propuesta/) | Generadores de propuesta PDF (redes y diagnóstico de workflows) |
| [../diagnostico-workflows.html](../diagnostico-workflows.html) | Cuestionario web público: autodiagnóstico de 2 minutos que llega calificado por WhatsApp |

---

## El flujo semanal

```
LUNES        Elegir 25 empresas del CSV (prioridad A primero)
             Revisar su Instagram → confirmar el scoring
             
MARTES       Escribir los 25 primeros contactos (guion 02)
             Interactuar antes en sus cuentas: like + historia
             
MIÉRCOLES    Producir auditorías solo para los que respondieron
             
JUEVES       Mandar auditorías + pedir reunión
             Seguimiento día 4 de la semana anterior
             
VIERNES      Reuniones agendadas
             Propuestas el mismo día (generador de propuesta/)
```

**Meta:** 25 contactos → 6 respuestas → 2-3 reuniones → 1 cierre.
Cuatro semanas de esto son 3 clientes nuevos al mes.

---

## El listado de leads

`leads-chile-132-empresas.csv` — ábrelo en Excel. Columnas:

- **prioridad / puntaje** — A, B o C. Empieza por las A.
- **zona** — RM, Valparaíso, Biobío o sin dato
- **rubro** — clasificado según lo que vendes
- **web / linkedin** — para revisar antes de escribir
- **instagram_buscar** — link directo a buscar la empresa en Instagram
- **biblioteca_anuncios** — link a la Biblioteca de Anuncios de Meta para ver
  si ya están pauteando (señal fuerte: ya gastan en publicidad)
- **notas** — marca las que no tienen web propia, que son las de mayor necesidad

Composición: 49 fitness/wellness/estética · 35 centros médicos y clínicas ·
25 moda/retail · 11 gastronomía · 4 cosmética · 3 entretención · 2 odontología ·
2 farmacia · 1 belleza. 75 en Región Metropolitana.

Ya vienen excluidos gremios, universidades, corporaciones municipales, empresas
extranjeras y una agencia de marketing que se había colado.

---

## Generar una propuesta

```bash
cd propuesta && node generar.js
```

1. Edita `cliente.json` con los datos del prospecto (o crea uno nuevo, ej. `sakura.json`)
2. Corre `node generar.js sakura.json`
3. Salen `propuesta-sakura.html` y `propuesta-sakura.pdf`

**Campos clave del JSON:**
- `objetivo` — en las palabras del cliente, tal como lo dijo en la reunión
- `diagnostico` — los 3 hallazgos de la auditoría, con su impacto
- `competencia` — la primera fila siempre son ellos, después 2 competidores
- `plan_recomendado` — `presencia`, `crecimiento` o `autoridad`
- `addons` — `meta_ads`, `contenido`, `influencers`
- `roadmap` — las fases con entregables concretos

Los precios de planes y add-ons están dentro de `generar.js`. Si suben, se
cambian ahí una vez y quedan para todas las propuestas.

---

## Generar un diagnóstico de workflows

Metodología completa en [06-diagnostico-workflows.md](06-diagnostico-workflows.md). El
cuestionario web (`../diagnostico-workflows.html`) hace el primer filtro solo; para el
documento formal después de la llamada:

```bash
cd propuesta && node generar-diagnostico.js
```

1. Edita `cliente-workflows.json` con los hallazgos de la llamada (o crea uno nuevo)
2. Corre `node generar-diagnostico.js otraempresa.json`
3. Salen `diagnostico-<empresa>.html` y `diagnostico-<empresa>.pdf`

Sin precios en el documento — el precio va en la reunión, no en el diagnóstico.

---

## El listado de leads de automatización

Dos fuentes, ver [07-icp-automatizacion.md](07-icp-automatizacion.md) para el criterio completo:

1. **Cross-sell inmediato:** filtra `leads-chile-132-empresas.csv` por rubro `Centro médico /
   Clínica`, `Odontología` o `Farmacia / Salud retail` — 39 empresas ya calificadas para redes
   que también encajan en automatización.
2. **`leads-automatizacion-chile.csv`** — 21 empresas nuevas en inmobiliaria/corretaje y
   servicios profesionales B2B (legal, contable, RR.HH.), encontradas por búsqueda web. A
   diferencia del CSV de redes, **no trae facturación ni cantidad de empleados** porque esos
   datos no salían de fuentes públicas verificables — cada fila trae la señal encontrada, la
   fuente, y qué falta confirmar antes de escribirle. No sirve para mandar en frío tal cual:
   primero hay que revisar el sitio de cada una y confirmar tamaño real de equipo.

---

## Qué queda pendiente

- **Contactos individuales** (nombre, email y teléfono de cada dueño o encargado
  de marketing): la base de datos se quedó sin créditos después de descargar las
  132 empresas. Con créditos nuevos se corre el paso que faltó y quedan enriquecidas.
- Mientras tanto, el contacto va por **DM de Instagram**, que igual es el canal
  con mejor tasa de respuesta en Chile para PYME.
