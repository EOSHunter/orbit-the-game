V="C:/Users/hunte/R7 Orbit Projects/orbit-the-game/docs/video"
cd "C:/Users/hunte/R7 Orbit Projects/orbit-the-game.orbit/footage-analyst-0f893a"
for n in 1 2 3 4 5 6 7 8 9 10 11; do
 ffmpeg -hide_banner -nostats -y -i "$V/$n.mp4" -vf "select='gt(scene,0.25)',showinfo,scale=640:-2" -fps_mode vfr -q:v 6 -frames:v 40 docs/video/analysis/frames/$n/scene_%03d.jpg 2> .scratch/scene_$n.log
 echo done $n
done
