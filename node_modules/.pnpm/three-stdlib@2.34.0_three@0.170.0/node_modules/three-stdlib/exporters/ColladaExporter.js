var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { InterleavedBufferAttribute, Matrix4, MeshLambertMaterial, MeshBasicMaterial, MeshPhongMaterial, Color, DoubleSide, Mesh } from "three";
import { UV1 } from "../_polyfill/uv1.js";
class ColladaExporter {
  constructor() {
    __publicField(this, "options");
    __publicField(this, "geometryInfo");
    __publicField(this, "materialMap");
    __publicField(this, "imageMap");
    __publicField(this, "textures");
    __publicField(this, "libraryImages");
    __publicField(this, "libraryGeometries");
    __publicField(this, "libraryEffects");
    __publicField(this, "libraryMaterials");
    __publicField(this, "canvas");
    __publicField(this, "ctx");
    __publicField(this, "transMat");
    __publicField(this, "getFuncs", ["getX", "getY", "getZ", "getW"]);
    this.options = {
      version: "1.4.1",
      author: null,
      textureDirectory: "",
      upAxis: "Y_UP",
      unitName: null,
      unitMeter: null
    };
    this.geometryInfo = /* @__PURE__ */ new WeakMap();
    this.materialMap = /* @__PURE__ */ new WeakMap();
    this.imageMap = /* @__PURE__ */ new WeakMap();
    this.textures = [];
    this.libraryImages = [];
    this.libraryGeometries = [];
    this.libraryEffects = [];
    this.libraryMaterials = [];
    this.canvas = null;
    this.ctx = null;
    this.transMat = null;
  }
  parse(object, onDone, options = {}) {
    this.options = { ...this.options, ...options };
    if (this.options.upAxis.match(/^[XYZ]_UP$/) === null) {
      console.error("ColladaExporter: Invalid upAxis: valid values are X_UP, Y_UP or Z_UP.");
      return null;
    }
    if (this.options.unitName !== null && this.options.unitMeter === null) {
      console.error("ColladaExporter: unitMeter needs to be specified if unitName is specified.");
      return null;
    }
    if (this.options.unitMeter !== null && this.options.unitName === null) {
      console.error("ColladaExporter: unitName needs to be specified if unitMeter is specified.");
      return null;
    }
    if (this.options.textureDirectory !== "") {
      this.options.textureDirectory = `${this.options.textureDirectory}/`.replace(/\\/g, "/").replace(/\/+/g, "/");
    }
    if (this.options.version !== "1.4.1" && this.options.version !== "1.5.0") {
      console.warn(`ColladaExporter : Version ${this.options.version} not supported for export. Only 1.4.1 and 1.5.0.`);
      return null;
    }
    const libraryVisualScenes = this.processObject(object);
    const specLink = this.options.version === "1.4.1" ? "http://www.collada.org/2005/11/COLLADASchema" : "https://www.khronos.org/collada/";
    let dae = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>${`<COLLADA xmlns="${specLink}" version="${this.options.version}">`}<asset><contributor><authoring_tool>three.js Collada Exporter</authoring_tool>${this.options.author !== null ? `<author>${this.options.author}</author>` : ""}</contributor>${`<created>${(/* @__PURE__ */ new Date()).toISOString()}</created>`}${`<modified>${(/* @__PURE__ */ new Date()).toISOString()}</modified>`}<up_axis>Y_UP</up_axis></asset>`;
    dae += `<library_images>${this.libraryImages.join("")}</library_images>`;
    dae += `<library_effects>${this.libraryEffects.join("")}</library_effects>`;
    dae += `<library_materials>${this.libraryMaterials.join("")}</library_materials>`;
    dae += `<library_geometries>${this.libraryGeometries.join("")}</library_geometries>`;
    dae += `<library_visual_scenes><visual_scene id="Scene" name="scene">${libraryVisualScenes}</visual_scene></library_visual_scenes>`;
    dae += '<scene><instance_visual_scene url="#Scene"/></scene>';
    dae += "</COLLADA>";
    const res = {
      data: this.format(dae),
      textures: this.textures
    };
    if (typeof onDone === "function") {
      requestAnimationFrame(() => onDone(res));
    }
    return res;
  }
  // Convert the urdf xml into a well-formatted, indented format
  format(urdf) {
    var _a, _b;
    const IS_END_TAG = /^<\//;
    const IS_SELF_CLOSING = /(\?>$)|(\/>$)/;
    const HAS_TEXT = /<[^>]+>[^<]*<\/[^<]+>/;
    const pad = (ch, num) => num > 0 ? ch + pad(ch, num - 1) : "";
    let tagnum = 0;
    return (_b = (_a = urdf.match(/(<[^>]+>[^<]+<\/[^<]+>)|(<[^>]+>)/g)) == null ? void 0 : _a.map((tag) => {
      if (!HAS_TEXT.test(tag) && !IS_SELF_CLOSING.test(tag) && IS_END_TAG.test(tag)) {
        tagnum--;
      }
      const res = `${pad("  ", tagnum)}${tag}`;
      if (!HAS_TEXT.test(tag) && !IS_SELF_CLOSING.test(tag) && !IS_END_TAG.test(tag)) {
        tagnum++;
      }
      return res;
    }).join("\n")) != null ? _b : "";
  }
  // Convert an image into a png format for saving
  base64ToBuffer(str) {
    const b = atob(str);
    const buf = new Uint8Array(b.length);
    for (let i = 0, l = buf.length; i < l; i++) {
      buf[i] = b.charCodeAt(i);
    }
    return buf;
  }
  imageToData(image, ext) {
    var _a;
    this.canvas = this.canvas || document.createElement("canvas");
    this.ctx = this.ctx || this.canvas.getContext("2d");
    this.canvas.width = image.width instanceof SVGAnimatedLength ? 0 : image.width;
    this.canvas.height = image.height instanceof SVGAnimatedLength ? 0 : image.height;
    (_a = this.ctx) == null ? void 0 : _a.drawImage(image, 0, 0);
    const base64data = this.canvas.toDataURL(`image/${ext}`, 1).replace(/^data:image\/(png|jpg);base64,/, "");
    return this.base64ToBuffer(base64data);
  }
  // gets the attribute array. Generate a new array if the attribute is interleaved
  attrBufferToArray(attr) {
    if (attr instanceof InterleavedBufferAttribute && attr.isInterleavedBufferAttribute) {
      const TypedArrayConstructor = attr.array.constructor;
      const arr = new TypedArrayConstructor(attr.count * attr.itemSize);
      const size = attr.itemSize;
      for (let i = 0, l = attr.count; i < l; i++) {
        for (let j = 0; j < size; j++) {
          arr[i * size + j] = attr[this.getFuncs[j]](i);
        }
      }
      return arr;
    } else {
      return attr.array;
    }
  }
  // Returns an array of the same type starting at the `st` index,
  // and `ct` length
  subArray(arr, st, ct) {
    if (Array.isArray(arr)) {
      return arr.slice(st, st + ct);
    } else {
      const TypedArrayConstructor = arr.constructor;
      return new TypedArrayConstructor(arr.buffer, st * arr.BYTES_PER_ELEMENT, ct);
    }
  }
  // Returns the string for a geometry's attribute
  getAttribute(attr, name, params, type) {
    const array = this.attrBufferToArray(attr);
    const res = Array.isArray(array) ? `${`<source id="${name}"><float_array id="${name}-array" count="${array.length}">` + array.join(" ")}</float_array><technique_common>${`<accessor source="#${name}-array" count="${Math.floor(
      array.length / attr.itemSize
    )}" stride="${attr.itemSize}">`}${params.map((n) => `<param name="${n}" type="${type}" />`).join("")}</accessor></technique_common></source>` : "";
    return res;
  }
  // Returns the string for a node's transform information
  getTransform(o) {
    o.updateMatrix();
    this.transMat = this.transMat || new Matrix4();
    this.transMat.copy(o.matrix);
    this.transMat.transpose();
    return `<matrix>${this.transMat.toArray().join(" ")}</matrix>`;
  }
  // Process the given piece of geometry into the geometry library
  // Returns the mesh id
  processGeometry(g) {
    let info = this.geometryInfo.get(g);
    if (!info) {
      const bufferGeometry = g;
      if (!bufferGeometry.isBufferGeometry) {
        throw new Error("THREE.ColladaExporter: Geometry is not of type THREE.BufferGeometry.");
      }
      const meshid = `Mesh${this.libraryGeometries.length + 1}`;
      const indexCount = bufferGeometry.index ? bufferGeometry.index.count * bufferGeometry.index.itemSize : bufferGeometry.attributes.position.count;
      const groups = bufferGeometry.groups != null && bufferGeometry.groups.length !== 0 ? bufferGeometry.groups : [{ start: 0, count: indexCount, materialIndex: 0 }];
      const gname = g.name ? ` name="${g.name}"` : "";
      let gnode = `<geometry id="${meshid}"${gname}><mesh>`;
      const posName = `${meshid}-position`;
      const vertName = `${meshid}-vertices`;
      gnode += this.getAttribute(bufferGeometry.attributes.position, posName, ["X", "Y", "Z"], "float");
      gnode += `<vertices id="${vertName}"><input semantic="POSITION" source="#${posName}" /></vertices>`;
      let triangleInputs = `<input semantic="VERTEX" source="#${vertName}" offset="0" />`;
      if ("normal" in bufferGeometry.attributes) {
        const normName = `${meshid}-normal`;
        gnode += this.getAttribute(bufferGeometry.attributes.normal, normName, ["X", "Y", "Z"], "float");
        triangleInputs += `<input semantic="NORMAL" source="#${normName}" offset="0" />`;
      }
      if ("uv" in bufferGeometry.attributes) {
        const uvName = `${meshid}-texcoord`;
        gnode += this.getAttribute(bufferGeometry.attributes.uv, uvName, ["S", "T"], "float");
        triangleInputs += `<input semantic="TEXCOORD" source="#${uvName}" offset="0" set="0" />`;
      }
      if (UV1 in bufferGeometry.attributes) {
        const uvName = `${meshid}-texcoord2`;
        gnode += this.getAttribute(bufferGeometry.attributes[UV1], uvName, ["S", "T"], "float");
        triangleInputs += `<input semantic="TEXCOORD" source="#${uvName}" offset="0" set="1" />`;
      }
      if ("color" in bufferGeometry.attributes) {
        const colName = `${meshid}-color`;
        gnode += this.getAttribute(bufferGeometry.attributes.color, colName, ["X", "Y", "Z"], "uint8");
        triangleInputs += `<input semantic="COLOR" source="#${colName}" offset="0" />`;
      }
      let indexArray = null;
      if (bufferGeometry.index) {
        indexArray = this.attrBufferToArray(bufferGeometry.index);
      } else {
        indexArray = new Array(indexCount);
        for (let i = 0, l = indexArray.length; i < l && Array.isArray(indexArray); i++)
          indexArray[i] = i;
      }
      for (let i = 0, l = groups.length; i < l; i++) {
        const group = groups[i];
        const subarr = this.subArray(indexArray, group.start, group.count);
        const polycount = subarr.length / 3;
        gnode += `<triangles material="MESH_MATERIAL_${group.materialIndex}" count="${polycount}">`;
        gnode += triangleInputs;
        gnode += `<p>${subarr.join(" ")}</p>`;
        gnode += "</triangles>";
      }
      gnode += "</mesh></geometry>";
      this.libraryGeometries.push(gnode);
      info = { meshid, bufferGeometry };
      this.geometryInfo.set(g, info);
    }
    return info;
  }
  // Process the given texture into the image library
  // Returns the image library
  processTexture(tex) {
    let texid = this.imageMap.get(tex);
    if (texid == null) {
      texid = `image-${this.libraryImages.length + 1}`;
      const ext = "png";
      const name = tex.name || texid;
      let imageNode = `<image id="${texid}" name="${name}">`;
      if (this.options.version === "1.5.0") {
        imageNode += `<init_from><ref>${this.options.textureDirectory}${name}.${ext}</ref></init_from>`;
      } else {
        imageNode += `<init_from>${this.options.textureDirectory}${name}.${ext}</init_from>`;
      }
      imageNode += "</image>";
      this.libraryImages.push(imageNode);
      this.imageMap.set(tex, texid);
      this.textures.push({
        directory: this.options.textureDirectory,
        name,
        ext,
        data: this.imageToData(tex.image, ext),
        original: tex
      });
    }
    return texid;
  }
  // Process the given material into the material and effect libraries
  // Returns the material id
  processMaterial(m) {
    let matid = this.materialMap.get(m);
    if (matid == null) {
      matid = `Mat${this.libraryEffects.length + 1}`;
      let type = "phong";
      if (m instanceof MeshLambertMaterial) {
        type = "lambert";
      } else if (m instanceof MeshBasicMaterial) {
        type = "constant";
        if (m.map !== null) {
          console.warn("ColladaExporter: Texture maps not supported with MeshBasicMaterial.");
        }
      }
      if (m instanceof MeshPhongMaterial) {
        const emissive = m.emissive ? m.emissive : new Color(0, 0, 0);
        const diffuse = m.color ? m.color : new Color(0, 0, 0);
        const specular = m.specular ? m.specular : new Color(1, 1, 1);
        const shininess = m.shininess || 0;
        const reflectivity = m.reflectivity || 0;
        let transparencyNode = "";
        if (m.transparent) {
          transparencyNode += `<transparent>${m.map ? '<texture texture="diffuse-sampler"></texture>' : "<float>1</float>"}</transparent>`;
          if (m.opacity < 1) {
            transparencyNode += `<transparency><float>${m.opacity}</float></transparency>`;
          }
        }
        const techniqueNode = `${`<technique sid="common"><${type}>`}<emission>${m.emissiveMap ? '<texture texture="emissive-sampler" texcoord="TEXCOORD" />' : `<color sid="emission">${emissive.r} ${emissive.g} ${emissive.b} 1</color>`}</emission>${type !== "constant" ? `<diffuse>${m.map ? '<texture texture="diffuse-sampler" texcoord="TEXCOORD" />' : `<color sid="diffuse">${diffuse.r} ${diffuse.g} ${diffuse.b} 1</color>`}</diffuse>` : ""}${type !== "constant" ? `<bump>${m.normalMap ? '<texture texture="bump-sampler" texcoord="TEXCOORD" />' : ""}</bump>` : ""}${type === "phong" ? `${`<specular><color sid="specular">${specular.r} ${specular.g} ${specular.b} 1</color></specular>`}<shininess>${m.specularMap ? '<texture texture="specular-sampler" texcoord="TEXCOORD" />' : `<float sid="shininess">${shininess}</float>`}</shininess>` : ""}${`<reflective><color>${diffuse.r} ${diffuse.g} ${diffuse.b} 1</color></reflective>`}${`<reflectivity><float>${reflectivity}</float></reflectivity>`}${transparencyNode}${`</${type}></technique>`}`;
        const effectnode = `${`<effect id="${matid}-effect">`}<profile_COMMON>${m.map ? `<newparam sid="diffuse-surface"><surface type="2D">${`<init_from>${this.processTexture(
          m.map
        )}</init_from>`}</surface></newparam><newparam sid="diffuse-sampler"><sampler2D><source>diffuse-surface</source></sampler2D></newparam>` : ""}${m.specularMap ? `<newparam sid="specular-surface"><surface type="2D">${`<init_from>${this.processTexture(
          m.specularMap
        )}</init_from>`}</surface></newparam><newparam sid="specular-sampler"><sampler2D><source>specular-surface</source></sampler2D></newparam>` : ""}${m.emissiveMap ? `<newparam sid="emissive-surface"><surface type="2D">${`<init_from>${this.processTexture(
          m.emissiveMap
        )}</init_from>`}</surface></newparam><newparam sid="emissive-sampler"><sampler2D><source>emissive-surface</source></sampler2D></newparam>` : ""}${m.normalMap ? `<newparam sid="bump-surface"><surface type="2D">${`<init_from>${this.processTexture(
          m.normalMap
        )}</init_from>`}</surface></newparam><newparam sid="bump-sampler"><sampler2D><source>bump-surface</source></sampler2D></newparam>` : ""}${techniqueNode}${m.side === DoubleSide ? '<extra><technique profile="THREEJS"><double_sided sid="double_sided" type="int">1</double_sided></technique></extra>' : ""}</profile_COMMON></effect>`;
        const materialName = m.name ? ` name="${m.name}"` : "";
        const materialNode = `<material id="${matid}"${materialName}><instance_effect url="#${matid}-effect" /></material>`;
        this.libraryMaterials.push(materialNode);
        this.libraryEffects.push(effectnode);
        this.materialMap.set(m, matid);
      }
    }
    return matid;
  }
  // Recursively process the object into a scene
  processObject(o) {
    let node = `<node name="${o.name}">`;
    node += this.getTransform(o);
    const a = new Mesh();
    a.geometry;
    if (o instanceof Mesh && o.isMesh && o.geometry !== null) {
      const geomInfo = this.processGeometry(o.geometry);
      const meshid = geomInfo.meshid;
      const geometry = geomInfo.bufferGeometry;
      let matids = null;
      let matidsArray;
      const mat = o.material || new MeshBasicMaterial();
      const materials = Array.isArray(mat) ? mat : [mat];
      if (geometry.groups.length > materials.length) {
        matidsArray = new Array(geometry.groups.length);
      } else {
        matidsArray = new Array(materials.length);
      }
      matids = matidsArray.fill(null).map((_, i) => this.processMaterial(materials[i % materials.length]));
      node += `${`<instance_geometry url="#${meshid}">` + (matids != null ? `<bind_material><technique_common>${matids.map(
        (id, i) => `${`<instance_material symbol="MESH_MATERIAL_${i}" target="#${id}" >`}<bind_vertex_input semantic="TEXCOORD" input_semantic="TEXCOORD" input_set="0" /></instance_material>`
      ).join("")}</technique_common></bind_material>` : "")}</instance_geometry>`;
    }
    o.children.forEach((c) => node += this.processObject(c));
    node += "</node>";
    return node;
  }
}
export {
  ColladaExporter
};
//# sourceMappingURL=ColladaExporter.js.map
