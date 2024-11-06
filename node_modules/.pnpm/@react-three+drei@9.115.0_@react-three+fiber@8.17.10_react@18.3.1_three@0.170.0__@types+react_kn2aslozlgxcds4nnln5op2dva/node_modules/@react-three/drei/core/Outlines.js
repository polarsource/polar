import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { shaderMaterial } from './shaderMaterial.js';
import { useThree, extend, applyProps } from '@react-three/fiber';
import { toCreasedNormals } from 'three-stdlib';
import { version } from '../helpers/constants.js';

const OutlinesMaterial = /* @__PURE__ */shaderMaterial({
  screenspace: false,
  color: /* @__PURE__ */new THREE.Color('black'),
  opacity: 1,
  thickness: 0.05,
  size: /* @__PURE__ */new THREE.Vector2()
}, `#include <common>
   #include <morphtarget_pars_vertex>
   #include <skinning_pars_vertex>
   uniform float thickness;
   uniform bool screenspace;
   uniform vec2 size;
   void main() {
     #if defined (USE_SKINNING)
	     #include <beginnormal_vertex>
       #include <morphnormal_vertex>
       #include <skinbase_vertex>
       #include <skinnormal_vertex>
       #include <defaultnormal_vertex>
     #endif
     #include <begin_vertex>
	   #include <morphtarget_vertex>
	   #include <skinning_vertex>
     #include <project_vertex>
     vec4 tNormal = vec4(normal, 0.0);
     vec4 tPosition = vec4(transformed, 1.0);
     #ifdef USE_INSTANCING
       tNormal = instanceMatrix * tNormal;
       tPosition = instanceMatrix * tPosition;
     #endif
     if (screenspace) {
       vec3 newPosition = tPosition.xyz + tNormal.xyz * thickness;
       gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0); 
     } else {
       vec4 clipPosition = projectionMatrix * modelViewMatrix * tPosition;
       vec4 clipNormal = projectionMatrix * modelViewMatrix * tNormal;
       vec2 offset = normalize(clipNormal.xy) * thickness / size * clipPosition.w * 2.0;
       clipPosition.xy += offset;
       gl_Position = clipPosition;
     }
   }`, `uniform vec3 color;
   uniform float opacity;
   void main(){
     gl_FragColor = vec4(color, opacity);
     #include <tonemapping_fragment>
     #include <${version >= 154 ? 'colorspace_fragment' : 'encodings_fragment'}>
   }`);
function Outlines({
  color = 'black',
  opacity = 1,
  transparent = false,
  screenspace = false,
  toneMapped = true,
  polygonOffset = false,
  polygonOffsetFactor = 0,
  renderOrder = 0,
  thickness = 0.05,
  angle = Math.PI,
  ...props
}) {
  const ref = React.useRef();
  const [material] = React.useState(() => new OutlinesMaterial({
    side: THREE.BackSide
  }));
  const {
    gl
  } = useThree();
  const contextSize = gl.getDrawingBufferSize(new THREE.Vector2());
  React.useMemo(() => extend({
    OutlinesMaterial
  }), []);
  const oldAngle = React.useRef(0);
  const oldGeometry = React.useRef();
  React.useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    const parent = group.parent;
    if (parent && parent.geometry) {
      if (oldAngle.current !== angle || oldGeometry.current !== parent.geometry) {
        var _group$children;
        oldAngle.current = angle;
        oldGeometry.current = parent.geometry;

        // Remove old mesh
        let mesh = (_group$children = group.children) == null ? void 0 : _group$children[0];
        if (mesh) {
          if (angle) mesh.geometry.dispose();
          group.remove(mesh);
        }
        if (parent.skeleton) {
          mesh = new THREE.SkinnedMesh();
          mesh.material = material;
          mesh.bind(parent.skeleton, parent.bindMatrix);
          group.add(mesh);
        } else if (parent.isInstancedMesh) {
          mesh = new THREE.InstancedMesh(parent.geometry, material, parent.count);
          mesh.instanceMatrix = parent.instanceMatrix;
          group.add(mesh);
        } else {
          mesh = new THREE.Mesh();
          mesh.material = material;
          group.add(mesh);
        }
        mesh.geometry = angle ? toCreasedNormals(parent.geometry, angle) : parent.geometry;
      }
    }
  });
  React.useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    const mesh = group.children[0];
    if (mesh) {
      mesh.renderOrder = renderOrder;
      applyProps(mesh.material, {
        transparent,
        thickness,
        color,
        opacity,
        size: contextSize,
        screenspace,
        toneMapped,
        polygonOffset,
        polygonOffsetFactor
      });
    }
  });
  React.useEffect(() => {
    return () => {
      // Dispose everything on unmount
      const group = ref.current;
      if (!group) return;
      const mesh = group.children[0];
      if (mesh) {
        if (angle) mesh.geometry.dispose();
        group.remove(mesh);
      }
    };
  }, []);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: ref
  }, props));
}

export { Outlines };
