# Influence Fit — Identidad de marca

Qué tiene que transmitir, cómo se ve y qué no hacer. Vale para el logo, la landing, los anuncios,
el feed, las historias y los PDF. Todo lo que se publique se mide contra esta página.

## 1. Las cualidades que tiene que tener para que funcione

El cliente es un coach que ya recibió veinte DM de agencias este mes. Compra confianza, no diseño.
La marca tiene que parecer **de alguien que entrena**, no de alguien que vende.

| Cualidad | Qué significa en la práctica | Cómo se nota |
|---|---|---|
| **Credibilidad de sala** | Habla un coach con 15 años, no "un equipo". Primera persona singular. | Foto real de Gabriel en sala, nunca banco de imágenes. Lenguaje técnico correcto (RPE, RIR, periodización) sin explicarlo de más. |
| **Resultado antes que servicio** | Vende evaluaciones agendadas y clientes que renuevan, no "gestión de redes". | Cada pieza termina en un número o una acción concreta. Nunca "potenciamos tu marca". |
| **Sobriedad** | Lo contrario del look de agencia: sin brillos, sin neón, sin degradados, sin emojis en cadena. | Carbón, blanco y un acento. Tipografía grande y pocas palabras. Aire. |
| **Especificidad** | Lo que diferencia este mensaje de los otros veinte es el detalle que solo un coach notaría. | "Tus reels llegan a 8.000 personas y ninguno dice cómo agendar" en vez de "mejora tu presencia". |
| **Prueba** | Todo lo que afirma se puede mostrar. | Capturas reales del agente, del reporte, de la agenda. Cifras propias actualizadas cada mes. Nada inventado. |
| **Consistencia** | Que la landing, el anuncio, la propuesta y el reporte parezcan la misma mano. | Mismo sistema tipográfico y de color en todo (está en esta página). |

Si una pieza no cumple las seis, no sale.

## 2. Logo

**Concepto.** La I y la F construidas con barras. Las tres barras de la F crecen de abajo hacia arriba:
progresión, periodización, sobrecarga progresiva. Es un símbolo que un coach reconoce sin que se lo
expliquen y que un cliente lee simplemente como "IF". Cuadrado con esquinas redondeadas para que funcione
como avatar e ícono de app.

**Por qué genera confianza.** Es geométrico, plano y de un solo acento: se ve igual en 40 px (foto de
perfil de WhatsApp) que en una portada. No usa mancuernas, rayos ni siluetas musculosas, que son el
símbolo de todas las marcas fitness que el coach ya desconfía. Y hereda el carbón teal y el coral de
Influence Chile, así que el coach que después vea la agencia matriz reconoce la familia.

**Archivos** (`logo/`):
- `isotipo.svg`: el cuadro solo. Avatar, favicon, marca de agua.
- `isotipo-mono.svg`: un color (`currentColor`), para sellos, bordado, fondos de foto.
- `logo-horizontal.svg`: cuadro + INFLUENCE**FIT**, sobre fondo claro.
- `logo-horizontal-inverso.svg`: sobre carbón.
- `logo-vertical.svg`: con la bajada "Hecho por un coach".

**Reglas.** Espacio libre alrededor igual al ancho de la barra de la I. Nunca estirar, girar, poner
sombra ni degradado. Sobre foto, usar el inverso con una capa carbón al 60 % debajo. Mínimo 32 px de alto
para el isotipo y 120 px de ancho para el horizontal.

## 3. Color

| Uso | Color | Hex |
|---|---|---|
| Carbón (fondos de cabecera, portadas, anuncios oscuros, texto) | carbón teal | `#123638` |
| Carbón 2 (franjas y tarjetas sobre carbón) | | `#0E2B2D` |
| Acento único (titulares destacados, cifras, botones, la F del logo) | coral | `#FF7B7B` |
| Secundario (links, checks, focos; nunca grandes áreas) | teal | `#12959C` |
| Fondo claro / fondo claro 2 | | `#FFFFFF` / `#F3F6F6` |
| Texto secundario / silenciado | | `#3F5D5E` / `#6E8A8B` |
| Líneas | | `#DCE5E5` sobre claro · `#24494B` sobre carbón |

Sobre coral va texto carbón, no blanco. El coral es acento: si una pieza tiene más de un 15 % de coral,
está mal. El verde solo existe para el botón de WhatsApp.

## 4. Tipografía

- **Títulos:** Barlow Condensed 800, MAYÚSCULAS, interletrado 0.01–0.02 em, interlineado 1. La segunda
  línea o la palabra clave en coral.
- **Etiquetas** (eyebrow, categorías, botones): Barlow Condensed 700, mayúsculas, interletrado 0.12 em.
- **Texto:** Barlow 400/500, 16–18 px en web, nunca justificado.
- **Cifras:** Barlow Condensed 800, grandes, en coral sobre carbón o carbón sobre claro.

Las fuentes están en Google Fonts. En Canva o CapCut: Barlow Condensed y Barlow existen en ambos.

## 5. Voz

- Español de Chile, "tú", frases cortas. Como habla un coach por WhatsApp, no como escribe una agencia.
- Primera persona: "yo lo hago", "te muestro", "lo uso en mis canales".
- Palabras que sí: coach, evaluación, agenda, clientes, cliente que renueva, horas de administración.
- Palabras que no: lead, funnel, engagement, potenciar, estrategia 360, comunidad (salvo el canal de WhatsApp).
- Un emoji como máximo por pieza, y solo en historias.
- Nunca prometer resultados que no están en la garantía escrita (15 evaluaciones en 60 días, cupos fundadores).

## 6. Fotografía y video

- Gabriel en sala, luz natural o de gimnasio real, sin filtros de piel ni fondos generados.
- Planos: corrigiendo técnica a alguien, mirando el teléfono con el agente abierto, en la pizarra con un
  programa. Nada de poses de "antes y después" ni cuerpos como argumento.
- Capturas de pantalla reales: chat del agente, reporte mensual, agenda llena. Tapar nombres y números
  de clientes.
- Si no hay foto buena, la pieza va tipográfica sobre carbón. Es mejor que una foto de banco.

## 7. Lo que no se hace

Degradados decorativos, brillos y glow, glassmorphism, íconos 3D, emojis como viñetas, mancuernas y
rayos como símbolos, "antes y después" de cuerpos, listas de "beneficios" genéricos, cifras inventadas,
testimonios sin nombre, "equipo de expertos", stock de gente sonriendo en un gimnasio.

## 8. Plantillas

`graficas/plantillas/` tiene anuncios, feed e historias en HTML con este sistema. `node graficas/build.js`
las convierte a PNG en `graficas/png/`. Para cambiar el texto se edita el HTML; para cambiar la foto se
reemplaza el archivo en `graficas/fotos/`.
