#!/usr/bin/env python3
"""Montaje v2 del episodio 1: un plano por línea, con cortes al personaje que habla.

Reutiliza las mismas voces, efectos, música, escenas y animaciones de la v1 (sin créditos).
Cada plano recorta (encuadra) al personaje que habla, de preferencia desde una animación
para que haya movimiento, y los efectos de sonido van en el momento de la acción.

Uso: python3 montaje_v2.py   -> episodio-01-hora-del-bano-v2.mp4
"""
import math
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
TMP = os.environ.get("MONTAJE_TMP", "/tmp/montaje-ep1-v2")
OUT = f"{EP}/episodio-01-hora-del-bano-v2.mp4"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
W, H, FPS, SR = 1920, 1080, 30, 44100
GAP = 0.35
BED_VOL = 0.09

os.makedirs(TMP, exist_ok=True)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(" ".join(cmd)[:3000] + "\n" + r.stderr[-3000:])
        raise SystemExit(1)


_dur = {}


def dur(path):
    if path not in _dur:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", path], capture_output=True, text=True).stdout
        _dur[path] = float(out.strip())
    return _dur[path]


# --- Encuadres (centro x, centro y, ancho) en fracción del cuadro -------------------------
WIDE = (0.5, 0.5, 1.0)
F = {
    "K01": {"raffa": (0.40, 0.40, 0.50), "tobi": (0.57, 0.46, 0.48), "dos": (0.48, 0.42, 0.70)},
    "K02": {"raffa": (0.32, 0.45, 0.55), "tobi": (0.53, 0.48, 0.50), "dos": (0.42, 0.45, 0.70)},
    "K03": {"raffa": (0.25, 0.50, 0.52), "pipo": (0.49, 0.40, 0.52), "tobi": (0.73, 0.50, 0.52)},
    "K04": {"raffa": (0.25, 0.36, 0.50), "tobi": (0.55, 0.55, 0.50), "pipo": (0.85, 0.42, 0.48)},
    "K05": {"raffa": (0.51, 0.56, 0.50), "mama": (0.75, 0.30, 0.55), "sofa": (0.22, 0.55, 0.50)},
    "K06": {"mama": (0.32, 0.32, 0.55), "tablet": (0.37, 0.47, 0.36), "raffa": (0.56, 0.50, 0.48),
            "tobi": (0.86, 0.55, 0.40)},
    "K07": {"mama": (0.42, 0.33, 0.55), "tobi": (0.65, 0.46, 0.48), "dos": (0.52, 0.45, 0.78)},
    "K08": {"mama": (0.38, 0.33, 0.55), "tobi": (0.64, 0.42, 0.48), "agua": (0.48, 0.50, 0.75)},
    "K09": {"papa": (0.22, 0.38, 0.52), "tobi": (0.58, 0.55, 0.48), "raffa": (0.83, 0.50, 0.42)},
    "K10": {"papa": (0.21, 0.42, 0.50), "raffa": (0.40, 0.40, 0.48), "tobi": (0.77, 0.45, 0.46)},
    "K11": {"raffa": (0.32, 0.45, 0.58), "tobi": (0.70, 0.50, 0.55), "dos": (0.50, 0.47, 0.82)},
    "K12": {"mama": (0.25, 0.33, 0.56), "papa": (0.50, 0.38, 0.55), "tobi": (0.50, 0.56, 0.46),
            "raffa": (0.74, 0.55, 0.46)},
    "K13": {"papa": (0.19, 0.28, 0.48), "mama": (0.33, 0.32, 0.50), "familia": (0.33, 0.45, 0.70),
            "coco": (0.78, 0.70, 0.45)},
}
CLIP_KEY = {"C01": "K01", "C15": "K01", "C02": "K02", "C03": "K03", "C16": "K03", "C04": "K04",
            "C05": "K05", "C06": "K06", "C07": "K07", "C08": "K08", "C09": "K09", "C11": "K11",
            "C12": "K11", "C18": "K11", "C13": "K12", "C14": "K13"}


def clip(name, who="wide", start=0.0, rate=1.0):
    k = CLIP_KEY[name]
    return ("clip", name, WIDE if who == "wide" else F[k][who], start, rate)


def img(k, who="wide"):
    return ("img", k, WIDE if who == "wide" else F[k][who])


def v(path, gap=GAP):
    return ("v", path, gap)


def s(path, gap=0.1, vol=0.75):
    return ("s", path, gap, vol)


