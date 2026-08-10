# Colchones Yolé — Documento de traspaso

> **Cómo usar este archivo:** pégalo completo en un chat nuevo (aquí, en claude.ai, o donde sea)
> o compártelo con quien vaya a continuar el proyecto. Con esto se entiende todo sin haber
> estado en las conversaciones anteriores.
>
> Última actualización: 21 de julio de 2026.

---

## 1. Qué es este proyecto

Una **tienda online real** para Colchones Yolé (Yolé Ltda, fábrica en Malloco, Peñaflor),
construida desde cero. Es **paralela** al sitio actual en Wix (colchonesyole.cl sigue existiendo):
esta tienda nueva es la que procesa las compras directas.

Nació como una maqueta de propuesta y se transformó en tienda real con pagos. **Ya está
publicada y funcionando en modo marcha blanca** (todo el circuito es real, pero Webpay está en
ambiente de pruebas, sin cobros de dinero).

## 2. Accesos

| Qué | Dónde |
|---|---|
| **Tienda** | https://colchones-yole-production.up.railway.app |
| **Panel de administración** | https://colchones-yole-production.up.railway.app/admin.html |
| **Código** | github.com/Gabrielo28/colchones-yol (rama `main`) |
| **Hosting** | Railway, proyecto "loving-empathy" |
| **Clave del panel** | Está en Railway → servicio `colchones-yole` → Variables → `ADMIN_TOKEN` |

**Importante:** cada vez que se sube un cambio a GitHub, Railway **actualiza la tienda solo**
(auto-deploy). No hay que hacer nada más.

## 3. Qué sabe hacer la tienda

**Para el comprador:**
- Catálogo de 6 líneas de colchón con filtros (firmeza, tamaño, precio), fichas individuales,
  carrito lateral y checkout en pasos.
- **Encuesta "Encuentra tu colchón ideal"** en el inicio: 3 preguntas y recomienda un modelo.
- Las fichas traducen las specs a beneficios ("no despiertas cuando tu pareja se da vuelta" antes
  que "resorte Pocket") y aclaran el **peso máximo por persona vs. total**.
- **Dos formas de pago**: Webpay (tarjetas, hasta 3 cuotas) y **transferencia electrónica**.
- Página de **términos y condiciones** con las políticas reales, y aceptación obligatoria al comprar.
- Sección **mayorista separada** con formulario de cotización.

**Para Yolé (panel `/admin.html`), sin tocar código:**
- **Pedidos** — las compras que entran, con datos de despacho. Las transferencias se confirman
  con un botón cuando el pago aparece en la cartola.
- **Cotizaciones** — solicitudes mayoristas, con el teléfono enlazado directo a WhatsApp.
- **Productos** — editar precios por tamaño, textos, firmeza, etiquetas, mostrar/ocultar,
  agregar/eliminar productos y **subir la foto** de cada colchón. Se aprieta "Guardar cambios"
  y la tienda se actualiza al instante.

## 4. Cómo está hecho

HTML + CSS + JavaScript **vanilla** (sin frameworks, sin paso de compilación) como aplicación de
una sola página con rutas por hash, más un **servidor Node sin dependencias**. Tipografía Poppins.

```
index.html          Tienda
admin.html          Panel de administración
css/styles.css      Estilos (paleta de marca)
js/data.js          Marca, necesidades y encuesta (NO el catálogo)
js/icons.js         Ilustraciones SVG
js/app.js           Router, carrito, checkout, vistas
img/                Logo oficial y foto del hero
server/
  server.js           Sirve la web + API + retorno de Webpay
  tbk.js              Cliente de Webpay Plus (API REST de Transbank)
  catalog.js          Catálogo: fuente de verdad de los precios
  catalog-default.js  Catálogo inicial (semilla, solo la 1ª vez)
  store.js            Pedidos y cotizaciones
  data/               Datos en vivo (NO se sube a GitHub)
```

**Dos decisiones importantes de seguridad:**
1. **El precio se calcula siempre en el servidor.** El navegador nunca decide cuánto se cobra
   (probado: si se manipula el carrito, el servidor lo rechaza).
2. **La tienda nunca ve datos de tarjetas.** El pago ocurre en la plataforma de Transbank.

