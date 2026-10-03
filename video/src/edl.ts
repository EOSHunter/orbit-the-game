import data from './data/edl.json';

export type ColorKey = 'holo' | 'amber' | 'prey' | 'threat' | 'violet' | 'renderer' | 'simulation' | 'white';

export interface Segment {
  clip: number;
  in: number;
  out: number;
  offsetFrame: number;
  durFrames: number;
  file: string;
  mic: boolean;
  micFrom?: number;
  /** clip time (s) after which the mic fades out, so the next sentence never leaks into the hold */
  micUntil?: number;
}
export interface Chip {
  text: string;
  color: ColorKey;
  kicker: boolean;
  atFrame: number;
}
export interface Extra {
  type: 'typeKicker' | 'nameChips' | 'branches' | 'harborMeter' | 'banner' | 'counter';
  text?: string;
  label?: string;
  status?: string;
  color?: ColorKey;
  value?: number;
  names?: string[];
  atFrames?: number[];
}
export interface Beat {
  /** beat ID as written in the script: "64", "64a", ... */
  n: string;
  chapter: number;
  kind: 'clip' | 'still' | 'chapter' | 'title' | 'end';
  startFrame: number;
  durFrames: number;
  durSec: number;
  onScreen: string;
  lineType: 'real' | 'narration' | 'tts' | 'none';
  narration: boolean;
  segments: Segment[];
  bg?: string | null;
  layout: 'full' | 'screen';
  lowerThird?: {color: ColorKey; kicker: string; name: string; sub: string | null};
  chapterCard?: {kicker: string; title: string; tint: string; ladder: number};
  titleCard?: {title: string; status: string};
  endCard?: {lines: string[]};
  chips: Chip[];
  callout: boolean;
  extra: Extra | null;
  bed: 'off' | 'duck' | 'full';
  /** seconds of picture after Hunter's last word (spoken beats only) */
  speechTailSec: number | null;
}
export interface Cue {
  beat: string;
  text: string;
  speaker: 'creator' | 'orbit';
  narration: boolean;
  startFrame: number;
  endFrame: number;
  showLabel: boolean;
}
export interface Edl {
  title: string;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  chapters: {n: number; name: string; startFrame: number; endFrame: number}[];
  beats: Beat[];
  cues: Cue[];
  roster: {startFrame: number; endFrame: number; rows: {beat: number | string; n: string; title: string; role: string; name: string; atFrame: number}[]};
  beds: {id: string; file: string; label: string; startFrame: number; durFrames: number}[];
}

export const edl = data as unknown as Edl;
