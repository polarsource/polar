import * as React from 'react';
import { useEffect } from 'react';
import { useThree, useLoader } from '@react-three/fiber';
import { KTX2Loader } from 'three-stdlib';
import { IsObject } from './Texture.js';

const cdn = 'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master';
function useKTX2(input, basisPath = `${cdn}/basis/`) {
  const gl = useThree(state => state.gl);
  const textures = useLoader(KTX2Loader, IsObject(input) ? Object.values(input) : input, loader => {
    loader.detectSupport(gl);
    loader.setTranscoderPath(basisPath);
  });

  // https://github.com/mrdoob/three.js/issues/22696
  // Upload the texture to the GPU immediately instead of waiting for the first render
  useEffect(() => {
    const array = Array.isArray(textures) ? textures : [textures];
    array.forEach(gl.initTexture);
  }, [gl, textures]);
  if (IsObject(input)) {
    const keys = Object.keys(input);
    const keyed = {};
    keys.forEach(key => Object.assign(keyed, {
      [key]: textures[keys.indexOf(key)]
    }));
    return keyed;
  } else {
    return textures;
  }
}
useKTX2.preload = (url, basisPath = `${cdn}/basis/`) => useLoader.preload(KTX2Loader, url, loader => {
  loader.setTranscoderPath(basisPath);
});
useKTX2.clear = input => useLoader.clear(KTX2Loader, input);

//

const Ktx2 = ({
  children,
  input,
  basisPath
}) => {
  const texture = useKTX2(input, basisPath);
  return /*#__PURE__*/React.createElement(React.Fragment, null, children == null ? void 0 : children(texture));
};

export { Ktx2, useKTX2 };
