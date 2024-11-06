import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { SkeletonUtils } from 'three-stdlib';

function createSpread(child, {
  keys = ['near', 'far', 'color', 'distance', 'decay', 'penumbra', 'angle', 'intensity', 'skeleton', 'visible', 'castShadow', 'receiveShadow', 'morphTargetDictionary', 'morphTargetInfluences', 'name', 'geometry', 'material', 'position', 'rotation', 'scale', 'up', 'userData', 'bindMode', 'bindMatrix', 'bindMatrixInverse', 'skeleton'],
  deep,
  inject,
  castShadow,
  receiveShadow
}) {
  let spread = {};
  for (const key of keys) {
    spread[key] = child[key];
  }
  if (deep) {
    if (spread.geometry && deep !== 'materialsOnly') spread.geometry = spread.geometry.clone();
    if (spread.material && deep !== 'geometriesOnly') spread.material = spread.material.clone();
  }
  if (inject) {
    if (typeof inject === 'function') spread = {
      ...spread,
      children: inject(child)
    };else if ( /*#__PURE__*/React.isValidElement(inject)) spread = {
      ...spread,
      children: inject
    };else spread = {
      ...spread,
      ...inject
    };
  }
  if (child instanceof THREE.Mesh) {
    if (castShadow) spread.castShadow = true;
    if (receiveShadow) spread.receiveShadow = true;
  }
  return spread;
}
const Clone = /* @__PURE__ */React.forwardRef(({
  isChild = false,
  object,
  children,
  deep,
  castShadow,
  receiveShadow,
  inject,
  keys,
  ...props
}, forwardRef) => {
  const config = {
    keys,
    deep,
    inject,
    castShadow,
    receiveShadow
  };
  object = React.useMemo(() => {
    if (isChild === false && !Array.isArray(object)) {
      let isSkinned = false;
      object.traverse(object => {
        if (object.isSkinnedMesh) isSkinned = true;
      });
      if (isSkinned) return SkeletonUtils.clone(object);
    }
    return object;
  }, [object, isChild]);

  // Deal with arrayed clones
  if (Array.isArray(object)) {
    return /*#__PURE__*/React.createElement("group", _extends({}, props, {
      ref: forwardRef
    }), object.map(o => /*#__PURE__*/React.createElement(Clone, _extends({
      key: o.uuid,
      object: o
    }, config))), children);
  }

  // Singleton clones
  const {
    children: injectChildren,
    ...spread
  } = createSpread(object, config);
  const Element = object.type[0].toLowerCase() + object.type.slice(1);
  return /*#__PURE__*/React.createElement(Element, _extends({}, spread, props, {
    ref: forwardRef
  }), object.children.map(child => {
    if (child.type === 'Bone') return /*#__PURE__*/React.createElement("primitive", _extends({
      key: child.uuid,
      object: child
    }, config));
    return /*#__PURE__*/React.createElement(Clone, _extends({
      key: child.uuid,
      object: child
    }, config, {
      isChild: true
    }));
  }), children, injectChildren);
});

export { Clone };
