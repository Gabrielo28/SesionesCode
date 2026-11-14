const {chromium}=require('playwright');const fs=require('fs');
const DUR=JSON.parse(process.argv[2]),FPS=25,out=process.argv[3];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});
await p.addInitScript(d=>{window.__DUR__=d},DUR);
await p.goto('file:///home/user/SesionesCode/impulz-gym/video/video.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
const total=await p.evaluate(()=>TOTAL);const n=Math.ceil(total*FPS);
const only=process.argv[4]?process.argv[4].split(',').map(Number):null;
if(only){for(const t of only){await p.evaluate(t=>seek(t),t);await p.screenshot({path:`${out}/t${t}.png`});}}
else for(let i=0;i<n;i++){await p.evaluate(t=>seek(t),i/FPS);await p.screenshot({path:`${out}/f${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});}
console.log('total',total,'frames',n);await b.close()})();
