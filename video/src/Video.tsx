import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {colors, effects, timing} from './theme';
import {edl, type Beat} from './edl';
import {FootageBeat} from './components/Footage';
import {ChapterCard, EndCard, StillBeat, TitleCard} from './components/Cards';
import {Callout, Chips, Extra, Glitch, LowerThird, NarrationTag, Roster} from './components/Overlays';
import {Subtitles} from './components/Subtitles';
import {easeInOut} from './components/ui';

export type VideoProps = {mediaRes: number};

// Music-bed levels (linear gain). Speech sits ~18 dB above the ducked bed.
const BED = {off: 0, duck: 0.1, full: 0.5};
const BED_RAMP = 10; // frames

const beatAt = (frame: number) => edl.beats.find((b) => frame >= b.startFrame && frame < b.startFrame + b.durFrames) ?? edl.beats[edl.beats.length - 1];
const bedLevel = (frame: number) => {
  const b = beatAt(frame);
  const i = edl.beats.indexOf(b);
  const cur = BED[b.bed];
  const prev = i > 0 ? BED[edl.beats[i - 1].bed] : cur;
  return interpolate(frame - b.startFrame, [0, BED_RAMP], [prev, cur], {extrapolateRight: 'clamp'});
};

const BeatView: React.FC<{beat: Beat; mediaRes: number}> = ({beat, mediaRes}) => (
  <AbsoluteFill>
    {beat.kind === 'clip' && <FootageBeat beat={beat} mediaRes={mediaRes} />}
    {beat.kind === 'still' && <StillBeat beat={beat} />}
    {beat.kind === 'chapter' && <ChapterCard beat={beat} />}
    {beat.kind === 'title' && <TitleCard beat={beat} />}
    {beat.kind === 'end' && <EndCard beat={beat} />}
    {beat.callout && <Callout />}
    {beat.glitch && <Glitch at={beat.glitchAt ?? 0} />}
    <Chips chips={beat.chips} durFrames={beat.durFrames} />
    {beat.extra && <Extra beat={beat} mediaRes={mediaRes} />}
    {beat.narration && !beat.narrationTake && <NarrationTag beat={beat} />}
    {beat.narrationTake && <Audio src={staticFile(beat.narrationTake)} />}
  </AbsoluteFill>
);

/** Chapter transition: a 1 px cyan line sweeps top→bottom over the chapter card (brand §6.6). */
const ScanWipe: React.FC = () => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 15], [0, 1080], {easing: easeInOut, extrapolateRight: 'clamp'});
  const flash = interpolate(frame, [0, 6, 15], [0, 0.12, 0], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: effects.scanlines, opacity: flash * 6}} />
      <AbsoluteFill style={{clipPath: `inset(${y}px 0 0 0)`, background: colors.voidDeep}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: y, height: 1, background: colors.holoHi, boxShadow: effects.glowStrong}} />
    </AbsoluteFill>
  );
};

// Lower-thirds hold 4.5 s (brand §6.5), across cuts, until the next lower-third or chapter card.
const lowerThirds = edl.beats
  .filter((b) => b.lowerThird)
  .map((b) => {
    const stop = edl.beats.find((x) => x.startFrame > b.startFrame && (x.lowerThird || x.kind !== 'clip'));
    const dur = Math.min(timing.holdLowerThird, (stop ? stop.startFrame : edl.totalFrames) - b.startFrame);
    return {beat: b, dur};
  });

export const Video: React.FC<VideoProps> = ({mediaRes}) => (
  <AbsoluteFill style={{background: colors.voidDeep}}>
    {edl.beats.map((b) => (
      <Sequence key={b.n} from={b.startFrame} durationInFrames={b.durFrames} name={`B${b.n} ${b.kind}`}>
        <BeatView beat={b} mediaRes={mediaRes} />
      </Sequence>
    ))}

    {edl.beats
      .filter((b) => b.kind === 'chapter')
      .map((b) => (
        <Sequence key={`wipe${b.n}`} from={b.startFrame} durationInFrames={16} name={`wipe ch${b.chapter}`}>
          <ScanWipe />
        </Sequence>
      ))}

    {lowerThirds.map(({beat, dur}) => (
      <Sequence key={`lt${beat.n}`} from={beat.startFrame} durationInFrames={dur} name={`LT ${beat.lowerThird!.name}`}>
        <LowerThird lt={beat.lowerThird!} durFrames={dur} />
      </Sequence>
    ))}

    <Sequence from={edl.roster.startFrame} durationInFrames={edl.roster.endFrame - edl.roster.startFrame} name="Roster">
      <Roster roster={edl.roster} />
    </Sequence>

    {/* Music bed: the game's own audio (system stream of clips 9-11), per the script's audio plan */}
    {edl.beds.map((bed) => (
      <Sequence key={bed.id} from={bed.startFrame} durationInFrames={bed.durFrames} name={`MUSIC BED ${bed.label}`}>
        <Audio src={staticFile(`media/beds/${bed.file}`)} volume={(f) => bedLevel(bed.startFrame + f)} />
      </Sequence>
    ))}

    <Subtitles cues={edl.cues} />
    <AbsoluteFill style={{background: effects.scanlines, pointerEvents: 'none'}} />
  </AbsoluteFill>
);
