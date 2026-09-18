// Crea negocios de ejemplo (uno por rubro) con su banco de contenido inicial.
// Correr una vez: node server/seed.js  (no borra negocios existentes con el mismo id
// si ya tienen contenido generado, para no perder aprobaciones al reiniciar).
//
// Rubrofy es self-service: cada negocio es su propia cuenta (email + clave).
// La clave de los 3 negocios de ejemplo es siempre "rubrofy123" — solo para
// probar en local, nunca se usa en un negocio real creado desde /registro.
//
// Sus estrategias están escritas a mano (no generadas por Claude) para que
// sembrar los ejemplos sea instantáneo y no dependa de ANTHROPIC_API_KEY —
// un negocio real sí genera la suya en /registro.html vía server/estrategia.js.

const store = require('./store');
const auth = require('./auth');
const { generarBanco } = require('./generator');

const CLAVE_DEMO = 'rubrofy123';

const NEGOCIOS_EJEMPLO = [
  {
    id: 'domo-bosque-sur',
    nombre: 'Domo Bosque Sur',
    email: 'demo-turismo@rubrofy.com',
    marca: { color: '#7fae6b' },
    estiloImagen: 'limpia',
    estrategia: {
      rubro: 'turismo y hospedaje: domos y cabañas para desconectar',
      tono: 'cercano y evocador, que venda la experiencia de desconectar',
      categoriasFoto: ['exterior', 'interior', 'detalles'],
      enfoques: [
        { id: 'experiencia', label: 'Experiencia', pista: 'describe una sensación o momento concreto de la estadía', categoriaFoto: 'interior' },
        { id: 'precio', label: 'Precio y datos', pista: 'menciona una tarifa, promoción o condición real', categoriaFoto: 'exterior' },
        { id: 'urgencia', label: 'Urgencia', pista: 'destaca cupos limitados o una fecha que se acerca', categoriaFoto: 'exterior' },
        { id: 'recinto', label: 'Mostrar el recinto', pista: 'pon el foco en una instalación o vista del lugar', categoriaFoto: 'interior' },
      ],
    },
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
    email: 'demo-panaderia@rubrofy.com',
    marca: { color: '#e6a23a' },
    estiloImagen: 'limpia',
    estrategia: {
      rubro: 'panadería y pastelería de barrio',
      tono: 'cálido y casero, con olor a recién horneado',
      categoriasFoto: ['producto', 'local', 'equipo'],
      enfoques: [
        { id: 'producto', label: 'Producto del día', pista: 'destaca un producto específico recién hecho', categoriaFoto: 'producto' },
        { id: 'precio', label: 'Precio y datos', pista: 'menciona un precio, combo o promoción real', categoriaFoto: 'producto' },
        { id: 'urgencia', label: 'Urgencia', pista: 'stock limitado del día o de un producto de temporada', categoriaFoto: 'producto' },
        { id: 'proceso', label: 'Mostrar el proceso', pista: 'muestra cómo se hace o de dónde vienen los ingredientes', categoriaFoto: 'local' },
      ],
    },
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
    email: 'demo-clinica@rubrofy.com',
    marca: { color: '#7d93a8' },
    estiloImagen: 'limpia',
    estrategia: {
      rubro: 'clínica dental',
      tono: 'profesional y tranquilizador, sin tecnicismos innecesarios',
      categoriasFoto: ['local', 'equipo'],
      enfoques: [
        { id: 'servicio', label: 'Servicio destacado', pista: 'explica un tratamiento en lenguaje simple', categoriaFoto: 'equipo' },
        { id: 'precio', label: 'Precio y datos', pista: 'menciona un valor, plan de pago o convenio real', categoriaFoto: 'local' },
        { id: 'confianza', label: 'Confianza', pista: 'transmite seguridad: equipo, tecnología o testimonio', categoriaFoto: 'equipo' },
        { id: 'recordatorio', label: 'Recordatorio de salud', pista: 'motiva a agendar un chequeo o control', categoriaFoto: 'local' },
      ],
    },
    datos: {
      precioDesde: '$45.000',
      promo: 'plan de pago en 3 cuotas sin interés',
      productoDestacado: 'limpieza dental profesional',
    },
  },
];

async function main() {
  for (const negocio of NEGOCIOS_EJEMPLO) {
    const existente = store.getNegocio(negocio.id);
    if (!existente) {
      negocio.auth = auth.hashPassword(CLAVE_DEMO);
      store.saveNegocio(negocio);
    }

    const contenidoExistente = store.getContenido(negocio.id);
    if (contenidoExistente.length === 0) {
      const banco = await generarBanco(negocio, 6, 0);
      // Deja un par de ejemplos ya decididos para que el panel no arranque vacío de estados.
      if (banco[2]) banco[2].status = 'aprobado';
      if (banco[4]) banco[4].status = 'rechazado';
      store.saveContenido(negocio.id, banco);
    }
  }

  console.log('Negocios de ejemplo listos:', NEGOCIOS_EJEMPLO.map((n) => n.id).join(', '));
  console.log(`Inicia sesión en /app con cualquiera de estos emails y la clave "${CLAVE_DEMO}":`);
  for (const n of NEGOCIOS_EJEMPLO) console.log(`  - ${n.email}`);
}

main();