def p(sec):
    return ("p", sec)


# --- Lista de planos ------------------------------------------------------------------------
# Cada plano: (visual, [audio...], overlays). Si el visual es una lista [(visual, seg), ...]
# el plano se reparte entre varios cuadros (se usa en la canción).
SHOTS = [
    # Entrada
    (clip("C01", "wide", 0, 0.85), [("m", f"{MUS}/jingle-A.mp3", 0.9), p(0.2)], []),
    (clip("C01", "raffa", 0.8), [v(f"{V}/L01-raffa.mp3")], []),
    (clip("C01", "tobi", 2.0), [v(f"{V}/L02-tobi.mp3")], []),
    (clip("C01", "dos", 3.0), [v(f"{V}/L03-raffa.mp3", 0.6)], []),
    # Escena 1: charcos
    (clip("C02", "wide", 0, 0.9), [p(1.6)], []),
    (clip("C02", "raffa", 1.2), [v(f"{V}/L04-raffa.mp3")], []),
    (clip("C02", "tobi", 3.0), [v(f"{V}/L05-tobi.mp3", 0.5)], []),
    (clip("C16", "pipo", 2.8), [v(f"{V}/L06-pipo.mp3")], []),
    (clip("C03", "raffa", 0.0), [v(f"{V}/L07-raffa.mp3", 0.1)], []),
    (clip("C03", "wide", 0.0, 0.9), [p(1.55), s(f"{SFX}/sfx-splash.mp3", 0.6, 0.85)], []),
    (clip("C16", "wide", 0.0, 0.9), [v(f"{V}/L08-raffa.mp3", 0.2), s(f"{SFX}/sfx-splash.mp3", 0.3, 0.6)], []),
    (clip("C16", "pipo", 1.5), [v(f"{V}/L09-pipo.mp3", 0.3)], []),
    (clip("C04", "wide", 0.0), [p(0.2), s(f"{SFX}/sfx-mud.mp3", 0.2, 0.9)], []),
    (clip("C04", "tobi", 1.5), [v(f"{OLD}/03-tobi.mp3")], []),
    (clip("C04", "raffa", 2.0), [v(f"{OLD}/02-raffa.mp3")], []),
    (clip("C04", "pipo", 3.0), [v(f"{V}/L12-pipo.mp3", 0.2)], []),
    (clip("C04", "wide", 3.5), [p(1.4)], []),
    # Escena 2: no quiero bañarme
    (img("K05", "mama"), [v(f"{V}/L13-mama.mp3")], []),
    (clip("C16", "pipo", 3.6), [v(f"{V}/L14-pipo.mp3")], []),
    (clip("C02", "dos", 2.0), [v(f"{V}/L15a-raffa.mp3", 0.05), v(f"{V}/L15b-tobi.mp3", 0.5)], []),
    (img("K05", "mama"), [v(f"{OLD}/04-mama.mp3")], []),
    (img("K07", "tobi"), [v(f"{OLD}/05-tobi.mp3", 0.2)], []),
    (clip("C05", "sofa", 0.0), [p(1.2)], []),
    (clip("C05", "raffa", 1.0), [v(f"{V}/L18-raffa.mp3", 2.0)], []),
    (clip("C05", "wide", 3.0), [v(f"{V}/L19-raffa.mp3")], []),
    (clip("C05", "sofa", 4.0), [v(f"{V}/L20-tobi.mp3", 0.5)], []),
    (clip("C06", "wide", 0.0), [s(f"{SFX}/sfx-tablet.mp3", 0.2, 0.7)], []),
    (clip("C06", "tablet", 0.6), [v(f"{V}/L21-abuela.mp3")], []),
    (clip("C06", "raffa", 1.5), [v(f"{V}/L22-raffa.mp3")], []),
    (clip("C06", "tablet", 2.5), [v(f"{V}/L23-abuela.mp3")], []),
    (clip("C06", "raffa", 3.5), [v(f"{V}/L24-raffa.mp3")], []),
    (clip("C06", "tablet", 4.0), [v(f"{V}/L25-abuela.mp3", 0.5)], []),
    (clip("C07", "mama", 0.0), [v(f"{V}/L26-mama.mp3", 0.6)], []),
    (clip("C07", "tobi", 2.0), [v(f"{OLD}/08-tobi.mp3", 0.6)], []),
    (clip("C07", "dos", 3.0), [v(f"{V}/L28-mama.mp3", 0.5)], []),
    (clip("C06", "tablet", 1.0), [v(f"{V}/L29-abuela.mp3", 0.6)], []),
    # Escena 3: el baño
    (clip("C08", "agua", 0.0), [p(0.4), v(f"{OLD}/10-mama.mp3", 0.6)], []),
    (clip("C08", "tobi", 2.8), [v(f"{OLD}/12-tobi.mp3", 0.6)], []),
    (clip("C09", "papa", 0.0), [s(f"{SFX}/sfx-duck-bubbles.mp3", 0.1, 0.7), v(f"{OLD}/11-papa.mp3", 0.3)], []),
    (clip("C09", "wide", 2.0), [p(1.0)], []),
    (clip("C09", "raffa", 3.0), [v(f"{OLD}/13-raffa.mp3")], []),
    (img("K10", "papa"), [v(f"{V}/L34-papa.mp3", 0.6)], []),
    # English Time (se arma en english_shots)
    "ENGLISH",
    # Canción
    ([(clip("C11", "wide", 0, 0.85), 6.5), (clip("C12", "raffa", 0, 0.9), 5.5),
      (clip("C18", "tobi", 0, 0.9), 5.5), (clip("C11", "dos", 1.0, 0.9), 6.0),
      (clip("C12", "wide", 0, 0.85), 6.0), (clip("C18", "raffa", 0.5, 0.9), 5.5),
      (clip("C11", "tobi", 2.0, 0.9), 5.0), (clip("C18", "wide", 0, 0.85), 6.0),
      (img("K11", "dos"), None)],
     [("m", f"{MUS}/cancion-bano-A.mp3", 1.0), p(0.4)], "SONG"),
    # Escena 5: toalla y Coco
    (clip("C13", "mama", 0.0), [v(f"{V}/L50-mama.mp3")], []),
    (clip("C13", "raffa", 1.0), [v(f"{V}/L51-raffa.mp3", 0.4)], []),
    (clip("C13", "tobi", 2.0), [v(f"{OLD}/14-tobi.mp3", 0.3)], []),
    (clip("C13", "papa", 2.5), [v(f"{V}/L53-papa.mp3", 0.8)], []),
    (img("K12", "raffa"), [v(f"{V}/L54-raffa.mp3", 0.5)], []),
    (clip("C14", "wide", 0.0), [p(0.3), s(f"{SFX}/sfx-chick.mp3", 0.1, 0.8)], []),
    (clip("C14", "mama", 3.0), [v(f"{OLD}/17-mama.mp3", 0.3)], []),
    (clip("C14", "coco", 3.5), [p(1.3)], []),
    # Despedida
    (clip("C15", "dos", 0.0), [v(f"{OLD}/16a-raffa.mp3", 0.05), v(f"{OLD}/16b-tobi.mp3", 0.3)], []),
    (clip("C15", "wide", 1.5, 0.85), [("m", f"{MUS}/jingle-A.mp3", 0.9), p(0.4)], []),
]


