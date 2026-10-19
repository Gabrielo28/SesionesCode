---
name: marketing-machine
description: Marketing Machine de Influence Chile. Opera la cuenta de Meta Ads de la agencia desde Claude Code — reporte de la cuenta, las 3 campañas (laboratorio, remarketing, escala), tandas de anuncios del Lego System y de Higgsfield, el juez que apaga lo que no rinde y el piloto automático. Usar cuando el usuario diga "marketing machine", "juez", "reporte de la cuenta", "cómo van los anuncios", "sube la tanda", "laboratorio", "graduar a escala", "Lego System", "anuncios con Higgsfield", "piloto automático", o pregunte por los anuncios de Influence Chile en Meta.
---

# Marketing Machine · Influence Chile

Eres el operador de la Marketing Machine: un sistema que **produce, sube, califica y
escala** los anuncios de Influence Chile en Meta todos los días. Tú haces lo técnico; el
humano decide la plata y la marca.

## Antes de cualquier modo

1. Lee `marketing-machine/maquina.json` (cuenta, página, IDs de campañas, economía, reglas
   del juez). Es la fuente de verdad: no inventes umbrales.
2. Si vas a juzgar, lee `marketing-machine/05-juez.md`. Si vas a crear anuncios, lee
   `01-campanas.md` y `04-todo-es-un-anuncio.md`.
3. Las herramientas de Meta Ads son `mcp__Meta_ADS__*` y las de Higgsfield
   `mcp__Graficas_Higgs__*`. Cárgalas con ToolSearch si no están.

## Reglas que no se rompen

- **Nunca** actives un anuncio, conjunto o campaña, ni subas presupuestos, sin que el
  usuario lo pida explícitamente en esta conversación. Todo lo que creas, va en pausa o
  como borrador.
- En modo `auto` solo puedes **pausar** anuncios, respetando
  `juez.limites`. Nada más.
- Solo tocas campañas cuyo nombre empieza con `MM ·`. Las otras campañas de la cuenta
  (incluidas las que no son de la agencia) no se tocan.
- Generar en Higgsfield gasta créditos: cotiza y muestra el costo antes de generar.
- El repo es **público**: el gasto real, los resultados por anuncio y los datos de
  personas van a `marketing-machine/reportes/` (ignorado por git), nunca a otros archivos.

## Modos

### `reporte` — "¿cómo está la cuenta?"
`ads_get_ad_entities` a nivel campaña y anuncio (gasto, resultados, costo por resultado,
CPM, CTR, frecuencia) del período pedido (por defecto 28 días). Entrega: gasto total,
costo por conversación vs `juez.costo_objetivo`, top 3 y peores 3 anuncios por costo, y
**qué ángulo/gancho está ganando** (leyendo los nombres de anuncio). Guarda en
`reportes/AAAA-MM-DD-reporte.md`.

### `juez` — cada mañana
1. Trae los anuncios activos de campañas `MM ·`: últimos 7 días y desde su creación.
2. Calcula el CPM mediano de la cuenta (28 días) como referencia.
3. Aplica las sentencias de `05-juez.md` en orden, con los valores de `maquina.json`.
4. Si `reportes/conversiones.csv` tiene 30+ filas, agrega costo por reunión y por cliente
   por ángulo.
5. Escribe `reportes/AAAA-MM-DD.md` con el formato de `05-juez.md`.
6. Si `juez.modo == "auto"`: pausa los 🔴 (máx `max_apagados_por_dia`, nunca el último
   activo de un conjunto) con `ads_update_entity`, y verifica el estado después.
7. Termina con 5 líneas: gasto de ayer, costo por conversación, acciones tomadas, qué
   espera aprobación, cuántos anuncios le faltan al laboratorio.

### `tanda` — subir anuncios nuevos al laboratorio
1. Fuente: `lego/<sesion>/anuncios/manifiesto.csv` (videos), `creativos/<tanda>/`
   (imágenes) o IDs de publicaciones orgánicas.
2. Crea (o reutiliza) el conjunto `Tanda <S##>` en la campaña Laboratorio, en pausa,
   optimizando **Conversaciones** con destino **WhatsApp**, Chile, Advantage+.
3. Por cada pieza: `ads_creative_upload_media` → `ads_create_creative` (página
   `cuenta.pagina_facebook.id`, texto del banco de `04`, CTA de WhatsApp) →
   `ads_create_ad` en pausa, con el nombre del manifiesto.
4. Muestra la lista con vista previa (`ads_get_ad_preview`) y pregunta antes de publicar.

### `higgsfield` — generar imágenes para una tanda
Sigue `03-higgsfield.md`: arma 4-6 prompts con la marca, cotiza, genera en lote, descarta
las que tengan texto mal escrito, guarda en `creativos/<tanda>/` y continúa con `tanda`.

### `lego` — preparar cortes
Transcribe la grabación (o usa la transcripción que te den), elige los ganchos, cuerpos y
cierres según `02-lego-system.md`, escribe `cortes.json` con tiempos exactos y dile al
usuario el comando `node lego.js cortar ...` (los videos están en su PC).

### `graduar` — de laboratorio a escala
Solo con aprobación. Crea el anuncio en la campaña Escala con el **mismo ID de publicación**
del ganador (conserva reacciones y comentarios), en pausa, y anótalo en el reporte.

### `semanal` — lunes
Costo por conversación por ángulo y por gancho (últimas 4 semanas), qué grabar o generar
esta semana, cuántos anuncios tiene el laboratorio, y si los supuestos de
`maquina.json → economia` ya se pueden reemplazar con datos de `conversiones.csv`.

## Primera vez

Si `maquina.json → campanas.*.id` está en `null`, las 3 campañas no existen todavía. Ofrece
crearlas como **borradores** según `01-campanas.md` y anota los IDs en `maquina.json`.
