import { Vector3, Line3, Plane, Mesh } from "three";
import { ConvexGeometry } from "../geometries/ConvexGeometry.js";
const _v1 = new Vector3();
class ConvexObjectBreaker {
  constructor(minSizeForBreak = 1.4, smallDelta = 1e-4) {
    this.minSizeForBreak = minSizeForBreak;
    this.smallDelta = smallDelta;
    this.tempLine1 = new Line3();
    this.tempPlane1 = new Plane();
    this.tempPlane2 = new Plane();
    this.tempPlane_Cut = new Plane();
    this.tempCM1 = new Vector3();
    this.tempCM2 = new Vector3();
    this.tempVector3 = new Vector3();
    this.tempVector3_2 = new Vector3();
    this.tempVector3_3 = new Vector3();
    this.tempVector3_P0 = new Vector3();
    this.tempVector3_P1 = new Vector3();
    this.tempVector3_P2 = new Vector3();
    this.tempVector3_N0 = new Vector3();
    this.tempVector3_N1 = new Vector3();
    this.tempVector3_AB = new Vector3();
    this.tempVector3_CB = new Vector3();
    this.tempResultObjects = { object1: null, object2: null };
    this.segments = [];
    const n = 30 * 30;
    for (let i = 0; i < n; i++)
      this.segments[i] = false;
  }
  prepareBreakableObject(object, mass, velocity, angularVelocity, breakable) {
    const userData = object.userData;
    userData.mass = mass;
    userData.velocity = velocity.clone();
    userData.angularVelocity = angularVelocity.clone();
    userData.breakable = breakable;
  }
  /*
   * @param {int} maxRadialIterations Iterations for radial cuts.
   * @param {int} maxRandomIterations Max random iterations for not-radial cuts
   *
   * Returns the array of pieces
   */
  subdivideByImpact(object, pointOfImpact, normal, maxRadialIterations, maxRandomIterations) {
    const debris = [];
    const tempPlane1 = this.tempPlane1;
    const tempPlane2 = this.tempPlane2;
    this.tempVector3.addVectors(pointOfImpact, normal);
    tempPlane1.setFromCoplanarPoints(pointOfImpact, object.position, this.tempVector3);
    const maxTotalIterations = maxRandomIterations + maxRadialIterations;
    const scope = this;
    function subdivideRadial(subObject, startAngle, endAngle, numIterations) {
      if (Math.random() < numIterations * 0.05 || numIterations > maxTotalIterations) {
        debris.push(subObject);
        return;
      }
      let angle = Math.PI;
      if (numIterations === 0) {
        tempPlane2.normal.copy(tempPlane1.normal);
        tempPlane2.constant = tempPlane1.constant;
      } else {
        if (numIterations <= maxRadialIterations) {
          angle = (endAngle - startAngle) * (0.2 + 0.6 * Math.random()) + startAngle;
          scope.tempVector3_2.copy(object.position).sub(pointOfImpact).applyAxisAngle(normal, angle).add(pointOfImpact);
          tempPlane2.setFromCoplanarPoints(pointOfImpact, scope.tempVector3, scope.tempVector3_2);
        } else {
          angle = (0.5 * (numIterations & 1) + 0.2 * (2 - Math.random())) * Math.PI;
          scope.tempVector3_2.copy(pointOfImpact).sub(subObject.position).applyAxisAngle(normal, angle).add(subObject.position);
          scope.tempVector3_3.copy(normal).add(subObject.position);
          tempPlane2.setFromCoplanarPoints(subObject.position, scope.tempVector3_3, scope.tempVector3_2);
        }
      }
      scope.cutByPlane(subObject, tempPlane2, scope.tempResultObjects);
      const obj1 = scope.tempResultObjects.object1;
      const obj2 = scope.tempResultObjects.object2;
      if (obj1) {
        subdivideRadial(obj1, startAngle, angle, numIterations + 1);
      }
      if (obj2) {
        subdivideRadial(obj2, angle, endAngle, numIterations + 1);
      }
    }
    subdivideRadial(object, 0, 2 * Math.PI, 0);
    return debris;
  }
  cutByPlane(object, plane, output) {
    const geometry = object.geometry;
    const coords = geometry.attributes.position.array;
    const normals = geometry.attributes.normal.array;
    const numPoints = coords.length / 3;
    let numFaces = numPoints / 3;
    let indices = geometry.getIndex();
    if (indices) {
      indices = indices.array;
      numFaces = indices.length / 3;
    }
    function getVertexIndex(faceIdx, vert) {
      const idx = faceIdx * 3 + vert;
      return indices ? indices[idx] : idx;
    }
    const points1 = [];
    const points2 = [];
    const delta = this.smallDelta;
    const numPointPairs = numPoints * numPoints;
    for (let i = 0; i < numPointPairs; i++)
      this.segments[i] = false;
    const p0 = this.tempVector3_P0;
    const p1 = this.tempVector3_P1;
    const n0 = this.tempVector3_N0;
    const n1 = this.tempVector3_N1;
    for (let i = 0; i < numFaces - 1; i++) {
      const a1 = getVertexIndex(i, 0);
      const b1 = getVertexIndex(i, 1);
      const c1 = getVertexIndex(i, 2);
      n0.set(normals[a1], normals[a1] + 1, normals[a1] + 2);
      for (let j = i + 1; j < numFaces; j++) {
        const a2 = getVertexIndex(j, 0);
        const b2 = getVertexIndex(j, 1);
        const c2 = getVertexIndex(j, 2);
        n1.set(normals[a2], normals[a2] + 1, normals[a2] + 2);
        const coplanar = 1 - n0.dot(n1) < delta;
        if (coplanar) {
          if (a1 === a2 || a1 === b2 || a1 === c2) {
            if (b1 === a2 || b1 === b2 || b1 === c2) {
              this.segments[a1 * numPoints + b1] = true;
              this.segments[b1 * numPoints + a1] = true;
            } else {
              this.segments[c1 * numPoints + a1] = true;
              this.segments[a1 * numPoints + c1] = true;
            }
          } else if (b1 === a2 || b1 === b2 || b1 === c2) {
            this.segments[c1 * numPoints + b1] = true;
            this.segments[b1 * numPoints + c1] = true;
          }
        }
      }
    }
    const localPlane = this.tempPlane_Cut;
    object.updateMatrix();
    ConvexObjectBreaker.transformPlaneToLocalSpace(plane, object.matrix, localPlane);
    for (let i = 0; i < numFaces; i++) {
      const va = getVertexIndex(i, 0);
      const vb = getVertexIndex(i, 1);
      const vc = getVertexIndex(i, 2);
      for (let segment = 0; segment < 3; segment++) {
        const i0 = segment === 0 ? va : segment === 1 ? vb : vc;
        const i1 = segment === 0 ? vb : segment === 1 ? vc : va;
        const segmentState = this.segments[i0 * numPoints + i1];
        if (segmentState)
          continue;
        this.segments[i0 * numPoints + i1] = true;
        this.segments[i1 * numPoints + i0] = true;
        p0.set(coords[3 * i0], coords[3 * i0 + 1], coords[3 * i0 + 2]);
        p1.set(coords[3 * i1], coords[3 * i1 + 1], coords[3 * i1 + 2]);
        let mark0 = 0;
        let d = localPlane.distanceToPoint(p0);
        if (d > delta) {
          mark0 = 2;
          points2.push(p0.clone());
        } else if (d < -delta) {
          mark0 = 1;
          points1.push(p0.clone());
        } else {
          mark0 = 3;
          points1.push(p0.clone());
          points2.push(p0.clone());
        }
        let mark1 = 0;
        d = localPlane.distanceToPoint(p1);
        if (d > delta) {
          mark1 = 2;
          points2.push(p1.clone());
        } else if (d < -delta) {
          mark1 = 1;
          points1.push(p1.clone());
        } else {
          mark1 = 3;
          points1.push(p1.clone());
          points2.push(p1.clone());
        }
        if (mark0 === 1 && mark1 === 2 || mark0 === 2 && mark1 === 1) {
          this.tempLine1.start.copy(p0);
          this.tempLine1.end.copy(p1);
          let intersection = new Vector3();
          intersection = localPlane.intersectLine(this.tempLine1, intersection);
          if (intersection === null) {
            console.error("Internal error: segment does not intersect plane.");
            output.segmentedObject1 = null;
            output.segmentedObject2 = null;
            return 0;
          }
          points1.push(intersection);
          points2.push(intersection.clone());
        }
      }
    }
    const newMass = object.userData.mass * 0.5;
    this.tempCM1.set(0, 0, 0);
    let radius1 = 0;
    const numPoints1 = points1.length;
    if (numPoints1 > 0) {
      for (let i = 0; i < numPoints1; i++)
        this.tempCM1.add(points1[i]);
      this.tempCM1.divideScalar(numPoints1);
      for (let i = 0; i < numPoints1; i++) {
        const p = points1[i];
        p.sub(this.tempCM1);
        radius1 = Math.max(radius1, p.x, p.y, p.z);
      }
      this.tempCM1.add(object.position);
    }
    this.tempCM2.set(0, 0, 0);
    let radius2 = 0;
    const numPoints2 = points2.length;
    if (numPoints2 > 0) {
      for (let i = 0; i < numPoints2; i++)
        this.tempCM2.add(points2[i]);
      this.tempCM2.divideScalar(numPoints2);
      for (let i = 0; i < numPoints2; i++) {
        const p = points2[i];
        p.sub(this.tempCM2);
        radius2 = Math.max(radius2, p.x, p.y, p.z);
      }
      this.tempCM2.add(object.position);
    }
    let object1 = null;
    let object2 = null;
    let numObjects = 0;
    if (numPoints1 > 4) {
      object1 = new Mesh(new ConvexGeometry(points1), object.material);
      object1.position.copy(this.tempCM1);
      object1.quaternion.copy(object.quaternion);
      this.prepareBreakableObject(
        object1,
        newMass,
        object.userData.velocity,
        object.userData.angularVelocity,
        2 * radius1 > this.minSizeForBreak
      );
      numObjects++;
    }
    if (numPoints2 > 4) {
      object2 = new Mesh(new ConvexGeometry(points2), object.material);
      object2.position.copy(this.tempCM2);
      object2.quaternion.copy(object.quaternion);
      this.prepareBreakableObject(
        object2,
        newMass,
        object.userData.velocity,
        object.userData.angularVelocity,
        2 * radius2 > this.minSizeForBreak
      );
      numObjects++;
    }
    output.object1 = object1;
    output.object2 = object2;
    return numObjects;
  }
  static transformFreeVector(v, m) {
    const x = v.x, y = v.y, z = v.z;
    const e = m.elements;
    v.x = e[0] * x + e[4] * y + e[8] * z;
    v.y = e[1] * x + e[5] * y + e[9] * z;
    v.z = e[2] * x + e[6] * y + e[10] * z;
    return v;
  }
  static transformFreeVectorInverse(v, m) {
    const x = v.x, y = v.y, z = v.z;
    const e = m.elements;
    v.x = e[0] * x + e[1] * y + e[2] * z;
    v.y = e[4] * x + e[5] * y + e[6] * z;
    v.z = e[8] * x + e[9] * y + e[10] * z;
    return v;
  }
  static transformTiedVectorInverse(v, m) {
    const x = v.x, y = v.y, z = v.z;
    const e = m.elements;
    v.x = e[0] * x + e[1] * y + e[2] * z - e[12];
    v.y = e[4] * x + e[5] * y + e[6] * z - e[13];
    v.z = e[8] * x + e[9] * y + e[10] * z - e[14];
    return v;
  }
  static transformPlaneToLocalSpace(plane, m, resultPlane) {
    resultPlane.normal.copy(plane.normal);
    resultPlane.constant = plane.constant;
    const referencePoint = ConvexObjectBreaker.transformTiedVectorInverse(plane.coplanarPoint(_v1), m);
    ConvexObjectBreaker.transformFreeVectorInverse(resultPlane.normal, m);
    resultPlane.constant = -referencePoint.dot(resultPlane.normal);
  }
}
export {
  ConvexObjectBreaker
};
//# sourceMappingURL=ConvexObjectBreaker.js.map
