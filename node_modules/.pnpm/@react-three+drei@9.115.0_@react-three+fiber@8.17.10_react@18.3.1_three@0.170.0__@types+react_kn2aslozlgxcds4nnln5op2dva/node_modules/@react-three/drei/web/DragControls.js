import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useGesture } from '@use-gesture/react';

const initialModelPosition = new THREE.Vector3();
const mousePosition2D = new THREE.Vector2();
const mousePosition3D = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const dragPlaneNormal = new THREE.Vector3();
const dragPlane = new THREE.Plane();
const DragControls = /*#__PURE__*/React.forwardRef(({
  autoTransform = true,
  matrix,
  axisLock,
  dragLimits,
  onHover,
  onDragStart,
  onDrag,
  onDragEnd,
  children,
  dragConfig,
  ...props
}, fRef) => {
  const defaultControls = useThree(state => state.controls);
  const {
    camera,
    size,
    raycaster,
    invalidate
  } = useThree();
  const ref = React.useRef(null);
  const bind = useGesture({
    onHover: ({
      hovering
    }) => onHover && onHover(hovering !== null && hovering !== void 0 ? hovering : false),
    onDragStart: ({
      event
    }) => {
      if (defaultControls) defaultControls.enabled = false;
      const {
        point
      } = event;
      ref.current.matrix.decompose(initialModelPosition, new THREE.Quaternion(), new THREE.Vector3());
      mousePosition3D.copy(point);
      dragOffset.copy(mousePosition3D).sub(initialModelPosition);
      onDragStart && onDragStart(initialModelPosition);
      invalidate();
    },
    onDrag: ({
      xy: [dragX, dragY],
      intentional
    }) => {
      if (!intentional) return;
      const normalizedMouseX = (dragX - size.left) / size.width * 2 - 1;
      const normalizedMouseY = -((dragY - size.top) / size.height) * 2 + 1;
      mousePosition2D.set(normalizedMouseX, normalizedMouseY);
      raycaster.setFromCamera(mousePosition2D, camera);
      if (!axisLock) {
        camera.getWorldDirection(dragPlaneNormal).negate();
      } else {
        switch (axisLock) {
          case 'x':
            dragPlaneNormal.set(1, 0, 0);
            break;
          case 'y':
            dragPlaneNormal.set(0, 1, 0);
            break;
          case 'z':
            dragPlaneNormal.set(0, 0, 1);
            break;
        }
      }
      dragPlane.setFromNormalAndCoplanarPoint(dragPlaneNormal, mousePosition3D);
      raycaster.ray.intersectPlane(dragPlane, mousePosition3D);
      const previousLocalMatrix = ref.current.matrix.clone();
      const previousWorldMatrix = ref.current.matrixWorld.clone();
      const intendedNewPosition = new THREE.Vector3(mousePosition3D.x - dragOffset.x, mousePosition3D.y - dragOffset.y, mousePosition3D.z - dragOffset.z);
      if (dragLimits) {
        intendedNewPosition.x = dragLimits[0] ? Math.max(Math.min(intendedNewPosition.x, dragLimits[0][1]), dragLimits[0][0]) : intendedNewPosition.x;
        intendedNewPosition.y = dragLimits[1] ? Math.max(Math.min(intendedNewPosition.y, dragLimits[1][1]), dragLimits[1][0]) : intendedNewPosition.y;
        intendedNewPosition.z = dragLimits[2] ? Math.max(Math.min(intendedNewPosition.z, dragLimits[2][1]), dragLimits[2][0]) : intendedNewPosition.z;
      }
      if (autoTransform) {
        ref.current.matrix.setPosition(intendedNewPosition);
        const deltaLocalMatrix = ref.current.matrix.clone().multiply(previousLocalMatrix.invert());
        const deltaWorldMatrix = ref.current.matrix.clone().multiply(previousWorldMatrix.invert());
        onDrag && onDrag(ref.current.matrix, deltaLocalMatrix, ref.current.matrixWorld, deltaWorldMatrix);
      } else {
        const tempMatrix = new THREE.Matrix4().copy(ref.current.matrix);
        tempMatrix.setPosition(intendedNewPosition);
        const deltaLocalMatrix = tempMatrix.clone().multiply(previousLocalMatrix.invert());
        const deltaWorldMatrix = tempMatrix.clone().multiply(previousWorldMatrix.invert());
        onDrag && onDrag(tempMatrix, deltaLocalMatrix, ref.current.matrixWorld, deltaWorldMatrix);
      }
      invalidate();
    },
    onDragEnd: () => {
      if (defaultControls) defaultControls.enabled = true;
      onDragEnd && onDragEnd();
      invalidate();
    }
  }, {
    drag: {
      filterTaps: true,
      threshold: 1,
      ...(typeof dragConfig === 'object' ? dragConfig : {})
    }
  });
  React.useImperativeHandle(fRef, () => ref.current, []);
  React.useLayoutEffect(() => {
    if (!matrix) return;

    // If the matrix is a real matrix4 it means that the user wants to control the gizmo
    // In that case it should just be set, as a bare prop update would merely copy it
    ref.current.matrix = matrix;
  }, [matrix]);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: ref
  }, bind(), {
    matrix: matrix,
    matrixAutoUpdate: false
  }, props), children);
});

export { DragControls };
