#!/usr/bin/env python3
"""Monta el episodio 1 "Hora del baño" a partir de los audios, clips y escenas.

Uso: python3 montaje.py            -> genera episodio-01-hora-del-bano.mp4
Requiere ffmpeg. Todo se procesa en local; no consume créditos.
"""
import os
import subprocess
import sys

EP = os.path.dirname(os.path.abspath(__file__))
OLD = f"{EP}/audio"
V = f"{EP}/v5/voz"
SFX = f"{EP}/v5/sfx"
CL = f"{EP}/v5/clips"
ESC = f"{EP}/escenas"
MUS = f"{EP}/../musica"
BED = f"{EP}/v5/musica/music-bed.mp3"
TMP = os.environ.get("MONTAJE_TMP", "/tmp/montaje-ep1")
OUT = f"{EP}/episodio-01-hora-del-bano.mp4"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
W, H, FPS, SR = 1920, 1080, 30, 44100
GAP = 0.45

os.makedirs(TMP, exist_ok=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(" ".join(cmd) + "\n" + r.stderr[-2000:])
        raise SystemExit(1)


def dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    return float(out.strip())


def clip(name):
    return f"{EP}/animacion-prueba/K03-charcos-kling.mp4" if name == "C03" else f"{CL}/{name}.mp4"


# Audio items: ("v", file[, gap]) voz | ("s", file[, gap, vol]) efecto | ("p", seg) pausa
#              ("m", file, vol) música en primer plano (jingle, canción)
# Visual: ("c", clip) animación | ("cp", clip) animación ida y vuelta | ("i", imagen) fija con zoom
# Overlays: lista de (texto, inicio, fin, tamaño, y) relativos al inicio del bloque
SCENES = [
    {"id": "A-entrada", "bed": 0.0,
     "audio": [("m", f"{MUS}/jingle-A.mp3", 0.9), ("p", 0.3), ("v", f"{V}/L01-raffa.mp3"),
               ("v", f"{V}/L02-tobi.mp3"), ("v", f"{V}/L03-raffa.mp3", 0.8)],
     "visual": [("i", "K01"), ("c", "C01")]},
    {"id": "B1-charcos", "bed": 0.10,
     "audio": [("p", 0.6), ("v", f"{V}/L04-raffa.mp3"), ("v", f"{V}/L05-tobi.mp3", 1.0)],
     "visual": [("c", "C02"), ("i", "K02")]},
    {"id": "B2-pipo", "bed": 0.10,
     "audio": [("v", f"{V}/L06-pipo.mp3"), ("v", f"{V}/L07-raffa.mp3", 0.3),
               ("s", f"{SFX}/sfx-splash.mp3", 0.6, 0.8), ("v", f"{V}/L08-raffa.mp3"),
               ("s", f"{SFX}/sfx-splash.mp3", 0.8, 0.8), ("v", f"{V}/L09-pipo.mp3", 0.6)],
     "visual": [("i", "K03"), ("c", "C03"), ("c", "C16")]},
    {"id": "B3-barro", "bed": 0.10,
     "audio": [("s", f"{SFX}/sfx-mud.mp3", 0.4, 0.9), ("v", f"{OLD}/03-tobi.mp3"),
               ("v", f"{OLD}/02-raffa.mp3"), ("v", f"{V}/L12-pipo.mp3", 1.5)],
     "visual": [("c", "C04"), ("i", "K04")]},
    {"id": "C1-no-quiero", "bed": 0.08,
     "audio": [("v", f"{V}/L13-mama.mp3"), ("v", f"{V}/L14-pipo.mp3"), ("v", f"{V}/L15a-raffa.mp3", 0.1),
               ("v", f"{V}/L15b-tobi.mp3", 0.8), ("v", f"{OLD}/04-mama.mp3"), ("v", f"{OLD}/05-tobi.mp3", 1.0),
               ("v", f"{V}/L18-raffa.mp3", 2.2), ("v", f"{V}/L19-raffa.mp3"), ("v", f"{V}/L20-tobi.mp3", 0.8)],
     "visual": [("i", "K05"), ("cp", "C05"), ("i", "K05")]},
    {"id": "C2-abuela", "bed": 0.08,
     "audio": [("s", f"{SFX}/sfx-tablet.mp3", 0.3, 0.7), ("v", f"{V}/L21-abuela.mp3"),
               ("v", f"{V}/L22-raffa.mp3"), ("v", f"{V}/L23-abuela.mp3"), ("v", f"{V}/L24-raffa.mp3"),
               ("v", f"{V}/L25-abuela.mp3", 0.8)],
     "visual": [("c", "C06"), ("i", "K06")]},
    {"id": "C3-mama", "bed": 0.07,
     "audio": [("v", f"{V}/L26-mama.mp3", 0.8), ("v", f"{OLD}/08-tobi.mp3", 0.8),
               ("v", f"{V}/L28-mama.mp3", 0.6)],
     "visual": [("c", "C07"), ("i", "K07")]},
    {"id": "C4-chao-abuela", "bed": 0.08,
     "audio": [("v", f"{V}/L29-abuela.mp3", 0.8)],
     "visual": [("i", "K06")]},
    {"id": "D1-agua", "bed": 0.08,
     "audio": [("p", 0.5), ("v", f"{OLD}/10-mama.mp3", 1.2), ("v", f"{OLD}/12-tobi.mp3", 0.8)],
     "visual": [("c", "C08"), ("i", "K08")]},
    {"id": "D2-papa", "bed": 0.10,
     "audio": [("s", f"{SFX}/sfx-duck-bubbles.mp3", 0.3, 0.7), ("v", f"{OLD}/11-papa.mp3", 1.0),
               ("v", f"{OLD}/13-raffa.mp3"), ("v", f"{V}/L34-papa.mp3", 0.8)],
     "visual": [("c", "C09"), ("i", "K09")]},
    {"id": "E-english", "bed": 0.07, "english": True,
     "audio": "ENGLISH",
     "visual": [("i", "K10")]},
    {"id": "F-cancion", "bed": 0.0,
     "audio": [("m", f"{MUS}/cancion-bano-A.mp3", 1.0), ("p", 0.5)],
     "visual": [("cp", "C11"), ("i", "K11"), ("cp", "C12"), ("i", "K11"), ("cp", "C18")]},
    {"id": "G1-toalla", "bed": 0.08,
     "audio": [("v", f"{V}/L50-mama.mp3"), ("v", f"{V}/L51-raffa.mp3", 0.6), ("v", f"{OLD}/14-tobi.mp3", 0.5),
               ("v", f"{V}/L53-papa.mp3", 1.0), ("v", f"{V}/L54-raffa.mp3", 0.8)],
     "visual": [("c", "C13"), ("i", "K12")]},
    {"id": "G2-coco", "bed": 0.10,
     "audio": [("s", f"{SFX}/sfx-chick.mp3", 0.3, 0.8), ("v", f"{OLD}/17-mama.mp3", 1.5)],
     "visual": [("c", "C14"), ("i", "K13")]},
    {"id": "H-despedida", "bed": 0.0,
     "audio": [("v", f"{OLD}/16a-raffa.mp3", 0.1), ("v", f"{OLD}/16b-tobi.mp3", 0.4),
               ("m", f"{MUS}/jingle-A.mp3", 0.9), ("p", 0.5)],
     "visual": [("c", "C15"), ("i", "K01")]},
]


def english_audio():
    """English Time: conteo intercalado Raffa/Tobi con números en pantalla."""
    items, overlays, t = [], [], 0.0

    def add(kind, f, gap=GAP, vol=1.0):
        nonlocal t
        d = dur(f)
        items.append((kind, f, gap, vol))
        start = t
        t += d + gap
        return start, d

    add("s", f"{SFX}/sfx-english.mp3", 0.3, 0.8)
    overlays.append(("English Time", 0.0, 4.5, 130, "h*0.10"))
    add("v", f"{V}/L35-raffa.mp3", 0.8)
    words = "one two three four five".split()
    for i, w in enumerate(words):
        s, _ = add("v", f"{V}/L36{'abcde'[i]}-raffa-{w}.mp3", 0.35)
        add("v", f"{V}/L37{'abcde'[i]}-tobi-{w}.mp3", 0.7)
        overlays.append((f"{i + 1}  {w}", s, t - 0.1, 150, "h*0.08"))
    add("v", f"{V}/L46-papa.mp3", 0.8)
    s, _ = add("v", f"{V}/L47-raffa.mp3", 0.4)
    overlays += [("water", s + 2.3, s + 4.9, 130, "h*0.08"),
                 ("soap", s + 5.0, s + 7.4, 130, "h*0.08"),
                 ("bubbles", s + 7.5, s + 9.5, 130, "h*0.08")]
    add("v", f"{V}/L48-tobi.mp3", 0.6)
    s, d = add("v", f"{V}/L49-raffa.mp3", 1.0)
    overlays += [("water", s + 0.8, s + 2.2, 130, "h*0.08"),
                 ("soap", s + 2.4, s + 3.7, 130, "h*0.08"),
                 ("bubbles", s + 3.8, s + 5.3, 130, "h*0.08")]
    return items, overlays


def build_audio(sc, idx):
    items, overlays = (english_audio() if sc["audio"] == "ENGLISH" else (sc["audio"], []))
    inputs, filters, t = [], [], 0.0
    for it in items:
        kind = it[0]
        if kind == "p":
            t += it[1]
            continue
        f = it[1]
        if kind == "v":
            gap = it[2] if len(it) > 2 else GAP
            vol = it[3] if len(it) > 3 else 1.0
        elif kind == "s":
            gap = it[2] if len(it) > 2 else GAP
            vol = it[3] if len(it) > 3 else 0.8
        else:  # m
            vol = it[2] if len(it) > 2 else 1.0
            gap = 0.2
        n = len(inputs) // 2
        inputs += ["-i", f]
        ms = int(t * 1000)
        # La entrada 0 es el video, por eso el audio parte en 1.
        filters.append(f"[{n + 1}:a]aresample={SR},aformat=channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[a{n}]")
        t += dur(f) + gap
    return inputs, filters, t, overlays


def still_segment(img, seconds, out):
    frames = max(1, int(round(seconds * FPS)))
    zoom = f"zoompan=z='1+0.08*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS}"
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{ESC}/{img}.jpg",
         "-vf", f"scale=3840:-2,{zoom},format=yuv420p", "-frames:v", str(frames),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-an", out])


def clip_segment(name, out, pingpong=False):
    base = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p"
    if pingpong:
        vf = f"[0:v]{base},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[v]"
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", clip(name), "-filter_complex", vf, "-map", "[v]",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-an", out])
    else:
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", clip(name), "-vf", base,
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-an", out])
    return dur(out)


