"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class TDSLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
    this.debug = false;
    this.group = null;
    this.position = 0;
    this.materials = [];
    this.meshes = [];
  }
  /**
   * Load 3ds file from url.
   *
   * @method load
   * @param {[type]} url URL for the file.
   * @param {Function} onLoad onLoad callback, receives group Object3D as argument.
   * @param {Function} onProgress onProgress callback.
   * @param {Function} onError onError callback.
   */
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const path = this.path === "" ? THREE.LoaderUtils.extractUrlBase(url) : this.path;
    const loader = new THREE.FileLoader(this.manager);
    loader.setPath(this.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(this.requestHeader);
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      function(data) {
        try {
          onLoad(scope.parse(data, path));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      },
      onProgress,
      onError
    );
  }
  /**
   * Parse arraybuffer data and load 3ds file.
   *
   * @method parse
   * @param {ArrayBuffer} arraybuffer Arraybuffer data to be loaded.
   * @param {String} path Path for external resources.
   * @return {Group} Group loaded from 3ds file.
   */
  parse(arraybuffer, path) {
    this.group = new THREE.Group();
    this.position = 0;
    this.materials = [];
    this.meshes = [];
    this.readFile(arraybuffer, path);
    for (let i = 0; i < this.meshes.length; i++) {
      this.group.add(this.meshes[i]);
    }
    return this.group;
  }
  /**
   * Decode file content to read 3ds data.
   *
   * @method readFile
   * @param {ArrayBuffer} arraybuffer Arraybuffer data to be loaded.
   * @param {String} path Path for external resources.
   */
  readFile(arraybuffer, path) {
    const data = new DataView(arraybuffer);
    const chunk = this.readChunk(data);
    if (chunk.id === MLIBMAGIC || chunk.id === CMAGIC || chunk.id === M3DMAGIC) {
      let next = this.nextChunk(data, chunk);
      while (next !== 0) {
        if (next === M3D_VERSION) {
          const version = this.readDWord(data);
          this.debugMessage("3DS file version: " + version);
        } else if (next === MDATA) {
          this.resetPosition(data);
          this.readMeshData(data, path);
        } else {
          this.debugMessage("Unknown main chunk: " + next.toString(16));
        }
        next = this.nextChunk(data, chunk);
      }
    }
    this.debugMessage("Parsed " + this.meshes.length + " meshes");
  }
  /**
   * Read mesh data chunk.
   *
   * @method readMeshData
   * @param {Dataview} data Dataview in use.
   * @param {String} path Path for external resources.
   */
  readMeshData(data, path) {
    const chunk = this.readChunk(data);
    let next = this.nextChunk(data, chunk);
    while (next !== 0) {
      if (next === MESH_VERSION) {
        const version = +this.readDWord(data);
        this.debugMessage("Mesh Version: " + version);
      } else if (next === MASTER_SCALE) {
        const scale = this.readFloat(data);
        this.debugMessage("Master scale: " + scale);
        this.group.scale.set(scale, scale, scale);
      } else if (next === NAMED_OBJECT) {
        this.debugMessage("Named Object");
        this.resetPosition(data);
        this.readNamedObject(data);
      } else if (next === MAT_ENTRY) {
        this.debugMessage("Material");
        this.resetPosition(data);
        this.readMaterialEntry(data, path);
      } else {
        this.debugMessage("Unknown MDATA chunk: " + next.toString(16));
      }
      next = this.nextChunk(data, chunk);
    }
  }
  /**
   * Read named object chunk.
   *
   * @method readNamedObject
   * @param {Dataview} data Dataview in use.
   */
  readNamedObject(data) {
    const chunk = this.readChunk(data);
    const name = this.readString(data, 64);
    chunk.cur = this.position;
    let next = this.nextChunk(data, chunk);
    while (next !== 0) {
      if (next === N_TRI_OBJECT) {
        this.resetPosition(data);
        const mesh = this.readMesh(data);
        mesh.name = name;
        this.meshes.push(mesh);
      } else {
        this.debugMessage("Unknown named object chunk: " + next.toString(16));
      }
      next = this.nextChunk(data, chunk);
    }
    this.endChunk(chunk);
  }
  /**
   * Read material data chunk and add it to the material list.
   *
   * @method readMaterialEntry
   * @param {Dataview} data Dataview in use.
   * @param {String} path Path for external resources.
   */
  readMaterialEntry(data, path) {
    const chunk = this.readChunk(data);
    let next = this.nextChunk(data, chunk);
    const material = new THREE.MeshPhongMaterial();
    while (next !== 0) {
      if (next === MAT_NAME) {
        material.name = this.readString(data, 64);
        this.debugMessage("   Name: " + material.name);
      } else if (next === MAT_WIRE) {
        this.debugMessage("   Wireframe");
        material.wireframe = true;
      } else if (next === MAT_WIRE_SIZE) {
        const value = this.readByte(data);
        material.wireframeLinewidth = value;
        this.debugMessage("   Wireframe Thickness: " + value);
      } else if (next === MAT_TWO_SIDE) {
        material.side = THREE.DoubleSide;
        this.debugMessage("   DoubleSided");
      } else if (next === MAT_ADDITIVE) {
        this.debugMessage("   Additive Blending");
        material.blending = THREE.AdditiveBlending;
      } else if (next === MAT_DIFFUSE) {
        this.debugMessage("   Diffuse Color");
        material.color = this.readColor(data);
      } else if (next === MAT_SPECULAR) {
        this.debugMessage("   Specular Color");
        material.specular = this.readColor(data);
      } else if (next === MAT_AMBIENT) {
        this.debugMessage("   Ambient color");
        material.color = this.readColor(data);
      } else if (next === MAT_SHININESS) {
        const shininess = this.readPercentage(data);
        material.shininess = shininess * 100;
        this.debugMessage("   Shininess : " + shininess);
      } else if (next === MAT_TRANSPARENCY) {
        const transparency = this.readPercentage(data);
        material.opacity = 1 - transparency;
        this.debugMessage("  Transparency : " + transparency);
        material.transparent = material.opacity < 1 ? true : false;
      } else if (next === MAT_TEXMAP) {
        this.debugMessage("   ColorMap");
        this.resetPosition(data);
        material.map = this.readMap(data, path);
      } else if (next === MAT_BUMPMAP) {
        this.debugMessage("   BumpMap");
        this.resetPosition(data);
        material.bumpMap = this.readMap(data, path);
      } else if (next === MAT_OPACMAP) {
        this.debugMessage("   OpacityMap");
        this.resetPosition(data);
        material.alphaMap = this.readMap(data, path);
      } else if (next === MAT_SPECMAP) {
        this.debugMessage("   SpecularMap");
        this.resetPosition(data);
        material.specularMap = this.readMap(data, path);
      } else {
        this.debugMessage("   Unknown material chunk: " + next.toString(16));
      }
      next = this.nextChunk(data, chunk);
    }
    this.endChunk(chunk);
    this.materials[material.name] = material;
  }
  /**
   * Read mesh data chunk.
   *
   * @method readMesh
   * @param {Dataview} data Dataview in use.
   * @return {Mesh} The parsed mesh.
   */
  readMesh(data) {
    const chunk = this.readChunk(data);
    let next = this.nextChunk(data, chunk);
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshPhongMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "mesh";
    while (next !== 0) {
      if (next === POINT_ARRAY) {
        const points = this.readWord(data);
        this.debugMessage("   Vertex: " + points);
        const vertices = [];
        for (let i = 0; i < points; i++) {
          vertices.push(this.readFloat(data));
          vertices.push(this.readFloat(data));
          vertices.push(this.readFloat(data));
        }
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      } else if (next === FACE_ARRAY) {
        this.resetPosition(data);
        this.readFaceArray(data, mesh);
      } else if (next === TEX_VERTS) {
        const texels = this.readWord(data);
        this.debugMessage("   UV: " + texels);
        const uvs = [];
        for (let i = 0; i < texels; i++) {
          uvs.push(this.readFloat(data));
          uvs.push(this.readFloat(data));
        }
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      } else if (next === MESH_MATRIX) {
        this.debugMessage("   Tranformation Matrix (TODO)");
        const values = [];
        for (let i = 0; i < 12; i++) {
          values[i] = this.readFloat(data);
        }
        const matrix = new THREE.Matrix4();
        matrix.elements[0] = values[0];
        matrix.elements[1] = values[6];
        matrix.elements[2] = values[3];
        matrix.elements[3] = values[9];
        matrix.elements[4] = values[2];
        matrix.elements[5] = values[8];
        matrix.elements[6] = values[5];
        matrix.elements[7] = values[11];
        matrix.elements[8] = values[1];
        matrix.elements[9] = values[7];
        matrix.elements[10] = values[4];
        matrix.elements[11] = values[10];
        matrix.elements[12] = 0;
        matrix.elements[13] = 0;
        matrix.elements[14] = 0;
        matrix.elements[15] = 1;
        matrix.transpose();
        const inverse = new THREE.Matrix4();
        inverse.copy(matrix).invert();
        geometry.applyMatrix4(inverse);
        matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
      } else {
        this.debugMessage("   Unknown mesh chunk: " + next.toString(16));
      }
      next = this.nextChunk(data, chunk);
    }
    this.endChunk(chunk);
    geometry.computeVertexNormals();
    return mesh;
  }
  /**
   * Read face array data chunk.
   *
   * @method readFaceArray
   * @param {Dataview} data Dataview in use.
   * @param {Mesh} mesh Mesh to be filled with the data read.
   */
  readFaceArray(data, mesh) {
    const chunk = this.readChunk(data);
    const faces = this.readWord(data);
    this.debugMessage("   Faces: " + faces);
    const index = [];
    for (let i = 0; i < faces; ++i) {
      index.push(this.readWord(data), this.readWord(data), this.readWord(data));
      this.readWord(data);
    }
    mesh.geometry.setIndex(index);
    let materialIndex = 0;
    let start = 0;
    while (this.position < chunk.end) {
      const subchunk = this.readChunk(data);
      if (subchunk.id === MSH_MAT_GROUP) {
        this.debugMessage("      Material Group");
        this.resetPosition(data);
        const group = this.readMaterialGroup(data);
        const count = group.index.length * 3;
        mesh.geometry.addGroup(start, count, materialIndex);
        start += count;
        materialIndex++;
        const material = this.materials[group.name];
        if (Array.isArray(mesh.material) === false)
          mesh.material = [];
        if (material !== void 0) {
          mesh.material.push(material);
        }
      } else {
        this.debugMessage("      Unknown face array chunk: " + subchunk.toString(16));
      }
      this.endChunk(subchunk);
    }
    if (mesh.material.length === 1)
      mesh.material = mesh.material[0];
    this.endChunk(chunk);
  }
  /**
   * Read texture map data chunk.
   *
   * @method readMap
   * @param {Dataview} data Dataview in use.
   * @param {String} path Path for external resources.
   * @return {Texture} Texture read from this data chunk.
   */
  readMap(data, path) {
    const chunk = this.readChunk(data);
    let next = this.nextChunk(data, chunk);
    let texture = {};
    const loader = new THREE.TextureLoader(this.manager);
    loader.setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);
    while (next !== 0) {
      if (next === MAT_MAPNAME) {
        const name = this.readString(data, 128);
        texture = loader.load(name);
        this.debugMessage("      File: " + path + name);
      } else if (next === MAT_MAP_UOFFSET) {
        texture.offset.x = this.readFloat(data);
        this.debugMessage("      OffsetX: " + texture.offset.x);
      } else if (next === MAT_MAP_VOFFSET) {
        texture.offset.y = this.readFloat(data);
        this.debugMessage("      OffsetY: " + texture.offset.y);
      } else if (next === MAT_MAP_USCALE) {
        texture.repeat.x = this.readFloat(data);
        this.debugMessage("      RepeatX: " + texture.repeat.x);
      } else if (next === MAT_MAP_VSCALE) {
        texture.repeat.y = this.readFloat(data);
        this.debugMessage("      RepeatY: " + texture.repeat.y);
      } else {
        this.debugMessage("      Unknown map chunk: " + next.toString(16));
      }
      next = this.nextChunk(data, chunk);
    }
    this.endChunk(chunk);
    return texture;
  }
  /**
   * Read material group data chunk.
   *
   * @method readMaterialGroup
   * @param {Dataview} data Dataview in use.
   * @return {Object} Object with name and index of the object.
   */
  readMaterialGroup(data) {
    this.readChunk(data);
    const name = this.readString(data, 64);
    const numFaces = this.readWord(data);
    this.debugMessage("         Name: " + name);
    this.debugMessage("         Faces: " + numFaces);
    const index = [];
    for (let i = 0; i < numFaces; ++i) {
      index.push(this.readWord(data));
    }
    return { name, index };
  }
  /**
   * Read a color value.
   *
   * @method readColor
   * @param {DataView} data Dataview.
   * @return {Color} Color value read..
   */
  readColor(data) {
    const chunk = this.readChunk(data);
    const color = new THREE.Color();
    if (chunk.id === COLOR_24 || chunk.id === LIN_COLOR_24) {
      const r = this.readByte(data);
      const g = this.readByte(data);
      const b = this.readByte(data);
      color.setRGB(r / 255, g / 255, b / 255);
      this.debugMessage("      Color: " + color.r + ", " + color.g + ", " + color.b);
    } else if (chunk.id === COLOR_F || chunk.id === LIN_COLOR_F) {
      const r = this.readFloat(data);
      const g = this.readFloat(data);
      const b = this.readFloat(data);
      color.setRGB(r, g, b);
      this.debugMessage("      Color: " + color.r + ", " + color.g + ", " + color.b);
    } else {
      this.debugMessage("      Unknown color chunk: " + chunk.toString(16));
    }
    this.endChunk(chunk);
    return color;
  }
  /**
   * Read next chunk of data.
   *
   * @method readChunk
   * @param {DataView} data Dataview.
   * @return {Object} Chunk of data read.
   */
  readChunk(data) {
    const chunk = {};
    chunk.cur = this.position;
    chunk.id = this.readWord(data);
    chunk.size = this.readDWord(data);
    chunk.end = chunk.cur + chunk.size;
    chunk.cur += 6;
    return chunk;
  }
  /**
   * Set position to the end of the current chunk of data.
   *
   * @method endChunk
   * @param {Object} chunk Data chunk.
   */
  endChunk(chunk) {
    this.position = chunk.end;
  }
  /**
   * Move to the next data chunk.
   *
   * @method nextChunk
   * @param {DataView} data Dataview.
   * @param {Object} chunk Data chunk.
   */
  nextChunk(data, chunk) {
    if (chunk.cur >= chunk.end) {
      return 0;
    }
    this.position = chunk.cur;
    try {
      const next = this.readChunk(data);
      chunk.cur += next.size;
      return next.id;
    } catch (e) {
      this.debugMessage("Unable to read chunk at " + this.position);
      return 0;
    }
  }
  /**
   * Reset dataview position.
   *
   * @method resetPosition
   */
  resetPosition() {
    this.position -= 6;
  }
  /**
   * Read byte value.
   *
   * @method readByte
   * @param {DataView} data Dataview to read data from.
   * @return {Number} Data read from the dataview.
   */
  readByte(data) {
    const v = data.getUint8(this.position, true);
    this.position += 1;
    return v;
  }
  /**
   * Read 32 bit float value.
   *
   * @method readFloat
   * @param {DataView} data Dataview to read data from.
   * @return {Number} Data read from the dataview.
   */
  readFloat(data) {
    try {
      const v = data.getFloat32(this.position, true);
      this.position += 4;
      return v;
    } catch (e) {
      this.debugMessage(e + " " + this.position + " " + data.byteLength);
    }
  }
  /**
   * Read 32 bit signed integer value.
   *
   * @method readInt
   * @param {DataView} data Dataview to read data from.
   * @return {Number} Data read from the dataview.
   */
  readInt(data) {
    const v = data.getInt32(this.position, true);
    this.position += 4;
    return v;
  }
  /**
   * Read 16 bit signed integer value.
   *
   * @method readShort
   * @param {DataView} data Dataview to read data from.
   * @return {Number} Data read from the dataview.
   */
  readShort(data) {
    const v = data.getInt16(this.position, true);
    this.position += 2;
    return v;
  }
  /**
   * Read 64 bit unsigned integer value.
   *
   * @method readDWord
   * @param {DataView} data Dataview to read data from.
   * @return {Number} Data read from the dataview.
   */
  readDWord(data) {
    const v = data.getUint32(this.position, true);
    this.position += 4;
    return v;
  }
  /**
   * Read 32 bit unsigned integer value.
   *
   * @method readWord
   * @param {DataView} data Dataview to read data from.
   * @return {Number} Data read from the dataview.
   */
  readWord(data) {
    const v = data.getUint16(this.position, true);
    this.position += 2;
    return v;
  }
  /**
   * Read string value.
   *
   * @method readString
   * @param {DataView} data Dataview to read data from.
   * @param {Number} maxLength Max size of the string to be read.
   * @return {String} Data read from the dataview.
   */
  readString(data, maxLength) {
    let s = "";
    for (let i = 0; i < maxLength; i++) {
      const c = this.readByte(data);
      if (!c) {
        break;
      }
      s += String.fromCharCode(c);
    }
    return s;
  }
  /**
   * Read percentage value.
   *
   * @method readPercentage
   * @param {DataView} data Dataview to read data from.
   * @return {Number} Data read from the dataview.
   */
  readPercentage(data) {
    const chunk = this.readChunk(data);
    let value;
    switch (chunk.id) {
      case INT_PERCENTAGE:
        value = this.readShort(data) / 100;
        break;
      case FLOAT_PERCENTAGE:
        value = this.readFloat(data);
        break;
      default:
        this.debugMessage("      Unknown percentage chunk: " + chunk.toString(16));
    }
    this.endChunk(chunk);
    return value;
  }
  /**
   * Print debug message to the console.
   *
   * Is controlled by a flag to show or hide debug messages.
   *
   * @method debugMessage
   * @param {Object} message Debug message to print to the console.
   */
  debugMessage(message) {
    if (this.debug) {
      console.log(message);
    }
  }
}
const M3DMAGIC = 19789;
const MLIBMAGIC = 15786;
const CMAGIC = 49725;
const M3D_VERSION = 2;
const COLOR_F = 16;
const COLOR_24 = 17;
const LIN_COLOR_24 = 18;
const LIN_COLOR_F = 19;
const INT_PERCENTAGE = 48;
const FLOAT_PERCENTAGE = 49;
const MDATA = 15677;
const MESH_VERSION = 15678;
const MASTER_SCALE = 256;
const MAT_ENTRY = 45055;
const MAT_NAME = 40960;
const MAT_AMBIENT = 40976;
const MAT_DIFFUSE = 40992;
const MAT_SPECULAR = 41008;
const MAT_SHININESS = 41024;
const MAT_TRANSPARENCY = 41040;
const MAT_TWO_SIDE = 41089;
const MAT_ADDITIVE = 41091;
const MAT_WIRE = 41093;
const MAT_WIRE_SIZE = 41095;
const MAT_TEXMAP = 41472;
const MAT_OPACMAP = 41488;
const MAT_BUMPMAP = 41520;
const MAT_SPECMAP = 41476;
const MAT_MAPNAME = 41728;
const MAT_MAP_USCALE = 41812;
const MAT_MAP_VSCALE = 41814;
const MAT_MAP_UOFFSET = 41816;
const MAT_MAP_VOFFSET = 41818;
const NAMED_OBJECT = 16384;
const N_TRI_OBJECT = 16640;
const POINT_ARRAY = 16656;
const FACE_ARRAY = 16672;
const MSH_MAT_GROUP = 16688;
const TEX_VERTS = 16704;
const MESH_MATRIX = 16736;
exports.TDSLoader = TDSLoader;
//# sourceMappingURL=TDSLoader.cjs.map
