# Mensaje para acompañar la propuesta de Meta Ads

Cambia `[Nombre]`.

```
Hola [Nombre], soy Gabriel, de Influence Chile. Te mando la propuesta que conversamos para hacernos cargo de tus campañas en Meta Ads.

Incluye el armado de la campaña sin costo el primer mes, revisión y ajustes cada semana, 2 a 3 creatividades nuevas al mes con tus fotos y videos, y un informe mensual con cuánto te cuesta cada resultado.

Queda en $150.000 + IVA al mes, sin permanencia. La pauta la sigues pagando directo a Meta, como hoy.

Si te hace sentido, dime qué día y hora te acomodan para la reunión de arranque.
```

## Para personalizar

Edita `cliente.json` (nombre, contacto, instagram, archivo; `inversion_semanal` si cambia el monto;
`nota_cliente` para una línea a medida) y corre:

```
python3 prospeccion-ventas/propuesta/meta-ads-150k/generar.py prospeccion-ventas/propuesta/meta-ads-150k/cliente.json
NODE_PATH=/opt/node22/lib/node_modules node prospeccion-ventas/propuesta/meta-ads-150k/render.js NOMBRE-ARCHIVO
```
