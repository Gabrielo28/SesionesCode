# Escáner de mercado — herramienta interna

Escanea muchos negocios de un rubro desde afuera, detecta sus fallas con el catálogo de
códigos del Escáner de Negocio, ordena las soluciones de la mejor a la peor y te dice a
quién escribir primero y con qué mensaje. Además resume **qué falla más en todo el
rubro**, para saber qué servicio empaquetar y venderle a ese mercado.

Es el modo taller del escáner, pero en lote: lo usas tú, no el cliente.

## Cómo se usa

```bash
cd detector-dolores/mercado
npm install                      # una sola vez: usa el Chrome que ya tienes instalado
node escanear-mercado.js lista.csv --nombre dentistas-rm
```

Abre `resultados/dentistas-rm.html` con doble clic. Ese es el tablero.

**Opciones:**

| Opción | Para qué |
|---|---|
| `--rubro "Odontología"` | Escanear solo un rubro de una lista grande |
| `--max 30` | Probar con los primeros 30 |
| `--nombre salida` | Nombre de los archivos de resultado |
| `--sin-navegador` | Más rápido, pero las webs hechas con JavaScript quedan para revisar a mano |

**La lista** es un CSV con al menos nombre y web. Sirve el de `prospeccion-ventas/`, una
exportación de Google Maps, de Apollo o una planilla tuya. Reconoce las columnas
`nombre`, `web`, `rubro`, `ciudad`, `instagram`, `prioridad`, `puntaje`, `empleados`.
También sirve un `.txt` con una web por línea.

## Qué revisa solo

Visita una vez la página principal de cada negocio, como lo haría un cliente desde el
celular, y detecta:

| Señal | Código |
|---|---|
| El dominio no existe o el servidor falla | CAP-06 Web caída o insegura |
| Sin candado (https) | CAP-06 |
| No adaptada al celular o lenta | CON-06 Web lenta o mala en celular |
| Sin botón ni link de WhatsApp | CON-07 Sin WhatsApp a un toque |
| Sin precios ni rangos | CON-05 Precio escondido |
| No se puede comprar ni reservar | CON-03 No se puede comprar sin llamar |
| Sin reseñas, testimonios ni casos | CON-04 Sin prueba social |
| Sin píxel de Meta ni Google Analytics | DAT-05 Web sin sensores |
| Analytics pero sin píxel | DAT-02 Marketing sin medir |
| © de hace 2 años o más | CAP-03 Instagram inactivo o mudo (web abandonada) |
| Sin links a redes | CAP-02 Un solo canal de entrada |
| Sin captura de datos | RET-01 Sin datos de clientes |
| Su "web" es un link de WhatsApp o Instagram | CON-03 y CAP-01 |

Además anota la plataforma (Shopify, WordPress, Wix…), el tiempo de carga y el camino de
compra. Las webs que bloquean robots (errores 403, 429 o 503) no se marcan como caídas:
quedan en **Revisar a mano**.

## El tablero

- **Qué falla en este mercado.** Porcentaje de negocios con cada código.
- **Qué venderle a este mercado.** Las soluciones que más aparecen en el Top 3 de cada
  negocio, y la oferta de precio fijo que conviene empaquetar.
- **La lista**, ordenada por oportunidad (0 a 100). La oportunidad combina la gravedad
  de las fallas, cuántas se reparan con servicios de Influence (pesan el triple) y el
  encaje con el cliente ideal. Los niveles son relativos: el 15% de arriba con fallas
  fuertes es **Escribir hoy**, el siguiente 25% es **Esta semana**, el resto **Nutrir**.
- **El detalle de cada negocio:** códigos con su evidencia, las 5 soluciones de la mejor
  a la peor, el primer mensaje listo para copiar y editar, links para revisar (web,
  Google Maps, Instagram, anuncios en Meta) y el **modo taller**. Ahí marcas lo que
  veas a mano (reseñas, Instagram, comprador misterioso, visita) y el negocio suma
  códigos y reordena sus soluciones al tiro.
- **Seguimiento:** Por contactar, Contactado, Respondió, Reunión, Propuesta, Cliente o
  Descartado. Al copiar el mensaje pasa solo a Contactado. Se exporta a CSV.

Las marcas del modo taller y el seguimiento quedan guardados en ese navegador. Si
vuelves a escanear la misma lista con el mismo nombre, se conservan.

## Antes de mandar un mensaje

El escaneo automático acierta en lo que se ve en el código de la web, pero no es
infalible: un botón de WhatsApp puede cargarse tarde o un precio estar en otra página.
**Abre la web 30 segundos antes de escribir** y confirma el hallazgo que vas a citar.
Un mensaje con un error ("no tienen WhatsApp" cuando sí tienen) quema el contacto.
