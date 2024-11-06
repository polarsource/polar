import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree, useFrame } from '@react-three/fiber';
import * as React from 'react';
import { FlyControls as FlyControls$1 } from 'three-stdlib';

const FlyControls = /* @__PURE__ */React.forwardRef(({
  domElement,
  ...props
}, fref) => {
  const {
    onChange,
    makeDefault,
    ...rest
  } = props;
  const invalidate = useThree(state => state.invalidate);
  const camera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const events = useThree(state => state.events);
  const get = useThree(state => state.get);
  const set = useThree(state => state.set);
  const explDomElement = domElement || events.connected || gl.domElement;
  const controls = React.useMemo(() => new FlyControls$1(camera), [camera]);
  React.useEffect(() => {
    controls.connect(explDomElement);
    return () => void controls.dispose();
  }, [explDomElement, controls, invalidate]);
  React.useEffect(() => {
    const callback = e => {
      invalidate();
      if (onChange) onChange(e);
    };
    controls.addEventListener == null || controls.addEventListener('change', callback);
    return () => controls.removeEventListener == null ? void 0 : controls.removeEventListener('change', callback);
  }, [onChange, invalidate]);
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
  useFrame((_, delta) => controls.update(delta));
  return /*#__PURE__*/React.createElement("primitive", _extends({
    ref: fref,
    object: controls,
    args: [camera, explDomElement]
  }, rest));
});

export { FlyControls };
