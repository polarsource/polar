import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree } from '@react-three/fiber';
import * as React from 'react';
import * as THREE from 'three';
import { TransformControls as TransformControls$1 } from 'three-stdlib';

const TransformControls = /* @__PURE__ */React.forwardRef(({
  children,
  domElement,
  onChange,
  onMouseDown,
  onMouseUp,
  onObjectChange,
  object,
  makeDefault,
  camera,
  // Transform
  enabled,
  axis,
  mode,
  translationSnap,
  rotationSnap,
  scaleSnap,
  space,
  size,
  showX,
  showY,
  showZ,
  ...props
}, ref) => {
  // @ts-expect-error new in @react-three/fiber@7.0.5
  const defaultControls = useThree(state => state.controls);
  const gl = useThree(state => state.gl);
  const events = useThree(state => state.events);
  const defaultCamera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const get = useThree(state => state.get);
  const set = useThree(state => state.set);
  const explCamera = camera || defaultCamera;
  const explDomElement = domElement || events.connected || gl.domElement;
  const controls = React.useMemo(() => new TransformControls$1(explCamera, explDomElement), [explCamera, explDomElement]);
  const group = React.useRef(null);
  React.useLayoutEffect(() => {
    if (object) {
      controls.attach(object instanceof THREE.Object3D ? object : object.current);
    } else if (group.current instanceof THREE.Object3D) {
      controls.attach(group.current);
    }
    return () => void controls.detach();
  }, [object, children, controls]);
  React.useEffect(() => {
    if (defaultControls) {
      const callback = event => defaultControls.enabled = !event.value;
      controls.addEventListener('dragging-changed', callback);
      return () => controls.removeEventListener('dragging-changed', callback);
    }
  }, [controls, defaultControls]);
  const onChangeRef = React.useRef();
  const onMouseDownRef = React.useRef();
  const onMouseUpRef = React.useRef();
  const onObjectChangeRef = React.useRef();
  React.useLayoutEffect(() => void (onChangeRef.current = onChange), [onChange]);
  React.useLayoutEffect(() => void (onMouseDownRef.current = onMouseDown), [onMouseDown]);
  React.useLayoutEffect(() => void (onMouseUpRef.current = onMouseUp), [onMouseUp]);
  React.useLayoutEffect(() => void (onObjectChangeRef.current = onObjectChange), [onObjectChange]);
  React.useEffect(() => {
    const onChange = e => {
      invalidate();
      onChangeRef.current == null || onChangeRef.current(e);
    };
    const onMouseDown = e => onMouseDownRef.current == null ? void 0 : onMouseDownRef.current(e);
    const onMouseUp = e => onMouseUpRef.current == null ? void 0 : onMouseUpRef.current(e);
    const onObjectChange = e => onObjectChangeRef.current == null ? void 0 : onObjectChangeRef.current(e);
    controls.addEventListener('change', onChange);
    controls.addEventListener('mouseDown', onMouseDown);
    controls.addEventListener('mouseUp', onMouseUp);
    controls.addEventListener('objectChange', onObjectChange);
    return () => {
      controls.removeEventListener('change', onChange);
      controls.removeEventListener('mouseDown', onMouseDown);
      controls.removeEventListener('mouseUp', onMouseUp);
      controls.removeEventListener('objectChange', onObjectChange);
    };
  }, [invalidate, controls]);
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
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("primitive", {
    ref: ref,
    object: controls,
    enabled: enabled,
    axis: axis,
    mode: mode,
    translationSnap: translationSnap,
    rotationSnap: rotationSnap,
    scaleSnap: scaleSnap,
    space: space,
    size: size,
    showX: showX,
    showY: showY,
    showZ: showZ
  }), /*#__PURE__*/React.createElement("group", _extends({
    ref: group
  }, props), children));
});

export { TransformControls };
