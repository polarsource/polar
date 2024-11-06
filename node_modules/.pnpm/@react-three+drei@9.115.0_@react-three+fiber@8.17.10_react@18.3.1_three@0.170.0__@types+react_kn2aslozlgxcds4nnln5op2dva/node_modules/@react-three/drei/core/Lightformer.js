import _extends from '@babel/runtime/helpers/esm/extends';
import { applyProps } from '@react-three/fiber';
import * as React from 'react';
import * as THREE from 'three';

const Lightformer = /* @__PURE__ */React.forwardRef(({
  args,
  map,
  toneMapped = false,
  color = 'white',
  form: Form = 'rect',
  intensity = 1,
  scale = 1,
  target,
  children,
  ...props
}, forwardRef) => {
  // Apply emissive power
  const ref = React.useRef(null);
  React.useImperativeHandle(forwardRef, () => ref.current, []);
  React.useLayoutEffect(() => {
    if (!children && !props.material) {
      applyProps(ref.current.material, {
        color
      });
      ref.current.material.color.multiplyScalar(intensity);
    }
  }, [color, intensity, children, props.material]);

  // Target light
  React.useLayoutEffect(() => {
    if (target) ref.current.lookAt(Array.isArray(target) ? new THREE.Vector3(...target) : target);
  }, [target]);

  // Fix 2-dimensional scale
  scale = Array.isArray(scale) && scale.length === 2 ? [scale[0], scale[1], 1] : scale;
  return /*#__PURE__*/React.createElement("mesh", _extends({
    ref: ref,
    scale: scale
  }, props), Form === 'circle' ? /*#__PURE__*/React.createElement("ringGeometry", {
    args: [0, 1, 64]
  }) : Form === 'ring' ? /*#__PURE__*/React.createElement("ringGeometry", {
    args: [0.5, 1, 64]
  }) : Form === 'rect' ? /*#__PURE__*/React.createElement("planeGeometry", null) : /*#__PURE__*/React.createElement(Form, {
    args: args
  }), children ? children : !props.material ? /*#__PURE__*/React.createElement("meshBasicMaterial", {
    toneMapped: toneMapped,
    map: map,
    side: THREE.DoubleSide
  }) : null);
});

export { Lightformer };
