/**
 * R7 Orbit x Vesper Drift: video theme for Remotion.
 * Everything is authored for a 1920x1080 canvas at 30 fps. Scale with `scale(width)` for other sizes.
 * Values are lifted from the game (src/ui/ui.css, docs/art-bible.md, src/render/palette.js); see brand-guide.md.
 *
 * Usage:
 *   import {colors, fonts, fontFaceCss, subtitle, ease, timing} from './brand-kit/theme';
 *   import {Easing, interpolate} from 'remotion';
 *   interpolate(frame, [0, timing.panelIn], [0, 1], {easing: Easing.bezier(...ease.out)});
 */

// ---------------------------------------------------------------- canvas
export const canvas = {width: 1920, height: 1080, fps: 30} as const;
export const scale = (width: number) => width / canvas.width;
/** milliseconds -> frames at the project fps */
export const ms = (n: number, fps: number = canvas.fps) => Math.round((n / 1000) * fps);

// ---------------------------------------------------------------- colours
export const colors = {
  // Void / backgrounds
  voidDeep: '#050812', // UI void, darkest
  voidMid: '#0A1424', // UI panel base
  voidBlue: '#0A1530', // default sky between nebula clouds
  voidInk: '#05080F', // meter tracks, art-bible "void deep"
  nebulaBody: '#2E5F8C',
  nebulaCore: '#8FB3D9',
  hAlpha: '#C8456E', // star-era emission nebula (magenta-red)
  oIII: '#3FB8B0', // star-era emission nebula (teal)
  violetNebula: '#7A5BB0',

  // Instrument layer (the HUD look; primary brand colour of the game)
  holo: '#5CE1FF', // cyan: lines, brackets, progress, kickers
  holoHi: '#B8F3FF', // cyan highlight / glow core / cursor
  holoDim: 'rgba(92,225,255,0.42)', // default panel border / ring
  holoFaint: 'rgba(92,225,255,0.14)', // hairlines
  holoGlow: 'rgba(92,225,255,0.35)', // box-shadow glow
  holoDeep: '#1AA9D6', // start of progress-bar gradient

  // Text
  text: '#E6F6FF', // UI text ("moon white", cool)
  moonWhite: '#EAF0FF', // art-bible text
  mist: '#86A3BF', // secondary text, labels
  cardDesc: '#C9D4EE', // body copy on dark glass

  // Signal colours
  amber: '#FFB547', // caution, dev, "hold form", beacon
  amberDim: 'rgba(255,181,71,0.35)',
  violet: '#B48CFF', // evolution choices, Event Horizon
  prey: '#5FF0C0', // mint
  neutral: '#7FD6FF', // glacier (UI) / #A9BCD9 in art-bible overlay
  threat: '#FF5E73', // coral

  // Glass panel
  panelBg:
    'linear-gradient(140deg, rgba(10,34,52,0.66), rgba(6,14,30,0.5) 60%, rgba(10,26,44,0.6))',
  scrim: 'rgba(5,8,18,0.72)',

  // R7 Orbit logo (studio / sign-off accent, sampled from r7-orbit-logo.png)
  r7Gold: '#CAAB6C', // main body of the mark
  r7GoldLight: '#E6C98C', // highlight / orbit dot
  r7GoldDeep: '#8A6A36', // shadow side
  r7Tile: '#0D0D0F', // the logo tile fill
} as const;

/** Stage backdrop gradients [outer, inner] from the 2D renderer (src/render/palette.js STAGES). */
export const stageTints: Record<string, [string, string]> = {
  meteorite: ['#10142B', '#161B38'],
  asteroid: ['#12162E', '#1B2447'],
  dwarf_planet: ['#161A3A', '#22305A'],
  rocky_planet: ['#1A1238', '#2F2160'],
  gas_giant: ['#1F1440', '#3A1E5C'],
  gas_planet: ['#241446', '#43266B'],
  dwarf_star: ['#2A1030', '#5A1F3A'],
  star: ['#2F0F2B', '#6A2338'],
  giant_star: ['#2A0D1F', '#5A1A2E'],
  supergiant_star: ['#10153A', '#1B2A6A'],
  neutron_star: ['#05060F', '#0E1A33'],
  black_hole: ['#05060F', '#2A1F4D'],
};

/** The 12 stages in order, names exactly as shown in the game (src/stages.js). */
export const stages = [
  'Meteorite', 'Asteroid', 'Dwarf Planet', 'Rocky Planet', 'Gas Giant', 'Gas Planet',
  'Dwarf Star', 'Star', 'Giant Star', 'Supergiant Star', 'Neutron Star', 'Black Hole',
] as const;

