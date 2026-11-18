#!/usr/bin/env bash
# Arma los 5 reels de la semana 1 (1080×1920, 30 fps, sin audio: la música en tendencia se agrega en la app).
# Uso: armar-reels.sh <clips> <capas> <grabacion.webm> <salida>   (la grabación la genera grabar-generador.js)
#   clips: noche.mp4 amanecer.mp4 sala.mp4 prensa.mp4 sala-tarde.png sala-noche.png (generados con IA en ElevenLabs)
#   capas: PNG de render-reels.js
set -euo pipefail
C=$1; K=$2; REC=$3; OUT=$4
F=$(cd "$(dirname "$0")/../../../app/public/fotos" && pwd)
T=$(mktemp -d); mkdir -p "$OUT"
ENC="-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -an"
# Fondo desenfocado + contenido centrado (para material que no es vertical)
CENTRO="split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=60:4[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30"

# Material 4:5 del letrero: arriba sin bordes (el cielo llega al borde) y abajo fundido a negro
ARRIBA="split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=60:4,eq=brightness=-0.3[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=0:0,setsar=1,fps=30"
# Foto 4:5 con acercamiento lento
foto45(){ ffmpeg -v error -y -loop 1 -t "$3" -i "$1" -filter_complex "scale=2160:-2,zoompan=z='1+0.0009*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1350:fps=30,$ARRIBA" $ENC "$2"; }
# Video 4:5
video45(){ ffmpeg -v error -y -i "$1" -filter_complex "$ARRIBA" $ENC "$2"; }
# Video o foto 16:9 recortado vertical con paneo horizontal (x0 → x0+vel·t)
paneo(){ local extra=(); [[ $1 == *.png || $1 == *.jpg ]] && extra=(-loop 1 -t "$3"); ffmpeg -v error -y "${extra[@]}" -i "$1" -t "$3" -vf "scale=-2:1920,crop=1080:1920:x='$4+$5*t':y=0,setsar=1,fps=30" $ENC "$2"; }
# Une segmentos con fundido de 0,5 s
unir(){ local out=$1; shift; local n=$# args=() f="" prev="0:v" off=0 i=1; for s in "$@"; do args+=(-i "$s"); done
  for ((i=1;i<n;i++)); do local d; d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "${@:$i:1}"); off=$(echo "$off+$d-0.5" | bc); f+="[$prev][$i:v]xfade=transition=fade:duration=0.5:offset=$off[x$i];"; prev="x$i"; done
  ffmpeg -v error -y "${args[@]}" -filter_complex "${f%;}" -map "[$prev]" $ENC "$out"; }
# Capas de texto: pares "capa.png desde hasta"; congela el último cuadro $3 segundos para el cierre
capas(){ local base=$1 out=$2 hold=$3; shift 3; local args=(-i "$base") f="[0:v]tpad=stop_mode=clone:stop_duration=$hold[v0]" prev=v0 i=1
  while (($#)); do args+=(-framerate 30 -loop 1 -i "$K/$1.png"); f+=";[$i:v]format=rgba,fade=t=in:st=$2:d=0.25:alpha=1[o$i];[$prev][o$i]overlay=0:0:shortest=1:enable='between(t,$2,$3)'[v$i]"; prev=v$i; i=$((i+1)); shift 3; done
  ffmpeg -v error -y "${args[@]}" -filter_complex "$f" -map "[$prev]" $ENC -movflags +faststart "$out"; }

echo "Lunes"
foto45 "$F/ia-letrero.jpg" $T/l1.mp4 3
foto45 "$F/ia-letrero-tarde.jpg" $T/l2.mp4 3
video45 "$C/noche.mp4" $T/l3.mp4
paneo "$C/sala.mp4" $T/l4.mp4 5 950 70
unir $T/lun.mp4 $T/l1.mp4 $T/l2.mp4 $T/l3.mp4 $T/l4.mp4
capas $T/lun.mp4 "$OUT/lun-reel-impulz-a-toda-hora.mp4" 2 \
  lun-hook 0 2.6  lun-c1 0.6 2.6  lun-c2 2.8 5.2  lun-c3 6.3 10  lun-c4 10 13  fin-impulz 13 99

echo "Martes"
ffmpeg -v error -y -i "$C/prensa.mp4" -i "$C/prensa.mp4" -filter_complex "[0:v][1:v]concat=n=2,setpts=PTS/0.65,$CENTRO" $ENC $T/m.mp4
capas $T/m.mp4 "$OUT/mar-reel-coach-3-errores-prensa.mp4" 3 \
  mar-hook 0 15.5  mar-okchip 0 15.5  mar-e1 2.5 6  mar-e2 6 9.5  mar-e3 9.5 13  mar-guarda 13 15.5  fin-coach 15.5 99

echo "Jueves"
ffmpeg -v error -y -ss 1 -to 21.6 -i "$REC" -vf "crop=432:768:0:0,scale=1080:1920:flags=lanczos,unsharp=5:5:0.8,setsar=1,fps=30" $ENC $T/j.mp4
capas $T/j.mp4 "$OUT/jue-reel-coach-generador-rutina.mp4" 3 \
  jue-intro 0 2.6  jue-p1 3.6 7  jue-p2 7 10  jue-p3 10 15  jue-p4 15 20.6  fin-coach 20.6 99

echo "Viernes"
video45 "$C/noche.mp4" $T/v1.mp4
video45 "$C/amanecer.mp4" $T/v2.mp4
paneo "$C/sala.mp4" $T/v3.mp4 4.5 1300 -70
unir $T/vie.mp4 $T/v1.mp4 $T/v2.mp4 $T/v3.mp4
capas $T/vie.mp4 "$OUT/vie-reel-impulz-abrimos-5am.mp4" 2.5 \
  vie-459 0 1.8  vie-500 1.8 4.6  vie-sol 4.8 9.3  vie-sala 9.5 13.2  fin-impulz 12.6 99

echo "Sábado"
paneo "$F/ia-sala.jpg" $T/s1.mp4 4.5 1000 60
paneo "$C/sala-tarde.png" $T/s2.mp4 4.5 1270 60
paneo "$C/sala-noche.png" $T/s3.mp4 4.5 1540 60
unir $T/sab.mp4 $T/s1.mp4 $T/s2.mp4 $T/s3.mp4
capas $T/sab.mp4 "$OUT/sab-reel-coach-mejor-hora.mp4" 3 \
  sab-hook 0 3.8  sab-r1 0.4 4  sab-r2 4 8  sab-r3 8 12.5  sab-resp 8.6 12.5  fin-coach 12.5 99

rm -rf "$T"; ls -la "$OUT"
