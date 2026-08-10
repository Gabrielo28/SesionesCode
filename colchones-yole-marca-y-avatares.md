# Colchones Yolé — Sistema de marca + Avatares (contexto para la propuesta)

Complementa a `brief-propuesta-colchonesyole.md`.

> ⚠️ **ACTUALIZACIÓN 2026-07-20 — datos reales (propuesta Cinemedia, "Web Yolé .html"):**
> El catálogo real tiene **6 líneas**: Eco Paradise ($235.990, Pocket 20cm, parejas),
> Ecobear Resortes ($170.990, Bonell alto soporte, espalda), E-Confort ($115.990, Bonell
> 15cm, uso intensivo), Ecobear Soft ($157.990, D24 suave), Eco I ($90.990, económico),
> Eco Air ($84.990, D28, solo 1 y 1,5 plazas). Tallas: 1P 90×190 · 1,5P 105×190 ·
> 2P 150×190 · King 180×200 (NO hay Queen). El mapeo necesidad→modelo de la §2 de este
> documento quedó **obsoleto**: pareja→Eco Paradise y espalda→Ecobear Resortes (las specs
> reales lo respaldan: Pocket = independencia de movimiento). Datos reales: fábrica en
> Malloco (Peñaflor), despacho gratis RM 5 días hábiles, devolución 10 días/cambio 30,
> +56 9 4990 5296, contacto@yoleltda.cl, mayoristas Denisse +56 9 3254 7982 y Fernanda
> +56 9 4990 5296. La tienda (`colchones-yole/`) ya usa todos estos datos.

## 1. Colores

### Colores corporativos del logo
- 🔴 **Rojo Yolé:** `#D62027`
- 🔵 **Azul Yolé (logo):** `#0A46D8`

### Sistema de diseño recomendado
| Rol | HEX | Uso |
|-----|-----|-----|
| Primario / Azul principal | `#0507E7` | CTA, botones |
| Secundario / Azul marino | `#20234D` | Textos principales, header |
| Acento | `#D62027` | **Solo** ofertas, descuentos y elementos importantes |
| Fondo blanco | `#FFFFFF` | Fondos |
| Gris muy claro | `#F1F3F8` | Fondos alternos |
| Gris claro | `#E6EAF5` | Bordes |
| Texto secundario / Gris oscuro | `#585868` | Texto secundario |
| Gris medio | `#A2A0A6` | — |

Regla clave: el rojo (`#D62027`) es acento reservado; el azul (`#0507E7`) manda en botones/CTA;
el azul marino (`#20234D`) para header y textos.

## 2. Avatares ↔ Punto de dolor ↔ Modelo
Fuente: "Informe Estratégico: Puntos de Dolor, Modelos y Avatares", justificado en la
arquitectura oficial de la web. Sirve para organizar el **home por necesidad** (problema 6
del brief) y escribir el **copy en lenguaje de beneficio** (problema 3).

### Dolor 1 — Descanso en pareja
- Frase: *"Duermo en pareja — se nota cada movimiento en la noche."*
- **Modelo:** E-Confort (Dual Side)
- Por qué: absorbe la transferencia de movimiento; formato reversible (Dual Side) = alta durabilidad ante uso compartido constante.
- **Avatar "Ana y Carlos" (Pareja Práctica):** 28-38 años, optimizan su inversión compartida, valoran dormir sin interrupciones por movimientos, prefieren producto duradero de doble uso.

### Dolor 2 — Salud física y postura
- Frase: *"Me duele la espalda — despierto con contracturas o tensión."*
- **Modelo:** Eco Paradise (Línea Premium)
- Por qué: alta gama orientada a dolores corporales y tensión; estructuras ergonómicas avanzadas y materiales de máxima calidad para soporte ortopédico.
- **Avatar "Sofía" (Profesional de Alto Rendimiento):** mujer 35-45 años, rutina laboral exigente, prioriza bienestar físico y productividad, requiere descanso superior que elimine contracturas diarias.

### Dolor 3 — Resistencia y uso intenso
- Frase: *"Necesito resistencia — contexturas robustas, uso diario intenso."*
- **Modelo:** Eco Bear (Resortes)
- Por qué: arquitectura estructural de resortes y refuerzos para soportar presiones elevadas y desgaste diario severo sin deformarse prematuramente.
- **Avatar "Felipe" (Deportista Activo):** hombre 25-35 años, alta exigencia física, requiere firmeza estructural superior y alta capacidad de respuesta para recuperación muscular.

### Dolor 4 — Soluciones prácticas y accesibles
- Frase: *"Solución práctica — pieza de niños, invitados o estudio."*
- **Modelo:** Eco Air / Eco Bear Soft
- Por qué: alternativa versátil y de rápida disposición para espacios secundarios; prioriza eficiencia presupuestaria y logística de compra simple.
- **Avatar "Valentina / Roberto" (Buscadores de Eficiencia):** jóvenes independizándose o dueños de casa que equipan habitaciones de invitados, buscan balance entre comodidad básica y accesibilidad económica.

## 3. Catálogo de modelos (derivado de los avatares)
- **E-Confort (Dual Side)** — parejas, anti-transferencia de movimiento, reversible.
- **Eco Paradise (Premium)** — alta gama, ergonómico/ortopédico, dolor de espalda.
- **Eco Bear (Resortes)** — firme y resistente, uso intenso.
- **Eco Air / Eco Bear Soft** — accesible, práctico, piezas secundarias/invitados.

## 4. Encuesta "Encuentra tu colchón ideal" (selector guiado)
Mini-encuesta de 2-3 preguntas que ayuda al cliente a elegir su modelo. Funciona por
**puntaje**: cada respuesta suma puntos a uno o más modelos y al final se recomienda el de
mayor puntaje (con link directo a su ficha + botón "Agregar al carrito"). Debe ser 100%
visual/front (sin backend), mobile-first, y **vive en el Home** (bloque destacado).

Modelos: **EC** = E-Confort · **EP** = Eco Paradise · **EB** = Eco Bear · **EA** = Eco Air / Eco Bear Soft

**P1 — ¿Dónde vas a usar el colchón?**
- "Mi cama de todos los días" → +1 EP, +1 EB, +1 EC
- "Pieza de invitados, de niños o el estudio" → **+3 EA**

**P2 — ¿Cómo duermes?**
- "En pareja" → **+2 EC**
- "Solo/a" → +1 EP, +1 EB

**P3 — ¿Qué es lo más importante para ti?**
- "Que no me duela la espalda / mejor postura" → **+3 EP**
- "Firmeza y resistencia para uso intenso" → **+3 EB**
- "No sentir los movimientos de mi pareja" → **+3 EC**
- "Algo simple y a buen precio" → **+3 EA**

Resultado: el modelo con más puntos; empate → desempata P3. Pantalla de resultado con foto,
1-línea de por qué encaja (tomada del avatar) y CTA a la ficha. Opción "ver otras opciones".
