// Plantillas por nicho: lo único que hay que escribir para sumar un rubro nuevo.
// El motor (generator.js / server.js) no sabe nada de "glamping" ni de "panadería" —
// solo lee esta tabla.

const NICHOS = {
  turismo: {
    nombre: 'Turismo y hospedaje',
    tono: 'cercano y evocador, que venda la experiencia de desconectar',
    enfoques: [
      { id: 'experiencia', label: 'Experiencia', pista: 'describe una sensación o momento concreto de la estadía', categoriaFoto: 'interior' },
      { id: 'precio', label: 'Precio y datos', pista: 'menciona una tarifa, promoción o condición real', categoriaFoto: 'exterior' },
      { id: 'urgencia', label: 'Urgencia', pista: 'destaca cupos limitados o una fecha que se acerca', categoriaFoto: 'exterior' },
      { id: 'recinto', label: 'Mostrar el recinto', pista: 'pon el foco en una instalación o vista del lugar', categoriaFoto: 'interior' },
    ],
    categoriasFoto: ['exterior', 'interior', 'detalles'],
    calendarioComercial: [
      { fecha: '18 de septiembre', motivo: 'Fiestas Patrias' },
      { fecha: '21 de septiembre', motivo: 'inicio de primavera' },
      { fecha: 'diciembre a febrero', motivo: 'temporada alta de verano' },
    ],
  },
  panaderia: {
    nombre: 'Panadería y pastelería',
    tono: 'cálido y casero, con olor a recién horneado',
    enfoques: [
      { id: 'producto', label: 'Producto del día', pista: 'destaca un producto específico recién hecho', categoriaFoto: 'producto' },
      { id: 'precio', label: 'Precio y datos', pista: 'menciona un precio, combo o promoción real', categoriaFoto: 'producto' },
      { id: 'urgencia', label: 'Urgencia', pista: 'stock limitado del día o de un producto de temporada', categoriaFoto: 'producto' },
      { id: 'proceso', label: 'Mostrar el proceso', pista: 'muestra cómo se hace o de dónde vienen los ingredientes', categoriaFoto: 'local' },
    ],
    categoriasFoto: ['producto', 'local', 'equipo'],
    calendarioComercial: [
      { fecha: '15 de mayo', motivo: 'Día de la pastelería' },
      { fecha: 'segundo domingo de mayo', motivo: 'Día de la Madre' },
      { fecha: 'diciembre', motivo: 'temporada de pan de pascua y pedidos navideños' },
    ],
  },
  clinica_dental: {
    nombre: 'Clínica dental',
    tono: 'profesional y tranquilizador, sin tecnicismos innecesarios',
    enfoques: [
      { id: 'servicio', label: 'Servicio destacado', pista: 'explica un tratamiento en lenguaje simple', categoriaFoto: 'equipo' },
      { id: 'precio', label: 'Precio y datos', pista: 'menciona un valor, plan de pago o convenio real', categoriaFoto: 'local' },
      { id: 'confianza', label: 'Confianza', pista: 'transmite seguridad: equipo, tecnología o testimonio', categoriaFoto: 'equipo' },
      { id: 'recordatorio', label: 'Recordatorio de salud', pista: 'motiva a agendar un chequeo o control', categoriaFoto: 'local' },
    ],
    categoriasFoto: ['local', 'equipo'],
    calendarioComercial: [
      { fecha: '9 de febrero', motivo: 'Día Mundial de la Salud Dental' },
      { fecha: 'marzo', motivo: 'vuelta a clases, control dental escolar' },
      { fecha: 'enero', motivo: 'propósitos de año nuevo, salud' },
    ],
  },
};

function getNicho(id) {
  return NICHOS[id] || null;
}

function listNichos() {
  return Object.entries(NICHOS).map(([id, n]) => ({ id, nombre: n.nombre }));
}

module.exports = { NICHOS, getNicho, listNichos };
