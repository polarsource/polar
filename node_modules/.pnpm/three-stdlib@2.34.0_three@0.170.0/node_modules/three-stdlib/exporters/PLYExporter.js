import { Mesh, Vector3, Matrix3 } from "three";
class PLYExporter {
  parse(object, onDone, options) {
    if (onDone && typeof onDone === "object") {
      console.warn(
        'THREE.PLYExporter: The options parameter is now the third argument to the "parse" function. See the documentation for the new API.'
      );
      options = onDone;
      onDone = void 0;
    }
    const defaultOptions = {
      binary: false,
      excludeAttributes: [],
      // normal, uv, color, index
      littleEndian: false
    };
    options = Object.assign(defaultOptions, options);
    const excludeAttributes = options.excludeAttributes;
    let includeNormals = false;
    let includeColors = false;
    let includeUVs = false;
    let vertexCount = 0;
    let faceCount = 0;
    object.traverse(function(child) {
      if (child instanceof Mesh && child.isMesh) {
        const mesh = child;
        const geometry = mesh.geometry;
        if (!geometry.isBufferGeometry) {
          throw new Error("THREE.PLYExporter: Geometry is not of type THREE.BufferGeometry.");
        }
        const vertices = geometry.getAttribute("position");
        const normals = geometry.getAttribute("normal");
        const uvs = geometry.getAttribute("uv");
        const colors = geometry.getAttribute("color");
        const indices = geometry.getIndex();
        if (vertices === void 0) {
          return;
        }
        vertexCount += vertices.count;
        faceCount += indices ? indices.count / 3 : vertices.count / 3;
        if (normals !== void 0)
          includeNormals = true;
        if (uvs !== void 0)
          includeUVs = true;
        if (colors !== void 0)
          includeColors = true;
      }
    });
    const includeIndices = (excludeAttributes == null ? void 0 : excludeAttributes.indexOf("index")) === -1;
    includeNormals = includeNormals && (excludeAttributes == null ? void 0 : excludeAttributes.indexOf("normal")) === -1;
    includeColors = includeColors && (excludeAttributes == null ? void 0 : excludeAttributes.indexOf("color")) === -1;
    includeUVs = includeUVs && (excludeAttributes == null ? void 0 : excludeAttributes.indexOf("uv")) === -1;
    if (includeIndices && faceCount !== Math.floor(faceCount)) {
      console.error(
        "PLYExporter: Failed to generate a valid PLY file with triangle indices because the number of indices is not divisible by 3."
      );
      return null;
    }
    const indexByteCount = 4;
    let header = `ply
format ${options.binary ? options.littleEndian ? "binary_little_endian" : "binary_big_endian" : "ascii"} 1.0
element vertex ${vertexCount}
property float x
property float y
property float z
`;
    if (includeNormals) {
      header += "property float nx\nproperty float ny\nproperty float nz\n";
    }
    if (includeUVs) {
      header += "property float s\nproperty float t\n";
    }
    if (includeColors) {
      header += "property uchar red\nproperty uchar green\nproperty uchar blue\n";
    }
    if (includeIndices) {
      header += `${`element face ${faceCount}
`}property list uchar int vertex_index
`;
    }
    header += "end_header\n";
    const vertex = new Vector3();
    const normalMatrixWorld = new Matrix3();
    let result = null;
    if (options.binary) {
      const headerBin = new TextEncoder().encode(header);
      const vertexListLength = vertexCount * (4 * 3 + (includeNormals ? 4 * 3 : 0) + (includeColors ? 3 : 0) + (includeUVs ? 4 * 2 : 0));
      const faceListLength = includeIndices ? faceCount * (indexByteCount * 3 + 1) : 0;
      const output = new DataView(new ArrayBuffer(headerBin.length + vertexListLength + faceListLength));
      new Uint8Array(output.buffer).set(headerBin, 0);
      let vOffset = headerBin.length;
      let fOffset = headerBin.length + vertexListLength;
      let writtenVertices = 0;
      this.traverseMeshes(object, function(mesh, geometry) {
        const vertices = geometry.getAttribute("position");
        const normals = geometry.getAttribute("normal");
        const uvs = geometry.getAttribute("uv");
        const colors = geometry.getAttribute("color");
        const indices = geometry.getIndex();
        normalMatrixWorld.getNormalMatrix(mesh.matrixWorld);
        for (let i = 0, l = vertices.count; i < l; i++) {
          vertex.x = vertices.getX(i);
          vertex.y = vertices.getY(i);
          vertex.z = vertices.getZ(i);
          vertex.applyMatrix4(mesh.matrixWorld);
          output.setFloat32(vOffset, vertex.x, options.littleEndian);
          vOffset += 4;
          output.setFloat32(vOffset, vertex.y, options.littleEndian);
          vOffset += 4;
          output.setFloat32(vOffset, vertex.z, options.littleEndian);
          vOffset += 4;
          if (includeNormals) {
            if (normals != null) {
              vertex.x = normals.getX(i);
              vertex.y = normals.getY(i);
              vertex.z = normals.getZ(i);
              vertex.applyMatrix3(normalMatrixWorld).normalize();
              output.setFloat32(vOffset, vertex.x, options.littleEndian);
              vOffset += 4;
              output.setFloat32(vOffset, vertex.y, options.littleEndian);
              vOffset += 4;
              output.setFloat32(vOffset, vertex.z, options.littleEndian);
              vOffset += 4;
            } else {
              output.setFloat32(vOffset, 0, options.littleEndian);
              vOffset += 4;
              output.setFloat32(vOffset, 0, options.littleEndian);
              vOffset += 4;
              output.setFloat32(vOffset, 0, options.littleEndian);
              vOffset += 4;
            }
          }
          if (includeUVs) {
            if (uvs != null) {
              output.setFloat32(vOffset, uvs.getX(i), options.littleEndian);
              vOffset += 4;
              output.setFloat32(vOffset, uvs.getY(i), options.littleEndian);
              vOffset += 4;
            } else if (!includeUVs) {
              output.setFloat32(vOffset, 0, options.littleEndian);
              vOffset += 4;
              output.setFloat32(vOffset, 0, options.littleEndian);
              vOffset += 4;
            }
          }
          if (includeColors) {
            if (colors != null) {
              output.setUint8(vOffset, Math.floor(colors.getX(i) * 255));
              vOffset += 1;
              output.setUint8(vOffset, Math.floor(colors.getY(i) * 255));
              vOffset += 1;
              output.setUint8(vOffset, Math.floor(colors.getZ(i) * 255));
              vOffset += 1;
            } else {
              output.setUint8(vOffset, 255);
              vOffset += 1;
              output.setUint8(vOffset, 255);
              vOffset += 1;
              output.setUint8(vOffset, 255);
              vOffset += 1;
            }
          }
        }
        if (includeIndices) {
          if (indices !== null) {
            for (let i = 0, l = indices.count; i < l; i += 3) {
              output.setUint8(fOffset, 3);
              fOffset += 1;
              output.setUint32(fOffset, indices.getX(i + 0) + writtenVertices, options.littleEndian);
              fOffset += indexByteCount;
              output.setUint32(fOffset, indices.getX(i + 1) + writtenVertices, options.littleEndian);
              fOffset += indexByteCount;
              output.setUint32(fOffset, indices.getX(i + 2) + writtenVertices, options.littleEndian);
              fOffset += indexByteCount;
            }
          } else {
            for (let i = 0, l = vertices.count; i < l; i += 3) {
              output.setUint8(fOffset, 3);
              fOffset += 1;
              output.setUint32(fOffset, writtenVertices + i, options.littleEndian);
              fOffset += indexByteCount;
              output.setUint32(fOffset, writtenVertices + i + 1, options.littleEndian);
              fOffset += indexByteCount;
              output.setUint32(fOffset, writtenVertices + i + 2, options.littleEndian);
              fOffset += indexByteCount;
            }
          }
        }
        writtenVertices += vertices.count;
      });
      result = output.buffer;
    } else {
      let writtenVertices = 0;
      let vertexList = "";
      let faceList = "";
      this.traverseMeshes(object, function(mesh, geometry) {
        const vertices = geometry.getAttribute("position");
        const normals = geometry.getAttribute("normal");
        const uvs = geometry.getAttribute("uv");
        const colors = geometry.getAttribute("color");
        const indices = geometry.getIndex();
        normalMatrixWorld.getNormalMatrix(mesh.matrixWorld);
        for (let i = 0, l = vertices.count; i < l; i++) {
          vertex.x = vertices.getX(i);
          vertex.y = vertices.getY(i);
          vertex.z = vertices.getZ(i);
          vertex.applyMatrix4(mesh.matrixWorld);
          let line = vertex.x + " " + vertex.y + " " + vertex.z;
          if (includeNormals) {
            if (normals != null) {
              vertex.x = normals.getX(i);
              vertex.y = normals.getY(i);
              vertex.z = normals.getZ(i);
              vertex.applyMatrix3(normalMatrixWorld).normalize();
              line += " " + vertex.x + " " + vertex.y + " " + vertex.z;
            } else {
              line += " 0 0 0";
            }
          }
          if (includeUVs) {
            if (uvs != null) {
              line += " " + uvs.getX(i) + " " + uvs.getY(i);
            } else if (includeUVs) {
              line += " 0 0";
            }
          }
          if (includeColors) {
            if (colors != null) {
              line += " " + Math.floor(colors.getX(i) * 255) + " " + Math.floor(colors.getY(i) * 255) + " " + Math.floor(colors.getZ(i) * 255);
            } else {
              line += " 255 255 255";
            }
          }
          vertexList += line + "\n";
        }
        if (includeIndices) {
          if (indices !== null) {
            for (let i = 0, l = indices.count; i < l; i += 3) {
              faceList += `3 ${indices.getX(i + 0) + writtenVertices}`;
              faceList += ` ${indices.getX(i + 1) + writtenVertices}`;
              faceList += ` ${indices.getX(i + 2) + writtenVertices}
`;
            }
          } else {
            for (let i = 0, l = vertices.count; i < l; i += 3) {
              faceList += `3 ${writtenVertices + i} ${writtenVertices + i + 1} ${writtenVertices + i + 2}
`;
            }
          }
          faceCount += indices ? indices.count / 3 : vertices.count / 3;
        }
        writtenVertices += vertices.count;
      });
      result = `${header}${vertexList}${includeIndices ? `${faceList}
` : "\n"}`;
    }
    if (typeof onDone === "function") {
      requestAnimationFrame(() => onDone && onDone(typeof result === "string" ? result : ""));
    }
    return result;
  }
  // Iterate over the valid meshes in the object
  traverseMeshes(object, cb) {
    object.traverse(function(child) {
      if (child instanceof Mesh && child.isMesh) {
        const mesh = child;
        const geometry = mesh.geometry;
        if (!geometry.isBufferGeometry) {
          throw new Error("THREE.PLYExporter: Geometry is not of type THREE.BufferGeometry.");
        }
        if (geometry.hasAttribute("position")) {
          cb(mesh, geometry);
        }
      }
    });
  }
}
export {
  PLYExporter
};
//# sourceMappingURL=PLYExporter.js.map
