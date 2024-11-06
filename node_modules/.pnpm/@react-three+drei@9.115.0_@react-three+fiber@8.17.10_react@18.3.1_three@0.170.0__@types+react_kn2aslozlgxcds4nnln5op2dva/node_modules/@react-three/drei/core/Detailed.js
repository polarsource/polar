import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { useFrame } from '@react-three/fiber';

const Detailed = /* @__PURE__ */React.forwardRef(({
  children,
  hysteresis = 0,
  distances,
  ...props
}, ref) => {
  const lodRef = React.useRef(null);
  React.useImperativeHandle(ref, () => lodRef.current, []);
  React.useLayoutEffect(() => {
    const {
      current: lod
    } = lodRef;
    lod.levels.length = 0;
    lod.children.forEach((object, index) => lod.levels.push({
      object,
      hysteresis,
      distance: distances[index]
    }));
  });
  useFrame(state => {
    var _lodRef$current;
    return (_lodRef$current = lodRef.current) == null ? void 0 : _lodRef$current.update(state.camera);
  });
  return /*#__PURE__*/React.createElement("lOD", _extends({
    ref: lodRef
  }, props), children);
});

export { Detailed };
