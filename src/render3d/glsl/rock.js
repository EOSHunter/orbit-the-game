// Instanced procedural rock/metal/ice/lava surfaces: meteorite, asteroid, debris, fragment,
// comet nucleus, dwarf planet, airless/lava/metallic rocky planet.
// Everything per instance arrives as attributes; nothing here glows unless aE says so (the CPU
// only writes aE for causes on the emitter whitelist).
import { NOISE, BLACKBODY } from './noise.js';
import { LIGHT } from './common.js';

export const rockVert = /* glsl */ `
${NOISE}
${LIGHT}
attribute float aSeed;
attribute vec3 aColA;
attribute vec3 aColB;
attribute vec4 aP;      // craterDensity, sizeExp, roughness, elongation
attribute vec4 aM;      // metalness, albedoScale, kind(0 rock,1 metal,2 lava,3 ice), lump
attribute vec2 aE;      // emissionK, emissionIntensity
attribute vec4 aOcc0;
attribute vec4 aOcc1;
attribute vec4 aStretch; // world axis xyz, stretch (Roche)

varying vec3 vQ;
varying vec3 vNView;
varying vec3 vViewPos;
varying vec3 vSO;
varying float vScale;
varying float vPx;
varying vec3 vColA;
varying vec3 vColB;
varying vec4 vP;
varying vec4 vM;
varying vec2 vE;
varying vec4 vOcc0;
varying vec4 vOcc1;

vec3 shape(vec3 q, float seed, float elong, float lump){
  vec3 o = hash33(vec3(seed, seed * 1.7, 3.1)) * 10.;
  vec3 el = 1. + elong * (hash33(vec3(seed * .37, 5.5, seed)) - .5) * 1.5;
  float l = fbm(q * 1.4 + o, 3) - .5;
  return q * el * (1. + l * lump * 1.7);
}

void main(){
  vec3 q = normalize(position);
  vec3 up = abs(q.y) < .99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.);
  vec3 t1 = normalize(cross(q, up));
  vec3 t2 = cross(q, t1);
  float e = .03;
  vec3 P0 = shape(q, aSeed, aP.w, aM.w);
  vec3 P1 = shape(normalize(q + t1 * e), aSeed, aP.w, aM.w);
  vec3 P2 = shape(normalize(q + t2 * e), aSeed, aP.w, aM.w);
  vec3 n = normalize(cross(P1 - P0, P2 - P0));
  if (dot(n, q) < 0.) n = -n;

  float scale = length(instanceMatrix[0].xyz);
  mat3 R = mat3(instanceMatrix) / scale;
  vec4 wp = instanceMatrix * vec4(P0, 1.);
  vec3 center = instanceMatrix[3].xyz;
  wp.xyz += aStretch.xyz * dot(wp.xyz - center, aStretch.xyz) * aStretch.w;
  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;

  vQ = q;
  vNView = normalize(mat3(viewMatrix) * (R * n));
  vViewPos = mv.xyz;
  vSO = hash33(vec3(aSeed, aSeed * .31, 7.7)) * 31.;   // per-vertex (exact), never hash a interpolated seed
  vScale = scale;
  vPx = scale * projectionMatrix[1][1] * uViewH * .5 / max(-mv.z, 1e-4);
  vColA = aColA; vColB = aColB; vP = aP; vM = aM; vE = aE; vOcc0 = aOcc0; vOcc1 = aOcc1;
}
`;

export const rockFrag = /* glsl */ `
${NOISE}
${BLACKBODY}
${LIGHT}
varying vec3 vQ;
varying vec3 vNView;
varying vec3 vViewPos;
varying vec3 vSO;
varying float vScale;
varying float vPx;
varying vec3 vColA;
varying vec3 vColB;
varying vec4 vP;
varying vec4 vM;
varying vec2 vE;
varying vec4 vOcc0;
varying vec4 vOcc1;

void main(){
  vec3 Ng = normalize(vNView);
  vec3 V = normalize(-vViewPos);
  vec3 L = normalize(uKeyDir);
  vec3 q = vQ + vSO;
  // band-limit every noise octave to >= ~4-5 px features (prevents shimmer / speckle)
  float oct = clamp(log(max(vPx * .093, 1.) / 2.2) / log(2.3) + 1., 1., 3.);
  float fo = clamp(log2(max(vPx, 1.) / 80.) + 1., 1., 4.);

  float kind = vM.z;
  float dens = vP.x;
  float hc = (dens > .001) ? craterHeight(q, dens, vP.y, oct) : 0.;
  float rough = vP.z;
  float hn = (fbmL(q * 6., fo) - .5) * (.03 + .03 * rough);
  float H = (hc * .05 + hn) * vScale;

  // derivative bump mapping
  vec3 dpx = dFdx(vViewPos), dpy = dFdy(vViewPos);
  float dhx = dFdx(H), dhy = dFdy(H);
  vec3 r1 = cross(dpy, Ng), r2 = cross(Ng, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  vec3 N = normalize(abs(det) * Ng - grad);

  // albedo: two-tone base, crater floors dark and rims bright, steep slope brightening (fresh regolith)
  float tone = smoothstep(.3, .7, fbm(q * 3.1, 3));
  vec3 alb = mix(vColA, vColB, tone) * vM.y;
  alb *= 1. + clamp(hc, -1., 1.) * .3;
  alb *= 1. + (1. - clamp(dot(N, Ng), 0., 1.)) * 2.2;
  alb *= .92 + .16 * mix(.5, vnoise(q * 25.), smoothstep(150., 500., vPx));
  if (kind > 2.5) {        // ice: bright with blue shadows handled by ambient
    alb = mix(alb, vec3(.85, .9, 1.), .15);
  }

  float terminator = smoothstep(-.015, .05, dot(Ng, L));
  float ndl = max(dot(N, L), 0.) * terminator;
  float surge = 1. + .35 * smoothstep(.96, 1., dot(L, V));
  float shadow = occl(vViewPos, L, vOcc0) * occl(vViewPos, L, vOcc1);

  float metal = vM.x;
  vec3 col = alb * (1. - .6 * metal) * uKeyColor * ndl * shadow * surge;
  if (metal > .01) {
    vec3 Hh = normalize(L + V);
    float sp = pow(max(dot(N, Hh), 0.), mix(18., 90., 1. - rough)) * terminator * shadow;
    col += mix(vec3(1.), alb, .6) * uKeyColor * sp * metal * .8;
  }
  col += alb * uAmbient;

  // emission: ONLY when the CPU wrote it (whitelisted causes)
  if (vE.y > 0.) {
    float em;
    if (kind > 1.5 && kind < 2.5) {       // lava: glowing cracks + melt pools (cause hot-ground)
      vec2 w = worley(q * 3.2);
      float crack = 1. - smoothstep(0., .14, w.y - w.x);
      float pool = smoothstep(.62, .78, fbm(q * 2.2, 4));
      em = clamp(crack * (.5 + .8 * fbm(q * 9., 3)) + pool, 0., 1.5);
      col *= 1. - .6 * pool;
    } else {                              // uniform hot body (hot-debris, ablation, impact-flash)
      em = .75 + .35 * vnoise(q * 6. + uTime * .7);
    }
    col += blackbody(vE.x) * vE.y * em;
  }
  gl_FragColor = vec4(col, 1.);
}
`;
