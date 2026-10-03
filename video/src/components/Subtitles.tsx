import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {colors, subtitle} from '../theme';
import type {Cue} from '../edl';

// Orbit's text-to-speech is the studio's own voice, not one of the seven roles: it gets the agent
// style (italic, tinted text, ◆ label) with the instrument cyan as its colour (script beat 39).
const ORBIT = {label: 'ORBIT', color: colors.holo};

// [NARRATION] lines are never spoken: they're on-screen text in Hunter's words. They use the
// subtitle box (white bar, upright) but type on character by character with the game's caret,
// so they read as text the video is "writing", not as a transcript of speech.
const TYPE_CPS = 32;
const TypedText: React.FC<{text: string; frame: number}> = ({text, frame}) => {
  const shown = Math.min(text.length, Math.floor((frame * TYPE_CPS) / 30));
  const typing = shown < text.length;
  return (
    <>
      {text.slice(0, shown)}
      <span style={{color: colors.holoHi, opacity: typing || Math.floor(frame / 15) % 2 === 0 ? 1 : 0}}>▍</span>
      {/* the rest is laid out but invisible, so line breaks don't jump while typing */}
      <span style={{opacity: 0}}>{text.slice(shown)}</span>
    </>
  );
};

/** Burned-in subtitles (brand §7). Rendered at the composition root so cues can span beat cuts. */
export const Subtitles: React.FC<{cues: Cue[]}> = ({cues}) => {
  const frame = useCurrentFrame();
  const cue = cues.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!cue) return null;

  const agent = cue.speaker === 'orbit';
  const typed = cue.narration;
  const opacity = interpolate(
    frame,
    [cue.startFrame, cue.startFrame + subtitle.fadeInFrames, cue.endFrame - subtitle.fadeOutFrames, cue.endFrame],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const bar = agent ? ORBIT.color : subtitle.creator.bar;
  const label = agent ? `${subtitle.agent.prefix} ${ORBIT.label}` : subtitle.creator.label;
  const labelColor = agent ? ORBIT.color : subtitle.creator.labelColor;

  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: subtitle.bottom, display: 'flex', justifyContent: 'center', opacity}}>
      <div
        style={{
          position: 'relative',
          maxWidth: subtitle.maxWidth,
          background: subtitle.boxBackground,
          border: subtitle.boxBorder,
          borderRadius: subtitle.radius,
          padding: `${subtitle.paddingY}px ${subtitle.paddingX}px ${subtitle.paddingY}px ${subtitle.paddingX + subtitle.barWidth}px`,
          textAlign: subtitle.align,
        }}
      >
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: subtitle.barWidth, background: bar, boxShadow: agent ? `0 0 12px ${bar}` : undefined}} />
        {cue.showLabel && (
          <div
            style={{
              fontFamily: subtitle.label.font, fontSize: subtitle.label.size, letterSpacing: subtitle.label.tracking, fontWeight: subtitle.label.weight,
              color: labelColor, textTransform: 'uppercase', marginBottom: 6,
            }}
          >
            {label}
          </div>
        )}
        <div
          style={{
            fontFamily: subtitle.font,
            fontWeight: subtitle.fontWeight,
            fontSize: subtitle.fontSize,
            lineHeight: subtitle.lineHeight,
            letterSpacing: subtitle.letterSpacing,
            color: agent ? subtitle.agent.text : subtitle.creator.text,
            fontStyle: agent ? 'italic' : 'normal',
            textShadow: subtitle.textShadow,
            WebkitTextStroke: subtitle.textStroke,
            paintOrder: 'stroke fill',
            textWrap: 'balance',
          }}
        >
          {typed ? <TypedText text={cue.text} frame={frame - cue.startFrame} /> : cue.text}
        </div>
      </div>
    </div>
  );
};
