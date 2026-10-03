import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {colors, effects} from '../theme';
import type {Beat} from '../edl';
import {Brackets} from './ui';

// Every recording has a ~32 px title bar and a ~40 px Windows taskbar; crop both (script Gaps #13).
// Gameplay runs inside Orbit's browser pane, so full-bleed shots also lose the app/tab/URL bars (~135 px).
const CROP = {screen: {top: 32, bottom: 40}, full: {top: 135, bottom: 45}} as const;

/** Frames of dissolve between two footage beats, and between the "+" joins inside a beat. */
export const BEAT_DISSOLVE = 8;
const JOIN_DISSOLVE = 4;

/** Dimmed stage frame behind the framed screen recordings, one per chapter (follows the stage ladder). */
const chapterBg: Record<number, string> = {
  1: 'bg-stage01-asteroid-clean.png',
  2: 'bg-stage01-asteroid-clean.png',
  3: 'bg-stage04-rocky-lava-clean.png',
  4: 'bg-stage05-gas-giant-clean.png',
  5: 'bg-stage08-star-clean.png',
  6: 'bg-stage11-neutron-clean.png',
  7: 'bg-stage12-black-hole-clean.png',
};

/** Dimmed stage frame behind brand-asset cards and framed recordings. Never drawn over footage. */
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

/** One source range. Fades its picture and sound in, and its sound out while it runs on under the next shot. */
const Clip: React.FC<{src: string; width: number; cropTop: number; fadeIn: number; playFrames: number; tail: number}> = ({
  src,
  width,
  cropTop,
  fadeIn,
  playFrames,
  tail,
}) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn ? interpolate(frame, [0, fadeIn], [0, 1], {extrapolateRight: 'clamp'}) : 1;
  const volume = (f: number) =>
    Math.min(
      fadeIn ? interpolate(f, [0, fadeIn], [0, 1], {extrapolateRight: 'clamp'}) : 1,
      tail ? interpolate(f, [playFrames, playFrames + tail], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1,
    );
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', opacity}}>
      <OffthreadVideo
        src={src}
        volume={volume}
        style={{position: 'absolute', left: 0, top: -cropTop * (width / 1920), width, height: 1080 * (width / 1920)}}
      />
    </div>
  );
};

/**
 * A footage beat. Gameplay is full-bleed and unframed; screen recordings sit in the bracketed frame
 * over the chapter's dimmed stage background (brand §5, §6.7). Nothing is drawn over the picture
 * itself: no scanlines, grain, vignette, tint or push-ins.
 *
 * fadeIn: frames to dissolve in from the previous footage beat (0 = hard cut).
 * tail:   frames this beat keeps playing under the next beat's dissolve (0 = none).
 */
export const FootageBeat: React.FC<{beat: Beat; mediaRes: number; fadeIn: number; tail: number}> = ({beat, mediaRes, fadeIn, tail}) => {
  const frame = useCurrentFrame();
  const full = beat.layout === 'full';
  const crop = CROP[beat.layout];
  const visibleH = 1080 - crop.top - crop.bottom;
  // full-bleed: the cropped height fills the frame; framed: 1800 px wide inside the brackets
  const width = full ? (1920 * 1080) / visibleH : 1800;
  const box: React.CSSProperties = full
    ? {left: (1920 - width) / 2, top: 0, width, height: 1080}
    : {left: 60, top: 34, width, height: visibleH * (width / 1920)};
  const opacity = fadeIn ? interpolate(frame, [0, fadeIn], [0, 1], {extrapolateRight: 'clamp'}) : 1;

  return (
    <AbsoluteFill style={{opacity}}>
      {!full && <StageBackdrop file={chapterBg[beat.chapter]} dim={0.3} durFrames={beat.durFrames} />}
      <div style={{position: 'absolute', ...box, overflow: 'hidden', background: colors.voidDeep}}>
        {beat.segments.map((s, i) => {
          const last = i === beat.segments.length - 1;
          const runOn = last ? tail : JOIN_DISSOLVE;
          return (
            <Sequence key={s.file} from={s.offsetFrame} durationInFrames={s.durFrames + runOn} layout="none">
              <Clip
                src={staticFile(`media/${mediaRes}/${s.file}`)}
                width={width}
                cropTop={crop.top}
                fadeIn={i === 0 ? 0 : JOIN_DISSOLVE}
                playFrames={s.durFrames}
                tail={runOn}
              />
            </Sequence>
          );
        })}
      </div>
      {!full && (
        // the frame sits around the picture, not over it
        <div style={{position: 'absolute', ...box, border: `1px solid ${colors.holoDim}`, boxShadow: effects.glow, pointerEvents: 'none'}}>
          <Brackets inset={-6} />
        </div>
      )}
    </AbsoluteFill>
  );
};
