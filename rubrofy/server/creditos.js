// Créditos ⚡: un solo saldo para fotos y videos con IA.
//
// - Cada creación cuesta créditos según el modelo y, en video, la duración:
//   créditos = techo(costo real USD × dólar × (1 + comisión) ÷ valor de 1 ⚡).
//   Los videos se calculan por cada 5 segundos.
// - El saldo es la suma de los créditos del plan (se renuevan cada mes) y los
//   lotes de server/recargas.js con tipo "creditos": packs comprados, regalos
//   (bono de primera compra, referidos) y reembolsos. Los lotes duran 12 meses
//   y se gastan del más antiguo.
// - Se cobra primero del plan y después de los lotes. Si una creación falla,
//   se devuelve lo cobrado.
// - Todo lo que el administrador ajusta (comisión, dólar, modelos y su costo,
//   packs, créditos por plan, promociones) vive en la tabla creditos_config,
//   así se cambia desde /admin sin desplegar.
// - Si el proveedor se queda sin saldo, las creaciones se pausan un rato, no
//   se cobra nada y se avisa al administrador (ver pausar / pausa).

const store = require('./store');
const recargas = require('./recargas');

const MODELOS_BASE = [
  // Fotos: USD por imagen (open.higgsfield.ai/pricing, precio sin descuento).
  { id: 'soul_2', nombre: 'Soul 2', proveedor: 'Higgsfield', tipo: 'foto', calidad: 'recomendada', usd: 0.0057, ruta: 'higgsfield-ai/soul/v2/standard', familia: 'soul', activo: true },
  { id: 'z_image_turbo', nombre: 'Z-Image Turbo', proveedor: 'Alibaba', tipo: 'foto', calidad: 'rapida', usd: 0.015, ruta: 'z-image/turbo', familia: 'qwen', activo: false },
  { id: 'qwen_image_3', nombre: 'Qwen Image 3', proveedor: 'Alibaba', tipo: 'foto', calidad: 'premium', usd: 0.04, ruta: 'alibaba/qwen-image-3/text-to-image', familia: 'qwen', activo: true },
  { id: 'ideogram_4', nombre: 'Ideogram 4.0', proveedor: 'Ideogram', tipo: 'foto', calidad: 'premium', usd: 0.03, ruta: 'ideogram/v4.0', familia: 'ideogram', activo: false },
  // Edición de fotos (la foto del negocio + lo que escribe): USD por imagen.
  // GPT Image 2.5 se cobra por tokens: el precio es estimado, probar antes de activarlo.
  { id: 'qwen_edit_1k', nombre: 'Qwen Image 3 Edit', proveedor: 'Alibaba', tipo: 'edicion', calidad: 'recomendada', usd: 0.04, ruta: 'alibaba/qwen-image-3/edit', familia: 'qwen-edit', resolucion: '1k', activo: true },
  { id: 'qwen_edit_2k', nombre: 'Qwen Image 3 Edit 2K', proveedor: 'Alibaba', tipo: 'edicion', calidad: 'premium', usd: 0.075, ruta: 'alibaba/qwen-image-3/edit', familia: 'qwen-edit', resolucion: '2k', activo: true },
  { id: 'gpt_image_25_edit', nombre: 'GPT Image 2.5 (Flare)', proveedor: 'OpenAI', tipo: 'edicion', calidad: 'premium', usd: 0.15, ruta: 'marketing-studio/image/flare', familia: 'flare', resolucion: '1k', activo: false },
  // Videos: USD por segundo en formato vertical.
  { id: 'wan_3', nombre: 'Wan 3.0', proveedor: 'Alibaba', tipo: 'video', calidad: 'rapida', usd: 0.05, ruta: 'alibaba/wan-3.0', familia: 'wan', resolucion: '480p', activo: true },
  { id: 'kling_3_std', nombre: 'Kling 3.0', proveedor: 'Kling', tipo: 'video', calidad: 'recomendada', usd: 0.126, ruta: 'kling-video/v3.0/std', familia: 'kling', activo: true },
  { id: 'kling_3_pro', nombre: 'Kling 3.0 Pro', proveedor: 'Kling', tipo: 'video', calidad: 'premium', usd: 0.168, ruta: 'kling-video/v3.0/pro', familia: 'kling', activo: true },
  { id: 'seedance_2_0', nombre: 'Seedance 2.0', proveedor: 'Bytedance', tipo: 'video', calidad: 'premium', usd: 0.3024, ruta: 'bytedance/seedance-2.0', familia: 'seedance', resolucion: '720p', activo: false },
  { id: 'seedance_2_5', nombre: 'Seedance 2.5', proveedor: 'Bytedance', tipo: 'video', calidad: 'premium', usd: 0.4622, ruta: 'bytedance/seedance-2.5', familia: 'seedance', resolucion: '720p', activo: false },
];

