#!/usr/bin/env python3
"""
Compositor de World King — ESTILO APROBADO.

Recorta al artista de sus fotos de estudio y lo pone sobre fondo espacial con
la firma lumínica de la marca: rim DORADO cálido por la izquierda, AZUL frío
por la derecha, sobre negro dominante con nebulosa apenas insinuada.

  python3 componer.py
"""
from PIL import Image, ImageFilter, ImageEnhance, ImageChops

V, F = 'visuales/', 'fotos/'

# Firma lumínica de la marca. Cambiar esto cambia el look de todas las piezas.
LUZ_CALIDA = (255, 198, 104)
LUZ_FRIA   = (108, 178, 255)
FUERZA_CALIDA, FUERZA_FRIA = 140, 165   # el rim azul manda, como en la referencia


def sin_bandas(im):
    """El generador a veces devuelve letterbox blanco; se recorta."""
    g = im.convert('L'); w, h = g.size; px = g.load()
    paso_x = max(1, w // 60); paso_y = max(1, h // 60)
    clara_fila = lambda y: sum(px[x, y] for x in range(0, w, paso_x)) / len(range(0, w, paso_x)) > 232
    clara_col  = lambda x: sum(px[x, y] for y in range(0, h, paso_y)) / len(range(0, h, paso_y)) > 232
    t = 0
    while t < h - 1 and clara_fila(t): t += 1
    b = h - 1
    while b > t and clara_fila(b): b -= 1
    l = 0
    while l < w - 1 and clara_col(l): l += 1
    r = w - 1
    while r > l and clara_col(r): r -= 1
    return im.crop((l, t, r + 1, b + 1))


def realzar(fg):
    """Las fotos de estudio vienen subexpuestas: se levantan sin saturar."""
    rgb, a = fg.convert('RGB'), fg.split()[3]
    rgb = ImageEnhance.Brightness(rgb).enhance(1.32)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.20)
    rgb = ImageEnhance.Color(rgb).enhance(1.05)
    rgb = rgb.filter(ImageFilter.UnsharpMask(3, 62, 3))
    o = rgb.convert('RGBA'); o.putalpha(a); return o


def luz_borde(fg, color, lado, fuerza):
    """Rim light: el contorno recibe la luz de la escena y deja de verse recortado."""
    a = fg.split()[3]
    b = ImageChops.subtract(a, a.filter(ImageFilter.MinFilter(11)))
    b = b.filter(ImageFilter.GaussianBlur(10)).point(lambda v: min(255, int(v * fuerza / 100)))
    capa = Image.new('RGBA', fg.size, color + (0,)); capa.putalpha(b)
    g = Image.linear_gradient('L').rotate(90, expand=True).resize(fg.size)
    if lado == 'izq': g = g.transpose(Image.FLIP_LEFT_RIGHT)
    capa.putalpha(ImageChops.multiply(capa.split()[3], g))
    return Image.alpha_composite(fg, capa)


def componer(fondo, recorte, salida, W=1080, H=1350, escala=.9, dx=.5, dy=1.0):
    bg = sin_bandas(Image.open(V + fondo).convert('RGBA'))
    r = max(W / bg.width, H / bg.height)
    bg = bg.resize((int(bg.width * r), int(bg.height * r)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2,
                  (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))

    fg = Image.open(F + recorte).convert('RGBA')
    fg = realzar(fg.crop(fg.getbbox()))
    fg = luz_borde(fg, LUZ_CALIDA, 'izq', FUERZA_CALIDA)
    fg = luz_borde(fg, LUZ_FRIA,   'der', FUERZA_FRIA)

    nh = int(H * escala); nw = int(fg.width * nh / fg.height)
    fg = fg.resize((nw, nh), Image.LANCZOS)
    x, y = int(W * dx) - nw // 2, int(H * dy) - nh

    halo = Image.new('RGBA', bg.size, (0, 0, 0, 0))
    s = Image.new('RGBA', fg.size, (0, 0, 0, 0)); s.paste((0, 0, 0, 215), (0, 0), fg.split()[3])
    halo.paste(s, (x, y + 18), s)
    bg = Image.alpha_composite(bg, halo.filter(ImageFilter.GaussianBlur(55)))

    o = Image.new('RGBA', bg.size); o.paste(bg, (0, 0)); o.paste(fg, (x, y), fg)
    o.convert('RGB').save(V + salida, quality=95)
    print(f'  {salida:28} {W}x{H}')


if __name__ == '__main__':
    print('\n  WORLD KING · composiciones\n')
    # El sujeto va grande, con la cara en el tercio superior.
    componer('fondo-retrato.png', 'recorte-rey-capa.png',    'wk-retrato.png',        escala=.94, dy=1.04)
    componer('fondo-espacio.png', 'recorte-rey-cetro.png',   'wk-cetro.png',          escala=.88, dy=1.04)
    componer('fondo-espacio.png', 'recorte-rey-espaldas.png','wk-espaldas.png',       escala=.80, dy=1.0, dx=.46)
    componer('fondo-retrato.png', 'recorte-terrestre.png',   'wk-terrestre.png',      escala=.90, dy=1.03)
    componer('fondo-story.png',   'recorte-rey-capa.png',    'wk-story.png',          1080, 1920, .66, dy=1.0)
    componer('fondo-story.png',   'recorte-rey-cetro.png',   'wk-story-cetro.png',    1080, 1920, .62, dy=1.0)
    componer('fondo-story.png',   'recorte-terrestre.png',   'wk-terrestre-story.png',1080, 1920, .64, dy=1.0)
    componer('fondo-minimo.png',  'recorte-rey-capa.png',    'wk-minimo.png',         escala=.92, dy=1.03)
    print()
