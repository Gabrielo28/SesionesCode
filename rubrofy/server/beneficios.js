// Beneficios que otorga quien administra Rubrofy (/admin → Beneficios):
//
// 1. Plan de regalo: Pro o Estudio sin costo ni tarjeta para una cuenta
//    elegida, por un tiempo o sin límite, con un motivo. Queda en
//    negocio.planRegalado = { plan, desde, hasta|null, motivo }. No cuenta
//    como ingreso en /admin. Al vencer (o si se revoca) la cuenta vuelve a
//    sin plan, salvo que pague o siga en su prueba gratis. Si la cuenta se
//    suscribe pagando, el regalo termina y manda el plan pagado.
//
// 2. Códigos de descuento: un porcentaje o un monto en pesos sobre Pro,
//    Estudio o ambos, por algunos meses o para siempre, con un máximo de usos
//    y fecha de vencimiento opcionales. El negocio lo ingresa al elegir su
//    plan; se aplica como cupón de Flow en la suscripción (solo con Flow).
//    Un código se usa una vez por negocio.

const store = require('./store');
const { PLANES } = require('./planes');

const DIA = 24 * 3600 * 1000;
const PLANES_PAGADOS = Object.keys(PLANES).filter((p) => p !== 'gratis');

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS codigos_descuento (
    codigo TEXT PRIMARY KEY,           -- en mayúsculas
    tipo TEXT NOT NULL,                -- porcentaje | monto
    valor REAL NOT NULL,               -- 1-100 (%) o pesos
    planes TEXT NOT NULL,              -- "pro,estudio"
    meses INTEGER NOT NULL,            -- 0 = mientras dure la suscripción
    max_usos INTEGER,                  -- null = sin límite
    usos INTEGER NOT NULL DEFAULT 0,
    vence_el TEXT,                     -- último día en que se puede usar (YYYY-MM-DD)
    nota TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    flow_cupon TEXT,                   -- id del cupón en Flow (se crea al primer uso)
    creado_el TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS canjes_descuento (
    codigo TEXT NOT NULL,
    negocio_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    fecha TEXT NOT NULL,
    PRIMARY KEY (codigo, negocio_id)
  );
  CREATE TABLE IF NOT EXISTS regalos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id TEXT NOT NULL,
    negocio_nombre TEXT NOT NULL,
    email TEXT,
    plan TEXT NOT NULL,
    desde TEXT NOT NULL,
    hasta TEXT,
    motivo TEXT,
    terminado_el TEXT,
    fin TEXT                           -- vencio | revocado | suscripcion | eliminada
  );
`);
store.registrarLimpieza((negocioId) => {
  db.prepare("UPDATE regalos SET terminado_el = COALESCE(terminado_el, ?), fin = COALESCE(fin, 'eliminada') WHERE negocio_id = ?").run(new Date().toISOString(), negocioId);
  db.prepare('DELETE FROM canjes_descuento WHERE negocio_id = ?').run(negocioId);
});

const sql = {
  codigo: db.prepare('SELECT * FROM codigos_descuento WHERE codigo = ?'),
  codigos: db.prepare('SELECT * FROM codigos_descuento ORDER BY creado_el DESC'),
  crearCodigo: db.prepare(`INSERT INTO codigos_descuento (codigo, tipo, valor, planes, meses, max_usos, vence_el, nota, creado_el)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  activar: db.prepare('UPDATE codigos_descuento SET activo = ? WHERE codigo = ?'),
  cupon: db.prepare('UPDATE codigos_descuento SET flow_cupon = ? WHERE codigo = ?'),
  usado: db.prepare('SELECT 1 FROM canjes_descuento WHERE codigo = ? AND negocio_id = ?'),
  canjear: db.prepare('INSERT OR IGNORE INTO canjes_descuento (codigo, negocio_id, plan, fecha) VALUES (?, ?, ?, ?)'),
  sumarUso: db.prepare('UPDATE codigos_descuento SET usos = usos + 1 WHERE codigo = ?'),
  regalar: db.prepare('INSERT INTO regalos (negocio_id, negocio_nombre, email, plan, desde, hasta, motivo) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  terminarRegalo: db.prepare("UPDATE regalos SET terminado_el = ?, fin = ? WHERE negocio_id = ? AND terminado_el IS NULL"),
  regalos: db.prepare('SELECT * FROM regalos ORDER BY desde DESC LIMIT 200'),
};

const txt = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const hoy = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 10);

// --- Plan de regalo ---

