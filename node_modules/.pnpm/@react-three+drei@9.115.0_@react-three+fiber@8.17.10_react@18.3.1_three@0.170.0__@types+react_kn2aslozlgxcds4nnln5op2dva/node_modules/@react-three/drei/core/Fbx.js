import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { FBXLoader } from 'three-stdlib';
import { useLoader } from '@react-three/fiber';
import { Clone } from './Clone.js';

function useFBX(path) {
  return useLoader(FBXLoader, path);
}
useFBX.preload = path => useLoader.preload(FBXLoader, path);
useFBX.clear = input => useLoader.clear(FBXLoader, input);
function Fbx({
  path,
  ...props
}) {
  const fbx = useFBX(path);
  const object = fbx.children[0];
  return /*#__PURE__*/React.createElement(Clone, _extends({}, props, {
    object: object
  }));
}

export { Fbx, useFBX };
