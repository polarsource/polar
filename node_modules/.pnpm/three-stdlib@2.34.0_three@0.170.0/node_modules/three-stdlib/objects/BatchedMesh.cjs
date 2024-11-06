"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const ID_ATTR_NAME = "_batch_id_";
const _identityMatrix = new THREE.Matrix4();
const _zeroScaleMatrix = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);
const batchingParsVertex = (
  /* glsl */
  `
#ifdef BATCHING
	attribute float ${ID_ATTR_NAME};
	uniform highp sampler2D batchingTexture;
	mat4 getBatchingMatrix( const in float i ) {

		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );

	}
#endif
`
);
const batchingbaseVertex = (
  /* glsl */
  `
#ifdef BATCHING
	mat4 batchingMatrix = getBatchingMatrix( ${ID_ATTR_NAME} );
#endif
`
);
const batchingnormalVertex = (
  /* glsl */
  `
#ifdef BATCHING
	objectNormal = vec4( batchingMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( batchingMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif
`
);
const batchingVertex = (
  /* glsl */
  `
#ifdef BATCHING
	transformed = ( batchingMatrix * vec4( transformed, 1.0 ) ).xyz;
#endif
`
);
function copyAttributeData(src, target, targetOffset = 0) {
  const itemSize = target.itemSize;
  if (src.isInterleavedBufferAttribute || src.array.constructor !== target.array.constructor) {
    const vertexCount = src.count;
    for (let i = 0; i < vertexCount; i++) {
      for (let c = 0; c < itemSize; c++) {
        target.setComponent(i + targetOffset, c, src.getComponent(i, c));
      }
    }
  } else {
    target.array.set(src.array, targetOffset * itemSize);
  }
  target.needsUpdate = true;
}
class BatchedMesh extends THREE.Mesh {
  constructor(maxGeometryCount, maxVertexCount, maxIndexCount = maxVertexCount * 2, material) {
    super(new THREE.BufferGeometry(), material);
    __publicField(this, "_vertexStarts");
    __publicField(this, "_vertexCounts");
    __publicField(this, "_indexStarts");
    __publicField(this, "_indexCounts");
    __publicField(this, "_reservedRanges");
    __publicField(this, "_visible");
    __publicField(this, "_active");
    __publicField(this, "_maxGeometryCount");
    __publicField(this, "_maxVertexCount");
    __publicField(this, "_maxIndexCount");
    __publicField(this, "_geometryInitialized");
    __publicField(this, "_geometryCount");
    __publicField(this, "_matrices");
    __publicField(this, "_matricesTexture");
    __publicField(this, "_customUniforms");
    this._vertexStarts = [];
    this._vertexCounts = [];
    this._indexStarts = [];
    this._indexCounts = [];
    this._reservedRanges = [];
    this._visible = [];
    this._active = [];
    this._maxGeometryCount = maxGeometryCount;
    this._maxVertexCount = maxVertexCount;
    this._maxIndexCount = maxIndexCount;
    this._geometryInitialized = false;
    this._geometryCount = 0;
    this._matrices = [];
    this._matricesTexture = null;
    this.frustumCulled = false;
    this._customUniforms = {
      batchingTexture: { value: null }
    };
    this._initMatricesTexture();
    this._initShader();
    this.onBeforeRender = function() {
      if (this.material.defines) {
        this.material.defines.BATCHING = true;
      }
    };
    this.onAfterRender = function() {
      if (this.material.defines) {
        this.material.defines.BATCHING = false;
      }
    };
  }
  _initMatricesTexture() {
    let size = Math.sqrt(this._maxGeometryCount * 4);
    size = THREE.MathUtils.ceilPowerOfTwo(size);
    size = Math.max(size, 4);
    const matricesArray = new Float32Array(size * size * 4);
    const matricesTexture = new THREE.DataTexture(matricesArray, size, size, THREE.RGBAFormat, THREE.FloatType);
    this._matricesTexture = matricesTexture;
    this._customUniforms.batchingTexture.value = this._matricesTexture;
  }
  _initShader() {
    const material = this.material;
    const currentOnBeforeCompile = material.onBeforeCompile;
    const customUniforms = this._customUniforms;
    material.onBeforeCompile = function onBeforeCompile(parameters, renderer) {
      parameters.vertexShader = parameters.vertexShader.replace("#include <skinning_pars_vertex>", "#include <skinning_pars_vertex>\n" + batchingParsVertex).replace("#include <uv_vertex>", "#include <uv_vertex>\n" + batchingbaseVertex).replace("#include <skinnormal_vertex>", "#include <skinnormal_vertex>\n" + batchingnormalVertex).replace("#include <skinning_vertex>", "#include <skinning_vertex>\n" + batchingVertex);
      for (const uniformName in customUniforms) {
        parameters.uniforms[uniformName] = customUniforms[uniformName];
      }
      currentOnBeforeCompile.call(this, parameters, renderer);
    };
    material.defines = material.defines || {};
    material.defines.BATCHING = false;
  }
  _initializeGeometry(reference) {
    const geometry = this.geometry;
    const maxVertexCount = this._maxVertexCount;
    const maxGeometryCount = this._maxGeometryCount;
    const maxIndexCount = this._maxIndexCount;
    if (this._geometryInitialized === false) {
      for (const attributeName in reference.attributes) {
        const srcAttribute = reference.getAttribute(attributeName);
        const { array, itemSize, normalized } = srcAttribute;
        const dstArray = new array.constructor(maxVertexCount * itemSize);
        const dstAttribute = new srcAttribute.constructor(dstArray, itemSize, normalized);
        dstAttribute.setUsage(srcAttribute.usage);
        geometry.setAttribute(attributeName, dstAttribute);
      }
      if (reference.getIndex() !== null) {
        const indexArray = maxVertexCount > 65536 ? new Uint32Array(maxIndexCount) : new Uint16Array(maxIndexCount);
        geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
      }
      const idArray = maxGeometryCount > 65536 ? new Uint32Array(maxVertexCount) : new Uint16Array(maxVertexCount);
      geometry.setAttribute(ID_ATTR_NAME, new THREE.BufferAttribute(idArray, 1));
      this._geometryInitialized = true;
    }
  }
  // Make sure the geometry is compatible with the existing combined geometry atributes
  _validateGeometry(geometry) {
    if (geometry.getAttribute(ID_ATTR_NAME)) {
      throw new Error(`BatchedMesh: Geometry cannot use attribute "${ID_ATTR_NAME}"`);
    }
    const batchGeometry = this.geometry;
    if (Boolean(geometry.getIndex()) !== Boolean(batchGeometry.getIndex())) {
      throw new Error('BatchedMesh: All geometries must consistently have "index".');
    }
    for (const attributeName in batchGeometry.attributes) {
      if (attributeName === ID_ATTR_NAME) {
        continue;
      }
      if (!geometry.hasAttribute(attributeName)) {
        throw new Error(
          `BatchedMesh: Added geometry missing "${attributeName}". All geometries must have consistent attributes.`
        );
      }
      const srcAttribute = geometry.getAttribute(attributeName);
      const dstAttribute = batchGeometry.getAttribute(attributeName);
      if (srcAttribute.itemSize !== dstAttribute.itemSize || srcAttribute.normalized !== dstAttribute.normalized) {
        throw new Error("BatchedMesh: All attributes must have a consistent itemSize and normalized value.");
      }
    }
  }
  getGeometryCount() {
    return this._geometryCount;
  }
  getVertexCount() {
    const reservedRanges = this._reservedRanges;
    if (reservedRanges.length === 0) {
      return 0;
    } else {
      const finalRange = reservedRanges[reservedRanges.length - 1];
      return finalRange.vertexStart + finalRange.vertexCount;
    }
  }
  getIndexCount() {
    const reservedRanges = this._reservedRanges;
    const geometry = this.geometry;
    if (geometry.getIndex() === null || reservedRanges.length === 0) {
      return 0;
    } else {
      const finalRange = reservedRanges[reservedRanges.length - 1];
      return finalRange.indexStart + finalRange.indexCount;
    }
  }
  addGeometry(geometry, vertexCount = -1, indexCount = -1) {
    this._initializeGeometry(geometry);
    this._validateGeometry(geometry);
    if (this._geometryCount >= this._maxGeometryCount) {
      throw new Error("BatchedMesh: Maximum geometry count reached.");
    }
    const range = {
      vertexStart: -1,
      vertexCount: -1,
      indexStart: -1,
      indexCount: -1
    };
    let lastRange = null;
    const reservedRanges = this._reservedRanges;
    if (this._geometryCount !== 0) {
      lastRange = reservedRanges[reservedRanges.length - 1];
    }
    if (vertexCount === -1) {
      range.vertexCount = geometry.getAttribute("position").count;
    } else {
      range.vertexCount = vertexCount;
    }
    if (lastRange === null) {
      range.vertexStart = 0;
    } else {
      range.vertexStart = lastRange.vertexStart + lastRange.vertexCount;
    }
    if (geometry.getIndex() !== null) {
      if (indexCount === -1) {
        range.indexCount = geometry.getIndex().count;
      } else {
        range.indexCount = indexCount;
      }
      if (lastRange === null) {
        range.indexStart = 0;
      } else {
        range.indexStart = lastRange.indexStart + lastRange.indexCount;
      }
    }
    if (range.indexStart !== -1 && range.indexStart + range.indexCount > this._maxIndexCount || range.vertexStart + range.vertexCount > this._maxVertexCount) {
      throw new Error("BatchedMesh: Reserved space request exceeds the maximum buffer size.");
    }
    const indexCounts = this._indexCounts;
    const indexStarts = this._indexStarts;
    const vertexCounts = this._vertexCounts;
    const vertexStarts = this._vertexStarts;
    const visible = this._visible;
    const active = this._active;
    const matricesTexture = this._matricesTexture;
    const matrices = this._matrices;
    const matricesArray = this._matricesTexture.image.data;
    visible.push(true);
    active.push(true);
    const geometryId = this._geometryCount;
    this._geometryCount++;
    matrices.push(new THREE.Matrix4());
    _identityMatrix.toArray(matricesArray, geometryId * 16);
    matricesTexture.needsUpdate = true;
    reservedRanges.push(range);
    vertexStarts.push(range.vertexStart);
    vertexCounts.push(range.vertexCount);
    if (geometry.getIndex() !== null) {
      indexStarts.push(range.indexCount);
      indexCounts.push(range.indexCount);
    }
    const idAttribute = this.geometry.getAttribute(ID_ATTR_NAME);
    for (let i = 0; i < range.vertexCount; i++) {
      idAttribute.setX(range.vertexStart + i, geometryId);
    }
    idAttribute.needsUpdate = true;
    this.setGeometryAt(geometryId, geometry);
    return geometryId;
  }
  /**
   * @deprecated use `addGeometry` instead.
   */
  applyGeometry(geometry) {
    return this.addGeometry(geometry);
  }
  setGeometryAt(id, geometry) {
    if (id >= this._geometryCount) {
      throw new Error("BatchedMesh: Maximum geometry count reached.");
    }
    this._validateGeometry(geometry);
    const range = this._reservedRanges[id];
    if (geometry.getIndex() !== null && geometry.getIndex().count > range.indexCount || geometry.attributes.position.count > range.vertexCount) {
      throw new Error("BatchedMesh: Reserved space not large enough for provided geometry.");
    }
    const batchGeometry = this.geometry;
    const srcPositionAttribute = geometry.getAttribute("position");
    const hasIndex = batchGeometry.getIndex() !== null;
    const dstIndex = batchGeometry.getIndex();
    const srcIndex = geometry.getIndex();
    const vertexStart = range.vertexStart;
    const vertexCount = range.vertexCount;
    for (const attributeName in batchGeometry.attributes) {
      if (attributeName === ID_ATTR_NAME) {
        continue;
      }
      const srcAttribute = geometry.getAttribute(attributeName);
      const dstAttribute = batchGeometry.getAttribute(attributeName);
      copyAttributeData(srcAttribute, dstAttribute, vertexStart);
      const itemSize = srcAttribute.itemSize;
      for (let i = srcAttribute.count, l = vertexCount; i < l; i++) {
        const index = vertexStart + i;
        for (let c = 0; c < itemSize; c++) {
          dstAttribute.setComponent(index, c, 0);
        }
      }
      dstAttribute.needsUpdate = true;
    }
    this._vertexCounts[id] = srcPositionAttribute.count;
    if (hasIndex) {
      const indexStart = range.indexStart;
      for (let i = 0; i < srcIndex.count; i++) {
        dstIndex.setX(indexStart + i, vertexStart + srcIndex.getX(i));
      }
      for (let i = srcIndex.count, l = range.indexCount; i < l; i++) {
        dstIndex.setX(indexStart + i, vertexStart);
      }
      dstIndex.needsUpdate = true;
      this._indexCounts[id] = srcIndex.count;
    }
    return id;
  }
  deleteGeometry(geometryId) {
    const active = this._active;
    const matricesTexture = this._matricesTexture;
    const matricesArray = matricesTexture.image.data;
    if (geometryId >= active.length || active[geometryId] === false) {
      return this;
    }
    active[geometryId] = false;
    _zeroScaleMatrix.toArray(matricesArray, geometryId * 16);
    matricesTexture.needsUpdate = true;
    return this;
  }
  optimize() {
    throw new Error("BatchedMesh: Optimize function not implemented.");
  }
  setMatrixAt(geometryId, matrix) {
    const visible = this._visible;
    const active = this._active;
    const matricesTexture = this._matricesTexture;
    const matrices = this._matrices;
    const matricesArray = matricesTexture.image.data;
    if (geometryId >= matrices.length || active[geometryId] === false) {
      return this;
    }
    if (visible[geometryId] === true) {
      matrix.toArray(matricesArray, geometryId * 16);
      matricesTexture.needsUpdate = true;
    }
    matrices[geometryId].copy(matrix);
    return this;
  }
  getMatrixAt(geometryId, matrix) {
    const matrices = this._matrices;
    const active = this._active;
    if (geometryId >= matrices.length || active[geometryId] === false) {
      return matrix;
    }
    return matrix.copy(matrices[geometryId]);
  }
  setVisibleAt(geometryId, value) {
    const visible = this._visible;
    const active = this._active;
    const matricesTexture = this._matricesTexture;
    const matrices = this._matrices;
    const matricesArray = matricesTexture.image.data;
    if (geometryId >= visible.length || active[geometryId] === false || visible[geometryId] === value) {
      return this;
    }
    if (value === true) {
      matrices[geometryId].toArray(matricesArray, geometryId * 16);
    } else {
      _zeroScaleMatrix.toArray(matricesArray, geometryId * 16);
    }
    matricesTexture.needsUpdate = true;
    visible[geometryId] = value;
    return this;
  }
  getVisibleAt(geometryId) {
    const visible = this._visible;
    const active = this._active;
    if (geometryId >= visible.length || active[geometryId] === false) {
      return false;
    }
    return visible[geometryId];
  }
  raycast() {
    console.warn("BatchedMesh: Raycast function not implemented.");
  }
  copy() {
    throw new Error("BatchedMesh: Copy function not implemented.");
  }
  toJSON() {
    throw new Error("BatchedMesh: toJSON function not implemented.");
  }
  dispose() {
    this.geometry.dispose();
    this._matricesTexture.dispose();
    this._matricesTexture = null;
    return this;
  }
}
exports.BatchedMesh = BatchedMesh;
//# sourceMappingURL=BatchedMesh.cjs.map