// ---------------------------------------------------------------- agent roles (lower-thirds + subtitle tags)
export type RoleKey =
  | 'creativeDirector' | 'uiDesigner' | 'soundDesigner' | 'engine' | 'renderer' | 'simulation' | 'qa';

export interface Role {
  key: RoleKey;
  /** Title shown in the lower-third (uppercase in render) */
  title: string;
  /** Short tag for subtitles / chips */
  tag: string;
  /** Two-letter-ish code in the game's `STG 07/12 // DST` style */
  code: string;
  /** Accent colour, all drawn from the game's signal palette */
  color: string;
  /** One line "what they did", for the lower-third sub-line (edit freely) */
  blurb: string;
}

export const roles: Record<RoleKey, Role> = {
  creativeDirector: { key: 'creativeDirector', title: 'Creative Director', tag: 'CREATIVE DIR', code: 'CD', color: '#B48CFF', blurb: 'Vision, art bible, what the game should feel like' },
  uiDesigner:       { key: 'uiDesigner',       title: 'UI Designer',       tag: 'UI DESIGN',    code: 'UI', color: '#5CE1FF', blurb: 'The holographic HUD, menus and screens' },
  soundDesigner:    { key: 'soundDesigner',    title: 'Sound Designer',    tag: 'SOUND',        code: 'SN', color: '#FFB547', blurb: 'Everything you hear, synthesised live' },
  engine:           { key: 'engine',           title: 'Engine',            tag: 'ENGINE',       code: 'EN', color: '#5FF0C0', blurb: 'Game loop, input, camera, wiring it together' },
  renderer:         { key: 'renderer',         title: 'Renderer',          tag: 'RENDERER',     code: 'RN', color: '#E0608F', blurb: 'Planets, stars, nebulae and black holes in 3D' },
  simulation:       { key: 'simulation',       title: 'Simulation',        tag: 'SIM',          code: 'SM', color: '#6EA2FF', blurb: 'Gravity, absorption, stages and the infinite universe' },
  qa:               { key: 'qa',               title: 'QA',                tag: 'QA',           code: 'QA', color: '#FF5E73', blurb: 'Playtests, balance runs, finding what breaks' },
};
export const roleList: Role[] = Object.values(roles);

/** Display name for the creator in subtitles / lower-thirds (confirmed). */
export const creator = {name: 'Hunter', tag: 'HUNTER', color: '#FFFFFF'} as const;

// ---------------------------------------------------------------- fonts
/**
 * The game itself loads NO web fonts: it uses local system fonts via CSS stacks (src/ui/ui.css lines 23-24).
 *   display: Bahnschrift (Windows system font, Microsoft licence, NOT redistributable)
 *   mono:    JetBrains Mono if installed, else Cascadia Mono / Consolas (the screenshots rendered with the fallbacks)
 * For video we ship OFL fonts that match the look and render identically on any machine:
 *   display -> Barlow Semi Condensed (OFL 1.1), the closest open match to Bahnschrift SemiCondensed / DIN
 *   mono    -> JetBrains Mono (OFL 1.1)
 * On a Windows render machine you may put Bahnschrift first for an exact match to the game's pixels.
 */
export const fonts = {
  display: '"Barlow Semi Condensed", "Bahnschrift", "DIN Alternate", "Segoe UI", system-ui, sans-serif',
  displayExact: '"Bahnschrift", "Barlow Semi Condensed", "Segoe UI", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Cascadia Mono", Consolas, ui-monospace, monospace',
  body: 'system-ui, "Segoe UI", sans-serif', // the game's long-form copy (card descriptions)
} as const;

/** Files live in ./assets/fonts. With Remotion: staticFile('brand-kit/assets/fonts/...') after copying into /public, or use @remotion/fonts loadFont. */
export const fontFiles = [
  {family: 'Barlow Semi Condensed', weight: 400, file: 'assets/fonts/BarlowSemiCondensed-Regular.ttf'},
  {family: 'Barlow Semi Condensed', weight: 500, file: 'assets/fonts/BarlowSemiCondensed-Medium.ttf'},
  {family: 'Barlow Semi Condensed', weight: 600, file: 'assets/fonts/BarlowSemiCondensed-SemiBold.ttf'},
  {family: 'Barlow Semi Condensed', weight: 700, file: 'assets/fonts/BarlowSemiCondensed-Bold.ttf'},
  {family: 'JetBrains Mono', weight: 400, file: 'assets/fonts/JetBrainsMono-Regular.ttf'},
  {family: 'JetBrains Mono', weight: 500, file: 'assets/fonts/JetBrainsMono-Medium.ttf'},
  {family: 'JetBrains Mono', weight: 700, file: 'assets/fonts/JetBrainsMono-Bold.ttf'},
] as const;

