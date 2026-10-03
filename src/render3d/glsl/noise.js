// Shared GLSL chunks: hashes, noise, fBm, Worley, blackbody, procedural sky.
// Kept as plain strings so a later WebGPU/TSL port can replace them one by one.

export const NOISE = /* glsl */ `
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3){
  p3 = fract(p3 * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
// value noise, smooth, range 0..1
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  float a = hash13(i), b = hash13(i + vec3(1,0,0)), c = hash13(i + vec3(0,1,0)), d = hash13(i + vec3(1,1,0));
  float e = hash13(i + vec3(0,0,1)), g = hash13(i + vec3(1,0,1)), h = hash13(i + vec3(0,1,1)), k = hash13(i + vec3(1,1,1));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
float fbm(vec3 p, int oct){
  float s = 0., a = .5;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s += a * vnoise(p);
    p = p * 2.03 + vec3(7.1, 3.7, 5.3);
    a *= .5;
  }
  return s;
}
float ridged(vec3 p, int oct){
  float s = 0., a = .5;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    float n = 1. - abs(vnoise(p) * 2. - 1.);
    s += a * n * n;
    p = p * 2.07 + vec3(1.3, 9.2, 4.1);
    a *= .5;
  }
  return s;
}
// Worley: x = F1, y = F2 (distance in cell units)
vec2 worley(vec3 p){
  vec3 i = floor(p), f = fract(p);
  float d1 = 8., d2 = 8.;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = hash33(i + g);
    float d = length(g + o - f);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; }
  }
  return vec2(d1, d2);
}
// Crater field on the unit sphere: returns height (negative bowls, positive rims).
// Power-law sizes: three octaves, fewer large ones, density in 0..1.
float craterHeight(vec3 p, float density, float sizeExp, float oct){
  float h = 0.;
  float scale = 2.2;
  float w = 1.;
  for (int k = 0; k < 3; k++){
    float wk = clamp(oct - float(k), 0., 1.);          // continuous LOD fade, no divergent break
    vec3 q = p * scale + float(k) * 17.31;
    vec3 i = floor(q), f = fract(q);
    float thr = density * (.45 + .55 * float(k) / 2.);
    for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++){
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 r = hash33(i + g);
      float on = step(r.x, thr) * wk;                    // fewer large craters, branch-free
      vec3 c = g + hash33(i + g + 3.7) - f;
      float rad = (.28 + .22 * r.y);
      float d = length(c) / rad;
      float bowl = -(1. - smoothstep(0., 1., d)) * .9;
      float rim = smoothstep(.75, 1., d) * (1. - smoothstep(1., 1.35, d)) * .35;
      h += (bowl + rim) * w * on;
    }
    scale *= 2.3;
    w *= pow(.5, sizeExp * .5 + .5);
  }
  return h;
}
float fbmL(vec3 p, float oct){
  float s = 0., a = .5, wsum = 0.;
  for (int i = 0; i < 5; i++){
    float wk = clamp(oct - float(i), 0., 1.);
    s += a * vnoise(p) * wk; wsum += a * wk;
    p = p * 2.03 + vec3(7.1, 3.7, 5.3);
    a *= .5;
  }
  return s;
}
`;

export const BLACKBODY = /* glsl */ `
// Tanner Helland style fit. Output is linear-ish RGB, 0..1, from kelvin.
vec3 blackbody(float K){
  float t = clamp(K, 800., 40000.) / 100.;
  float r, g, b;
  if (t <= 66.) { r = 1.; } else { r = clamp(1.2929362 * pow(t - 60., -0.1332048), 0., 1.); }
  if (t <= 66.) { g = clamp(0.3900816 * log(t) - 0.6318414, 0., 1.); }
  else { g = clamp(1.1298909 * pow(t - 60., -0.0755148), 0., 1.); }
  if (t >= 66.) { b = 1.; } else if (t <= 19.) { b = 0.; }
  else { b = clamp(0.5432068 * log(t - 10.) - 1.1962541, 0., 1.); }
  vec3 c = vec3(r, g, b);
  // below ~1500K it dims toward black (dull red)
  float dim = smoothstep(700., 1900., K);
  return pow(c, vec3(2.2)) * mix(.25, 1., dim);
}
`;

// Direction-based sky. Used by the skybox and, with a deflected ray, by the black hole shader.
export const SKY = /* glsl */ `
uniform vec3 uSkyA;      // deep tint
uniform vec3 uSkyB;      // nebula tint
uniform float uSkySeed;
uniform float uSkyDensity;
vec3 starLayer(vec3 d, float cells, float seed, float bright, float sharp){
  vec3 q = d * cells;
  vec3 i = floor(q);
  vec3 col = vec3(0.);
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 cell = i + g;
    vec3 r = hash33(cell + seed);
    if (r.x > .22 + .5 * uSkyDensity) continue;
    vec3 sp = normalize((cell + .2 + .6 * hash33(cell + seed + 9.1)) );
    float dist = length(d - sp) * cells;
    float s = exp(-dist * dist * sharp) * bright * (.25 + 1.5 * r.y * r.y);
    float K = mix(3200., 12000., r.z);
    vec3 tint = mix(vec3(1., .75, .55), vec3(.7, .8, 1.), smoothstep(3200., 12000., K));
    col += s * tint;
  }
  return col;
}
// Baked once into a cubemap: a near-flat dark tint with a very faint, low-contrast haze; crisp stars are Points.
vec3 skyBake(vec3 d){
  vec3 p = d * 1.2 + uSkySeed * 13.7;
  float haze = fbm(p, 3);
  vec3 col = uSkyA * (.35 + .15 * haze);
  col += uSkyB * .03 * haze;
  return col;
}
`;
