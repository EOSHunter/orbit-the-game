// Parses docs/video/script/script.md (the beat table is the edit decision list) plus the word-level
// transcripts into a single edit list: src/data/edl.json. Also writes NARRATION-TODO.md.
//
//   node scripts/build-edl.mjs
//
// Subtitle text is copied verbatim from the script's "Hunter's line" column; transcripts are only
// used to time the cues.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as ov from './edl-overrides.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.resolve(here, '..');
const repo = path.resolve(videoDir, '..');
const docs = path.join(repo, 'docs', 'video');
const FPS = 30;
const PROFANITY = {clip: 1, from: 13 * 60 + 55, to: 14 * 60 + 6};

const md = fs.readFileSync(path.join(docs, 'script', 'script.md'), 'utf8');

// ------------------------------------------------------------------ helpers
const tc = (s) => {
  const [m, rest] = s.split(':');
  return Number(m) * 60 + Number(rest);
};
const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};
const f = (sec) => Math.round(sec * FPS);
const norm = (w) => w.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]/g, '');
const COLORS = {
  cyan: 'holo', amber: 'amber', mint: 'prey', coral: 'threat', violet: 'violet',
  magenta: 'renderer', white: 'white', 'ice blue': 'simulation',
};
const colorIn = (s, fallback = 'holo') => {
  const m = s.toLowerCase().match(/\b(ice blue|cyan|amber|mint|coral|violet|magenta|white)\b/);
  return m ? COLORS[m[1]] : fallback;
};

// ------------------------------------------------------------------ title + chapters
const title = (md.match(/\*\*On-screen title:\*\*\s*(.+)/) || [])[1]?.trim();
const chapterRows = [...md.matchAll(/^\|\s*(\d)\s*\|\s*([^|]+?)\s*\|\s*(\d+:\d\d)\s*\|\s*(\d+:\d\d)\s*\|\s*(\d+:\d\d)\s*\|$/gm)];
const chapterNames = Object.fromEntries(chapterRows.map((m) => [Number(m[1]), m[2]]));

// ------------------------------------------------------------------ beat table
const tableStart = md.indexOf('## Beat table');
const tableEnd = md.indexOf('\n## ', tableStart + 5);
const rows = md
  .slice(tableStart, tableEnd)
  .split('\n')
  .filter((l) => /^\|\s*\d+\s*\|/.test(l));

const splitRow = (line) => {
  // Split on cell pipes; none of the cells contain " | ".
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(' | ').map((c) => c.trim());
  if (cells.length !== 9) throw new Error(`Row has ${cells.length} cells: ${line.slice(0, 80)}`);
  return cells;
};

// ------------------------------------------------------------------ transcripts
const transcripts = {};
const words = (clip) => {
  if (!transcripts[clip]) {
    const j = JSON.parse(fs.readFileSync(path.join(docs, 'analysis', 'transcripts', `${clip}.json`), 'utf8'));
    transcripts[clip] = j.segments.flatMap((s) =>
      (s.words || []).map((w) => ({w: w.w.trim(), n: norm(w.w), start: w.start, end: w.end, speaker: s.speaker})),
    );
  }
  return transcripts[clip];
};

// ------------------------------------------------------------------ lines
const parseLine = (raw) => {
  if (/^\(none\)/.test(raw)) return {type: 'none', items: []};
  const type = raw.includes('[NARRATION]') ? 'narration' : raw.includes('[AGENT TTS') ? 'tts' : 'real';
  const items = [];
  // drop editorial asides like (adapted from "Last, ...", see Gaps #2) before taking the quoted lines
  for (const m of raw.replace(/\([^)]*\)/g, '').matchAll(/(\*?)"([^"]+)"\*?/g)) {
    items.push({text: m[2], speaker: m[1] === '*' ? 'orbit' : 'creator'});
  }
  if (!items.length) throw new Error(`No quoted line in: ${raw}`);
  return {type, items, readingOrbit: raw.includes('(reading Orbit)')};
};

