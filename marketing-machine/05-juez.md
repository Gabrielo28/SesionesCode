# 05 · El juez: CPA, CPM y la regla de apagado

Cada mañana Claude revisa todos los anuncios activos de las campañas `MM ·` y les dicta
sentencia. Las reglas viven en `maquina.json → juez` para poder ajustarlas sin tocar este
documento.

## Las métricas que mira

| Métrica | Qué dice | Cuándo preocupa |
|---|---|---|
| **Costo por conversación** (CPA) | Lo que de verdad importa | Sobre $3.000 (`costo_techo`) |
| **CTR** | Si el gancho detiene el scroll | Bajo 0,8% → gancho muerto |
| **CPM** | Cuánto le cobra Meta por mostrarlo (calidad + competencia) | Más del doble del CPM mediano de la cuenta |
| **Frecuencia 7 días** | Cuántas veces vio lo mismo la misma persona | Sobre 3 → fatiga |
| **Gasto** | Si ya hay datos suficientes para juzgar | Bajo $1.500 → todavía no se juzga |

## Las sentencias

Se evalúan en este orden; la primera que se cumple gana.

| Sentencia | Regla (valores por defecto) | Acción |
|---|---|---|
| ⏳ **ESPERAR** | Gastó menos de $1.500 | Nada. Está aprendiendo |
| 🔴 **APAGAR · sin resultado** | Gastó $3.000+ y 0 conversaciones | Pausar |
| 🔴 **APAGAR · caro** | Gastó $6.000+ y cuesta más de $3.000 por conversación | Pausar |
| 🔴 **APAGAR · gancho muerto** | Gastó $3.000+ y CTR bajo 0,8% | Pausar. El gancho no sirve; probar otro gancho con el mismo cuerpo |
| 🏆 **GANADOR** | 5+ conversaciones, $1.500 o menos cada una y CTR 1,5%+ | Graduar a Escala (mismo ID de publicación) |
| 🟠 **FATIGA** (escala y remarketing) | Frecuencia 7d sobre 3, o costo 7d 50% sobre su histórico | Reemplazar por el siguiente ganador |
| 🟢 **SIGUE** | Ninguna de las anteriores | Nada |

## Límites de seguridad

- **Nunca** apaga el último anuncio activo de un conjunto (dejaría el conjunto sin entregar).
- Máximo **5 apagados por día**. Si hay más, avisa: algo más grande está pasando
  (oferta, página, WhatsApp caído).
- En Escala, sube presupuesto **máximo 20% por día** y solo con aprobación humana.
- En modo `auto` el juez **solo puede pausar anuncios**. Graduar, crear, activar y mover
  presupuesto siempre lo aprueba una persona.

## Modo

`maquina.json → juez.modo`:

| Modo | Qué hace |
|---|---|
| `recomendar` (por defecto) | Escribe el reporte con las sentencias. No cambia nada en Meta |
| `auto` | Además pausa los 🔴 que cumplan los límites de seguridad |

Empezar en `recomendar` al menos 2 semanas. Si las sentencias te parecen bien, pasar a `auto`.

## Más allá del costo por conversación: la planilla de conversiones

Meta solo ve hasta la conversación. Que una conversación termine en cliente se ve en el
WhatsApp. Lleva un registro mínimo en `reportes/conversiones.csv` (no se sube a git porque
tiene datos de personas):

```
fecha,anuncio,negocio,rubro,estado,monto_mensual
2026-10-20,S43 · Lego · son-las-11 · auditoria-gratis+whatsapp,Café Ejemplo,gastronomía,reunion,
```

`estado`: `conversacion` → `calificado` → `reunion` → `cliente` | `perdido`.
En WhatsApp Business, los mensajes que llegan por anuncio traen la etiqueta del anuncio;
eso es lo que va en la columna `anuncio`.

Con 30+ filas, el juez agrega una segunda columna de verdad: **costo por reunión** y
**costo por cliente por ángulo**. Un anuncio barato que nunca trae reuniones se apaga
igual.

## El reporte de cada mañana

Lo escribe en `reportes/AAAA-MM-DD.md`:

```
## Juez · 2026-10-21

Gasto ayer: $13.200 · Conversaciones: 9 · Costo: $1.467 (objetivo $1.500) ✅

| Anuncio | Gasto | Conv. | Costo | CTR | Sentencia |
| S43 · Lego · redes-dar-mas · ... | $4.100 | 4 | $1.025 | 2,9% | 🟢 SIGUE |
| S43 · Higgs · oferta · coral | $3.400 | 0 | — | 0,6% | 🔴 APAGAR · sin resultado |

Acciones tomadas (modo auto): pausado S43 · Higgs · oferta · coral
Para aprobar: graduar "S42 · Lego · son-las-11 · caso+whatsapp" a Escala
Laboratorio: 5 anuncios activos de 8 → faltan 3 para la próxima tanda
```
