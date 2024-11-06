import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { REVISION, Quaternion, Vector3, DynamicDrawUsage, MeshLambertMaterial, Matrix4, Color } from 'three';
import { extend, useFrame, applyProps } from '@react-three/fiber';
import { useTexture } from './Texture.js';
import { v4 } from 'uuid';
import { setUpdateRange } from '../helpers/deprecated.js';

const CLOUD_URL = 'https://rawcdn.githack.com/pmndrs/drei-assets/9225a9f1fbd449d9411125c2f419b843d0308c9f/cloud.png';
const parentMatrix = /* @__PURE__ */new Matrix4();
const translation = /* @__PURE__ */new Vector3();
const rotation = /* @__PURE__ */new Quaternion();
const cpos = /* @__PURE__ */new Vector3();
const cquat = /* @__PURE__ */new Quaternion();
const scale = /* @__PURE__ */new Vector3();
const context = /* @__PURE__ */React.createContext(null);
const Clouds = /* @__PURE__ */React.forwardRef(({
  children,
  material = MeshLambertMaterial,
  texture = CLOUD_URL,
  range,
  limit = 200,
  frustumCulled,
  ...props
}, fref) => {
  var _image$width, _image$height;
  const CloudMaterial = React.useMemo(() => {
    return class extends material {
      constructor() {
        super();
        const opaque_fragment = parseInt(REVISION.replace(/\D+/g, '')) >= 154 ? 'opaque_fragment' : 'output_fragment';
        this.onBeforeCompile = shader => {
          shader.vertexShader = `attribute float cloudOpacity;
               varying float vOpacity;
              ` + shader.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>
                 vOpacity = cloudOpacity;
                `);
          shader.fragmentShader = `varying float vOpacity;
              ` + shader.fragmentShader.replace(`#include <${opaque_fragment}>`, `#include <${opaque_fragment}>
                 gl_FragColor = vec4(outgoingLight, diffuseColor.a * vOpacity);
                `);
        };
      }
    };
  }, [material]);
  extend({
    CloudMaterial
  });
  const instance = React.useRef(null);
  const clouds = React.useRef([]);
  const opacities = React.useMemo(() => new Float32Array(Array.from({
    length: limit
  }, () => 1)), [limit]);
  const colors = React.useMemo(() => new Float32Array(Array.from({
    length: limit
  }, () => [1, 1, 1]).flat()), [limit]);
  const cloudTexture = useTexture(texture);
  let t = 0;
  let index = 0;
  let config;
  const qat = new Quaternion();
  const dir = new Vector3(0, 0, 1);
  const pos = new Vector3();
  useFrame((state, delta) => {
    t = state.clock.getElapsedTime();
    parentMatrix.copy(instance.current.matrixWorld).invert();
    state.camera.matrixWorld.decompose(cpos, cquat, scale);
    for (index = 0; index < clouds.current.length; index++) {
      config = clouds.current[index];
      config.ref.current.matrixWorld.decompose(translation, rotation, scale);
      translation.add(pos.copy(config.position).applyQuaternion(rotation).multiply(scale));
      rotation.copy(cquat).multiply(qat.setFromAxisAngle(dir, config.rotation += delta * config.rotationFactor));
      scale.multiplyScalar(config.volume + (1 + Math.sin(t * config.density * config.speed)) / 2 * config.growth);
      config.matrix.compose(translation, rotation, scale).premultiply(parentMatrix);
      config.dist = translation.distanceTo(cpos);
    }

    // Depth-sort. Instances have no specific draw order, w/o sorting z would be random
    clouds.current.sort((a, b) => b.dist - a.dist);
    for (index = 0; index < clouds.current.length; index++) {
      config = clouds.current[index];
      opacities[index] = config.opacity * (config.dist < config.fade - 1 ? config.dist / config.fade : 1);
      instance.current.setMatrixAt(index, config.matrix);
      instance.current.setColorAt(index, config.color);
    }

    // Update instance
    instance.current.geometry.attributes.cloudOpacity.needsUpdate = true;
    instance.current.instanceMatrix.needsUpdate = true;
    if (instance.current.instanceColor) instance.current.instanceColor.needsUpdate = true;
  });
  React.useLayoutEffect(() => {
    const count = Math.min(limit, range !== undefined ? range : limit, clouds.current.length);
    instance.current.count = count;
    setUpdateRange(instance.current.instanceMatrix, {
      offset: 0,
      count: count * 16
    });
    if (instance.current.instanceColor) {
      setUpdateRange(instance.current.instanceColor, {
        offset: 0,
        count: count * 3
      });
    }
    setUpdateRange(instance.current.geometry.attributes.cloudOpacity, {
      offset: 0,
      count: count
    });
  });
  let imageBounds = [(_image$width = cloudTexture.image.width) !== null && _image$width !== void 0 ? _image$width : 1, (_image$height = cloudTexture.image.height) !== null && _image$height !== void 0 ? _image$height : 1];
  const max = Math.max(imageBounds[0], imageBounds[1]);
  imageBounds = [imageBounds[0] / max, imageBounds[1] / max];
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: fref
  }, props), /*#__PURE__*/React.createElement(context.Provider, {
    value: clouds
  }, children, /*#__PURE__*/React.createElement("instancedMesh", {
    matrixAutoUpdate: false,
    ref: instance,
    args: [null, null, limit],
    frustumCulled: frustumCulled
  }, /*#__PURE__*/React.createElement("instancedBufferAttribute", {
    usage: DynamicDrawUsage,
    attach: "instanceColor",
    args: [colors, 3]
  }), /*#__PURE__*/React.createElement("planeGeometry", {
    args: [...imageBounds]
  }, /*#__PURE__*/React.createElement("instancedBufferAttribute", {
    usage: DynamicDrawUsage,
    attach: "attributes-cloudOpacity",
    args: [opacities, 1]
  })), /*#__PURE__*/React.createElement("cloudMaterial", {
    key: material.name,
    map: cloudTexture,
    transparent: true,
    depthWrite: false
  }))));
});
const CloudInstance = /* @__PURE__ */React.forwardRef(({
  opacity = 1,
  speed = 0,
  bounds = [5, 1, 1],
  segments = 20,
  color = '#ffffff',
  fade = 10,
  volume = 6,
  smallestVolume = 0.25,
  distribute = null,
  growth = 4,
  concentrate = 'inside',
  seed = Math.random(),
  ...props
}, fref) => {
  function random() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  const parent = React.useContext(context);
  const ref = React.useRef(null);
  const [uuid] = React.useState(() => v4());
  const clouds = React.useMemo(() => {
    return [...new Array(segments)].map((_, index) => ({
      segments,
      bounds: new Vector3(1, 1, 1),
      position: new Vector3(),
      uuid,
      index,
      ref,
      dist: 0,
      matrix: new Matrix4(),
      color: new Color(),
      rotation: index * (Math.PI / segments)
    }));
  }, [segments, uuid]);
  React.useLayoutEffect(() => {
    clouds.forEach((cloud, index) => {
      applyProps(cloud, {
        volume,
        color,
        speed,
        growth,
        opacity,
        fade,
        bounds,
        density: Math.max(0.5, random()),
        rotationFactor: Math.max(0.2, 0.5 * random()) * speed
      });
      // Only distribute randomly if there are multiple segments

      const distributed = distribute == null ? void 0 : distribute(cloud, index);
      if (distributed || segments > 1) {
        var _distributed$point;
        cloud.position.copy(cloud.bounds).multiply((_distributed$point = distributed == null ? void 0 : distributed.point) !== null && _distributed$point !== void 0 ? _distributed$point : {
          x: random() * 2 - 1,
          y: random() * 2 - 1,
          z: random() * 2 - 1
        });
      }
      const xDiff = Math.abs(cloud.position.x);
      const yDiff = Math.abs(cloud.position.y);
      const zDiff = Math.abs(cloud.position.z);
      const max = Math.max(xDiff, yDiff, zDiff);
      cloud.length = 1;
      if (xDiff === max) cloud.length -= xDiff / cloud.bounds.x;
      if (yDiff === max) cloud.length -= yDiff / cloud.bounds.y;
      if (zDiff === max) cloud.length -= zDiff / cloud.bounds.z;
      cloud.volume = ((distributed == null ? void 0 : distributed.volume) !== undefined ? distributed.volume : Math.max(Math.max(0, smallestVolume), concentrate === 'random' ? random() : concentrate === 'inside' ? cloud.length : 1 - cloud.length)) * volume;
    });
  }, [concentrate, bounds, fade, color, opacity, growth, volume, seed, segments, speed]);
  React.useLayoutEffect(() => {
    const temp = clouds;
    parent.current = [...parent.current, ...temp];
    return () => {
      parent.current = parent.current.filter(item => item.uuid !== uuid);
    };
  }, [clouds]);
  React.useImperativeHandle(fref, () => ref.current, []);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: ref
  }, props));
});
const Cloud = /* @__PURE__ */React.forwardRef((props, fref) => {
  const parent = React.useContext(context);
  if (parent) return /*#__PURE__*/React.createElement(CloudInstance, _extends({
    ref: fref
  }, props));
  return /*#__PURE__*/React.createElement(Clouds, null, /*#__PURE__*/React.createElement(CloudInstance, _extends({
    ref: fref
  }, props)));
});

export { Cloud, CloudInstance, Clouds };
