/*
 * Generador del dashboard de prospectos — Influence Chile
 *
 *   node generar.js <campana.json> [carpeta-salida]
 *
 * Lee la campaña (datos que juntó la skill prospector-leads), clasifica cada
 * prospecto con reglas.js y produce en la carpeta de salida (por defecto, la
 * misma del JSON):
 *
 *   prospectos-<slug>.html      dashboard para leer (resumen, tabla, mensajes)
 *   prospectos-<slug>.crm.json  JSON plano para importar al CRM
 *   prospectos-<slug>.csv       lo mismo en CSV (HubSpot / Excel)
 */

const fs = require('fs');
const path = require('path');
const { clasificar } = require('./reglas');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normNombre = s => slugify(s).replace(/-(spa|ltda|limitada|eirl|sa)$/g, '');
const dominio = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };
const soloDigitos = t => String(t || '').replace(/\D/g, '').slice(-9);

const archivo = process.argv[2];
if (!archivo) { console.error('Uso: node generar.js <campana.json> [carpeta-salida]'); process.exit(1); }
const ruta = path.resolve(archivo);
const salida = path.resolve(process.argv[3] || path.dirname(ruta));
const d = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const c = d.campana;

// ── Validación ────────────────────────────────────────────────────────────
const faltan = ['rubro', 'zona', 'servicio', 'tipo_oferta', 'meta'].filter(k => c?.[k] == null || c[k] === '');
if (faltan.length) { console.error('Faltan datos de la campaña: ' + faltan.join(', ')); process.exit(1); }
if (!Array.isArray(d.prospectos) || !d.prospectos.length) { console.error('No hay prospectos.'); process.exit(1); }

// Deduplicar por dominio, teléfono o nombre normalizado
const vistos = new Map();
const duplicados = [];
const prospectos = [];
for (const p of d.prospectos) {
  const claves = [dominio(p.web) && 'd:' + dominio(p.web), soloDigitos(p.telefono).length === 9 && 't:' + soloDigitos(p.telefono),
    'n:' + normNombre(p.nombre) + '|' + slugify(p.comuna || '')].filter(Boolean);
  const previo = claves.map(k => vistos.get(k)).find(Boolean);
  if (previo) { duplicados.push(`${p.nombre} = ${previo.nombre}`); continue; }
  claves.forEach(k => vistos.set(k, p));
  prospectos.push(p);
}

const avisos = [];
for (const p of prospectos) {
  Object.assign(p, { _c: clasificar(p, c) });
  if (!p.fuentes || !p.fuentes.length) avisos.push(`${p.nombre}: sin fuentes (cada dato debe citar de dónde salió)`);
}
const ORDEN = { alta: 0, media: 1, baja: 2 };
prospectos.sort((a, b) => ORDEN[a._c.nivel] - ORDEN[b._c.nivel] || b._c.puntaje - a._c.puntaje);
prospectos.forEach((p, i) => { p._rank = i + 1; });
for (const p of prospectos) if (p._c.nivel === 'alta' && !p.mensaje) avisos.push(`${p.nombre}: oportunidad alta sin mensaje redactado`);

// ── Métricas ──────────────────────────────────────────────────────────────
const cuenta = f => prospectos.filter(f).length;
const M = {
  total: prospectos.length,
  email: cuenta(p => p.email),
  telefono: cuenta(p => p.telefono || p.whatsapp),
  sinContacto: cuenta(p => !(p.email || p.telefono || p.whatsapp || p.instagram)),
  alta: cuenta(p => p._c.nivel === 'alta'),
  media: cuenta(p => p._c.nivel === 'media'),
  baja: cuenta(p => p._c.nivel === 'baja'),
  mensajes: cuenta(p => p.mensaje)
};
const comunas = [...new Set(prospectos.map(p => p.comuna).filter(Boolean))].sort();
const porComuna = comunas.map(k => [k, cuenta(p => p.comuna === k), cuenta(p => p.comuna === k && p._c.nivel === 'alta')]);

const slug = slugify(c.slug || `${c.rubro}-${c.zona}`);
const fecha = c.fecha || new Date().toISOString().slice(0, 10);
const TIPO = { construir: 'Construir desde cero', optimizar: 'Optimizar lo que existe', escalar: 'Escalar lo que funciona' };

