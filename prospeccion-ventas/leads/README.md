# Prospector de leads

Skill que busca negocios reales de un rubro en una zona, junta sus datos de contacto,
los ordena por oportunidad según lo que vendes y deja el mensaje redactado para los
mejores. Sale un dashboard HTML para leer y un JSON + CSV para el CRM.

La skill está en `.claude/skills/prospector-leads/SKILL.md`. Se activa sola cuando
pides prospectos ("búscame 50 clínicas dentales en Providencia y Ñuñoa").

## Los 5 bloques

| Bloque | Dónde vive |
|---|---|
| 1. Preguntas antes de actuar (rubro, zona, qué ofreces, cuántos), siempre | `SKILL.md` |
| 2. Proceso explícito: búsquedas por barrio × sinónimo, deduplicar, enriquecer | `SKILL.md` |
| 3. Reglas de oportunidad que se invierten según lo que vendes | **`reglas.js`** |
| 4. Formato de salida: dashboard + JSON + CSV | `generar.js` |
| 5. Cierre: pregunta dónde guardar, resume, tú decides | `SKILL.md` |

## El bloque 3 es tuyo

`reglas.js` define qué es "oportunidad alta". La matriz:

| Madurez del canal | construir | optimizar | escalar |
|---|---|---|---|
| ninguna | alta | baja | baja |
| abandonada | alta | alta | baja |
| desordenada | media | alta | media |
| buena | baja | media | alta |

Si tu criterio es otro, cámbialo ahí y queda para todas las campañas.

## Probar el generador

```bash
node generar.js ejemplo-campana.json
```

Genera `prospectos-ejemplo-dentales-oriente.html / .crm.json / .csv` con datos ficticios.
Cambia `"tipo_oferta": "optimizar"` por `"construir"` y vuelve a correr: el dentista sin
web ni Instagram pasa del último lugar al segundo.

## Campañas

Cada campaña real va en `campanas/<fecha>-<slug>/` con su `campana.json` y los tres
archivos generados. La skill pregunta antes de guardar.
