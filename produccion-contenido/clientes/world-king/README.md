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
- Lo **jovial está en su actitud** — sonríe, va relajado, disfruta la bajada — no
  en la luz. La estética es **oscura**: negro y azul profundo de espacio.
- La luz entra como **dorado metálico, brasa ámbar y LED azul**, nunca como sol
  de día. El dorado es el protagonista.
- Vestuario: corona de naves con LED, **armadura dorada barroca, audífonos
  dorados y cadenas**. La tecnología Dolby es parte del vestuario.
- Tipografía enorme e inclinada con **oro biselado en relieve**, imitando el
  acabado 3D del wordmark oficial. Nunca amarillo plano.
- Los copys hablan **desde su otredad**: "No soy de acá", "Bajé a traer algo que
  todavía no existe", "Ya voy bajando".
- El **emblema WK** va como sello abajo a la derecha en cada pieza.

Cuatro direcciones que se probaron y se descartaron, y por qué:

| Intento | Por qué no |
|---|---|
| Astronauta techwear violeta/cian | La paleta era inventada; la real es dorado, ámbar y azul |
| Rey espacial épico tipo Dune | Solemne y oscuro de más: perdía lo jovial |
| Esquina de barrio con parka y cadenas | Demasiado terrenal: lo volvía uno más de la calle |
| Descenso con cielo diurno y sol | Muy claro y aplanado: se alejaba de sus canvas |

El barrio (Cerro 18) es dato biográfico de color, **nunca** el titular.

## Nota de render

Todo se dibuja dentro de `.frame` con tamaño explícito, y el pie va en el flujo
normal del bloque de texto. Posicionar el pie contra el marco con `position:
absolute` lo dejaba fuera del lienzo al renderizar.