// ── Salidas para CRM ──────────────────────────────────────────────────────
const crm = prospectos.map(p => ({
  rank: p._rank, nombre: p.nombre, rubro: p.rubro || c.rubro, comuna: p.comuna || '', direccion: p.direccion || '',
  telefono: p.telefono || '', whatsapp: p.whatsapp || '', email: p.email || '', web: p.web || '',
  instagram: p.instagram || '', seguidores: p.seguidores ?? '', google_rating: p.google?.rating ?? '',
  google_resenas: p.google?.resenas ?? '', madurez_web: p.senales?.web || '', madurez_redes: p.senales?.redes || '',
  oportunidad: p._c.nivel, puntaje: p._c.puntaje, motivo: p._c.motivos.join('; '), hallazgo: p.hallazgo || '',
  canal_mensaje: p.canal_mensaje || '', mensaje: p.mensaje || '', fuentes: (p.fuentes || []).join(' | '),
  campana: `${c.rubro} · ${c.zona} · ${fecha}`, servicio: c.servicio, estado: 'nuevo'
}));
const csvCelda = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = '﻿' + [Object.keys(crm[0]).join(','), ...crm.map(r => Object.values(r).map(csvCelda).join(','))].join('\n');

// ── HTML ──────────────────────────────────────────────────────────────────
const enlace = (href, txt) => href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(txt)}</a>` : '<span class="nd">—</span>';
const ig = h => h ? enlace('https://instagram.com/' + String(h).replace(/^@/, ''), '@' + String(h).replace(/^@/, '')) : enlace(null);
const wa = p => { const n = soloDigitos(p.whatsapp || p.telefono); return n.length === 9 && n[0] === '9' ? `https://wa.me/56${n}` : null; };
const chip = n => `<span class="chip ${n}">${n}</span>`;
const MAD = ['nada', 'abandonada', 'desordenada', 'buena'];

const filas = prospectos.map(p => `
<tr data-nivel="${p._c.nivel}" data-comuna="${esc(p.comuna || '')}" data-email="${p.email ? 1 : 0}" data-q="${esc(slugify([p.nombre, p.comuna, p.hallazgo].join(' ')))}">
  <td class="num">${p._rank}</td>
  <td><strong>${esc(p.nombre)}</strong><div class="sub">${esc(p.comuna || '')}${p.direccion ? ' · ' + esc(p.direccion) : ''}</div></td>
  <td>${chip(p._c.nivel)}<div class="sub" title="${esc(p._c.motivos.join(' · '))}">${p._c.puntaje} pts · ${p._c.madurez == null ? 's/d' : MAD[p._c.madurez]}</div></td>
  <td class="contacto">${p.email ? enlace('mailto:' + p.email, p.email) : '<span class="nd">sin email</span>'}
    <div>${p.telefono || p.whatsapp ? (wa(p) ? enlace(wa(p), p.whatsapp || p.telefono) : esc(p.telefono)) : '<span class="nd">sin teléfono</span>'}</div></td>
  <td>${p.web ? enlace(p.web, dominio(p.web)) : '<span class="nd">sin web</span>'}<div>${ig(p.instagram)}${p.seguidores != null ? ` <span class="sub">${Number(p.seguidores).toLocaleString('es-CL')}</span>` : ''}</div></td>
  <td>${p.google?.rating != null ? `★ ${p.google.rating} <span class="sub">(${p.google.resenas ?? 0})</span>` : '<span class="nd">—</span>'}</td>
  <td class="hallazgo">${esc(p.hallazgo || '')}</td>
</tr>`).join('');

const tarjetas = prospectos.filter(p => p.mensaje).map(p => `
<article class="msg">
  <header><span class="rank">#${p._rank}</span><h3>${esc(p.nombre)}</h3>${chip(p._c.nivel)}<span class="canal">${esc(p.canal_mensaje || 'DM')}</span></header>
  <p class="hall"><b>Hallazgo:</b> ${esc(p.hallazgo || '')}</p>
  <pre>${esc(p.mensaje)}</pre>
  <footer><button type="button" data-copy>Copiar mensaje</button>
    ${wa(p) ? `<a class="btn2" href="${wa(p)}?text=${encodeURIComponent(p.mensaje)}" target="_blank" rel="noopener">Abrir WhatsApp</a>` : ''}
    ${p.email ? `<a class="btn2" href="mailto:${esc(p.email)}?body=${encodeURIComponent(p.mensaje)}">Abrir email</a>` : ''}</footer>
</article>`).join('');

