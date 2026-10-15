# El Escáner de Negocio — códigos de falla

La metáfora que gobierna el servicio: **como el escáner de un auto.** Se conecta al
negocio, lee los 8 sistemas y entrega códigos de falla. Cada código dice qué sistema
falla, qué tan grave es, cuál es el síntoma, la causa probable y la reparación. El
escáner dice **qué** falla; el taller (diagnóstico completo y radiografía de proceso)
dice **cuánto cuesta y cómo se repara exactamente**.

Herramienta: `escaner/index.html`. Catálogo: `escaner/codigos.js` (este documento
se genera desde ahí: `node escaner/codigos-a-md.js > 06-escaner-y-codigos.md`).

---

## Cómo funciona

```
CONECTAR     Nombre, rubro y modo. Rápido (lo responde el dueño) o Taller (Influence,
             con señales observadas desde afuera).

LEER         16 lecturas, 2 por sistema. Cada respuesta es un sensor: puede disparar
             uno o más códigos.
             En modo taller, además, 32 señales observadas (Google Maps, Instagram,
             web, Meta Ads, empleo, comprador misterioso, visita).

ESCANEAR     La consola recorre los 8 sistemas y muestra cuántas fallas hay en cada uno.

CÓDIGOS      Informe: ID de escaneo, totales por gravedad, estado de los 8 sistemas,
             y los códigos ordenados por gravedad. Cada uno con síntoma, causa,
             reparación rápida (esta semana), reparación en taller, quién la hace y
             por qué sensor fue detectado. "Confirmado por 2 fuentes" cuando lo
             disparan una lectura y una señal a la vez.

REPARAR      Botón de WhatsApp con los códigos críticos ya escritos. Informe
             imprimible. Link del escaneo para reabrirlo.
```

**Gravedad:** 🔴 Crítico = parar y reparar, está costando ventas hoy. 🟠 Medio =
reparar este mes. 🔵 Leve = revisar en el próximo servicio.

**Cómo se ofrece:** "Conecto el escáner a tu negocio. En 3 minutos te dice qué sistema
falla y qué tan grave. Si quieres, después lo llevamos al taller: te muestro cuánto
cuesta cada falla con tus números y cómo se repara." Gratis, sin registro, desde el
celular. Es la puerta de entrada: el dueño que pasa el escáner ya levantó la mano y ya
sabe qué le duele.

---

## Los 8 sistemas

| Código | Sistema | En el auto | La pregunta |
|---|---|---|---|
| **CAP** | Captación | Admisión | ¿Llega suficiente gente? |
| **CON** | Conversión | Transmisión | ¿Los que llegan, compran? |
| **MAR** | Ticket y margen | Rendimiento | ¿Queda plata de cada venta? |
| **OPE** | Operación | Motor | ¿Se entrega bien y a tiempo? |
| **CAJ** | Caja y cobro | Combustible | ¿La plata llega cuando debe? |
| **RET** | Retención | Batería | ¿Vuelven a comprar? |
| **PER** | Personas y dueño | Conductor | ¿Funciona sin el dueño? |
| **DAT** | Datos y control | Tablero | ¿Se sabe cuánto se gana? |

---

## Catálogo de códigos (43)


### CAP · Captación (Admisión)

| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |
|---|---|---|---|---|---|---|
| **CAP-01** | Crítico | Invisible en Google | Al buscar el rubro y la comuna, el negocio no aparece o el perfil no está reclamado. | Reclamar el perfil, cargar 10 fotos reales, horario, categoría correcta y pedir 10 reseñas con QR en 2 semanas. | Contenido local constante y pauta geolocalizada con medición de llamadas y rutas. | Influence |
| **CAP-02** | Medio | Un solo canal de entrada | Casi todos los clientes nuevos llegan por la misma vía: la ubicación, el boca a boca o un marketplace. | Abrir el segundo canal más barato para el rubro: Google para servicios locales, Instagram para venta visual, WhatsApp al barrio para almacenes. | Plan de contenido y pauta con medición de origen por canal. | Influence |
| **CAP-03** | Medio | Instagram inactivo o mudo | Más de 30 días sin publicar, o la bio no dice qué vende, dónde ni cómo comprar. | Bio con qué, dónde y cómo comprar; destacadas con precios, ubicación y preguntas frecuentes; 3 publicaciones por semana durante un mes. | Plan Presencia o Crecimiento con calendario mensual. | Influence |
| **CAP-04** | Medio | Publicidad a ciegas | Promociona posts con el botón azul, sin objetivo, sin landing y sin saber cuánto costó cada cliente. | Una sola campaña con un objetivo (mensajes o visitas), un público y un mensaje; medir costo por consulta. | Meta Ads con estructura, públicos y optimización semanal. | Influence |
| **CAP-06** | Crítico | Web caída o insegura | La web no carga, da error o no tiene candado de seguridad (https). | Renovar dominio y hosting, activar https y revisar que la página principal cargue en el celular. | Landing o sitio nuevo con hosting administrado y monitoreo. | Influence |
| **CAP-05** | Crítico | Clientes nuevos en caída | Llega menos gente que antes y el dueño no sabe por qué ("el barrio está malo"). | Preguntar a cada cliente cómo llegó durante 2 semanas; revisar si abrió competencia y qué ofrece. | Captación activa: Google, contenido y pauta con medición. | Influence |

### CON · Conversión (Transmisión)

| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |
|---|---|---|---|---|---|---|
| **CON-01** | Crítico | Respuesta lenta | Un WhatsApp o DM en hora punta demora más de 2 horas en ser respondido. | WhatsApp Business con respuesta automática inmediata y respuestas rápidas con precio y siguiente paso; regla de 15 minutos en horario. | Flujo de WhatsApp automatizado y una persona responsable del canal en hora punta. | Influence |
| **CON-02** | Crítico | Consultas sin seguimiento | Comentarios con "¿precio?" sin responder; el que pregunta y no compra no vuelve a recibir mensaje. | Un mensaje de seguimiento fijo a las 48 horas, con dueño y texto definidos. | Secuencia de seguimiento automatizada por WhatsApp. | Influence |
| **CON-03** | Medio | No se puede comprar sin llamar | Para reservar, pedir o cotizar hay que llamar o esperar un DM. El link de la bio va al home. | Link de agenda, catálogo de WhatsApp o formulario de pedido en la bio y en Google. | Landing con prueba social y un solo botón, tienda online o agenda online. | Influence |
| **CON-06** | Medio | Web lenta o mala en celular | La web demora más de 4 segundos en cargar o no está adaptada al celular. | Comprimir las imágenes de la portada y revisar la web en el celular; sacar lo que no carga. | Landing o sitio liviano, pensado primero para celular. | Influence |
| **CON-07** | Medio | Sin WhatsApp a un toque | La web no tiene un botón o link directo a WhatsApp. | Botón flotante de WhatsApp con mensaje prellenado en todas las páginas. | Flujo de WhatsApp que responde, califica y agenda. | Influence |
| **CON-04** | Leve | Sin prueba social | Pocas reseñas, sin testimonios, sin casos ni antes-después visibles. | QR de reseñas en el mesón o en el mensaje post-venta; 3 testimonios en destacadas. | Casos y resultados como línea de contenido permanente. | Influence |
| **CON-05** | Leve | Precio escondido | No hay precios ni rangos en ningún canal; todo es "consultar". | Publicar rangos ("desde $X") en bio, destacadas y respuestas rápidas. | Catálogo con precios y la política de precios detrás. | Influence |

### MAR · Ticket y margen (Rendimiento)

| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |
|---|---|---|---|---|---|---|
| **MAR-01** | Crítico | Margen desconocido | El dueño no sabe cuánto deja cada producto o servicio después de todos los costos. | Costear los 5 productos más vendidos esta semana (insumos + tiempo + proporción de fijos). | Costeo completo y política de precios con un contador de gestión. | Se deriva |
| **MAR-02** | Medio | Precios congelados | Más de un año sin subir precios, o no se atreve a subirlos. | Subir 5 a 8% en los productos que el cliente no compara; comunicar con calma. | Revisión de precios semestral con costeo. | Se deriva |
| **MAR-03** | Medio | Vende lo que menos deja | El producto más vendido no es el que más margen deja, y nada destaca el que sí. | Destacar 3 productos de alto margen (tamaño, posición, foto) y armar un combo con ellos. | Ingeniería de carta o catálogo completa. | Influence |
| **MAR-04** | Leve | Descuento por reflejo | Oferta permanente, o descuento a cualquiera que lo pide. | Regla: descuento solo a cambio de algo (volumen, pago anticipado, referido). | Guion de objeciones y política de descuentos. | Dueño |
| **MAR-05** | Leve | Sin venta adicional | Nunca se le ofrece algo más al que ya está comprando. | Un combo y una pregunta fija en caja. | Combos y upsell en el catálogo y en el flujo de WhatsApp. | Influence |

### OPE · Operación (Motor)

| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |
|---|---|---|---|---|---|---|
| **OPE-01** | Crítico | Pedidos en la cabeza | Los pedidos y tareas del día viven en la memoria de alguien, en un cuaderno o en WhatsApp. | Una planilla compartida o app simple donde entran todos los pedidos, con estado. | Sistema de pedidos (formulario web o WhatsApp → panel) o punto de venta. | Influence |
| **OPE-02** | Crítico | Errores y atrasos cada semana | Varios pedidos salen mal o tarde en una semana normal; "es parte del día a día". | Checklist de apertura y cierre; lista de requisitos antes de empezar cada pedido. | Radiografía de proceso y rediseño del flujo. | Influence |
| **OPE-03** | Medio | Quiebres de stock | Falta justo lo que más se vende; "no hay" en productos básicos. | Lista fija de reposición semanal con mínimos para los 20 productos que más rotan. | Control de inventario en el punto de venta. | Se deriva |
| **OPE-04** | Medio | Hora punta desbordada | Fila, demora y una sola persona en caja el sábado a la una. | Refuerzo en las 2 horas punta; pedidos anticipados por WhatsApp para descargar la fila. | Radiografía de proceso y capacidad. | Influence |
| **OPE-05** | Medio | Las reseñas repiten "demora" | Reseñas de Google con "se demoran", "se equivocaron", "nunca contestan". | Responder cada reseña y arreglar la causa más repetida este mes. | Proceso de atención con tiempos máximos y seguimiento de reseñas. | Influence |

### CAJ · Caja y cobro (Combustible)

| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |
|---|---|---|---|---|---|---|
| **CAJ-01** | Crítico | Fiado o cobros sin control | Le deben "harto" o no sabe cuánto; parte lleva más de 60 días. | Lista de quién debe cuánto desde cuándo; tope por cliente y día de pago; cobrar lo vencido esta semana. | Política de cobro; factoring para ventas a empresas. | Se deriva |
| **CAJ-02** | Crítico | Solo efectivo | No acepta tarjeta, o pone mínimo o recargo; transferencia "a mano". | Máquina de tarjeta y QR de transferencia en el mesón; cartel "aceptamos todo medio de pago". | Pago online en la tienda o en el flujo de WhatsApp. | Influence |
| **CAJ-03** | Medio | Stock muerto | Mercadería que lleva más de 3 meses sin moverse ocupa bodega y plata. | Liquidar lo que no rota con una promoción comunicada; usar la plata en lo que sí vende. | Control de inventario con rotación por producto. | Se deriva |
| **CAJ-04** | Medio | Paga al contado, cobra a plazo | Proveedores al contado y clientes (empresas) a 30-60 días; semanas apretadas. | Anticipo obligatorio en pedidos grandes; negociar plazo con el proveedor principal. | Factoring y política de condiciones comerciales. | Se deriva |
| **CAJ-05** | Leve | Caja mezclada | La plata del negocio y la personal salen del mismo bolsillo. | Cuenta separada y sueldo fijo del dueño desde el próximo mes. | Orden contable con el contador. | Se deriva |

