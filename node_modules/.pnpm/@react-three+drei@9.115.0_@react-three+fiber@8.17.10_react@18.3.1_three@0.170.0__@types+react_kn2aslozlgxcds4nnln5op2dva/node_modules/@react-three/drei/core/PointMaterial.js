import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { version } from '../helpers/constants.js';

const opaque_fragment = version >= 154 ? 'opaque_fragment' : 'output_fragment';
class PointMaterialImpl extends THREE.PointsMaterial {
  constructor(props) {
    super(props);
    this.onBeforeCompile = (shader, renderer) => {
      const {
        isWebGL2
      } = renderer.capabilities;
      shader.fragmentShader = shader.fragmentShader.replace(`#include <${opaque_fragment}>`, `
        ${!isWebGL2 ? `#extension GL_OES_standard_derivatives : enable\n#include <${opaque_fragment}>` : `#include <${opaque_fragment}>`}
      vec2 cxy = 2.0 * gl_PointCoord - 1.0;
      float r = dot(cxy, cxy);
      float delta = fwidth(r);     
      float mask = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);
      gl_FragColor = vec4(gl_FragColor.rgb, mask * gl_FragColor.a );
      #include <tonemapping_fragment>
      #include <${version >= 154 ? 'colorspace_fragment' : 'encodings_fragment'}>
      `);
    };
  }
}
const PointMaterial = /* @__PURE__ */React.forwardRef((props, ref) => {
  const [material] = React.useState(() => new PointMaterialImpl(null));
  return /*#__PURE__*/React.createElement("primitive", _extends({}, props, {
    object: material,
    ref: ref,
    attach: "material"
  }));
});

export { PointMaterial, PointMaterialImpl };
