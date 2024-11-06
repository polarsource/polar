"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const fflate = require("fflate");
const THREE = require("three");
class USDZExporter {
  constructor() {
    __publicField(this, "PRECISION", 7);
    __publicField(this, "materials");
    __publicField(this, "textures");
    __publicField(this, "files");
    this.materials = {};
    this.textures = {};
    this.files = {};
  }
  async parse(scene) {
    const modelFileName = "model.usda";
    this.files[modelFileName] = null;
    let output = this.buildHeader();
    scene.traverseVisible((object) => {
      if (object instanceof THREE.Mesh && object.isMesh && object.material.isMeshStandardMaterial) {
        const geometry = object.geometry;
        const material = object.material;
        const geometryFileName = "geometries/Geometry_" + geometry.id + ".usd";
        if (!(geometryFileName in this.files)) {
          const meshObject = this.buildMeshObject(geometry);
          this.files[geometryFileName] = this.buildUSDFileAsString(meshObject);
        }
        if (!(material.uuid in this.materials)) {
          this.materials[material.uuid] = material;
        }
        output += this.buildXform(object, geometry, material);
      }
    });
    output += this.buildMaterials(this.materials);
    this.files[modelFileName] = fflate.strToU8(output);
    output = null;
    for (const id in this.textures) {
      const texture = this.textures[id];
      const color = id.split("_")[1];
      const isRGBA = texture.format === 1023;
      const canvas = this.imageToCanvas(texture.image, color);
      const blob = await new Promise(
        (resolve) => canvas == null ? void 0 : canvas.toBlob(resolve, isRGBA ? "image/png" : "image/jpeg", 1)
      );
      if (blob) {
        this.files[`textures/Texture_${id}.${isRGBA ? "png" : "jpg"}`] = new Uint8Array(await blob.arrayBuffer());
      }
    }
    let offset = 0;
    for (const filename in this.files) {
      const file = this.files[filename];
      const headerSize = 34 + filename.length;
      offset += headerSize;
      const offsetMod64 = offset & 63;
      if (offsetMod64 !== 4 && file !== null && file instanceof Uint8Array) {
        const padLength = 64 - offsetMod64;
        const padding = new Uint8Array(padLength);
        this.files[filename] = [file, { extra: { 12345: padding } }];
      }
      if (file && typeof file.length === "number") {
        offset = file.length;
      }
    }
    return fflate.zipSync(this.files, { level: 0 });
  }
  imageToCanvas(image, color) {
    if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== "undefined" && image instanceof HTMLCanvasElement || typeof OffscreenCanvas !== "undefined" && image instanceof OffscreenCanvas || typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
      const scale = 1024 / Math.max(image.width, image.height);
      const canvas = document.createElement("canvas");
      canvas.width = image.width * Math.min(1, scale);
      canvas.height = image.height * Math.min(1, scale);
      const context = canvas.getContext("2d");
      context == null ? void 0 : context.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (color !== void 0) {
        const hex = parseInt(color, 16);
        const r = (hex >> 16 & 255) / 255;
        const g = (hex >> 8 & 255) / 255;
        const b = (hex & 255) / 255;
        const imagedata = context == null ? void 0 : context.getImageData(0, 0, canvas.width, canvas.height);
        if (imagedata) {
          const data = imagedata == null ? void 0 : imagedata.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i + 0] = data[i + 0] * r;
            data[i + 1] = data[i + 1] * g;
            data[i + 2] = data[i + 2] * b;
          }
          context == null ? void 0 : context.putImageData(imagedata, 0, 0);
        }
      }
      return canvas;
    }
  }
  buildHeader() {
    return `#usda 1.0
(
    customLayerData = {
        string creator = "Three.js USDZExporter"
    }
    metersPerUnit = 1
    upAxis = "Y"
)
`;
  }
  buildUSDFileAsString(dataToInsert) {
    let output = this.buildHeader();
    output += dataToInsert;
    return fflate.strToU8(output);
  }
  // Xform
  buildXform(object, geometry, material) {
    const name = "Object_" + object.id;
    const transform = this.buildMatrix(object.matrixWorld);
    if (object.matrixWorld.determinant() < 0) {
      console.warn("THREE.USDZExporter: USDZ does not support negative scales", object);
    }
    return `def Xform "${name}" (
    prepend references = @./geometries/Geometry_${geometry.id}.usd@</Geometry>
)
{
    matrix4d xformOp:transform = ${transform}
    uniform token[] xformOpOrder = ["xformOp:transform"]
    rel material:binding = </Materials/Material_${material.id}>
}
`;
  }
  buildMatrix(matrix) {
    const array = matrix.elements;
    return `( ${this.buildMatrixRow(array, 0)}, ${this.buildMatrixRow(array, 4)}, ${this.buildMatrixRow(
      array,
      8
    )}, ${this.buildMatrixRow(array, 12)} )`;
  }
  buildMatrixRow(array, offset) {
    return `(${array[offset + 0]}, ${array[offset + 1]}, ${array[offset + 2]}, ${array[offset + 3]})`;
  }
  // Mesh
  buildMeshObject(geometry) {
    const mesh = this.buildMesh(geometry);
    return `
def "Geometry"
{
  ${mesh}
}
`;
  }
  buildMesh(geometry) {
    const name = "Geometry";
    const attributes = geometry.attributes;
    const count = attributes.position.count;
    return `
    def Mesh "${name}"
    {
        int[] faceVertexCounts = [${this.buildMeshVertexCount(geometry)}]
        int[] faceVertexIndices = [${this.buildMeshVertexIndices(geometry)}]
        normal3f[] normals = [${this.buildVector3Array(attributes.normal, count)}] (
            interpolation = "vertex"
        )
        point3f[] points = [${this.buildVector3Array(attributes.position, count)}]
        float2[] primvars:st = [${this.buildVector2Array(attributes.uv, count)}] (
            interpolation = "vertex"
        )
        uniform token subdivisionScheme = "none"
    }
`;
  }
  buildMeshVertexCount(geometry) {
    const count = geometry.index !== null ? geometry.index.array.length : geometry.attributes.position.count;
    return Array(count / 3).fill(3).join(", ");
  }
  buildMeshVertexIndices(geometry) {
    if (geometry.index !== null) {
      return geometry.index.array.join(", ");
    }
    const array = [];
    const length = geometry.attributes.position.count;
    for (let i = 0; i < length; i++) {
      array.push(i);
    }
    return array.join(", ");
  }
  buildVector3Array(attribute, count) {
    if (attribute === void 0) {
      console.warn("USDZExporter: Normals missing.");
      return Array(count).fill("(0, 0, 0)").join(", ");
    }
    const array = [];
    const data = attribute.array;
    for (let i = 0; i < data.length; i += 3) {
      array.push(
        `(${data[i + 0].toPrecision(this.PRECISION)}, ${data[i + 1].toPrecision(this.PRECISION)}, ${data[i + 2].toPrecision(this.PRECISION)})`
      );
    }
    return array.join(", ");
  }
  buildVector2Array(attribute, count) {
    if (attribute === void 0) {
      console.warn("USDZExporter: UVs missing.");
      return Array(count).fill("(0, 0)").join(", ");
    }
    const array = [];
    const data = attribute.array;
    for (let i = 0; i < data.length; i += 2) {
      array.push(`(${data[i + 0].toPrecision(this.PRECISION)}, ${1 - data[i + 1].toPrecision(this.PRECISION)})`);
    }
    return array.join(", ");
  }
  // Materials
  buildMaterials(materials) {
    const array = [];
    for (const uuid in materials) {
      const material = materials[uuid];
      array.push(this.buildMaterial(material));
    }
    return `def "Materials"
{
${array.join("")}
}
`;
  }
  buildMaterial(material) {
    const pad = "            ";
    const inputs = [];
    const samplers = [];
    if (material.map !== null) {
      inputs.push(
        `${pad}color3f inputs:diffuseColor.connect = </Materials/Material_${material.id}/Texture_${material.map.id}_diffuse.outputs:rgb>`
      );
      if (material.transparent || material.alphaTest > 0) {
        inputs.push(`${pad}float inputs:opacity.connect = </Materials/Material_${material.id}/Texture_${material.map.id}_diffuse.outputs:a>`);
      }
      if (material.alphaTest > 0.01) {
        inputs.push(`${pad}float inputs:opacityThreshold = ${material.alphaTest}`);
      } else if (material.transparent || material.alphaTest > 0) {
        inputs.push(`${pad}float inputs:opacityThreshold = 0.01`);
      }
      samplers.push(this.buildTexture(material, material.map, "diffuse", material.color));
    } else {
      inputs.push(`${pad}color3f inputs:diffuseColor = ${this.buildColor(material.color)}`);
    }
    if (material.emissiveMap !== null) {
      inputs.push(
        `${pad}color3f inputs:emissiveColor.connect = </Materials/Material_${material.id}/Texture_${material.emissiveMap.id}_emissive.outputs:rgb>`
      );
      samplers.push(this.buildTexture(material, material.emissiveMap, "emissive"));
    } else if (material.emissive.getHex() > 0) {
      inputs.push(`${pad}color3f inputs:emissiveColor = ${this.buildColor(material.emissive)}`);
    }
    if (material.normalMap !== null) {
      inputs.push(
        `${pad}normal3f inputs:normal.connect = </Materials/Material_${material.id}/Texture_${material.normalMap.id}_normal.outputs:rgb>`
      );
      samplers.push(this.buildTexture(material, material.normalMap, "normal"));
    }
    if (material.aoMap !== null) {
      inputs.push(
        `${pad}float inputs:occlusion.connect = </Materials/Material_${material.id}/Texture_${material.aoMap.id}_occlusion.outputs:r>`
      );
      samplers.push(this.buildTexture(material, material.aoMap, "occlusion"));
    }
    if (material.roughnessMap !== null && material.roughness === 1) {
      inputs.push(
        `${pad}float inputs:roughness.connect = </Materials/Material_${material.id}/Texture_${material.roughnessMap.id}_roughness.outputs:g>`
      );
      samplers.push(this.buildTexture(material, material.roughnessMap, "roughness"));
    } else {
      inputs.push(`${pad}float inputs:roughness = ${material.roughness}`);
    }
    if (material.metalnessMap !== null && material.metalness === 1) {
      inputs.push(
        `${pad}float inputs:metallic.connect = </Materials/Material_${material.id}/Texture_${material.metalnessMap.id}_metallic.outputs:b>`
      );
      samplers.push(this.buildTexture(material, material.metalnessMap, "metallic"));
    } else {
      inputs.push(`${pad}float inputs:metallic = ${material.metalness}`);
    }
    inputs.push(`${pad}float inputs:opacity = ${material.opacity}`);
    if (material instanceof THREE.MeshPhysicalMaterial) {
      inputs.push(`${pad}float inputs:clearcoat = ${material.clearcoat}`);
      inputs.push(`${pad}float inputs:clearcoatRoughness = ${material.clearcoatRoughness}`);
      inputs.push(`${pad}float inputs:ior = ${material.ior}`);
    }
    return `
    def Material "Material_${material.id}"
    {
        def Shader "PreviewSurface"
        {
            uniform token info:id = "UsdPreviewSurface"
${inputs.join("\n")}
            int inputs:useSpecularWorkflow = 0
            token outputs:surface
        }
        token outputs:surface.connect = </Materials/Material_${material.id}/PreviewSurface.outputs:surface>
        token inputs:frame:stPrimvarName = "st"
        def Shader "uvReader_st"
        {
            uniform token info:id = "UsdPrimvarReader_float2"
            token inputs:varname.connect = </Materials/Material_${material.id}.inputs:frame:stPrimvarName>
            float2 inputs:fallback = (0.0, 0.0)
            float2 outputs:result
        }
${samplers.join("\n")}
    }
`;
  }
  buildTexture(material, texture, mapType, color) {
    const id = texture.id + (color ? "_" + color.getHexString() : "");
    const isRGBA = texture.format === 1023;
    this.textures[id] = texture;
    return `
      def Shader "Transform2d_${mapType}" (
          sdrMetadata = {
              string role = "math"
          }
      )
      {
          uniform token info:id = "UsdTransform2d"
          float2 inputs:in.connect = </Materials/Material_${material.id}/uvReader_st.outputs:result>
          float2 inputs:scale = ${this.buildVector2(texture.repeat)}
          float2 inputs:translation = ${this.buildVector2(texture.offset)}
          float2 outputs:result
      }
      def Shader "Texture_${texture.id}_${mapType}"
      {
          uniform token info:id = "UsdUVTexture"
          asset inputs:file = @textures/Texture_${id}.${isRGBA ? "png" : "jpg"}@
          float2 inputs:st.connect = </Materials/Material_${material.id}/Transform2d_${mapType}.outputs:result>
          token inputs:wrapS = "repeat"
          token inputs:wrapT = "repeat"
          float outputs:r
          float outputs:g
          float outputs:b
          float3 outputs:rgb
          ${material.transparent || material.alphaTest > 0 ? "float outputs:a" : ""}
      }`;
  }
  buildColor(color) {
    return `(${color.r}, ${color.g}, ${color.b})`;
  }
  buildVector2(vector) {
    return `(${vector.x}, ${vector.y})`;
  }
}
exports.USDZExporter = USDZExporter;
//# sourceMappingURL=USDZExporter.cjs.map
