import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { FirstPersonControls as FirstPersonControls$1 } from 'three-stdlib';

const FirstPersonControls = /* @__PURE__ */React.forwardRef(({
  domElement,
  makeDefault,
  ...props
}, ref) => {
  const camera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const events = useThree(state => state.events);
  const get = useThree(state => state.get);
  const set = useThree(state => state.set);
  const explDomElement = domElement || events.connected || gl.domElement;
  const [controls] = React.useState(() => new FirstPersonControls$1(camera, explDomElement));
  React.useEffect(() => {
    if (makeDefault) {
      const old = get().controls;
      set({
        controls
      });
      return () => set({
        controls: old
      });
    }
  }, [makeDefault, controls]);
  useFrame((_, delta) => {
    controls.update(delta);
  }, -1);
  return controls ? /*#__PURE__*/React.createElement("primitive", _extends({
    ref: ref,
    object: controls
  }, props)) : null;
});

export { FirstPersonControls };