/** Split a line into subtitle chunks (≤ 2 × 42 chars), at sentences, then clauses, then words. */
const MAX = 84;
const splitLong = (s) => {
  if (s.length <= MAX) return [s];
  const mid = s.length / 2;
  // index of the space to split on, for: sentence ends, clause punctuation, conjunctions, any space
  const kinds = [/[.?!]+ /g, /[,:;] /g, / (?=(and|but|so|because|until|then|or|which|even|with|that|where|while|if) )/g, / /g];
  for (const [i, re] of kinds.entries()) {
    const spaces = [...s.matchAll(re)]
      .map((m) => m.index + m[0].length - 1)
      .filter((c) => c > 8 && c < s.length - 8);
    if (!spaces.length) continue;
    const best = spaces.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    // accept a sentence/clause break only if it is not wildly off-centre
    if (Math.abs(best - mid) < s.length * 0.3 || i === kinds.length - 1) {
      return [...splitLong(s.slice(0, best)), ...splitLong(s.slice(best + 1))];
    }
  }
  return [s];
};
const chunkText = (text) => {
  // sentence units
  const units = [];
  let cur = '';
  for (const tok of text.split(' ')) {
    cur = cur ? `${cur} ${tok}` : tok;
    if (/[.?!]$|\.\.\.$/.test(tok)) {
      units.push(cur);
      cur = '';
    }
  }
  if (cur) units.push(cur);
  const pieces = units.flatMap(splitLong);
  // greedy merge of short neighbours
  const out = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    if (last && last.length + 1 + p.length <= 60) out[out.length - 1] = `${last} ${p}`;
    else out.push(p);
  }
  if (out.join(' ') !== text) throw new Error(`chunking changed text: ${text}`);
  return out;
};

// ------------------------------------------------------------------ build beats
const beats = [];
let cumSec = 0;
const narrationTodo = [];
const warnings = [];

