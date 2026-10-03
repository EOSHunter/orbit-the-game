import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {colors, effects} from '../theme';
import type {Beat} from '../edl';
import {Brackets} from './ui';

// Every recording has a ~32 px title bar and a ~40 px Windows taskbar; crop both (script Gaps #13).
// Gameplay runs inside Orbit's browser pane, so full-bleed shots also lose the app/tab/URL bars (~135 px).
const CROP = {panel: {top: 32, bottom: 40}, full: {top: 135, bottom: 45}} as const;

/** Background behind panelled screen recordings: the chapter's stage frame, dimmed hard. */
export const chapterBg: Record<number, string> = {
  1: 'bg-stage01-asteroid-clean.png',
  2: 'bg-stage01-asteroid-clean.png',
  3: 'bg-stage04-rocky-lava-clean.png',
  4: 'bg-stage05-gas-giant-clean.png',
  5: 'bg-stage08-star-clean.png',
  6: 'bg-stage11-neutron-clean.png',
  7: 'bg-stage12-black-hole-clean.png',
};

export const StageBackdrop: React.FC<{file: string; dim?: number; drift?: boolean; durFrames?: number}> = ({
  file,
  dim = 0.55,
  drift = true,
  durFrames = 300,
}) => {
  const frame = useCurrentFrame();
  // scale 105%, slow 1.5% drift (brand §5)
  const s = 1.05 + (drift ? interpolate(frame, [0, Math.max(durFrames, 300)], [0, 0.015]) : 0);
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${colors.voidDeep}, ${colors.voidBlue})`}}>
      <Img
        src={staticFile(file.startsWith('brand-kit/') ? file : `brand-kit/assets/backgrounds/${file}`)}
        style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s})`, filter: `brightness(${dim})`}}
      />
      <AbsoluteFill style={{background: effects.vignette}} />
    </AbsoluteFill>
  );
};

const Clip: React.FC<{src: string; width: number; cropTop: number; push: number; durFrames: number}> = ({src, width, cropTop, push, durFrames}) => {
  const frame = useCurrentFrame();
  const scale = width / 1920;
  const p = push ? 1 + interpolate(frame, [0, durFrames], [0, push]) : 1;
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <OffthreadVideo
        src={src}
        style={{
          position: 'absolute',
          left: 0,
          top: -cropTop * scale,
          width,
          height: 1080 * scale,
          transform: `scale(${p})`,
          transformOrigin: '50% 45%',
        }}
      />
    </div>
  );
};

export const FootageBeat: React.FC<{beat: Beat; mediaRes: number}> = ({beat, mediaRes}) => {
  const full = beat.layout === 'full';
  const crop = CROP[beat.layout];
  const visibleH = 1080 - crop.top - crop.bottom;
  // full-bleed: scale so the cropped height fills 1080; panel: 1800 px wide inside brackets
  const width = full ? (1920 * 1080) / visibleH : 1800;
  const scale = width / 1920;
  const box: React.CSSProperties = full
    ? {left: (1920 - width) / 2, top: 0, width, height: 1080}
    : {left: 60, top: 34, width, height: visibleH * scale};

  const clips = beat.segments.map((s) => (
    <Sequence key={s.file} from={s.offsetFrame} durationInFrames={s.durFrames} layout="none">
      <Clip src={staticFile(`media/${mediaRes}/${s.file}`)} width={width} cropTop={crop.top} push={beat.push} durFrames={beat.durFrames} />
    </Sequence>
  ));

  return (
    <AbsoluteFill>
      {!full && <StageBackdrop file={chapterBg[beat.chapter]} dim={0.3} durFrames={beat.durFrames} />}
      <div style={{position: 'absolute', ...box, overflow: 'hidden', background: colors.voidDeep}}>{clips}</div>
      {!full && (
        <div style={{position: 'absolute', ...box, border: `1px solid ${colors.holoDim}`, boxShadow: effects.glow}}>
          <Brackets inset={-6} />
        </div>
      )}
    </AbsoluteFill>
  );
};
