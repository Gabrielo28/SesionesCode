# Impulz: lista para dar el OK

> Última actualización: 14 de noviembre de 2026, después de la reunión con el dueño.
> El dueño aceptó el piloto y la fórmula. Todo lo que no depende de datos pendientes está terminado.

## 1. Listo: solo falta tu OK

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

## 2. Pendiente: valores

- [ ] **Precio de compra del sitio web** (pago único) → cláusula décimo primera del acuerdo. Sugerido: $450.000 más IVA
- [ ] **Mantención mensual del sitio** → misma cláusula. Sugerido: $45.000 más IVA al mes
- [ ] **Fee de gestión de la opción B** (si el gimnasio pasa a pagar la publicidad). Se conversa el día 91

El acuerdo se puede firmar con los dos primeros en blanco: dice que se fijan después en un anexo firmado.

## 3. Pendiente: datos que faltan

**Del dueño (para el acuerdo):**
- [ ] Nombre o razón social, RUT, cédula y domicilio
- [ ] Qué da el código de reserva (matrícula gratis, semana gratis u otro)

**Tuyos (para el acuerdo):**
- [ ] Nombre o razón social con que firmas por Influence Chile, RUT, cédula y domicilio
- [ ] Cuenta bancaria para el pago de la comisión
- [ ] Fecha de inicio del piloto
- [ ] Con tu contador: si emites boleta de honorarios o factura, y si la comisión va más IVA

**Para el sitio web (se cargan en el panel → Ajustes):**
- [ ] Dirección del gimnasio y link de Google Maps
- [ ] Precios: plan mensual, plan pareja, matrícula y pase verano
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
