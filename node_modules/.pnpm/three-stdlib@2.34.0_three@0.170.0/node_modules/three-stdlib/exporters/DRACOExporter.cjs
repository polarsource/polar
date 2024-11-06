"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const _DRACOExporter = class {
  parse(object, options = {
    decodeSpeed: 5,
    encodeSpeed: 5,
    encoderMethod: _DRACOExporter.MESH_EDGEBREAKER_ENCODING,
    quantization: [16, 8, 8, 8, 8],
    exportUvs: true,
    exportNormals: true,
    exportColor: false
  }) {
    if (object instanceof THREE.BufferGeometry && object.isBufferGeometry) {
      throw new Error("DRACOExporter: The first parameter of parse() is now an instance of Mesh or Points.");
    }
    if (DracoEncoderModule === void 0) {
      throw new Error("THREE.DRACOExporter: required the draco_encoder to work.");
    }
    const geometry = object.geometry;
    const dracoEncoder = DracoEncoderModule();
    const encoder = new dracoEncoder.Encoder();
    let builder;
    let dracoObject;
    if (!geometry.isBufferGeometry) {
      throw new Error("THREE.DRACOExporter.parse(geometry, options): geometry is not a THREE.BufferGeometry instance.");
    }
    if (object instanceof THREE.Mesh && object.isMesh) {
      builder = new dracoEncoder.MeshBuilder();
      dracoObject = new dracoEncoder.Mesh();
      const vertices = geometry.getAttribute("position");
      builder.AddFloatAttributeToMesh(
        dracoObject,
        dracoEncoder.POSITION,
        vertices.count,
        vertices.itemSize,
        vertices.array
      );
      const faces = geometry.getIndex();
      if (faces !== null) {
        builder.AddFacesToMesh(dracoObject, faces.count / 3, faces.array);
      } else {
        const faces2 = new (vertices.count > 65535 ? Uint32Array : Uint16Array)(vertices.count);
        for (let i = 0; i < faces2.length; i++) {
          faces2[i] = i;
        }
        builder.AddFacesToMesh(dracoObject, vertices.count, faces2);
      }
      if (options.exportNormals) {
        const normals = geometry.getAttribute("normal");
        if (normals !== void 0) {
          builder.AddFloatAttributeToMesh(
            dracoObject,
            dracoEncoder.NORMAL,
            normals.count,
            normals.itemSize,
            normals.array
          );
        }
      }
      if (options.exportUvs) {
        const uvs = geometry.getAttribute("uv");
        if (uvs !== void 0) {
          builder.AddFloatAttributeToMesh(dracoObject, dracoEncoder.TEX_COORD, uvs.count, uvs.itemSize, uvs.array);
        }
      }
      if (options.exportColor) {
        const colors = geometry.getAttribute("color");
        if (colors !== void 0) {
          builder.AddFloatAttributeToMesh(dracoObject, dracoEncoder.COLOR, colors.count, colors.itemSize, colors.array);
        }
      }
    } else if (object instanceof THREE.Points && object.isPoints) {
      builder = new dracoEncoder.PointCloudBuilder();
      dracoObject = new dracoEncoder.PointCloud();
      const vertices = geometry.getAttribute("position");
      builder.AddFloatAttribute(dracoObject, dracoEncoder.POSITION, vertices.count, vertices.itemSize, vertices.array);
      if (options.exportColor) {
        const colors = geometry.getAttribute("color");
        if (colors !== void 0) {
          builder.AddFloatAttribute(dracoObject, dracoEncoder.COLOR, colors.count, colors.itemSize, colors.array);
        }
      }
    } else {
      throw new Error("DRACOExporter: Unsupported object type.");
    }
    const encodedData = new dracoEncoder.DracoInt8Array();
    const encodeSpeed = options.encodeSpeed !== void 0 ? options.encodeSpeed : 5;
    const decodeSpeed = options.decodeSpeed !== void 0 ? options.decodeSpeed : 5;
    encoder.SetSpeedOptions(encodeSpeed, decodeSpeed);
    if (options.encoderMethod !== void 0) {
      encoder.SetEncodingMethod(options.encoderMethod);
    }
    if (options.quantization !== void 0) {
      for (let i = 0; i < 5; i++) {
        if (options.quantization[i] !== void 0) {
          encoder.SetAttributeQuantization(i, options.quantization[i]);
        }
      }
    }
    let length;
    if (object instanceof THREE.Mesh && object.isMesh) {
      length = encoder.EncodeMeshToDracoBuffer(dracoObject, encodedData);
    } else {
      length = encoder.EncodePointCloudToDracoBuffer(dracoObject, true, encodedData);
    }
    dracoEncoder.destroy(dracoObject);
    if (length === 0) {
      throw new Error("THREE.DRACOExporter: Draco encoding failed.");
    }
    const outputData = new Int8Array(new ArrayBuffer(length));
    for (let i = 0; i < length; i++) {
      outputData[i] = encodedData.GetValue(i);
    }
    dracoEncoder.destroy(encodedData);
    dracoEncoder.destroy(encoder);
    dracoEncoder.destroy(builder);
    return outputData;
  }
};
let DRACOExporter = _DRACOExporter;
// Encoder methods
__publicField(DRACOExporter, "MESH_EDGEBREAKER_ENCODING", 1);
__publicField(DRACOExporter, "MESH_SEQUENTIAL_ENCODING", 0);
// Geometry type
__publicField(DRACOExporter, "POINT_CLOUD", 0);
__publicField(DRACOExporter, "TRIANGULAR_MESH", 1);
// Attribute type
__publicField(DRACOExporter, "INVALID", -1);
__publicField(DRACOExporter, "POSITION", 0);
__publicField(DRACOExporter, "NORMAL", 1);
__publicField(DRACOExporter, "COLOR", 2);
__publicField(DRACOExporter, "TEX_COORD", 3);
__publicField(DRACOExporter, "GENERIC", 4);
exports.DRACOExporter = DRACOExporter;
//# sourceMappingURL=DRACOExporter.cjs.map
