import * as React from 'react';
import { CubeTextureLoader } from 'three';
import { useLoader } from '@react-three/fiber';

function useCubeTexture(files, {
  path
}) {
  // @ts-ignore
  const [cubeTexture] = useLoader(
  // @ts-ignore
  CubeTextureLoader, [files], loader => loader.setPath(path));
  return cubeTexture;
}
useCubeTexture.preload = (files, {
  path
}) => useLoader.preload(
// @ts-ignore
CubeTextureLoader, [files], loader => loader.setPath(path));
function CubeTexture({
  children,
  files,
  ...options
}) {
  const texture = useCubeTexture(files, {
    ...options
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, children == null ? void 0 : children(texture));
}

export { CubeTexture, useCubeTexture };
