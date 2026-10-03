// Uniform-driven shaders for the large, few bodies: terrestrial planet, gas giant / brown dwarf,
// star / neutron star surface, atmosphere shell, ring, glow billboard, beam/jet cone.
import { NOISE, BLACKBODY } from './noise.js';
import { LIGHT } from './common.js';

// ---------- shared sphere vertex shader (mesh with unit sphere, scaled by radius) ----------
export const sphereVert = /* glsl */ `
uniform vec4 uStretch;   // world axis xyz, stretch (Roche)
varying vec3 vObj;
varying vec3 vNView;
varying vec3 vViewPos;
void main(){
  vObj = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.);
  vec3 c = modelMatrix[3].xyz;
  wp.xyz += uStretch.xyz * dot(wp.xyz - c, uStretch.xyz) * uStretch.w;
  vec4 mv = viewMatrix * wp;
  vViewPos = mv.xyz;
  vNView = normalize(mat3(viewMatrix) * mat3(modelMatrix) * normalize(position));
  gl_Position = projectionMatrix * mv;
}
`;

const BUMP = /* glsl */ `
vec3 bumpN(vec3 Ng, vec3 vp, float H){
  vec3 dpx = dFdx(vp), dpy = dFdy(vp);
  float dhx = dFdx(H), dhy = dFdy(H);
  vec3 r1 = cross(dpy, Ng), r2 = cross(Ng, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * Ng - grad);
}
`;

// ---------- terrestrial planet (height > biome > ocean > ice > clouds) ----------
export const planetFrag = /* glsl */ `
${NOISE}
${LIGHT}
${BUMP}
uniform float uSeed;
uniform vec3 uLand, uOcean, uHigh, uIce;
uniform float uRadius;
uniform float uCloud;      // 0..1 cloud cover
uniform float uWater;      // sea level 0..1
uniform vec4 uOcc0, uOcc1;
varying vec3 vObj;
varying vec3 vNView;
varying vec3 vViewPos;
void main(){
  vec3 Ng = normalize(vNView);
  vec3 V = normalize(-vViewPos);
  vec3 L = normalize(uKeyDir);
  vec3 p = vObj + uSeed * 3.17;
  float h = fbm(p * 2.2, 6) + .35 * ridged(p * 4.5, 4) * .5;
  h = (h - .25) / .85;
  float sea = uWater;
  float land = smoothstep(sea - .01, sea + .015, h);
  float lat = abs(vObj.y);
  float ice = smoothstep(.8, .92, lat + (h - .5) * .25 + (fbm(p * 6., 3) - .5) * .12);
  vec3 low = mix(uLand, uHigh, smoothstep(sea, sea + .35, h));
  low *= .85 + .3 * vnoise(p * 30.);
  vec3 deep = mix(uOcean * .35, uOcean, smoothstep(sea - .35, sea, h));
  vec3 alb = mix(deep, low, land);
  alb = mix(alb, uIce, ice);
  float Hb = land * h * .02 * uRadius;
  vec3 N = bumpN(Ng, vViewPos, Hb);
  // clouds
  vec3 cp = p * 3.4 + vec3(uTime * .006, 0., 0.);
  float cl = smoothstep(.52 - .25 * uCloud, .8, fbm(cp, 5)) * uCloud;
  alb = mix(alb, vec3(.8), cl * .85);
  float shadow = occl(vViewPos, L, uOcc0) * occl(vViewPos, L, uOcc1);
  float term = smoothstep(-.02, .12, dot(Ng, L));
  float ndl = max(dot(mix(N, Ng, cl), L), 0.) * term;
  vec3 col = alb * uKeyColor * .55 * ndl * shadow + alb * uAmbient;
  // sun glint on open water
  vec3 Hh = normalize(L + V);
  float glint = pow(max(dot(Ng, Hh), 0.), 160.) * (1. - land) * (1. - ice) * (1. - cl) * term * shadow;
  col += uKeyColor * glint * .22;
  gl_FragColor = vec4(col, 1.);
}
`;