def esc(text):
    return text.replace(":", r"\:").replace("'", r"\'")


def build_scene(sc, idx):
    inputs, filters, adur, overlays = build_audio(sc, idx)
    # Clips: duración natural; las imágenes fijas reparten el resto.
    segs, clip_total = [], 0.0
    for kind, name in sc["visual"]:
        if kind in ("c", "cp"):
            out = f"{TMP}/{sc['id']}-{len(segs)}-{name}.mp4"
            d = clip_segment(name, out, pingpong=(kind == "cp"))
            segs.append(("c", out, d))
            clip_total += d
        else:
            segs.append(("i", name, None))
    n_still = sum(1 for s in segs if s[0] == "i")
    remaining = adur - clip_total
    still_len = max(2.5, remaining / n_still) if n_still else 0
    total = clip_total + still_len * n_still
    if not n_still and total < adur:
        total = adur
    total = max(total, adur)
    parts = []
    for i, (kind, src, d) in enumerate(segs):
        if kind == "i":
            out = f"{TMP}/{sc['id']}-{i}-{src}.mp4"
            still_segment(src, still_len, out)
            parts.append(out)
        else:
            parts.append(src)
    lst = f"{TMP}/{sc['id']}-list.txt"
    with open(lst, "w") as fh:
        fh.writelines(f"file '{p}'\n" for p in parts)
    video = f"{TMP}/{sc['id']}-video.mp4"
    run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
         "-c", "copy", video])
    vdur = dur(video)
    total = max(vdur, adur)

    # Audio de la escena: voces + música de fondo en loop.
    n = len(inputs) // 2
    mix_inputs = list(inputs)
    labels = [f"[a{k}]" for k in range(n)]
    if sc["bed"] > 0:
        mix_inputs += ["-stream_loop", "-1", "-i", BED]
        filters.append(f"[{n + 1}:a]aresample={SR},aformat=channel_layouts=stereo,volume={sc['bed']},atrim=0:{total:.3f}[bed]")
        labels.append("[bed]")
    filters.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,"
                   f"apad,atrim=0:{total:.3f}[aout]")
    vf = "null"
    if overlays:
        draws = [f"drawtext=fontfile={FONT}:text='{esc(t)}':fontsize={sz}:fontcolor=0xFFE36B:"
                 f"borderw=8:bordercolor=0x5A3A1E:x=(w-text_w)/2:y={y}:enable='between(t,{a:.2f},{b:.2f})'"
                 for t, a, b, sz, y in overlays]
        vf = ",".join(draws)
    out = f"{TMP}/{idx:02d}-{sc['id']}.mp4"
    cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", video] + mix_inputs + [
        "-filter_complex", ";".join(filters) + f";[0:v]{vf},tpad=stop_mode=clone:stop_duration=30,trim=0:{total:.3f}[vout]",
        "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k", "-ar", str(SR), out]
    run(cmd)
    return out, total


def main(only=None):
    """only: ids de escenas a regenerar; las demás reutilizan lo ya armado en TMP."""
    parts, timeline, t = [], [], 0.0
    for i, sc in enumerate(SCENES):
        cached = f"{TMP}/{i:02d}-{sc['id']}.mp4"
        if only is not None and sc["id"] not in only and os.path.exists(cached):
            out, d = cached, dur(cached)
        else:
            out, d = build_scene(sc, i)
        parts.append(out)
        timeline.append(f"{int(t // 60)}:{t % 60:05.2f}  {sc['id']}  ({d:.1f}s)")
        t += d
        print(timeline[-1], flush=True)
    lst = f"{TMP}/all.txt"
    with open(lst, "w") as fh:
        fh.writelines(f"file '{p}'\n" for p in parts)
    run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
         "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
         "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", OUT])
    print(f"TOTAL {t / 60:.2f} min -> {OUT}")


if __name__ == "__main__":
    main(set(sys.argv[1:]) or None)
