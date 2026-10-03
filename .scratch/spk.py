import json,wave,numpy as np,re,warnings
warnings.filterwarnings("ignore")
from resemblyzer import VoiceEncoder,preprocess_wav
from sklearn.cluster import AgglomerativeClustering
W=".scratch";T="docs/video/analysis/transcripts"
enc=VoiceEncoder()
rows=[];embs=[]
for n in range(1,12):
    a=np.frombuffer(wave.open(f"{W}/{n}_t0.wav").readframes(10**10),np.int16).astype(np.float32)/32768
    b=np.frombuffer(wave.open(f"{W}/{n}_t2.wav").readframes(10**10),np.int16).astype(np.float32)/32768
    d=json.load(open(f"{T}/{n}.json"))
    # split long segments by words with gaps>1.5s into utterances
    for si,s in enumerate(d["segments"]):
        ws=s["words"]
        if not ws: continue
        groups=[[ws[0]]]
        for w in ws[1:]:
            if w["start"]-groups[-1][-1]["end"]>1.0: groups.append([w])
            else: groups[-1].append(w)
        for g in groups:
            st,en=g[0]["start"],g[-1]["end"]
            if en-st<0.8: continue
            sa=a[int(st*16000):int(en*16000)];sb=b[int(st*16000):int(en*16000)]
            ra=float(np.sqrt((sa**2).mean())+1e-9);rb=float(np.sqrt((sb**2).mean())+1e-9)
            try: e=enc.embed_utterance(preprocess_wav(sa,source_sr=16000))
            except Exception: continue
            rows.append(dict(clip=n,start=st,end=en,text="".join(x["w"] for x in g).strip(),ratio=ra/rb,rms=ra));embs.append(e)
E=np.array(embs)
np.save(f"{W}/embs.npy",E);json.dump(rows,open(f"{W}/rows.json","w"))
print(len(rows))
