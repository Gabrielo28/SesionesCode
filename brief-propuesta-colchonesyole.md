# Brief — Propuesta de landing/catálogo para Colchones Yolé

## Contexto
Colchones Yolé vende colchones online (colchonesyole.cl, actualmente en Wix). Una
auditoría de terreno + una revisión propia detectaron 15 problemas de UX/conversión.
Este brief resume **qué** debe resolver la propuesta — el objetivo es una **maqueta
de referencia** (HTML/CSS o React), no replicar el sitio actual ni tocar el Wix en vivo.

## Problemas que la propuesta debe resolver
1. **Navegación clara:** cada link/botón debe llevar exactamente donde promete su etiqueta.
2. **Catálogo con precio y botón de compra visibles** en cada producto — no solo párrafos descriptivos.
3. **Specs traducidas a beneficio** antes que al dato crudo (ej. "resortes independientes: cada lado de la cama se mueve por separado" antes que "Resorte Pockett").
4. **Claridad en "peso máximo"** en tallas King/2 plazas: siempre aclarar si es por persona o total.
5. **Imagen principal en dormitorio real** (luz cálida, cama tendida) — nunca bodega o fábrica.
6. **Home organizado por necesidad del comprador** (firmeza, tamaño) en vez de listado plano de ofertas.
7. **Sección mayorista separada** de la venta a consumidor final (no comparten página).
8. **Fichas de producto sin errores de recorte** de imagen.
9. **Footer prolijo**, con toda la información visible y sin cortes.
10. **Copy de SEO/meta descripción real y legible**, no listas de keywords.
11. **Encuesta "Encuentra tu colchón ideal"** (2-3 preguntas) que ayude al cliente a elegir su modelo y lo lleve directo a la ficha recomendada — ver lógica en `colchones-yole-marca-y-avatares.md` §4.

## Decisión técnica (definida)
**Stack: HTML + CSS + JavaScript vanilla, arquitectura single-page app (SPA)** — vistas
que se intercambian por JS + hash routing (`#/`, `#/catalogo`, `#/producto/<id>`,
`#/checkout`), en varios archivos pero **sin paso de build** (abre con doble clic / file://,
o se sube tal cual a cualquier host estático). **No React.**

Por qué (es una maqueta/demo para mostrar a un cliente, no la web de producción):
- Cero tooling: no requiere Node/npm ni servidor; el cliente y el usuario la abren directo.
- Un solo runtime JS = **carrito, encuesta y filtros comparten estado** sin sincronizar
  localStorage entre páginas → menos bugs, justo lo que ataca el "sin dead-ends".
- Navegación instantánea = sensación "Shopify moderno".
- Fácil de compartir: se sube tal cual a Netlify/GitHub Pages o se envía la carpeta.
- La web real de Yolé es Wix; la demo no se convierte en la app de producción, así que
  React no aporta lo suficiente para justificar el build.

## Objetivo de la propuesta
Un sitio de **varias páginas, 100% visual** (sin backend ni pagos reales), pero con
**navegación completa**: cada link, botón y "agregar al carrito" debe llevar a algo
real dentro del sitio, nunca a un dead-end. El problema actual de Yolé no es solo
estético: el camino se corta (menús rotos, catálogo sin precio). La propuesta debe
demostrar lo contrario — un recorrido fluido de principio a fin, desde que alguien
llega por una red social hasta que "compra" (pago simulado, navegación no).

## Estilo de referencia: e-commerce moderno (tipo Shopify)
- Header fijo (sticky) con buscador e ícono de carrito.
- Grilla de productos limpia: foto, nombre, precio y 1-2 specs clave visibles sin scroll dentro de la tarjeta.
- Página de producto individual por cada colchón: fotos, specs en lenguaje de beneficio, selector de tamaño, botón de compra.
- Carrito tipo **drawer** (panel lateral que se abre al hacer clic en "Agregar"), no página nueva.
- Checkout en pasos claros (envío → pago → confirmación); el pago puede ser pantalla estática.
- Breadcrumbs y filtros simples (firmeza, tamaño, precio) en el catálogo.
- **Mobile-first**: la mayoría del tráfico de redes llega desde el celular.
- Tipografía grande, harto espacio en blanco, fotografía de producto real en contexto.

## Marca (referencia)
- Logo azul y blanco "Yolé".
- Posicionamiento actual: "colchones nacionales de calidad".
- ~18 años en el mercado.
- Envío a Región Metropolitana.
- Hasta 3 cuotas sin interés.
- Revisar colchonesyole.cl para el tono de azul exacto del logo.

## Sugerencia de primer prompt
"Lee @brief-propuesta-colchonesyole.md. Arma un sitio de varias páginas en HTML/CSS
(home, catálogo, 2-3 fichas de producto, carrito tipo drawer, checkout simulado en
pasos) para Colchones Yolé, estilo e-commerce moderno tipo Shopify. Todo debe estar
conectado: cada botón lleva a una página o estado real dentro del sitio, sin links
muertos. Empieza por el home y la navegación, después el catálogo y una ficha de
producto completa."
