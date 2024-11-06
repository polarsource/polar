import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Quaternion } from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Wraps children in a billboarded group. Sample usage:
 *
 * ```js
 * <Billboard>
 *   <Text>hi</Text>
 * </Billboard>
 * ```
 */
const Billboard = /* @__PURE__ */React.forwardRef(function Billboard({
  children,
  follow = true,
  lockX = false,
  lockY = false,
  lockZ = false,
  ...props
}, fref) {
  const inner = React.useRef(null);
  const localRef = React.useRef(null);
  const q = new Quaternion();
  useFrame(({
    camera
  }) => {
    if (!follow || !localRef.current) return;

    // save previous rotation in case we're locking an axis
    const prevRotation = localRef.current.rotation.clone();

    // always face the camera
    localRef.current.updateMatrix();
    localRef.current.updateWorldMatrix(false, false);
    localRef.current.getWorldQuaternion(q);
    camera.getWorldQuaternion(inner.current.quaternion).premultiply(q.invert());

    // readjust any axis that is locked
    if (lockX) localRef.current.rotation.x = prevRotation.x;
    if (lockY) localRef.current.rotation.y = prevRotation.y;
    if (lockZ) localRef.current.rotation.z = prevRotation.z;
  });
  React.useImperativeHandle(fref, () => localRef.current, []);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: localRef
  }, props), /*#__PURE__*/React.createElement("group", {
    ref: inner
  }, children));
});

export { Billboard };
