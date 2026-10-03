import React from 'react';
import {AbsoluteFill, Freeze, OffthreadVideo, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {colors, effects, fonts, lowerThird, roles, timing, type, type RoleKey} from '../theme';
import type {Beat, Chip, Edl} from '../edl';
import {Brackets, Glass, colorOf, easeOut, inP, mono, outP, panelStyle, typed, withCaret} from './ui';

// ------------------------------------------------------------------ lower-third (brand §6.5)
export const LowerThird: React.FC<{lt: NonNullable<Beat['lowerThird']>; durFrames: number}> = ({lt, durFrames}) => {
  const frame = useCurrentFrame();
  const accent = colorOf(lt.color);
  const p = inP(frame, 0, timing.panelIn) * outP(frame, durFrames, timing.panelOut);
  const item = (i: number) => panelStyle(inP(frame, 4 + i * timing.stagger, timing.panelIn), 'x');
  return (
    <Glass style={{left: lowerThird.x, bottom: lowerThird.bottom, width: lowerThird.width, padding: '24px 28px 24px 40px', ...panelStyle(p, 'x')}}>
      <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: lowerThird.accentBar, background: accent, boxShadow: `0 0 14px ${accent}`}} />
      <div style={{...mono(lowerThird.kickerSize, accent, '0.3em'), ...item(0)}}>{lt.kicker}</div>
      <div
        style={{
          fontFamily: fonts.display, fontWeight: 600, fontSize: lowerThird.nameSize, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: '#FFFFFF', textShadow: effects.textGlow, marginTop: 8, lineHeight: 1.1, ...item(1),
        }}
      >
        {lt.name}
      </div>
      {lt.sub && <div style={{...mono(20, colors.mist, '0.16em'), marginTop: 8, ...item(2)}}>{lt.sub}</div>}
    </Glass>
  );
};

// ------------------------------------------------------------------ chips + kickers
const ChipView: React.FC<{chip: Chip; frame: number; durFrames: number}> = ({chip, frame, durFrames}) => {
  const c = colorOf(chip.color);
  const f = frame - chip.atFrame;
  if (f < 0) return null;
  const p = inP(f, 0, timing.panelIn) * outP(frame, durFrames, 5);
  if (chip.kicker) {
    return (
      <div style={{...mono(type.kicker.size, c, '0.3em'), opacity: p, textShadow: effects.textGlow, display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: 40 * p, height: 1, background: c}} />
        {withCaret(chip.text, frame)}
      </div>
    );
  }
  const scale = interpolate(f, [0, 8], [0.92, 1], {easing: easeOut, extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        ...mono(22, c, '0.18em'), opacity: p, transform: `scale(${scale})`, transformOrigin: 'left center',
        padding: '10px 18px', border: `1px solid ${c}`, background: 'rgba(5,8,18,0.82)', boxShadow: `0 0 16px ${c}55`,
        alignSelf: 'flex-start',
      }}
    >
      {withCaret(chip.text, frame, c)}
    </div>
  );
};