### RET · Retención (Batería)

| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |
|---|---|---|---|---|---|---|
| **RET-01** | Crítico | Sin datos de clientes | No tiene teléfono ni correo de quienes ya compraron, o los tiene y nunca les escribe. | Pedir el teléfono en cada compra con una razón (oferta, rifa); lista de difusión de WhatsApp; un mensaje semanal. | CRM simple y mensajería automatizada post-venta. | Influence |
| **RET-02** | Medio | Baja recompra | Menos de un cuarto de las ventas del mes son de clientes que ya habían comprado. | Oferta exclusiva para clientes anteriores; mensaje a los 30 días de la compra. | Programa de fidelización y contenido para clientes actuales. | Influence |
| **RET-03** | Medio | Silencio post-venta | Después de comprar no pasa nada: ni gracias, ni reseña, ni siguiente paso. | Mensaje post-compra con agradecimiento, QR de reseña y qué viene después. | Secuencia post-venta automatizada. | Influence |
| **RET-04** | Leve | Reseñas sin responder | Reseñas de Google, buenas y malas, sin respuesta. | Responder todas las de los últimos 3 meses esta semana; regla de 48 horas. | Gestión de reputación dentro del community management. | Influence |
| **RET-05** | Leve | Sin motivo para volver | Sin puntos, sin tarjeta, sin "la próxima te damos…". | Una mecánica simple: la décima gratis, descuento al referido. | Programa de fidelización con seguimiento. | Influence |

### PER · Personas y dueño (Conductor)

| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |
|---|---|---|---|---|---|---|
| **PER-01** | Crítico | Depende del dueño | Si el dueño falta una semana, el negocio se para o se cae. | Sacarle una tarea completa este mes (redes, WhatsApp, cobranza) con un responsable y un procedimiento escrito. | Procesos escritos y un encargado por área. | Influence |
| **PER-02** | Medio | Dueño apagando incendios | Más de 15 horas a la semana resolviendo urgencias en vez de mejorar el negocio. | Anotar una semana de incendios y arreglar la causa del más repetido. | Radiografía de proceso. | Influence |
| **PER-03** | Medio | Rotación alta | La misma vacante publicada varias veces en el año; "les enseño y se van". | Descripción de cargo de una página y una semana de inducción con checklist. | Selección e incentivos con un partner de RRHH. | Se deriva |
| **PER-04** | Leve | Redes de madrugada | El dueño responde Instagram a la 1 de la mañana y publica cuando puede. | Horario fijo de 30 minutos diarios o delegar el canal completo. | Community management externo. | Influence |
| **PER-05** | Leve | Sin procesos escritos | Nada está escrito; cada uno hace las cosas como las aprendió. | Escribir el proceso más repetido en 10 pasos, con fotos, esta semana. | Manual operativo por área. | Dueño |

### DAT · Datos y control (Tablero)

| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |
|---|---|---|---|---|---|---|
| **DAT-01** | Crítico | Venta de la semana desconocida | No puede decir cuánto vendió la semana pasada en 10 segundos. | Cinco números cada lunes en una planilla: ventas, clientes nuevos, consultas, cierres, caja. | Punto de venta con reporte semanal. | Se deriva |
| **DAT-02** | Medio | Marketing sin medir | No sabe cuánto cuesta conseguir un cliente ni qué canal lo trajo. | Preguntar "¿cómo llegaste?" en cada venta y anotarlo; un link distinto por canal. | Medición de origen y costo por cliente en todas las campañas. | Influence |
| **DAT-03** | Medio | Sin registro de ventas | Boleta manual, calculadora, sin punto de venta ni planilla. | Planilla diaria de ventas por categoría, 5 minutos al cierre. | Punto de venta con inventario. | Se deriva |
| **DAT-04** | Leve | No pregunta de dónde llegan | Nunca se le pregunta al cliente nuevo cómo conoció el negocio. | Una pregunta en caja durante un mes. | Origen registrado en el CRM. | Dueño |
| **DAT-05** | Leve | Web sin sensores | La web no tiene píxel de Meta ni Google Analytics. | Instalar píxel y analytics; medir WhatsApp y formulario como conversiones. | Medición completa de la web y de las campañas. | Influence |

---

## Los sensores: qué dispara cada código

### Lecturas (preguntas al dueño)

| # | Sistema | Lectura | Opción B dispara | Opción C dispara |
|---|---|---|---|---|
| 1 | CAP | ¿De dónde llegan tus clientes nuevos? | CAP-02 | CAP-02, CAP-05 |
| 2 | CAP | Si alguien busca en Google tu rubro y tu comuna, ¿apareces? | CAP-01 | CAP-01 |
| 3 | CON | Cuando te escriben por WhatsApp o Instagram en hora punta, ¿cuánto demoras en responder? | CON-01 | CON-01 |
| 4 | CON | De cada 10 personas que preguntan precio, ¿cuántas terminan comprando? | CON-02 | CON-02, CON-03 |
| 5 | MAR | ¿Sabes cuánto te deja cada producto o servicio después de todos los costos? | MAR-01 | MAR-01, MAR-03 |
| 6 | MAR | ¿Cuándo subiste precios por última vez? | MAR-02 | MAR-02, MAR-04 |
| 7 | OPE | En una semana normal, ¿cuántos pedidos o atenciones salen mal o atrasados? | OPE-02 | OPE-02 |
| 8 | OPE | ¿Dónde se anotan los pedidos y las tareas del día? | OPE-01 | OPE-01 |
| 9 | CAJ | ¿Cuánta plata te deben hoy tus clientes (fiado, facturas por cobrar)? | CAJ-04 | CAJ-01 |
| 10 | CAJ | ¿Aceptas tarjeta y transferencia sin monto mínimo? | CAJ-02 | CAJ-02 |
| 11 | RET | ¿Tienes el teléfono o correo de tus clientes y les escribes? | RET-01, RET-03 | RET-01 |
| 12 | RET | De tus ventas del mes, ¿qué parte viene de clientes que ya habían comprado antes? | RET-05 | RET-02 |
| 13 | PER | Si te enfermas una semana, ¿qué pasa con el negocio? | PER-05 | PER-01 |
| 14 | PER | ¿Cuántas horas a la semana se te van apagando incendios en vez de mejorar el negocio? | — | PER-02 |
| 15 | DAT | ¿Cuánto vendiste la semana pasada? | DAT-03 | DAT-01 |
| 16 | DAT | ¿Mides qué te trae cada peso que gastas en publicidad o promociones? | DAT-02 | DAT-02, DAT-04 |

### Señales observadas (modo taller)

