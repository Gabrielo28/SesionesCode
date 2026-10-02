// Recargas: paquetes que el negocio compra con un pago único cuando se le
// acaba el cupo del mes (piezas con IA, fotos, videos o reels editados).
//
// - Cada compra es un lote con su propio vencimiento (12 meses) y lo que le
//   queda. Se consume del lote más antiguo que no haya vencido.
// - Se usa solo después del cupo del mes (ver registrarUsoIA en server.js).
// - Se paga con Stripe Checkout en modo "payment" (no es una suscripción).
//   El lote nace "pendiente" y el webhook checkout.session.completed lo
//   marca pagado; un evento repetido no lo acredita dos veces.
// - Los precios incluyen IVA. El costo de IA es el del peor caso, para que
//   /admin muestre una ganancia conservadora.

const crypto = require('crypto');
const store = require('./store');

const MESES_VIGENCIA = 12;
const TIPOS = {
  piezas: { nombre: 'piezas con IA', campo: 'usoTextosIA' },
  fotos: { nombre: 'fotos con IA', campo: 'usoFotosIA' },
  videos: { nombre: 'videos con IA', campo: 'usoVideosIA' },
  reels: { nombre: 'reels editados', campo: 'usoReelsEditados' },
  creditos: { nombre: 'créditos para fotos y videos con IA', campo: null }, // fotos y videos con IA (server/creditos.js)
};
// costoClp: costo de IA por unidad en el peor caso (dólar a 950). Piezas: con
// Claude Sonnet 5.5 y su pensamiento (con Haiku 4.5 eran unos $8).
const PAQUETES = [
  { id: 'piezas-50', tipo: 'piezas', cantidad: 50, precioClp: 3990, costoClp: 20 },
  { id: 'piezas-150', tipo: 'piezas', cantidad: 150, precioClp: 9990, costoClp: 20, destacado: true },
  { id: 'reels-10', tipo: 'reels', cantidad: 10, precioClp: 2990, costoClp: 20 },
];
const COMISION_STRIPE = 0.04;
const IVA = 0.19;

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS recargas (
    id TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    paquete TEXT NOT NULL,
    tipo TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    restante INTEGER NOT NULL,
    precio_clp INTEGER NOT NULL,
    estado TEXT NOT NULL,            -- pendiente | pagada | simulada
    stripe_session TEXT,
    creado_el TEXT NOT NULL,
    pagado_el TEXT,
    vence_el TEXT
  );
  CREATE INDEX IF NOT EXISTS recargas_negocio ON recargas (negocio_id, tipo);
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM recargas WHERE negocio_id = ?').run(negocioId));

