import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { extend, useThree, useFrame } from '@react-three/fiber';
import { shaderMaterial } from './shaderMaterial.js';
import { DiscardMaterial } from '../materials/DiscardMaterial.js';
import { version } from '../helpers/constants.js';

function isLight(object) {
  return object.isLight;
}
function isGeometry(object) {
  return !!object.geometry;
}
const accumulativeContext = /* @__PURE__ */React.createContext(null);
const SoftShadowMaterial = /* @__PURE__ */shaderMaterial({
  color: /* @__PURE__ */new THREE.Color(),
  blend: 2.0,
  alphaTest: 0.75,
  opacity: 0,
  map: null
}, `varying vec2 vUv;
   void main() {
     gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.);
     vUv = uv;
   }`, `varying vec2 vUv;
   uniform sampler2D map;
   uniform vec3 color;
   uniform float opacity;
   uniform float alphaTest;
   uniform float blend;
   void main() {
     vec4 sampledDiffuseColor = texture2D(map, vUv);
     gl_FragColor = vec4(color * sampledDiffuseColor.r * blend, max(0.0, (1.0 - (sampledDiffuseColor.r + sampledDiffuseColor.g + sampledDiffuseColor.b) / alphaTest)) * opacity);
     #include <tonemapping_fragment>
     #include <${version >= 154 ? 'colorspace_fragment' : 'encodings_fragment'}>
   }`);
