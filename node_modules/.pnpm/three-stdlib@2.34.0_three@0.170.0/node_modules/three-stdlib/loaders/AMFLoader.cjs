"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const fflate = require("fflate");
const LoaderUtils = require("../_polyfill/LoaderUtils.cjs");
class AMFLoader extends THREE.Loader {
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
    function loadDocument(data2) {
      let view = new DataView(data2);
      const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1));
      if (magic === "PK") {
        let zip = null;
        let file = null;
        console.log("THREE.AMFLoader: Loading Zip");
        try {
          zip = fflate.unzipSync(new Uint8Array(data2));
        } catch (e) {
          if (e instanceof ReferenceError) {
            console.log("THREE.AMFLoader: fflate missing and file is compressed.");
            return null;
          }
        }
        for (file in zip) {
          if (file.toLowerCase().substr(-4) === ".amf") {
            break;
          }
        }
        console.log("THREE.AMFLoader: Trying to load file asset: " + file);
        view = new DataView(zip[file].buffer);
      }
      const fileText = LoaderUtils.decodeText(view);
      const xmlData2 = new DOMParser().parseFromString(fileText, "application/xml");
      if (xmlData2.documentElement.nodeName.toLowerCase() !== "amf") {
        console.log("THREE.AMFLoader: Error loading AMF - no AMF document found.");
        return null;
      }
      return xmlData2;
    }
    function loadDocumentScale(node) {
      let scale = 1;
      let unit = "millimeter";
      if (node.documentElement.attributes.unit !== void 0) {
        unit = node.documentElement.attributes.unit.value.toLowerCase();
      }
      const scaleUnits = {
        millimeter: 1,
        inch: 25.4,
        feet: 304.8,
        meter: 1e3,
        micron: 1e-3
      };
      if (scaleUnits[unit] !== void 0) {
        scale = scaleUnits[unit];
      }
      console.log("THREE.AMFLoader: Unit scale: " + scale);
      return scale;
    }
    function loadMaterials(node) {
      let matName = "AMF Material";
      const matId = node.attributes.id.textContent;
      let color = { r: 1, g: 1, b: 1, a: 1 };
      let loadedMaterial = null;
      for (let i2 = 0; i2 < node.childNodes.length; i2++) {
        const matChildEl = node.childNodes[i2];
        if (matChildEl.nodeName === "metadata" && matChildEl.attributes.type !== void 0) {
          if (matChildEl.attributes.type.value === "name") {
            matName = matChildEl.textContent;
          }
        } else if (matChildEl.nodeName === "color") {
          color = loadColor(matChildEl);
        }
      }
      loadedMaterial = new THREE.MeshPhongMaterial({
        flatShading: true,
        color: new THREE.Color(color.r, color.g, color.b),
        name: matName
      });
      if (color.a !== 1) {
        loadedMaterial.transparent = true;
        loadedMaterial.opacity = color.a;
      }
      return { id: matId, material: loadedMaterial };
    }
    function loadColor(node) {
      const color = { r: 1, g: 1, b: 1, a: 1 };
      for (let i2 = 0; i2 < node.childNodes.length; i2++) {
        const matColor = node.childNodes[i2];
        if (matColor.nodeName === "r") {
          color.r = matColor.textContent;
        } else if (matColor.nodeName === "g") {
          color.g = matColor.textContent;
        } else if (matColor.nodeName === "b") {
          color.b = matColor.textContent;
        } else if (matColor.nodeName === "a") {
          color.a = matColor.textContent;
        }
      }
      return color;
    }
    function loadMeshVolume(node) {
      const volume = { name: "", triangles: [], materialid: null };
      let currVolumeNode = node.firstElementChild;
      if (node.attributes.materialid !== void 0) {
        volume.materialId = node.attributes.materialid.nodeValue;
      }
      while (currVolumeNode) {
        if (currVolumeNode.nodeName === "metadata") {
          if (currVolumeNode.attributes.type !== void 0) {
            if (currVolumeNode.attributes.type.value === "name") {
              volume.name = currVolumeNode.textContent;
            }
          }
        } else if (currVolumeNode.nodeName === "triangle") {
          const v1 = currVolumeNode.getElementsByTagName("v1")[0].textContent;
          const v2 = currVolumeNode.getElementsByTagName("v2")[0].textContent;
          const v3 = currVolumeNode.getElementsByTagName("v3")[0].textContent;
          volume.triangles.push(v1, v2, v3);
        }
        currVolumeNode = currVolumeNode.nextElementSibling;
      }
      return volume;
    }
    function loadMeshVertices(node) {
      const vertArray = [];
      const normalArray = [];
      let currVerticesNode = node.firstElementChild;
      while (currVerticesNode) {
        if (currVerticesNode.nodeName === "vertex") {
          let vNode = currVerticesNode.firstElementChild;
          while (vNode) {
            if (vNode.nodeName === "coordinates") {
              const x = vNode.getElementsByTagName("x")[0].textContent;
              const y = vNode.getElementsByTagName("y")[0].textContent;
              const z = vNode.getElementsByTagName("z")[0].textContent;
              vertArray.push(x, y, z);
            } else if (vNode.nodeName === "normal") {
              const nx = vNode.getElementsByTagName("nx")[0].textContent;
              const ny = vNode.getElementsByTagName("ny")[0].textContent;
              const nz = vNode.getElementsByTagName("nz")[0].textContent;
              normalArray.push(nx, ny, nz);
            }
            vNode = vNode.nextElementSibling;
          }
        }
        currVerticesNode = currVerticesNode.nextElementSibling;
      }
      return { vertices: vertArray, normals: normalArray };
    }
    function loadObject(node) {
      const objId = node.attributes.id.textContent;
      const loadedObject = { name: "amfobject", meshes: [] };
      let currColor = null;
      let currObjNode = node.firstElementChild;
      while (currObjNode) {
        if (currObjNode.nodeName === "metadata") {
          if (currObjNode.attributes.type !== void 0) {
            if (currObjNode.attributes.type.value === "name") {
              loadedObject.name = currObjNode.textContent;
            }
          }
        } else if (currObjNode.nodeName === "color") {
          currColor = loadColor(currObjNode);
        } else if (currObjNode.nodeName === "mesh") {
          let currMeshNode = currObjNode.firstElementChild;
          const mesh = { vertices: [], normals: [], volumes: [], color: currColor };
          while (currMeshNode) {
            if (currMeshNode.nodeName === "vertices") {
              const loadedVertices = loadMeshVertices(currMeshNode);
              mesh.normals = mesh.normals.concat(loadedVertices.normals);
              mesh.vertices = mesh.vertices.concat(loadedVertices.vertices);
            } else if (currMeshNode.nodeName === "volume") {
              mesh.volumes.push(loadMeshVolume(currMeshNode));
            }
            currMeshNode = currMeshNode.nextElementSibling;
          }
          loadedObject.meshes.push(mesh);
        }
        currObjNode = currObjNode.nextElementSibling;
      }
      return { id: objId, obj: loadedObject };
    }
    const xmlData = loadDocument(data);
    let amfName = "";
    let amfAuthor = "";
    const amfScale = loadDocumentScale(xmlData);
    const amfMaterials = {};
    const amfObjects = {};
    const childNodes = xmlData.documentElement.childNodes;
    let i, j;
    for (i = 0; i < childNodes.length; i++) {
      const child = childNodes[i];
      if (child.nodeName === "metadata") {
        if (child.attributes.type !== void 0) {
          if (child.attributes.type.value === "name") {
            amfName = child.textContent;
          } else if (child.attributes.type.value === "author") {
            amfAuthor = child.textContent;
          }
        }
      } else if (child.nodeName === "material") {
        const loadedMaterial = loadMaterials(child);
        amfMaterials[loadedMaterial.id] = loadedMaterial.material;
      } else if (child.nodeName === "object") {
        const loadedObject = loadObject(child);
        amfObjects[loadedObject.id] = loadedObject.obj;
      }
    }
    const sceneObject = new THREE.Group();
    const defaultMaterial = new THREE.MeshPhongMaterial({ color: 11184895, flatShading: true });
    sceneObject.name = amfName;
    sceneObject.userData.author = amfAuthor;
    sceneObject.userData.loader = "AMF";
    for (const id in amfObjects) {
      const part = amfObjects[id];
      const meshes = part.meshes;
      const newObject = new THREE.Group();
      newObject.name = part.name || "";
      for (i = 0; i < meshes.length; i++) {
        let objDefaultMaterial = defaultMaterial;
        const mesh = meshes[i];
        const vertices = new THREE.Float32BufferAttribute(mesh.vertices, 3);
        let normals = null;
        if (mesh.normals.length) {
          normals = new THREE.Float32BufferAttribute(mesh.normals, 3);
        }
        if (mesh.color) {
          const color = mesh.color;
          objDefaultMaterial = defaultMaterial.clone();
          objDefaultMaterial.color = new THREE.Color(color.r, color.g, color.b);
          if (color.a !== 1) {
            objDefaultMaterial.transparent = true;
            objDefaultMaterial.opacity = color.a;
          }
        }
        const volumes = mesh.volumes;
        for (j = 0; j < volumes.length; j++) {
          const volume = volumes[j];
          const newGeometry = new THREE.BufferGeometry();
          let material = objDefaultMaterial;
          newGeometry.setIndex(volume.triangles);
          newGeometry.setAttribute("position", vertices.clone());
          if (normals) {
            newGeometry.setAttribute("normal", normals.clone());
          }
          if (amfMaterials[volume.materialId] !== void 0) {
            material = amfMaterials[volume.materialId];
          }
          newGeometry.scale(amfScale, amfScale, amfScale);
          newObject.add(new THREE.Mesh(newGeometry, material.clone()));
        }
      }
      sceneObject.add(newObject);
    }
    return sceneObject;
  }
}
exports.AMFLoader = AMFLoader;
//# sourceMappingURL=AMFLoader.cjs.map
