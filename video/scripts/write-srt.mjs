// Writes out/subtitles.srt from the edit list: same cues, same timing, same text as the burned-in
// subtitles (text exactly as in the script's "Hunter's line" column).
//
//   node scripts/write-srt.mjs [out/subtitles.srt]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const videoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edl = JSON.parse(fs.readFileSync(path.join(videoDir, 'src', 'data', 'edl.json'), 'utf8'));
const out = path.resolve(videoDir, process.argv[2] || 'out/subtitles.srt');

// Use frame boundaries so the .srt matches the burned-in cues exactly.
const ts = (frame) => {
  const ms = Math.round((frame / edl.fps) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};

const srt = edl.cues
  .map((c, i) => `${i + 1}\n${ts(c.startFrame)} --> ${ts(c.endFrame)}\n${c.text}\n`)
  .join('\n');
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, srt, 'utf8');
console.log(`Wrote ${edl.cues.length} cues to ${path.relative(videoDir, out)}`);
