"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const SimplexNoise = require("../math/SimplexNoise.cjs");
const _LightningStrike = class extends THREE.BufferGeometry {
  constructor(rayParameters = {}) {
    super();
    this.isLightningStrike = true;
    this.type = "LightningStrike";
    this.init(_LightningStrike.copyParameters(rayParameters, rayParameters));
    this.createMesh();
  }
  static createRandomGenerator() {
    const numSeeds = 2053;
    const seeds = [];
    for (let i = 0; i < numSeeds; i++) {
      seeds.push(Math.random());
    }
    const generator = {
      currentSeed: 0,
      random: function() {
        const value = seeds[generator.currentSeed];
        generator.currentSeed = (generator.currentSeed + 1) % numSeeds;
        return value;
      },
      getSeed: function() {
        return generator.currentSeed / numSeeds;
      },
      setSeed: function(seed) {
        generator.currentSeed = Math.floor(seed * numSeeds) % numSeeds;
      }
    };
    return generator;
  }
  static copyParameters(dest = {}, source = {}) {
    const vecCopy = function(v) {
      if (source === dest) {
        return v;
      } else {
        return v.clone();
      }
    };
    dest.sourceOffset = source.sourceOffset !== void 0 ? vecCopy(source.sourceOffset) : new THREE.Vector3(0, 100, 0), dest.destOffset = source.destOffset !== void 0 ? vecCopy(source.destOffset) : new THREE.Vector3(0, 0, 0), dest.timeScale = source.timeScale !== void 0 ? source.timeScale : 1, dest.roughness = source.roughness !== void 0 ? source.roughness : 0.9, dest.straightness = source.straightness !== void 0 ? source.straightness : 0.7, dest.up0 = source.up0 !== void 0 ? vecCopy(source.up0) : new THREE.Vector3(0, 0, 1);
    dest.up1 = source.up1 !== void 0 ? vecCopy(source.up1) : new THREE.Vector3(0, 0, 1), dest.radius0 = source.radius0 !== void 0 ? source.radius0 : 1, dest.radius1 = source.radius1 !== void 0 ? source.radius1 : 1, dest.radius0Factor = source.radius0Factor !== void 0 ? source.radius0Factor : 0.5, dest.radius1Factor = source.radius1Factor !== void 0 ? source.radius1Factor : 0.2, dest.minRadius = source.minRadius !== void 0 ? source.minRadius : 0.2, // These parameters should not be changed after lightning creation. They can be changed but the ray will change its form abruptly:
    dest.isEternal = source.isEternal !== void 0 ? source.isEternal : source.birthTime === void 0 || source.deathTime === void 0, dest.birthTime = source.birthTime, dest.deathTime = source.deathTime, dest.propagationTimeFactor = source.propagationTimeFactor !== void 0 ? source.propagationTimeFactor : 0.1, dest.vanishingTimeFactor = source.vanishingTimeFactor !== void 0 ? source.vanishingTimeFactor : 0.9, dest.subrayPeriod = source.subrayPeriod !== void 0 ? source.subrayPeriod : 4, dest.subrayDutyCycle = source.subrayDutyCycle !== void 0 ? source.subrayDutyCycle : 0.6;
    dest.maxIterations = source.maxIterations !== void 0 ? source.maxIterations : 9;
    dest.isStatic = source.isStatic !== void 0 ? source.isStatic : false;
    dest.ramification = source.ramification !== void 0 ? source.ramification : 5;
    dest.maxSubrayRecursion = source.maxSubrayRecursion !== void 0 ? source.maxSubrayRecursion : 3;
    dest.recursionProbability = source.recursionProbability !== void 0 ? source.recursionProbability : 0.6;
    dest.generateUVs = source.generateUVs !== void 0 ? source.generateUVs : false;
    dest.randomGenerator = source.randomGenerator, dest.noiseSeed = source.noiseSeed, dest.onDecideSubrayCreation = source.onDecideSubrayCreation, dest.onSubrayCreation = source.onSubrayCreation;
    return dest;
  }
  update(time) {
    if (this.isStatic)
      return;
    if (this.rayParameters.isEternal || this.rayParameters.birthTime <= time && time <= this.rayParameters.deathTime) {
      this.updateMesh(time);
      if (time < this.subrays[0].endPropagationTime) {
        this.state = _LightningStrike.RAY_PROPAGATING;
      } else if (time > this.subrays[0].beginVanishingTime) {
        this.state = _LightningStrike.RAY_VANISHING;
      } else {
        this.state = _LightningStrike.RAY_STEADY;
      }
      this.visible = true;
    } else {
      this.visible = false;
      if (time < this.rayParameters.birthTime) {
        this.state = _LightningStrike.RAY_UNBORN;
      } else {
        this.state = _LightningStrike.RAY_EXTINGUISHED;
      }
    }
  }
  init(rayParameters) {
    this.rayParameters = rayParameters;
    this.maxIterations = rayParameters.maxIterations !== void 0 ? Math.floor(rayParameters.maxIterations) : 9;
    rayParameters.maxIterations = this.maxIterations;
    this.isStatic = rayParameters.isStatic !== void 0 ? rayParameters.isStatic : false;
    rayParameters.isStatic = this.isStatic;
    this.ramification = rayParameters.ramification !== void 0 ? Math.floor(rayParameters.ramification) : 5;
    rayParameters.ramification = this.ramification;
    this.maxSubrayRecursion = rayParameters.maxSubrayRecursion !== void 0 ? Math.floor(rayParameters.maxSubrayRecursion) : 3;
    rayParameters.maxSubrayRecursion = this.maxSubrayRecursion;
    this.recursionProbability = rayParameters.recursionProbability !== void 0 ? rayParameters.recursionProbability : 0.6;
    rayParameters.recursionProbability = this.recursionProbability;
    this.generateUVs = rayParameters.generateUVs !== void 0 ? rayParameters.generateUVs : false;
    rayParameters.generateUVs = this.generateUVs;
    if (rayParameters.randomGenerator !== void 0) {
      this.randomGenerator = rayParameters.randomGenerator;
      this.seedGenerator = rayParameters.randomGenerator;
      if (rayParameters.noiseSeed !== void 0) {
        this.seedGenerator.setSeed(rayParameters.noiseSeed);
      }
    } else {
      this.randomGenerator = _LightningStrike.createRandomGenerator();
      this.seedGenerator = Math;
    }
    if (rayParameters.onDecideSubrayCreation !== void 0) {
      this.onDecideSubrayCreation = rayParameters.onDecideSubrayCreation;
    } else {
      this.createDefaultSubrayCreationCallbacks();
      if (rayParameters.onSubrayCreation !== void 0) {
        this.onSubrayCreation = rayParameters.onSubrayCreation;
      }
    }
    this.state = _LightningStrike.RAY_INITIALIZED;
    this.maxSubrays = Math.ceil(1 + Math.pow(this.ramification, Math.max(0, this.maxSubrayRecursion - 1)));
    rayParameters.maxSubrays = this.maxSubrays;
    this.maxRaySegments = 2 * (1 << this.maxIterations);
    this.subrays = [];
    for (let i = 0; i < this.maxSubrays; i++) {
      this.subrays.push(this.createSubray());
    }
    this.raySegments = [];
    for (let i = 0; i < this.maxRaySegments; i++) {
      this.raySegments.push(this.createSegment());
    }
    this.time = 0;
    this.timeFraction = 0;
    this.currentSegmentCallback = null;
    this.currentCreateTriangleVertices = this.generateUVs ? this.createTriangleVerticesWithUVs : this.createTriangleVerticesWithoutUVs;
    this.numSubrays = 0;
    this.currentSubray = null;
    this.currentSegmentIndex = 0;
    this.isInitialSegment = false;
    this.subrayProbability = 0;
    this.currentVertex = 0;
    this.currentIndex = 0;
    this.currentCoordinate = 0;
    this.currentUVCoordinate = 0;
    this.vertices = null;
    this.uvs = null;
    this.indices = null;
    this.positionAttribute = null;
    this.uvsAttribute = null;
    this.simplexX = new SimplexNoise.SimplexNoise(this.seedGenerator);
    this.simplexY = new SimplexNoise.SimplexNoise(this.seedGenerator);
    this.simplexZ = new SimplexNoise.SimplexNoise(this.seedGenerator);
    this.forwards = new THREE.Vector3();
    this.forwardsFill = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.down = new THREE.Vector3();
    this.middlePos = new THREE.Vector3();
    this.middleLinPos = new THREE.Vector3();
    this.newPos = new THREE.Vector3();
    this.vPos = new THREE.Vector3();
    this.cross1 = new THREE.Vector3();
  }
  createMesh() {
    const maxDrawableSegmentsPerSubRay = 1 << this.maxIterations;
    const maxVerts = 3 * (maxDrawableSegmentsPerSubRay + 1) * this.maxSubrays;
    const maxIndices = 18 * maxDrawableSegmentsPerSubRay * this.maxSubrays;
    this.vertices = new Float32Array(maxVerts * 3);
    this.indices = new Uint32Array(maxIndices);
    if (this.generateUVs) {
      this.uvs = new Float32Array(maxVerts * 2);
    }
    this.fillMesh(0);
    this.setIndex(new THREE.Uint32BufferAttribute(this.indices, 1));
    this.positionAttribute = new THREE.Float32BufferAttribute(this.vertices, 3);
    this.setAttribute("position", this.positionAttribute);
    if (this.generateUVs) {
      this.uvsAttribute = new THREE.Float32BufferAttribute(new Float32Array(this.uvs), 2);
      this.setAttribute("uv", this.uvsAttribute);
    }
    if (!this.isStatic) {
      this.index.usage = THREE.DynamicDrawUsage;
      this.positionAttribute.usage = THREE.DynamicDrawUsage;
      if (this.generateUVs) {
        this.uvsAttribute.usage = THREE.DynamicDrawUsage;
      }
    }
    this.vertices = this.positionAttribute.array;
    this.indices = this.index.array;
    if (this.generateUVs) {
      this.uvs = this.uvsAttribute.array;
    }
  }
  updateMesh(time) {
    this.fillMesh(time);
    this.drawRange.count = this.currentIndex;
    this.index.needsUpdate = true;
    this.positionAttribute.needsUpdate = true;
    if (this.generateUVs) {
      this.uvsAttribute.needsUpdate = true;
    }
  }
  fillMesh(time) {
    const scope = this;
    this.currentVertex = 0;
    this.currentIndex = 0;
    this.currentCoordinate = 0;
    this.currentUVCoordinate = 0;
    this.fractalRay(time, function fillVertices(segment) {
      const subray = scope.currentSubray;
      if (time < subray.birthTime) {
        return;
      } else if (this.rayParameters.isEternal && scope.currentSubray.recursion == 0) {
        scope.createPrism(segment);
        scope.onDecideSubrayCreation(segment, scope);
      } else if (time < subray.endPropagationTime) {
        if (scope.timeFraction >= segment.fraction0 * subray.propagationTimeFactor) {
          scope.createPrism(segment);
          scope.onDecideSubrayCreation(segment, scope);
        }
      } else if (time < subray.beginVanishingTime) {
        scope.createPrism(segment);
        scope.onDecideSubrayCreation(segment, scope);
      } else {
        if (scope.timeFraction <= subray.vanishingTimeFactor + segment.fraction1 * (1 - subray.vanishingTimeFactor)) {
          scope.createPrism(segment);
        }
        scope.onDecideSubrayCreation(segment, scope);
      }
    });
  }
  addNewSubray() {
    return this.subrays[this.numSubrays++];
  }
  initSubray(subray, rayParameters) {
    subray.pos0.copy(rayParameters.sourceOffset);
    subray.pos1.copy(rayParameters.destOffset);
    subray.up0.copy(rayParameters.up0);
    subray.up1.copy(rayParameters.up1);
    subray.radius0 = rayParameters.radius0;
    subray.radius1 = rayParameters.radius1;
    subray.birthTime = rayParameters.birthTime;
    subray.deathTime = rayParameters.deathTime;
    subray.timeScale = rayParameters.timeScale;
    subray.roughness = rayParameters.roughness;
    subray.straightness = rayParameters.straightness;
    subray.propagationTimeFactor = rayParameters.propagationTimeFactor;
    subray.vanishingTimeFactor = rayParameters.vanishingTimeFactor;
    subray.maxIterations = this.maxIterations;
    subray.seed = rayParameters.noiseSeed !== void 0 ? rayParameters.noiseSeed : 0;
    subray.recursion = 0;
  }
  fractalRay(time, segmentCallback) {
    this.time = time;
    this.currentSegmentCallback = segmentCallback;
    this.numSubrays = 0;
    this.initSubray(this.addNewSubray(), this.rayParameters);
    for (let subrayIndex = 0; subrayIndex < this.numSubrays; subrayIndex++) {
      const subray = this.subrays[subrayIndex];
      this.currentSubray = subray;
      this.randomGenerator.setSeed(subray.seed);
      subray.endPropagationTime = THREE.MathUtils.lerp(subray.birthTime, subray.deathTime, subray.propagationTimeFactor);
      subray.beginVanishingTime = THREE.MathUtils.lerp(subray.deathTime, subray.birthTime, 1 - subray.vanishingTimeFactor);
      const random1 = this.randomGenerator.random;
      subray.linPos0.set(random1(), random1(), random1()).multiplyScalar(1e3);
      subray.linPos1.set(random1(), random1(), random1()).multiplyScalar(1e3);
      this.timeFraction = (time - subray.birthTime) / (subray.deathTime - subray.birthTime);
      this.currentSegmentIndex = 0;
      this.isInitialSegment = true;
      const segment = this.getNewSegment();
      segment.iteration = 0;
      segment.pos0.copy(subray.pos0);
      segment.pos1.copy(subray.pos1);
      segment.linPos0.copy(subray.linPos0);
      segment.linPos1.copy(subray.linPos1);
      segment.up0.copy(subray.up0);
      segment.up1.copy(subray.up1);
      segment.radius0 = subray.radius0;
      segment.radius1 = subray.radius1;
      segment.fraction0 = 0;
      segment.fraction1 = 1;
      segment.positionVariationFactor = 1 - subray.straightness;
      this.subrayProbability = this.ramification * Math.pow(this.recursionProbability, subray.recursion) / (1 << subray.maxIterations);
      this.fractalRayRecursive(segment);
    }
    this.currentSegmentCallback = null;
    this.currentSubray = null;
  }
  fractalRayRecursive(segment) {
    if (segment.iteration >= this.currentSubray.maxIterations) {
      this.currentSegmentCallback(segment);
      return;
    }
    this.forwards.subVectors(segment.pos1, segment.pos0);
    let lForwards = this.forwards.length();
    if (lForwards < 1e-6) {
      this.forwards.set(0, 0, 0.01);
      lForwards = this.forwards.length();
    }
    const middleRadius = (segment.radius0 + segment.radius1) * 0.5;
    const middleFraction = (segment.fraction0 + segment.fraction1) * 0.5;
    const timeDimension = this.time * this.currentSubray.timeScale * Math.pow(2, segment.iteration);
    this.middlePos.lerpVectors(segment.pos0, segment.pos1, 0.5);
    this.middleLinPos.lerpVectors(segment.linPos0, segment.linPos1, 0.5);
    const p = this.middleLinPos;
    this.newPos.set(
      this.simplexX.noise4d(p.x, p.y, p.z, timeDimension),
      this.simplexY.noise4d(p.x, p.y, p.z, timeDimension),
      this.simplexZ.noise4d(p.x, p.y, p.z, timeDimension)
    );
    this.newPos.multiplyScalar(segment.positionVariationFactor * lForwards);
    this.newPos.add(this.middlePos);
    const newSegment1 = this.getNewSegment();
    newSegment1.pos0.copy(segment.pos0);
    newSegment1.pos1.copy(this.newPos);
    newSegment1.linPos0.copy(segment.linPos0);
    newSegment1.linPos1.copy(this.middleLinPos);
    newSegment1.up0.copy(segment.up0);
    newSegment1.up1.copy(segment.up1);
    newSegment1.radius0 = segment.radius0;
    newSegment1.radius1 = middleRadius;
    newSegment1.fraction0 = segment.fraction0;
    newSegment1.fraction1 = middleFraction;
    newSegment1.positionVariationFactor = segment.positionVariationFactor * this.currentSubray.roughness;
    newSegment1.iteration = segment.iteration + 1;
    const newSegment2 = this.getNewSegment();
    newSegment2.pos0.copy(this.newPos);
    newSegment2.pos1.copy(segment.pos1);
    newSegment2.linPos0.copy(this.middleLinPos);
    newSegment2.linPos1.copy(segment.linPos1);
    this.cross1.crossVectors(segment.up0, this.forwards.normalize());
    newSegment2.up0.crossVectors(this.forwards, this.cross1).normalize();
    newSegment2.up1.copy(segment.up1);
    newSegment2.radius0 = middleRadius;
    newSegment2.radius1 = segment.radius1;
    newSegment2.fraction0 = middleFraction;
    newSegment2.fraction1 = segment.fraction1;
    newSegment2.positionVariationFactor = segment.positionVariationFactor * this.currentSubray.roughness;
    newSegment2.iteration = segment.iteration + 1;
    this.fractalRayRecursive(newSegment1);
    this.fractalRayRecursive(newSegment2);
  }
  createPrism(segment) {
    this.forwardsFill.subVectors(segment.pos1, segment.pos0).normalize();
    if (this.isInitialSegment) {
      this.currentCreateTriangleVertices(segment.pos0, segment.up0, this.forwardsFill, segment.radius0, 0);
      this.isInitialSegment = false;
    }
    this.currentCreateTriangleVertices(segment.pos1, segment.up0, this.forwardsFill, segment.radius1, segment.fraction1);
    this.createPrismFaces();
  }
  createTriangleVerticesWithoutUVs(pos, up, forwards, radius) {
    this.side.crossVectors(up, forwards).multiplyScalar(radius * _LightningStrike.COS30DEG);
    this.down.copy(up).multiplyScalar(-radius * _LightningStrike.SIN30DEG);
    const p = this.vPos;
    const v = this.vertices;
    p.copy(pos).sub(this.side).add(this.down);
    v[this.currentCoordinate++] = p.x;
    v[this.currentCoordinate++] = p.y;
    v[this.currentCoordinate++] = p.z;
    p.copy(pos).add(this.side).add(this.down);
    v[this.currentCoordinate++] = p.x;
    v[this.currentCoordinate++] = p.y;
    v[this.currentCoordinate++] = p.z;
    p.copy(up).multiplyScalar(radius).add(pos);
    v[this.currentCoordinate++] = p.x;
    v[this.currentCoordinate++] = p.y;
    v[this.currentCoordinate++] = p.z;
    this.currentVertex += 3;
  }
  createTriangleVerticesWithUVs(pos, up, forwards, radius, u) {
    this.side.crossVectors(up, forwards).multiplyScalar(radius * _LightningStrike.COS30DEG);
    this.down.copy(up).multiplyScalar(-radius * _LightningStrike.SIN30DEG);
    const p = this.vPos;
    const v = this.vertices;
    const uv = this.uvs;
    p.copy(pos).sub(this.side).add(this.down);
    v[this.currentCoordinate++] = p.x;
    v[this.currentCoordinate++] = p.y;
    v[this.currentCoordinate++] = p.z;
    uv[this.currentUVCoordinate++] = u;
    uv[this.currentUVCoordinate++] = 0;
    p.copy(pos).add(this.side).add(this.down);
    v[this.currentCoordinate++] = p.x;
    v[this.currentCoordinate++] = p.y;
    v[this.currentCoordinate++] = p.z;
    uv[this.currentUVCoordinate++] = u;
    uv[this.currentUVCoordinate++] = 0.5;
    p.copy(up).multiplyScalar(radius).add(pos);
    v[this.currentCoordinate++] = p.x;
    v[this.currentCoordinate++] = p.y;
    v[this.currentCoordinate++] = p.z;
    uv[this.currentUVCoordinate++] = u;
    uv[this.currentUVCoordinate++] = 1;
    this.currentVertex += 3;
  }
  createPrismFaces(vertex) {
    const indices = this.indices;
    vertex = this.currentVertex - 6;
    indices[this.currentIndex++] = vertex + 1;
    indices[this.currentIndex++] = vertex + 2;
    indices[this.currentIndex++] = vertex + 5;
    indices[this.currentIndex++] = vertex + 1;
    indices[this.currentIndex++] = vertex + 5;
    indices[this.currentIndex++] = vertex + 4;
    indices[this.currentIndex++] = vertex + 0;
    indices[this.currentIndex++] = vertex + 1;
    indices[this.currentIndex++] = vertex + 4;
    indices[this.currentIndex++] = vertex + 0;
    indices[this.currentIndex++] = vertex + 4;
    indices[this.currentIndex++] = vertex + 3;
    indices[this.currentIndex++] = vertex + 2;
    indices[this.currentIndex++] = vertex + 0;
    indices[this.currentIndex++] = vertex + 3;
    indices[this.currentIndex++] = vertex + 2;
    indices[this.currentIndex++] = vertex + 3;
    indices[this.currentIndex++] = vertex + 5;
  }
  createDefaultSubrayCreationCallbacks() {
    const random1 = this.randomGenerator.random;
    this.onDecideSubrayCreation = function(segment, lightningStrike) {
      const subray = lightningStrike.currentSubray;
      const period = lightningStrike.rayParameters.subrayPeriod;
      const dutyCycle = lightningStrike.rayParameters.subrayDutyCycle;
      const phase0 = lightningStrike.rayParameters.isEternal && subray.recursion == 0 ? -random1() * period : THREE.MathUtils.lerp(subray.birthTime, subray.endPropagationTime, segment.fraction0) - random1() * period;
      const phase = lightningStrike.time - phase0;
      const currentCycle = Math.floor(phase / period);
      const childSubraySeed = random1() * (currentCycle + 1);
      const isActive = phase % period <= dutyCycle * period;
      let probability = 0;
      if (isActive) {
        probability = lightningStrike.subrayProbability;
      }
      if (subray.recursion < lightningStrike.maxSubrayRecursion && lightningStrike.numSubrays < lightningStrike.maxSubrays && random1() < probability) {
        const childSubray = lightningStrike.addNewSubray();
        const parentSeed = lightningStrike.randomGenerator.getSeed();
        childSubray.seed = childSubraySeed;
        lightningStrike.randomGenerator.setSeed(childSubraySeed);
        childSubray.recursion = subray.recursion + 1;
        childSubray.maxIterations = Math.max(1, subray.maxIterations - 1);
        childSubray.linPos0.set(random1(), random1(), random1()).multiplyScalar(1e3);
        childSubray.linPos1.set(random1(), random1(), random1()).multiplyScalar(1e3);
        childSubray.up0.copy(subray.up0);
        childSubray.up1.copy(subray.up1);
        childSubray.radius0 = segment.radius0 * lightningStrike.rayParameters.radius0Factor;
        childSubray.radius1 = Math.min(
          lightningStrike.rayParameters.minRadius,
          segment.radius1 * lightningStrike.rayParameters.radius1Factor
        );
        childSubray.birthTime = phase0 + currentCycle * period;
        childSubray.deathTime = childSubray.birthTime + period * dutyCycle;
        if (!lightningStrike.rayParameters.isEternal && subray.recursion == 0) {
          childSubray.birthTime = Math.max(childSubray.birthTime, subray.birthTime);
          childSubray.deathTime = Math.min(childSubray.deathTime, subray.deathTime);
        }
        childSubray.timeScale = subray.timeScale * 2;
        childSubray.roughness = subray.roughness;
        childSubray.straightness = subray.straightness;
        childSubray.propagationTimeFactor = subray.propagationTimeFactor;
        childSubray.vanishingTimeFactor = subray.vanishingTimeFactor;
        lightningStrike.onSubrayCreation(segment, subray, childSubray, lightningStrike);
        lightningStrike.randomGenerator.setSeed(parentSeed);
      }
    };
    const vec1Pos = new THREE.Vector3();
    const vec2Forward = new THREE.Vector3();
    const vec3Side = new THREE.Vector3();
    const vec4Up = new THREE.Vector3();
    this.onSubrayCreation = function(segment, parentSubray, childSubray, lightningStrike) {
      lightningStrike.subrayCylinderPosition(segment, parentSubray, childSubray, 0.5, 0.6, 0.2);
    };
    this.subrayConePosition = function(segment, parentSubray, childSubray, heightFactor, sideWidthFactor, minSideWidthFactor) {
      childSubray.pos0.copy(segment.pos0);
      vec1Pos.subVectors(parentSubray.pos1, parentSubray.pos0);
      vec2Forward.copy(vec1Pos).normalize();
      vec1Pos.multiplyScalar(segment.fraction0 + (1 - segment.fraction0) * (random1() * heightFactor));
      const length = vec1Pos.length();
      vec3Side.crossVectors(parentSubray.up0, vec2Forward);
      const angle = 2 * Math.PI * random1();
      vec3Side.multiplyScalar(Math.cos(angle));
      vec4Up.copy(parentSubray.up0).multiplyScalar(Math.sin(angle));
      childSubray.pos1.copy(vec3Side).add(vec4Up).multiplyScalar(length * sideWidthFactor * (minSideWidthFactor + random1() * (1 - minSideWidthFactor))).add(vec1Pos).add(parentSubray.pos0);
    };
    this.subrayCylinderPosition = function(segment, parentSubray, childSubray, heightFactor, sideWidthFactor, minSideWidthFactor) {
      childSubray.pos0.copy(segment.pos0);
      vec1Pos.subVectors(parentSubray.pos1, parentSubray.pos0);
      vec2Forward.copy(vec1Pos).normalize();
      vec1Pos.multiplyScalar(segment.fraction0 + (1 - segment.fraction0) * ((2 * random1() - 1) * heightFactor));
      const length = vec1Pos.length();
      vec3Side.crossVectors(parentSubray.up0, vec2Forward);
      const angle = 2 * Math.PI * random1();
      vec3Side.multiplyScalar(Math.cos(angle));
      vec4Up.copy(parentSubray.up0).multiplyScalar(Math.sin(angle));
      childSubray.pos1.copy(vec3Side).add(vec4Up).multiplyScalar(length * sideWidthFactor * (minSideWidthFactor + random1() * (1 - minSideWidthFactor))).add(vec1Pos).add(parentSubray.pos0);
    };
  }
  createSubray() {
    return {
      seed: 0,
      maxIterations: 0,
      recursion: 0,
      pos0: new THREE.Vector3(),
      pos1: new THREE.Vector3(),
      linPos0: new THREE.Vector3(),
      linPos1: new THREE.Vector3(),
      up0: new THREE.Vector3(),
      up1: new THREE.Vector3(),
      radius0: 0,
      radius1: 0,
      birthTime: 0,
      deathTime: 0,
      timeScale: 0,
      roughness: 0,
      straightness: 0,
      propagationTimeFactor: 0,
      vanishingTimeFactor: 0,
      endPropagationTime: 0,
      beginVanishingTime: 0
    };
  }
  createSegment() {
    return {
      iteration: 0,
      pos0: new THREE.Vector3(),
      pos1: new THREE.Vector3(),
      linPos0: new THREE.Vector3(),
      linPos1: new THREE.Vector3(),
      up0: new THREE.Vector3(),
      up1: new THREE.Vector3(),
      radius0: 0,
      radius1: 0,
      fraction0: 0,
      fraction1: 0,
      positionVariationFactor: 0
    };
  }
  getNewSegment() {
    return this.raySegments[this.currentSegmentIndex++];
  }
  copy(source) {
    super.copy(source);
    this.init(_LightningStrike.copyParameters({}, source.rayParameters));
    return this;
  }
  clone() {
    return new this.constructor(_LightningStrike.copyParameters({}, this.rayParameters));
  }
};
let LightningStrike = _LightningStrike;
// Ray states
__publicField(LightningStrike, "RAY_INITIALIZED", 0);
__publicField(LightningStrike, "RAY_UNBORN", 1);
__publicField(LightningStrike, "RAY_PROPAGATING", 2);
__publicField(LightningStrike, "RAY_STEADY", 3);
__publicField(LightningStrike, "RAY_VANISHING", 4);
__publicField(LightningStrike, "RAY_EXTINGUISHED", 5);
__publicField(LightningStrike, "COS30DEG", Math.cos(30 * Math.PI / 180));
__publicField(LightningStrike, "SIN30DEG", Math.sin(30 * Math.PI / 180));
exports.LightningStrike = LightningStrike;
//# sourceMappingURL=LightningStrike.cjs.map
