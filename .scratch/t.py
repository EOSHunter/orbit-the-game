import time
from faster_whisper import WhisperModel
t=time.time()
m=WhisperModel("small",device="cpu",compute_type="int8",cpu_threads=16)
print("load",time.time()-t)
for f in ["t0.wav","t2.wav"]:
    segs,_=m.transcribe(f,vad_filter=True)
    print(f)
    for s in segs: print(round(s.start),s.text)
