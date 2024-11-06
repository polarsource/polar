import { shaderMaterial } from '../core/shaderMaterial.js';

const DiscardMaterial = /* @__PURE__ */shaderMaterial({}, 'void main() { }', 'void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); discard;  }');

export { DiscardMaterial };
