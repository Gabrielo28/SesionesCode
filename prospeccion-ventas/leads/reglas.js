/*
 * Reglas de oportunidad — el bloque 3 de la skill prospector-leads.
 *
 * ESTE ES EL ARCHIVO QUE CALIBRAS TÚ. La estructura de la skill es universal;
 * el criterio de "oportunidad alta" depende de lo que vendes, y se invierte
 * según el tipo de oferta:
 *
 *   construir  → vendes algo que se hace desde cero (web nueva, redes desde cero).
 *                El negocio SIN presencia en ese canal es tu mejor prospecto.
 *   optimizar  → vendes ordenar / mejorar lo que ya existe (gestión de redes,
 *                rediseño, SEO). El que no tiene nada NO sirve: no hay qué mejorar.
 *                Tu alta es el que ya tiene algo, pero desordenado o abandonado.
 *   escalar    → vendes crecimiento sobre una base sana (pauta, influencers,
 *                automatización). Necesitas que el canal ya funcione.
 *
 * Madurez del canal (la llena la skill por cada prospecto, con evidencia):
 *   0 = ninguna      no existe
 *   1 = abandonada   existe pero muerta o mínima (último post hace meses, web de 1 página caída o sin contacto)
 *   2 = desordenada  activa pero mal hecha (fotos de celular, sin CTA, web lenta, sin reservas)
 *   3 = buena        bien hecha y al día
 */

const MADUREZ = { ninguna: 0, abandonada: 1, basica: 1, desordenada: 2, buena: 3 };

// Para cada tipo de oferta: nivel de oportunidad según la madurez (índice 0..3).
const MATRIZ = {
  construir: ['alta', 'alta', 'media', 'baja'],
  optimizar: ['baja', 'alta', 'alta', 'media'],
  escalar:   ['baja', 'baja', 'media', 'alta']
};

// Puntos de "encaje" por nivel. El puntaje total (0-100) solo ordena DENTRO de cada nivel.
const PUNTOS_ENCAJE = { alta: 60, media: 35, baja: 10 };

// Desempates dentro de optimizar: desordenada (2) le gana a abandonada (1),
// porque ya está pagando el costo de hacerlo mal y lo sabe.
const BONO_MADUREZ = {
  construir: [10, 4, 0, 0],
  optimizar: [0, 4, 10, 0],
  escalar:   [0, 0, 4, 10]
};

// Demanda: un negocio vivo y con clientes paga; uno sin reseñas puede ni estar operando.
function puntosDemanda(p) {
  const g = p.google || {};
  const n = Number(g.resenas) || 0;
  let pts = n >= 200 ? 15 : n >= 50 ? 11 : n >= 15 ? 7 : n >= 1 ? 3 : 0;
  if (g.rating >= 4.5) pts += 5; else if (g.rating >= 4.0) pts += 3;
  if (p.sucursales > 1) pts += 5;
  return Math.min(pts, 25);
}

// Contactabilidad: un lead sin cómo escribirle no es un lead.
function puntosContacto(p) {
  let pts = 0;
  if (p.email) pts += 8;
  if (p.telefono || p.whatsapp) pts += 5;
  if (p.instagram) pts += 2;
  return pts;
}

const tieneContacto = p => !!(p.email || p.telefono || p.whatsapp || p.instagram);

// Madurez del canal que importa para la oferta.
function madurezCanal(p, canal) {
  const s = p.senales || {};
  const web = MADUREZ[s.web] ?? null;
  const redes = MADUREZ[s.redes] ?? null;
  if (canal === 'web') return web;
  if (canal === 'redes') return redes;
  // ambos: manda el canal más débil (es donde está el trabajo)
  if (web == null) return redes;
  if (redes == null) return web;
  return Math.min(web, redes);
}

const BAJAR = { alta: 'media', media: 'baja', baja: 'baja' };

function clasificar(p, campana) {
  const tipo = campana.tipo_oferta;
  if (!MATRIZ[tipo]) throw new Error(`tipo_oferta inválido: "${tipo}" (usa construir | optimizar | escalar)`);
  const m = madurezCanal(p, campana.canal || 'ambos');
  const motivos = [];
  let nivel;

  if (m == null) {
    nivel = 'baja';
    motivos.push('sin dato de madurez del canal: revisar a mano');
  } else {
    nivel = MATRIZ[tipo][m];
    motivos.push(`madurez ${m}/3 en ${campana.canal || 'ambos'} → ${nivel} para "${tipo}"`);
  }

  // Un negocio sin señales de vida no paga, aunque calce perfecto.
  const demanda = puntosDemanda(p);
  const activo = p.senales?.activo || (p.ultimo_post_dias != null && p.ultimo_post_dias <= 60);
  if (nivel === 'alta' && demanda === 0 && !activo) {
    nivel = 'media';
    motivos.push('sin reseñas ni señal de actividad: baja a media');
  }
  if (!tieneContacto(p)) {
    nivel = BAJAR[nivel];
    motivos.push('sin ningún dato de contacto: baja un nivel');
  }

  // Override manual con motivo explícito (la skill o tú)
  if (p.oportunidad && p.oportunidad !== nivel) {
    if (!p.motivo_override) throw new Error(`"${p.nombre}": oportunidad forzada a "${p.oportunidad}" sin motivo_override`);
    motivos.push(`override: ${p.motivo_override}`);
    nivel = p.oportunidad;
  }

  const puntaje = Math.min(100,
    PUNTOS_ENCAJE[nivel] + (m == null ? 0 : BONO_MADUREZ[tipo][m]) +
    Math.round(demanda * 0.6) + puntosContacto(p));

  return { nivel, puntaje, madurez: m, motivos };
}

module.exports = { clasificar, MATRIZ, MADUREZ };
