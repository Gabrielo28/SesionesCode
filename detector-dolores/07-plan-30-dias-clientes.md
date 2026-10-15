# Plan de 30 días — de 2 cuentas a clientes que pagan

**Situación de partida:** 2 cuentas en el plan más barato, pocos leads orgánicos
(cerca de 1 por semana) y muchos servicios sin un camino claro de venta.

**Lo que cambia:** dejar de esperar que lleguen y salir a buscarlos con evidencia. El
escáner de mercado encuentra negocios con fallas concretas que tú sabes reparar. Les
escribes con el hallazgo, les regalas el diagnóstico y les vendes **una reparación de
precio fijo**. La gestión de redes deja de ser la puerta de entrada y pasa a ser un
servicio más.

---

## El posicionamiento

> **Influence Chile repara lo que le está costando ventas a tu negocio.**
> Diagnóstico gratis, reparación a precio fijo, operación mensual.

Tres escalones, siempre en este orden:

| Escalón | Qué es | Precio (ya está en tu web) | Para qué sirve |
|---|---|---|---|
| **1. Diagnóstico** | Escáner + 15 minutos de conversación | Gratis | Abre la puerta con evidencia, no con promesas |
| **2. Reparación** | Una solución concreta, alcance cerrado, plazo corto | Desde $250.000 a $500.000 una vez | Primer pago rápido y prueba de que cumples |
| **3. Operación** | Lo que mantiene funcionando la reparación | Desde $80.000 a $200.000 al mes | Ingreso recurrente que se acumula cliente a cliente |

Las reparaciones que más aparecen en el escaneo, con tus precios actuales:

- **Asistente de WhatsApp que responde, califica y agenda.** Desde $350.000 más
  $80.000 al mes. Repara respuesta lenta, consultas sin seguimiento, sin WhatsApp a un
  toque y precio escondido.
- **Landing o sitio que vende.** Landing desde $250.000 o sitio con reserva desde
  $500.000. Repara web caída, lenta, sin camino de compra y sin prueba social.
- **Medición y campaña.** Armado de campaña $150.000. Repara web sin sensores y
  marketing sin medir. Es la puerta a la gestión de Meta Ads.

La gestión de redes se ofrece después, a quien ya confió en una reparación, y se
entrega con Rubrify para que el margen sea alto.

---

## Semana 1 — elegir el mercado y escanearlo

1. **Elegir un rubro**, no cinco. Con los datos del escaneo de las 132 empresas, el
   mejor candidato es el que tenga más fallas reparables por ti y ticket alto por
   cliente (clínicas, odontología, estética y centros médicos agendan horas: cada
   consulta perdida en WhatsApp vale plata, y lo entienden al tiro).
2. **Armar la lista**: 60 a 100 negocios de ese rubro. Sirve el CSV actual, una
   búsqueda en Google Maps ("clínica dental Providencia") pasada a planilla, o Apollo.
3. **Escanear**: `node escanear-mercado.js lista.csv --nombre dentistas`.
4. **Revisar a mano los "Escribir hoy"** (10 a 15): abrir web, Google Maps e Instagram
   30 segundos cada uno, marcar en el modo taller lo que veas, y confirmar el hallazgo
   que vas a citar.
5. **Hacer una prueba en tu propia web primero**: el escáner y la web nueva publicados
   en influencechile.cl/escaner, para que el link del mensaje respalde lo que dices.

## Semana 2 — salir a conversar

- **10 mensajes al día**, de lunes a viernes, desde el tablero (botón "Copiar
  mensaje"). Canal en este orden: WhatsApp del negocio si aparece en Google Maps, DM de
  Instagram, correo, LinkedIn del dueño.
- **Seguimiento a los 3 y a los 7 días** con las secuencias de
  `prospeccion-ventas/05-secuencias-completas.md`, cambiando el gancho por el código
  de falla.
- **A quien responde**: le mandas su diagnóstico (el PDF de `diagnostico/` o el informe
  del escáner) y pides 15 minutos.
- **En la reunión**: el cuello de botella con número (`03-entrevista-de-diagnostico.md`)
  y una sola reparación con precio fijo y fecha. Nada de planes de tres niveles en la
  primera conversación.

## Semana 3 — entregar rápido y pedir el caso

- Entregar la primera reparación en 7 días o menos. Es tu mejor argumento de venta.
- Medir el antes y el después: tiempo de respuesta, consultas, horas agendadas.
- Pedir permiso para usarlo como caso y una reseña en Google. Con un caso real del
  rubro, el mensaje del mes siguiente cambia de "encontré esto" a "a la clínica X le
  pasaba lo mismo y ahora…".

## Semana 4 — repetir y subir de escalón

- Segunda vuelta de 50 mensajes en el mismo rubro, ahora con el caso.
- A los clientes de reparación: ofrecer la operación mensual y, si calza, la gestión.
- Escanear un segundo rubro con la misma herramienta y comparar qué falla más.

---

## Los números de referencia

Son metas razonables para mensajes personalizados con un hallazgo real, no promesas:

| Por semana | Meta |
|---|---|
| Mensajes enviados | 50 |
| Respuestas | 5 a 8 |
| Reuniones de 15 minutos | 2 a 3 |
| Reparaciones cerradas | 1 |

Cuatro semanas así son 4 reparaciones (entre $1.000.000 y $2.000.000 una vez) y 4
operaciones mensuales que se suman a tu ingreso recurrente. El número que manda es
**mensajes enviados**: si no llegan respuestas, se cambia el rubro o el gancho, no la
cantidad.

## La web

- Publicar `influencechile-web/` en Netlify (arrastrar la carpeta en Deploys).
- Pegar tu ID de Google Analytics y de tu píxel de Meta en `medicion.js`.
- Crear y verificar el perfil de Google Business y Google Search Console, y enviar el
  sitemap. Darse de alta en Bing Webmaster Tools: ChatGPT y Copilot buscan con Bing.
- Pedir reseñas en Google a las 2 cuentas actuales y a cada cliente nuevo.

La web no va a traer clientes este mes. Sirve para que el que recibe tu mensaje entre,
vea que eres serio y termine de confiar. Los clientes de este mes salen del escáner de
mercado y de los mensajes.
