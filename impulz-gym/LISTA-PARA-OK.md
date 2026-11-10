# Impulz: lista para revisar y dar el OK

> Todo esto quedó preparado antes de que el dueño acepte. Nada se publicó ni se envió.
> Marca cada punto cuando lo revises. Última actualización: 10 de noviembre de 2026.

## 1. Qué revisar

| # | Qué | Dónde | Estado |
|---|---|---|---|
| 1 | Propuesta (web y PDF) | `propuesta.html`, `Propuesta-Impulz-Gym.pdf` | Lista. Falta tu nombre y experiencia |
| 2 | Página de reservas | `app/public/reserva.html` (ver capturas en el chat) | Lista para publicar |
| 3 | Panel de comisiones con usuario y clave | `app/public/panel.html` | Listo. 19 pruebas automáticas OK |
| 4 | Cómo publicarlo en Railway | `app/README.md` | Listo |
| 5 | Acuerdo de piloto (para firmar) | `docs/01-acuerdo-piloto.md` | Borrador. Borrar las notas del final antes de imprimir |
| 6 | Autorización de uso de imagen | `docs/02-autorizacion-imagen.md` | Borrador |
| 7 | Respuestas a objeciones | `docs/03-objeciones.md` | Borrador |
| 8 | Plan de contenido mes 1 (12 publicaciones + 4 videos de YouTube) | `docs/04-plan-contenido-mes-1.md` | Borrador |
| 9 | Campañas de Meta (estructura, textos, links) | `docs/05-campanas-meta.md` | Borrador |

## 2. Decisiones que te tocan a ti

1. **WhatsApp de las reservas:** ¿llegan a tu número o al de recepción? ¿Quién responde los mensajes de Instagram del gimnasio?
2. **Beneficio del código:** la propuesta ofrece a los primeros 50 socios "sin matrícula y precio congelado 6 meses".
   Si el código también da "matrícula gratis", se repiten. Opciones: que el código dé una semana gratis, o que el código sea la forma de acceder a la oferta de fundadores.
3. **Base de la comisión:** ¿se calcula sobre lo que pagó el socio después de descuentos? ¿La matrícula cuenta? ¿El plan pareja son 2 socios a mitad de precio? ¿La comisión va + IVA? (preguntar al contador).
4. **Si un socio se salta un mes:** el acuerdo dice que su reloj sigue corriendo y ese mes no paga comisión. ¿Te parece?
5. **Día 91 sin aviso:** el acuerdo dice que si nadie avisa, sigue la Opción A. No está en la propuesta.
6. **Fee de la Opción B** ($150.000 a $250.000): no está en la propuesta que verá el dueño. El acuerdo solo dice "a conversar el día 91".
7. **Instagram del gimnasio (`c=ig`):** si otra persona también publica en esa cuenta, el dueño podría discutir las reservas que vienen de la bio. Conviene dejar claro que el link de reservas de la bio cuenta como gestión tuya.

## 3. Problemas que podemos encontrar antes del sí

| Problema | Por qué importa | Qué hacer |
|---|---|---|
| **El gimnasio necesita una página de Facebook** conectada a su Instagram | Sin ella no se puede pedir acceso de anunciante ni hacer anuncios a nombre de Impulz | Preguntarle al dueño en la reunión. Si no existe, crearla el primer día |
| **Verificar el dominio entrenachile.cl en tu Business Manager** | Meta lo pide para medir bien las reservas con el Píxel | Hacerlo ya, no depende del dueño |
| **DNS de entrenachile.cl** | Para crear `impulz.entrenachile.cl` hay que agregar un registro CNAME | Confirmar dónde manejas el dominio (NIC Chile, Cloudflare u otro) |
| **Volumen de Railway** | Sin volumen, las reservas se borran en cada actualización | Crear el volumen antes del primer uso real (ver README) |
| **Presupuesto bajo para Meta** (unos $3.000 al día) | Meta tarda en optimizar con pocas reservas | El plan de campañas tiene un plan B con objetivo de tráfico |
| **Reglas de Meta para salud y bienestar** | Anuncios con "antes y después" o que aludan al cuerpo de la persona se rechazan | Los textos ya lo evitan. Revisar las reglas vigentes antes de cada campaña |
| **No sabemos cómo registran hoy a sus socios** | Define cuánto trabajo extra es marcar códigos | El sistema funciona igual: solo pide marcar el código al inscribir |
| **Promociones con fecha** (las de bienvenida eran del 6 al 12 de noviembre) | La página y los anuncios no pueden mostrar precios vencidos | La promoción de la página se edita en Ajustes; queda vacía hasta confirmar |

## 4. Lo que se puede hacer ya, sin esperar el sí

- [ ] Verificar el dominio entrenachile.cl en el Business Manager de Influence Chile.
- [ ] Crear el Píxel de Meta y guardar su ID.
- [ ] Publicar la app en Railway con el volumen y tus usuarios (aún sin dominio, con la dirección `*.up.railway.app`) para probarla tú.
- [ ] Grabar contenido tuyo como coach (sirve para tus redes aunque el dueño diga que no).
- [ ] Completar tu nombre y experiencia en la propuesta y regenerar el PDF.

## 5. Lo que espera el sí del dueño

- [ ] Firmar el acuerdo.
- [ ] Acceso de anunciante a la página de Impulz y acceso a su Instagram.
- [ ] Usuario y clave del dueño en el panel (variables en Railway).
- [ ] Dominio `impulz.entrenachile.cl` apuntando a Railway.
- [ ] Primera sesión de grabación y lanzamiento de la campaña.
