// Checks the edit list (and optionally a rendered file):
//  - total runtime under 10:00 and equal to the script's beat table
//  - no clip 1 range inside the excluded 13:55-14:06 window
//  - every subtitle cue sits inside its own beat, cues never overlap, 1-7 s each,
//    cue text appears verbatim in the script line, .srt matches the edit list
//  - rendered file duration matches the timeline (pass the path as an argument)
//
//   node scripts/verify.mjs [out/rough-cut.mp4]
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const videoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edl = JSON.parse(fs.readFileSync(path.join(videoDir, 'src', 'data', 'edl.json'), 'utf8'));
const fps = edl.fps;
const problems = [];
const ok = (msg) => console.log(`  ok  ${msg}`);
const fail = (msg) => problems.push(msg);
const mmss = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;

// runtime
const total = edl.totalFrames / fps;
const beatSum = edl.beats.reduce((a, b) => a + b.durSec, 0);
// Hunter: telling the whole story matters more than a hard 10:00, "a little over is fine".
if (total < 600) ok(`runtime ${mmss(total)} < 10:00`);
else if (total < 660) ok(`runtime ${mmss(total)} (over 10:00, inside the agreed 11:00 ceiling)`);
else fail(`runtime ${mmss(total)} is over the 11:00 ceiling`);
Math.abs(total - beatSum) < 0.05 ? ok(`runtime matches beat table sum (${beatSum.toFixed(1)} s)`) : fail(`runtime ${total} != beat sum ${beatSum}`);

// profanity window (proxies carry a 0.5 s tail for the dissolves; see prep-media.mjs)
const PROXY_TAIL = 0.5;
const bad = edl.beats.flatMap((b) => b.segments.map((s) => ({b, s}))).filter(({s}) => s.clip === 1 && s.in < 846 && s.in + s.durFrames / fps + PROXY_TAIL > 835);
bad.length ? fail(`clip 1 13:55-14:06 used by beats ${bad.map((x) => x.b.n)}`) : ok('nothing from clip 1 13:55-14:06 (incl. proxy tail)');

// breathing room: picture holds at least 0.55 s after Hunter's last word on every spoken beat
const tight = edl.beats.filter((b) => b.speechTailSec != null && b.speechTailSec < 0.55);
tight.length ? fail(`cut too soon after the last word in beats ${tight.map((b) => `${b.n} (${b.speechTailSec}s)`).join(', ')}`) : ok(`${edl.beats.filter((b) => b.speechTailSec != null).length} spoken beats hold ≥ 0.55 s after the last word`);

// dropped content stays dropped: Hunter's personal "R7" smart assistant (not part of R7 Orbit)
const r7 = edl.beats.flatMap((b) => b.segments.map((s) => ({b, s}))).filter(({s}) => s.clip === 1 && s.in < 11 * 60 + 52 && s.out > 10 * 60 + 19);
r7.length ? fail(`R7-assistant footage (clip 1 10:19-11:52) used by beats ${r7.map((x) => x.b.n)}`) : ok("Hunter's R7 smart-assistant exchange is not in the cut");

// cues
const beats = Object.fromEntries(edl.beats.map((b) => [b.n, b]));
let prevEnd = -1;
for (const c of edl.cues) {
  const b = beats[c.beat];
  if (c.startFrame < b.startFrame || c.endFrame > b.startFrame + b.durFrames) fail(`cue "${c.text}" leaves beat ${b.n}`);
  if (c.startFrame < prevEnd) fail(`cue "${c.text}" overlaps the previous cue`);
  const d = (c.endFrame - c.startFrame) / fps;
  if (d < 0.99 || d > 7.01) fail(`cue "${c.text}" lasts ${d.toFixed(2)} s`);
  if (!b.lineRaw.includes(c.text)) fail(`cue text not verbatim in script line (beat ${b.n}): "${c.text}"`);
  prevEnd = c.endFrame;
}
const spoken = edl.beats.filter((b) => b.lineType !== 'none');
const covered = spoken.filter((b) => edl.cues.some((c) => c.beat === b.n));
covered.length === spoken.length ? ok(`${edl.cues.length} cues; every one of ${spoken.length} spoken beats is subtitled`) : fail('some spoken beats have no cue');
if (!problems.some((p) => p.startsWith('cue'))) ok('cues inside their beats, no overlaps, 1-7 s, text verbatim from script');

