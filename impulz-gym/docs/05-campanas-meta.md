# Plan de campañas en Meta (piloto)

> Borrador para revisión del coach. La publicidad la paga el coach desde la cuenta publicitaria de Influence Chile.
> El gimnasio no paga nada. Precios de las promociones: ejemplos del Instagram del gimnasio, **confirmar con el dueño**.

---

## 1. Configuración de cuentas (antes de lanzar)

1. **Business Manager (portafolio comercial) de Influence Chile.** Revisar que el coach sea administrador.
2. **Cuenta publicitaria** dentro de ese portafolio: moneda CLP y zona horaria America/Santiago.
   Ambas cosas no se pueden cambiar después. Nombre sugerido: `IC - Impulz Gym El Quisco`.
3. **Método de pago:** tarjeta del coach o de Influence Chile en esa cuenta. Poner un límite de gasto de la cuenta
   igual al presupuesto del periodo (ej. $80.000 para las 3 primeras semanas) para no pasarse.
4. **Acceso a la página del gimnasio:** en Configuración del negocio, Cuentas, Páginas, "Solicitar acceso a una página".
   Pedir solo permiso para crear y administrar anuncios (no control total). El dueño aprueba desde su página.
5. **Acceso a Instagram (@impulzgym.elquisco):** la cuenta debe estar conectada a la página de Facebook del gimnasio.
   Pedir acceso a la cuenta de Instagram desde el mismo portafolio para que los anuncios salgan con el nombre de Impulz.
6. **Píxel (conjunto de datos):** crear el píxel en el portafolio de Influence Chile e instalarlo en `impulz.entrenachile.cl`.
   - `PageView` en todas las páginas.
   - `Lead` cuando la persona completa la reserva (no al abrir el formulario).
   - Probar con "Probar eventos" en el Administrador de eventos: hacer una reserva de prueba y ver que llegue el `Lead`.
   - No enviar al píxel nombre, teléfono ni datos de salud en la URL o en parámetros del evento.
7. **Verificar el dominio** `entrenachile.cl` en el portafolio (Seguridad de la marca, Dominios). Sirve para todo el subdominio.
8. **Reserva de prueba completa** antes de lanzar: anuncio de prueba, página, código, WhatsApp y registro en el panel con `c=meta`.

---

## 2. Objetivo de la campaña: por qué "Clientes potenciales" con el evento Lead

**Recomendación:** objetivo **Clientes potenciales**, ubicación de la conversión **Sitio web**, optimizando para el evento **Lead**.

- Lo que importa es la reserva, no el clic. Si se optimiza por tráfico, Meta busca a quien hace clic barato, que no siempre reserva.
- Optimizar por `Lead` le enseña al píxel qué tipo de persona reserva. Eso sirve para diciembre y para el verano.
- El presupuesto es chico (unos $3.000 diarios), así que Meta no va a salir de la "fase de aprendizaje". Es normal. Igual aprende.

**Plan B, tráfico:** objetivo **Tráfico**, optimizando por **visitas a la página de destino**. Usarlo si:
- el píxel todavía no recibe el evento `Lead` el día del lanzamiento, o
- después de 5 días y unos $15.000 gastados hay 0 a 2 reservas y la campaña casi no entrega (pocas impresiones).

Cuando el píxel junte las primeras 15 a 20 reservas, volver a "Clientes potenciales".

---

## 3. Estructura de las 3 primeras semanas

**Presupuesto total: $60.000 a $80.000.**

| Semana | Presupuesto | Qué se hace |
|---|---|---|
| 1 | $20.000 (≈ $2.900 al día) | Lanzar con 3 o 4 anuncios. No tocar nada por 3 a 4 días. |
| 2 | $20.000 a $25.000 | Apagar el anuncio con peor costo por reserva. Sumar uno nuevo del contenido de la semana. |
| 3 | $20.000 a $35.000 | Si el costo por socio va bien, subir hasta 30%. Si no, mantener y revisar oferta y página. |

