// Publicador: proceso de fondo que publica en Instagram las piezas
// aprobadas cuando llega su hora (`publicarEl`), reintenta los fallos con
// espera creciente y renueva el token de Instagram antes de que venza.
//
// Estado de cada pieza aprobada en `item.publicacion.estado`:
//   programada → publicando → publicada
//                          ↘ programada (reintento, con `proximoIntento`)
//                          ↘ fallida (sin foto, error permanente o sin más reintentos)
// Si el token deja de servir, el NEGOCIO queda en `instagram.estado =
// 'reconectar'` y sus piezas esperan programadas: al reconectar se publican
// solas, en vez de fallar una por una.
//
// Corre dentro del mismo proceso del servidor (un setInterval, sin colas
// externas): suficiente para una sola instancia. Con varias instancias
// habría que llevar el bloqueo a la base de datos.

const store = require('./store');
const instagram = require('./instagram');

// Esperas entre reintentos, en minutos. Después del último, queda fallida.
const REINTENTOS_MIN = [1, 5, 15, 60, 180];
const ESPERA_MINIMA_LIMITE_MIN = 15; // si Meta dice "límite de llamadas", no antes de esto
// Meta descarta los contenedores sin publicar a las 24 h; se recrean antes.
const VIGENCIA_CONTENEDOR_MS = 23 * 60 * 60 * 1000;
// Renovación del token: el primero a las 24 h de conectado (mínimo que exige
// Meta), después cada 7 días; si falla por red, se reintenta cada 6 h.
const EDAD_MINIMA_TOKEN_MS = 24 * 60 * 60 * 1000;
const RENOVAR_CADA_MS = 7 * 24 * 60 * 60 * 1000;
const REINTENTAR_RENOVACION_MS = 6 * 60 * 60 * 1000;

function ahoraISO() {
  return new Date().toISOString();
}

// Lee-modifica-guarda sin `await` entre medio: en Node no se intercala con
// otros requests, así que no pisa cambios hechos mientras se esperaba a
// Instagram (a diferencia de guardar un objeto leído antes de esa espera).
function actualizarItem(negocioId, itemId, cambio) {
  const items = store.getContenido(negocioId);
  const item = items.find((it) => it.id === itemId);
  if (!item) return null;
  cambio(item);
  store.saveContenido(negocioId, items);
  return item;
}

function actualizarNegocio(negocioId, cambio) {
  const negocio = store.getNegocio(negocioId);
  if (!negocio) return null;
  cambio(negocio);
  store.saveNegocio(negocio);
  return negocio;
}

function estaVencida(item, ahora = Date.now()) {
  return item.status === 'aprobado' && item.publicacion && item.publicacion.estado === 'programada'
    && Date.parse(item.publicacion.proximoIntento) <= ahora;
}

