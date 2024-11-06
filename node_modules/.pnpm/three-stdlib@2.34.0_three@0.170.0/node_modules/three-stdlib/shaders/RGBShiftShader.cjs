"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const RGBShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 5e-3 },
    angle: { value: 0 }
  },
  vertexShader: [
    "varying vec2 vUv;",
    "void main() {",
    "	vUv = uv;",
    "	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform sampler2D tDiffuse;",
    "uniform float amount;",
    "uniform float angle;",
    "varying vec2 vUv;",
    "void main() {",
    "	vec2 offset = amount * vec2( cos(angle), sin(angle));",
    "	vec4 cr = texture2D(tDiffuse, vUv + offset);",
    "	vec4 cga = texture2D(tDiffuse, vUv);",
    "	vec4 cb = texture2D(tDiffuse, vUv - offset);",
    "	gl_FragColor = vec4(cr.r, cga.g, cb.b, cga.a);",
    "}"
  ].join("\n")
};
exports.RGBShiftShader = RGBShiftShader;
//# sourceMappingURL=RGBShiftShader.cjs.map
