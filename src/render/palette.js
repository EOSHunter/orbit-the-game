// Palette + per-stage table for the "Luminous Vector Dusk" style (docs/creative-direction.md
// sections 4 and 6). One config module so art direction can be tuned in a single place.

export const CORE = {
  voidDeep: '#070914',
  voidMid: '#10142B',
  voidHaze: '#2A1F4D',
  slateGlass: '#161B38',
  slateLine: '#2F3A73',
  moonWhite: '#EAF0FF',
  mist: '#8F9BC7',
};

/** Relative-mass colours: rim colour is driven by the mass ratio, not by what the body is. */
export const REL = {
  player: '#FFC15A',      // Ember Gold
  playerGlow: '#FF8A3D',  // Ember Hot
  prey: '#5FF0C0',        // Aurora Mint
  equal: '#7FD6FF',       // Glacier
  threat: '#FF5E73',      // Flare Coral
  threatHC: '#FF9F1C',    // high-contrast swap for coral
  neutral: '#5E6C9E',     // Ash Blue
  orchid: '#C48BFF',      // rare / choice
};

/**
 * 12 stages. `tint` is the background [outer, inner] gradient, `dust`/`stars` scale the
 * density of the parallax layers, `playerPx` is the recommended constant on-screen player
 * radius (CSS px) for the camera, `wake` switches the player's trail from thruster to
 * gravity wake.
 */
export const STAGES = [
  { name: 'Meteorite',      tint: ['#10142B', '#161B38'], dust: 1.0,  stars: 1.0,  playerPx: 20, thruster: true },
  { name: 'Asteroid',       tint: ['#12162E', '#1B2447'], dust: 1.0,  stars: 1.0,  playerPx: 22, thruster: true },
  { name: 'Dwarf Planet',   tint: ['#161A3A', '#22305A'], dust: 0.9,  stars: 0.95, playerPx: 24, thruster: true },
  { name: 'Rocky Planet',   tint: ['#1A1238', '#2F2160'], dust: 0.7,  stars: 0.9,  playerPx: 25, thruster: true },
  { name: 'Gas Giant',      tint: ['#1F1440', '#3A1E5C'], dust: 0.5,  stars: 0.85, playerPx: 27, thruster: false },
  { name: 'Gas Planet',     tint: ['#241446', '#43266B'], dust: 0.4,  stars: 0.85, playerPx: 27, thruster: false },
  { name: 'Dwarf Star',     tint: ['#2A1030', '#5A1F3A'], dust: 0.3,  stars: 0.8,  playerPx: 28, thruster: false },
  { name: 'Star',           tint: ['#2F0F2B', '#6A2338'], dust: 0.3,  stars: 0.75, playerPx: 29, thruster: false },
  { name: 'Giant Star',     tint: ['#2A0D1F', '#5A1A2E'], dust: 0.25, stars: 0.7,  playerPx: 30, thruster: false },
  { name: 'Supergiant Star',tint: ['#10153A', '#1B2A6A'], dust: 0.25, stars: 0.65, playerPx: 30, thruster: false },
  { name: 'Neutron Star',   tint: ['#05060F', '#0E1A33'], dust: 0.15, stars: 0.45, playerPx: 24, thruster: false },
  { name: 'Black Hole',     tint: ['#05060F', '#2A1F4D'], dust: 0.2,  stars: 0.6,  playerPx: 32, thruster: false },
];

/** Stage -> colour used for the player's wake / trail once the thruster fades out (stage 5+). */
export const WAKE_COLOR = [
  '#FFB067', '#FFB067', '#FFC15A', '#FFC15A',
  '#F2D3A0', '#E9D8FF', '#FFD66B', '#FFB347', '#FF8A4D', '#7FB0FF', '#7FD6FF', '#C48BFF',
];

export function stageInfo(i) {
  return STAGES[Math.max(0, Math.min(11, i | 0))];
}