const AccumulativeShadows = /* @__PURE__ */React.forwardRef(({
  children,
  temporal,
  frames = 40,
  limit = Infinity,
  blend = 20,
  scale = 10,
  opacity = 1,
  alphaTest = 0.75,
  color = 'black',
  colorBlend = 2,
  resolution = 1024,
  toneMapped = true,
  ...props
}, forwardRef) => {
  extend({
    SoftShadowMaterial
  });
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const gPlane = React.useRef(null);
  const gLights = React.useRef(null);
  const [plm] = React.useState(() => new ProgressiveLightMap(gl, scene, resolution));
  React.useLayoutEffect(() => {
    plm.configure(gPlane.current);
  }, []);
  const api = React.useMemo(() => ({
    lights: new Map(),
    temporal: !!temporal,
    frames: Math.max(2, frames),
    blend: Math.max(2, frames === Infinity ? blend : frames),
    count: 0,
    getMesh: () => gPlane.current,
    reset: () => {
      // Clear buffers, reset opacities, set frame count to 0
      plm.clear();
      const material = gPlane.current.material;
      material.opacity = 0;
      material.alphaTest = 0;
      api.count = 0;
    },
    update: (frames = 1) => {
      // Adapt the opacity-blend ratio to the number of frames
      const material = gPlane.current.material;
      if (!api.temporal) {
        material.opacity = opacity;
        material.alphaTest = alphaTest;
      } else {
        material.opacity = Math.min(opacity, material.opacity + opacity / api.blend);
        material.alphaTest = Math.min(alphaTest, material.alphaTest + alphaTest / api.blend);
      }

      // Switch accumulative lights on
      gLights.current.visible = true;
      // Collect scene lights and meshes
      plm.prepare();

      // Update the lightmap and the accumulative lights
      for (let i = 0; i < frames; i++) {
        api.lights.forEach(light => light.update());
        plm.update(camera, api.blend);
      }
      // Switch lights off
      gLights.current.visible = false;
      // Restore lights and meshes
      plm.finish();
    }
  }), [plm, camera, scene, temporal, frames, blend, opacity, alphaTest]);
  React.useLayoutEffect(() => {
    // Reset internals, buffers, ...
    api.reset();
    // Update lightmap
    if (!api.temporal && api.frames !== Infinity) api.update(api.blend);
  });

  // Expose api, allow children to set itself as the main light source
  React.useImperativeHandle(forwardRef, () => api, [api]);
  useFrame(() => {
    if ((api.temporal || api.frames === Infinity) && api.count < api.frames && api.count < limit) {
      invalidate();
      api.update();
      api.count++;
    }
  });
  return /*#__PURE__*/React.createElement("group", props, /*#__PURE__*/React.createElement("group", {
    traverse: () => null,
    ref: gLights
  }, /*#__PURE__*/React.createElement(accumulativeContext.Provider, {
    value: api
  }, children)), /*#__PURE__*/React.createElement("mesh", {
    receiveShadow: true,
    ref: gPlane,
    scale: scale,
    rotation: [-Math.PI / 2, 0, 0]
  }, /*#__PURE__*/React.createElement("planeGeometry", null), /*#__PURE__*/React.createElement("softShadowMaterial", {
    transparent: true,
    depthWrite: false,
    toneMapped: toneMapped,
    color: color,
    blend: colorBlend,
    map: plm.progressiveLightMap2.texture
  })));
});
const RandomizedLight = /* @__PURE__ */React.forwardRef(({
  castShadow = true,
  bias = 0.001,
  mapSize = 512,
  size = 5,
  near = 0.5,
  far = 500,
  frames = 1,
  position = [0, 0, 0],
  radius = 1,
  amount = 8,
  intensity = version >= 155 ? Math.PI : 1,
  ambient = 0.5,
  ...props
}, forwardRef) => {
  const gLights = React.useRef(null);
  const length = new THREE.Vector3(...position).length();
  const parent = React.useContext(accumulativeContext);
  const update = React.useCallback(() => {
    let light;
    if (gLights.current) {
      for (let l = 0; l < gLights.current.children.length; l++) {
        light = gLights.current.children[l];
        if (Math.random() > ambient) {
          light.position.set(position[0] + THREE.MathUtils.randFloatSpread(radius), position[1] + THREE.MathUtils.randFloatSpread(radius), position[2] + THREE.MathUtils.randFloatSpread(radius));
        } else {
          let lambda = Math.acos(2 * Math.random() - 1) - Math.PI / 2.0;
          let phi = 2 * Math.PI * Math.random();
          light.position.set(Math.cos(lambda) * Math.cos(phi) * length, Math.abs(Math.cos(lambda) * Math.sin(phi) * length), Math.sin(lambda) * length);
        }
      }
    }
  }, [radius, ambient, length, ...position]);
  const api = React.useMemo(() => ({
    update
  }), [update]);
  React.useImperativeHandle(forwardRef, () => api, [api]);
  React.useLayoutEffect(() => {
    var _parent$lights;
    const group = gLights.current;
    if (parent) (_parent$lights = parent.lights) == null || _parent$lights.set(group.uuid, api);
    return () => {
      var _parent$lights2;
      return void (parent == null || (_parent$lights2 = parent.lights) == null ? void 0 : _parent$lights2.delete(group.uuid));
    };
  }, [parent, api]);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: gLights
  }, props), Array.from({
    length: amount
  }, (_, index) => /*#__PURE__*/React.createElement("directionalLight", {
    key: index,
    castShadow: castShadow,
    "shadow-bias": bias,
    "shadow-mapSize": [mapSize, mapSize],
    intensity: intensity / amount
  }, /*#__PURE__*/React.createElement("orthographicCamera", {
    attach: "shadow-camera",
    args: [-size, size, size, -size, near, far]
  }))));
});