const busquedas = (c.busquedas || []).map(b => `<li><code>${esc(b.consulta)}</code> <span class="sub">${esc(b.fuente || '')}${b.resultados != null ? ' · ' + b.resultados + ' resultados' : ''}</span></li>`).join('');

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prospectos ${esc(c.rubro)}</title>
<style>
:root{--bg:#f5f6f8;--card:#fff;--tx:#14171f;--tx2:#5d6474;--bd:#e3e6ec;--ac:#0f8b8d;--alta:#0f8b6d;--alta-bg:#dff5ec;--media:#a76a00;--media-bg:#fdf1d8;--baja:#7a808c;--baja-bg:#eef0f3}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f1115;--card:#171a21;--tx:#e8eaef;--tx2:#9aa1af;--bd:#2a2f3a;--ac:#3cc2c4;--alta:#4ad6a7;--alta-bg:#123628;--media:#f0b54a;--media-bg:#3a2c10;--baja:#9aa1af;--baja-bg:#23272f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1240px;margin:0 auto;padding:24px 16px 64px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:36px 0 12px}
.meta{color:var(--tx2);font-size:14px}.meta b{color:var(--tx)}.ejemplo{background:var(--media-bg);color:var(--media);padding:8px 12px;border-radius:8px;margin:12px 0;font-weight:600}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:20px}
.kpi{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:14px 16px}.kpi .v{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}.kpi .l{color:var(--tx2);font-size:13px}
.kpi.alta .v{color:var(--alta)}.kpi.media .v{color:var(--media)}
.bar{display:flex;height:10px;border-radius:5px;overflow:hidden;margin-top:12px;background:var(--bd)}.bar span{display:block}
.filtros{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.filtros select,.filtros input{font:inherit;padding:7px 10px;border:1px solid var(--bd);border-radius:8px;background:var(--card);color:var(--tx)}.filtros input{flex:1;min-width:180px}
.tabla{overflow-x:auto;background:var(--card);border:1px solid var(--bd);border-radius:12px}table{border-collapse:collapse;width:100%;min-width:980px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--bd);vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--tx2);position:sticky;top:0;background:var(--card)}
tr:last-child td{border-bottom:0}.num{font-variant-numeric:tabular-nums;color:var(--tx2)}.sub{color:var(--tx2);font-size:12.5px}.nd{color:var(--tx2);opacity:.7;font-size:13px}
.contacto{font-size:13.5px;word-break:break-all}.hallazgo{font-size:13.5px;max-width:320px}a{color:var(--ac);text-decoration:none}a:hover{text-decoration:underline}
.chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.chip.alta{background:var(--alta-bg);color:var(--alta)}.chip.media{background:var(--media-bg);color:var(--media)}.chip.baja{background:var(--baja-bg);color:var(--baja)}
.msgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.msg{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:16px;display:flex;flex-direction:column}
.msg header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.msg h3{font-size:16px;margin:0;flex:1}.rank{color:var(--tx2);font-variant-numeric:tabular-nums}.canal{font-size:12px;color:var(--tx2)}
.hall{font-size:13.5px;color:var(--tx2);margin:10px 0}.msg pre{white-space:pre-wrap;font:inherit;background:var(--bg);border-radius:8px;padding:12px;margin:0 0 12px;flex:1}
.msg footer{display:flex;gap:8px;flex-wrap:wrap}button,.btn2{font:inherit;font-size:13.5px;padding:7px 12px;border-radius:8px;border:1px solid var(--bd);background:var(--card);color:var(--tx);cursor:pointer}
button{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:600}.btn2:hover{text-decoration:none;border-color:var(--ac)}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.box{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:16px}
.box ul{margin:0;padding-left:18px}.box li{margin:4px 0;font-size:14px}code{font-size:13px}
@media (max-width:560px){.msgs{grid-template-columns:1fr}h1{font-size:20px}}
</style></head><body><div class="wrap">
<h1>Prospectos: ${esc(c.rubro)} en ${esc(c.zona)}</h1>
<div class="meta"><b>Servicio:</b> ${esc(c.servicio)} · <b>Criterio:</b> ${esc(TIPO[c.tipo_oferta])} (${esc(c.canal || 'ambos')}) · <b>Meta:</b> ${c.meta} · ${esc(fecha)}</div>
${c.ejemplo ? '<div class="ejemplo">Ejemplo con datos ficticios: sirve para ver el formato, no para prospectar.</div>' : ''}
<div class="kpis">
  <div class="kpi"><div class="v">${M.total}</div><div class="l">prospectos (meta ${c.meta})</div></div>
  <div class="kpi"><div class="v">${M.email}</div><div class="l">con email</div></div>
  <div class="kpi"><div class="v">${M.telefono}</div><div class="l">con teléfono / WhatsApp</div></div>
  <div class="kpi alta"><div class="v">${M.alta}</div><div class="l">oportunidad alta</div></div>
  <div class="kpi media"><div class="v">${M.media}</div><div class="l">oportunidad media</div></div>
  <div class="kpi"><div class="v">${M.mensajes}</div><div class="l">mensajes listos</div></div>
