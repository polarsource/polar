import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Shape } from 'three';
import { toCreasedNormals } from 'three-stdlib';

const eps = 0.00001;
function createShape(width, height, radius0) {
  const shape = new Shape();
  const radius = radius0 - eps;
  shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
  shape.absarc(eps, height - radius * 2, eps, Math.PI, Math.PI / 2, true);
  shape.absarc(width - radius * 2, height - radius * 2, eps, Math.PI / 2, 0, true);
  shape.absarc(width - radius * 2, eps, eps, 0, -Math.PI / 2, true);
  return shape;
}
const RoundedBox = /* @__PURE__ */React.forwardRef(function RoundedBox({
  args: [width = 1, height = 1, depth = 1] = [],
  radius = 0.05,
  steps = 1,
  smoothness = 4,
  bevelSegments = 4,
  creaseAngle = 0.4,
  children,
  ...rest
}, ref) {
  const shape = React.useMemo(() => createShape(width, height, radius), [width, height, radius]);
  const params = React.useMemo(() => ({
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: bevelSegments * 2,
    steps,
    bevelSize: radius - eps,
    bevelThickness: radius,
    curveSegments: smoothness
  }), [depth, radius, smoothness]);
  const geomRef = React.useRef(null);
  React.useLayoutEffect(() => {
    if (geomRef.current) {
      geomRef.current.center();
      toCreasedNormals(geomRef.current, creaseAngle);
    }
  }, [shape, params]);
  return /*#__PURE__*/React.createElement("mesh", _extends({
    ref: ref
  }, rest), /*#__PURE__*/React.createElement("extrudeGeometry", {
    ref: geomRef,
    args: [shape, params]
  }), children);
});

export { RoundedBox };
