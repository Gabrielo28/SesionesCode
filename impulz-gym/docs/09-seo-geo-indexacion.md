# SEO, GEO e indexación: Impulz Gym El Quisco

Objetivo: que quien busque "gimnasio El Quisco" (en Google, Google Maps, Bing, Apple Maps, Waze) o le pregunte a una IA
(ChatGPT, Gemini, Perplexity, Copilot, Claude) "¿qué gimnasio hay en El Quisco?" encuentre a Impulz.

- **SEO**: aparecer en buscadores.
- **SEO local**: aparecer en mapas ("gimnasio cerca de mí"). Para un gimnasio es lo que más pesa.
- **GEO** (optimización para motores generativos): que las IA lo conozcan y lo recomienden. Las IA leen la web, Bing,
  Google Maps, Instagram y las reseñas, así que GEO se gana haciendo bien lo anterior y dando datos claros y repetidos.

Todo queda **a nombre de la Agencia** (ver Anexo N° 1 del acuerdo).

## 1. Ya hecho en el sitio (código)

| Qué | Para qué |
|---|---|
| Título y descripción con "gimnasio en El Quisco" y precio desde $25.000 | Lo que se ve en el resultado de Google |
| Dirección canónica y redirección de `www` a la dirección sin `www` | Una sola versión del sitio, sin duplicados |
| Vista previa para compartir (Open Graph) con foto de la fachada | Se ve bien al pegar el link en WhatsApp, Facebook e Instagram |
| Datos estructurados `ExerciseGym`: horario, comunas, planes con precio, Instagram, mapa | Google y las IA entienden que es un gimnasio, dónde está y cuánto cuesta |
| Datos estructurados `FAQPage` leídos de las preguntas del sitio | Respuestas directas en Google y en las IA |
| `sitemap.xml` con fecha de actualización | Le dice a los buscadores qué indexar |
| `robots.txt` que permite a Google, Bing y a los rastreadores de IA (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended) y bloquea el panel | Que las IA puedan leer el sitio; que el panel nunca aparezca |
| `llms.txt`: resumen en texto con datos, planes y preguntas | Formato pensado para que las IA lo lean sin errores |
| Etiquetas de verificación de Google y Bing (variables `GOOGLE_VERIFICACION`, `BING_VERIFICACION`) | Verificar el sitio sin tocar código |
| IndexNow (variable `INDEXNOW_KEY` y `scripts/indexnow.js`) | Avisar a Bing al instante cuando el sitio cambia. ChatGPT y Copilot buscan con Bing |
| La página de reservas para anuncios no se indexa | No compite con el sitio principal |
| El panel de comisiones no se indexa (en ningún dominio) | Privacidad |
| Enlace del sitio a `entrenachile.cl/gimnasios/impulz` y de vuelta | Los dos sitios se refuerzan |

## 2. Pasos al publicar (en este orden)

Cuando el sitio esté en Railway con su dominio propio:

1. **Google Search Console** (search.google.com/search-console) con la cuenta de Google de la Agencia.
   Agregar la propiedad "Prefijo de URL" `https://<dominio>/`, elegir "Etiqueta HTML", copiar solo el código del
   `content` en la variable `GOOGLE_VERIFICACION` de Railway y verificar.
   Luego: Sitemaps → enviar `sitemap.xml`. Inspección de URL → `https://<dominio>/` → "Solicitar indexación".
2. **Bing Webmaster Tools** (bing.com/webmasters): "Importar desde Google Search Console" (verifica solo).
   Si no, etiqueta HTML en `BING_VERIFICACION`. Enviar el sitemap. Bing alimenta a ChatGPT, Copilot y DuckDuckGo.
3. **IndexNow**: inventar una clave (32 letras y números), ponerla en `INDEXNOW_KEY` en Railway y correr
   `SITIO=https://<dominio> INDEXNOW_KEY=<clave> node scripts/indexnow.js`. Repetirlo cada vez que cambien precios o textos.
4. **Probar los datos estructurados**: search.google.com/test/rich-results con la dirección del sitio. Debe mostrar
   "Gimnasio" y "Preguntas frecuentes" sin errores.
5. **Probar la vista previa**: pegar el link en un chat de WhatsApp y en developers.facebook.com/tools/debug.

## 3. Mapas: lo más importante para un gimnasio