// ---------- gas giant / brown dwarf ----------
export const gasFrag = /* glsl */ `
${NOISE}
${BLACKBODY}
${LIGHT}
uniform float uSeed, uBands, uWarp;
uniform vec3 uBase, uAccent, uShade, uStorm, uHaze;
uniform float uHazeAmt;
uniform vec2 uEmit;        // temperatureK, intensity (brown dwarf stellar-remnant only; 0 for gas giants)
uniform vec4 uOcc0, uOcc1;
varying vec3 vObj;
varying vec3 vNView;
varying vec3 vViewPos;
void main(){
  vec3 Ng = normalize(vNView);
  vec3 V = normalize(-vViewPos);
  vec3 L = normalize(uKeyDir);
  vec3 o = vObj;
  float lat = o.y;
  // differential rotation: equator spins fastest
  float ang = uTime * .02 * (.4 + .6 * cos(lat * 1.5708));
  float ca = cos(ang), sa = sin(ang);
  vec3 p = vec3(o.x * ca - o.z * sa, o.y, o.x * sa + o.z * ca) + uSeed * 1.37;
  float turb = fbm(vec3(p.x * 3.2, p.y * 7., p.z * 3.2), 5);
  float shear = fbm(vec3(p.x * 1.1, p.y * 2.2, p.z * 1.1) + 9., 3);
  float band = sin((lat * uBands + uWarp * (turb - .5) * 4. + shear * .8) * 3.14159);
  float band2 = sin((lat * uBands * 2.3 + uWarp * (turb - .5) * 6.) * 3.14159 + 1.3);
  float t = clamp(.5 + .45 * band + .15 * band2, 0., 1.);
  vec3 alb = mix(uShade, uBase, smoothstep(.1, .5, t));
  alb = mix(alb, uAccent, smoothstep(.5, .95, t));
  alb *= .92 + .16 * fbm(vec3(p.x * 14., p.y * 40., p.z * 14.), 3);
  // vortices: stretched cells + one seeded great storm
  vec2 w = worley(vec3(p.x * 2.4, p.y * 6.5, p.z * 2.4) + 3.);
  float vortex = (1. - smoothstep(.0, .22, w.x)) * smoothstep(.35, .8, turb);
  alb = mix(alb, uStorm, vortex * .55);
  vec3 sc = normalize(vec3(hash11(uSeed) - .5, (hash11(uSeed + 1.) - .5) * .7, hash11(uSeed + 2.) - .5));
  vec3 d = (o - sc);
  float spot = 1. - smoothstep(.0, .22, length(vec2(d.x * .7 + d.z * .7, d.y * 2.6)));
  alb = mix(alb, uStorm, spot * .6 * step(.0, dot(o, sc) - .3));

  float mu = max(dot(Ng, V), 0.);
  float term = smoothstep(-.1, .25, dot(Ng, L));   // soft: gas has no hard surface
  float shadow = occl(vViewPos, L, uOcc0) * occl(vViewPos, L, uOcc1);
  float ndl = max(dot(Ng, L), 0.);
  vec3 col = alb * uKeyColor * .6 * mix(ndl, 1., .08) * term * shadow + alb * uAmbient;
  // soft haze limb (scatter of sunlight, not emission)
  float limb = pow(1. - mu, 3.);
  col += uHaze * uKeyColor * limb * uHazeAmt * max(dot(Ng, L) * .8 + .2, 0.) * shadow;
  if (uEmit.y > 0.) {     // brown dwarf: very dim deep-red self emission, cooler on dark bands
    float e = (.35 + .65 * t) * (.55 + .45 * mu);
    col += blackbody(uEmit.x) * uEmit.y * e;
  }
  gl_FragColor = vec4(col, 1.);
}
`;