function regaloVigente(negocio, ahora = Date.now()) {
  const r = negocio && negocio.planRegalado;
  return !!(r && PLANES[r.plan] && (!r.hasta || Date.parse(r.hasta) > ahora));
}

// El plan que le corresponde a una cuenta que no paga (regalo vigente o sin plan).
function planSinPago(negocio, ahora = Date.now()) {
  return regaloVigente(negocio, ahora) ? negocio.planRegalado.plan : 'gratis';
}

// Otorga un plan de regalo al negocio (ya leído). meses: 0 = sin límite.
// Devuelve { negocio } o { error }. No guarda: lo hace quien llama.
function regalar(negocio, { plan, meses, motivo }, { suscrito, ahora = Date.now() } = {}) {
  if (!PLANES_PAGADOS.includes(plan)) return { error: 'Elige Pro o Estudio' };
  const m = Number(meses);
  if (!Number.isInteger(m) || m < 0 || m > 36) return { error: 'La duración va de 1 a 36 meses (o sin límite)' };
  if (suscrito) return { error: 'Esta cuenta ya paga una suscripción. Para regalarle meses, que la cancele primero, o dale un código de descuento.' };
  const desde = new Date(ahora);
  let hasta = null;
  if (m > 0) { const h = new Date(ahora); h.setMonth(h.getMonth() + m); hasta = h.toISOString(); }
  if (negocio.planRegalado) sql.terminarRegalo.run(desde.toISOString(), 'reemplazado', negocio.id);
  negocio.planRegalado = { plan, desde: desde.toISOString(), hasta, motivo: txt(motivo, 200) };
  negocio.plan = plan;
  // Mientras tenga el regalo, la prueba gratis no aplica.
  if (negocio.prueba && !negocio.prueba.terminada) negocio.prueba.terminada = 'regalo';
  sql.regalar.run(negocio.id, negocio.nombre, negocio.email || '', plan, desde.toISOString(), hasta, negocio.planRegalado.motivo);
  return { negocio };
}

// Termina el regalo (revocado, vencido o porque ahora paga). No guarda.
function terminarRegalo(negocio, fin, { suscrito, ahora = Date.now() } = {}) {
  if (!negocio.planRegalado) return false;
  delete negocio.planRegalado;
  sql.terminarRegalo.run(new Date(ahora).toISOString(), fin, negocio.id);
  if (!suscrito && fin !== 'suscripcion') {
    const pv = negocio.prueba && !negocio.prueba.terminada && Date.parse(negocio.prueba.hasta) > ahora;
    negocio.plan = pv ? negocio.prueba.plan : 'gratis';
  }
  return true;
}

// Termina los regalos vencidos. suscrito(negocio) → bool. Devuelve los ids.
function revisarRegalos(suscrito, ahora = Date.now()) {
  const vencidos = [];
  for (const n of store.listNegocios()) {
    const r = n.planRegalado;
    if (!r || !r.hasta || Date.parse(r.hasta) > ahora) continue;
    const fresco = store.getNegocio(n.id);
    terminarRegalo(fresco, 'vencio', { suscrito: suscrito(fresco), ahora });
    store.saveNegocio(fresco);
    vencidos.push(n.id);
  }
  return vencidos;
}

function listarRegalos(ahora = Date.now()) {
  return sql.regalos.all().map((r) => ({
    id: r.id, negocioId: r.negocio_id, negocio: r.negocio_nombre, email: r.email, plan: r.plan,
    desde: r.desde, hasta: r.hasta, motivo: r.motivo || '',
    estado: r.terminado_el ? (r.fin || 'terminado') : (r.hasta && Date.parse(r.hasta) <= ahora ? 'vencio' : 'vigente'),
    terminadoEl: r.terminado_el,
  }));
}

// --- Códigos de descuento ---

const normalizarCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);

