import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Vector3, CylinderGeometry, Matrix4, WebGLRenderTarget, RGBAFormat, ShaderMaterial, DoubleSide, RepeatWrapping } from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { FullScreenQuad } from 'three-stdlib';
import { SpotLightMaterial } from '../materials/SpotLightMaterial.js';
import SpotlightShadowShader from '../helpers/glsl/DefaultSpotlightShadowShadows.glsl.js';

const isSpotLight = child => {
  return child == null ? void 0 : child.isSpotLight;
};
function VolumetricMesh({
  opacity = 1,
  radiusTop,
  radiusBottom,
  depthBuffer,
  color = 'white',
  distance = 5,
  angle = 0.15,
  attenuation = 5,
  anglePower = 5
}) {
  const mesh = React.useRef(null);
  const size = useThree(state => state.size);
  const camera = useThree(state => state.camera);
  const dpr = useThree(state => state.viewport.dpr);
  const [material] = React.useState(() => new SpotLightMaterial());
  const [vec] = React.useState(() => new Vector3());
  radiusTop = radiusTop === undefined ? 0.1 : radiusTop;
  radiusBottom = radiusBottom === undefined ? angle * 7 : radiusBottom;
  useFrame(() => {
    material.uniforms.spotPosition.value.copy(mesh.current.getWorldPosition(vec));
    mesh.current.lookAt(mesh.current.parent.target.getWorldPosition(vec));
  });
  const geom = React.useMemo(() => {
    const geometry = new CylinderGeometry(radiusTop, radiusBottom, distance, 128, 64, true);
    geometry.applyMatrix4(new Matrix4().makeTranslation(0, -distance / 2, 0));
    geometry.applyMatrix4(new Matrix4().makeRotationX(-Math.PI / 2));
    return geometry;
  }, [distance, radiusTop, radiusBottom]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("mesh", {
    ref: mesh,
    geometry: geom,
    raycast: () => null
  }, /*#__PURE__*/React.createElement("primitive", {
    object: material,
    attach: "material",
    "uniforms-opacity-value": opacity,
    "uniforms-lightColor-value": color,
    "uniforms-attenuation-value": attenuation,
    "uniforms-anglePower-value": anglePower,
    "uniforms-depth-value": depthBuffer,
    "uniforms-cameraNear-value": camera.near,
    "uniforms-cameraFar-value": camera.far,
    "uniforms-resolution-value": depthBuffer ? [size.width * dpr, size.height * dpr] : [0, 0]
  })));
}
function useCommon(spotlight, mesh, width, height, distance) {
  const [[pos, dir]] = React.useState(() => [new Vector3(), new Vector3()]);
  React.useLayoutEffect(() => {
    if (isSpotLight(spotlight.current)) {
      spotlight.current.shadow.mapSize.set(width, height);
      spotlight.current.shadow.needsUpdate = true;
    } else {
      throw new Error('SpotlightShadow must be a child of a SpotLight');
    }
  }, [spotlight, width, height]);
  useFrame(() => {
    if (!spotlight.current) return;
    const A = spotlight.current.position;
    const B = spotlight.current.target.position;
    dir.copy(B).sub(A);
    var len = dir.length();
    dir.normalize().multiplyScalar(len * distance);
    pos.copy(A).add(dir);
    mesh.current.position.copy(pos);
    mesh.current.lookAt(spotlight.current.target.position);
  });
}
function SpotlightShadowWithShader({
  distance = 0.4,
  alphaTest = 0.5,
  map,
  shader = SpotlightShadowShader,
  width = 512,
  height = 512,
  scale = 1,
  children,
  ...rest
}) {
  const mesh = React.useRef(null);
  const spotlight = rest.spotlightRef;
  const debug = rest.debug;
  useCommon(spotlight, mesh, width, height, distance);
  const renderTarget = React.useMemo(() => new WebGLRenderTarget(width, height, {
    format: RGBAFormat,
    stencilBuffer: false
    // depthTexture: null!
  }), [width, height]);
  const uniforms = React.useRef({
    uShadowMap: {
      value: map
    },
    uTime: {
      value: 0
    }
  });
  React.useEffect(() => void (uniforms.current.uShadowMap.value = map), [map]);
  const fsQuad = React.useMemo(() => new FullScreenQuad(new ShaderMaterial({
    uniforms: uniforms.current,
    vertexShader: /* glsl */`
          varying vec2 vUv;

          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
          `,
    fragmentShader: shader
  })), [shader]);
  React.useEffect(() => () => {
    fsQuad.material.dispose();
    fsQuad.dispose();
  }, [fsQuad]);
  React.useEffect(() => () => renderTarget.dispose(), [renderTarget]);
  useFrame(({
    gl
  }, dt) => {
    uniforms.current.uTime.value += dt;
    gl.setRenderTarget(renderTarget);
    fsQuad.render(gl);
    gl.setRenderTarget(null);
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("mesh", {
    ref: mesh,
    scale: scale,
    castShadow: true
  }, /*#__PURE__*/React.createElement("planeGeometry", null), /*#__PURE__*/React.createElement("meshBasicMaterial", {
    transparent: true,
    side: DoubleSide,
    alphaTest: alphaTest,
    alphaMap: renderTarget.texture,
    "alphaMap-wrapS": RepeatWrapping,
    "alphaMap-wrapT": RepeatWrapping,
    opacity: debug ? 1 : 0
  }, children)));
}
function SpotlightShadowWithoutShader({
  distance = 0.4,
  alphaTest = 0.5,
  map,
  width = 512,
  height = 512,
  scale,
  children,
  ...rest
}) {
  const mesh = React.useRef(null);
  const spotlight = rest.spotlightRef;
  const debug = rest.debug;
  useCommon(spotlight, mesh, width, height, distance);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("mesh", {
    ref: mesh,
    scale: scale,
    castShadow: true
  }, /*#__PURE__*/React.createElement("planeGeometry", null), /*#__PURE__*/React.createElement("meshBasicMaterial", {
    transparent: true,
    side: DoubleSide,
    alphaTest: alphaTest,
    alphaMap: map,
    "alphaMap-wrapS": RepeatWrapping,
    "alphaMap-wrapT": RepeatWrapping,
    opacity: debug ? 1 : 0
  }, children)));
}
function SpotLightShadow(props) {
  if (props.shader) return /*#__PURE__*/React.createElement(SpotlightShadowWithShader, props);
  return /*#__PURE__*/React.createElement(SpotlightShadowWithoutShader, props);
}
const SpotLight = /*#__PURE__*/React.forwardRef(({
  // Volumetric
  opacity = 1,
  radiusTop,
  radiusBottom,
  depthBuffer,
  color = 'white',
  distance = 5,
  angle = 0.15,
  attenuation = 5,
  anglePower = 5,
  volumetric = true,
  debug = false,
  children,
  ...props
}, ref) => {
  const spotlight = React.useRef(null);
  React.useImperativeHandle(ref, () => spotlight.current, []);
  return /*#__PURE__*/React.createElement("group", null, debug && spotlight.current && /*#__PURE__*/React.createElement("spotLightHelper", {
    args: [spotlight.current]
  }), /*#__PURE__*/React.createElement("spotLight", _extends({
    ref: spotlight,
    angle: angle,
    color: color,
    distance: distance,
    castShadow: true
  }, props), volumetric && /*#__PURE__*/React.createElement(VolumetricMesh, {
    debug: debug,
    opacity: opacity,
    radiusTop: radiusTop,
    radiusBottom: radiusBottom,
    depthBuffer: depthBuffer,
    color: color,
    distance: distance,
    angle: angle,
    attenuation: attenuation,
    anglePower: anglePower
  })), children && /*#__PURE__*/React.cloneElement(children, {
    spotlightRef: spotlight,
    debug: debug
  }));
});

export { SpotLight, SpotLightShadow };
