import os,sys,json,subprocess,glob,site,time
sp=site.getsitepackages()[1]
for d in glob.glob(sp+"/nvidia/*/bin"): os.add_dll_directory(d); os.environ["PATH"]=d+os.pathsep+os.environ["PATH"]
from faster_whisper import WhisperModel
VID="C:/Users/hunte/R7 Orbit Projects/orbit-the-game/docs/video"
OUT="C:/Users/hunte/R7 Orbit Projects/orbit-the-game.orbit/footage-analyst-0f893a/docs/video/analysis/transcripts"
W="C:/Users/hunte/R7 Orbit Projects/orbit-the-game.orbit/footage-analyst-0f893a/.scratch"
m=WhisperModel("medium",device="cuda",compute_type="float16")
def ts(t):
    h=int(t//3600);mi=int(t%3600//60);s=t%60
    return f"{h:02d}:{mi:02d}:{int(s):02d},{int(round((s-int(s))*1000)):03d}"
for n in range(1,12):
    if os.path.exists(f"{OUT}/{n}.json"): continue
    t0=time.time()
    for t in (0,2):
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",f"{VID}/{n}.mp4","-map",f"0:a:{t}","-ac","1","-ar","16000",f"{W}/{n}_t{t}.wav"],check=True)
    segs,info=m.transcribe(f"{W}/{n}_t0.wav",word_timestamps=True,vad_filter=True,language="en",condition_on_previous_text=False)
    out=[]
    for s in segs:
        out.append({"start":round(s.start,2),"end":round(s.end,2),"text":s.text.strip(),"avg_logprob":round(s.avg_logprob,3),"no_speech_prob":round(s.no_speech_prob,3),
          "words":[{"w":w.word,"start":round(w.start,2),"end":round(w.end,2),"p":round(w.probability,2)} for w in s.words]})
    json.dump({"clip":f"{n}.mp4","duration":info.duration,"model":"faster-whisper medium (audio track 0)","segments":out},open(f"{OUT}/{n}.json","w"),indent=1)
    with open(f"{OUT}/{n}.srt","w",encoding="utf-8") as f:
        for i,s in enumerate(out,1): f.write(f"{i}\n{ts(s['start'])} --> {ts(s['end'])}\n{s['text']}\n\n")
    print(n,len(out),"segs",round(time.time()-t0),"s",flush=True)
