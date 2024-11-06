import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { MeshSurfaceSampler } from 'three-stdlib';
import { InstancedBufferAttribute, Vector3, Color, Object3D } from 'three';

function useSurfaceSampler(mesh, count = 16, transform, weight, instanceMesh) {
  const [buffer, setBuffer] = React.useState(() => {
    const arr = Array.from({
      length: count
    }, () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]).flat();
    return new InstancedBufferAttribute(Float32Array.from(arr), 16);
  });
  React.useLayoutEffect(() => {
    if (typeof mesh.current === 'undefined') return;
    const sampler = new MeshSurfaceSampler(mesh.current);
    if (weight) {
      sampler.setWeightAttribute(weight);
    }
    sampler.build();
    const position = new Vector3();
    const normal = new Vector3();
    const color = new Color();
    const dummy = new Object3D();
    mesh.current.updateMatrixWorld(true);
    for (let i = 0; i < count; i++) {
      sampler.sample(position, normal, color);
      if (typeof transform === 'function') {
        transform({
          dummy,
          sampledMesh: mesh.current,
          position,
          normal,
          color
        }, i);
      } else {
        dummy.position.copy(position);
      }
      dummy.updateMatrix();
      if (instanceMesh != null && instanceMesh.current) {
        instanceMesh.current.setMatrixAt(i, dummy.matrix);
      }
      dummy.matrix.toArray(buffer.array, i * 16);
    }
    if (instanceMesh != null && instanceMesh.current) {
      instanceMesh.current.instanceMatrix.needsUpdate = true;
    }
    buffer.needsUpdate = true;
    setBuffer(new InstancedBufferAttribute(buffer.array, buffer.itemSize).copy(buffer));
  }, [mesh, instanceMesh, weight, count, transform]);
  return buffer;
}
function Sampler({
  children,
  weight,
  transform,
  instances,
  mesh,
  count = 16,
  ...props
}) {
  const group = React.useRef(null);
  const instancedRef = React.useRef(null);
  const meshToSampleRef = React.useRef(null);
  React.useLayoutEffect(() => {
    var _instances$current, _mesh$current;
    instancedRef.current = (_instances$current = instances == null ? void 0 : instances.current) !== null && _instances$current !== void 0 ? _instances$current : group.current.children.find(c => c.hasOwnProperty('instanceMatrix'));
    meshToSampleRef.current = (_mesh$current = mesh == null ? void 0 : mesh.current) !== null && _mesh$current !== void 0 ? _mesh$current : group.current.children.find(c => c.type === 'Mesh');
  }, [children, mesh == null ? void 0 : mesh.current, instances == null ? void 0 : instances.current]);
  useSurfaceSampler(meshToSampleRef, count, transform, weight, instancedRef);
  return /*#__PURE__*/React.createElement("group", _extends({
    ref: group
  }, props), children);
}

export { Sampler, useSurfaceSampler };
