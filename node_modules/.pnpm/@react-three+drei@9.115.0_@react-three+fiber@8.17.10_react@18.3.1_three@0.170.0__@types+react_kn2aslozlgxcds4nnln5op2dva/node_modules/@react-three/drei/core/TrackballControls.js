import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree, useFrame } from '@react-three/fiber';
import * as React from 'react';
import { TrackballControls as TrackballControls$1 } from 'three-stdlib';

const TrackballControls = /* @__PURE__ */React.forwardRef(({
  makeDefault,
  camera,
  domElement,
  regress,
  onChange,
  onStart,
  onEnd,
  ...restProps
}, ref) => {
  const {
    invalidate,
    camera: defaultCamera,
    gl,
    events,
    set,
    get,
    performance,
    viewport
  } = useThree();
  const explCamera = camera || defaultCamera;
  const explDomElement = domElement || events.connected || gl.domElement;
  const controls = React.useMemo(() => new TrackballControls$1(explCamera), [explCamera]);
  useFrame(() => {
    if (controls.enabled) controls.update();
  }, -1);
  React.useEffect(() => {
    controls.connect(explDomElement);
    return () => void controls.dispose();
  }, [explDomElement, regress, controls, invalidate]);
  React.useEffect(() => {
    const callback = e => {
      invalidate();
      if (regress) performance.regress();
      if (onChange) onChange(e);
    };
    controls.addEventListener('change', callback);
    if (onStart) controls.addEventListener('start', onStart);
    if (onEnd) controls.addEventListener('end', onEnd);
    return () => {
      if (onStart) controls.removeEventListener('start', onStart);
      if (onEnd) controls.removeEventListener('end', onEnd);
      controls.removeEventListener('change', callback);
    };
  }, [onChange, onStart, onEnd, controls, invalidate]);
  React.useEffect(() => {
    controls.handleResize();
  }, [viewport]);
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
  return /*#__PURE__*/React.createElement("primitive", _extends({
    ref: ref,
    object: controls
  }, restProps));
});

export { TrackballControls };
