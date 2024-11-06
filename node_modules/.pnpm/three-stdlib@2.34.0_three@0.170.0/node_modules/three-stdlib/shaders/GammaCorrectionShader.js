const GammaCorrectionShader = {
  uniforms: {
    tDiffuse: { value: null }
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
    "varying vec2 vUv;",
    "void main() {",
    "	vec4 tex = texture2D( tDiffuse, vUv );",
    "	#ifdef LinearTosRGB",
    "		gl_FragColor = LinearTosRGB( tex );",
    "	#else",
    "		gl_FragColor = sRGBTransferOETF( tex );",
    "	#endif",
    "}"
  ].join("\n")
};
export {
  GammaCorrectionShader
};
//# sourceMappingURL=GammaCorrectionShader.js.map
