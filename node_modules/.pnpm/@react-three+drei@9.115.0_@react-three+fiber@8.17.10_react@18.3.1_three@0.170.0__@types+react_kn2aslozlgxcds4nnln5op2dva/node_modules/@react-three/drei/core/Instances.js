import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { extend, useFrame } from '@react-three/fiber';
import Composer from 'react-composer';
import { setUpdateRange } from '../helpers/deprecated.js';

function isFunctionChild(value) {
  return typeof value === 'function';
}
const _instanceLocalMatrix = /* @__PURE__ */new THREE.Matrix4();
const _instanceWorldMatrix = /* @__PURE__ */new THREE.Matrix4();
const _instanceIntersects = [];
const _mesh = /* @__PURE__ */new THREE.Mesh();
class PositionMesh extends THREE.Group {
  constructor() {
    super();
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

  // And this will allow the virtual instance to receive events
  raycast(raycaster, intersects) {
    const parent = this.instance.current;
    if (!parent) return;
    if (!parent.geometry || !parent.material) return;
    _mesh.geometry = parent.geometry;
    const matrixWorld = parent.matrixWorld;
    const instanceId = parent.userData.instances.indexOf(this.instanceKey);
    // If the instance wasn't found or exceeds the parents draw range, bail out
    if (instanceId === -1 || instanceId > parent.count) return;
    // calculate the world matrix for each instance
    parent.getMatrixAt(instanceId, _instanceLocalMatrix);
    _instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix);
    // the mesh represents this single instance
    _mesh.matrixWorld = _instanceWorldMatrix;
    // raycast side according to instance material
    if (parent.material instanceof THREE.Material) _mesh.material.side = parent.material.side;else _mesh.material.side = parent.material[0].side;
    _mesh.raycast(raycaster, _instanceIntersects);
    // process the result of raycast
    for (let i = 0, l = _instanceIntersects.length; i < l; i++) {
      const intersect = _instanceIntersects[i];
      intersect.instanceId = instanceId;
      intersect.object = this;
      intersects.push(intersect);
    }
    _instanceIntersects.length = 0;
  }
}
const globalContext = /* @__PURE__ */React.createContext(null);
const parentMatrix = /* @__PURE__ */new THREE.Matrix4();
const instanceMatrix = /* @__PURE__ */new THREE.Matrix4();
const tempMatrix = /* @__PURE__ */new THREE.Matrix4();
const translation = /* @__PURE__ */new THREE.Vector3();
const rotation = /* @__PURE__ */new THREE.Quaternion();
const scale = /* @__PURE__ */new THREE.Vector3();
const isInstancedBufferAttribute = attr => attr.isInstancedBufferAttribute;
const Instance = /* @__PURE__ */React.forwardRef(({
  context,
  children,
  ...props
}, ref) => {
  React.useMemo(() => extend({
    PositionMesh
  }), []);
  const group = React.useRef();
  React.useImperativeHandle(ref, () => group.current, []);
  const {
    subscribe,
    getParent
  } = React.useContext(context || globalContext);
  React.useLayoutEffect(() => subscribe(group), []);
  return /*#__PURE__*/React.createElement("positionMesh", _extends({
    instance: getParent(),
    instanceKey: group,
    ref: group
  }, props), children);
});
const Instances = /* @__PURE__ */React.forwardRef(({
  context,
  children,
  range,
  limit = 1000,
  frames = Infinity,
  ...props
}, ref) => {
  const [{
    localContext,
    instance
  }] = React.useState(() => {
    const localContext = /*#__PURE__*/React.createContext(null);
    return {
      localContext,
      instance: /*#__PURE__*/React.forwardRef((props, ref) => /*#__PURE__*/React.createElement(Instance, _extends({
        context: localContext
      }, props, {
        ref: ref
      })))
    };
  });
  const parentRef = React.useRef(null);
  React.useImperativeHandle(ref, () => parentRef.current, []);
  const [instances, setInstances] = React.useState([]);
  const [[matrices, colors]] = React.useState(() => {
    const mArray = new Float32Array(limit * 16);
    for (let i = 0; i < limit; i++) tempMatrix.identity().toArray(mArray, i * 16);
    return [mArray, new Float32Array([...new Array(limit * 3)].map(() => 1))];
  });
  React.useEffect(() => {
    // We might be a frame too late? 🤷‍♂️
    parentRef.current.instanceMatrix.needsUpdate = true;
  });
  let iterations = 0;
  let count = 0;
  const attributes = React.useRef([]);
  React.useLayoutEffect(() => {
    attributes.current = Object.entries(parentRef.current.geometry.attributes).filter(([_name, value]) => isInstancedBufferAttribute(value));
  });
  useFrame(() => {
    if (frames === Infinity || iterations < frames) {
      parentRef.current.updateMatrix();
      parentRef.current.updateMatrixWorld();
      parentMatrix.copy(parentRef.current.matrixWorld).invert();
      count = Math.min(limit, range !== undefined ? range : limit, instances.length);
      parentRef.current.count = count;
      setUpdateRange(parentRef.current.instanceMatrix, {
        offset: 0,
        count: count * 16
      });
      setUpdateRange(parentRef.current.instanceColor, {
        offset: 0,
        count: count * 3
      });
      for (let i = 0; i < instances.length; i++) {
        const instance = instances[i].current;
        // Multiply the inverse of the InstancedMesh world matrix or else
        // Instances will be double-transformed if <Instances> isn't at identity
        instance.matrixWorld.decompose(translation, rotation, scale);
        instanceMatrix.compose(translation, rotation, scale).premultiply(parentMatrix);
        instanceMatrix.toArray(matrices, i * 16);
        parentRef.current.instanceMatrix.needsUpdate = true;
        instance.color.toArray(colors, i * 3);
        parentRef.current.instanceColor.needsUpdate = true;
      }
      iterations++;
    }
  });
  const api = React.useMemo(() => ({
    getParent: () => parentRef,
    subscribe: ref => {
      setInstances(instances => [...instances, ref]);
      return () => setInstances(instances => instances.filter(item => item.current !== ref.current));
    }
  }), []);
  return /*#__PURE__*/React.createElement("instancedMesh", _extends({
    userData: {
      instances,
      limit,
      frames
    },
    matrixAutoUpdate: false,
    ref: parentRef,
    args: [null, null, 0],
    raycast: () => null
  }, props), /*#__PURE__*/React.createElement("instancedBufferAttribute", {
    attach: "instanceMatrix",
    count: matrices.length / 16,
    array: matrices,
    itemSize: 16,
    usage: THREE.DynamicDrawUsage
  }), /*#__PURE__*/React.createElement("instancedBufferAttribute", {
    attach: "instanceColor",
    count: colors.length / 3,
    array: colors,
    itemSize: 3,
    usage: THREE.DynamicDrawUsage
  }), isFunctionChild(children) ? /*#__PURE__*/React.createElement(localContext.Provider, {
    value: api
  }, children(instance)) : context ? /*#__PURE__*/React.createElement(context.Provider, {
    value: api
  }, children) : /*#__PURE__*/React.createElement(globalContext.Provider, {
    value: api
  }, children));
});
const Merged = /* @__PURE__ */React.forwardRef(function Merged({
  meshes,
  children,
  ...props
}, ref) {
  const isArray = Array.isArray(meshes);
  // Filter out meshes from collections, which may contain non-meshes
  if (!isArray) for (const key of Object.keys(meshes)) if (!meshes[key].isMesh) delete meshes[key];
  return /*#__PURE__*/React.createElement("group", {
    ref: ref
  }, /*#__PURE__*/React.createElement(Composer, {
    components: (isArray ? meshes : Object.values(meshes)).map(({
      geometry,
      material
    }) => /*#__PURE__*/React.createElement(Instances, _extends({
      key: geometry.uuid,
      geometry: geometry,
      material: material
    }, props)))
  }, args => isArray ? children(...args) : children(Object.keys(meshes).filter(key => meshes[key].isMesh).reduce((acc, key, i) => ({
    ...acc,
    [key]: args[i]
  }), {}))));
});

