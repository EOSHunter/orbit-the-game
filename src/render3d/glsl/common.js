// Lighting chunk shared by all lit materials. One hard key light, view space.
export const LIGHT = /* glsl */ `
uniform vec3 uKeyDir;     // view space, unit, points TOWARD the key light
uniform vec3 uKeyColor;   // linear rgb * intensity
uniform vec3 uAmbient;    // tiny cool fill
uniform float uTime;
uniform float uViewH;

// Sphere-sphere occlusion of the sun (analytic eclipse). o = (centre view, radius). radius 0 => off.
float occl(vec3 P, vec3 L, vec4 o){
  if (o.w <= 0.) return 1.;
  vec3 oc = o.xyz - P;
  float t = dot(oc, L);
  if (t <= 0.) return 1.;
  float d = length(oc - L * t);
  float pen = o.w * .015 + t * .0093;
  return smoothstep(o.w - pen, o.w + pen, d);
}
`;
