// Publicidad que aprende (Meta Ads). Cada recomendación del diagnóstico
// (analisis-ads.js) tiene una clave estable. Cuando el dueño la abre en Meta
// ("Hacer este cambio en Meta"), la marca como hecha o dice que no le sirve,
// queda un registro en meta_cambios. Con cada sincronización Rubrofy:
//   1. detecta si el cambio se hizo (anuncio o campaña apagada, presupuesto
//      movido, anuncio nuevo...), sin preguntarle al dueño;
//   2. mide los 7 días siguientes contra los 7 anteriores y dice si funcionó;
//   3. con eso ajusta el próximo diagnóstico: lo que le funcionó a este
//      negocio sube, lo que dijo que no le sirve se oculta 30 días y, si un
//      cambio no funcionó, la próxima vez propone otra cosa.
// También resume lo que enseñan sus anuncios (texto, formato, ubicación y
// público con resultados más baratos) para la IA que escribe el contenido
// (aprendizaje.js). Rubrofy sigue siendo de solo lectura: nunca cambia nada
// en Meta.

const store = require('./store');
const meta = require('./meta');
const analitica = require('./analitica');
const { apagado } = require('./analisis-ads');

const db = store.db;

const DIAS_MEDIR = 7;     // se comparan los 7 días después del cambio con los 7 antes
const DIAS_MINIMOS = 4;   // con menos días después no se da un resultado
const DIAS_VENCE = 21;    // abierta en Meta y nunca hecha: se archiva
const DIAS_OCULTA = 30;   // "No me sirve" la oculta este tiempo
const UMBRAL = 0.1;       // ±10 % para decir que mejoró o empeoró