for (const line of rows) {
  const [nS, chS, startS, durS, source, onScreen, lineRaw, overlay] = splitRow(line);
  const n = Number(nS);
  const chapter = Number(chS);
  const dur = Number(durS.replace('s', ''));
  const beat = {
    n, chapter, scriptStart: startS, durSec: dur, onScreen, lineRaw, overlayRaw: overlay,
    startSec: Number(cumSec.toFixed(3)),
    startFrame: f(cumSec),
    durFrames: f(cumSec + dur) - f(cumSec),
    segments: [], chips: [],
  };

  // ---- source
  if (source.startsWith('asset:')) {
    const assets = [...source.matchAll(/`([^`]+)`/g)].map((m) => m[1]).join(' ');
    const bg = (assets.match(/backgrounds\/([\w-]+\.png)/) || [])[1];
    beat.bg = bg ? `brand-kit/assets/backgrounds/${bg}` : null;
    if (/Title card/i.test(onScreen)) beat.kind = 'title';
    else if (/End card/i.test(onScreen)) beat.kind = 'end';
    else if (/Chapter card/i.test(onScreen)) beat.kind = 'chapter';
    else beat.kind = 'still';
  } else {
    beat.kind = 'clip';
    let segSum = 0;
    const parts = source.split(' + ');
    let off = 0;
    parts.forEach((p, i) => {
      const m = p.match(/clip (\d+) (\d+:\d\d(?:\.\d)?)-(\d+:\d\d(?:\.\d)?)/);
      if (!m) throw new Error(`Bad source in beat ${n}: ${p}`);
      const clip = Number(m[1]);
      const inS = tc(m[2]);
      const outS = tc(m[3]);
      const d = Number((outS - inS).toFixed(3));
      segSum += d;
      if (clip === PROFANITY.clip && inS < PROFANITY.to && outS > PROFANITY.from) {
        throw new Error(`Beat ${n} touches the excluded clip 1 ${fmt(PROFANITY.from)}-${fmt(PROFANITY.to)} window`);
      }
      const segStart = f(beat.startSec + off) - beat.startFrame;
      const segEnd = i === parts.length - 1 ? beat.durFrames : f(beat.startSec + off + d) - beat.startFrame;
      beat.segments.push({
        clip, in: inS, out: outS, offsetSec: Number(off.toFixed(3)),
        offsetFrame: segStart, durFrames: segEnd - segStart,
        file: `b${String(n).padStart(3, '0')}_${i}.mp4`,
      });
      off += d;
    });
    if (Math.abs(segSum - dur) > 0.051) warnings.push(`Beat ${n}: sources sum ${segSum.toFixed(2)}s, table says ${dur}s`);
  }

  // ---- line
  const line_ = parseLine(lineRaw);
  beat.lineType = line_.type;
  beat.items = line_.items;
  beat.narration = line_.type === 'narration';

  // ---- audio routing (script "Audio streams")
  const mutedByTable = /mic muted/i.test(onScreen) || /Audio: game sound only/i.test(onScreen) || /Game sound only/i.test(onScreen);
  for (const s of beat.segments) {
    const speaks = line_.items.some((it) => it.speaker === 'creator') && line_.type !== 'narration';
    s.mic = speaks && !(mutedByTable && !ov.audio[n]?.micFrom);
    if (ov.audio[n]?.micFrom) {
      s.mic = true;
      s.micFrom = ov.audio[n].micFrom;
    }
    s.sys = true; // a:1 is always kept (near-silent on clips 1-7)
  }
  beat.nativeGameAudio = beat.segments.some((s) => s.clip >= 8);

  // ---- layout
  beat.layout = ov.fullBleed.has(n) ? 'full' : 'panel';
  beat.push = ov.push[n] || 0;

  // ---- overlay column
  const lt = overlay.match(/Lower-third \(([^)]+)\):\s*`([^`]+)`\s*\/\s*\*\*([^*]+)\*\*(?:\s*\(([^)]+)\))?/);
  if (lt) {
    const kicker = lt[2];
    const roleCode = (kicker.match(/\/\/\s*(\w+)$/) || [])[1];
    beat.lowerThird = {color: colorIn(lt[1]), kicker, name: lt[3], sub: lt[4] ? lt[4].toUpperCase() : null, roleCode};
  }
  if (beat.kind === 'chapter') {
    const k = overlay.match(/Kicker `([^`]+)`; title \*\*([^*]+)\*\*/);
    const tint = (onScreen.match(/stageTints\.(\w+)/) || [])[1];
    beat.chapterCard = {kicker: k[1], title: k[2], tint, ladder: chapter === 7 ? 11 : chapter - 1};
  }
  if (beat.kind === 'title') {
    beat.titleCard = {
      title: (overlay.match(/\*\*([^*]+)\*\*/) || [])[1],
      status: (overlay.match(/status `([^`]+)`/) || [])[1],
    };
  }
  if (beat.kind === 'end') beat.endCard = {lines: [...overlay.matchAll(/`([^`]+)`/g)].map((m) => m[1])};

  beat.callout = /bracket/i.test(overlay) || /Target brackets/i.test(onScreen);
  beat.glitch = /glitch/i.test(overlay);
  beat.extra = ov.extras[n] || null;
  // chips are only taken from free-form overlay notes; notes about the subtitle style
  // ("Agent subtitle (italic, `◆ ORBIT`)", "Two stacked cues") describe the Subtitles component instead
  const aboutSubtitles = /subtitle|stacked cues/i.test(overlay);
  if (!lt && !aboutSubtitles && !['chapter', 'title', 'end'].includes(beat.kind) && !beat.extra && !/^Roster/.test(overlay)) {
    for (const clause of overlay.split(/;\s*/)) {
      for (const m of clause.matchAll(/`([^`]+)`/g)) {
        const isKicker = /^Kicker/i.test(clause) || /Mono kicker/i.test(clause);
        beat.chips.push({text: m[1], color: isKicker ? 'holo' : colorIn(clause.split('`')[0]), kicker: isKicker, mono: true, atFrame: 0});
      }
    }
  }
  if (beat.extra?.type === 'banner' || beat.extra?.type === 'typeKicker') beat.chips = [];

  // ---- bed level
  beat.bed = beat.nativeGameAudio ? 'off' : line_.items.length ? 'duck' : 'full';

  if (beat.narration) {
    const take = `narration/b${String(n).padStart(3, '0')}.wav`;
    beat.narrationTake = fs.existsSync(path.join(videoDir, 'public', take)) ? take : null;
    narrationTodo.push({n, start: beat.startSec, dur, text: line_.items.map((i) => i.text).join(' '), picture: onScreen});
  }

  beats.push(beat);
  cumSec += dur;
}

// ------------------------------------------------------------------ subtitle cues
const timelineWords = (beat) => {
  const pool = [];
  for (const s of beat.segments) {
    for (const w of words(s.clip)) {
      if (w.start >= s.in - 0.15 && w.end <= s.out + 0.35 && w.start < s.out) {
        const t0 = beat.startSec + s.offsetSec + (w.start - s.in);
        const t1 = beat.startSec + s.offsetSec + Math.min(w.end, s.out) - s.in;
        pool.push({...w, t0, t1});
      }
    }
  }
  return pool.sort((a, b) => a.t0 - b.t0);
};

const cues = [];
let alignedChunks = 0;
let totalRealChunks = 0;

