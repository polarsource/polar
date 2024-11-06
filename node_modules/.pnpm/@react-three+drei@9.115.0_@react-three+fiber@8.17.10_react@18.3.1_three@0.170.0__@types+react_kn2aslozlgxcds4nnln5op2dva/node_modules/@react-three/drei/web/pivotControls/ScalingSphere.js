import * as React from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Html } from '../Html.js';
import { context } from './context.js';
import { calculateScaleFactor } from '../../core/calculateScaleFactor.js';

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
const scaleV = /* @__PURE__ */new THREE.Vector3();
const scaleMatrix = /* @__PURE__ */new THREE.Matrix4();
const ScalingSphere = ({
  direction,
  axis
}) => {
  const {
    scaleLimits,
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
  const size = useThree(state => state.size);
  // @ts-expect-error new in @react-three/fiber@7.0.5
  const camControls = useThree(state => state.controls);
  const divRef = React.useRef(null);
  const objRef = React.useRef(null);
  const meshRef = React.useRef(null);
  const scale0 = React.useRef(1);
  const scaleCur = React.useRef(1);
  const clickInfo = React.useRef(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const position = fixed ? 1.2 : 1.2 * scale;
  const onPointerDown = React.useCallback(e => {
    if (annotations) {
      divRef.current.innerText = `${scaleCur.current.toFixed(2)}`;
      divRef.current.style.display = 'block';
    }
    e.stopPropagation();
    const rotation = new THREE.Matrix4().extractRotation(objRef.current.matrixWorld);
    const clickPoint = e.point.clone();
    const origin = new THREE.Vector3().setFromMatrixPosition(objRef.current.matrixWorld);
    const dir = direction.clone().applyMatrix4(rotation).normalize();
    const mPLG = objRef.current.matrixWorld.clone();
    const mPLGInv = mPLG.clone().invert();
    const offsetMultiplier = fixed ? 1 / calculateScaleFactor(objRef.current.getWorldPosition(vec1), scale, e.camera, size) : 1;
    clickInfo.current = {
      clickPoint,
      dir,
      mPLG,
      mPLGInv,
      offsetMultiplier
    };
    onDragStart({
      component: 'Sphere',
      axis,
      origin,
      directions: [dir]
    });
    camControls && (camControls.enabled = false);
    // @ts-ignore - setPointerCapture is not in the type definition
    e.target.setPointerCapture(e.pointerId);
  }, [annotations, camControls, direction, onDragStart, axis, fixed, scale, size]);
  const onPointerMove = React.useCallback(e => {
    e.stopPropagation();
    if (!isHovered) setIsHovered(true);
    if (clickInfo.current) {
      const {
        clickPoint,
        dir,
        mPLG,
        mPLGInv,
        offsetMultiplier
      } = clickInfo.current;
      const [min, max] = (scaleLimits == null ? void 0 : scaleLimits[axis]) || [1e-5, undefined]; // always limit the minimal value, since setting it very low might break the transform

      const offsetW = calculateOffset(clickPoint, dir, e.ray.origin, e.ray.direction);
      const offsetL = offsetW * offsetMultiplier;
      const offsetH = fixed ? offsetL : offsetL / scale;
      let upscale = Math.pow(2, offsetH * 0.2);

      // @ts-ignore
      if (e.shiftKey) {
        upscale = Math.round(upscale * 10) / 10;
      }
      upscale = Math.max(upscale, min / scale0.current);
      if (max !== undefined) {
        upscale = Math.min(upscale, max / scale0.current);
      }
      scaleCur.current = scale0.current * upscale;
      meshRef.current.position.set(0, position + offsetL, 0);
      if (annotations) {
        divRef.current.innerText = `${scaleCur.current.toFixed(2)}`;
      }
      scaleV.set(1, 1, 1);
      scaleV.setComponent(axis, upscale);
      scaleMatrix.makeScale(scaleV.x, scaleV.y, scaleV.z).premultiply(mPLG).multiply(mPLGInv);
      onDrag(scaleMatrix);
    }
  }, [annotations, position, onDrag, isHovered, scaleLimits, axis]);
  const onPointerUp = React.useCallback(e => {
    if (annotations) {
      divRef.current.style.display = 'none';
    }
    e.stopPropagation();
    scale0.current = scaleCur.current;
    clickInfo.current = null;
    meshRef.current.position.set(0, position, 0);
    onDragEnd();
    camControls && (camControls.enabled = true);
    // @ts-ignore - releasePointerCapture & PointerEvent#pointerId is not in the type definition
    e.target.releasePointerCapture(e.pointerId);
  }, [annotations, camControls, onDragEnd, position]);
  const onPointerOut = React.useCallback(e => {
    e.stopPropagation();
    setIsHovered(false);
  }, []);
  const {
    radius,
    matrixL
  } = React.useMemo(() => {
    const radius = fixed ? lineWidth / scale * 1.8 : scale / 22.5;
    const quaternion = new THREE.Quaternion().setFromUnitVectors(upV, direction.clone().normalize());
    const matrixL = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);
    return {
      radius,
      matrixL
    };
  }, [direction, scale, lineWidth, fixed]);
  const color = isHovered ? hoveredColor : axisColors[axis];
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
    position: [0, position / 2, 0]
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
    ref: meshRef,
    position: [0, position, 0],
    renderOrder: 500,
    userData: userData
  }, /*#__PURE__*/React.createElement("sphereGeometry", {
    args: [radius, 12, 12]
  }), /*#__PURE__*/React.createElement("meshBasicMaterial", {
    transparent: true,
    depthTest: depthTest,
    color: color,
    opacity: opacity,
    polygonOffset: true,
    polygonOffsetFactor: -10
  }))));
};

export { ScalingSphere, calculateOffset };
