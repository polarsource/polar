import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree, useFrame } from '@react-three/fiber';
import * as React from 'react';
import * as THREE from 'three';
import { AxisArrow } from './AxisArrow.js';
import { AxisRotator } from './AxisRotator.js';
import { PlaneSlider } from './PlaneSlider.js';
import { ScalingSphere } from './ScalingSphere.js';
import { context } from './context.js';
import { calculateScaleFactor } from '../../core/calculateScaleFactor.js';

const mL0 = /* @__PURE__ */new THREE.Matrix4();
const mW0 = /* @__PURE__ */new THREE.Matrix4();
const mP = /* @__PURE__ */new THREE.Matrix4();
const mPInv = /* @__PURE__ */new THREE.Matrix4();
const mW = /* @__PURE__ */new THREE.Matrix4();
const mL = /* @__PURE__ */new THREE.Matrix4();
const mL0Inv = /* @__PURE__ */new THREE.Matrix4();
const mdL = /* @__PURE__ */new THREE.Matrix4();
const mG = /* @__PURE__ */new THREE.Matrix4();
const bb = /* @__PURE__ */new THREE.Box3();
const bbObj = /* @__PURE__ */new THREE.Box3();
const vCenter = /* @__PURE__ */new THREE.Vector3();
const vSize = /* @__PURE__ */new THREE.Vector3();
const vAnchorOffset = /* @__PURE__ */new THREE.Vector3();
const vPosition = /* @__PURE__ */new THREE.Vector3();
const vScale = /* @__PURE__ */new THREE.Vector3();
const xDir = /* @__PURE__ */new THREE.Vector3(1, 0, 0);
const yDir = /* @__PURE__ */new THREE.Vector3(0, 1, 0);
const zDir = /* @__PURE__ */new THREE.Vector3(0, 0, 1);
const PivotControls = /* @__PURE__ */React.forwardRef(({
  enabled = true,
  matrix,
  onDragStart,
  onDrag,
  onDragEnd,
  autoTransform = true,
  anchor,
  disableAxes = false,
  disableSliders = false,
  disableRotations = false,
  disableScaling = false,
  activeAxes = [true, true, true],
  offset = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  lineWidth = 4,
  fixed = false,
  translationLimits,
  rotationLimits,
  scaleLimits,
  depthTest = true,
  axisColors = ['#ff2060', '#20df80', '#2080ff'],
  hoveredColor = '#ffff40',
  annotations = false,
  annotationsClass,
  opacity = 1,
  visible = true,
  userData,
  children,
  ...props
}, fRef) => {
  const invalidate = useThree(state => state.invalidate);
  const parentRef = React.useRef(null);
  const ref = React.useRef(null);
  const gizmoRef = React.useRef(null);
  const childrenRef = React.useRef(null);
  const translation = React.useRef([0, 0, 0]);
  const cameraScale = React.useRef(new THREE.Vector3(1, 1, 1));
  const gizmoScale = React.useRef(new THREE.Vector3(1, 1, 1));
  React.useLayoutEffect(() => {
    if (!anchor) return;
    childrenRef.current.updateWorldMatrix(true, true);
    mPInv.copy(childrenRef.current.matrixWorld).invert();
    bb.makeEmpty();
    childrenRef.current.traverse(obj => {
      if (!obj.geometry) return;
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      mL.copy(obj.matrixWorld).premultiply(mPInv);
      bbObj.copy(obj.geometry.boundingBox);
      bbObj.applyMatrix4(mL);
      bb.union(bbObj);
    });
    vCenter.copy(bb.max).add(bb.min).multiplyScalar(0.5);
    vSize.copy(bb.max).sub(bb.min).multiplyScalar(0.5);
    vAnchorOffset.copy(vSize).multiply(new THREE.Vector3(...anchor)).add(vCenter);
    vPosition.set(...offset).add(vAnchorOffset);
    gizmoRef.current.position.copy(vPosition);
    invalidate();
  });
  const config = React.useMemo(() => ({
    onDragStart: props => {
      mL0.copy(ref.current.matrix);
      mW0.copy(ref.current.matrixWorld);
      onDragStart && onDragStart(props);
      invalidate();
    },
    onDrag: mdW => {
      mP.copy(parentRef.current.matrixWorld);
      mPInv.copy(mP).invert();
      // After applying the delta
      mW.copy(mW0).premultiply(mdW);
      mL.copy(mW).premultiply(mPInv);
      mL0Inv.copy(mL0).invert();
      mdL.copy(mL).multiply(mL0Inv);
      if (autoTransform) {
        ref.current.matrix.copy(mL);
      }
      onDrag && onDrag(mL, mdL, mW, mdW);
      invalidate();
    },
    onDragEnd: () => {
      if (onDragEnd) onDragEnd();
      invalidate();
    },
    translation,
    translationLimits,
    rotationLimits,
    axisColors,
    hoveredColor,
    opacity,
    scale,
    lineWidth,
    fixed,
    depthTest,
    userData,
    annotations,
    annotationsClass
  }), [onDragStart, onDrag, onDragEnd, translation, translationLimits, rotationLimits, scaleLimits, depthTest, scale, lineWidth, fixed, ...axisColors, hoveredColor, opacity, userData, autoTransform, annotations, annotationsClass]);
  const vec = new THREE.Vector3();
  useFrame(state => {
    if (fixed) {
      const sf = calculateScaleFactor(gizmoRef.current.getWorldPosition(vec), scale, state.camera, state.size);
      cameraScale.current.setScalar(sf);
    }
    if (matrix && matrix instanceof THREE.Matrix4) {
      ref.current.matrix = matrix;
    }
    // Update gizmo scale in accordance with matrix changes
    // Without this, there might be noticable turbulences if scaling happens fast enough
    ref.current.updateWorldMatrix(true, true);
    mG.makeRotationFromEuler(gizmoRef.current.rotation).setPosition(gizmoRef.current.position).premultiply(ref.current.matrixWorld);
    gizmoScale.current.setFromMatrixScale(mG);
    vScale.copy(cameraScale.current).divide(gizmoScale.current);
    if (Math.abs(gizmoRef.current.scale.x - vScale.x) > 1e-4 || Math.abs(gizmoRef.current.scale.y - vScale.y) > 1e-4 || Math.abs(gizmoRef.current.scale.z - vScale.z) > 1e-4) {
      gizmoRef.current.scale.copy(vScale);
      state.invalidate();
    }
  });
  React.useImperativeHandle(fRef, () => ref.current, []);
  return /*#__PURE__*/React.createElement(context.Provider, {
    value: config
  }, /*#__PURE__*/React.createElement("group", {
    ref: parentRef
  }, /*#__PURE__*/React.createElement("group", _extends({
    ref: ref,
    matrix: matrix,
    matrixAutoUpdate: false
  }, props), /*#__PURE__*/React.createElement("group", {
    visible: visible,
    ref: gizmoRef,
    position: offset,
    rotation: rotation
  }, enabled && /*#__PURE__*/React.createElement(React.Fragment, null, !disableAxes && activeAxes[0] && /*#__PURE__*/React.createElement(AxisArrow, {
    axis: 0,
    direction: xDir
  }), !disableAxes && activeAxes[1] && /*#__PURE__*/React.createElement(AxisArrow, {
    axis: 1,
    direction: yDir
  }), !disableAxes && activeAxes[2] && /*#__PURE__*/React.createElement(AxisArrow, {
    axis: 2,
    direction: zDir
  }), !disableSliders && activeAxes[0] && activeAxes[1] && /*#__PURE__*/React.createElement(PlaneSlider, {
    axis: 2,
    dir1: xDir,
    dir2: yDir
  }), !disableSliders && activeAxes[0] && activeAxes[2] && /*#__PURE__*/React.createElement(PlaneSlider, {
    axis: 1,
    dir1: zDir,
    dir2: xDir
  }), !disableSliders && activeAxes[2] && activeAxes[1] && /*#__PURE__*/React.createElement(PlaneSlider, {
    axis: 0,
    dir1: yDir,
    dir2: zDir
  }), !disableRotations && activeAxes[0] && activeAxes[1] && /*#__PURE__*/React.createElement(AxisRotator, {
    axis: 2,
    dir1: xDir,
    dir2: yDir
  }), !disableRotations && activeAxes[0] && activeAxes[2] && /*#__PURE__*/React.createElement(AxisRotator, {
    axis: 1,
    dir1: zDir,
    dir2: xDir
  }), !disableRotations && activeAxes[2] && activeAxes[1] && /*#__PURE__*/React.createElement(AxisRotator, {
    axis: 0,
    dir1: yDir,
    dir2: zDir
  }), !disableScaling && activeAxes[0] && /*#__PURE__*/React.createElement(ScalingSphere, {
    axis: 0,
    direction: xDir
  }), !disableScaling && activeAxes[1] && /*#__PURE__*/React.createElement(ScalingSphere, {
    axis: 1,
    direction: yDir
  }), !disableScaling && activeAxes[2] && /*#__PURE__*/React.createElement(ScalingSphere, {
    axis: 2,
    direction: zDir
  }))), /*#__PURE__*/React.createElement("group", {
    ref: childrenRef
  }, children))));
});

export { PivotControls };
