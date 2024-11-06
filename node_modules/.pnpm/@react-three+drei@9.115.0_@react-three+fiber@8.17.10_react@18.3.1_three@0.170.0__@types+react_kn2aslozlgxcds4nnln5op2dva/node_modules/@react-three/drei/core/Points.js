import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { extend, useFrame } from '@react-three/fiber';

const _inverseMatrix = /* @__PURE__ */new THREE.Matrix4();
const _ray = /* @__PURE__ */new THREE.Ray();
const _sphere = /* @__PURE__ */new THREE.Sphere();
const _position = /* @__PURE__ */new THREE.Vector3();
class PositionPoint extends THREE.Group {
  constructor() {
    super();
    this.size = 0;
    this.color = new THREE.Color('white');
    this.instance = {
      current: undefined
    };
    this.instanceKey = {
      current: undefined
    };
  }

  // This will allow the virtual instance have bounds
  get geometry() {
    var _this$instance$curren;
    return (_this$instance$curren = this.instance.current) == null ? void 0 : _this$instance$curren.geometry;
  }
  raycast(raycaster, intersects) {
    var _raycaster$params$Poi, _raycaster$params$Poi2;
    const parent = this.instance.current;
    if (!parent || !parent.geometry) return;
    const instanceId = parent.userData.instances.indexOf(this.instanceKey);
    // If the instance wasn't found or exceeds the parents draw range, bail out
    if (instanceId === -1 || instanceId > parent.geometry.drawRange.count) return;
    const threshold = (_raycaster$params$Poi = (_raycaster$params$Poi2 = raycaster.params.Points) == null ? void 0 : _raycaster$params$Poi2.threshold) !== null && _raycaster$params$Poi !== void 0 ? _raycaster$params$Poi : 1;
    _sphere.set(this.getWorldPosition(_position), threshold);
    if (raycaster.ray.intersectsSphere(_sphere) === false) return;
    _inverseMatrix.copy(parent.matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
    const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;
    const rayPointDistanceSq = _ray.distanceSqToPoint(this.position);
    if (rayPointDistanceSq < localThresholdSq) {
      const intersectPoint = new THREE.Vector3();
      _ray.closestPointToPoint(this.position, intersectPoint);
      intersectPoint.applyMatrix4(this.matrixWorld);
      const distance = raycaster.ray.origin.distanceTo(intersectPoint);
      if (distance < raycaster.near || distance > raycaster.far) return;
      intersects.push({
        distance: distance,
        distanceToRay: Math.sqrt(rayPointDistanceSq),
        point: intersectPoint,
        index: instanceId,
        face: null,
        object: this
      });
    }
  }
}
let i, positionRef;
const context = /* @__PURE__ */React.createContext(null);
const parentMatrix = /* @__PURE__ */new THREE.Matrix4();
const position = /* @__PURE__ */new THREE.Vector3();

/**
 * Instance implementation, relies on react + context to update the attributes based on the children of this component
 */
const PointsInstances = /* @__PURE__ */React.forwardRef(({
  children,
  range,
  limit = 1000,
  ...props
}, ref) => {
  const parentRef = React.useRef(null);
  React.useImperativeHandle(ref, () => parentRef.current, []);
  const [refs, setRefs] = React.useState([]);
  const [[positions, colors, sizes]] = React.useState(() => [new Float32Array(limit * 3), Float32Array.from({
    length: limit * 3
  }, () => 1), Float32Array.from({
    length: limit
  }, () => 1)]);
  React.useEffect(() => {
    // We might be a frame too late? 🤷‍♂️
    parentRef.current.geometry.attributes.position.needsUpdate = true;
  });
  useFrame(() => {
    parentRef.current.updateMatrix();
    parentRef.current.updateMatrixWorld();
    parentMatrix.copy(parentRef.current.matrixWorld).invert();
    parentRef.current.geometry.drawRange.count = Math.min(limit, range !== undefined ? range : limit, refs.length);
    for (i = 0; i < refs.length; i++) {
      positionRef = refs[i].current;
      positionRef.getWorldPosition(position).applyMatrix4(parentMatrix);
      position.toArray(positions, i * 3);
      parentRef.current.geometry.attributes.position.needsUpdate = true;
      positionRef.matrixWorldNeedsUpdate = true;
      positionRef.color.toArray(colors, i * 3);
      parentRef.current.geometry.attributes.color.needsUpdate = true;
      sizes.set([positionRef.size], i);
      parentRef.current.geometry.attributes.size.needsUpdate = true;
    }
  });
  const api = React.useMemo(() => ({
    getParent: () => parentRef,
    subscribe: ref => {
      setRefs(refs => [...refs, ref]);
      return () => setRefs(refs => refs.filter(item => item.current !== ref.current));
    }
  }), []);
  return /*#__PURE__*/React.createElement("points", _extends({
    userData: {
      instances: refs
    },
    matrixAutoUpdate: false,
    ref: parentRef,
    raycast: () => null
  }, props), /*#__PURE__*/React.createElement("bufferGeometry", null, /*#__PURE__*/React.createElement("bufferAttribute", {
    attach: "attributes-position",
    count: positions.length / 3,
    array: positions,
    itemSize: 3,
    usage: THREE.DynamicDrawUsage
  }), /*#__PURE__*/React.createElement("bufferAttribute", {
    attach: "attributes-color",
    count: colors.length / 3,
    array: colors,
    itemSize: 3,
    usage: THREE.DynamicDrawUsage
  }), /*#__PURE__*/React.createElement("bufferAttribute", {
    attach: "attributes-size",
    count: sizes.length,
    array: sizes,
    itemSize: 1,
    usage: THREE.DynamicDrawUsage
  })), /*#__PURE__*/React.createElement(context.Provider, {
    value: api
  }, children));
});
const Point = /* @__PURE__ */React.forwardRef(({
  children,
  ...props
}, ref) => {
  React.useMemo(() => extend({
    PositionPoint
  }), []);
  const group = React.useRef(null);
  React.useImperativeHandle(ref, () => group.current, []);
  const {
    subscribe,
    getParent
  } = React.useContext(context);
  React.useLayoutEffect(() => subscribe(group), []);
  return /*#__PURE__*/React.createElement("positionPoint", _extends({
    instance: getParent(),
    instanceKey: group,
    ref: group
  }, props), children);
});

/**
 * Buffer implementation, relies on complete buffers of the correct number, leaves it to the user to update them
 */

const PointsBuffer = /* @__PURE__ */React.forwardRef(({
  children,
  positions,
  colors,
  sizes,
  stride = 3,
  ...props
}, forwardedRef) => {
  const pointsRef = React.useRef(null);
  React.useImperativeHandle(forwardedRef, () => pointsRef.current, []);
  useFrame(() => {
    const attr = pointsRef.current.geometry.attributes;
    attr.position.needsUpdate = true;
    if (colors) attr.color.needsUpdate = true;
    if (sizes) attr.size.needsUpdate = true;
  });
  return /*#__PURE__*/React.createElement("points", _extends({
    ref: pointsRef
  }, props), /*#__PURE__*/React.createElement("bufferGeometry", null, /*#__PURE__*/React.createElement("bufferAttribute", {
    attach: "attributes-position",
    count: positions.length / stride,
    array: positions,
    itemSize: stride,
    usage: THREE.DynamicDrawUsage
  }), colors && /*#__PURE__*/React.createElement("bufferAttribute", {
    attach: "attributes-color",
    count: colors.length / stride,
    array: colors,
    itemSize: 3,
    usage: THREE.DynamicDrawUsage
  }), sizes && /*#__PURE__*/React.createElement("bufferAttribute", {
    attach: "attributes-size",
    count: sizes.length / stride,
    array: sizes,
    itemSize: 1,
    usage: THREE.DynamicDrawUsage
  })), children);
});
const Points = /* @__PURE__ */React.forwardRef((props, forwardedRef) => {
  if (props.positions instanceof Float32Array) {
    return /*#__PURE__*/React.createElement(PointsBuffer, _extends({}, props, {
      ref: forwardedRef
    }));
  } else return /*#__PURE__*/React.createElement(PointsInstances, _extends({}, props, {
    ref: forwardedRef
  }));
});

export { Point, Points, PointsBuffer, PositionPoint };
