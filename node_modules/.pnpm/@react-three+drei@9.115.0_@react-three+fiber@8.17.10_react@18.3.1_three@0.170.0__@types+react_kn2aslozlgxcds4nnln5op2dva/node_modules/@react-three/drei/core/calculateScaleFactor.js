import * as THREE from 'three';

const tV0 = /* @__PURE__ */new THREE.Vector3();
const tV1 = /* @__PURE__ */new THREE.Vector3();
const tV2 = /* @__PURE__ */new THREE.Vector3();
const getPoint2 = (point3, camera, size) => {
  const widthHalf = size.width / 2;
  const heightHalf = size.height / 2;
  camera.updateMatrixWorld(false);
  const vector = point3.project(camera);
  vector.x = vector.x * widthHalf + widthHalf;
  vector.y = -(vector.y * heightHalf) + heightHalf;
  return vector;
};
const getPoint3 = (point2, camera, size, zValue = 1) => {
  const vector = tV0.set(point2.x / size.width * 2 - 1, -(point2.y / size.height) * 2 + 1, zValue);
  vector.unproject(camera);
  return vector;
};
const calculateScaleFactor = (point3, radiusPx, camera, size) => {
  const point2 = getPoint2(tV2.copy(point3), camera, size);
  let scale = 0;
  for (let i = 0; i < 2; ++i) {
    const point2off = tV1.copy(point2).setComponent(i, point2.getComponent(i) + radiusPx);
    const point3off = getPoint3(point2off, camera, size, point2off.z);
    scale = Math.max(scale, point3.distanceTo(point3off));
  }
  return scale;
};

export { calculateScaleFactor };