// prepararPublicacion(negocio, item) → { imageUrl, caption, generadaPorIA }
// o { motivo } si la pieza no se puede publicar (ej. no tiene foto). La
// entrega server.js porque sabe elegir la foto y firmar su enlace temporal.
function crearPublicador({ prepararPublicacion, intervaloMs = 30000, log = console.log }) {
  const enCurso = new Set(); // "negocioId/itemId" que se están publicando ahora
  let recorriendo = false;
  let timer = null;

  function marcarFallida(negocioId, itemId, motivo) {
    return actualizarItem(negocioId, itemId, (it) => {
      it.publicacion = Object.assign({}, it.publicacion, { estado: 'fallida', motivo, falloEl: ahoraISO() });
      it.instagram = { intentado: true, ok: false, error: motivo };
    });
  }

  // Programa el próximo reintento, o la da por fallida si ya no quedan.
  function reintentarOFallar(negocioId, itemId, resultado, opciones = {}) {
    let fallida = false;
    const item = actualizarItem(negocioId, itemId, (it) => {
      const pub = Object.assign({}, it.publicacion);
      if (opciones.descartarContenedor) {
        delete pub.creationId;
        delete pub.creationEl;
      }
      pub.intentos = (pub.intentos || 0) + 1;
      pub.ultimoError = resultado.error;
      if (pub.intentos > REINTENTOS_MIN.length) {
        pub.estado = 'fallida';
        pub.motivo = `No se pudo publicar después de ${pub.intentos} intentos: ${resultado.error}`;
        pub.falloEl = ahoraISO();
        it.instagram = { intentado: true, ok: false, error: pub.motivo };
        fallida = true;
      } else {
        let esperaMin = REINTENTOS_MIN[pub.intentos - 1];
        if (resultado.tipo === 'limite') esperaMin = Math.max(esperaMin, ESPERA_MINIMA_LIMITE_MIN);
        pub.estado = 'programada';
        pub.proximoIntento = new Date(Date.now() + esperaMin * 60000).toISOString();
      }
      it.publicacion = pub;
    });
    log(`Publicador: ${negocioId}/${itemId} ${fallida ? 'falló definitivamente' : 'se reintentará'}: ${resultado.error}`);
    return item;
  }

  // El token ya no sirve: el negocio pasa a "reconectar" y la pieza vuelve
  // a esperar programada, sin gastar un reintento.
  function pausarPorToken(negocioId, itemId, resultado) {
    actualizarNegocio(negocioId, (n) => {
      if (!n.instagram) return;
      n.instagram.estado = 'reconectar';
      n.instagram.motivoReconexion = resultado.error;
    });
    log(`Publicador: ${negocioId} debe reconectar Instagram: ${resultado.error}`);
    return actualizarItem(negocioId, itemId, (it) => {
      it.publicacion = Object.assign({}, it.publicacion, { estado: 'programada', proximoIntento: ahoraISO() });
    });
  }

  function manejarError(negocioId, itemId, resultado, paso) {
    if (resultado.tipo === 'auth') return pausarPorToken(negocioId, itemId, resultado);
    if (resultado.tipo === 'permanente') {
      // Un 100 al PUBLICAR suele ser un contenedor vencido o inválido: se
      // recrea una vez. Al CREARLO, es el contenido el que no sirve.
      if (paso === 'publicar') return reintentarOFallar(negocioId, itemId, resultado, { descartarContenedor: true });
      return marcarFallida(negocioId, itemId, resultado.error);
    }
    return reintentarOFallar(negocioId, itemId, resultado);
  }

  async function publicarPieza(negocioId, itemId) {
    const item = store.getContenido(negocioId).find((it) => it.id === itemId);
    if (!item || !estaVencida(item)) return item;

    const negocio = store.getNegocio(negocioId);
    if (!negocio || !negocio.instagram || !negocio.instagram.accessToken) {
      return marcarFallida(negocioId, itemId, 'Instagram no está conectado');
    }
    if (negocio.instagram.estado === 'reconectar') return item; // espera la reconexión

    actualizarItem(negocioId, itemId, (it) => { it.publicacion.estado = 'publicando'; });
    const { userId, accessToken } = negocio.instagram;
    let pub = item.publicacion;

    const contenedorVigente = pub.creationId && pub.creationEl
      && Date.now() - Date.parse(pub.creationEl) < VIGENCIA_CONTENEDOR_MS;
    if (!contenedorVigente) {
      const preparado = await prepararPublicacion(negocio, item);
      if (preparado.motivo) return marcarFallida(negocioId, itemId, preparado.motivo);
      const creado = await instagram.crearContenedor({ userId, accessToken, imageUrl: preparado.imageUrl, caption: preparado.caption });
      if (!creado.ok) return manejarError(negocioId, itemId, creado, 'crear');
      // Se guarda antes de publicar: si lo que sigue falla o el proceso se
      // cae, el reintento publica este mismo contenedor.
      const conContenedor = actualizarItem(negocioId, itemId, (it) => {
        Object.assign(it.publicacion, { creationId: creado.id, creationEl: ahoraISO(), generadaPorIA: !!preparado.generadaPorIA });
      });
      if (!conContenedor) return null; // la pieza se borró mientras tanto
      pub = conContenedor.publicacion;
    }

    const publicado = await instagram.publicarContenedor({ userId, accessToken, creationId: pub.creationId });
    if (!publicado.ok) return manejarError(negocioId, itemId, publicado, 'publicar');

    log(`Publicador: ${negocioId}/${itemId} publicado en Instagram (${publicado.id}).`);
    return actualizarItem(negocioId, itemId, (it) => {
      const publicadoEl = ahoraISO();
      it.publicacion = Object.assign({}, it.publicacion, { estado: 'publicada', publicadoEl, mediaId: publicado.id });
      delete it.publicacion.ultimoError;
      it.instagram = { intentado: true, ok: true, mediaId: publicado.id, publicadoEl, generadaPorIA: !!it.publicacion.generadaPorIA };
    });
  }

  // Publica una pieza si ya le toca. Nunca dos veces a la vez la misma: un
  // segundo llamado mientras la primera espera a Instagram no hace nada.
  async function procesar(negocioId, itemId) {
    const clave = `${negocioId}/${itemId}`;
    if (enCurso.has(clave)) return store.getContenido(negocioId).find((it) => it.id === itemId) || null;
    enCurso.add(clave);
    try {
      return await publicarPieza(negocioId, itemId);
    } catch (err) {
      log(`Publicador: error inesperado en ${clave}: ${err.message}`);
      return reintentarOFallar(negocioId, itemId, { tipo: 'reintentable', error: err.message });
    } finally {
      enCurso.delete(clave);
    }
  }

  function estaPublicando(negocioId, itemId) {
    return enCurso.has(`${negocioId}/${itemId}`);
  }

  async function renovarTokenSiToca(negocio) {
    const ig = negocio.instagram;
    if (!ig || !ig.accessToken || ig.estado === 'reconectar') return;
    const ahora = Date.now();
    const desde = Date.parse(ig.renovadoEl || ig.conectadoEl || 0);
    const toca = ig.renovadoEl ? RENOVAR_CADA_MS : EDAD_MINIMA_TOKEN_MS;
    if (ahora - desde < toca) return;
    if (ig.ultimoIntentoRenovacion && ahora - Date.parse(ig.ultimoIntentoRenovacion) < REINTENTAR_RENOVACION_MS) return;

    const r = await instagram.renovarToken(ig.accessToken);
    actualizarNegocio(negocio.id, (n) => {
      // Si el negocio reconectó con otro token mientras tanto, no se toca.
      if (!n.instagram || n.instagram.accessToken !== ig.accessToken) return;
      n.instagram.ultimoIntentoRenovacion = ahoraISO();
      if (r.ok) {
        n.instagram.accessToken = r.accessToken;
        n.instagram.renovadoEl = ahoraISO();
        n.instagram.venceEl = new Date(Date.now() + r.expiraEnSeg * 1000).toISOString();
      } else if (r.tipo === 'auth') {
        n.instagram.estado = 'reconectar';
        n.instagram.motivoReconexion = r.error;
      }
    });
    log(`Publicador: token de Instagram de ${negocio.id} ${r.ok ? 'renovado' : 'no se pudo renovar: ' + r.error}.`);
  }

  // Una pasada: renueva tokens y publica todo lo que ya venció.
  async function recorrer() {
    if (recorriendo) return;
    recorriendo = true;
    try {
      for (const negocio of store.listNegocios()) {
        if (!negocio.instagram || !negocio.instagram.accessToken) {
          // Sin Instagram, lo vencido se marca fallido (con motivo) en procesar.
          const vencidas = store.getContenido(negocio.id).filter((it) => estaVencida(it));
          for (const it of vencidas) await procesar(negocio.id, it.id);
          continue;
        }
        try {
          await renovarTokenSiToca(negocio);
        } catch (err) {
          log(`Publicador: error renovando token de ${negocio.id}: ${err.message}`);
        }
        const fresco = store.getNegocio(negocio.id);
        if (!fresco || (fresco.instagram && fresco.instagram.estado === 'reconectar')) continue;
        const vencidas = store.getContenido(negocio.id).filter((it) => estaVencida(it));
        for (const it of vencidas) await procesar(negocio.id, it.id);
      }
    } catch (err) {
      log(`Publicador: error en la pasada: ${err.message}`);
    } finally {
      recorriendo = false;
    }
  }

  // Piezas que quedaron "publicando" porque el proceso se cayó a mitad de
  // camino: vuelven a programada. Si alcanzaron a crear el contenedor, el
  // reintento publica ese mismo (no se crea otro post).
  function recuperarInterrumpidas() {
    for (const negocio of store.listNegocios()) {
      const items = store.getContenido(negocio.id);
      let cambio = false;
      for (const it of items) {
        if (it.publicacion && it.publicacion.estado === 'publicando') {
          it.publicacion.estado = 'programada';
          it.publicacion.proximoIntento = ahoraISO();
          cambio = true;
        }
      }
      if (cambio) store.saveContenido(negocio.id, items);
    }
  }

  function iniciar() {
    recuperarInterrumpidas();
    timer = setInterval(recorrer, intervaloMs);
    setTimeout(recorrer, 2000);
  }

  function detener() {
    if (timer) clearInterval(timer);
  }

  return { iniciar, detener, procesar, recorrer, estaPublicando, estaVencida };
}

module.exports = { crearPublicador };
