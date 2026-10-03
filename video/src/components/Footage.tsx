import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {colors, effects} from '../theme';
import type {Beat} from '../edl';

// Every recording has a ~32 px title bar and a ~40 px Windows taskbar; crop both (script Gaps #13).
// Gameplay runs inside Orbit's browser pane, so full-bleed shots also lose the app/tab/URL bars (~135 px).
const CROP = {screen: {top: 32, bottom: 40}, full: {top: 135, bottom: 45}} as const;

/** Dimmed stage frame behind brand-asset cards (title, chapter, stills, end). Never used over footage. */
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

const Clip: React.FC<{src: string; width: number; cropTop: number}> = ({src, width, cropTop}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <OffthreadVideo
      src={src}
      style={{position: 'absolute', left: 0, top: -cropTop * (width / 1920), width, height: 1080 * (width / 1920)}}
    />
  </div>
);

/**
 * Footage is shown clean: full frame, nothing drawn over the picture itself (no scanlines, vignette,
 * glow, tint or push-ins). Only the title bar / taskbar (and, on gameplay, the browser chrome) are cropped.
 */
export const FootageBeat: React.FC<{beat: Beat; mediaRes: number}> = ({beat, mediaRes}) => {
  const crop = CROP[beat.layout];
  const visibleH = 1080 - crop.top - crop.bottom;
  const width = (1920 * 1080) / visibleH; // the cropped height fills the frame
  return (
    <AbsoluteFill style={{background: colors.voidDeep}}>
      <div style={{position: 'absolute', left: (1920 - width) / 2, top: 0, width, height: 1080, overflow: 'hidden'}}>
        {beat.segments.map((s) => (
          <Sequence key={s.file} from={s.offsetFrame} durationInFrames={s.durFrames} layout="none">
            <Clip src={staticFile(`media/${mediaRes}/${s.file}`)} width={width} cropTop={crop.top} />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};
