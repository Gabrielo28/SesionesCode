// Códigos de prueba: reemplazan al plan gratis. El administrador crea un
// código (qué plan da, por cuántos días, cuántas veces se puede usar y hasta
// cuándo) y el negocio lo canjea al registrarse o desde su panel. Durante la
// prueba el negocio tiene el plan completo; al terminar vuelve a "sin plan"
// salvo que se haya suscrito.
//
// Un negocio no puede usar dos veces el mismo código. Si canjea otro con la
// prueba vigente, los días se suman desde el fin de la prueba actual.

const crypto = require('crypto');
const store = require('./store');

const DIA = 24 * 3600 * 1000;
const PLANES_CON_PRUEBA = ['pro', 'estudio'];

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS codigos (
    codigo TEXT PRIMARY KEY,         -- en mayúsculas
    plan TEXT NOT NULL,
    dias INTEGER NOT NULL,
    usos_max INTEGER,                -- null = sin límite
    usos INTEGER NOT NULL DEFAULT 0,
    vence_el TEXT,                   -- hasta cuándo se puede canjear (null = no vence)
    nota TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_el TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS canjes (
    codigo TEXT NOT NULL,
    negocio_id TEXT NOT NULL,
    canjeado_el TEXT NOT NULL,
    PRIMARY KEY (codigo, negocio_id)
  );
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM canjes WHERE negocio_id = ?').run(negocioId));

const sql = {
  crear: db.prepare('INSERT INTO codigos (codigo, plan, dias, usos_max, vence_el, nota, creado_el) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  get: db.prepare('SELECT * FROM codigos WHERE codigo = ?'),
  listar: db.prepare('SELECT * FROM codigos ORDER BY creado_el DESC'),
  activo: db.prepare('UPDATE codigos SET activo = ? WHERE codigo = ?'),
  usar: db.prepare('UPDATE codigos SET usos = usos + 1 WHERE codigo = ? AND (usos_max IS NULL OR usos < usos_max)'),
  canje: db.prepare('INSERT INTO canjes (codigo, negocio_id, canjeado_el) VALUES (?, ?, ?)'),
  yaUso: db.prepare('SELECT 1 FROM canjes WHERE codigo = ? AND negocio_id = ?'),
  canjesDe: db.prepare('SELECT negocio_id, canjeado_el FROM canjes WHERE codigo = ? ORDER BY canjeado_el DESC'),
};

const normal = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');

function aleatorio() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (const b of crypto.randomBytes(8)) s += letras[b % letras.length];
  return `RUBRO-${s.slice(0, 4)}-${s.slice(4)}`;
}

// Devuelve { codigo } o { error }.
function crear({ codigo, plan, dias, usosMax, venceEl, nota }) {
  const c = normal(codigo) || aleatorio();
  if (!/^[A-Z0-9-]{4,40}$/.test(c)) return { error: 'El código solo puede tener letras, números y guiones (4 a 40)' };
  if (!PLANES_CON_PRUEBA.includes(plan)) return { error: 'Elige el plan que da el código' };
  const d = Math.floor(Number(dias));
  if (!(d >= 1 && d <= 365)) return { error: 'Los días deben ser entre 1 y 365' };
  const u = usosMax === '' || usosMax == null ? null : Math.floor(Number(usosMax));
  if (u !== null && !(u >= 1)) return { error: 'Los usos deben ser 1 o más (o vacío para ilimitados)' };
  let vence = null;
  if (venceEl) {
    const t = Date.parse(venceEl);
    if (!t) return { error: 'Fecha de vencimiento inválida' };
    vence = new Date(t).toISOString();
  }
  if (sql.get.get(c)) return { error: 'Ese código ya existe' };
  sql.crear.run(c, plan, d, u, vence, String(nota || '').slice(0, 200) || null, new Date().toISOString());
  return { codigo: c };
}

function listar(nombreDe) {
  return sql.listar.all().map((c) => ({
    codigo: c.codigo, plan: c.plan, dias: c.dias, usosMax: c.usos_max, usos: c.usos, venceEl: c.vence_el, nota: c.nota,
    activo: !!c.activo, creadoEl: c.creado_el,
    canjes: sql.canjesDe.all(c.codigo).slice(0, 20).map((k) => ({ negocio: nombreDe(k.negocio_id), fecha: k.canjeado_el })),
  }));
}

function activar(codigo, activo) {
  sql.activo.run(activo ? 1 : 0, normal(codigo));
  return !!sql.get.get(normal(codigo));
}

function suscripcionActiva(negocio) {
  return !!(negocio.stripe && negocio.stripe.subscriptionId && ['active', 'trialing', 'past_due'].includes(negocio.stripe.estado));
}

// Revisa un código sin usarlo (para el registro). Devuelve null si sirve o el error.
function validar(codigoCrudo, ahora = Date.now()) {
  const cod = sql.get.get(normal(codigoCrudo));
  if (!cod || !cod.activo) return 'Ese código no existe o ya no está disponible';
  if (cod.vence_el && Date.parse(cod.vence_el) < ahora) return 'Ese código ya venció';
  if (cod.usos_max != null && cod.usos >= cod.usos_max) return 'Ese código ya se usó todas las veces permitidas';
  return null;
}

// Aplica el código al negocio (ya leído de la base). Devuelve { negocio } o { error }.
function canjear(negocio, codigoCrudo, ahora = Date.now()) {
  const c = normal(codigoCrudo);
  const cod = c && sql.get.get(c);
  if (!cod || !cod.activo) return { error: 'Ese código no existe o ya no está disponible' };
  if (cod.vence_el && Date.parse(cod.vence_el) < ahora) return { error: 'Ese código ya venció' };
  if (cod.usos_max != null && cod.usos >= cod.usos_max) return { error: 'Ese código ya se usó todas las veces permitidas' };
  if (sql.yaUso.get(c, negocio.id)) return { error: 'Ya usaste este código' };
  if (suscripcionActiva(negocio)) return { error: 'Ya tienes un plan pagado activo' };
  const vigente = negocio.prueba && !negocio.prueba.terminada && Date.parse(negocio.prueba.hasta) > ahora;
  const desde = vigente ? Date.parse(negocio.prueba.hasta) : ahora;
  const resultado = store.transaccion(() => {
    if (!sql.usar.run(c).changes) return false; // otro canje se llevó el último uso
    sql.canje.run(c, negocio.id, new Date(ahora).toISOString());
    return true;
  });
  if (!resultado) return { error: 'Ese código ya se usó todas las veces permitidas' };
  // Si la prueba vigente era de otro plan, gana el mejor de los dos.
  const plan = vigente && negocio.prueba.plan === 'estudio' ? 'estudio' : cod.plan;
  negocio.prueba = {
    codigo: c, plan, desde: vigente ? negocio.prueba.desde : new Date(ahora).toISOString(),
    hasta: new Date(desde + cod.dias * DIA).toISOString(),
  };
  negocio.plan = plan;
  return { negocio, dias: cod.dias, plan };
}

// Termina las pruebas vencidas. Devuelve los negocios que cambiaron (para avisar).
function revisarVencidas(ahora = Date.now()) {
  const cambiados = [];
  for (const n of store.listNegocios()) {
    const p = n.prueba;
    if (!p || p.terminada || Date.parse(p.hasta) > ahora) continue;
    const fresco = store.getNegocio(n.id);
    fresco.prueba = Object.assign({}, fresco.prueba, { terminada: new Date(ahora).toISOString() });
    if (!suscripcionActiva(fresco)) fresco.plan = 'gratis';
    store.saveNegocio(fresco);
    cambiados.push(fresco);
  }
  return cambiados;
}

// Datos públicos de la prueba para el panel.
function publico(negocio, ahora = Date.now()) {
  const p = negocio.prueba;
  if (!p) return null;
  const vigente = !p.terminada && Date.parse(p.hasta) > ahora;
  return { plan: p.plan, hasta: p.hasta, vigente, diasRestantes: vigente ? Math.ceil((Date.parse(p.hasta) - ahora) / DIA) : 0 };
}

module.exports = { validar, crear, listar, activar, canjear, revisarVencidas, publico, suscripcionActiva, normal, PLANES_CON_PRUEBA };
