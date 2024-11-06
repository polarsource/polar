import { Loader, FileLoader, BufferGeometry, Float32BufferAttribute, PointsMaterial, Points } from "three";
import { decodeText } from "../_polyfill/LoaderUtils.js";
class PCDLoader extends Loader {
  constructor(manager) {
    super(manager);
    this.littleEndian = true;
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
          onLoad(scope.parse(data, url));
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
  parse(data, url) {
    function decompressLZF(inData, outLength) {
      const inLength = inData.length;
      const outData = new Uint8Array(outLength);
      let inPtr = 0;
      let outPtr = 0;
      let ctrl;
      let len;
      let ref;
      do {
        ctrl = inData[inPtr++];
        if (ctrl < 1 << 5) {
          ctrl++;
          if (outPtr + ctrl > outLength)
            throw new Error("Output buffer is not large enough");
          if (inPtr + ctrl > inLength)
            throw new Error("Invalid compressed data");
          do {
            outData[outPtr++] = inData[inPtr++];
          } while (--ctrl);
        } else {
          len = ctrl >> 5;
          ref = outPtr - ((ctrl & 31) << 8) - 1;
          if (inPtr >= inLength)
            throw new Error("Invalid compressed data");
          if (len === 7) {
            len += inData[inPtr++];
            if (inPtr >= inLength)
              throw new Error("Invalid compressed data");
          }
          ref -= inData[inPtr++];
          if (outPtr + len + 2 > outLength)
            throw new Error("Output buffer is not large enough");
          if (ref < 0)
            throw new Error("Invalid compressed data");
          if (ref >= outPtr)
            throw new Error("Invalid compressed data");
          do {
            outData[outPtr++] = outData[ref++];
          } while (--len + 2);
        }
      } while (inPtr < inLength);
      return outData;
    }
    function parseHeader(data2) {
      const PCDheader2 = {};
      const result1 = data2.search(/[\r\n]DATA\s(\S*)\s/i);
      const result2 = /[\r\n]DATA\s(\S*)\s/i.exec(data2.substr(result1 - 1));
      PCDheader2.data = result2[1];
      PCDheader2.headerLen = result2[0].length + result1;
      PCDheader2.str = data2.substr(0, PCDheader2.headerLen);
      PCDheader2.str = PCDheader2.str.replace(/\#.*/gi, "");
      PCDheader2.version = /VERSION (.*)/i.exec(PCDheader2.str);
      PCDheader2.fields = /FIELDS (.*)/i.exec(PCDheader2.str);
      PCDheader2.size = /SIZE (.*)/i.exec(PCDheader2.str);
      PCDheader2.type = /TYPE (.*)/i.exec(PCDheader2.str);
      PCDheader2.count = /COUNT (.*)/i.exec(PCDheader2.str);
      PCDheader2.width = /WIDTH (.*)/i.exec(PCDheader2.str);
      PCDheader2.height = /HEIGHT (.*)/i.exec(PCDheader2.str);
      PCDheader2.viewpoint = /VIEWPOINT (.*)/i.exec(PCDheader2.str);
      PCDheader2.points = /POINTS (.*)/i.exec(PCDheader2.str);
      if (PCDheader2.version !== null)
        PCDheader2.version = parseFloat(PCDheader2.version[1]);
      if (PCDheader2.fields !== null)
        PCDheader2.fields = PCDheader2.fields[1].split(" ");
      if (PCDheader2.type !== null)
        PCDheader2.type = PCDheader2.type[1].split(" ");
      if (PCDheader2.width !== null)
        PCDheader2.width = parseInt(PCDheader2.width[1]);
      if (PCDheader2.height !== null)
        PCDheader2.height = parseInt(PCDheader2.height[1]);
      if (PCDheader2.viewpoint !== null)
        PCDheader2.viewpoint = PCDheader2.viewpoint[1];
      if (PCDheader2.points !== null)
        PCDheader2.points = parseInt(PCDheader2.points[1], 10);
      if (PCDheader2.points === null)
        PCDheader2.points = PCDheader2.width * PCDheader2.height;
      if (PCDheader2.size !== null) {
        PCDheader2.size = PCDheader2.size[1].split(" ").map(function(x) {
          return parseInt(x, 10);
        });
      }
      if (PCDheader2.count !== null) {
        PCDheader2.count = PCDheader2.count[1].split(" ").map(function(x) {
          return parseInt(x, 10);
        });
      } else {
        PCDheader2.count = [];
        for (let i = 0, l = PCDheader2.fields.length; i < l; i++) {
          PCDheader2.count.push(1);
        }
      }
      PCDheader2.offset = {};
      let sizeSum = 0;
      for (let i = 0, l = PCDheader2.fields.length; i < l; i++) {
        if (PCDheader2.data === "ascii") {
          PCDheader2.offset[PCDheader2.fields[i]] = i;
        } else {
          PCDheader2.offset[PCDheader2.fields[i]] = sizeSum;
          sizeSum += PCDheader2.size[i] * PCDheader2.count[i];
        }
      }
      PCDheader2.rowSize = sizeSum;
      return PCDheader2;
    }
    const textData = decodeText(new Uint8Array(data));
    const PCDheader = parseHeader(textData);
    const position = [];
    const normal = [];
    const color = [];
    if (PCDheader.data === "ascii") {
      const offset = PCDheader.offset;
      const pcdData = textData.substr(PCDheader.headerLen);
      const lines = pcdData.split("\n");
      for (let i = 0, l = lines.length; i < l; i++) {
        if (lines[i] === "")
          continue;
        const line = lines[i].split(" ");
        if (offset.x !== void 0) {
          position.push(parseFloat(line[offset.x]));
          position.push(parseFloat(line[offset.y]));
          position.push(parseFloat(line[offset.z]));
        }
        if (offset.rgb !== void 0) {
          const rgb = parseFloat(line[offset.rgb]);
          const r = rgb >> 16 & 255;
          const g = rgb >> 8 & 255;
          const b = rgb >> 0 & 255;
          color.push(r / 255, g / 255, b / 255);
        }
        if (offset.normal_x !== void 0) {
          normal.push(parseFloat(line[offset.normal_x]));
          normal.push(parseFloat(line[offset.normal_y]));
          normal.push(parseFloat(line[offset.normal_z]));
        }
      }
    }
    if (PCDheader.data === "binary_compressed") {
      const sizes = new Uint32Array(data.slice(PCDheader.headerLen, PCDheader.headerLen + 8));
      const compressedSize = sizes[0];
      const decompressedSize = sizes[1];
      const decompressed = decompressLZF(
        new Uint8Array(data, PCDheader.headerLen + 8, compressedSize),
        decompressedSize
      );
      const dataview = new DataView(decompressed.buffer);
      const offset = PCDheader.offset;
      for (let i = 0; i < PCDheader.points; i++) {
        if (offset.x !== void 0) {
          position.push(dataview.getFloat32(PCDheader.points * offset.x + PCDheader.size[0] * i, this.littleEndian));
          position.push(dataview.getFloat32(PCDheader.points * offset.y + PCDheader.size[1] * i, this.littleEndian));
          position.push(dataview.getFloat32(PCDheader.points * offset.z + PCDheader.size[2] * i, this.littleEndian));
        }
        if (offset.rgb !== void 0) {
          color.push(dataview.getUint8(PCDheader.points * offset.rgb + PCDheader.size[3] * i + 2) / 255);
          color.push(dataview.getUint8(PCDheader.points * offset.rgb + PCDheader.size[3] * i + 1) / 255);
          color.push(dataview.getUint8(PCDheader.points * offset.rgb + PCDheader.size[3] * i + 0) / 255);
        }
        if (offset.normal_x !== void 0) {
          normal.push(
            dataview.getFloat32(PCDheader.points * offset.normal_x + PCDheader.size[4] * i, this.littleEndian)
          );
          normal.push(
            dataview.getFloat32(PCDheader.points * offset.normal_y + PCDheader.size[5] * i, this.littleEndian)
          );
          normal.push(
            dataview.getFloat32(PCDheader.points * offset.normal_z + PCDheader.size[6] * i, this.littleEndian)
          );
        }
      }
    }
    if (PCDheader.data === "binary") {
      const dataview = new DataView(data, PCDheader.headerLen);
      const offset = PCDheader.offset;
      for (let i = 0, row = 0; i < PCDheader.points; i++, row += PCDheader.rowSize) {
        if (offset.x !== void 0) {
          position.push(dataview.getFloat32(row + offset.x, this.littleEndian));
          position.push(dataview.getFloat32(row + offset.y, this.littleEndian));
          position.push(dataview.getFloat32(row + offset.z, this.littleEndian));
        }
        if (offset.rgb !== void 0) {
          color.push(dataview.getUint8(row + offset.rgb + 2) / 255);
          color.push(dataview.getUint8(row + offset.rgb + 1) / 255);
          color.push(dataview.getUint8(row + offset.rgb + 0) / 255);
        }
        if (offset.normal_x !== void 0) {
          normal.push(dataview.getFloat32(row + offset.normal_x, this.littleEndian));
          normal.push(dataview.getFloat32(row + offset.normal_y, this.littleEndian));
          normal.push(dataview.getFloat32(row + offset.normal_z, this.littleEndian));
        }
      }
    }
    const geometry = new BufferGeometry();
    if (position.length > 0)
      geometry.setAttribute("position", new Float32BufferAttribute(position, 3));
    if (normal.length > 0)
      geometry.setAttribute("normal", new Float32BufferAttribute(normal, 3));
    if (color.length > 0)
      geometry.setAttribute("color", new Float32BufferAttribute(color, 3));
    geometry.computeBoundingSphere();
    const material = new PointsMaterial({ size: 5e-3 });
    if (color.length > 0) {
      material.vertexColors = true;
    } else {
      material.color.setHex(Math.random() * 16777215);
    }
    const mesh = new Points(geometry, material);
    let name = url.split("").reverse().join("");
    name = /([^\/]*)/.exec(name);
    name = name[1].split("").reverse().join("");
    mesh.name = name;
    return mesh;
  }
}
export {
  PCDLoader
};
//# sourceMappingURL=PCDLoader.js.map
