import { DepthTexture, DepthFormat, UnsignedShortType } from 'three';
import * as React from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useFBO } from './Fbo.js';

function useDepthBuffer({
  size = 256,
  frames = Infinity
} = {}) {
  const dpr = useThree(state => state.viewport.dpr);
  const {
    width,
    height
  } = useThree(state => state.size);
  const w = size || width * dpr;
  const h = size || height * dpr;
  const depthConfig = React.useMemo(() => {
    const depthTexture = new DepthTexture(w, h);
    depthTexture.format = DepthFormat;
    depthTexture.type = UnsignedShortType;
    return {
      depthTexture
    };
  }, [w, h]);
  let count = 0;
  const depthFBO = useFBO(w, h, depthConfig);
  useFrame(state => {
    if (frames === Infinity || count < frames) {
      state.gl.setRenderTarget(depthFBO);
      state.gl.render(state.scene, state.camera);
      state.gl.setRenderTarget(null);
      count++;
    }
  });
  return depthFBO.depthTexture;
}

export { useDepthBuffer };
