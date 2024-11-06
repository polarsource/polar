import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Sky as Sky$1 } from 'three-stdlib';
import { Vector3 } from 'three';

function calcPosFromAngles(inclination, azimuth, vector = new Vector3()) {
  const theta = Math.PI * (inclination - 0.5);
  const phi = 2 * Math.PI * (azimuth - 0.5);
  vector.x = Math.cos(phi);
  vector.y = Math.sin(theta);
  vector.z = Math.sin(phi);
  return vector;
}
const Sky = /* @__PURE__ */React.forwardRef(({
  inclination = 0.6,
  azimuth = 0.1,
  distance = 1000,
  mieCoefficient = 0.005,
  mieDirectionalG = 0.8,
  rayleigh = 0.5,
  turbidity = 10,
  sunPosition = calcPosFromAngles(inclination, azimuth),
  ...props
}, ref) => {
  const scale = React.useMemo(() => new Vector3().setScalar(distance), [distance]);
  const [sky] = React.useState(() => new Sky$1());
  return /*#__PURE__*/React.createElement("primitive", _extends({
    object: sky,
    ref: ref,
    "material-uniforms-mieCoefficient-value": mieCoefficient,
    "material-uniforms-mieDirectionalG-value": mieDirectionalG,
    "material-uniforms-rayleigh-value": rayleigh,
    "material-uniforms-sunPosition-value": sunPosition,
    "material-uniforms-turbidity-value": turbidity,
    scale: scale
  }, props));
});

export { Sky, calcPosFromAngles };
