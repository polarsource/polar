"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const FINISH_TYPE_DEFAULT = 0;
const FINISH_TYPE_CHROME = 1;
const FINISH_TYPE_PEARLESCENT = 2;
const FINISH_TYPE_RUBBER = 3;
const FINISH_TYPE_MATTE_METALLIC = 4;
const FINISH_TYPE_METAL = 5;
const FILE_LOCATION_AS_IS = 0;
const FILE_LOCATION_TRY_PARTS = 1;
const FILE_LOCATION_TRY_P = 2;
const FILE_LOCATION_TRY_MODELS = 3;
const FILE_LOCATION_TRY_RELATIVE = 4;
const FILE_LOCATION_TRY_ABSOLUTE = 5;
const FILE_LOCATION_NOT_FOUND = 6;
const MAIN_COLOUR_CODE = "16";
const MAIN_EDGE_COLOUR_CODE = "24";
const _tempVec0 = new THREE.Vector3();
const _tempVec1 = new THREE.Vector3();
class LDrawConditionalLineMaterial extends THREE.ShaderMaterial {
  constructor(parameters) {
    super({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          diffuse: {
            value: new THREE.Color()
          },
          opacity: {
            value: 1
          }
        }
      ]),
      vertexShader: (
        /* glsl */
        `
        attribute vec3 control0;
        attribute vec3 control1;
        attribute vec3 direction;
        varying float discardFlag;

        #include <common>
        #include <color_pars_vertex>
        #include <fog_pars_vertex>
        #include <logdepthbuf_pars_vertex>
        #include <clipping_planes_pars_vertex>

        void main() {
          #include <color_vertex>

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Transform the line segment ends and control points into camera clip space
          vec4 c0 = projectionMatrix * modelViewMatrix * vec4(control0, 1.0);
          vec4 c1 = projectionMatrix * modelViewMatrix * vec4(control1, 1.0);
          vec4 p0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 p1 = projectionMatrix * modelViewMatrix * vec4(position + direction, 1.0);

          c0.xy /= c0.w;
          c1.xy /= c1.w;
          p0.xy /= p0.w;
          p1.xy /= p1.w;

          // Get the direction of the segment and an orthogonal vector
          vec2 dir = p1.xy - p0.xy;
          vec2 norm = vec2(-dir.y, dir.x);

          // Get control point directions from the line
          vec2 c0dir = c0.xy - p1.xy;
          vec2 c1dir = c1.xy - p1.xy;

          // If the vectors to the controls points are pointed in different directions away
          // from the line segment then the line should not be drawn.
          float d0 = dot(normalize(norm), normalize(c0dir));
          float d1 = dot(normalize(norm), normalize(c1dir));
          discardFlag = float(sign(d0) != sign(d1));

          #include <logdepthbuf_vertex>
          #include <clipping_planes_vertex>
          #include <fog_vertex>
        }
      `
      ),
      fragmentShader: (
        /* glsl */
        `
        uniform vec3 diffuse;
        uniform float opacity;
        varying float discardFlag;

        #include <common>
        #include <color_pars_fragment>
        #include <fog_pars_fragment>
        #include <logdepthbuf_pars_fragment>
        #include <clipping_planes_pars_fragment>

        void main() {
          if (discardFlag > 0.5) discard;

          #include <clipping_planes_fragment>
          vec3 outgoingLight = vec3(0.0);
          vec4 diffuseColor = vec4(diffuse, opacity);
          #include <logdepthbuf_fragment>
          #include <color_fragment>
          outgoingLight = diffuseColor.rgb; // simple shader
          gl_FragColor = vec4(outgoingLight, diffuseColor.a);
          #include <tonemapping_fragment>
          #include <${parseInt(THREE.REVISION.replace(/\D+/g, "")) >= 154 ? "colorspace_fragment" : "encodings_fragment"}>
          #include <fog_fragment>
          #include <premultiplied_alpha_fragment>
        }
      `
      )
    });
    Object.defineProperties(this, {
      opacity: {
        get: function() {
          return this.uniforms.opacity.value;
        },
        set: function(value) {
          this.uniforms.opacity.value = value;
        }
      },
      color: {
        get: function() {
          return this.uniforms.diffuse.value;
        }
      }
    });
    this.setValues(parameters);
    this.isLDrawConditionalLineMaterial = true;
  }
}
class ConditionalLineSegments extends THREE.LineSegments {
  constructor(geometry, material) {
    super(geometry, material);
    this.isConditionalLine = true;
  }
}
function generateFaceNormals(faces) {
  for (let i = 0, l = faces.length; i < l; i++) {
    const face = faces[i];
    const vertices = face.vertices;
    const v0 = vertices[0];
    const v1 = vertices[1];
    const v2 = vertices[2];
    _tempVec0.subVectors(v1, v0);
    _tempVec1.subVectors(v2, v1);
    face.faceNormal = new THREE.Vector3().crossVectors(_tempVec0, _tempVec1).normalize();
  }
}
const _ray = new THREE.Ray();
function smoothNormals(faces, lineSegments, checkSubSegments = false) {
  const hashMultiplier = (1 + 1e-10) * 100;
  function hashVertex(v) {
    const x = ~~(v.x * hashMultiplier);
    const y = ~~(v.y * hashMultiplier);
    const z = ~~(v.z * hashMultiplier);
    return `${x},${y},${z}`;
  }
  function hashEdge(v0, v1) {
    return `${hashVertex(v0)}_${hashVertex(v1)}`;
  }
  function toNormalizedRay(v0, v1, targetRay) {
    targetRay.direction.subVectors(v1, v0).normalize();
    const scalar = v0.dot(targetRay.direction);
    targetRay.origin.copy(v0).addScaledVector(targetRay.direction, -scalar);
    return targetRay;
  }
  function hashRay(ray) {
    return hashEdge(ray.origin, ray.direction);
  }
  const hardEdges = /* @__PURE__ */ new Set();
  const hardEdgeRays = /* @__PURE__ */ new Map();
  const halfEdgeList = {};
  const normals = [];
  for (let i = 0, l = lineSegments.length; i < l; i++) {
    const ls = lineSegments[i];
    const vertices = ls.vertices;
    const v0 = vertices[0];
    const v1 = vertices[1];
    hardEdges.add(hashEdge(v0, v1));
    hardEdges.add(hashEdge(v1, v0));
    if (checkSubSegments) {
      const ray = toNormalizedRay(v0, v1, new THREE.Ray());
      const rh1 = hashRay(ray);
      if (!hardEdgeRays.has(rh1)) {
        toNormalizedRay(v1, v0, ray);
        const rh2 = hashRay(ray);
        const info2 = {
          ray,
          distances: []
        };
        hardEdgeRays.set(rh1, info2);
        hardEdgeRays.set(rh2, info2);
      }
      const info = hardEdgeRays.get(rh1);
      let d0 = info.ray.direction.dot(v0);
      let d1 = info.ray.direction.dot(v1);
      if (d0 > d1) {
        [d0, d1] = [d1, d0];
      }
      info.distances.push(d0, d1);
    }
  }
  for (let i = 0, l = faces.length; i < l; i++) {
    const tri = faces[i];
    const vertices = tri.vertices;
    const vertCount = vertices.length;
    for (let i2 = 0; i2 < vertCount; i2++) {
      const index = i2;
      const next = (i2 + 1) % vertCount;
      const v0 = vertices[index];
      const v1 = vertices[next];
      const hash = hashEdge(v0, v1);
      if (hardEdges.has(hash)) {
        continue;
      }
      if (checkSubSegments) {
        toNormalizedRay(v0, v1, _ray);
        const rayHash = hashRay(_ray);
        if (hardEdgeRays.has(rayHash)) {
          const info2 = hardEdgeRays.get(rayHash);
          const { ray, distances } = info2;
          let d0 = ray.direction.dot(v0);
          let d1 = ray.direction.dot(v1);
          if (d0 > d1) {
            [d0, d1] = [d1, d0];
          }
          let found = false;
          for (let i3 = 0, l2 = distances.length; i3 < l2; i3 += 2) {
            if (d0 >= distances[i3] && d1 <= distances[i3 + 1]) {
              found = true;
              break;
            }
          }
          if (found) {
            continue;
          }
        }
      }
      const info = {
        index,
        tri
      };
      halfEdgeList[hash] = info;
    }
  }
  while (true) {
    let halfEdge = null;
    for (const key in halfEdgeList) {
      halfEdge = halfEdgeList[key];
      break;
    }
    if (halfEdge === null) {
      break;
    }
    const queue = [halfEdge];
    while (queue.length > 0) {
      const tri = queue.pop().tri;
      const vertices = tri.vertices;
      const vertNormals = tri.normals;
      const faceNormal = tri.faceNormal;
      const vertCount = vertices.length;
      for (let i2 = 0; i2 < vertCount; i2++) {
        const index = i2;
        const next = (i2 + 1) % vertCount;
        const v0 = vertices[index];
        const v1 = vertices[next];
        const hash = hashEdge(v0, v1);
        delete halfEdgeList[hash];
        const reverseHash = hashEdge(v1, v0);
        const otherInfo = halfEdgeList[reverseHash];
        if (otherInfo) {
          const otherTri = otherInfo.tri;
          const otherIndex = otherInfo.index;
          const otherNormals = otherTri.normals;
          const otherVertCount = otherNormals.length;
          const otherFaceNormal = otherTri.faceNormal;
          if (Math.abs(otherTri.faceNormal.dot(tri.faceNormal)) < 0.25) {
            continue;
          }
          if (reverseHash in halfEdgeList) {
            queue.push(otherInfo);
            delete halfEdgeList[reverseHash];
          }
          const otherNext = (otherIndex + 1) % otherVertCount;
          if (vertNormals[index] && otherNormals[otherNext] && vertNormals[index] !== otherNormals[otherNext]) {
            otherNormals[otherNext].norm.add(vertNormals[index].norm);
            vertNormals[index].norm = otherNormals[otherNext].norm;
          }
          let sharedNormal1 = vertNormals[index] || otherNormals[otherNext];
          if (sharedNormal1 === null) {
            sharedNormal1 = { norm: new THREE.Vector3() };
            normals.push(sharedNormal1.norm);
          }
          if (vertNormals[index] === null) {
            vertNormals[index] = sharedNormal1;
            sharedNormal1.norm.add(faceNormal);
          }
          if (otherNormals[otherNext] === null) {
            otherNormals[otherNext] = sharedNormal1;
            sharedNormal1.norm.add(otherFaceNormal);
          }
          if (vertNormals[next] && otherNormals[otherIndex] && vertNormals[next] !== otherNormals[otherIndex]) {
            otherNormals[otherIndex].norm.add(vertNormals[next].norm);
            vertNormals[next].norm = otherNormals[otherIndex].norm;
          }
          let sharedNormal2 = vertNormals[next] || otherNormals[otherIndex];
          if (sharedNormal2 === null) {
            sharedNormal2 = { norm: new THREE.Vector3() };
            normals.push(sharedNormal2.norm);
          }
          if (vertNormals[next] === null) {
            vertNormals[next] = sharedNormal2;
            sharedNormal2.norm.add(faceNormal);
          }
          if (otherNormals[otherIndex] === null) {
            otherNormals[otherIndex] = sharedNormal2;
            sharedNormal2.norm.add(otherFaceNormal);
          }
        }
      }
    }
  }
  for (let i = 0, l = normals.length; i < l; i++) {
    normals[i].normalize();
  }
}
function isPartType(type) {
  return type === "Part" || type === "Unofficial_Part";
}
function isPrimitiveType(type) {
  return /primitive/i.test(type) || type === "Subpart";
}
class LineParser {
  constructor(line, lineNumber) {
    this.line = line;
    this.lineLength = line.length;
    this.currentCharIndex = 0;
    this.currentChar = " ";
    this.lineNumber = lineNumber;
  }
  seekNonSpace() {
    while (this.currentCharIndex < this.lineLength) {
      this.currentChar = this.line.charAt(this.currentCharIndex);
      if (this.currentChar !== " " && this.currentChar !== "	") {
        return;
      }
      this.currentCharIndex++;
    }
  }
  getToken() {
    const pos0 = this.currentCharIndex++;
    while (this.currentCharIndex < this.lineLength) {
      this.currentChar = this.line.charAt(this.currentCharIndex);
      if (this.currentChar === " " || this.currentChar === "	") {
        break;
      }
      this.currentCharIndex++;
    }
    const pos1 = this.currentCharIndex;
    this.seekNonSpace();
    return this.line.substring(pos0, pos1);
  }
  getVector() {
    return new THREE.Vector3(parseFloat(this.getToken()), parseFloat(this.getToken()), parseFloat(this.getToken()));
  }
  getRemainingString() {
    return this.line.substring(this.currentCharIndex, this.lineLength);
  }
  isAtTheEnd() {
    return this.currentCharIndex >= this.lineLength;
  }
  setToEnd() {
    this.currentCharIndex = this.lineLength;
  }
  getLineNumberString() {
    return this.lineNumber >= 0 ? " at line " + this.lineNumber : "";
  }
}
class LDrawParsedCache {
  constructor(loader) {
    this.loader = loader;
    this._cache = {};
  }
  cloneResult(original) {
    const result = {};
    result.faces = original.faces.map((face) => {
      return {
        colorCode: face.colorCode,
        material: face.material,
        vertices: face.vertices.map((v) => v.clone()),
        normals: face.normals.map(() => null),
        faceNormal: null
      };
    });
    result.conditionalSegments = original.conditionalSegments.map((face) => {
      return {
        colorCode: face.colorCode,
        material: face.material,
        vertices: face.vertices.map((v) => v.clone()),
        controlPoints: face.controlPoints.map((v) => v.clone())
      };
    });
    result.lineSegments = original.lineSegments.map((face) => {
      return {
        colorCode: face.colorCode,
        material: face.material,
        vertices: face.vertices.map((v) => v.clone())
      };
    });
    result.type = original.type;
    result.category = original.category;
    result.keywords = original.keywords;
    result.subobjects = original.subobjects;
    result.totalFaces = original.totalFaces;
    result.startingConstructionStep = original.startingConstructionStep;
    result.materials = original.materials;
    result.group = null;
    return result;
  }
  async fetchData(fileName) {
    let triedLowerCase = false;
    let locationState = FILE_LOCATION_AS_IS;
    while (locationState !== FILE_LOCATION_NOT_FOUND) {
      let subobjectURL = fileName;
      switch (locationState) {
        case FILE_LOCATION_AS_IS:
          locationState = locationState + 1;
          break;
        case FILE_LOCATION_TRY_PARTS:
          subobjectURL = "parts/" + subobjectURL;
          locationState = locationState + 1;
          break;
        case FILE_LOCATION_TRY_P:
          subobjectURL = "p/" + subobjectURL;
          locationState = locationState + 1;
          break;
        case FILE_LOCATION_TRY_MODELS:
          subobjectURL = "models/" + subobjectURL;
          locationState = locationState + 1;
          break;
        case FILE_LOCATION_TRY_RELATIVE:
          subobjectURL = fileName.substring(0, fileName.lastIndexOf("/") + 1) + subobjectURL;
          locationState = locationState + 1;
          break;
        case FILE_LOCATION_TRY_ABSOLUTE:
          if (triedLowerCase) {
            locationState = FILE_LOCATION_NOT_FOUND;
          } else {
            fileName = fileName.toLowerCase();
            subobjectURL = fileName;
            triedLowerCase = true;
            locationState = FILE_LOCATION_AS_IS;
          }
          break;
      }
      const loader = this.loader;
      const fileLoader = new THREE.FileLoader(loader.manager);
      fileLoader.setPath(loader.partsLibraryPath);
      fileLoader.setRequestHeader(loader.requestHeader);
      fileLoader.setWithCredentials(loader.withCredentials);
      try {
        const text = await fileLoader.loadAsync(subobjectURL);
        return text;
      } catch (e) {
        continue;
      }
    }
    throw new Error('LDrawLoader: Subobject "' + fileName + '" could not be loaded.');
  }
  parse(text, fileName = null) {
    const loader = this.loader;
    const faces = [];
    const lineSegments = [];
    const conditionalSegments = [];
    const subobjects = [];
    const materials = {};
    const getLocalMaterial = (colorCode) => {
      return materials[colorCode] || null;
    };
    let type = "Model";
    let category = null;
    let keywords = null;
    let totalFaces = 0;
    if (text.indexOf("\r\n") !== -1) {
      text = text.replace(/\r\n/g, "\n");
    }
    const lines = text.split("\n");
    const numLines = lines.length;
    let parsingEmbeddedFiles = false;
    let currentEmbeddedFileName = null;
    let currentEmbeddedText = null;
    let bfcCertified = false;
    let bfcCCW = true;
    let bfcInverted = false;
    let bfcCull = true;
    let startingConstructionStep = false;
    for (let lineIndex = 0; lineIndex < numLines; lineIndex++) {
      const line = lines[lineIndex];
      if (line.length === 0)
        continue;
      if (parsingEmbeddedFiles) {
        if (line.startsWith("0 FILE ")) {
          this.setData(currentEmbeddedFileName, currentEmbeddedText);
          currentEmbeddedFileName = line.substring(7);
          currentEmbeddedText = "";
        } else {
          currentEmbeddedText += line + "\n";
        }
        continue;
      }
      const lp = new LineParser(line, lineIndex + 1);
      lp.seekNonSpace();
      if (lp.isAtTheEnd()) {
        continue;
      }
      const lineType = lp.getToken();
      let material;
      let colorCode;
      let segment;
      let ccw;
      let doubleSided;
      let v0, v1, v2, v3, c0, c1;
      switch (lineType) {
        case "0":
          const meta = lp.getToken();
          if (meta) {
            switch (meta) {
              case "!LDRAW_ORG":
                type = lp.getToken();
                break;
              case "!COLOUR":
                material = loader.parseColorMetaDirective(lp);
                if (material) {
                  materials[material.userData.code] = material;
                } else {
                  console.warn("LDrawLoader: Error parsing material" + lp.getLineNumberString());
                }
                break;
              case "!CATEGORY":
                category = lp.getToken();
                break;
              case "!KEYWORDS":
                const newKeywords = lp.getRemainingString().split(",");
                if (newKeywords.length > 0) {
                  if (!keywords) {
                    keywords = [];
                  }
                  newKeywords.forEach(function(keyword) {
                    keywords.push(keyword.trim());
                  });
                }
                break;
              case "FILE":
                if (lineIndex > 0) {
                  parsingEmbeddedFiles = true;
                  currentEmbeddedFileName = lp.getRemainingString();
                  currentEmbeddedText = "";
                  bfcCertified = false;
                  bfcCCW = true;
                }
                break;
              case "BFC":
                while (!lp.isAtTheEnd()) {
                  const token = lp.getToken();
                  switch (token) {
                    case "CERTIFY":
                    case "NOCERTIFY":
                      bfcCertified = token === "CERTIFY";
                      bfcCCW = true;
                      break;
                    case "CW":
                    case "CCW":
                      bfcCCW = token === "CCW";
                      break;
                    case "INVERTNEXT":
                      bfcInverted = true;
                      break;
                    case "CLIP":
                    case "NOCLIP":
                      bfcCull = token === "CLIP";
                      break;
                    default:
                      console.warn('THREE.LDrawLoader: BFC directive "' + token + '" is unknown.');
                      break;
                  }
                }
                break;
              case "STEP":
                startingConstructionStep = true;
                break;
            }
          }
          break;
        case "1":
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          const posX = parseFloat(lp.getToken());
          const posY = parseFloat(lp.getToken());
          const posZ = parseFloat(lp.getToken());
          const m0 = parseFloat(lp.getToken());
          const m1 = parseFloat(lp.getToken());
          const m2 = parseFloat(lp.getToken());
          const m3 = parseFloat(lp.getToken());
          const m4 = parseFloat(lp.getToken());
          const m5 = parseFloat(lp.getToken());
          const m6 = parseFloat(lp.getToken());
          const m7 = parseFloat(lp.getToken());
          const m8 = parseFloat(lp.getToken());
          const matrix = new THREE.Matrix4().set(m0, m1, m2, posX, m3, m4, m5, posY, m6, m7, m8, posZ, 0, 0, 0, 1);
          let fileName2 = lp.getRemainingString().trim().replace(/\\/g, "/");
          if (loader.fileMap[fileName2]) {
            fileName2 = loader.fileMap[fileName2];
          } else {
            if (fileName2.startsWith("s/")) {
              fileName2 = "parts/" + fileName2;
            } else if (fileName2.startsWith("48/")) {
              fileName2 = "p/" + fileName2;
            }
          }
          subobjects.push({
            material,
            colorCode,
            matrix,
            fileName: fileName2,
            inverted: bfcInverted,
            startingConstructionStep
          });
          bfcInverted = false;
          break;
        case "2":
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          v0 = lp.getVector();
          v1 = lp.getVector();
          segment = {
            material,
            colorCode,
            vertices: [v0, v1]
          };
          lineSegments.push(segment);
          break;
        case "5":
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          v0 = lp.getVector();
          v1 = lp.getVector();
          c0 = lp.getVector();
          c1 = lp.getVector();
          segment = {
            material,
            colorCode,
            vertices: [v0, v1],
            controlPoints: [c0, c1]
          };
          conditionalSegments.push(segment);
          break;
        case "3":
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          ccw = bfcCCW;
          doubleSided = !bfcCertified || !bfcCull;
          if (ccw === true) {
            v0 = lp.getVector();
            v1 = lp.getVector();
            v2 = lp.getVector();
          } else {
            v2 = lp.getVector();
            v1 = lp.getVector();
            v0 = lp.getVector();
          }
          faces.push({
            material,
            colorCode,
            faceNormal: null,
            vertices: [v0, v1, v2],
            normals: [null, null, null]
          });
          totalFaces++;
          if (doubleSided === true) {
            faces.push({
              material,
              colorCode,
              faceNormal: null,
              vertices: [v2, v1, v0],
              normals: [null, null, null]
            });
            totalFaces++;
          }
          break;
        case "4":
          colorCode = lp.getToken();
          material = getLocalMaterial(colorCode);
          ccw = bfcCCW;
          doubleSided = !bfcCertified || !bfcCull;
          if (ccw === true) {
            v0 = lp.getVector();
            v1 = lp.getVector();
            v2 = lp.getVector();
            v3 = lp.getVector();
          } else {
            v3 = lp.getVector();
            v2 = lp.getVector();
            v1 = lp.getVector();
            v0 = lp.getVector();
          }
          faces.push({
            material,
            colorCode,
            faceNormal: null,
            vertices: [v0, v1, v2, v3],
            normals: [null, null, null, null]
          });
          totalFaces += 2;
          if (doubleSided === true) {
            faces.push({
              material,
              colorCode,
              faceNormal: null,
              vertices: [v3, v2, v1, v0],
              normals: [null, null, null, null]
            });
            totalFaces += 2;
          }
          break;
        default:
          throw new Error('LDrawLoader: Unknown line type "' + lineType + '"' + lp.getLineNumberString() + ".");
      }
    }
    if (parsingEmbeddedFiles) {
      this.setData(currentEmbeddedFileName, currentEmbeddedText);
    }
    return {
      faces,
      conditionalSegments,
      lineSegments,
      type,
      category,
      keywords,
      subobjects,
      totalFaces,
      startingConstructionStep,
      materials,
      fileName,
      group: null
    };
  }
  // returns an (optionally cloned) instance of the data
  getData(fileName, clone = true) {
    const key = fileName.toLowerCase();
    const result = this._cache[key];
    if (result === null || result instanceof Promise) {
      return null;
    }
    if (clone) {
      return this.cloneResult(result);
    } else {
      return result;
    }
  }
  // kicks off a fetch and parse of the requested data if it hasn't already been loaded. Returns when
  // the data is ready to use and can be retrieved synchronously with "getData".
  async ensureDataLoaded(fileName) {
    const key = fileName.toLowerCase();
    if (!(key in this._cache)) {
      this._cache[key] = this.fetchData(fileName).then((text) => {
        const info = this.parse(text, fileName);
        this._cache[key] = info;
        return info;
      });
    }
    await this._cache[key];
  }
  // sets the data in the cache from parsed data
  setData(fileName, text) {
    const key = fileName.toLowerCase();
    this._cache[key] = this.parse(text, fileName);
  }
}
function getMaterialFromCode(colorCode, parentColorCode, materialHierarchy, forEdge) {
  const isPassthrough = !forEdge && colorCode === MAIN_COLOUR_CODE || forEdge && colorCode === MAIN_EDGE_COLOUR_CODE;
  if (isPassthrough) {
    colorCode = parentColorCode;
  }
  return materialHierarchy[colorCode] || null;
}
class LDrawPartsGeometryCache {
  constructor(loader) {
    this.loader = loader;
    this.parseCache = new LDrawParsedCache(loader);
    this._cache = {};
  }
  // Convert the given file information into a mesh by processing subobjects.
  async processIntoMesh(info) {
    const loader = this.loader;
    const parseCache = this.parseCache;
    const faceMaterials = /* @__PURE__ */ new Set();
    const processInfoSubobjects = async (info2, subobject = null) => {
      const subobjects = info2.subobjects;
      const promises = [];
      for (let i = 0, l = subobjects.length; i < l; i++) {
        const subobject2 = subobjects[i];
        const promise = parseCache.ensureDataLoaded(subobject2.fileName).then(() => {
          const subobjectInfo = parseCache.getData(subobject2.fileName, false);
          if (!isPrimitiveType(subobjectInfo.type)) {
            return this.loadModel(subobject2.fileName).catch((error) => {
              console.warn(error);
              return null;
            });
          }
          return processInfoSubobjects(parseCache.getData(subobject2.fileName), subobject2);
        });
        promises.push(promise);
      }
      const group2 = new THREE.Group();
      group2.userData.category = info2.category;
      group2.userData.keywords = info2.keywords;
      info2.group = group2;
      const subobjectInfos = await Promise.all(promises);
      for (let i = 0, l = subobjectInfos.length; i < l; i++) {
        const subobject2 = info2.subobjects[i];
        const subobjectInfo = subobjectInfos[i];
        if (subobjectInfo === null) {
          continue;
        }
        if (subobjectInfo.isGroup) {
          const subobjectGroup = subobjectInfo;
          subobject2.matrix.decompose(subobjectGroup.position, subobjectGroup.quaternion, subobjectGroup.scale);
          subobjectGroup.userData.startingConstructionStep = subobject2.startingConstructionStep;
          subobjectGroup.name = subobject2.fileName;
          loader.applyMaterialsToMesh(subobjectGroup, subobject2.colorCode, info2.materials);
          group2.add(subobjectGroup);
          continue;
        }
        if (subobjectInfo.group.children.length) {
          group2.add(subobjectInfo.group);
        }
        const parentLineSegments = info2.lineSegments;
        const parentConditionalSegments = info2.conditionalSegments;
        const parentFaces = info2.faces;
        const lineSegments = subobjectInfo.lineSegments;
        const conditionalSegments = subobjectInfo.conditionalSegments;
        const faces = subobjectInfo.faces;
        const matrix = subobject2.matrix;
        const inverted = subobject2.inverted;
        const matrixScaleInverted = matrix.determinant() < 0;
        const colorCode = subobject2.colorCode;
        const lineColorCode = colorCode === MAIN_COLOUR_CODE ? MAIN_EDGE_COLOUR_CODE : colorCode;
        for (let i2 = 0, l2 = lineSegments.length; i2 < l2; i2++) {
          const ls = lineSegments[i2];
          const vertices = ls.vertices;
          vertices[0].applyMatrix4(matrix);
          vertices[1].applyMatrix4(matrix);
          ls.colorCode = ls.colorCode === MAIN_EDGE_COLOUR_CODE ? lineColorCode : ls.colorCode;
          ls.material = ls.material || getMaterialFromCode(ls.colorCode, ls.colorCode, info2.materials, true);
          parentLineSegments.push(ls);
        }
        for (let i2 = 0, l2 = conditionalSegments.length; i2 < l2; i2++) {
          const os = conditionalSegments[i2];
          const vertices = os.vertices;
          const controlPoints = os.controlPoints;
          vertices[0].applyMatrix4(matrix);
          vertices[1].applyMatrix4(matrix);
          controlPoints[0].applyMatrix4(matrix);
          controlPoints[1].applyMatrix4(matrix);
          os.colorCode = os.colorCode === MAIN_EDGE_COLOUR_CODE ? lineColorCode : os.colorCode;
          os.material = os.material || getMaterialFromCode(os.colorCode, os.colorCode, info2.materials, true);
          parentConditionalSegments.push(os);
        }
        for (let i2 = 0, l2 = faces.length; i2 < l2; i2++) {
          const tri = faces[i2];
          const vertices = tri.vertices;
          for (let i3 = 0, l3 = vertices.length; i3 < l3; i3++) {
            vertices[i3].applyMatrix4(matrix);
          }
          tri.colorCode = tri.colorCode === MAIN_COLOUR_CODE ? colorCode : tri.colorCode;
          tri.material = tri.material || getMaterialFromCode(tri.colorCode, colorCode, info2.materials, false);
          faceMaterials.add(tri.colorCode);
          if (matrixScaleInverted !== inverted) {
            vertices.reverse();
          }
          parentFaces.push(tri);
        }
        info2.totalFaces += subobjectInfo.totalFaces;
      }
      if (subobject) {
        loader.applyMaterialsToMesh(group2, subobject.colorCode, info2.materials);
      }
      return info2;
    };
    for (let i = 0, l = info.faces; i < l; i++) {
      faceMaterials.add(info.faces[i].colorCode);
    }
    await processInfoSubobjects(info);
    if (loader.smoothNormals) {
      const checkSubSegments = faceMaterials.size > 1;
      generateFaceNormals(info.faces);
      smoothNormals(info.faces, info.lineSegments, checkSubSegments);
    }
    const group = info.group;
    if (info.faces.length > 0) {
      group.add(createObject(info.faces, 3, false, info.totalFaces));
    }
    if (info.lineSegments.length > 0) {
      group.add(createObject(info.lineSegments, 2));
    }
    if (info.conditionalSegments.length > 0) {
      group.add(createObject(info.conditionalSegments, 2, true));
    }
    return group;
  }
  hasCachedModel(fileName) {
    return fileName !== null && fileName.toLowerCase() in this._cache;
  }
  async getCachedModel(fileName) {
    if (fileName !== null && this.hasCachedModel(fileName)) {
      const key = fileName.toLowerCase();
      const group = await this._cache[key];
      return group.clone();
    } else {
      return null;
    }
  }
  // Loads and parses the model with the given file name. Returns a cached copy if available.
  async loadModel(fileName) {
    const parseCache = this.parseCache;
    const key = fileName.toLowerCase();
    if (this.hasCachedModel(fileName)) {
      return this.getCachedModel(fileName);
    } else {
      await parseCache.ensureDataLoaded(fileName);
      const info = parseCache.getData(fileName);
      const promise = this.processIntoMesh(info);
      if (this.hasCachedModel(fileName)) {
        return this.getCachedModel(fileName);
      }
      if (isPartType(info.type)) {
        this._cache[key] = promise;
      }
      const group = await promise;
      return group.clone();
    }
  }
  // parses the given model text into a renderable object. Returns cached copy if available.
  async parseModel(text) {
    const parseCache = this.parseCache;
    const info = parseCache.parse(text);
    if (isPartType(info.type) && this.hasCachedModel(info.fileName)) {
      return this.getCachedModel(info.fileName);
    }
    return this.processIntoMesh(info);
  }
}
function sortByMaterial(a, b) {
  if (a.colorCode === b.colorCode) {
    return 0;
  }
  if (a.colorCode < b.colorCode) {
    return -1;
  }
  return 1;
}
function createObject(elements, elementSize, isConditionalSegments = false, totalElements = null) {
  elements.sort(sortByMaterial);
  if (totalElements === null) {
    totalElements = elements.length;
  }
  const positions = new Float32Array(elementSize * totalElements * 3);
  const normals = elementSize === 3 ? new Float32Array(elementSize * totalElements * 3) : null;
  const materials = [];
  const quadArray = new Array(6);
  const bufferGeometry = new THREE.BufferGeometry();
  let prevMaterial = null;
  let index0 = 0;
  let numGroupVerts = 0;
  let offset = 0;
  for (let iElem = 0, nElem = elements.length; iElem < nElem; iElem++) {
    const elem = elements[iElem];
    let vertices = elem.vertices;
    if (vertices.length === 4) {
      quadArray[0] = vertices[0];
      quadArray[1] = vertices[1];
      quadArray[2] = vertices[2];
      quadArray[3] = vertices[0];
      quadArray[4] = vertices[2];
      quadArray[5] = vertices[3];
      vertices = quadArray;
    }
    for (let j = 0, l = vertices.length; j < l; j++) {
      const v = vertices[j];
      const index = offset + j * 3;
      positions[index + 0] = v.x;
      positions[index + 1] = v.y;
      positions[index + 2] = v.z;
    }
    if (elementSize === 3) {
      if (!elem.faceNormal) {
        const v0 = vertices[0];
        const v1 = vertices[1];
        const v2 = vertices[2];
        _tempVec0.subVectors(v1, v0);
        _tempVec1.subVectors(v2, v1);
        elem.faceNormal = new THREE.Vector3().crossVectors(_tempVec0, _tempVec1).normalize();
      }
      let elemNormals = elem.normals;
      if (elemNormals.length === 4) {
        quadArray[0] = elemNormals[0];
        quadArray[1] = elemNormals[1];
        quadArray[2] = elemNormals[2];
        quadArray[3] = elemNormals[0];
        quadArray[4] = elemNormals[2];
        quadArray[5] = elemNormals[3];
        elemNormals = quadArray;
      }
      for (let j = 0, l = elemNormals.length; j < l; j++) {
        let n = elem.faceNormal;
        if (elemNormals[j]) {
          n = elemNormals[j].norm;
        }
        const index = offset + j * 3;
        normals[index + 0] = n.x;
        normals[index + 1] = n.y;
        normals[index + 2] = n.z;
      }
    }
    if (prevMaterial !== elem.colorCode) {
      if (prevMaterial !== null) {
        bufferGeometry.addGroup(index0, numGroupVerts, materials.length - 1);
      }
      const material = elem.material;
      if (material !== null) {
        if (elementSize === 3) {
          materials.push(material);
        } else if (elementSize === 2) {
          if (material !== null) {
            if (isConditionalSegments) {
              materials.push(material.userData.edgeMaterial.userData.conditionalEdgeMaterial);
            } else {
              materials.push(material.userData.edgeMaterial);
            }
          } else {
            materials.push(null);
          }
        }
      } else {
        materials.push(elem.colorCode);
      }
      prevMaterial = elem.colorCode;
      index0 = offset / 3;
      numGroupVerts = vertices.length;
    } else {
      numGroupVerts += vertices.length;
    }
    offset += 3 * vertices.length;
  }
  if (numGroupVerts > 0) {
    bufferGeometry.addGroup(index0, Infinity, materials.length - 1);
  }
  bufferGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (normals !== null) {
    bufferGeometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  }
  let object3d = null;
  if (elementSize === 2) {
    if (isConditionalSegments) {
      object3d = new ConditionalLineSegments(bufferGeometry, materials.length === 1 ? materials[0] : materials);
    } else {
      object3d = new THREE.LineSegments(bufferGeometry, materials.length === 1 ? materials[0] : materials);
    }
  } else if (elementSize === 3) {
    object3d = new THREE.Mesh(bufferGeometry, materials.length === 1 ? materials[0] : materials);
  }
  if (isConditionalSegments) {
    object3d.isConditionalLine = true;
    const controlArray0 = new Float32Array(elements.length * 3 * 2);
    const controlArray1 = new Float32Array(elements.length * 3 * 2);
    const directionArray = new Float32Array(elements.length * 3 * 2);
    for (let i = 0, l = elements.length; i < l; i++) {
      const os = elements[i];
      const vertices = os.vertices;
      const controlPoints = os.controlPoints;
      const c0 = controlPoints[0];
      const c1 = controlPoints[1];
      const v0 = vertices[0];
      const v1 = vertices[1];
      const index = i * 3 * 2;
      controlArray0[index + 0] = c0.x;
      controlArray0[index + 1] = c0.y;
      controlArray0[index + 2] = c0.z;
      controlArray0[index + 3] = c0.x;
      controlArray0[index + 4] = c0.y;
      controlArray0[index + 5] = c0.z;
      controlArray1[index + 0] = c1.x;
      controlArray1[index + 1] = c1.y;
      controlArray1[index + 2] = c1.z;
      controlArray1[index + 3] = c1.x;
      controlArray1[index + 4] = c1.y;
      controlArray1[index + 5] = c1.z;
      directionArray[index + 0] = v1.x - v0.x;
      directionArray[index + 1] = v1.y - v0.y;
      directionArray[index + 2] = v1.z - v0.z;
      directionArray[index + 3] = v1.x - v0.x;
      directionArray[index + 4] = v1.y - v0.y;
      directionArray[index + 5] = v1.z - v0.z;
    }
    bufferGeometry.setAttribute("control0", new THREE.BufferAttribute(controlArray0, 3, false));
    bufferGeometry.setAttribute("control1", new THREE.BufferAttribute(controlArray1, 3, false));
    bufferGeometry.setAttribute("direction", new THREE.BufferAttribute(directionArray, 3, false));
  }
  return object3d;
}
class LDrawLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
    this.materials = [];
    this.materialLibrary = {};
    this.partsCache = new LDrawPartsGeometryCache(this);
    this.fileMap = {};
    this.setMaterials([]);
    this.smoothNormals = true;
    this.partsLibraryPath = "";
  }
  setPartsLibraryPath(path) {
    this.partsLibraryPath = path;
    return this;
  }
  async preloadMaterials(url) {
    const fileLoader = new THREE.FileLoader(this.manager);
    fileLoader.setPath(this.path);
    fileLoader.setRequestHeader(this.requestHeader);
    fileLoader.setWithCredentials(this.withCredentials);
    const text = await fileLoader.loadAsync(url);
    const colorLineRegex = /^0 !COLOUR/;
    const lines = text.split(/[\n\r]/g);
    const materials = [];
    for (let i = 0, l = lines.length; i < l; i++) {
      const line = lines[i];
      if (colorLineRegex.test(line)) {
        const directive = line.replace(colorLineRegex, "");
        const material = this.parseColorMetaDirective(new LineParser(directive));
        materials.push(material);
      }
    }
    this.setMaterials(materials);
  }
  load(url, onLoad, onProgress, onError) {
    const fileLoader = new THREE.FileLoader(this.manager);
    fileLoader.setPath(this.path);
    fileLoader.setRequestHeader(this.requestHeader);
    fileLoader.setWithCredentials(this.withCredentials);
    fileLoader.load(
      url,
      (text) => {
        this.partsCache.parseModel(text, this.materialLibrary).then((group) => {
          this.applyMaterialsToMesh(group, MAIN_COLOUR_CODE, this.materialLibrary, true);
          this.computeConstructionSteps(group);
          onLoad(group);
        }).catch(onError);
      },
      onProgress,
      onError
    );
  }
  parse(text, onLoad) {
    this.partsCache.parseModel(text, this.materialLibrary).then((group) => {
      this.computeConstructionSteps(group);
      onLoad(group);
    });
  }
  setMaterials(materials) {
    this.materialLibrary = {};
    this.materials = [];
    for (let i = 0, l = materials.length; i < l; i++) {
      this.addMaterial(materials[i]);
    }
    this.addMaterial(this.parseColorMetaDirective(new LineParser("Main_Colour CODE 16 VALUE #FF8080 EDGE #333333")));
    this.addMaterial(this.parseColorMetaDirective(new LineParser("Edge_Colour CODE 24 VALUE #A0A0A0 EDGE #333333")));
    return this;
  }
  setFileMap(fileMap) {
    this.fileMap = fileMap;
    return this;
  }
  addMaterial(material) {
    const matLib = this.materialLibrary;
    if (!matLib[material.userData.code]) {
      this.materials.push(material);
      matLib[material.userData.code] = material;
    }
    return this;
  }
  getMaterial(colorCode) {
    if (colorCode.startsWith("0x2")) {
      const color = colorCode.substring(3);
      return this.parseColorMetaDirective(
        new LineParser("Direct_Color_" + color + " CODE -1 VALUE #" + color + " EDGE #" + color)
      );
    }
    return this.materialLibrary[colorCode] || null;
  }
  // Applies the appropriate materials to a prebuilt hierarchy of geometry. Assumes that color codes are present
  // in the material array if they need to be filled in.
  applyMaterialsToMesh(group, parentColorCode, materialHierarchy, finalMaterialPass = false) {
    const loader = this;
    const parentIsPassthrough = parentColorCode === MAIN_COLOUR_CODE;
    group.traverse((c) => {
      if (c.isMesh || c.isLineSegments) {
        if (Array.isArray(c.material)) {
          for (let i = 0, l = c.material.length; i < l; i++) {
            if (!c.material[i].isMaterial) {
              c.material[i] = getMaterial(c, c.material[i]);
            }
          }
        } else if (!c.material.isMaterial) {
          c.material = getMaterial(c, c.material);
        }
      }
    });
    function getMaterial(c, colorCode) {
      if (parentIsPassthrough && !(colorCode in materialHierarchy) && !finalMaterialPass) {
        return colorCode;
      }
      const forEdge = c.isLineSegments || c.isConditionalLine;
      const isPassthrough = !forEdge && colorCode === MAIN_COLOUR_CODE || forEdge && colorCode === MAIN_EDGE_COLOUR_CODE;
      if (isPassthrough) {
        colorCode = parentColorCode;
      }
      let material = null;
      if (colorCode in materialHierarchy) {
        material = materialHierarchy[colorCode];
      } else if (finalMaterialPass) {
        material = loader.getMaterial(colorCode);
        if (material === null) {
          throw new Error(`LDrawLoader: Material properties for code ${colorCode} not available.`);
        }
      } else {
        return colorCode;
      }
      if (c.isLineSegments) {
        material = material.userData.edgeMaterial;
        if (c.isConditionalLine) {
          material = material.userData.conditionalEdgeMaterial;
        }
      }
      return material;
    }
  }
  getMainMaterial() {
    return this.getMaterial(MAIN_COLOUR_CODE);
  }
  getMainEdgeMaterial() {
    return this.getMaterial(MAIN_EDGE_COLOUR_CODE);
  }
  parseColorMetaDirective(lineParser) {
    let code = null;
    let color = 16711935;
    let edgeColor = 16711935;
    let alpha = 1;
    let isTransparent = false;
    let luminance = 0;
    let finishType = FINISH_TYPE_DEFAULT;
    let edgeMaterial = null;
    const name = lineParser.getToken();
    if (!name) {
      throw new Error(
        'LDrawLoader: Material name was expected after "!COLOUR tag' + lineParser.getLineNumberString() + "."
      );
    }
    let token = null;
    while (true) {
      token = lineParser.getToken();
      if (!token) {
        break;
      }
      switch (token.toUpperCase()) {
        case "CODE":
          code = lineParser.getToken();
          break;
        case "VALUE":
          color = lineParser.getToken();
          if (color.startsWith("0x")) {
            color = "#" + color.substring(2);
          } else if (!color.startsWith("#")) {
            throw new Error(
              "LDrawLoader: Invalid color while parsing material" + lineParser.getLineNumberString() + "."
            );
          }
          break;
        case "EDGE":
          edgeColor = lineParser.getToken();
          if (edgeColor.startsWith("0x")) {
            edgeColor = "#" + edgeColor.substring(2);
          } else if (!edgeColor.startsWith("#")) {
            edgeMaterial = this.getMaterial(edgeColor);
            if (!edgeMaterial) {
              throw new Error(
                "LDrawLoader: Invalid edge color while parsing material" + lineParser.getLineNumberString() + "."
              );
            }
            edgeMaterial = edgeMaterial.userData.edgeMaterial;
          }
          break;
        case "ALPHA":
          alpha = parseInt(lineParser.getToken());
          if (isNaN(alpha)) {
            throw new Error(
              "LDrawLoader: Invalid alpha value in material definition" + lineParser.getLineNumberString() + "."
            );
          }
          alpha = Math.max(0, Math.min(1, alpha / 255));
          if (alpha < 1) {
            isTransparent = true;
          }
          break;
        case "LUMINANCE":
          luminance = parseInt(lineParser.getToken());
          if (isNaN(luminance)) {
            throw new Error(
              "LDrawLoader: Invalid luminance value in material definition" + LineParser.getLineNumberString() + "."
            );
          }
          luminance = Math.max(0, Math.min(1, luminance / 255));
          break;
        case "CHROME":
          finishType = FINISH_TYPE_CHROME;
          break;
        case "PEARLESCENT":
          finishType = FINISH_TYPE_PEARLESCENT;
          break;
        case "RUBBER":
          finishType = FINISH_TYPE_RUBBER;
          break;
        case "MATTE_METALLIC":
          finishType = FINISH_TYPE_MATTE_METALLIC;
          break;
        case "METAL":
          finishType = FINISH_TYPE_METAL;
          break;
        case "MATERIAL":
          lineParser.setToEnd();
          break;
        default:
          throw new Error(
            'LDrawLoader: Unknown token "' + token + '" while parsing material' + lineParser.getLineNumberString() + "."
          );
      }
    }
    let material = null;
    switch (finishType) {
      case FINISH_TYPE_DEFAULT:
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0 });
        break;
      case FINISH_TYPE_PEARLESCENT:
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.25 });
        break;
      case FINISH_TYPE_CHROME:
        material = new THREE.MeshStandardMaterial({ color, roughness: 0, metalness: 1 });
        break;
      case FINISH_TYPE_RUBBER:
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
        break;
      case FINISH_TYPE_MATTE_METALLIC:
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.4 });
        break;
      case FINISH_TYPE_METAL:
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.85 });
        break;
    }
    material.transparent = isTransparent;
    material.premultipliedAlpha = true;
    material.opacity = alpha;
    material.depthWrite = !isTransparent;
    material.polygonOffset = true;
    material.polygonOffsetFactor = 1;
    if (luminance !== 0) {
      material.emissive.set(material.color).multiplyScalar(luminance);
    }
    if (!edgeMaterial) {
      edgeMaterial = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: isTransparent,
        opacity: alpha,
        depthWrite: !isTransparent
      });
      edgeMaterial.userData.code = code;
      edgeMaterial.name = name + " - Edge";
      edgeMaterial.userData.conditionalEdgeMaterial = new LDrawConditionalLineMaterial({
        fog: true,
        transparent: isTransparent,
        depthWrite: !isTransparent,
        color: edgeColor,
        opacity: alpha
      });
    }
    material.userData.code = code;
    material.name = name;
    material.userData.edgeMaterial = edgeMaterial;
    this.addMaterial(material);
    return material;
  }
  computeConstructionSteps(model) {
    let stepNumber = 0;
    model.traverse((c) => {
      if (c.isGroup) {
        if (c.userData.startingConstructionStep) {
          stepNumber++;
        }
        c.userData.constructionStep = stepNumber;
      }
    });
    model.userData.numConstructionSteps = stepNumber + 1;
  }
}
exports.LDrawLoader = LDrawLoader;
//# sourceMappingURL=LDrawLoader.cjs.map
