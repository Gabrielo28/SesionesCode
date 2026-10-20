# Episodio 1: "Hora del baño" (piloto, versión 5 minutos)

**Video final (v2):** `episodio-01-hora-del-bano-v2.mp4` (1920×1080, 30 fps, 4:30, 71 planos), armado con `montaje_v2.py`.

v2 es un remontaje con el mismo material, sin gastar créditos: cada línea corta a un primer plano del personaje que habla (recortes de las animaciones cuando existen), las animaciones de acción van donde ocurre la acción, los efectos de sonido caen en el momento del salto/barro/tablet, y en el English Time se marca cada patito al contarlo. No hay sincronía labial real: para eso hace falta generar animación con lip-sync (créditos).

Versión anterior: `episodio-01-hora-del-bano-web.mp4` (`montaje.py`).

- Guion: `guion.md`
- Escenas (keyframes): `escenas/K01-K13.jpg` · hoja: `escenas-hoja.jpg`
- Animaciones (Kling 2.5 Turbo vía ElevenLabs): `v5/clips/C01-C18.mp4` + `animacion-prueba/K03-charcos-kling.mp4` (C03)
- Diálogos: `v5/voz/` (nuevos) y `audio/` (líneas reutilizadas de la versión corta)
- Efectos: `v5/sfx/` (recortados; originales en `v5/sfx/raw/`) · música de fondo: `v5/musica/music-bed.mp3`
- Canción y jingle: `../musica/cancion-bano-A.mp3`, `../musica/jingle-A.mp3`

## Voces

| Personaje | Voz | ID |
|---|---|---|
| Raffa | Blackie | `iFhPOZcajR7W3sDL39qJ` |
| Tobi | Carito | `WtRYgQbAJ4i0AckgdVbq` |
| Mamá | Jhenny | `EDitztUwd7lban76PAZs` |
| Papá | Gabrielo (voz clonada del creador) | `zSBw9G2zyuOd68yDdWPY` |
| Abuela Lela | Grandma Aurora | `aYQAm4rWuigkeuRA5i92` |
| Pipo | Charlee | `cQIBhnciTWugZAxX52uW` |

## Cómo se arma

```bash
python3 montaje.py                 # arma todo (~10 min, solo ffmpeg, sin créditos)
python3 montaje.py E-english       # regenera solo esas escenas y vuelve a unir
```

`montaje.py` define cada bloque (`SCENES`): audios en orden con pausas, efectos, música de
fondo y las imágenes/animaciones. Las animaciones duran lo que duran; las escenas fijas
llenan el resto con un zoom lento. El English Time pone en pantalla los números y palabras.

## Decisiones de edición

- El English Time usa la imagen fija de los 5 patitos: las animaciones C10 y C17 cambiaban
  la cantidad de patitos mientras se movían, y eso confunde al contar. Quedan sin usar.
- El conteo de Raffa se grabó número por número; el de Tobi se cortó por silencios.

## Pendientes / mejoras posibles

- Revisar con audífonos: volumen de voces vs. música, y que ninguna línea suene rara.
- Miniatura para YouTube y título/descripción.
- Si alguna voz o animación no convence, se regenera solo esa pieza y se vuelve a montar.
