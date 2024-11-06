import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { useFrame } from '@react-three/fiber';

const ScreenSpace = /* @__PURE__ */React.forwardRef(({
  children,
  depth = -1,
  ...rest
}, ref) => {
  const localRef = React.useRef(null);
  React.useImperativeHandle(ref, () => localRef.current, []);
  useFrame(({
    camera
  }) => {
    localRef.current.quaternion.copy(camera.quaternion);
    localRef.current.position.copy(camera.position);
  });
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: localRef
  }, rest), /*#__PURE__*/React.createElement("group", {
    "position-z": -depth
  }, children));
});

export { ScreenSpace };
