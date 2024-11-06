import * as React from 'react';
import * as THREE from 'three';
import { createPortal } from '@react-three/fiber';
import { Flow } from 'three-stdlib';

const CurveModifier = /* @__PURE__ */React.forwardRef(({
  children,
  curve
}, ref) => {
  const [scene] = React.useState(() => new THREE.Scene());
  const [obj, set] = React.useState();
  const modifier = React.useRef();
  React.useEffect(() => {
    modifier.current = new Flow(scene.children[0]);
    set(modifier.current.object3D);
  }, [children]);
  React.useEffect(() => {
    var _modifier$current;
    if (curve) (_modifier$current = modifier.current) == null || _modifier$current.updateCurve(0, curve);
  }, [curve]);
  React.useImperativeHandle(ref, () => ({
    moveAlongCurve: val => {
      var _modifier$current2;
      (_modifier$current2 = modifier.current) == null || _modifier$current2.moveAlongCurve(val);
    }
  }));
  return /*#__PURE__*/React.createElement(React.Fragment, null, createPortal(children, scene), obj && /*#__PURE__*/React.createElement("primitive", {
    object: obj
  }));
});

export { CurveModifier };
