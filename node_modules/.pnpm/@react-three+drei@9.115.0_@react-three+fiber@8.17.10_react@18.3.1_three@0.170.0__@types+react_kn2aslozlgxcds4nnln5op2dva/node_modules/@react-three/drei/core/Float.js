import * as React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Float = /* @__PURE__ */React.forwardRef(({
  children,
  enabled = true,
  speed = 1,
  rotationIntensity = 1,
  floatIntensity = 1,
  floatingRange = [-0.1, 0.1],
  autoInvalidate = false,
  ...props
}, forwardRef) => {
  const ref = React.useRef(null);
  React.useImperativeHandle(forwardRef, () => ref.current, []);
  const offset = React.useRef(Math.random() * 10000);
  useFrame(state => {
    var _floatingRange$, _floatingRange$2;
    if (!enabled || speed === 0) return;
    if (autoInvalidate) state.invalidate();
    const t = offset.current + state.clock.getElapsedTime();
    ref.current.rotation.x = Math.cos(t / 4 * speed) / 8 * rotationIntensity;
    ref.current.rotation.y = Math.sin(t / 4 * speed) / 8 * rotationIntensity;
    ref.current.rotation.z = Math.sin(t / 4 * speed) / 20 * rotationIntensity;
    let yPosition = Math.sin(t / 4 * speed) / 10;
    yPosition = THREE.MathUtils.mapLinear(yPosition, -0.1, 0.1, (_floatingRange$ = floatingRange == null ? void 0 : floatingRange[0]) !== null && _floatingRange$ !== void 0 ? _floatingRange$ : -0.1, (_floatingRange$2 = floatingRange == null ? void 0 : floatingRange[1]) !== null && _floatingRange$2 !== void 0 ? _floatingRange$2 : 0.1);
    ref.current.position.y = yPosition * floatIntensity;
    ref.current.updateMatrix();
  });
  return /*#__PURE__*/React.createElement("group", props, /*#__PURE__*/React.createElement("group", {
    ref: ref,
    matrixAutoUpdate: false
  }, children));
});

export { Float };
