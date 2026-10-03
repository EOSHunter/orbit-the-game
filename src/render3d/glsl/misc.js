// Black hole (lensed disc), sky, far-field dots, particles, relation outlines, grade pass.
import { NOISE, BLACKBODY, SKY } from './noise.js';

// ---------------- black hole: ray-marched Schwarzschild null geodesics inside a billboard ----------------
export const bhVert = /* glsl */ `
uniform vec3 uCenter;      // world
uniform float uHalf;       // quad half size (world)
varying vec2 vUv;
varying vec3 vViewPos;
void main(){
  vUv = position.xy;
  vec4 c = viewMatrix * vec4(uCenter, 1.);
  vec3 p = c.xyz + vec3(position.xy * uHalf, 0.);
  vViewPos = p;
  gl_Position = projectionMatrix * vec4(p, 1.);
}
`;
export const bhFrag = /* glsl */ `
${NOISE}
${BLACKBODY}
${SKY}
uniform vec3 uCenter;
uniform float uR;              // shadow radius (world) == body.radius
uniform float uHalf;
uniform vec3 uDiscN;           // disc normal, view space
uniform vec3 uDiscE1;          // disc basis, view space
uniform float uDiscT;          // inner-edge temperature (K)
uniform float uDiscI;          // 0 = no disc (cause not whitelisted)
uniform float uLens;           // 1 normal, >1 when a capture is under way
uniform float uTime;
uniform int uSteps;
uniform samplerCube uCubeA;
uniform samplerCube uCubeB;
uniform float uSkyMix;
uniform float uSkyGain;
varying vec2 vUv;
varying vec3 vViewPos;

vec3 skyAt(vec3 vView){
  vec3 dw = transpose(mat3(viewMatrix)) * vView;
  vec3 c = mix(textureCube(uCubeA, dw).rgb, textureCube(uCubeB, dw).rgb, uSkyMix) * uSkyGain;
  c += starLayer(dw, 38., uSkySeed, 3.5, 900.) * 1.0;
  return c;
}

void main(){
  vec3 d = normalize(vViewPos);
  vec4 cv = viewMatrix * vec4(uCenter, 1.);
  vec3 o = -cv.xyz / uR;                       // camera in units of the shadow radius
  float rs = .385 * uLens;                     // shadow radius 2.6 rs == 1 (at uLens = 1)
  float rin = 3. * .385, rout = 5.2;
  vec3 n = normalize(uDiscN);
  vec3 e1 = normalize(uDiscE1), e2 = cross(n, e1);

  vec3 col = vec3(0.);
  float trans = 1.;
  bool captured = false;
  vec3 v = d;
  float tc = -dot(o, d);
  float b2 = dot(o, o) - tc * tc;
  float R0 = 14.;
  if (b2 < R0 * R0) {
    float tS = max(tc - sqrt(R0 * R0 - b2), 0.);
    vec3 x = o + d * tS;
    for (int i = 0; i < 160; i++){
      if (i >= uSteps) break;
      float r = length(x);
      if (r < rs) { captured = true; break; }
      if (r > R0 && dot(x, v) > 0.) break;
      float dt = clamp(.09 * r, .035, .7);
      vec3 L3 = cross(x, v);
      vec3 a = -1.5 * rs * dot(L3, L3) / (r * r * r * r * r) * x;
      v = normalize(v + a * dt);
      vec3 xn = x + v * dt;
      float y0 = dot(x, n), y1 = dot(xn, n);
      if (uDiscI > 0. && y0 * y1 < 0.) {
        float f = y0 / (y0 - y1);
        vec3 xc = mix(x, xn, f);
        float rc = length(xc);
        if (rc > rin * .98 && rc < rout) {
          float Td = uDiscT * pow(rin / rc, .75);
          vec3 vd = normalize(cross(n, xc));
          float beta = .55 * sqrt(rin / rc);
          float D = 1. / (sqrt(1. - beta * beta) * (1. - beta * dot(vd, -v)));
          float ph = atan(dot(xc, e2), dot(xc, e1)) - uTime * .6 * pow(rin / rc, 1.5);
          vec3 tp = vec3(rc * 2.2, cos(ph) * 1.6, sin(ph) * 1.6);
          float turb = .6 + .8 * fbm(tp * vec3(1., 1.6, 1.6), 4);
          float edge = smoothstep(rin * .98, rin * 1.12, rc) * (1. - smoothstep(rout * .7, rout, rc));
          vec3 em = blackbody(Td * D) * min(pow(D, 2.2), 3.) * pow(rin / rc, 1.6) * turb * edge * uDiscI * .16;
          col += trans * em;
          trans *= .12;
        }
      }
      x = xn;
    }
  }
  if (!captured) col += trans * skyAt(v);
  float edgeFade = 1. - smoothstep(.82, 1., max(abs(vUv.x), abs(vUv.y)));
  // only the lensed / disc / shadow part is opaque; un-deflected sky stays transparent so bodies behind show through
  float lensed = captured ? 1. : clamp((1. - trans) + smoothstep(.0015, .02, 1. - dot(d, v)), 0., 1.);
  gl_FragColor = vec4(col, edgeFade * lensed);
}
`;

