var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Vector3 } from "three";
const isMesh = (object) => object.isMesh;
class STLExporter {
  constructor() {
    __publicField(this, "binary", false);
    __publicField(this, "output", "");
    __publicField(this, "offset", 80);
    // skip header
    __publicField(this, "objects", []);
    __publicField(this, "triangles", 0);
    __publicField(this, "vA", new Vector3());
    __publicField(this, "vB", new Vector3());
    __publicField(this, "vC", new Vector3());
    __publicField(this, "cb", new Vector3());
    __publicField(this, "ab", new Vector3());
    __publicField(this, "normal", new Vector3());
  }
  parse(scene, options) {
    this.binary = (options == null ? void 0 : options.binary) !== void 0 ? options == null ? void 0 : options.binary : false;
    scene.traverse((object) => {
      if (isMesh(object)) {
        const geometry = object.geometry;
        if (!geometry.isBufferGeometry) {
          throw new Error("THREE.STLExporter: Geometry is not of type THREE.BufferGeometry.");
        }
        const index = geometry.index;
        const positionAttribute = geometry.getAttribute("position") || null;
        if (!positionAttribute)
          return;
        this.triangles += index !== null ? index.count / 3 : positionAttribute.count / 3;
        this.objects.push({
          object3d: object,
          geometry
        });
      }
    });
    if (this.binary) {
      const bufferLength = this.triangles * 2 + this.triangles * 3 * 4 * 4 + 80 + 4;
      const arrayBuffer = new ArrayBuffer(bufferLength);
      this.output = new DataView(arrayBuffer);
      this.output.setUint32(this.offset, this.triangles, true);
      this.offset += 4;
    } else {
      this.output = "";
      this.output += "solid exported\n";
    }
    for (let i = 0, il = this.objects.length; i < il; i++) {
      const object = this.objects[i].object3d;
      const geometry = this.objects[i].geometry;
      const index = geometry.index;
      const positionAttribute = geometry.getAttribute("position");
      if (index !== null) {
        for (let j = 0; j < index.count; j += 3) {
          const a = index.getX(j + 0);
          const b = index.getX(j + 1);
          const c = index.getX(j + 2);
          this.writeFace(a, b, c, positionAttribute, object);
        }
      } else {
        for (let j = 0; j < positionAttribute.count; j += 3) {
          const a = j + 0;
          const b = j + 1;
          const c = j + 2;
          this.writeFace(a, b, c, positionAttribute, object);
        }
      }
    }
    if (!this.binary) {
      this.output += "endsolid exported\n";
    }
    return this.output;
  }
  writeFace(a, b, c, positionAttribute, object) {
    this.vA.fromBufferAttribute(positionAttribute, a);
    this.vB.fromBufferAttribute(positionAttribute, b);
    this.vC.fromBufferAttribute(positionAttribute, c);
    if (object.isSkinnedMesh) {
      const mesh = object;
      if ("applyBoneTransform" in mesh) {
        mesh.applyBoneTransform(a, this.vA);
        mesh.applyBoneTransform(b, this.vB);
        mesh.applyBoneTransform(c, this.vC);
      } else {
        mesh.boneTransform(a, this.vA);
        mesh.boneTransform(b, this.vB);
        mesh.boneTransform(c, this.vC);
      }
    }
    this.vA.applyMatrix4(object.matrixWorld);
    this.vB.applyMatrix4(object.matrixWorld);
    this.vC.applyMatrix4(object.matrixWorld);
    this.writeNormal(this.vA, this.vB, this.vC);
    this.writeVertex(this.vA);
    this.writeVertex(this.vB);
    this.writeVertex(this.vC);
    if (this.binary && this.output instanceof DataView) {
      this.output.setUint16(this.offset, 0, true);
      this.offset += 2;
    } else {
      this.output += "		endloop\n";
      this.output += "	endfacet\n";
    }
  }
  writeNormal(vA, vB, vC) {
    this.cb.subVectors(vC, vB);
    this.ab.subVectors(vA, vB);
    this.cb.cross(this.ab).normalize();
    this.normal.copy(this.cb).normalize();
    if (this.binary && this.output instanceof DataView) {
      this.output.setFloat32(this.offset, this.normal.x, true);
      this.offset += 4;
      this.output.setFloat32(this.offset, this.normal.y, true);
      this.offset += 4;
      this.output.setFloat32(this.offset, this.normal.z, true);
      this.offset += 4;
    } else {
      this.output += `	facet normal ${this.normal.x} ${this.normal.y} ${this.normal.z}
`;
      this.output += "		outer loop\n";
    }
  }
  writeVertex(vertex) {
    if (this.binary && this.output instanceof DataView) {
      this.output.setFloat32(this.offset, vertex.x, true);
      this.offset += 4;
      this.output.setFloat32(this.offset, vertex.y, true);
      this.offset += 4;
      this.output.setFloat32(this.offset, vertex.z, true);
      this.offset += 4;
    } else {
      this.output += `			vertex ${vertex.x} ${vertex.y} ${vertex.z}
`;
    }
  }
}
export {
  STLExporter
};
//# sourceMappingURL=STLExporter.js.map
