/*
 * Catálogo de códigos de falla — Escáner de Negocio · Influence Chile
 *
 * Como en un escáner automotriz: cada falla tiene un código, un sistema, una gravedad,
 * un síntoma, una causa probable y una reparación. El escáner (index.html) detecta
 * códigos a partir de las respuestas del dueño y de las señales observadas desde afuera.
 *
 * Se usa desde el navegador (window.CODIGOS) y desde Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CODIGOS = factory();
})(this, function () {

  // Los 8 sistemas, en el orden de la cadena del dinero. "auto" es la pieza equivalente en un vehículo.
  var SISTEMAS = [
    { id: 'CAP', nombre: 'Captación',        auto: 'Admisión',      pregunta: '¿Llega suficiente gente?' },
    { id: 'CON', nombre: 'Conversión',       auto: 'Transmisión',   pregunta: '¿Los que llegan, compran?' },
    { id: 'MAR', nombre: 'Ticket y margen',  auto: 'Rendimiento',   pregunta: '¿Queda plata de cada venta?' },
    { id: 'OPE', nombre: 'Operación',        auto: 'Motor',         pregunta: '¿Se entrega bien y a tiempo?' },
    { id: 'CAJ', nombre: 'Caja y cobro',     auto: 'Combustible',   pregunta: '¿La plata llega cuando debe?' },
    { id: 'RET', nombre: 'Retención',        auto: 'Batería',       pregunta: '¿Vuelven a comprar?' },
    { id: 'PER', nombre: 'Personas y dueño', auto: 'Conductor',     pregunta: '¿Funciona sin el dueño?' },
    { id: 'DAT', nombre: 'Datos y control',  auto: 'Tablero',       pregunta: '¿Se sabe cuánto se gana?' }
  ];

  // Gravedad: 3 crítica (rojo, parar y reparar), 2 media (ámbar, reparar este mes), 1 leve (revisar).
  var CODIGOS = [
    // CAPTACIÓN
    { id: 'CAP-01', g: 3, nombre: 'Invisible en Google', sintoma: 'Al buscar el rubro y la comuna, el negocio no aparece o el perfil no está reclamado.', causa: 'Nunca se reclamó ni se completó el Perfil de Negocio de Google. Es el canal donde la gente ya está buscando.', rapida: 'Reclamar el perfil, cargar 10 fotos reales, horario, categoría correcta y pedir 10 reseñas con QR en 2 semanas.', taller: 'Contenido local constante y pauta geolocalizada con medición de llamadas y rutas.', quien: 'influence' },
    { id: 'CAP-02', g: 2, nombre: 'Un solo canal de entrada', sintoma: 'Casi todos los clientes nuevos llegan por la misma vía: la ubicación, el boca a boca o un marketplace.', causa: 'Nunca se abrió un segundo canal. Si el único cambia (abre un competidor, baja el flujo), la venta cae sin reemplazo.', rapida: 'Abrir el segundo canal más barato para el rubro: Google para servicios locales, Instagram para venta visual, WhatsApp al barrio para almacenes.', taller: 'Plan de contenido y pauta con medición de origen por canal.', quien: 'influence' },
    { id: 'CAP-03', g: 2, nombre: 'Instagram inactivo o mudo', sintoma: 'Más de 30 días sin publicar, o la bio no dice qué vende, dónde ni cómo comprar.', causa: 'Lo hace el dueño cuando puede. Sin sistema, no hay constancia; sin bio clara, el que llega no entiende.', rapida: 'Bio con qué, dónde y cómo comprar; destacadas con precios, ubicación y preguntas frecuentes; 3 publicaciones por semana durante un mes.', taller: 'Plan Presencia o Crecimiento con calendario mensual.', quien: 'influence' },
    { id: 'CAP-04', g: 2, nombre: 'Publicidad a ciegas', sintoma: 'Promociona posts con el botón azul, sin objetivo, sin landing y sin saber cuánto costó cada cliente.', causa: 'Gasta sin estructura ni medición. La conclusión "la publicidad no sirve" sale de aquí.', rapida: 'Una sola campaña con un objetivo (mensajes o visitas), un público y un mensaje; medir costo por consulta.', taller: 'Meta Ads con estructura, públicos y optimización semanal.', quien: 'influence' },
    { id: 'CAP-05', g: 3, nombre: 'Clientes nuevos en caída', sintoma: 'Llega menos gente que antes y el dueño no sabe por qué ("el barrio está malo").', causa: 'Cambió algo afuera (competencia, flujo, hábitos) y el negocio no tiene cómo verlo ni compensarlo.', rapida: 'Preguntar a cada cliente cómo llegó durante 2 semanas; revisar si abrió competencia y qué ofrece.', taller: 'Captación activa: Google, contenido y pauta con medición.', quien: 'influence' },

    // CONVERSIÓN
    { id: 'CON-01', g: 3, nombre: 'Respuesta lenta', sintoma: 'Un WhatsApp o DM en hora punta demora más de 2 horas en ser respondido.', causa: 'Responde el dueño entre medio de atender. El cliente que pregunta precio compra donde le contestan primero.', rapida: 'WhatsApp Business con respuesta automática inmediata y respuestas rápidas con precio y siguiente paso; regla de 15 minutos en horario.', taller: 'Flujo de WhatsApp automatizado y una persona responsable del canal en hora punta.', quien: 'influence' },
    { id: 'CON-02', g: 3, nombre: 'Consultas sin seguimiento', sintoma: 'Comentarios con "¿precio?" sin responder; el que pregunta y no compra no vuelve a recibir mensaje.', causa: 'Nadie tiene asignado el seguimiento. Lo que no tiene dueño no se hace.', rapida: 'Un mensaje de seguimiento fijo a las 48 horas, con dueño y texto definidos.', taller: 'Secuencia de seguimiento automatizada por WhatsApp.', quien: 'influence' },
    { id: 'CON-03', g: 2, nombre: 'No se puede comprar sin llamar', sintoma: 'Para reservar, pedir o cotizar hay que llamar o esperar un DM. El link de la bio va al home.', causa: 'No hay un camino directo de interés a compra. Cada fricción pierde una parte.', rapida: 'Link de agenda, catálogo de WhatsApp o formulario de pedido en la bio y en Google.', taller: 'Landing con prueba social y un solo botón, tienda online o agenda online.', quien: 'influence' },
    { id: 'CON-04', g: 1, nombre: 'Sin prueba social', sintoma: 'Pocas reseñas, sin testimonios, sin casos ni antes-después visibles.', causa: 'Nunca se pide. El cliente nuevo no tiene cómo confiar.', rapida: 'QR de reseñas en el mesón o en el mensaje post-venta; 3 testimonios en destacadas.', taller: 'Casos y resultados como línea de contenido permanente.', quien: 'influence' },
    { id: 'CON-05', g: 1, nombre: 'Precio escondido', sintoma: 'No hay precios ni rangos en ningún canal; todo es "consultar".', causa: 'Miedo a espantar. En la práctica espanta más el no saber.', rapida: 'Publicar rangos ("desde $X") en bio, destacadas y respuestas rápidas.', taller: 'Catálogo con precios y la política de precios detrás.', quien: 'influence' },

    // TICKET Y MARGEN
    { id: 'MAR-01', g: 3, nombre: 'Margen desconocido', sintoma: 'El dueño no sabe cuánto deja cada producto o servicio después de todos los costos.', causa: 'Sin costeo, los precios se ponen mirando al vecino y se empuja lo que menos deja.', rapida: 'Costear los 5 productos más vendidos esta semana (insumos + tiempo + proporción de fijos).', taller: 'Costeo completo y política de precios con un contador de gestión.', quien: 'partner' },
    { id: 'MAR-02', g: 2, nombre: 'Precios congelados', sintoma: 'Más de un año sin subir precios, o no se atreve a subirlos.', causa: 'Los costos subieron y el precio no. El margen se achica en silencio.', rapida: 'Subir 5 a 8% en los productos que el cliente no compara; comunicar con calma.', taller: 'Revisión de precios semestral con costeo.', quien: 'partner' },
    { id: 'MAR-03', g: 2, nombre: 'Vende lo que menos deja', sintoma: 'El producto más vendido no es el que más margen deja, y nada destaca el que sí.', causa: 'Carta o catálogo plano: todo al mismo tamaño, sin producto estrella.', rapida: 'Destacar 3 productos de alto margen (tamaño, posición, foto) y armar un combo con ellos.', taller: 'Ingeniería de carta o catálogo completa.', quien: 'influence' },
    { id: 'MAR-04', g: 1, nombre: 'Descuento por reflejo', sintoma: 'Oferta permanente, o descuento a cualquiera que lo pide.', causa: 'El descuento es la respuesta a la objeción porque no hay otra preparada.', rapida: 'Regla: descuento solo a cambio de algo (volumen, pago anticipado, referido).', taller: 'Guion de objeciones y política de descuentos.', quien: 'dueño' },
    { id: 'MAR-05', g: 1, nombre: 'Sin venta adicional', sintoma: 'Nunca se le ofrece algo más al que ya está comprando.', causa: 'No hay combos ni "¿le agrego…?" definidos.', rapida: 'Un combo y una pregunta fija en caja.', taller: 'Combos y upsell en el catálogo y en el flujo de WhatsApp.', quien: 'influence' },

    // OPERACIÓN
    { id: 'OPE-01', g: 3, nombre: 'Pedidos en la cabeza', sintoma: 'Los pedidos y tareas del día viven en la memoria de alguien, en un cuaderno o en WhatsApp.', causa: 'Sin un solo lugar visible para todos, en hora punta se olvidan y se pierden.', rapida: 'Una planilla compartida o app simple donde entran todos los pedidos, con estado.', taller: 'Sistema de pedidos (formulario web o WhatsApp → panel) o punto de venta.', quien: 'influence' },
    { id: 'OPE-02', g: 3, nombre: 'Errores y atrasos cada semana', sintoma: 'Varios pedidos salen mal o tarde en una semana normal; "es parte del día a día".', causa: 'Proceso sin estándar: cada uno lo hace a su manera y la información llega incompleta.', rapida: 'Checklist de apertura y cierre; lista de requisitos antes de empezar cada pedido.', taller: 'Radiografía de proceso y rediseño del flujo.', quien: 'influence' },
    { id: 'OPE-03', g: 2, nombre: 'Quiebres de stock', sintoma: 'Falta justo lo que más se vende; "no hay" en productos básicos.', causa: 'El pedido al proveedor se hace de memoria, cuando ya faltó.', rapida: 'Lista fija de reposición semanal con mínimos para los 20 productos que más rotan.', taller: 'Control de inventario en el punto de venta.', quien: 'partner' },
    { id: 'OPE-04', g: 2, nombre: 'Hora punta desbordada', sintoma: 'Fila, demora y una sola persona en caja el sábado a la una.', causa: 'La capacidad está dimensionada para el promedio, no para la punta.', rapida: 'Refuerzo en las 2 horas punta; pedidos anticipados por WhatsApp para descargar la fila.', taller: 'Radiografía de proceso y capacidad.', quien: 'influence' },
    { id: 'OPE-05', g: 2, nombre: 'Las reseñas repiten "demora"', sintoma: 'Reseñas de Google con "se demoran", "se equivocaron", "nunca contestan".', causa: 'Los clientes ya diagnosticaron la operación; nadie lo leyó.', rapida: 'Responder cada reseña y arreglar la causa más repetida este mes.', taller: 'Proceso de atención con tiempos máximos y seguimiento de reseñas.', quien: 'influence' },

    // CAJA Y COBRO
    { id: 'CAJ-01', g: 3, nombre: 'Fiado o cobros sin control', sintoma: 'Le deben "harto" o no sabe cuánto; parte lleva más de 60 días.', causa: 'Crédito informal sin tope, fecha ni registro.', rapida: 'Lista de quién debe cuánto desde cuándo; tope por cliente y día de pago; cobrar lo vencido esta semana.', taller: 'Política de cobro; factoring para ventas a empresas.', quien: 'partner' },
    { id: 'CAJ-02', g: 3, nombre: 'Solo efectivo', sintoma: 'No acepta tarjeta, o pone mínimo o recargo; transferencia "a mano".', causa: 'Evita la comisión y pierde la venta completa del que no anda con efectivo.', rapida: 'Máquina de tarjeta y QR de transferencia en el mesón; cartel "aceptamos todo medio de pago".', taller: 'Pago online en la tienda o en el flujo de WhatsApp.', quien: 'influence' },
    { id: 'CAJ-03', g: 2, nombre: 'Stock muerto', sintoma: 'Mercadería que lleva más de 3 meses sin moverse ocupa bodega y plata.', causa: 'Se compró por impulso o por oferta del proveedor, sin mirar rotación.', rapida: 'Liquidar lo que no rota con una promoción comunicada; usar la plata en lo que sí vende.', taller: 'Control de inventario con rotación por producto.', quien: 'partner' },
    { id: 'CAJ-04', g: 2, nombre: 'Paga al contado, cobra a plazo', sintoma: 'Proveedores al contado y clientes (empresas) a 30-60 días; semanas apretadas.', causa: 'El ciclo de caja está al revés. Vende bien y no tiene plata.', rapida: 'Anticipo obligatorio en pedidos grandes; negociar plazo con el proveedor principal.', taller: 'Factoring y política de condiciones comerciales.', quien: 'partner' },
    { id: 'CAJ-05', g: 1, nombre: 'Caja mezclada', sintoma: 'La plata del negocio y la personal salen del mismo bolsillo.', causa: 'No hay un sueldo definido para el dueño.', rapida: 'Cuenta separada y sueldo fijo del dueño desde el próximo mes.', taller: 'Orden contable con el contador.', quien: 'partner' },

    // RETENCIÓN
    { id: 'RET-01', g: 3, nombre: 'Sin datos de clientes', sintoma: 'No tiene teléfono ni correo de quienes ya compraron, o los tiene y nunca les escribe.', causa: 'Nunca se pidió el dato. Cada mes parte de cero buscando clientes nuevos.', rapida: 'Pedir el teléfono en cada compra con una razón (oferta, rifa); lista de difusión de WhatsApp; un mensaje semanal.', taller: 'CRM simple y mensajería automatizada post-venta.', quien: 'influence' },
    { id: 'RET-02', g: 2, nombre: 'Baja recompra', sintoma: 'Menos de un cuarto de las ventas del mes son de clientes que ya habían comprado.', causa: 'No hay motivo ni recordatorio para volver.', rapida: 'Oferta exclusiva para clientes anteriores; mensaje a los 30 días de la compra.', taller: 'Programa de fidelización y contenido para clientes actuales.', quien: 'influence' },
    { id: 'RET-03', g: 2, nombre: 'Silencio post-venta', sintoma: 'Después de comprar no pasa nada: ni gracias, ni reseña, ni siguiente paso.', causa: 'El proceso termina en el cobro.', rapida: 'Mensaje post-compra con agradecimiento, QR de reseña y qué viene después.', taller: 'Secuencia post-venta automatizada.', quien: 'influence' },
    { id: 'RET-04', g: 1, nombre: 'Reseñas sin responder', sintoma: 'Reseñas de Google, buenas y malas, sin respuesta.', causa: 'Nadie las mira.', rapida: 'Responder todas las de los últimos 3 meses esta semana; regla de 48 horas.', taller: 'Gestión de reputación dentro del community management.', quien: 'influence' },
    { id: 'RET-05', g: 1, nombre: 'Sin motivo para volver', sintoma: 'Sin puntos, sin tarjeta, sin "la próxima te damos…".', causa: 'Se asume que vuelven solos.', rapida: 'Una mecánica simple: la décima gratis, descuento al referido.', taller: 'Programa de fidelización con seguimiento.', quien: 'influence' },

    // PERSONAS Y DUEÑO
    { id: 'PER-01', g: 3, nombre: 'Depende del dueño', sintoma: 'Si el dueño falta una semana, el negocio se para o se cae.', causa: 'Todo el conocimiento y todas las decisiones pasan por una persona.', rapida: 'Sacarle una tarea completa este mes (redes, WhatsApp, cobranza) con un responsable y un procedimiento escrito.', taller: 'Procesos escritos y un encargado por área.', quien: 'influence' },
    { id: 'PER-02', g: 2, nombre: 'Dueño apagando incendios', sintoma: 'Más de 15 horas a la semana resolviendo urgencias en vez de mejorar el negocio.', causa: 'Los incendios son síntomas de otros códigos (OPE, CON) que nadie arregla de raíz.', rapida: 'Anotar una semana de incendios y arreglar la causa del más repetido.', taller: 'Radiografía de proceso.', quien: 'influence' },
    { id: 'PER-03', g: 2, nombre: 'Rotación alta', sintoma: 'La misma vacante publicada varias veces en el año; "les enseño y se van".', causa: 'Sin inducción, sin claridad de cargo, sin incentivo ligado a resultados.', rapida: 'Descripción de cargo de una página y una semana de inducción con checklist.', taller: 'Selección e incentivos con un partner de RRHH.', quien: 'partner' },
    { id: 'PER-04', g: 1, nombre: 'Redes de madrugada', sintoma: 'El dueño responde Instagram a la 1 de la mañana y publica cuando puede.', causa: 'Marketing es la tarea que siempre queda para el final del día.', rapida: 'Horario fijo de 30 minutos diarios o delegar el canal completo.', taller: 'Community management externo.', quien: 'influence' },
    { id: 'PER-05', g: 1, nombre: 'Sin procesos escritos', sintoma: 'Nada está escrito; cada uno hace las cosas como las aprendió.', causa: 'Nunca hubo tiempo de escribirlo.', rapida: 'Escribir el proceso más repetido en 10 pasos, con fotos, esta semana.', taller: 'Manual operativo por área.', quien: 'dueño' },

    // DATOS Y CONTROL
    { id: 'DAT-01', g: 3, nombre: 'Venta de la semana desconocida', sintoma: 'No puede decir cuánto vendió la semana pasada en 10 segundos.', causa: 'No hay registro diario. Sin este número, todos los otros códigos son invisibles hasta que duelen.', rapida: 'Cinco números cada lunes en una planilla: ventas, clientes nuevos, consultas, cierres, caja.', taller: 'Punto de venta con reporte semanal.', quien: 'partner' },
    { id: 'DAT-02', g: 2, nombre: 'Marketing sin medir', sintoma: 'No sabe cuánto cuesta conseguir un cliente ni qué canal lo trajo.', causa: 'Sin medición, se corta lo que funciona y se insiste en lo que no.', rapida: 'Preguntar "¿cómo llegaste?" en cada venta y anotarlo; un link distinto por canal.', taller: 'Medición de origen y costo por cliente en todas las campañas.', quien: 'influence' },
    { id: 'DAT-03', g: 2, nombre: 'Sin registro de ventas', sintoma: 'Boleta manual, calculadora, sin punto de venta ni planilla.', causa: 'Se decidió "a ojo" desde el principio y nunca se cambió.', rapida: 'Planilla diaria de ventas por categoría, 5 minutos al cierre.', taller: 'Punto de venta con inventario.', quien: 'partner' },
    { id: 'DAT-04', g: 1, nombre: 'No pregunta de dónde llegan', sintoma: 'Nunca se le pregunta al cliente nuevo cómo conoció el negocio.', causa: 'No se consideró un dato.', rapida: 'Una pregunta en caja durante un mes.', taller: 'Origen registrado en el CRM.', quien: 'dueño' },
    { id: 'DAT-05', g: 1, nombre: 'Web sin sensores', sintoma: 'La web no tiene píxel de Meta ni Google Analytics.', causa: 'Se hizo la web y nadie la instrumentó.', rapida: 'Instalar píxel y analytics; medir WhatsApp y formulario como conversiones.', taller: 'Medición completa de la web y de las campañas.', quien: 'influence' }
  ];

  // Preguntas al dueño (escaneo rápido). s = índice del sistema. Cada opción dispara códigos (puede ser ninguno).
  var PREGUNTAS = [
    { s: 0, t: '¿De dónde llegan tus clientes nuevos?', o: ['De varios canales, y sé cuánto trae cada uno', 'Casi todo es boca a boca o gente que pasa', 'No lo sé, o cada vez llegan menos'], c: [[], ['CAP-02'], ['CAP-02', 'CAP-05']] },
    { s: 0, t: 'Si alguien busca en Google tu rubro y tu comuna, ¿apareces?', o: ['Sí, con fotos y reseñas recientes', 'Aparezco, pero el perfil está incompleto', 'No aparezco, o nunca lo he revisado'], c: [[], ['CAP-01'], ['CAP-01']] },
    { s: 1, t: 'Cuando te escriben por WhatsApp o Instagram en hora punta, ¿cuánto demoras en responder?', o: ['Menos de 15 minutos', 'Entre 15 minutos y 2 horas', 'Más de 2 horas, o cuando puedo'], c: [[], ['CON-01'], ['CON-01']] },
    { s: 1, t: 'De cada 10 personas que preguntan precio, ¿cuántas terminan comprando?', o: ['4 o más', 'Entre 2 y 3', '1 o ninguna, o no lo sé'], c: [[], ['CON-02'], ['CON-02', 'CON-03']] },
    { s: 2, t: '¿Sabes cuánto te deja cada producto o servicio después de todos los costos?', o: ['Sí, lo tengo calculado', 'Más o menos, a ojo', 'No'], c: [[], ['MAR-01'], ['MAR-01', 'MAR-03']] },
    { s: 2, t: '¿Cuándo subiste precios por última vez?', o: ['Hace menos de un año, con cálculo', 'Hace más de un año', 'No me atrevo a subirlos'], c: [[], ['MAR-02'], ['MAR-02', 'MAR-04']] },
    { s: 3, t: 'En una semana normal, ¿cuántos pedidos o atenciones salen mal o atrasados?', o: ['Casi ninguno', 'Algunos, se arreglan sobre la marcha', 'Varios, es parte del día a día'], c: [[], ['OPE-02'], ['OPE-02']] },
    { s: 3, t: '¿Dónde se anotan los pedidos y las tareas del día?', o: ['En un sistema o app que todos ven', 'Cuaderno, Excel o WhatsApp', 'En la cabeza de alguien'], c: [[], ['OPE-01'], ['OPE-01']] },
    { s: 4, t: '¿Cuánta plata te deben hoy tus clientes (fiado, facturas por cobrar)?', o: ['Nada o muy poco, y controlado', 'Algo, pero sé cuánto y de quién', 'Harto, o no sé exactamente cuánto'], c: [[], ['CAJ-04'], ['CAJ-01']] },
    { s: 4, t: '¿Aceptas tarjeta y transferencia sin monto mínimo?', o: ['Sí, todos los medios de pago', 'Sí, pero con mínimo o recargo', 'Solo efectivo, o transferencia a mano'], c: [[], ['CAJ-02'], ['CAJ-02']] },
    { s: 5, t: '¿Tienes el teléfono o correo de tus clientes y les escribes?', o: ['Sí, y les escribo con regularidad', 'Tengo algunos, pero no les escribo', 'No tengo sus datos'], c: [[], ['RET-01', 'RET-03'], ['RET-01']] },
    { s: 5, t: 'De tus ventas del mes, ¿qué parte viene de clientes que ya habían comprado antes?', o: ['Más de la mitad', 'Entre un cuarto y la mitad', 'Menos de un cuarto, o no lo sé'], c: [[], ['RET-05'], ['RET-02']] },
    { s: 6, t: 'Si te enfermas una semana, ¿qué pasa con el negocio?', o: ['Sigue funcionando igual', 'Funciona a medias', 'Se para, o se cae'], c: [[], ['PER-05'], ['PER-01']] },
    { s: 6, t: '¿Cuántas horas a la semana se te van apagando incendios en vez de mejorar el negocio?', o: ['Menos de 5', 'Entre 5 y 15', 'Más de 15'], c: [[], [], ['PER-02']] },
    { s: 7, t: '¿Cuánto vendiste la semana pasada?', o: ['Lo sé exacto, ahora mismo', 'Lo puedo calcular en un rato', 'No lo sé'], c: [[], ['DAT-03'], ['DAT-01']] },
    { s: 7, t: '¿Mides qué te trae cada peso que gastas en publicidad o promociones?', o: ['Sí, sé cuánto cuesta cada cliente', 'A veces, a ojo', 'No, o no hago publicidad'], c: [[], ['DAT-02'], ['DAT-02', 'DAT-04']] }
  ];

  // Señales observadas desde afuera (modo taller). Cada una dispara códigos. Ver 02-senales-desde-afuera.md.
  var SENALES = [
    { grupo: 'Google Maps', items: [
      { id: 'g1', t: 'No aparece al buscar rubro + comuna, o el perfil no está reclamado', c: ['CAP-01'] },
      { id: 'g2', t: 'Reseñas que repiten demora, errores o que no contestan', c: ['OPE-05'] },
      { id: 'g3', t: 'Reseñas sin responder (buenas o malas)', c: ['RET-04'] },
      { id: 'g4', t: 'Menos de 10 reseñas o la última hace más de 3 meses', c: ['CON-04'] },
      { id: 'g5', t: 'Horario cargado distinto al real', c: ['OPE-02'] }
    ] },
    { grupo: 'Instagram', items: [
      { id: 'i1', t: 'Más de 30 días sin publicar', c: ['CAP-03'] },
      { id: 'i2', t: 'La bio no dice qué vende, dónde ni cómo comprar', c: ['CAP-03'] },
      { id: 'i3', t: 'Comentarios con "¿precio?" sin responder', c: ['CON-02', 'CON-05'] },
      { id: 'i4', t: 'Responde de madrugada (lo hace el dueño)', c: ['PER-04'] },
      { id: 'i5', t: 'Solo contenido para captar, nada para clientes actuales', c: ['RET-05'] }
    ] },
    { grupo: 'Web', items: [
      { id: 'w1', t: 'No se puede comprar, reservar ni cotizar en 2 toques', c: ['CON-03'] },
      { id: 'w2', t: 'Sin precios ni rangos', c: ['CON-05'] },
      { id: 'w3', t: 'Sin píxel de Meta ni Google Analytics', c: ['DAT-05'] },
      { id: 'w4', t: 'Abandonada: pie de página o novedades de hace más de un año', c: ['CAP-03'] }
    ] },
    { grupo: 'Meta Ads y empleo', items: [
      { id: 'a1', t: 'Un post promocionado sin landing ni llamado a la acción', c: ['CAP-04'] },
      { id: 'a2', t: 'La misma vacante operativa publicada 2 o más veces en el año', c: ['PER-03'] }
    ] },
    { grupo: 'Comprador misterioso', items: [
      { id: 'm1', t: 'Respondió en más de 2 horas (o no respondió)', c: ['CON-01'] },
      { id: 'm2', t: 'No dio precio ni rango', c: ['CON-05'] },
      { id: 'm3', t: 'No propuso un siguiente paso (link, hora, dirección)', c: ['CON-03'] },
      { id: 'm4', t: 'No hizo seguimiento al día siguiente', c: ['CON-02'] }
    ] },
    { grupo: 'Visita al local', items: [
      { id: 'v1', t: 'Solo efectivo, o mínimo de compra con tarjeta', c: ['CAJ-02'] },
      { id: 'v2', t: 'Cuaderno de fiado a la vista', c: ['CAJ-01'] },
      { id: 'v3', t: '"No hay" en productos básicos', c: ['OPE-03'] },
      { id: 'v4', t: 'Fila en hora punta con una sola caja', c: ['OPE-04'] },
      { id: 'v5', t: 'Bodega o vitrina llena de lo que no rota; oferta permanente', c: ['CAJ-03', 'MAR-04'] },
      { id: 'v6', t: 'No piden ningún dato ni reseña al comprar', c: ['RET-01', 'RET-03'] },
      { id: 'v7', t: 'El dueño está en caja, cocina y teléfono a la vez', c: ['PER-01'] },
      { id: 'v8', t: 'Carta o catálogo plano, sin producto destacado ni combos', c: ['MAR-03', 'MAR-05'] },
      { id: 'v9', t: 'El dueño saca plata de la caja para gastos personales; no tiene sueldo fijo', c: ['CAJ-05'] }
    ] }
  ];

  var porId = {};
  CODIGOS.forEach(function (c) { c.sistema = c.id.slice(0, 3); porId[c.id] = c; });

  // Catálogo de soluciones. Cada una repara varios códigos. esfuerzo: 1 = esta semana, 2 = 2 a 4 semanas, 3 = 1 a 3 meses.
  // El escáner las ordena de la mejor a la peor para el negocio escaneado (ver rankearSoluciones).
  var SOLUCIONES = [
    { id: 'S01', nombre: 'Perfil de Google completo y 10 reseñas', esfuerzo: 1, costo: 'Gratis', quien: 'dueño',
      que: 'Reclamar el perfil, fotos reales, horario, categoría, botón de WhatsApp; QR de reseñas en el mesón y en el mensaje post-venta; responder todas las reseñas.',
      resultado: 'Aparecer cuando buscan el rubro en la comuna y tener prueba social en 2 semanas.', codigos: ['CAP-01', 'CON-04', 'RET-04', 'CAP-05'] },
    { id: 'S02', nombre: 'Flujo de WhatsApp que responde y hace seguimiento', esfuerzo: 1, costo: 'Bajo', quien: 'influence',
      que: 'WhatsApp Business con respuesta automática inmediata, respuestas rápidas con precio y siguiente paso, catálogo, regla de 15 minutos en horario y mensaje de seguimiento fijo a las 48 horas.',
      resultado: 'Cerrar las consultas que hoy se pierden por demora o silencio.', codigos: ['CON-01', 'CON-02', 'CON-03', 'CON-05', 'PER-04'] },
    { id: 'S03', nombre: 'Aceptar todos los medios de pago', esfuerzo: 1, costo: 'Bajo', quien: 'dueño',
      que: 'Máquina de tarjeta y QR de transferencia en el mesón, sin mínimo ni recargo; cartel nuevo; anunciarlo en el barrio y en redes.',
      resultado: 'Dejar de perder la venta completa del que no anda con efectivo.', codigos: ['CAJ-02'] },
    { id: 'S04', nombre: 'Lista de clientes y un mensaje semanal', esfuerzo: 1, costo: 'Bajo', quien: 'influence',
      que: 'Pedir el teléfono en cada compra con una razón; lista de difusión de WhatsApp; un mensaje a la semana con oferta para clientes anteriores; mensaje post-compra con gracias y reseña; una mecánica simple para volver.',
      resultado: 'Que los que ya compraron vuelvan sin gastar en captación.', codigos: ['RET-01', 'RET-02', 'RET-03', 'RET-05', 'CAP-02'] },
    { id: 'S05', nombre: 'Tablero de 5 números cada lunes', esfuerzo: 1, costo: 'Gratis', quien: 'dueño',
      que: 'Planilla con ventas, clientes nuevos, consultas, cierres y caja, 10 minutos a la semana; preguntar "¿cómo llegaste?" en cada venta; un link distinto por canal.',
      resultado: 'Ver las fugas antes de que duelan y saber qué canal trae clientes.', codigos: ['DAT-01', 'DAT-02', 'DAT-03', 'DAT-04'] },
    { id: 'S06', nombre: 'Ordenar la caja', esfuerzo: 2, costo: 'Gratis', quien: 'partner',
      que: 'Lista de quién debe cuánto desde cuándo; tope y día de pago por cliente; cobrar lo vencido; liquidar el stock muerto con una promoción; anticipo en pedidos grandes; cuenta separada y sueldo fijo del dueño.',
      resultado: 'Que la plata de las ventas esté en la cuenta y no en el cuaderno ni en la bodega.', codigos: ['CAJ-01', 'CAJ-03', 'CAJ-04', 'CAJ-05'] },
    { id: 'S07', nombre: 'Un solo lugar para los pedidos', esfuerzo: 2, costo: 'Bajo', quien: 'influence',
      que: 'Planilla compartida o formulario de pedidos que llega a un panel o a WhatsApp, con estado; checklist de apertura y cierre; lista fija de reposición semanal con mínimos; responder las reseñas que reclaman demora y arreglar la causa más repetida.',
      resultado: 'Menos pedidos perdidos, atrasados o con error cada semana.', codigos: ['OPE-01', 'OPE-02', 'OPE-03', 'OPE-05'] },
    { id: 'S08', nombre: 'Costeo, precios y carta con destacados', esfuerzo: 2, costo: 'Bajo', quien: 'partner',
      que: 'Costear los 5 productos más vendidos; subir 5 a 8% en lo que el cliente no compara; destacar los 3 de mayor margen en la carta o catálogo; un combo y una pregunta fija en caja; descuentos solo a cambio de algo.',
      resultado: 'Que quede más plata de las mismas ventas.', codigos: ['MAR-01', 'MAR-02', 'MAR-03', 'MAR-04', 'MAR-05'] },
    { id: 'S09', nombre: 'Presencia constante en redes con sistema', esfuerzo: 2, costo: 'Medio', quien: 'influence',
      que: 'Bio y destacadas que digan qué, dónde y cómo comprar; calendario mensual; 3 publicaciones por semana; community management que responde en el día. Plan Presencia o Crecimiento.',
      resultado: 'Un segundo canal de clientes nuevos que no depende del dueño.', codigos: ['CAP-03', 'CAP-02', 'PER-04', 'CAP-05'] },
    { id: 'S10', nombre: 'Campaña de captación medida', esfuerzo: 2, costo: 'Medio', quien: 'influence',
      que: 'Una campaña en Meta con un objetivo, un público y un mensaje; landing o WhatsApp como destino; píxel y analytics instalados; costo por consulta medido cada semana.',
      resultado: 'Saber cuánto cuesta cada cliente nuevo y comprar más de los que convienen.', codigos: ['CAP-04', 'CAP-05', 'DAT-02', 'DAT-05'] },
    { id: 'S11', nombre: 'Landing, tienda online o agenda online', esfuerzo: 3, costo: 'Medio', quien: 'influence',
      que: 'Una página con prueba social, precios y un solo botón; o tienda con catálogo, carrito y pago; o agenda online. Link en la bio y en Google.',
      resultado: 'Que se pueda comprar o reservar sin llamar y sin esperar un DM.', codigos: ['CON-03', 'CON-05', 'CON-04', 'OPE-01', 'CAJ-02'] },
    { id: 'S12', nombre: 'Delegar un área completa con procedimiento', esfuerzo: 2, costo: 'Medio', quien: 'influence',
      que: 'Elegir la tarea que más horas quita al dueño y no necesita que sea él (redes, WhatsApp, cobranza); escribirla en 10 pasos; asignar un responsable interno o externo; revisar una vez por semana.',
      resultado: 'Que el negocio funcione una semana sin el dueño y que él recupere horas para pensar.', codigos: ['PER-01', 'PER-02', 'PER-04', 'PER-05'] },
    { id: 'S13', nombre: 'Radiografía de proceso y refuerzo en hora punta', esfuerzo: 2, costo: 'Bajo', quien: 'influence',
      que: 'Mapear el proceso que más duele paso a paso (proceso/index.html), encontrar el paso que no da abasto, liberarlo con las 4 jugadas; refuerzo en las 2 horas punta; pedidos anticipados por WhatsApp.',
      resultado: 'Saber en qué paso exacto se frena y cuánto cuesta, y destrabarlo sin contratar.', codigos: ['OPE-02', 'OPE-04', 'PER-02'] },
    { id: 'S14', nombre: 'Cargo escrito e inducción de una semana', esfuerzo: 2, costo: 'Bajo', quien: 'partner',
      que: 'Descripción de cargo de una página; checklist de inducción; incentivo simple ligado a ventas o a reseñas.',
      resultado: 'Que la gente nueva rinda en una semana y se quede.', codigos: ['PER-03', 'PER-05'] },
    { id: 'S15', nombre: 'Punto de venta con inventario', esfuerzo: 3, costo: 'Medio', quien: 'partner',
      que: 'Software de caja con stock, reportes de venta por producto y rotación; reposición con mínimos automáticos.',
      resultado: 'Ventas, margen y stock al día sin planillas.', codigos: ['OPE-03', 'CAJ-03', 'DAT-03', 'DAT-01'] }
  ];

  // Ordena las soluciones de la mejor a la peor para un escaneo.
  // detectados: { 'CAP-01': fuentes[] , ... }. Devuelve hasta `max` soluciones con su explicación.
  // Regla: impacto = suma de la gravedad de los códigos detectados que repara (x1.5 si el código
  // está confirmado por 2 o más fuentes); puntaje = impacto x (4 - esfuerzo): lo rápido pesa más.
  // Se eligen de a una, contando solo los códigos que aún no cubre una solución anterior.
  function rankearSoluciones(detectados, max) {
    max = max || 5;
    var cubiertos = {}, out = [];
    var peso = function (id) { return porId[id].g * (detectados[id] && detectados[id].length > 1 ? 1.5 : 1); };
    for (var k = 0; k < max; k++) {
      var mejor = null;
      SOLUCIONES.forEach(function (s) {
        if (out.some(function (o) { return o.s === s; })) return;
        var nuevos = s.codigos.filter(function (id) { return detectados[id] && !cubiertos[id]; });
        if (!nuevos.length) return;
        var impacto = nuevos.reduce(function (a, id) { return a + peso(id); }, 0);
        var puntaje = impacto * (4 - s.esfuerzo);
        if (!mejor || puntaje > mejor.puntaje) mejor = { s: s, nuevos: nuevos, impacto: impacto, puntaje: puntaje, tambien: s.codigos.filter(function (id) { return detectados[id] && cubiertos[id]; }) };
      });
      if (!mejor) break;
      mejor.nuevos.forEach(function (id) { cubiertos[id] = true; });
      out.push(mejor);
    }
    return out;
  }

  return { SISTEMAS: SISTEMAS, CODIGOS: CODIGOS, PREGUNTAS: PREGUNTAS, SENALES: SENALES, SOLUCIONES: SOLUCIONES, porId: porId, rankearSoluciones: rankearSoluciones };
});