export const Chips: React.FC<{chips: Chip[]; durFrames: number}> = ({chips, durFrames}) => {
  const frame = useCurrentFrame();
  if (!chips.length) return null;
  return (
    <div style={{position: 'absolute', left: 130, top: 96, display: 'flex', flexDirection: 'column', gap: 14}}>
      {chips.map((c, i) => (
        <ChipView key={i} chip={{...c, atFrame: c.atFrame + (c.atFrame === 0 ? i * 6 : 0)}} frame={frame} durFrames={durFrames} />
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ target-bracket callout (brand §6.7)
// The rough cut has no per-shot target coordinates yet, so the brackets close on the centre of frame.
export const Callout: React.FC = () => {
  const frame = useCurrentFrame();
  const p = inP(frame, 6, 9);
  const w = interpolate(p, [0, 1], [1100, 760]);
  const h = interpolate(p, [0, 1], [560, 300]);
  return (
    <div style={{position: 'absolute', left: (1920 - w) / 2, top: (1000 - h) / 2, width: w, height: h, opacity: p * 0.95}}>
      <Brackets len={34} stroke={3} color={colors.holoHi} />
    </div>
  );
};

// ------------------------------------------------------------------ glitch accent (brand §6.6)
export const Glitch: React.FC<{at: number}> = ({at}) => {
  const frame = useCurrentFrame();
  const f = frame - at;
  if (f < 0 || f > 24) return null;
  const vignette = interpolate(f, [0, 4, 24], [0.9, 0.9, 0], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {f < timing.glitchCut &&
        [0.18, 0.42, 0.63, 0.8].map((y, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: 0, right: 0, top: `${y * 100}%`, height: 26 + i * 6,
              background: `linear-gradient(90deg, ${colors.threat}55, transparent 30%, transparent 70%, ${colors.holo}55)`,
              transform: `translateX(${(i % 2 ? 6 : -6) * (f % 2 ? 1 : -1)}px)`, mixBlendMode: 'screen',
            }}
          />
        ))}
      <AbsoluteFill style={{boxShadow: `inset 0 0 180px ${colors.threat}`, opacity: vignette * 0.55}} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ narration placeholder
export const NarrationTag: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const blink = Math.floor(frame / 24) % 2 === 0 ? 1 : 0.25; // 1.6 s period, well under 3 Hz
  const progress = frame / beat.durFrames;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
      <div style={{...mono(20, colors.amber, '0.2em'), padding: '8px 14px', border: `1px solid ${colors.amber}`, background: 'rgba(5,8,18,0.85)', boxShadow: effects.amberGlow}}>
        <span style={{opacity: blink}}>▮</span> NARRATION TODO // B{String(beat.n).padStart(2, '0')} // {beat.durSec.toFixed(1)}S
      </div>
      <div style={{width: 300, height: 3, background: 'rgba(0,0,0,0.55)', border: `1px solid ${colors.amberDim}`}}>
        <div style={{width: `${progress * 100}%`, height: '100%', background: colors.amber}} />
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ roster panel (chapter 3)
export const Roster: React.FC<{roster: Edl['roster']}> = ({roster}) => {
  const frame = useCurrentFrame(); // relative to roster.startFrame
  const dur = roster.endFrame - roster.startFrame;
  const p = inP(frame, 0, timing.panelIn) * outP(frame, dur, timing.panelOut);
  return (
    <Glass style={{right: 110, top: 80, width: 560, padding: '22px 26px', ...panelStyle(p)}}>
      <div style={{...mono(18, colors.holo, '0.3em'), marginBottom: 14}}>
        <span style={{opacity: Math.floor(frame / 24) % 2 ? 0.3 : 1}}>▮</span> AGENT ROSTER // PHASE 3
      </div>
      {roster.rows.map((r) => {
        const f = frame - (r.atFrame - roster.startFrame);
        if (f < 0) return null;
        const role = roles[r.role as RoleKey];
        return (
          <div key={r.n} style={{display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0', ...panelStyle(inP(f, 0, timing.panelIn), 'x')}}>
            <div style={{width: 6, height: 30, background: role.color, boxShadow: `0 0 10px ${role.color}`}} />
            <div style={mono(18, role.color, '0.16em')}>{r.n}</div>
            <div style={{fontFamily: fonts.display, fontWeight: 600, fontSize: 28, letterSpacing: '0.12em', color: '#FFFFFF'}}>{r.title}</div>
            {r.name && <div style={{...mono(16, colors.mist, '0.16em'), marginLeft: 'auto'}}>{r.name}</div>}
          </div>
        );
      })}
    </Glass>
  );
};

// ------------------------------------------------------------------ beat-specific graphics
export const Extra: React.FC<{beat: Beat; mediaRes: number}> = ({beat, mediaRes}) => {
  const frame = useCurrentFrame();
  const x = beat.extra!;
  const end = beat.durFrames;

  if (x.type === 'typeKicker') {
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center'}}>
        <div style={{...mono(30, colors.holo, '0.3em'), padding: '14px 28px', background: 'rgba(5,8,18,0.8)', textShadow: effects.textGlow, opacity: outP(frame, end, 5)}}>
          {withCaret(typed(x.text!, frame, 6, 1.2), frame)}
        </div>
      </div>
    );
  }

  if (x.type === 'nameChips') {
    return (
      <div style={{position: 'absolute', left: 130, top: 96, display: 'flex', gap: 14}}>
        {x.names!.map((n, i) => {
          const f = frame - (x.atFrames?.[i] ?? i * 30);
          if (f < 0) return null;
          return (
            <div key={n} style={{...mono(24, colors.holo, '0.2em'), padding: '10px 18px', border: `1px solid ${colors.holoDim}`, background: 'rgba(5,8,18,0.85)', opacity: inP(f, 0, 6)}}>
              {n}
            </div>
          );
        })}
      </div>
    );
  }

  if (x.type === 'banner') {
    const c = colorOf(x.color);
    const p = inP(frame, 4, timing.bannerBlurIn * 3);
    return (
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: 200, opacity: outP(frame, end, timing.panelOut)}}>
        <div style={{background: 'rgba(5,8,18,0.6)', padding: '20px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div
            style={{
              fontFamily: fonts.display, fontWeight: 600, fontSize: 46, color: c, textShadow: `0 0 24px ${c}AA`,
              letterSpacing: `${0.6 - 0.36 * p}em`, filter: `blur(${(1 - p) * 6}px)`, opacity: inP(frame, 4, 9),
            }}
          >
            {x.text}
          </div>
          <div style={{marginTop: 14, width: 640, height: 1, background: c, transform: `scaleX(${inP(frame, 8, timing.lineDraw)})`}} />
        </div>
      </AbsoluteFill>
    );
  }

  if (x.type === 'counter') {
    const v = interpolate(frame, [6, 36], [0, x.value!], {easing: easeOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const p = inP(frame, 0, timing.panelIn) * outP(frame, end, timing.panelOut);
    return (
      <Glass style={{left: 120, top: 90, padding: '24px 36px', ...panelStyle(p)}}>
        <div style={{fontFamily: fonts.mono, fontStyle: 'italic', fontWeight: 500, fontSize: 84, color: '#FFFFFF', textShadow: effects.textGlow, fontVariantNumeric: 'tabular-nums'}}>
          ${v.toFixed(2)}
        </div>
        <div style={{...mono(18, colors.mist, '0.16em'), marginTop: 8}}>{x.label}</div>
      </Glass>
    );
  }

  if (x.type === 'branches') {
    // `main` splits into one cyan branch line per agent
    const agents = ['CEDAR // CORE ENGINE', 'DUNE // STAGES', 'FERN // HUD', 'RENDERER & VFX'];
    const draw = inP(frame, 8, 30);
    return (
      <Glass style={{right: 110, top: 90, width: 720, height: 380, padding: 28}}>
        <svg width={664} height={260} style={{position: 'absolute', left: 28, top: 30}}>
          <line x1={0} y1={130} x2={150 * Math.min(1, draw * 2)} y2={130} stroke={colors.holo} strokeWidth={3} />
          {agents.map((a, i) => {
            const y = 25 + i * 70;
            const p = interpolate(draw, [0.3 + i * 0.1, 0.7 + i * 0.1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            return (
              <g key={a} opacity={p}>
                <path d={`M150 130 C 220 130, 220 ${y}, 300 ${y} L ${300 + 110 * p} ${y}`} stroke={colors.holo} strokeWidth={2} fill="none" />
                <circle cx={300 + 110 * p} cy={y} r={5} fill={colors.holoHi} />
                <text x={428} y={y + 6} fill={colors.text} fontFamily={fonts.mono} fontSize={17} letterSpacing="0.1em">{a}</text>
              </g>
            );
          })}
          <text x={0} y={118} fill={colors.holoHi} fontFamily={fonts.mono} fontSize={20} letterSpacing="0.2em">MAIN</text>
        </svg>
        <div style={{position: 'absolute', left: 28, bottom: 24, ...mono(20, colors.holo, '0.2em'), opacity: inP(frame, 40, 10)}}>{x.label}</div>
      </Glass>
    );
  }

  if (x.type === 'harborMeter') {
    // Illustration beat: a still of Harbor's card (from clip 4, beat 56's source) in a glass panel + a coral meter.
    const fill = interpolate(frame, [10, end - 10], [0.05, 0.92], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const ghost = interpolate(frame, [37, end + 17], [0.05, 0.92], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    const p = inP(frame, 0, timing.panelIn);
    const w = 860;
    return (
      <Glass style={{left: (1920 - w) / 2, top: 110, width: w, padding: 28, ...panelStyle(p)}}>
        <div style={{...mono(18, colors.threat, '0.3em'), marginBottom: 16}}>▮ AGENT 07/07 // QA</div>
        <div style={{width: w - 56, height: ((w - 56) * 9) / 16, overflow: 'hidden', position: 'relative', border: `1px solid ${colors.holoFaint}`}}>
          <Freeze frame={60}>
            <OffthreadVideo muted src={staticFile(`media/${mediaRes}/b056_0.mp4`)} style={{width: '100%', height: '100%'}} />
          </Freeze>
        </div>
        <div style={{marginTop: 22, height: 10, background: 'rgba(0,0,0,0.55)', border: `1px solid ${colors.holoFaint}`, position: 'relative'}}>
          <div style={{position: 'absolute', inset: 0, width: `${ghost * 100}%`, background: `${colors.threat}44`}} />
          <div style={{position: 'absolute', inset: 0, width: `${fill * 100}%`, background: `linear-gradient(90deg, #B8364A, ${colors.threat})`, boxShadow: `0 0 12px ${colors.threat}AA`}} />
        </div>
        <div style={{...mono(20, colors.threat, '0.2em'), marginTop: 14}}>{withCaret(x.status!, frame)}</div>
      </Glass>
    );
  }
  return null;
};