- **1 campaña, 1 conjunto de anuncios, 3 o 4 anuncios.** Con este presupuesto, dividir en más conjuntos reparte muy pocos datos.
- Presupuesto a nivel de campaña o de conjunto, da igual con un solo conjunto. Usar presupuesto diario.
- Ubicaciones: Advantage+ (automáticas). Revisar después en el desglose si Reels e Historias rinden más.
- No editar la campaña todos los días. Cada cambio grande reinicia el aprendizaje. Revisar cada 3 o 4 días.

---

## 4. Público

- **Ubicación:** El Quisco con un radio que cubra Algarrobo, El Tabo, Isla Negra y Cartagena.
  Opción simple: pin en el gimnasio con radio de unos 20 km (llega a Cartagena). Revisar en el mapa que no tome zonas sin interés.
  Alternativa: agregar por nombre las comunas de El Quisco, Algarrobo, El Tabo y Cartagena.
- **Opción de ubicación:** "personas que viven en esta ubicación o estuvieron recientemente". En noviembre y diciembre apunta a residentes.
- **Edad:** 18 a 55 años. Todo género. Mayores de 18 por política de Meta en anuncios de bienestar y estado físico.
- **Intereses o abierto:** partir **abierto** (sin intereses, con Advantage+ público). La zona es chica y los intereses
  ("fitness", "gimnasio") la achican aún más y suben el costo. Que el anuncio y el píxel hagan el filtro.
  Si después de 2 semanas el costo por reserva es alto, probar un conjunto con intereses de fitness y comparar.
- **Más adelante (cuando haya datos):**
  - Visitantes de la página que no reservaron (últimos 30 días).
  - Personas que interactuaron con el Instagram de Impulz (requiere el acceso a la cuenta de Instagram del punto 1).
  - Público similar a quienes reservaron, cuando haya al menos 100 reservas.

---

## 5. Convención de nombres

| Nivel | Formato | Ejemplo |
|---|---|---|
| Campaña | `IMP_<OBJETIVO>_<campaña>` | `IMP_LEADS_relanzamiento-nov` |
| Conjunto | `IMP_<zona>_<edad>_<público>` | `IMP_litoral20km_18-55_abierto` |
| Anuncio | igual al `utm_content` | `a1-bienvenida-reel` |

- `<campaña>` es el mismo valor de `utm_campaign`. Así el panel y el Administrador de anuncios cuadran.
- Todo en minúsculas, sin tildes, sin espacios (usar guiones).
- Valores de campaña del piloto: `relanzamiento-nov`, `reto-verano-dic`, `pase-verano-ene`, `pase-verano-feb`.

---

## 6. Anuncios de las 3 primeras semanas

Todos usan `c=meta`. El link va en el campo "URL del sitio web" del anuncio, completo:

### A1 · Bienvenida $25.000 (video recorrido)
- **Formato:** Reel vertical de 15 s (el Post 1 del plan de contenido, sin el saludo largo).
- **Texto principal:**
  > Impulz Gym abrió con nuevo nombre en El Quisco.
  > Primer mes a $25.000 (confirmar con el dueño). Abierto de lunes a viernes de 5:00 a 22:00 y sábados de 8:00 a 14:00.
  > Reserva tu clase de prueba y recibe tu código con [BENEFICIO DEL CÓDIGO].
- **Título:** Primer mes a $25.000 en El Quisco
- **Descripción:** Clase de prueba sin costo [confirmar]
- **Botón:** Reservar
- **URL:** `https://impulz.entrenachile.cl/?c=meta&utm_campaign=relanzamiento-nov&utm_content=a1-bienvenida-reel`

### A2 · Coach a cámara: volver a entrenar
- **Formato:** Reel vertical de 15 a 20 s, el coach hablando a cámara y tomas de clase.
- **Texto principal:**
  > Si quieres volver a entrenar y no sabes por dónde partir, parte con una clase de prueba.
  > Te mostramos la sala y armamos una rutina para tu nivel. En Impulz Gym, El Quisco.
- **Título:** Tu clase de prueba en Impulz
- **Descripción:** Reserva en 1 minuto
- **Botón:** Reservar
- **URL:** `https://impulz.entrenachile.cl/?c=meta&utm_campaign=relanzamiento-nov&utm_content=a2-coach-volver-reel`

