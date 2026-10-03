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
| 1 | `npm run edl` | Parses `script.md` + `docs/video/analysis/transcripts/*.json` → `src/data/edl.json` |
| 2 | `npm run prep` | ffmpeg: cuts each beat from the original recordings into small H.264 proxies with the right audio mix, extracts the music beds, copies brand-kit fonts/logos/backgrounds into `public/` |
| 3 | `npm run srt` | Writes `out/subtitles.srt` (the same cues as the burned-in subtitles) |
| 4 | `remotion render` | Renders the composition `VesperDrift` at `--scale=0.5` |
| 5 | `npm run verify` | Checks runtime < 10:00, the clip-1 profanity window, subtitle timing/text, agent-name spelling, reading time on on-screen text, the .srt, and the rendered file's duration |

Other commands:

- `npm run studio`: opens Remotion Studio (port 3918) to scrub the timeline. Run `npm run edl && npm run prep` first.
- `npm run render:final`: cuts 1080p proxies (`prep:1080`) and renders `out/final-1080p.mp4` at full 1920×1080.
- `npm run typecheck`

### Requirements

- Node 20+ and **ffmpeg/ffprobe on PATH**.
- The original recordings `1.mp4 … 11.mp4`. By default they're read in place from the main checkout
  (`C:/Users/hunte/R7 Orbit Projects/orbit-the-game/docs/video/`). Set `FOOTAGE_DIR` to read them from somewhere else.
  They're never copied into git. The proxies live in `public/media/` (gitignored).
- Renders pick a free port automatically (`scripts/render.mjs`); Remotion's default 3000 is often taken by the game's dev server.

## How it fits together

```
docs/video/script/script.md ─┐
docs/video/analysis/transcripts/*.json ─┤  scripts/build-edl.mjs  ──► src/data/edl.json ──► Remotion (src/)
scripts/edl-overrides.mjs ─┘
                                             │
recordings (1-11.mp4) ── scripts/prep-media.mjs ──► public/media/{540,1080}/bNNN_k.mp4, public/media/beds/*.m4a
docs/video/brand-kit/assets ─────────────────────► public/brand-kit/
docs/video/brand-kit/theme.ts ◄── imported directly by src/theme.ts (single source for colours, fonts, motion)
```

- **Beat → picture.** Gameplay beats are full-bleed and unframed (browser chrome and taskbar cropped). Screen recordings of Orbit sit in the bracketed frame over the chapter's dimmed stage background (brand §5, §6.7). **Nothing is drawn over the footage itself**: no scanlines, grain, vignette, tint or push-ins. `asset:` beats become the title card, chapter cards (stage background + `stageTints`, stage ladder, banner un-blur), illustration stills, or the end card.
- **Story order.** Chapters follow the order things happened: research → the first build team → merging, QA and version 1 (2D) → the Phase 3 specialists going 3D → the comeback (3D flop, cost, R7 Orbit upgrading itself, iterating) → the finished game. Beat IDs are kept from the original script; new beats have letter suffixes (`64a`, `70a`, …). Hunter's personal smart assistant "R7" (not part of R7 Orbit) is cut, and `verify` keeps it out.
- **Breathing room.** `build-edl.mjs` holds each spoken beat at least 0.6 s past Hunter's last word (from the word-level transcripts). If Hunter's next sentence starts inside that hold, the mic fades out 0.15 s after the line (`micUntil`), so it never leaks in.
- **Dissolves.** Footage beats dissolve into each other over 8 frames, and the "+" joins inside a beat over 4. The outgoing shot keeps playing (proxies carry a 0.5 s tail) under the incoming one, so the timeline and subtitles don't move. Chapter cards keep the scan-wipe.
- **Audio** (script "Audio streams"). Proxies are mixed from the source's separate streams: `a:2` mic (+6.8 dB) plus `a:1` system at 0.6 on real-line beats. On `[NARRATION]`, TTS and "mic muted" beats it's `a:1` only. Beat 90 keeps the mic muted until 1:54.0.
- **Music bed.** The game ships no audio files. Following the script's audio plan, each chapter's bed is lifted from the game's own sound (`a:1`) in clips 9-11 and looped with crossfades. Each bed is a clearly named `MUSIC BED …` sequence in Studio. It plays only under beats without their own game audio (clips 1-7 and cards), ducked about 18 dB under speech and up on silent beats. To use a proper stem later (e.g. rendered from `src/audio/demo.html`), change the bed's source in `edl-overrides.mjs › beds` or drop a file over `public/media/beds/<id>.m4a`.
- **Subtitles** (brand §7). The text comes verbatim from the script's "Hunter's line" column, split into ≤ 2-line cues at sentence/clause breaks. Cues on real lines are timed by aligning their words to the word-level transcripts. On-screen-text cues type on with a cursor that disappears once the line is complete. Hunter is white and upright. Orbit's TTS is italic and tinted, with a cyan bar and a `◆ ORBIT` label; `HUNTER` is labelled when the voice switches back. `out/subtitles.srt` has exactly the same cues.
- **Lower-thirds** hold 4.5 s across cuts (brand §6.5), with the role colour on the bar and white for Hunter. They widen from 640 px up to 900 px so long names stay on one line. The roster panel (chapter 5) builds row by row.
- **No flicker.** Glass panels don't use `backdrop-filter` (headless Chrome dropped them for single frames), and nothing blinks except the cursor while text is typing.

## On-screen text instead of narration

Nothing is recorded for the video, and there is no AI voiceover: R7 Orbit makes the whole thing from the existing footage.
The 19 `[NARRATION]` lines are shown as **on-screen text**. They sit in the subtitle box, typed on character by character with the
game's caret, and are in the .srt like every other line. Under them you hear only the clip's own system audio and the game
music bed, which comes up to full level because there's no speech. `build-edl.mjs` lengthens a beat whose line needs more time
to read (15 characters/s + 1 s). Its last source range simply runs on.

## The R7 Orbit reveal

The "made by R7 Orbit" message is kept for the **end card only**, as the payoff. After the VESPER / DRIFT wordmark lifts
away, the gold R7 Orbit mark arrives with *THIS VIDEO WAS MADE ENTIRELY BY R7 ORBIT* and *EDITED, SCRIPTED AND BUILT BY A
TEAM OF AI AGENTS IN R7 ORBIT*. The lines come from the script's beat 94 row.

## Known rough-cut limitations (for the next pass)

- **Zooms and callout targets are not placed yet.** The script asks for 150-200 % zooms on cards and chat. Bracket callouts currently close on the centre of the frame. Both need per-shot coordinates (add a `zoom`/`target` field per beat in `edl-overrides.mjs`).
- **Beat 57's Harbor "cut-out"** is a frozen full frame from clip 4, not a cropped card.
- The Orbit UI is small in the full-frame screen recordings; the zooms above are what fixes that.
- **No blur/crop pass yet** for account details on the Claude usage page (beat 70) or for taskbar notifications (script Gaps #11).
- The audio mix is rough: fixed gains, no loudness normalisation.

## Runtime

With the full story, breathing room and reading time the cut runs about **10:51**. Hunter agreed a little over 10:00 is
fine, so `verify` passes up to 11:00 (and says so when the cut is over 10:00). Trim reserve if needed: beat 54 (robot-workers
joke, 11 s), beat 70's Max-plan half (6 s), beat 26 (agent names, 8 s).