/** Idea and implementation for global instances and instanced attributes by
/*  Matias Gonzalez Fernandez https://x.com/matiNotFound
/*  and Paul Henschel https://x.com/0xca0a
*/
function createInstances() {
  const context = /*#__PURE__*/React.createContext(null);
  return [/*#__PURE__*/React.forwardRef((props, fref) => /*#__PURE__*/React.createElement(Instances, _extends({
    ref: fref,
    context: context
  }, props))), /*#__PURE__*/React.forwardRef((props, fref) => /*#__PURE__*/React.createElement(Instance, _extends({
    ref: fref,
    context: context
  }, props)))];
}
const InstancedAttribute = /*#__PURE__*/React.forwardRef(({
  name,
  defaultValue,
  normalized,
  usage = THREE.DynamicDrawUsage
}, fref) => {
  const ref = React.useRef(null);
  React.useImperativeHandle(fref, () => ref.current, []);
  React.useLayoutEffect(() => {
    const parent = ref.current.__r3f.parent;
    parent.geometry.attributes[name] = ref.current;
    const value = Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    const array = Array.from({
      length: parent.userData.limit
    }, () => value).flat();
    ref.current.array = new Float32Array(array);
    ref.current.itemSize = value.length;
    ref.current.count = array.length / ref.current.itemSize;
    return () => {
      delete parent.geometry.attributes[name];
    };
  }, [name]);
  let iterations = 0;
  useFrame(() => {
    const parent = ref.current.__r3f.parent;
    if (parent.userData.frames === Infinity || iterations < parent.userData.frames) {
      for (let i = 0; i < parent.userData.instances.length; i++) {
        const instance = parent.userData.instances[i].current;
        const value = instance[name];
        if (value !== undefined) {
          ref.current.set(Array.isArray(value) ? value : typeof value.toArray === 'function' ? value.toArray() : [value], i * ref.current.itemSize);
          ref.current.needsUpdate = true;
        }
      }
      iterations++;
    }
  });
  return /*#__PURE__*/React.createElement("instancedBufferAttribute", {
    ref: ref,
    usage: usage,
    normalized: normalized
  });
});

export { Instance, InstancedAttribute, Instances, Merged, PositionMesh, createInstances };