// ---------------- sky: cube bake + display + crisp stars ----------------
export const skyBakeVert = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;
export const skyBakeFrag = /* glsl */ `
${NOISE}
${SKY}
varying vec3 vDir;
void main(){ gl_FragColor = vec4(skyBake(normalize(vDir)), 1.); }
`;
export const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.);
  gl_Position = p.xyww;
}
`;
export const skyFrag = /* glsl */ `
uniform samplerCube uCubeA;
uniform samplerCube uCubeB;
uniform float uSkyMix;
uniform float uSkyGain;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  gl_FragColor = vec4(mix(textureCube(uCubeA, d).rgb, textureCube(uCubeB, d).rgb, uSkyMix) * uSkyGain, 1.);
}
`;
export const starsVert = /* glsl */ `
attribute vec4 aStar;     // rgb tint, size px in a separate attribute
attribute float aPx;
uniform float uViewH;
uniform float uPixelRatio;
varying vec3 vC;
void main(){
  vC = aStar.rgb * aStar.w;
  vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.);
  gl_Position = p.xyww;
  gl_PointSize = aPx * uPixelRatio;
}
`;
export const starsFrag = /* glsl */ `
uniform float uSkyGain;
varying vec3 vC;
void main(){
  float d = length(gl_PointCoord - .5) * 2.;
  float a = smoothstep(1., 0., d);
  a *= a;
  gl_FragColor = vec4(vC * a * uSkyGain, a);
}
`;

// ---------------- far-field / sub-pixel dots (impostors) ----------------
export const dotsVert = /* glsl */ `
attribute float aSize;     // world radius
attribute vec4 aColor;     // rgb (HDR for stars), a = 1 for sub-pixel near bodies, 0 for far impostors (cross-fade)
uniform float uViewH;
uniform float uPixelRatio;
varying vec3 vC;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  float dist = max(-mv.z, 1e-3);
  float px = aSize * projectionMatrix[1][1] * uViewH * .5 / dist;     // radius in px
  float fade = mix(1. - smoothstep(2.5, 7., px), 1., aColor.a);
  gl_PointSize = clamp(max(px * 2., 1.8), 1.8, 40.) * uPixelRatio;
  vC = aColor.rgb;
  vA = fade * clamp(px * 2. / 1.8, .35, 1.);
  gl_Position = projectionMatrix * mv;
}
`;
export const dotsFrag = /* glsl */ `
varying vec3 vC;
varying float vA;
void main(){
  float d = length(gl_PointCoord - .5) * 2.;
  float a = smoothstep(1., .35, d) * vA;
  if (a < .01) discard;
  gl_FragColor = vec4(vC, a);
}
`;

// ---------------- particles (events only): glow pool (additive) and dust pool (grey, normal blend) ----------------
export const partVert = /* glsl */ `
attribute float aSize;     // world radius
attribute vec4 aState;     // temperatureK (0 = dust), brightness/alpha, shape (0 disc, 1 ring), age01
uniform float uViewH;
uniform float uPixelRatio;
varying vec4 vS;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  float dist = max(-mv.z, 1e-3);
  float px = aSize * projectionMatrix[1][1] * uViewH * .5 / dist;
  gl_PointSize = clamp(px * 2., 1.5, 420.) * uPixelRatio;
  vS = aState;
  gl_Position = projectionMatrix * mv;
}
`;
export const partFrag = /* glsl */ `
${BLACKBODY}
varying vec4 vS;
void main(){
  vec2 q = (gl_PointCoord - .5) * 2.;
  float d = length(q);
  if (d > 1.) discard;
  float shape = vS.z;
  float m;
  if (shape > .5) {                      // expanding shock ring (evolve / impact)
    float w = .12 + .25 * vS.w;
    m = smoothstep(1. - w * 2., 1. - w, d) * (1. - smoothstep(1. - w, 1., d));
  } else {
    m = pow(1. - d, 1.6);
  }
  vec3 c = vS.x > 0. ? blackbody(vS.x) : vec3(.42, .41, .4);
  float a = m * vS.y;
  if (a < .003) discard;
  gl_FragColor = vec4(c, a);
}
`;

// ---------------- relation outlines (HUD overlay pass; never touches lit materials) ----------------
export const outlineVert = /* glsl */ `
attribute vec4 aCol;       // rgb, alpha
varying vec2 vUv;
varying vec4 vC;
varying float vW;
uniform float uViewH;
uniform float uPixelRatio;
void main(){
  vUv = position.xy;
  vC = aCol;
  vec4 c = viewMatrix * instanceMatrix[3];
  float s = length(instanceMatrix[0].xyz);
  float dist = max(-c.z, 1e-3);
  float k = projectionMatrix[1][1] * uViewH * .5 / dist;         // px per world unit
  float rpx = max(s * k * 1.14, 9. * uPixelRatio);
  float sw = rpx / k;
  vW = 1.6 * uPixelRatio / rpx;
  gl_Position = projectionMatrix * vec4(c.xyz + vec3(position.xy * sw, 0.), 1.);
}
`;
export const outlineFrag = /* glsl */ `
varying vec2 vUv;
varying vec4 vC;
varying float vW;
void main(){
  float d = length(vUv);
  float a = (1. - smoothstep(vW, vW * 2., abs(d - 1. + vW)));
  if (a < .01 || d > 1.2) discard;
  gl_FragColor = vec4(vC.rgb, a * vC.a);
}
`;

// ---------------- final grade: vignette, hit chromatic aberration, death desaturation ----------------
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: .35 }, uCA: { value: 0 }, uDesat: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVig, uCA, uDesat, uFlash; varying vec2 vUv;
    void main(){
      vec2 c = vUv - .5;
      float r2 = dot(c, c);
      vec2 off = c * uCA * (.4 + r2 * 2.);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float l = dot(col, vec3(.2126, .7152, .0722));
      col = mix(col, vec3(l), uDesat);
      col *= 1. - uVig * smoothstep(.1, .62, r2 * 1.6);
      col += uFlash;
      gl_FragColor = vec4(col, 1.);
    }`,
};
