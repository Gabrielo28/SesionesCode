/*
 * Avisa a Bing (y a los demás buscadores de IndexNow: Yandex, Seznam, Naver) que la web cambió,
 * para que la vuelvan a leer en horas en vez de semanas. Google no usa IndexNow: ahí se usa Search Console.
 *
 *   node herramientas/indexnow.js                 # todas las URL del sitemap de influencechile.cl
 *   node herramientas/indexnow.js https://influencechile.cl/escaner/
 *
 * Requisito: el archivo de la clave (influencechile-web/<CLAVE>.txt) tiene que estar publicado en la web.
 */
const SITIO = 'influencechile.cl';
const CLAVE = '9b2bfa7f24ee95e0f7e41371b7e93f2d';

(async () => {
  let urls = process.argv.slice(2);
  if (!urls.length) {
    const xml = await (await fetch(`https://${SITIO}/sitemap.xml`)).text();
    urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
  }
  const clave = await fetch(`https://${SITIO}/${CLAVE}.txt`).then(r => r.ok ? r.text() : '');
  if (clave.trim() !== CLAVE) { console.error(`La clave no está publicada en https://${SITIO}/${CLAVE}.txt — sube la web a Netlify primero.`); process.exit(1); }
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: SITIO, key: CLAVE, keyLocation: `https://${SITIO}/${CLAVE}.txt`, urlList: urls })
  });
  console.log(r.status, r.status === 200 || r.status === 202 ? 'Aviso recibido' : await r.text());
  urls.forEach(u => console.log('  ' + u));
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