// Based on "Progressive Light Map Accumulator", by [zalo](https://github.com/zalo/)
class ProgressiveLightMap {
  constructor(renderer, scene, res = 1024) {
    this.renderer = renderer;
    this.res = res;
    this.scene = scene;
    this.buffer1Active = false;
    this.lights = [];
    this.meshes = [];
    this.object = null;
    this.clearColor = new THREE.Color();
    this.clearAlpha = 0;

    // Create the Progressive LightMap Texture
    const textureParams = {
      type: THREE.HalfFloatType,
      magFilter: THREE.NearestFilter,
      minFilter: THREE.NearestFilter
    };
    this.progressiveLightMap1 = new THREE.WebGLRenderTarget(this.res, this.res, textureParams);
    this.progressiveLightMap2 = new THREE.WebGLRenderTarget(this.res, this.res, textureParams);

    // Inject some spicy new logic into a standard phong material
    this.discardMat = new DiscardMaterial();
    this.targetMat = new THREE.MeshLambertMaterial({
      fog: false
    });
    this.previousShadowMap = {
      value: this.progressiveLightMap1.texture
    };
    this.averagingWindow = {
      value: 100
    };
    this.targetMat.onBeforeCompile = shader => {
      // Vertex Shader: Set Vertex Positions to the Unwrapped UV Positions
      shader.vertexShader = 'varying vec2 vUv;\n' + shader.vertexShader.slice(0, -1) + 'vUv = uv; gl_Position = vec4((uv - 0.5) * 2.0, 1.0, 1.0); }';

      // Fragment Shader: Set Pixels to average in the Previous frame's Shadows
      const bodyStart = shader.fragmentShader.indexOf('void main() {');
      shader.fragmentShader = 'varying vec2 vUv;\n' + shader.fragmentShader.slice(0, bodyStart) + 'uniform sampler2D previousShadowMap;\n	uniform float averagingWindow;\n' + shader.fragmentShader.slice(bodyStart - 1, -1) + `\nvec3 texelOld = texture2D(previousShadowMap, vUv).rgb;
        gl_FragColor.rgb = mix(texelOld, gl_FragColor.rgb, 1.0/ averagingWindow);
      }`;

      // Set the Previous Frame's Texture Buffer and Averaging Window
      shader.uniforms.previousShadowMap = this.previousShadowMap;
      shader.uniforms.averagingWindow = this.averagingWindow;
    };
  }
  clear() {
    this.renderer.getClearColor(this.clearColor);
    this.clearAlpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor('black', 1);
    this.renderer.setRenderTarget(this.progressiveLightMap1);
    this.renderer.clear();
    this.renderer.setRenderTarget(this.progressiveLightMap2);
    this.renderer.clear();
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(this.clearColor, this.clearAlpha);
    this.lights = [];
    this.meshes = [];
    this.scene.traverse(object => {
      if (isGeometry(object)) {
        this.meshes.push({
          object,
          material: object.material
        });
      } else if (isLight(object)) {
        this.lights.push({
          object,
          intensity: object.intensity
        });
      }
    });
  }
  prepare() {
    this.lights.forEach(light => light.object.intensity = 0);
    this.meshes.forEach(mesh => mesh.object.material = this.discardMat);
  }
  finish() {
    this.lights.forEach(light => light.object.intensity = light.intensity);
    this.meshes.forEach(mesh => mesh.object.material = mesh.material);
  }
  configure(object) {
    this.object = object;
  }
  update(camera, blendWindow = 100) {
    if (!this.object) return;
    // Set each object's material to the UV Unwrapped Surface Mapping Version
    this.averagingWindow.value = blendWindow;
    this.object.material = this.targetMat;
    // Ping-pong two surface buffers for reading/writing
    const activeMap = this.buffer1Active ? this.progressiveLightMap1 : this.progressiveLightMap2;
    const inactiveMap = this.buffer1Active ? this.progressiveLightMap2 : this.progressiveLightMap1;
    // Render the object's surface maps
    const oldBg = this.scene.background;
    this.scene.background = null;
    this.renderer.setRenderTarget(activeMap);
    this.previousShadowMap.value = inactiveMap.texture;
    this.buffer1Active = !this.buffer1Active;
    this.renderer.render(this.scene, camera);
    this.renderer.setRenderTarget(null);
    this.scene.background = oldBg;
  }
}

export { AccumulativeShadows, RandomizedLight, accumulativeContext };
