import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';

function MultiMaterial(props) {
  const group = React.useRef(null);
  React.useLayoutEffect(() => {
    var _group$current;
    const parent = (_group$current = group.current) == null ? void 0 : _group$current.parent;
    const geometry = parent == null ? void 0 : parent.geometry;
    if (geometry) {
      const oldMaterial = parent.material;
      parent.material = group.current.__r3f.objects;
      const oldGroups = [...geometry.groups];
      geometry.clearGroups();
      parent.material.forEach((material, index) => {
        if (index < parent.material.length - 1) material.depthWrite = false;
        geometry.addGroup(0, Infinity, index);
      });
      return () => {
        parent.material = oldMaterial;
        geometry.groups = oldGroups;
      };
    }
  });
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: group
  }, props));
}

export { MultiMaterial };
