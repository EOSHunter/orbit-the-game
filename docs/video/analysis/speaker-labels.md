# Speaker labels (please verify the samples)

## How the labels were derived
Every clip has **3 audio streams** (all AAC 48 kHz stereo). Probing them showed:

| ffmpeg stream | Content | Evidence |
|---|---|---|
| `a:0` (stream 1) | **Mix** (mic + system audio) | = mic x 0.75 + system |
| `a:1` (stream 2) | **System / desktop audio only** (game sfx, music, Orbit dings, Orbit text-to-speech voices) | near-silent (2-6 kbps) in clips 1-7; correlation 0.9999 with (mix - 0.75 x mic) in clips 8 and 9 |
| `a:2` (stream 3) | **Microphone only** (the creator) | identical shape to the mix at a constant 0.75 gain |

So speaker separation is done by *source*, not by guesswork:
* **`creator`** = speech transcribed from the mic-only stream (`a:2`). Confidence ~0.95-0.99. Resemblyzer voice embeddings of all creator segments cluster as one voice (mean self-similarity 0.89).
* **`agent_tts`** = speech found in the system-audio residual (`a:0 - 0.75 x a:2`). These are Orbit's built-in text-to-speech announcements ("Atlas needs you", "Polaris is done"). Voice embedding similarity to the creator is only 0.51-0.58 (clearly a different voice). Confidence ~0.95.
* There is **no spoken agent dialogue** anywhere in the footage. Agents "speak" only as on-screen text, plus those short TTS announcements. The R7 assistant (blue robot bubble, clip 1 10:19-11:50) answers in text only; no audio.

## Samples per speaker label (all timestamps m:ss in the named clip)

### creator (confidence high)
| Clip | In | Out | Text |
|---|---|---|---|
| 1.mp4 | 0:04 | 0:11 | "okay welcome to r7 orbit, I'm not gonna explain what this is..." |
| 1.mp4 | 13:50 | 13:57 | "Merge it. Ay yi yi." |
| 9.mp4 | 12:09 | 12:12 | "there's no need for me to record this entire process" |

### agent_tts (Orbit text-to-speech voice, confidence high)
| Clip | In | Out | Text |
|---|---|---|---|
| 8.mp4 | 7:54 | 7:57 | "This is how I will read answers to you." (voice preview in settings; repeated at 8:05-8:08) |
| 9.mp4 | 2:17 | 2:19 | "Atlas needs you." (Whisper wrote "Atlus"; corrected to Atlas in the transcripts) |
| 10.mp4 | 1:57 | 1:59 | "Polaris is done." |

Other agent_tts lines: 9.mp4 10:21 "(Polaris) is done" (Whisper heard "This is done"), 11.mp4 2:50 "Rigel is done".
Raw machine-readable samples: `speaker-samples.json`. Every transcript segment in `transcripts/*.json` carries `speaker`, `conf` and `source`.

## Known transcription caveats
* Whisper "medium" is used. Misheard terms: "Sonic 5.5" / "Sonnet 55" = Sonnet 5.5; "Atlus" = Atlas (corrected in the transcripts); "Lark and Juno" are real agent names; "R7 orbit" is "R7 Orbit".
* Where game sound plays under the voice (clips 8-11), the mic stream is clean but short fragments may still be garbled (e.g. clip 9 1:21-1:50 sound-cue explanation).
* In `.srt` files each line is prefixed `[creator]` or `[agent_tts]`.
