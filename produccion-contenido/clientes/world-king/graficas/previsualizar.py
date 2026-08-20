#!/usr/bin/env python3
"""Arma las tres vistas previas que se le muestran al cliente antes de publicar.

  _preview-feed.png        la grilla del perfil, 3 columnas, como la ve Instagram
  _preview-historias.png   la tira de historias en orden de publicacion
  _preview-destacadas.png  las portadas de historias destacadas

Se recorta a 4:5 igual que la grilla del perfil: si una pieza pierde el titulo al
recortarla, hay que arreglarla antes de publicar, no despues.
"""
import os
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
PNG = os.path.join(AQUI, 'PNG')
FONDO = (10, 10, 12)

# Orden de publicacion. En la grilla se invierte: lo ultimo publicado va arriba.
FEED = [
    'post-01-llegada', 'post-02-genero-nuevo', 'post-03-sonido',
    'reel-01-la-llegada', 'post-04-corona', 'post-05-ankh',
    'reel-02-adaptacion', 'post-06-trayectoria', 'reel-03-frecuencias',
    'post-07-entre-ustedes', 'reel-04-transmision',
]
HISTORIAS = [
    'historia-01-cuenta-regresiva', 'historia-02-pregunta', 'historia-03-bts',
    'historia-04-outfit', 'historia-04b-outfit-ankh', 'historia-05-invocacion',
    'historia-06-prueba-impacto', 'historia-07-cita-musical',
    'historia-08-ultimo-aviso', 'historia-09-ya-es-la-hora',
]
DESTACADAS = ['destacada-1-el-rey', 'destacada-2-musica', 'destacada-3-senal',
              'destacada-4-ankh', 'destacada-5-shows', 'destacada-6-terrestres']


def abrir(nombre):
    return Image.open(os.path.join(PNG, nombre + '.png')).convert('RGB')


def recortar(im, prop, desde='centro'):
    """Recorta a la proporcion pedida (ancho/alto).

    `desde='centro'` imita la grilla del perfil, que toma la banda central de un
    9:16. `desde='arriba'` sirve para la tira de historias, donde solo interesa
    revisar que el titulo entre.
    """
    w, h = im.size
    if w / h > prop:
        nw = int(h * prop)
        return im.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
    nh = int(w / prop)
    y = 0 if desde == 'arriba' else (h - nh) // 2
    return im.crop((0, y, w, y + nh))


def grilla(nombres, cols, ancho, prop, sep=6, invertir=False, desde='centro'):
    orden = list(reversed(nombres)) if invertir else list(nombres)
    alto = int(ancho / prop)
    filas = (len(orden) + cols - 1) // cols
    hoja = Image.new('RGB', (cols * ancho + (cols + 1) * sep,
                             filas * alto + (filas + 1) * sep), FONDO)
    for i, n in enumerate(orden):
        t = recortar(abrir(n), prop, desde).resize((ancho, alto), Image.LANCZOS)
        hoja.paste(t, (sep + (i % cols) * (ancho + sep), sep + (i // cols) * (alto + sep)))
    return hoja


def guardar(im, nombre):
    ruta = os.path.join(PNG, nombre)
    im.save(ruta)
    print(f'  {nombre:28} {im.size[0]}x{im.size[1]}')


if __name__ == '__main__':
    print('\n  Vistas previas\n')
    guardar(grilla(FEED, 3, 360, 4 / 5, invertir=True), '_preview-feed.png')
    guardar(grilla(HISTORIAS, 5, 260, 9 / 16, desde='arriba'), '_preview-historias.png')
    guardar(grilla(DESTACADAS, 6, 200, 1), '_preview-destacadas.png')
    print()