| Fuente | Señal | Dispara |
|---|---|---|
| Google Maps | No aparece al buscar rubro + comuna, o el perfil no está reclamado | CAP-01 |
| Google Maps | Reseñas que repiten demora, errores o que no contestan | OPE-05 |
| Google Maps | Reseñas sin responder (buenas o malas) | RET-04 |
| Google Maps | Menos de 10 reseñas o la última hace más de 3 meses | CON-04 |
| Google Maps | Horario cargado distinto al real | OPE-02 |
| Instagram | Más de 30 días sin publicar | CAP-03 |
| Instagram | La bio no dice qué vende, dónde ni cómo comprar | CAP-03 |
| Instagram | Comentarios con "¿precio?" sin responder | CON-02, CON-05 |
| Instagram | Responde de madrugada (lo hace el dueño) | PER-04 |
| Instagram | Solo contenido para captar, nada para clientes actuales | RET-05 |
| Web | No se puede comprar, reservar ni cotizar en 2 toques | CON-03 |
| Web | Sin precios ni rangos | CON-05 |
| Web | Sin píxel de Meta ni Google Analytics | DAT-05 |
| Web | Abandonada: pie de página o novedades de hace más de un año | CAP-03 |
| Web | Demora más de 4 segundos o se ve mal en el celular | CON-06 |
| Web | No carga, da error o no tiene candado (https) | CAP-06 |
| Web | No tiene botón ni link directo a WhatsApp | CON-07 |
| Meta Ads y empleo | Un post promocionado sin landing ni llamado a la acción | CAP-04 |
| Meta Ads y empleo | La misma vacante operativa publicada 2 o más veces en el año | PER-03 |
| Comprador misterioso | Respondió en más de 2 horas (o no respondió) | CON-01 |
| Comprador misterioso | No dio precio ni rango | CON-05 |
| Comprador misterioso | No propuso un siguiente paso (link, hora, dirección) | CON-03 |
| Comprador misterioso | No hizo seguimiento al día siguiente | CON-02 |
| Visita al local | Solo efectivo, o mínimo de compra con tarjeta | CAJ-02 |
| Visita al local | Cuaderno de fiado a la vista | CAJ-01 |
| Visita al local | "No hay" en productos básicos | OPE-03 |
| Visita al local | Fila en hora punta con una sola caja | OPE-04 |
| Visita al local | Bodega o vitrina llena de lo que no rota; oferta permanente | CAJ-03, MAR-04 |
| Visita al local | No piden ningún dato ni reseña al comprar | RET-01, RET-03 |
| Visita al local | El dueño está en caja, cocina y teléfono a la vez | PER-01 |
| Visita al local | Carta o catálogo plano, sin producto destacado ni combos | MAR-03, MAR-05 |
| Visita al local | El dueño saca plata de la caja para gastos personales; no tiene sueldo fijo | CAJ-05 |

---

## Posibles soluciones (15)

Cada solución repara varios códigos. El escáner las ordena **de la mejor a la peor para el negocio escaneado** y muestra las 5 primeras:

- **Impacto** = suma de la gravedad (3/2/1) de los códigos detectados que repara; un código confirmado por 2 o más fuentes pesa 1,5 veces.
- **Puntaje** = impacto × (4 − esfuerzo). Esfuerzo 1 = esta semana (×3), 2 = 2 a 4 semanas (×2), 3 = 1 a 3 meses (×1). Lo rápido pesa más.
- Se eligen **de a una**, contando solo los códigos que aún no cubre una solución anterior. Así la Top 2 no repite lo que ya arregla la Top 1 y las cinco juntas cubren lo máximo posible.

