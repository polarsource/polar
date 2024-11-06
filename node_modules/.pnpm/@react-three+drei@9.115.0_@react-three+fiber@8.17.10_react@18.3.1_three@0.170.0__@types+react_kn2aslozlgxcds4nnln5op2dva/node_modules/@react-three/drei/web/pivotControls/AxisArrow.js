import * as React from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Line } from '../../core/Line.js';
import { Html } from '../Html.js';
import { context } from './context.js';

const vec1 = /* @__PURE__ */new THREE.Vector3();
const vec2 = /* @__PURE__ */new THREE.Vector3();
const calculateOffset = (clickPoint, normal, rayStart, rayDir) => {
  const e1 = normal.dot(normal);
  const e2 = normal.dot(clickPoint) - normal.dot(rayStart);
  const e3 = normal.dot(rayDir);
  if (e3 === 0) {
    return -e2 / e1;
  }
  vec1.copy(rayDir).multiplyScalar(e1 / e3).sub(normal);
  vec2.copy(rayDir).multiplyScalar(e2 / e3).add(rayStart).sub(clickPoint);
  const offset = -vec1.dot(vec2) / vec1.dot(vec1);
  return offset;
};
const upV = /* @__PURE__ */new THREE.Vector3(0, 1, 0);
const offsetMatrix = /* @__PURE__ */new THREE.Matrix4();
const AxisArrow = ({
  direction,
  axis
}) => {
  const {
    translation,
    translationLimits,
    annotations,
    annotationsClass,
    depthTest,
    scale,
    lineWidth,
    fixed,
    axisColors,
    hoveredColor,
    opacity,
    onDragStart,
    onDrag,
    onDragEnd,
    userData
  } = React.useContext(context);

  // @ts-expect-error new in @react-three/fiber@7.0.5
  const camControls = useThree(state => state.controls);
  const divRef = React.useRef(null);
  const objRef = React.useRef(null);
  const clickInfo = React.useRef(null);
  const offset0 = React.useRef(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const onPointerDown = React.useCallback(e => {
    if (annotations) {
      divRef.current.innerText = `${translation.current[axis].toFixed(2)}`;
      divRef.current.style.display = 'block';
    }
    e.stopPropagation();
    const rotation = new THREE.Matrix4().extractRotation(objRef.current.matrixWorld);
    const clickPoint = e.point.clone();
    const origin = new THREE.Vector3().setFromMatrixPosition(objRef.current.matrixWorld);
    const dir = direction.clone().applyMatrix4(rotation).normalize();
    clickInfo.current = {
      clickPoint,
      dir
    };
    offset0.current = translation.current[axis];
    onDragStart({
      component: 'Arrow',
      axis,
      origin,
      directions: [dir]
    });
    camControls && (camControls.enabled = false);
    // @ts-ignore - setPointerCapture is not in the type definition
    e.target.setPointerCapture(e.pointerId);
  }, [annotations, direction, camControls, onDragStart, translation, axis]);
  const onPointerMove = React.useCallback(e => {
    e.stopPropagation();
    if (!isHovered) setIsHovered(true);
    if (clickInfo.current) {
      const {
        clickPoint,
        dir
      } = clickInfo.current;
      const [min, max] = (translationLimits == null ? void 0 : translationLimits[axis]) || [undefined, undefined];
      let offset = calculateOffset(clickPoint, dir, e.ray.origin, e.ray.direction);
      if (min !== undefined) {
        offset = Math.max(offset, min - offset0.current);
      }
      if (max !== undefined) {
        offset = Math.min(offset, max - offset0.current);
      }
      translation.current[axis] = offset0.current + offset;
      if (annotations) {
        divRef.current.innerText = `${translation.current[axis].toFixed(2)}`;
      }
      offsetMatrix.makeTranslation(dir.x * offset, dir.y * offset, dir.z * offset);
      onDrag(offsetMatrix);
    }
  }, [annotations, onDrag, isHovered, translation, translationLimits, axis]);
  const onPointerUp = React.useCallback(e => {
    if (annotations) {
      divRef.current.style.display = 'none';
    }
    e.stopPropagation();
    clickInfo.current = null;
    onDragEnd();
    camControls && (camControls.enabled = true);
    // @ts-ignore - releasePointerCapture & PointerEvent#pointerId is not in the type definition
    e.target.releasePointerCapture(e.pointerId);
  }, [annotations, camControls, onDragEnd]);
  const onPointerOut = React.useCallback(e => {
    e.stopPropagation();
    setIsHovered(false);
  }, []);
  const {
    cylinderLength,
    coneWidth,
    coneLength,
    matrixL
  } = React.useMemo(() => {
    const coneWidth = fixed ? lineWidth / scale * 1.6 : scale / 20;
    const coneLength = fixed ? 0.2 : scale / 5;
    const cylinderLength = fixed ? 1 - coneLength : scale - coneLength;
    const quaternion = new THREE.Quaternion().setFromUnitVectors(upV, direction.clone().normalize());
    const matrixL = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
    return {
      cylinderLength,
      coneWidth,
      coneLength,
      matrixL
    };
  }, [direction, scale, lineWidth, fixed]);
  const color_ = isHovered ? hoveredColor : axisColors[axis];
  return /*#__PURE__*/React.createElement("group", {
    ref: objRef
  }, /*#__PURE__*/React.createElement("group", {
    matrix: matrixL,
    matrixAutoUpdate: false,
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    onPointerOut: onPointerOut
  }, annotations && /*#__PURE__*/React.createElement(Html, {
    position: [0, -coneLength, 0]
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'none',
      background: '#151520',
      color: 'white',
      padding: '6px 8px',
      borderRadius: 7,
      whiteSpace: 'nowrap'
    },
    className: annotationsClass,
    ref: divRef
  })), /*#__PURE__*/React.createElement("mesh", {
    visible: false,
    position: [0, (cylinderLength + coneLength) / 2.0, 0],
    userData: userData
  }, /*#__PURE__*/React.createElement("cylinderGeometry", {
    args: [coneWidth * 1.4, coneWidth * 1.4, cylinderLength + coneLength, 8, 1]
  })), /*#__PURE__*/React.createElement(Line, {
    transparent: true,
    raycast: () => null,
    depthTest: depthTest,
    points: [0, 0, 0, 0, cylinderLength, 0],
    lineWidth: lineWidth,
    side: THREE.DoubleSide,
    color: color_,
    opacity: opacity,
    polygonOffset: true,
    renderOrder: 1,
    polygonOffsetFactor: -10,
    fog: false
  }), /*#__PURE__*/React.createElement("mesh", {
    raycast: () => null,
    position: [0, cylinderLength + coneLength / 2.0, 0],
    renderOrder: 500
  }, /*#__PURE__*/React.createElement("coneGeometry", {
    args: [coneWidth, coneLength, 24, 1]
  }), /*#__PURE__*/React.createElement("meshBasicMaterial", {
    transparent: true,
    depthTest: depthTest,
    color: color_,
    opacity: opacity,
    polygonOffset: true,
    polygonOffsetFactor: -10,
    fog: false
  }))));
};

export { AxisArrow, calculateOffset };
