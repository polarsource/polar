import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { GLTFLoader, DRACOLoader, MeshoptDecoder } from 'three-stdlib';
import { useLoader } from '@react-three/fiber';
import { Clone } from './Clone.js';

let dracoLoader = null;
let decoderPath = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/';
function extensions(useDraco = true, useMeshopt = true, extendLoader) {
  return loader => {
    if (extendLoader) {
      extendLoader(loader);
    }
    if (useDraco) {
      if (!dracoLoader) {
        dracoLoader = new DRACOLoader();
      }
      dracoLoader.setDecoderPath(typeof useDraco === 'string' ? useDraco : decoderPath);
      loader.setDRACOLoader(dracoLoader);
    }
    if (useMeshopt) {
      loader.setMeshoptDecoder(typeof MeshoptDecoder === 'function' ? MeshoptDecoder() : MeshoptDecoder);
    }
  };
}
const useGLTF = (path, useDraco, useMeshopt, extendLoader) => useLoader(GLTFLoader, path, extensions(useDraco, useMeshopt, extendLoader));
useGLTF.preload = (path, useDraco, useMeshopt, extendLoader) => useLoader.preload(GLTFLoader, path, extensions(useDraco, useMeshopt, extendLoader));
useGLTF.clear = path => useLoader.clear(GLTFLoader, path);
useGLTF.setDecoderPath = path => {
  decoderPath = path;
};

//

const Gltf = /* @__PURE__ */React.forwardRef(({
  src,
  useDraco,
  useMeshOpt,
  extendLoader,
  ...props
}, ref) => {
  const {
    scene
  } = useGLTF(src, useDraco, useMeshOpt, extendLoader);
  return /*#__PURE__*/React.createElement(Clone, _extends({
    ref: ref
  }, props, {
    object: scene
  }));
});

export { Gltf, useGLTF };
