import { Vector3, Line3, Plane, Triangle } from "three";
const Visible = 0;
const Deleted = 1;
const _v1 = new Vector3();
const _line3 = new Line3();
const _plane = new Plane();
const _closestPoint = new Vector3();
const _triangle = new Triangle();
class ConvexHull {
  constructor() {
    this.tolerance = -1;
    this.faces = [];
    this.newFaces = [];
    this.assigned = new VertexList();
    this.unassigned = new VertexList();
    this.vertices = [];
  }
  setFromPoints(points) {
    if (points.length >= 4) {
      this.makeEmpty();
      for (let i = 0, l = points.length; i < l; i++) {
        this.vertices.push(new VertexNode(points[i]));
      }
      this.compute();
    }
    return this;
  }
  setFromObject(object) {
    const points = [];
    object.updateMatrixWorld(true);
    object.traverse(function(node) {
      const geometry = node.geometry;
      if (geometry !== void 0) {
        const attribute = geometry.attributes.position;
        if (attribute !== void 0) {
          for (let i = 0, l = attribute.count; i < l; i++) {
            const point = new Vector3();
            point.fromBufferAttribute(attribute, i).applyMatrix4(node.matrixWorld);
            points.push(point);
          }
        }
      }
    });
    return this.setFromPoints(points);
  }
  containsPoint(point) {
    const faces = this.faces;
    for (let i = 0, l = faces.length; i < l; i++) {
      const face = faces[i];
      if (face.distanceToPoint(point) > this.tolerance)
        return false;
    }
    return true;
  }
  intersectRay(ray, target) {
    const faces = this.faces;
    let tNear = -Infinity;
    let tFar = Infinity;
    for (let i = 0, l = faces.length; i < l; i++) {
      const face = faces[i];
      const vN = face.distanceToPoint(ray.origin);
      const vD = face.normal.dot(ray.direction);
      if (vN > 0 && vD >= 0)
        return null;
      const t = vD !== 0 ? -vN / vD : 0;
      if (t <= 0)
        continue;
      if (vD > 0) {
        tFar = Math.min(t, tFar);
      } else {
        tNear = Math.max(t, tNear);
      }
      if (tNear > tFar) {
        return null;
      }
    }
    if (tNear !== -Infinity) {
      ray.at(tNear, target);
    } else {
      ray.at(tFar, target);
    }
    return target;
  }
  intersectsRay(ray) {
    return this.intersectRay(ray, _v1) !== null;
  }
  makeEmpty() {
    this.faces = [];
    this.vertices = [];
    return this;
  }
  // Adds a vertex to the 'assigned' list of vertices and assigns it to the given face
  addVertexToFace(vertex, face) {
    vertex.face = face;
    if (face.outside === null) {
      this.assigned.append(vertex);
    } else {
      this.assigned.insertBefore(face.outside, vertex);
    }
    face.outside = vertex;
    return this;
  }
  // Removes a vertex from the 'assigned' list of vertices and from the given face
  removeVertexFromFace(vertex, face) {
    if (vertex === face.outside) {
      if (vertex.next !== null && vertex.next.face === face) {
        face.outside = vertex.next;
      } else {
        face.outside = null;
      }
    }
    this.assigned.remove(vertex);
    return this;
  }
  // Removes all the visible vertices that a given face is able to see which are stored in the 'assigned' vertex list
  removeAllVerticesFromFace(face) {
    if (face.outside !== null) {
      const start = face.outside;
      let end = face.outside;
      while (end.next !== null && end.next.face === face) {
        end = end.next;
      }
      this.assigned.removeSubList(start, end);
      start.prev = end.next = null;
      face.outside = null;
      return start;
    }
  }
  // Removes all the visible vertices that 'face' is able to see
  deleteFaceVertices(face, absorbingFace) {
    const faceVertices = this.removeAllVerticesFromFace(face);
    if (faceVertices !== void 0) {
      if (absorbingFace === void 0) {
        this.unassigned.appendChain(faceVertices);
      } else {
        let vertex = faceVertices;
        do {
          const nextVertex = vertex.next;
          const distance = absorbingFace.distanceToPoint(vertex.point);
          if (distance > this.tolerance) {
            this.addVertexToFace(vertex, absorbingFace);
          } else {
            this.unassigned.append(vertex);
          }
          vertex = nextVertex;
        } while (vertex !== null);
      }
    }
    return this;
  }
  // Reassigns as many vertices as possible from the unassigned list to the new faces
  resolveUnassignedPoints(newFaces) {
    if (this.unassigned.isEmpty() === false) {
      let vertex = this.unassigned.first();
      do {
        const nextVertex = vertex.next;
        let maxDistance = this.tolerance;
        let maxFace = null;
        for (let i = 0; i < newFaces.length; i++) {
          const face = newFaces[i];
          if (face.mark === Visible) {
            const distance = face.distanceToPoint(vertex.point);
            if (distance > maxDistance) {
              maxDistance = distance;
              maxFace = face;
            }
            if (maxDistance > 1e3 * this.tolerance)
              break;
          }
        }
        if (maxFace !== null) {
          this.addVertexToFace(vertex, maxFace);
        }
        vertex = nextVertex;
      } while (vertex !== null);
    }
    return this;
  }
  // Computes the extremes of a simplex which will be the initial hull
  computeExtremes() {
    const min = new Vector3();
    const max = new Vector3();
    const minVertices = [];
    const maxVertices = [];
    for (let i = 0; i < 3; i++) {
      minVertices[i] = maxVertices[i] = this.vertices[0];
    }
    min.copy(this.vertices[0].point);
    max.copy(this.vertices[0].point);
    for (let i = 0, l = this.vertices.length; i < l; i++) {
      const vertex = this.vertices[i];
      const point = vertex.point;
      for (let j = 0; j < 3; j++) {
        if (point.getComponent(j) < min.getComponent(j)) {
          min.setComponent(j, point.getComponent(j));
          minVertices[j] = vertex;
        }
      }
      for (let j = 0; j < 3; j++) {
        if (point.getComponent(j) > max.getComponent(j)) {
          max.setComponent(j, point.getComponent(j));
          maxVertices[j] = vertex;
        }
      }
    }
    this.tolerance = 3 * Number.EPSILON * (Math.max(Math.abs(min.x), Math.abs(max.x)) + Math.max(Math.abs(min.y), Math.abs(max.y)) + Math.max(Math.abs(min.z), Math.abs(max.z)));
    return { min: minVertices, max: maxVertices };
  }
  // Computes the initial simplex assigning to its faces all the points
  // that are candidates to form part of the hull
  computeInitialHull() {
    const vertices = this.vertices;
    const extremes = this.computeExtremes();
    const min = extremes.min;
    const max = extremes.max;
    let maxDistance = 0;
    let index = 0;
    for (let i = 0; i < 3; i++) {
      const distance = max[i].point.getComponent(i) - min[i].point.getComponent(i);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    const v0 = min[index];
    const v1 = max[index];
    let v2;
    let v3;
    maxDistance = 0;
    _line3.set(v0.point, v1.point);
    for (let i = 0, l = this.vertices.length; i < l; i++) {
      const vertex = vertices[i];
      if (vertex !== v0 && vertex !== v1) {
        _line3.closestPointToPoint(vertex.point, true, _closestPoint);
        const distance = _closestPoint.distanceToSquared(vertex.point);
        if (distance > maxDistance) {
          maxDistance = distance;
          v2 = vertex;
        }
      }
    }
    maxDistance = -1;
    _plane.setFromCoplanarPoints(v0.point, v1.point, v2.point);
    for (let i = 0, l = this.vertices.length; i < l; i++) {
      const vertex = vertices[i];
      if (vertex !== v0 && vertex !== v1 && vertex !== v2) {
        const distance = Math.abs(_plane.distanceToPoint(vertex.point));
        if (distance > maxDistance) {
          maxDistance = distance;
          v3 = vertex;
        }
      }
    }
    const faces = [];
    if (_plane.distanceToPoint(v3.point) < 0) {
      faces.push(Face.create(v0, v1, v2), Face.create(v3, v1, v0), Face.create(v3, v2, v1), Face.create(v3, v0, v2));
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        faces[i + 1].getEdge(2).setTwin(faces[0].getEdge(j));
        faces[i + 1].getEdge(1).setTwin(faces[j + 1].getEdge(0));
      }
    } else {
      faces.push(Face.create(v0, v2, v1), Face.create(v3, v0, v1), Face.create(v3, v1, v2), Face.create(v3, v2, v0));
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        faces[i + 1].getEdge(2).setTwin(faces[0].getEdge((3 - i) % 3));
        faces[i + 1].getEdge(0).setTwin(faces[j + 1].getEdge(1));
      }
    }
    for (let i = 0; i < 4; i++) {
      this.faces.push(faces[i]);
    }
    for (let i = 0, l = vertices.length; i < l; i++) {
      const vertex = vertices[i];
      if (vertex !== v0 && vertex !== v1 && vertex !== v2 && vertex !== v3) {
        maxDistance = this.tolerance;
        let maxFace = null;
        for (let j = 0; j < 4; j++) {
          const distance = this.faces[j].distanceToPoint(vertex.point);
          if (distance > maxDistance) {
            maxDistance = distance;
            maxFace = this.faces[j];
          }
        }
        if (maxFace !== null) {
          this.addVertexToFace(vertex, maxFace);
        }
      }
    }
    return this;
  }
  // Removes inactive faces
  reindexFaces() {
    const activeFaces = [];
    for (let i = 0; i < this.faces.length; i++) {
      const face = this.faces[i];
      if (face.mark === Visible) {
        activeFaces.push(face);
      }
    }
    this.faces = activeFaces;
    return this;
  }
  // Finds the next vertex to create faces with the current hull
  nextVertexToAdd() {
    if (this.assigned.isEmpty() === false) {
      let eyeVertex, maxDistance = 0;
      const eyeFace = this.assigned.first().face;
      let vertex = eyeFace.outside;
      do {
        const distance = eyeFace.distanceToPoint(vertex.point);
        if (distance > maxDistance) {
          maxDistance = distance;
          eyeVertex = vertex;
        }
        vertex = vertex.next;
      } while (vertex !== null && vertex.face === eyeFace);
      return eyeVertex;
    }
  }
  // Computes a chain of half edges in CCW order called the 'horizon'.
  // For an edge to be part of the horizon it must join a face that can see
  // 'eyePoint' and a face that cannot see 'eyePoint'.
  computeHorizon(eyePoint, crossEdge, face, horizon) {
    this.deleteFaceVertices(face);
    face.mark = Deleted;
    let edge;
    if (crossEdge === null) {
      edge = crossEdge = face.getEdge(0);
    } else {
      edge = crossEdge.next;
    }
    do {
      const twinEdge = edge.twin;
      const oppositeFace = twinEdge.face;
      if (oppositeFace.mark === Visible) {
        if (oppositeFace.distanceToPoint(eyePoint) > this.tolerance) {
          this.computeHorizon(eyePoint, twinEdge, oppositeFace, horizon);
        } else {
          horizon.push(edge);
        }
      }
      edge = edge.next;
    } while (edge !== crossEdge);
    return this;
  }
  // Creates a face with the vertices 'eyeVertex.point', 'horizonEdge.tail' and 'horizonEdge.head' in CCW order
  addAdjoiningFace(eyeVertex, horizonEdge) {
    const face = Face.create(eyeVertex, horizonEdge.tail(), horizonEdge.head());
    this.faces.push(face);
    face.getEdge(-1).setTwin(horizonEdge.twin);
    return face.getEdge(0);
  }
  //  Adds 'horizon.length' faces to the hull, each face will be linked with the
  //  horizon opposite face and the face on the left/right
  addNewFaces(eyeVertex, horizon) {
    this.newFaces = [];
    let firstSideEdge = null;
    let previousSideEdge = null;
    for (let i = 0; i < horizon.length; i++) {
      const horizonEdge = horizon[i];
      const sideEdge = this.addAdjoiningFace(eyeVertex, horizonEdge);
      if (firstSideEdge === null) {
        firstSideEdge = sideEdge;
      } else {
        sideEdge.next.setTwin(previousSideEdge);
      }
      this.newFaces.push(sideEdge.face);
      previousSideEdge = sideEdge;
    }
    firstSideEdge.next.setTwin(previousSideEdge);
    return this;
  }
  // Adds a vertex to the hull
  addVertexToHull(eyeVertex) {
    const horizon = [];
    this.unassigned.clear();
    this.removeVertexFromFace(eyeVertex, eyeVertex.face);
    this.computeHorizon(eyeVertex.point, null, eyeVertex.face, horizon);
    this.addNewFaces(eyeVertex, horizon);
    this.resolveUnassignedPoints(this.newFaces);
    return this;
  }
  cleanup() {
    this.assigned.clear();
    this.unassigned.clear();
    this.newFaces = [];
    return this;
  }
  compute() {
    let vertex;
    this.computeInitialHull();
    while ((vertex = this.nextVertexToAdd()) !== void 0) {
      this.addVertexToHull(vertex);
    }
    this.reindexFaces();
    this.cleanup();
    return this;
  }
}
class Face {
  constructor() {
    this.normal = new Vector3();
    this.midpoint = new Vector3();
    this.area = 0;
    this.constant = 0;
    this.outside = null;
    this.mark = Visible;
    this.edge = null;
  }
  static create(a, b, c) {
    const face = new Face();
    const e0 = new HalfEdge(a, face);
    const e1 = new HalfEdge(b, face);
    const e2 = new HalfEdge(c, face);
    e0.next = e2.prev = e1;
    e1.next = e0.prev = e2;
    e2.next = e1.prev = e0;
    face.edge = e0;
    return face.compute();
  }
  getEdge(i) {
    let edge = this.edge;
    while (i > 0) {
      edge = edge.next;
      i--;
    }
    while (i < 0) {
      edge = edge.prev;
      i++;
    }
    return edge;
  }
  compute() {
    const a = this.edge.tail();
    const b = this.edge.head();
    const c = this.edge.next.head();
    _triangle.set(a.point, b.point, c.point);
    _triangle.getNormal(this.normal);
    _triangle.getMidpoint(this.midpoint);
    this.area = _triangle.getArea();
    this.constant = this.normal.dot(this.midpoint);
    return this;
  }
  distanceToPoint(point) {
    return this.normal.dot(point) - this.constant;
  }
}
class HalfEdge {
  constructor(vertex, face) {
    this.vertex = vertex;
    this.prev = null;
    this.next = null;
    this.twin = null;
    this.face = face;
  }
  head() {
    return this.vertex;
  }
  tail() {
    return this.prev ? this.prev.vertex : null;
  }
  length() {
    const head = this.head();
    const tail = this.tail();
    if (tail !== null) {
      return tail.point.distanceTo(head.point);
    }
    return -1;
  }
  lengthSquared() {
    const head = this.head();
    const tail = this.tail();
    if (tail !== null) {
      return tail.point.distanceToSquared(head.point);
    }
    return -1;
  }
  setTwin(edge) {
    this.twin = edge;
    edge.twin = this;
    return this;
  }
}
class VertexNode {
  constructor(point) {
    this.point = point;
    this.prev = null;
    this.next = null;
    this.face = null;
  }
}
class VertexList {
  constructor() {
    this.head = null;
    this.tail = null;
  }
  first() {
    return this.head;
  }
  last() {
    return this.tail;
  }
  clear() {
    this.head = this.tail = null;
    return this;
  }
  // Inserts a vertex before the target vertex
  insertBefore(target, vertex) {
    vertex.prev = target.prev;
    vertex.next = target;
    if (vertex.prev === null) {
      this.head = vertex;
    } else {
      vertex.prev.next = vertex;
    }
    target.prev = vertex;
    return this;
  }
  // Inserts a vertex after the target vertex
  insertAfter(target, vertex) {
    vertex.prev = target;
    vertex.next = target.next;
    if (vertex.next === null) {
      this.tail = vertex;
    } else {
      vertex.next.prev = vertex;
    }
    target.next = vertex;
    return this;
  }
  // Appends a vertex to the end of the linked list
  append(vertex) {
    if (this.head === null) {
      this.head = vertex;
    } else {
      this.tail.next = vertex;
    }
    vertex.prev = this.tail;
    vertex.next = null;
    this.tail = vertex;
    return this;
  }
  // Appends a chain of vertices where 'vertex' is the head.
  appendChain(vertex) {
    if (this.head === null) {
      this.head = vertex;
    } else {
      this.tail.next = vertex;
    }
    vertex.prev = this.tail;
    while (vertex.next !== null) {
      vertex = vertex.next;
    }
    this.tail = vertex;
    return this;
  }
  // Removes a vertex from the linked list
  remove(vertex) {
    if (vertex.prev === null) {
      this.head = vertex.next;
    } else {
      vertex.prev.next = vertex.next;
    }
    if (vertex.next === null) {
      this.tail = vertex.prev;
    } else {
      vertex.next.prev = vertex.prev;
    }
    return this;
  }
  // Removes a list of vertices whose 'head' is 'a' and whose 'tail' is b
  removeSubList(a, b) {
    if (a.prev === null) {
      this.head = b.next;
    } else {
      a.prev.next = b.next;
    }
    if (b.next === null) {
      this.tail = a.prev;
    } else {
      b.next.prev = a.prev;
    }
    return this;
  }
  isEmpty() {
    return this.head === null;
  }
}
export {
  ConvexHull,
  Face,
  HalfEdge,
  VertexList,
  VertexNode
};
//# sourceMappingURL=ConvexHull.js.map
