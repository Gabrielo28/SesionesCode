// La ruta del cliente: el camino para aprovechar todo Rubrofy, en cuatro
// etapas. Se calcula con el estado real del negocio para que el Inicio diga
// en qué va, qué le toca ahora y qué desbloquea cada plan.
//
//   1. Configura (una vez)      datos y objetivo, Instagram, fotos, Mi estilo
//   2. Crea cada semana         generar la semana, aprobar, subir videos/fotos
//   3. Mide (automático)        resultados, publicidad, competencia
//   4. Mejora cada mes          leer el informe y ajustar la estrategia
//
// calcular() es pura: recibe todo lo que necesita y no lee la base.

const planContenido = require('./plan-contenido');

const DIA = 86400000;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

function mesSiguiente(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

function nombreMes(mes) {
  return MESES[Number(mes.slice(5, 7)) - 1];
}

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function formatoDe(item) {
  return item.formato || (item.aspect && String(item.aspect).trim().startsWith('9') ? 'historia' : 'post');
}

// Lo que le falta a una pieza para poder publicarse (video o fotos).
function faltaMaterial(item, fotos, hayFotosIA) {
  const f = formatoDe(item);
  const enCategoria = (item.categoriaFoto && fotos[item.categoriaFoto]) || [];
  if (f === 'reel') return item.video ? null : 'reel';
  if (f === 'carrusel') return enCategoria.length >= 2 ? null : 'carrusel';
  if (f === 'historia' && item.video) return null;
  return enCategoria.length || hayFotosIA ? null : 'foto';
}

// input: { negocio, plan, contenido, fotos, referencias, competidores,
//          fotosIA, syncInstagram, mesHoy, ahora }
function calcular(input) {
  const { negocio, plan, contenido, fotos, referencias, competidores, fotosIA, syncInstagram, mesHoy } = input;
  const ahora = input.ahora || Date.now();
  const igOk = !!negocio.instagramConectado && negocio.instagramEstado !== 'reconectar';
  const vivas = contenido.filter((i) => i.status !== 'rechazado' && !(i.publicacion && i.publicacion.estado === 'publicada'));
  const cuando = (i) => Date.parse(i.publicarEl || '') || Infinity;
  const pronto = (i, dias) => cuando(i) <= ahora + dias * DIA;

  // --- 1. Configura ---
  const categorias = (negocio.estrategia && negocio.estrategia.categoriasFoto) || [];
  const conFotos = categorias.filter((c) => (fotos[c] || []).length).length;
  const configura = [
    {
      id: 'bienvenida',
      titulo: 'Cuéntanos de tu negocio y tu objetivo',
      detalle: 'Público, qué te hace distinto, objetivo, tono y cuánto publicar. Con eso la IA arma tu estrategia.',
      estado: negocio.bienvenidaCompletada ? 'hecho' : 'pendiente',
      prioridad: 1,
      accion: negocio.bienvenidaCompletada ? { tipo: 'vista', vista: 'estrategia' } : { tipo: 'bienvenida' },
      boton: 'Empezar',
      botonHecho: 'Ver o cambiar',
    },
    {
      id: 'instagram',
      titulo: negocio.instagramEstado === 'reconectar' ? 'Reconecta Instagram' : 'Conecta Instagram',
      detalle: negocio.instagramEstado === 'reconectar'
        ? 'Tu conexión venció: lo programado espera hasta que reconectes.'
        : 'Para que lo que apruebes se publique solo, en su fecha y hora.',
      estado: igOk ? 'hecho' : 'pendiente',
      prioridad: negocio.instagramEstado === 'reconectar' ? 0 : 2,
      accion: { tipo: 'vista', vista: 'config' },
      boton: negocio.instagramEstado === 'reconectar' ? 'Reconectar' : 'Conectar',
      botonHecho: 'Ver conexión',
    },
    {
      id: 'fotos',
      titulo: 'Sube fotos de tu negocio',
      detalle: categorias.length
        ? `${conFotos} de ${categorias.length} categorías con fotos (${categorias.join(', ')}). Tus publicaciones usan tus fotos reales.`
        : 'Tus publicaciones usan tus fotos reales.',
      estado: categorias.length && conFotos === categorias.length ? 'hecho' : 'pendiente',
      prioridad: 5,
      accion: { tipo: 'vista', vista: 'fotos' },
      boton: 'Subir fotos',
      botonHecho: 'Ver fotos',
    },
    {
      id: 'estilo',
      titulo: 'Muéstrale tu estilo',
      detalle: referencias >= 5
        ? `${referencias} publicaciones tuyas de referencia.`
        : `Sube o importa al menos 5 publicaciones tuyas (llevas ${referencias}) para que escriba como tú y use tu mezcla de formatos.`,
      estado: referencias >= 5 ? 'hecho' : 'pendiente',
      prioridad: 7,
      accion: { tipo: 'vista', vista: 'estilo' },
      boton: 'Ir a Mi estilo',
      botonHecho: 'Ver mi estilo',
    },
  ];

  // --- 2. Crea cada semana ---
  const objetivoSemana = planContenido.totalSemanal(negocio.planContenido) || 3;
  const proximos7 = vivas.filter((i) => cuando(i) >= ahora && pronto(i, 7)).length;
  const pendientes = contenido.filter((i) => i.status === 'pendiente');
  const pendientesUrgentes = pendientes.filter((i) => pronto(i, 3)).length;
  const hayFotosIA = fotosIA > 0;
  const sinMaterial = vivas.filter((i) => pronto(i, 14)).map((i) => ({ i, falta: faltaMaterial(i, fotos, hayFotosIA) })).filter((x) => x.falta);
  const cuenta = (t) => sinMaterial.filter((x) => x.falta === t).length;
  const partesMaterial = [
    cuenta('reel') && plural(cuenta('reel'), 'reel sin video', 'reels sin video'),
    cuenta('carrusel') && plural(cuenta('carrusel'), 'carrusel con menos de 2 fotos', 'carruseles con menos de 2 fotos'),
    cuenta('foto') && plural(cuenta('foto'), 'publicación sin foto', 'publicaciones sin foto'),
  ].filter(Boolean);
  const fallidas = contenido.filter((i) => i.publicacion && i.publicacion.estado === 'fallida');

  const crea = [];
  if (fallidas.length) {
    crea.push({
      id: 'fallidas',
      titulo: `${plural(fallidas.length, 'publicación no se pudo publicar', 'publicaciones no se pudieron publicar')}`,
      detalle: 'La tarjeta dice qué faltó. Corrígelo y usa "Reintentar".',
      estado: 'pendiente',
      prioridad: 0,
      accion: { tipo: 'vista', vista: 'cola' },
      boton: 'Revisar',
    });
  }
  crea.push(
    {
      id: 'semana',
      titulo: 'Ten lista tu próxima semana',
      detalle: proximos7 >= objetivoSemana
        ? `${plural(proximos7, 'publicación', 'publicaciones')} para los próximos 7 días.`
        : `${proximos7} de ${objetivoSemana} publicaciones para los próximos 7 días. Genera la semana según tu plan.`,
      estado: proximos7 >= objetivoSemana ? 'hecho' : 'pendiente',
      prioridad: proximos7 === 0 ? 2 : 3,
      accion: { tipo: 'generar' },
      boton: 'Generar semana',
    },
    {
      id: 'aprobar',
      titulo: 'Revisa y aprueba',
      detalle: pendientes.length
        ? `${plural(pendientes.length, 'publicación espera', 'publicaciones esperan')} tu aprobación${pendientesUrgentes ? `, ${pendientesUrgentes} para los próximos 3 días` : ''}.`
        : 'No hay nada esperando tu aprobación.',
      estado: pendientes.length ? 'pendiente' : 'hecho',
      prioridad: pendientesUrgentes ? 1 : 4,
      accion: { tipo: 'vista', vista: 'cola' },
      boton: 'Ir a Por aprobar',
    },
    {
      id: 'material',
      titulo: 'Sube videos y fotos que faltan',
      detalle: partesMaterial.length
        ? `En las próximas 2 semanas: ${partesMaterial.join(', ')}.`
        : 'Todo lo de las próximas 2 semanas tiene su foto o video.',
      estado: partesMaterial.length ? 'pendiente' : 'hecho',
      prioridad: sinMaterial.some((x) => pronto(x.i, 3)) ? 1 : 4,
      accion: { tipo: 'vista', vista: cuenta('reel') ? 'cola' : 'fotos' },
      boton: cuenta('reel') ? 'Ver cuáles' : 'Subir fotos',
    },
  );

  // --- 3. Mide ---
  const syncError = syncInstagram && syncInstagram.error;
  const mide = [
    {
      id: 'resultados',
      titulo: 'Mira qué te funciona',
      detalle: !igOk ? 'Conecta Instagram y Rubrofy mide tus resultados solo, cada 12 horas.'
        : syncError ? `No se pudieron leer tus resultados: ${syncInstagram.detalle || syncError}.`
          : 'Alcance, interacciones, mejor horario y qué enfoques rinden más. Se actualiza solo.',
      estado: !plan.analitica ? 'bloqueado' : igOk && !syncError ? 'hecho' : 'pendiente',
      requierePlan: plan.analitica ? null : 'Pro',
      prioridad: 6,
      accion: igOk ? { tipo: 'vista', vista: 'resultados', tab: 'instagram' } : { tipo: 'vista', vista: 'config' },
      boton: igOk ? 'Ver resultados' : 'Conectar Instagram',
      botonHecho: 'Ver resultados',
    },
    {
      id: 'publicidad',
      titulo: 'Conecta tu publicidad',
      detalle: 'Meta Ads y Google Ads: cuánto inviertes, qué obtienes y cuánto cuesta cada resultado.',
      estado: !plan.ads ? 'bloqueado' : (negocio.metaConexion || negocio.googleConexion) ? 'hecho' : 'pendiente',
      requierePlan: plan.ads ? null : 'Estudio',
      prioridad: 8,
      accion: (negocio.metaConexion || negocio.googleConexion) ? { tipo: 'vista', vista: 'resultados', tab: 'meta' } : { tipo: 'vista', vista: 'config' },
      boton: 'Conectar',
      botonHecho: 'Ver publicidad',
    },
    {
      id: 'competencia',
      titulo: 'Sigue a tu competencia',
      detalle: competidores
        ? `Sigues ${plural(competidores, 'cuenta', 'cuentas')}. Compara seguidores, frecuencia e interacción.`
        : 'Agrega hasta 5 cuentas de Instagram y compárate con ellas.',
      estado: !plan.competencia ? 'bloqueado' : competidores ? 'hecho' : 'pendiente',
      requierePlan: plan.competencia ? null : 'Estudio',
      prioridad: 9,
      accion: { tipo: 'vista', vista: 'resultados', tab: 'competencia' },
      boton: 'Agregar competidores',
      botonHecho: 'Ver comparación',
    },
  ];

  // --- 4. Mejora cada mes ---
  // El primer informe tiene sentido cuando ya pasó un mes completo con la cuenta.
  const creadoMes = (negocio.bienvenidaCompletada || '').slice(0, 7) || mesHoy;
  const mesInforme = mesAnterior(mesHoy);
  const hayInforme = creadoMes < mesHoy;
  const ruta = negocio.ruta || {};
  const informeVisto = hayInforme && ruta.informeVisto && ruta.informeVisto >= mesInforme;
  const revisadaEsteMes = (negocio.estrategiaRevisadaEl || '').slice(0, 7) === mesHoy || !hayInforme;
  const mejora = [
    {
      id: 'informe',
      titulo: hayInforme ? `Lee tu informe de ${nombreMes(mesInforme)}` : 'Lee tu informe mensual',
      detalle: !hayInforme
        ? `Tu primer informe estará listo el 1 de ${nombreMes(mesSiguiente(mesHoy))}: resultados, qué funcionó y una conclusión escrita.`
        : 'Resultados del mes, qué funcionó y una conclusión escrita. Listo para imprimir o compartir.',
      estado: !plan.analitica ? 'bloqueado' : !hayInforme ? 'proximo' : informeVisto ? 'hecho' : 'pendiente',
      requierePlan: plan.analitica ? null : 'Pro',
      prioridad: 3,
      accion: { tipo: 'informe', mes: mesInforme },
      boton: 'Abrir informe',
      botonHecho: 'Abrir informe',
    },
    {
      id: 'ajustar',
      titulo: 'Ajusta tu estrategia',
      detalle: !hayInforme
        ? 'Al cierre de cada mes, usa lo aprendido para ajustar objetivo, temas o cuánto publicar.'
        : 'Con lo que aprendiste del mes, ajusta objetivo, temas o cuánto publicar. La IA también aprende sola de tus resultados.',
      estado: !hayInforme ? 'proximo' : revisadaEsteMes ? 'hecho' : 'pendiente',
      prioridad: 5,
      accion: { tipo: 'vista', vista: 'estrategia' },
      boton: 'Revisar estrategia',
    },
  ];

  const etapas = [
    { id: 'configura', titulo: 'Configura', cuando: 'Una vez', resumen: 'Tu negocio, tu objetivo y tus cuentas.', pasos: configura },
    { id: 'crea', titulo: 'Crea', cuando: 'Cada semana', resumen: 'Genera, revisa y aprueba. Se publica solo.', pasos: crea },
    { id: 'mide', titulo: 'Mide', cuando: 'Automático', resumen: 'Qué funciona, tu publicidad y tu competencia.', pasos: mide },
    { id: 'mejora', titulo: 'Mejora', cuando: 'Cada mes', resumen: 'Lee tu informe y ajusta la estrategia.', pasos: mejora },
  ];
  for (const e of etapas) {
    const contables = e.pasos.filter((p) => p.estado !== 'bloqueado' && p.estado !== 'proximo');
    e.hechos = contables.filter((p) => p.estado === 'hecho').length;
    e.total = contables.length;
    e.bloqueados = e.pasos.filter((p) => p.estado === 'bloqueado').length;
  }

  // Etapa en la que está: primero terminar lo básico de Configura; después,
  // la primera etapa con algo pendiente (Crea se repite cada semana).
  const basico = configura.filter((p) => p.id === 'bienvenida' || p.id === 'instagram');
  const actual = basico.some((p) => p.estado === 'pendiente') ? 'configura'
    : (etapas.find((e) => e.id !== 'configura' && e.pasos.some((p) => p.estado === 'pendiente')) || { id: 'crea' }).id;

  const siguientes = etapas
    .flatMap((e) => e.pasos.filter((p) => p.estado === 'pendiente').map((p) => Object.assign({ etapa: e.id }, p)))
    .sort((a, b) => a.prioridad - b.prioridad)
    .slice(0, 3);

  return { etapaActual: actual, etapas, siguientes, plan: plan.id };
}

module.exports = { calcular, mesAnterior, faltaMaterial };
