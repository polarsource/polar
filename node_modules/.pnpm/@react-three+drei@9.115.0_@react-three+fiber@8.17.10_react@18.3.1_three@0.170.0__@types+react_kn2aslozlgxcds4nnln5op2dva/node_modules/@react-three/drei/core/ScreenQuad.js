import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';

function createScreenQuadGeometry() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
  geometry.boundingSphere = new THREE.Sphere();
  geometry.boundingSphere.set(new THREE.Vector3(), Infinity);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 2));
  return geometry;
}
const ScreenQuad = /* @__PURE__ */React.forwardRef(function ScreenQuad({
  children,
  ...restProps
}, ref) {
  const geometry = React.useMemo(createScreenQuadGeometry, []);
  return /*#__PURE__*/React.createElement("mesh", _extends({
    ref: ref,
    geometry: geometry,
    frustumCulled: false
  }, restProps), children);
});

export { ScreenQuad };