### A3 · Horario: antes o después del trabajo
- **Formato:** imagen o carrusel de 3 láminas (sala a las 5:00, sala de noche, horario).
- **Texto principal:**
  > Abrimos a las 5:00 y cerramos a las 22:00, de lunes a viernes.
  > Entrena antes del trabajo o después, en El Quisco. Reserva tu clase de prueba en Impulz Gym.
- **Título:** Abierto de 5:00 a 22:00
- **Descripción:** Impulz Gym El Quisco
- **Botón:** Reservar
- **URL:** `https://impulz.entrenachile.cl/?c=meta&utm_campaign=relanzamiento-nov&utm_content=a3-horario-carrusel`

### A4 · Plan pareja y trae un amigo (sumar en la semana 2)
- **Formato:** Reel corto con dos personas entrenando juntas (con autorización firmada de ambas).
- **Texto principal:**
  > Entrenar acompañado cuesta menos.
  > Plan pareja $50.000 y 25% de descuento si traes a un amigo (confirmar con el dueño). En Impulz Gym, El Quisco.
- **Título:** Plan pareja a $50.000
- **Descripción:** Reserva para los dos
- **Botón:** Reservar
- **URL:** `https://impulz.entrenachile.cl/?c=meta&utm_campaign=relanzamiento-nov&utm_content=a4-pareja-amigo-reel`

> Nota: `utm_content` se escribe a mano en cada anuncio para que coincida con su nombre.
> No usar parámetros dinámicos de Meta en estos campos para no salirse de la convención del panel.

---

## 7. Qué medir cada semana

Revisar todos los lunes, con el Administrador de anuncios y el panel lado a lado.

| Métrica | Cómo se calcula | Dónde |
|---|---|---|
| Gasto | Total de la semana | Meta |
| Reservas | Personas con `c=meta` registradas | Panel (comparar con los `Lead` de Meta) |
| Costo por reserva | Gasto / reservas | Calculado |
| Reserva a prueba | Pruebas asistidas / reservas | Panel |
| Prueba a inscripción | Inscritos / pruebas asistidas | Panel |
| **Costo por socio** | **Gasto / socios inscritos atribuidos a `c=meta`** | Calculado |

**Qué hacer con el costo por socio:**
- **Menos de $20.000:** seguir y escalar. Subir el presupuesto hasta 30% por semana, no más de golpe.
- **Entre $20.000 y $25.000:** mantener. Cambiar el anuncio más débil y revisar la oferta.
- **Más de $25.000:** revisar. Con la mensualidad de referencia de $25.000, el primer mes ya no paga el anuncio.
  Antes de culpar al anuncio, mirar las tasas: si hay muchas reservas pero pocas llegan a la prueba, el problema es la
  confirmación por WhatsApp; si llegan a la prueba pero no se inscriben, es la oferta o la experiencia en sala.

**Cuidado:** si los `Lead` de Meta no cuadran con las reservas del panel (diferencia de más de 20%), revisar el píxel antes de sacar conclusiones.

---

## 8. Diciembre: "Llega en forma al verano"

- **Campaña:** `IMP_LEADS_reto-verano-dic`, desde el anuncio del reto (fin de noviembre) hasta [FECHA DE CIERRE DE INSCRIPCIONES].
- **Público:** el mismo de noviembre (residentes, 18 a 55, abierto). Sumar los visitantes de la página que no reservaron.
- **Presupuesto:** definirlo con el costo por socio de noviembre. Referencia de la memoria: 20 socios al mes a $15.000 cada uno son $300.000 al mes.
- **Anuncios:**
  - R1 · Anuncio del reto (Reel del Post 10).
    Texto: "Reto Llega en forma al verano en Impulz Gym. 6 semanas, medición al inicio y al final, premio para quien más avance. Parte el [FECHA]. Cupos limitados."
    Título: "Reto de 6 semanas en El Quisco". Botón: Registrarte.
    URL: `https://impulz.entrenachile.cl/?c=meta&utm_campaign=reto-verano-dic&utm_content=r1-anuncio-reel`
  - R2 · Cómo funciona (carrusel del Post 11).
    URL: `https://impulz.entrenachile.cl/?c=meta&utm_campaign=reto-verano-dic&utm_content=r2-como-funciona-carrusel`
  - R3 · Coach: "Parte en diciembre" (Reel del Post 12).
    URL: `https://impulz.entrenachile.cl/?c=meta&utm_campaign=reto-verano-dic&utm_content=r3-parte-diciembre-reel`
