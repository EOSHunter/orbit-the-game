import React from 'react';
import {Easing, interpolate} from 'remotion';
import {colors, ease, effects, fonts, roles, spacing, timing, type} from '../theme';
import type {ColorKey} from '../edl';

export const colorOf = (k: ColorKey | string | undefined): string =>
  ({
    holo: colors.holo,
    amber: colors.amber,
    prey: colors.prey,
    threat: colors.threat,
    violet: colors.violet,
    renderer: roles.renderer.color,
    simulation: roles.simulation.color,
    white: '#FFFFFF',
  })[k as ColorKey] ?? colors.holo;

export const easeOut = Easing.bezier(...ease.out);
export const easeIn = Easing.bezier(...ease.in);
export const easeInOut = Easing.bezier(...ease.inOut);
export const easePop = Easing.bezier(...ease.pop);

/** 0→1 over `dur` frames starting at `at`, eased out. */
export const inP = (frame: number, at = 0, dur: number = timing.panelIn, easing = easeOut) =>
  interpolate(frame, [at, at + dur], [0, 1], {easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
/** 1→0 over the last `dur` frames before `end`. */
export const outP = (frame: number, end: number, dur: number = timing.panelOut) =>
  interpolate(frame, [end - dur, end], [1, 0], {easing: easeIn, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** Panel in: fade + 12 px slide (brand §6.2). */
export const panelStyle = (p: number, axis: 'x' | 'y' = 'y'): React.CSSProperties => ({
  opacity: p,
  transform: axis === 'y' ? `translateY(${(1 - p) * 12}px)` : `translateX(${(1 - p) * -12}px)`,
});

export const Brackets: React.FC<{color?: string; len?: number; stroke?: number; inset?: number}> = ({
  color = colors.holo,
  len = spacing.bracketLen,
  stroke = spacing.bracketStroke,
  inset = 0,
}) => {
  const base: React.CSSProperties = {position: 'absolute', width: len, height: len, filter: `drop-shadow(0 0 3px ${colors.holoGlow})`};
  const b = `${stroke}px solid ${color}`;
  return (
    <>
      <div style={{...base, left: inset, top: inset, borderLeft: b, borderTop: b}} />
      <div style={{...base, right: inset, top: inset, borderRight: b, borderTop: b}} />
      <div style={{...base, left: inset, bottom: inset, borderLeft: b, borderBottom: b}} />
      <div style={{...base, right: inset, bottom: inset, borderRight: b, borderBottom: b}} />
    </>
  );
};

export const Glass: React.FC<{style?: React.CSSProperties; children?: React.ReactNode; brackets?: boolean}> = ({
  style,
  children,
  brackets = true,
}) => (
  <div style={{position: 'absolute', ...effects.panel, ...style}}>
    {brackets && <Brackets />}
    {children}
  </div>
);

export const mono = (size: number = type.kicker.size, color: string = colors.holo, tracking: string = type.kicker.tracking): React.CSSProperties => ({
  fontFamily: fonts.mono,
  fontWeight: 500,
  fontSize: size,
  letterSpacing: tracking,
  textTransform: 'uppercase',
  color,
  whiteSpace: 'nowrap',
});

/** Blinking caret, 1 s period, steps(2). Text ending in `_` gets the caret instead of a literal underscore. */
export const Caret: React.FC<{frame: number; color?: string}> = ({frame, color}) => (
  <span style={{opacity: Math.floor(frame / timing.caretBlink) % 2 === 0 ? 1 : 0, color}}>_</span>
);

export const withCaret = (text: string, frame: number, color?: string) =>
  text.endsWith('_') ? (
    <>
      {text.slice(0, -1)}
      <Caret frame={frame} color={color} />
    </>
  ) : (
    text
  );

/** Typed-on text: one character per frame from `at`. */
export const typed = (text: string, frame: number, at = 0, perChar = 1) =>
  text.slice(0, Math.max(0, Math.floor((frame - at) / perChar)));
