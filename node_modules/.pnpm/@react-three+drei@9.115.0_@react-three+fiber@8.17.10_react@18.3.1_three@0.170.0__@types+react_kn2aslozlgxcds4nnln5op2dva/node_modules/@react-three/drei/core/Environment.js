import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { useThree, useFrame, createPortal, applyProps, extend } from '@react-three/fiber';
import { Scene, WebGLCubeRenderTarget, HalfFloatType } from 'three';
import { GroundProjectedEnv } from 'three-stdlib';
import { useEnvironment } from './useEnvironment.js';

const isRef = obj => obj.current && obj.current.isScene;
const resolveScene = scene => isRef(scene) ? scene.current : scene;
function setEnvProps(background, scene, defaultScene, texture, sceneProps = {}) {
  var _sceneProps$blur, _target$backgroundRot, _target$backgroundRot2, _target$environmentRo, _target$environmentRo2;
  // defaults
  sceneProps = {
    backgroundBlurriness: (_sceneProps$blur = sceneProps.blur) !== null && _sceneProps$blur !== void 0 ? _sceneProps$blur : 0,
    backgroundIntensity: 1,
    backgroundRotation: [0, 0, 0],
    environmentIntensity: 1,
    environmentRotation: [0, 0, 0],
    ...sceneProps
  };
  const target = resolveScene(scene || defaultScene);
  const oldbg = target.background;
  const oldenv = target.environment;
  const oldSceneProps = {
    // @ts-ignore
    backgroundBlurriness: target.backgroundBlurriness,
    // @ts-ignore
    backgroundIntensity: target.backgroundIntensity,
    // @ts-ignore
    backgroundRotation: (_target$backgroundRot = (_target$backgroundRot2 = target.backgroundRotation) == null || _target$backgroundRot2.clone == null ? void 0 : _target$backgroundRot2.clone()) !== null && _target$backgroundRot !== void 0 ? _target$backgroundRot : [0, 0, 0],
    // @ts-ignore
    environmentIntensity: target.environmentIntensity,
    // @ts-ignore
    environmentRotation: (_target$environmentRo = (_target$environmentRo2 = target.environmentRotation) == null || _target$environmentRo2.clone == null ? void 0 : _target$environmentRo2.clone()) !== null && _target$environmentRo !== void 0 ? _target$environmentRo : [0, 0, 0]
  };
  if (background !== 'only') target.environment = texture;
  if (background) target.background = texture;
  applyProps(target, sceneProps);
  return () => {
    if (background !== 'only') target.environment = oldenv;
    if (background) target.background = oldbg;
    applyProps(target, oldSceneProps);
  };
}
function EnvironmentMap({
  scene,
  background = false,
  map,
  ...config
}) {
  const defaultScene = useThree(state => state.scene);
  React.useLayoutEffect(() => {
    if (map) return setEnvProps(background, scene, defaultScene, map, config);
  });
  return null;
}
function EnvironmentCube({
  background = false,
  scene,
  blur,
  backgroundBlurriness,
  backgroundIntensity,
  backgroundRotation,
  environmentIntensity,
  environmentRotation,
  ...rest
}) {
  const texture = useEnvironment(rest);
  const defaultScene = useThree(state => state.scene);
  React.useLayoutEffect(() => {
    return setEnvProps(background, scene, defaultScene, texture, {
      blur,
      backgroundBlurriness,
      backgroundIntensity,
      backgroundRotation,
      environmentIntensity,
      environmentRotation
    });
  });
  return null;
}
function EnvironmentPortal({
  children,
  near = 1,
  far = 1000,
  resolution = 256,
  frames = 1,
  map,
  background = false,
  blur,
  backgroundBlurriness,
  backgroundIntensity,
  backgroundRotation,
  environmentIntensity,
  environmentRotation,
  scene,
  files,
  path,
  preset = undefined,
  extensions
}) {
  const gl = useThree(state => state.gl);
  const defaultScene = useThree(state => state.scene);
  const camera = React.useRef(null);
  const [virtualScene] = React.useState(() => new Scene());
  const fbo = React.useMemo(() => {
    const fbo = new WebGLCubeRenderTarget(resolution);
    fbo.texture.type = HalfFloatType;
    return fbo;
  }, [resolution]);
  React.useLayoutEffect(() => {
    if (frames === 1) camera.current.update(gl, virtualScene);
    return setEnvProps(background, scene, defaultScene, fbo.texture, {
      blur,
      backgroundBlurriness,
      backgroundIntensity,
      backgroundRotation,
      environmentIntensity,
      environmentRotation
    });
  }, [children, virtualScene, fbo.texture, scene, defaultScene, background, frames, gl]);
  let count = 1;
  useFrame(() => {
    if (frames === Infinity || count < frames) {
      camera.current.update(gl, virtualScene);
      count++;
    }
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, createPortal( /*#__PURE__*/React.createElement(React.Fragment, null, children, /*#__PURE__*/React.createElement("cubeCamera", {
    ref: camera,
    args: [near, far, fbo]
  }), files || preset ? /*#__PURE__*/React.createElement(EnvironmentCube, {
    background: true,
    files: files,
    preset: preset,
    path: path,
    extensions: extensions
  }) : map ? /*#__PURE__*/React.createElement(EnvironmentMap, {
    background: true,
    map: map,
    extensions: extensions
  }) : null), virtualScene));
}
function EnvironmentGround(props) {
  var _props$ground, _props$ground2, _scale, _props$ground3;
  const textureDefault = useEnvironment(props);
  const texture = props.map || textureDefault;
  React.useMemo(() => extend({
    GroundProjectedEnvImpl: GroundProjectedEnv
  }), []);
  const args = React.useMemo(() => [texture], [texture]);
  const height = (_props$ground = props.ground) == null ? void 0 : _props$ground.height;
  const radius = (_props$ground2 = props.ground) == null ? void 0 : _props$ground2.radius;
  const scale = (_scale = (_props$ground3 = props.ground) == null ? void 0 : _props$ground3.scale) !== null && _scale !== void 0 ? _scale : 1000;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(EnvironmentMap, _extends({}, props, {
    map: texture
  })), /*#__PURE__*/React.createElement("groundProjectedEnvImpl", {
    args: args,
    scale: scale,
    height: height,
    radius: radius
  }));
}
function Environment(props) {
  return props.ground ? /*#__PURE__*/React.createElement(EnvironmentGround, props) : props.map ? /*#__PURE__*/React.createElement(EnvironmentMap, props) : props.children ? /*#__PURE__*/React.createElement(EnvironmentPortal, props) : /*#__PURE__*/React.createElement(EnvironmentCube, props);
}

export { Environment, EnvironmentCube, EnvironmentMap, EnvironmentPortal };
