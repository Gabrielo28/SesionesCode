# Impulz Gym: plan digital completo

> Punto de partida (14 de noviembre de 2026): el gimnasio solo tiene Instagram. No tiene correo, página de Facebook,
> sitio web ni ficha en Google. El dueño aceptó el piloto. Este plan ordena todo lo que hay que crear, en qué orden y quién lo hace.

## 1. Lo que ya está construido

| Pieza | Estado | Dónde |
|---|---|---|
| Sitio web del gimnasio | Listo para publicar. Faltan datos del dueño (ver punto 4) | `app/public/sitio.html` |
| Página corta de reservas para anuncios | Lista | `app/public/reserva.html` (dirección `/reserva`) |
| Panel de comisiones con usuario y clave | Listo | `app/public/panel.html` (dirección `/panel`) |
| Acuerdo, autorización de imagen, plan de contenido, campañas | Borradores | `docs/` |

El sitio, las reservas y el panel son una sola aplicación. Los precios, la dirección, el WhatsApp y la promoción se
cambian desde el panel (Ajustes), sin tocar código.

## 2. Cuentas que hay que crear, en este orden

El orden importa: cada cuenta necesita la anterior.

| # | Qué | Para qué | A nombre de quién | Tiempo |
|---|---|---|---|---|
| 1 | **Correo del gimnasio** (Gmail, por ejemplo `impulzgym.elquisco@gmail.com`) | Es la llave de todas las demás cuentas | Del dueño. Tú con acceso | 10 min |
| 2 | **Dominio propio del gimnasio** (por ejemplo `impulzgym.cl`, en NIC Chile; verificar que esté libre) | Dirección del sitio web oficial | Lo registra el coach con autorización escrita, o el dueño | 15 min, unos $10.000 al año |
| 2b | **Subdominio `impulz.entrenachile.cl`** (registro CNAME en el DNS de entrenachile.cl) | Dirección del panel de comisiones | Del coach | 10 min, sin costo |
| 3 | **Página de Facebook** de Impulz Gym | Sin página no se pueden hacer anuncios en Meta | Creada con el perfil del dueño. Tú como administrador | 15 min |
| 4 | **Instagram a cuenta profesional** y conectada a la página de Facebook | Estadísticas, botón de contacto y anuncios | Cuenta actual del gimnasio | 10 min |
| 5 | **Portafolio comercial de Meta** (Business) del gimnasio, y acceso de socio para Influence Chile | Así los anuncios salen de tu cuenta publicitaria y la página sigue siendo del dueño | Dueño comparte, tú administras | 20 min |
| 6 | **Píxel de Meta** y verificación del dominio | Medir las reservas que vienen de anuncios | En tu cuenta publicitaria | 20 min |
| 7 | **Perfil de Empresa en Google** (Google Maps) | Aparecer en "gimnasio El Quisco" y en el mapa. Es gratis y es lo que más visitas locales trae | Con el correo del gimnasio. Google verifica por video o por carta | 20 min + verificación (días) |
| 8 | **WhatsApp Business** en el número que recibirá las reservas | Perfil con horario, respuestas rápidas y catálogo de planes | Número del gimnasio o tuyo (decidir) | 15 min |
| 9 | **Publicar la aplicación en Railway** y apuntar el dominio | Sitio, reservas y panel en línea | Tu cuenta de Railway | 30 min (ver `app/README.md`) |
| 10 | **Link en la bio de Instagram** con `?c=ig` | Que las reservas desde Instagram queden medidas | Tú | 2 min |

**Regla de propiedad:** todo lo que es del gimnasio (correo, página, Instagram, ficha de Google) queda a nombre
del dueño, contigo como administrador. Lo tuyo (sitio web, dominio, cuenta publicitaria, Píxel, Railway, panel) queda a tu nombre.
Así, si el acuerdo termina, nadie pierde lo suyo.

## 3. Dominios y propiedad (decidido el 16 de noviembre)

- **Sitio web oficial del gimnasio: dominio propio** (por ejemplo `impulzgym.cl`). No es un subdominio de entrenachile.cl.
- **Panel de comisiones: `impulz.entrenachile.cl`**, dentro de la plataforma del coach.
- Los dos apuntan a la misma aplicación. Las reservas del sitio quedan registradas en el panel.
- El sitio, la página de reservas, el panel, la cuenta publicitaria y el Píxel son del coach / la Agencia. El gimnasio usa el sitio sin costo mientras dure el acuerdo.
- El dominio lo registra la Agencia con autorización escrita del gimnasio (está en el acuerdo) y se traspasa con la compra del sitio o al terminar.
- Las reservas que entran por el sitio cuentan como gestión del coach (cláusula sexta).

## 4. Datos que faltan del dueño para publicar

Se completan en el panel → Ajustes. Mientras falten, el sitio muestra "Consulta" o simplemente no muestra ese dato.

- [ ] Dirección exacta y link de Google Maps
- [ ] Precio del plan mensual, del plan pareja y de la matrícula
- [ ] Promociones vigentes (las de bienvenida vencían el 12 de noviembre)
- [ ] Precio del pase verano (semana y quincena)
- [ ] Número de WhatsApp que recibirá las reservas
- [ ] Qué da el código de reserva (matrícula gratis, una semana gratis u otro)
- [ ] Fotos y videos reales del gimnasio (hoy el sitio no usa fotos; se agregan después de la primera grabación)
- [ ] Tu nombre como coach y el link de tu perfil en entrenachile.cl

## 5. Primeras 4 semanas

| Semana | Qué se hace |
|---|---|
| **1** | Cuentas 1 a 5. Primera sesión de grabación en el gimnasio (fotos para el sitio y contenido). Publicar la aplicación con la dirección temporal de Railway y probarla |
| **2** | Dominio apuntando al sitio. Píxel y verificación. Ficha de Google creada. Link en la bio. Primeras publicaciones del relanzamiento |
| **3** | Primera campaña en Meta con presupuesto bajo ($60.000 a $80.000 en 3 semanas). Pedir las primeras reseñas en Google a socios actuales |
| **4** | Revisar el costo por reserva y por socio en el panel. Anunciar el reto de verano. Primera liquidación mensual con el dueño |

## 6. Acuerdo

El acuerdo formal ya incluye lo conversado en la reunión: `../Acuerdo-Impulz-Gym.pdf`. Las decisiones por defecto y lo que
se completa a mano están en `01-acuerdo-piloto.md`.
