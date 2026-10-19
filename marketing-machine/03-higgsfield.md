# 03 · Imágenes con Higgsfield que se suben solas

El Lego System pone la cara (video real). Higgsfield pone **gráficos, stories y
variaciones** para el laboratorio. Claude usa el conector de Higgsfield (`Graficas_Higgs`)
para generar y el de Meta Ads para subir. **Generar gasta créditos de Higgsfield**: Claude
cotiza antes de cada tanda.

## Marca

| | |
|---|---|
| Colores | Turquesa `#33C7CE` · turquesa oscuro `#12959C` · coral `#FF7B7B` (solo acentos/CTA) · tinta `#123638` · fondo `#F3FBFB` |
| Tipografía | Montserrat (títulos en negrita, cortos) |
| Tono | Directo, chileno, sin tecnicismos. Le hablamos al dueño, no al "community manager" |
| Prohibido | Promesas de resultados garantizados, "seguidores", stock genérico de oficina |

## Formatos por tanda

| Formato | Medidas | Para qué |
|---|---|---|
| Feed | 1080×1350 (4:5) | Laboratorio y remarketing |
| Story / Reel | 1080×1920 (9:16) | Laboratorio. Dejar libre el 14% de arriba y el 20% de abajo |

## Las 5 plantillas que se prueban

1. **Pregunta-dolor** — fondo turquesa, frase grande: "¿Sientes que tus redes podrían dar
   mucho más?". Es el ángulo ganador en imagen.
2. **Celular con el problema** — mockup de un Instagram descuidado (última publicación hace
   47 días) junto a uno ordenado. Antes/después sin mostrar marcas reales de terceros.
3. **Lista de errores** — "3 errores que hacen que nadie te escriba" (carrusel, reaprovecha
   `carrusel-5-errores/`).
4. **Oferta** — "Plan Crecimiento: 8 reels + 8 posts + Meta Ads" con precio. Solo remarketing.
5. **Diagnóstico gratis** — captura estilizada del escáner (`detector-dolores/`): "te decimos
   qué le falla a tu negocio en 10 minutos".

## Flujo (lo hace el skill)

```
1. Claude arma 4-6 prompts (plantilla × ángulo) y cotiza en Higgsfield
2. generate_image_batch  → espera → revisa que el texto se lea y esté bien escrito
3. ads_creative_upload_media  → sube cada imagen a la cuenta
4. ads_create_creative (página Influence Chile SPA, CTA "Enviar mensaje de WhatsApp")
5. ads_create_ad en el conjunto de la tanda del Laboratorio, EN PAUSA
6. Anota la tanda en reportes/tandas.md
```

Regla: si una imagen tiene texto mal escrito o una cara deformada, se descarta, no se sube.
Las imágenes se guardan en `creativos/<tanda>/` (fuera de git).
