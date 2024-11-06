import * as React from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Object3D, Matrix4, Quaternion } from 'three';
import { OrthographicCamera } from './OrthographicCamera.js';
import { Hud } from './Hud.js';

const Context = /* @__PURE__ */React.createContext({});
const useGizmoContext = () => {
  return React.useContext(Context);
};
const turnRate = 2 * Math.PI; // turn rate in angles per second
const dummy = /* @__PURE__ */new Object3D();
const matrix = /* @__PURE__ */new Matrix4();
const [q1, q2] = [/* @__PURE__ */new Quaternion(), /* @__PURE__ */new Quaternion()];
const target = /* @__PURE__ */new Vector3();
const targetPosition = /* @__PURE__ */new Vector3();
const isOrbitControls = controls => {
  return 'minPolarAngle' in controls;
};
const isCameraControls = controls => {
  return 'getTarget' in controls;
};
const GizmoHelper = ({
  alignment = 'bottom-right',
  margin = [80, 80],
  renderPriority = 1,
  onUpdate,
  onTarget,
  children
}) => {
  const size = useThree(state => state.size);
  const mainCamera = useThree(state => state.camera);
  // @ts-ignore
  const defaultControls = useThree(state => state.controls);
  const invalidate = useThree(state => state.invalidate);
  const gizmoRef = React.useRef(null);
  const virtualCam = React.useRef(null);
  const animating = React.useRef(false);
  const radius = React.useRef(0);
  const focusPoint = React.useRef(new Vector3(0, 0, 0));
  const defaultUp = React.useRef(new Vector3(0, 0, 0));
  React.useEffect(() => {
    defaultUp.current.copy(mainCamera.up);
  }, [mainCamera]);
  const tweenCamera = React.useCallback(direction => {
    animating.current = true;
    if (defaultControls || onTarget) {
      focusPoint.current = (onTarget == null ? void 0 : onTarget()) || (isCameraControls(defaultControls) ? defaultControls.getTarget(focusPoint.current) : defaultControls == null ? void 0 : defaultControls.target);
    }
    radius.current = mainCamera.position.distanceTo(target);

    // Rotate from current camera orientation
    q1.copy(mainCamera.quaternion);

    // To new current camera orientation
    targetPosition.copy(direction).multiplyScalar(radius.current).add(target);
    dummy.lookAt(targetPosition);
    q2.copy(dummy.quaternion);
    invalidate();
  }, [defaultControls, mainCamera, onTarget, invalidate]);
  useFrame((_, delta) => {
    if (virtualCam.current && gizmoRef.current) {
      var _gizmoRef$current;
      // Animate step
      if (animating.current) {
        if (q1.angleTo(q2) < 0.01) {
          animating.current = false;
          // Orbit controls uses UP vector as the orbit axes,
          // so we need to reset it after the animation is done
          // moving it around for the controls to work correctly
          if (isOrbitControls(defaultControls)) {
            mainCamera.up.copy(defaultUp.current);
          }
        } else {
          const step = delta * turnRate;
          // animate position by doing a slerp and then scaling the position on the unit sphere
          q1.rotateTowards(q2, step);
          // animate orientation
          mainCamera.position.set(0, 0, 1).applyQuaternion(q1).multiplyScalar(radius.current).add(focusPoint.current);
          mainCamera.up.set(0, 1, 0).applyQuaternion(q1).normalize();
          mainCamera.quaternion.copy(q1);
          if (isCameraControls(defaultControls)) defaultControls.setPosition(mainCamera.position.x, mainCamera.position.y, mainCamera.position.z);
          if (onUpdate) onUpdate();else if (defaultControls) defaultControls.update(delta);
          invalidate();
        }
      }

      // Sync Gizmo with main camera orientation
      matrix.copy(mainCamera.matrix).invert();
      (_gizmoRef$current = gizmoRef.current) == null || _gizmoRef$current.quaternion.setFromRotationMatrix(matrix);
    }
  });
  const gizmoHelperContext = React.useMemo(() => ({
    tweenCamera
  }), [tweenCamera]);

  // Position gizmo component within scene
  const [marginX, marginY] = margin;
  const x = alignment.endsWith('-center') ? 0 : alignment.endsWith('-left') ? -size.width / 2 + marginX : size.width / 2 - marginX;
  const y = alignment.startsWith('center-') ? 0 : alignment.startsWith('top-') ? size.height / 2 - marginY : -size.height / 2 + marginY;
  return /*#__PURE__*/React.createElement(Hud, {
    renderPriority: renderPriority
  }, /*#__PURE__*/React.createElement(Context.Provider, {
    value: gizmoHelperContext
  }, /*#__PURE__*/React.createElement(OrthographicCamera, {
    makeDefault: true,
    ref: virtualCam,
    position: [0, 0, 200]
  }), /*#__PURE__*/React.createElement("group", {
    ref: gizmoRef,
    position: [x, y, 0]
  }, children)));
};

export { GizmoHelper, useGizmoContext };
