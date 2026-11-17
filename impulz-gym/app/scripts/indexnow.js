/*
 * Avisa a Bing (y a los buscadores que usan IndexNow) que el sitio cambió, para que lo vuelvan a leer al tiro.
 * ChatGPT y Copilot buscan con Bing, así que esto también acelera que aparezca en respuestas de IA.
 *
 *   SITIO=https://impulzgym.cl INDEXNOW_KEY=<la misma clave del servidor> node scripts/indexnow.js
 */
const sitio = (process.env.SITIO || '').replace(/\/$/, '');
const key = process.env.INDEXNOW_KEY || '';
if (!/^https:\/\//.test(sitio) || !key) { console.error('Faltan SITIO (https://...) o INDEXNOW_KEY'); process.exit(1); }
const host = new URL(sitio).host;
fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: sitio + '/' + key + '.txt', urlList: [sitio + '/', sitio + '/llms.txt'] })
}).then(r => console.log('IndexNow respondió ' + r.status + (r.status < 300 ? ' (aviso recibido)' : ''))).catch(e => { console.error(e.message); process.exit(1); });
