var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Vector3, Color, Vector2, Mesh, Line, Points, Matrix3, BufferAttribute } from "three";
class OBJExporter {
  constructor() {
    __publicField(this, "output");
    __publicField(this, "indexVertex");
    __publicField(this, "indexVertexUvs");
    __publicField(this, "indexNormals");
    __publicField(this, "vertex");
    __publicField(this, "color");
    __publicField(this, "normal");
    __publicField(this, "uv");
    __publicField(this, "face");
    this.output = "";
    this.indexVertex = 0;
    this.indexVertexUvs = 0;
    this.indexNormals = 0;
    this.vertex = new Vector3();
    this.color = new Color();
    this.normal = new Vector3();
    this.uv = new Vector2();
    this.face = [];
  }
  parse(object) {
    object.traverse((child) => {
      if (child instanceof Mesh && child.isMesh) {
        this.parseMesh(child);
      }
      if (child instanceof Line && child.isLine) {
        this.parseLine(child);
      }
      if (child instanceof Points && child.isPoints) {
        this.parsePoints(child);
      }
    });
    return this.output;
  }
  parseMesh(mesh) {
    let nbVertex = 0;
    let nbNormals = 0;
    let nbVertexUvs = 0;
    const geometry = mesh.geometry;
    const normalMatrixWorld = new Matrix3();
    if (!geometry.isBufferGeometry) {
      throw new Error("THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.");
    }
    const vertices = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const uvs = geometry.getAttribute("uv");
    const indices = geometry.getIndex();
    this.output += `o ${mesh.name}
`;
    if (mesh.material && !Array.isArray(mesh.material) && mesh.material.name) {
      this.output += `usemtl ${mesh.material.name}
`;
    }
    if (vertices !== void 0) {
      for (let i = 0, l = vertices.count; i < l; i++, nbVertex++) {
        this.vertex.x = vertices.getX(i);
        this.vertex.y = vertices.getY(i);
        this.vertex.z = vertices.getZ(i);
        this.vertex.applyMatrix4(mesh.matrixWorld);
        this.output += `v ${this.vertex.x} ${this.vertex.y} ${this.vertex.z}
`;
      }
    }
    if (uvs !== void 0) {
      for (let i = 0, l = uvs.count; i < l; i++, nbVertexUvs++) {
        this.uv.x = uvs.getX(i);
        this.uv.y = uvs.getY(i);
        this.output += `vt ${this.uv.x} ${this.uv.y}
`;
      }
    }
    if (normals !== void 0) {
      normalMatrixWorld.getNormalMatrix(mesh.matrixWorld);
      for (let i = 0, l = normals.count; i < l; i++, nbNormals++) {
        this.normal.x = normals.getX(i);
        this.normal.y = normals.getY(i);
        this.normal.z = normals.getZ(i);
        this.normal.applyMatrix3(normalMatrixWorld).normalize();
        this.output += `vn ${this.normal.x} ${this.normal.y} ${this.normal.z}
`;
      }
    }
    if (indices !== null) {
      for (let i = 0, l = indices.count; i < l; i += 3) {
        for (let m = 0; m < 3; m++) {
          const j = indices.getX(i + m) + 1;
          this.face[m] = this.indexVertex + j + (normals || uvs ? `/${uvs ? this.indexVertexUvs + j : ""}${normals ? `/${this.indexNormals + j}` : ""}` : "");
        }
        this.output += `f ${this.face.join(" ")}
`;
      }
    } else {
      for (let i = 0, l = vertices.count; i < l; i += 3) {
        for (let m = 0; m < 3; m++) {
          const j = i + m + 1;
          this.face[m] = this.indexVertex + j + (normals || uvs ? `/${uvs ? this.indexVertexUvs + j : ""}${normals ? `/${this.indexNormals + j}` : ""}` : "");
        }
        this.output += `f ${this.face.join(" ")}
`;
      }
    }
    this.indexVertex += nbVertex;
    this.indexVertexUvs += nbVertexUvs;
    this.indexNormals += nbNormals;
  }
  parseLine(line) {
    let nbVertex = 0;
    const geometry = line.geometry;
    const type = line.type;
    if (geometry.isBufferGeometry) {
      throw new Error("THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.");
    }
    const vertices = geometry.getAttribute("position");
    this.output += `o ${line.name}
`;
    if (vertices !== void 0) {
      for (let i = 0, l = vertices.count; i < l; i++, nbVertex++) {
        this.vertex.x = vertices.getX(i);
        this.vertex.y = vertices.getY(i);
        this.vertex.z = vertices.getZ(i);
        this.vertex.applyMatrix4(line.matrixWorld);
        this.output += `v ${this.vertex.x} ${this.vertex.y} ${this.vertex.z}
`;
      }
    }
    if (type === "Line") {
      this.output += "l ";
      for (let j = 1, l = vertices.count; j <= l; j++) {
        this.output += `${this.indexVertex + j} `;
      }
      this.output += "\n";
    }
    if (type === "LineSegments") {
      for (let j = 1, k = j + 1, l = vertices.count; j < l; j += 2, k = j + 1) {
        this.output += `l ${this.indexVertex + j} ${this.indexVertex + k}
`;
      }
    }
    this.indexVertex += nbVertex;
  }
  parsePoints(points) {
    let nbVertex = 0;
    const geometry = points.geometry;
    if (!geometry.isBufferGeometry) {
      throw new Error("THREE.OBJExporter: Geometry is not of type THREE.BufferGeometry.");
    }
    const vertices = geometry.getAttribute("position");
    const colors = geometry.getAttribute("color");
    this.output += `o ${points.name}
`;
    if (vertices !== void 0) {
      for (let i = 0, l = vertices.count; i < l; i++, nbVertex++) {
        this.vertex.fromBufferAttribute(vertices, i);
        this.vertex.applyMatrix4(points.matrixWorld);
        this.output += `v ${this.vertex.x} ${this.vertex.y} ${this.vertex.z}`;
        if (colors !== void 0 && colors instanceof BufferAttribute) {
          this.color.fromBufferAttribute(colors, i);
          this.output += ` ${this.color.r} ${this.color.g} ${this.color.b}`;
        }
        this.output += "\n";
      }
    }
    this.output += "p ";
    for (let j = 1, l = vertices.count; j <= l; j++) {
      this.output += `${this.indexVertex + j} `;
    }
    this.output += "\n";
    this.indexVertex += nbVertex;
  }
}
export {
  OBJExporter
};
//# sourceMappingURL=OBJExporter.js.map
