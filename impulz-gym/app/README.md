# Impulz: sitio web, página de reservas y panel de comisiones

Una sola aplicación Node, sin dependencias, para Railway (mismo patrón que el Escáner y Colchones Yolé).

| Dirección | Qué es | Quién la ve |
|---|---|---|
| `https://impulzgym.cl/` | Sitio oficial del gimnasio: planes, horarios, entrenamiento personalizado, ubicación y reserva | Cualquiera |
| `/reserva` | Página corta de reservas, para anuncios | Cualquiera |
| `https://impulzgym.cl/panel` (más adelante `impulz.entrenachile.cl`) | Panel de comisiones con usuario y clave (plataforma del coach, en entrenachile.cl) | Coach, dueño y (opcional) recepción |

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

1. Railway → **New Project → Deploy from GitHub repo** → `SesionesCode`. Si no aparece, **Configure GitHub App** y dale acceso.
2. En el servicio, **Settings**:
   - **Source → Branch**: `claude/sweet-ptolemy-3u66w7` (la aplicación todavía no está en `main`).
   - **Source → Root Directory**: `impulz-gym/app`. Railway lee `railway.json` y arranca con `node server.js`.
3. **Volumen** (obligatorio: sin él se borran las reservas en cada deploy): clic derecho en el servicio → **Attach Volume** → Mount path `/data`.
4. **Variables**:

   | Variable | Valor | Para qué |
   |---|---|---|
   | `DATA_DIR` | `/data` | Dónde se guardan reservas, socios e historial |
   | `ADMIN_USUARIO` / `ADMIN_CLAVE` | `coach` / clave larga | Tu usuario |
   | `DUENO_USUARIO` / `DUENO_CLAVE` | `impulz` / clave larga | Usuario del dueño |
   | `SESION_SECRETO` | 40+ caracteres al azar | Firma las sesiones |
   | `ORIGEN_CLAVE` | 32+ caracteres al azar | Clave compartida con entrenachile.cl |
   | `RECEPCION_USUARIO` / `RECEPCION_CLAVE` | opcional | Usuario de recepción |
   | `META_PIXEL_ID` | opcional | Píxel de Meta |
   | `GOOGLE_VERIFICACION`, `BING_VERIFICACION`, `INDEXNOW_KEY` | después | SEO (`docs/09-seo-geo-indexacion.md`) |
   | `PANEL_HOST` | después | Solo si el panel pasa a `impulz.entrenachile.cl` |

5. **Dominio** (Settings → Networking → Custom Domain): `impulzgym.cl` y `www.impulzgym.cl` (si pregunta el puerto, deja el que sugiere Railway).
   Railway muestra un registro CNAME y uno TXT para cada uno: se crean en el DNS del dominio. NIC Chile no permite CNAME
   en la raíz, así que el DNS conviene manejarlo en Cloudflare (gratis), con la nube en gris ("DNS only").
   `www` redirige solo a la dirección sin `www`.
6. Comprobar: `https://impulzgym.cl/salud` responde `{"ok":true}`. Entrar a `https://impulzgym.cl/panel` → **Ajustes**.

Mientras no se defina `PANEL_HOST`, el panel abre en `impulzgym.cl/panel` (con usuario y clave, y fuera de los buscadores).

## Reservas que llegan desde entrenachile.cl

La página `entrenachile.cl/gimnasios/impulz` (repo `entrenacl`) reenvía sus reservas a `/api/reservas` de esta aplicación.
En el servicio de entrenachile.cl se definen `GIMNASIO_IMPULZ_RESERVAS_URL=https://impulzgym.cl/api/reservas` y
`GIMNASIO_IMPULZ_CLAVE` con el mismo valor que `ORIGEN_CLAVE` de aquí, para que el límite de
intentos use la IP del visitante y no la del servidor de entrenachile.cl.

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
public/sitio.html    Sitio web del gimnasio (se sirve en /)
public/reserva.html  Página corta de reservas para anuncios (/reserva)
public/panel.html    Panel de comisiones
pruebas.js         Prueba de punta a punta (npm test)
```
