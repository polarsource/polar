import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree, useFrame } from '@react-three/fiber';
import * as React from 'react';
import { DeviceOrientationControls as DeviceOrientationControls$1 } from 'three-stdlib';

const DeviceOrientationControls = /* @__PURE__ */React.forwardRef((props, ref) => {
  const {
    camera,
    onChange,
    makeDefault,
    ...rest
  } = props;
  const defaultCamera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const get = useThree(state => state.get);
  const set = useThree(state => state.set);
  const explCamera = camera || defaultCamera;
  const controls = React.useMemo(() => new DeviceOrientationControls$1(explCamera), [explCamera]);
  React.useEffect(() => {
    const callback = e => {
      invalidate();
      if (onChange) onChange(e);
    };
    controls == null || controls.addEventListener == null || controls.addEventListener('change', callback);
    return () => controls == null || controls.removeEventListener == null ? void 0 : controls.removeEventListener('change', callback);
  }, [onChange, controls, invalidate]);
  useFrame(() => controls == null ? void 0 : controls.update(), -1);
  React.useEffect(() => {
    const current = controls;
    current == null || current.connect();
    return () => current == null ? void 0 : current.dispose();
  }, [controls]);
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
  return controls ? /*#__PURE__*/React.createElement("primitive", _extends({
    ref: ref,
    object: controls
  }, rest)) : null;
});

export { DeviceOrientationControls };
