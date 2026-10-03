V="C:/Users/hunte/R7 Orbit Projects/orbit-the-game/docs/video"
cd "C:/Users/hunte/R7 Orbit Projects/orbit-the-game.orbit/footage-analyst-0f893a"
for n in 1 2 3 4 5 6 7 8 9 10 11; do
 mkdir -p docs/video/analysis/frames/$n
 # every 10s, 640px wide, timestamp encoded in filename (seconds)
 ffmpeg -hide_banner -loglevel error -y -i "$V/$n.mp4" -vf "fps=1/10,scale=640:-2" -q:v 6 -start_number 0 docs/video/analysis/frames/$n/tmp_%05d.jpg
 for f in docs/video/analysis/frames/$n/tmp_*.jpg; do i=${f##*tmp_}; i=${i%.jpg}; s=$((10#$i*10)); mv "$f" "$(dirname $f)/$(printf 't%05d' $s).jpg"; done
 echo done $n
done
