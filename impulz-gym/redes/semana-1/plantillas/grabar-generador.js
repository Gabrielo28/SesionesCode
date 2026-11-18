// Graba la pantalla (celular 432×768, video de 1080×1920 con la página arriba a la izquierda) usando el generador de entrenachile.cl. No envía ninguna reserva.
// Uso: node grabar-generador.js <carpeta>  → <carpeta>/rec/*.webm
const {chromium}=require('playwright');(async()=>{const S=process.argv[2];
const b=await chromium.launch({proxy:{server:process.env.HTTPS_PROXY||process.env.https_proxy}});
const c=await b.newContext({ignoreHTTPSErrors:true,viewport:{width:432,height:768},deviceScaleFactor:2,isMobile:true,hasTouch:true,recordVideo:{dir:S+'/rec',size:{width:1080,height:1920}}});
const p=await c.newPage();const lento=ms=>p.waitForTimeout(ms);
const scrollA=async(sel)=>{await p.evaluate(s=>document.querySelector(s).scrollIntoView({behavior:'smooth',block:'start'}),sel);await lento(1400)};
await p.goto('https://entrenachile.cl/gimnasios/impulz',{waitUntil:'load',timeout:60000});await lento(1500);
const e=await p.$('text=Entendido');if(e){await e.click();}
await lento(800);await scrollA('#reserva');
await p.type('#reserva input[name=nombre]','Camila',{delay:90});await lento(300);
await p.type('#reserva input[name=telefono]','9 1234 5678',{delay:70});await lento(500);
await p.evaluate(()=>document.querySelector('#reserva input[value="torso-pierna"]').scrollIntoView({behavior:'smooth',block:'center'}));await lento(900);
await p.click('#reserva input[value="torso-pierna"]');await lento(900);
await p.selectOption('#reserva select[name=nivel]','1');await lento(600);
await p.selectOption('#reserva select[name=dias]','4');await lento(900);
// Sin enviar: abre directamente la rutina que recibe la persona
await p.goto('https://entrenachile.cl/gimnasios/impulz/rutina?c=IMP-DEMO&t=torso-pierna&n=1&d=4',{waitUntil:'load',timeout:60000});await lento(1500);
for(let i=0;i<5;i++){await p.mouse.wheel(0,330);await lento(700);}
const primero=await p.$('details summary');if(primero){await primero.scrollIntoViewIfNeeded();await lento(500);await primero.click();await lento(1800);}
for(let i=0;i<4;i++){await p.mouse.wheel(0,300);await lento(650);}
await c.close();await b.close()})()
