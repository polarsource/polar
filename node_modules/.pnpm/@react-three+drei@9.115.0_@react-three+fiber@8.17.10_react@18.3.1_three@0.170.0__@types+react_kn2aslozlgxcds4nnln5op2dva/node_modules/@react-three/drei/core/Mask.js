import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';

const Mask = /* @__PURE__ */React.forwardRef(({
  id = 1,
  colorWrite = false,
  depthWrite = false,
  ...props
}, fref) => {
  const ref = React.useRef(null);
  const spread = React.useMemo(() => ({
    colorWrite,
    depthWrite,
    stencilWrite: true,
    stencilRef: id,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZFail: THREE.ReplaceStencilOp,
    stencilZPass: THREE.ReplaceStencilOp
  }), [id, colorWrite, depthWrite]);
  React.useLayoutEffect(() => {
    Object.assign(ref.current.material, spread);
  });
  React.useImperativeHandle(fref, () => ref.current, []);
  return /*#__PURE__*/React.createElement("mesh", _extends({
    ref: ref,
    renderOrder: -id
  }, props));
});
function useMask(id, inverse = false) {
  return {
    stencilWrite: true,
    stencilRef: id,
    stencilFunc: inverse ? THREE.NotEqualStencilFunc : THREE.EqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  };
}

export { Mask, useMask };
