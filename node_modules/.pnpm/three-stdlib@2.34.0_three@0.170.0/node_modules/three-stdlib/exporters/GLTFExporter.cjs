"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const constants = require("../_polyfill/constants.cjs");
async function readAsDataURL(blob) {
  const buffer = await blob.arrayBuffer();
  const data = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:${blob.type || ""};base64,${data}`;
}
let _renderer;
let fullscreenQuadGeometry;
let fullscreenQuadMaterial;
let fullscreenQuad;
function decompress(texture, maxTextureSize = Infinity, renderer = null) {
  if (!fullscreenQuadGeometry)
    fullscreenQuadGeometry = new THREE.PlaneGeometry(2, 2, 1, 1);
  if (!fullscreenQuadMaterial)
    fullscreenQuadMaterial = new THREE.ShaderMaterial({
      uniforms: { blitTexture: new THREE.Uniform(texture) },
      vertexShader: (
        /* glsl */
        `
        varying vec2 vUv;
        void main(){
            vUv = uv;
            gl_Position = vec4(position.xy * 1.0,0.,.999999);
        }
      `
      ),
      fragmentShader: (
        /* glsl */
        `
          uniform sampler2D blitTexture; 
          varying vec2 vUv;

          void main(){ 
              gl_FragColor = vec4(vUv.xy, 0, 1);
              
              #ifdef IS_SRGB
              gl_FragColor = LinearTosRGB( texture2D( blitTexture, vUv) );
              #else
              gl_FragColor = texture2D( blitTexture, vUv);
              #endif
          }
      `
      )
    });
  fullscreenQuadMaterial.uniforms.blitTexture.value = texture;
  fullscreenQuadMaterial.defines.IS_SRGB = "colorSpace" in texture ? texture.colorSpace === "srgb" : texture.encoding === 3001;
  fullscreenQuadMaterial.needsUpdate = true;
  if (!fullscreenQuad) {
    fullscreenQuad = new THREE.Mesh(fullscreenQuadGeometry, fullscreenQuadMaterial);
    fullscreenQuad.frustrumCulled = false;
  }
  const _camera = new THREE.PerspectiveCamera();
  const _scene = new THREE.Scene();
  _scene.add(fullscreenQuad);
  if (!renderer) {
    renderer = _renderer = new THREE.WebGLRenderer({ antialias: false });
  }
  renderer.setSize(Math.min(texture.image.width, maxTextureSize), Math.min(texture.image.height, maxTextureSize));
  renderer.clear();
  renderer.render(_scene, _camera);
  const readableTexture = new THREE.Texture(renderer.domElement);
  readableTexture.minFilter = texture.minFilter;
  readableTexture.magFilter = texture.magFilter;
  readableTexture.wrapS = texture.wrapS;
  readableTexture.wrapT = texture.wrapT;
  readableTexture.name = texture.name;
  if (_renderer) {
    _renderer.dispose();
    _renderer = null;
  }
  return readableTexture;
}
const KHR_mesh_quantization_ExtraAttrTypes = {
  POSITION: [
    "byte",
    "byte normalized",
    "unsigned byte",
    "unsigned byte normalized",
    "short",
    "short normalized",
    "unsigned short",
    "unsigned short normalized"
  ],
  NORMAL: ["byte normalized", "short normalized"],
  TANGENT: ["byte normalized", "short normalized"],
  TEXCOORD: ["byte", "byte normalized", "unsigned byte", "short", "short normalized", "unsigned short"]
};
class GLTFExporter {
  constructor() {
    this.pluginCallbacks = [];
    this.register(function(writer) {
      return new GLTFLightExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsUnlitExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsTransmissionExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsVolumeExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsIorExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsSpecularExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsClearcoatExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsIridescenceExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsSheenExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsAnisotropyExtension(writer);
    });
    this.register(function(writer) {
      return new GLTFMaterialsEmissiveStrengthExtension(writer);
    });
  }
  register(callback) {
    if (this.pluginCallbacks.indexOf(callback) === -1) {
      this.pluginCallbacks.push(callback);
    }
    return this;
  }
  unregister(callback) {
    if (this.pluginCallbacks.indexOf(callback) !== -1) {
      this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(callback), 1);
    }
    return this;
  }
  /**
   * Parse scenes and generate GLTF output
   * @param  {Scene or [THREE.Scenes]} input   Scene or Array of THREE.Scenes
   * @param  {Function} onDone  Callback on completed
   * @param  {Function} onError  Callback on errors
   * @param  {Object} options options
   */
  parse(input, onDone, onError, options) {
    const writer = new GLTFWriter();
    const plugins = [];
    for (let i = 0, il = this.pluginCallbacks.length; i < il; i++) {
      plugins.push(this.pluginCallbacks[i](writer));
    }
    writer.setPlugins(plugins);
    writer.write(input, onDone, options).catch(onError);
  }
  parseAsync(input, options) {
    const scope = this;
    return new Promise(function(resolve, reject) {
      scope.parse(input, resolve, reject, options);
    });
  }
}
/**
 * Static utility functions
 */
__publicField(GLTFExporter, "Utils", {
  insertKeyframe: function(track, time) {
    const tolerance = 1e-3;
    const valueSize = track.getValueSize();
    const times = new track.TimeBufferType(track.times.length + 1);
    const values = new track.ValueBufferType(track.values.length + valueSize);
    const interpolant = track.createInterpolant(new track.ValueBufferType(valueSize));
    let index;
    if (track.times.length === 0) {
      times[0] = time;
      for (let i = 0; i < valueSize; i++) {
        values[i] = 0;
      }
      index = 0;
    } else if (time < track.times[0]) {
      if (Math.abs(track.times[0] - time) < tolerance)
        return 0;
      times[0] = time;
      times.set(track.times, 1);
      values.set(interpolant.evaluate(time), 0);
      values.set(track.values, valueSize);
      index = 0;
    } else if (time > track.times[track.times.length - 1]) {
      if (Math.abs(track.times[track.times.length - 1] - time) < tolerance) {
        return track.times.length - 1;
      }
      times[times.length - 1] = time;
      times.set(track.times, 0);
      values.set(track.values, 0);
      values.set(interpolant.evaluate(time), track.values.length);
      index = times.length - 1;
    } else {
      for (let i = 0; i < track.times.length; i++) {
        if (Math.abs(track.times[i] - time) < tolerance)
          return i;
        if (track.times[i] < time && track.times[i + 1] > time) {
          times.set(track.times.slice(0, i + 1), 0);
          times[i + 1] = time;
          times.set(track.times.slice(i + 1), i + 2);
          values.set(track.values.slice(0, (i + 1) * valueSize), 0);
          values.set(interpolant.evaluate(time), (i + 1) * valueSize);
          values.set(track.values.slice((i + 1) * valueSize), (i + 2) * valueSize);
          index = i + 1;
          break;
        }
      }
    }
    track.times = times;
    track.values = values;
    return index;
  },
  mergeMorphTargetTracks: function(clip, root) {
    const tracks = [];
    const mergedTracks = {};
    const sourceTracks = clip.tracks;
    for (let i = 0; i < sourceTracks.length; ++i) {
      let sourceTrack = sourceTracks[i];
      const sourceTrackBinding = THREE.PropertyBinding.parseTrackName(sourceTrack.name);
      const sourceTrackNode = THREE.PropertyBinding.findNode(root, sourceTrackBinding.nodeName);
      if (sourceTrackBinding.propertyName !== "morphTargetInfluences" || sourceTrackBinding.propertyIndex === void 0) {
        tracks.push(sourceTrack);
        continue;
      }
      if (sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodDiscrete && sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodLinear) {
        if (sourceTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline) {
          throw new Error("THREE.GLTFExporter: Cannot merge tracks with glTF CUBICSPLINE interpolation.");
        }
        console.warn("THREE.GLTFExporter: Morph target interpolation mode not yet supported. Using LINEAR instead.");
        sourceTrack = sourceTrack.clone();
        sourceTrack.setInterpolation(THREE.InterpolateLinear);
      }
      const targetCount = sourceTrackNode.morphTargetInfluences.length;
      const targetIndex = sourceTrackNode.morphTargetDictionary[sourceTrackBinding.propertyIndex];
      if (targetIndex === void 0) {
        throw new Error("THREE.GLTFExporter: Morph target name not found: " + sourceTrackBinding.propertyIndex);
      }
      let mergedTrack;
      if (mergedTracks[sourceTrackNode.uuid] === void 0) {
        mergedTrack = sourceTrack.clone();
        const values = new mergedTrack.ValueBufferType(targetCount * mergedTrack.times.length);
        for (let j = 0; j < mergedTrack.times.length; j++) {
          values[j * targetCount + targetIndex] = mergedTrack.values[j];
        }
        mergedTrack.name = (sourceTrackBinding.nodeName || "") + ".morphTargetInfluences";
        mergedTrack.values = values;
        mergedTracks[sourceTrackNode.uuid] = mergedTrack;
        tracks.push(mergedTrack);
        continue;
      }
      const sourceInterpolant = sourceTrack.createInterpolant(new sourceTrack.ValueBufferType(1));
      mergedTrack = mergedTracks[sourceTrackNode.uuid];
      for (let j = 0; j < mergedTrack.times.length; j++) {
        mergedTrack.values[j * targetCount + targetIndex] = sourceInterpolant.evaluate(mergedTrack.times[j]);
      }
      for (let j = 0; j < sourceTrack.times.length; j++) {
        const keyframeIndex = this.insertKeyframe(mergedTrack, sourceTrack.times[j]);
        mergedTrack.values[keyframeIndex * targetCount + targetIndex] = sourceTrack.values[j];
      }
    }
    clip.tracks = tracks;
    return clip;
  }
});
const WEBGL_CONSTANTS = {
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6,
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  INT: 5124,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
  ARRAY_BUFFER: 34962,
  ELEMENT_ARRAY_BUFFER: 34963,
  NEAREST: 9728,
  LINEAR: 9729,
  NEAREST_MIPMAP_NEAREST: 9984,
  LINEAR_MIPMAP_NEAREST: 9985,
  NEAREST_MIPMAP_LINEAR: 9986,
  LINEAR_MIPMAP_LINEAR: 9987,
  CLAMP_TO_EDGE: 33071,
  MIRRORED_REPEAT: 33648,
  REPEAT: 10497
};
const KHR_MESH_QUANTIZATION = "KHR_mesh_quantization";
const THREE_TO_WEBGL = {};
THREE_TO_WEBGL[THREE.NearestFilter] = WEBGL_CONSTANTS.NEAREST;
THREE_TO_WEBGL[THREE.NearestMipmapNearestFilter] = WEBGL_CONSTANTS.NEAREST_MIPMAP_NEAREST;
THREE_TO_WEBGL[THREE.NearestMipmapLinearFilter] = WEBGL_CONSTANTS.NEAREST_MIPMAP_LINEAR;
THREE_TO_WEBGL[THREE.LinearFilter] = WEBGL_CONSTANTS.LINEAR;
THREE_TO_WEBGL[THREE.LinearMipmapNearestFilter] = WEBGL_CONSTANTS.LINEAR_MIPMAP_NEAREST;
THREE_TO_WEBGL[THREE.LinearMipmapLinearFilter] = WEBGL_CONSTANTS.LINEAR_MIPMAP_LINEAR;
THREE_TO_WEBGL[THREE.ClampToEdgeWrapping] = WEBGL_CONSTANTS.CLAMP_TO_EDGE;
THREE_TO_WEBGL[THREE.RepeatWrapping] = WEBGL_CONSTANTS.REPEAT;
THREE_TO_WEBGL[THREE.MirroredRepeatWrapping] = WEBGL_CONSTANTS.MIRRORED_REPEAT;
const PATH_PROPERTIES = {
  scale: "scale",
  position: "translation",
  quaternion: "rotation",
  morphTargetInfluences: "weights"
};
const DEFAULT_SPECULAR_COLOR = new THREE.Color();
const GLB_HEADER_BYTES = 12;
const GLB_HEADER_MAGIC = 1179937895;
const GLB_VERSION = 2;
const GLB_CHUNK_PREFIX_BYTES = 8;
const GLB_CHUNK_TYPE_JSON = 1313821514;
const GLB_CHUNK_TYPE_BIN = 5130562;
function equalArray(array1, array2) {
  return array1.length === array2.length && array1.every(function(element, index) {
    return element === array2[index];
  });
}
function stringToArrayBuffer(text) {
  return new TextEncoder().encode(text).buffer;
}
function isIdentityMatrix(matrix) {
  return equalArray(matrix.elements, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function getMinMax(attribute, start, count) {
  const output = {
    min: new Array(attribute.itemSize).fill(Number.POSITIVE_INFINITY),
    max: new Array(attribute.itemSize).fill(Number.NEGATIVE_INFINITY)
  };
  for (let i = start; i < start + count; i++) {
    for (let a = 0; a < attribute.itemSize; a++) {
      let value;
      if (attribute.itemSize > 4) {
        value = attribute.array[i * attribute.itemSize + a];
      } else {
        if (a === 0)
          value = attribute.getX(i);
        else if (a === 1)
          value = attribute.getY(i);
        else if (a === 2)
          value = attribute.getZ(i);
        else if (a === 3)
          value = attribute.getW(i);
        if (attribute.normalized === true) {
          value = THREE.MathUtils.normalize(value, attribute.array);
        }
      }
      output.min[a] = Math.min(output.min[a], value);
      output.max[a] = Math.max(output.max[a], value);
    }
  }
  return output;
}
function getPaddedBufferSize(bufferSize) {
  return Math.ceil(bufferSize / 4) * 4;
}
function getPaddedArrayBuffer(arrayBuffer, paddingByte = 0) {
  const paddedLength = getPaddedBufferSize(arrayBuffer.byteLength);
  if (paddedLength !== arrayBuffer.byteLength) {
    const array = new Uint8Array(paddedLength);
    array.set(new Uint8Array(arrayBuffer));
    if (paddingByte !== 0) {
      for (let i = arrayBuffer.byteLength; i < paddedLength; i++) {
        array[i] = paddingByte;
      }
    }
    return array.buffer;
  }
  return arrayBuffer;
}
function getCanvas() {
  if (typeof document === "undefined" && typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(1, 1);
  }
  return document.createElement("canvas");
}
function getToBlobPromise(canvas, mimeType) {
  if (canvas.toBlob !== void 0) {
    return new Promise((resolve) => canvas.toBlob(resolve, mimeType));
  }
  let quality;
  if (mimeType === "image/jpeg") {
    quality = 0.92;
  } else if (mimeType === "image/webp") {
    quality = 0.8;
  }
  return canvas.convertToBlob({
    type: mimeType,
    quality
  });
}
class GLTFWriter {
  constructor() {
    this.plugins = [];
    this.options = {};
    this.pending = [];
    this.buffers = [];
    this.byteOffset = 0;
    this.buffers = [];
    this.nodeMap = /* @__PURE__ */ new Map();
    this.skins = [];
    this.extensionsUsed = {};
    this.extensionsRequired = {};
    this.uids = /* @__PURE__ */ new Map();
    this.uid = 0;
    this.json = {
      asset: {
        version: "2.0",
        generator: "THREE.GLTFExporter"
      }
    };
    this.cache = {
      meshes: /* @__PURE__ */ new Map(),
      attributes: /* @__PURE__ */ new Map(),
      attributesNormalized: /* @__PURE__ */ new Map(),
      materials: /* @__PURE__ */ new Map(),
      textures: /* @__PURE__ */ new Map(),
      images: /* @__PURE__ */ new Map()
    };
  }
  setPlugins(plugins) {
    this.plugins = plugins;
  }
  /**
   * Parse scenes and generate GLTF output
   * @param  {Scene or [THREE.Scenes]} input   Scene or Array of THREE.Scenes
   * @param  {Function} onDone  Callback on completed
   * @param  {Object} options options
   */
  async write(input, onDone, options = {}) {
    this.options = Object.assign(
      {
        // default options
        binary: false,
        trs: false,
        onlyVisible: true,
        maxTextureSize: Infinity,
        animations: [],
        includeCustomExtensions: false
      },
      options
    );
    if (this.options.animations.length > 0) {
      this.options.trs = true;
    }
    this.processInput(input);
    await Promise.all(this.pending);
    const writer = this;
    const buffers = writer.buffers;
    const json = writer.json;
    options = writer.options;
    const extensionsUsed = writer.extensionsUsed;
    const extensionsRequired = writer.extensionsRequired;
    const blob = new Blob(buffers, { type: "application/octet-stream" });
    const extensionsUsedList = Object.keys(extensionsUsed);
    const extensionsRequiredList = Object.keys(extensionsRequired);
    if (extensionsUsedList.length > 0)
      json.extensionsUsed = extensionsUsedList;
    if (extensionsRequiredList.length > 0)
      json.extensionsRequired = extensionsRequiredList;
    if (json.buffers && json.buffers.length > 0)
      json.buffers[0].byteLength = blob.size;
    if (options.binary === true) {
      blob.arrayBuffer().then((result) => {
        const binaryChunk = getPaddedArrayBuffer(result);
        const binaryChunkPrefix = new DataView(new ArrayBuffer(GLB_CHUNK_PREFIX_BYTES));
        binaryChunkPrefix.setUint32(0, binaryChunk.byteLength, true);
        binaryChunkPrefix.setUint32(4, GLB_CHUNK_TYPE_BIN, true);
        const jsonChunk = getPaddedArrayBuffer(stringToArrayBuffer(JSON.stringify(json)), 32);
        const jsonChunkPrefix = new DataView(new ArrayBuffer(GLB_CHUNK_PREFIX_BYTES));
        jsonChunkPrefix.setUint32(0, jsonChunk.byteLength, true);
        jsonChunkPrefix.setUint32(4, GLB_CHUNK_TYPE_JSON, true);
        const header = new ArrayBuffer(GLB_HEADER_BYTES);
        const headerView = new DataView(header);
        headerView.setUint32(0, GLB_HEADER_MAGIC, true);
        headerView.setUint32(4, GLB_VERSION, true);
        const totalByteLength = GLB_HEADER_BYTES + jsonChunkPrefix.byteLength + jsonChunk.byteLength + binaryChunkPrefix.byteLength + binaryChunk.byteLength;
        headerView.setUint32(8, totalByteLength, true);
        const glbBlob = new Blob([header, jsonChunkPrefix, jsonChunk, binaryChunkPrefix, binaryChunk], {
          type: "application/octet-stream"
        });
        glbBlob.arrayBuffer().then(onDone);
      });
    } else {
      if (json.buffers && json.buffers.length > 0) {
        readAsDataURL(blob).then((uri) => {
          json.buffers[0].uri = uri;
          onDone(json);
        });
      } else {
        onDone(json);
      }
    }
  }
  /**
   * Serializes a userData.
   *
   * @param {THREE.Object3D|THREE.Material} object
   * @param {Object} objectDef
   */
  serializeUserData(object, objectDef) {
    if (Object.keys(object.userData).length === 0)
      return;
    const options = this.options;
    const extensionsUsed = this.extensionsUsed;
    try {
      const json = JSON.parse(JSON.stringify(object.userData));
      if (options.includeCustomExtensions && json.gltfExtensions) {
        if (objectDef.extensions === void 0)
          objectDef.extensions = {};
        for (const extensionName in json.gltfExtensions) {
          objectDef.extensions[extensionName] = json.gltfExtensions[extensionName];
          extensionsUsed[extensionName] = true;
        }
        delete json.gltfExtensions;
      }
      if (Object.keys(json).length > 0)
        objectDef.extras = json;
    } catch (error) {
      console.warn(
        "THREE.GLTFExporter: userData of '" + object.name + "' won't be serialized because of JSON.stringify error - " + error.message
      );
    }
  }
  /**
   * Returns ids for buffer attributes.
   * @param  {Object} object
   * @return {Integer}
   */
  getUID(attribute, isRelativeCopy = false) {
    if (this.uids.has(attribute) === false) {
      const uids2 = /* @__PURE__ */ new Map();
      uids2.set(true, this.uid++);
      uids2.set(false, this.uid++);
      this.uids.set(attribute, uids2);
    }
    const uids = this.uids.get(attribute);
    return uids.get(isRelativeCopy);
  }
  /**
   * Checks if normal attribute values are normalized.
   *
   * @param {BufferAttribute} normal
   * @returns {Boolean}
   */
  isNormalizedNormalAttribute(normal) {
    const cache = this.cache;
    if (cache.attributesNormalized.has(normal))
      return false;
    const v = new THREE.Vector3();
    for (let i = 0, il = normal.count; i < il; i++) {
      if (Math.abs(v.fromBufferAttribute(normal, i).length() - 1) > 5e-4)
        return false;
    }
    return true;
  }
  /**
   * Creates normalized normal buffer attribute.
   *
   * @param {BufferAttribute} normal
   * @returns {BufferAttribute}
   *
   */
  createNormalizedNormalAttribute(normal) {
    const cache = this.cache;
    if (cache.attributesNormalized.has(normal))
      return cache.attributesNormalized.get(normal);
    const attribute = normal.clone();
    const v = new THREE.Vector3();
    for (let i = 0, il = attribute.count; i < il; i++) {
      v.fromBufferAttribute(attribute, i);
      if (v.x === 0 && v.y === 0 && v.z === 0) {
        v.setX(1);
      } else {
        v.normalize();
      }
      attribute.setXYZ(i, v.x, v.y, v.z);
    }
    cache.attributesNormalized.set(normal, attribute);
    return attribute;
  }
  /**
   * Applies a texture transform, if present, to the map definition. Requires
   * the KHR_texture_transform extension.
   *
   * @param {Object} mapDef
   * @param {THREE.Texture} texture
   */
  applyTextureTransform(mapDef, texture) {
    let didTransform = false;
    const transformDef = {};
    if (texture.offset.x !== 0 || texture.offset.y !== 0) {
      transformDef.offset = texture.offset.toArray();
      didTransform = true;
    }
    if (texture.rotation !== 0) {
      transformDef.rotation = texture.rotation;
      didTransform = true;
    }
    if (texture.repeat.x !== 1 || texture.repeat.y !== 1) {
      transformDef.scale = texture.repeat.toArray();
      didTransform = true;
    }
    if (didTransform) {
      mapDef.extensions = mapDef.extensions || {};
      mapDef.extensions["KHR_texture_transform"] = transformDef;
      this.extensionsUsed["KHR_texture_transform"] = true;
    }
  }
  buildMetalRoughTexture(metalnessMap, roughnessMap) {
    if (metalnessMap === roughnessMap)
      return metalnessMap;
    function getEncodingConversion(map) {
      if ("colorSpace" in map ? map.colorSpace === "srgb" : map.encoding === 3001) {
        return function SRGBToLinear(c) {
          return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
        };
      }
      return function LinearToLinear(c) {
        return c;
      };
    }
    console.warn("THREE.GLTFExporter: Merged metalnessMap and roughnessMap textures.");
    if (metalnessMap instanceof THREE.CompressedTexture) {
      metalnessMap = decompress(metalnessMap);
    }
    if (roughnessMap instanceof THREE.CompressedTexture) {
      roughnessMap = decompress(roughnessMap);
    }
    const metalness = metalnessMap ? metalnessMap.image : null;
    const roughness = roughnessMap ? roughnessMap.image : null;
    const width = Math.max(metalness ? metalness.width : 0, roughness ? roughness.width : 0);
    const height = Math.max(metalness ? metalness.height : 0, roughness ? roughness.height : 0);
    const canvas = getCanvas();
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#00ffff";
    context.fillRect(0, 0, width, height);
    const composite = context.getImageData(0, 0, width, height);
    if (metalness) {
      context.drawImage(metalness, 0, 0, width, height);
      const convert = getEncodingConversion(metalnessMap);
      const data = context.getImageData(0, 0, width, height).data;
      for (let i = 2; i < data.length; i += 4) {
        composite.data[i] = convert(data[i] / 256) * 256;
      }
    }
    if (roughness) {
      context.drawImage(roughness, 0, 0, width, height);
      const convert = getEncodingConversion(roughnessMap);
      const data = context.getImageData(0, 0, width, height).data;
      for (let i = 1; i < data.length; i += 4) {
        composite.data[i] = convert(data[i] / 256) * 256;
      }
    }
    context.putImageData(composite, 0, 0);
    const reference = metalnessMap || roughnessMap;
    const texture = reference.clone();
    texture.source = new THREE.Texture(canvas).source;
    if ("colorSpace" in texture)
      texture.colorSpace = "";
    else
      texture.encoding = 3e3;
    texture.channel = (metalnessMap || roughnessMap).channel;
    if (metalnessMap && roughnessMap && metalnessMap.channel !== roughnessMap.channel) {
      console.warn("THREE.GLTFExporter: UV channels for metalnessMap and roughnessMap textures must match.");
    }
    return texture;
  }
  /**
   * Process a buffer to append to the default one.
   * @param  {ArrayBuffer} buffer
   * @return {Integer}
   */
  processBuffer(buffer) {
    const json = this.json;
    const buffers = this.buffers;
    if (!json.buffers)
      json.buffers = [{ byteLength: 0 }];
    buffers.push(buffer);
    return 0;
  }
  /**
   * Process and generate a BufferView
   * @param  {BufferAttribute} attribute
   * @param  {number} componentType
   * @param  {number} start
   * @param  {number} count
   * @param  {number} target (Optional) Target usage of the BufferView
   * @return {Object}
   */
  processBufferView(attribute, componentType, start, count, target) {
    const json = this.json;
    if (!json.bufferViews)
      json.bufferViews = [];
    let componentSize;
    switch (componentType) {
      case WEBGL_CONSTANTS.BYTE:
      case WEBGL_CONSTANTS.UNSIGNED_BYTE:
        componentSize = 1;
        break;
      case WEBGL_CONSTANTS.SHORT:
      case WEBGL_CONSTANTS.UNSIGNED_SHORT:
        componentSize = 2;
        break;
      default:
        componentSize = 4;
    }
    const byteLength = getPaddedBufferSize(count * attribute.itemSize * componentSize);
    const dataView = new DataView(new ArrayBuffer(byteLength));
    let offset = 0;
    for (let i = start; i < start + count; i++) {
      for (let a = 0; a < attribute.itemSize; a++) {
        let value;
        if (attribute.itemSize > 4) {
          value = attribute.array[i * attribute.itemSize + a];
        } else {
          if (a === 0)
            value = attribute.getX(i);
          else if (a === 1)
            value = attribute.getY(i);
          else if (a === 2)
            value = attribute.getZ(i);
          else if (a === 3)
            value = attribute.getW(i);
          if (attribute.normalized === true) {
            value = THREE.MathUtils.normalize(value, attribute.array);
          }
        }
        if (componentType === WEBGL_CONSTANTS.FLOAT) {
          dataView.setFloat32(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.INT) {
          dataView.setInt32(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_INT) {
          dataView.setUint32(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.SHORT) {
          dataView.setInt16(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT) {
          dataView.setUint16(offset, value, true);
        } else if (componentType === WEBGL_CONSTANTS.BYTE) {
          dataView.setInt8(offset, value);
        } else if (componentType === WEBGL_CONSTANTS.UNSIGNED_BYTE) {
          dataView.setUint8(offset, value);
        }
        offset += componentSize;
      }
    }
    const bufferViewDef = {
      buffer: this.processBuffer(dataView.buffer),
      byteOffset: this.byteOffset,
      byteLength
    };
    if (target !== void 0)
      bufferViewDef.target = target;
    if (target === WEBGL_CONSTANTS.ARRAY_BUFFER) {
      bufferViewDef.byteStride = attribute.itemSize * componentSize;
    }
    this.byteOffset += byteLength;
    json.bufferViews.push(bufferViewDef);
    const output = {
      id: json.bufferViews.length - 1,
      byteLength: 0
    };
    return output;
  }
  /**
   * Process and generate a BufferView from an image Blob.
   * @param {Blob} blob
   * @return {Promise<Integer>}
   */
  processBufferViewImage(blob) {
    const writer = this;
    const json = writer.json;
    if (!json.bufferViews)
      json.bufferViews = [];
    return blob.arrayBuffer().then((result) => {
      const buffer = getPaddedArrayBuffer(result);
      const bufferViewDef = {
        buffer: writer.processBuffer(buffer),
        byteOffset: writer.byteOffset,
        byteLength: buffer.byteLength
      };
      writer.byteOffset += buffer.byteLength;
      return json.bufferViews.push(bufferViewDef) - 1;
    });
  }
  /**
   * Process attribute to generate an accessor
   * @param  {BufferAttribute} attribute Attribute to process
   * @param  {THREE.BufferGeometry} geometry (Optional) Geometry used for truncated draw range
   * @param  {Integer} start (Optional)
   * @param  {Integer} count (Optional)
   * @return {Integer|null} Index of the processed accessor on the "accessors" array
   */
  processAccessor(attribute, geometry, start, count) {
    const json = this.json;
    const types = {
      1: "SCALAR",
      2: "VEC2",
      3: "VEC3",
      4: "VEC4",
      9: "MAT3",
      16: "MAT4"
    };
    let componentType;
    if (attribute.array.constructor === Float32Array) {
      componentType = WEBGL_CONSTANTS.FLOAT;
    } else if (attribute.array.constructor === Int32Array) {
      componentType = WEBGL_CONSTANTS.INT;
    } else if (attribute.array.constructor === Uint32Array) {
      componentType = WEBGL_CONSTANTS.UNSIGNED_INT;
    } else if (attribute.array.constructor === Int16Array) {
      componentType = WEBGL_CONSTANTS.SHORT;
    } else if (attribute.array.constructor === Uint16Array) {
      componentType = WEBGL_CONSTANTS.UNSIGNED_SHORT;
    } else if (attribute.array.constructor === Int8Array) {
      componentType = WEBGL_CONSTANTS.BYTE;
    } else if (attribute.array.constructor === Uint8Array) {
      componentType = WEBGL_CONSTANTS.UNSIGNED_BYTE;
    } else {
      throw new Error(
        "THREE.GLTFExporter: Unsupported bufferAttribute component type: " + attribute.array.constructor.name
      );
    }
    if (start === void 0)
      start = 0;
    if (count === void 0)
      count = attribute.count;
    if (count === 0)
      return null;
    const minMax = getMinMax(attribute, start, count);
    let bufferViewTarget;
    if (geometry !== void 0) {
      bufferViewTarget = attribute === geometry.index ? WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER : WEBGL_CONSTANTS.ARRAY_BUFFER;
    }
    const bufferView = this.processBufferView(attribute, componentType, start, count, bufferViewTarget);
    const accessorDef = {
      bufferView: bufferView.id,
      byteOffset: bufferView.byteOffset,
      componentType,
      count,
      max: minMax.max,
      min: minMax.min,
      type: types[attribute.itemSize]
    };
    if (attribute.normalized === true)
      accessorDef.normalized = true;
    if (!json.accessors)
      json.accessors = [];
    return json.accessors.push(accessorDef) - 1;
  }
  /**
   * Process image
   * @param  {Image} image to process
   * @param  {Integer} format of the image (RGBAFormat)
   * @param  {Boolean} flipY before writing out the image
   * @param  {String} mimeType export format
   * @return {Integer}     Index of the processed texture in the "images" array
   */
  processImage(image, format, flipY, mimeType = "image/png") {
    if (image !== null) {
      const writer = this;
      const cache = writer.cache;
      const json = writer.json;
      const options = writer.options;
      const pending = writer.pending;
      if (!cache.images.has(image))
        cache.images.set(image, {});
      const cachedImages = cache.images.get(image);
      const key = mimeType + ":flipY/" + flipY.toString();
      if (cachedImages[key] !== void 0)
        return cachedImages[key];
      if (!json.images)
        json.images = [];
      const imageDef = { mimeType };
      const canvas = getCanvas();
      canvas.width = Math.min(image.width, options.maxTextureSize);
      canvas.height = Math.min(image.height, options.maxTextureSize);
      const ctx = canvas.getContext("2d");
      if (flipY === true) {
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
      }
      if (image.data !== void 0) {
        if (format !== THREE.RGBAFormat) {
          console.error("GLTFExporter: Only RGBAFormat is supported.", format);
        }
        if (image.width > options.maxTextureSize || image.height > options.maxTextureSize) {
          console.warn("GLTFExporter: Image size is bigger than maxTextureSize", image);
        }
        const data = new Uint8ClampedArray(image.height * image.width * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i + 0] = image.data[i + 0];
          data[i + 1] = image.data[i + 1];
          data[i + 2] = image.data[i + 2];
          data[i + 3] = image.data[i + 3];
        }
        ctx.putImageData(new ImageData(data, image.width, image.height), 0, 0);
      } else {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      if (options.binary === true) {
        pending.push(
          getToBlobPromise(canvas, mimeType).then((blob) => writer.processBufferViewImage(blob)).then((bufferViewIndex) => {
            imageDef.bufferView = bufferViewIndex;
          })
        );
      } else {
        if (canvas.toDataURL !== void 0) {
          imageDef.uri = canvas.toDataURL(mimeType);
        } else {
          pending.push(
            getToBlobPromise(canvas, mimeType).then(readAsDataURL).then((uri) => {
              imageDef.uri = uri;
            })
          );
        }
      }
      const index = json.images.push(imageDef) - 1;
      cachedImages[key] = index;
      return index;
    } else {
      throw new Error("THREE.GLTFExporter: No valid image data found. Unable to process texture.");
    }
  }
  /**
   * Process sampler
   * @param  {Texture} map Texture to process
   * @return {Integer}     Index of the processed texture in the "samplers" array
   */
  processSampler(map) {
    const json = this.json;
    if (!json.samplers)
      json.samplers = [];
    const samplerDef = {
      magFilter: THREE_TO_WEBGL[map.magFilter],
      minFilter: THREE_TO_WEBGL[map.minFilter],
      wrapS: THREE_TO_WEBGL[map.wrapS],
      wrapT: THREE_TO_WEBGL[map.wrapT]
    };
    return json.samplers.push(samplerDef) - 1;
  }
  /**
   * Process texture
   * @param  {Texture} map Map to process
   * @return {Integer} Index of the processed texture in the "textures" array
   */
  processTexture(map) {
    const writer = this;
    const options = writer.options;
    const cache = this.cache;
    const json = this.json;
    if (cache.textures.has(map))
      return cache.textures.get(map);
    if (!json.textures)
      json.textures = [];
    if (map instanceof THREE.CompressedTexture) {
      map = decompress(map, options.maxTextureSize);
    }
    let mimeType = map.userData.mimeType;
    if (mimeType === "image/webp")
      mimeType = "image/png";
    const textureDef = {
      sampler: this.processSampler(map),
      source: this.processImage(map.image, map.format, map.flipY, mimeType)
    };
    if (map.name)
      textureDef.name = map.name;
    this._invokeAll(function(ext) {
      ext.writeTexture && ext.writeTexture(map, textureDef);
    });
    const index = json.textures.push(textureDef) - 1;
    cache.textures.set(map, index);
    return index;
  }
  /**
   * Process material
   * @param  {THREE.Material} material Material to process
   * @return {Integer|null} Index of the processed material in the "materials" array
   */
  processMaterial(material) {
    const cache = this.cache;
    const json = this.json;
    if (cache.materials.has(material))
      return cache.materials.get(material);
    if (material.isShaderMaterial) {
      console.warn("GLTFExporter: THREE.ShaderMaterial not supported.");
      return null;
    }
    if (!json.materials)
      json.materials = [];
    const materialDef = { pbrMetallicRoughness: {} };
    if (material.isMeshStandardMaterial !== true && material.isMeshBasicMaterial !== true) {
      console.warn("GLTFExporter: Use MeshStandardMaterial or MeshBasicMaterial for best results.");
    }
    const color = material.color.toArray().concat([material.opacity]);
    if (!equalArray(color, [1, 1, 1, 1])) {
      materialDef.pbrMetallicRoughness.baseColorFactor = color;
    }
    if (material.isMeshStandardMaterial) {
      materialDef.pbrMetallicRoughness.metallicFactor = material.metalness;
      materialDef.pbrMetallicRoughness.roughnessFactor = material.roughness;
    } else {
      materialDef.pbrMetallicRoughness.metallicFactor = 0.5;
      materialDef.pbrMetallicRoughness.roughnessFactor = 0.5;
    }
    if (material.metalnessMap || material.roughnessMap) {
      const metalRoughTexture = this.buildMetalRoughTexture(material.metalnessMap, material.roughnessMap);
      const metalRoughMapDef = {
        index: this.processTexture(metalRoughTexture),
        channel: metalRoughTexture.channel
      };
      this.applyTextureTransform(metalRoughMapDef, metalRoughTexture);
      materialDef.pbrMetallicRoughness.metallicRoughnessTexture = metalRoughMapDef;
    }
    if (material.map) {
      const baseColorMapDef = {
        index: this.processTexture(material.map),
        texCoord: material.map.channel
      };
      this.applyTextureTransform(baseColorMapDef, material.map);
      materialDef.pbrMetallicRoughness.baseColorTexture = baseColorMapDef;
    }
    if (material.emissive) {
      const emissive = material.emissive;
      const maxEmissiveComponent = Math.max(emissive.r, emissive.g, emissive.b);
      if (maxEmissiveComponent > 0) {
        materialDef.emissiveFactor = material.emissive.toArray();
      }
      if (material.emissiveMap) {
        const emissiveMapDef = {
          index: this.processTexture(material.emissiveMap),
          texCoord: material.emissiveMap.channel
        };
        this.applyTextureTransform(emissiveMapDef, material.emissiveMap);
        materialDef.emissiveTexture = emissiveMapDef;
      }
    }
    if (material.normalMap) {
      const normalMapDef = {
        index: this.processTexture(material.normalMap),
        texCoord: material.normalMap.channel
      };
      if (material.normalScale && material.normalScale.x !== 1) {
        normalMapDef.scale = material.normalScale.x;
      }
      this.applyTextureTransform(normalMapDef, material.normalMap);
      materialDef.normalTexture = normalMapDef;
    }
    if (material.aoMap) {
      const occlusionMapDef = {
        index: this.processTexture(material.aoMap),
        texCoord: material.aoMap.channel
      };
      if (material.aoMapIntensity !== 1) {
        occlusionMapDef.strength = material.aoMapIntensity;
      }
      this.applyTextureTransform(occlusionMapDef, material.aoMap);
      materialDef.occlusionTexture = occlusionMapDef;
    }
    if (material.transparent) {
      materialDef.alphaMode = "BLEND";
    } else {
      if (material.alphaTest > 0) {
        materialDef.alphaMode = "MASK";
        materialDef.alphaCutoff = material.alphaTest;
      }
    }
    if (material.side === THREE.DoubleSide)
      materialDef.doubleSided = true;
    if (material.name !== "")
      materialDef.name = material.name;
    this.serializeUserData(material, materialDef);
    this._invokeAll(function(ext) {
      ext.writeMaterial && ext.writeMaterial(material, materialDef);
    });
    const index = json.materials.push(materialDef) - 1;
    cache.materials.set(material, index);
    return index;
  }
  /**
   * Process mesh
   * @param  {THREE.Mesh} mesh Mesh to process
   * @return {Integer|null} Index of the processed mesh in the "meshes" array
   */
  processMesh(mesh) {
    const cache = this.cache;
    const json = this.json;
    const meshCacheKeyParts = [mesh.geometry.uuid];
    if (Array.isArray(mesh.material)) {
      for (let i = 0, l = mesh.material.length; i < l; i++) {
        meshCacheKeyParts.push(mesh.material[i].uuid);
      }
    } else {
      meshCacheKeyParts.push(mesh.material.uuid);
    }
    const meshCacheKey = meshCacheKeyParts.join(":");
    if (cache.meshes.has(meshCacheKey))
      return cache.meshes.get(meshCacheKey);
    const geometry = mesh.geometry;
    let mode;
    if (mesh.isLineSegments) {
      mode = WEBGL_CONSTANTS.LINES;
    } else if (mesh.isLineLoop) {
      mode = WEBGL_CONSTANTS.LINE_LOOP;
    } else if (mesh.isLine) {
      mode = WEBGL_CONSTANTS.LINE_STRIP;
    } else if (mesh.isPoints) {
      mode = WEBGL_CONSTANTS.POINTS;
    } else {
      mode = mesh.material.wireframe ? WEBGL_CONSTANTS.LINES : WEBGL_CONSTANTS.TRIANGLES;
    }
    const meshDef = {};
    const attributes = {};
    const primitives = [];
    const targets = [];
    const nameConversion = {
      ...constants.version >= 152 ? {
        uv: "TEXCOORD_0",
        uv1: "TEXCOORD_1",
        uv2: "TEXCOORD_2",
        uv3: "TEXCOORD_3"
      } : {
        uv: "TEXCOORD_0",
        uv2: "TEXCOORD_1"
      },
      color: "COLOR_0",
      skinWeight: "WEIGHTS_0",
      skinIndex: "JOINTS_0"
    };
    const originalNormal = geometry.getAttribute("normal");
    if (originalNormal !== void 0 && !this.isNormalizedNormalAttribute(originalNormal)) {
      console.warn("THREE.GLTFExporter: Creating normalized normal attribute from the non-normalized one.");
      geometry.setAttribute("normal", this.createNormalizedNormalAttribute(originalNormal));
    }
    let modifiedAttribute = null;
    for (let attributeName in geometry.attributes) {
      if (attributeName.slice(0, 5) === "morph")
        continue;
      const attribute = geometry.attributes[attributeName];
      attributeName = nameConversion[attributeName] || attributeName.toUpperCase();
      const validVertexAttributes = /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+|COLOR_\d+|JOINTS_\d+|WEIGHTS_\d+)$/;
      if (!validVertexAttributes.test(attributeName))
        attributeName = "_" + attributeName;
      if (cache.attributes.has(this.getUID(attribute))) {
        attributes[attributeName] = cache.attributes.get(this.getUID(attribute));
        continue;
      }
      modifiedAttribute = null;
      const array = attribute.array;
      if (attributeName === "JOINTS_0" && !(array instanceof Uint16Array) && !(array instanceof Uint8Array)) {
        console.warn('GLTFExporter: Attribute "skinIndex" converted to type UNSIGNED_SHORT.');
        modifiedAttribute = new THREE.BufferAttribute(new Uint16Array(array), attribute.itemSize, attribute.normalized);
      }
      const accessor = this.processAccessor(modifiedAttribute || attribute, geometry);
      if (accessor !== null) {
        if (!attributeName.startsWith("_")) {
          this.detectMeshQuantization(attributeName, attribute);
        }
        attributes[attributeName] = accessor;
        cache.attributes.set(this.getUID(attribute), accessor);
      }
    }
    if (originalNormal !== void 0)
      geometry.setAttribute("normal", originalNormal);
    if (Object.keys(attributes).length === 0)
      return null;
    if (mesh.morphTargetInfluences !== void 0 && mesh.morphTargetInfluences.length > 0) {
      const weights = [];
      const targetNames = [];
      const reverseDictionary = {};
      if (mesh.morphTargetDictionary !== void 0) {
        for (const key in mesh.morphTargetDictionary) {
          reverseDictionary[mesh.morphTargetDictionary[key]] = key;
        }
      }
      for (let i = 0; i < mesh.morphTargetInfluences.length; ++i) {
        const target = {};
        let warned = false;
        for (const attributeName in geometry.morphAttributes) {
          if (attributeName !== "position" && attributeName !== "normal") {
            if (!warned) {
              console.warn("GLTFExporter: Only POSITION and NORMAL morph are supported.");
              warned = true;
            }
            continue;
          }
          const attribute = geometry.morphAttributes[attributeName][i];
          const gltfAttributeName = attributeName.toUpperCase();
          const baseAttribute = geometry.attributes[attributeName];
          if (cache.attributes.has(this.getUID(attribute, true))) {
            target[gltfAttributeName] = cache.attributes.get(this.getUID(attribute, true));
            continue;
          }
          const relativeAttribute = attribute.clone();
          if (!geometry.morphTargetsRelative) {
            for (let j = 0, jl = attribute.count; j < jl; j++) {
              for (let a = 0; a < attribute.itemSize; a++) {
                if (a === 0)
                  relativeAttribute.setX(j, attribute.getX(j) - baseAttribute.getX(j));
                if (a === 1)
                  relativeAttribute.setY(j, attribute.getY(j) - baseAttribute.getY(j));
                if (a === 2)
                  relativeAttribute.setZ(j, attribute.getZ(j) - baseAttribute.getZ(j));
                if (a === 3)
                  relativeAttribute.setW(j, attribute.getW(j) - baseAttribute.getW(j));
              }
            }
          }
          target[gltfAttributeName] = this.processAccessor(relativeAttribute, geometry);
          cache.attributes.set(this.getUID(baseAttribute, true), target[gltfAttributeName]);
        }
        targets.push(target);
        weights.push(mesh.morphTargetInfluences[i]);
        if (mesh.morphTargetDictionary !== void 0)
          targetNames.push(reverseDictionary[i]);
      }
      meshDef.weights = weights;
      if (targetNames.length > 0) {
        meshDef.extras = {};
        meshDef.extras.targetNames = targetNames;
      }
    }
    const isMultiMaterial = Array.isArray(mesh.material);
    if (isMultiMaterial && geometry.groups.length === 0)
      return null;
    const materials = isMultiMaterial ? mesh.material : [mesh.material];
    const groups = isMultiMaterial ? geometry.groups : [{ materialIndex: 0, start: void 0, count: void 0 }];
    for (let i = 0, il = groups.length; i < il; i++) {
      const primitive = {
        mode,
        attributes
      };
      this.serializeUserData(geometry, primitive);
      if (targets.length > 0)
        primitive.targets = targets;
      if (geometry.index !== null) {
        let cacheKey = this.getUID(geometry.index);
        if (groups[i].start !== void 0 || groups[i].count !== void 0) {
          cacheKey += ":" + groups[i].start + ":" + groups[i].count;
        }
        if (cache.attributes.has(cacheKey)) {
          primitive.indices = cache.attributes.get(cacheKey);
        } else {
          primitive.indices = this.processAccessor(geometry.index, geometry, groups[i].start, groups[i].count);
          cache.attributes.set(cacheKey, primitive.indices);
        }
        if (primitive.indices === null)
          delete primitive.indices;
      }
      const material = this.processMaterial(materials[groups[i].materialIndex]);
      if (material !== null)
        primitive.material = material;
      primitives.push(primitive);
    }
    meshDef.primitives = primitives;
    if (!json.meshes)
      json.meshes = [];
    this._invokeAll(function(ext) {
      ext.writeMesh && ext.writeMesh(mesh, meshDef);
    });
    const index = json.meshes.push(meshDef) - 1;
    cache.meshes.set(meshCacheKey, index);
    return index;
  }
  /**
   * If a vertex attribute with a
   * [non-standard data type](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes-overview)
   * is used, it is checked whether it is a valid data type according to the
   * [KHR_mesh_quantization](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_mesh_quantization/README.md)
   * extension.
   * In this case the extension is automatically added to the list of used extensions.
   *
   * @param {string} attributeName
   * @param {THREE.BufferAttribute} attribute
   */
  detectMeshQuantization(attributeName, attribute) {
    if (this.extensionsUsed[KHR_MESH_QUANTIZATION])
      return;
    let attrType = void 0;
    switch (attribute.array.constructor) {
      case Int8Array:
        attrType = "byte";
        break;
      case Uint8Array:
        attrType = "unsigned byte";
        break;
      case Int16Array:
        attrType = "short";
        break;
      case Uint16Array:
        attrType = "unsigned short";
        break;
      default:
        return;
    }
    if (attribute.normalized)
      attrType += " normalized";
    const attrNamePrefix = attributeName.split("_", 1)[0];
    if (KHR_mesh_quantization_ExtraAttrTypes[attrNamePrefix] && KHR_mesh_quantization_ExtraAttrTypes[attrNamePrefix].includes(attrType)) {
      this.extensionsUsed[KHR_MESH_QUANTIZATION] = true;
      this.extensionsRequired[KHR_MESH_QUANTIZATION] = true;
    }
  }
  /**
   * Process camera
   * @param  {THREE.Camera} camera Camera to process
   * @return {Integer}      Index of the processed mesh in the "camera" array
   */
  processCamera(camera) {
    const json = this.json;
    if (!json.cameras)
      json.cameras = [];
    const isOrtho = camera.isOrthographicCamera;
    const cameraDef = {
      type: isOrtho ? "orthographic" : "perspective"
    };
    if (isOrtho) {
      cameraDef.orthographic = {
        xmag: camera.right * 2,
        ymag: camera.top * 2,
        zfar: camera.far <= 0 ? 1e-3 : camera.far,
        znear: camera.near < 0 ? 0 : camera.near
      };
    } else {
      cameraDef.perspective = {
        aspectRatio: camera.aspect,
        yfov: THREE.MathUtils.degToRad(camera.fov),
        zfar: camera.far <= 0 ? 1e-3 : camera.far,
        znear: camera.near < 0 ? 0 : camera.near
      };
    }
    if (camera.name !== "")
      cameraDef.name = camera.type;
    return json.cameras.push(cameraDef) - 1;
  }
  /**
   * Creates glTF animation entry from AnimationClip object.
   *
   * Status:
   * - Only properties listed in PATH_PROPERTIES may be animated.
   *
   * @param {THREE.AnimationClip} clip
   * @param {THREE.Object3D} root
   * @return {number|null}
   */
  processAnimation(clip, root) {
    const json = this.json;
    const nodeMap = this.nodeMap;
    if (!json.animations)
      json.animations = [];
    clip = GLTFExporter.Utils.mergeMorphTargetTracks(clip.clone(), root);
    const tracks = clip.tracks;
    const channels = [];
    const samplers = [];
    for (let i = 0; i < tracks.length; ++i) {
      const track = tracks[i];
      const trackBinding = THREE.PropertyBinding.parseTrackName(track.name);
      let trackNode = THREE.PropertyBinding.findNode(root, trackBinding.nodeName);
      const trackProperty = PATH_PROPERTIES[trackBinding.propertyName];
      if (trackBinding.objectName === "bones") {
        if (trackNode.isSkinnedMesh === true) {
          trackNode = trackNode.skeleton.getBoneByName(trackBinding.objectIndex);
        } else {
          trackNode = void 0;
        }
      }
      if (!trackNode || !trackProperty) {
        console.warn('THREE.GLTFExporter: Could not export animation track "%s".', track.name);
        return null;
      }
      const inputItemSize = 1;
      let outputItemSize = track.values.length / track.times.length;
      if (trackProperty === PATH_PROPERTIES.morphTargetInfluences) {
        outputItemSize /= trackNode.morphTargetInfluences.length;
      }
      let interpolation;
      if (track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline === true) {
        interpolation = "CUBICSPLINE";
        outputItemSize /= 3;
      } else if (track.getInterpolation() === THREE.InterpolateDiscrete) {
        interpolation = "STEP";
      } else {
        interpolation = "LINEAR";
      }
      samplers.push({
        input: this.processAccessor(new THREE.BufferAttribute(track.times, inputItemSize)),
        output: this.processAccessor(new THREE.BufferAttribute(track.values, outputItemSize)),
        interpolation
      });
      channels.push({
        sampler: samplers.length - 1,
        target: {
          node: nodeMap.get(trackNode),
          path: trackProperty
        }
      });
    }
    json.animations.push({
      name: clip.name || "clip_" + json.animations.length,
      samplers,
      channels
    });
    return json.animations.length - 1;
  }
  /**
   * @param {THREE.Object3D} object
   * @return {number|null}
   */
  processSkin(object) {
    const json = this.json;
    const nodeMap = this.nodeMap;
    const node = json.nodes[nodeMap.get(object)];
    const skeleton = object.skeleton;
    if (skeleton === void 0)
      return null;
    const rootJoint = object.skeleton.bones[0];
    if (rootJoint === void 0)
      return null;
    const joints = [];
    const inverseBindMatrices = new Float32Array(skeleton.bones.length * 16);
    const temporaryBoneInverse = new THREE.Matrix4();
    for (let i = 0; i < skeleton.bones.length; ++i) {
      joints.push(nodeMap.get(skeleton.bones[i]));
      temporaryBoneInverse.copy(skeleton.boneInverses[i]);
      temporaryBoneInverse.multiply(object.bindMatrix).toArray(inverseBindMatrices, i * 16);
    }
    if (json.skins === void 0)
      json.skins = [];
    json.skins.push({
      inverseBindMatrices: this.processAccessor(new THREE.BufferAttribute(inverseBindMatrices, 16)),
      joints,
      skeleton: nodeMap.get(rootJoint)
    });
    const skinIndex = node.skin = json.skins.length - 1;
    return skinIndex;
  }
  /**
   * Process Object3D node
   * @param  {THREE.Object3D} node Object3D to processNode
   * @return {Integer} Index of the node in the nodes list
   */
  processNode(object) {
    const json = this.json;
    const options = this.options;
    const nodeMap = this.nodeMap;
    if (!json.nodes)
      json.nodes = [];
    const nodeDef = {};
    if (options.trs) {
      const rotation = object.quaternion.toArray();
      const position = object.position.toArray();
      const scale = object.scale.toArray();
      if (!equalArray(rotation, [0, 0, 0, 1])) {
        nodeDef.rotation = rotation;
      }
      if (!equalArray(position, [0, 0, 0])) {
        nodeDef.translation = position;
      }
      if (!equalArray(scale, [1, 1, 1])) {
        nodeDef.scale = scale;
      }
    } else {
      if (object.matrixAutoUpdate) {
        object.updateMatrix();
      }
      if (isIdentityMatrix(object.matrix) === false) {
        nodeDef.matrix = object.matrix.elements;
      }
    }
    if (object.name !== "")
      nodeDef.name = String(object.name);
    this.serializeUserData(object, nodeDef);
    if (object.isMesh || object.isLine || object.isPoints) {
      const meshIndex = this.processMesh(object);
      if (meshIndex !== null)
        nodeDef.mesh = meshIndex;
    } else if (object.isCamera) {
      nodeDef.camera = this.processCamera(object);
    }
    if (object.isSkinnedMesh)
      this.skins.push(object);
    if (object.children.length > 0) {
      const children = [];
      for (let i = 0, l = object.children.length; i < l; i++) {
        const child = object.children[i];
        if (child.visible || options.onlyVisible === false) {
          const nodeIndex2 = this.processNode(child);
          if (nodeIndex2 !== null)
            children.push(nodeIndex2);
        }
      }
      if (children.length > 0)
        nodeDef.children = children;
    }
    this._invokeAll(function(ext) {
      ext.writeNode && ext.writeNode(object, nodeDef);
    });
    const nodeIndex = json.nodes.push(nodeDef) - 1;
    nodeMap.set(object, nodeIndex);
    return nodeIndex;
  }
  /**
   * Process Scene
   * @param  {Scene} node Scene to process
   */
  processScene(scene) {
    const json = this.json;
    const options = this.options;
    if (!json.scenes) {
      json.scenes = [];
      json.scene = 0;
    }
    const sceneDef = {};
    if (scene.name !== "")
      sceneDef.name = scene.name;
    json.scenes.push(sceneDef);
    const nodes = [];
    for (let i = 0, l = scene.children.length; i < l; i++) {
      const child = scene.children[i];
      if (child.visible || options.onlyVisible === false) {
        const nodeIndex = this.processNode(child);
        if (nodeIndex !== null)
          nodes.push(nodeIndex);
      }
    }
    if (nodes.length > 0)
      sceneDef.nodes = nodes;
    this.serializeUserData(scene, sceneDef);
  }
  /**
   * Creates a Scene to hold a list of objects and parse it
   * @param  {Array} objects List of objects to process
   */
  processObjects(objects) {
    const scene = new THREE.Scene();
    scene.name = "AuxScene";
    for (let i = 0; i < objects.length; i++) {
      scene.children.push(objects[i]);
    }
    this.processScene(scene);
  }
  /**
   * @param {THREE.Object3D|Array<THREE.Object3D>} input
   */
  processInput(input) {
    const options = this.options;
    input = input instanceof Array ? input : [input];
    this._invokeAll(function(ext) {
      ext.beforeParse && ext.beforeParse(input);
    });
    const objectsWithoutScene = [];
    for (let i = 0; i < input.length; i++) {
      if (input[i] instanceof THREE.Scene) {
        this.processScene(input[i]);
      } else {
        objectsWithoutScene.push(input[i]);
      }
    }
    if (objectsWithoutScene.length > 0)
      this.processObjects(objectsWithoutScene);
    for (let i = 0; i < this.skins.length; ++i) {
      this.processSkin(this.skins[i]);
    }
    for (let i = 0; i < options.animations.length; ++i) {
      this.processAnimation(options.animations[i], input[0]);
    }
    this._invokeAll(function(ext) {
      ext.afterParse && ext.afterParse(input);
    });
  }
  _invokeAll(func) {
    for (let i = 0, il = this.plugins.length; i < il; i++) {
      func(this.plugins[i]);
    }
  }
}
class GLTFLightExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_lights_punctual";
  }
  writeNode(light, nodeDef) {
    if (!light.isLight)
      return;
    if (!light.isDirectionalLight && !light.isPointLight && !light.isSpotLight) {
      console.warn("THREE.GLTFExporter: Only directional, point, and spot lights are supported.", light);
      return;
    }
    const writer = this.writer;
    const json = writer.json;
    const extensionsUsed = writer.extensionsUsed;
    const lightDef = {};
    if (light.name)
      lightDef.name = light.name;
    lightDef.color = light.color.toArray();
    lightDef.intensity = light.intensity;
    if (light.isDirectionalLight) {
      lightDef.type = "directional";
    } else if (light.isPointLight) {
      lightDef.type = "point";
      if (light.distance > 0)
        lightDef.range = light.distance;
    } else if (light.isSpotLight) {
      lightDef.type = "spot";
      if (light.distance > 0)
        lightDef.range = light.distance;
      lightDef.spot = {};
      lightDef.spot.innerConeAngle = (light.penumbra - 1) * light.angle * -1;
      lightDef.spot.outerConeAngle = light.angle;
    }
    if (light.decay !== void 0 && light.decay !== 2) {
      console.warn(
        "THREE.GLTFExporter: Light decay may be lost. glTF is physically-based, and expects light.decay=2."
      );
    }
    if (light.target && (light.target.parent !== light || light.target.position.x !== 0 || light.target.position.y !== 0 || light.target.position.z !== -1)) {
      console.warn(
        "THREE.GLTFExporter: Light direction may be lost. For best results, make light.target a child of the light with position 0,0,-1."
      );
    }
    if (!extensionsUsed[this.name]) {
      json.extensions = json.extensions || {};
      json.extensions[this.name] = { lights: [] };
      extensionsUsed[this.name] = true;
    }
    const lights = json.extensions[this.name].lights;
    lights.push(lightDef);
    nodeDef.extensions = nodeDef.extensions || {};
    nodeDef.extensions[this.name] = { light: lights.length - 1 };
  }
}
class GLTFMaterialsUnlitExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_unlit";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshBasicMaterial)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = {};
    extensionsUsed[this.name] = true;
    materialDef.pbrMetallicRoughness.metallicFactor = 0;
    materialDef.pbrMetallicRoughness.roughnessFactor = 0.9;
  }
}
class GLTFMaterialsClearcoatExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_clearcoat";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshPhysicalMaterial || material.clearcoat === 0)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    extensionDef.clearcoatFactor = material.clearcoat;
    if (material.clearcoatMap) {
      const clearcoatMapDef = {
        index: writer.processTexture(material.clearcoatMap),
        texCoord: material.clearcoatMap.channel
      };
      writer.applyTextureTransform(clearcoatMapDef, material.clearcoatMap);
      extensionDef.clearcoatTexture = clearcoatMapDef;
    }
    extensionDef.clearcoatRoughnessFactor = material.clearcoatRoughness;
    if (material.clearcoatRoughnessMap) {
      const clearcoatRoughnessMapDef = {
        index: writer.processTexture(material.clearcoatRoughnessMap),
        texCoord: material.clearcoatRoughnessMap.channel
      };
      writer.applyTextureTransform(clearcoatRoughnessMapDef, material.clearcoatRoughnessMap);
      extensionDef.clearcoatRoughnessTexture = clearcoatRoughnessMapDef;
    }
    if (material.clearcoatNormalMap) {
      const clearcoatNormalMapDef = {
        index: writer.processTexture(material.clearcoatNormalMap),
        texCoord: material.clearcoatNormalMap.channel
      };
      writer.applyTextureTransform(clearcoatNormalMapDef, material.clearcoatNormalMap);
      extensionDef.clearcoatNormalTexture = clearcoatNormalMapDef;
    }
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
class GLTFMaterialsIridescenceExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_iridescence";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshPhysicalMaterial || material.iridescence === 0)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    extensionDef.iridescenceFactor = material.iridescence;
    if (material.iridescenceMap) {
      const iridescenceMapDef = {
        index: writer.processTexture(material.iridescenceMap),
        texCoord: material.iridescenceMap.channel
      };
      writer.applyTextureTransform(iridescenceMapDef, material.iridescenceMap);
      extensionDef.iridescenceTexture = iridescenceMapDef;
    }
    extensionDef.iridescenceIor = material.iridescenceIOR;
    extensionDef.iridescenceThicknessMinimum = material.iridescenceThicknessRange[0];
    extensionDef.iridescenceThicknessMaximum = material.iridescenceThicknessRange[1];
    if (material.iridescenceThicknessMap) {
      const iridescenceThicknessMapDef = {
        index: writer.processTexture(material.iridescenceThicknessMap),
        texCoord: material.iridescenceThicknessMap.channel
      };
      writer.applyTextureTransform(iridescenceThicknessMapDef, material.iridescenceThicknessMap);
      extensionDef.iridescenceThicknessTexture = iridescenceThicknessMapDef;
    }
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
class GLTFMaterialsTransmissionExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_transmission";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshPhysicalMaterial || material.transmission === 0)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    extensionDef.transmissionFactor = material.transmission;
    if (material.transmissionMap) {
      const transmissionMapDef = {
        index: writer.processTexture(material.transmissionMap),
        texCoord: material.transmissionMap.channel
      };
      writer.applyTextureTransform(transmissionMapDef, material.transmissionMap);
      extensionDef.transmissionTexture = transmissionMapDef;
    }
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
class GLTFMaterialsVolumeExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_volume";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshPhysicalMaterial || material.transmission === 0)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    extensionDef.thicknessFactor = material.thickness;
    if (material.thicknessMap) {
      const thicknessMapDef = {
        index: writer.processTexture(material.thicknessMap),
        texCoord: material.thicknessMap.channel
      };
      writer.applyTextureTransform(thicknessMapDef, material.thicknessMap);
      extensionDef.thicknessTexture = thicknessMapDef;
    }
    extensionDef.attenuationDistance = material.attenuationDistance;
    extensionDef.attenuationColor = material.attenuationColor.toArray();
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
class GLTFMaterialsIorExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_ior";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshPhysicalMaterial || material.ior === 1.5)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    extensionDef.ior = material.ior;
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
class GLTFMaterialsSpecularExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_specular";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshPhysicalMaterial || material.specularIntensity === 1 && material.specularColor.equals(DEFAULT_SPECULAR_COLOR) && !material.specularIntensityMap && !material.specularColorTexture)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    if (material.specularIntensityMap) {
      const specularIntensityMapDef = {
        index: writer.processTexture(material.specularIntensityMap),
        texCoord: material.specularIntensityMap.channel
      };
      writer.applyTextureTransform(specularIntensityMapDef, material.specularIntensityMap);
      extensionDef.specularTexture = specularIntensityMapDef;
    }
    if (material.specularColorMap) {
      const specularColorMapDef = {
        index: writer.processTexture(material.specularColorMap),
        texCoord: material.specularColorMap.channel
      };
      writer.applyTextureTransform(specularColorMapDef, material.specularColorMap);
      extensionDef.specularColorTexture = specularColorMapDef;
    }
    extensionDef.specularFactor = material.specularIntensity;
    extensionDef.specularColorFactor = material.specularColor.toArray();
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
class GLTFMaterialsSheenExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_sheen";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshPhysicalMaterial || material.sheen == 0)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    if (material.sheenRoughnessMap) {
      const sheenRoughnessMapDef = {
        index: writer.processTexture(material.sheenRoughnessMap),
        texCoord: material.sheenRoughnessMap.channel
      };
      writer.applyTextureTransform(sheenRoughnessMapDef, material.sheenRoughnessMap);
      extensionDef.sheenRoughnessTexture = sheenRoughnessMapDef;
    }
    if (material.sheenColorMap) {
      const sheenColorMapDef = {
        index: writer.processTexture(material.sheenColorMap),
        texCoord: material.sheenColorMap.channel
      };
      writer.applyTextureTransform(sheenColorMapDef, material.sheenColorMap);
      extensionDef.sheenColorTexture = sheenColorMapDef;
    }
    extensionDef.sheenRoughnessFactor = material.sheenRoughness;
    extensionDef.sheenColorFactor = material.sheenColor.toArray();
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
class GLTFMaterialsAnisotropyExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_anisotropy";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshPhysicalMaterial || material.anisotropy == 0)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    if (material.anisotropyMap) {
      const anisotropyMapDef = { index: writer.processTexture(material.anisotropyMap) };
      writer.applyTextureTransform(anisotropyMapDef, material.anisotropyMap);
      extensionDef.anisotropyTexture = anisotropyMapDef;
    }
    extensionDef.anisotropyStrength = material.anisotropy;
    extensionDef.anisotropyRotation = material.anisotropyRotation;
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
class GLTFMaterialsEmissiveStrengthExtension {
  constructor(writer) {
    this.writer = writer;
    this.name = "KHR_materials_emissive_strength";
  }
  writeMaterial(material, materialDef) {
    if (!material.isMeshStandardMaterial || material.emissiveIntensity === 1)
      return;
    const writer = this.writer;
    const extensionsUsed = writer.extensionsUsed;
    const extensionDef = {};
    extensionDef.emissiveStrength = material.emissiveIntensity;
    materialDef.extensions = materialDef.extensions || {};
    materialDef.extensions[this.name] = extensionDef;
    extensionsUsed[this.name] = true;
  }
}
exports.GLTFExporter = GLTFExporter;
//# sourceMappingURL=GLTFExporter.cjs.map
