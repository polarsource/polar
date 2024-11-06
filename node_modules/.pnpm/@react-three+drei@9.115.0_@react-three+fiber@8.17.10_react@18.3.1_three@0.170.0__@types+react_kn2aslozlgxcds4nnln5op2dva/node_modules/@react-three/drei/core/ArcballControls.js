import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree, useFrame } from '@react-three/fiber';
import * as React from 'react';
import { forwardRef, useMemo, useEffect } from 'react';
import { ArcballControls as ArcballControls$1 } from 'three-stdlib';

const ArcballControls = /* @__PURE__ */forwardRef(({
  camera,
  makeDefault,
  regress,
  domElement,
  onChange,
  onStart,
  onEnd,
  ...restProps
}, ref) => {
  const invalidate = useThree(state => state.invalidate);
  const defaultCamera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const events = useThree(state => state.events);
  const set = useThree(state => state.set);
  const get = useThree(state => state.get);
  const performance = useThree(state => state.performance);
  const explCamera = camera || defaultCamera;
  const explDomElement = domElement || events.connected || gl.domElement;
  const controls = useMemo(() => new ArcballControls$1(explCamera), [explCamera]);
  useFrame(() => {
    if (controls.enabled) controls.update();
  }, -1);
  useEffect(() => {
    controls.connect(explDomElement);
    return () => void controls.dispose();
  }, [explDomElement, regress, controls, invalidate]);
  useEffect(() => {
    const callback = e => {
      invalidate();
      if (regress) performance.regress();
      if (onChange) onChange(e);
    };
    controls.addEventListener('change', callback);
    if (onStart) controls.addEventListener('start', onStart);
    if (onEnd) controls.addEventListener('end', onEnd);
    return () => {
      controls.removeEventListener('change', callback);
      if (onStart) controls.removeEventListener('start', onStart);
      if (onEnd) controls.removeEventListener('end', onEnd);
    };
  }, [onChange, onStart, onEnd]);
  useEffect(() => {
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

export { ArcballControls };