1. **Perfil de empresa en Google** (business.google.com), con la cuenta de Google de la Agencia como propietaria.
   - Nombre exacto: **Impulz Gym El Quisco** (siempre igual en todas partes).
   - Categoría principal "Gimnasio"; secundarias "Entrenador personal" y "Centro de fitness".
   - Dirección, teléfono de WhatsApp, horario, sitio web, link de reserva (`https://<dominio>/#reserva`).
   - Productos: los 6 planes con su precio. Servicios: clase de prueba, entrenamiento personalizado.
   - Mínimo 15 fotos (fachada, sala, zonas, equipo). Una publicación por semana (sirven las mismas del Instagram).
   - Responder todas las reseñas. Preguntas y respuestas: cargar las del sitio.
   - Verificación: Google puede pedir video del local o una carta a la dirección. Coordinarlo con el dueño.
2. **Bing Places** (bingplaces.com): importar desde Google.
3. **Apple Business Connect** (businessconnect.apple.com): Apple Maps y Siri; también lo usan algunas IA.
4. **Waze** (ads.waze.com o reportar lugar en la app): agregar el lugar con la dirección.
5. **Facebook**: página con la misma dirección, teléfono, horario y link al sitio.

## 4. Reseñas: el factor que más mueve mapas y recomendaciones de IA

- Meta: **30 reseñas en Google en 90 días**. Las IA y Google Maps recomiendan a los que tienen más y mejores.
- Pedirla en el momento bueno: al terminar la primera semana de un socio nuevo, por WhatsApp, con el link directo
  ("Pedir reseñas" en el perfil de Google). Un QR en recepción con ese link.
- Que mencionen el lugar y lo que hacen ("gimnasio en El Quisco", "entrenamiento personalizado"): sin guionar, solo
  preguntar "¿qué te ha gustado?".
- Nunca reseñas pagadas ni falsas: Google las borra y puede suspender la ficha.

## 5. Datos idénticos en todas partes (NAP)

Nombre, dirección y teléfono deben ser **exactamente iguales** en el sitio, Google, Bing, Apple, Facebook, Instagram,
entrenachile.cl y directorios. Las IA cruzan fuentes: si coinciden, confían.

| Dato | Valor oficial |
|---|---|
| Nombre | Impulz Gym El Quisco |
| Dirección | _pendiente (se carga en panel → Ajustes)_ |
| Teléfono / WhatsApp | _pendiente_ |
| Horario | Lunes a viernes 5:00 a 22:00 · Sábado 8:00 a 14:00 · Domingo cerrado |
| Sitio | _dominio pendiente_ |

## 6. GEO: que las IA lo recomienden

- Ya hecho: `llms.txt`, datos estructurados, preguntas frecuentes, permiso a rastreadores de IA, Bing al día.
- **Menciones en otros sitios**: las IA recomiendan lo que aparece en varias fuentes. Conseguir que aparezca en:
  municipalidad de El Quisco (directorio de comercio o deporte), guías turísticas del litoral, medios locales
  (nota por la reapertura con nuevo nombre), Tripadvisor/Foursquare, directorios de gimnasios de Chile.
- **Instagram con texto**: la bio y los textos deben decir "Gimnasio en El Quisco" y nombrar las comunas. Las IA leen el texto, no la imagen.
- **Prueba mensual**: preguntar a ChatGPT, Gemini, Perplexity y Copilot "gimnasio en El Quisco" y "dónde entrenar en el litoral central";
  anotar si aparece Impulz en el reporte mensual.

## 7. Qué medir cada mes

- Search Console: impresiones y clics por "gimnasio el quisco", "gym el quisco", "gimnasio algarrobo", "gimnasio el tabo".
- Perfil de Google: vistas, llamadas, clics al sitio, solicitudes de ruta, reseñas nuevas.
- Panel de comisiones: reservas con canal "Sitio web y reservas (sin campaña)" = llegaron por búsqueda.
- Prueba de IA (punto 6).

## 8. Nota sobre el nombre anterior

El gimnasio se llamaba World Fit. Si quedó una ficha de Google "World Fit" en la misma dirección, **no crear una nueva**:
reclamarla y renombrarla a "Impulz Gym El Quisco" para no perder sus reseñas. Si no se puede, pedir a Google que la marque
como "cerrada / trasladada". Corregir también el flyer del Plan Clase, que todavía dice "Worldfit".
