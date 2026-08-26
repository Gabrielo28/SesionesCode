# ICP y Scoring — Automatización con IA

Perfil de cliente ideal para el [diagnóstico de workflows](06-diagnostico-workflows.md). Es
distinto del ICP de redes ([01-icp-y-scoring.md](01-icp-y-scoring.md)) en un punto clave: **el
modelo es 100% remoto, reuniones por Zoom**, así que no hay que priorizar por cercanía
geográfica. Se prioriza por rubro y por señales de volumen operativo.

---

## Perfil de Cliente Ideal (ICP)

### Perfil primario

| Dimensión | Criterio |
|---|---|
| **Rubro** | Salud y clínicas · Inmobiliaria y corretaje de propiedades · Servicios profesionales B2B (legal, contable, RR.HH., consultoría) |
| **Tamaño** | Empresas boutique/medianas — evitar cadenas grandes con ERP/CRM ya instalado y evitar unipersonales sin equipo que atienda |
| **Ubicación** | Todo Chile — sin prioridad por región, dado que el servicio se entrega 100% remoto |
| **Decisor** | Dueño, socio o gerente general — en estudios profesionales, el socio principal |

### Por qué estos 3 rubros

- **Salud y clínicas** — alto volumen de consultas repetitivas (precio, disponibilidad,
  convenios) y agendamiento que se pisa. Además **hay overlap directo con el ICP de redes**:
  muchas ya están en el radar por otro motivo.
- **Inmobiliaria y corretaje** — el negocio entero depende de responder rápido un WhatsApp de
  un interesado; el que se demora, pierde la comisión. Seguimiento de arriendo/venta es
  manual case por case.
- **Servicios profesionales B2B** (legal, contable, RR.HH., consultoría) — cotizaciones y
  reportería hechas a mano, mucho traspaso de información entre el equipo y el cliente por
  correo/WhatsApp sin sistema.

### Señales de compra (proxy, sin acceso a datos internos)

A diferencia del ICP de redes, acá no hay "biblioteca de anuncios" que muestre el dolor desde
afuera — el dolor operativo no se ve en una foto. Las señales son más indirectas:

1. **El sitio dice explícitamente "atendemos pymes/medianas empresas"** — señal de que el
   volumen de clientes ya es alto y probablemente gestionado a mano.
2. **Atienden "múltiples rubros" o "todo tipo de empresas"** — cada cliente distinto significa
   cotizar y reportar distinto cada vez, sin plantilla repetible.
3. **No hay agendamiento/cotización online en el sitio** — todo pasa por WhatsApp o formulario
   de contacto que cae a un correo.
4. **Publican vacante de "asistente administrativo/a", "encargado de atención al cliente" o
   "recepcionista"** — están cubriendo el síntoma (más manos) en vez de la causa (el proceso).
5. **Reseñas o comentarios públicos mencionando demora en la respuesta** — Google Business,
   Instagram, foros del rubro.

### Descartes automáticos

- Cadenas grandes con más de ~200 empleados o filiales de multinacionales (Randstad, grandes
  desarrolladoras) → ya tienen sistemas propios, ciclo de venta larguísimo, no es el ICP hoy.
- Empresas que ya declaran usar IA/automatización en su propio sitio (ej. un corretaje que
  promociona "gestión con Inteligencia Artificial") → ya resolvieron esto, no es prospecto.
- Profesional independiente sin equipo (ej. un abogado solo, sin secretaria) → el cuello de
  botella es 100% su propio tiempo, no hay a quién devolverle horas — se puede ofrecer, pero
  no es prioridad de prospección masiva.

---

## Scoring simplificado

Sin acceso a redes sociales ni biblioteca de anuncios, el scoring de 0-100 de redes no aplica
igual acá. En vez de eso, cada empresa nueva se marca con:

- **Señal encontrada** (cuál de las 5 de arriba aplica, y dónde se vio)
- **Por verificar antes de contactar** — tamaño real de equipo, si ya usan algún sistema, quién
  es el decisor. Estos datos no salen de una búsqueda general; se confirman mirando el sitio,
  LinkedIn de la empresa, o en la primera llamada.

No se inventan números de facturación ni cantidad de empleados que no estén confirmados — eso
fue lo que sí se pudo hacer en `leads-chile-132-empresas.csv` porque venía de una base de datos
con esos campos reales. Acá se documenta la fuente pública de cada dato.

---

## Punto de partida: los que ya tienes

Antes de salir a buscar empresas nuevas, revisa `leads-chile-132-empresas.csv` filtrando por
rubro `Centro médico / Clínica`, `Odontología` y `Farmacia / Salud retail` — son **39 empresas**
que ya calificaste para redes y que son candidatos directos de automatización. Es el cierre más
rápido posible: no hay que generar confianza de nuevo, solo mostrarles el hallazgo la próxima
vez que hables con ellas (o al ofrecerles el [cuestionario](../diagnostico-workflows.html)
directamente).

Las empresas nuevas de inmobiliaria y servicios profesionales están en
[`leads-automatizacion-chile.csv`](leads-automatizacion-chile.csv).
