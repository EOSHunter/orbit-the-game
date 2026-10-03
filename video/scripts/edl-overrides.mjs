// Hand-set edit details the script table only describes in prose.
// Everything else (timing, sources, lines, lower-thirds, chips, chapter cards) is parsed from
// docs/video/script/script.md by build-edl.mjs. Keep this file small.

/** Gameplay shots: the browser chrome is cropped as well. All footage is full-frame with no effects over it. */
export const fullBleed = new Set([1, 61, 62, 63, 64, 66, 67, 68, 69, 73, 76, 80, 81, 82, 83, 84, 85, 86, 88, 89, 90, 91]);

/** Per-beat audio tweaks. micFrom = clip time (s) where the mic comes back in (beat 90: "Mic muted until 1:54.0"). */
export const audio = {
  90: {micFrom: 114.0},
};

/** Chips that should appear on a word rather than at beat start. */
export const chipAtWord = {11: 'creative'};
/** Chips that should appear N seconds before the beat ends. */
export const chipFromEnd = {92: 1.6};

/** Roster panel (chapter 3). Rows are added on the beat listed and stay until the panel ends. */
export const roster = {
  showBeats: [20, 21, 22, 23, 24, 25],
  rows: [
    {beat: 20, n: '01/07', title: 'CREATIVE DIRECTOR', role: 'creativeDirector', name: 'Iris'},
    {beat: 22, n: '02/07', title: 'UI DESIGNER', role: 'uiDesigner', name: 'Juno'},
    {beat: 22, n: '03/07', title: 'SOUND DESIGNER', role: 'soundDesigner', name: 'Kestrel'},
    {beat: 23, n: '04/07', title: 'ENGINE', role: 'engine', name: 'Cedar'},
    {beat: 23, n: '05/07', title: 'RENDERER', role: 'renderer', name: ''},
    {beat: 24, n: '06/07', title: 'SIMULATION', role: 'simulation', name: ''},
  ],
};

/** Special graphics keyed by beat. */
export const extras = {
  5: {type: 'typeKicker', text: '1 CREATOR // A TEAM OF AGENTS // 1 CANVAS_'},
  26: {type: 'nameChips', names: ['VOYAGER', 'QUASAR', 'POLARIS', 'LAIKA'], atWords: ['voyager', 'quasar', 'polaris', 'laika']},
  30: {type: 'branches', label: '1 AGENT = 1 BRANCH + 1 WORKTREE'},
  57: {type: 'harborMeter', status: 'QA // HARBOR // RUNNING ON ITS OWN_'},
  63: {type: 'banner', text: 'ASTEROID', color: 'holo'},
  70: {type: 'counter', value: 445.97, label: 'API-EQUIVALENT // COVERED BY CLAUDE MAX PLAN'},
  87: {type: 'banner', text: 'EVOLUTION BRANCH DETECTED', color: 'violet'},
};

/** Chapter music beds, from the game's own audio (a:1, system stream) per the script's Audio plan. */
// The bed only sounds under beats that have no game audio of their own (clips 1-7 and brand-asset
// cards); on clip 8-11 beats the shot's native a:1 carries the game sound instead.
export const beds = [
  {id: 'bed-ch1-2', chapters: [1, 2], clip: 9, in: 284, out: 350, label: 'Meteorite / asteroid'},
  {id: 'bed-ch3-4', chapters: [3, 4], clip: 9, in: 543, out: 615, label: 'Dwarf planet'},
  {id: 'bed-ch5', chapters: [5], clip: 10, in: 30, out: 55, label: 'Gas giant'},
  {id: 'bed-ch6', chapters: [6], clip: 11, in: 40, out: 60, label: 'Gas giant / nebula'},
  {id: 'bed-ch7', chapters: [7], clip: 11, in: 100, out: 110, label: 'Black hole'},
];
