---
name: prospector-leads
description: Prospector de leads. Busca negocios reales de un rubro en una zona, junta sus datos de contacto (email, teléfono, WhatsApp, web, Instagram), los clasifica en oportunidad Alta / Media / Baja según lo que el usuario vende, redacta el mensaje de contacto para los mejores y entrega un dashboard HTML + JSON y CSV para el CRM. Usar cuando el usuario pida "prospectos", "leads", "lista de negocios", "a quién le escribo", "búscame clínicas / restaurantes / gimnasios en X", "arma una campaña de prospección" o quiera llenar el CRM.
---

# Prospector de leads

Le pasan un rubro, una zona, qué se va a ofrecer y cuántos prospectos quiere. Vuelve
con la lista completa ordenada por oportunidad, el mensaje redactado para los mejores
y los archivos para el CRM. Todo con evidencia: cada dato cita de dónde salió.

Contexto del repo (léelo una vez por sesión, no lo copies):
- `prospeccion-ventas/01-icp-y-scoring.md`: ICP de Influence Chile, señales de compra y descartes
- `prospeccion-ventas/02-guiones-de-contacto.md`: tono y reglas del primer mensaje
- `prospeccion-ventas/leads/reglas.js`: **las reglas de oportunidad** (bloque 3)
- `prospeccion-ventas/leads/ejemplo-campana.json`: la estructura exacta del JSON de campaña

---

## Bloque 1 — Preguntas antes de actuar

**Siempre, en cada campaña, aunque haya una anterior en la conversación.** Si la oferta
cambia entre campañas y asumes el contexto anterior, la clasificación sale al revés.
Puedes proponer como opción lo que se usó la vez pasada, pero el usuario lo confirma.

Pregunta con AskUserQuestion (lo que el usuario ya dijo en el mensaje no se vuelve a preguntar,
pero sí se confirma el tipo de oferta):

1. **Rubro.** Qué tipo de negocio. Si es amplio ("salud"), acótalo a uno o dos rubros.
2. **Zona.** Ciudad, sector o comunas concretas. Si dice "Santiago", propón el sector
   (Oriente, Centro, Sur…) o las 4-8 comunas a cubrir.
3. **Qué vas a ofrecer** y, de ahí, el **tipo de oferta** y el **canal**:
   - `construir`: algo que se hace desde cero (web nueva, redes desde cero, primera tienda online)
   - `optimizar`: ordenar o mejorar lo que ya existe (gestión de redes, rediseño, SEO, contenido)
   - `escalar`: crecer sobre una base que ya funciona (pauta, influencers, automatización)
   - canal: `web`, `redes` o `ambos`. Es el canal donde vas a trabajar.
   Si el servicio no calza claro en uno, pregúntalo así: "¿Tu mejor cliente es el que
   no tiene nada, el que tiene algo mal hecho, o el que ya lo hace bien y quiere más?"
4. **Cuántos prospectos** (meta). Por defecto 50.

Opcional, solo si aplica: exclusiones (clientes actuales, ya contactados). Si existen
campañas previas en `prospeccion-ventas/leads/campanas/`, ofrece excluir los que ya
están en sus `.crm.json`.

## Bloque 2 — El proceso, en orden

No es "busca negocios". Es esto:

1. **Plan de búsqueda.** Expande la zona en comunas, y las comunas grandes en barrios
   o ejes (ej. Providencia → Barrio Italia, Manuel Montt, Los Leones; Ñuñoa → Plaza
   Egaña, Villa Frei, Irarrázaval). Expande el rubro en 2-3 sinónimos como lo busca la
   gente ("clínica dental", "dentista", "ortodoncia"). Matriz = barrios × sinónimos.
   Apunta a 1,5 × la meta en candidatos crudos (se pierden en deduplicar y descartar).
2. **Lanzar búsquedas múltiples**, nunca una sola por ciudad. Con WebSearch, una
   consulta por celda de la matriz, y variantes que sacan negocios distintos:
   `"<rubro> <barrio>"`, `"<rubro> <comuna> instagram"`, `"<rubro> <comuna> contacto"`,
   directorios (`site:doctoralia.cl`, `site:paginasamarillas.cl`, `site:instagram.com`).
   Si hay herramientas de datos conectadas (Apollo, vibe-prospecting), úsalas como
   fuente extra para negocios con dominio; no reemplazan la búsqueda por barrio.
   Registra cada consulta en `campana.busquedas` con cuántos candidatos útiles dio.
   Para metas de 30+, reparte por comunas entre subagentes (Agent) en paralelo, cada uno
   devuelve sus candidatos en el formato de `prospectos` del JSON.
3. **Deduplicar** por dominio, teléfono y nombre normalizado (el generador lo vuelve a
   hacer, pero no gastes enriquecimiento en duplicados). Descarta lo que el ICP descarta
   (franquicias grandes, cadenas manejadas por casa matriz, negocios cerrados).
