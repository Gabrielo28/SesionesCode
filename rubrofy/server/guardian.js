// Guardián de marca: revisa cada texto antes de que el dueño lo apruebe y
// marca lo que conviene verificar. No bloquea nada — la decisión es del
// dueño —, pero evita los errores caros del contenido con IA:
//   - promesas de salud o de resultados (delicadas en clínicas, estética,
//     suplementos; en Chile la publicidad de salud está regulada),
//   - precios, descuentos o fechas que no están en los datos del negocio
//     (la IA pudo inventarlos),
//   - frases de plantilla que delatan un texto genérico de IA.
// Sin dependencias ni IA: corre en todos los planes.

const PROMESAS = [
  /\bcura(r|mos|n)?\b/i, /\bsana(r)?\b/i, /garantiza(do|da|dos|das|mos)?\b/i, /\b100\s?%\s*(efectiv|segur|garantiz|natural)/i,
  /\belimina(r|mos)?\b.*\b(dolor|grasa|arrugas|manchas|celulitis|acn[eé])/i, /\badelgaz/i, /\bbaja(r)? de peso\b/i,
  /\bsin dolor\b/i, /\bmilagr/i, /\bresultados? (inmediatos?|asegurados?|permanentes?|definitivos?)/i,
  /\bpara siempre\b/i, /\bsin efectos (secundarios|adversos)\b/i, /\bprevien(e|en)\b.*\b(c[aá]ncer|enfermedad|covid)/i,
];

const PLANTILLA = [
  /\bdescubre\b/i, /\bno te lo pierdas\b/i, /\bs[uú]mergete\b/i, /\ben el mundo de\b/i, /\beleva tu\b/i,
  /\bexperiencia (única|inolvidable|incomparable)\b/i, /\bno busques más\b/i, /\blleva(r)? tu .* al siguiente nivel\b/i,
];

const PRECIO = /(\$\s?\d{1,3}(?:[.\s]\d{3})+|\$\s?\d{3,}|\b\d{1,3}(?:\.\d{3})+\s?(?:pesos|clp)\b|\b\d{4,}\s?(?:pesos|clp)\b)/gi;
const DESCUENTO = /\b(\d{1,2})\s?%/g;
const FECHA = /\b(hasta el|este|próximo|proximo|desde el)\s+(\d{1,2}(\s+de\s+[a-záéíóú]+)?|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/gi;

const soloDigitos = (s) => String(s || '').replace(/\D/g, '');

function revisar(texto, negocio) {
  const t = String(texto || '');
  const datos = (negocio && negocio.datos) || {};
  const datosTexto = [datos.precioDesde, datos.promo, datos.productoDestacado, datos.unidad].filter(Boolean).join(' ');
  const numerosConocidos = new Set((datosTexto.match(/\d[\d.]*/g) || []).map(soloDigitos).filter(Boolean));
  const alertas = [];

  const promesa = PROMESAS.find((re) => re.test(t));
  if (promesa) {
    alertas.push({ tipo: 'promesa', texto: `Promete un resultado ("${t.match(promesa)[0].slice(0, 40)}"). Verifica que puedas cumplirlo; en salud y estética la publicidad está regulada.` });
  }

  for (const m of t.match(PRECIO) || []) {
    if (!numerosConocidos.has(soloDigitos(m))) {
      alertas.push({ tipo: 'dato', texto: `El precio ${m.trim()} no está en los datos de tu negocio: confirma que sea correcto.` });
      break;
    }
  }

  for (const m of t.matchAll(DESCUENTO)) {
    if (!numerosConocidos.has(m[1]) || !/%/.test(datosTexto)) {
      alertas.push({ tipo: 'dato', texto: `Menciona un ${m[1]}% que no está en tu promoción cargada: confirma que exista.` });
      break;
    }
  }

  const fecha = t.match(FECHA);
  if (fecha) alertas.push({ tipo: 'dato', texto: `Menciona una fecha ("${fecha[0]}"): revisa que calce con el día en que se publica.` });

  const plantilla = PLANTILLA.find((re) => re.test(t));
  if (plantilla) {
    alertas.push({ tipo: 'estilo', texto: `"${t.match(plantilla)[0]}" suena a texto genérico de IA; considera decirlo con tus palabras.` });
  }
  return alertas;
}

// Recalcula las alertas del texto vigente de una pieza.
// También el puntaje de voz de marca (server/voz.js), si el negocio tiene ficha.
function aplicar(item, negocio) {
  const texto = item.variants[item.variantIndex];
  item.alertas = revisar(texto, negocio);
  const v = require('./voz').puntuar(texto, negocio);
  if (v) item.voz = v; else delete item.voz;
  return item;
}

module.exports = { revisar, aplicar };
