# Vesper Drift vlog: Remotion project

The video "Building a game with a team of AI agents", built with [Remotion](https://www.remotion.dev/).
Everything is driven by **one edit list**, `src/data/edl.json`, generated from the script's beat table
(`docs/video/script/script.md`). To re-cut the video, edit the script (or `scripts/edl-overrides.mjs`) and re-run.

## Quick start

```bash
cd video
npm install
npm run render:rough      # → out/rough-cut.mp4 (960×540, 30 fps) + out/subtitles.srt
```

`render:rough` runs these steps in order:

| Step | Command | What it does |
|---|---|---|
| 1 | `npm run edl` | Parses `script.md` + `docs/video/analysis/transcripts/*.json` → `src/data/edl.json` and `NARRATION-TODO.md` |
| 2 | `npm run prep` | ffmpeg: cuts each beat from the original recordings into small H.264 proxies with the right audio mix, extracts the music beds, copies brand-kit fonts/logos/backgrounds into `public/` |
| 3 | `npm run srt` | Writes `out/subtitles.srt` (the same cues as the burned-in subtitles) |
| 4 | `remotion render` | Renders the composition `VesperDrift` at `--scale=0.5` |
| 5 | `npm run verify` | Checks runtime < 10:00, the clip-1 profanity window, subtitle timing/text, the .srt, and the rendered file's duration |

Other commands:

- `npm run studio`: opens Remotion Studio (port 3918) to scrub the timeline. Run `npm run edl && npm run prep` first.
- `npm run render:final`: cuts 1080p proxies (`prep:1080`) and renders `out/final-1080p.mp4` at full 1920×1080.
- `npm run typecheck`

### Requirements

- Node 20+ and **ffmpeg/ffprobe on PATH**.
- The original recordings `1.mp4 … 11.mp4`. By default they're read in place from the main checkout
  (`C:/Users/hunte/R7 Orbit Projects/orbit-the-game/docs/video/`). Set `FOOTAGE_DIR` to read them from somewhere else.
  They're never copied into git. The proxies live in `public/media/` (gitignored).
- Remotion renders on port 3917. If that's taken, change `--port` in `package.json`. Port 3000 was avoided because the game's dev server often uses it.

## How it fits together

```
docs/video/script/script.md ─┐
docs/video/analysis/transcripts/*.json ─┤  scripts/build-edl.mjs  ──► src/data/edl.json ──► Remotion (src/)
scripts/edl-overrides.mjs ─┘          └─► NARRATION-TODO.md
                                             │
recordings (1-11.mp4) ── scripts/prep-media.mjs ──► public/media/{540,1080}/bNNN_k.mp4, public/media/beds/*.m4a
docs/video/brand-kit/assets ─────────────────────► public/brand-kit/
docs/video/brand-kit/theme.ts ◄── imported directly by src/theme.ts (single source for colours, fonts, motion)
```

- **Beat → picture.** `clip` beats play their proxy segment(s) back to back. Gameplay beats are full-bleed (browser chrome and taskbar cropped). Screen recordings of Orbit sit in a bracketed glass panel over the chapter's dimmed stage background (brand §5, §6.7). `asset:` beats become the title card, chapter cards (stage background + `stageTints`, stage ladder, banner un-blur), illustration stills, or the end card.
- **Audio** (script "Audio streams"). Proxies are mixed from the source's separate streams: `a:2` mic (+6.8 dB) plus `a:1` system at 0.6 on real-line beats. On `[NARRATION]`, TTS and "mic muted" beats it's `a:1` only. Beat 90 keeps the mic muted until 1:54.0.
- **Music bed.** The game ships no audio files. Following the script's audio plan, each chapter's bed is lifted from the game's own sound (`a:1`) in clips 9-11 and looped with crossfades. Each bed is a clearly named `MUSIC BED …` sequence in Studio. It plays only under beats without their own game audio (clips 1-7 and cards), ducked about 18 dB under speech and up on silent beats. To use a proper stem later (e.g. rendered from `src/audio/demo.html`), change the bed's source in `edl-overrides.mjs › beds` or drop a file over `public/media/beds/<id>.m4a`.
- **Subtitles** (brand §7). The text comes verbatim from the script's "Hunter's line" column, split into ≤ 2-line cues at sentence/clause breaks. Cues on real lines are timed by aligning their words to the word-level transcripts. Narration cues are spread across their beat. Hunter is white and upright. Orbit's TTS is italic and tinted, with a cyan bar and a `◆ ORBIT` label; `HUNTER` is labelled when the voice switches back. `out/subtitles.srt` has exactly the same cues.
- **Lower-thirds** hold 4.5 s across cuts (brand §6.5), with the role colour on the bar and white for Hunter. The chapter-3 roster panel builds row by row.

## Narration

The 19 `[NARRATION]` beats are silent gaps with an amber `NARRATION TODO // Bnn` tag and burned-in subtitles.
See **[NARRATION-TODO.md](./NARRATION-TODO.md)** for each line, slot length and cut timecode. To add a take, save
`public/narration/bNNN.wav`, then run `npm run edl` and re-render.

## Known rough-cut limitations (for the next pass)

- **Zooms and callout targets are not placed yet.** The script asks for 150-200 % zooms on cards and chat. Bracket callouts currently close on the centre of the frame. Both need per-shot coordinates (add a `zoom`/`target` field per beat in `edl-overrides.mjs`).
- **Beat 57's Harbor "cut-out"** is a frozen full frame from clip 4, not a cropped card.
- **No blur/crop pass yet** for account details on the Claude usage page (beat 70) or for taskbar notifications (script Gaps #11).
- **Transitions** are hard cuts, plus a scan-wipe into each chapter card. No crossfades yet, so the runtime equals the script's 8:03.
- The audio mix is rough: fixed gains, no loudness normalisation.
