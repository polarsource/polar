import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const boundingBox = /* @__PURE__ */new THREE.Box3();
const boundingBoxSize = /* @__PURE__ */new THREE.Vector3();
const BBAnchor = ({
  anchor,
  ...props
}) => {
  const ref = React.useRef(null);
  const parentRef = React.useRef(null);

  // Reattach group created by this component to the parent's parent,
  // so it becomes a sibling of its initial parent.
  // We do that so the children have no impact on a bounding box of a parent.
  React.useEffect(() => {
    var _ref$current;
    if ((_ref$current = ref.current) != null && (_ref$current = _ref$current.parent) != null && _ref$current.parent) {
      parentRef.current = ref.current.parent;
      ref.current.parent.parent.add(ref.current);
    }
  }, []);
  useFrame(() => {
    if (parentRef.current) {
      boundingBox.setFromObject(parentRef.current);
      boundingBox.getSize(boundingBoxSize);
      ref.current.position.set(parentRef.current.position.x + boundingBoxSize.x * (Array.isArray(anchor) ? anchor[0] : anchor.x) / 2, parentRef.current.position.y + boundingBoxSize.y * (Array.isArray(anchor) ? anchor[1] : anchor.y) / 2, parentRef.current.position.z + boundingBoxSize.z * (Array.isArray(anchor) ? anchor[2] : anchor.z) / 2);
    }
  });
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: ref
  }, props));
};

export { BBAnchor };
