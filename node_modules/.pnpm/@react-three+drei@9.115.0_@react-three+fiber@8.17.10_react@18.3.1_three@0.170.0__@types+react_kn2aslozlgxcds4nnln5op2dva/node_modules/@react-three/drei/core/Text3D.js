import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { useMemo } from 'react';
import { extend } from '@react-three/fiber';
import { TextGeometry, mergeVertices } from 'three-stdlib';
import { useFont } from './useFont.js';

const types = ['string', 'number'];
const getTextFromChildren = children => {
  let label = '';
  const rest = [];
  React.Children.forEach(children, child => {
    if (types.includes(typeof child)) label += child + '';else rest.push(child);
  });
  return [label, ...rest];
};
const Text3D = /* @__PURE__ */React.forwardRef(({
  font: _font,
  letterSpacing = 0,
  lineHeight = 1,
  size = 1,
  height = 0.2,
  bevelThickness = 0.1,
  bevelSize = 0.01,
  bevelEnabled = false,
  bevelOffset = 0,
  bevelSegments = 4,
  curveSegments = 8,
  smooth,
  children,
  ...props
}, fref) => {
  React.useMemo(() => extend({
    RenamedTextGeometry: TextGeometry
  }), []);
  const ref = React.useRef(null);
  const font = useFont(_font);
  const opts = useMemo(() => {
    return {
      font,
      size,
      height,
      bevelThickness,
      bevelSize,
      bevelEnabled,
      bevelSegments,
      bevelOffset,
      curveSegments,
      letterSpacing,
      lineHeight
    };
  }, [font, size, height, bevelThickness, bevelSize, bevelEnabled, bevelSegments, bevelOffset, curveSegments, letterSpacing, lineHeight]);

  /**
   * We need the `children` in the deps because we
   * need to be able to do `<Text3d>{state}</Text3d>`.
   */
  const [label, ...rest] = useMemo(() => getTextFromChildren(children), [children]);
  const args = React.useMemo(() => [label, opts], [label, opts]);
  React.useLayoutEffect(() => {
    if (smooth) {
      ref.current.geometry = mergeVertices(ref.current.geometry, smooth);
      ref.current.geometry.computeVertexNormals();
    }
  }, [args, smooth]);
  React.useImperativeHandle(fref, () => ref.current, []);
  return /*#__PURE__*/React.createElement("mesh", _extends({}, props, {
    ref: ref
  }), /*#__PURE__*/React.createElement("renamedTextGeometry", {
    args: args
  }), rest);
});

export { Text3D };
