"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const KHR_SUPERCOMPRESSION_NONE = 0;
const KHR_SUPERCOMPRESSION_ZSTD = 2;
const KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT = 0;
const KHR_DF_VENDORID_KHRONOS = 0;
const KHR_DF_VERSION = 2;
const KHR_DF_MODEL_UNSPECIFIED = 0;
const KHR_DF_FLAG_ALPHA_STRAIGHT = 0;
const KHR_DF_FLAG_ALPHA_PREMULTIPLIED = 1;
const KHR_DF_TRANSFER_SRGB = 2;
const KHR_DF_PRIMARIES_UNSPECIFIED = 0;
const KHR_DF_PRIMARIES_BT709 = 1;
const KHR_DF_PRIMARIES_DISPLAYP3 = 10;
const KHR_DF_SAMPLE_DATATYPE_SIGNED = 64;
const VK_FORMAT_UNDEFINED = 0;
const VK_FORMAT_R8_UNORM = 9;
const VK_FORMAT_R8_SRGB = 15;
const VK_FORMAT_R8G8_UNORM = 16;
const VK_FORMAT_R8G8_SRGB = 22;
const VK_FORMAT_R8G8B8A8_UNORM = 37;
const VK_FORMAT_R8G8B8A8_SRGB = 43;
const VK_FORMAT_R16_SFLOAT = 76;
const VK_FORMAT_R16G16_SFLOAT = 83;
const VK_FORMAT_R16G16B16A16_SFLOAT = 97;
const VK_FORMAT_R32_SFLOAT = 100;
const VK_FORMAT_R32G32_SFLOAT = 103;
const VK_FORMAT_R32G32B32A32_SFLOAT = 109;
const VK_FORMAT_ASTC_6x6_UNORM_BLOCK = 165;
const VK_FORMAT_ASTC_6x6_SRGB_BLOCK = 166;
class KTX2Container {
  constructor() {
    this.vkFormat = VK_FORMAT_UNDEFINED;
    this.typeSize = 1;
    this.pixelWidth = 0;
    this.pixelHeight = 0;
    this.pixelDepth = 0;
    this.layerCount = 0;
    this.faceCount = 1;
    this.supercompressionScheme = KHR_SUPERCOMPRESSION_NONE;
    this.levels = [];
    this.dataFormatDescriptor = [
      {
        vendorId: KHR_DF_VENDORID_KHRONOS,
        descriptorType: KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT,
        descriptorBlockSize: 0,
        versionNumber: KHR_DF_VERSION,
        colorModel: KHR_DF_MODEL_UNSPECIFIED,
        colorPrimaries: KHR_DF_PRIMARIES_BT709,
        transferFunction: KHR_DF_TRANSFER_SRGB,
        flags: KHR_DF_FLAG_ALPHA_STRAIGHT,
        texelBlockDimension: [0, 0, 0, 0],
        bytesPlane: [0, 0, 0, 0, 0, 0, 0, 0],
        samples: []
      }
    ];
    this.keyValue = {};
    this.globalData = null;
  }
}
class BufferReader {
  constructor(data, byteOffset, byteLength, littleEndian) {
    this._dataView = void 0;
    this._littleEndian = void 0;
    this._offset = void 0;
    this._dataView = new DataView(data.buffer, data.byteOffset + byteOffset, byteLength);
    this._littleEndian = littleEndian;
    this._offset = 0;
  }
  _nextUint8() {
    const value = this._dataView.getUint8(this._offset);
    this._offset += 1;
    return value;
  }
  _nextUint16() {
    const value = this._dataView.getUint16(this._offset, this._littleEndian);
    this._offset += 2;
    return value;
  }
  _nextUint32() {
    const value = this._dataView.getUint32(this._offset, this._littleEndian);
    this._offset += 4;
    return value;
  }
  _nextUint64() {
    const left = this._dataView.getUint32(this._offset, this._littleEndian);
    const right = this._dataView.getUint32(this._offset + 4, this._littleEndian);
    const value = left + 2 ** 32 * right;
    this._offset += 8;
    return value;
  }
  _nextInt32() {
    const value = this._dataView.getInt32(this._offset, this._littleEndian);
    this._offset += 4;
    return value;
  }
  _nextUint8Array(len) {
    const value = new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + this._offset, len);
    this._offset += len;
    return value;
  }
  _skip(bytes) {
    this._offset += bytes;
    return this;
  }
  _scan(maxByteLength, term) {
    if (term === void 0) {
      term = 0;
    }
    const byteOffset = this._offset;
    let byteLength = 0;
    while (this._dataView.getUint8(this._offset) !== term && byteLength < maxByteLength) {
      byteLength++;
      this._offset++;
    }
    if (byteLength < maxByteLength)
      this._offset++;
    return new Uint8Array(this._dataView.buffer, this._dataView.byteOffset + byteOffset, byteLength);
  }
}
const KTX2_ID = [
  // '´', 'K', 'T', 'X', '2', '0', 'ª', '\r', '\n', '\x1A', '\n'
  171,
  75,
  84,
  88,
  32,
  50,
  48,
  187,
  13,
  10,
  26,
  10
];
function decodeText(buffer) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(buffer);
  }
  return Buffer.from(buffer).toString("utf8");
}
function read(data) {
  const id = new Uint8Array(data.buffer, data.byteOffset, KTX2_ID.length);
  if (id[0] !== KTX2_ID[0] || // '´'
  id[1] !== KTX2_ID[1] || // 'K'
  id[2] !== KTX2_ID[2] || // 'T'
  id[3] !== KTX2_ID[3] || // 'X'
  id[4] !== KTX2_ID[4] || // ' '
  id[5] !== KTX2_ID[5] || // '2'
  id[6] !== KTX2_ID[6] || // '0'
  id[7] !== KTX2_ID[7] || // 'ª'
  id[8] !== KTX2_ID[8] || // '\r'
  id[9] !== KTX2_ID[9] || // '\n'
  id[10] !== KTX2_ID[10] || // '\x1A'
  id[11] !== KTX2_ID[11]) {
    throw new Error("Missing KTX 2.0 identifier.");
  }
  const container = new KTX2Container();
  const headerByteLength = 17 * Uint32Array.BYTES_PER_ELEMENT;
  const headerReader = new BufferReader(data, KTX2_ID.length, headerByteLength, true);
  container.vkFormat = headerReader._nextUint32();
  container.typeSize = headerReader._nextUint32();
  container.pixelWidth = headerReader._nextUint32();
  container.pixelHeight = headerReader._nextUint32();
  container.pixelDepth = headerReader._nextUint32();
  container.layerCount = headerReader._nextUint32();
  container.faceCount = headerReader._nextUint32();
  const levelCount = headerReader._nextUint32();
  container.supercompressionScheme = headerReader._nextUint32();
  const dfdByteOffset = headerReader._nextUint32();
  const dfdByteLength = headerReader._nextUint32();
  const kvdByteOffset = headerReader._nextUint32();
  const kvdByteLength = headerReader._nextUint32();
  const sgdByteOffset = headerReader._nextUint64();
  const sgdByteLength = headerReader._nextUint64();
  const levelByteLength = levelCount * 3 * 8;
  const levelReader = new BufferReader(data, KTX2_ID.length + headerByteLength, levelByteLength, true);
  for (let i = 0; i < levelCount; i++) {
    container.levels.push({
      levelData: new Uint8Array(data.buffer, data.byteOffset + levelReader._nextUint64(), levelReader._nextUint64()),
      uncompressedByteLength: levelReader._nextUint64()
    });
  }
  const dfdReader = new BufferReader(data, dfdByteOffset, dfdByteLength, true);
  const dfd = {
    vendorId: dfdReader._skip(
      4
      /* totalSize */
    )._nextUint16(),
    descriptorType: dfdReader._nextUint16(),
    versionNumber: dfdReader._nextUint16(),
    descriptorBlockSize: dfdReader._nextUint16(),
    colorModel: dfdReader._nextUint8(),
    colorPrimaries: dfdReader._nextUint8(),
    transferFunction: dfdReader._nextUint8(),
    flags: dfdReader._nextUint8(),
    texelBlockDimension: [
      dfdReader._nextUint8(),
      dfdReader._nextUint8(),
      dfdReader._nextUint8(),
      dfdReader._nextUint8()
    ],
    bytesPlane: [
      dfdReader._nextUint8(),
      dfdReader._nextUint8(),
      dfdReader._nextUint8(),
      dfdReader._nextUint8(),
      dfdReader._nextUint8(),
      dfdReader._nextUint8(),
      dfdReader._nextUint8(),
      dfdReader._nextUint8()
    ],
    samples: []
  };
  const sampleStart = 6;
  const sampleWords = 4;
  const numSamples = (dfd.descriptorBlockSize / 4 - sampleStart) / sampleWords;
  for (let i = 0; i < numSamples; i++) {
    const sample = {
      bitOffset: dfdReader._nextUint16(),
      bitLength: dfdReader._nextUint8(),
      channelType: dfdReader._nextUint8(),
      samplePosition: [dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8(), dfdReader._nextUint8()],
      sampleLower: -Infinity,
      sampleUpper: Infinity
    };
    if (sample.channelType & KHR_DF_SAMPLE_DATATYPE_SIGNED) {
      sample.sampleLower = dfdReader._nextInt32();
      sample.sampleUpper = dfdReader._nextInt32();
    } else {
      sample.sampleLower = dfdReader._nextUint32();
      sample.sampleUpper = dfdReader._nextUint32();
    }
    dfd.samples[i] = sample;
  }
  container.dataFormatDescriptor.length = 0;
  container.dataFormatDescriptor.push(dfd);
  const kvdReader = new BufferReader(data, kvdByteOffset, kvdByteLength, true);
  while (kvdReader._offset < kvdByteLength) {
    const keyValueByteLength = kvdReader._nextUint32();
    const keyData = kvdReader._scan(keyValueByteLength);
    const key = decodeText(keyData);
    container.keyValue[key] = kvdReader._nextUint8Array(keyValueByteLength - keyData.byteLength - 1);
    if (key.match(/^ktx/i)) {
      const text = decodeText(container.keyValue[key]);
      container.keyValue[key] = text.substring(0, text.lastIndexOf("\0"));
    }
    const kvPadding = keyValueByteLength % 4 ? 4 - keyValueByteLength % 4 : 0;
    kvdReader._skip(kvPadding);
  }
  if (sgdByteLength <= 0)
    return container;
  const sgdReader = new BufferReader(data, sgdByteOffset, sgdByteLength, true);
  const endpointCount = sgdReader._nextUint16();
  const selectorCount = sgdReader._nextUint16();
  const endpointsByteLength = sgdReader._nextUint32();
  const selectorsByteLength = sgdReader._nextUint32();
  const tablesByteLength = sgdReader._nextUint32();
  const extendedByteLength = sgdReader._nextUint32();
  const imageDescs = [];
  for (let i = 0; i < levelCount; i++) {
    imageDescs.push({
      imageFlags: sgdReader._nextUint32(),
      rgbSliceByteOffset: sgdReader._nextUint32(),
      rgbSliceByteLength: sgdReader._nextUint32(),
      alphaSliceByteOffset: sgdReader._nextUint32(),
      alphaSliceByteLength: sgdReader._nextUint32()
    });
  }
  const endpointsByteOffset = sgdByteOffset + sgdReader._offset;
  const selectorsByteOffset = endpointsByteOffset + endpointsByteLength;
  const tablesByteOffset = selectorsByteOffset + selectorsByteLength;
  const extendedByteOffset = tablesByteOffset + tablesByteLength;
  const endpointsData = new Uint8Array(data.buffer, data.byteOffset + endpointsByteOffset, endpointsByteLength);
  const selectorsData = new Uint8Array(data.buffer, data.byteOffset + selectorsByteOffset, selectorsByteLength);
  const tablesData = new Uint8Array(data.buffer, data.byteOffset + tablesByteOffset, tablesByteLength);
  const extendedData = new Uint8Array(data.buffer, data.byteOffset + extendedByteOffset, extendedByteLength);
  container.globalData = {
    endpointCount,
    selectorCount,
    imageDescs,
    endpointsData,
    selectorsData,
    tablesData,
    extendedData
  };
  return container;
}
exports.KHR_DF_FLAG_ALPHA_PREMULTIPLIED = KHR_DF_FLAG_ALPHA_PREMULTIPLIED;
exports.KHR_DF_FLAG_ALPHA_STRAIGHT = KHR_DF_FLAG_ALPHA_STRAIGHT;
exports.KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT = KHR_DF_KHR_DESCRIPTORTYPE_BASICFORMAT;
exports.KHR_DF_MODEL_UNSPECIFIED = KHR_DF_MODEL_UNSPECIFIED;
exports.KHR_DF_PRIMARIES_BT709 = KHR_DF_PRIMARIES_BT709;
exports.KHR_DF_PRIMARIES_DISPLAYP3 = KHR_DF_PRIMARIES_DISPLAYP3;
exports.KHR_DF_PRIMARIES_UNSPECIFIED = KHR_DF_PRIMARIES_UNSPECIFIED;
exports.KHR_DF_SAMPLE_DATATYPE_SIGNED = KHR_DF_SAMPLE_DATATYPE_SIGNED;
exports.KHR_DF_TRANSFER_SRGB = KHR_DF_TRANSFER_SRGB;
exports.KHR_DF_VENDORID_KHRONOS = KHR_DF_VENDORID_KHRONOS;
exports.KHR_DF_VERSION = KHR_DF_VERSION;
exports.KHR_SUPERCOMPRESSION_NONE = KHR_SUPERCOMPRESSION_NONE;
exports.KHR_SUPERCOMPRESSION_ZSTD = KHR_SUPERCOMPRESSION_ZSTD;
exports.KTX2Container = KTX2Container;
exports.VK_FORMAT_ASTC_6x6_SRGB_BLOCK = VK_FORMAT_ASTC_6x6_SRGB_BLOCK;
exports.VK_FORMAT_ASTC_6x6_UNORM_BLOCK = VK_FORMAT_ASTC_6x6_UNORM_BLOCK;
exports.VK_FORMAT_R16G16B16A16_SFLOAT = VK_FORMAT_R16G16B16A16_SFLOAT;
exports.VK_FORMAT_R16G16_SFLOAT = VK_FORMAT_R16G16_SFLOAT;
exports.VK_FORMAT_R16_SFLOAT = VK_FORMAT_R16_SFLOAT;
exports.VK_FORMAT_R32G32B32A32_SFLOAT = VK_FORMAT_R32G32B32A32_SFLOAT;
exports.VK_FORMAT_R32G32_SFLOAT = VK_FORMAT_R32G32_SFLOAT;
exports.VK_FORMAT_R32_SFLOAT = VK_FORMAT_R32_SFLOAT;
exports.VK_FORMAT_R8G8B8A8_SRGB = VK_FORMAT_R8G8B8A8_SRGB;
exports.VK_FORMAT_R8G8B8A8_UNORM = VK_FORMAT_R8G8B8A8_UNORM;
exports.VK_FORMAT_R8G8_SRGB = VK_FORMAT_R8G8_SRGB;
exports.VK_FORMAT_R8G8_UNORM = VK_FORMAT_R8G8_UNORM;
exports.VK_FORMAT_R8_SRGB = VK_FORMAT_R8_SRGB;
exports.VK_FORMAT_R8_UNORM = VK_FORMAT_R8_UNORM;
exports.VK_FORMAT_UNDEFINED = VK_FORMAT_UNDEFINED;
exports.read = read;
//# sourceMappingURL=ktx-parse.cjs.map
