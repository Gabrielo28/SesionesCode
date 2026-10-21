# Mensaje para acompañar la propuesta · Itata Travel

Cambia `[Nombre]` si tienes el nombre de la persona; si no, deja "Hola, equipo de Itata Travel".

```
Hola [Nombre], soy Gabriel, de Influence Chile. Te mando la propuesta que conversamos para Itata Travel.

Es nuestro Plan Crecimiento: 8 reels, 8 publicaciones y 12 historias al mes, respuesta a comentarios, gestión de anuncios e influencers incluidas. Para partir les sumamos sin costo la puesta a punto de la cuenta: perfil y enlace directo a reservas, destacadas nuevas y orden de la grilla.

Queda en $450.000 + IVA al mes, sin permanencia. Si partimos en noviembre, la cuenta queda lista antes de la temporada de verano.

En el PDF va el detalle y lo que ya vimos en su Instagram. Dime qué día y hora te acomodan para la reunión de arranque.
```

## Para otro cliente del mismo plan

Copia `cliente-itata.json`, cambia nombre, instagram, archivo, `por_que`, `observaciones` y
`necesitamos_mes`, y corre:

```
python3 prospeccion-ventas/propuesta/crecimiento-450k/generar.py prospeccion-ventas/propuesta/crecimiento-450k/cliente-NUEVO.json
NODE_PATH=/opt/node22/lib/node_modules node prospeccion-ventas/propuesta/crecimiento-450k/render.js NOMBRE-ARCHIVO
```