def english_shots():
    """Conteo con el patito marcado y palabras en pantalla."""
    title = [("text", "English Time", 0.0, 4.0, 130, "h*0.08")]
    shots = [(img("K10", "wide"), [s(f"{SFX}/sfx-english.mp3", 0.2, 0.75), v(f"{V}/L35-raffa.mp3", 0.6)], title)]
    words = "one two three four five".split()
    duck_x = [0.375, 0.465, 0.555, 0.645, 0.735]  # centro de cada patito en K10
    for i, wd in enumerate(words):
        ov = [("text", f"{i + 1}  {wd}", 0.0, 99, 150, "h*0.07"), ("duck", duck_x[i], 0.585, 0.0, 99)]
        ov += [("duck", duck_x[j], 0.585, 0.0, 99) for j in range(i)]
        shots.append((img("K10", "wide"), [v(f"{V}/L36{'abcde'[i]}-raffa-{wd}.mp3", 0.3),
                                           v(f"{V}/L37{'abcde'[i]}-tobi-{wd}.mp3", 0.6)], ov))
    shots.append((img("K10", "papa"), [v(f"{V}/L46-papa.mp3", 0.6)], []))
    shots.append((img("K10", "raffa"), [v(f"{V}/L47-raffa.mp3", 0.3)],
                  [("text", "water", 2.3, 4.9, 130, "h*0.08"), ("text", "soap", 5.0, 7.4, 130, "h*0.08"),
                   ("text", "bubbles", 7.5, 99, 130, "h*0.08")]))
    shots.append((img("K10", "tobi"), [v(f"{V}/L48-tobi.mp3", 0.5)], [("text", "bubbles", 0, 99, 130, "h*0.08")]))
    shots.append((img("K10", "raffa"), [v(f"{V}/L49-raffa.mp3", 0.8)],
                  [("text", "water", 0.8, 2.2, 140, "h*0.08"), ("text", "soap", 2.4, 3.7, 140, "h*0.08"),
                   ("text", "bubbles", 3.8, 5.6, 140, "h*0.08")]))
    return shots


