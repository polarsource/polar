import * as React from 'react';
import { useLayoutEffect, useEffect, useMemo } from 'react';
import { TextureLoader, Texture as Texture$1 } from 'three';
import { useThree, useLoader } from '@react-three/fiber';

const IsObject = url => url === Object(url) && !Array.isArray(url) && typeof url !== 'function';
function useTexture(input, onLoad) {
  const gl = useThree(state => state.gl);
  const textures = useLoader(TextureLoader, IsObject(input) ? Object.values(input) : input);
  useLayoutEffect(() => {
    onLoad == null || onLoad(textures);
  }, [onLoad]);

  // https://github.com/mrdoob/three.js/issues/22696
  // Upload the texture to the GPU immediately instead of waiting for the first render
  // NOTE: only available for WebGLRenderer
  useEffect(() => {
    if ('initTexture' in gl) {
      let textureArray = [];
      if (Array.isArray(textures)) {
        textureArray = textures;
      } else if (textures instanceof Texture$1) {
        textureArray = [textures];
      } else if (IsObject(textures)) {
        textureArray = Object.values(textures);
      }
      textureArray.forEach(texture => {
        if (texture instanceof Texture$1) {
          gl.initTexture(texture);
        }
      });
    }
  }, [gl, textures]);
  const mappedTextures = useMemo(() => {
    if (IsObject(input)) {
      const keyed = {};
      let i = 0;
      for (const key in input) keyed[key] = textures[i++];
      return keyed;
    } else {
      return textures;
    }
  }, [input, textures]);
  return mappedTextures;
}
useTexture.preload = url => useLoader.preload(TextureLoader, url);
useTexture.clear = input => useLoader.clear(TextureLoader, input);

//

const Texture = ({
  children,
  input,
  onLoad
}) => {
  const ret = useTexture(input, onLoad);
  return /*#__PURE__*/React.createElement(React.Fragment, null, children == null ? void 0 : children(ret));
};

export { IsObject, Texture, useTexture };
