import * as React from 'react';
import { useThree } from '@react-three/fiber';

function AdaptiveDpr({
  pixelated
}) {
  const gl = useThree(state => state.gl);
  const active = useThree(state => state.internal.active);
  const current = useThree(state => state.performance.current);
  const initialDpr = useThree(state => state.viewport.initialDpr);
  const setDpr = useThree(state => state.setDpr);
  // Restore initial pixelratio on unmount
  React.useEffect(() => {
    const domElement = gl.domElement;
    return () => {
      if (active) setDpr(initialDpr);
      if (pixelated && domElement) domElement.style.imageRendering = 'auto';
    };
  }, []);
  // Set adaptive pixelratio
  React.useEffect(() => {
    setDpr(current * initialDpr);
    if (pixelated && gl.domElement) gl.domElement.style.imageRendering = current === 1 ? 'auto' : 'pixelated';
  }, [current]);
  return null;
}

export { AdaptiveDpr };
