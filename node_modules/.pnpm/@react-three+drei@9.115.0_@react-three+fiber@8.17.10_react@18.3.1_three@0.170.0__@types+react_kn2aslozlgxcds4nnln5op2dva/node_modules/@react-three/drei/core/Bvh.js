import _extends from '@babel/runtime/helpers/esm/extends';
import { useThree } from '@react-three/fiber';
import * as React from 'react';
import { Mesh } from 'three';
import { SAH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

const isMesh = child => child.isMesh;

/**
 * @deprecated Use the Bvh component instead
 */
function useBVH(mesh, options) {
  options = {
    strategy: SAH,
    verbose: false,
    setBoundingBox: true,
    maxDepth: 40,
    maxLeafTris: 10,
    indirect: false,
    ...options
  };
  React.useEffect(() => {
    if (mesh.current) {
      mesh.current.raycast = acceleratedRaycast;
      const geometry = mesh.current.geometry;
      geometry.computeBoundsTree = computeBoundsTree;
      geometry.disposeBoundsTree = disposeBoundsTree;
      geometry.computeBoundsTree(options);
      return () => {
        if (geometry.boundsTree) {
          geometry.disposeBoundsTree();
        }
      };
    }
  }, [mesh, JSON.stringify(options)]);
}
const Bvh = /* @__PURE__ */React.forwardRef(({
  enabled = true,
  firstHitOnly = false,
  children,
  strategy = SAH,
  verbose = false,
  setBoundingBox = true,
  maxDepth = 40,
  maxLeafTris = 10,
  indirect = false,
  ...props
}, fref) => {
  const ref = React.useRef(null);
  const raycaster = useThree(state => state.raycaster);
  React.useImperativeHandle(fref, () => ref.current, []);
  React.useEffect(() => {
    if (enabled) {
      const options = {
        strategy,
        verbose,
        setBoundingBox,
        maxDepth,
        maxLeafTris,
        indirect
      };
      const group = ref.current;
      // This can only safely work if the component is used once, but there is no alternative.
      // Hijacking the raycast method to do it for individual meshes is not an option as it would
      // cost too much memory ...
      raycaster.firstHitOnly = firstHitOnly;
      group.traverse(child => {
        // Only include meshes that do not yet have a boundsTree and whose raycast is standard issue
        if (isMesh(child) && !child.geometry.boundsTree && child.raycast === Mesh.prototype.raycast) {
          child.raycast = acceleratedRaycast;
          child.geometry.computeBoundsTree = computeBoundsTree;
          child.geometry.disposeBoundsTree = disposeBoundsTree;
          child.geometry.computeBoundsTree(options);
        }
      });
      return () => {
        delete raycaster.firstHitOnly;
        group.traverse(child => {
          if (isMesh(child) && child.geometry.boundsTree) {
            child.geometry.disposeBoundsTree();
            child.raycast = Mesh.prototype.raycast;
          }
        });
      };
    }
  }, []);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: ref
  }, props), children);
});

export { Bvh, useBVH };