const CONFIG_BASE = {
  parametros: { comision: 20, dolar: 1000, valorCredito: 70, flow: 3.5, videosSoloConPacks: false },
  modelos: MODELOS_BASE,
  packs: [
    { creditos: 50, precioClp: 4990 },
    { creditos: 150, precioClp: 12990, destacado: true },
    { creditos: 400, precioClp: 32990 },
  ],
  planes: { pro: 30, estudio: 120 },
  promo: { bono: 30, prueba: 20, referido: 25 },
};

const CALIDADES = {
  rapida: { nombre: 'Rápida', foto: 'Buena para el día a día', video: '480p · ideal para historias', edicion: 'Cambios simples' },
  recomendada: { nombre: 'Recomendada', foto: 'Realista, el mejor equilibrio', video: 'Alta calidad · con audio', edicion: 'Colores, fondo y textos' },
  premium: { nombre: 'Premium', foto: 'Máximo detalle y texto legible', video: 'Máxima calidad · audio · mejor movimiento', edicion: 'Más resolución y detalle' },
};
const DURACIONES = [5, 10, 15];

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS creditos_config (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS creditos_mov (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id TEXT NOT NULL,
    fecha TEXT NOT NULL,
    cantidad INTEGER NOT NULL,       -- + entra, - sale
    tipo TEXT NOT NULL,              -- compra | regalo | uso | reembolso
    detalle TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS creditos_mov_negocio ON creditos_mov (negocio_id, fecha);
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM creditos_mov WHERE negocio_id = ?').run(negocioId));
const sql = {
  getCfg: db.prepare('SELECT valor FROM creditos_config WHERE clave = ?'),
  setCfg: db.prepare('INSERT INTO creditos_config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'),
  mov: db.prepare('INSERT INTO creditos_mov (negocio_id, fecha, cantidad, tipo, detalle) VALUES (?, ?, ?, ?, ?)'),
  movs: db.prepare('SELECT * FROM creditos_mov WHERE negocio_id = ? ORDER BY id DESC LIMIT ?'),
  usoMes: db.prepare("SELECT COALESCE(SUM(-cantidad), 0) AS c, COUNT(*) AS n FROM creditos_mov WHERE tipo = 'uso' AND fecha >= ?"),
};

// --- configuración ---

const num = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

function config() {
  let guardada = {};
  try { guardada = JSON.parse((sql.getCfg.get('config') || {}).valor || '{}'); } catch { guardada = {}; }
  const c = JSON.parse(JSON.stringify(CONFIG_BASE));
  Object.assign(c.parametros, guardada.parametros || {});
  Object.assign(c.planes, guardada.planes || {});
  Object.assign(c.promo, guardada.promo || {});
  if (Array.isArray(guardada.packs) && guardada.packs.length) c.packs = guardada.packs;
  // Los modelos guardados ajustan a los de base (costo, calidad, activo); un
  // modelo nuevo en el código aparece con sus valores de base.
  const g = Object.fromEntries((guardada.modelos || []).map((m) => [m.id, m]));
  c.modelos = MODELOS_BASE.map((m) => Object.assign({}, m, g[m.id] ? { usd: g[m.id].usd, calidad: g[m.id].calidad, activo: g[m.id].activo } : {}));
  return c;
}

// Valida y guarda lo que manda /admin. Devuelve la config nueva o { error }.
function guardarConfig(entrada) {
  const c = config();
  const p = entrada.parametros || {};
  c.parametros = {
    comision: num(p.comision, 0, 300, c.parametros.comision),
    dolar: num(p.dolar, 300, 5000, c.parametros.dolar),
    valorCredito: num(p.valorCredito, 5, 10000, c.parametros.valorCredito),
    flow: num(p.flow, 0, 30, c.parametros.flow),
    videosSoloConPacks: p.videosSoloConPacks === undefined ? c.parametros.videosSoloConPacks : !!p.videosSoloConPacks,
  };
  if (Array.isArray(entrada.modelos)) {
    for (const m of entrada.modelos) {
      const actual = c.modelos.find((x) => x.id === m.id);
      if (!actual) continue;
      if (m.usd !== undefined) actual.usd = num(m.usd, 0, 100, actual.usd);
      if (CALIDADES[m.calidad]) actual.calidad = m.calidad;
      if (m.activo !== undefined) actual.activo = !!m.activo;
    }
  }
  // En cada tipo y calidad queda un solo modelo activo: gana el que se acaba
  // de activar en este guardado.
  const recien = new Set((entrada.modelos || []).filter((m) => m.activo).map((m) => m.id));
  const vistos = new Set();
  const orden = c.modelos.filter((m) => recien.has(m.id)).concat(c.modelos.filter((m) => !recien.has(m.id)));
  for (const m of orden) {
    const k = m.tipo + ':' + m.calidad;
    if (m.activo && vistos.has(k)) m.activo = false;
    if (m.activo) vistos.add(k);
  }
  if (!c.modelos.some((m) => m.tipo === 'foto' && m.activo)) return { error: 'Deja al menos un modelo de fotos activo.' };
  if (!c.modelos.some((m) => m.tipo === 'video' && m.activo)) return { error: 'Deja al menos un modelo de videos activo.' };
  if (Array.isArray(entrada.packs)) {
    const packs = entrada.packs.map((x) => ({ creditos: Math.round(num(x.creditos, 1, 100000, 0)), precioClp: Math.round(num(x.precioClp, 0, 10000000, 0)), destacado: !!x.destacado }))
      .filter((x) => x.creditos > 0 && x.precioClp >= 500);
    if (!packs.length) return { error: 'Deja al menos un pack de créditos con precio.' };
    if (new Set(packs.map((x) => x.creditos)).size !== packs.length) return { error: 'Dos packs no pueden tener la misma cantidad de créditos.' };
    c.packs = packs.sort((a, b) => a.creditos - b.creditos).slice(0, 6);
  }
  if (entrada.planes) for (const k of Object.keys(c.planes)) c.planes[k] = Math.round(num(entrada.planes[k], 0, 100000, c.planes[k]));
  if (entrada.promo) for (const k of Object.keys(c.promo)) c.promo[k] = Math.round(num(entrada.promo[k], 0, k === 'bono' ? 200 : 10000, c.promo[k]));
  sql.setCfg.run('config', JSON.stringify({ parametros: c.parametros, modelos: c.modelos.map((m) => ({ id: m.id, usd: m.usd, calidad: m.calidad, activo: m.activo })), packs: c.packs, planes: c.planes, promo: c.promo }));
  return config();
}

// --- costos ---

function creditosModelo(m, c = config()) {
  const p = c.parametros;
  const usd = m.tipo === 'video' ? m.usd * 5 : m.usd; // video: por cada 5 s
  return Math.max(1, Math.ceil(usd * p.dolar * (1 + p.comision / 100) / p.valorCredito));
}

function modeloDe(tipo, calidad, c = config()) {
  return c.modelos.find((m) => m.tipo === tipo && m.calidad === calidad && m.activo) || null;
}

function segundosValidos(s) { return DURACIONES.includes(Number(s)) ? Number(s) : 5; }

// Lo que cuesta una creación: { modelo, creditos, segundos } o null si esa calidad no está.
function costo(tipo, calidad, segundos, c = config()) {
  const m = modeloDe(tipo, CALIDADES[calidad] ? calidad : 'recomendada', c) || modeloDe(tipo, 'recomendada', c)
    || c.modelos.find((x) => x.tipo === tipo && x.activo);
  if (!m) return null;
  const seg = tipo === 'video' ? segundosValidos(segundos) : 0;
  return { modelo: m, calidad: m.calidad, segundos: seg, creditos: creditosModelo(m, c) * (tipo === 'video' ? seg / 5 : 1) };
}

// Opciones para el panel: cada calidad con su modelo y cuánto cuesta.
function opciones(c = config()) {
  const out = {};
  for (const tipo of ['foto', 'video', 'edicion']) {
    out[tipo] = Object.entries(CALIDADES).map(([id, q]) => {
      const m = modeloDe(tipo, id, c);
      return m ? { calidad: id, nombre: q.nombre, detalle: q[tipo], modelo: m.nombre, creditos: creditosModelo(m, c) } : null;
    }).filter(Boolean);
  }
  return { opciones: out, duraciones: DURACIONES };
}

// --- saldo ---

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function enPrueba(negocio) {
  return !!(negocio.prueba && !negocio.prueba.terminada && Date.parse(negocio.prueba.hasta) > Date.now());
}

// Créditos del plan para este mes. En la prueba gratis, los de regalo de la prueba.
function delPlan(negocio, c = config()) {
  const plan = negocio.plan || 'gratis';
  if (plan === 'gratis') return 0;
  if (enPrueba(negocio)) return c.promo.prueba;
  return c.planes[plan] || 0;
}

function usadoPlan(negocio) {
  const u = negocio.creditosPlan;
  return u && u.mes === mesActual() ? u.usados : 0;
}

function saldo(negocio, c = config()) {
  const plan = Math.max(0, delPlan(negocio, c) - usadoPlan(negocio));
  const packs = recargas.saldo(negocio.id, 'creditos');
  return { plan, packs, total: plan + packs, planMes: delPlan(negocio, c) };
}

// Cuánto puede gastar en este tipo de creación (con "videos solo con packs",
// los créditos del plan no sirven para videos).
function disponible(negocio, tipo, c = config()) {
  const s = saldo(negocio, c);
  return tipo === 'video' && c.parametros.videosSoloConPacks ? s.packs : s.total;
}

// Cobra sobre el negocio recién leído de disco. Devuelve { dePlan, dePacks }
// para poder devolverlo, o null si no alcanza.
function cobrar(negocioId, cantidad, { tipo, detalle }) {
  const c = config();
  let cobro = null;
  store.transaccion(() => {
    const n = store.getNegocio(negocioId);
    if (!n || cantidad <= 0 || disponible(n, tipo, c) < cantidad) return;
    const mes = mesActual();
    if (!n.creditosPlan || n.creditosPlan.mes !== mes) n.creditosPlan = { mes, usados: 0 };
    const libresPlan = tipo === 'video' && c.parametros.videosSoloConPacks ? 0 : Math.max(0, delPlan(n, c) - n.creditosPlan.usados);
    const dePlan = Math.min(cantidad, libresPlan);
    n.creditosPlan.usados += dePlan;
    const dePacks = cantidad - dePlan;
    if (dePacks) recargas.consumir(negocioId, 'creditos', dePacks);
    store.saveNegocio(n);
    sql.mov.run(negocioId, new Date().toISOString(), -cantidad, 'uso', detalle);
    cobro = { dePlan, dePacks, mes, cantidad, detalle };
  });
  return cobro;
}

// Devuelve un cobro que no llegó a nada: lo del plan vuelve al mes en que se
// cobró; lo de packs vuelve como un lote nuevo de 12 meses.
function devolver(negocioId, cobro, motivo) {
  if (!cobro || !cobro.cantidad) return;
  store.transaccion(() => {
    const n = store.getNegocio(negocioId);
    if (!n) return;
    if (cobro.dePlan && n.creditosPlan && n.creditosPlan.mes === cobro.mes) {
      n.creditosPlan.usados = Math.max(0, n.creditosPlan.usados - cobro.dePlan);
      store.saveNegocio(n);
    }
    if (cobro.dePacks) recargas.regalar(negocioId, 'creditos', cobro.dePacks, 'reembolso');
    sql.mov.run(negocioId, new Date().toISOString(), cobro.cantidad, 'reembolso', motivo || 'Devolución: ' + cobro.detalle);
  });
}

function regalar(negocioId, cantidad, motivo, detalle) {
  if (!(cantidad > 0)) return;
  recargas.regalar(negocioId, 'creditos', cantidad, motivo);
  sql.mov.run(negocioId, new Date().toISOString(), cantidad, 'regalo', detalle);
}

// Al acreditarse un pack pagado: movimiento y, si es su primera compra, el bono.
function alAcreditarPack(lote) {
  if (lote.tipo !== 'creditos' || lote.paquete === 'regalo') return;
  sql.mov.run(lote.negocio_id, new Date().toISOString(), lote.cantidad, 'compra', `Pack ${lote.cantidad} créditos`);
  const c = config();
  const compras = recargas.comprasPagadas(lote.negocio_id, 'creditos');
  if (compras === 1 && c.promo.bono > 0) {
    const bono = Math.round(lote.cantidad * c.promo.bono / 100);
    regalar(lote.negocio_id, bono, 'bono', `Regalo de primera compra (+${c.promo.bono}%)`);
  }
}
recargas.alAcreditar(alAcreditarPack);

function movimientos(negocioId, limite = 30) {
  return sql.movs.all(negocioId, limite).map((m) => ({ fecha: m.fecha, cantidad: m.cantidad, tipo: m.tipo, detalle: m.detalle }));
}

// --- referidos ---

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codigoReferido(negocio) {
  if (negocio.codigoReferido) return negocio.codigoReferido;
  let codigo;
  const usados = new Set(store.listNegocios().map((n) => n.codigoReferido).filter(Boolean));
  do {
    codigo = Array.from({ length: 6 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
  } while (usados.has(codigo));
  const fresco = store.getNegocio(negocio.id);
  if (fresco) { fresco.codigoReferido = codigo; store.saveNegocio(fresco); }
  negocio.codigoReferido = codigo;
  return codigo;
}

function negocioDeCodigo(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) return null;
  return store.listNegocios().find((n) => n.codigoReferido === c) || null;
}

// Cuando quien llegó con un enlace ya paga su plan, los dos reciben el regalo
// (una sola vez). suscrito(n) dice si el negocio paga.
function revisarReferidos(suscrito) {
  const c = config();
  if (!c.promo.referido) return 0;
  let n = 0;
  for (const neg of store.listNegocios()) {
    if (!neg.referidoPor || neg.referidoAcreditado || !suscrito(neg)) continue;
    const padrino = store.getNegocio(neg.referidoPor);
    const fresco = store.getNegocio(neg.id);
    fresco.referidoAcreditado = new Date().toISOString();
    store.saveNegocio(fresco);
    regalar(neg.id, c.promo.referido, 'referido', 'Regalo por llegar con una invitación');
    if (padrino) regalar(padrino.id, c.promo.referido, 'referido', `Regalo por invitar a ${neg.nombre}`);
    n++;
  }
  return n;
}

// --- pausa por falta de saldo en el proveedor ---

const PAUSA_MIN = () => Number(process.env.CREDITOS_PAUSA_MIN) || 30;

function pausa() {
  try {
    const p = JSON.parse((sql.getCfg.get('pausa') || {}).valor || 'null');
    if (!p) return null;
    // Pasado el rato se deja intentar de nuevo; si sigue sin saldo, vuelve a pausarse.
    if (Date.now() - Date.parse(p.desde) > PAUSA_MIN() * 60000) return null;
    return p;
  } catch { return null; }
}

function pausar(proveedor, motivo) {
  const ya = pausa();
  sql.setCfg.run('pausa', JSON.stringify({ proveedor, motivo, desde: new Date().toISOString() }));
  return !ya; // true la primera vez, para avisar una sola vez
}

function reanudar() { sql.setCfg.run('pausa', 'null'); }

// --- resumen para /admin ---

function resumenAdmin() {
  const c = config();
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const u = sql.usoMes.get(inicioMes.toISOString());
  const peor = Math.max(...c.modelos.filter((m) => m.activo).map((m) => (m.tipo === 'video' ? m.usd * 5 : m.usd) * c.parametros.dolar / creditosModelo(m, c)));
  return {
    config: c,
    calidades: CALIDADES,
    modelos: c.modelos.map((m) => ({ ...m, creditos: creditosModelo(m, c), costoClp: Math.round((m.tipo === 'video' ? m.usd * 5 : m.usd) * c.parametros.dolar) })),
    packs: c.packs.map((p) => {
      const neto = p.precioClp / 1.19 - p.precioClp * c.parametros.flow / 100;
      const costoMax = p.creditos * peor;
      return { ...p, neto: Math.round(neto), costoMax: Math.round(costoMax), ganancia: Math.round(neto - costoMax) };
    }),
    costoCreditoMax: Math.round(peor),
    usoMes: { creditos: u.c, creaciones: u.n },
    pausa: pausa(),
  };
}

// Packs como paquetes de server/recargas.js.
function paquetes() {
  const c = config();
  const peor = resumenAdmin().costoCreditoMax;
  return c.packs.map((p) => ({ id: 'creditos-' + p.creditos, tipo: 'creditos', cantidad: p.creditos, precioClp: p.precioClp, costoClp: peor, destacado: !!p.destacado }));
}
recargas.paquetesDinamicos(paquetes);

// Lo que el panel muestra del saldo y de las promociones.
function publico(negocio) {
  const c = config();
  const s = saldo(negocio, c);
  return {
    saldo: s.total, plan: s.plan, packs: s.packs, planMes: s.planMes,
    videosSoloConPacks: c.parametros.videosSoloConPacks,
    bonoPrimeraCompra: recargas.comprasPagadas(negocio.id, 'creditos') === 0 ? c.promo.bono : 0,
    referido: c.promo.referido,
    pausa: !!pausa(),
    ...opciones(c),
  };
}

module.exports = {
  CALIDADES, DURACIONES, config, guardarConfig, costo, opciones, saldo, disponible, cobrar, devolver, regalar, movimientos,
  codigoReferido, negocioDeCodigo, revisarReferidos, pausa, pausar, reanudar, resumenAdmin, publico, creditosModelo, enPrueba,
};