// ---------- star / neutron star surface (emissive) ----------
export const starFrag = /* glsl */ `
${NOISE}
${BLACKBODY}
uniform float uTime, uSeed, uTemp, uIntensity, uCells, uSpots, uLimbU;
varying vec3 vObj;
varying vec3 vNView;
varying vec3 vViewPos;
void main(){
  vec3 Ng = normalize(vNView);
  vec3 V = normalize(-vViewPos);
  float mu = clamp(dot(Ng, V), 0., 1.);
  vec3 p = vObj + uSeed * 2.1;
  float t = uTime * .05;
  float gran = 0.;
  if (uCells > .5) {
    vec2 w = worley(p * uCells + vec3(0., t, 0.));
    float cell = smoothstep(.0, .6, w.x);                   // bright cell centres, dark lanes
    float fine = vnoise(p * uCells * 3. + t * 4.);
    gran = (1. - cell) * .6 + (fine - .5) * .3;
  }
  float spots = 0.;
  if (uSpots > 0.) spots = smoothstep(.6, .75, fbm(p * 2.2 + 5., 3)) * uSpots;
  float limb = 1. - uLimbU * (1. - mu);                      // I(mu) = 1 - u(1 - mu)
  vec3 base = blackbody(uTemp);
  // limb is also redder: shift toward a cooler blackbody at the edge
  vec3 edge = blackbody(uTemp * .72);
  vec3 col = mix(edge, base, smoothstep(0., .6, mu));
  col *= limb * (1. + gran) * (1. - .75 * spots);
  gl_FragColor = vec4(col * uIntensity, 1.);
}
`;