for (const beat of beats) {
  if (!beat.items.length) continue;
  const bStart = beat.startSec;
  const bEnd = beat.startSec + beat.durSec;
  const chunks = beat.items.flatMap((it) => chunkText(it.text).map((text) => ({text, speaker: it.speaker})));

  const timed = beat.kind === 'clip' && beat.lineType !== 'narration';
  if (timed) {
    const pool = timelineWords(beat);
    let j = 0;
    for (const c of chunks) {
      const toks = c.text.split(' ').map(norm).filter(Boolean);
      const hits = [];
      for (const t of toks) {
        for (let k = j; k < Math.min(pool.length, j + 8); k++) {
          const p = pool[k].n;
          if (p && (p === t || (t.length >= 4 && p.length >= 4 && (p.startsWith(t) || t.startsWith(p))))) {
            hits.push(pool[k]);
            j = k + 1;
            break;
          }
        }
      }
      c.matched = hits.length;
      c.tokens = toks.length;
      if (hits.length) {
        c.s = hits[0].t0;
        c.e = hits[hits.length - 1].t1;
      }
    }
    // fill unaligned chunks proportionally between neighbours
    chunks.forEach((c, i) => {
      if (c.s !== undefined) return;
      const prevEnd = i > 0 && chunks[i - 1].e !== undefined ? chunks[i - 1].e : bStart;
      const next = chunks.slice(i + 1).find((x) => x.s !== undefined);
      const nextStart = next ? next.s : bEnd;
      c.s = prevEnd;
      c.e = Math.max(prevEnd + 0.8, nextStart);
    });
  } else {
    // narration / TTS / stills: spread over the beat by length
    const total = chunks.reduce((a, c) => a + c.text.length, 0);
    let t = bStart + 0.15;
    const span = beat.durSec - 0.3;
    for (const c of chunks) {
      c.s = t;
      c.e = t + (span * c.text.length) / total;
      t = c.e;
    }
  }

  // assemble boundaries
  chunks.forEach((c, i) => {
    c.start = Math.max(bStart, c.s - 0.12);
    c.end = Math.min(bEnd, c.e + 0.35);
  });
  chunks.forEach((c, i) => {
    const next = chunks[i + 1];
    if (next) {
      if (c.end > next.start || next.start - c.end < 0.6) c.end = Math.max(c.start + 0.3, next.start);
    } else if (bEnd - c.end < 0.6) c.end = bEnd;
    if (c.end - c.start > 7) c.end = c.start + 7;
    if (c.end - c.start < 1.0) {
      const limit = next ? next.start : bEnd;
      c.end = Math.min(limit, c.start + 1.0);
      if (c.end - c.start < 1.0) {
        const prev = chunks[i - 1];
        c.start = Math.max(prev ? prev.end : bStart, c.end - 1.0);
      }
    }
  });

  for (const c of chunks) {
    if (timed) {
      totalRealChunks++;
      if (c.matched / Math.max(1, c.tokens) >= 0.5) alignedChunks++;
      else warnings.push(`Beat ${beat.n}: weak word alignment for "${c.text}" (${c.matched}/${c.tokens})`);
    }
    if (c.end - c.start > 7.01) warnings.push(`Beat ${beat.n}: cue longer than 7 s: "${c.text}"`);
    cues.push({
      beat: beat.n,
      text: c.text,
      speaker: c.speaker,
      narration: beat.lineType === 'narration',
      start: Number(c.start.toFixed(3)),
      end: Number(c.end.toFixed(3)),
      startFrame: f(c.start),
      endFrame: f(c.end),
      aligned: timed ? c.matched / Math.max(1, c.tokens) : null,
    });
  }
}
// frame rounding can leave a 1 s cue at 29 frames; borrow from free space around it
cues.forEach((c, i) => {
  const beat = beats.find((b) => b.n === c.beat);
  const next = cues[i + 1];
  const prev = cues[i - 1];
  const sameNext = next && next.beat === c.beat;
  const samePrev = prev && prev.beat === c.beat;
  const maxEnd = sameNext ? next.endFrame - FPS : beat.startFrame + beat.durFrames;
  const minStart = samePrev ? prev.startFrame + FPS : beat.startFrame;
  while (c.endFrame - c.startFrame < FPS && c.endFrame < maxEnd) {
    c.endFrame++;
    if (sameNext && next.startFrame < c.endFrame) next.startFrame = c.endFrame;
  }
  while (c.endFrame - c.startFrame < FPS && c.startFrame > minStart) {
    c.startFrame--;
    if (samePrev && prev.endFrame > c.startFrame) prev.endFrame = c.startFrame;
  }
});
// speaker labels (brand §7): agents label on the first cue of a run; Hunter only when switching back
cues.forEach((c, i) => {
  const prev = cues[i - 1];
  c.showLabel = c.speaker === 'orbit' ? !prev || prev.speaker !== 'orbit' : !!prev && prev.speaker === 'orbit';
});

