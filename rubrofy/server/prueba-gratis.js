// Prueba gratis: 7 días del plan Pro a cambio de un formulario corto con los
// datos de contacto de quien la pide: nombre, correo y teléfono.
// Rubrofy sigue siendo de pago: es una sola prueba por negocio y por número
// de teléfono, y al terminar la cuenta vuelve a "sin plan" salvo que pague.
//
// Los datos del formulario quedan en la tabla `prospectos` para quien
// administra la plataforma (/admin → Pruebas gratis). Son datos de contacto,
// no contenido: el administrador sigue sin ver textos, fotos ni estrategia.

const store = require('./store');

const DIA = 24 * 3600 * 1000;
// El sitio y los correos dicen "7 días del plan Pro": si cambian, cambiar
// también public/site/index.html.
const PLAN = 'pro';
const DIAS = 7;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS prospectos (
    negocio_id TEXT PRIMARY KEY,
    telefono TEXT NOT NULL,          -- solo dígitos: una prueba por número
    datos TEXT NOT NULL,             -- JSON con lo que respondió
    creado_el TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS prospectos_telefono ON prospectos (telefono);
`);
// Al eliminar la cuenta se borran sus datos, pero el número queda marcado
// (sin nada más) para que no se repita la prueba con una cuenta nueva.
db.exec(`CREATE TABLE IF NOT EXISTS pruebas_usadas (telefono TEXT PRIMARY KEY, usado_el TEXT NOT NULL)`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM prospectos WHERE negocio_id = ?').run(negocioId));

const sql = {
  guardar: db.prepare('INSERT INTO prospectos (negocio_id, telefono, datos, creado_el) VALUES (?, ?, ?, ?)'),
  usado: db.prepare('INSERT OR IGNORE INTO pruebas_usadas (telefono, usado_el) VALUES (?, ?)'),
  telefonoUsado: db.prepare('SELECT 1 FROM pruebas_usadas WHERE telefono = ?'),
  listar: db.prepare('SELECT * FROM prospectos ORDER BY creado_el DESC'),
};

const txt = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const digitos = (v) => String(v || '').replace(/\D/g, '');

function suscrito(negocio) {
  return !!(negocio.stripe && negocio.stripe.subscriptionId && ['active', 'trialing', 'past_due'].includes(negocio.stripe.estado));
}

// La prueba se puede pedir si nunca la tuvo y no tiene plan.
function disponible(negocio) {
  return !negocio.prueba && (negocio.plan || 'gratis') === 'gratis' && !suscrito(negocio);
}

// Valida el formulario. emailCuenta: el de la cuenta, si no viene otro.
// Devuelve { datos, telefono } o { error, campo }.
function validar(body, emailCuenta) {
  const b = body || {};
  const datos = {
    nombre: txt(b.nombre, 100),
    email: txt(b.email || emailCuenta, 200).toLowerCase(),
    telefono: txt(b.telefono, 30).replace(/[^\d+ ]/g, ''),
  };
  if (datos.nombre.length < 2) return { error: 'Escribe tu nombre', campo: 'nombre' };
  if (!EMAIL_RE.test(datos.email)) return { error: 'Escribe un correo válido', campo: 'email' };
  const d = digitos(datos.telefono);
  if (d.length < 8 || d.length > 15) return { error: 'Escribe un número de teléfono válido', campo: 'telefono' };
  if (sql.telefonoUsado.get(d)) return { error: 'Ese número ya usó su prueba gratis. Elige un plan para seguir.', campo: 'telefono' };
  return { datos, telefono: d };
}

// Activa la prueba en el negocio (ya leído). Devuelve { negocio } o { error, campo }.
function activar(negocio, body, ahora = Date.now()) {
  if (!disponible(negocio)) return { error: negocio.prueba ? 'Ya usaste tu prueba gratis' : 'Tu cuenta ya tiene un plan' };
  const v = validar(body, negocio.email);
  if (v.error) return v;
  const ok = store.transaccion(() => {
    if (sql.telefonoUsado.get(v.telefono)) return false;
    sql.usado.run(v.telefono, new Date(ahora).toISOString());
    sql.guardar.run(negocio.id, v.telefono, JSON.stringify(v.datos), new Date(ahora).toISOString());
    return true;
  });
  if (!ok) return { error: 'Ese número ya usó su prueba gratis. Elige un plan para seguir.', campo: 'telefono' };
  negocio.plan = PLAN;
  negocio.prueba = { plan: PLAN, desde: new Date(ahora).toISOString(), hasta: new Date(ahora + DIAS * DIA).toISOString() };
  // El teléfono completa el WhatsApp del perfil si estaba vacío.
  if (!(negocio.perfil && negocio.perfil.whatsapp)) negocio.perfil = Object.assign({}, negocio.perfil || {}, { whatsapp: v.datos.telefono });
  return { negocio };
}

function vigente(negocio, ahora = Date.now()) {
  const p = negocio.prueba;
  return !!(p && !p.terminada && Date.parse(p.hasta) > ahora);
}

// Termina las pruebas vencidas; avisa 2 días antes. Devuelve los avisos a enviar.
function revisar(ahora = Date.now()) {
  const avisos = [];
  for (const n of store.listNegocios()) {
    const p = n.prueba;
    if (!p || p.terminada) continue;
    const quedan = Date.parse(p.hasta) - ahora;
    if (quedan <= 0) {
      const fresco = store.getNegocio(n.id);
      fresco.prueba = Object.assign({}, fresco.prueba, { terminada: new Date(ahora).toISOString() });
      if (!suscrito(fresco) && !fresco.cortesia) fresco.plan = 'gratis';
      store.saveNegocio(fresco);
      if (fresco.plan === 'gratis') avisos.push({ negocioId: n.id, tipo: 'termino' });
    } else if (quedan <= 2 * DIA && !p.avisoFin) {
      const fresco = store.getNegocio(n.id);
      fresco.prueba = Object.assign({}, fresco.prueba, { avisoFin: new Date(ahora).toISOString() });
      store.saveNegocio(fresco);
      avisos.push({ negocioId: n.id, tipo: 'termina-pronto' });
    }
  }
  return avisos;
}

// Lo que ve el panel del negocio.
function publico(negocio, ahora = Date.now()) {
  const p = negocio.prueba;
  if (!p) return { disponible: disponible(negocio), plan: PLAN, dias: DIAS };
  const v = vigente(negocio, ahora);
  return { disponible: false, plan: p.plan, dias: DIAS, hasta: p.hasta, vigente: v, diasRestantes: v ? Math.ceil((Date.parse(p.hasta) - ahora) / DIA) : 0 };
}

// Para /admin: quién pidió la prueba y en qué quedó.
function listar() {
  return sql.listar.all().map((f) => {
    const n = store.getNegocio(f.negocio_id);
    const d = JSON.parse(f.datos);
    let estado = 'eliminada';
    if (n) estado = suscrito(n) ? 'pagando' : vigente(n) ? 'en prueba' : 'terminó sin pagar';
    return {
      fecha: f.creado_el, negocio: n ? n.nombre : '(cuenta eliminada)', estado,
      nombre: d.nombre, email: d.email || (n ? n.email : ''), telefono: d.telefono,
    };
  });
}

function catalogo() {
  return { plan: PLAN, dias: DIAS };
}

module.exports = { activar, validar, disponible, vigente, revisar, publico, listar, catalogo, suscrito, PLAN, DIAS };
