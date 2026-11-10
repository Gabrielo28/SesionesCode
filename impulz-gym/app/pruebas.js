/*
 * Prueba de punta a punta: levanta el servidor con datos temporales y recorre el flujo completo.
 * Uso: npm test   (no toca la carpeta datos/ real)
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PUERTO = 5199;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'impulz-'));
const URL = 'http://localhost:' + PUERTO;
const env = { ...process.env, PORT: PUERTO, DATA_DIR: DIR, ADMIN_USUARIO: 'coach', ADMIN_CLAVE: 'clave-coach', DUENO_USUARIO: 'dueno', DUENO_CLAVE: 'clave-dueno', SESION_SECRETO: 'prueba' };

let ok = 0;
const paso = (n, f) => f().then(() => { ok++; console.log('  ✓ ' + n); });

async function pedir(metodo, ruta, cuerpo, cookie) {
  const r = await fetch(URL + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.' + Math.floor(Math.random() * 200), ...(cookie ? { Cookie: cookie } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch (e) { j = t; }
  return { estado: r.status, j, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
}

(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv.stdout.once('data', r));
  try {
    let coach, dueno, codigo, idA;
    const mes = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 7);

    await paso('la página de reservas carga y muestra el beneficio', async () => {
      const r = await fetch(URL + '/'); const h = await r.text();
      assert.equal(r.status, 200); assert.match(h, /Reserva tu/); assert.match(h, /Matrícula gratis/);
    });
    await paso('una reserva desde un anuncio de Meta genera código y queda atribuida', async () => {
      const r = await pedir('POST', '/api/reservas', { nombre: 'Camila Rojas', telefono: '9 1234 5678', acepta: true, c: 'meta', utm_campaign: 'relanzamiento' });
      assert.equal(r.estado, 200); assert.match(r.j.codigo, /^IMP-[A-Z0-9]{4}$/); codigo = r.j.codigo;
    });
    await paso('el mismo teléfono no duplica: devuelve el mismo código', async () => {
      const r = await pedir('POST', '/api/reservas', { nombre: 'Camila', telefono: '+56 9 1234 5678', acepta: true });
      assert.equal(r.j.codigo, codigo);
    });
    await paso('sin autorización de contacto no se puede reservar', async () => {
      const r = await pedir('POST', '/api/reservas', { nombre: 'Pedro', telefono: '987654321' });
      assert.equal(r.estado, 400);
    });
    await paso('sin sesión, la API del panel responde 401', async () => {
      assert.equal((await pedir('GET', '/api/leads')).estado, 401);
    });
    await paso('clave incorrecta no entra', async () => {
      assert.equal((await pedir('POST', '/api/login', { usuario: 'dueno', clave: 'mala' })).estado, 401);
    });
    await paso('el coach y el dueño inician sesión', async () => {
      const a = await pedir('POST', '/api/login', { usuario: 'coach', clave: 'clave-coach' }); assert.equal(a.j.rol, 'admin'); coach = a.cookie;
      const b = await pedir('POST', '/api/login', { usuario: 'DUENO', clave: 'clave-dueno' }); assert.equal(b.j.rol, 'dueno'); dueno = b.cookie;
    });
    await paso('el dueño ve la reserva con su canal', async () => {
      const r = await pedir('GET', '/api/leads', null, dueno);
      const l = r.j.find(x => x.codigo === codigo); idA = l.id;
      assert.equal(l.canal, 'meta_ads'); assert.equal(l.campana, 'relanzamiento');
    });
    await paso('el dueño NO puede cambiar el canal de origen', async () => {
      const r = await pedir('PATCH', '/api/leads/' + idA, { canal: 'meson' }, dueno);
      assert.equal(r.estado, 403);
    });
    await paso('el dueño NO puede registrar un contacto en un canal de gestión', async () => {
      const r = await pedir('POST', '/api/leads', { nombre: 'Falso', canal: 'meta_ads' }, dueno);
      assert.equal(r.estado, 403);
    });
    await paso('el dueño inscribe con el código y se registra el primer pago', async () => {
      const r = await pedir('PATCH', '/api/leads/' + idA, { etapa: 'Inscrito' }, dueno);
      assert.equal(r.j.etapa, 'Inscrito'); assert.equal(r.j.pagos.length, 1); assert.equal(r.j.pagos[0].mes, mes);
    });
    await paso('el dueño registra un socio que llegó directo (sin comisión)', async () => {
      const r = await pedir('POST', '/api/leads', { nombre: 'Javier Pérez', canal: 'meson', etapa: 'Inscrito' }, dueno);
      assert.equal(r.estado, 201); assert.equal(r.j.pagos.length, 1);
    });
    await paso('la comisión del primer mes es 100% y el socio directo no paga comisión', async () => {
      const R = require('./public/reglas.js');
      const cfg = (await pedir('GET', '/api/config', null, dueno)).j;
      const leads = (await pedir('GET', '/api/leads', null, dueno)).j;
      const total = leads.flatMap(l => R.detallePagos(l, cfg)).filter(p => p.mes === mes).reduce((s, p) => s + p.valor, 0);
      assert.equal(total, 25000);
    });
    await paso('el reloj por socio: mes 2 al 7 con 15% y mes 8 sin comisión', async () => {
      const R = require('./public/reglas.js');
      const pagos = Array.from({ length: 9 }, (_, i) => ({ mes: '2027-' + String(i + 1).padStart(2, '0'), monto: 25000 }));
      const d = R.detallePagos({ canal: 'meta_ads', pagos }, { pctPrimer: 100, pctRecurrente: 15, mesesRecurrente: 6, pctPase: 30 });
      assert.deepEqual(d.map(p => p.valor), [25000, 3750, 3750, 3750, 3750, 3750, 3750, 0, 0]);
      const pase = R.detallePagos({ canal: 'meta_ads', plan: 'Pase verano', pagos: [{ mes: '2027-01', monto: 20000 }] }, { pctPase: 30 });
      assert.equal(pase[0].valor, 6000);
    });
    await paso('el dueño NO ve la inversión del coach ni puede cambiar el acuerdo', async () => {
      assert.equal((await pedir('GET', '/api/inversion', null, dueno)).estado, 403);
      assert.equal((await pedir('PUT', '/api/config', { pctPrimer: 10 }, dueno)).estado, 403);
      assert.equal((await pedir('DELETE', '/api/leads/' + idA, null, dueno)).estado, 403);
    });
    await paso('el coach guarda su inversión y no aparece en el historial del dueño', async () => {
      assert.equal((await pedir('PUT', '/api/inversion/' + mes, { monto: 70000 }, coach)).j[mes], 70000);
      const h = (await pedir('GET', '/api/historial', null, dueno)).j;
      assert.ok(!h.some(e => e.accion === 'inversión'));
      assert.ok(h.some(e => e.accion === 'editó contacto' && e.usuario === 'dueno'));
    });
    await paso('el historial registra quién inscribió', async () => {
      const h = (await pedir('GET', '/api/historial', null, coach)).j;
      assert.ok(h.some(e => e.codigo === codigo && /Inscrito/.test(e.detalle || '')));
    });
    await paso('el CSV se descarga con los contactos', async () => {
      const r = await pedir('GET', '/api/exportar.csv', null, dueno);
      assert.equal(r.estado, 200); assert.match(String(r.j), /Camila Rojas/);
    });
    await paso('los datos quedan en DATA_DIR, fuera del código', async () => {
      assert.ok(fs.existsSync(path.join(DIR, 'leads.json'))); assert.ok(fs.existsSync(path.join(DIR, 'historial.log')));
    });
    console.log(`\n${ok} pruebas OK`);
  } catch (e) {
    console.error('\n✗ FALLÓ:', e.message); process.exitCode = 1;
  } finally {
    srv.kill(); fs.rmSync(DIR, { recursive: true, force: true });
  }
})();