const sql = {
  crear: db.prepare(`INSERT INTO recargas (id, negocio_id, paquete, tipo, cantidad, restante, precio_clp, estado, creado_el)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  get: db.prepare('SELECT * FROM recargas WHERE id = ?'),
  sesion: db.prepare('UPDATE recargas SET stripe_session = ? WHERE id = ?'),
  pagar: db.prepare("UPDATE recargas SET estado = ?, pagado_el = ?, vence_el = ?, stripe_session = COALESCE(?, stripe_session) WHERE id = ? AND estado = 'pendiente'"),
  vigentes: db.prepare("SELECT * FROM recargas WHERE negocio_id = ? AND tipo = ? AND estado IN ('pagada', 'simulada', 'regalo') AND restante > 0 AND vence_el > ? ORDER BY pagado_el, rowid"),
  pagadas: db.prepare("SELECT COUNT(*) AS n FROM recargas WHERE negocio_id = ? AND tipo = ? AND estado IN ('pagada', 'simulada')"),
  regalo: db.prepare(`INSERT INTO recargas (id, negocio_id, paquete, tipo, cantidad, restante, precio_clp, estado, creado_el, pagado_el, vence_el)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'regalo', ?, ?, ?)`),
  descontar: db.prepare('UPDATE recargas SET restante = restante - ? WHERE id = ?'),
  delNegocio: db.prepare("SELECT * FROM recargas WHERE negocio_id = ? AND estado IN ('pagada', 'simulada') ORDER BY pagado_el DESC LIMIT 20"),
  viejos: db.prepare("SELECT * FROM recargas WHERE tipo IN ('fotos', 'videos') AND estado IN ('pagada', 'simulada') AND restante > 0"),
  aCreditos: db.prepare("UPDATE recargas SET tipo = 'creditos', cantidad = ?, restante = ? WHERE id = ?"),
  vendidas: db.prepare("SELECT * FROM recargas WHERE estado IN ('pagada', 'simulada') AND pagado_el >= ? ORDER BY pagado_el DESC"),
};

// Los packs de créditos los define server/creditos.js (se editan en /admin).
let dinamicos = () => [];
function paquetesDinamicos(fn) { dinamicos = fn; }
const todos = () => PAQUETES.concat(dinamicos());
const paquete = (id) => todos().find((p) => p.id === id) || null;
let hookAcreditar = null;
function alAcreditar(fn) { hookAcreditar = fn; }

function tipoDeCampo(campo) {
  return Object.keys(TIPOS).find((t) => TIPOS[t].campo === campo) || null;
}

function saldo(negocioId, tipo, ahora = new Date()) {
  return sql.vigentes.all(negocioId, tipo, ahora.toISOString()).reduce((t, r) => t + r.restante, 0);
}

function saldos(negocioId) {
  const out = {};
  for (const t of Object.keys(TIPOS)) out[t] = saldo(negocioId, t);
  return out;
}

// Descuenta del lote vigente más antiguo. Devuelve cuánto no alcanzó a cubrir.
function consumir(negocioId, tipo, cantidad, ahora = new Date()) {
  let falta = cantidad;
  store.transaccion(() => {
    for (const lote of sql.vigentes.all(negocioId, tipo, ahora.toISOString())) {
      if (falta <= 0) break;
      const usa = Math.min(falta, lote.restante);
      sql.descontar.run(usa, lote.id);
      falta -= usa;
    }
  });
  return falta;
}

// Quién puede comprar: un plan pagado (o la cuenta administradora, para
// probar). La prueba gratis y "sin plan" primero eligen un plan.
function puedeComprar(negocio, esAdmin) {
  if ((negocio.plan || 'gratis') === 'gratis') return { ok: false, motivo: 'Elige un plan para poder cargar más.' };
  const enPrueba = negocio.prueba && !negocio.prueba.terminada && Date.parse(negocio.prueba.hasta) > Date.now();
  if (enPrueba && !esAdmin) return { ok: false, motivo: 'Durante la prueba gratis no se pueden comprar recargas. Elige un plan para seguir.' };
  return { ok: true };
}

function crearPendiente(negocioId, paqueteId, estado = 'pendiente') {
  const p = paquete(paqueteId);
  if (!p) return null;
  const id = 'rc_' + crypto.randomBytes(9).toString('hex');
  sql.crear.run(id, negocioId, p.id, p.tipo, p.cantidad, p.cantidad, p.precioClp, estado, new Date().toISOString());
  return { id, paquete: p };
}

function venceDesde(fecha) {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + MESES_VIGENCIA);
  return d.toISOString();
}

// Acredita un lote pendiente (webhook de Stripe o compra simulada).
// Devuelve el lote acreditado, o null si no existía o ya estaba acreditado.
function acreditar(recargaId, { sesion = null, simulada = false, ahora = new Date() } = {}) {
  const cambios = sql.pagar.run(simulada ? 'simulada' : 'pagada', ahora.toISOString(), venceDesde(ahora), sesion, recargaId).changes;
  const lote = cambios ? sql.get.get(recargaId) : null;
  if (lote && hookAcreditar) hookAcreditar(lote);
  return lote;
}

// Un lote que no se compra: bono, referido o devolución. Dura lo mismo que un pack.
function regalar(negocioId, tipo, cantidad, motivo, ahora = new Date()) {
  const id = 'rg_' + crypto.randomBytes(9).toString('hex');
  sql.regalo.run(id, negocioId, 'regalo', tipo, cantidad, cantidad, ahora.toISOString(), ahora.toISOString(), venceDesde(ahora));
  return id;
}

function comprasPagadas(negocioId, tipo) {
  return sql.pagadas.get(negocioId, tipo).n;
}

function obtener(recargaId) {
  return recargaId ? sql.get.get(String(recargaId)) || null : null;
}

function registrarSesion(recargaId, sesionId) {
  sql.sesion.run(sesionId, recargaId);
}

function historial(negocioId) {
  return sql.delNegocio.all(negocioId).map((r) => ({
    fecha: r.pagado_el, tipo: r.tipo, nombre: TIPOS[r.tipo].nombre, cantidad: r.cantidad, restante: r.restante,
    precioClp: r.precio_clp, venceEl: r.vence_el, simulada: r.estado === 'simulada',
  }));
}

// Cuentas de una venta: lo que queda después de IVA, comisión y costo de IA.
function cuentas(p) {
  const neto = p.precioClp / (1 + IVA);
  const comision = p.precioClp * COMISION_STRIPE;
  const ia = p.cantidad * p.costoClp;
  return { neto: Math.round(neto), iva: Math.round(p.precioClp - neto), comision: Math.round(comision), ia, ganancia: Math.round(neto - comision - ia) };
}

function catalogo() {
  return {
    vigenciaMeses: MESES_VIGENCIA,
    tipos: Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, v.nombre])),
    paquetes: todos().map((p) => ({ id: p.id, tipo: p.tipo, cantidad: p.cantidad, precioClp: p.precioClp, destacado: !!p.destacado })),
  };
}

// Para /admin: ventas del período, sin contar las simuladas como ingreso.
function resumenAdmin({ dias = 30, nombreDe }) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const filas = sql.vendidas.all(desde);
  let ingresos = 0, ganancia = 0, ventas = 0;
  const lista = filas.map((r) => {
    const p = paquete(r.paquete) || { cantidad: r.cantidad, precioClp: r.precio_clp, costoClp: 0 };
    const c = cuentas(p);
    const real = r.estado === 'pagada';
    if (real) { ingresos += r.precio_clp; ganancia += c.ganancia; ventas += 1; }
    return { fecha: r.pagado_el, negocio: nombreDe(r.negocio_id), nombre: `${r.cantidad} ${TIPOS[r.tipo].nombre}`, precioClp: r.precio_clp, ganancia: c.ganancia, simulada: !real };
  });
  return { dias, ventas, ingresosClp: ingresos, gananciaClp: ganancia, lista: lista.slice(0, 30) };
}

// Las recargas de fotos y videos de antes pasan a créditos: 1 ⚡ por foto y
// 13 ⚡ por video (lo que costaba un video de 5 s al pasar a créditos).
function migrarACreditos() {
  let n = 0;
  store.transaccion(() => {
    for (const r of sql.viejos.all()) {
      const factor = r.tipo === 'videos' ? 13 : 1;
      sql.aCreditos.run(r.cantidad * factor, r.restante * factor, r.id);
      n++;
    }
  });
  return n;
}
migrarACreditos();

module.exports = {
  obtener, regalar, comprasPagadas, paquetesDinamicos, alAcreditar, todos,
  TIPOS, PAQUETES, paquete, tipoDeCampo, saldo, saldos, consumir, puedeComprar, crearPendiente, acreditar,
  registrarSesion, historial, cuentas, catalogo, resumenAdmin,
};
