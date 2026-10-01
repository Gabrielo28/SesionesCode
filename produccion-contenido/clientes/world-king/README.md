# World King — Producción de gráficas

Cliente en **prelanzamiento**. La propuesta completa (4 reels · 4 posts · 8 historias)
está en `plan-lanzamiento-2026.md`. La marca, la paleta y los assets pendientes
están en `marca.json`.

## Estructura

```
marca.json      Paleta, tono, concepto y lista de assets que faltan del cliente
graficas/       Capa tipográfica: HTML + Chrome headless → PNG/
  build.js        Define las piezas y las renderiza
  png.js          Recorta el PNG al alto exacto (ver Notas de render)
  previsualizar.py  Arma las tres vistas previas
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

### Vestuario real

Las fotos del artista muestran el vestuario que **existe y se puede fotografiar**:
corona negra con glitter y gemas de colores, lentes de sol oscuros, hombreras de
lamé dorado, camisa barroca blanco y dorado, cadena con **ankh** de pavé, guantes
blancos y bastón con puño dorado. Y sobre todo: un **manto con una galaxia
impresa** — literalmente lleva el espacio puesto, que es el mejor hallazgo del
vestuario.

Los canvas son la versión idealizada del mismo personaje (la corona con forma de
naves y LED es la misma corona en otro registro). Las piezas mezclan ambos.

El **ankh** pasa a ser recurso gráfico propio y firma el pie de cada pieza.
La capa de galaxia suma **magenta y morado** a la paleta, como acento sobre el
negro y el dorado, nunca en lugar de ellos.

## Notas de render

Tres cosas que costaron encontrar y conviene no volver a tropezar:

**El lienzo.** Todo se dibuja dentro de `.frame` con tamaño explícito, no contra
el `body`.

**La franja sin pintar.** El headless nuevo de Chrome descuenta la altura de la
barra del navegador (~87px) del viewport, pero el screenshot igual sale del alto
de la ventana: esa franja de abajo queda sin pintar y se come el sello y el pie.
`build.js` lo mide solo al arrancar con una página de prueba, pide la ventana más
alta y después recorta el PNG al alto exacto del formato con `png.js` (decodifica
y reescribe el PNG con `zlib`, sin dependencias). Si el descuento cambia con otra
versión de Chrome, la medición lo sigue sola.

**Dónde va el texto de un reel.** Instagram recorta la portada de reel a 4:5
**desde el centro** para la grilla del perfil, y en el reproductor tapa el tercio
de abajo con su propia interfaz. El título va en la banda central (`.wrap.reel`,
480px de aire abajo), no al pie: al pie se pierde en los dos lados.

## Inventario de piezas

**27 gráficas** listas en `graficas/PNG/`:

| Bloque | Cantidad | Formato |
|---|---|---|
| Posts de feed | 7 | 1080×1350 |
| Portadas de reel | 4 | 1080×1920 |
| Historias | 10 | 1080×1920 |
| Portadas de destacadas | 6 | 1080×1080 |

Más tres vistas previas, que se regeneran con `python3 graficas/previsualizar.py`
después de cada `node build.js`:

| Archivo | Qué muestra |
|---|---|
| `_preview-feed.png` | La grilla del perfil, recortada a 4:5 desde el centro igual que Instagram |
| `_preview-historias.png` | La tira de historias en orden de publicación |
| `_preview-destacadas.png` | La tira circular bajo la bio |

**Revisar siempre `_preview-feed.png` antes de cerrar un set.** El recorte de la
grilla deja ver problemas que la pieza suelta esconde — hasta ahora aparecieron
tres ahí: una imagen que se leía como iconografía religiosa, un titular que se
cortaba, y los títulos de las portadas de reel quedando fuera del recorte.

### Emoción: maravilla, no poder

El riesgo permanente de esta marca es que **el oro sobre negro la convierta en
estética de capo**. Pasó una vez: primeros planos cerrados, dorado, y copys de
poder territorial ("la corona no se presta", "ando entre ustedes y no se dieron
cuenta"). Leía como narco, no como viajero de otra galaxia.

Lo que lo corrige:

- **Color contenido.** El NEGRO domina el cuadro. La nebulosa aparece sólo como
  resplandor sutil en los bordes, en violeta y azul apagados. Llenar el cuadro de
  color saturado se ve chillón y barato — se probó y se descartó.
- **Luz de dos fuentes.** Rim dorado cálido por un lado, azul frío por el otro,
  sobre negro. Esa es la firma lumínica de la marca.
- **Escala.** Planos donde lo inmenso domina y el personaje es pequeño ante la
  galaxia. Sin escala no hay épica.
- **Luz que estalla**, rayos, partículas, movimiento. No sólo brillo de metal.
- **Copys de asombro y generosidad**, nunca de dominio: "Vengo de más lejos de
  lo que te imaginas", "Allá arriba la música se ve", "No vine a mandar, vine a
  darles". Lo que trae **se comparte**, no se cobra ni se impone.

### Los dos registros del artista

El vestuario tiene **dos modos**, y conviene alternarlos:

- **Modo rey** — corona con gemas, capa de galaxia, hombreras doradas, ankh, cetro.
  Es el ser de la exósfera.
- **Modo terrestre** — sombrero panamá, lentes de cristal ámbar, chaleco, plastrón
  dorado. Es cómo se ve cuando se mezcla entre nosotros.

El contraste entre ambos es material narrativo que la propuesta original no tenía:
el visitante camuflado. El gesto de mirarse el reloj, en modo terrestre, funciona
como cuenta regresiva sin tener que explicarla.

### Ritmo del feed

Ninguna foto se repite en la grilla y las piezas **alternan artista y espacio**.
Cuando varios posts seguidos usan el mismo recorte, el perfil se ve pobre aunque
cada pieza por separado funcione — por eso hay fondos sin figura entremedio, que
además dan respiro entre los retratos.

La asignación vive en `build.js`: cada pieza del array `piezas[]` declara su
`imagen`. Al elegirla manda **la composición, no el tema**: una toma con la cara
al centro sirve de portada de reel (el botón de play va arriba del centro y el
título abajo); una toma con la figura pequeña o tumbada sirve de historia, donde
no hay play que le caiga encima.

## Qué falta del cliente

- Fecha de lanzamiento del EP (hoy sale como `XX.XX.2026`, marcador a propósito)
- ¿La firma va como **WORLD KING** o **WORLD KING MUSIC**?
- ¿Palm Beach y Corsica son suyos? La propuesta los cita, el press kit no
- Confirmar quién aparece en la foto de backstage, para poder usarla
- La barra del tema para la historia de cita musical
