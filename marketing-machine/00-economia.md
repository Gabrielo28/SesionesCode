# 00 · El 80/20: cuánto puedes pagar por un cliente

Antes de gastar un peso en anuncios hay que saber **cuánto vale un cliente** y, de ahí,
**cuánto puedes pagar por una conversación de WhatsApp**. Ese número es el que usa el juez
(`05-juez.md`) para decidir qué anuncio vive y cuál se apaga.

## La cadena

```
Conversación WA  →  Reunión  →  Cliente  →  Meses pagando  →  Margen
     $X              15%          25%        6 meses             50%
```

## Los números de Influence Chile

| Dato | Valor | Fuente |
|---|---|---|
| Ticket mensual promedio | **$400.000** | Mezcla de Presencia $290k, Crecimiento $450k y Autoridad $749.990 (web) |
| Meses que se queda un cliente | **6** | ⚠️ supuesto, reemplazar con el promedio real |
| Margen bruto | **50%** | ⚠️ supuesto (lo que queda tras pagar equipo y producción) |
| LTV en ventas | 400.000 × 6 = **$2.400.000** | |
| LTV en margen | 2.400.000 × 50% = **$1.200.000** | |

### Golden Ratio: LTV : CAC = 3 : 1

Por cada peso que pagas para conseguir un cliente, ese cliente debe dejarte tres de margen.

**CAC máximo = $1.200.000 ÷ 3 = $400.000 por cliente nuevo.**

### De cliente a conversación

| Paso | Tasa | Estado |
|---|---|---|
| Conversación → reunión | 15% | ⚠️ supuesto |
| Reunión → cliente | 25% | ⚠️ supuesto |
| **Conversación → cliente** | **3,75%** (1 de cada 27) | |

**Costo máximo por conversación = $400.000 × 3,75% = $15.000.**

## Qué significa esto

- El costo histórico por conversación de la cuenta está muy por debajo de ese techo
  (ver el reporte inicial en `reportes/`, que no se sube a git).
- O sea, **el problema no es el costo del anuncio, es lo que pasa después del anuncio**:
  si con las tasas de arriba las conversaciones pagadas deberían haber sido muchos más
  clientes de los que fueron, la fuga está en la respuesta, la calificación o el cierre,
  no en Meta.
- Por eso la máquina mide hasta el cierre (ver la planilla de conversiones en
  `05-juez.md`). Sin ese dato, el juez solo puede optimizar lo barato, no lo rentable.

## Objetivo operativo del juez

El techo teórico ($15.000) es para saber que hay margen, no para gastarlo. El juez trabaja
con números que la cuenta ya demostró que puede lograr:

| | Valor | Por qué |
|---|---|---|
| `costo_objetivo` | **$1.500** por conversación | Algo mejor que lo que la cuenta logra hoy, y lejos de su mejor histórico |
| `costo_techo` | **$3.000** | El doble del objetivo: sobre esto, se apaga |

Cuando tengas 30 días de datos de cierre reales, reemplaza los supuestos en
`maquina.json → economia` y pídele a Claude: *"recalcula la economía de la máquina"*.