**Ojo:** la tienda necesita el servidor corriendo incluso para navegar (el catálogo se carga
desde la API). Ya no se abre haciendo doble clic en `index.html`.

## 5. Para correr el proyecto en local

Requiere Node 18+.
```
cd colchones-yole
npm start
```
Abre http://localhost:5178 · Panel: http://localhost:5178/admin.html (token: `yole-admin-local`)

Arranca en modo prueba. Tarjeta de prueba de Transbank: VISA `4051 8856 0044 6623`, CVV `123`,
cualquier fecha futura; en el banco simulado RUT `11.111.111-1`, clave `123`.

## 6. Qué falta para vender de verdad

Está detallado en `PASOS-PRODUCCION.md` dentro del proyecto. En resumen:

1. **Llaves de Webpay de producción** — las obtiene el cliente en su portal Transbank. Se cargan
   como variables en Railway (`TBK_ENV=produccion`, `TBK_COMMERCE_CODE`, `TBK_API_KEY`).
2. **Precios reales por tamaño** — solo el precio de "1 plaza" es real; los de 1,5 plaza, 2 plazas
   y King están **estimados**. Se cargan desde el panel.
3. **Cuenta bancaria real** para las transferencias (hoy hay un placeholder con XXX).
4. **RUT de la empresa** para los términos y condiciones.
5. **Boleta electrónica (SII)** — obligación legal del vendedor en cada venta.
6. **Método de pago en Railway** (~US$5/mes) para que no se caiga al terminar el período de prueba.
7. Una **compra real de monto bajo** como prueba final antes de abrir al público.

## 7. Datos del negocio

- **Empresa:** Yolé Ltda · Fábrica: Hijuelas Lindenau, Sector C, Parcela 21, Malloco, Peñaflor
- **Contacto:** WhatsApp +56 9 4990 5296 · contacto@yoleltda.cl · Lun a Vie 9:00–18:00
- **Mayoristas:** Denisse +56 9 3254 7982 · Fernanda +56 9 4990 5296
- **Despacho:** gratis en la Región Metropolitana, 5 días hábiles (lun-vie 9-18, con seguimiento)
- **Cambios:** devolución 10 días corridos, cambio 30 días, reembolso máx. 10 días hábiles
- **Pago:** hasta 3 cuotas sin interés con Webpay

**Las 6 líneas** (tamaños: 1 plaza 90×190, 1,5 plaza 105×190, 2 plazas 150×190, King 180×200 —
**no existe Queen**):

| Modelo | Para qué | Desde (1 plaza) |
|---|---|---|
| Eco Paradise | Parejas (resorte Pocket, no se traspasa el movimiento) | $235.990 |
| Ecobear Resortes | Dolor de espalda (extra firme) | $170.990 |
| E-Confort | Uso intensivo, contexturas robustas | $115.990 |
| Ecobear Soft | Opción suave | $157.990 |
| Eco I | Económico | $90.990 |
| Eco Air | Niños e invitados (solo 1 y 1,5 plazas) | $84.990 |

## 8. Identidad visual

- **Logo oficial** en `img/logo-yole.svg` (vectorial, ya preparado para web).
- **Colores:** azul principal `#0507E7` (botones), azul marino `#20234D` (textos/header),
  rojo `#D62027` **solo** para ofertas, fondos `#FFFFFF` y `#F1F3F8`, bordes `#E6EAF5`,
  texto secundario `#585868`.
- **Tipografía:** Poppins.
- Las fotos deben ser de **dormitorio real con luz cálida** — nunca de bodega o fábrica
  (es uno de los problemas del sitio actual que esta propuesta vino a resolver).

## 9. Notas para quien continúe

- El PC del usuario tiene **Node y git, pero no Python** ni herramientas de imagen. Para procesar
  imágenes se usa el navegador (canvas); para scripts, Node.
- Los archivos `DESPLIEGUE.md`, `PASOS-PRODUCCION.md` y `README.md` del proyecto tienen el detalle
  de despliegue y de salida a producción.
- El brief original y el análisis de marca están en `brief-propuesta-colchonesyole.md` y
  `colchones-yole-marca-y-avatares.md`.
