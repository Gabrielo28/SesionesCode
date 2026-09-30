// Cliente mínimo de la API de Claude. Todas las llamadas de Rubrofy pasan
// por llamar(): aquí se decide el modelo y sus opciones, se registra el
// costo y se maneja el rechazo. pedir() es el atajo que devuelve solo el
// texto (o null: cada llamador tiene su plan B).
//
// Modelo: ANTHROPIC_MODEL, por omisión Claude Sonnet 5.5. Con Sonnet 5.5
// (y los Opus/Sonnet 5): pensamiento adaptativo con esfuerzo ANTHROPIC_EFFORT
// (por omisión "low": piensa poco y solo cuando hace falta, que es lo que
// piden textos cortos), un margen de tokens para ese pensamiento, y si el
// modelo rechaza una petición, Anthropic la reintenta en otro modelo
// ("fallbacks"). ANTHROPIC_PENSAMIENTO=no lo apaga del todo en Sonnet 5.5.

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const API = 'https://api.anthropic.com/v1/messages';

// Modelos que aceptan output_config.effort y piensan de forma adaptativa.
const CON_ESFUERZO = /^claude-(sonnet-5|opus-5|opus-4-[678]|fable-5)/;
// Modelos con reintento automático en otro modelo si rechazan la petición.
const CON_RESPALDO = /^claude-(sonnet-5-5|opus-5|fable-5-1)/;
const ESFUERZOS = ['low', 'medium', 'high', 'xhigh', 'max'];
// El pensamiento cuenta dentro de max_tokens: se suma este margen para que
// la respuesta no salga cortada.
const MARGEN_PENSAMIENTO = 4000;

function configurado() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function esfuerzo() {
  const e = String(process.env.ANTHROPIC_EFFORT || 'low').toLowerCase();
  return ESFUERZOS.includes(e) ? e : 'low';
}

// Cuerpo y cabeceras de la petición según el modelo.
function solicitud({ maxTokens, content }) {
  const headers = { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' };
  const body = { model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content }] };
  if (CON_ESFUERZO.test(MODEL)) {
    const e = esfuerzo();
    body.output_config = { effort: e };
    const sinPensar = process.env.ANTHROPIC_PENSAMIENTO === 'no' && MODEL.startsWith('claude-sonnet-5-5') && ['low', 'medium', 'high'].includes(e);
    if (sinPensar) body.thinking = { type: 'between_tools' };
    else body.max_tokens = maxTokens + MARGEN_PENSAMIENTO;
  }
  if (CON_RESPALDO.test(MODEL)) {
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }
  return { headers, body };
}

// Llama a Claude. Devuelve { texto, data } o { error } con error:
//   'sin-clave' | 'http' | 'rechazo' | 'red'.
// negocioId / uso: para registrar el costo (server/costos.js).
async function llamar({ maxTokens = 800, content, negocioId, uso }) {
  if (!configurado()) return { error: 'sin-clave' };
  const { headers, body } = solicitud({ maxTokens, content });
  try {
    const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      let detalle = '';
      try { detalle = ((await res.json()).error || {}).message || ''; } catch (e) { /* sin cuerpo */ }
      console.log(`Claude respondió ${res.status}${detalle ? ': ' + detalle : ''}`);
      return { error: 'http', status: res.status };
    }
    const data = await res.json();
    require('./costos').claude(negocioId, uso || 'otro', data.model || MODEL, data.usage);
    // Se revisa el motivo de término antes de leer el contenido.
    if (data.stop_reason === 'refusal') return { error: 'rechazo', data };
    // La respuesta puede traer bloques de pensamiento antes del texto: se leen solo los de texto.
    const texto = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
    return { texto, data };
  } catch (err) {
    return { error: 'red' };
  }
}

async function pedir({ prompt, maxTokens = 800, imagenes, negocioId, uso }) {
  const content = imagenes && imagenes.length
    ? [...imagenes.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.tipo, data: i.base64 } })), { type: 'text', text: prompt }]
    : prompt;
  const r = await llamar({ maxTokens, content, negocioId, uso });
  return r.texto || null;
}

// El primer objeto u arreglo JSON dentro del texto (Claude a veces agrega texto alrededor).
function extraerJSON(texto, tipo = 'objeto') {
  if (!texto) return null;
  const [a, b] = tipo === 'arreglo' ? ['[', ']'] : ['{', '}'];
  const inicio = texto.indexOf(a);
  const fin = texto.lastIndexOf(b);
  if (inicio === -1 || fin <= inicio) return null;
  try {
    return JSON.parse(texto.slice(inicio, fin + 1));
  } catch (err) {
    return null;
  }
}

module.exports = { llamar, pedir, extraerJSON, configurado, solicitud, MODEL };
