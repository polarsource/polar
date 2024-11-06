import { LWO2Parser } from "./LWO2Parser.js";
import { LWO3Parser } from "./LWO3Parser.js";
class IFFParser {
  constructor() {
    this.debugger = new Debugger();
  }
  parse(buffer) {
    this.reader = new DataViewReader(buffer);
    this.tree = {
      materials: {},
      layers: [],
      tags: [],
      textures: []
    };
    this.currentLayer = this.tree;
    this.currentForm = this.tree;
    this.parseTopForm();
    if (this.tree.format === void 0)
      return;
    if (this.tree.format === "LWO2") {
      this.parser = new LWO2Parser(this);
      while (!this.reader.endOfFile())
        this.parser.parseBlock();
    } else if (this.tree.format === "LWO3") {
      this.parser = new LWO3Parser(this);
      while (!this.reader.endOfFile())
        this.parser.parseBlock();
    }
    this.debugger.offset = this.reader.offset;
    this.debugger.closeForms();
    return this.tree;
  }
  parseTopForm() {
    this.debugger.offset = this.reader.offset;
    var topForm = this.reader.getIDTag();
    if (topForm !== "FORM") {
      console.warn("LWOLoader: Top-level FORM missing.");
      return;
    }
    var length = this.reader.getUint32();
    this.debugger.dataOffset = this.reader.offset;
    this.debugger.length = length;
    var type = this.reader.getIDTag();
    if (type === "LWO2") {
      this.tree.format = type;
    } else if (type === "LWO3") {
      this.tree.format = type;
    }
    this.debugger.node = 0;
    this.debugger.nodeID = type;
    this.debugger.log();
    return;
  }
  ///
  // FORM PARSING METHODS
  ///
  // Forms are organisational and can contain any number of sub chunks and sub forms
  // FORM ::= 'FORM'[ID4], length[U4], type[ID4], ( chunk[CHUNK] | form[FORM] ) * }
  parseForm(length) {
    var type = this.reader.getIDTag();
    switch (type) {
      case "ISEQ":
      case "ANIM":
      case "STCC":
      case "VPVL":
      case "VPRM":
      case "NROT":
      case "WRPW":
      case "WRPH":
      case "FUNC":
      case "FALL":
      case "OPAC":
      case "GRAD":
      case "ENVS":
      case "VMOP":
      case "VMBG":
      case "OMAX":
      case "STEX":
      case "CKBG":
      case "CKEY":
      case "VMLA":
      case "VMLB":
        this.debugger.skipped = true;
        this.skipForm(length);
        break;
      case "META":
      case "NNDS":
      case "NODS":
      case "NDTA":
      case "ADAT":
      case "AOVS":
      case "BLOK":
      case "IBGC":
      case "IOPC":
      case "IIMG":
      case "TXTR":
        this.debugger.length = 4;
        this.debugger.skipped = true;
        break;
      case "IFAL":
      case "ISCL":
      case "IPOS":
      case "IROT":
      case "IBMP":
      case "IUTD":
      case "IVTD":
        this.parseTextureNodeAttribute(type);
        break;
      case "ENVL":
        this.parseEnvelope(length);
        break;
      case "CLIP":
        if (this.tree.format === "LWO2") {
          this.parseForm(length);
        } else {
          this.parseClip(length);
        }
        break;
      case "STIL":
        this.parseImage();
        break;
      case "XREF":
        this.reader.skip(8);
        this.currentForm.referenceTexture = {
          index: this.reader.getUint32(),
          refName: this.reader.getString()
          // internal unique ref
        };
        break;
      case "IMST":
        this.parseImageStateForm(length);
        break;
      case "SURF":
        this.parseSurfaceForm(length);
        break;
      case "VALU":
        this.parseValueForm(length);
        break;
      case "NTAG":
        this.parseSubNode(length);
        break;
      case "ATTR":
      case "SATR":
        this.setupForm("attributes", length);
        break;
      case "NCON":
        this.parseConnections(length);
        break;
      case "SSHA":
        this.parentForm = this.currentForm;
        this.currentForm = this.currentSurface;
        this.setupForm("surfaceShader", length);
        break;
      case "SSHD":
        this.setupForm("surfaceShaderData", length);
        break;
      case "ENTR":
        this.parseEntryForm(length);
        break;
      case "IMAP":
        this.parseImageMap(length);
        break;
      case "TAMP":
        this.parseXVAL("amplitude", length);
        break;
      case "TMAP":
        this.setupForm("textureMap", length);
        break;
      case "CNTR":
        this.parseXVAL3("center", length);
        break;
      case "SIZE":
        this.parseXVAL3("scale", length);
        break;
      case "ROTA":
        this.parseXVAL3("rotation", length);
        break;
      default:
        this.parseUnknownForm(type, length);
    }
    this.debugger.node = 0;
    this.debugger.nodeID = type;
    this.debugger.log();
  }
  setupForm(type, length) {
    if (!this.currentForm)
      this.currentForm = this.currentNode;
    this.currentFormEnd = this.reader.offset + length;
    this.parentForm = this.currentForm;
    if (!this.currentForm[type]) {
      this.currentForm[type] = {};
      this.currentForm = this.currentForm[type];
    } else {
      console.warn("LWOLoader: form already exists on parent: ", type, this.currentForm);
      this.currentForm = this.currentForm[type];
    }
  }
  skipForm(length) {
    this.reader.skip(length - 4);
  }
  parseUnknownForm(type, length) {
    console.warn("LWOLoader: unknown FORM encountered: " + type, length);
    printBuffer(this.reader.dv.buffer, this.reader.offset, length - 4);
    this.reader.skip(length - 4);
  }
  parseSurfaceForm(length) {
    this.reader.skip(8);
    var name = this.reader.getString();
    var surface = {
      attributes: {},
      // LWO2 style non-node attributes will go here
      connections: {},
      name,
      inputName: name,
      nodes: {},
      source: this.reader.getString()
    };
    this.tree.materials[name] = surface;
    this.currentSurface = surface;
    this.parentForm = this.tree.materials;
    this.currentForm = surface;
    this.currentFormEnd = this.reader.offset + length;
  }
  parseSurfaceLwo2(length) {
    var name = this.reader.getString();
    var surface = {
      attributes: {},
      // LWO2 style non-node attributes will go here
      connections: {},
      name,
      nodes: {},
      source: this.reader.getString()
    };
    this.tree.materials[name] = surface;
    this.currentSurface = surface;
    this.parentForm = this.tree.materials;
    this.currentForm = surface;
    this.currentFormEnd = this.reader.offset + length;
  }
  parseSubNode(length) {
    this.reader.skip(8);
    var name = this.reader.getString();
    var node = {
      name
    };
    this.currentForm = node;
    this.currentNode = node;
    this.currentFormEnd = this.reader.offset + length;
  }
  // collect attributes from all nodes at the top level of a surface
  parseConnections(length) {
    this.currentFormEnd = this.reader.offset + length;
    this.parentForm = this.currentForm;
    this.currentForm = this.currentSurface.connections;
  }
  // surface node attribute data, e.g. specular, roughness etc
  parseEntryForm(length) {
    this.reader.skip(8);
    var name = this.reader.getString();
    this.currentForm = this.currentNode.attributes;
    this.setupForm(name, length);
  }
  // parse values from material - doesn't match up to other LWO3 data types
  // sub form of entry form
  parseValueForm() {
    this.reader.skip(8);
    var valueType = this.reader.getString();
    if (valueType === "double") {
      this.currentForm.value = this.reader.getUint64();
    } else if (valueType === "int") {
      this.currentForm.value = this.reader.getUint32();
    } else if (valueType === "vparam") {
      this.reader.skip(24);
      this.currentForm.value = this.reader.getFloat64();
    } else if (valueType === "vparam3") {
      this.reader.skip(24);
      this.currentForm.value = this.reader.getFloat64Array(3);
    }
  }
  // holds various data about texture node image state
  // Data other thanmipMapLevel unknown
  parseImageStateForm() {
    this.reader.skip(8);
    this.currentForm.mipMapLevel = this.reader.getFloat32();
  }
  // LWO2 style image data node OR LWO3 textures defined at top level in editor (not as SURF node)
  parseImageMap(length) {
    this.currentFormEnd = this.reader.offset + length;
    this.parentForm = this.currentForm;
    if (!this.currentForm.maps)
      this.currentForm.maps = [];
    var map = {};
    this.currentForm.maps.push(map);
    this.currentForm = map;
    this.reader.skip(10);
  }
  parseTextureNodeAttribute(type) {
    this.reader.skip(28);
    this.reader.skip(20);
    switch (type) {
      case "ISCL":
        this.currentNode.scale = this.reader.getFloat32Array(3);
        break;
      case "IPOS":
        this.currentNode.position = this.reader.getFloat32Array(3);
        break;
      case "IROT":
        this.currentNode.rotation = this.reader.getFloat32Array(3);
        break;
      case "IFAL":
        this.currentNode.falloff = this.reader.getFloat32Array(3);
        break;
      case "IBMP":
        this.currentNode.amplitude = this.reader.getFloat32();
        break;
      case "IUTD":
        this.currentNode.uTiles = this.reader.getFloat32();
        break;
      case "IVTD":
        this.currentNode.vTiles = this.reader.getFloat32();
        break;
    }
    this.reader.skip(2);
  }
  // ENVL forms are currently ignored
  parseEnvelope(length) {
    this.reader.skip(length - 4);
  }
  ///
  // CHUNK PARSING METHODS
  ///
  // clips can either be defined inside a surface node, or at the top
  // level and they have a different format in each case
  parseClip(length) {
    var tag = this.reader.getIDTag();
    if (tag === "FORM") {
      this.reader.skip(16);
      this.currentNode.fileName = this.reader.getString();
      return;
    }
    this.reader.setOffset(this.reader.offset - 4);
    this.currentFormEnd = this.reader.offset + length;
    this.parentForm = this.currentForm;
    this.reader.skip(8);
    var texture = {
      index: this.reader.getUint32()
    };
    this.tree.textures.push(texture);
    this.currentForm = texture;
  }
  parseClipLwo2(length) {
    var texture = {
      index: this.reader.getUint32(),
      fileName: ""
    };
    while (true) {
      var tag = this.reader.getIDTag();
      var n_length = this.reader.getUint16();
      if (tag === "STIL") {
        texture.fileName = this.reader.getString();
        break;
      }
      if (n_length >= length) {
        break;
      }
    }
    this.tree.textures.push(texture);
    this.currentForm = texture;
  }
  parseImage() {
    this.reader.skip(8);
    this.currentForm.fileName = this.reader.getString();
  }
  parseXVAL(type, length) {
    var endOffset = this.reader.offset + length - 4;
    this.reader.skip(8);
    this.currentForm[type] = this.reader.getFloat32();
    this.reader.setOffset(endOffset);
  }
  parseXVAL3(type, length) {
    var endOffset = this.reader.offset + length - 4;
    this.reader.skip(8);
    this.currentForm[type] = {
      x: this.reader.getFloat32(),
      y: this.reader.getFloat32(),
      z: this.reader.getFloat32()
    };
    this.reader.setOffset(endOffset);
  }
  // Tags associated with an object
  // OTAG { type[ID4], tag-string[S0] }
  parseObjectTag() {
    if (!this.tree.objectTags)
      this.tree.objectTags = {};
    this.tree.objectTags[this.reader.getIDTag()] = {
      tagString: this.reader.getString()
    };
  }
  // Signals the start of a new layer. All the data chunks which follow will be included in this layer until another layer chunk is encountered.
  // LAYR: number[U2], flags[U2], pivot[VEC12], name[S0], parent[U2]
  parseLayer(length) {
    var layer = {
      number: this.reader.getUint16(),
      flags: this.reader.getUint16(),
      // If the least significant bit of flags is set, the layer is hidden.
      pivot: this.reader.getFloat32Array(3),
      // Note: this seems to be superflous, as the geometry is translated when pivot is present
      name: this.reader.getString()
    };
    this.tree.layers.push(layer);
    this.currentLayer = layer;
    var parsedLength = 16 + stringOffset(this.currentLayer.name);
    this.currentLayer.parent = parsedLength < length ? this.reader.getUint16() : -1;
  }
  // VEC12 * ( F4 + F4 + F4 ) array of x,y,z vectors
  // Converting from left to right handed coordinate system:
  // x -> -x and switch material FrontSide -> BackSide
  parsePoints(length) {
    this.currentPoints = [];
    for (var i = 0; i < length / 4; i += 3) {
      this.currentPoints.push(this.reader.getFloat32(), this.reader.getFloat32(), -this.reader.getFloat32());
    }
  }
  // parse VMAP or VMAD
  // Associates a set of floating-point vectors with a set of points.
  // VMAP: { type[ID4], dimension[U2], name[S0], ( vert[VX], value[F4] # dimension ) * }
  // VMAD Associates a set of floating-point vectors with the vertices of specific polygons.
  // Similar to VMAP UVs, but associates with polygon vertices rather than points
  // to solve to problem of UV seams:  VMAD chunks are paired with VMAPs of the same name,
  // if they exist. The vector values in the VMAD will then replace those in the
  // corresponding VMAP, but only for calculations involving the specified polygons.
  // VMAD { type[ID4], dimension[U2], name[S0], ( vert[VX], poly[VX], value[F4] # dimension ) * }
  parseVertexMapping(length, discontinuous) {
    var finalOffset = this.reader.offset + length;
    var channelName = this.reader.getString();
    if (this.reader.offset === finalOffset) {
      this.currentForm.UVChannel = channelName;
      return;
    }
    this.reader.setOffset(this.reader.offset - stringOffset(channelName));
    var type = this.reader.getIDTag();
    this.reader.getUint16();
    var name = this.reader.getString();
    var remainingLength = length - 6 - stringOffset(name);
    switch (type) {
      case "TXUV":
        this.parseUVMapping(name, finalOffset, discontinuous);
        break;
      case "MORF":
      case "SPOT":
        this.parseMorphTargets(name, finalOffset, type);
        break;
      case "APSL":
      case "NORM":
      case "WGHT":
      case "MNVW":
      case "PICK":
      case "RGB ":
      case "RGBA":
        this.reader.skip(remainingLength);
        break;
      default:
        console.warn("LWOLoader: unknown vertex map type: " + type);
        this.reader.skip(remainingLength);
    }
  }
  parseUVMapping(name, finalOffset, discontinuous) {
    var uvIndices = [];
    var polyIndices = [];
    var uvs = [];
    while (this.reader.offset < finalOffset) {
      uvIndices.push(this.reader.getVariableLengthIndex());
      if (discontinuous)
        polyIndices.push(this.reader.getVariableLengthIndex());
      uvs.push(this.reader.getFloat32(), this.reader.getFloat32());
    }
    if (discontinuous) {
      if (!this.currentLayer.discontinuousUVs)
        this.currentLayer.discontinuousUVs = {};
      this.currentLayer.discontinuousUVs[name] = {
        uvIndices,
        polyIndices,
        uvs
      };
    } else {
      if (!this.currentLayer.uvs)
        this.currentLayer.uvs = {};
      this.currentLayer.uvs[name] = {
        uvIndices,
        uvs
      };
    }
  }
  parseMorphTargets(name, finalOffset, type) {
    var indices = [];
    var points = [];
    type = type === "MORF" ? "relative" : "absolute";
    while (this.reader.offset < finalOffset) {
      indices.push(this.reader.getVariableLengthIndex());
      points.push(this.reader.getFloat32(), this.reader.getFloat32(), -this.reader.getFloat32());
    }
    if (!this.currentLayer.morphTargets)
      this.currentLayer.morphTargets = {};
    this.currentLayer.morphTargets[name] = {
      indices,
      points,
      type
    };
  }
  // A list of polygons for the current layer.
  // POLS { type[ID4], ( numvert+flags[U2], vert[VX] # numvert ) * }
  parsePolygonList(length) {
    var finalOffset = this.reader.offset + length;
    var type = this.reader.getIDTag();
    var indices = [];
    var polygonDimensions = [];
    while (this.reader.offset < finalOffset) {
      var numverts = this.reader.getUint16();
      numverts = numverts & 1023;
      polygonDimensions.push(numverts);
      for (var j = 0; j < numverts; j++)
        indices.push(this.reader.getVariableLengthIndex());
    }
    var geometryData = {
      type,
      vertexIndices: indices,
      polygonDimensions,
      points: this.currentPoints
    };
    if (polygonDimensions[0] === 1)
      geometryData.type = "points";
    else if (polygonDimensions[0] === 2)
      geometryData.type = "lines";
    this.currentLayer.geometry = geometryData;
  }
  // Lists the tag strings that can be associated with polygons by the PTAG chunk.
  // TAGS { tag-string[S0] * }
  parseTagStrings(length) {
    this.tree.tags = this.reader.getStringArray(length);
  }
  // Associates tags of a given type with polygons in the most recent POLS chunk.
  // PTAG { type[ID4], ( poly[VX], tag[U2] ) * }
  parsePolygonTagMapping(length) {
    var finalOffset = this.reader.offset + length;
    var type = this.reader.getIDTag();
    if (type === "SURF")
      this.parseMaterialIndices(finalOffset);
    else {
      this.reader.skip(length - 4);
    }
  }
  parseMaterialIndices(finalOffset) {
    this.currentLayer.geometry.materialIndices = [];
    while (this.reader.offset < finalOffset) {
      var polygonIndex = this.reader.getVariableLengthIndex();
      var materialIndex = this.reader.getUint16();
      this.currentLayer.geometry.materialIndices.push(polygonIndex, materialIndex);
    }
  }
  parseUnknownCHUNK(blockID, length) {
    console.warn("LWOLoader: unknown chunk type: " + blockID + " length: " + length);
    var data = this.reader.getString(length);
    this.currentForm[blockID] = data;
  }
}
class DataViewReader {
  constructor(buffer) {
    this.dv = new DataView(buffer);
    this.offset = 0;
    this._textDecoder = new TextDecoder();
    this._bytes = new Uint8Array(buffer);
  }
  size() {
    return this.dv.buffer.byteLength;
  }
  setOffset(offset) {
    if (offset > 0 && offset < this.dv.buffer.byteLength) {
      this.offset = offset;
    } else {
      console.error("LWOLoader: invalid buffer offset");
    }
  }
  endOfFile() {
    if (this.offset >= this.size())
      return true;
    return false;
  }
  skip(length) {
    this.offset += length;
  }
  getUint8() {
    var value = this.dv.getUint8(this.offset);
    this.offset += 1;
    return value;
  }
  getUint16() {
    var value = this.dv.getUint16(this.offset);
    this.offset += 2;
    return value;
  }
  getInt32() {
    var value = this.dv.getInt32(this.offset, false);
    this.offset += 4;
    return value;
  }
  getUint32() {
    var value = this.dv.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }
  getUint64() {
    var low, high;
    high = this.getUint32();
    low = this.getUint32();
    return high * 4294967296 + low;
  }
  getFloat32() {
    var value = this.dv.getFloat32(this.offset, false);
    this.offset += 4;
    return value;
  }
  getFloat32Array(size) {
    var a = [];
    for (var i = 0; i < size; i++) {
      a.push(this.getFloat32());
    }
    return a;
  }
  getFloat64() {
    var value = this.dv.getFloat64(this.offset, this.littleEndian);
    this.offset += 8;
    return value;
  }
  getFloat64Array(size) {
    var a = [];
    for (var i = 0; i < size; i++) {
      a.push(this.getFloat64());
    }
    return a;
  }
  // get variable-length index data type
  // VX ::= index[U2] | (index + 0xFF000000)[U4]
  // If the index value is less than 65,280 (0xFF00),then VX === U2
  // otherwise VX === U4 with bits 24-31 set
  // When reading an index, if the first byte encountered is 255 (0xFF), then
  // the four-byte form is being used and the first byte should be discarded or masked out.
  getVariableLengthIndex() {
    var firstByte = this.getUint8();
    if (firstByte === 255) {
      return this.getUint8() * 65536 + this.getUint8() * 256 + this.getUint8();
    }
    return firstByte * 256 + this.getUint8();
  }
  // An ID tag is a sequence of 4 bytes containing 7-bit ASCII values
  getIDTag() {
    return this.getString(4);
  }
  getString(size) {
    if (size === 0)
      return;
    const start = this.offset;
    let result;
    let length;
    if (size) {
      length = size;
      result = this._textDecoder.decode(new Uint8Array(this.dv.buffer, start, size));
    } else {
      length = this._bytes.indexOf(0, start) - start;
      result = this._textDecoder.decode(new Uint8Array(this.dv.buffer, start, length));
      length++;
      length += length % 2;
    }
    this.skip(length);
    return result;
  }
  getStringArray(size) {
    var a = this.getString(size);
    a = a.split("\0");
    return a.filter(Boolean);
  }
}
class Debugger {
  constructor() {
    this.active = false;
    this.depth = 0;
    this.formList = [];
  }
  enable() {
    this.active = true;
  }
  log() {
    if (!this.active)
      return;
    var nodeType;
    switch (this.node) {
      case 0:
        nodeType = "FORM";
        break;
      case 1:
        nodeType = "CHK";
        break;
      case 2:
        nodeType = "S-CHK";
        break;
    }
    console.log(
      "| ".repeat(this.depth) + nodeType,
      this.nodeID,
      `( ${this.offset} ) -> ( ${this.dataOffset + this.length} )`,
      this.node == 0 ? " {" : "",
      this.skipped ? "SKIPPED" : "",
      this.node == 0 && this.skipped ? "}" : ""
    );
    if (this.node == 0 && !this.skipped) {
      this.depth += 1;
      this.formList.push(this.dataOffset + this.length);
    }
    this.skipped = false;
  }
  closeForms() {
    if (!this.active)
      return;
    for (var i = this.formList.length - 1; i >= 0; i--) {
      if (this.offset >= this.formList[i]) {
        this.depth -= 1;
        console.log("| ".repeat(this.depth) + "}");
        this.formList.splice(-1, 1);
      }
    }
  }
}
function isEven(num) {
  return num % 2;
}
function stringOffset(string) {
  return string.length + 1 + (isEven(string.length + 1) ? 1 : 0);
}
function printBuffer(buffer, from, to) {
  console.log(new TextDecoder().decode(new Uint8Array(buffer, from, to)));
}
export {
  IFFParser
};
//# sourceMappingURL=IFFParser.js.map
