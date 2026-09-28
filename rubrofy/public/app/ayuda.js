// Ayuda contextual: un "?" junto a cada sección o proceso. Al pasar el
// mouse (o tocarlo en el celular, o llegar con Tab) muestra qué es y los
// pasos para hacerlo. Todos los textos viven aquí, en AYUDA.
//
// Uso: en HTML, <button type="button" class="ay" data-ayuda="clave">?</button>
//      en JS,   Ayuda.boton('clave')  → el mismo botón como texto HTML.
// Lo usan el panel, la administración y el sitio (/app/ayuda.js).
(function () {
  'use strict';

  const AYUDA = {
    // ---------- Inicio ----------
    'inicio': { t: 'Inicio', d: 'Tu punto de partida: te dice qué te toca hacer hoy y en qué parte de la ruta vas.',
      p: ['Mira "Qué hacer ahora": son las 3 tareas más urgentes, en orden.', 'Pulsa el botón de cada tarea para ir directo a donde se hace.', 'Revisa "Tu ruta" para ver lo que falta en cada etapa.'] },
    'que-hacer': { t: 'Qué hacer ahora', d: 'Las 3 tareas más importantes según el estado real de tu cuenta.',
      p: ['Empieza por la tarjeta 1 (la rosada): es la más urgente.', 'Pulsa su botón y completa la tarea.', 'Vuelve a Inicio: la lista se actualiza sola.'], n: 'Primero aparece lo que puede hacer que algo no se publique: publicaciones fallidas, Instagram desconectado o contenido que sale pronto sin aprobar.' },
    'ruta': { t: 'Tu ruta en Rubrofy', d: 'Cuatro etapas para aprovechar todo Rubrofy: Configura (una vez), Crea (cada semana), Mide (automático) y Mejora (cada mes).',
      p: ['Toca una etapa para ver sus pasos.', 'Los pasos con ✓ están hechos; los de círculo, pendientes.', 'Los que tienen candado son de otro plan: su botón te lleva a Plan y pago.'] },
    'proximas': { t: 'Próximas publicaciones', d: 'Lo que ya aprobaste y va a salir en Instagram, ordenado por fecha.',
      p: ['Revisa que las fechas te sirvan.', 'Para mover una, ábrela en Por aprobar o en el Calendario y cambia su fecha.'], n: 'Si Instagram no está conectado, lo aprobado queda guardado pero no se publica.' },
    'plan-inicio': { t: 'Tu plan de contenido', d: 'Resumen de tu objetivo, tu tono y cuántas publicaciones quieres por semana.',
      p: ['Pulsa "Cambiar" para editarlo en Estrategia.'] },
    'contadores': { t: 'Pendientes, aprobados y en cola', d: 'Pendientes: esperan tu revisión. Aprobados: ya tienen tu OK y se publicarán en su fecha. En cola: el total de publicaciones que tienes.',
      p: ['Pulsa "Por aprobar" en el menú para revisar las pendientes.'] },
    'generar-semana': { t: 'Generar semana', d: 'Crea las publicaciones de la próxima semana con la mezcla de tu plan (cuántos posts, carruseles, reels e historias).',
      p: ['Pulsa "+ Generar semana".', 'Revisa cuántas se van a crear y pulsa "Generar".', 'Llegan a Por aprobar con fecha, después de lo que ya tienes programado.'], n: 'Se crean hasta 12 por vez. Para cambiar la mezcla, usa "Cambiar mi plan".' },

    // ---------- Estrategia ----------
    'estrategia': { t: 'Estrategia', d: 'Todo lo que Rubrofy usa para escribir por ti: qué quieres lograr, cómo suenas, de qué hablas y cuánto publicas.',
      p: ['Revisa el resumen, el tono y los enfoques.', 'Ajusta tu negocio, objetivo y cuánto publicar.', 'Guarda cada parte con su botón.'] },
    'estrategia-editar': { t: 'Tu estrategia', d: 'El resumen, el tono de voz y los temas (enfoques) que se van turnando en tus publicaciones.',
      p: ['Edita el resumen y el tono con tus palabras.', 'Cambia, agrega o quita enfoques.', 'Pulsa "Guardar estrategia".', 'Si quieres otra idea, pulsa "Proponer otra con IA" (reemplaza lo que ves; revísala y guarda).'] },
    'enfoques': { t: 'Enfoques de contenido', d: 'Los temas que se van turnando, por ejemplo "Precio y promociones" o "Detrás de escena". Cada publicación usa uno.',
      p: ['Nombre: corto, para reconocerlo.', 'Qué transmite: lo que debe contar ese tipo de publicación.', 'Foto: la categoría de tus fotos que usa.', '"+ Agregar enfoque" suma uno; la × lo quita.'], n: 'Entre 4 y 6 enfoques suele funcionar bien. Rubrofy repite más los que mejor te funcionan.' },
    'negocio-objetivo': { t: 'Tu negocio y objetivo', d: 'Datos reales que se usan en los textos y lo que quieres lograr con Instagram.',
      p: ['Completa precio, producto destacado y promoción (solo lo que sea verdad hoy).', 'Escribe a quién le hablas y qué te hace distinto.', 'Elige uno o dos objetivos y tu tono.', 'Pulsa "Guardar plan".'], n: 'Si un texto menciona un precio o descuento que no está aquí, Rubrofy te lo marca antes de aprobar.' },
    'cuanto-publicar': { t: 'Cuánto publicar', d: 'Cuántos posts, carruseles, reels e historias quieres por semana, y a qué hora salen los posts.',
      p: ['Elige un ritmo sugerido (Básico, Recomendado o Intensivo) o ajusta con − y +.', 'Elige la hora de los posts (las historias salen a las 18:30).', 'Pulsa "Guardar plan". "Generar semana" usará esta mezcla.'] },

    // ---------- Por aprobar ----------
    'cola': { t: 'Por aprobar', d: 'Aquí revisas cada publicación antes de que salga. Nada se publica sin tu aprobación.',
      p: ['Lee el texto y la idea de qué foto o video usar.', 'Si está bien, pulsa "Aprobar": queda programada en su fecha.', 'Si no, pulsa "Otra versión" o "Editar" para cambiar el texto.', 'Si te equivocaste, "Deshacer" la devuelve a pendiente.'] },
    'pieza-acciones': { t: 'Qué hace cada botón', d: '',
      p: ['Aprobar: queda programada y se publica sola en su fecha.', 'Otra versión: la IA escribe un texto distinto con el mismo enfoque.', 'Pedir cambio: le dices a la IA qué cambiar ("más corto", "menciona el despacho") y escribe otra versión.', 'Editar: cambias el texto a mano (Rubrofy aprende de tus cambios).', 'Generar foto con IA: crea una imagen si no tienes foto (plan Estudio).', 'Publicar ahora: la saca de inmediato, sin esperar su fecha.', 'Deshacer: vuelve a pendiente mientras no se haya publicado.', '×: la rechazas y no se publicará.', 'Reintentar: si falló, la vuelve a intentar después de corregir lo que faltaba.'] },
    'pieza-formato': { t: 'Formato, fecha y video', d: 'Cada pieza es un post, carrusel, reel o historia, con su fecha y hora.',
      p: ['Cambia el formato con el selector.', 'Para cambiar el día o la hora, pulsa la fecha de la tarjeta, elige otra y guarda.', 'Reel: sube el video (obligatorio), vertical 9:16, MP4, o generarlo con IA (plan Estudio).', 'Historia: el video es opcional; sin video usa una foto.', 'Carrusel: necesita al menos 2 fotos en su categoría.'] },
    'pieza-fecha': { t: 'Cambiar la fecha', d: 'Cada pieza tiene fecha y hora de publicación.',
      p: ['Pulsa la fecha de la tarjeta (debajo del enfoque).', 'Elige el nuevo día y hora.', 'Guarda. Si ya estaba aprobada, se reprograma sola.'] },
    'alertas': { t: 'Revisa antes de aprobar', d: 'Rubrofy marca frases delicadas: promesas ("garantizado"), precios, descuentos o fechas que no están en tus datos.',
      p: ['Lee la alerta.', 'Corrige el texto con "Editar", o actualiza tus datos en Estrategia si el precio es real.', 'La alerta desaparece cuando el texto calza con tus datos.'] },

    // ---------- Calendario y fotos ----------
    'calendario': { t: 'Calendario', d: 'Tus publicaciones del mes ubicadas en su día y hora.',
      p: ['Pulsa una publicación para ver su detalle a la derecha.', 'Colores: verde aprobada, rosado pendiente, rojo rechazada.', 'Para mover una fecha, hazlo desde la tarjeta en Por aprobar.'] },
    'fotos': { t: 'Fotos del negocio', d: 'Tus fotos reales, ordenadas por categoría. Cada publicación usa una foto de su categoría.',
      p: ['Busca la categoría (por ejemplo "producto" o "local").', 'Pulsa "+ Subir" y elige la imagen (JPG, PNG o WEBP).', 'Sube varias por categoría: Rubrofy las va alternando.', 'Para quitar una, usa la × sobre la foto.'], n: 'Los carruseles necesitan al menos 2 fotos en su categoría.' },

    // ---------- Mi estilo ----------
    'estilo': { t: 'Mi estilo', d: 'Muéstrale a Rubrofy lo que ya publicas para que escriba como tú y use tu mezcla de formatos.',
      p: ['Pulsa "Importar mis publicaciones de Instagram", o agrégalas una por una.', 'Llega a 5 ejemplos o más.', 'Pulsa "Analizar mi estilo con IA" para crear tu guía (planes Pro y Estudio).'] },
    'estilo-guia': { t: 'Tu guía de estilo', d: 'El resumen de cómo escribes: tono, temas y cómo usas cada formato. Se usa en cada texto nuevo.',
      p: ['Léela y corrige lo que no te represente.', 'Pulsa "Guardar guía".', 'Vuelve a analizar cuando agregues ejemplos nuevos.'] },
    'estilo-agregar': { t: 'Agregar un ejemplo', d: 'Una publicación tuya que te guste, para que Rubrofy aprenda de ella.',
      p: ['Elige el formato (post, carrusel, reel o historia).', 'Pega el texto que usaste.', 'Opcional: sube una captura y anota qué te gusta de ella.', 'Pulsa "Agregar ejemplo".'] },
    'estilo-ejemplos': { t: 'Tus ejemplos', d: 'Lo que Rubrofy usa para aprender tu estilo y tu mezcla de formatos.',
      p: ['Revisa que sean publicaciones que te representen.', 'Pulsa "Quitar" en las que no quieras que imite.'] },

    // ---------- Resultados ----------
    'resultados': { t: 'Resultados', d: 'Cómo le va a tu Instagram y qué te funciona. Se actualiza solo cada 12 horas.',
      p: ['Elige el periodo: 7, 30 o 90 días.', 'Mira los números de arriba y los gráficos.', 'Revisa "Qué enfoques funcionan" y "Cuándo publicar".', 'Pulsa "Informe mensual" para el resumen del mes.'], n: 'Necesita Instagram conectado (plan Pro o Estudio).' },
    'res-numeros': { t: 'Los números', d: 'Seguidores: cuántos tienes y cuánto cambió. Alcance: cuentas que vieron tus publicaciones. Interacciones: me gusta, comentarios, guardados y compartidos. Tasa de interacción: interacciones sobre alcance. Aprobado sin cambios: cuánto aprobaste sin editar (sube cuando la IA escribe como tú).' },
    'res-graficos': { t: 'Gráficos diarios', d: 'Cómo cambió el alcance o las interacciones cada día del periodo.',
      p: ['Pasa el mouse sobre el gráfico para ver el valor de cada día.'] },
    'res-enfoques': { t: 'Qué enfoques funcionan', d: 'Interacciones promedio por publicación según el tema con que la escribió Rubrofy. El primero es el que mejor te funciona.',
      p: ['Mira cuál rinde más.', 'Rubrofy ya lo repite más seguido; si quieres, súmale enfoques parecidos en Estrategia.'] },
    'res-horario': { t: 'Cuándo publicar', d: 'Qué día y franja horaria logran más interacción. Más intenso = mejor.',
      p: ['Busca la celda más intensa.', 'Rubrofy ya programa tus posts a esa hora; puedes cambiarla en Estrategia.'] },
    'res-mejores': { t: 'Tus mejores publicaciones', d: 'Las publicaciones del periodo con más interacción.',
      p: ['Mira qué tienen en común (tema, formato, foto).', 'Agrégalas a Mi estilo para que Rubrofy aprenda de ellas.'] },
    'informe': { t: 'Informe mensual', d: 'Un resumen del mes con resultados, qué funcionó y una conclusión escrita, listo para imprimir o compartir.',
      p: ['Elige el mes.', 'Pulsa "Generar conclusión" si aún no la tiene.', 'Imprímelo o guárdalo en PDF, o copia el enlace para compartirlo.'] },

    // ---------- Publicidad y competencia ----------
    'publicidad': { t: 'Publicidad', d: 'Tus campañas de Meta Ads o Google Ads: cuánto inviertes, qué obtienes y cuánto cuesta cada resultado.',
      p: ['Conecta tu cuenta publicitaria en Conexiones y ajustes (plan Estudio).', 'Elige la pestaña Meta Ads o Google Ads.', 'Mira los totales y la tabla de campañas.'] },
    'ads-numeros': { t: 'Los números de publicidad', d: 'Inversión: lo que gastaste. Resultados: el objetivo de la campaña (mensajes, compras, clics…). Costo por resultado: inversión ÷ resultados, mientras más bajo mejor. CTR: porcentaje de gente que hizo clic. CPC: costo por clic. ROAS: ventas atribuidas ÷ inversión.' },
    'campanas': { t: 'Campañas', d: 'Cada campaña con su inversión, resultados y costo por resultado.',
      p: ['Compara el costo por resultado entre campañas.', 'Pasa más presupuesto a la que consigue resultados más baratos (en Meta o Google).'] },
    'admin-costos': { t: 'Costo de IA', d: 'Lo que pagas a los proveedores de IA (Claude, Higgsfield u OpenAI) por lo que usan tus clientes, comparado con lo que pagan sus planes.',
      p: ['Mira el margen: bajo 60 % conviene revisar cupos o precios.', 'En "Por negocio" ves quién gasta más y si su plan lo cubre.', 'La proyección estima el gasto del mes completo al ritmo actual.'], n: 'Los textos usan los tokens reales; imágenes y videos, una tarifa estimada por unidad.' },
    'admin-ia': { t: 'IA de la plataforma', d: 'Qué proveedores de IA están activos y las reglas de calidad que se aplican a todos los negocios, por sección.',
      p: ['Escribe la regla en la sección que corresponda.', 'Pulsa "Guardar reglas".', 'Se aplica desde el próximo pedido a la IA de cualquier negocio.'], n: 'Los negocios ven estas reglas en su Contexto para la IA.' },
    'reels-prueba': { t: 'Reels de prueba', d: 'Un Reel de prueba se muestra primero solo a personas que no te siguen. Rubrofy detecta tus Reels que funcionaron mucho mejor que el resto y los vuelve a publicar así, con un texto pensado para quien no te conoce, para llegar a público nuevo.',
      p: ['En Resultados, mira "Reels para volver a probar".', 'Pulsa "Enviar a Reel de prueba": queda en Por aprobar con el mismo video.', 'Revisa el texto y apruébalo; se publica en su fecha.', 'Elige si Instagram lo comparte con tus seguidores cuando le va bien, o si lo decides tú en la app.'],
      n: 'Con la opción automática, el Reel más destacado llega solo a Por aprobar (máximo uno por semana). Instagram habilita los Reels de prueba solo en algunas cuentas profesionales; si la tuya no puede, la pieza queda marcada con el motivo.' },
    'notificaciones': { t: 'Notificaciones', d: 'Avisos en este celular o computador: cuando se publica algo, si una publicación falla o Instagram se desconecta, cuando un video con IA o un Reel de prueba está listo, y cada lunes lo que tienes por aprobar.',
      p: ['Pulsa "Activar notificaciones" y acepta el permiso.', 'Repite en cada dispositivo donde quieras recibirlas.', 'Para dejar de recibirlas en uno, pulsa "Desactivar en este dispositivo".'], n: 'En iPhone, primero instala Rubrofy en tu pantalla de inicio (iOS 16.4 o superior).' },
    'perfil': { t: 'Perfil del negocio', d: 'Qué es tu negocio, dónde está, cómo te compran, tus redes, tu web y lo que vendes. La IA lo usa en todo lo que crea para ti.',
      p: ['Escribe qué es tu negocio como se lo contarías a un cliente nuevo.', 'Agrega tus redes y tu web: la IA solo menciona los canales que escribas.', 'Si tienes web, pulsa "Leer mi web con IA" para completar lo que falte.', 'Pulsa "Guardar perfil".'] },
    'bv-venta': { t: 'Lo que vendes', d: 'Tus productos o servicios, tu cliente ideal y por qué te eligen. El precio y la promoción son opcionales: la IA solo menciona los que escribas aquí.' },
    'voz': { t: 'Voz de marca', d: 'La ficha de cómo habla tu marca. La IA la sigue en todo lo que escribe y cada texto recibe un puntaje de fidelidad.',
      p: ['Pulsa "Completar con IA" para una primera propuesta, o llénala tú.', 'Revisa trato, emojis y las palabras que sí y que no usas.', 'Guarda: las piezas por aprobar se puntúan al tiro.', 'Usa "Escribir con mi voz" para cualquier otro texto del negocio.'] },
    'voz-ficha': { t: 'Quién es tu marca', d: 'Lo esencial: qué son, a quién le hablan y 3 a 5 adjetivos de personalidad. Escríbelo como se lo explicarías a alguien nuevo en tu equipo.' },
    'voz-como': { t: 'Cómo habla', d: 'Las reglas que la IA respeta y que se revisan en cada texto: tú o usted, qué español, emojis, largo, palabras propias y prohibidas.',
      p: ['Palabras propias: expresiones que te identifican.', 'Palabras que nunca usa: muletillas o términos que no van con tu marca.', 'Prohibido: promesas que no puedes cumplir o temas delicados.'] },
    'voz-ejemplos': { t: 'Textos que sí suenan a ti', d: 'La forma más rápida de enseñarle tu voz a la IA: textos reales que te encantaron. Imita el estilo sin copiarlos.' },
    'voz-redactor': { t: 'Escribir con mi voz', d: 'Anuncios, correos, mensajes de WhatsApp, fichas de producto, textos para la web o tu bio, siempre con tu voz.',
      p: ['Elige qué necesitas.', 'Cuenta de qué trata, con los datos reales (precio, fecha).', 'Pulsa "Escribir 3 versiones".', 'Copia la que más te guste. Si una suena perfecta, pulsa "Así sí suena" para que la IA aprenda.'], n: 'Cada pedido usa 1 texto con IA de tu plan.' },
    'voz-probar': { t: 'Probar un texto', d: 'Pega cualquier texto y mira qué tan fiel es a tu ficha, con los motivos. Sirve para revisar textos de tu equipo o de otra herramienta. No usa IA.' },
    'voz-puntaje': { t: 'Puntaje de voz', d: 'Qué tan fiel es el texto a tu ficha de voz (0 a 100). Pasa el mouse sobre el número para ver los motivos.',
      p: ['Sobre 85: suena a tu marca.', 'Entre 65 y 85: revisa lo marcado.', 'Bajo 65: usa "Pedir cambio" o edítalo.'] },
    'contexto': { t: 'Contexto para la IA', d: 'Lo que la IA debe saber de tu negocio, por sección. Se suma a tu estrategia y tu voz cada vez que la IA trabaja para ti.',
      p: ['Escribe en "General" lo que vale para todo.', 'Completa solo las secciones que te importen.', 'Pulsa "Guardar".'], n: 'Si algo se contradice, manda lo más específico: la indicación de un pedido, después esto y al final las reglas de la plataforma.' },
    'contexto-general': { t: 'Siempre', d: 'Lo que la IA debe tener en cuenta en todo: qué vendes, qué te diferencia, qué nunca decir, cómo tratar a tus clientes.' },
    'contexto-textos': { t: 'Estrategia y textos', d: 'Estrategia: objetivos del momento, lanzamientos, temporadas. Copys: reglas para todos los textos (largo, hashtags, cómo cerrar).' },
    'contexto-formatos': { t: 'Por formato', d: 'Lo que funciona en cada formato: cómo arman sus carruseles, qué va en el primer segundo de un reel, qué stickers usan en historias.' },
    'contexto-medios': { t: 'Imágenes y videos con IA', d: 'El estilo visual que deben seguir las fotos y videos generados: luz, colores, ambiente, qué evitar.' },
    'indicacion': { t: 'Indicaciones para esta tanda', d: 'Algo puntual para las piezas que vas a generar ahora, sin cambiar tu estrategia. Ej: "esta semana es el aniversario" o "enfócate en las tortas".' },
    'video-ia': { t: 'Video con IA', d: 'Genera un video corto (unos 5 segundos) para el Reel o la historia. Si la pieza tiene foto, la anima; si no, lo crea desde la idea de la pieza.',
      p: ['Pulsa "o generarlo con IA".', 'Espera 1 a 3 minutos: la tarjeta se actualiza sola.', 'Revísalo con "Ver" antes de aprobar.'], n: 'Incluido en el plan Estudio (cupo mensual). Si falla, no se descuenta.' },
    'diagnostico': { t: 'Diagnóstico', d: 'Rubrofy revisa tus campañas y te dice en palabras simples qué está funcionando, qué está gastando de más y qué hacer.',
      p: ['Parte por los puntos con "!": son plata que se está yendo sin resultados.', 'Los "→" son oportunidades: mover presupuesto, cambiar el anuncio o apuntar a otro público.', 'Haz los cambios en Meta o Google Ads y vuelve en 3 o 4 días a ver si el costo bajó.'], n: 'Las flechas de los números comparan con el período anterior del mismo largo.' },
    'ads-anuncios': { t: 'Tus anuncios', d: 'Cada anuncio con su imagen, lo que gastó y lo que consiguió. El borde verde marca el más rentable y el rojo los que gastan sin resultados.',
      p: ['Apaga los anuncios en rojo si ya llevan varios días así.', 'Haz variantes del anuncio en verde: misma idea, otra foto o texto.'] },
    'ads-publico': { t: 'Edad y sexo', d: 'Cuánto te cuesta cada resultado según quién vio el anuncio. Más claro = más barato. Los cuadros vacíos gastaron sin resultados.',
      p: ['Busca el cuadro más claro: es tu público más rentable.', 'En Meta Ads, crea un conjunto de anuncios enfocado en ese grupo.'] },
    'ads-ubicacion': { t: 'Ubicación', d: 'Dónde se mostró tu anuncio (Feed, Historias, Reels, Facebook…) y cuánto costó cada resultado ahí.',
      p: ['Si Reels o Historias salen más baratos, haz piezas verticales pensadas para ese lugar.', 'Puedes excluir ubicaciones caras en la configuración del conjunto de anuncios.'] },
    'comp-conclusiones': { t: 'Lo que hace tu competencia', d: 'Conclusiones automáticas al comparar tu cuenta con las que sigues: formatos, frecuencia, horarios, crecimiento y hashtags.',
      p: ['Lee cada punto y su "Qué hacer".', 'Los cambios de formato y frecuencia se aplican en Estrategia → Tu plan de contenido.'] },
    'comp-tasa': { t: 'Tasa de interacción', d: 'Me gusta + comentarios por publicación dividido por los seguidores. Sirve para comparar una cuenta chica con una grande: mide qué tanto le importa el contenido a su gente.' },
    'comp-crecimiento': { t: 'Crecimiento de seguidores', d: 'Cuánto subió o bajó cada cuenta en los últimos 30 días, en porcentaje. Al empezar a seguir una cuenta se cuenta desde ese día.' },
    'comp-formatos': { t: 'Qué publica cada uno', d: 'La mezcla de videos y reels, carruseles y fotos de sus últimas publicaciones. Pasa el mouse sobre cada tramo para ver la interacción de ese formato.' },
    'comp-top': { t: 'Lo que mejor le funciona a tu competencia', d: 'Sus publicaciones recientes con más interacción por seguidor.',
      p: ['Ábrelas y fíjate en el primer segundo o la primera línea.', 'Mira qué piden al final (comentar, guardar, escribir).', 'Adapta la idea a tu negocio; no copies el texto.'] },
    'comp-hashtags': { t: 'Hashtags', d: 'Los hashtags que más repite cada competidor en sus publicaciones recientes.' },
    'competencia': { t: 'Competencia', d: 'Compara tu Instagram con hasta 5 cuentas: seguidores, frecuencia de publicación e interacción.',
      p: ['Conecta Meta en Conexiones y ajustes, eligiendo tu cuenta de Instagram (plan Estudio).', 'Escribe el @usuario de un competidor y pulsa "Seguir".', 'Para dejar de seguir una cuenta, pulsa "Quitar".', 'Se actualiza solo cada 12 horas.'], n: 'Solo funciona con cuentas profesionales (empresa o creador).' },

    // ---------- Conexiones y ajustes ----------
    'config': { t: 'Conexiones y ajustes', d: 'Donde conectas Instagram y tu publicidad, activas los avisos por correo, actualizas los datos del negocio y administras tu plan.',
      p: ['Usa los botones de arriba para saltar a cada sección.'] },
    'instagram': { t: 'Conectar Instagram', d: 'Con Instagram conectado, lo que apruebas se publica solo, en su fecha y hora.',
      p: ['Tu cuenta debe ser profesional (empresa o creador): Instagram → Configuración → Tipo de cuenta.', 'Pulsa "Conectar con Instagram".', 'Inicia sesión en Instagram y acepta los permisos.', 'Vuelves a Rubrofy ya conectado.'], n: 'Si no ves el botón, conecta pegando el ID y el token (hay una guía en la misma tarjeta).' },
    'meta': { t: 'Conectar Meta (Ads y competencia)', d: 'Lee tus campañas de Meta Ads y, con tu cuenta de Instagram, compara tu competencia (plan Estudio).',
      p: ['Pega un token de Meta con permisos ads_read, pages_show_list, pages_read_engagement e instagram_basic.', 'Pulsa "Buscar mis cuentas".', 'Elige tu cuenta publicitaria y tu cuenta de Instagram.', 'Pulsa "Conectar".'], n: 'Lo más cómodo es un token de "usuario del sistema" de tu Business Manager, que no vence.' },
    'google': { t: 'Conectar Google Ads', d: 'Lee tus campañas de Google Ads junto a tu Instagram (plan Estudio).',
      p: ['Pulsa "Conectar con Google".', 'Inicia sesión con la cuenta que administra tus anuncios y acepta.', 'Si tienes varias cuentas, elige cuál usar.'] },
    'avisos': { t: 'Resumen semanal por correo', d: 'Cada lunes en la mañana te llega un correo con lo que te toca esa semana y lo que se publica en los próximos 7 días.',
      p: ['Marca o desmarca la casilla para activarlo o apagarlo.', 'Pulsa "Enviarme uno ahora" para ver cómo llega.'], n: 'También recibes un aviso si Instagram se desconecta.' },
    'datos': { t: 'Datos del negocio', d: 'Nombre, precios, promoción y producto destacado. Se usan tal cual en tus publicaciones.',
      p: ['Actualiza lo que haya cambiado (sobre todo precios y promociones).', 'Pulsa "Guardar cambios".', 'Rubrofy vuelve a revisar las alertas de lo que aún no se publica.'] },
    'fotos-ia': { t: 'Fotos generadas por IA', d: 'Cuando una pieza no tiene foto real, Rubrofy puede crear una (plan Estudio).',
      p: ['"Foto limpia": imagen sin texto.', '"Con el titular": la imagen lleva el titular escrito.'] },
    'plan-pago': { t: 'Plan y pago', d: 'Tu plan actual y lo que usaste este mes.',
      p: ['Para subir de plan, pulsa "Actualizar a…" y paga con tarjeta.', 'Para cambiar de plan, cancelar o ver tus boletas, pulsa "Gestionar suscripción".'], n: 'Las piezas y fotos con IA se renuevan el día 1 de cada mes.' },
    'eliminar': { t: 'Eliminar negocio', d: 'Borra tu cuenta y todo su contenido, fotos, métricas y conexiones. No se puede deshacer.',
      p: ['Pulsa "Eliminar negocio".', 'Confirma.'], n: 'Si tienes un plan de pago, la suscripción se cancela.' },

    // ---------- Bienvenida ----------
    'bv-negocio': { t: 'Tu negocio', d: 'Lo primero es que Rubrofy te conozca: qué es tu negocio, dónde está, cómo te compran y dónde te encuentran.',
      p: ['Describe tu negocio en una o dos frases.', 'Marca cómo te compran (local, online, WhatsApp…).', 'Agrega tus redes y tu web.', 'Con web y plan Pro o Estudio, "Leer mi web con IA" completa lo que falte.'], n: 'La IA solo menciona las redes y canales que escribas aquí.' },
    'bv-objetivo': { t: 'Objetivo y tono', d: 'Qué quieres lograr y cómo quieres sonar.',
      p: ['Elige uno o dos objetivos.', 'Elige un tono (opcional).', 'Pulsa "Continuar".'] },
    'bv-ritmo': { t: 'Cuánto publicar', d: 'Cuántas publicaciones de cada formato quieres por semana.',
      p: ['Elige un ritmo sugerido o ajusta con − y +.', 'Elige la hora de los posts.', 'Pulsa "Crear mi estrategia".'] },
    'bv-estrategia': { t: 'Tu estrategia', d: 'La IA la armó con lo que contaste. Ajústala a tu gusto.',
      p: ['Revisa el resumen y el tono.', 'Cambia o agrega enfoques.', 'Si no te convence, "Proponer otra con IA".', 'Pulsa "Continuar".'] },
    'bv-conexiones': { t: 'Conexiones', d: 'Instagram es necesario para publicar solo. Meta Ads y Google Ads son opcionales.',
      p: ['Si puedes, pulsa "Conectar ahora" en Instagram.', 'Si no, pulsa "Generar mi primera semana": puedes conectar después en Conexiones y ajustes.'] },

    // ---------- Administración ----------
    'adm-kpis': { t: 'Indicadores', d: 'Negocios: total y nuevos del periodo. Pagan un plan: cuántos y el ingreso mensual (MRR). Activos 7 días: entraron al panel. Visitas: vistas de la portada y cuántas terminan en registro. Publicado: publicaciones y aprobaciones del periodo. Por resolver: publicaciones fallidas e Instagram por reconectar.' },
    'adm-series': { t: 'Gráficos por día', d: 'Visitas a la portada, registros nuevos y publicaciones hechas cada día del periodo. Pasa el mouse para ver cada día.' },
    'adm-embudo': { t: 'Embudo', d: 'Cuántos negocios llegan a cada paso: registro → bienvenida → primera aprobación → Instagram conectado → primera publicación → pago.',
      p: ['Busca el paso donde más se pierden.', 'Pasa el mouse por cada barra para ver el % respecto del paso anterior.'] },
    'adm-etapas': { t: 'Etapa de la ruta', d: 'En qué etapa está hoy cada negocio según su Inicio. Muchos en Configura = les cuesta arrancar.' },
    'adm-planes': { t: 'Planes', d: 'Cuántos negocios hay en cada plan hoy. Los de pago suman el ingreso mensual (MRR) de arriba.' },
    'adm-ia': { t: 'Uso de IA este mes', d: 'Cuántos textos y fotos se generaron con IA este mes entre todos los negocios. Sirve para estimar el costo de Anthropic y OpenAI.' },
    'adm-referentes': { t: 'De dónde llegan', d: 'Desde qué sitios llegan las visitas a la portada (solo el dominio; sin cookies ni IP).' },
    'adm-sistema': { t: 'Sistema', d: 'Qué integraciones están configuradas en Railway. "Falta configurar" = esa función está apagada para todos.',
      p: ['Agrega la variable que falta en Railway → Variables.', 'Railway redespliega solo.'] },
    'adm-negocios': { t: 'Negocios', d: 'Cada cuenta con su plan, fechas, etapa, Instagram y conteos. No muestra textos, fotos ni estrategias.',
      p: ['Busca por nombre o email.', 'Ordena por más nuevos, última actividad, publicaciones o plan.', 'Pulsa "Descargar CSV" para abrirlo en Excel.'] },

    // ---------- Sitio ----------
    'reg-rubro': { t: 'Rubro', d: 'A qué se dedica tu negocio, con tus palabras. Con esto Rubrofy arma tu tono, tus temas y las categorías de tus fotos.',
      p: ['Escribe qué haces y qué vendes, en una o dos frases.', 'Ejemplo: "panadería artesanal de barrio, pan de masa madre y pasteles".'] },
    'precios-comparar': { t: 'Cómo elegir plan', d: 'Pro: estrategia, publicaciones completas (gancho, texto con llamado a la acción y hashtags) que aprenden de ti, resultados e informe mensual. Estudio: todo lo de Pro, fotos y videos con IA, Meta Ads, Google Ads y competencia.',
      p: ['Si vas a hacer publicidad o quieres fotos y videos con IA, elige Estudio. Si no, Pro.', 'Pagas con tarjeta en Stripe; cambias de plan o cancelas desde tu panel cuando quieras.'] },
  };

  const CSS = `
  button.ay.ay{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;
    border:1.5px solid currentColor;background:transparent;color:inherit;opacity:.55;font:700 11px/1 system-ui,sans-serif;
    cursor:help;padding:0;margin-left:6px;vertical-align:middle;flex-shrink:0;transition:opacity .12s,color .12s,border-color .12s}
  button.ay.ay:hover,button.ay.ay:focus-visible,button.ay.ay[aria-expanded="true"]{opacity:1;color:#ff4d94;border-color:#ff4d94;outline:none}
  .ay-pop{position:fixed;z-index:1000;max-width:330px;background:#111014;color:#f6f3f7;border:1px solid #3a3740;border-radius:12px;
    padding:14px 16px;box-shadow:0 18px 50px -12px rgba(0,0,0,.6);font:13px/1.5 'Plus Jakarta Sans',system-ui,sans-serif;text-align:left}
  .ay-pop[hidden]{display:none}
  .ay-pop b.ay-t{display:block;font-size:14px;margin-bottom:4px;color:#fff}
  .ay-pop p{margin:0 0 6px;color:#cfcad3}
  .ay-pop ol{margin:6px 0 0;padding-left:20px;color:#f6f3f7}
  .ay-pop li{margin-bottom:4px}
  .ay-pop li::marker{color:#ff4d94;font-weight:700}
  .ay-pop .ay-n{margin:8px 0 0;padding-top:8px;border-top:1px solid #2e2c33;color:#b3adb8;font-size:12px}
  button.ay.ay{text-decoration:none;font-family:system-ui,sans-serif}
  @media print{.ay,.ay-pop{display:none!important}}`;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function boton(clave) {
    const a = AYUDA[clave];
    if (!a) return '';
    return `<button type="button" class="ay" data-ayuda="${esc(clave)}" aria-label="Ayuda: ${esc(a.t)}" aria-expanded="false">?</button>`;
  }

  let pop = null;
  let actual = null; // botón abierto
  let fijo = false;  // abierto con clic/toque (no se cierra al salir el mouse)
  let timer = null;

  function asegurarPop() {
    if (pop) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    pop = document.createElement('div');
    pop.className = 'ay-pop';
    pop.id = 'ay-pop';
    pop.setAttribute('role', 'dialog');
    pop.hidden = true;
    document.body.appendChild(pop);
    pop.addEventListener('mouseenter', () => clearTimeout(timer));
    pop.addEventListener('mouseleave', () => { if (!fijo) programarCierre(); });
  }

  function abrir(btn, conClic) {
    const a = AYUDA[btn.dataset.ayuda];
    if (!a) return;
    asegurarPop();
    clearTimeout(timer);
    if (actual && actual !== btn) actual.setAttribute('aria-expanded', 'false');
    actual = btn;
    fijo = !!conClic;
    pop.setAttribute('aria-label', a.t);
    pop.innerHTML = `<b class="ay-t">${esc(a.t)}</b>${a.d ? `<p>${esc(a.d)}</p>` : ''}` +
      (a.p && a.p.length ? `<ol>${a.p.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '') +
      (a.n ? `<p class="ay-n">${esc(a.n)}</p>` : '');
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', 'ay-pop');
    posicionar(btn);
  }

  function posicionar(btn) {
    const r = btn.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
    let top = r.bottom + 8;
    if (top + h > vh - 8 && r.top - h - 8 > 8) top = r.top - h - 8; // arriba si no cabe abajo
    pop.style.left = left + 'px';
    pop.style.top = Math.max(8, top) + 'px';
  }

  function cerrar() {
    clearTimeout(timer);
    if (pop) pop.hidden = true;
    if (actual) actual.setAttribute('aria-expanded', 'false');
    actual = null;
    fijo = false;
  }
  function programarCierre() { clearTimeout(timer); timer = setTimeout(cerrar, 180); }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.ay');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (actual === btn && fijo) return cerrar();
      return abrir(btn, true);
    }
    if (pop && !pop.hidden && !e.target.closest('.ay-pop')) cerrar();
  }, true);
  {
    document.addEventListener('mouseover', (e) => {
      const btn = e.target.closest && e.target.closest('.ay');
      if (btn && !fijo) { clearTimeout(timer); timer = setTimeout(() => abrir(btn, false), 120); }
    });
    document.addEventListener('mouseout', (e) => {
      const btn = e.target.closest && e.target.closest('.ay');
      if (btn && !fijo && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.ay-pop'))) programarCierre();
    });
  }
  document.addEventListener('focusin', (e) => {
    const btn = e.target.closest && e.target.closest('.ay');
    if (btn && e.target.matches(':focus-visible')) abrir(btn, false);
  });
  document.addEventListener('focusout', (e) => { if (e.target.closest && e.target.closest('.ay') && !fijo) programarCierre(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pop && !pop.hidden) { const b = actual; cerrar(); if (b) b.focus(); }
  });
  window.addEventListener('scroll', () => { if (actual && pop && !pop.hidden) posicionar(actual); }, true);
  window.addEventListener('resize', () => { if (actual && pop && !pop.hidden) posicionar(actual); });

  window.Ayuda = { boton, textos: AYUDA, cerrar };
})();
