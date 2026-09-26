// Plan de contenido del negocio: lo que responde en la bienvenida del panel
// (objetivo, a quién le habla, qué lo hace distinto, tono) y cuánto quiere
// publicar por semana de cada formato. La estrategia lo usa para elegir sus
// enfoques y el generador para decidir formatos y fechas.

const FORMATOS = ['post', 'carrusel', 'reel', 'historia'];
const MAX_POR_FORMATO = 14; // dos al día: más que eso no es un plan realista
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const OBJETIVOS = [
  { id: 'ventas', label: 'Vender más', detalle: 'Que más gente compre o pida tus productos.' },
  { id: 'consultas', label: 'Más reservas o consultas', detalle: 'Que te escriban, agenden o reserven.' },
  { id: 'seguidores', label: 'Ganar seguidores', detalle: 'Llegar a gente nueva que no te conoce.' },
  { id: 'comunidad', label: 'Fidelizar clientes', detalle: 'Que tus clientes vuelvan y te recomienden.' },
  { id: 'marca', label: 'Dar a conocer la marca', detalle: 'Que te reconozcan y recuerden.' },
];

const TONOS = [
  { id: 'cercano', label: 'Cercano', detalle: 'Como un vecino de confianza. Tutea.' },
  { id: 'profesional', label: 'Profesional', detalle: 'Claro, confiable y sin chistes.' },
  { id: 'divertido', label: 'Divertido', detalle: 'Con humor y energía.' },
  { id: 'inspirador', label: 'Inspirador', detalle: 'Emotivo, que invite a soñar.' },
  { id: 'premium', label: 'Premium', detalle: 'Elegante y cuidado, pocas palabras.' },
];

// Sugerencias para quien no sabe cuánto publicar.
const RITMOS = [
  { id: 'basico', label: 'Básico', detalle: 'Para empezar sin agobiarte.', semanal: { post: 2, carrusel: 1, reel: 0, historia: 3 } },
  { id: 'recomendado', label: 'Recomendado', detalle: 'Constante y con variedad.', semanal: { post: 2, carrusel: 1, reel: 1, historia: 5 } },
  { id: 'intensivo', label: 'Intensivo', detalle: 'Para crecer rápido.', semanal: { post: 3, carrusel: 2, reel: 2, historia: 7 } },
];

const SEMANAL_POR_DEFECTO = RITMOS[1].semanal;

function texto(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// Valida lo que manda el panel. Devuelve { plan } o { error }.
function normalizar(body) {
  const b = body || {};
  const objetivos = (Array.isArray(b.objetivos) ? b.objetivos : [b.objetivo])
    .filter((o) => OBJETIVOS.some((x) => x.id === o));
  if (!objetivos.length) return { error: 'Elige al menos un objetivo' };
  const tono = TONOS.some((t) => t.id === b.tono) ? b.tono : null;
  const semanal = {};
  for (const f of FORMATOS) {
    const n = Math.floor(Number(b.semanal && b.semanal[f]));
    semanal[f] = Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_POR_FORMATO) : 0;
  }
  if (!totalSemanal({ semanal })) return { error: 'Elige al menos una publicación por semana' };
  const hora = HORA_RE.test(String(b.hora || '')) ? b.hora : null;
  return {
    plan: {
      objetivos: [...new Set(objetivos)],
      publico: texto(b.publico, 300),
      diferenciador: texto(b.diferenciador, 300),
      tono,
      semanal,
      hora,
    },
  };
}

function totalSemanal(plan) {
  if (!plan || !plan.semanal) return 0;
  return FORMATOS.reduce((s, f) => s + (plan.semanal[f] || 0), 0);
}

// Mezcla en porcentajes (la misma forma que estilo.mezcla) según el plan.
function mezcla(plan) {
  const total = totalSemanal(plan);
  if (!total) return null;
  const m = {};
  for (const f of FORMATOS) m[f] = ((plan.semanal[f] || 0) / total) * 100;
  return m;
}

// Texto para los prompts: qué busca el negocio y a quién le habla.
function textoParaPrompt(plan) {
  if (!plan) return '';
  const partes = [];
  const objetivos = (plan.objetivos || []).map((id) => (OBJETIVOS.find((o) => o.id === id) || {}).label).filter(Boolean);
  if (objetivos.length) partes.push(`Objetivo en Instagram: ${objetivos.join(', ').toLowerCase()}.`);
  if (plan.publico) partes.push(`Le habla a: ${plan.publico}.`);
  if (plan.diferenciador) partes.push(`Lo que lo hace distinto: ${plan.diferenciador}.`);
  const tono = TONOS.find((t) => t.id === plan.tono);
  if (tono) partes.push(`Tono preferido: ${tono.label.toLowerCase()} (${tono.detalle.toLowerCase()})`);
  return partes.join(' ');
}

function catalogo() {
  return { objetivos: OBJETIVOS, tonos: TONOS, ritmos: RITMOS, formatos: FORMATOS, maxPorFormato: MAX_POR_FORMATO };
}

module.exports = {
  FORMATOS, OBJETIVOS, TONOS, RITMOS, SEMANAL_POR_DEFECTO,
  normalizar, totalSemanal, mezcla, textoParaPrompt, catalogo,
};
