import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import * as THREE from 'three';
import { extend, useFrame } from '@react-three/fiber';
import { shaderMaterial } from './shaderMaterial.js';
import { version } from '../helpers/constants.js';

const GridMaterial = /* @__PURE__ */shaderMaterial({
  cellSize: 0.5,
  sectionSize: 1,
  fadeDistance: 100,
  fadeStrength: 1,
  fadeFrom: 1,
  cellThickness: 0.5,
  sectionThickness: 1,
  cellColor: /* @__PURE__ */new THREE.Color(),
  sectionColor: /* @__PURE__ */new THREE.Color(),
  infiniteGrid: false,
  followCamera: false,
  worldCamProjPosition: /* @__PURE__ */new THREE.Vector3(),
  worldPlanePosition: /* @__PURE__ */new THREE.Vector3()
}, /* glsl */`
    varying vec3 localPosition;
    varying vec4 worldPosition;

    uniform vec3 worldCamProjPosition;
    uniform vec3 worldPlanePosition;
    uniform float fadeDistance;
    uniform bool infiniteGrid;
    uniform bool followCamera;

    void main() {
      localPosition = position.xzy;
      if (infiniteGrid) localPosition *= 1.0 + fadeDistance;
      
      worldPosition = modelMatrix * vec4(localPosition, 1.0);
      if (followCamera) {
        worldPosition.xyz += (worldCamProjPosition - worldPlanePosition);
        localPosition = (inverse(modelMatrix) * worldPosition).xyz;
      }

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `, /* glsl */`
    varying vec3 localPosition;
    varying vec4 worldPosition;

    uniform vec3 worldCamProjPosition;
    uniform float cellSize;
    uniform float sectionSize;
    uniform vec3 cellColor;
    uniform vec3 sectionColor;
    uniform float fadeDistance;
    uniform float fadeStrength;
    uniform float fadeFrom;
    uniform float cellThickness;
    uniform float sectionThickness;

    float getGrid(float size, float thickness) {
      vec2 r = localPosition.xz / size;
      vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
      float line = min(grid.x, grid.y) + 1.0 - thickness;
      return 1.0 - min(line, 1.0);
    }

    void main() {
      float g1 = getGrid(cellSize, cellThickness);
      float g2 = getGrid(sectionSize, sectionThickness);

      vec3 from = worldCamProjPosition*vec3(fadeFrom);
      float dist = distance(from, worldPosition.xyz);
      float d = 1.0 - min(dist / fadeDistance, 1.0);
      vec3 color = mix(cellColor, sectionColor, min(1.0, sectionThickness * g2));

      gl_FragColor = vec4(color, (g1 + g2) * pow(d, fadeStrength));
      gl_FragColor.a = mix(0.75 * gl_FragColor.a, gl_FragColor.a, g2);
      if (gl_FragColor.a <= 0.0) discard;

      #include <tonemapping_fragment>
      #include <${version >= 154 ? 'colorspace_fragment' : 'encodings_fragment'}>
    }
  `);
const Grid = /* @__PURE__ */React.forwardRef(({
  args,
  cellColor = '#000000',
  sectionColor = '#2080ff',
  cellSize = 0.5,
  sectionSize = 1,
  followCamera = false,
  infiniteGrid = false,
  fadeDistance = 100,
  fadeStrength = 1,
  fadeFrom = 1,
  cellThickness = 0.5,
  sectionThickness = 1,
  side = THREE.BackSide,
  ...props
}, fRef) => {
  extend({
    GridMaterial
  });
  const ref = React.useRef(null);
  React.useImperativeHandle(fRef, () => ref.current, []);
  const plane = new THREE.Plane();
  const upVector = new THREE.Vector3(0, 1, 0);
  const zeroVector = new THREE.Vector3(0, 0, 0);
  useFrame(state => {
    plane.setFromNormalAndCoplanarPoint(upVector, zeroVector).applyMatrix4(ref.current.matrixWorld);
    const gridMaterial = ref.current.material;
    const worldCamProjPosition = gridMaterial.uniforms.worldCamProjPosition;
    const worldPlanePosition = gridMaterial.uniforms.worldPlanePosition;
    plane.projectPoint(state.camera.position, worldCamProjPosition.value);
    worldPlanePosition.value.set(0, 0, 0).applyMatrix4(ref.current.matrixWorld);
  });
  const uniforms1 = {
    cellSize,
    sectionSize,
    cellColor,
    sectionColor,
    cellThickness,
    sectionThickness
  };
  const uniforms2 = {
    fadeDistance,
    fadeStrength,
    fadeFrom,
    infiniteGrid,
    followCamera
  };
  return /*#__PURE__*/React.createElement("mesh", _extends({
    ref: ref,
    frustumCulled: false
  }, props), /*#__PURE__*/React.createElement("gridMaterial", _extends({
    transparent: true,
    "extensions-derivatives": true,
    side: side
  }, uniforms1, uniforms2)), /*#__PURE__*/React.createElement("planeGeometry", {
    args: args
  }));
});

export { Grid };