function crearCodigo(body, ahora = Date.now()) {
  const b = body || {};
  const codigo = normalizarCodigo(b.codigo);
  if (codigo.length < 3) return { error: 'El código necesita al menos 3 letras o números', campo: 'codigo' };
  if (sql.codigo.get(codigo)) return { error: 'Ese código ya existe', campo: 'codigo' };
  const tipo = b.tipo === 'monto' ? 'monto' : 'porcentaje';
  const valor = Math.round(Number(b.valor) * 100) / 100;
  if (tipo === 'porcentaje' && !(valor > 0 && valor <= 100)) return { error: 'El porcentaje va de 1 a 100', campo: 'valor' };
  if (tipo === 'monto' && !(Number.isInteger(valor) && valor > 0 && valor < 1000000)) return { error: 'Escribe un monto en pesos, sin puntos', campo: 'valor' };
  let planes = Array.isArray(b.planes) ? b.planes : String(b.planes || '').split(',');
  planes = planes.map((p) => String(p).trim()).filter((p) => PLANES_PAGADOS.includes(p));
  if (!planes.length) planes = PLANES_PAGADOS.slice();
  const meses = Number(b.meses || 0);
  if (!Number.isInteger(meses) || meses < 0 || meses > 36) return { error: 'La duración va de 1 a 36 meses (o para siempre)', campo: 'meses' };
  const maxUsos = b.maxUsos === '' || b.maxUsos == null ? null : Number(b.maxUsos);
  if (maxUsos !== null && !(Number.isInteger(maxUsos) && maxUsos > 0)) return { error: 'El máximo de usos es un número entero', campo: 'maxUsos' };
  const vence = b.venceEl ? String(b.venceEl).slice(0, 10) : null;
  if (vence && (!/^\d{4}-\d{2}-\d{2}$/.test(vence) || vence < hoy(ahora))) return { error: 'La fecha de vencimiento no puede ser pasada', campo: 'venceEl' };
  sql.crearCodigo.run(codigo, tipo, valor, planes.join(','), meses, maxUsos, vence, txt(b.nota, 200), new Date(ahora).toISOString());
  return { codigo: publicoCodigo(sql.codigo.get(codigo)) };
}

function publicoCodigo(c) {
  return {
    codigo: c.codigo, tipo: c.tipo, valor: c.valor, planes: c.planes.split(','), meses: c.meses,
    maxUsos: c.max_usos, usos: c.usos, venceEl: c.vence_el, nota: c.nota || '', activo: !!c.activo,
  };
}

function listarCodigos() {
  return sql.codigos.all().map(publicoCodigo);
}

function activarCodigo(codigo, activo) {
  return sql.activar.run(activo ? 1 : 0, normalizarCodigo(codigo)).changes > 0;
}

// Texto para el cliente: "20% de descuento por 3 meses".
function describir(c) {
  const cuanto = c.tipo === 'porcentaje' ? `${String(c.valor).replace('.', ',')}% de descuento` : `$${Number(c.valor).toLocaleString('es-CL')} de descuento al mes`;
  const cuando = c.meses === 0 ? 'mientras mantengas tu plan' : c.meses === 1 ? 'el primer mes' : `por ${c.meses} meses`;
  return `${cuanto} ${cuando}`;
}

// ¿Puede este negocio usar el código en este plan? Devuelve { codigo } o { error }.
// Sin plan: valida que el código sirva para algún plan.
function validarCodigo(texto, negocioId, plan, ahora = Date.now()) {
  const c = sql.codigo.get(normalizarCodigo(texto));
  if (!c || !c.activo) return { error: 'Ese código no existe o ya no está activo' };
  if (c.vence_el && c.vence_el < hoy(ahora)) return { error: 'Ese código ya venció' };
  if (c.max_usos !== null && c.usos >= c.max_usos) return { error: 'Ese código ya se usó todas las veces que permitía' };
  if (sql.usado.get(c.codigo, negocioId)) return { error: 'Ya usaste ese código' };
  const planes = c.planes.split(',');
  if (plan && !planes.includes(plan)) return { error: `Ese código es solo para el plan ${planes.map((p) => PLANES[p].nombre).join(' o ')}` };
  return { codigo: Object.assign(publicoCodigo(c), { descripcion: describir(c) }), fila: c };
}

// Precio mensual con el descuento (para mostrarlo).
function precioConDescuento(precio, c) {
  if (!c) return precio;
  const d = c.tipo === 'porcentaje' ? Math.round(precio * c.valor / 100) : c.valor;
  return Math.max(0, precio - d);
}

function registrarCanje(codigo, negocioId, plan, ahora = Date.now()) {
  return store.transaccion(() => {
    const r = sql.canjear.run(normalizarCodigo(codigo), negocioId, plan, new Date(ahora).toISOString());
    if (r.changes) sql.sumarUso.run(normalizarCodigo(codigo));
    return r.changes > 0;
  });
}

function guardarCuponFlow(codigo, cuponId) {
  sql.cupon.run(String(cuponId), normalizarCodigo(codigo));
}

module.exports = {
  PLANES_PAGADOS, regaloVigente, planSinPago, regalar, terminarRegalo, revisarRegalos, listarRegalos,
  normalizarCodigo, crearCodigo, listarCodigos, activarCodigo, validarCodigo, describir, precioConDescuento,
  registrarCanje, guardarCuponFlow,
};
