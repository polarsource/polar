"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const WorkerPool = require("../utils/WorkerPool.cjs");
const ktxParse = require("../libs/ktx-parse.cjs");
const zstddec = require("../libs/zstddec.cjs");
const CompressedCubeTexture = require("../_polyfill/CompressedCubeTexture.cjs");
const CompressedArrayTexture = require("../_polyfill/CompressedArrayTexture.cjs");
const Data3DTexture = require("../_polyfill/Data3DTexture.cjs");
const LinearEncoding = 3e3;
const sRGBEncoding = 3001;
const NoColorSpace = "";
const DisplayP3ColorSpace = "display-p3";
const LinearDisplayP3ColorSpace = "display-p3-linear";
const LinearSRGBColorSpace = "srgb-linear";
const SRGBColorSpace = "srgb";
const _taskCache = /* @__PURE__ */ new WeakMap();
let _activeLoaders = 0;
let _zstd;
const _KTX2Loader = class extends THREE.Loader {
  constructor(manager) {
    super(manager);
    this.transcoderPath = "";
    this.transcoderBinary = null;
    this.transcoderPending = null;
    this.workerPool = new WorkerPool.WorkerPool();
    this.workerSourceURL = "";
    this.workerConfig = null;
    if (typeof MSC_TRANSCODER !== "undefined") {
      console.warn(
        'THREE.KTX2Loader: Please update to latest "basis_transcoder". "msc_basis_transcoder" is no longer supported in three.js r125+.'
      );
    }
  }
  setTranscoderPath(path) {
    this.transcoderPath = path;
    return this;
  }
  setWorkerLimit(num) {
    this.workerPool.setWorkerLimit(num);
    return this;
  }
  detectSupport(renderer) {
    this.workerConfig = {
      astcSupported: renderer.extensions.has("WEBGL_compressed_texture_astc"),
      etc1Supported: renderer.extensions.has("WEBGL_compressed_texture_etc1"),
      etc2Supported: renderer.extensions.has("WEBGL_compressed_texture_etc"),
      dxtSupported: renderer.extensions.has("WEBGL_compressed_texture_s3tc"),
      bptcSupported: renderer.extensions.has("EXT_texture_compression_bptc"),
      pvrtcSupported: renderer.extensions.has("WEBGL_compressed_texture_pvrtc") || renderer.extensions.has("WEBKIT_WEBGL_compressed_texture_pvrtc")
    };
    if (renderer.capabilities.isWebGL2) {
      this.workerConfig.etc1Supported = false;
    }
    return this;
  }
  init() {
    if (!this.transcoderPending) {
      const jsLoader = new THREE.FileLoader(this.manager);
      jsLoader.setPath(this.transcoderPath);
      jsLoader.setWithCredentials(this.withCredentials);
      const jsContent = jsLoader.loadAsync("basis_transcoder.js");
      const binaryLoader = new THREE.FileLoader(this.manager);
      binaryLoader.setPath(this.transcoderPath);
      binaryLoader.setResponseType("arraybuffer");
      binaryLoader.setWithCredentials(this.withCredentials);
      const binaryContent = binaryLoader.loadAsync("basis_transcoder.wasm");
      this.transcoderPending = Promise.all([jsContent, binaryContent]).then(([jsContent2, binaryContent2]) => {
        const fn = _KTX2Loader.BasisWorker.toString();
        const body = [
          "/* constants */",
          "let _EngineFormat = " + JSON.stringify(_KTX2Loader.EngineFormat),
          "let _TranscoderFormat = " + JSON.stringify(_KTX2Loader.TranscoderFormat),
          "let _BasisFormat = " + JSON.stringify(_KTX2Loader.BasisFormat),
          "/* basis_transcoder.js */",
          jsContent2,
          "/* worker */",
          fn.substring(fn.indexOf("{") + 1, fn.lastIndexOf("}"))
        ].join("\n");
        this.workerSourceURL = URL.createObjectURL(new Blob([body]));
        this.transcoderBinary = binaryContent2;
        this.workerPool.setWorkerCreator(() => {
          const worker = new Worker(this.workerSourceURL);
          const transcoderBinary = this.transcoderBinary.slice(0);
          worker.postMessage({ type: "init", config: this.workerConfig, transcoderBinary }, [transcoderBinary]);
          return worker;
        });
      });
      if (_activeLoaders > 0) {
        console.warn(
          "THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues. Use a single KTX2Loader instance, or call .dispose() on old instances."
        );
      }
      _activeLoaders++;
    }
    return this.transcoderPending;
  }
  load(url, onLoad, onProgress, onError) {
    if (this.workerConfig === null) {
      throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");
    }
    const loader = new THREE.FileLoader(this.manager);
    loader.setResponseType("arraybuffer");
    loader.setWithCredentials(this.withCredentials);
    loader.load(
      url,
      (buffer) => {
        if (_taskCache.has(buffer)) {
          const cachedTask = _taskCache.get(buffer);
          return cachedTask.promise.then(onLoad).catch(onError);
        }
        this._createTexture(buffer).then((texture) => onLoad ? onLoad(texture) : null).catch(onError);
      },
      onProgress,
      onError
    );
  }
  _createTextureFrom(transcodeResult, container) {
    const { faces, width, height, format, type, error, dfdFlags } = transcodeResult;
    if (type === "error")
      return Promise.reject(error);
    let texture;
    if (container.faceCount === 6) {
      texture = new CompressedCubeTexture.CompressedCubeTexture(faces, format, THREE.UnsignedByteType);
    } else {
      const mipmaps = faces[0].mipmaps;
      texture = container.layerCount > 1 ? new CompressedArrayTexture.CompressedArrayTexture(mipmaps, width, height, container.layerCount, format, THREE.UnsignedByteType) : new THREE.CompressedTexture(mipmaps, width, height, format, THREE.UnsignedByteType);
    }
    texture.minFilter = faces[0].mipmaps.length === 1 ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    const colorSpace = parseColorSpace(container);
    if ("colorSpace" in texture)
      texture.colorSpace = colorSpace;
    else
      texture.encoding = colorSpace === SRGBColorSpace ? sRGBEncoding : LinearEncoding;
    texture.premultiplyAlpha = !!(dfdFlags & ktxParse.KHR_DF_FLAG_ALPHA_PREMULTIPLIED);
    return texture;
  }
  /**
   * @param {ArrayBuffer} buffer
   * @param {object?} config
   * @return {Promise<CompressedTexture|CompressedArrayTexture|DataTexture|Data3DTexture>}
   */
  async _createTexture(buffer, config = {}) {
    const container = ktxParse.read(new Uint8Array(buffer));
    if (container.vkFormat !== ktxParse.VK_FORMAT_UNDEFINED) {
      return createRawTexture(container);
    }
    const taskConfig = config;
    const texturePending = this.init().then(() => {
      return this.workerPool.postMessage({ type: "transcode", buffer, taskConfig }, [buffer]);
    }).then((e) => this._createTextureFrom(e.data, container));
    _taskCache.set(buffer, { promise: texturePending });
    return texturePending;
  }
  dispose() {
    this.workerPool.dispose();
    if (this.workerSourceURL)
      URL.revokeObjectURL(this.workerSourceURL);
    _activeLoaders--;
    return this;
  }
};
let KTX2Loader = _KTX2Loader;
/* CONSTANTS */
__publicField(KTX2Loader, "BasisFormat", {
  ETC1S: 0,
  UASTC_4x4: 1
});
__publicField(KTX2Loader, "TranscoderFormat", {
  ETC1: 0,
  ETC2: 1,
  BC1: 2,
  BC3: 3,
  BC4: 4,
  BC5: 5,
  BC7_M6_OPAQUE_ONLY: 6,
  BC7_M5: 7,
  PVRTC1_4_RGB: 8,
  PVRTC1_4_RGBA: 9,
  ASTC_4x4: 10,
  ATC_RGB: 11,
  ATC_RGBA_INTERPOLATED_ALPHA: 12,
  RGBA32: 13,
  RGB565: 14,
  BGR565: 15,
  RGBA4444: 16
});
__publicField(KTX2Loader, "EngineFormat", {
  RGBAFormat: THREE.RGBAFormat,
  RGBA_ASTC_4x4_Format: THREE.RGBA_ASTC_4x4_Format,
  RGBA_BPTC_Format: THREE.RGBA_BPTC_Format,
  RGBA_ETC2_EAC_Format: THREE.RGBA_ETC2_EAC_Format,
  RGBA_PVRTC_4BPPV1_Format: THREE.RGBA_PVRTC_4BPPV1_Format,
  RGBA_S3TC_DXT5_Format: THREE.RGBA_S3TC_DXT5_Format,
  RGB_ETC1_Format: THREE.RGB_ETC1_Format,
  RGB_ETC2_Format: THREE.RGB_ETC2_Format,
  RGB_PVRTC_4BPPV1_Format: THREE.RGB_PVRTC_4BPPV1_Format,
  RGB_S3TC_DXT1_Format: THREE.RGB_S3TC_DXT1_Format
});
/* WEB WORKER */
__publicField(KTX2Loader, "BasisWorker", function() {
  let config;
  let transcoderPending;
  let BasisModule;
  const EngineFormat = _EngineFormat;
  const TranscoderFormat = _TranscoderFormat;
  const BasisFormat = _BasisFormat;
  self.addEventListener("message", function(e) {
    const message = e.data;
    switch (message.type) {
      case "init":
        config = message.config;
        init(message.transcoderBinary);
        break;
      case "transcode":
        transcoderPending.then(() => {
          try {
            const { faces, buffers, width, height, hasAlpha, format, dfdFlags } = transcode(message.buffer);
            self.postMessage(
              { type: "transcode", id: message.id, faces, width, height, hasAlpha, format, dfdFlags },
              buffers
            );
          } catch (error) {
            console.error(error);
            self.postMessage({ type: "error", id: message.id, error: error.message });
          }
        });
        break;
    }
  });
  function init(wasmBinary) {
    transcoderPending = new Promise((resolve) => {
      BasisModule = { wasmBinary, onRuntimeInitialized: resolve };
      BASIS(BasisModule);
    }).then(() => {
      BasisModule.initializeBasis();
      if (BasisModule.KTX2File === void 0) {
        console.warn("THREE.KTX2Loader: Please update Basis Universal transcoder.");
      }
    });
  }
  function transcode(buffer) {
    const ktx2File = new BasisModule.KTX2File(new Uint8Array(buffer));
    function cleanup() {
      ktx2File.close();
      ktx2File.delete();
    }
    if (!ktx2File.isValid()) {
      cleanup();
      throw new Error("THREE.KTX2Loader:	Invalid or unsupported .ktx2 file");
    }
    const basisFormat = ktx2File.isUASTC() ? BasisFormat.UASTC_4x4 : BasisFormat.ETC1S;
    const width = ktx2File.getWidth();
    const height = ktx2File.getHeight();
    const layerCount = ktx2File.getLayers() || 1;
    const levelCount = ktx2File.getLevels();
    const faceCount = ktx2File.getFaces();
    const hasAlpha = ktx2File.getHasAlpha();
    const dfdFlags = ktx2File.getDFDFlags();
    const { transcoderFormat, engineFormat } = getTranscoderFormat(basisFormat, width, height, hasAlpha);
    if (!width || !height || !levelCount) {
      cleanup();
      throw new Error("THREE.KTX2Loader:	Invalid texture");
    }
    if (!ktx2File.startTranscoding()) {
      cleanup();
      throw new Error("THREE.KTX2Loader: .startTranscoding failed");
    }
    const faces = [];
    const buffers = [];
    for (let face = 0; face < faceCount; face++) {
      const mipmaps = [];
      for (let mip = 0; mip < levelCount; mip++) {
        const layerMips = [];
        let mipWidth, mipHeight;
        for (let layer = 0; layer < layerCount; layer++) {
          const levelInfo = ktx2File.getImageLevelInfo(mip, layer, face);
          if (face === 0 && mip === 0 && layer === 0 && (levelInfo.origWidth % 4 !== 0 || levelInfo.origHeight % 4 !== 0)) {
            console.warn("THREE.KTX2Loader: ETC1S and UASTC textures should use multiple-of-four dimensions.");
          }
          if (levelCount > 1) {
            mipWidth = levelInfo.origWidth;
            mipHeight = levelInfo.origHeight;
          } else {
            mipWidth = levelInfo.width;
            mipHeight = levelInfo.height;
          }
          const dst = new Uint8Array(ktx2File.getImageTranscodedSizeInBytes(mip, layer, 0, transcoderFormat));
          const status = ktx2File.transcodeImage(dst, mip, layer, face, transcoderFormat, 0, -1, -1);
          if (!status) {
            cleanup();
            throw new Error("THREE.KTX2Loader: .transcodeImage failed.");
          }
          layerMips.push(dst);
        }
        const mipData = concat(layerMips);
        mipmaps.push({ data: mipData, width: mipWidth, height: mipHeight });
        buffers.push(mipData.buffer);
      }
      faces.push({ mipmaps, width, height, format: engineFormat });
    }
    cleanup();
    return { faces, buffers, width, height, hasAlpha, format: engineFormat, dfdFlags };
  }
  const FORMAT_OPTIONS = [
    {
      if: "astcSupported",
      basisFormat: [BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ASTC_4x4, TranscoderFormat.ASTC_4x4],
      engineFormat: [EngineFormat.RGBA_ASTC_4x4_Format, EngineFormat.RGBA_ASTC_4x4_Format],
      priorityETC1S: Infinity,
      priorityUASTC: 1,
      needsPowerOfTwo: false
    },
    {
      if: "bptcSupported",
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.BC7_M5, TranscoderFormat.BC7_M5],
      engineFormat: [EngineFormat.RGBA_BPTC_Format, EngineFormat.RGBA_BPTC_Format],
      priorityETC1S: 3,
      priorityUASTC: 2,
      needsPowerOfTwo: false
    },
    {
      if: "dxtSupported",
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.BC1, TranscoderFormat.BC3],
      engineFormat: [EngineFormat.RGB_S3TC_DXT1_Format, EngineFormat.RGBA_S3TC_DXT5_Format],
      priorityETC1S: 4,
      priorityUASTC: 5,
      needsPowerOfTwo: false
    },
    {
      if: "etc2Supported",
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ETC1, TranscoderFormat.ETC2],
      engineFormat: [EngineFormat.RGB_ETC2_Format, EngineFormat.RGBA_ETC2_EAC_Format],
      priorityETC1S: 1,
      priorityUASTC: 3,
      needsPowerOfTwo: false
    },
    {
      if: "etc1Supported",
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.ETC1],
      engineFormat: [EngineFormat.RGB_ETC1_Format],
      priorityETC1S: 2,
      priorityUASTC: 4,
      needsPowerOfTwo: false
    },
    {
      if: "pvrtcSupported",
      basisFormat: [BasisFormat.ETC1S, BasisFormat.UASTC_4x4],
      transcoderFormat: [TranscoderFormat.PVRTC1_4_RGB, TranscoderFormat.PVRTC1_4_RGBA],
      engineFormat: [EngineFormat.RGB_PVRTC_4BPPV1_Format, EngineFormat.RGBA_PVRTC_4BPPV1_Format],
      priorityETC1S: 5,
      priorityUASTC: 6,
      needsPowerOfTwo: true
    }
  ];
  const ETC1S_OPTIONS = FORMAT_OPTIONS.sort(function(a, b) {
    return a.priorityETC1S - b.priorityETC1S;
  });
  const UASTC_OPTIONS = FORMAT_OPTIONS.sort(function(a, b) {
    return a.priorityUASTC - b.priorityUASTC;
  });
  function getTranscoderFormat(basisFormat, width, height, hasAlpha) {
    let transcoderFormat;
    let engineFormat;
    const options = basisFormat === BasisFormat.ETC1S ? ETC1S_OPTIONS : UASTC_OPTIONS;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (!config[opt.if])
        continue;
      if (!opt.basisFormat.includes(basisFormat))
        continue;
      if (hasAlpha && opt.transcoderFormat.length < 2)
        continue;
      if (opt.needsPowerOfTwo && !(isPowerOfTwo(width) && isPowerOfTwo(height)))
        continue;
      transcoderFormat = opt.transcoderFormat[hasAlpha ? 1 : 0];
      engineFormat = opt.engineFormat[hasAlpha ? 1 : 0];
      return { transcoderFormat, engineFormat };
    }
    console.warn("THREE.KTX2Loader: No suitable compressed texture format found. Decoding to RGBA32.");
    transcoderFormat = TranscoderFormat.RGBA32;
    engineFormat = EngineFormat.RGBAFormat;
    return { transcoderFormat, engineFormat };
  }
  function isPowerOfTwo(value) {
    if (value <= 2)
      return true;
    return (value & value - 1) === 0 && value !== 0;
  }
  function concat(arrays) {
    if (arrays.length === 1)
      return arrays[0];
    let totalByteLength = 0;
    for (let i = 0; i < arrays.length; i++) {
      const array = arrays[i];
      totalByteLength += array.byteLength;
    }
    const result = new Uint8Array(totalByteLength);
    let byteOffset = 0;
    for (let i = 0; i < arrays.length; i++) {
      const array = arrays[i];
      result.set(array, byteOffset);
      byteOffset += array.byteLength;
    }
    return result;
  }
});
const UNCOMPRESSED_FORMATS = /* @__PURE__ */ new Set([THREE.RGBAFormat, THREE.RGFormat, THREE.RedFormat]);
const FORMAT_MAP = {
  [ktxParse.VK_FORMAT_R32G32B32A32_SFLOAT]: THREE.RGBAFormat,
  [ktxParse.VK_FORMAT_R16G16B16A16_SFLOAT]: THREE.RGBAFormat,
  [ktxParse.VK_FORMAT_R8G8B8A8_UNORM]: THREE.RGBAFormat,
  [ktxParse.VK_FORMAT_R8G8B8A8_SRGB]: THREE.RGBAFormat,
  [ktxParse.VK_FORMAT_R32G32_SFLOAT]: THREE.RGFormat,
  [ktxParse.VK_FORMAT_R16G16_SFLOAT]: THREE.RGFormat,
  [ktxParse.VK_FORMAT_R8G8_UNORM]: THREE.RGFormat,
  [ktxParse.VK_FORMAT_R8G8_SRGB]: THREE.RGFormat,
  [ktxParse.VK_FORMAT_R32_SFLOAT]: THREE.RedFormat,
  [ktxParse.VK_FORMAT_R16_SFLOAT]: THREE.RedFormat,
  [ktxParse.VK_FORMAT_R8_SRGB]: THREE.RedFormat,
  [ktxParse.VK_FORMAT_R8_UNORM]: THREE.RedFormat,
  [ktxParse.VK_FORMAT_ASTC_6x6_SRGB_BLOCK]: THREE.RGBA_ASTC_6x6_Format,
  [ktxParse.VK_FORMAT_ASTC_6x6_UNORM_BLOCK]: THREE.RGBA_ASTC_6x6_Format
};
const TYPE_MAP = {
  [ktxParse.VK_FORMAT_R32G32B32A32_SFLOAT]: THREE.FloatType,
  [ktxParse.VK_FORMAT_R16G16B16A16_SFLOAT]: THREE.HalfFloatType,
  [ktxParse.VK_FORMAT_R8G8B8A8_UNORM]: THREE.UnsignedByteType,
  [ktxParse.VK_FORMAT_R8G8B8A8_SRGB]: THREE.UnsignedByteType,
  [ktxParse.VK_FORMAT_R32G32_SFLOAT]: THREE.FloatType,
  [ktxParse.VK_FORMAT_R16G16_SFLOAT]: THREE.HalfFloatType,
  [ktxParse.VK_FORMAT_R8G8_UNORM]: THREE.UnsignedByteType,
  [ktxParse.VK_FORMAT_R8G8_SRGB]: THREE.UnsignedByteType,
  [ktxParse.VK_FORMAT_R32_SFLOAT]: THREE.FloatType,
  [ktxParse.VK_FORMAT_R16_SFLOAT]: THREE.HalfFloatType,
  [ktxParse.VK_FORMAT_R8_SRGB]: THREE.UnsignedByteType,
  [ktxParse.VK_FORMAT_R8_UNORM]: THREE.UnsignedByteType,
  [ktxParse.VK_FORMAT_ASTC_6x6_SRGB_BLOCK]: THREE.UnsignedByteType,
  [ktxParse.VK_FORMAT_ASTC_6x6_UNORM_BLOCK]: THREE.UnsignedByteType
};
async function createRawTexture(container) {
  const { vkFormat } = container;
  if (FORMAT_MAP[vkFormat] === void 0) {
    throw new Error("THREE.KTX2Loader: Unsupported vkFormat.");
  }
  let zstd;
  if (container.supercompressionScheme === ktxParse.KHR_SUPERCOMPRESSION_ZSTD) {
    if (!_zstd) {
      _zstd = new Promise(async (resolve) => {
        const zstd2 = new zstddec.ZSTDDecoder();
        await zstd2.init();
        resolve(zstd2);
      });
    }
    zstd = await _zstd;
  }
  const mipmaps = [];
  for (let levelIndex = 0; levelIndex < container.levels.length; levelIndex++) {
    const levelWidth = Math.max(1, container.pixelWidth >> levelIndex);
    const levelHeight = Math.max(1, container.pixelHeight >> levelIndex);
    const levelDepth = container.pixelDepth ? Math.max(1, container.pixelDepth >> levelIndex) : 0;
    const level = container.levels[levelIndex];
    let levelData;
    if (container.supercompressionScheme === ktxParse.KHR_SUPERCOMPRESSION_NONE) {
      levelData = level.levelData;
    } else if (container.supercompressionScheme === ktxParse.KHR_SUPERCOMPRESSION_ZSTD) {
      levelData = zstd.decode(level.levelData, level.uncompressedByteLength);
    } else {
      throw new Error("THREE.KTX2Loader: Unsupported supercompressionScheme.");
    }
    let data;
    if (TYPE_MAP[vkFormat] === THREE.FloatType) {
      data = new Float32Array(
        levelData.buffer,
        levelData.byteOffset,
        levelData.byteLength / Float32Array.BYTES_PER_ELEMENT
      );
    } else if (TYPE_MAP[vkFormat] === THREE.HalfFloatType) {
      data = new Uint16Array(
        levelData.buffer,
        levelData.byteOffset,
        levelData.byteLength / Uint16Array.BYTES_PER_ELEMENT
      );
    } else {
      data = levelData;
    }
    mipmaps.push({
      data,
      width: levelWidth,
      height: levelHeight,
      depth: levelDepth
    });
  }
  let texture;
  if (UNCOMPRESSED_FORMATS.has(FORMAT_MAP[vkFormat])) {
    texture = container.pixelDepth === 0 ? new THREE.DataTexture(mipmaps[0].data, container.pixelWidth, container.pixelHeight) : new Data3DTexture.Data3DTexture(mipmaps[0].data, container.pixelWidth, container.pixelHeight, container.pixelDepth);
  } else {
    if (container.pixelDepth > 0)
      throw new Error("THREE.KTX2Loader: Unsupported pixelDepth.");
    texture = new THREE.CompressedTexture(mipmaps, container.pixelWidth, container.pixelHeight);
  }
  texture.mipmaps = mipmaps;
  texture.type = TYPE_MAP[vkFormat];
  texture.format = FORMAT_MAP[vkFormat];
  texture.needsUpdate = true;
  const colorSpace = parseColorSpace(container);
  if ("colorSpace" in texture)
    texture.colorSpace = colorSpace;
  else
    texture.encoding = colorSpace === SRGBColorSpace ? sRGBEncoding : LinearEncoding;
  return Promise.resolve(texture);
}
function parseColorSpace(container) {
  const dfd = container.dataFormatDescriptor[0];
  if (dfd.colorPrimaries === ktxParse.KHR_DF_PRIMARIES_BT709) {
    return dfd.transferFunction === ktxParse.KHR_DF_TRANSFER_SRGB ? SRGBColorSpace : LinearSRGBColorSpace;
  } else if (dfd.colorPrimaries === ktxParse.KHR_DF_PRIMARIES_DISPLAYP3) {
    return dfd.transferFunction === ktxParse.KHR_DF_TRANSFER_SRGB ? DisplayP3ColorSpace : LinearDisplayP3ColorSpace;
  } else if (dfd.colorPrimaries === ktxParse.KHR_DF_PRIMARIES_UNSPECIFIED) {
    return NoColorSpace;
  } else {
    console.warn(`THREE.KTX2Loader: Unsupported color primaries, "${dfd.colorPrimaries}"`);
    return NoColorSpace;
  }
}
exports.KTX2Loader = KTX2Loader;
//# sourceMappingURL=KTX2Loader.cjs.map
