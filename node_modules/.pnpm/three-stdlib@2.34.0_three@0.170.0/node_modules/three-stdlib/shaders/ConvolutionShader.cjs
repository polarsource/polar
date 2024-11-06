"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const ConvolutionShader = {
  defines: {
    KERNEL_SIZE_FLOAT: "25.0",
    KERNEL_SIZE_INT: "25"
  },
  uniforms: {
    tDiffuse: { value: null },
    uImageIncrement: { value: new THREE.Vector2(1953125e-9, 0) },
    cKernel: { value: [] }
  },
  vertexShader: [
    "uniform vec2 uImageIncrement;",
    "varying vec2 vUv;",
    "void main() {",
    "	vUv = uv - ( ( KERNEL_SIZE_FLOAT - 1.0 ) / 2.0 ) * uImageIncrement;",
    "	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
    "}"
  ].join("\n"),
  fragmentShader: [
    "uniform float cKernel[ KERNEL_SIZE_INT ];",
    "uniform sampler2D tDiffuse;",
    "uniform vec2 uImageIncrement;",
    "varying vec2 vUv;",
    "void main() {",
    "	vec2 imageCoord = vUv;",
    "	vec4 sum = vec4( 0.0, 0.0, 0.0, 0.0 );",
    "	for( int i = 0; i < KERNEL_SIZE_INT; i ++ ) {",
    "		sum += texture2D( tDiffuse, imageCoord ) * cKernel[ i ];",
    "		imageCoord += uImageIncrement;",
    "	}",
    "	gl_FragColor = sum;",
    "}"
  ].join("\n"),
  buildKernel: function(sigma) {
    function gauss(x, sigma2) {
      return Math.exp(-(x * x) / (2 * sigma2 * sigma2));
    }
    const kMaxKernelSize = 25;
    const kernelSize = Math.min(2 * Math.ceil(sigma * 3) + 1, kMaxKernelSize);
    const halfWidth = (kernelSize - 1) * 0.5;
    const values = new Array(kernelSize);
    let sum = 0;
    for (let i = 0; i < kernelSize; ++i) {
      values[i] = gauss(i - halfWidth, sigma);
      sum += values[i];
    }
    for (let i = 0; i < kernelSize; ++i)
      values[i] /= sum;
    return values;
  }
};
exports.ConvolutionShader = ConvolutionShader;
//# sourceMappingURL=ConvolutionShader.cjs.map