def audio_len(items):
    t = 0.0
    for it in items:
        if it[0] == "p":
            t += it[1]
        elif it[0] == "m":
            t += dur(it[1]) + 0.1
        else:
            t += dur(it[1]) + it[2]
    return t


def crop_filter(box):
    cx, cy, wf = box
    cw, ch = W * wf, H * wf
    x0 = min(max(cx * W - cw / 2, 0), W - cw)
    y0 = min(max(cy * H - ch / 2, 0), H - ch)
    return f"crop={int(cw)}:{int(ch)}:{int(x0)}:{int(y0)},scale={W}:{H}:flags=lanczos"


_src = {}


def clip_source(name):
    """Clip normalizado a 1080p/30 fps, en loop ida-vuelta para poder alargarlo."""
    if name not in _src:
        src = f"{CL}/{name}.mp4" if name != "C03" else f"{EP}/animacion-prueba/K03-charcos-kling.mp4"
        out = f"{TMP}/src-{name}.mp4"
        if not os.path.exists(out):
            base = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p"
            fc = (f"[0:v]{base},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,split[x][y];"
                  f"[x][y]concat=n=2:v=1:a=0[v]")
            run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-filter_complex", fc, "-map", "[v]",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-an", out])
        _src[name] = out
    return _src[name]


def overlay_filters(ovs, seconds):
    fs = []
    for o in ovs:
        if o[0] == "text":
            _, t, a, b, sz, y = o
            t = t.replace(":", r"\:").replace("'", r"\'")
            fs.append(f"drawtext=fontfile={FONT}:text='{t}':fontsize={sz}:fontcolor=0xFFE36B:borderw=8:"
                      f"bordercolor=0x5A3A1E:x=(w-text_w)/2:y={y}:enable='between(t,{a:.2f},{min(b, seconds):.2f})'")
        elif o[0] == "duck":
            _, x, y, a, b = o
            size = 150
            fs.append(f"drawbox=x={int(x * W - size / 2)}:y={int(y * H - size / 2)}:w={size}:h={size}:"
                      f"color=0xFFE36B@0.9:t=8:enable='between(t,{a:.2f},{min(b, seconds):.2f})'")
    return fs