| Id | Solución | Esfuerzo | Costo | Quién | Repara | Qué cambia |
|---|---|---|---|---|---|---|
| **S01** | Perfil de Google completo y 10 reseñas | Esta semana | Gratis | Dueño | CAP-01, CON-04, RET-04, CAP-05 | Aparecer cuando buscan el rubro en la comuna y tener prueba social en 2 semanas. |
| **S02** | Asistente de WhatsApp que responde, califica y agenda | Esta semana | Bajo | Influence | CON-01, CON-02, CON-03, CON-05, CON-07, PER-04 | Cerrar las consultas que hoy se pierden por demora o silencio. |
| **S03** | Aceptar todos los medios de pago | Esta semana | Bajo | Dueño | CAJ-02 | Dejar de perder la venta completa del que no anda con efectivo. |
| **S04** | Lista de clientes y un mensaje semanal | Esta semana | Bajo | Influence | RET-01, RET-02, RET-03, RET-05, CAP-02 | Que los que ya compraron vuelvan sin gastar en captación. |
| **S05** | Tablero de 5 números cada lunes | Esta semana | Gratis | Dueño | DAT-01, DAT-02, DAT-03, DAT-04 | Ver las fugas antes de que duelan y saber qué canal trae clientes. |
| **S06** | Ordenar la caja | 2 a 4 semanas | Gratis | Se deriva | CAJ-01, CAJ-03, CAJ-04, CAJ-05 | Que la plata de las ventas esté en la cuenta y no en el cuaderno ni en la bodega. |
| **S07** | Un solo lugar para los pedidos | 2 a 4 semanas | Bajo | Influence | OPE-01, OPE-02, OPE-03, OPE-05 | Menos pedidos perdidos, atrasados o con error cada semana. |
| **S08** | Costeo, precios y carta con destacados | 2 a 4 semanas | Bajo | Se deriva | MAR-01, MAR-02, MAR-03, MAR-04, MAR-05 | Que quede más plata de las mismas ventas. |
| **S09** | Presencia constante en redes con sistema | 2 a 4 semanas | Medio | Influence | CAP-03, CAP-02, PER-04, CAP-05 | Un segundo canal de clientes nuevos que no depende del dueño. |
| **S10** | Campaña de captación medida | 2 a 4 semanas | Medio | Influence | CAP-04, CAP-05, DAT-02, DAT-05 | Saber cuánto cuesta cada cliente nuevo y comprar más de los que convienen. |
| **S11** | Landing, tienda online o agenda online | 1 a 3 meses | Medio | Influence | CON-03, CON-06, CAP-06, CON-05, CON-04, OPE-01, CAJ-02 | Que se pueda comprar o reservar sin llamar y sin esperar un DM. |
| **S12** | Delegar un área completa con procedimiento | 2 a 4 semanas | Medio | Influence | PER-01, PER-02, PER-04, PER-05 | Que el negocio funcione una semana sin el dueño y que él recupere horas para pensar. |
| **S13** | Radiografía de proceso y refuerzo en hora punta | 2 a 4 semanas | Bajo | Influence | OPE-02, OPE-04, PER-02 | Saber en qué paso exacto se frena y cuánto cuesta, y destrabarlo sin contratar. |
| **S14** | Cargo escrito e inducción de una semana | 2 a 4 semanas | Bajo | Se deriva | PER-03, PER-05 | Que la gente nueva rinda en una semana y se quede. |
| **S15** | Punto de venta con inventario | 1 a 3 meses | Medio | Se deriva | OPE-03, CAJ-03, DAT-03, DAT-01 | Ventas, margen y stock al día sin planillas. |

---

## Del código a la reparación

- **Reparación rápida** es lo que el dueño puede hacer esta semana, con o sin Influence.
  Se regala: demuestra que el escáner sabe de lo que habla.
- **En taller** es la reparación de fondo. Las que dicen *Influence* se venden con
  `04-de-dolor-a-oferta.md`. Las que dicen *Se deriva* van a un partner con nombre y
  teléfono (contador de gestión, software de punto de venta, RRHH, fintech).
- Los códigos no traen precio ni costo mensual a propósito: eso sale del taller, con
  los números del dueño (`diagnostico/` y `proceso/`). Un escáner que dice "esto te
  cuesta $1.400.000" sin haber preguntado nada no es creíble.
- Tres o más códigos críticos en el mismo sistema = ese sistema es el cuello de
  botella casi seguro. Dos sistemas en rojo = entrar por el que el dueño siente
  (`01-mapa-de-dolores.md`, dolor sentido vs. dolor real).

## Agregar o cambiar códigos

Todo vive en `escaner/codigos.js`: sistemas, códigos, lecturas, señales y soluciones. Para
agregar un código: una línea en `CODIGOS`, al menos un sensor que lo dispare (una opción
de lectura o una señal) y una solución que lo repare. Después regenerar este documento
con `codigos-a-md.js`.

