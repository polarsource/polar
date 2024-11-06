import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

function BakeShadows() {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = gl.shadowMap.needsUpdate = true;
    };
  }, [gl.shadowMap]);
  return null;
}

export { BakeShadows };
