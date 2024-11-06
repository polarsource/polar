import * as THREE from 'three';
import { WebGLCubeRenderTarget, HalfFloatType } from 'three';
import * as React from 'react';
import { useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';

function useCubeCamera({
  resolution = 256,
  near = 0.1,
  far = 1000,
  envMap,
  fog
} = {}) {
  const gl = useThree(({
    gl
  }) => gl);
  const scene = useThree(({
    scene
  }) => scene);
  const fbo = useMemo(() => {
    const fbo = new WebGLCubeRenderTarget(resolution);
    fbo.texture.type = HalfFloatType;
    return fbo;
  }, [resolution]);
  useEffect(() => {
    return () => {
      fbo.dispose();
    };
  }, [fbo]);
  const camera = useMemo(() => new THREE.CubeCamera(near, far, fbo), [near, far, fbo]);
  let originalFog;
  let originalBackground;
  const update = React.useCallback(() => {
    originalFog = scene.fog;
    originalBackground = scene.background;
    scene.background = envMap || originalBackground;
    scene.fog = fog || originalFog;
    camera.update(gl, scene);
    scene.fog = originalFog;
    scene.background = originalBackground;
  }, [gl, scene, camera]);
  return {
    fbo,
    camera,
    update
  };
}
function CubeCamera({
  children,
  frames = Infinity,
  resolution,
  near,
  far,
  envMap,
  fog,
  ...props
}) {
  const ref = React.useRef(null);
  const {
    fbo,
    camera,
    update
  } = useCubeCamera({
    resolution,
    near,
    far,
    envMap,
    fog
  });
  let count = 0;
  useFrame(() => {
    if (ref.current && (frames === Infinity || count < frames)) {
      ref.current.visible = false;
      update();
      ref.current.visible = true;
      count++;
    }
  });
  return /*#__PURE__*/React.createElement("group", props, /*#__PURE__*/React.createElement("primitive", {
    object: camera
  }), /*#__PURE__*/React.createElement("group", {
    ref: ref
  }, children == null ? void 0 : children(fbo.texture)));
}

export { CubeCamera, useCubeCamera };
