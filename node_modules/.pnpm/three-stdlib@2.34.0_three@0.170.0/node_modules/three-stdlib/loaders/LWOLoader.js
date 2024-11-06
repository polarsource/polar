import { Loader, FileLoader, TextureLoader, Points, LineSegments, Mesh, PointsMaterial, LineBasicMaterial, BufferAttribute, MeshPhongMaterial, BackSide, DoubleSide, FrontSide, Vector2, Color, AddOperation, EquirectangularRefractionMapping, EquirectangularReflectionMapping, ClampToEdgeWrapping, MirroredRepeatWrapping, RepeatWrapping, MeshPhysicalMaterial, MeshStandardMaterial, BufferGeometry, Float32BufferAttribute } from "three";
import { IFFParser } from "./lwo/IFFParser.js";
import { UV1 } from "../_polyfill/uv1.js";
let _lwoTree;
class LWOLoader extends Loader {
  constructor(manager, parameters = {}) {
    super(manager);
    this.resourcePath = parameters.resourcePath !== void 0 ? parameters.resourcePath : "";
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const path = scope.path === "" ? extractParentUrl(url, "Objects") : scope.path;
    const modelName = url.split(path).pop().split(".")[0];
    const loader = new FileLoader(this.manager);
    loader.setPath(scope.path);
    loader.setResponseType("arraybuffer");
    loader.load(
      url,
      function(buffer) {
        try {
          onLoad(scope.parse(buffer, path, modelName));
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
  parse(iffBuffer, path, modelName) {
    _lwoTree = new IFFParser().parse(iffBuffer);
    const textureLoader = new TextureLoader(this.manager).setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);
    return new LWOTreeParser(textureLoader).parse(modelName);
  }
}
class LWOTreeParser {
  constructor(textureLoader) {
    this.textureLoader = textureLoader;
  }
  parse(modelName) {
    this.materials = new MaterialParser(this.textureLoader).parse();
    this.defaultLayerName = modelName;
    this.meshes = this.parseLayers();
    return {
      materials: this.materials,
      meshes: this.meshes
    };
  }
  parseLayers() {
    const meshes = [];
    const finalMeshes = [];
    const geometryParser = new GeometryParser();
    const scope = this;
    _lwoTree.layers.forEach(function(layer) {
      const geometry = geometryParser.parse(layer.geometry, layer);
      const mesh = scope.parseMesh(geometry, layer);
      meshes[layer.number] = mesh;
      if (layer.parent === -1)
        finalMeshes.push(mesh);
      else
        meshes[layer.parent].add(mesh);
    });
    this.applyPivots(finalMeshes);
    return finalMeshes;
  }
  parseMesh(geometry, layer) {
    let mesh;
    const materials = this.getMaterials(geometry.userData.matNames, layer.geometry.type);
    if (UV1 === "uv2")
      this.duplicateUVs(geometry, materials);
    if (layer.geometry.type === "points")
      mesh = new Points(geometry, materials);
    else if (layer.geometry.type === "lines")
      mesh = new LineSegments(geometry, materials);
    else
      mesh = new Mesh(geometry, materials);
    if (layer.name)
      mesh.name = layer.name;
    else
      mesh.name = this.defaultLayerName + "_layer_" + layer.number;
    mesh.userData.pivot = layer.pivot;
    return mesh;
  }
  // TODO: may need to be reversed in z to convert LWO to three.js coordinates
  applyPivots(meshes) {
    meshes.forEach(function(mesh) {
      mesh.traverse(function(child) {
        const pivot = child.userData.pivot;
        child.position.x += pivot[0];
        child.position.y += pivot[1];
        child.position.z += pivot[2];
        if (child.parent) {
          const parentPivot = child.parent.userData.pivot;
          child.position.x -= parentPivot[0];
          child.position.y -= parentPivot[1];
          child.position.z -= parentPivot[2];
        }
      });
    });
  }
  getMaterials(namesArray, type) {
    const materials = [];
    const scope = this;
    namesArray.forEach(function(name, i) {
      materials[i] = scope.getMaterialByName(name);
    });
    if (type === "points" || type === "lines") {
      materials.forEach(function(mat, i) {
        const spec = {
          color: mat.color
        };
        if (type === "points") {
          spec.size = 0.1;
          spec.map = mat.map;
          spec.morphTargets = mat.morphTargets;
          materials[i] = new PointsMaterial(spec);
        } else if (type === "lines") {
          materials[i] = new LineBasicMaterial(spec);
        }
      });
    }
    const filtered = materials.filter(Boolean);
    if (filtered.length === 1)
      return filtered[0];
    return materials;
  }
  getMaterialByName(name) {
    return this.materials.filter(function(m) {
      return m.name === name;
    })[0];
  }
  // If the material has an aoMap, duplicate UVs
  duplicateUVs(geometry, materials) {
    let duplicateUVs = false;
    if (!Array.isArray(materials)) {
      if (materials.aoMap)
        duplicateUVs = true;
    } else {
      materials.forEach(function(material) {
        if (material.aoMap)
          duplicateUVs = true;
      });
    }
    if (!duplicateUVs)
      return;
    geometry.setAttribute("uv2", new BufferAttribute(geometry.attributes.uv.array, 2));
  }
}
class MaterialParser {
  constructor(textureLoader) {
    this.textureLoader = textureLoader;
  }
  parse() {
    const materials = [];
    this.textures = {};
    for (const name in _lwoTree.materials) {
      if (_lwoTree.format === "LWO3") {
        materials.push(this.parseMaterial(_lwoTree.materials[name], name, _lwoTree.textures));
      } else if (_lwoTree.format === "LWO2") {
        materials.push(this.parseMaterialLwo2(_lwoTree.materials[name], name, _lwoTree.textures));
      }
    }
    return materials;
  }
  parseMaterial(materialData, name, textures) {
    let params = {
      name,
      side: this.getSide(materialData.attributes),
      flatShading: this.getSmooth(materialData.attributes)
    };
    const connections = this.parseConnections(materialData.connections, materialData.nodes);
    const maps = this.parseTextureNodes(connections.maps);
    this.parseAttributeImageMaps(connections.attributes, textures, maps, materialData.maps);
    const attributes = this.parseAttributes(connections.attributes, maps);
    this.parseEnvMap(connections, maps, attributes);
    params = Object.assign(maps, params);
    params = Object.assign(params, attributes);
    const materialType = this.getMaterialType(connections.attributes);
    return new materialType(params);
  }
  parseMaterialLwo2(materialData, name) {
    let params = {
      name,
      side: this.getSide(materialData.attributes),
      flatShading: this.getSmooth(materialData.attributes)
    };
    const attributes = this.parseAttributes(materialData.attributes, {});
    params = Object.assign(params, attributes);
    return new MeshPhongMaterial(params);
  }
  // Note: converting from left to right handed coords by switching x -> -x in vertices, and
  // then switching mat FrontSide -> BackSide
  // NB: this means that FrontSide and BackSide have been switched!
  getSide(attributes) {
    if (!attributes.side)
      return BackSide;
    switch (attributes.side) {
      case 0:
      case 1:
        return BackSide;
      case 2:
        return FrontSide;
      case 3:
        return DoubleSide;
    }
  }
  getSmooth(attributes) {
    if (!attributes.smooth)
      return true;
    return !attributes.smooth;
  }
  parseConnections(connections, nodes) {
    const materialConnections = {
      maps: {}
    };
    const inputName = connections.inputName;
    const inputNodeName = connections.inputNodeName;
    const nodeName = connections.nodeName;
    const scope = this;
    inputName.forEach(function(name, index) {
      if (name === "Material") {
        const matNode = scope.getNodeByRefName(inputNodeName[index], nodes);
        materialConnections.attributes = matNode.attributes;
        materialConnections.envMap = matNode.fileName;
        materialConnections.name = inputNodeName[index];
      }
    });
    nodeName.forEach(function(name, index) {
      if (name === materialConnections.name) {
        materialConnections.maps[inputName[index]] = scope.getNodeByRefName(inputNodeName[index], nodes);
      }
    });
    return materialConnections;
  }
  getNodeByRefName(refName, nodes) {
    for (const name in nodes) {
      if (nodes[name].refName === refName)
        return nodes[name];
    }
  }
  parseTextureNodes(textureNodes) {
    const maps = {};
    for (const name in textureNodes) {
      const node = textureNodes[name];
      const path = node.fileName;
      if (!path)
        return;
      const texture = this.loadTexture(path);
      if (node.widthWrappingMode !== void 0)
        texture.wrapS = this.getWrappingType(node.widthWrappingMode);
      if (node.heightWrappingMode !== void 0)
        texture.wrapT = this.getWrappingType(node.heightWrappingMode);
      switch (name) {
        case "Color":
          maps.map = texture;
          break;
        case "Roughness":
          maps.roughnessMap = texture;
          maps.roughness = 0.5;
          break;
        case "Specular":
          maps.specularMap = texture;
          maps.specular = 16777215;
          break;
        case "Luminous":
          maps.emissiveMap = texture;
          maps.emissive = 8421504;
          break;
        case "Luminous Color":
          maps.emissive = 8421504;
          break;
        case "Metallic":
          maps.metalnessMap = texture;
          maps.metalness = 0.5;
          break;
        case "Transparency":
        case "Alpha":
          maps.alphaMap = texture;
          maps.transparent = true;
          break;
        case "Normal":
          maps.normalMap = texture;
          if (node.amplitude !== void 0)
            maps.normalScale = new Vector2(node.amplitude, node.amplitude);
          break;
        case "Bump":
          maps.bumpMap = texture;
          break;
      }
    }
    if (maps.roughnessMap && maps.specularMap)
      delete maps.specularMap;
    return maps;
  }
  // maps can also be defined on individual material attributes, parse those here
  // This occurs on Standard (Phong) surfaces
  parseAttributeImageMaps(attributes, textures, maps) {
    for (const name in attributes) {
      const attribute = attributes[name];
      if (attribute.maps) {
        const mapData = attribute.maps[0];
        const path = this.getTexturePathByIndex(mapData.imageIndex, textures);
        if (!path)
          return;
        const texture = this.loadTexture(path);
        if (mapData.wrap !== void 0)
          texture.wrapS = this.getWrappingType(mapData.wrap.w);
        if (mapData.wrap !== void 0)
          texture.wrapT = this.getWrappingType(mapData.wrap.h);
        switch (name) {
          case "Color":
            maps.map = texture;
            break;
          case "Diffuse":
            maps.aoMap = texture;
            break;
          case "Roughness":
            maps.roughnessMap = texture;
            maps.roughness = 1;
            break;
          case "Specular":
            maps.specularMap = texture;
            maps.specular = 16777215;
            break;
          case "Luminosity":
            maps.emissiveMap = texture;
            maps.emissive = 8421504;
            break;
          case "Metallic":
            maps.metalnessMap = texture;
            maps.metalness = 1;
            break;
          case "Transparency":
          case "Alpha":
            maps.alphaMap = texture;
            maps.transparent = true;
            break;
          case "Normal":
            maps.normalMap = texture;
            break;
          case "Bump":
            maps.bumpMap = texture;
            break;
        }
      }
    }
  }
  parseAttributes(attributes, maps) {
    const params = {};
    if (attributes.Color && !maps.map) {
      params.color = new Color().fromArray(attributes.Color.value);
    } else {
      params.color = new Color();
    }
    if (attributes.Transparency && attributes.Transparency.value !== 0) {
      params.opacity = 1 - attributes.Transparency.value;
      params.transparent = true;
    }
    if (attributes["Bump Height"])
      params.bumpScale = attributes["Bump Height"].value * 0.1;
    if (attributes["Refraction Index"])
      params.refractionRatio = 1 / attributes["Refraction Index"].value;
    this.parsePhysicalAttributes(params, attributes, maps);
    this.parseStandardAttributes(params, attributes, maps);
    this.parsePhongAttributes(params, attributes, maps);
    return params;
  }
  parsePhysicalAttributes(params, attributes) {
    if (attributes.Clearcoat && attributes.Clearcoat.value > 0) {
      params.clearcoat = attributes.Clearcoat.value;
      if (attributes["Clearcoat Gloss"]) {
        params.clearcoatRoughness = 0.5 * (1 - attributes["Clearcoat Gloss"].value);
      }
    }
  }
  parseStandardAttributes(params, attributes, maps) {
    if (attributes.Luminous) {
      params.emissiveIntensity = attributes.Luminous.value;
      if (attributes["Luminous Color"] && !maps.emissive) {
        params.emissive = new Color().fromArray(attributes["Luminous Color"].value);
      } else {
        params.emissive = new Color(8421504);
      }
    }
    if (attributes.Roughness && !maps.roughnessMap)
      params.roughness = attributes.Roughness.value;
    if (attributes.Metallic && !maps.metalnessMap)
      params.metalness = attributes.Metallic.value;
  }
  parsePhongAttributes(params, attributes, maps) {
    if (attributes.Diffuse)
      params.color.multiplyScalar(attributes.Diffuse.value);
    if (attributes.Reflection) {
      params.reflectivity = attributes.Reflection.value;
      params.combine = AddOperation;
    }
    if (attributes.Luminosity) {
      params.emissiveIntensity = attributes.Luminosity.value;
      if (!maps.emissiveMap && !maps.map) {
        params.emissive = params.color;
      } else {
        params.emissive = new Color(8421504);
      }
    }
    if (!attributes.Roughness && attributes.Specular && !maps.specularMap) {
      if (attributes["Color Highlight"]) {
        params.specular = new Color().setScalar(attributes.Specular.value).lerp(params.color.clone().multiplyScalar(attributes.Specular.value), attributes["Color Highlight"].value);
      } else {
        params.specular = new Color().setScalar(attributes.Specular.value);
      }
    }
    if (params.specular && attributes.Glossiness) {
      params.shininess = 7 + Math.pow(2, attributes.Glossiness.value * 12 + 2);
    }
  }
  parseEnvMap(connections, maps, attributes) {
    if (connections.envMap) {
      const envMap = this.loadTexture(connections.envMap);
      if (attributes.transparent && attributes.opacity < 0.999) {
        envMap.mapping = EquirectangularRefractionMapping;
        if (attributes.reflectivity !== void 0) {
          delete attributes.reflectivity;
          delete attributes.combine;
        }
        if (attributes.metalness !== void 0) {
          delete attributes.metalness;
        }
      } else {
        envMap.mapping = EquirectangularReflectionMapping;
      }
      maps.envMap = envMap;
    }
  }
  // get texture defined at top level by its index
  getTexturePathByIndex(index) {
    let fileName = "";
    if (!_lwoTree.textures)
      return fileName;
    _lwoTree.textures.forEach(function(texture) {
      if (texture.index === index)
        fileName = texture.fileName;
    });
    return fileName;
  }
  loadTexture(path) {
    if (!path)
      return null;
    const texture = this.textureLoader.load(path, void 0, void 0, function() {
      console.warn(
        "LWOLoader: non-standard resource hierarchy. Use `resourcePath` parameter to specify root content directory."
      );
    });
    return texture;
  }
  // 0 = Reset, 1 = Repeat, 2 = Mirror, 3 = Edge
  getWrappingType(num) {
    switch (num) {
      case 0:
        console.warn('LWOLoader: "Reset" texture wrapping type is not supported in three.js');
        return ClampToEdgeWrapping;
      case 1:
        return RepeatWrapping;
      case 2:
        return MirroredRepeatWrapping;
      case 3:
        return ClampToEdgeWrapping;
    }
  }
  getMaterialType(nodeData) {
    if (nodeData.Clearcoat && nodeData.Clearcoat.value > 0)
      return MeshPhysicalMaterial;
    if (nodeData.Roughness)
      return MeshStandardMaterial;
    return MeshPhongMaterial;
  }
}
class GeometryParser {
  parse(geoData, layer) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(geoData.points, 3));
    const indices = this.splitIndices(geoData.vertexIndices, geoData.polygonDimensions);
    geometry.setIndex(indices);
    this.parseGroups(geometry, geoData);
    geometry.computeVertexNormals();
    this.parseUVs(geometry, layer, indices);
    this.parseMorphTargets(geometry, layer, indices);
    geometry.translate(-layer.pivot[0], -layer.pivot[1], -layer.pivot[2]);
    return geometry;
  }
  // split quads into tris
  splitIndices(indices, polygonDimensions) {
    const remappedIndices = [];
    let i = 0;
    polygonDimensions.forEach(function(dim) {
      if (dim < 4) {
        for (let k = 0; k < dim; k++)
          remappedIndices.push(indices[i + k]);
      } else if (dim === 4) {
        remappedIndices.push(
          indices[i],
          indices[i + 1],
          indices[i + 2],
          indices[i],
          indices[i + 2],
          indices[i + 3]
        );
      } else if (dim > 4) {
        for (let k = 1; k < dim - 1; k++) {
          remappedIndices.push(indices[i], indices[i + k], indices[i + k + 1]);
        }
        console.warn("LWOLoader: polygons with greater than 4 sides are not supported");
      }
      i += dim;
    });
    return remappedIndices;
  }
  // NOTE: currently ignoring poly indices and assuming that they are intelligently ordered
  parseGroups(geometry, geoData) {
    const tags = _lwoTree.tags;
    const matNames = [];
    let elemSize = 3;
    if (geoData.type === "lines")
      elemSize = 2;
    if (geoData.type === "points")
      elemSize = 1;
    const remappedIndices = this.splitMaterialIndices(geoData.polygonDimensions, geoData.materialIndices);
    let indexNum = 0;
    const indexPairs = {};
    let prevMaterialIndex;
    let materialIndex;
    let prevStart = 0;
    let currentCount = 0;
    for (let i = 0; i < remappedIndices.length; i += 2) {
      materialIndex = remappedIndices[i + 1];
      if (i === 0)
        matNames[indexNum] = tags[materialIndex];
      if (prevMaterialIndex === void 0)
        prevMaterialIndex = materialIndex;
      if (materialIndex !== prevMaterialIndex) {
        let currentIndex;
        if (indexPairs[tags[prevMaterialIndex]]) {
          currentIndex = indexPairs[tags[prevMaterialIndex]];
        } else {
          currentIndex = indexNum;
          indexPairs[tags[prevMaterialIndex]] = indexNum;
          matNames[indexNum] = tags[prevMaterialIndex];
          indexNum++;
        }
        geometry.addGroup(prevStart, currentCount, currentIndex);
        prevStart += currentCount;
        prevMaterialIndex = materialIndex;
        currentCount = 0;
      }
      currentCount += elemSize;
    }
    if (geometry.groups.length > 0) {
      let currentIndex;
      if (indexPairs[tags[materialIndex]]) {
        currentIndex = indexPairs[tags[materialIndex]];
      } else {
        currentIndex = indexNum;
        indexPairs[tags[materialIndex]] = indexNum;
        matNames[indexNum] = tags[materialIndex];
      }
      geometry.addGroup(prevStart, currentCount, currentIndex);
    }
    geometry.userData.matNames = matNames;
  }
  splitMaterialIndices(polygonDimensions, indices) {
    const remappedIndices = [];
    polygonDimensions.forEach(function(dim, i) {
      if (dim <= 3) {
        remappedIndices.push(indices[i * 2], indices[i * 2 + 1]);
      } else if (dim === 4) {
        remappedIndices.push(indices[i * 2], indices[i * 2 + 1], indices[i * 2], indices[i * 2 + 1]);
      } else {
        for (let k = 0; k < dim - 2; k++) {
          remappedIndices.push(indices[i * 2], indices[i * 2 + 1]);
        }
      }
    });
    return remappedIndices;
  }
  // UV maps:
  // 1: are defined via index into an array of points, not into a geometry
  // - the geometry is also defined by an index into this array, but the indexes may not match
  // 2: there can be any number of UV maps for a single geometry. Here these are combined,
  // 	with preference given to the first map encountered
  // 3: UV maps can be partial - that is, defined for only a part of the geometry
  // 4: UV maps can be VMAP or VMAD (discontinuous, to allow for seams). In practice, most
  // UV maps are defined as partially VMAP and partially VMAD
  // VMADs are currently not supported
  parseUVs(geometry, layer) {
    const remappedUVs = Array.from(Array(geometry.attributes.position.count * 2), function() {
      return 0;
    });
    for (const name in layer.uvs) {
      const uvs = layer.uvs[name].uvs;
      const uvIndices = layer.uvs[name].uvIndices;
      uvIndices.forEach(function(i, j) {
        remappedUVs[i * 2] = uvs[j * 2];
        remappedUVs[i * 2 + 1] = uvs[j * 2 + 1];
      });
    }
    geometry.setAttribute("uv", new Float32BufferAttribute(remappedUVs, 2));
  }
  parseMorphTargets(geometry, layer) {
    let num = 0;
    for (const name in layer.morphTargets) {
      const remappedPoints = geometry.attributes.position.array.slice();
      if (!geometry.morphAttributes.position)
        geometry.morphAttributes.position = [];
      const morphPoints = layer.morphTargets[name].points;
      const morphIndices = layer.morphTargets[name].indices;
      const type = layer.morphTargets[name].type;
      morphIndices.forEach(function(i, j) {
        if (type === "relative") {
          remappedPoints[i * 3] += morphPoints[j * 3];
          remappedPoints[i * 3 + 1] += morphPoints[j * 3 + 1];
          remappedPoints[i * 3 + 2] += morphPoints[j * 3 + 2];
        } else {
          remappedPoints[i * 3] = morphPoints[j * 3];
          remappedPoints[i * 3 + 1] = morphPoints[j * 3 + 1];
          remappedPoints[i * 3 + 2] = morphPoints[j * 3 + 2];
        }
      });
      geometry.morphAttributes.position[num] = new Float32BufferAttribute(remappedPoints, 3);
      geometry.morphAttributes.position[num].name = name;
      num++;
    }
    geometry.morphTargetsRelative = false;
  }
}
function extractParentUrl(url, dir) {
  const index = url.indexOf(dir);
  if (index === -1)
    return "./";
  return url.substr(0, index);
}
export {
  LWOLoader
};
//# sourceMappingURL=LWOLoader.js.map