db.exec(`
  CREATE TABLE IF NOT EXISTS meta_cambios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id TEXT NOT NULL,
    cuenta TEXT NOT NULL,            -- cuenta publicitaria (act_...)
    clave TEXT NOT NULL,             -- la recomendación (ver analisis-ads.js)
    regla TEXT NOT NULL,
    titulo TEXT NOT NULL,
    accion TEXT,
    destino TEXT,                    -- JSON: dónde se hace en Meta
    foto TEXT,                       -- JSON: cómo estaba la cuenta al abrirla
    estado TEXT NOT NULL,            -- abierto | hecho | descartado | vencido
    como TEXT,                       -- dueno | lo que Rubrofy detectó (apagado, presupuesto...)
    abierto_el TEXT NOT NULL,        -- ISO
    hecho_el TEXT,                   -- AAAA-MM-DD
    resultado TEXT,                  -- mejoro | empeoro | igual | sin_datos
    medicion TEXT,                   -- JSON: antes, después, días
    variacion REAL,
    cerrado INTEGER NOT NULL DEFAULT 0,  -- 1: ya se midieron los 7 días
    oculta INTEGER NOT NULL DEFAULT 0,   -- 1: "No me sirve" vigente
    descartado_el TEXT                   -- ISO, cuándo dijo "No me sirve"
  );
  CREATE INDEX IF NOT EXISTS meta_cambios_negocio ON meta_cambios (negocio_id, cuenta, clave);
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM meta_cambios WHERE negocio_id = ?').run(negocioId));

// Qué se mide en cada regla y cómo se detecta que el dueño hizo el cambio.
//   metrica: cpr (costo por resultado, bajar es bueno) | ctr | roas |
//            resultados (por día) | escala (más resultados sin que suba el costo)
//   ambito: 'campanas' mide solo las campañas de la recomendación; si no, la cuenta.
const REGLAS = {
  'campana-sin-resultados': { metrica: 'cpr', detectar: ['apagada', 'objetivo', 'sinGasto'] },
  'costo-campanas': { metrica: 'cpr', detectar: ['presupuesto', 'reparto', 'apagada'] },
  'ctr-bajo': { metrica: 'ctr', ambito: 'campanas', detectar: ['anuncioNuevo'] },
  'roas-bajo': { metrica: 'roas', detectar: [] },
  'costo-subio': { metrica: 'cpr', detectar: ['anuncioNuevo'] },
  'costo-bajo': { metrica: 'escala', detectar: ['presupuesto', 'masGasto'] },
  'sin-resultados-periodo': { metrica: 'resultados', detectar: [] },
  publico: { metrica: 'cpr', detectar: ['anuncioNuevo'] },
  ubicacion: { metrica: 'cpr', detectar: ['anuncioNuevo'] },
  'anuncios-sin-resultados': { metrica: 'cpr', detectar: ['anuncioApagado', 'sinGasto'] },
};

const sql = {
  porClave: db.prepare('SELECT * FROM meta_cambios WHERE negocio_id = ? AND cuenta = ? AND clave = ? ORDER BY id DESC LIMIT 1'),
  porId: db.prepare('SELECT * FROM meta_cambios WHERE negocio_id = ? AND id = ?'),
  delNegocio: db.prepare('SELECT * FROM meta_cambios WHERE negocio_id = ? AND cuenta = ? AND abierto_el >= ? ORDER BY id DESC'),
  insertar: db.prepare(`INSERT INTO meta_cambios (negocio_id, cuenta, clave, regla, titulo, accion, destino, foto, estado, como, abierto_el, hecho_el, oculta)
    VALUES (@negocio_id, @cuenta, @clave, @regla, @titulo, @accion, @destino, @foto, @estado, @como, @abierto_el, @hecho_el, @oculta)`),
  descartadoEl: db.prepare('UPDATE meta_cambios SET descartado_el = ? WHERE id = ?'),
  hecho: db.prepare("UPDATE meta_cambios SET estado = 'hecho', como = ?, hecho_el = ? WHERE id = ?"),
  descartar: db.prepare("UPDATE meta_cambios SET estado = 'descartado', oculta = 1, descartado_el = ? WHERE id = ?"),
  vencer: db.prepare("UPDATE meta_cambios SET estado = 'vencido' WHERE negocio_id = ? AND estado = 'abierto' AND abierto_el < ?"),
  abiertos: db.prepare("SELECT * FROM meta_cambios WHERE negocio_id = ? AND cuenta = ? AND estado = 'abierto'"),
  porMedir: db.prepare("SELECT * FROM meta_cambios WHERE negocio_id = ? AND cuenta = ? AND estado = 'hecho' AND cerrado = 0"),
  medir: db.prepare('UPDATE meta_cambios SET resultado = ?, medicion = ?, variacion = ?, cerrado = ? WHERE id = ?'),
  mostrarOcultas: db.prepare("UPDATE meta_cambios SET oculta = 0 WHERE negocio_id = ? AND estado = 'descartado'"),
  hechosEntre: db.prepare("SELECT * FROM meta_cambios WHERE negocio_id = ? AND estado = 'hecho' AND hecho_el BETWEEN ? AND ? ORDER BY hecho_el"),
  todos: db.prepare('SELECT regla, estado, resultado, cerrado FROM meta_cambios WHERE abierto_el >= ?'),
};

const hoyLocal = () => analitica.fechaLocal(new Date());
const fechaDe = (iso) => analitica.fechaLocal(new Date(iso));
const sumar = analitica.sumarDias;
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const json = (t, def) => { try { return t ? JSON.parse(t) : def; } catch (err) { return def; } };

// Campañas y anuncios a los que apunta una recomendación.
function idsDe(destino) {
  if (!destino) return { campanas: [], anuncios: [] };
  return {
    campanas: (destino.tipo === 'campanas' ? destino.ids : destino.campanas) || [],
    anuncios: destino.tipo === 'anuncios' ? (destino.ids || []) : [],
  };
}

// Cómo estaba la cuenta al abrir la recomendación: lo que después se compara
// para saber si el dueño hizo el cambio.
function fotoDe(negocioId, destino, hoy) {
  const ids = idsDe(destino);
  const cuenta = meta.estadoCuenta(negocioId);
  const desde = sumar(hoy, -DIAS_MEDIR);
  const hasta = sumar(hoy, -1);
  const gastos = meta.gastoPor(negocioId, 'campanas', desde, hasta);
  const total = [...gastos.values()].reduce((a, b) => a + b, 0);
  // Las campañas de la recomendación y las que gastaron en la última semana
  // (para ver después si cambió el presupuesto de la cuenta).
  const campanas = {};
  for (const id of new Set([...ids.campanas, ...[...gastos.keys()].filter((x) => gastos.get(x) > 0)])) {
    campanas[id] = Object.assign({ gasto: gastos.get(id) || 0 }, cuenta.campanas.get(id) || {});
  }
  const anuncios = {};
  for (const id of ids.anuncios) anuncios[id] = (cuenta.anuncios.find((a) => a.id === id) || {}).estado || null;
  return { campanas, anuncios, gastoDiario: total / DIAS_MEDIR };
}

// ¿Se hizo el cambio? Devuelve { como, hechoEl } o null.
function detectar(c, cuenta, hoy) {
  const regla = REGLAS[c.regla];
  if (!regla || !regla.detectar.length) return null;
  const destino = json(c.destino, null);
  const foto = json(c.foto, { campanas: {}, anuncios: {} });
  const ids = idsDe(destino);
  const abierto = fechaDe(c.abierto_el);
  // Días completos después de abrirla (hoy todavía no termina).
  const desde = sumar(abierto, 1);
  const hasta = sumar(hoy, -1);
  const diasDespues = hasta >= desde ? diasEntre(desde, hasta) + 1 : 0;
  // Si se detecta a más de 2 días de abrirla, se toma el día en que se vio.
  const cuando = diasEntre(abierto, hoy) <= 2 ? abierto : hoy;

  for (const tipo of regla.detectar) {
    if (tipo === 'apagada') {
      const id = ids.campanas.find((x) => apagado((cuenta.campanas.get(x) || {}).estado) && !apagado((foto.campanas[x] || {}).estado));
      // En "mover presupuesto" solo cuenta si se pausó la campaña cara.
      if (id && (c.regla !== 'costo-campanas' || id === ids.campanas[0])) return { como: 'apagada', hechoEl: cuando };
    }
    if (tipo === 'objetivo') {
      const id = ids.campanas.find((x) => {
        const antes = (foto.campanas[x] || {}).objetivo;
        const ahora = (cuenta.campanas.get(x) || {}).objetivo;
        return antes && ahora && antes !== ahora;
      });
      if (id) return { como: 'objetivo', hechoEl: cuando };
    }
    if (tipo === 'anuncioApagado') {
      const id = ids.anuncios.find((x) => apagado((cuenta.anuncios.find((a) => a.id === x) || {}).estado) && !apagado(foto.anuncios[x]));
      if (id) return { como: 'anuncioApagado', hechoEl: cuando };
    }
    if (tipo === 'presupuesto') {
      const cambio = (id) => {
        const antes = (foto.campanas[id] || {}).presupuesto;
        const ahora = (cuenta.campanas.get(id) || {}).presupuesto;
        return antes && ahora ? (ahora - antes) / antes : 0;
      };
      if (c.regla === 'costo-campanas') {
        const [peor, mejor] = ids.campanas;
        if (cambio(peor) <= -0.1 || cambio(mejor) >= 0.1) return { como: 'presupuesto', hechoEl: cuando };
      } else {
        // Toda la cuenta: la suma de los presupuestos de las campañas activas.
        const suma = (cual) => Object.keys(foto.campanas).reduce((t, id) => {
          const c2 = cual === 'antes' ? foto.campanas[id] : cuenta.campanas.get(id);
          return t + (c2 && c2.presupuesto && !apagado(c2.estado) ? c2.presupuesto : 0);
        }, 0);
        const antes = suma('antes');
        if (antes && suma('ahora') >= antes * 1.1) return { como: 'presupuesto', hechoEl: cuando };
      }
    }
    if (tipo === 'anuncioNuevo') {
      const nuevo = cuenta.anuncios.filter((a) => a.creadoEl && a.creadoEl > c.abierto_el && !apagado(a.estado))
        .filter((a) => c.regla !== 'ctr-bajo' || ids.campanas.includes(a.campanaId))
        .sort((a, b) => a.creadoEl.localeCompare(b.creadoEl))[0];
      if (nuevo) return { como: 'anuncioNuevo', hechoEl: fechaDe(nuevo.creadoEl) };
    }
    // Los que miran el gasto necesitan 2 días completos de datos.
    if (diasDespues < 2) continue;
    if (tipo === 'sinGasto') {
      const porCampana = meta.gastoPor(c.negocio_id, 'campanas', desde, hasta);
      const totalDespues = [...porCampana.values()].reduce((a, b) => a + b, 0);
      if (totalDespues > 0) {
        if (ids.campanas.length && ids.campanas.every((x) => !porCampana.get(x))) return { como: 'sinGasto', hechoEl: abierto };
        if (ids.anuncios.length) {
          // Solo si llegaron datos por anuncio (si Meta no los entregó, no se supone nada).
          const porAnuncio = meta.gastoPor(c.negocio_id, 'anuncios', desde, hasta);
          const hayDatos = [...porAnuncio.values()].some((g) => g > 0);
          if (hayDatos && ids.anuncios.some((x) => !porAnuncio.get(x))) return { como: 'sinGasto', hechoEl: abierto };
        }
      }
    }
    if (tipo === 'reparto' && ids.campanas.length === 2) {
      const [peor, mejor] = ids.campanas;
      const antes = foto.campanas[peor] && foto.campanas[mejor] ? foto.campanas[peor].gasto / ((foto.campanas[peor].gasto + foto.campanas[mejor].gasto) || 1) : null;
      const g = meta.gastoPor(c.negocio_id, 'campanas', desde, hasta);
      const suma = (g.get(peor) || 0) + (g.get(mejor) || 0);
      if (antes && suma > 0 && (g.get(peor) || 0) / suma <= antes * 0.85) return { como: 'reparto', hechoEl: abierto };
    }
    if (tipo === 'masGasto' && foto.gastoDiario > 0) {
      const g = meta.gastoPor(c.negocio_id, 'campanas', desde, hasta);
      const diario = [...g.values()].reduce((a, b) => a + b, 0) / diasDespues;
      if (diario >= foto.gastoDiario * 1.15) return { como: 'masGasto', hechoEl: abierto };
    }
  }
  return null;
}

// Números de un rango para lo que mide la regla (la cuenta o sus campañas).
function numeros(negocioId, regla, destino, desde, hasta) {
  const r = meta.resumenAds(negocioId, desde, hasta);
  if ((REGLAS[regla] || {}).ambito !== 'campanas') return r.total;
  const ids = idsDe(destino).campanas;
  const t = r.campanas.filter((c) => ids.includes(c.id)).reduce((s, c) => {
    for (const k of ['gasto', 'impresiones', 'clics', 'resultados', 'valorCompras']) s[k] += c[k] || 0;
    return s;
  }, { gasto: 0, impresiones: 0, clics: 0, resultados: 0, valorCompras: 0 });
  return Object.assign(t, {
    ctr: t.impresiones ? t.clics / t.impresiones : null,
    costoPorResultado: t.resultados ? t.gasto / t.resultados : null,
    roas: t.gasto && t.valorCompras ? t.valorCompras / t.gasto : null,
  });
}

// ¿Funcionó? Compara antes y después según la métrica de la regla.
function evaluar(metrica, a, d, diasA, diasD) {
  const base = (valorA, valorD) => ({ antes: { valor: valorA, gasto: a.gasto, resultados: a.resultados }, despues: { valor: valorD, gasto: d.gasto, resultados: d.resultados } });
  if (!a.gasto || !d.gasto) return Object.assign({ resultado: 'sin_datos', variacion: null }, base(null, null));
  const relativo = (va, vd) => (va ? (vd - va) / va : null);
  const veredicto = (v, masEsMejor) => {
    if (v == null) return 'igual';
    const bueno = masEsMejor ? v : -v;
    return bueno >= UMBRAL ? 'mejoro' : (bueno <= -UMBRAL ? 'empeoro' : 'igual');
  };
  if (metrica === 'cpr') {
    const va = a.costoPorResultado;
    const vd = d.costoPorResultado;
    if (va == null && vd == null) return Object.assign({ resultado: 'igual', variacion: null }, base(va, vd));
    if (va == null) return Object.assign({ resultado: 'mejoro', variacion: null }, base(va, vd));
    if (vd == null) return Object.assign({ resultado: 'empeoro', variacion: null }, base(va, vd));
    const v = relativo(va, vd);
    return Object.assign({ resultado: veredicto(v, false), variacion: v }, base(va, vd));
  }
  if (metrica === 'ctr' || metrica === 'roas') {
    const va = metrica === 'ctr' ? a.ctr : a.roas;
    const vd = metrica === 'ctr' ? d.ctr : d.roas;
    if (va == null && vd == null) return Object.assign({ resultado: 'igual', variacion: null }, base(va, vd));
    if (!va) return Object.assign({ resultado: vd ? 'mejoro' : 'igual', variacion: null }, base(va, vd));
    const v = relativo(va, vd || 0);
    return Object.assign({ resultado: veredicto(v, true), variacion: v }, base(va, vd));
  }
  // resultados por día y escala
  const ra = a.resultados / diasA;
  const rd = d.resultados / diasD;
  const vr = ra ? (rd - ra) / ra : null;
  if (metrica === 'escala') {
    const vc = a.costoPorResultado && d.costoPorResultado ? (d.costoPorResultado - a.costoPorResultado) / a.costoPorResultado : null;
    const r = base(ra, rd);
    r.antes.costo = a.costoPorResultado;
    r.despues.costo = d.costoPorResultado;
    if (vc != null && vc >= 0.15) return Object.assign({ resultado: 'empeoro', variacion: vr, variacionCosto: vc }, r);
    return Object.assign({ resultado: vr == null ? (rd ? 'mejoro' : 'igual') : veredicto(vr, true), variacion: vr, variacionCosto: vc }, r);
  }
  if (!ra) return Object.assign({ resultado: rd ? 'mejoro' : 'igual', variacion: null }, base(ra, rd));
  return Object.assign({ resultado: veredicto(vr, true), variacion: vr }, base(ra, rd));
}

// Mide un cambio hecho: 7 días antes del día del cambio contra los días
// siguientes (hasta 7). Con menos de 4 días todavía no hay resultado.
function medir(c, hoy) {
  const ayer = sumar(hoy, -1);
  const desde = sumar(c.hecho_el, 1);
  const hasta = [sumar(c.hecho_el, DIAS_MEDIR), ayer].sort()[0];
  const diasD = hasta >= desde ? diasEntre(desde, hasta) + 1 : 0;
  if (diasD < DIAS_MINIMOS) return null;
  const destino = json(c.destino, null);
  const a = numeros(c.negocio_id, c.regla, destino, sumar(c.hecho_el, -DIAS_MEDIR), sumar(c.hecho_el, -1));
  const d = numeros(c.negocio_id, c.regla, destino, desde, hasta);
  const r = evaluar((REGLAS[c.regla] || { metrica: 'cpr' }).metrica, a, d, DIAS_MEDIR, diasD);
  r.dias = diasD;
  return r;
}

// Pone al día los cambios de un negocio: archiva los abiertos que nunca se
// hicieron, detecta los que se hicieron y mide los hechos. Se llama después de
// cada sincronización y al abrir Resultados → Meta Ads (solo lee la base).
function revisar(negocioId, opciones = {}) {
  const n = store.getNegocio(negocioId);
  if (!n || !n.meta || !n.meta.adAccountId) return;
  const cuentaId = n.meta.adAccountId;
  const hoy = opciones.hoy || hoyLocal();
  const ahora = opciones.ahora || new Date().toISOString();
  sql.vencer.run(negocioId, new Date(Date.parse(ahora) - DIAS_VENCE * 86400000).toISOString());
  const abiertos = sql.abiertos.all(negocioId, cuentaId);
  if (abiertos.length) {
    const cuenta = meta.estadoCuenta(negocioId);
    for (const c of abiertos) {
      const d = detectar(c, cuenta, hoy);
      if (d) sql.hecho.run(d.como, d.hechoEl, c.id);
    }
  }
  for (const c of sql.porMedir.all(negocioId, cuentaId)) {
    const r = medir(c, hoy);
    if (!r) continue;
    sql.medir.run(r.resultado, JSON.stringify({ antes: r.antes, despues: r.despues, dias: r.dias, variacionCosto: r.variacionCosto }),
      r.variacion == null ? null : r.variacion, r.dias >= DIAS_MEDIR ? 1 : 0, c.id);
  }
}

// El dueño abrió la recomendación en Meta, dijo que ya lo hizo o que no le sirve.
// h: el hallazgo del diagnóstico actual (con clave, regla y destino).
function registrar(negocioId, cuentaId, h, accion, opciones = {}) {
  const hoy = opciones.hoy || hoyLocal();
  const ahora = opciones.ahora || new Date().toISOString();
  const previo = sql.porClave.get(negocioId, cuentaId, h.clave);
  const vigente = previo && (previo.estado === 'abierto' || (previo.estado === 'hecho' && !previo.cerrado)) ? previo : null;
  if (accion === 'abrir' && vigente) return vigente.id;
  if (accion === 'hecho' && vigente) {
    if (vigente.estado === 'abierto') sql.hecho.run('dueno', diasEntre(fechaDe(vigente.abierto_el), hoy) <= 2 ? fechaDe(vigente.abierto_el) : hoy, vigente.id);
    return vigente.id;
  }
  if (accion === 'descartar' && vigente && vigente.estado === 'abierto') {
    sql.descartar.run(ahora, vigente.id);
    return vigente.id;
  }
  const r = sql.insertar.run({
    negocio_id: negocioId, cuenta: cuentaId, clave: h.clave, regla: h.regla, titulo: h.cambio || h.titulo, accion: h.accion || null,
    destino: JSON.stringify(h.destino || null), foto: JSON.stringify(fotoDe(negocioId, h.destino, hoy)),
    estado: accion === 'hecho' ? 'hecho' : (accion === 'descartar' ? 'descartado' : 'abierto'),
    como: accion === 'hecho' ? 'dueno' : null, abierto_el: ahora, hecho_el: accion === 'hecho' ? hoy : null,
    oculta: accion === 'descartar' ? 1 : 0,
  });
  if (accion === 'descartar') sql.descartadoEl.run(ahora, r.lastInsertRowid);
  return Number(r.lastInsertRowid);
}

// Desde la lista "Tus cambios": marcar como hecho o descartar uno abierto.
function actualizar(negocioId, id, accion, opciones = {}) {
  const c = sql.porId.get(negocioId, Number(id));
  if (!c || c.estado !== 'abierto') return false;
  const hoy = opciones.hoy || hoyLocal();
  if (accion === 'hecho') sql.hecho.run('dueno', diasEntre(fechaDe(c.abierto_el), hoy) <= 2 ? fechaDe(c.abierto_el) : hoy, c.id);
  else if (accion === 'descartar') sql.descartar.run(new Date().toISOString(), c.id);
  else return false;
  return true;
}

function mostrarOcultas(negocioId) {
  sql.mostrarOcultas.run(negocioId);
}

// Lo que el panel muestra de un cambio.
function publico(c, hoy, enlaceDe) {
  const m = json(c.medicion, null);
  const destino = json(c.destino, null);
  return {
    id: c.id, regla: c.regla, titulo: c.titulo, que: destino && destino.que, estado: c.estado, como: c.como,
    metrica: (REGLAS[c.regla] || {}).metrica || 'cpr',
    abiertoEl: c.abierto_el, hechoEl: c.hecho_el, resultadoEl: c.hecho_el ? sumar(c.hecho_el, DIAS_MEDIR + 1) : null,
    resultado: c.resultado, variacion: c.variacion, cerrado: !!c.cerrado,
    antes: m && m.antes, despues: m && m.despues, dias: m && m.dias, variacionCosto: m && m.variacionCosto,
    enlace: c.estado === 'abierto' && destino && enlaceDe ? enlaceDe(destino) : null,
  };
}

// Aplica lo aprendido al diagnóstico de hoy y arma "Tus cambios".
function aplicar(negocioId, cuentaId, hallazgos, opciones = {}) {
  const hoy = opciones.hoy || hoyLocal();
  const ahora = Date.parse(opciones.ahora || new Date().toISOString());
  const historial = sql.delNegocio.all(negocioId, cuentaId, new Date(ahora - 180 * 86400000).toISOString());
  const diasDesde = (iso) => (ahora - Date.parse(iso)) / 86400000;
  // "No me sirve": la misma recomendación se oculta 30 días; si dijo que no a
  // la misma regla 2 veces en 90 días, se oculta la regla completa 30 días.
  const descartes = historial.filter((c) => c.estado === 'descartado' && c.oculta);
  const cuandoDescarto = (c) => diasDesde(c.descartado_el || c.abierto_el);
  const clavesOcultas = new Set(descartes.filter((c) => cuandoDescarto(c) <= DIAS_OCULTA).map((c) => c.clave));
  const reglasOcultas = new Set();
  for (const regla of new Set(descartes.map((c) => c.regla))) {
    const de = descartes.filter((c) => c.regla === regla && cuandoDescarto(c) <= 90).sort((a, b) => cuandoDescarto(a) - cuandoDescarto(b));
    if (de.length >= 2 && cuandoDescarto(de[0]) <= DIAS_OCULTA) reglasOcultas.add(regla);
  }
  let ocultas = 0;
  const lista = [];
  for (const h0 of hallazgos) {
    const h = Object.assign({}, h0);
    delete h.alternativa;
    if (!h0.clave) { lista.push(h); continue; }
    if (clavesOcultas.has(h0.clave) || reglasOcultas.has(h0.regla)) { ocultas += 1; continue; }
    const ultimo = historial.find((c) => c.clave === h0.clave);
    if (ultimo && ultimo.estado === 'abierto') h.seguimiento = { estado: 'abierto', id: ultimo.id, abiertoEl: ultimo.abierto_el };
    else if (ultimo && ultimo.estado === 'hecho' && !ultimo.cerrado) h.seguimiento = { estado: 'midiendo', id: ultimo.id, hechoEl: ultimo.hecho_el, resultadoEl: sumar(ultimo.hecho_el, DIAS_MEDIR + 1), como: ultimo.como };
    // Lo que ya pasó con esta misma regla en este negocio.
    const medidos = historial.filter((c) => c.regla === h0.regla && c.estado === 'hecho' && c.cerrado && c.resultado !== 'sin_datos');
    const ultimoMedido = medidos[0];
    if (ultimoMedido && (ultimoMedido.resultado === 'empeoro' || ultimoMedido.resultado === 'igual') && diasDesde(ultimoMedido.abierto_el) <= 90 && h0.alternativa) {
      h.previo = { resultado: ultimoMedido.resultado, variacion: ultimoMedido.variacion, hechoEl: ultimoMedido.hecho_el, metrica: (REGLAS[h0.regla] || {}).metrica };
      h.accionOriginal = h.accion;
      h.accion = h0.alternativa;
    }
    const funciono = medidos.find((c) => c.resultado === 'mejoro');
    if (funciono && !h.previo) h.funciono = { variacion: funciono.variacion, hechoEl: funciono.hecho_el, metrica: (REGLAS[h0.regla] || {}).metrica };
    lista.push(h);
  }
  // Lo que ya le funcionó a este negocio va primero dentro de su nivel.
  const peso = { alerta: 0, idea: 1, bien: 2 };
  const orden = lista.map((h, i) => [h, i]);
  orden.sort((a, b) => peso[a[0].nivel] - peso[b[0].nivel] || (b[0].funciono ? 1 : 0) - (a[0].funciono ? 1 : 0) || a[1] - b[1]);
  const visibles = historial.filter((c) => (c.estado === 'abierto' || c.estado === 'hecho') && diasDesde(c.abierto_el) <= 60).slice(0, 12);
  const medidosTodos = historial.filter((c) => c.estado === 'hecho' && c.cerrado && c.resultado !== 'sin_datos');
  return {
    diagnostico: orden.map((x) => x[0]),
    ocultas,
    cambios: visibles.map((c) => publico(c, hoy, opciones.enlaceDe)),
    resumenCambios: { medidos: medidosTodos.length, funcionaron: medidosTodos.filter((c) => c.resultado === 'mejoro').length },
  };
}

// Cambios hechos en un mes (informe mensual).
function delPeriodo(negocioId, desde, hasta) {
  return sql.hechosEntre.all(negocioId, desde, hasta).map((c) => publico(c, hasta, null));
}

// Para /admin: solo números, sin contenido de ningún negocio.
function estadisticas(dias = 90) {
  const filas = sql.todos.all(new Date(Date.now() - dias * 86400000).toISOString());
  const porRegla = {};
  for (const f of filas) {
    const r = porRegla[f.regla] || (porRegla[f.regla] = { regla: f.regla, abiertas: 0, hechas: 0, descartadas: 0, medidas: 0, funcionaron: 0 });
    if (f.estado === 'descartado') r.descartadas += 1;
    else r.abiertas += 1;
    if (f.estado === 'hecho') r.hechas += 1;
    if (f.estado === 'hecho' && f.cerrado && f.resultado !== 'sin_datos') {
      r.medidas += 1;
      if (f.resultado === 'mejoro') r.funcionaron += 1;
    }
  }
  const lista = Object.values(porRegla).sort((a, b) => b.abiertas - a.abiertas);
  const total = lista.reduce((t, r) => {
    for (const k of ['abiertas', 'hechas', 'descartadas', 'medidas', 'funcionaron']) t[k] += r[k];
    return t;
  }, { abiertas: 0, hechas: 0, descartadas: 0, medidas: 0, funcionaron: 0 });
  return { total, porRegla: lista };
}

// --- Lo que enseñan los anuncios al contenido ---

const NOMBRE_SEXO = { female: 'mujeres', male: 'hombres' };

// Qué funcionó en sus anuncios de los últimos 60 días: el texto y el formato
// de los anuncios con resultados más baratos, la ubicación y el público.
// Solo afirma algo si hay al menos 3 resultados y una diferencia clara (20 %).
function leccion(negocioId, opciones = {}) {
  const hoy = opciones.hoy || hoyLocal();
  const desde = sumar(hoy, -60);
  const total = meta.resumenAds(negocioId, desde, hoy).total;
  if (!total.resultados || !total.costoPorResultado) return null;
  const promedio = total.costoPorResultado;
  const ds = meta.desglosesAds(negocioId, desde, hoy);
  const fichas = new Map(meta.estadoCuenta(negocioId).anuncios.map((a) => [a.id, a]));
  const pct = (v) => Math.round(v * 100);
  const frases = [];
  const prompt = [];

  const buenos = ds.anuncios.filter((a) => a.resultados >= 3 && a.costoPorResultado != null && a.costoPorResultado <= promedio * 0.8)
    .sort((a, b) => a.costoPorResultado - b.costoPorResultado).slice(0, 2);
  for (const a of buenos) {
    const f = fichas.get(a.id) || {};
    const formato = f.formato === 'video' ? 'en video' : (f.formato === 'imagen' ? 'con imagen' : '');
    frases.push(`Tu anuncio "${a.nombre}"${formato ? ` (${formato})` : ''} consigue resultados ${pct(1 - a.costoPorResultado / promedio)} % más baratos que el promedio.`);
    if (f.texto) prompt.push(`Anuncio${formato ? ' ' + formato : ''} con resultados ${pct(1 - a.costoPorResultado / promedio)} % más baratos: "${f.texto.replace(/\s+/g, ' ').slice(0, 220)}"`);
  }

  const porFormato = {};
  for (const a of ds.anuncios) {
    const f = (fichas.get(a.id) || {}).formato;
    if (!f) continue;
    const x = porFormato[f] || (porFormato[f] = { gasto: 0, resultados: 0 });
    x.gasto += a.gasto;
    x.resultados += a.resultados;
  }
  const v = porFormato.video;
  const im = porFormato.imagen;
  if (v && im && v.resultados >= 3 && im.resultados >= 3) {
    const cv = v.gasto / v.resultados;
    const ci = im.gasto / im.resultados;
    if (cv <= ci * 0.8) {
      frases.push(`Tus anuncios en video consiguen resultados ${pct(1 - cv / ci)} % más baratos que los de imagen.`);
      prompt.push('Sus anuncios en video rinden mejor que los de imagen: cuando el formato lo permita, prefiere ideas que se cuenten en video (reels).');
    } else if (ci <= cv * 0.8) {
      frases.push(`Tus anuncios con imagen consiguen resultados ${pct(1 - ci / cv)} % más baratos que los de video.`);
      prompt.push('Sus anuncios con imagen rinden mejor que los de video: cuida que cada post funcione con una sola imagen clara.');
    }
  }

  const lugar = ds.ubicaciones.filter((u) => u.resultados >= 3 && u.costoPorResultado != null && u.costoPorResultado <= promedio * 0.8)
    .sort((a, b) => a.costoPorResultado - b.costoPorResultado)[0];
  if (lugar) {
    const corto = lugar.nombre.split(' · ')[1] || lugar.nombre;
    frases.push(`${lugar.nombre} es donde tus anuncios rinden más: ${pct(1 - lugar.costoPorResultado / promedio)} % más barato que el promedio.`);
    prompt.push(`Donde mejor le va en anuncios: ${lugar.nombre}${/Reels|Historias/.test(corto) ? ' (formato vertical, lo importante en los primeros 2 segundos)' : ''}.`);
  }

  const gente = ds.edadSexo.filter((p) => p.resultados >= 3 && p.costoPorResultado != null && p.costoPorResultado <= promedio * 0.8 && NOMBRE_SEXO[p.sexo])
    .sort((a, b) => a.costoPorResultado - b.costoPorResultado)[0];
  if (gente) {
    frases.push(`Quienes más responden a tus anuncios: ${NOMBRE_SEXO[gente.sexo]} de ${gente.edad} años.`);
    prompt.push(`Quienes más responden a sus anuncios: ${NOMBRE_SEXO[gente.sexo]} de ${gente.edad} años (escribe pensando en ellos, sin excluir a nadie).`);
  }
  if (!frases.length) return null;
  return { frases, prompt, desde, hasta: hoy };
}

module.exports = { revisar, registrar, actualizar, mostrarOcultas, aplicar, delPeriodo, estadisticas, leccion, evaluar, detectar, REGLAS, DIAS_MEDIR };