- **Mensaje:** constancia, energía, fuerza, llegar al verano con el hábito armado. Sin promesas de kilos ni antes y después.

---

## 9. Enero y febrero: pase verano

- **Campañas:** `IMP_LEADS_pase-verano-ene` y `IMP_LEADS_pase-verano-feb` (separar por mes para comparar).
- **Público:** personas que **están o estuvieron recientemente** en El Quisco, Algarrobo, El Tabo, Isla Negra y Cartagena.
  Es lo que permite llegar al veraneante sin saber dónde vive. Revisar en el Administrador qué opciones de ubicación
  ofrece Meta en ese momento, porque cambian. Edad 18 a 60. Abierto.
- **Mantener aparte** la campaña de residentes (socios mensuales), con menos presupuesto, para no mezclar costos:
  el pase tiene otra comisión (30%) y otro valor.
- **Anuncios:**
  - V1 · "¿De vacaciones en el litoral? Sigue entrenando." Pase semanal [PRECIO PASE SEMANAL] y quincenal [PRECIO PASE QUINCENAL] (confirmar con el dueño). Sin matrícula.
    URL: `https://impulz.entrenachile.cl/?c=meta&utm_campaign=pase-verano-ene&utm_content=v1-vacaciones-reel`
  - V2 · Horario de verano y ubicación, con tomas de la sala y del camino desde la playa.
    URL: `https://impulz.entrenachile.cl/?c=meta&utm_campaign=pase-verano-ene&utm_content=v2-horario-ubicacion-carrusel`
  - V3 · Clase grupal de verano con veraneantes reales (con autorización).
    URL: `https://impulz.entrenachile.cl/?c=meta&utm_campaign=pase-verano-ene&utm_content=v3-clase-grupal-reel`
  - En febrero, copiar los anuncios que mejor funcionaron cambiando `pase-verano-ene` por `pase-verano-feb`.
- **Opcional (prueba chica, fin de diciembre):** anuncio para personas de la Región Metropolitana que ya interactuaron con Impulz
  o visitaron la página, avisando que pueden entrenar en sus vacaciones. Solo si hay presupuesto y público suficiente.
- **Medir aparte:** costo por pase vendido. Como la comisión del pase es 30%, el anuncio tiene que costar bastante menos
  que lo que deja cada pase. Definir el tope cuando se conozca el precio del pase.

---

## 10. Políticas de Meta: revisar antes de lanzar

Las políticas cambian. Revisarlas en el Centro de transparencia de Meta antes de cada campaña.

- **Categoría especial de anuncios:** un gimnasio normalmente no entra en ninguna (vivienda, empleo, crédito, temas sociales o políticos).
  No declararla. Confirmar en la versión vigente de la política y revisar si Meta trata los anuncios de salud y bienestar
  con reglas aparte en Chile (por ejemplo, límites para optimizar por eventos del sitio o para usar datos del píxel).
  Si el Administrador de eventos marca el píxel o el dominio como "restringido", avisar y pasar al plan B de tráfico.
- **Salud y apariencia personal:**
  - No usar fotos de antes y después del cuerpo.
  - No prometer resultados de peso o medidas ("baja 5 kilos en 6 semanas").
  - No generar inseguridad sobre el cuerpo.
  - Público mayor de 18 años en anuncios de estado físico o bajar de peso.
- **Atributos personales:** no afirmar ni insinuar características de quien ve el anuncio.
  - Mal: "¿Tienes sobrepeso?", "¿Te cuesta bajar de peso?", "Para ti que estás fuera de forma".
  - Bien: "Clase de prueba en Impulz", "Reto de 6 semanas", "Entrena antes o después del trabajo".
- **Imágenes de personas:** solo de quienes firmaron la autorización de uso de imagen que incluye anuncios pagados. Nunca menores en anuncios.
- **Datos del píxel:** no enviar datos de salud ni datos personales en parámetros. El formulario de reserva no debería pedir información de salud.
