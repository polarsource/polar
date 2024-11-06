import _extends from '@babel/runtime/helpers/esm/extends';
import { useFrame } from '@react-three/fiber';
import * as React from 'react';
import { forwardRef, useRef } from 'react';
import { Vector3 } from 'three';
import { calculateScaleFactor } from './calculateScaleFactor.js';

const worldPos = /* @__PURE__ */new Vector3();
/**
 * Wraps children in an `Object3D` and attempts to scale from
 * world units to screen units * scale factor.
 *
 * For example, this will render a box of roughly 1x1 pixel size,
 * independently of how far the camera is.
 *
 * ```jsx
 * <ScreenSizer>
 *   <Box />
 * </ScreenSizer>
 * ```
 */
const ScreenSizer = /* @__PURE__ */forwardRef(({
  scale = 1,
  ...props
}, ref) => {
  const container = useRef(null);
  React.useImperativeHandle(ref, () => container.current, []);
  useFrame(state => {
    const obj = container.current;
    if (!obj) return;
    const sf = calculateScaleFactor(obj.getWorldPosition(worldPos), scale, state.camera, state.size);
    obj.scale.setScalar(sf * scale);
  });
  return /*#__PURE__*/React.createElement("object3D", _extends({
    ref: container
  }, props));
});

export { ScreenSizer };
