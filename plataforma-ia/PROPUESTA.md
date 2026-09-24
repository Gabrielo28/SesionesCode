# Pauta — Propuesta de plataforma de contenido con IA

> Nombre de trabajo. Basado en el informe *"Análisis Exhaustivo de Plataformas de IA para la
> Generación y Automatización de Estrategias de Contenido (2026)"* y en lo que Influence Chile
> ya tiene construido en este repositorio.
>
> Septiembre 2026.

---

## 1. La propuesta en una frase

**Una herramienta que produce la parrilla mensual de una marca con su voz real en español
chileno, la pasa por un filtro de riesgos y se la entrega al cliente para aprobar desde el
celular en minutos. Nada se publica sin un "sí" humano.**

Combina las ventanas 1 (Human-in-the-Loop) y 2 (voz de marca y localización) del informe.
Las ventanas 4 (MCP) y 5 (implementación con n8n) quedan como capas posteriores de
distribución e ingresos. La ventana 3 (C2PA) se descarta por ahora (ver §4).

---

## 2. Por qué esta combinación y no otra

El informe identifica tres dolores de fondo. Esto es lo que cada uno significa para una
agencia chilena de 1 a 5 personas:

| Dolor del informe | ¿Se puede atacar con nuestros recursos? | Decisión |
|---|---|---|
| APIs hostiles de Meta/TikTok (rate limits, contenedores de Reels frágiles, tokens que expiran) | No como primer producto. Es un problema de infraestructura que Metricool, Buffer y Postiz ya pelean con equipos completos. | **No competir en publicación.** Integrarse con quien ya publica. |
| IA en piloto automático que daña la marca (alucinaciones, textos robóticos, cero sensibilidad cultural) | Sí. El valor está en el flujo y el criterio, no en infraestructura pesada. | **Núcleo del producto.** |
| Contenido genérico que no suena a la marca ni al país | Sí, y aquí tenemos ventaja real: conocemos el español chileno, los rubros y ya trabajamos con fichas de marca (`marca.json`). | **Núcleo del producto.** |
| Cumplimiento AI Act / C2PA | Técnicamente sí, comercialmente no: nuestro cliente es una pyme chilena que no vende a Europa. | Descartado por ahora. |

**La tesis:** el mercado no paga por "más contenido con IA" (sobra, y los algoritmos lo
castigan). Paga por **contenido con IA que el dueño de la marca aprueba sin reescribir**.
La métrica que define si el producto funciona es una sola:

> **% de piezas aprobadas sin cambios.**

Si es alta, el cliente confía, la agencia produce más con el mismo equipo y el producto se
puede vender solo.

---

## 3. El producto

### 3.1 Los cinco módulos

```
 ┌─────────────┐   ┌──────────────┐   ┌─────────────┐   ┌──────────────┐   ┌────────────┐
 │ 1. ADN de   │──▶│ 2. Generador │──▶│ 3. Guardián │──▶│ 4. Tablero de│──▶│ 5. Salida  │
 │    marca    │   │  de parrilla │   │  de marca   │   │  aprobación  │   │ (export)   │
 └─────────────┘   └──────────────┘   └─────────────┘   └──────────────┘   └────────────┘
        ▲                                                       │
        └──────────── lo aprobado y lo corregido alimenta ──────┘
```

**1. ADN de marca.** Es la evolución de `produccion-contenido/clientes/yeet/marca.json`
hacia un esquema formal: tono, público, productos y precios, claims prohibidos, palabras que
la marca sí y no usa, variante de español (chileno formal, chileno juvenil, neutro) y lo más
importante, **ejemplos reales**: los 10 a 20 posts históricos que mejor funcionaron y los que
el cliente rechazó. Se llena con un formulario más una ingesta automática de su Instagram y
su web.

