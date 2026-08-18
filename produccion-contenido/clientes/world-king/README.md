# World King — Producción de gráficas

Cliente en **prelanzamiento**. La propuesta completa (4 reels · 4 posts · 8 historias)
está en `plan-lanzamiento-2026.md`. La marca, la paleta y los assets pendientes
están en `marca.json`.

## Estructura

```
marca.json      Paleta, tono, concepto y lista de assets que faltan del cliente
graficas/       Capa tipográfica: HTML + Chrome headless → PNG/
  build.js        Define las piezas y las renderiza
  PNG/            Salida lista para publicar
visuales/       Piezas fotorrealistas generadas con Higgsfield (IA)
```

## Regenerar las gráficas

```bash
cd graficas
node build.js
```

Busca Chrome/Chromium solo; si no lo encuentra, define `CHROME_PATH`.
Las piezas se declaran en el array `piezas[]` de `build.js`.

**Los datos pendientes del cliente están como constantes arriba del archivo**
(`TEMA`, `FECHA_LANZAMIENTO`, `STREAMS`). Aparecen como `XX.XX.2026` y `—` en las
gráficas a propósito: son marcadores visibles para que no se publique nada con
datos inventados. Al recibirlos, se cambian ahí y se vuelve a correr `build.js`.

## Nota de render

Todo se dibuja dentro de `.frame` con tamaño explícito, no contra el `body`:
posicionando contra el body, Chrome headless deja sin pintar la franja inferior.

## Dirección de diseño

**World King es un ser de la exósfera que baja a traer un género nuevo a la
música urbana.** No pertenece a la Tierra: la calle es su destino, no su origen.

- Aparece **descendiendo, flotando o suspendido**. Casi nunca con los pies en el
  suelo: si camina por la calle como uno más, se pierde el concepto.
- El tono es **jovial y juvenil**. Sonríe, disfruta la bajada, llega con buena
  onda. No es un rey solemne ni un tipo duro.
- Las piezas son **luminosas**: cielo azul brillante, sol dorado, blanco. No
  nocturnas y oscuras.
- Vestuario: **streetwear futurista luminoso** blanco y azul con ribetes dorados,
  más la corona de naves con LED. Ropa que no es de la Tierra pero se lee urbana.
- Los copys hablan **desde su otredad**: "No soy de acá", "Bajé a traer algo que
  todavía no existe", "Ya voy bajando".
- Tipografía enorme e inclinada sobre una base sólida abajo, con el oro metálico
  como acento. El texto vive en la parte inferior para no tapar la figura.

Tres direcciones que se probaron y se descartaron, y por qué:

| Intento | Por qué no |
|---|---|
| Astronauta techwear violeta/cian | La paleta era inventada; la real es azul, dorado y naranja |
| Rey espacial épico tipo Dune | Solemne y oscuro: perdía lo jovial y lo juvenil |
| Esquina de barrio con parka y cadenas | Demasiado terrenal: lo volvía uno más de la calle y borraba que viene de afuera |

El barrio (Cerro 18) es dato biográfico de color, **nunca** el titular.

## Nota de render

Todo se dibuja dentro de `.frame` con tamaño explícito, y el pie va en el flujo
normal del bloque de texto. Posicionar el pie contra el marco con `position:
absolute` lo dejaba fuera del lienzo al renderizar.
