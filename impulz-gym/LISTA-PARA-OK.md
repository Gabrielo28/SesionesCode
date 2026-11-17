# Impulz: lista para dar el OK

> Última actualización: 14 de noviembre de 2026, después de la reunión con el dueño.
> El dueño aceptó el piloto y la fórmula. Todo lo que no depende de datos pendientes está terminado.

## 0. Ruta de lanzamiento (17 de noviembre)

Hecho: Instagram vinculado, página de Facebook, portafolio comercial de Meta, cuenta publicitaria, dominio `impulzgym.cl`.

1. [ ] Píxel de Meta (Administrador de eventos) y verificar `impulzgym.cl` en el portafolio
2. [ ] Proyecto en Railway, volumen `/data` y variables (`app/README.md`)
3. [ ] Dominio `impulzgym.cl` + `www` en Railway y registros DNS (Cloudflare si el dominio es de NIC Chile)
4. [ ] Panel → Ajustes: WhatsApp, dirección, Google Maps, Instagram, nombre del coach
5. [ ] Variables `GIMNASIO_IMPULZ_*` en el servicio de entrenachile.cl y unir `claude/gimnasio-aliado-impulz` a `main`
6. [ ] Reserva de prueba de punta a punta y entregar usuario al dueño
7. [ ] Search Console, Bing, IndexNow (`docs/09-seo-geo-indexacion.md`)
8. [ ] Perfil de empresa en Google (revisar si existe la ficha de World Fit), Bing Places, Apple, Waze
9. [ ] Links: Facebook → `impulzgym.cl`; bio de Instagram → `entrenachile.cl/gimnasios/impulz?c=ig`
10. [ ] Primera campaña en Meta y QR de reseñas en recepción



| # | Qué | Dónde |
|---|---|---|
| 1 | **Acuerdo formal para firmar** (5 páginas, carta). Incluye licencia de uso y opción de compra del sitio | `Acuerdo-Impulz-Gym.pdf` |
| 2 | **Sitio web del gimnasio**, con los colores de Impulz | `app/public/sitio.html` |
| 3 | **Página corta de reservas** para anuncios | `app/public/reserva.html` |
| 4 | **Panel de comisiones** con usuario y clave | `app/public/panel.html` |
| 5 | **Propuesta** (web y PDF), sin el programa de bienvenida | `propuesta.html`, `Propuesta-Impulz-Gym.pdf` |
| 6 | **Plan digital**: cuentas a crear y en qué orden | `docs/07-plan-digital.md` |
| 7 | **Plan de contenido del mes 1** y **campañas de Meta** | `docs/04-...`, `docs/05-...` |
| 8 | **Autorización de uso de imagen** | `docs/02-autorizacion-imagen.md` |
| 9 | **Cómo publicar en Railway** | `app/README.md` |
| 10 | **Anexo N° 1: activos a tu nombre y opción de compra** (para firmar junto al acuerdo) | `Anexo-1-Activos-Impulz-Gym.pdf` |
| 11 | **SEO, GEO e indexación**: lo hecho en el sitio y los pasos al publicar | `docs/09-seo-geo-indexacion.md` |

## 1b. Página de Impulz en entrenachile.cl (16 de noviembre)

- Construida en el repositorio `entrenacl`, rama `claude/gimnasio-aliado-impulz`. **No está publicada**: falta unirla a `main`.
- Dirección: `entrenachile.cl/gimnasios/impulz`. Es el destino de los anuncios y el filtro de atribución.
- Para que funcione publicada: desplegar esta aplicación en Railway y cargar en entrenachile.cl las variables
  `GIMNASIO_IMPULZ_RESERVAS_URL` y `GIMNASIO_IMPULZ_CLAVE` (ver `docs/gimnasios-aliados.md` en ese repositorio).

## 2. Pendiente: valores

- [ ] **Precios del Anexo N° 1**: paquete completo, solo sitio, solo cuentas y mantención mensual (referencia anterior: sitio $450.000 y mantención $45.000, más IVA)
- [ ] **Fee de gestión de la opción B** (si el gimnasio pasa a pagar la publicidad). Se conversa el día 91

El acuerdo se puede firmar con los dos primeros en blanco: dice que se fijan después en un anexo firmado.

## 3. Pendiente: datos que faltan

**Del dueño (para el acuerdo):**
- [ ] Nombre o razón social, RUT, cédula y domicilio
- [ ] Qué da el código de reserva. **El gimnasio no cobra matrícula**, así que "matrícula gratis" no sirve. Propuesta: evaluación inicial y plan de entrenamiento gratis con el coach, solo con código

**Tuyos (para el acuerdo):**
- [ ] Nombre o razón social con que firmas por Influence Chile, RUT, cédula y domicilio
- [ ] Cuenta bancaria para el pago de la comisión
- [ ] Fecha de inicio del piloto
- [ ] Con tu contador: si emites boleta de honorarios o factura, y si la comisión va más IVA

**Para el sitio web (se cargan en el panel → Ajustes):**
- [ ] Dirección del gimnasio y link de Google Maps
- [x] Precios de los planes: cargados desde los flyers del gimnasio (16 de noviembre)
- [ ] Confirmar con el dueño: si hay matrícula, si existen plan pareja y pases de verano, y si el Plan Clase sigue con "15 clases diarias" (el flyer todavía dice Worldfit)
- [ ] Promociones vigentes
- [ ] Si la clase de prueba es gratis (se activa en Ajustes)
- [ ] Link a las reseñas de Google, cuando exista la ficha
- [ ] Número de WhatsApp que recibe las reservas
- [ ] Tu nombre de coach y el link de tu perfil en entrenachile.cl
- [ ] Fotos reales del gimnasio (después de la primera grabación)

**Para publicar:**
- [ ] **Dominio propio del gimnasio:** elegirlo (por ejemplo `impulzgym.cl`), verificar en NIC Chile que esté libre y registrarlo
- [ ] Dónde manejas el DNS de entrenachile.cl (para crear `impulz.entrenachile.cl`, dirección del panel de comisiones)
- [ ] Claves que quieres para tu usuario y el del dueño en el panel

## 4. Pendiente: decisiones tuyas

- [ ] Revisar las decisiones por defecto del acuerdo (`docs/01-acuerdo-piloto.md`): matrícula fuera de la comisión, plan pareja, mes sin pago, día 91 sin aviso
- [ ] Hacer revisar el acuerdo por un abogado antes de firmar
- [ ] El **video de la propuesta** todavía dice "programa de bienvenida" en la locución. Rehacer esa escena cuesta créditos de ElevenLabs. Decidir si se rehace o se deja de usar
- [ ] El repositorio es público: la propuesta y el acuerdo quedan a la vista. Decidir si se pasa a privado

## 5. Orden sugerido

1. Completar y firmar el acuerdo.
2. Crear las cuentas del gimnasio (correo, página de Facebook, Instagram profesional, ficha de Google): `docs/07-plan-digital.md`.
3. Publicar la aplicación en Railway y apuntar los dos dominios (el del gimnasio para el sitio, `impulz.entrenachile.cl` para el panel): `app/README.md`.
4. Cargar los datos del sitio en el panel → Ajustes.
5. Primera grabación en el gimnasio y agregar fotos al sitio.
6. Link en la bio de Instagram y primera campaña.
