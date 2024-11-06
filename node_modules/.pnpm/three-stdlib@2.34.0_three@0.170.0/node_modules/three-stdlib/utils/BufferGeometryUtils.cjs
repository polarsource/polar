"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const helpers = require("../types/helpers.cjs");
const mergeBufferGeometries = (geometries, useGroups) => {
  const isIndexed = geometries[0].index !== null;
  const attributesUsed = new Set(Object.keys(geometries[0].attributes));
  const morphAttributesUsed = new Set(Object.keys(geometries[0].morphAttributes));
  const attributes = {};
  const morphAttributes = {};
  const morphTargetsRelative = geometries[0].morphTargetsRelative;
  const mergedGeometry = new THREE.BufferGeometry();
  let offset = 0;
  geometries.forEach((geom, i) => {
    let attributesCount = 0;
    if (isIndexed !== (geom.index !== null)) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + i + ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."
      );
      return null;
    }
    for (let name in geom.attributes) {
      if (!attributesUsed.has(name)) {
        console.error(
          "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + i + '. All geometries must have compatible attributes; make sure "' + name + '" attribute exists among all geometries, or in none of them.'
        );
        return null;
      }
      if (attributes[name] === void 0) {
        attributes[name] = [];
      }
      attributes[name].push(geom.attributes[name]);
      attributesCount++;
    }
    if (attributesCount !== attributesUsed.size) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + i + ". Make sure all geometries have the same number of attributes."
      );
      return null;
    }
    if (morphTargetsRelative !== geom.morphTargetsRelative) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + i + ". .morphTargetsRelative must be consistent throughout all geometries."
      );
      return null;
    }
    for (let name in geom.morphAttributes) {
      if (!morphAttributesUsed.has(name)) {
        console.error(
          "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + i + ".  .morphAttributes must be consistent throughout all geometries."
        );
        return null;
      }
      if (morphAttributes[name] === void 0)
        morphAttributes[name] = [];
      morphAttributes[name].push(geom.morphAttributes[name]);
    }
    mergedGeometry.userData.mergedUserData = mergedGeometry.userData.mergedUserData || [];
    mergedGeometry.userData.mergedUserData.push(geom.userData);
    if (useGroups) {
      let count;
      if (geom.index) {
        count = geom.index.count;
      } else if (geom.attributes.position !== void 0) {
        count = geom.attributes.position.count;
      } else {
        console.error(
          "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " + i + ". The geometry must have either an index or a position attribute"
        );
        return null;
      }
      mergedGeometry.addGroup(offset, count, i);
      offset += count;
    }
  });
  if (isIndexed) {
    let indexOffset = 0;
    const mergedIndex = [];
    geometries.forEach((geom) => {
      const index = geom.index;
      for (let j = 0; j < index.count; ++j) {
        mergedIndex.push(index.getX(j) + indexOffset);
      }
      indexOffset += geom.attributes.position.count;
    });
    mergedGeometry.setIndex(mergedIndex);
  }
  for (let name in attributes) {
    const mergedAttribute = mergeBufferAttributes(attributes[name]);
    if (!mergedAttribute) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the " + name + " attribute."
      );
      return null;
    }
    mergedGeometry.setAttribute(name, mergedAttribute);
  }
  for (let name in morphAttributes) {
    const numMorphTargets = morphAttributes[name][0].length;
    if (numMorphTargets === 0)
      break;
    mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
    mergedGeometry.morphAttributes[name] = [];
    for (let i = 0; i < numMorphTargets; ++i) {
      const morphAttributesToMerge = [];
      for (let j = 0; j < morphAttributes[name].length; ++j) {
        morphAttributesToMerge.push(morphAttributes[name][j][i]);
      }
      const mergedMorphAttribute = mergeBufferAttributes(morphAttributesToMerge);
      if (!mergedMorphAttribute) {
        console.error(
          "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the " + name + " morphAttribute."
        );
        return null;
      }
      mergedGeometry.morphAttributes[name].push(mergedMorphAttribute);
    }
  }
  return mergedGeometry;
};
const mergeBufferAttributes = (attributes) => {
  let TypedArray = void 0;
  let itemSize = void 0;
  let normalized = void 0;
  let arrayLength = 0;
  attributes.forEach((attr) => {
    if (TypedArray === void 0) {
      TypedArray = attr.array.constructor;
    }
    if (TypedArray !== attr.array.constructor) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."
      );
      return null;
    }
    if (itemSize === void 0)
      itemSize = attr.itemSize;
    if (itemSize !== attr.itemSize) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."
      );
      return null;
    }
    if (normalized === void 0)
      normalized = attr.normalized;
    if (normalized !== attr.normalized) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."
      );
      return null;
    }
    arrayLength += attr.array.length;
  });
  if (TypedArray && itemSize) {
    const array = new TypedArray(arrayLength);
    let offset = 0;
    attributes.forEach((attr) => {
      array.set(attr.array, offset);
      offset += attr.array.length;
    });
    return new THREE.BufferAttribute(array, itemSize, normalized);
  }
};
const interleaveAttributes = (attributes) => {
  let TypedArray = void 0;
  let arrayLength = 0;
  let stride = 0;
  for (let i = 0, l = attributes.length; i < l; ++i) {
    const attribute = attributes[i];
    if (TypedArray === void 0)
      TypedArray = attribute.array.constructor;
    if (TypedArray !== attribute.array.constructor) {
      console.error("AttributeBuffers of different types cannot be interleaved");
      return null;
    }
    arrayLength += attribute.array.length;
    stride += attribute.itemSize;
  }
  const interleavedBuffer = new THREE.InterleavedBuffer(new TypedArray(arrayLength), stride);
  let offset = 0;
  const res = [];
  const getters = ["getX", "getY", "getZ", "getW"];
  const setters = ["setX", "setY", "setZ", "setW"];
  for (let j = 0, l = attributes.length; j < l; j++) {
    const attribute = attributes[j];
    const itemSize = attribute.itemSize;
    const count = attribute.count;
    const iba = new THREE.InterleavedBufferAttribute(interleavedBuffer, itemSize, offset, attribute.normalized);
    res.push(iba);
    offset += itemSize;
    for (let c = 0; c < count; c++) {
      for (let k = 0; k < itemSize; k++) {
        const set = helpers.getWithKey(iba, setters[k]);
        const get = helpers.getWithKey(attribute, getters[k]);
        set(c, get(c));
      }
    }
  }
  return res;
};
function estimateBytesUsed(geometry) {
  let mem = 0;
  for (let name in geometry.attributes) {
    const attr = geometry.getAttribute(name);
    mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;
  }
  const indices = geometry.getIndex();
  mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
  return mem;
}
function mergeVertices(geometry, tolerance = 1e-4) {
  tolerance = Math.max(tolerance, Number.EPSILON);
  const hashToIndex = {};
  const indices = geometry.getIndex();
  const positions = geometry.getAttribute("position");
  const vertexCount = indices ? indices.count : positions.count;
  let nextIndex = 0;
  const attributeNames = Object.keys(geometry.attributes);
  const attrArrays = {};
  const morphAttrsArrays = {};
  const newIndices = [];
  const getters = ["getX", "getY", "getZ", "getW"];
  for (let i = 0, l = attributeNames.length; i < l; i++) {
    const name = attributeNames[i];
    attrArrays[name] = [];
    const morphAttr = geometry.morphAttributes[name];
    if (morphAttr) {
      morphAttrsArrays[name] = new Array(morphAttr.length).fill(0).map(() => []);
    }
  }
  const decimalShift = Math.log10(1 / tolerance);
  const shiftMultiplier = Math.pow(10, decimalShift);
  for (let i = 0; i < vertexCount; i++) {
    const index = indices ? indices.getX(i) : i;
    let hash = "";
    for (let j = 0, l = attributeNames.length; j < l; j++) {
      const name = attributeNames[j];
      const attribute = geometry.getAttribute(name);
      const itemSize = attribute.itemSize;
      for (let k = 0; k < itemSize; k++) {
        hash += `${~~(attribute[getters[k]](index) * shiftMultiplier)},`;
      }
    }
    if (hash in hashToIndex) {
      newIndices.push(hashToIndex[hash]);
    } else {
      for (let j = 0, l = attributeNames.length; j < l; j++) {
        const name = attributeNames[j];
        const attribute = geometry.getAttribute(name);
        const morphAttr = geometry.morphAttributes[name];
        const itemSize = attribute.itemSize;
        const newarray = attrArrays[name];
        const newMorphArrays = morphAttrsArrays[name];
        for (let k = 0; k < itemSize; k++) {
          const getterFunc = getters[k];
          newarray.push(attribute[getterFunc](index));
          if (morphAttr) {
            for (let m = 0, ml = morphAttr.length; m < ml; m++) {
              newMorphArrays[m].push(morphAttr[m][getterFunc](index));
            }
          }
        }
      }
      hashToIndex[hash] = nextIndex;
      newIndices.push(nextIndex);
      nextIndex++;
    }
  }
  const result = geometry.clone();
  for (let i = 0, l = attributeNames.length; i < l; i++) {
    const name = attributeNames[i];
    const oldAttribute = geometry.getAttribute(name);
    const buffer = new oldAttribute.array.constructor(attrArrays[name]);
    const attribute = new THREE.BufferAttribute(buffer, oldAttribute.itemSize, oldAttribute.normalized);
    result.setAttribute(name, attribute);
    if (name in morphAttrsArrays) {
      for (let j = 0; j < morphAttrsArrays[name].length; j++) {
        const oldMorphAttribute = geometry.morphAttributes[name][j];
        const buffer2 = new oldMorphAttribute.array.constructor(morphAttrsArrays[name][j]);
        const morphAttribute = new THREE.BufferAttribute(buffer2, oldMorphAttribute.itemSize, oldMorphAttribute.normalized);
        result.morphAttributes[name][j] = morphAttribute;
      }
    }
  }
  result.setIndex(newIndices);
  return result;
}
function toTrianglesDrawMode(geometry, drawMode) {
  if (drawMode === THREE.TrianglesDrawMode) {
    console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.");
    return geometry;
  }
  if (drawMode === THREE.TriangleFanDrawMode || drawMode === THREE.TriangleStripDrawMode) {
    let index = geometry.getIndex();
    if (index === null) {
      const indices = [];
      const position = geometry.getAttribute("position");
      if (position !== void 0) {
        for (let i = 0; i < position.count; i++) {
          indices.push(i);
        }
        geometry.setIndex(indices);
        index = geometry.getIndex();
      } else {
        console.error(
          "THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."
        );
        return geometry;
      }
    }
    const numberOfTriangles = index.count - 2;
    const newIndices = [];
    if (index) {
      if (drawMode === THREE.TriangleFanDrawMode) {
        for (let i = 1; i <= numberOfTriangles; i++) {
          newIndices.push(index.getX(0));
          newIndices.push(index.getX(i));
          newIndices.push(index.getX(i + 1));
        }
      } else {
        for (let i = 0; i < numberOfTriangles; i++) {
          if (i % 2 === 0) {
            newIndices.push(index.getX(i));
            newIndices.push(index.getX(i + 1));
            newIndices.push(index.getX(i + 2));
          } else {
            newIndices.push(index.getX(i + 2));
            newIndices.push(index.getX(i + 1));
            newIndices.push(index.getX(i));
          }
        }
      }
    }
    if (newIndices.length / 3 !== numberOfTriangles) {
      console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");
    }
    const newGeometry = geometry.clone();
    newGeometry.setIndex(newIndices);
    newGeometry.clearGroups();
    return newGeometry;
  } else {
    console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:", drawMode);
    return geometry;
  }
}
function computeMorphedAttributes(object) {
  if (object.geometry.isBufferGeometry !== true) {
    console.error("THREE.BufferGeometryUtils: Geometry is not of type BufferGeometry.");
    return null;
  }
  const _vA = new THREE.Vector3();
  const _vB = new THREE.Vector3();
  const _vC = new THREE.Vector3();
  const _tempA = new THREE.Vector3();
  const _tempB = new THREE.Vector3();
  const _tempC = new THREE.Vector3();
  const _morphA = new THREE.Vector3();
  const _morphB = new THREE.Vector3();
  const _morphC = new THREE.Vector3();
  function _calculateMorphedAttributeData(object2, material2, attribute, morphAttribute, morphTargetsRelative2, a2, b2, c2, modifiedAttributeArray) {
    _vA.fromBufferAttribute(attribute, a2);
    _vB.fromBufferAttribute(attribute, b2);
    _vC.fromBufferAttribute(attribute, c2);
    const morphInfluences = object2.morphTargetInfluences;
    if (
      // @ts-ignore
      material2.morphTargets && morphAttribute && morphInfluences
    ) {
      _morphA.set(0, 0, 0);
      _morphB.set(0, 0, 0);
      _morphC.set(0, 0, 0);
      for (let i2 = 0, il2 = morphAttribute.length; i2 < il2; i2++) {
        const influence = morphInfluences[i2];
        const morph = morphAttribute[i2];
        if (influence === 0)
          continue;
        _tempA.fromBufferAttribute(morph, a2);
        _tempB.fromBufferAttribute(morph, b2);
        _tempC.fromBufferAttribute(morph, c2);
        if (morphTargetsRelative2) {
          _morphA.addScaledVector(_tempA, influence);
          _morphB.addScaledVector(_tempB, influence);
          _morphC.addScaledVector(_tempC, influence);
        } else {
          _morphA.addScaledVector(_tempA.sub(_vA), influence);
          _morphB.addScaledVector(_tempB.sub(_vB), influence);
          _morphC.addScaledVector(_tempC.sub(_vC), influence);
        }
      }
      _vA.add(_morphA);
      _vB.add(_morphB);
      _vC.add(_morphC);
    }
    if (object2.isSkinnedMesh) {
      object2.boneTransform(a2, _vA);
      object2.boneTransform(b2, _vB);
      object2.boneTransform(c2, _vC);
    }
    modifiedAttributeArray[a2 * 3 + 0] = _vA.x;
    modifiedAttributeArray[a2 * 3 + 1] = _vA.y;
    modifiedAttributeArray[a2 * 3 + 2] = _vA.z;
    modifiedAttributeArray[b2 * 3 + 0] = _vB.x;
    modifiedAttributeArray[b2 * 3 + 1] = _vB.y;
    modifiedAttributeArray[b2 * 3 + 2] = _vB.z;
    modifiedAttributeArray[c2 * 3 + 0] = _vC.x;
    modifiedAttributeArray[c2 * 3 + 1] = _vC.y;
    modifiedAttributeArray[c2 * 3 + 2] = _vC.z;
  }
  const geometry = object.geometry;
  const material = object.material;
  let a, b, c;
  const index = geometry.index;
  const positionAttribute = geometry.attributes.position;
  const morphPosition = geometry.morphAttributes.position;
  const morphTargetsRelative = geometry.morphTargetsRelative;
  const normalAttribute = geometry.attributes.normal;
  const morphNormal = geometry.morphAttributes.position;
  const groups = geometry.groups;
  const drawRange = geometry.drawRange;
  let i, j, il, jl;
  let group, groupMaterial;
  let start, end;
  const modifiedPosition = new Float32Array(positionAttribute.count * positionAttribute.itemSize);
  const modifiedNormal = new Float32Array(normalAttribute.count * normalAttribute.itemSize);
  if (index !== null) {
    if (Array.isArray(material)) {
      for (i = 0, il = groups.length; i < il; i++) {
        group = groups[i];
        groupMaterial = material[group.materialIndex];
        start = Math.max(group.start, drawRange.start);
        end = Math.min(group.start + group.count, drawRange.start + drawRange.count);
        for (j = start, jl = end; j < jl; j += 3) {
          a = index.getX(j);
          b = index.getX(j + 1);
          c = index.getX(j + 2);
          _calculateMorphedAttributeData(
            object,
            groupMaterial,
            positionAttribute,
            morphPosition,
            morphTargetsRelative,
            a,
            b,
            c,
            modifiedPosition
          );
          _calculateMorphedAttributeData(
            object,
            groupMaterial,
            normalAttribute,
            morphNormal,
            morphTargetsRelative,
            a,
            b,
            c,
            modifiedNormal
          );
        }
      }
    } else {
      start = Math.max(0, drawRange.start);
      end = Math.min(index.count, drawRange.start + drawRange.count);
      for (i = start, il = end; i < il; i += 3) {
        a = index.getX(i);
        b = index.getX(i + 1);
        c = index.getX(i + 2);
        _calculateMorphedAttributeData(
          object,
          material,
          positionAttribute,
          morphPosition,
          morphTargetsRelative,
          a,
          b,
          c,
          modifiedPosition
        );
        _calculateMorphedAttributeData(
          object,
          material,
          normalAttribute,
          morphNormal,
          morphTargetsRelative,
          a,
          b,
          c,
          modifiedNormal
        );
      }
    }
  } else if (positionAttribute !== void 0) {
    if (Array.isArray(material)) {
      for (i = 0, il = groups.length; i < il; i++) {
        group = groups[i];
        groupMaterial = material[group.materialIndex];
        start = Math.max(group.start, drawRange.start);
        end = Math.min(group.start + group.count, drawRange.start + drawRange.count);
        for (j = start, jl = end; j < jl; j += 3) {
          a = j;
          b = j + 1;
          c = j + 2;
          _calculateMorphedAttributeData(
            object,
            groupMaterial,
            positionAttribute,
            morphPosition,
            morphTargetsRelative,
            a,
            b,
            c,
            modifiedPosition
          );
          _calculateMorphedAttributeData(
            object,
            groupMaterial,
            normalAttribute,
            morphNormal,
            morphTargetsRelative,
            a,
            b,
            c,
            modifiedNormal
          );
        }
      }
    } else {
      start = Math.max(0, drawRange.start);
      end = Math.min(positionAttribute.count, drawRange.start + drawRange.count);
      for (i = start, il = end; i < il; i += 3) {
        a = i;
        b = i + 1;
        c = i + 2;
        _calculateMorphedAttributeData(
          object,
          material,
          positionAttribute,
          morphPosition,
          morphTargetsRelative,
          a,
          b,
          c,
          modifiedPosition
        );
        _calculateMorphedAttributeData(
          object,
          material,
          normalAttribute,
          morphNormal,
          morphTargetsRelative,
          a,
          b,
          c,
          modifiedNormal
        );
      }
    }
  }
  const morphedPositionAttribute = new THREE.Float32BufferAttribute(modifiedPosition, 3);
  const morphedNormalAttribute = new THREE.Float32BufferAttribute(modifiedNormal, 3);
  return {
    positionAttribute,
    normalAttribute,
    morphedPositionAttribute,
    morphedNormalAttribute
  };
}
function toCreasedNormals(geometry, creaseAngle = Math.PI / 3) {
  const creaseDot = Math.cos(creaseAngle);
  const hashMultiplier = (1 + 1e-10) * 100;
  const verts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const tempVec1 = new THREE.Vector3();
  const tempVec2 = new THREE.Vector3();
  const tempNorm = new THREE.Vector3();
  const tempNorm2 = new THREE.Vector3();
  function hashVertex(v) {
    const x = ~~(v.x * hashMultiplier);
    const y = ~~(v.y * hashMultiplier);
    const z = ~~(v.z * hashMultiplier);
    return `${x},${y},${z}`;
  }
  const resultGeometry = geometry.index ? geometry.toNonIndexed() : geometry;
  const posAttr = resultGeometry.attributes.position;
  const vertexMap = {};
  for (let i = 0, l = posAttr.count / 3; i < l; i++) {
    const i3 = 3 * i;
    const a = verts[0].fromBufferAttribute(posAttr, i3 + 0);
    const b = verts[1].fromBufferAttribute(posAttr, i3 + 1);
    const c = verts[2].fromBufferAttribute(posAttr, i3 + 2);
    tempVec1.subVectors(c, b);
    tempVec2.subVectors(a, b);
    const normal = new THREE.Vector3().crossVectors(tempVec1, tempVec2).normalize();
    for (let n = 0; n < 3; n++) {
      const vert = verts[n];
      const hash = hashVertex(vert);
      if (!(hash in vertexMap)) {
        vertexMap[hash] = [];
      }
      vertexMap[hash].push(normal);
    }
  }
  const normalArray = new Float32Array(posAttr.count * 3);
  const normAttr = new THREE.BufferAttribute(normalArray, 3, false);
  for (let i = 0, l = posAttr.count / 3; i < l; i++) {
    const i3 = 3 * i;
    const a = verts[0].fromBufferAttribute(posAttr, i3 + 0);
    const b = verts[1].fromBufferAttribute(posAttr, i3 + 1);
    const c = verts[2].fromBufferAttribute(posAttr, i3 + 2);
    tempVec1.subVectors(c, b);
    tempVec2.subVectors(a, b);
    tempNorm.crossVectors(tempVec1, tempVec2).normalize();
    for (let n = 0; n < 3; n++) {
      const vert = verts[n];
      const hash = hashVertex(vert);
      const otherNormals = vertexMap[hash];
      tempNorm2.set(0, 0, 0);
      for (let k = 0, lk = otherNormals.length; k < lk; k++) {
        const otherNorm = otherNormals[k];
        if (tempNorm.dot(otherNorm) > creaseDot) {
          tempNorm2.add(otherNorm);
        }
      }
      tempNorm2.normalize();
      normAttr.setXYZ(i3 + n, tempNorm2.x, tempNorm2.y, tempNorm2.z);
    }
  }
  resultGeometry.setAttribute("normal", normAttr);
  return resultGeometry;
}
exports.computeMorphedAttributes = computeMorphedAttributes;
exports.estimateBytesUsed = estimateBytesUsed;
exports.interleaveAttributes = interleaveAttributes;
exports.mergeBufferAttributes = mergeBufferAttributes;
exports.mergeBufferGeometries = mergeBufferGeometries;
exports.mergeVertices = mergeVertices;
exports.toCreasedNormals = toCreasedNormals;
exports.toTrianglesDrawMode = toTrianglesDrawMode;
//# sourceMappingURL=BufferGeometryUtils.cjs.map
