# Enriquecimiento Apollo — tamaño real de equipo

Corrido el 21 de septiembre de 2026 sobre 42 empresas de `leads-automatizacion-chile.csv` (excluye
Pro Casa, sin sitio propio). Apollo matcheó **26 de 42** (26 créditos usados de 200 disponibles,
0 créditos cobrados por las 16 que no matchearon). Dato clave por empresa: **cantidad real de
empleados** — reemplaza las notas de cautela que veníamos escribiendo a ojo desde el contenido del
sitio.

**Nota sobre `organization_revenue`:** Apollo devolvió $0 en las 26 — no tiene facturación
indexada para ninguna. No se usa como dato en este archivo.

---

## Empresas donde el dato de Apollo CONFIRMA lo que ya sabíamos (sin cambios)

| Empresa | Empleados (Apollo) | Lote |
|---|---|---|
| Grupo Cueto | 4 | 2 |
| Vercetti Propiedades | 7 | 2 |
| Propietat Corredora | 3 | 2 |
| CZ Abogados | 8 | 1 (adaptado) |
| Schneider Abogados | 9 | 1 |
| AIJ Abogados | 11 | 2 |
| BS Chile Consultores | 2 | 1 |
| Luppa | 17 | 1 |
| Wiseplan | 16 | 2 |
| Home Key Propiedades | 3 | 3 |
| Consultores Vega | 7 | 2 |
| Seguros Broker | 6 | 1 |
| Administración de Edificios Santiago | 2 | 1 |
| Luz Propiedades | 4 | 2 |
| Seguros Gaete | 5 | 2 |
| Golden Propiedades | 4 | 3 |
| Emprende Tu Pyme | 7 | 3 |
| Abogaley | 2 | 1 |
| Celer | 20 (Apollo describe "equipo de 11 a 50") | 2 |

Todas boutique/mediana como se asumió — sin cambios en el mensaje.

---

## Cambios que SÍ hay que hacer

### 1. Avanzo Consultora — quitar la nota de cautela (lote 2)
Apollo confirma **10 empleados**, y su propia descripción dice "equipo de 8 staff members". **No
es unipersonal.** La nota de cautela del lote 2 ("confirmar tamaño de equipo, riesgo de ser
profesional independiente") queda obsoleta — está lista para contactar sin reservas.

### 2. YouHR — agregar nota de cautela retroactiva (ya enviado en lote 1)
Apollo muestra **1 solo empleado**. Esto cae directo en el descarte del ICP ("profesional
independiente sin equipo... no hay a quién devolverle horas"). YouHR ya está en
`mensajes-lote1-frio.md` marcado como "no se pudo verificar" (el sitio devolvió contenido vacío),
así que por suerte **no se envió nada todavía** — pero si decides revisarlo manualmente, ahora
sabes que probablemente no vale la pena priorizarlo.

### 3. Quinta Propiedades — nueva empresa, viene con descarte de entrada
No estaba en ningún lote todavía (se encontró su sitio recién en el lote 3, pero el WebFetch
falló dos veces). Apollo muestra **1 solo empleado**. Mismo caso que YouHR — profesional
independiente, no prioridad de prospección masiva según el ICP.

### 4. Grupo Insurex — mucho más grande de lo que parecía (ya enviado en lote 1)
El sitio no mencionaba tamaño de equipo. Apollo revela **140 empleados**, con un área comercial de
21 personas y crecimiento del 72% en el último año. Esto ya no es "corredora boutique" — es una
empresa mediana-grande con infraestructura comercial real. Sigue técnicamente dentro del límite
del ICP (<200 empleados), pero **el ángulo del mensaje enviado ("cotizaciones caso a caso, sin
cotizador online") probablemente ya no aplica** — una empresa de este tamaño, con esa tasa de
crecimiento, es mucho más probable que ya tenga o esté evaluando algún sistema. Si responden, vale
la pena confirmar esto en la primera conversación antes de asumir que el hueco sigue ahí.

### 5. Kreston MCA Chile — confirma el descarte que ya habíamos anotado (lote 3, nota de cautela)
La nota de cautela del lote 3 decía "confirmar en LinkedIn si de verdad encaja como boutique o es
mejor descartarla". Apollo lo resuelve: es propiedad de **Kreston Global** (`owned_by_organization`
explícito), con **más de 35 profesionales** en oficinas de Santiago Y Concepción (Apollo cuenta
solo 11 en el dominio local, pero la propia descripción de la empresa dice 35+). Esto confirma el
descarte del ICP por "filial de multinacional". **Recomendación: sacarla de la lista de contacto.**

### 6. MisAbogados — replantear el ángulo (ya enviado en lote 3)
Esta es la más importante. Apollo revela que MisAbogados **no es un estudio jurídico tradicional**
— es una plataforma legal-tech tipo SaaS, con **20 empleados + una subsidiaria (58 empleados
totales)**, financiamiento levantado (Seed, $190K de Nazca Ventures y Start-Up Chile) y presencia
en México. Su propio texto dice que ya tiene "lawyer client portal", "legal case management" y
"legal service automation" como parte de su producto. Es decir: **es candidato a competir con
nuestra propuesta, no a comprarla** — probablemente ya resolvieron la automatización de intake
por dentro de su plataforma. El mensaje que se envió (lote 3) pedía verificar "primer contacto
manual por formulario", que sigue siendo cierto de cara al cliente final, pero la empresa por
detrás claramente no es una pyme tradicional sin tecnología. Si responden, ajustar la conversación
— puede que el interés real esté en otra cosa (integraciones, no automatización básica).

### 7. Gestión360 — corregir el rubro/ángulo (ya enviado en lote 2)
El sitio decía "gestión contable y administrativa para pymes" y así se armó el mensaje. Apollo
(que lee su propia descripción de LinkedIn) revela que su especialidad real es **gestión de
cobranza** ("Asesoría del Proceso de Cobranza", "Gestión de Empresas Externas de Cobranza",
"Assessment de Gestión Cobranza") — no contabilidad general. El mensaje enviado sigue siendo
razonable (habla de "trámites y reportería repetitiva", que no es falso), pero si responden, el
hallazgo específico a mencionar en la reunión debería ser el proceso de cobranza, no contabilidad
genérica.

---

## Empresas sin match en Apollo (16) — sin cambios, seguir con el criterio ya aplicado

mbm.cl, arriendoschile.cl, gia-propiedades.cl, arabogados.cl, consultorasav.cl,
inmocimapropiedades.cl (Cima Propiedades), hbestudiocontable.cl, mundo-corretaje.cl,
romainmobiliaria.cl, admincondominios.cl, concretapropiedades.cl, monttcorretajes.cl,
contadoresrancagua.cl, efgconsulting.cl, optimapymechile.cl, delunopropiedades.com.

Apollo no las tiene indexadas — no es señal de nada (ni bueno ni malo), simplemente no hay dato.
Se mantiene el criterio de verificación manual ya aplicado en los lotes 1-3 para estas.

---

## Acción recomendada

1. **Avanzo Consultora** (lote 2): confirmado, sin reservas — puedes escribirle ya.
2. **Kreston MCA Chile** (lote 3): sacar de la lista de contacto — descarte confirmado.
3. **Grupo Insurex y MisAbogados** (ya enviados en lote 1 y 3 respectivamente): si responden,
   ajustar la conversación con lo que Apollo reveló antes de ofrecer la solución genérica.
4. **YouHR y Quinta Propiedades**: no priorizar — ambas parecen unipersonales.
5. **Gestión360**: si responde, mencionar cobranza específicamente, no contabilidad genérica.