/** Convenience @font-face CSS. `base` is the URL prefix where the brand-kit folder is served from. */
export const fontFaceCss = (base = '/brand-kit/') =>
  fontFiles
    .map(
      (f) =>
        `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:normal;font-display:block;src:url("${base}${f.file}") format("truetype");}`,
    )
    .join('\n');

/** Type scale (px @1080p). Titles are UPPERCASE with wide tracking, exactly like the game. */
export const type = {
  wordmarkA: {size: 168, weight: 300, tracking: '0.42em', font: 'display'}, // "VESPER"
  wordmarkB: {size: 66, weight: 600, tracking: '1.1em', font: 'display'}, // "DRIFT"
  chapterTitle: {size: 96, weight: 600, tracking: '0.24em', font: 'display'},
  heading: {size: 64, weight: 600, tracking: '0.18em', font: 'display'},
  lowerThirdName: {size: 44, weight: 600, tracking: '0.12em', font: 'display'},
  kicker: {size: 22, weight: 500, tracking: '0.3em', font: 'mono'}, // "STG 07/12 // DST"
  label: {size: 20, weight: 500, tracking: '0.16em', font: 'mono'},
  stat: {size: 56, weight: 500, tracking: '0.02em', font: 'mono', italic: true}, // mass counter style
  body: {size: 32, weight: 400, tracking: '0.03em', font: 'display'},
} as const;

// ---------------------------------------------------------------- spacing & safe areas
export const spacing = {
  unit: 8,
  gap: 32, // the game's --gap (16px) doubled for 1080p
  panelPad: 28,
  panelRadius: 0, // the game is square-cornered; brackets, not rounded boxes
  borderWidth: 2,
  bracketLen: 18, // corner bracket arm length
  bracketStroke: 3,
  scanlinePeriod: 6, // px; 1px line every 3px in-game at 720p reference
} as const;

export const safe = {
  /** action safe: keep all meaningful graphics inside */
  actionX: 96,
  actionY: 54,
  /** title safe: keep text inside (also clears YouTube's bottom control bar overlap) */
  titleX: 192,
  titleTop: 108,
  titleBottom: 140,
} as const;

// ---------------------------------------------------------------- panel / effect styles (CSS-in-JS)
export const effects = {
  glow: `0 0 20px ${colors.holoGlow}`,
  glowStrong: `0 0 44px rgba(92,225,255,0.55)`,
  textGlow: '0 0 24px rgba(92,225,255,0.45)',
  textGlowStrong: '0 0 44px rgba(92,225,255,0.6)',
  amberGlow: '0 0 20px rgba(255,181,71,0.35)',
  grainOpacity: 0.05,
  vignette: 'radial-gradient(ellipse at 50% 45%, rgba(10,30,50,0.25), rgba(2,5,12,0.75) 75%)',
  scanlines:
    'repeating-linear-gradient(0deg, rgba(120,220,255,0.035) 0 1px, transparent 1px 3px)',
  /** the game's panel: dark glass, cyan hairline, blur 3px (at 720p ref; use 6 at 1080p) */
  panel: {
    background: colors.panelBg,
    border: `1px solid ${colors.holoFaint}`,
    backdropFilter: 'blur(6px)',
  },
  button: {
    background: 'linear-gradient(180deg, rgba(92,225,255,0.12), rgba(92,225,255,0.03))',
    border: `2px solid ${colors.holoDim}`,
    letterSpacing: '0.28em',
    textTransform: 'uppercase' as const,
  },
  progressFill: `linear-gradient(90deg, ${colors.holoDeep}, ${colors.holo} 70%, ${colors.holoHi})`,
} as const;

// ---------------------------------------------------------------- motion
/** cubic-bezier control points; use Easing.bezier(...ease.out) */
export const ease = {
  out: [0.215, 0.61, 0.355, 1] as const, // the game's --ease (easeOutCubic-ish): default for everything
  pop: [0.34, 1.56, 0.64, 1] as const, // the game's --ease-pop: tiny overshoot for chips/badges only
  inOut: [0.65, 0, 0.35, 1] as const, // camera-style moves, scene-to-scene drifts
  in: [0.55, 0.055, 0.675, 0.19] as const, // exits only
  linear: [0, 0, 1, 1] as const,
} as const;