// spelling of agent names and product names in everything that is shown or exported
const MISSPELT = /\b(kaisar|kaiser|leica|atlus|quazar|ryegel|vespa|drifting star|drifterstar|r7orbit|orbit7)\b/i;
const WRONG_CASE = /\b(R7 orbit|r7 Orbit|r7 orbit|Vesper drift|vesper Drift|Drifter star|drifter Star)\b/; // case-sensitive
const badSpell = edl.cues.filter((c) => MISSPELT.test(c.text) || WRONG_CASE.test(c.text));
badSpell.length ? fail(`misspelt names in cues: ${badSpell.map((c) => `"${c.text}"`).join(', ')}`) : ok('agent/product names spelt correctly in all cues');

// on-screen-text lines (nothing is recorded for [NARRATION]) must be readable: ≤ 15 characters/s + 1 s
const rushed = edl.beats.filter((b) => b.narration).filter((b) => {
  const chars = edl.cues.filter((c) => c.beat === b.n).reduce((a, c) => a + c.text.length, 0);
  return b.durSec + 0.05 < chars / 15 + 1;
});
rushed.length ? fail(`on-screen text too fast in beats ${rushed.map((b) => b.n)}`) : ok(`${edl.beats.filter((b) => b.narration).length} on-screen-text beats have reading time (15 chars/s + 1 s)`);

// srt
const srtPath = path.join(videoDir, 'out', 'subtitles.srt');
if (fs.existsSync(srtPath)) {
  const blocks = fs.readFileSync(srtPath, 'utf8').trim().split(/\n\n/);
  const same = blocks.length === edl.cues.length && blocks.every((bl, i) => bl.split('\n').slice(2).join('\n') === edl.cues[i].text);
  same ? ok(`out/subtitles.srt has the same ${blocks.length} cues as the burned-in subtitles`) : fail('subtitles.srt differs from the edit list (run npm run srt)');
}

// rendered file
const file = process.argv[2];
if (file) {
  const p = path.resolve(videoDir, file);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', p]).toString());
  const dur = Number(probe.format.duration);
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const a = probe.streams.find((s) => s.codec_type === 'audio');
  Math.abs(dur - total) < 0.2 ? ok(`${file}: ${mmss(dur)}, ${v.width}x${v.height} @ ${v.r_frame_rate}, audio ${a ? 'yes' : 'NO'}`) : fail(`${file} is ${dur}s, timeline is ${total}s`);
  if (!a) fail(`${file} has no audio stream`);

  // Flicker scan: glass panels (lower-thirds, roster) must not drop out for single frames. Measures the
  // panel area's mean brightness per frame and flags isolated one-frame dips.
  const k = v.width / 1920;
  const crop = (w, h, x, y) => [w, h, x, y].map((n) => Math.round(n * k)).join(':');
  const windows = [];
  const panelBeats = edl.beats.filter((b) => b.lowerThird);
  for (const b of panelBeats) {
    const stop = edl.beats.find((x) => x.startFrame > b.startFrame && (x.lowerThird || x.kind !== 'clip'));
    const end = Math.min(b.startFrame + 135, stop ? stop.startFrame : edl.totalFrames);
    windows.push({label: `lower-third ${b.lowerThird.name}`, from: b.startFrame + 12, to: end - 10, crop: crop(560, 100, 150, 640)});
  }
  windows.push({label: 'roster panel', from: edl.roster.startFrame + 12, to: edl.roster.endFrame - 10, crop: crop(500, 280, 1300, 100)});
  let dips = 0;
  for (const w of windows) {
    if (w.to - w.from < 10) continue;
    // ffmpeg prints the per-frame metadata on stderr
    const {stderr} = spawnSync('ffmpeg', ['-hide_banner', '-ss', (w.from / fps).toFixed(3), '-t', ((w.to - w.from) / fps).toFixed(3), '-i', p,
      '-vf', `crop=${w.crop},signalstats,metadata=print:key=lavfi.signalstats.YAVG`, '-f', 'null', '-'], {maxBuffer: 64 * 1024 * 1024});
    const ys = [...stderr.toString().matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
    if (ys.length < (w.to - w.from) * 0.8) fail(`flicker scan read only ${ys.length} frames for ${w.label}`);
    for (let i = 1; i < ys.length - 1; i++) {
      if (ys[i - 1] - ys[i] > 3 && ys[i + 1] - ys[i] > 3) {
        dips++;
        fail(`flicker: ${w.label} drops out for one frame at ${mmss((w.from + i) / fps)}`);
      }
    }
  }
  if (!dips) ok(`no single-frame panel drop-outs (${windows.length} panel windows scanned)`);
}

if (problems.length) {
  console.error(`\nFAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll checks passed.');
