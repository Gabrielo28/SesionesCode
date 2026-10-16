/*
 * Modelo compartido del Centro de escaneo: cómo se identifica un negocio y cómo se
 * convierte un resultado del escáner de mercado en un registro del Centro.
 * Lo usan centro.js (puente con la app en claude.ai), servidor-centro.js (versión independiente)
 * y la propia app en el navegador (window.MODELO), para importar archivos en cualquiera de las dos.
 */
(function (raiz) {
const slug = t => String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const dominio = w => String(w || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
// Nombre + dominio: un reescaneo actualiza el mismo negocio y nunca pisa su seguimiento.
const idDe = n => slug(n.nombre + '-' + (dominio(n.web) || 'sin-web'));

function aRegistro(n, lote, generado) {
  const info = {};
  ['plataforma', 'ms', 'camino', 'revisar', 'whatsapp', 'pixel', 'analytics'].forEach(k => { if (n.info && n.info[k] != null) info[k] = n.info[k]; });
  return {
    nombre: n.nombre, web: n.web || '', rubro: n.rubro || '', ciudad: n.ciudad || '', lote: slug(lote || 'lista'),
    nivel: n.nivel, oportunidad: n.oportunidad, codigos: (n.codigos || []).map(c => ({ id: c.id, evidencia: c.evidencia })),
    mensaje: n.mensaje || '', info, escaneado: generado || new Date().toISOString()
  };
}

// Resultados del escáner (JSON) -> { id: registro }
function registrosDe(resultados, lote) {
  const out = {}, vistos = {};
  for (const n of resultados.negocios || []) {
    let id = idDe(n); if (vistos[id]) id += '-' + (++vistos[id]); else vistos[id] = 1;
    out[id] = aRegistro(n, lote || resultados.rubro, resultados.generado);
  }
  return out;
}

// Une un seguimiento importado con el actual: gana el que se actualizó más tarde.
const masNuevo = (actual, nuevo) => !actual || String(nuevo && nuevo.actualizado || '') > String(actual.actualizado || '');

const M = { slug, dominio, idDe, aRegistro, registrosDe, masNuevo };
if (typeof module !== 'undefined' && module.exports) module.exports = M; else raiz.MODELO = M;
})(this);
