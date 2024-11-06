import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { extend } from '@react-three/fiber';
import { DiscardMaterial } from '../materials/DiscardMaterial.js';

const MeshDiscardMaterial = /* @__PURE__ */React.forwardRef((props, fref) => {
  extend({
    DiscardMaterialImpl: DiscardMaterial
  });
  return /*#__PURE__*/React.createElement("discardMaterialImpl", _extends({
    ref: fref
  }, props));
});

export { MeshDiscardMaterial };
