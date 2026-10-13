/*
 * Genera 06-escaner-y-codigos.md a partir de codigos.js
 *   node codigos-a-md.js > ../06-escaner-y-codigos.md
 */
const C = require('./codigos.js');
const G = { 3: 'Crítico', 2: 'Medio', 1: 'Leve' };
const Q = { influence: 'Influence', partner: 'Se deriva', 'dueño': 'Dueño' };
const nSenales = C.SENALES.reduce((s, g) => s + g.items.length, 0);
const out = [];
out.push(`# El Escáner de Negocio — códigos de falla

La metáfora que gobierna el servicio: **como el escáner de un auto.** Se conecta al
negocio, lee los 8 sistemas y entrega códigos de falla. Cada código dice qué sistema
falla, qué tan grave es, cuál es el síntoma, la causa probable y la reparación. El
escáner dice **qué** falla; el taller (diagnóstico completo y radiografía de proceso)
dice **cuánto cuesta y cómo se repara exactamente**.

Herramienta: \`escaner/index.html\`. Catálogo: \`escaner/codigos.js\` (este documento
se genera desde ahí: \`node escaner/codigos-a-md.js > 06-escaner-y-codigos.md\`).

---

## Cómo funciona

\`\`\`
CONECTAR     Nombre, rubro y modo. Rápido (lo responde el dueño) o Taller (Influence,
             con señales observadas desde afuera).

LEER         ${C.PREGUNTAS.length} lecturas, 2 por sistema. Cada respuesta es un sensor: puede disparar
             uno o más códigos.
             En modo taller, además, ${nSenales} señales observadas (Google Maps, Instagram,
             web, Meta Ads, empleo, comprador misterioso, visita).

ESCANEAR     La consola recorre los 8 sistemas y muestra cuántas fallas hay en cada uno.

CÓDIGOS      Informe: ID de escaneo, totales por gravedad, estado de los 8 sistemas,
             y los códigos ordenados por gravedad. Cada uno con síntoma, causa,
             reparación rápida (esta semana), reparación en taller, quién la hace y
             por qué sensor fue detectado. "Confirmado por 2 fuentes" cuando lo
             disparan una lectura y una señal a la vez.

REPARAR      Botón de WhatsApp con los códigos críticos ya escritos. Informe
             imprimible. Link del escaneo para reabrirlo.
\`\`\`

**Gravedad:** 🔴 Crítico = parar y reparar, está costando ventas hoy. 🟠 Medio =
reparar este mes. 🔵 Leve = revisar en el próximo servicio.

**Cómo se ofrece:** "Conecto el escáner a tu negocio. En 3 minutos te dice qué sistema
falla y qué tan grave. Si quieres, después lo llevamos al taller: te muestro cuánto
cuesta cada falla con tus números y cómo se repara." Gratis, sin registro, desde el
celular. Es la puerta de entrada: el dueño que pasa el escáner ya levantó la mano y ya
sabe qué le duele.

---

## Los 8 sistemas

| Código | Sistema | En el auto | La pregunta |
|---|---|---|---|
${C.SISTEMAS.map(s => `| **${s.id}** | ${s.nombre} | ${s.auto} | ${s.pregunta} |`).join('\n')}

---

## Catálogo de códigos (${C.CODIGOS.length})
`);
for (const s of C.SISTEMAS) {
  out.push(`\n### ${s.id} · ${s.nombre} (${s.auto})\n`);
  out.push(`| Código | Gravedad | Falla | Síntoma | Reparación rápida (esta semana) | En taller | Quién |\n|---|---|---|---|---|---|---|`);
  for (const c of C.CODIGOS.filter(c => c.sistema === s.id)) {
    out.push(`| **${c.id}** | ${G[c.g]} | ${c.nombre} | ${c.sintoma} | ${c.rapida} | ${c.taller} | ${Q[c.quien]} |`);
  }
}
out.push(`\n---\n\n## Los sensores: qué dispara cada código\n\n### Lecturas (preguntas al dueño)\n\n| # | Sistema | Lectura | Opción B dispara | Opción C dispara |\n|---|---|---|---|---|`);
C.PREGUNTAS.forEach((q, i) => out.push(`| ${i + 1} | ${C.SISTEMAS[q.s].id} | ${q.t} | ${q.c[1].join(', ') || '—'} | ${q.c[2].join(', ') || '—'} |`));
out.push(`\n### Señales observadas (modo taller)\n\n| Fuente | Señal | Dispara |\n|---|---|---|`);
C.SENALES.forEach(g => g.items.forEach(it => out.push(`| ${g.grupo} | ${it.t} | ${it.c.join(', ')} |`)));
out.push(`
---

## Del código a la reparación

- **Reparación rápida** es lo que el dueño puede hacer esta semana, con o sin Influence.
  Se regala: demuestra que el escáner sabe de lo que habla.
- **En taller** es la reparación de fondo. Las que dicen *Influence* se venden con
  \`04-de-dolor-a-oferta.md\`. Las que dicen *Se deriva* van a un partner con nombre y
  teléfono (contador de gestión, software de punto de venta, RRHH, fintech).
- Los códigos no traen precio ni costo mensual a propósito: eso sale del taller, con
  los números del dueño (\`diagnostico/\` y \`proceso/\`). Un escáner que dice "esto te
  cuesta $1.400.000" sin haber preguntado nada no es creíble.
- Tres o más códigos críticos en el mismo sistema = ese sistema es el cuello de
  botella casi seguro. Dos sistemas en rojo = entrar por el que el dueño siente
  (\`01-mapa-de-dolores.md\`, dolor sentido vs. dolor real).

## Agregar o cambiar códigos

Todo vive en \`escaner/codigos.js\`: sistemas, códigos, lecturas y señales. Para agregar
un código: una línea en \`CODIGOS\` y al menos un sensor que lo dispare (una opción de
lectura o una señal). Después regenerar este documento con \`codigos-a-md.js\`.
`);
console.log(out.join('\n'));
