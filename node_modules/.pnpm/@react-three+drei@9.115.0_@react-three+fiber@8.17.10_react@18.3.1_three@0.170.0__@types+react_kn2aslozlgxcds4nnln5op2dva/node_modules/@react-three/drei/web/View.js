import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import * as THREE from 'three';
import { context, useThree, createPortal, useFrame } from '@react-three/fiber';
import tunnel from 'tunnel-rat';

const isOrthographicCamera = def => def && def.isOrthographicCamera;
const col = new THREE.Color();
const tracked = tunnel();

/**
 * In `@react-three/fiber` after `v8.0.0` but prior to `v8.1.0`, `state.size` contained only dimension
 * information. After `v8.1.0`, position information (`top`, `left`) was added
 *
 * @todo remove this when drei supports v9 and up
 */

function isNonLegacyCanvasSize(size) {
  return 'top' in size;
}
function computeContainerPosition(canvasSize, trackRect) {
  const {
    right,
    top,
    left: trackLeft,
    bottom: trackBottom,
    width,
    height
  } = trackRect;
  const isOffscreen = trackRect.bottom < 0 || top > canvasSize.height || right < 0 || trackRect.left > canvasSize.width;
  if (isNonLegacyCanvasSize(canvasSize)) {
    const canvasBottom = canvasSize.top + canvasSize.height;
    const bottom = canvasBottom - trackBottom;
    const left = trackLeft - canvasSize.left;
    return {
      position: {
        width,
        height,
        left,
        top,
        bottom,
        right
      },
      isOffscreen
    };
  }
  // Fall back on old behavior if r3f < 8.1.0
  const bottom = canvasSize.height - trackBottom;
  return {
    position: {
      width,
      height,
      top,
      left: trackLeft,
      bottom,
      right
    },
    isOffscreen
  };
}
function prepareSkissor(state, {
  left,
  bottom,
  width,
  height
}) {
  let autoClear;
  const aspect = width / height;
  if (isOrthographicCamera(state.camera)) {
    if (state.camera.left !== width / -2 || state.camera.right !== width / 2 || state.camera.top !== height / 2 || state.camera.bottom !== height / -2) {
      Object.assign(state.camera, {
        left: width / -2,
        right: width / 2,
        top: height / 2,
        bottom: height / -2
      });
      state.camera.updateProjectionMatrix();
    }
  } else if (state.camera.aspect !== aspect) {
    state.camera.aspect = aspect;
    state.camera.updateProjectionMatrix();
  }
  autoClear = state.gl.autoClear;
  state.gl.autoClear = false;
  state.gl.setViewport(left, bottom, width, height);
  state.gl.setScissor(left, bottom, width, height);
  state.gl.setScissorTest(true);
  return autoClear;
}
function finishSkissor(state, autoClear) {
  // Restore the default state
  state.gl.setScissorTest(false);
  state.gl.autoClear = autoClear;
}
function clear(state) {
  state.gl.getClearColor(col);
  state.gl.setClearColor(col, state.gl.getClearAlpha());
  state.gl.clear(true, true);
}
function Container({
  visible = true,
  canvasSize,
  scene,
  index,
  children,
  frames,
  rect,
  track
}) {
  const rootState = useThree();
  const [isOffscreen, setOffscreen] = React.useState(false);
  let frameCount = 0;
  useFrame(state => {
    if (frames === Infinity || frameCount <= frames) {
      var _track$current;
      if (track) rect.current = (_track$current = track.current) == null ? void 0 : _track$current.getBoundingClientRect();
      frameCount++;
    }
    if (rect.current) {
      const {
        position,
        isOffscreen: _isOffscreen
      } = computeContainerPosition(canvasSize, rect.current);
      if (isOffscreen !== _isOffscreen) setOffscreen(_isOffscreen);
      if (visible && !isOffscreen && rect.current) {
        const autoClear = prepareSkissor(state, position);
        // When children are present render the portalled scene, otherwise the default scene
        state.gl.render(children ? state.scene : scene, state.camera);
        finishSkissor(state, autoClear);
      }
    }
  }, index);
  React.useLayoutEffect(() => {
    const curRect = rect.current;
    if (curRect && (!visible || !isOffscreen)) {
      // If the view is not visible clear it once, but stop rendering afterwards!
      const {
        position
      } = computeContainerPosition(canvasSize, curRect);
      const autoClear = prepareSkissor(rootState, position);
      clear(rootState);
      finishSkissor(rootState, autoClear);
    }
  }, [visible, isOffscreen]);
  React.useEffect(() => {
    if (!track) return;
    const curRect = rect.current;
    // Connect the event layer to the tracking element
    const old = rootState.get().events.connected;
    rootState.setEvents({
      connected: track.current
    });
    return () => {
      if (curRect) {
        const {
          position
        } = computeContainerPosition(canvasSize, curRect);
        const autoClear = prepareSkissor(rootState, position);
        clear(rootState);
        finishSkissor(rootState, autoClear);
      }
      rootState.setEvents({
        connected: old
      });
    };
  }, [track]);
  React.useEffect(() => {
    if (isNonLegacyCanvasSize(canvasSize)) return;
    console.warn('Detected @react-three/fiber canvas size does not include position information. <View /> may not work as expected. ' + 'Upgrade to @react-three/fiber ^8.1.0 for support.\n See https://github.com/pmndrs/drei/issues/944');
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, children, /*#__PURE__*/React.createElement("group", {
    onPointerOver: () => null
  }));
}
const CanvasView = /*#__PURE__*/React.forwardRef(({
  track,
  visible = true,
  index = 1,
  id,
  style,
  className,
  frames = Infinity,
  children,
  ...props
}, fref) => {
  var _rect$current, _rect$current2, _rect$current3, _rect$current4;
  const rect = React.useRef(null);
  const {
    size,
    scene
  } = useThree();
  const [virtualScene] = React.useState(() => new THREE.Scene());
  const [ready, toggle] = React.useReducer(() => true, false);
  const compute = React.useCallback((event, state) => {
    if (rect.current && track && track.current && event.target === track.current) {
      const {
        width,
        height,
        left,
        top
      } = rect.current;
      const x = event.clientX - left;
      const y = event.clientY - top;
      state.pointer.set(x / width * 2 - 1, -(y / height) * 2 + 1);
      state.raycaster.setFromCamera(state.pointer, state.camera);
    }
  }, [rect, track]);
  React.useEffect(() => {
    var _track$current2;
    // We need the tracking elements bounds beforehand in order to inject it into the portal
    if (track) rect.current = (_track$current2 = track.current) == null ? void 0 : _track$current2.getBoundingClientRect();
    // And now we can proceed
    toggle();
  }, [track]);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: fref
  }, props), ready && createPortal( /*#__PURE__*/React.createElement(Container, {
    visible: visible,
    canvasSize: size,
    frames: frames,
    scene: scene,
    track: track,
    rect: rect,
    index: index
  }, children), virtualScene, {
    events: {
      compute,
      priority: index
    },
    size: {
      width: (_rect$current = rect.current) == null ? void 0 : _rect$current.width,
      height: (_rect$current2 = rect.current) == null ? void 0 : _rect$current2.height,
      // @ts-ignore
      top: (_rect$current3 = rect.current) == null ? void 0 : _rect$current3.top,
      // @ts-ignore
      left: (_rect$current4 = rect.current) == null ? void 0 : _rect$current4.left
    }
  }));
});
const HtmlView = /*#__PURE__*/React.forwardRef(({
  as: El = 'div',
  id,
  visible,
  className,
  style,
  index = 1,
  track,
  frames = Infinity,
  children,
  ...props
}, fref) => {
  const uuid = React.useId();
  const ref = React.useRef(null);
  React.useImperativeHandle(fref, () => ref.current);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(El, _extends({
    ref: ref,
    id: id,
    className: className,
    style: style
  }, props)), /*#__PURE__*/React.createElement(tracked.In, null, /*#__PURE__*/React.createElement(CanvasView, {
    visible: visible,
    key: uuid,
    track: ref,
    frames: frames,
    index: index
  }, children)));
});
const View = /*#__PURE__*/React.forwardRef((props, fref) => {
  // If we're inside a canvas we should be able to access the context store
  const store = React.useContext(context);
  // If that's not the case we render a tunnel
  if (!store) return /*#__PURE__*/React.createElement(HtmlView, _extends({
    ref: fref
  }, props));
  // Otherwise a plain canvas-view
  else return /*#__PURE__*/React.createElement(CanvasView, _extends({
    ref: fref
  }, props));
});
View.Port = () => /*#__PURE__*/React.createElement(tracked.Out, null);

export { View };