// ---------- atmosphere shell (lit scatter, never emission) ----------
export const atmoVert = /* glsl */ `
varying vec3 vViewPos;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
export const atmoFrag = /* glsl */ `
${LIGHT}
uniform vec3 uCenter;      // view space
uniform float uRp, uRs;    // planet / shell radius (world)
uniform vec3 uTint;
uniform float uThick, uMie;
uniform vec4 uOcc0;
varying vec3 vViewPos;
bool sphere(vec3 ro, vec3 rd, float r, out float t0, out float t1){
  vec3 oc = ro - uCenter;
  float b = dot(oc, rd), c = dot(oc, oc) - r * r;
  float h = b * b - c;
  if (h < 0.) return false;
  h = sqrt(h); t0 = -b - h; t1 = -b + h;
  return true;
}
void main(){
  vec3 rd = normalize(vViewPos);
  float s0, s1;
  if (!sphere(vec3(0.), rd, uRs, s0, s1)) discard;
  s0 = max(s0, 0.);
  float p0, p1;
  if (sphere(vec3(0.), rd, uRp, p0, p1) && p0 > 0.) s1 = min(s1, p0);
  vec3 L = normalize(uKeyDir);
  float mu = dot(rd, L);
  float g = .75 * uMie;
  float mie = (1. - g * g) / pow(1. + g * g - 2. * g * mu, 1.5) * .08;
  float ray = .75 * (1. + mu * mu) * .4;
  vec3 rayCol = uTint * mix(vec3(.8, 1., 1.25), vec3(1.), .2);    // blue-leaning Rayleigh
  vec3 acc = vec3(0.);
  float dt = (s1 - s0) / 7.;
  float H = max(uRs - uRp, 1e-4);
  float trans = 1.;
  for (int i = 0; i < 7; i++){
    float t = s0 + (float(i) + .5) * dt;
    vec3 P = rd * t;
    vec3 n = normalize(P - uCenter);
    float h = (length(P - uCenter) - uRp) / H;
    float dens = exp(-h * 3.5) * uThick;
    float lit = smoothstep(-.18, .35, dot(n, L)) * occl(P, L, uOcc0);
    acc += trans * dens * dt / H * lit * (rayCol * ray + vec3(mie));
    trans *= exp(-dens * dt / H * .6);
  }
  gl_FragColor = vec4(acc * uKeyColor * .55, 1.);
}
`;

// ---------- ring ----------
export const ringVert = /* glsl */ `
varying float vR;
varying vec3 vViewPos;
void main(){
  vR = position.z;           // radial 0..1 stashed in z by the geometry builder
  vec4 mv = modelViewMatrix * vec4(position.xy, 0., 1.);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;
export const ringFrag = /* glsl */ `
${NOISE}
${LIGHT}
uniform float uSeed;
uniform vec3 uColA, uColB;
uniform vec3 uNormalView;
uniform vec3 uPlanet; uniform float uPlanetR;
varying float vR;
varying vec3 vViewPos;
void main(){
  float r = vR;
  float n = vnoise(vec3(r * 60., uSeed, 1.)) * .6 + vnoise(vec3(r * 190., uSeed, 5.)) * .4;
  float gaps = smoothstep(.06, .1, abs(fract(r * 5. + hash11(uSeed) * 3.) - .5)) ;
  float dens = clamp((n * 1.3 - .15) * (.4 + .6 * gaps), 0., 1.);
  dens *= smoothstep(0., .04, r) * (1. - smoothstep(.94, 1., r));
  vec3 L = normalize(uKeyDir);
  float side = abs(dot(normalize(uNormalView), L));
  // planet shadow on the ring
  float shadow = occl(vViewPos, L, vec4(uPlanet, uPlanetR));
  vec3 col = mix(uColA, uColB, n) * uKeyColor * .6 * (.25 + .75 * side) * shadow + mix(uColA, uColB, n) * uAmbient;
  gl_FragColor = vec4(col, dens * .92);
}
`;

// ---------- instanced glow billboards (star corona, neutron-star halo): scatter-style soft sprites ----------
export const glowVert = /* glsl */ `
attribute vec4 aGlow;     // rgb tint scale in xyz, falloff power in w
attribute vec3 aGlow2;    // intensity, innerRadius (fraction of quad half-size), seed
varying vec2 vUv;
varying vec4 vGlow;
varying vec3 vGlow2;
void main(){
  vUv = position.xy;
  vGlow = aGlow; vGlow2 = aGlow2;
  vec4 c = viewMatrix * instanceMatrix[3];
  float s = length(instanceMatrix[0].xyz);
  vec4 mv = vec4(c.xyz + vec3(position.xy * s, 0.), 1.);
  gl_Position = projectionMatrix * mv;
}
`;
export const glowFrag = /* glsl */ `
${NOISE}
uniform float uTime;
varying vec2 vUv;
varying vec4 vGlow;
varying vec3 vGlow2;
void main(){
  float r = length(vUv);
  if (r > 1.) discard;
  float inner = vGlow2.y;
  float x = max(r - inner, 0.) / (1. - inner);
  float f = pow(1. - x, vGlow.w) * smoothstep(0., .02, r - inner * .0 + .02);
  float ang = atan(vUv.y, vUv.x);
  float streak = .85 + .3 * vnoise(vec3(ang * 3., uTime * .2, vGlow2.z));
  float a = (r < inner) ? 0. : f * streak * vGlow2.x * (1. - smoothstep(.85, 1., r));
  gl_FragColor = vec4(vGlow.rgb * a, 1.);
}
`;

// ---------- beam / jet cone (additive, scrolling noise) ----------
export const beamVert = /* glsl */ `
varying float vLen;
varying vec3 vNv;
varying vec3 vVP;
void main(){
  vLen = position.y;                       // cone along +y, y in 0..1, radius = y
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vVP = mv.xyz;
  vNv = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}
`;
export const beamFrag = /* glsl */ `
${NOISE}
uniform float uTime, uIntensity, uSeed;
uniform vec3 uColor;
varying float vLen;
varying vec3 vNv;
varying vec3 vVP;
void main(){
  // wall facing the viewer is the cone's centre line seen through: brighter where the wall is face-on
  float mu = abs(dot(normalize(vNv), normalize(-vVP)));
  float core = pow(mu, 2.2);
  float knots = .65 + .6 * vnoise(vec3(vLen * 18. - uTime * 3., uSeed, 1.));
  float fade = (1. - vLen) * (1. - vLen) * smoothstep(0., .03, vLen);
  gl_FragColor = vec4(uColor * core * knots * fade * uIntensity, 1.);
}
`;