</div>
<div class="bar" title="alta / media / baja"><span style="width:${M.alta / M.total * 100}%;background:var(--alta)"></span><span style="width:${M.media / M.total * 100}%;background:var(--media)"></span><span style="width:${M.baja / M.total * 100}%;background:var(--baja)"></span></div>

<h2>Lista completa, ordenada por oportunidad</h2>
<div class="filtros">
  <select id="fNivel"><option value="">Todos los niveles</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select>
  <select id="fComuna"><option value="">Todas las comunas</option>${comunas.map(k => `<option>${esc(k)}</option>`).join('')}</select>
  <select id="fEmail"><option value="">Con y sin email</option><option value="1">Solo con email</option></select>
  <input id="fQ" type="search" placeholder="Buscar nombre o hallazgo">
</div>
<div class="tabla"><table><thead><tr><th>#</th><th>Negocio</th><th>Oportunidad</th><th>Contacto</th><th>Web / Instagram</th><th>Google</th><th>Hallazgo</th></tr></thead><tbody>${filas}</tbody></table></div>

<h2>Mensajes redactados (${M.mensajes})</h2>
<div class="msgs">${tarjetas || '<p class="meta">No hay mensajes redactados.</p>'}</div>

<h2>Cómo se armó</h2>
<div class="cols">
  <div class="box"><b>Por comuna</b><ul>${porComuna.map(([k, n, a]) => `<li>${esc(k)}: ${n} prospectos, ${a} alta</li>`).join('')}</ul></div>
  <div class="box"><b>Búsquedas lanzadas (${(c.busquedas || []).length})</b><ul>${busquedas || '<li>sin registro</li>'}</ul></div>
  <div class="box"><b>Regla de oportunidad</b><p class="sub">${esc(TIPO[c.tipo_oferta])}: ${{ construir: 'el que no tiene presencia en el canal es el mejor prospecto.', optimizar: 'el que ya tiene algo pero desordenado o abandonado es el mejor; el que no tiene nada no sirve.', escalar: 'el que ya tiene el canal funcionando es el mejor; sin base no hay qué escalar.' }[c.tipo_oferta]} Pasa el mouse sobre el puntaje para ver el motivo de cada uno.</p>${duplicados.length ? `<p class="sub">Duplicados descartados: ${duplicados.length}</p>` : ''}</div>
</div>
</div>
<script>
const $=s=>document.querySelector(s),rows=[...document.querySelectorAll('tbody tr')];
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
function filtrar(){const n=$('#fNivel').value,c=$('#fComuna').value,e=$('#fEmail').value,q=norm($('#fQ').value);
rows.forEach(r=>{r.hidden=(n&&r.dataset.nivel!==n)||(c&&r.dataset.comuna!==c)||(e&&r.dataset.email!==e)||(q&&!r.dataset.q.includes(q))})}
['#fNivel','#fComuna','#fEmail','#fQ'].forEach(s=>$(s).addEventListener('input',filtrar));
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{const t=b.closest('.msg').querySelector('pre').innerText;
try{await navigator.clipboard.writeText(t);b.textContent='Copiado ✓'}catch{b.textContent='Selecciona y copia'}setTimeout(()=>b.textContent='Copiar mensaje',1600)}));
</script></body></html>`;

// ── Escribir ──────────────────────────────────────────────────────────────
fs.mkdirSync(salida, { recursive: true });
const base = path.join(salida, `prospectos-${slug}`);
fs.writeFileSync(base + '.html', html);
fs.writeFileSync(base + '.crm.json', JSON.stringify({ campana: { ...c, fecha, generado: new Date().toISOString() }, resumen: M, prospectos: crm }, null, 2));
fs.writeFileSync(base + '.csv', csv);

console.log(`✓ ${path.relative(process.cwd(), base)}.html / .crm.json / .csv`);
console.log(`  ${M.total} prospectos (meta ${c.meta}) · ${M.email} con email · ${M.telefono} con teléfono · ${M.sinContacto} sin contacto`);
console.log(`  alta ${M.alta} · media ${M.media} · baja ${M.baja} · ${M.mensajes} mensajes`);
console.log('  Top 5: ' + prospectos.slice(0, 5).map(p => `${p.nombre} (${p._c.nivel}, ${p._c.puntaje})`).join(' · '));
if (duplicados.length) console.log(`  Duplicados descartados (${duplicados.length}): ` + duplicados.join('; '));
if (avisos.length) console.log('  AVISOS:\n   - ' + avisos.join('\n   - '));