**2. Generador de parrilla.** Recibe el ADN, el objetivo del mes, el formato contratado
(por ejemplo 8 reels, 8 posts y 12 historias) y un calendario chileno (Fiestas Patrias,
CyberDay, Black Friday, Día de la Madre, temporadas por rubro). Devuelve cada pieza con copy,
variantes por red, idea visual o guion de reel y **una justificación de una línea** ("por qué
esta pieza, este mes"). Toma como modelo el plan de agosto de YEET, que ya razona así.

**3. Guardián de marca.** Revisa cada pieza antes de que la vea el cliente:
- Claims de riesgo según el rubro: salud, suplementos, clínicas, promesas de resultados. Hoy
  esto se hace a mano (ver las advertencias legales del plan YEET).
- Datos inventados, como precios, promociones o fechas que no están en el ADN. Es el caso de
  la "aerolínea obligada a honrar el reembolso" del informe.
- Especificaciones técnicas del video: 9:16, duración y peso, reutilizando `produccion-contenido/video/video.js`.
- Un "detector de tono robótico": frases de plantilla que delatan IA.

Cada alerta aparece como etiqueta en el tablero y nunca bloquea en silencio.

**4. Tablero de aprobación.** Una sola página por cliente y por mes, pensada para el
celular: el cliente ve cada pieza tal como se verá en Instagram, con su justificación y sus
alertas, y marca ✅ / ✏️ comentar / ❌. Puede aprobar todo el lote de una vez. Recibe el
aviso por WhatsApp; ya existe `aviso-whatsapp.gs` como base. **Toda corrección se guarda y
vuelve al ADN como ejemplo**, así el sistema aprende la marca mes a mes.

**5. Salida.** No se construye un programador de publicaciones. Lo aprobado se exporta a lo
que la agencia ya usa (CSV de Metricool, API de Buffer o de Postiz) o como paquete de
archivos listo para subir. La publicación directa por la API de Meta queda para la fase 3.

### 3.2 Qué NO hace (a propósito)

- No publica sola ni responde comentarios o DMs sin aprobación. Ese es justamente el
  riesgo que el informe documenta.
- No compite con Canva ni con Midjourney en diseño. Entrega la dirección visual; el diseño
  lo hace el equipo o las herramientas que ya tiene.
- No compite con Metricool en analítica en el MVP.

### 3.3 Stack

El mismo que ya se domina en el proyecto de Colchones Yolé, para no aprender dos cosas a la vez:

- **Node.js + HTML/JS vanilla**, desplegado en **Railway** (auto-deploy desde GitHub).
- **Base de datos:** Postgres de Railway desde el día 1. Guardar en archivos JSON sirve para
  una tienda, pero no para varios clientes con historial.
- **Modelo de lenguaje:** detrás de una capa propia (`llm.js`) para poder cambiar de
  proveedor sin reescribir el sistema. El modelo se elige con una **prueba ciega** (ver §6),
  no con un benchmark ajeno.
- **Pagos:** Flow o Mercado Pago para Chile. Webpay ya está integrado en Yolé y se puede
  reutilizar.

---

## 4. Lo que el informe propone y conviene tomar con cuidado

El informe es útil para mapear el mercado, pero **la mayoría de sus fuentes son blogs de los
propios proveedores** (Hyper, Enrich Labs, Postiz, getclaw) y tiene afirmaciones que hay que
revisar antes de basar decisiones en ellas:

1. **DeepSeek como modelo recomendado.** Las comparaciones que cita son contra modelos de
   2024 (GPT-4o, Claude 3.5 Sonnet), que ya no son la referencia en 2026. Además, **enviar
   datos de clientes a una API alojada en China** es un problema para rubros como clínicas y
   centros médicos (35 de los 132 leads), sobre todo con la **Ley 21.719 de protección de
   datos personales**, que entra en vigencia en Chile en diciembre de 2026. El costo del
   modelo tampoco pesa en la decisión: generar la parrilla de una marca cuesta del orden de
   pocos dólares al mes con cualquier proveedor serio, frente a un precio de venta de decenas
   o cientos de dólares. **Hay que decidir por calidad en español chileno y por el manejo de
   los datos, no por precio por token.**
2. **Multas del AI Act.** El informe dice "hasta el 6% de la facturación". Para las
   obligaciones de transparencia del contenido sintético (art. 50), el tope es **3% o
   €15 millones**; el 7% corresponde a prácticas prohibidas. En cualquier caso, afecta a
   quien opera hacia la UE, que no es nuestro cliente objetivo.
3. **C2PA.** El propio informe reconoce que Meta y X borran los metadatos al subir el
   archivo. Vender trazabilidad que Instagram destruye es difícil de justificar a una pyme.
4. **Cifras de mercado** (40% de apps con agentes, 58% de contenido sintético, ahorro de 4
   horas diarias): son útiles como contexto, pero no se deben poner en materiales de venta
   sin verificar la fuente primaria.

---

## 5. Cómo se monetiza (en fases)

La secuencia importa: **primero ganar margen con los clientes propios y después vender el
software.** Así cada fase se financia con la anterior.

### Fase 0 · Herramienta interna (meses 1-2) → más margen

La agencia usa Pauta con sus propios clientes (YEET, Colchones Yolé, Curacaví FC).
- **Ingreso:** el mismo de hoy, con menos horas por cliente. Si una parrilla pasa de
  ~12 horas a ~4, el mismo equipo puede atender 2 a 3 veces más clientes.
- **Qué se mide:** horas por parrilla, % aprobado sin cambios y días hasta la aprobación
  del cliente.
- **Argumento de venta nuevo** para la agencia: "aprueba tu mes completo desde el celular
  en 10 minutos".

### Fase 1 · Plan pyme de menor precio (meses 3-5) → nuevos clientes

Hoy los planes van de $290.000 a $749.990 al mes, así que las empresas de menor tamaño
quedan fuera (los leads de prioridad B y C). Se agrega un plan semi-autoservicio:

| Plan | Qué incluye | Precio referencial |
|---|---|---|
| **Pauta Pyme** | Parrilla mensual con IA, guardián y tablero de aprobación. El cliente publica o exporta a Metricool. Una revisión humana de la agencia por mes. | $79.000 – $129.000 CLP/mes |
| Planes actuales | Siguen iguales, ahora producidos con Pauta | $290.000 – $749.990 CLP/mes |

Pauta Pyme también sirve como **puerta de entrada**: el cliente que crece pasa a un plan
completo. La auditoría express del proceso de prospección (`prospeccion-ventas/03-auditoria-express.md`)
se puede generar con el mismo motor.

### Fase 2 · SaaS para otras agencias y community managers (meses 6-12) → escala

Se vende Pauta a agencias pequeñas y community managers freelance de Chile y después de
Latinoamérica, **con cobro por marca** (el modelo que el informe identifica como la razón de
la adopción de Metricool) y con opción de marca blanca, para que la agencia lo presente como
propio ante sus clientes.

| Plan | Marcas | Precio referencial |
|---|---|---|
| Freelance | hasta 3 | USD 29/mes |
| Agencia | hasta 15 | USD 99/mes |
| Agencia+ | ilimitadas, marca blanca | USD 249/mes |

### Fase 3 · Capas de expansión (año 2)

- **Servidor MCP de Pauta (ventana 4):** que una agencia pueda pedir desde Claude o ChatGPT
  "arma la parrilla de octubre de YEET y mándala a aprobación". Aquí es una funcionalidad de
  distribución, no un negocio aparte.
- **Implementaciones a medida con n8n (ventana 5):** proyectos de automatización para
  empresas más grandes, con cobro de setup (referencial: $1,5M – $4M CLP) más mantención
  mensual. Genera caja alta, pero no escala; se toma de forma selectiva.
- **Publicación directa en Instagram** por la API oficial, con webhooks y colas de reintento,
  solo cuando el volumen de clientes lo justifique.
- **Respuestas a comentarios y DMs con aprobación**: la IA propone y una persona aprueba.

### Números de referencia

Meta a 12 meses, para dimensionar (no es una proyección validada):
- 10 clientes de agencia actuales con mejor margen
- 30 clientes en Pauta Pyme × ~$100.000 = **~$3M CLP/mes**
- 25 agencias o freelancers en SaaS × ~USD 60 = **~USD 1.500/mes**

El costo variable de IA por marca es bajo frente a estos precios. El costo real es el
tiempo de soporte y de onboarding, y por eso importa que el ADN de marca se llene rápido.

---

## 6. Validación antes de programar de más (semanas 1-2)

1. **Prueba ciega de voz de marca.** Se generan 10 posts de YEET con 2 o 3 modelos
   distintos y se mezclan con 10 posts reales, sin indicar el origen. Si el equipo o el
   cliente no distinguen los generados, o prefieren alguno, el núcleo funciona. Esta prueba
   también define qué modelo usar.
2. **10 conversaciones** con leads de prioridad B y C del CSV, y 5 con community managers
   freelance. La pregunta clave: *"¿cuánto tiempo te toma que tu cliente/jefe apruebe el
   contenido del mes, y qué pasa cuando no lo aprueba?"*.
3. **Landing de "lista de espera"** para Pauta Pyme con el precio visible. Se puede usar la
   misma pauta de Meta que ya se maneja. Si nadie deja sus datos a ese precio, se ajusta
   antes de construir.

---

## 7. Plan de desarrollo

| Semanas | Entregable | Resultado verificable |
|---|---|---|
| 1-2 | Esquema de ADN de marca + migrar `marca.json` de YEET y Yolé. CLI `node pauta.js parrilla yeet 2026-10` que genera la parrilla en Markdown. | La parrilla de octubre de YEET sale de la herramienta, no de cero. |
| 3-4 | Guardián de marca: claims, datos inventados, specs de video y tono robótico. | Detecta los riesgos que el plan de agosto marcó a mano. |
| 5-6 | Tablero de aprobación web con acceso por link y aviso por WhatsApp. Las correcciones vuelven al ADN. | Un cliente real aprueba su mes desde el celular. |
| 7-8 | Export a Metricool, Buffer y Postiz. Postgres y multi-cliente. | Tres clientes propios operando en Pauta. |
| 9-12 | Onboarding autoservicio, cobro recurrente, plan Pauta Pyme. | Primer cliente que paga sin haber sido cliente de la agencia. |

Todo se desarrolla dentro de `plataforma-ia/`, con la misma lógica de los otros proyectos:
sin frameworks pesados, sin paso de compilación y con deploy automático en Railway.

---

## 8. Riesgos principales

| Riesgo | Mitigación |
|---|---|
| Metricool, Predis u otro suma "aprobación + voz de marca" | Nuestra ventaja no es la función, es el conocimiento local: rubros chilenos, calendario, lenguaje y claims regulados. Además, entrar con servicio antes que con software nos da clientes cautivos. |
| La IA no logra la voz del cliente | Se mide desde la semana 1 (prueba ciega). Las correcciones alimentan el ADN, así que la calidad debería subir mes a mes. Si no sube, se detiene antes de la fase 2. |
| Datos sensibles de clientes (salud) | Proveedor de IA con acuerdo de tratamiento de datos, sin datos de pacientes en el ADN y cumplimiento de la Ley 21.719 desde el diseño. |
| Dependencia de un proveedor de IA | Capa `llm.js` que permite cambiar de modelo. |
| El equipo se reparte entre agencia y producto | La fase 0 hace que el producto *sea* la operación de la agencia, no un proyecto paralelo. |

---

## 9. Próximo paso concreto

Arrancar con la **semana 1**: formalizar el esquema de ADN de marca a partir del
`marca.json` de YEET y construir el primer generador de parrilla por línea de comandos, más
la prueba ciega de voz de marca para elegir el modelo.
