import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { useRef, useMemo, useLayoutEffect } from 'react';
import { extend, useThree, useFrame } from '@react-three/fiber';
import { MeshBVHUniformStruct, MeshBVH, SAH } from 'three-mesh-bvh';
import { MeshRefractionMaterial as MeshRefractionMaterial$1 } from '../materials/MeshRefractionMaterial.js';

const isCubeTexture = def => def && def.isCubeTexture;
function MeshRefractionMaterial({
  aberrationStrength = 0,
  fastChroma = true,
  envMap,
  ...props
}) {
  extend({
    MeshRefractionMaterial: MeshRefractionMaterial$1
  });
  const material = useRef();
  const {
    size
  } = useThree();
  const defines = useMemo(() => {
    var _ref, _envMap$image$;
    const temp = {};
    // Sampler2D and SamplerCube need different defines
    const isCubeMap = isCubeTexture(envMap);
    const w = (_ref = isCubeMap ? (_envMap$image$ = envMap.image[0]) == null ? void 0 : _envMap$image$.width : envMap.image.width) !== null && _ref !== void 0 ? _ref : 1024;
    const cubeSize = w / 4;
    const _lodMax = Math.floor(Math.log2(cubeSize));
    const _cubeSize = Math.pow(2, _lodMax);
    const width = 3 * Math.max(_cubeSize, 16 * 7);
    const height = 4 * _cubeSize;
    if (isCubeMap) temp.ENVMAP_TYPE_CUBEM = '';
    temp.CUBEUV_TEXEL_WIDTH = `${1.0 / width}`;
    temp.CUBEUV_TEXEL_HEIGHT = `${1.0 / height}`;
    temp.CUBEUV_MAX_MIP = `${_lodMax}.0`;
    // Add defines from chromatic aberration
    if (aberrationStrength > 0) temp.CHROMATIC_ABERRATIONS = '';
    if (fastChroma) temp.FAST_CHROMA = '';
    return temp;
  }, [aberrationStrength, fastChroma]);
  useLayoutEffect(() => {
    var _material$current;
    // Get the geometry of this materials parent
    const geometry = (_material$current = material.current) == null || (_material$current = _material$current.__r3f) == null || (_material$current = _material$current.parent) == null ? void 0 : _material$current.geometry;
    // Update the BVH
    if (geometry) {
      material.current.bvh = new MeshBVHUniformStruct();
      material.current.bvh.updateFrom(new MeshBVH(geometry.clone().toNonIndexed(), {
        strategy: SAH
      }));
    }
  }, []);
  useFrame(({
    camera
  }) => {
    material.current.viewMatrixInverse = camera.matrixWorld;
    material.current.projectionMatrixInverse = camera.projectionMatrixInverse;
  });
  return /*#__PURE__*/React.createElement("meshRefractionMaterial", _extends({
    // @ts-ignore
    key: JSON.stringify(defines)
    // @ts-ignore
    ,
    defines: defines,
    ref: material,
    resolution: [size.width, size.height],
    aberrationStrength: aberrationStrength,
    envMap: envMap
  }, props));
}

export { MeshRefractionMaterial };
