// Límite de intentos por IP, en memoria y sin dependencias. Protege los
// endpoints públicos (registro y login) de bots: el registro llama a Claude
// para diseñar la estrategia, así que sin límite un bot puede gastar la key
// de Anthropic creando cuentas, y el login sin límite permite probar claves
// sin freno. Al vivir en memoria se reinicia con el servidor — suficiente
// para un solo proceso; con varias instancias habría que llevarlo a la base.

// Ventana fija: cada IP tiene hasta `max` intentos por `ventanaMs`, contados
// desde su primer intento de esa ventana.
function crearLimitador({ max, ventanaMs }) {
  const registros = new Map();

  function vigente(clave, ahora) {
    const r = registros.get(clave);
    if (!r || ahora - r.inicio >= ventanaMs) return null;
    return r;
  }

  function limpiar(ahora) {
    for (const [clave, r] of registros) {
      if (ahora - r.inicio >= ventanaMs) registros.delete(clave);
    }
  }

  return {
    // Segundos que faltan para poder volver a intentar, o 0 si no está bloqueada.
    esperaSegundos(clave) {
      const ahora = Date.now();
      const r = vigente(clave, ahora);
      if (!r || r.cuenta < max) return 0;
      return Math.ceil((r.inicio + ventanaMs - ahora) / 1000);
    },
    registrar(clave) {
      const ahora = Date.now();
      let r = vigente(clave, ahora);
      if (!r) {
        r = { inicio: ahora, cuenta: 0 };
        registros.set(clave, r);
      }
      r.cuenta += 1;
      if (registros.size > 10000) limpiar(ahora);
    },
    reiniciar(clave) {
      registros.delete(clave);
    },
  };
}

// IP del cliente. Detrás del proxy de Railway la IP real llega en
// X-Forwarded-For; se toma la ÚLTIMA entrada, que es la que agrega el propio
// proxy — las anteriores las puede inventar el cliente. Sin proxy delante
// (local, u otro hosting sin configurar) ese header lo escribe el cliente
// completo, así que solo se confía en él en Railway o con TRUST_PROXY=1.
const CONFIAR_EN_PROXY = process.env.TRUST_PROXY === '1'
  || !!(process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_ENVIRONMENT_NAME);

function ipCliente(req) {
  const xff = req.headers['x-forwarded-for'];
  if (CONFIAR_EN_PROXY && xff) {
    const partes = String(xff).split(',').map((s) => s.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }
  return (req.socket && req.socket.remoteAddress) || 'desconocida';
}

module.exports = { crearLimitador, ipCliente };
