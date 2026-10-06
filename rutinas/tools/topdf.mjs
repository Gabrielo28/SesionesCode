import { chromium } from 'playwright';
import fs from 'fs';
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('Uso: node topdf.mjs <rutina.html> <salida.pdf>'); process.exit(1); }
const body = fs.readFileSync(src,'utf8');
const reset = ':root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]{display:none!important}';
const fontCss = fs.readFileSync(new URL('./fonts-barlow.css', import.meta.url),'utf8');
const pdfCss = `
  @page { size: A4; margin: 11mm 10mm 12mm; }
  html { background: #fff; }
  body { background: #fff !important; font-size: 13px; }
  .wrap { max-width: none; padding-inline: 0; padding-block: 0; }
  .head { margin-inline: 0; padding: 20px 22px 18px; }
  .head-in { gap: 14px; }
  .head h1 { font-size: 54px; }
  .split-line { font-size: 17px; }
  .fact { padding: 8px 12px; }
  .fact .v { font-size: 18px; }
  section { margin-top: 18px; break-inside: avoid; }
  .sec-title { margin-bottom: 12px; }
  .sec-title h2 { font-size: 24px; }
  .day { min-height: 0; padding: 8px; }
  .note { margin-top: 8px; }
  .g { padding: 10px 12px; }
  .g .t { font-size: 17px; }
  .g p { font-size: 12.5px; }
  .session { margin-top: 0; break-before: page; break-inside: avoid; }
  table { min-width: 0; }
  td, th { padding: 8px 10px; }
  td.ex .cue { max-width: none; }
  .cols { break-inside: avoid; }
  .toolbar { display: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;
const bodyNoLinks = body.replace(/<link[^>]*fonts\.googleapis[^>]*>\n?/g, '');
const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><style>'+reset+'</style><style>'+fontCss+'</style></head><body>'+bodyNoLinks+'<style>'+pdfCss+'</style></body></html>';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const p = await b.newPage({viewport:{width:900,height:1200}});
await p.emulateMedia({ media: 'print', colorScheme: 'light' });
await p.setContent(html,{waitUntil:'networkidle'});
await p.evaluate(() => document.fonts.ready);

await p.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
await b.close();
console.log('pdf written', fs.statSync(out).size, 'bytes');