/** Durations in frames @30fps (derived from the game: panels 200-320ms, banner 2.2s, bar 200ms, ghost 900ms). */
export const timing = {
  micro: ms(160), // hover/press-level
  panelIn: ms(320),
  panelOut: ms(240),
  barFill: ms(200),
  barGhost: ms(900),
  letterDecode: ms(500), // stage-name scramble
  bannerTotal: ms(2200),
  bannerBlurIn: ms(300), // opacity 0->1 and blur 4px->0 while tracking collapses 0.6em -> 0.24em
  crossfade: ms(400),
  glitchCut: ms(120),
  holdTitle: ms(2600),
  holdChapter: ms(2400),
  holdLowerThird: ms(4500),
  lineDraw: ms(700),
  stagger: ms(60), // per-letter / per-item
  caretBlink: ms(500), // steps(2) blink, 1 s period
  spin: ms(6000), // stage glyph ring rotation period
} as const;

// ---------------------------------------------------------------- lower-third
export const lowerThird = {
  /** left edge and bottom offset (px) from the canvas edge */
  x: safe.actionX + 24,
  bottom: 330, // sits ABOVE the 2-line subtitle zone (subtitle top edge is ~260 px from the bottom)
  width: 640,
  accentBar: 6,
  nameSize: type.lowerThirdName.size,
  kickerSize: type.kicker.size,
  glyphSize: 76,
} as const;

// ---------------------------------------------------------------- subtitles (burned in)
export const subtitle = {
  font: fonts.display,
  fontWeight: 500,
  /** px @1080p. 44 px reads on a phone; do not go below 40 */
  fontSize: 42,
  lineHeight: 1.28,
  letterSpacing: '0.01em',
  maxLines: 2,
  maxWidth: 1280, // ~ 66% of width; roughly 42 characters per line
  maxCharsPerLine: 42,
  /** distance from the bottom edge to the bottom of the box */
  bottom: 90,
  align: 'center' as const,
  paddingX: 28,
  paddingY: 14,
  radius: 4,
  boxBackground: 'rgba(5,8,18,0.78)',
  boxBorder: `1px solid ${colors.holoFaint}`,
  /** 2-layer outline + shadow so text survives bright nebula/star frames even without the box */
  textShadow:
    '0 0 2px #000, 0 2px 4px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)',
  textStroke: '3px rgba(2,4,9,0.95)', // use with paint-order: stroke fill
  /** Speaker label chip */
  label: {
    font: fonts.mono,
    size: 20,
    tracking: '0.16em',
    weight: 500,
    gap: 14,
  },
  /** left accent bar width */
  barWidth: 6,
  fadeInFrames: ms(120),
  fadeOutFrames: ms(120),
  /** creator = plain white, no label by default. Agents = tinted text + role label + coloured bar. */
  creator: {
    text: '#FFFFFF',
    bar: '#FFFFFF',
    label: creator.tag, // only render when the speaker changes
    labelColor: 'rgba(255,255,255,0.7)',
    italic: false,
  },
  agent: {
    text: '#D6F4FF', // cool tint: reads as "machine voice" against white
    italic: true, // agent voices are italic; creator is upright
    prefix: '◆', // diamond, the game's threat-marker shape reused as a speaker glyph
  },
} as const;

/** Resolve the subtitle colours for a speaker */
export const subtitleSpeaker = (who: 'creator' | RoleKey) =>
  who === 'creator'
    ? {label: creator.tag, color: creator.color, bar: subtitle.creator.bar, text: subtitle.creator.text, italic: false, showLabel: false}
    : {label: roles[who].tag, color: roles[who].color, bar: roles[who].color, text: subtitle.agent.text, italic: true, showLabel: true};

// ---------------------------------------------------------------- misc
export const logo = {
  /** Final masters from the creator (vector + 2048/4096 raster). Legacy 512 px keyed files are in assets/logo/legacy-512. */
  iconSvg: 'assets/logo/r7-orbit-icon.svg', // tile + mark, vector
  markSvg: 'assets/logo/r7-orbit-mark-transparent.svg', // mark only, vector
  tile2048: 'assets/logo/r7-orbit-icon-2048.png',
  tile4096: 'assets/logo/r7-orbit-icon-4096.png',
  markGoldOnDark: 'assets/logo/r7-orbit-mark-gold-transparent-2048.png',
  markBronzeOnLight: 'assets/logo/r7-orbit-mark-bronze-for-light-bg-2048.png',
  markWhite: 'assets/logo/r7-orbit-mark-white-2048.png',
  markInk: 'assets/logo/r7-orbit-mark-ink-2048.png',
  emblemSvg: 'assets/ui/vesper-drift-emblem.svg',
  /** minimum clear space = half the mark height; min on-screen width 96 px */
  minWidth: 96,
} as const;

/** Confirmed by the creator */
export const video = {title: 'Vesper Drift', creator: 'Hunter'} as const;

export const theme = {
  canvas, colors, stageTints, stages, roles, roleList, creator, fonts, type, spacing, safe,
  effects, ease, timing, lowerThird, subtitle, logo, video,
} as const;
export default theme;