def render_visual(vis, frames, out, ovs=()):
    seconds = frames / FPS
    extra = overlay_filters(ovs, seconds)
    if vis[0] == "clip":
        _, name, box, start, rate = vis
        src = clip_source(name)
        span = seconds * rate
        start = min(start, max(0.0, dur(src) - span - 0.05))
        vf = ",".join([f"setpts=(PTS-STARTPTS)/{rate}", crop_filter(box), f"fps={FPS}"] + extra + ["format=yuv420p"])
        run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{start:.3f}", "-i", src, "-vf", vf,
             "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", out])
    else:
        _, k, box = vis
        cx, cy, wf = box
        # Zoom muy lento sobre el encuadre para que la imagen fija respire.
        zoom = (f"zoompan=z='1+0.05*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                f":d={frames}:s={W}x{H}:fps={FPS}")
        vf = ",".join([f"scale={W * 2}:{H * 2}:flags=lanczos", crop_filter((cx, cy, wf)).replace(
            f"scale={W}:{H}", f"scale={W * 2}:{H * 2}").replace(f"crop={int(W * wf)}:{int(H * wf)}",
                                                                f"crop={int(2 * W * wf)}:{int(2 * H * wf)}"), zoom] + extra +
                       ["format=yuv420p"])
        # El recorte se calcula en 2x para conservar nitidez.
        cw, ch = 2 * W * wf, 2 * H * wf
        x0 = min(max(cx * 2 * W - cw / 2, 0), 2 * W - cw)
        y0 = min(max(cy * 2 * H - ch / 2, 0), 2 * H - ch)
        vf = ",".join([f"scale={2 * W}:{2 * H}:flags=lanczos", f"crop={int(cw)}:{int(ch)}:{int(x0)}:{int(y0)}",
                       f"scale={2 * W}:{2 * H}:flags=lanczos", zoom] + extra + ["format=yuv420p"])
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", f"{ESC}/{k}.jpg", "-vf", vf,
             "-frames:v", str(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", out])


def main():
    shots = []
    for sh in SHOTS:
        shots += english_shots() if sh == "ENGLISH" else [sh]

    # 1) Línea de tiempo absoluta de audio y cuadros por plano (sin deriva de redondeo).
    t, events, plan, song_span = 0.0, [], [], None
    for sh in shots:
        vis, items, ovs = sh
        start = t
        for it in items:
            if it[0] == "p":
                t += it[1]
            elif it[0] == "m":
                events.append((it[1], t, it[2]))
                t += dur(it[1]) + 0.1
            else:
                events.append((it[1], t, it[3] if it[0] == "s" else 1.0))
                t += dur(it[1]) + it[2]
        if ovs == "SONG":
            song_span = (start, t)
        plan.append((vis, start, t, [] if ovs == "SONG" else ovs))
    total = t

    # 2) Video: un segmento por plano.
    parts = []
    for i, (vis, a, b, ovs) in enumerate(plan):
        f0, f1 = round(a * FPS), round(b * FPS)
        if isinstance(vis, list):  # varios cuadros dentro del plano (canción)
            fixed = sum(sec for _, sec in vis if sec)
            free = [x for x in vis if not x[1]]
            rest = max(1.0, (b - a) - fixed) / max(1, len(free))
            cur = f0
            for j, (sub, sec) in enumerate(vis):
                sec = sec or rest
                nxt = f1 if j == len(vis) - 1 else min(f1, cur + round(sec * FPS))
                if nxt <= cur:
                    continue
                out = f"{TMP}/shot-{i:03d}-{j}.mp4"
                render_visual(sub, nxt - cur, out)
                parts.append(out)
                cur = nxt
        else:
            out = f"{TMP}/shot-{i:03d}.mp4"
            render_visual(vis, f1 - f0, out, ovs)
            parts.append(out)
        print(f"{i + 1}/{len(plan)}  {a:6.1f}s  {vis[0] if not isinstance(vis, list) else 'canción'}", flush=True)
    lst = f"{TMP}/parts.txt"
    with open(lst, "w") as fh:
        fh.writelines(f"file '{x}'\n" for x in parts)
    video = f"{TMP}/video.mp4"
    run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video])

    # 3) Audio: voces y efectos en su tiempo + música de fondo continua (se apaga en canción y jingles).
    inputs, filters = [], []
    for k, (f, at, vol) in enumerate(events):
        inputs += ["-i", f]
        ms = int(at * 1000)
        filters.append(f"[{k}:a]aresample={SR},aformat=channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[e{k}]")
    nb = len(events)
    inputs += ["-stream_loop", "-1", "-i", BED]
    mute = []
    if song_span:
        mute.append(song_span)
    mute += [(at, at + dur(f)) for f, at, _ in events if f.endswith("jingle-A.mp3")]
    vol_expr = "*".join(f"(1-between(t,{a - 0.5:.2f},{b + 0.5:.2f}))" for a, b in mute) or "1"
    filters.append(f"[{nb}:a]aresample={SR},aformat=channel_layouts=stereo,atrim=0:{total:.3f},"
                   f"volume='{BED_VOL}*{vol_expr}':eval=frame[bed]")
    labels = "".join(f"[e{k}]" for k in range(nb)) + "[bed]"
    filters.append(f"{labels}amix=inputs={nb + 1}:normalize=0:duration=longest,apad,atrim=0:{total:.3f},"
                   f"loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
    audio = f"{TMP}/audio.m4a"
    script = f"{TMP}/audio-filter.txt"
    with open(script, "w") as fh:
        fh.write(";\n".join(filters))
    run(["ffmpeg", "-loglevel", "error", "-y"] + inputs + ["-filter_complex_script", script, "-map", "[aout]",
                                                           "-ar", str(SR), "-c:a", "aac", "-b:a", "192k", audio])

    # 4) Unión final.
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", video, "-i", audio, "-map", "0:v", "-map", "1:a",
         "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "copy",
         "-shortest", "-movflags", "+faststart", OUT])
    print(f"TOTAL {total / 60:.2f} min, {len(parts)} planos -> {OUT}")


if __name__ == "__main__":
    main()
