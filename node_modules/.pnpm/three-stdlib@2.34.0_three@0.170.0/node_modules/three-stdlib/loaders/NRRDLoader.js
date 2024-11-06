import { Loader, FileLoader, Vector3, Matrix4 } from "three";
import { gunzipSync } from "fflate";
import { Volume } from "../misc/Volume.js";
class NRRDLoader extends Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new FileLoader(scope.manager);
    loader.setPath(scope.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(scope.requestHeader);
    loader.setWithCredentials(scope.withCredentials);
    loader.load(
      url,
      function(data) {
        try {
          onLoad(scope.parse(data));
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
  parse(data) {
    let _data = data;
    let _dataPointer = 0;
    const _nativeLittleEndian = new Int8Array(new Int16Array([1]).buffer)[0] > 0;
    const _littleEndian = true;
    const headerObject = {};
    function scan(type, chunks) {
      if (chunks === void 0 || chunks === null) {
        chunks = 1;
      }
      let _chunkSize = 1;
      let _array_type = Uint8Array;
      switch (type) {
        case "uchar":
          break;
        case "schar":
          _array_type = Int8Array;
          break;
        case "ushort":
          _array_type = Uint16Array;
          _chunkSize = 2;
          break;
        case "sshort":
          _array_type = Int16Array;
          _chunkSize = 2;
          break;
        case "uint":
          _array_type = Uint32Array;
          _chunkSize = 4;
          break;
        case "sint":
          _array_type = Int32Array;
          _chunkSize = 4;
          break;
        case "float":
          _array_type = Float32Array;
          _chunkSize = 4;
          break;
        case "complex":
          _array_type = Float64Array;
          _chunkSize = 8;
          break;
        case "double":
          _array_type = Float64Array;
          _chunkSize = 8;
          break;
      }
      let _bytes2 = new _array_type(_data.slice(_dataPointer, _dataPointer += chunks * _chunkSize));
      if (_nativeLittleEndian != _littleEndian) {
        _bytes2 = flipEndianness(_bytes2, _chunkSize);
      }
      if (chunks == 1) {
        return _bytes2[0];
      }
      return _bytes2;
    }
    function flipEndianness(array, chunkSize) {
      const u8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i2 = 0; i2 < array.byteLength; i2 += chunkSize) {
        for (let j = i2 + chunkSize - 1, k = i2; j > k; j--, k++) {
          const tmp = u8[k];
          u8[k] = u8[j];
          u8[j] = tmp;
        }
      }
      return array;
    }
    function parseHeader(header) {
      let data2, field, fn, i2, l, m, _i, _len;
      const lines = header.split(/\r?\n/);
      for (_i = 0, _len = lines.length; _i < _len; _i++) {
        l = lines[_i];
        if (l.match(/NRRD\d+/)) {
          headerObject.isNrrd = true;
        } else if (l.match(/^#/))
          ;
        else if (m = l.match(/(.*):(.*)/)) {
          field = m[1].trim();
          data2 = m[2].trim();
          fn = _fieldFunctions[field];
          if (fn) {
            fn.call(headerObject, data2);
          } else {
            headerObject[field] = data2;
          }
        }
      }
      if (!headerObject.isNrrd) {
        throw new Error("Not an NRRD file");
      }
      if (headerObject.encoding === "bz2" || headerObject.encoding === "bzip2") {
        throw new Error("Bzip is not supported");
      }
      if (!headerObject.vectors) {
        headerObject.vectors = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
        if (headerObject.spacings) {
          for (i2 = 0; i2 <= 2; i2++) {
            if (!isNaN(headerObject.spacings[i2])) {
              headerObject.vectors[i2].multiplyScalar(headerObject.spacings[i2]);
            }
          }
        }
      }
    }
    function parseDataAsText(data2, start, end) {
      let number = "";
      start = start || 0;
      end = end || data2.length;
      let value;
      const lengthOfTheResult = headerObject.sizes.reduce(function(previous, current) {
        return previous * current;
      }, 1);
      let base = 10;
      if (headerObject.encoding === "hex") {
        base = 16;
      }
      const result = new headerObject.__array(lengthOfTheResult);
      let resultIndex = 0;
      let parsingFunction = parseInt;
      if (headerObject.__array === Float32Array || headerObject.__array === Float64Array) {
        parsingFunction = parseFloat;
      }
      for (let i2 = start; i2 < end; i2++) {
        value = data2[i2];
        if ((value < 9 || value > 13) && value !== 32) {
          number += String.fromCharCode(value);
        } else {
          if (number !== "") {
            result[resultIndex] = parsingFunction(number, base);
            resultIndex++;
          }
          number = "";
        }
      }
      if (number !== "") {
        result[resultIndex] = parsingFunction(number, base);
        resultIndex++;
      }
      return result;
    }
    const _bytes = scan("uchar", data.byteLength);
    const _length = _bytes.length;
    let _header = null;
    let _data_start = 0;
    let i;
    for (i = 1; i < _length; i++) {
      if (_bytes[i - 1] == 10 && _bytes[i] == 10) {
        _header = this.parseChars(_bytes, 0, i - 2);
        _data_start = i + 1;
        break;
      }
    }
    parseHeader(_header);
    _data = _bytes.subarray(_data_start);
    if (headerObject.encoding.substring(0, 2) === "gz") {
      _data = gunzipSync(new Uint8Array(_data));
    } else if (headerObject.encoding === "ascii" || headerObject.encoding === "text" || headerObject.encoding === "txt" || headerObject.encoding === "hex") {
      _data = parseDataAsText(_data);
    } else if (headerObject.encoding === "raw") {
      const _copy = new Uint8Array(_data.length);
      for (let i2 = 0; i2 < _data.length; i2++) {
        _copy[i2] = _data[i2];
      }
      _data = _copy;
    }
    _data = _data.buffer;
    const volume = new Volume();
    volume.header = headerObject;
    volume.data = new headerObject.__array(_data);
    const min_max = volume.computeMinMax();
    const min = min_max[0];
    const max = min_max[1];
    volume.windowLow = min;
    volume.windowHigh = max;
    volume.dimensions = [headerObject.sizes[0], headerObject.sizes[1], headerObject.sizes[2]];
    volume.xLength = volume.dimensions[0];
    volume.yLength = volume.dimensions[1];
    volume.zLength = volume.dimensions[2];
    const spacingX = new Vector3(
      headerObject.vectors[0][0],
      headerObject.vectors[0][1],
      headerObject.vectors[0][2]
    ).length();
    const spacingY = new Vector3(
      headerObject.vectors[1][0],
      headerObject.vectors[1][1],
      headerObject.vectors[1][2]
    ).length();
    const spacingZ = new Vector3(
      headerObject.vectors[2][0],
      headerObject.vectors[2][1],
      headerObject.vectors[2][2]
    ).length();
    volume.spacing = [spacingX, spacingY, spacingZ];
    volume.matrix = new Matrix4();
    let _spaceX = 1;
    let _spaceY = 1;
    const _spaceZ = 1;
    if (headerObject.space == "left-posterior-superior") {
      _spaceX = -1;
      _spaceY = -1;
    } else if (headerObject.space === "left-anterior-superior") {
      _spaceX = -1;
    }
    if (!headerObject.vectors) {
      volume.matrix.set(_spaceX, 0, 0, 0, 0, _spaceY, 0, 0, 0, 0, _spaceZ, 0, 0, 0, 0, 1);
    } else {
      const v = headerObject.vectors;
      volume.matrix.set(
        _spaceX * v[0][0],
        _spaceX * v[1][0],
        _spaceX * v[2][0],
        0,
        _spaceY * v[0][1],
        _spaceY * v[1][1],
        _spaceY * v[2][1],
        0,
        _spaceZ * v[0][2],
        _spaceZ * v[1][2],
        _spaceZ * v[2][2],
        0,
        0,
        0,
        0,
        1
      );
    }
    volume.inverseMatrix = new Matrix4();
    volume.inverseMatrix.copy(volume.matrix).invert();
    volume.RASDimensions = new Vector3(volume.xLength, volume.yLength, volume.zLength).applyMatrix4(volume.matrix).round().toArray().map(Math.abs);
    if (volume.lowerThreshold === -Infinity) {
      volume.lowerThreshold = min;
    }
    if (volume.upperThreshold === Infinity) {
      volume.upperThreshold = max;
    }
    return volume;
  }
  parseChars(array, start, end) {
    if (start === void 0) {
      start = 0;
    }
    if (end === void 0) {
      end = array.length;
    }
    let output = "";
    let i = 0;
    for (i = start; i < end; ++i) {
      output += String.fromCharCode(array[i]);
    }
    return output;
  }
}
const _fieldFunctions = {
  type: function(data) {
    switch (data) {
      case "uchar":
      case "unsigned char":
      case "uint8":
      case "uint8_t":
        this.__array = Uint8Array;
        break;
      case "signed char":
      case "int8":
      case "int8_t":
        this.__array = Int8Array;
        break;
      case "short":
      case "short int":
      case "signed short":
      case "signed short int":
      case "int16":
      case "int16_t":
        this.__array = Int16Array;
        break;
      case "ushort":
      case "unsigned short":
      case "unsigned short int":
      case "uint16":
      case "uint16_t":
        this.__array = Uint16Array;
        break;
      case "int":
      case "signed int":
      case "int32":
      case "int32_t":
        this.__array = Int32Array;
        break;
      case "uint":
      case "unsigned int":
      case "uint32":
      case "uint32_t":
        this.__array = Uint32Array;
        break;
      case "float":
        this.__array = Float32Array;
        break;
      case "double":
        this.__array = Float64Array;
        break;
      default:
        throw new Error("Unsupported NRRD data type: " + data);
    }
    return this.type = data;
  },
  endian: function(data) {
    return this.endian = data;
  },
  encoding: function(data) {
    return this.encoding = data;
  },
  dimension: function(data) {
    return this.dim = parseInt(data, 10);
  },
  sizes: function(data) {
    let i;
    return this.sizes = function() {
      const _ref = data.split(/\s+/);
      const _results = [];
      for (let _i = 0, _len = _ref.length; _i < _len; _i++) {
        i = _ref[_i];
        _results.push(parseInt(i, 10));
      }
      return _results;
    }();
  },
  space: function(data) {
    return this.space = data;
  },
  "space origin": function(data) {
    return this.space_origin = data.split("(")[1].split(")")[0].split(",");
  },
  "space directions": function(data) {
    let f, v;
    const parts = data.match(/\(.*?\)/g);
    return this.vectors = function() {
      const _results = [];
      for (let _i = 0, _len = parts.length; _i < _len; _i++) {
        v = parts[_i];
        _results.push(
          function() {
            const _ref = v.slice(1, -1).split(/,/);
            const _results2 = [];
            for (let _j = 0, _len2 = _ref.length; _j < _len2; _j++) {
              f = _ref[_j];
              _results2.push(parseFloat(f));
            }
            return _results2;
          }()
        );
      }
      return _results;
    }();
  },
  spacings: function(data) {
    let f;
    const parts = data.split(/\s+/);
    return this.spacings = function() {
      const _results = [];
      for (let _i = 0, _len = parts.length; _i < _len; _i++) {
        f = parts[_i];
        _results.push(parseFloat(f));
      }
      return _results;
    }();
  }
};
export {
  NRRDLoader
};
//# sourceMappingURL=NRRDLoader.js.map
