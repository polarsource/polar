import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree, useFrame } from '@react-three/fiber';
import * as React from 'react';
import { MapControls as MapControls$1 } from 'three-stdlib';

const MapControls = /* @__PURE__ */React.forwardRef((props = {
  enableDamping: true
}, ref) => {
  const {
    domElement,
    camera,
    makeDefault,
    onChange,
    onStart,
    onEnd,
    ...rest
  } = props;
  const invalidate = useThree(state => state.invalidate);
  const defaultCamera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const events = useThree(state => state.events);
  const set = useThree(state => state.set);
  const get = useThree(state => state.get);
  const explDomElement = domElement || events.connected || gl.domElement;
  const explCamera = camera || defaultCamera;
  const controls = React.useMemo(() => new MapControls$1(explCamera), [explCamera]);
  React.useEffect(() => {
    controls.connect(explDomElement);
    const callback = e => {
      invalidate();
      if (onChange) onChange(e);
    };
    controls.addEventListener('change', callback);
    if (onStart) controls.addEventListener('start', onStart);
    if (onEnd) controls.addEventListener('end', onEnd);
    return () => {
      controls.dispose();
      controls.removeEventListener('change', callback);
      if (onStart) controls.removeEventListener('start', onStart);
      if (onEnd) controls.removeEventListener('end', onEnd);
    };
  }, [onChange, onStart, onEnd, controls, invalidate, explDomElement]);
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
  useFrame(() => controls.update(), -1);
  return /*#__PURE__*/React.createElement("primitive", _extends({
    ref: ref,
    object: controls,
    enableDamping: true
  }, rest));
});

export { MapControls };
