// Notificaciones push (Web Push) al celular o computador del dueño, sin
// dependencias: VAPID (RFC 8292) firmado con ES256 y el contenido cifrado
// con aes128gcm (RFC 8291), todo con node:crypto.
//
// Las claves VAPID salen de VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url)
// o, si no están, se generan una vez y se guardan en la base: así funciona
// sin configurar nada. Cambiarlas invalida las suscripciones existentes.
//
// Cada dispositivo que el dueño activa es una suscripción. Si el servicio
// de push responde 404 o 410, la suscripción murió y se borra.

const crypto = require('crypto');
const store = require('./store');

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS push_suscripciones (
    endpoint TEXT PRIMARY KEY,
    negocio_id TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    dispositivo TEXT,
    creado_el TEXT NOT NULL,
    ultimo_envio TEXT
  );
  CREATE INDEX IF NOT EXISTS push_negocio ON push_suscripciones (negocio_id);
  CREATE TABLE IF NOT EXISTS config_plataforma (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    actualizado_el TEXT NOT NULL
  );
`);
store.registrarLimpieza((negocioId) => db.prepare('DELETE FROM push_suscripciones WHERE negocio_id = ?').run(negocioId));

const sql = {
  guardar: db.prepare(`INSERT INTO push_suscripciones (endpoint, negocio_id, p256dh, auth, dispositivo, creado_el) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE SET negocio_id = excluded.negocio_id, p256dh = excluded.p256dh, auth = excluded.auth, dispositivo = excluded.dispositivo`),
  delNegocio: db.prepare('SELECT * FROM push_suscripciones WHERE negocio_id = ?'),
  borrar: db.prepare('DELETE FROM push_suscripciones WHERE endpoint = ?'),
  borrarDeNegocio: db.prepare('DELETE FROM push_suscripciones WHERE endpoint = ? AND negocio_id = ?'),
  enviado: db.prepare('UPDATE push_suscripciones SET ultimo_envio = ? WHERE endpoint = ?'),
  leerConfig: db.prepare('SELECT valor FROM config_plataforma WHERE clave = ?'),
  guardarConfig: db.prepare(`INSERT INTO config_plataforma (clave, valor, actualizado_el) VALUES (?, ?, ?)
    ON CONFLICT (clave) DO NOTHING`),
};

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const desdeB64u = (s) => Buffer.from(String(s), 'base64url');

// --- claves VAPID ---

let claves = null;
function vapid() {
  if (claves) return claves;
  let pub = process.env.VAPID_PUBLIC_KEY;
  let priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    const guardadas = sql.leerConfig.get('vapid');
    if (guardadas) {
      ({ pub, priv } = JSON.parse(guardadas.valor));
    } else {
      const ecdh = crypto.createECDH('prime256v1');
      ecdh.generateKeys();
      pub = b64u(ecdh.getPublicKey());
      priv = b64u(ecdh.getPrivateKey());
      sql.guardarConfig.run('vapid', JSON.stringify({ pub, priv }), new Date().toISOString());
      // Si otro proceso ganó la carrera, se usan las suyas.
      ({ pub, priv } = JSON.parse(sql.leerConfig.get('vapid').valor));
    }
  }
  const p = desdeB64u(pub);
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)), d: priv },
    format: 'jwk',
  });
  claves = { publica: pub, key };
  return claves;
}

function jwtVapid(endpoint) {
  const { key } = vapid();
  const aud = new URL(endpoint).origin;
  const contacto = process.env.CONTACTO_EMAIL || (/<([^>]+)>/.exec(process.env.EMAIL_FROM || '') || [])[1] || 'avisos@rubrofy.com';
  const cabecera = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const cuerpo = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: `mailto:${contacto}` }));
  const firma = crypto.sign('sha256', Buffer.from(`${cabecera}.${cuerpo}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${cabecera}.${cuerpo}.${b64u(firma)}`;
}

// --- cifrado aes128gcm (RFC 8291) ---

function hmac(clave, datos) {
  return crypto.createHmac('sha256', clave).update(datos).digest();
}
function expandir(prk, info, largo) {
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, largo);
}

function cifrar(payload, p256dh, authSecret) {
  const uaPublica = desdeB64u(p256dh);
  const auth = desdeB64u(authSecret);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublica = ecdh.getPublicKey();
  const compartido = ecdh.computeSecret(uaPublica);
  const sal = crypto.randomBytes(16);

  const prkClave = hmac(auth, compartido);
  const ikm = expandir(prkClave, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublica, asPublica]), 32);
  const prk = hmac(sal, ikm);
  const cek = expandir(prk, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = expandir(prk, Buffer.from('Content-Encoding: nonce\0'), 12);

  const cifrador = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const cuerpo = Buffer.concat([cifrador.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cifrador.final(), cifrador.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([sal, rs, Buffer.from([asPublica.length]), asPublica, cuerpo]);
}

// --- suscripciones y envío ---

function suscribir(negocioId, sub, dispositivo) {
  const ok = sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 1000
    && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
  if (!ok) return { error: 'Suscripción inválida' };
  if (desdeB64u(sub.keys.p256dh).length !== 65 || desdeB64u(sub.keys.auth).length !== 16) return { error: 'Suscripción inválida' };
  sql.guardar.run(sub.endpoint, negocioId, sub.keys.p256dh, sub.keys.auth, String(dispositivo || '').slice(0, 120), new Date().toISOString());
  return { ok: true };
}

function desuscribir(negocioId, endpoint) {
  sql.borrarDeNegocio.run(String(endpoint || ''), negocioId);
}

function dispositivos(negocioId) {
  return sql.delNegocio.all(negocioId).map((s) => ({ dispositivo: s.dispositivo, creadoEl: s.creado_el, ultimoEnvio: s.ultimo_envio, endpoint: s.endpoint }));
}

// mensaje: { titulo, cuerpo, url, tag }. Devuelve cuántos dispositivos lo recibieron.
async function enviar(negocioId, mensaje) {
  const subs = sql.delNegocio.all(negocioId);
  if (!subs.length) return 0;
  const payload = JSON.stringify({
    titulo: String(mensaje.titulo || 'Rubrofy').slice(0, 80),
    cuerpo: String(mensaje.cuerpo || '').slice(0, 240),
    url: mensaje.url || '/app',
    tag: mensaje.tag || undefined,
  });
  const { publica } = vapid();
  let enviados = 0;
  for (const s of subs) {
    try {
      const res = await fetch(s.endpoint, {
        method: 'POST',
        headers: {
          TTL: String(mensaje.ttl || 24 * 3600),
          Urgency: mensaje.urgente ? 'high' : 'normal',
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          Authorization: `vapid t=${jwtVapid(s.endpoint)}, k=${publica}`,
          ...(mensaje.tag ? { Topic: String(mensaje.tag).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
        },
        body: cifrar(payload, s.p256dh, s.auth),
      });
      if (res.status === 404 || res.status === 410) sql.borrar.run(s.endpoint);
      else if (res.ok) { enviados += 1; sql.enviado.run(new Date().toISOString(), s.endpoint); }
    } catch (err) {
      // sin red: se pierde este aviso, la suscripción se mantiene
    }
  }
  return enviados;
}

function clavePublica() {
  return vapid().publica;
}

module.exports = { suscribir, desuscribir, dispositivos, enviar, clavePublica, cifrar };
