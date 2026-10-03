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
import {execFileSync} from 'node:child_process';
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
total < 600 ? ok(`runtime ${mmss(total)} < 10:00`) : fail(`runtime ${mmss(total)} is not under 10:00`);
Math.abs(total - beatSum) < 0.05 ? ok(`runtime matches beat table sum (${beatSum.toFixed(1)} s)`) : fail(`runtime ${total} != beat sum ${beatSum}`);

// profanity window
const bad = edl.beats.flatMap((b) => b.segments.map((s) => ({b, s}))).filter(({s}) => s.clip === 1 && s.in < 846 && s.in + s.durFrames / fps + 0.1 > 835);
bad.length ? fail(`clip 1 13:55-14:06 used by beats ${bad.map((x) => x.b.n)}`) : ok('nothing from clip 1 13:55-14:06 (incl. proxy tail)');

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
}

if (problems.length) {
  console.error(`\nFAILED:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('\nAll checks passed.');
