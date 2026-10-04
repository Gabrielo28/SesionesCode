// Costo de IA: cada llamada a un proveedor (Claude, Higgsfield, OpenAI)
// queda registrada con lo que consumió (tokens, imágenes, segundos de
// video) y su costo en dólares, para el panel de administración.
//
// Los textos usan los tokens reales que devuelve la API de Claude. Las
// imágenes y videos usan una tarifa por unidad: son estimaciones que se
// ajustan con variables de entorno si el proveedor cambia sus precios.
// Solo se guardan cifras de uso, nunca el contenido de un negocio.

const store = require('./store');

// USD por millón de tokens (entrada / salida), según la tabla de precios de Anthropic.
const PRECIOS_CLAUDE = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5-5': [2, 10],
  'claude-sonnet-5': [2, 10],
  'claude-sonnet-4-6': [3, 15],
  'claude-opus-5-5': [4, 20],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-fable-5-1': [10, 50],
};
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const tarifa = () => ({
  imagen: { higgsfield: num(process.env.COSTO_IMAGEN_HIGGSFIELD_USD, 0.006), openai: num(process.env.COSTO_IMAGEN_OPENAI_USD, 0.053) },
  videoSegundo: { higgsfield: num(process.env.COSTO_VIDEO_SEG_HIGGSFIELD_USD, 0.15), openai: num(process.env.COSTO_VIDEO_SEG_OPENAI_USD, 0.1) },
});
const DOLAR_CLP = () => num(process.env.DOLAR_CLP, 950);

function precioClaude(modelo) {
  const m = String(modelo || '');
  const clave = Object.keys(PRECIOS_CLAUDE).sort((a, b) => b.length - a.length).find((k) => m.startsWith(k));
  return PRECIOS_CLAUDE[clave || 'claude-haiku-4-5'];
}

