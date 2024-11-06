import { Vector4, Vector3, Matrix4, Line3, Box3, Sphere, Mesh, InstancedInterleavedBuffer, InterleavedBufferAttribute, MathUtils } from "three";
import { LineSegmentsGeometry } from "./LineSegmentsGeometry.js";
import { LineMaterial } from "./LineMaterial.js";
import { UV1 } from "../_polyfill/uv1.js";
const _viewport = new Vector4();
const _start = new Vector3();
const _end = new Vector3();
const _start4 = new Vector4();
const _end4 = new Vector4();
const _ssOrigin = new Vector4();
const _ssOrigin3 = new Vector3();
const _mvMatrix = new Matrix4();
const _line = new Line3();
const _closestPoint = new Vector3();
const _box = new Box3();
const _sphere = new Sphere();
const _clipToWorldVector = new Vector4();
let _ray, _lineWidth;
function getWorldSpaceHalfWidth(camera, distance, resolution) {
  _clipToWorldVector.set(0, 0, -distance, 1).applyMatrix4(camera.projectionMatrix);
  _clipToWorldVector.multiplyScalar(1 / _clipToWorldVector.w);
  _clipToWorldVector.x = _lineWidth / resolution.width;
  _clipToWorldVector.y = _lineWidth / resolution.height;
  _clipToWorldVector.applyMatrix4(camera.projectionMatrixInverse);
  _clipToWorldVector.multiplyScalar(1 / _clipToWorldVector.w);
  return Math.abs(Math.max(_clipToWorldVector.x, _clipToWorldVector.y));
}
function raycastWorldUnits(lineSegments, intersects) {
  const matrixWorld = lineSegments.matrixWorld;
  const geometry = lineSegments.geometry;
  const instanceStart = geometry.attributes.instanceStart;
  const instanceEnd = geometry.attributes.instanceEnd;
  const segmentCount = Math.min(geometry.instanceCount, instanceStart.count);
  for (let i = 0, l = segmentCount; i < l; i++) {
    _line.start.fromBufferAttribute(instanceStart, i);
    _line.end.fromBufferAttribute(instanceEnd, i);
    _line.applyMatrix4(matrixWorld);
    const pointOnLine = new Vector3();
    const point = new Vector3();
    _ray.distanceSqToSegment(_line.start, _line.end, point, pointOnLine);
    const isInside = point.distanceTo(pointOnLine) < _lineWidth * 0.5;
    if (isInside) {
      intersects.push({
        point,
        pointOnLine,
        distance: _ray.origin.distanceTo(point),
        object: lineSegments,
        face: null,
        faceIndex: i,
        uv: null,
        [UV1]: null
      });
    }
  }
}
function raycastScreenSpace(lineSegments, camera, intersects) {
  const projectionMatrix = camera.projectionMatrix;
  const material = lineSegments.material;
  const resolution = material.resolution;
  const matrixWorld = lineSegments.matrixWorld;
  const geometry = lineSegments.geometry;
  const instanceStart = geometry.attributes.instanceStart;
  const instanceEnd = geometry.attributes.instanceEnd;
  const segmentCount = Math.min(geometry.instanceCount, instanceStart.count);
  const near = -camera.near;
  _ray.at(1, _ssOrigin);
  _ssOrigin.w = 1;
  _ssOrigin.applyMatrix4(camera.matrixWorldInverse);
  _ssOrigin.applyMatrix4(projectionMatrix);
  _ssOrigin.multiplyScalar(1 / _ssOrigin.w);
  _ssOrigin.x *= resolution.x / 2;
  _ssOrigin.y *= resolution.y / 2;
  _ssOrigin.z = 0;
  _ssOrigin3.copy(_ssOrigin);
  _mvMatrix.multiplyMatrices(camera.matrixWorldInverse, matrixWorld);
  for (let i = 0, l = segmentCount; i < l; i++) {
    _start4.fromBufferAttribute(instanceStart, i);
    _end4.fromBufferAttribute(instanceEnd, i);
    _start4.w = 1;
    _end4.w = 1;
    _start4.applyMatrix4(_mvMatrix);
    _end4.applyMatrix4(_mvMatrix);
    const isBehindCameraNear = _start4.z > near && _end4.z > near;
    if (isBehindCameraNear) {
      continue;
    }
    if (_start4.z > near) {
      const deltaDist = _start4.z - _end4.z;
      const t = (_start4.z - near) / deltaDist;
      _start4.lerp(_end4, t);
    } else if (_end4.z > near) {
      const deltaDist = _end4.z - _start4.z;
      const t = (_end4.z - near) / deltaDist;
      _end4.lerp(_start4, t);
    }
    _start4.applyMatrix4(projectionMatrix);
    _end4.applyMatrix4(projectionMatrix);
    _start4.multiplyScalar(1 / _start4.w);
    _end4.multiplyScalar(1 / _end4.w);
    _start4.x *= resolution.x / 2;
    _start4.y *= resolution.y / 2;
    _end4.x *= resolution.x / 2;
    _end4.y *= resolution.y / 2;
    _line.start.copy(_start4);
    _line.start.z = 0;
    _line.end.copy(_end4);
    _line.end.z = 0;
    const param = _line.closestPointToPointParameter(_ssOrigin3, true);
    _line.at(param, _closestPoint);
    const zPos = MathUtils.lerp(_start4.z, _end4.z, param);
    const isInClipSpace = zPos >= -1 && zPos <= 1;
    const isInside = _ssOrigin3.distanceTo(_closestPoint) < _lineWidth * 0.5;
    if (isInClipSpace && isInside) {
      _line.start.fromBufferAttribute(instanceStart, i);
      _line.end.fromBufferAttribute(instanceEnd, i);
      _line.start.applyMatrix4(matrixWorld);
      _line.end.applyMatrix4(matrixWorld);
      const pointOnLine = new Vector3();
      const point = new Vector3();
      _ray.distanceSqToSegment(_line.start, _line.end, point, pointOnLine);
      intersects.push({
        point,
        pointOnLine,
        distance: _ray.origin.distanceTo(point),
        object: lineSegments,
        face: null,
        faceIndex: i,
        uv: null,
        [UV1]: null
      });
    }
  }
}
class LineSegments2 extends Mesh {
  constructor(geometry = new LineSegmentsGeometry(), material = new LineMaterial({ color: Math.random() * 16777215 })) {
    super(geometry, material);
    this.isLineSegments2 = true;
    this.type = "LineSegments2";
  }
  // for backwards-compatibility, but could be a method of LineSegmentsGeometry...
  computeLineDistances() {
    const geometry = this.geometry;
    const instanceStart = geometry.attributes.instanceStart;
    const instanceEnd = geometry.attributes.instanceEnd;
    const lineDistances = new Float32Array(2 * instanceStart.count);
    for (let i = 0, j = 0, l = instanceStart.count; i < l; i++, j += 2) {
      _start.fromBufferAttribute(instanceStart, i);
      _end.fromBufferAttribute(instanceEnd, i);
      lineDistances[j] = j === 0 ? 0 : lineDistances[j - 1];
      lineDistances[j + 1] = lineDistances[j] + _start.distanceTo(_end);
    }
    const instanceDistanceBuffer = new InstancedInterleavedBuffer(lineDistances, 2, 1);
    geometry.setAttribute("instanceDistanceStart", new InterleavedBufferAttribute(instanceDistanceBuffer, 1, 0));
    geometry.setAttribute("instanceDistanceEnd", new InterleavedBufferAttribute(instanceDistanceBuffer, 1, 1));
    return this;
  }
  raycast(raycaster, intersects) {
    const worldUnits = this.material.worldUnits;
    const camera = raycaster.camera;
    if (camera === null && !worldUnits) {
      console.error(
        'LineSegments2: "Raycaster.camera" needs to be set in order to raycast against LineSegments2 while worldUnits is set to false.'
      );
    }
    const threshold = raycaster.params.Line2 !== void 0 ? raycaster.params.Line2.threshold || 0 : 0;
    _ray = raycaster.ray;
    const matrixWorld = this.matrixWorld;
    const geometry = this.geometry;
    const material = this.material;
    _lineWidth = material.linewidth + threshold;
    if (geometry.boundingSphere === null) {
      geometry.computeBoundingSphere();
    }
    _sphere.copy(geometry.boundingSphere).applyMatrix4(matrixWorld);
    let sphereMargin;
    if (worldUnits) {
      sphereMargin = _lineWidth * 0.5;
    } else {
      const distanceToSphere = Math.max(camera.near, _sphere.distanceToPoint(_ray.origin));
      sphereMargin = getWorldSpaceHalfWidth(camera, distanceToSphere, material.resolution);
    }
    _sphere.radius += sphereMargin;
    if (_ray.intersectsSphere(_sphere) === false) {
      return;
    }
    if (geometry.boundingBox === null) {
      geometry.computeBoundingBox();
    }
    _box.copy(geometry.boundingBox).applyMatrix4(matrixWorld);
    let boxMargin;
    if (worldUnits) {
      boxMargin = _lineWidth * 0.5;
    } else {
      const distanceToBox = Math.max(camera.near, _box.distanceToPoint(_ray.origin));
      boxMargin = getWorldSpaceHalfWidth(camera, distanceToBox, material.resolution);
    }
    _box.expandByScalar(boxMargin);
    if (_ray.intersectsBox(_box) === false) {
      return;
    }
    if (worldUnits) {
      raycastWorldUnits(this, intersects);
    } else {
      raycastScreenSpace(this, camera, intersects);
    }
  }
  onBeforeRender(renderer) {
    const uniforms = this.material.uniforms;
    if (uniforms && uniforms.resolution) {
      renderer.getViewport(_viewport);
      this.material.uniforms.resolution.value.set(_viewport.z, _viewport.w);
    }
  }
}
export {
  LineSegments2
};
//# sourceMappingURL=LineSegments2.js.map
