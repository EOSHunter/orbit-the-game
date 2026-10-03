import json,wave,numpy as np,warnings
warnings.filterwarnings("ignore")
from resemblyzer import VoiceEncoder,preprocess_wav
W=".scratch";O="docs/video/analysis"
enc=VoiceEncoder()
def rd(p): 
    w=wave.open(p);return np.frombuffer(w.readframes(10**10),np.int16).astype(np.float32)/32768
def ts(t):
    return f"{int(t//3600):02d}:{int(t%3600//60):02d}:{int(t%60):02d},{int(round((t%1)*1000))%1000:03d}"
cre_emb=[];tts=[];spk={"creator":[],"agent_tts":[]};activity={}
for n in range(1,12):
    mic=json.load(open(f"{W}/{n}_mic.json"));sy=json.load(open(f"{W}/{n}_sys.json"))
    sysw=rd(f"{W}/{n}_sys.wav");micw=rd(f"{W}/{n}_t2.wav")
    segs=[]
    for s in mic:
        if s["no_speech_prob"]>0.8: continue
        # overlap with sys speech => creator voice still dominant on mic track (separate mic track)
        segs.append(dict(s,speaker="creator",conf=0.97 if s["avg_logprob"]>-0.7 else 0.9,source="mic track (audio stream 3)"))
        a=micw[int(s["start"]*16000):int(s["end"]*16000)]
        if s["end"]-s["start"]>1.5:
            try: cre_emb.append(enc.embed_utterance(preprocess_wav(a,source_sr=16000)))
            except Exception: pass
    for s in sy:
        if s["no_speech_prob"]>0.5 or s["text"].lower().startswith("boop"): continue
        a=sysw[int(s["start"]*16000):int(s["end"]*16000)]
        e=enc.embed_utterance(preprocess_wav(a,source_sr=16000)) if len(a)>8000 else None
        tts.append((n,s,e))
        segs.append(dict(s,speaker="agent_tts",conf=0.95,source="system-audio residual (stream 1 minus mic)"))
    segs.sort(key=lambda s:s["start"])
    d=json.load(open(f"{O}/transcripts/{n}.json"))
    json.dump({"clip":f"{n}.mp4","duration":d["duration"],"model":"faster-whisper medium; creator=mic track, agent_tts=system-audio residual","segments":segs},open(f"{O}/transcripts/{n}.json","w"),indent=1)
    with open(f"{O}/transcripts/{n}.srt","w",encoding="utf-8") as f:
        for i,s in enumerate(segs,1): f.write(f"{i}\n{ts(s['start'])} --> {ts(s['end'])}\n[{s['speaker']}] {s['text']}\n\n")
    # system-audio activity per second (non-speech sfx / music / dings)
    r=np.sqrt(np.array([ (sysw[i:i+16000]**2).mean() for i in range(0,len(sysw)-16000,16000)]))
    m=np.sqrt(np.array([ (micw[i:i+16000]**2).mean() for i in range(0,len(micw)-16000,16000)]))
    activity[n]={"sys_rms":[round(float(x),4) for x in r],"mic_rms":[round(float(x),4) for x in m]}
    spk["creator"].append((n,[(round(s["start"],1),round(s["end"],1),s["text"][:60]) for s in segs if s["speaker"]=="creator" and 3<s["end"]-s["start"]<9][:3]))
C=np.mean(cre_emb,0);C/=np.linalg.norm(C)
sims=[float(np.dot(e,C)/np.linalg.norm(e)) for _,_,e in tts if e is not None]
cs=[float(np.dot(e,C)/np.linalg.norm(e)) for e in cre_emb]
print("creator self-sim mean/min",np.mean(cs),np.min(cs));print("tts vs creator",sims)
json.dump(activity,open(f"{W}/activity.json","w"))
# pick samples
samples={"creator":[],"agent_tts":[(n,s["start"],s["end"],s["text"]) for n,s,_ in tts]}
import random;random.seed(1)
pool=[]
for n in (1,5,9):
    for s in json.load(open(f"{O}/transcripts/{n}.json"))["segments"]:
        if s["speaker"]=="creator" and 3<s["end"]-s["start"]<9: pool.append((n,s["start"],s["end"],s["text"]))
samples["creator"]=[pool[0],pool[len(pool)//2],pool[-1]]
json.dump({"creator_sims":{"mean":float(np.mean(cs)),"min":float(np.min(cs))},"tts_vs_creator_sims":sims,"samples":samples},open(f"{O}/speaker-samples.json","w"),indent=1)
print(samples)
