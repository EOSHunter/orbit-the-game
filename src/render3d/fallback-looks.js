// Fallback looks with the exact shape of src/data/looks.js (contract 2.4), used until the Creative
// Director's file exists. Swap is automatic: render3d/index.js prefers ../data/looks.js when present.
//
// Palette conventions the shaders rely on (documented in docs/engine-notes.md):
//   rock/dwarf/lava/metallic : base + accent = two-tone regolith, shadow unused by lit pass
//   terrestrial planet       : base = lowland, accent = ocean, shadow = highland, extra[0] = ice
//   gas giant / brown dwarf  : base/accent = band tones, shadow = dark band, extra[0] = storm tint
//   star / neutron / hole    : colour comes from emission.temperatureK; palette is only the fallback

export const LOOK_VERSION = 1;

const S = (a, b, k, i, amb, ai) => ({ skyTint: [a, b], keyColorK: k, keyIntensity: i, ambient: amb, ambientIntensity: ai });

export const PRESETS = {
  exposure: { day: 1.0, deepSpace: 2.2, adaptSeconds: 1.6 },
  bloom: { threshold: 1.05, strength: 0.5, radius: 0.55 },
  camera: { pitchDeg: 58, fovDeg: 38, distanceFactor: 26, topDownPitchDeg: 90 },
  stages: {
    meteorite:         S('#040d1c', '#2a6aa8', 5800, 3.2, '#223a66', 0.05),
    asteroid:          S('#040d1c', '#2a6aa8', 5800, 3.2, '#223a66', 0.05),
    dwarf_planet:      S('#050c1a', '#2b5f9a', 5800, 3.2, '#223a66', 0.05),
    rocky_planet:      S('#050b18', '#2a5890', 5800, 3.2, '#223a66', 0.05),
    gas_giant:         S('#060a16', '#33508a', 5600, 3.0, '#2a3866', 0.05),
    gas_planet:        S('#08081a', '#4a3a7a', 5200, 2.8, '#2a2a5a', 0.045),
    dwarf_star:        S('#0a0814', '#5a3a6a', 3600, 2.8, '#2a2450', 0.04),
    star:              S('#070a1a', '#3a5a9a', 5800, 3.0, '#243860', 0.04),
    giant_star:        S('#0a0812', '#6a4050', 4000, 2.8, '#2a2048', 0.04),
    supergiant_star:   S('#060818', '#3a4a9a', 9000, 3.0, '#223066', 0.04),
    neutron_star:      S('#04060f', '#2a2f6a', 20000, 2.6, '#1c2860', 0.035),
    black_hole:        S('#030409', '#1c2650', 7000, 2.4, '#141c44', 0.03),
  },
  relation: { prey: '#5ee08a', neutral: '#b9c4d6', threat: '#ff5a5a' },
};

