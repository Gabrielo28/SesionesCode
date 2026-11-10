# Impulz: página de reservas y panel de comisiones

Una sola aplicación Node, sin dependencias, para Railway (mismo patrón que el Escáner y Colchones Yolé).

| Dirección | Qué es | Quién la ve |
|---|---|---|
| `https://impulz.entrenachile.cl/` | Página pública de reservas. Destino de todos los anuncios y links | Cualquiera |
| `https://impulz.entrenachile.cl/panel` | Panel de comisiones con usuario y clave | Coach, dueño y (opcional) recepción |

## Cómo funciona

1. La persona entra desde un anuncio o link con `?c=<canal>&utm_campaign=<campaña>&utm_content=<anuncio>`.
   Canales: `meta` (publicidad), `ig` (Instagram de Impulz), `coach` (redes del coach), `yt` (YouTube), `entrenachile` (perfil en la plataforma).
   Sin `c` queda como "Página de reservas (sin campaña)", que igual cuenta como gestión del coach.
2. Deja nombre y WhatsApp y recibe un código único (`IMP-6RHW`). Queda registrada sola, con fecha y campaña.
   El mismo teléfono en 60 días recibe el mismo código (no se duplica).
3. Se le abre WhatsApp con el mensaje listo (si está configurado el número en Ajustes).
4. En recepción: Panel → Contactos → **Inscribir con código** → escribir los 4 caracteres → **Marcar inscrito**.
   Se registra la fecha y el primer pago.
5. Cada mes: **Registrar pago** en los socios activos. Liquidación → **Copiar resumen para WhatsApp**.

## Permisos

| | Coach (`admin`) | Dueño / recepción |
|---|---|---|
| Ver contactos, liquidación, historial | Sí | Sí |
| Inscribir, cambiar etapa, registrar pagos | Sí | Sí |
| Registrar contactos de canales del gimnasio | Sí | Sí |
| Registrar contactos de canales de gestión | Sí | No |
| Cambiar el canal de origen de un contacto | Sí | No |
| Eliminar contactos | Sí | No |
| Cambiar el acuerdo (%), WhatsApp y textos de la página | Sí | No |
| Ver la inversión en publicidad y la ganancia neta | Sí | No |

Todo cambio queda en **Historial** con quién y cuándo. El historial no se puede borrar desde el panel.

## Publicar en Railway

1. En Railway: **New Project → Deploy from GitHub repo** → este repositorio.
2. En el servicio: **Settings → Root Directory** = `impulz-gym/app`. Railway lee `railway.json` y arranca con `node server.js`.
3. **Volumen para los datos** (obligatorio, si no se borran con cada deploy): Settings → Volumes → montar en `/data`.
4. **Variables** (Settings → Variables):

   | Variable | Ejemplo | Para qué |
   |---|---|---|
   | `DATA_DIR` | `/data` | Dónde se guardan reservas, socios e historial |
   | `ADMIN_USUARIO` / `ADMIN_CLAVE` | `coach` / (clave larga) | Tu usuario |
   | `DUENO_USUARIO` / `DUENO_CLAVE` | `impulz` / (clave larga) | Usuario del dueño |
   | `RECEPCION_USUARIO` / `RECEPCION_CLAVE` | opcional | Usuario de recepción |
   | `SESION_SECRETO` | 40+ caracteres al azar | Firma las sesiones |
   | `META_PIXEL_ID` | `1234567890` | Activa el Píxel de Meta (PageView y Lead al reservar) |

5. **Dominio:** Settings → Networking → Custom Domain → `impulz.entrenachile.cl`. Railway entrega un registro **CNAME**:
   créalo en el DNS de entrenachile.cl (nombre `impulz`, valor el que indique Railway). El certificado HTTPS es automático.
6. Entra a `/panel` con tu usuario → **Ajustes**: número de WhatsApp que recibe las reservas, beneficio del código, promoción y fecha de inicio.

## Probar en tu computador

```bash
cd impulz-gym/app
npm test                                   # 19 pruebas de punta a punta con datos temporales
ADMIN_USUARIO=coach ADMIN_CLAVE=1234 DUENO_USUARIO=dueno DUENO_CLAVE=1234 npm start
# reservas: http://localhost:5190/?c=meta   ·   panel: http://localhost:5190/panel
```

Los datos locales quedan en `impulz-gym/app/datos/`, que **no se sube a GitHub** (el repositorio es público).

## Archivos

```
server.js          Servidor: páginas, API, permisos, límites de intentos
lib/datos.js       Guardado en archivos JSON + historial
lib/sesiones.js    Usuarios (variables de entorno) y sesiones firmadas
public/reglas.js   Canales, etapas y cálculo de comisión (lo usan servidor y panel)
public/reserva.html  Página de reservas
public/panel.html    Panel de comisiones
pruebas.js         Prueba de punta a punta (npm test)
```
