/*
 * Datos de la app de Impulz: archivos JSON en DATA_DIR (en Railway, un volumen montado en /data).
 * Nunca se suben a git: el repositorio es público y aquí hay nombres y teléfonos de personas.
 *
 *   leads.json      contactos y socios atribuidos (objeto id → contacto)
 *   config.json     acuerdo comercial y textos de la página de reservas
 *   inversion.json  inversión mensual en publicidad (solo la ve el administrador)
 *   historial.log   un cambio por línea (JSON), solo se agrega, nunca se edita
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'datos');
fs.mkdirSync(DIR, { recursive: true });

const CONFIG_INICIAL = {
  pctPrimer: 100, pctRecurrente: 15, mesesRecurrente: 6, pctPase: 30, mensualidad: 25000,
  inicio: '', whatsapp: '', beneficio: 'Matrícula gratis al inscribirte con tu código', promo: ''
};

function leer(nombre, porDefecto) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, nombre), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') console.error('No se pudo leer ' + nombre + ':', e.message); return porDefecto; }
}
function escribir(nombre, valor) {
  const destino = path.join(DIR, nombre);
  const tmp = destino + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 1));
  fs.renameSync(tmp, destino);
}

let leads = leer('leads.json', {});
let config = { ...CONFIG_INICIAL, ...leer('config.json', {}) };
let inversion = leer('inversion.json', {});

const LETRAS = 'ACDEFGHJKMNPQRTUVWXY34679';
function nuevoCodigo() {
  const usados = new Set(Object.values(leads).map(l => l.codigo));
  for (;;) {
    let c = 'IMP-';
    for (let i = 0; i < 4; i++) c += LETRAS[crypto.randomInt(LETRAS.length)];
    if (!usados.has(c)) return c;
  }
}

module.exports = {
  DIR,
  listaLeads: () => Object.values(leads),
  lead: id => leads[id] || null,
  porCodigo: c => Object.values(leads).find(l => l.codigo === String(c || '').toUpperCase().trim()) || null,
  guardarLead(l) { leads[l.id] = l; escribir('leads.json', leads); return l; },
  borrarLead(id) { const l = leads[id]; delete leads[id]; escribir('leads.json', leads); return l; },
  nuevoId: () => crypto.randomUUID(),
  nuevoCodigo,
  config: () => ({ ...config }),
  guardarConfig(c) { config = { ...config, ...c }; escribir('config.json', config); return { ...config }; },
  inversion: () => ({ ...inversion }),
  guardarInversion(mes, monto) { inversion[mes] = monto; escribir('inversion.json', inversion); return { ...inversion }; },
  registrar(entrada) {
    fs.appendFileSync(path.join(DIR, 'historial.log'), JSON.stringify({ t: new Date().toISOString(), ...entrada }) + '\n');
  },
  historial(limite = 300) {
    let texto = '';
    try { texto = fs.readFileSync(path.join(DIR, 'historial.log'), 'utf8'); } catch (e) { return []; }
    return texto.trim().split('\n').filter(Boolean).slice(-limite).reverse().map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  }
};