const db = store.db;
db.exec(`
  CREATE TABLE IF NOT EXISTS uso_ia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negocio_id TEXT,
    fecha TEXT NOT NULL,             -- ISO
    proveedor TEXT NOT NULL,         -- anthropic | higgsfield | openai
    tipo TEXT NOT NULL,              -- textos | imagen | video
    uso TEXT,                        -- para qué: contenido, estrategia, voz, redactor, informe…
    modelo TEXT,
    entrada INTEGER,                 -- tokens de entrada
    salida INTEGER,                  -- tokens de salida
    cantidad REAL,                   -- imágenes o segundos de video
    costo_usd REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS uso_ia_fecha ON uso_ia (fecha);
`);
// Al borrar un negocio su gasto queda (es gasto real de la plataforma), sin el vínculo.
store.registrarLimpieza((negocioId) => db.prepare('UPDATE uso_ia SET negocio_id = NULL WHERE negocio_id = ?').run(negocioId));
const insertar = db.prepare(`INSERT INTO uso_ia (negocio_id, fecha, proveedor, tipo, uso, modelo, entrada, salida, cantidad, costo_usd)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

function guardar(f) {
  try {
    insertar.run(f.negocioId || null, new Date().toISOString(), f.proveedor, f.tipo, f.uso || null, f.modelo || null,
      f.entrada || null, f.salida || null, f.cantidad == null ? null : f.cantidad, Math.round(f.costo * 1e6) / 1e6);
  } catch (err) {
    // registrar el costo nunca debe romper una generación
  }
}

// usage: el objeto `usage` de la respuesta de Claude.
function claude(negocioId, uso, modelo, usage) {
  if (!usage) return;
  const [pe, ps] = precioClaude(modelo);
  const entrada = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  const salida = usage.output_tokens || 0;
  const costo = ((usage.input_tokens || 0) * pe + (usage.cache_creation_input_tokens || 0) * pe * 1.25
    + (usage.cache_read_input_tokens || 0) * pe * 0.1 + salida * ps) / 1e6;
  guardar({ negocioId, proveedor: 'anthropic', tipo: 'textos', uso, modelo, entrada, salida, costo });
}

// usd: costo real del modelo (server/creditos.js); sin él, la tarifa general.
function imagen(negocioId, proveedor, modelo, usd) {
  guardar({ negocioId, proveedor, tipo: 'imagen', uso: 'imagen', modelo, cantidad: 1, costo: usd != null ? usd : (tarifa().imagen[proveedor] || 0) });
}

// usdSegundo: costo real por segundo del modelo; sin él, la tarifa general.
function video(negocioId, proveedor, modelo, segundos, usdSegundo) {
  guardar({ negocioId, proveedor, tipo: 'video', uso: 'video', modelo, cantidad: segundos, costo: (usdSegundo != null ? usdSegundo : (tarifa().videoSegundo[proveedor] || 0)) * segundos });
}

// --- resumen para el panel de administración ---

const sql = {
  total: db.prepare('SELECT COALESCE(SUM(costo_usd), 0) AS c, COUNT(*) AS n FROM uso_ia WHERE fecha >= ?'),
  porTipo: db.prepare(`SELECT tipo, COALESCE(SUM(costo_usd), 0) AS costo, COUNT(*) AS llamadas, COALESCE(SUM(entrada), 0) AS entrada,
      COALESCE(SUM(salida), 0) AS salida, COALESCE(SUM(cantidad), 0) AS cantidad FROM uso_ia WHERE fecha >= ? GROUP BY tipo`),
  porUso: db.prepare('SELECT COALESCE(uso, tipo) AS uso, COALESCE(SUM(costo_usd), 0) AS costo, COUNT(*) AS llamadas FROM uso_ia WHERE fecha >= ? GROUP BY 1 ORDER BY 2 DESC'),
  porDia: db.prepare('SELECT substr(fecha, 1, 10) AS dia, COALESCE(SUM(costo_usd), 0) AS costo FROM uso_ia WHERE fecha >= ? GROUP BY 1 ORDER BY 1'),
  porNegocio: db.prepare('SELECT negocio_id, COALESCE(SUM(costo_usd), 0) AS costo, COUNT(*) AS llamadas FROM uso_ia WHERE fecha >= ? GROUP BY negocio_id'),
  mes: db.prepare('SELECT COALESCE(SUM(costo_usd), 0) AS c FROM uso_ia WHERE fecha >= ?'),
};

// negocios: [{ id, nombre, plan, cortesia? }]; precioPlan(negocio) → CLP que
// paga al mes de verdad (server/pagos.js: pagoMensual).
function resumen({ dias, negocios, precioPlan, ahora = new Date() }) {
  const desde = new Date(ahora.getTime() - dias * 24 * 3600 * 1000).toISOString();
  const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)).toISOString();
  const diasMes = Math.max(1, (ahora - Date.parse(inicioMes)) / (24 * 3600 * 1000));
  const t = sql.total.get(desde);
  const gastoMes = sql.mes.get(inicioMes).c;
  const porNeg = new Map(sql.porNegocio.all(desde).map((f) => [f.negocio_id, f]));
  const dolar = DOLAR_CLP();
  const filas = negocios.map((n) => {
    const f = porNeg.get(n.id) || { costo: 0, llamadas: 0 };
    const ingresoPeriodoUsd = n.cortesia ? 0 : (precioPlan(n) / dolar) * (dias / 30);
    return {
      id: n.id, nombre: n.nombre, plan: n.plan || 'gratis', costoUsd: f.costo, llamadas: f.llamadas,
      ingresoUsd: ingresoPeriodoUsd, margen: ingresoPeriodoUsd ? (ingresoPeriodoUsd - f.costo) / ingresoPeriodoUsd : null,
    };
  }).filter((f) => f.costoUsd > 0 || f.plan !== 'gratis').sort((a, b) => b.costoUsd - a.costoUsd);
  const borrados = porNeg.get(null);
  const porPlan = {};
  for (const f of filas) {
    const p = (porPlan[f.plan] = porPlan[f.plan] || { negocios: 0, costoUsd: 0 });
    p.negocios += 1;
    p.costoUsd += f.costoUsd;
  }
  for (const p of Object.values(porPlan)) p.promedioUsd = p.negocios ? p.costoUsd / p.negocios : 0;
  const ingresos = filas.reduce((s, f) => s + f.ingresoUsd, 0);
  return {
    dias, desde, dolarClp: dolar,
    totalUsd: t.c, llamadas: t.n,
    mesUsd: gastoMes, proyeccionMesUsd: (gastoMes / diasMes) * 30,
    ingresosUsd: ingresos, margen: ingresos ? (ingresos - t.c) / ingresos : null,
    porTipo: Object.fromEntries(sql.porTipo.all(desde).map((f) => [f.tipo, f])),
    porUso: sql.porUso.all(desde),
    serie: sql.porDia.all(desde),
    porPlan,
    negocios: filas.slice(0, 50),
    sinNegocioUsd: borrados ? borrados.costo : 0,
    tarifas: tarifa(),
  };
}

// Transcripción de voz a texto (subtítulos de reels editados), por minuto.
function audio(negocioId, proveedor, modelo, segundos) {
  const porMinuto = num(process.env.COSTO_TRANSCRIPCION_MIN_USD, 0.006);
  guardar({ negocioId, proveedor, tipo: 'audio', uso: 'subtitulos', modelo, cantidad: Math.round(segundos), costo: porMinuto * (segundos / 60) });
}

module.exports = { claude, imagen, video, audio, resumen, precioClaude };
