import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { MeshPhysicalMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import distort from '../helpers/glsl/distort.vert.glsl.js';

class DistortMaterialImpl extends MeshPhysicalMaterial {
  constructor(parameters = {}) {
    super(parameters);
    this.setValues(parameters);
    this._time = {
      value: 0
    };
    this._distort = {
      value: 0.4
    };
    this._radius = {
      value: 1
    };
  }

  // FIXME Use `THREE.WebGLProgramParametersWithUniforms` type when able to target @types/three@0.160.0
  onBeforeCompile(shader) {
    shader.uniforms.time = this._time;
    shader.uniforms.radius = this._radius;
    shader.uniforms.distort = this._distort;
    shader.vertexShader = `
      uniform float time;
      uniform float radius;
      uniform float distort;
      ${distort}
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        float updateTime = time / 50.0;
        float noise = snoise(vec3(position / 2.0 + updateTime * 5.0));
        vec3 transformed = vec3(position * (noise * pow(distort, 2.0) + radius));
        `);
  }
  get time() {
    return this._time.value;
  }
  set time(v) {
    this._time.value = v;
  }
  get distort() {
    return this._distort.value;
  }
  set distort(v) {
    this._distort.value = v;
  }
  get radius() {
    return this._radius.value;
  }
  set radius(v) {
    this._radius.value = v;
  }
}
const MeshDistortMaterial = /* @__PURE__ */React.forwardRef(({
  speed = 1,
  ...props
}, ref) => {
  const [material] = React.useState(() => new DistortMaterialImpl());
  useFrame(state => material && (material.time = state.clock.getElapsedTime() * speed));
  return /*#__PURE__*/React.createElement("primitive", _extends({
    object: material,
    ref: ref,
    attach: "material"
  }, props));
});

export { MeshDistortMaterial };