// ------------------------------------------------------------------ word-timed chips / extras
const wordFrame = (beat, word) => {
  const w = timelineWords(beat).find((x) => x.n === norm(word) || x.n.startsWith(norm(word)));
  return w ? f(w.t0) - beat.startFrame : 0;
};
for (const beat of beats) {
  if (ov.chipAtWord[beat.n]) for (const c of beat.chips) c.atFrame = wordFrame(beat, ov.chipAtWord[beat.n]);
  if (ov.chipFromEnd[beat.n]) for (const c of beat.chips) c.atFrame = beat.durFrames - f(ov.chipFromEnd[beat.n]);
  beat.glitchAt = beat.glitch && ov.glitchAtWord[beat.n] ? wordFrame(beat, ov.glitchAtWord[beat.n]) : 0;
  if (beat.extra?.atWords) {
    beat.extra.atFrames = beat.extra.atWords.map((w, i) => wordFrame(beat, w) || f(1 + i * 1.2));
  }
}

// ------------------------------------------------------------------ roster
const rosterRows = ov.roster.rows.map((r) => ({...r, atFrame: beats.find((b) => b.n === r.beat).startFrame}));
const rosterBeats = beats.filter((b) => ov.roster.showBeats.includes(b.n));
const roster = {
  startFrame: rosterBeats[0].startFrame,
  endFrame: rosterBeats[rosterBeats.length - 1].startFrame + rosterBeats[rosterBeats.length - 1].durFrames,
  rows: rosterRows,
};

// ------------------------------------------------------------------ chapters + beds
const chapters = [...new Set(beats.map((b) => b.chapter))].map((c) => {
  const bs = beats.filter((b) => b.chapter === c);
  const last = bs[bs.length - 1];
  return {n: c, name: chapterNames[c], startFrame: bs[0].startFrame, endFrame: last.startFrame + last.durFrames};
});
const beds = ov.beds.map((b) => {
  const cs = chapters.filter((c) => b.chapters.includes(c.n));
  return {
    ...b,
    file: `${b.id}.m4a`,
    startFrame: cs[0].startFrame,
    durFrames: cs[cs.length - 1].endFrame - cs[0].startFrame,
  };
});

const totalFrames = beats[beats.length - 1].startFrame + beats[beats.length - 1].durFrames;
const edl = {
  generatedFrom: 'docs/video/script/script.md',
  title,
  fps: FPS,
  width: 1920,
  height: 1080,
  totalFrames,
  totalSec: Number((totalFrames / FPS).toFixed(3)),
  chapters,
  beats,
  cues,
  roster,
  beds,
};
fs.mkdirSync(path.join(videoDir, 'src', 'data'), {recursive: true});
fs.writeFileSync(path.join(videoDir, 'src', 'data', 'edl.json'), JSON.stringify(edl, null, 1));

// ------------------------------------------------------------------ NARRATION-TODO.md
const todo = [
  '# Narration to record',
  '',
  'Generated by `npm run edl` from `docs/video/script/script.md`. Do not edit by hand.',
  '',
  `These ${narrationTodo.length} beats are marked \`[NARRATION]\` in the script. The lines are new, so they are not in any recording yet.`,
  'Hunter records them on their own mic (no AI voice). In the rough cut each one is a **silent gap**: the source clip\'s mic is muted and an amber',
  '`NARRATION TODO` tag sits top-right. The subtitle is already burned in, so it reads correctly once the audio is dropped in.',
  '',
  'Timecodes are positions in the cut. The duration is the slot length; aim to finish about 0.3 s before the slot ends.',
  '',
  '| Beat | Cut timecode | Slot | Line | Picture |',
  '|---|---|---|---|---|',
  ...narrationTodo.map((t) => `| ${t.n} | ${fmt(t.start)} | ${t.dur.toFixed(1)} s | "${t.text}" | ${t.picture.replace(/\|/g, '/')} |`),
  '',
  `**Total:** ${narrationTodo.length} lines, ${narrationTodo.reduce((a, t) => a + t.dur, 0).toFixed(1)} s.`,
  '',
  'To drop a take in: save it as `video/public/narration/bNNN.wav` (e.g. `b008.wav`), then run `npm run edl` and re-render. The take plays on that beat and the placeholder tag goes away.',
  '',
].join('\n');
fs.writeFileSync(path.join(videoDir, 'NARRATION-TODO.md'), todo);

console.log(`EDL: ${beats.length} beats, ${cues.length} cues, ${fmt(edl.totalSec)} (${edl.totalSec}s, ${totalFrames} frames)`);
console.log(`Narration beats: ${narrationTodo.length}; real-line chunks aligned to transcript words: ${alignedChunks}/${totalRealChunks}`);
if (warnings.length) console.log(`Warnings:\n  ${warnings.join('\n  ')}`);
