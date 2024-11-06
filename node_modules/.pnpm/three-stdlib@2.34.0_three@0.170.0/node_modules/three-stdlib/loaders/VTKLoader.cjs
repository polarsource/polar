"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const fflate = require("fflate");
const LoaderUtils = require("../_polyfill/LoaderUtils.cjs");
class VTKLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new THREE.FileLoader(scope.manager);
    loader.setPath(scope.path);
    loader.setResponseType("arraybuffer");
    loader.setRequestHeader(scope.requestHeader);
    loader.setWithCredentials(scope.withCredentials);
    loader.load(
      url,
      function(text) {
        try {
          onLoad(scope.parse(text));
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
    function parseASCII(data2) {
      var indices = [];
      var positions = [];
      var colors = [];
      var normals = [];
      var result;
      var patWord = /^[^\d.\s-]+/;
      var pat3Floats = /(\-?\d+\.?[\d\-\+e]*)\s+(\-?\d+\.?[\d\-\+e]*)\s+(\-?\d+\.?[\d\-\+e]*)/g;
      var patConnectivity = /^(\d+)\s+([\s\d]*)/;
      var patPOINTS = /^POINTS /;
      var patPOLYGONS = /^POLYGONS /;
      var patTRIANGLE_STRIPS = /^TRIANGLE_STRIPS /;
      var patPOINT_DATA = /^POINT_DATA[ ]+(\d+)/;
      var patCELL_DATA = /^CELL_DATA[ ]+(\d+)/;
      var patCOLOR_SCALARS = /^COLOR_SCALARS[ ]+(\w+)[ ]+3/;
      var patNORMALS = /^NORMALS[ ]+(\w+)[ ]+(\w+)/;
      var inPointsSection = false;
      var inPolygonsSection = false;
      var inTriangleStripSection = false;
      var inPointDataSection = false;
      var inCellDataSection = false;
      var inColorSection = false;
      var inNormalsSection = false;
      var lines = data2.split("\n");
      for (var i in lines) {
        var line = lines[i].trim();
        if (line.indexOf("DATASET") === 0) {
          var dataset = line.split(" ")[1];
          if (dataset !== "POLYDATA")
            throw new Error("Unsupported DATASET type: " + dataset);
        } else if (inPointsSection) {
          while ((result = pat3Floats.exec(line)) !== null) {
            if (patWord.exec(line) !== null)
              break;
            var x = parseFloat(result[1]);
            var y = parseFloat(result[2]);
            var z = parseFloat(result[3]);
            positions.push(x, y, z);
          }
        } else if (inPolygonsSection) {
          if ((result = patConnectivity.exec(line)) !== null) {
            var numVertices = parseInt(result[1]);
            var inds = result[2].split(/\s+/);
            if (numVertices >= 3) {
              var i0 = parseInt(inds[0]);
              var i1, i2;
              var k = 1;
              for (var j = 0; j < numVertices - 2; ++j) {
                i1 = parseInt(inds[k]);
                i2 = parseInt(inds[k + 1]);
                indices.push(i0, i1, i2);
                k++;
              }
            }
          }
        } else if (inTriangleStripSection) {
          if ((result = patConnectivity.exec(line)) !== null) {
            var numVertices = parseInt(result[1]);
            var inds = result[2].split(/\s+/);
            if (numVertices >= 3) {
              var i0, i1, i2;
              for (var j = 0; j < numVertices - 2; j++) {
                if (j % 2 === 1) {
                  i0 = parseInt(inds[j]);
                  i1 = parseInt(inds[j + 2]);
                  i2 = parseInt(inds[j + 1]);
                  indices.push(i0, i1, i2);
                } else {
                  i0 = parseInt(inds[j]);
                  i1 = parseInt(inds[j + 1]);
                  i2 = parseInt(inds[j + 2]);
                  indices.push(i0, i1, i2);
                }
              }
            }
          }
        } else if (inPointDataSection || inCellDataSection) {
          if (inColorSection) {
            while ((result = pat3Floats.exec(line)) !== null) {
              if (patWord.exec(line) !== null)
                break;
              var r = parseFloat(result[1]);
              var g = parseFloat(result[2]);
              var b = parseFloat(result[3]);
              colors.push(r, g, b);
            }
          } else if (inNormalsSection) {
            while ((result = pat3Floats.exec(line)) !== null) {
              if (patWord.exec(line) !== null)
                break;
              var nx = parseFloat(result[1]);
              var ny = parseFloat(result[2]);
              var nz = parseFloat(result[3]);
              normals.push(nx, ny, nz);
            }
          }
        }
        if (patPOLYGONS.exec(line) !== null) {
          inPolygonsSection = true;
          inPointsSection = false;
          inTriangleStripSection = false;
        } else if (patPOINTS.exec(line) !== null) {
          inPolygonsSection = false;
          inPointsSection = true;
          inTriangleStripSection = false;
        } else if (patTRIANGLE_STRIPS.exec(line) !== null) {
          inPolygonsSection = false;
          inPointsSection = false;
          inTriangleStripSection = true;
        } else if (patPOINT_DATA.exec(line) !== null) {
          inPointDataSection = true;
          inPointsSection = false;
          inPolygonsSection = false;
          inTriangleStripSection = false;
        } else if (patCELL_DATA.exec(line) !== null) {
          inCellDataSection = true;
          inPointsSection = false;
          inPolygonsSection = false;
          inTriangleStripSection = false;
        } else if (patCOLOR_SCALARS.exec(line) !== null) {
          inColorSection = true;
          inNormalsSection = false;
          inPointsSection = false;
          inPolygonsSection = false;
          inTriangleStripSection = false;
        } else if (patNORMALS.exec(line) !== null) {
          inNormalsSection = true;
          inColorSection = false;
          inPointsSection = false;
          inPolygonsSection = false;
          inTriangleStripSection = false;
        }
      }
      var geometry = new THREE.BufferGeometry();
      geometry.setIndex(indices);
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      if (normals.length === positions.length) {
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      }
      if (colors.length !== indices.length) {
        if (colors.length === positions.length) {
          geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        }
      } else {
        geometry = geometry.toNonIndexed();
        var numTriangles = geometry.attributes.position.count / 3;
        if (colors.length === numTriangles * 3) {
          var newColors = [];
          for (var i = 0; i < numTriangles; i++) {
            var r = colors[3 * i + 0];
            var g = colors[3 * i + 1];
            var b = colors[3 * i + 2];
            newColors.push(r, g, b);
            newColors.push(r, g, b);
            newColors.push(r, g, b);
          }
          geometry.setAttribute("color", new THREE.Float32BufferAttribute(newColors, 3));
        }
      }
      return geometry;
    }
    function parseBinary(data2) {
      var count, pointIndex, i, numberOfPoints, s;
      var buffer = new Uint8Array(data2);
      var dataView = new DataView(data2);
      var points = [];
      var normals = [];
      var indices = [];
      var index = 0;
      function findString(buffer2, start) {
        var index2 = start;
        var c = buffer2[index2];
        var s2 = [];
        while (c !== 10) {
          s2.push(String.fromCharCode(c));
          index2++;
          c = buffer2[index2];
        }
        return { start, end: index2, next: index2 + 1, parsedString: s2.join("") };
      }
      var state, line;
      while (true) {
        state = findString(buffer, index);
        line = state.parsedString;
        if (line.indexOf("DATASET") === 0) {
          var dataset = line.split(" ")[1];
          if (dataset !== "POLYDATA")
            throw new Error("Unsupported DATASET type: " + dataset);
        } else if (line.indexOf("POINTS") === 0) {
          numberOfPoints = parseInt(line.split(" ")[1], 10);
          count = numberOfPoints * 4 * 3;
          points = new Float32Array(numberOfPoints * 3);
          pointIndex = state.next;
          for (i = 0; i < numberOfPoints; i++) {
            points[3 * i] = dataView.getFloat32(pointIndex, false);
            points[3 * i + 1] = dataView.getFloat32(pointIndex + 4, false);
            points[3 * i + 2] = dataView.getFloat32(pointIndex + 8, false);
            pointIndex = pointIndex + 12;
          }
          state.next = state.next + count + 1;
        } else if (line.indexOf("TRIANGLE_STRIPS") === 0) {
          var numberOfStrips = parseInt(line.split(" ")[1], 10);
          var size = parseInt(line.split(" ")[2], 10);
          count = size * 4;
          indices = new Uint32Array(3 * size - 9 * numberOfStrips);
          var indicesIndex = 0;
          pointIndex = state.next;
          for (i = 0; i < numberOfStrips; i++) {
            var indexCount = dataView.getInt32(pointIndex, false);
            var strip = [];
            pointIndex += 4;
            for (s = 0; s < indexCount; s++) {
              strip.push(dataView.getInt32(pointIndex, false));
              pointIndex += 4;
            }
            for (var j = 0; j < indexCount - 2; j++) {
              if (j % 2) {
                indices[indicesIndex++] = strip[j];
                indices[indicesIndex++] = strip[j + 2];
                indices[indicesIndex++] = strip[j + 1];
              } else {
                indices[indicesIndex++] = strip[j];
                indices[indicesIndex++] = strip[j + 1];
                indices[indicesIndex++] = strip[j + 2];
              }
            }
          }
          state.next = state.next + count + 1;
        } else if (line.indexOf("POLYGONS") === 0) {
          var numberOfStrips = parseInt(line.split(" ")[1], 10);
          var size = parseInt(line.split(" ")[2], 10);
          count = size * 4;
          indices = new Uint32Array(3 * size - 9 * numberOfStrips);
          var indicesIndex = 0;
          pointIndex = state.next;
          for (i = 0; i < numberOfStrips; i++) {
            var indexCount = dataView.getInt32(pointIndex, false);
            var strip = [];
            pointIndex += 4;
            for (s = 0; s < indexCount; s++) {
              strip.push(dataView.getInt32(pointIndex, false));
              pointIndex += 4;
            }
            for (var j = 1; j < indexCount - 1; j++) {
              indices[indicesIndex++] = strip[0];
              indices[indicesIndex++] = strip[j];
              indices[indicesIndex++] = strip[j + 1];
            }
          }
          state.next = state.next + count + 1;
        } else if (line.indexOf("POINT_DATA") === 0) {
          numberOfPoints = parseInt(line.split(" ")[1], 10);
          state = findString(buffer, state.next);
          count = numberOfPoints * 4 * 3;
          normals = new Float32Array(numberOfPoints * 3);
          pointIndex = state.next;
          for (i = 0; i < numberOfPoints; i++) {
            normals[3 * i] = dataView.getFloat32(pointIndex, false);
            normals[3 * i + 1] = dataView.getFloat32(pointIndex + 4, false);
            normals[3 * i + 2] = dataView.getFloat32(pointIndex + 8, false);
            pointIndex += 12;
          }
          state.next = state.next + count;
        }
        index = state.next;
        if (index >= buffer.byteLength) {
          break;
        }
      }
      var geometry = new THREE.BufferGeometry();
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
      if (normals.length === points.length) {
        geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      }
      return geometry;
    }
    function Float32Concat(first, second) {
      const firstLength = first.length, result = new Float32Array(firstLength + second.length);
      result.set(first);
      result.set(second, firstLength);
      return result;
    }
    function Int32Concat(first, second) {
      var firstLength = first.length, result = new Int32Array(firstLength + second.length);
      result.set(first);
      result.set(second, firstLength);
      return result;
    }
    function parseXML(stringFile) {
      function xmlToJson(xml) {
        var obj = {};
        if (xml.nodeType === 1) {
          if (xml.attributes) {
            if (xml.attributes.length > 0) {
              obj["attributes"] = {};
              for (var j2 = 0; j2 < xml.attributes.length; j2++) {
                var attribute = xml.attributes.item(j2);
                obj["attributes"][attribute.nodeName] = attribute.nodeValue.trim();
              }
            }
          }
        } else if (xml.nodeType === 3) {
          obj = xml.nodeValue.trim();
        }
        if (xml.hasChildNodes()) {
          for (var i2 = 0; i2 < xml.childNodes.length; i2++) {
            var item = xml.childNodes.item(i2);
            var nodeName = item.nodeName;
            if (typeof obj[nodeName] === "undefined") {
              var tmp = xmlToJson(item);
              if (tmp !== "")
                obj[nodeName] = tmp;
            } else {
              if (typeof obj[nodeName].push === "undefined") {
                var old = obj[nodeName];
                obj[nodeName] = [old];
              }
              var tmp = xmlToJson(item);
              if (tmp !== "")
                obj[nodeName].push(tmp);
            }
          }
        }
        return obj;
      }
      function Base64toByteArray(b64) {
        var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
        var i2;
        var revLookup = [];
        var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var len2 = code.length;
        for (i2 = 0; i2 < len2; i2++) {
        }
        for (i2 = 0; i2 < len2; ++i2) {
          revLookup[code.charCodeAt(i2)] = i2;
        }
        revLookup["-".charCodeAt(0)] = 62;
        revLookup["_".charCodeAt(0)] = 63;
        var j2, l, tmp, placeHolders, arr2;
        var len2 = b64.length;
        if (len2 % 4 > 0) {
          throw new Error("Invalid string. Length must be a multiple of 4");
        }
        placeHolders = b64[len2 - 2] === "=" ? 2 : b64[len2 - 1] === "=" ? 1 : 0;
        arr2 = new Arr(len2 * 3 / 4 - placeHolders);
        l = placeHolders > 0 ? len2 - 4 : len2;
        var L = 0;
        for (i2 = 0, j2 = 0; i2 < l; i2 += 4, j2 += 3) {
          tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
          arr2[L++] = (tmp & 16711680) >> 16;
          arr2[L++] = (tmp & 65280) >> 8;
          arr2[L++] = tmp & 255;
        }
        if (placeHolders === 2) {
          tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
          arr2[L++] = tmp & 255;
        } else if (placeHolders === 1) {
          tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
          arr2[L++] = tmp >> 8 & 255;
          arr2[L++] = tmp & 255;
        }
        return arr2;
      }
      function parseDataArray(ele, compressed2) {
        var numBytes = 0;
        if (json.attributes.header_type === "UInt64") {
          numBytes = 8;
        } else if (json.attributes.header_type === "UInt32") {
          numBytes = 4;
        }
        if (ele.attributes.format === "binary" && compressed2) {
          var rawData, content, byteData, blocks, cSizeStart, headerSize, padding, dataOffsets, currentOffset;
          if (ele.attributes.type === "Float32") {
            var txt = new Float32Array();
          } else if (ele.attributes.type === "Int64") {
            var txt = new Int32Array();
          }
          rawData = ele["#text"];
          byteData = Base64toByteArray(rawData);
          blocks = byteData[0];
          for (var i2 = 1; i2 < numBytes - 1; i2++) {
            blocks = blocks | byteData[i2] << i2 * numBytes;
          }
          headerSize = (blocks + 3) * numBytes;
          padding = headerSize % 3 > 0 ? 3 - headerSize % 3 : 0;
          headerSize = headerSize + padding;
          dataOffsets = [];
          currentOffset = headerSize;
          dataOffsets.push(currentOffset);
          cSizeStart = 3 * numBytes;
          for (var i2 = 0; i2 < blocks; i2++) {
            var currentBlockSize = byteData[i2 * numBytes + cSizeStart];
            for (var j2 = 1; j2 < numBytes - 1; j2++) {
              currentBlockSize = currentBlockSize | byteData[i2 * numBytes + cSizeStart + j2] << j2 * 8;
            }
            currentOffset = currentOffset + currentBlockSize;
            dataOffsets.push(currentOffset);
          }
          for (var i2 = 0; i2 < dataOffsets.length - 1; i2++) {
            var data2 = fflate.unzlibSync(byteData.slice(dataOffsets[i2], dataOffsets[i2 + 1]));
            content = data2.buffer;
            if (ele.attributes.type === "Float32") {
              content = new Float32Array(content);
              txt = Float32Concat(txt, content);
            } else if (ele.attributes.type === "Int64") {
              content = new Int32Array(content);
              txt = Int32Concat(txt, content);
            }
          }
          delete ele["#text"];
          if (ele.attributes.type === "Int64") {
            if (ele.attributes.format === "binary") {
              txt = txt.filter(function(el, idx) {
                if (idx % 2 !== 1)
                  return true;
              });
            }
          }
        } else {
          if (ele.attributes.format === "binary" && !compressed2) {
            var content = Base64toByteArray(ele["#text"]);
            content = content.slice(numBytes).buffer;
          } else {
            if (ele["#text"]) {
              var content = ele["#text"].split(/\s+/).filter(function(el) {
                if (el !== "")
                  return el;
              });
            } else {
              var content = new Int32Array(0).buffer;
            }
          }
          delete ele["#text"];
          if (ele.attributes.type === "Float32") {
            var txt = new Float32Array(content);
          } else if (ele.attributes.type === "Int32") {
            var txt = new Int32Array(content);
          } else if (ele.attributes.type === "Int64") {
            var txt = new Int32Array(content);
            if (ele.attributes.format === "binary") {
              txt = txt.filter(function(el, idx) {
                if (idx % 2 !== 1)
                  return true;
              });
            }
          }
        }
        return txt;
      }
      var dom = null;
      if (window.DOMParser) {
        try {
          dom = new DOMParser().parseFromString(stringFile, "text/xml");
        } catch (e) {
          dom = null;
        }
      } else if (window.ActiveXObject) {
        try {
          dom = new ActiveXObject("Microsoft.XMLDOM");
          dom.async = false;
          if (!dom.loadXML(
            /* xml */
          )) {
            throw new Error(dom.parseError.reason + dom.parseError.srcText);
          }
        } catch (e) {
          dom = null;
        }
      } else {
        throw new Error("Cannot parse xml string!");
      }
      var doc = dom.documentElement;
      var json = xmlToJson(doc);
      var points = [];
      var normals = [];
      var indices = [];
      if (json.PolyData) {
        var piece = json.PolyData.Piece;
        var compressed = json.attributes.hasOwnProperty("compressor");
        var sections = ["PointData", "Points", "Strips", "Polys"];
        var sectionIndex = 0, numberOfSections = sections.length;
        while (sectionIndex < numberOfSections) {
          var section = piece[sections[sectionIndex]];
          if (section && section.DataArray) {
            if (Object.prototype.toString.call(section.DataArray) === "[object Array]") {
              var arr = section.DataArray;
            } else {
              var arr = [section.DataArray];
            }
            var dataArrayIndex = 0, numberOfDataArrays = arr.length;
            while (dataArrayIndex < numberOfDataArrays) {
              if ("#text" in arr[dataArrayIndex] && arr[dataArrayIndex]["#text"].length > 0) {
                arr[dataArrayIndex].text = parseDataArray(arr[dataArrayIndex], compressed);
              }
              dataArrayIndex++;
            }
            switch (sections[sectionIndex]) {
              case "PointData":
                var numberOfPoints = parseInt(piece.attributes.NumberOfPoints);
                var normalsName = section.attributes.Normals;
                if (numberOfPoints > 0) {
                  for (var i = 0, len = arr.length; i < len; i++) {
                    if (normalsName === arr[i].attributes.Name) {
                      var components = arr[i].attributes.NumberOfComponents;
                      normals = new Float32Array(numberOfPoints * components);
                      normals.set(arr[i].text, 0);
                    }
                  }
                }
                break;
              case "Points":
                var numberOfPoints = parseInt(piece.attributes.NumberOfPoints);
                if (numberOfPoints > 0) {
                  var components = section.DataArray.attributes.NumberOfComponents;
                  points = new Float32Array(numberOfPoints * components);
                  points.set(section.DataArray.text, 0);
                }
                break;
              case "Strips":
                var numberOfStrips = parseInt(piece.attributes.NumberOfStrips);
                if (numberOfStrips > 0) {
                  var connectivity = new Int32Array(section.DataArray[0].text.length);
                  var offset = new Int32Array(section.DataArray[1].text.length);
                  connectivity.set(section.DataArray[0].text, 0);
                  offset.set(section.DataArray[1].text, 0);
                  var size = numberOfStrips + connectivity.length;
                  indices = new Uint32Array(3 * size - 9 * numberOfStrips);
                  var indicesIndex = 0;
                  for (var i = 0, len = numberOfStrips; i < len; i++) {
                    var strip = [];
                    for (var s = 0, len1 = offset[i], len0 = 0; s < len1 - len0; s++) {
                      strip.push(connectivity[s]);
                      if (i > 0)
                        len0 = offset[i - 1];
                    }
                    for (var j = 0, len1 = offset[i], len0 = 0; j < len1 - len0 - 2; j++) {
                      if (j % 2) {
                        indices[indicesIndex++] = strip[j];
                        indices[indicesIndex++] = strip[j + 2];
                        indices[indicesIndex++] = strip[j + 1];
                      } else {
                        indices[indicesIndex++] = strip[j];
                        indices[indicesIndex++] = strip[j + 1];
                        indices[indicesIndex++] = strip[j + 2];
                      }
                      if (i > 0)
                        len0 = offset[i - 1];
                    }
                  }
                }
                break;
              case "Polys":
                var numberOfPolys = parseInt(piece.attributes.NumberOfPolys);
                if (numberOfPolys > 0) {
                  var connectivity = new Int32Array(section.DataArray[0].text.length);
                  var offset = new Int32Array(section.DataArray[1].text.length);
                  connectivity.set(section.DataArray[0].text, 0);
                  offset.set(section.DataArray[1].text, 0);
                  var size = numberOfPolys + connectivity.length;
                  indices = new Uint32Array(3 * size - 9 * numberOfPolys);
                  var indicesIndex = 0, connectivityIndex = 0;
                  var i = 0, len = numberOfPolys, len0 = 0;
                  while (i < len) {
                    var poly = [];
                    var s = 0, len1 = offset[i];
                    while (s < len1 - len0) {
                      poly.push(connectivity[connectivityIndex++]);
                      s++;
                    }
                    var j = 1;
                    while (j < len1 - len0 - 1) {
                      indices[indicesIndex++] = poly[0];
                      indices[indicesIndex++] = poly[j];
                      indices[indicesIndex++] = poly[j + 1];
                      j++;
                    }
                    i++;
                    len0 = offset[i - 1];
                  }
                }
                break;
            }
          }
          sectionIndex++;
        }
        var geometry = new THREE.BufferGeometry();
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
        if (normals.length === points.length) {
          geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
        }
        return geometry;
      } else {
        throw new Error("Unsupported DATASET type");
      }
    }
    var meta = LoaderUtils.decodeText(new Uint8Array(data, 0, 250)).split("\n");
    if (meta[0].indexOf("xml") !== -1) {
      return parseXML(LoaderUtils.decodeText(data));
    } else if (meta[2].includes("ASCII")) {
      return parseASCII(LoaderUtils.decodeText(data));
    } else {
      return parseBinary(data);
    }
  }
}
exports.VTKLoader = VTKLoader;
//# sourceMappingURL=VTKLoader.cjs.map
