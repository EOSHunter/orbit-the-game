// Cuts every beat's source range out of the original recordings into small H.264 proxies with the
// right audio mix, extracts the chapter music beds, and copies the brand-kit assets into public/.
// Nothing written here is committed (public/media, public/brand-kit are gitignored).
//
//   node scripts/prep-media.mjs --res 540     # rough cut proxies (960x540)
//   node scripts/prep-media.mjs --res 1080    # final
//   FOOTAGE_DIR=... to point at the folder holding 1.mp4 ... 11.mp4
//
// Audio streams in every recording: a:0 mix, a:1 system (game, Orbit dings/TTS), a:2 mic.
// Remotion can only play a file's default track, and its browser can't reliably decode HEVC,
// hence the proxies.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const videoDir = path.resolve(here, '..');
const repo = path.resolve(videoDir, '..');
const pub = path.join(videoDir, 'public');

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const res = Number(arg('res', '540'));
const force = process.argv.includes('--force');
const W = Math.round((res * 16) / 9);

const footageCandidates = [
  process.env.FOOTAGE_DIR,
  path.join(repo, 'docs', 'video'),
  'C:/Users/hunte/R7 Orbit Projects/orbit-the-game/docs/video',
].filter(Boolean);
const footage = footageCandidates.find((d) => fs.existsSync(path.join(d, '1.mp4')));
if (!footage) {
  console.error(`Source footage not found. Set FOOTAGE_DIR to the folder with 1.mp4 ... 11.mp4.\nTried:\n  ${footageCandidates.join('\n  ')}`);
  process.exit(1);
}
const src = (clip) => path.join(footage, `${clip}.mp4`);

const edl = JSON.parse(fs.readFileSync(path.join(videoDir, 'src', 'data', 'edl.json'), 'utf8'));
const FPS = edl.fps;

const run = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {stdio: ['ignore', 'inherit', 'pipe']});
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${args.join(' ')}\n${err}`))));
  });

const upToDate = (out, params) => {
  const side = `${out}.json`;
  if (force || !fs.existsSync(out) || !fs.existsSync(side)) return false;
  return fs.readFileSync(side, 'utf8') === JSON.stringify(params);
};
const stamp = (out, params) => fs.writeFileSync(`${out}.json`, JSON.stringify(params));

// ------------------------------------------------------------------ brand-kit assets
const kit = path.join(repo, 'docs', 'video', 'brand-kit', 'assets');
const kitOut = path.join(pub, 'brand-kit', 'assets');
for (const sub of ['fonts', 'backgrounds', 'ui']) {
  fs.cpSync(path.join(kit, sub), path.join(kitOut, sub), {recursive: true});
}
fs.mkdirSync(path.join(kitOut, 'logo'), {recursive: true});
for (const f of ['r7-orbit-mark-gold-transparent-2048.png', 'r7-orbit-mark-transparent.svg']) {
  fs.copyFileSync(path.join(kit, 'logo', f), path.join(kitOut, 'logo', f));
}

// ------------------------------------------------------------------ beat proxies
const mediaDir = path.join(pub, 'media', String(res));
fs.mkdirSync(mediaDir, {recursive: true});

const jobs = [];
for (const beat of edl.beats) {
  for (const s of beat.segments) {
    const out = path.join(mediaDir, s.file);
    // a little tail so the last frame never runs dry; never reaches the excluded clip-1 window
    const dur = s.durFrames / FPS + 0.1;
    const params = {res, clip: s.clip, in: s.in, dur, mic: s.mic, micFrom: s.micFrom ?? null, v: 3};
    if (upToDate(out, params)) continue;
    let af;
    if (s.mic) {
      const gate = s.micFrom != null ? `,volume='if(lt(t,${(s.micFrom - s.in).toFixed(3)}),0,1)':eval=frame` : '';
      af = `[0:a:1]volume=0.6[s];[0:a:2]volume=2.2${gate}[m];[s][m]amix=inputs=2:normalize=0:duration=first[a]`;
    } else {
      af = '[0:a:1]anull[a]';
    }
    jobs.push({
      label: `beat ${beat.n} seg ${s.file}`,
      out,
      params,
      args: [
        '-ss', s.in.toFixed(3), '-t', dur.toFixed(3), '-i', src(s.clip),
        '-filter_complex', `[0:v:0]fps=${FPS},scale=${W}:${res}:flags=bicubic,setsar=1[v];${af}`,
        '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-preset', res > 720 ? 'medium' : 'veryfast', '-crf', res > 720 ? '18' : '26',
        '-g', String(FPS), '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-movflags', '+faststart', out,
      ],
    });
  }
}

// ------------------------------------------------------------------ music beds (game audio, a:1 only)
const bedDir = path.join(pub, 'media', 'beds');
fs.mkdirSync(bedDir, {recursive: true});
const XF = 3; // crossfade seconds at each loop seam
const bedJobs = edl.beds.map((b) => {
  const out = path.join(bedDir, b.file);
  const need = b.durFrames / FPS + 1;
  const len = b.out - b.in;
  const params = {clip: b.clip, in: b.in, out: b.out, need, v: 1};
  return {b, out, need, len, params};
});

const runPool = async (list, n) => {
  let i = 0;
  let done = 0;
  const worker = async () => {
    while (i < list.length) {
      const job = list[i++];
      await job();
      done++;
      if (done % 10 === 0 || done === list.length) console.log(`  ${done}/${list.length}`);
    }
  };
  await Promise.all(Array.from({length: n}, worker));
};

console.log(`Footage: ${footage}`);
console.log(`Proxies @${W}x${res}: ${jobs.length} to cut (${edl.beats.flatMap((b) => b.segments).length - jobs.length} up to date)`);
await runPool(
  jobs.map((j) => async () => {
    await run(j.args);
    stamp(j.out, j.params);
  }),
  Math.max(2, Math.min(6, Math.floor(os.cpus().length / 3))),
);

console.log(`Music beds: ${bedJobs.length}`);
for (const {b, out, need, len, params} of bedJobs) {
  if (upToDate(out, params)) continue;
  const raw = path.join(bedDir, `${b.id}.raw.wav`);
  await run(['-ss', String(b.in), '-t', String(len), '-i', src(b.clip), '-map', '0:a:1', '-ac', '2', '-ar', '48000', raw]);
  // loop with crossfades until the chapter span is covered
  const copies = Math.max(1, Math.ceil((need - XF) / (len - XF)));
  const inputs = Array.from({length: copies}, () => ['-i', raw]).flat();
  let fc = '';
  let last = '[0:a]';
  for (let k = 1; k < copies; k++) {
    const lbl = `[x${k}]`;
    fc += `${last}[${k}:a]acrossfade=d=${XF}:c1=qsin:c2=qsin${lbl};`;
    last = lbl;
  }
  fc += `${last}atrim=0:${need.toFixed(2)},afade=t=in:d=1.5[out]`;
  await run([...inputs, '-filter_complex', fc, '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', out]);
  fs.rmSync(raw);
  stamp(out, params);
}
console.log('Media ready.');
