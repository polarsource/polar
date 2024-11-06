import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { BufferAttribute } from 'three';

/**
 * Used exclusively as a child of a BufferGeometry.
 * Computes the BufferAttribute by calling the `compute` function
 * and attaches the attribute to the geometry.
 */
const ComputedAttribute = ({
  compute,
  name,
  ...props
}) => {
  const [bufferAttribute] = React.useState(() => new BufferAttribute(new Float32Array(0), 1));
  const primitive = React.useRef(null);
  React.useLayoutEffect(() => {
    if (primitive.current) {
      var _ref;
      // @ts-expect-error brittle
      const parent = (_ref = primitive.current.parent) !== null && _ref !== void 0 ? _ref : primitive.current.__r3f.parent;
      const attr = compute(parent);
      primitive.current.copy(attr);
    }
  }, [compute]);
  return /*#__PURE__*/React.createElement("primitive", _extends({
    ref: primitive,
    object: bufferAttribute,
    attach: `attributes-${name}`
  }, props));
};

export { ComputedAttribute };
