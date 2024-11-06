import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { useThree, createPortal, useFrame } from '@react-three/fiber';

const RenderCubeTexture = /* @__PURE__ */React.forwardRef(({
  children,
  compute,
  renderPriority = -1,
  eventPriority = 0,
  frames = Infinity,
  stencilBuffer = false,
  depthBuffer = true,
  generateMipmaps = false,
  resolution = 896,
  near = 0.1,
  far = 1000,
  flip = false,
  position,
  rotation,
  scale,
  quaternion,
  matrix,
  matrixAutoUpdate,
  ...props
}, forwardRef) => {
  const {
    size,
    viewport
  } = useThree();
  const camera = React.useRef(null);
  const fbo = React.useMemo(() => {
    const fbo = new THREE.WebGLCubeRenderTarget(Math.max((resolution || size.width) * viewport.dpr, (resolution || size.height) * viewport.dpr), {
      stencilBuffer,
      depthBuffer,
      generateMipmaps
    });
    fbo.texture.isRenderTargetTexture = !flip;
    fbo.texture.flipY = true;
    fbo.texture.type = THREE.HalfFloatType;
    return fbo;
  }, [resolution, flip]);
  React.useEffect(() => {
    return () => fbo.dispose();
  }, [fbo]);
  const [vScene] = React.useState(() => new THREE.Scene());
  React.useImperativeHandle(forwardRef, () => ({
    scene: vScene,
    fbo,
    camera: camera.current
  }), [fbo]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, createPortal( /*#__PURE__*/React.createElement(Container, {
    renderPriority: renderPriority,
    frames: frames,
    camera: camera
  }, children, /*#__PURE__*/React.createElement("group", {
    onPointerOver: () => null
  })), vScene, {
    events: {
      compute,
      priority: eventPriority
    }
  }), /*#__PURE__*/React.createElement("primitive", _extends({
    object: fbo.texture
  }, props)), /*#__PURE__*/React.createElement("cubeCamera", {
    ref: camera,
    args: [near, far, fbo],
    position: position,
    rotation: rotation,
    scale: scale,
    quaternion: quaternion,
    matrix: matrix,
    matrixAutoUpdate: matrixAutoUpdate
  }));
});

// The container component has to be separate, it can not be inlined because "useFrame(state" when run inside createPortal will return
// the portals own state which includes user-land overrides (custom cameras etc), but if it is executed in <RenderTexture>'s render function
// it would return the default state.
function Container({
  frames,
  renderPriority,
  children,
  camera
}) {
  let count = 0;
  useFrame(state => {
    if (frames === Infinity || count < frames) {
      camera.current.update(state.gl, state.scene);
      count++;
    }
  }, renderPriority);
  return /*#__PURE__*/React.createElement(React.Fragment, null, children);
}

export { RenderCubeTexture };
