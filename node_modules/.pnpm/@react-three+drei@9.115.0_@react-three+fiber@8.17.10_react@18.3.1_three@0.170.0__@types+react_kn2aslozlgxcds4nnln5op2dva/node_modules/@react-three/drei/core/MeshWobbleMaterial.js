import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';

class WobbleMaterialImpl extends MeshStandardMaterial {
  constructor(parameters = {}) {
    super(parameters);
    this.setValues(parameters);
    this._time = {
      value: 0
    };
    this._factor = {
      value: 1
    };
  }

  // FIXME Use `THREE.WebGLProgramParametersWithUniforms` type when able to target @types/three@0.160.0
  onBeforeCompile(shader) {
    shader.uniforms.time = this._time;
    shader.uniforms.factor = this._factor;
    shader.vertexShader = `
      uniform float time;
      uniform float factor;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `float theta = sin( time + position.y ) / 2.0 * factor;
        float c = cos( theta );
        float s = sin( theta );
        mat3 m = mat3( c, 0, s, 0, 1, 0, -s, 0, c );
        vec3 transformed = vec3( position ) * m;
        vNormal = vNormal * m;`);
  }
  get time() {
    return this._time.value;
  }
  set time(v) {
    this._time.value = v;
  }
  get factor() {
    return this._factor.value;
  }
  set factor(v) {
    this._factor.value = v;
  }
}
const MeshWobbleMaterial = /* @__PURE__ */React.forwardRef(({
  speed = 1,
  ...props
}, ref) => {
  const [material] = React.useState(() => new WobbleMaterialImpl());
  useFrame(state => material && (material.time = state.clock.getElapsedTime() * speed));
  return /*#__PURE__*/React.createElement("primitive", _extends({
    object: material,
    ref: ref,
    attach: "material"
  }, props));
});

export { MeshWobbleMaterial };
