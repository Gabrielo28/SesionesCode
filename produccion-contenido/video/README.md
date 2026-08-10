# Kit de video — Influence Chile

Automatiza las tareas **mecánicas** de edición: reformatear, cortar, subtitular,
poner logo, comprimir. Por lote, sin abrir ningún programa.

**No reemplaza al editor.** No elige tomas, ni ritmo, ni música, ni hace color.
Eso sigue siendo trabajo humano. Esto le quita al editor las 2 horas de exportar
el mismo video en 4 formatos.

## Comandos

Se corre desde esta carpeta (`produccion-contenido\video`):

```bash
node video.js formatos "C:\ruta\video.mp4"
```

| Comando | Qué hace |
|---|---|
| `info` | Specs del archivo: resolución, duración, peso, códecs |
| `formatos` | Exporta en los 4 formatos de una vez |
| `reel` | Solo 9:16 → 1080×1920 (Reels, Stories, TikTok) |
| `feed` | Solo 4:5 → 1080×1350 (el que más pantalla ocupa en el feed) |
| `blur` | 9:16 con fondo borroso — **no recorta la imagen** |
| `subtitulos` | Quema subtítulos desde un `.srt` |
| `logo` | Marca de agua abajo a la derecha |
| `cortar` | Recorta un tramo: `cortar video.mp4 00:05 00:35` |
| `portada` | Extrae un frame en PNG para portada de reel |
| `optimizar` | Comprime a specs de Instagram |
| `lote` | Aplica cualquier comando a una carpeta completa |

Todo sale en una subcarpeta **EXPORT** al lado del video original. Nunca se
toca el archivo que le pasas.

## Los casos que más vas a usar

**Un video del cliente → los 4 formatos**
```bash
node video.js formatos "C:\Users\mezma\Videos\cliente.mp4"
```

**Una carpeta entera de una sesión de grabación → todos a reel**
```bash
node video.js lote "C:\Users\mezma\Videos\sesion-marzo" reel
```

**Video horizontal que no quieres recortar** — el `blur` mete el video completo
al centro sobre su propio fondo borroso. Es lo que usan todas las marcas cuando
el material original es 16:9 y hay que subirlo vertical.
```bash
node video.js blur "C:\Users\mezma\Videos\entrevista.mp4"
```

**Subtítulos**: yo te escribo el `.srt` con los tiempos, tú corres:
```bash
node video.js subtitulos "video.mp4" "subtitulos.srt"
```
El estilo ya viene calibrado: negrita, blanco con borde negro grueso, abajo.
Legible en celular y sin sonido, que es como se ve el 85% de los reels.

## Notas

- Si el comando dice que no encuentra ffmpeg, cierra y vuelve a abrir la terminal.
- Videos de menos de 1080px de ancho van a salir borrosos en Instagram sin
  importar lo que hagamos — hay que regrabar.
- El recorte es siempre al centro. Si lo importante del cuadro está a un costado,
  ese video hay que encuadrarlo a mano en el editor.
