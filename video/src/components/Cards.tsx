import React from 'react';
import {AbsoluteFill, Img, random, staticFile, useCurrentFrame} from 'remotion';
import {colors, effects, fonts, logo, stageTints, stages, timing, type} from '../theme';
import type {Beat} from '../edl';
import {StageBackdrop} from './Footage';
import {inP, mono, outP, typed, withCaret} from './ui';

const centre: React.CSSProperties = {alignItems: 'center', justifyContent: 'center', flexDirection: 'column'};

/** Banner choreography (brand §4): un-blur while tracking collapses. */
const bannerStyle = (frame: number, at: number, from: number, to: number): React.CSSProperties => {
  const p = inP(frame, at, timing.bannerBlurIn * 3);
  return {
    opacity: inP(frame, at, timing.bannerBlurIn),
    filter: `blur(${(1 - p) * 6}px)`,
    letterSpacing: `${from + (to - from) * p}em`,
  };
};

const Starfield: React.FC<{seed: string}> = ({seed}) => {
  const frame = useCurrentFrame();
  const layers = [
    {n: 90, size: 1.6, speed: 0.04, alpha: 0.5},
    {n: 50, size: 2.4, speed: 0.09, alpha: 0.7},
    {n: 18, size: 3.2, speed: 0.16, alpha: 0.85},
  ];
  return (
    <AbsoluteFill>
      {layers.flatMap((l, li) =>
        Array.from({length: l.n}, (_, i) => {
          const x = (random(`${seed}x${li}-${i}`) * 1920 + frame * l.speed * 10) % 1920;
          const y = random(`${seed}y${li}-${i}`) * 1080;
          const warm = random(`${seed}w${li}-${i}`) > 0.9;
          return (
            <div
              key={`${li}-${i}`}
              style={{position: 'absolute', left: x, top: y, width: l.size, height: l.size, borderRadius: '50%', background: warm ? '#FFBB81' : '#DCEBFF', opacity: l.alpha}}
            />
          );
        }),
      )}
    </AbsoluteFill>
  );
};

export const StillBeat: React.FC<{beat: Beat}> = ({beat}) => (
  <AbsoluteFill>
    <StageBackdrop file={beat.bg ?? 'bg-stage08-star-clean.png'} durFrames={beat.durFrames} />
    <Starfield seed={`still${beat.n}`} />
  </AbsoluteFill>
);

