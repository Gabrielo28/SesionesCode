// Crea negocios de ejemplo (uno por nicho) con su banco de contenido inicial.
// Correr una vez: node server/seed.js  (no borra negocios existentes con el mismo id
// si ya tienen contenido generado, para no perder aprobaciones al reiniciar).

const store = require('./store');
const { generarBanco } = require('./generator');

const NEGOCIOS_EJEMPLO = [
  {
    id: 'domo-bosque-sur',
    nombre: 'Domo Bosque Sur',
    nicho: 'turismo',
    marca: { color: '#7fae6b' },
    datos: {
      precioDesde: '$89.000',
      unidad: 'noche',
      promo: '15% de descuento en temporada baja',
      productoDestacado: 'domo con tina caliente',
    },
  },
  {
    id: 'panaderia-migas',
    nombre: 'Panadería Migas',
    nicho: 'panaderia',
    marca: { color: '#e6a23a' },
    datos: {
      precioDesde: '$2.500',
      unidad: 'combo pan + café',
      promo: '2x1 en masas los miércoles',
      productoDestacado: 'pan de masa madre',
    },
  },
  {
    id: 'clinica-sonrisa-sur',
    nombre: 'Clínica Sonrisa Sur',
    nicho: 'clinica_dental',
    marca: { color: '#7d93a8' },
    datos: {
      precioDesde: '$45.000',
      promo: 'plan de pago en 3 cuotas sin interés',
      productoDestacado: 'limpieza dental profesional',
    },
  },
];

for (const negocio of NEGOCIOS_EJEMPLO) {
  const existente = store.getNegocio(negocio.id);
  if (!existente) store.saveNegocio(negocio);

  const contenidoExistente = store.getContenido(negocio.id);
  if (contenidoExistente.length === 0) {
    const banco = generarBanco(negocio, 6, 0);
    // Deja un par de ejemplos ya decididos para que el panel no arranque vacío de estados.
    if (banco[2]) banco[2].status = 'aprobado';
    if (banco[4]) banco[4].status = 'rechazado';
    store.saveContenido(negocio.id, banco);
  }
}

console.log('Negocios de ejemplo listos:', NEGOCIOS_EJEMPLO.map((n) => n.id).join(', '));
