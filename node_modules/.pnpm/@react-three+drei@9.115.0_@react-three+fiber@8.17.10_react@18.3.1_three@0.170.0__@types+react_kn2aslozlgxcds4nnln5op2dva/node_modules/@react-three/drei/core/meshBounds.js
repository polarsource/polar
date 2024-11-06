import { Matrix4, Ray, Sphere, Vector3 } from 'three';

const _inverseMatrix = /* @__PURE__ */new Matrix4();
const _ray = /* @__PURE__ */new Ray();
const _sphere = /* @__PURE__ */new Sphere();
const _vA = /* @__PURE__ */new Vector3();
function meshBounds(raycaster, intersects) {
  const geometry = this.geometry;
  const material = this.material;
  const matrixWorld = this.matrixWorld;
  if (material === undefined) return;
  // Checking boundingSphere distance to ray
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
  _sphere.copy(geometry.boundingSphere);
  _sphere.applyMatrix4(matrixWorld);
  if (raycaster.ray.intersectsSphere(_sphere) === false) return;
  _inverseMatrix.copy(matrixWorld).invert();
  _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
  // Check boundingBox before continuing
  if (geometry.boundingBox !== null && _ray.intersectBox(geometry.boundingBox, _vA) === null) return;
  intersects.push({
    distance: _vA.distanceTo(raycaster.ray.origin),
    point: _vA.clone(),
    object: this
  });
}

export { meshBounds };