4. **Enriquecer cada candidato**:
   - Web (WebFetch a la home y a `/contacto`): email, teléfono, link de WhatsApp,
     link de Instagram, si tiene reservas/compra online, si se ve al día (año del footer,
     https, si carga).
   - Instagram y Google Maps suelen no ser accesibles desde aquí. Usa lo que muestre el
     buscador (seguidores, rating y reseñas en el snippet). Lo que no se pueda ver queda
     vacío, **no se inventa**.
   - Biblioteca de anuncios de Meta, si el servicio es pauta: anota si tienen anuncios.
5. **Llenar las señales** de madurez de cada prospecto (`senales.web`, `senales.redes`):
   `ninguna` · `abandonada` (existe pero muerta o mínima) · `desordenada` (activa pero
   mal hecha) · `buena`. Cada valor tiene que poder explicarse con lo que viste; si no
   viste el canal, déjalo vacío. Escribe el `hallazgo`: una frase concreta y verificable
   ("último post hace 5 meses", "el anuncio lleva al home, no a reservar").
6. Si quedaste bajo la meta, amplía con más barrios o sinónimos antes de cerrar. Si no
   hay más, entrega lo que hay y dilo.

## Bloque 3 — Reglas de decisión condicionales

La clasificación la hace `prospeccion-ventas/leads/reglas.js`, no tu intuición. El
criterio **se invierte según el tipo de oferta**:

| Madurez del canal | construir | optimizar | escalar |
|---|---|---|---|
| ninguna | **alta** | baja | baja |
| abandonada | **alta** | **alta** | baja |
| desordenada | media | **alta** | media |
| buena | baja | media | **alta** |

- Si vendes algo desde cero, el negocio sin presencia es tu mejor prospecto.
- Si vendes optimización, ese mismo negocio no sirve: no hay nada que mejorar. Tu alta
  es el que ya tiene algo, pero desordenado.
- Sobre eso: un alta sin reseñas ni actividad baja a media (puede no estar operando);
  un prospecto sin ningún dato de contacto baja un nivel. Demanda (reseñas, rating,
  sucursales) y contactabilidad ordenan dentro de cada nivel.
- Puedes forzar un nivel con `oportunidad` + `motivo_override` cuando hay una razón
  concreta (vacante de marketing publicada, local nuevo, competidor con agencia). Sin
  motivo, el generador lo rechaza.

`reglas.js` es del usuario: si te pide cambiar el criterio, se cambia ahí (y queda para
todas las campañas), no en el JSON de una campaña.

## Bloque 4 — Formato de salida definido

1. Escribe el JSON de la campaña con la estructura de `ejemplo-campana.json`
   (`campana` + `prospectos`, cada prospecto con `fuentes`).
2. **Mensajes**: redacta `mensaje` y `canal_mensaje` para cada prospecto de oportunidad
   alta (si son más de 15, para los 15 de mayor puntaje y dilo). Reglas de
   `02-guiones-de-contacto.md`: máximo 4 líneas, se presenta Gabriel de Influence Chile,
   un hallazgo concreto y real de ese negocio, cero precio, cero link, pide permiso para
   mandar algo ("¿te mando el análisis?"). Canal: el que tenga (DM Instagram > WhatsApp
   > email); si es email, igual corto.
3. Corre el generador:
   ```
   node prospeccion-ventas/leads/generar.js <ruta>/campana.json
   ```
   Produce en la misma carpeta `prospectos-<slug>.html` (dashboard: resumen, tabla
   filtrable ordenada por oportunidad, mensajes con botón copiar / abrir WhatsApp),
   `.crm.json` (plano, para importar) y `.csv` (HubSpot / Excel).
4. Resuelve los AVISOS que imprima (alta sin mensaje, prospecto sin fuentes) y vuelve a correr.

## Bloque 5 — Cierre con el humano al mando

- **Antes de guardar, pregunta dónde.** Propón por defecto
  `prospeccion-ventas/leads/campanas/<fecha>-<slug>/`. No escribas archivos de campaña
  hasta tener la respuesta. (Los datos se juntan en memoria o en el scratchpad mientras tanto.)
- Al final, resume en el chat, corto:
  1. Cuántos prospectos vs. la meta, cuántos con email, cuántos con teléfono/WhatsApp, cuántos sin contacto
  2. Alta / media / baja
  3. Los 5 mejores, una línea cada uno con su hallazgo
  4. Qué no se pudo ver (ej. "Instagram no accesible: seguidores sacados del buscador en 12 casos")
  5. Rutas de los 3 archivos
- Y deja la decisión al usuario: **seguir** (otra tanda, más comunas), **profundizar**
  (diagnóstico con la skill `detector-dolores` de los 3-5 mejores antes de escribirles,
  o propuesta con `prospeccion-ventas/propuesta/`), o **cargar al CRM**. No mandes
  mensajes ni cargues nada a un CRM sin que lo pida explícitamente.

## Reglas

- **Evidencia o nada.** Nada de emails "probables" (info@dominio sin verlo publicado),
  seguidores estimados ni reseñas inventadas. Vacío es mejor que falso.
- **Solo datos de contacto públicos del negocio** (los que el propio negocio publica
  para que lo contacten). Nada de datos personales de empleados sacados de otras fuentes.
- **Un dato mal clasificado arruina el orden.** Si dudas entre dos madureces, elige la
  que puedas defender con el hallazgo y anótalo.
- Español de Chile, directo, como los documentos del repo.