function h32(seed, k) {
  let h = (seed ^ (k * 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0');
}

const STAR_T = { yellow: 5800, red: 3400, blue: 11000, dwarf: 3600, main: 5800, giant: 4000, supergiant: 9000 };

export function getLook(cls, stageId, seed, variant) {
  const r = (k) => h32(seed >>> 0, k);
  const L = {
    palette: { base: '#6a6460', accent: '#8a8078', shadow: '#2a2622' },
    albedo: [0.06, 0.2], roughness: 0.9, metalness: 0,
    craters: { density: 0.3, sizeExp: 1 }, bands: null, emission: null, atmosphere: null, extras: {},
  };
  const tint = (a, b) => mixHex(a, b, r(1));
  switch (cls) {
    case 'meteorite':
      if (variant === 'iron') { L.palette = { base: '#8a8e94', accent: '#6c7076', shadow: '#2a2c30' }; L.metalness = 0.8; L.roughness = 0.5; L.albedo = [0.12, 0.3]; L.craters = { density: 0.35, sizeExp: 1.6 }; }
      else { L.palette = { base: tint('#7a6f66', '#6a625c'), accent: '#4c453f', shadow: '#201c19' }; L.albedo = [0.08, 0.22]; L.craters = { density: 0.25, sizeExp: 1 }; }
      L.extras.elongation = 0.5; L.extras.lump = 0.28; break;
    case 'asteroid':
      L.palette = { base: tint('#4a423d', '#8a7a6a'), accent: tint('#6a5a4e', '#7b6f66'), shadow: '#1e1a17' };
      L.albedo = [0.04, 0.2]; L.craters = { density: 0.55, sizeExp: 1.2 };
      L.extras.elongation = variant === 'monolith' ? 0.9 : 0.6; L.extras.lump = variant === 'rubble' ? 0.5 : 0.34;
      if (variant === 'iron') { L.metalness = 0.7; L.roughness = 0.55; L.palette.base = '#7d8186'; L.palette.accent = '#5c6065'; }
      break;
    case 'comet':
      L.palette = { base: '#5c554f', accent: '#b8c2c8', shadow: '#1a1816' };
      L.albedo = [0.04, 0.12]; L.craters = { density: 0.3, sizeExp: 1 }; L.extras.elongation = 0.55; L.extras.lump = 0.36; break;
    case 'dwarfPlanet':
      if (variant === 'ice') { L.palette = { base: '#cfd8de', accent: '#c9a98f', shadow: '#5a6a7a' }; L.albedo = [0.5, 0.8]; L.extras.kind = 3; }
      else { L.palette = { base: '#8a8480', accent: '#9c9087', shadow: '#2a2622' }; L.albedo = [0.09, 0.3]; }
      L.craters = { density: 0.5, sizeExp: 1.1 }; L.extras.elongation = 0.04; L.extras.lump = 0.06; break;
    case 'rockyPlanet':
      L.extras.elongation = 0.0; L.extras.lump = 0.035;
      if (variant === 'lava') {
        L.palette = { base: '#2a2320', accent: '#4a3a30', shadow: '#0e0a08' }; L.albedo = [0.04, 0.1];
        L.emission = { temperatureK: 1500, intensity: 1.7, cause: 'hot-ground' }; L.craters = { density: 0.3, sizeExp: 1 }; L.extras.kind = 2;
      } else if (variant === 'metallic') {
        L.palette = { base: '#7d8288', accent: '#5e6368', shadow: '#1c1e20' }; L.metalness = 0.75; L.roughness = 0.45; L.albedo = [0.1, 0.3];
        L.craters = { density: 0.12, sizeExp: 1.4 }; L.extras.kind = 1;
      } else {
        L.palette = { base: '#6b7f4a', accent: '#1f4e8c', shadow: '#6a5a46', extra: ['#e8eef2'] }; L.albedo = [0.25, 0.4];
        L.craters = null; L.atmosphere = { tint: '#5d9bff', thickness: 1.0, mie: 0.5 };
        L.extras.cloud = 0.55; L.extras.water = 0.5; L.extras.terrestrial = 1;
      }
      break;
    case 'gasGiant':
      if (variant === 'ice') L.palette = { base: '#7fa6c9', accent: '#cfe3ee', shadow: '#4a6f94', extra: ['#2f5a86'] };
      else if (variant === 'storm') L.palette = { base: '#b8845a', accent: '#e6cfae', shadow: '#6a3a26', extra: ['#b0442c'] };
      else L.palette = { base: '#c9a67a', accent: '#e8dcc2', shadow: '#8a5a3a', extra: ['#b0442c'] };
      L.bands = { count: 8 + Math.floor(r(2) * 5), warp: variant === 'storm' ? 1.4 : 0.9 };
      L.atmosphere = { tint: '#e8d2a8', thickness: 0.35, mie: 0.3 }; L.craters = null; L.albedo = [0.3, 0.5]; break;
    case 'brownDwarf':
      L.palette = { base: '#2e1420', accent: '#4a1c2a', shadow: '#12060b', extra: ['#1f0a12'] };
      L.bands = { count: 10 + Math.floor(r(2) * 4), warp: 1.2 };
      L.emission = { temperatureK: 1000, intensity: 0.22, cause: 'stellar-remnant' };
      L.atmosphere = { tint: '#a04060', thickness: 0.25, mie: 0.2 }; L.craters = null; L.albedo = [0.02, 0.08]; break;
    case 'star': {
      const T = STAR_T[variant] || 5800;
      L.palette = { base: '#ffd9a0', accent: '#ffb060', shadow: '#704020' };
      L.emission = { temperatureK: T, intensity: 1.0, cause: 'star' }; L.craters = null; L.albedo = [1, 1];
      L.extras = { cells: 8, spots: 0.5, limbU: 0.6, corona: 1 }; break;
    }
    case 'neutronStar':
      L.palette = { base: '#cfe0ff', accent: '#8ab0ff', shadow: '#203060' };
      L.emission = { temperatureK: 28000, intensity: 2.2, cause: 'stellar-remnant' }; L.craters = null;
      L.extras = { cells: 0, spots: 0, limbU: 0.3 }; break;
    case 'blackHole':
      L.palette = { base: '#000000', accent: '#ff9a50', shadow: '#000000' };
      L.emission = { temperatureK: 7500, intensity: 1.5, cause: 'accretion' }; L.craters = null; L.albedo = [0, 0]; break;
    case 'fragment':
    case 'debris':
    default:
      L.palette = { base: tint('#5a524c', '#7a6f66'), accent: '#3c3632', shadow: '#16130f' };
      L.albedo = [0.05, 0.2]; L.craters = { density: 0.2, sizeExp: 1 }; L.extras.elongation = 0.7; L.extras.lump = 0.4;
  }
  return L;
}
