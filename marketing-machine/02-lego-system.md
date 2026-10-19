# 02 · Lego System: una grabación, decenas de anuncios

Meta decide casi todo por el creativo, y el creativo que más pesa son **los primeros 3
segundos**. El Lego System sirve para probar muchos ganchos sin grabar muchos videos:
se graba una sola vez, se corta en piezas y se combinan.

**No es IA.** Son tomas reales de Gabriel (o del equipo) hablando a cámara. Claude
elige los cortes y los etiqueta; `lego.js` corta y pega con ffmpeg.

## Las piezas

| Rol | Duración | Qué dice | Cuántas grabar |
|---|---|---|---|
| `gancho` | 2-4 s | Lo que detiene el scroll | **8-10** (es lo que más se prueba) |
| `cuerpo` | 10-25 s | El problema, la prueba, el caso | 2-3 |
| `cta` | 3-5 s | "Escríbenos por WhatsApp y te decimos qué le falta a tu cuenta" | 2 |

8 ganchos × 3 cuerpos × 2 cierres = **48 anuncios** de una sola sesión de 30 minutos.

## Guion de grabación (sesión de 30 min)

Grabar vertical, luz de frente, una frase por toma, con 1 segundo de silencio antes y
después de cada una (facilita el corte).

**Ganchos** (partir por el ganador histórico y variar):
1. "¿Sientes que tus redes sociales podrían dar mucho más?"
2. "Son las 11 de la noche y te acordaste: no publicaste nada hoy."
3. "Tu negocio se ve lindo… pero no vende en redes."
4. "Si tu Instagram lo maneja tu sobrina, este video es para ti."
5. "Gastaste plata en anuncios y solo te llegaron 'hola, precio'."
6. "Tu competencia publica todos los días. ¿Y tú?"
7. "3 errores que hacen que nadie te escriba por Instagram." (conecta con `carrusel-5-errores/`)
8. "Esto es lo que hacemos con $450.000 al mes." (este va a remarketing)

**Cuerpos:**
- A · Caso real: un cliente, antes y después (números).
- B · El método: contenido + pauta + respuesta rápida al WhatsApp.
- C · La auditoría gratis: "te revisamos tu cuenta y te decimos qué le falta" (ver
  `prospeccion-ventas/03-auditoria-express.md`).

**Cierres:**
- "Escríbenos por WhatsApp y te mandamos tu diagnóstico gratis."
- "Toca el botón, cuéntanos tu rubro y te decimos por dónde partir."

## Cómo se usa

```bash
cd marketing-machine/lego

# 1. Pídele a Claude: "transcribe grabacion.mp4 y arma cortes.json para el Lego System"
#    (ver cortes-ejemplo.json)
# 2. Cortar
node lego.js cortar sesion-2026-10/grabacion.mp4 sesion-2026-10/cortes.json
# 3. Ver qué hay
node lego.js piezas sesion-2026-10/piezas
# 4. Armar (12 por tanda: los 8 ganchos con el mejor cuerpo, más 4 variaciones)
node lego.js armar sesion-2026-10/piezas --max 12 --tanda S43
```

Salen en `sesion-2026-10/anuncios/` en 9:16 con `manifiesto.csv`. Después:
*"sube la tanda de anuncios Lego al laboratorio"* (el skill `marketing-machine` los sube a
Meta en pausa con el nombre del manifiesto).

Para subtítulos, logo u otros formatos usa el kit existente:
`produccion-contenido/video/video.js`.

Las grabaciones y los videos exportados **no se suben a git** (son pesados): quedan en tu PC
o en Drive. Solo se versionan `cortes.json` y `manifiesto.csv`.
