// Informe mensual: junta los resultados del mes (y la comparación con el
// anterior), lo que se publicó, cuánto aprobó el dueño sin cambios y las
// secciones que agreguen otros módulos (Meta Ads, Google Ads, competencia),
// más una conclusión en español escrita por Claude ("qué pasó, qué funcionó,
// qué haremos el próximo mes"). La conclusión se guarda: no se vuelve a pagar
// cada vez que alguien abre el informe.

const store = require('./store');
const analitica = require('./analitica');

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS informes (
    negocio_id TEXT NOT NULL,
    mes TEXT NOT NULL,          -- AAAA-MM
    conclusion TEXT NOT NULL,
    origen TEXT NOT NULL,       -- ia | automatico
    generado_el TEXT NOT NULL,
    PRIMARY KEY (negocio_id, mes)
  );
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM informes WHERE negocio_id = ?').run(negocioId));

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Secciones extra: { nombre, datos(negocio, desde, hasta) → objeto | null }.
const secciones = [];
function registrarSeccion(nombre, fn) {
  secciones.push({ nombre, fn });
}

function mesValido(mes) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes || ''));
}

function mesActual() {
  return analitica.fechaLocal(new Date()).slice(0, 7);
}

function rangoDelMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  const desde = `${mes}-01`;
  const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  const hoy = analitica.fechaLocal(new Date());
  return { desde, hasta: ultimo < hoy ? ultimo : hoy, completo: ultimo < hoy };
}

function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

function etiquetaMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} ${a}`;
}

function variacion(actual, anterior) {
  if (actual == null || !anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

function datos(negocio, mes, estadisticasAprobacion) {
  const { desde, hasta, completo } = rangoDelMes(mes);
  const previo = rangoDelMes(mesAnterior(mes));
  const r = analitica.resumen(negocio.id, desde, hasta, negocio.estrategia);
  const rPrevio = analitica.resumen(negocio.id, previo.desde, previo.hasta, negocio.estrategia);

  // Lo que Rubrofy publicó en el mes, por formato.
  const publicadas = store.getContenido(negocio.id).filter((i) => {
    const cuando = i.publicacion && i.publicacion.publicadoEl;
    return cuando && analitica.fechaLocal(new Date(cuando)) >= desde && analitica.fechaLocal(new Date(cuando)) <= hasta;
  });
  const porFormato = {};
  for (const i of publicadas) {
    const f = i.formato || (i.aspect && i.aspect.trim().startsWith('9') ? 'historia' : 'post');
    porFormato[f] = (porFormato[f] || 0) + 1;
  }

  const extra = {};
  for (const s of secciones) {
    try {
      const d = s.fn(negocio, desde, hasta);
      if (d) extra[s.nombre] = d;
    } catch (err) {
      extra[s.nombre] = { error: err.message };
    }
  }

  const fila = db.prepare('SELECT conclusion, origen, generado_el FROM informes WHERE negocio_id = ? AND mes = ?').get(negocio.id, mes);
  const [a, m] = desde.split('-').map(Number);
  const programacion = require('./programacion');
  return {
    negocio: { id: negocio.id, nombre: negocio.nombre, rubro: negocio.estrategia && negocio.estrategia.rubro },
    mes, etiquetaMes: etiquetaMes(mes), desde, hasta, completo,
    resumen: r,
    comparacion: {
      mes: etiquetaMes(mesAnterior(mes)),
      alcance: variacion(r.alcance, rPrevio.alcance),
      interacciones: variacion(r.interacciones, rPrevio.interacciones),
      publicaciones: rPrevio.publicaciones,
    },
    horario: analitica.mejorHorario(negocio.id),
    aprobacion: estadisticasAprobacion(negocio.id, programacion.isoDesdeZona(a, m, 1, 0, 0),
      programacion.isoDesdeZona(...analitica.sumarDias(hasta, 1).split('-').map(Number), 0, 0)),
    publicadas: { total: publicadas.length, porFormato },
    secciones: extra,
    conclusion: fila ? { texto: fila.conclusion, origen: fila.origen, generadoEl: fila.generado_el } : null,
  };
}

// Conclusión sin IA (plan sin Claude o sin API key): las mismas tres partes,
// armadas con reglas a partir de los números.
function conclusionAutomatica(d) {
  const r = d.resumen;
  const c = d.comparacion;
  const n = (v) => (v == null ? '–' : Math.round(v).toLocaleString('es-CL'));
  const pasó = [];
  pasó.push(`Alcanzaste ${n(r.alcance)} cuentas (suma diaria) y lograste ${n(r.interacciones)} interacciones en ${d.etiquetaMes}.`);
  if (c.alcance != null) pasó.push(`El alcance ${c.alcance >= 0 ? 'subió' : 'bajó'} ${Math.abs(c.alcance)}% frente a ${c.mes}.`);
  if (r.seguidoresDelta === 0) pasó.push('Los seguidores se mantuvieron.');
  else if (r.seguidoresDelta != null) pasó.push(`Los seguidores ${r.seguidoresDelta > 0 ? 'crecieron en' : 'bajaron en'} ${n(Math.abs(r.seguidoresDelta))}.`);
  const funcionó = [];
  if (r.porEnfoque.length) funcionó.push(`El enfoque "${r.porEnfoque[0].label}" fue el de más interacción por publicación (${n(r.porEnfoque[0].promedioInteracciones)} en promedio).`);
  if (r.topPosts.length) funcionó.push(`La mejor publicación logró ${n(r.topPosts[0].interacciones)} interacciones.`);
  if (d.horario.mejor) funcionó.push(`Publicar el ${d.horario.mejor.diaLabel} en la ${d.horario.mejor.franjaLabel} rinde ${d.horario.mejor.factor.toLocaleString('es-CL')}× el promedio.`);
  const haremos = [];
  if (r.porEnfoque.length) haremos.push(`Dar más espacio al enfoque "${r.porEnfoque[0].label}".`);
  if (d.horario.mejor) haremos.push(`Concentrar las publicaciones a las ${d.horario.mejor.hora}.`);
  if (d.aprobacion.porcentajeSinCambios != null && d.aprobacion.porcentajeSinCambios < 70) {
    haremos.push('Seguir afinando la voz de la marca con tus correcciones: hoy editas más de un tercio de las piezas.');
  }
  if (!haremos.length) haremos.push('Mantener la frecuencia de publicación y revisar los resultados a mitad de mes.');
  const bloque = (t, xs) => `${t}\n${(xs.length ? xs : ['Aún no hay datos suficientes.']).map((x) => '- ' + x).join('\n')}`;
  return [bloque('Qué pasó', pasó), bloque('Qué funcionó', funcionó), bloque('Qué haremos el próximo mes', haremos)].join('\n\n');
}

async function conclusionConClaude(d, apiKey, negocioId) {
  const r = d.resumen;
  const resumenParaIA = {
    negocio: d.negocio.nombre, rubro: d.negocio.rubro, mes: d.etiquetaMes, mesCompleto: d.completo,
    seguidores: r.seguidores, variacionSeguidores: r.seguidoresDelta,
    alcanceSumaDiaria: r.alcance, interacciones: r.interacciones,
    tasaInteraccionPorcentaje: r.tasaInteraccion == null ? null : Math.round(r.tasaInteraccion * 1000) / 10,
    variacionVsMesAnterior: { mesAnterior: d.comparacion.mes, alcancePorcentaje: d.comparacion.alcance, interaccionesPorcentaje: d.comparacion.interacciones },
    publicacionesConMetricas: r.publicaciones, publicadasConRubrofy: d.publicadas,
    enfoques: r.porEnfoque.map((e) => ({ enfoque: e.label, posts: e.posts, interaccionesPromedio: e.promedioInteracciones })),
    mejoresPosts: r.topPosts.slice(0, 3).map((p) => ({ texto: (p.caption || '').slice(0, 200), interacciones: p.interacciones, alcance: p.alcance })),
    mejorHorario: d.horario.mejor,
    aprobacionSinCambiosPorcentaje: d.aprobacion.porcentajeSinCambios,
    otrasFuentes: d.secciones,
  };
  const prompt =
    'Eres el estratega de redes sociales de una pyme chilena y escribes la conclusión de su informe mensual. ' +
    'Con estos datos (JSON), escribe en español de Chile, cercano y claro, sin tecnicismos, tres secciones con estos títulos exactos, ' +
    'cada una con 2 o 3 viñetas que empiezan con "- ":\n' +
    'Qué pasó\nQué funcionó\nQué haremos el próximo mes\n\n' +
    'Reglas: usa solo cifras que están en los datos, nunca inventes números ni causas que los datos no muestren; ' +
    'si falta información dilo en una frase; las acciones del próximo mes deben ser concretas y salir de los datos. ' +
    'Máximo 170 palabras en total. Sin markdown aparte de las viñetas, sin saludo ni despedida.\n\n' +
    JSON.stringify(resumenParaIA);
  const respuesta = await require('./claude').llamar({ maxTokens: 1024, content: prompt, negocioId, uso: 'informe' });
  return respuesta.texto || null;
}

// Genera (o regenera) y guarda la conclusión. Con IA solo si el plan la
// incluye y hay API key; si Claude falla, queda la automática.
async function generarConclusion(negocio, mes, d, conIA) {
  let texto = null;
  let origen = 'automatico';
  if (conIA && process.env.ANTHROPIC_API_KEY) {
    try {
      texto = await conclusionConClaude(d, process.env.ANTHROPIC_API_KEY, negocio.id);
      if (texto) origen = 'ia';
    } catch (err) {
      texto = null;
    }
  }
  if (!texto) texto = conclusionAutomatica(d);
  db.prepare(`INSERT INTO informes (negocio_id, mes, conclusion, origen, generado_el) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (negocio_id, mes) DO UPDATE SET conclusion = excluded.conclusion, origen = excluded.origen,
      generado_el = excluded.generado_el`).run(negocio.id, mes, texto, origen, new Date().toISOString());
  return { texto, origen };
}

module.exports = { datos, generarConclusion, registrarSeccion, mesValido, mesActual, conclusionAutomatica };
