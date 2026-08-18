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

**Género urbano con concepto espacial.** El espacio es el escenario; el código es
de calle. Concretamente:

- La calle es el lugar real (esquina, bodega, cables, graffiti, cancha) y el
  planeta gigante en el cielo es lo que la vuelve épica. No al revés.
- Tipografía **enorme**, condensada e inclinada, que sangra fuera del margen y va
  **encima** de la foto, nunca al lado.
- El **oro metálico con degradado** es el código del género — cadenas, corona.
  Nada de amarillo plano.
- El **dato es un flex**: la cifra manda la composición, no es una fila de tabla.
- Grano, barrido de tubo y bandas diagonales tipo flyer de fiesta.
- El **barrio va grande**: "CERRO 18 SUR" es titular, no un dato en una cajita.

Lo que se evitó a propósito, porque hacía ver la marca como una empresa de
tecnología: rejilla de fondo tipo dashboard, kickers con línea fina, tablas de
datos ordenadas, mucho aire y copys de ficha técnica.

## Nota de render

Todo se dibuja dentro de `.frame` con tamaño explícito, y el pie va en el flujo
normal del bloque de texto. Posicionar el pie contra el marco con `position:
absolute` lo dejaba fuera del lienzo al renderizar.