const Ladder: React.FC<{current: number; frame: number}> = ({current, frame}) => (
  <div style={{position: 'absolute', left: 0, right: 0, bottom: 110, display: 'flex', justifyContent: 'center', gap: 14, opacity: inP(frame, 12, 18)}}>
    {stages.map((s, i) => {
      const done = i < current;
      const cur = i === current;
      const p = cur ? inP(frame, 20, timing.lineDraw) : 1;
      return (
        <div key={s} style={{width: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
          <div style={{width: '100%', height: 3, background: 'rgba(92,225,255,0.12)', position: 'relative'}}>
            {(done || cur) && (
              <div
                style={{
                  position: 'absolute', inset: 0, transformOrigin: 'left', transform: `scaleX(${p})`,
                  background: cur ? colors.holoHi : 'rgba(92,225,255,0.6)', boxShadow: cur ? effects.glowStrong : undefined,
                }}
              />
            )}
          </div>
          <div style={{...mono(13, cur ? colors.holoHi : colors.mist, '0.12em'), opacity: cur ? 1 : 0.55}}>{cur ? s : ''}</div>
        </div>
      );
    })}
  </div>
);

export const ChapterCard: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const c = beat.chapterCard!;
  const [outer, inner] = stageTints[c.tint] ?? stageTints.meteorite;
  const fade = outP(frame, beat.durFrames, timing.panelOut);
  return (
    <AbsoluteFill style={{opacity: Math.min(inP(frame, 0, 8), 1)}}>
      <StageBackdrop file={beat.bg!} durFrames={beat.durFrames} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 50%, ${inner}, ${outer})`, opacity: 0.4}} />
      <AbsoluteFill style={{...centre, display: 'flex', opacity: fade}}>
        <div style={{...mono(type.kicker.size, colors.holo, '0.3em'), opacity: inP(frame, 0, 10), marginBottom: 28}}>{c.kicker}</div>
        <div
          style={{
            fontFamily: fonts.display, fontWeight: 600, fontSize: type.chapterTitle.size, color: colors.text, textTransform: 'uppercase',
            textShadow: effects.textGlow, textAlign: 'center', whiteSpace: 'nowrap',
            ...bannerStyle(frame, 4, 0.6, 0.24),
          }}
        >
          {c.title}
        </div>
        <div style={{marginTop: 30, width: 900, height: 1, background: colors.holo, boxShadow: effects.glow, transform: `scaleX(${inP(frame, 10, timing.lineDraw)})`}} />
      </AbsoluteFill>
      <div style={{opacity: fade}}>
        <Ladder current={c.ladder} frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

const Emblem: React.FC<{size: number; frame: number}> = ({size, frame}) => (
  <Img
    src={staticFile(`brand-kit/${logo.emblemSvg}`)}
    style={{width: size, height: size, opacity: inP(frame, 0, 18), transform: `rotate(${frame * 0.3}deg)`}}
  />
);

const GoldSignoff: React.FC<{frame: number; at: number; text: string}> = ({frame, at, text}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 22, opacity: inP(frame, at, 18)}}>
    <Img src={staticFile(`brand-kit/${logo.markGoldOnDark}`)} style={{width: 104, height: 104, objectFit: 'contain'}} />
    <div style={mono(20, colors.mist, '0.3em')}>{text}</div>
  </div>
);

export const TitleCard: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const t = beat.titleCard!;
  return (
    <AbsoluteFill style={{opacity: outP(frame, beat.durFrames, timing.crossfade)}}>
      <StageBackdrop file={beat.bg!} durFrames={beat.durFrames} />
      <Starfield seed="title" />
      <AbsoluteFill style={{...centre, display: 'flex', gap: 30}}>
        <Emblem size={150} frame={frame} />
        <div style={{...mono(22, colors.holo, '0.3em'), minHeight: 30}}>{withCaret(typed(t.status, frame, 12, 0.5), frame)}</div>
        <div
          style={{
            fontFamily: fonts.display, fontWeight: 600, fontSize: type.heading.size, color: colors.text, textTransform: 'uppercase', textShadow: effects.textGlow,
            textAlign: 'center', maxWidth: 1700, lineHeight: 1.2, textWrap: 'balance', ...bannerStyle(frame, 21, 0.4, 0.14),
          }}
        >
          {t.title}
        </div>
        <div style={{marginTop: 18}}>
          <GoldSignoff frame={frame} at={48} text="BUILT WITH R7 ORBIT" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const lines = beat.endCard!.lines;
  return (
    <AbsoluteFill style={{opacity: inP(frame, 0, timing.crossfade)}}>
      <StageBackdrop file={beat.bg!} durFrames={beat.durFrames} dim={0.5} />
      <Starfield seed="end" />
      {/* wordmark block on the left; the right half is kept clear for YouTube end-screen elements */}
      <div style={{position: 'absolute', left: 170, top: 210, display: 'flex', flexDirection: 'column', gap: 26}}>
        <Emblem size={120} frame={frame} />
        <div style={{fontFamily: fonts.display, fontWeight: 300, fontSize: 132, color: colors.text, textShadow: effects.textGlow, ...bannerStyle(frame, 10, 0.6, 0.42)}}>
          VESPER
        </div>
        <div
          style={{
            fontFamily: fonts.display, fontWeight: 600, fontSize: 60, marginTop: -20,
            background: `linear-gradient(90deg, ${colors.holo}, ${colors.holoHi})`, WebkitBackgroundClip: 'text', color: 'transparent',
            ...bannerStyle(frame, 16, 1.4, 1.1),
          }}
        >
          DRIFT
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 30}}>
          {lines.slice(1).map((l, i) => (
            <div key={l} style={{...mono(22, colors.mist, '0.3em'), opacity: inP(frame, 40 + i * 8, 14)}}>
              {l}
            </div>
          ))}
        </div>
        <div style={{marginTop: 24}}>
          <GoldSignoff frame={frame} at={70} text={lines[0]} />
        </div>
      </div>
      {/* rough-cut guides only: where YouTube's end-screen elements will sit */}
      {[
        {left: 1100, top: 230, w: 640, h: 360},
        {left: 1100, top: 640, w: 300, h: 300},
        {left: 1440, top: 640, w: 300, h: 300},
      ].map((r, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: r.left, top: r.top, width: r.w, height: r.h, border: `1px dashed ${colors.holoFaint}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono(14, 'rgba(134,163,191,0.5)', '0.2em'),
          }}
        >
          YT END SCREEN
        </div>
      ))}
    </AbsoluteFill>
  );
};

