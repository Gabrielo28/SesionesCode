/*
 * Puente entre el Centro de escaneo (app privada en claude.ai) y el escáner de mercado.
 *
 * El Centro guarda en su base:
 *   cola/<auto>          lo que se agregó para escanear: nombre, web, rubro, ciudad, lote, estado
 *   negocios/<id>        resultados del escaneo (los escribe Claude con ArtifactData)
 *   seguimiento/<id>     estado, notas, modo taller y mensaje editado (los escribe la app)
 *
 *   node centro.js csv <carpeta-cola>            cola exportada (JSON por documento) -> un CSV por lote en ./cola-csv/
 *   node centro.js docs <resultados.json> <lote> <carpeta-salida>
 *                                                resultados del escáner -> un JSON por negocio + lotes de escritura
 *
 * Flujo "escanea la cola" (lo hace Claude):
 *   1. ArtifactData list de "cola" con out_dir, solo estado "pendiente"
 *   2. node centro.js csv <out_dir>/cola
 *   3. node ../mercado/escanear-mercado.js cola-csv/<lote>.csv --nombre <lote>
 *   4. node centro.js docs ../mercado/resultados/<lote>.json <lote> salida/
 *   5. ArtifactData batch con salida/batch-N.json (50 por tanda) y update de cada cola/<id> a estado "escaneado"
 */
const fs = require('fs');
const path = require('path');

const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const dom = w => String(w || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
// Mismo id que usa la app: nombre + dominio. Así un reescaneo actualiza el mismo negocio y no pisa su seguimiento.
const idDe = n => slug(n.nombre + '-' + (dom(n.web) || 'sin-web'));
const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';

const [cmd, a, b, c] = process.argv.slice(2);

if (cmd === 'csv') {
  const archivos = fs.readdirSync(a).filter(f => f.endsWith('.json'));
  const porLote = {};
  for (const f of archivos) {
    const raw = JSON.parse(fs.readFileSync(path.join(a, f), 'utf8'));
    const d = raw.data || raw;
    if (d.estado && d.estado !== 'pendiente') continue;
    const lote = slug(d.lote || 'cola');
    (porLote[lote] = porLote[lote] || []).push(Object.assign({ _id: raw.id || path.basename(f, '.json') }, d));
  }
  fs.mkdirSync('cola-csv', { recursive: true });
  for (const [lote, items] of Object.entries(porLote)) {
    const filas = ['nombre,web,rubro,ciudad,cola_id'].concat(items.map(i => [i.nombre, i.web, i.rubro, i.ciudad, i._id].map(q).join(',')));
    fs.writeFileSync(path.join('cola-csv', lote + '.csv'), filas.join('\n'));
    console.log(`cola-csv/${lote}.csv  ${items.length} negocios`);
  }
  if (!Object.keys(porLote).length) console.log('No hay pendientes en la cola.');
} else if (cmd === 'docs') {
  const r = JSON.parse(fs.readFileSync(a, 'utf8')); const lote = slug(b || r.rubro || 'lista');
  const out = c || 'salida'; fs.mkdirSync(path.join(out, 'negocios'), { recursive: true });
  const vistos = {}; const ids = [];
  for (const n of r.negocios) {
    let id = idDe(n); if (vistos[id]) id += '-' + (++vistos[id]); else vistos[id] = 1;
    const info = {}; ['plataforma', 'ms', 'camino', 'revisar', 'whatsapp', 'pixel', 'analytics'].forEach(k => { if (n.info && n.info[k] != null) info[k] = n.info[k]; });
    const doc = { nombre: n.nombre, web: n.web || '', rubro: n.rubro || '', ciudad: n.ciudad || '', lote, nivel: n.nivel, oportunidad: n.oportunidad,
      codigos: n.codigos.map(x => ({ id: x.id, evidencia: x.evidencia })), mensaje: n.mensaje || '', info, escaneado: r.generado };
    fs.writeFileSync(path.join(out, 'negocios', id + '.json'), JSON.stringify(doc)); ids.push(id);
  }
  const abs = path.resolve(out);
  for (let k = 0; k < ids.length; k += 50) {
    const w = ids.slice(k, k + 50).map(id => ({ op: 'set', collection: 'negocios', doc_id: id, file_path: path.join(abs, 'negocios', id + '.json') }));
    fs.writeFileSync(path.join(out, `batch-${k / 50 + 1}.json`), JSON.stringify(w));
  }
  console.log(`${ids.length} negocios listos en ${out}/negocios, ${Math.ceil(ids.length / 50)} tandas de escritura (batch-N.json).`);
  console.log('Ojo: "set" reemplaza el documento. Si el negocio ya existía, léelo antes y pasa su version como if_version.');
} else {
  console.log('Uso: node centro.js csv <carpeta-cola> | node centro.js docs <resultados.json> <lote> <salida>');
}
