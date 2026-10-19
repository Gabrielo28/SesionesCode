# 06 · Piloto automático: la máquina corriendo sola

El piloto es una **tarea programada de Claude** que corre el skill `marketing-machine`
todos los días, sin que nadie abra una conversación.

## La rutina

| Cuándo | Qué hace | Toca Meta |
|---|---|---|
| **Todos los días, 8:00 (Chile)** | Juez: lee los anuncios `MM ·`, dicta sentencias, escribe el reporte y te avisa | Solo en modo `auto`: pausa 🔴 |
| **Lunes, 8:30** | Revisión semanal: costo por ángulo y gancho, qué funcionó, qué grabar o generar esta semana, cuántos anuncios faltan en el laboratorio | No |
| **Cuando haya tanda nueva** (a pedido) | Sube la tanda Lego/Higgsfield al laboratorio, en pausa | Crea anuncios en pausa |

## Con o sin revisión humana (tú decides)

| Nivel | Configuración | Qué haces tú |
|---|---|---|
| 1 · Copiloto | `juez.modo = "recomendar"` | Lees el reporte y apruebas cada cambio |
| 2 · Piloto | `juez.modo = "auto"` | Solo apruebas graduaciones, tandas nuevas y presupuesto |

Nunca hay un nivel 3. Activar anuncios, subir presupuesto y publicar creativos nuevos
siempre pasa por una persona: es plata real y es la marca de la agencia.

## Cómo se crea la tarea programada

En una sesión de Claude Code con este repo y el conector de Meta Ads, pedir:

> "Programa el piloto automático de la Marketing Machine: juez de lunes a viernes a las 8:00
> hora de Chile y revisión semanal los lunes a las 8:30."

Claude crea la tarea con el prompt de abajo. La tarea abre una sesión nueva cada vez, lee
este repo y corre el skill. Como `reportes/` no se sube a git (el repo es público), el
reporte de cada día queda en la sesión de la tarea, y te llega el aviso al teléfono con el
resumen. Si corres el juez en tu PC, además queda guardado en `reportes/`.

### Prompt de la tarea diaria

```
Eres el piloto automático de la Marketing Machine de Influence Chile.
En el repo SesionesCode, usa el skill marketing-machine en modo "juez":
1. Lee marketing-machine/maquina.json.
2. Trae de Meta Ads (cuenta 874019311966265) los anuncios de las campañas que empiezan
   con "MM ·": gasto, conversaciones, costo por resultado, CTR, CPM y frecuencia,
   de los últimos 7 días y desde su creación.
3. Aplica las reglas del juez (marketing-machine/05-juez.md) y escribe el reporte.
4. Si juez.modo es "auto", pausa solo los anuncios en 🔴 respetando los límites.
5. Termina con un resumen de 5 líneas: gasto de ayer, costo por conversación,
   acciones tomadas y lo que necesita aprobación humana.
No actives anuncios, no cambies presupuestos y no crees campañas.
```

## Si algo se rompe

| Síntoma | Probable causa | Qué hacer |
|---|---|---|
| El reporte dice "0 anuncios MM" | Las campañas no se publicaron o cambiaron de nombre | Revisar en Administrador de anuncios |
| Error de permisos de Meta | Expiró la conexión del conector | Reconectar Meta Ads en los conectores de claude.ai |
| 5+ apagados el mismo día | Cambió algo grande (WhatsApp caído, página restringida, oferta) | Revisar antes de seguir pausando |
