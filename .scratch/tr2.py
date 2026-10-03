import os,json,glob,site,wave,numpy as np
sp=site.getsitepackages()[1]
for d in glob.glob(sp+"/nvidia/*/bin"): os.add_dll_directory(d); os.environ["PATH"]=d+os.pathsep+os.environ["PATH"]
from faster_whisper import WhisperModel
W=".scratch";O="docs/video/analysis/transcripts"
m=WhisperModel("medium",device="cuda",compute_type="float16")
def rd(p): 
    w=wave.open(p);return np.frombuffer(w.readframes(10**10),np.int16).astype(np.float32)/32768
def run(path,tag,n):
    segs,_=m.transcribe(path,word_timestamps=True,vad_filter=True,language="en",condition_on_previous_text=False)
    out=[{"start":round(s.start,2),"end":round(s.end,2),"text":s.text.strip(),"no_speech_prob":round(s.no_speech_prob,3),"avg_logprob":round(s.avg_logprob,3),
     "words":[{"w":w.word,"start":round(w.start,2),"end":round(w.end,2),"p":round(w.probability,2)} for w in s.words]} for s in segs]
    json.dump(out,open(f"{W}/{n}_{tag}.json","w"));return out
for n in range(1,12):
    a=rd(f"{W}/{n}_t0.wav");b=rd(f"{W}/{n}_t2.wav");L=min(len(a),len(b));a=a[:L];b=b[:L]
    k=float((a*b).sum()/(b*b).sum())
    res=a-k*b
    # also per-second system energy
    import scipy.io.wavfile as wf
    wf.write(f"{W}/{n}_sys.wav",16000,(np.clip(res,-1,1)*32767).astype(np.int16))
    mic=run(f"{W}/{n}_t2.wav","mic",n);sy=run(f"{W}/{n}_sys.wav","sys",n)
    print(n,"k",round(k,3),"mic segs",len(mic),"sys segs",len(sy),flush=True)
