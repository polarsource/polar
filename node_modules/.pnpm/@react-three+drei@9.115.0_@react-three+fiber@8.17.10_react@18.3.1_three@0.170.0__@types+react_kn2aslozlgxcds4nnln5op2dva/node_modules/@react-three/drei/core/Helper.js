import * as React from 'react';
import { useThree, useFrame } from '@react-three/fiber';

function useHelper(object3D, helperConstructor, ...args) {
  const helper = React.useRef();
  const scene = useThree(state => state.scene);
  React.useLayoutEffect(() => {
    let currentHelper = undefined;
    if (object3D && object3D != null && object3D.current && helperConstructor) {
      helper.current = currentHelper = new helperConstructor(object3D.current, ...args);
    }
    if (currentHelper) {
      // Prevent the helpers from blocking rays
      currentHelper.traverse(child => child.raycast = () => null);
      scene.add(currentHelper);
      return () => {
        helper.current = undefined;
        scene.remove(currentHelper);
        currentHelper.dispose == null || currentHelper.dispose();
      };
    }
  }, [scene, helperConstructor, object3D, ...args]);
  useFrame(() => {
    var _helper$current;
    return void ((_helper$current = helper.current) == null || _helper$current.update == null ? void 0 : _helper$current.update());
  });
  return helper;
}

//

const Helper = ({
  type: helperConstructor,
  args = []
}) => {
  const thisRef = React.useRef(null);
  const parentRef = React.useRef(null);
  React.useLayoutEffect(() => {
    parentRef.current = thisRef.current.parent;
  });
  useHelper(parentRef, helperConstructor, ...args);
  return /*#__PURE__*/React.createElement("object3D", {
    ref: thisRef
  });
};

export { Helper, useHelper };
