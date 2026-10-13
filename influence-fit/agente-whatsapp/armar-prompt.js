/*
 * Arma el prompt final del agente reemplazando los {{placeholders}} con faq.json.
 *   node armar-prompt.js              usa faq.json
 *   node armar-prompt.js otro.json    usa otro archivo (un coach distinto)
 * Produce: prompt-<coach>.txt listo para pegar en SendPulse.
 */
const fs = require('fs');
const path = require('path');

const archivo = process.argv[2] || 'faq.json';
const d = JSON.parse(fs.readFileSync(path.join(__dirname, archivo), 'utf8'));
const md = fs.readFileSync(path.join(__dirname, 'prompt-agente.md'), 'utf8');

const bloque = md.match(/## Prompt de sistema\s*```\n([\s\S]*?)\n```/);
if (!bloque) throw new Error('No encontré el bloque del prompt en prompt-agente.md');

d.faq_lista = (d.faq || []).map(f => `- ${f.p} → ${f.r}`).join('\n');
d.WEBHOOK_URL = d.WEBHOOK_URL || '{{WEBHOOK_URL}}';

let faltan = [];
const texto = bloque[1].replace(/\{\{(\w+)\}\}/g, (m, k) => {
  if (k === 'nombre') return m; // lo rellena el bot en tiempo real
  if (d[k] === undefined) { faltan.push(k); return m; }
  return String(d[k]);
});

const slug = (d.coach_nombre_corto || 'coach').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');
const out = path.join(__dirname, `prompt-${slug}.txt`);
fs.writeFileSync(out, texto, 'utf8');
console.log('Prompt ->', out, `(${texto.length} caracteres)`);
if (faltan.length) console.warn('Faltan en el JSON:', [...new Set(faltan)].join(', '));
