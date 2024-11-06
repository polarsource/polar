import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree } from '@react-three/fiber';
import * as React from 'react';
import { PointerLockControls as PointerLockControls$1 } from 'three-stdlib';

const PointerLockControls = /* @__PURE__ */React.forwardRef(({
  domElement,
  selector,
  onChange,
  onLock,
  onUnlock,
  enabled = true,
  makeDefault,
  ...props
}, ref) => {
  const {
    camera,
    ...rest
  } = props;
  const setEvents = useThree(state => state.setEvents);
  const gl = useThree(state => state.gl);
  const defaultCamera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const events = useThree(state => state.events);
  const get = useThree(state => state.get);
  const set = useThree(state => state.set);
  const explCamera = camera || defaultCamera;
  const explDomElement = domElement || events.connected || gl.domElement;
  const controls = React.useMemo(() => new PointerLockControls$1(explCamera), [explCamera]);
  React.useEffect(() => {
    if (enabled) {
      controls.connect(explDomElement);
      // Force events to be centered while PLC is active
      const oldComputeOffsets = get().events.compute;
      setEvents({
        compute(event, state) {
          const offsetX = state.size.width / 2;
          const offsetY = state.size.height / 2;
          state.pointer.set(offsetX / state.size.width * 2 - 1, -(offsetY / state.size.height) * 2 + 1);
          state.raycaster.setFromCamera(state.pointer, state.camera);
        }
      });
      return () => {
        controls.disconnect();
        setEvents({
          compute: oldComputeOffsets
        });
      };
    }
  }, [enabled, controls]);
  React.useEffect(() => {
    const callback = e => {
      invalidate();
      if (onChange) onChange(e);
    };
    controls.addEventListener('change', callback);
    if (onLock) controls.addEventListener('lock', onLock);
    if (onUnlock) controls.addEventListener('unlock', onUnlock);

    // Enforce previous interaction
    const handler = () => controls.lock();
    const elements = selector ? Array.from(document.querySelectorAll(selector)) : [document];
    elements.forEach(element => element && element.addEventListener('click', handler));
    return () => {
      controls.removeEventListener('change', callback);
      if (onLock) controls.removeEventListener('lock', onLock);
      if (onUnlock) controls.removeEventListener('unlock', onUnlock);
      elements.forEach(element => element ? element.removeEventListener('click', handler) : undefined);
    };
  }, [onChange, onLock, onUnlock, selector, controls, invalidate]);
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
  }, rest));
});

export { PointerLockControls };
