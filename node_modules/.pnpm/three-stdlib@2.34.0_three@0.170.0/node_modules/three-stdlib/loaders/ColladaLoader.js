import { Loader, LoaderUtils, FileLoader, Vector3, Quaternion, Matrix4, MeshBasicMaterial, Scene, TextureLoader, Euler, MathUtils, AnimationClip, VectorKeyframeTrack, QuaternionKeyframeTrack, MeshLambertMaterial, MeshPhongMaterial, Vector2, DoubleSide, FrontSide, PerspectiveCamera, OrthographicCamera, Color, AmbientLight, SpotLight, PointLight, DirectionalLight, BufferGeometry, Float32BufferAttribute, Group, Bone, LineBasicMaterial, SkinnedMesh, Mesh, Line, LineSegments, RepeatWrapping, ClampToEdgeWrapping, Skeleton } from "three";
import { TGALoader } from "./TGALoader.js";
import { UV1 } from "../_polyfill/uv1.js";
class ColladaLoader extends Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const path = scope.path === "" ? LoaderUtils.extractUrlBase(url) : scope.path;
    const loader = new FileLoader(scope.manager);
    loader.setPath(scope.path);
    loader.setRequestHeader(scope.requestHeader);
    loader.setWithCredentials(scope.withCredentials);
    loader.load(
      url,
      function(text) {
        try {
          onLoad(scope.parse(text, path));
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
  parse(text, path) {
    function getElementsByTagName(xml2, name) {
      const array = [];
      const childNodes = xml2.childNodes;
      for (let i = 0, l = childNodes.length; i < l; i++) {
        const child = childNodes[i];
        if (child.nodeName === name) {
          array.push(child);
        }
      }
      return array;
    }
    function parseStrings(text2) {
      if (text2.length === 0)
        return [];
      const parts = text2.trim().split(/\s+/);
      const array = new Array(parts.length);
      for (let i = 0, l = parts.length; i < l; i++) {
        array[i] = parts[i];
      }
      return array;
    }
    function parseFloats(text2) {
      if (text2.length === 0)
        return [];
      const parts = text2.trim().split(/\s+/);
      const array = new Array(parts.length);
      for (let i = 0, l = parts.length; i < l; i++) {
        array[i] = parseFloat(parts[i]);
      }
      return array;
    }
    function parseInts(text2) {
      if (text2.length === 0)
        return [];
      const parts = text2.trim().split(/\s+/);
      const array = new Array(parts.length);
      for (let i = 0, l = parts.length; i < l; i++) {
        array[i] = parseInt(parts[i]);
      }
      return array;
    }
    function parseId(text2) {
      return text2.substring(1);
    }
    function generateId() {
      return "three_default_" + count++;
    }
    function isEmpty(object) {
      return Object.keys(object).length === 0;
    }
    function parseAsset(xml2) {
      return {
        unit: parseAssetUnit(getElementsByTagName(xml2, "unit")[0]),
        upAxis: parseAssetUpAxis(getElementsByTagName(xml2, "up_axis")[0])
      };
    }
    function parseAssetUnit(xml2) {
      if (xml2 !== void 0 && xml2.hasAttribute("meter") === true) {
        return parseFloat(xml2.getAttribute("meter"));
      } else {
        return 1;
      }
    }
    function parseAssetUpAxis(xml2) {
      return xml2 !== void 0 ? xml2.textContent : "Y_UP";
    }
    function parseLibrary(xml2, libraryName, nodeName, parser) {
      const library2 = getElementsByTagName(xml2, libraryName)[0];
      if (library2 !== void 0) {
        const elements = getElementsByTagName(library2, nodeName);
        for (let i = 0; i < elements.length; i++) {
          parser(elements[i]);
        }
      }
    }
    function buildLibrary(data, builder) {
      for (const name in data) {
        const object = data[name];
        object.build = builder(data[name]);
      }
    }
    function getBuild(data, builder) {
      if (data.build !== void 0)
        return data.build;
      data.build = builder(data);
      return data.build;
    }
    function parseAnimation(xml2) {
      const data = {
        sources: {},
        samplers: {},
        channels: {}
      };
      let hasChildren = false;
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        let id;
        switch (child.nodeName) {
          case "source":
            id = child.getAttribute("id");
            data.sources[id] = parseSource(child);
            break;
          case "sampler":
            id = child.getAttribute("id");
            data.samplers[id] = parseAnimationSampler(child);
            break;
          case "channel":
            id = child.getAttribute("target");
            data.channels[id] = parseAnimationChannel(child);
            break;
          case "animation":
            parseAnimation(child);
            hasChildren = true;
            break;
          default:
            console.log(child);
        }
      }
      if (hasChildren === false) {
        library.animations[xml2.getAttribute("id") || MathUtils.generateUUID()] = data;
      }
    }
    function parseAnimationSampler(xml2) {
      const data = {
        inputs: {}
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "input":
            const id = parseId(child.getAttribute("source"));
            const semantic = child.getAttribute("semantic");
            data.inputs[semantic] = id;
            break;
        }
      }
      return data;
    }
    function parseAnimationChannel(xml2) {
      const data = {};
      const target = xml2.getAttribute("target");
      let parts = target.split("/");
      const id = parts.shift();
      let sid = parts.shift();
      const arraySyntax = sid.indexOf("(") !== -1;
      const memberSyntax = sid.indexOf(".") !== -1;
      if (memberSyntax) {
        parts = sid.split(".");
        sid = parts.shift();
        data.member = parts.shift();
      } else if (arraySyntax) {
        const indices = sid.split("(");
        sid = indices.shift();
        for (let i = 0; i < indices.length; i++) {
          indices[i] = parseInt(indices[i].replace(/\)/, ""));
        }
        data.indices = indices;
      }
      data.id = id;
      data.sid = sid;
      data.arraySyntax = arraySyntax;
      data.memberSyntax = memberSyntax;
      data.sampler = parseId(xml2.getAttribute("source"));
      return data;
    }
    function buildAnimation(data) {
      const tracks = [];
      const channels = data.channels;
      const samplers = data.samplers;
      const sources = data.sources;
      for (const target in channels) {
        if (channels.hasOwnProperty(target)) {
          const channel = channels[target];
          const sampler = samplers[channel.sampler];
          const inputId = sampler.inputs.INPUT;
          const outputId = sampler.inputs.OUTPUT;
          const inputSource = sources[inputId];
          const outputSource = sources[outputId];
          const animation = buildAnimationChannel(channel, inputSource, outputSource);
          createKeyframeTracks(animation, tracks);
        }
      }
      return tracks;
    }
    function getAnimation(id) {
      return getBuild(library.animations[id], buildAnimation);
    }
    function buildAnimationChannel(channel, inputSource, outputSource) {
      const node = library.nodes[channel.id];
      const object3D = getNode(node.id);
      const transform = node.transforms[channel.sid];
      const defaultMatrix = node.matrix.clone().transpose();
      let time, stride;
      let i, il, j, jl;
      const data = {};
      switch (transform) {
        case "matrix":
          for (i = 0, il = inputSource.array.length; i < il; i++) {
            time = inputSource.array[i];
            stride = i * outputSource.stride;
            if (data[time] === void 0)
              data[time] = {};
            if (channel.arraySyntax === true) {
              const value = outputSource.array[stride];
              const index = channel.indices[0] + 4 * channel.indices[1];
              data[time][index] = value;
            } else {
              for (j = 0, jl = outputSource.stride; j < jl; j++) {
                data[time][j] = outputSource.array[stride + j];
              }
            }
          }
          break;
        case "translate":
          console.warn('THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform);
          break;
        case "rotate":
          console.warn('THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform);
          break;
        case "scale":
          console.warn('THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform);
          break;
      }
      const keyframes = prepareAnimationData(data, defaultMatrix);
      const animation = {
        name: object3D.uuid,
        keyframes
      };
      return animation;
    }
    function prepareAnimationData(data, defaultMatrix) {
      const keyframes = [];
      for (const time in data) {
        keyframes.push({ time: parseFloat(time), value: data[time] });
      }
      keyframes.sort(ascending);
      for (let i = 0; i < 16; i++) {
        transformAnimationData(keyframes, i, defaultMatrix.elements[i]);
      }
      return keyframes;
      function ascending(a, b) {
        return a.time - b.time;
      }
    }
    const position = new Vector3();
    const scale = new Vector3();
    const quaternion = new Quaternion();
    function createKeyframeTracks(animation, tracks) {
      const keyframes = animation.keyframes;
      const name = animation.name;
      const times = [];
      const positionData = [];
      const quaternionData = [];
      const scaleData = [];
      for (let i = 0, l = keyframes.length; i < l; i++) {
        const keyframe = keyframes[i];
        const time = keyframe.time;
        const value = keyframe.value;
        matrix.fromArray(value).transpose();
        matrix.decompose(position, quaternion, scale);
        times.push(time);
        positionData.push(position.x, position.y, position.z);
        quaternionData.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
        scaleData.push(scale.x, scale.y, scale.z);
      }
      if (positionData.length > 0)
        tracks.push(new VectorKeyframeTrack(name + ".position", times, positionData));
      if (quaternionData.length > 0) {
        tracks.push(new QuaternionKeyframeTrack(name + ".quaternion", times, quaternionData));
      }
      if (scaleData.length > 0)
        tracks.push(new VectorKeyframeTrack(name + ".scale", times, scaleData));
      return tracks;
    }
    function transformAnimationData(keyframes, property, defaultValue) {
      let keyframe;
      let empty = true;
      let i, l;
      for (i = 0, l = keyframes.length; i < l; i++) {
        keyframe = keyframes[i];
        if (keyframe.value[property] === void 0) {
          keyframe.value[property] = null;
        } else {
          empty = false;
        }
      }
      if (empty === true) {
        for (i = 0, l = keyframes.length; i < l; i++) {
          keyframe = keyframes[i];
          keyframe.value[property] = defaultValue;
        }
      } else {
        createMissingKeyframes(keyframes, property);
      }
    }
    function createMissingKeyframes(keyframes, property) {
      let prev, next;
      for (let i = 0, l = keyframes.length; i < l; i++) {
        const keyframe = keyframes[i];
        if (keyframe.value[property] === null) {
          prev = getPrev(keyframes, i, property);
          next = getNext(keyframes, i, property);
          if (prev === null) {
            keyframe.value[property] = next.value[property];
            continue;
          }
          if (next === null) {
            keyframe.value[property] = prev.value[property];
            continue;
          }
          interpolate(keyframe, prev, next, property);
        }
      }
    }
    function getPrev(keyframes, i, property) {
      while (i >= 0) {
        const keyframe = keyframes[i];
        if (keyframe.value[property] !== null)
          return keyframe;
        i--;
      }
      return null;
    }
    function getNext(keyframes, i, property) {
      while (i < keyframes.length) {
        const keyframe = keyframes[i];
        if (keyframe.value[property] !== null)
          return keyframe;
        i++;
      }
      return null;
    }
    function interpolate(key, prev, next, property) {
      if (next.time - prev.time === 0) {
        key.value[property] = prev.value[property];
        return;
      }
      key.value[property] = (key.time - prev.time) * (next.value[property] - prev.value[property]) / (next.time - prev.time) + prev.value[property];
    }
    function parseAnimationClip(xml2) {
      const data = {
        name: xml2.getAttribute("id") || "default",
        start: parseFloat(xml2.getAttribute("start") || 0),
        end: parseFloat(xml2.getAttribute("end") || 0),
        animations: []
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "instance_animation":
            data.animations.push(parseId(child.getAttribute("url")));
            break;
        }
      }
      library.clips[xml2.getAttribute("id")] = data;
    }
    function buildAnimationClip(data) {
      const tracks = [];
      const name = data.name;
      const duration = data.end - data.start || -1;
      const animations2 = data.animations;
      for (let i = 0, il = animations2.length; i < il; i++) {
        const animationTracks = getAnimation(animations2[i]);
        for (let j = 0, jl = animationTracks.length; j < jl; j++) {
          tracks.push(animationTracks[j]);
        }
      }
      return new AnimationClip(name, duration, tracks);
    }
    function getAnimationClip(id) {
      return getBuild(library.clips[id], buildAnimationClip);
    }
    function parseController(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "skin":
            data.id = parseId(child.getAttribute("source"));
            data.skin = parseSkin(child);
            break;
          case "morph":
            data.id = parseId(child.getAttribute("source"));
            console.warn("THREE.ColladaLoader: Morph target animation not supported yet.");
            break;
        }
      }
      library.controllers[xml2.getAttribute("id")] = data;
    }
    function parseSkin(xml2) {
      const data = {
        sources: {}
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "bind_shape_matrix":
            data.bindShapeMatrix = parseFloats(child.textContent);
            break;
          case "source":
            const id = child.getAttribute("id");
            data.sources[id] = parseSource(child);
            break;
          case "joints":
            data.joints = parseJoints(child);
            break;
          case "vertex_weights":
            data.vertexWeights = parseVertexWeights(child);
            break;
        }
      }
      return data;
    }
    function parseJoints(xml2) {
      const data = {
        inputs: {}
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "input":
            const semantic = child.getAttribute("semantic");
            const id = parseId(child.getAttribute("source"));
            data.inputs[semantic] = id;
            break;
        }
      }
      return data;
    }
    function parseVertexWeights(xml2) {
      const data = {
        inputs: {}
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "input":
            const semantic = child.getAttribute("semantic");
            const id = parseId(child.getAttribute("source"));
            const offset = parseInt(child.getAttribute("offset"));
            data.inputs[semantic] = { id, offset };
            break;
          case "vcount":
            data.vcount = parseInts(child.textContent);
            break;
          case "v":
            data.v = parseInts(child.textContent);
            break;
        }
      }
      return data;
    }
    function buildController(data) {
      const build = {
        id: data.id
      };
      const geometry = library.geometries[build.id];
      if (data.skin !== void 0) {
        build.skin = buildSkin(data.skin);
        geometry.sources.skinIndices = build.skin.indices;
        geometry.sources.skinWeights = build.skin.weights;
      }
      return build;
    }
    function buildSkin(data) {
      const BONE_LIMIT = 4;
      const build = {
        joints: [],
        // this must be an array to preserve the joint order
        indices: {
          array: [],
          stride: BONE_LIMIT
        },
        weights: {
          array: [],
          stride: BONE_LIMIT
        }
      };
      const sources = data.sources;
      const vertexWeights = data.vertexWeights;
      const vcount = vertexWeights.vcount;
      const v = vertexWeights.v;
      const jointOffset = vertexWeights.inputs.JOINT.offset;
      const weightOffset = vertexWeights.inputs.WEIGHT.offset;
      const jointSource = data.sources[data.joints.inputs.JOINT];
      const inverseSource = data.sources[data.joints.inputs.INV_BIND_MATRIX];
      const weights = sources[vertexWeights.inputs.WEIGHT.id].array;
      let stride = 0;
      let i, j, l;
      for (i = 0, l = vcount.length; i < l; i++) {
        const jointCount = vcount[i];
        const vertexSkinData = [];
        for (j = 0; j < jointCount; j++) {
          const skinIndex = v[stride + jointOffset];
          const weightId = v[stride + weightOffset];
          const skinWeight = weights[weightId];
          vertexSkinData.push({ index: skinIndex, weight: skinWeight });
          stride += 2;
        }
        vertexSkinData.sort(descending);
        for (j = 0; j < BONE_LIMIT; j++) {
          const d = vertexSkinData[j];
          if (d !== void 0) {
            build.indices.array.push(d.index);
            build.weights.array.push(d.weight);
          } else {
            build.indices.array.push(0);
            build.weights.array.push(0);
          }
        }
      }
      if (data.bindShapeMatrix) {
        build.bindMatrix = new Matrix4().fromArray(data.bindShapeMatrix).transpose();
      } else {
        build.bindMatrix = new Matrix4().identity();
      }
      for (i = 0, l = jointSource.array.length; i < l; i++) {
        const name = jointSource.array[i];
        const boneInverse = new Matrix4().fromArray(inverseSource.array, i * inverseSource.stride).transpose();
        build.joints.push({ name, boneInverse });
      }
      return build;
      function descending(a, b) {
        return b.weight - a.weight;
      }
    }
    function getController(id) {
      return getBuild(library.controllers[id], buildController);
    }
    function parseImage(xml2) {
      const data = {
        init_from: getElementsByTagName(xml2, "init_from")[0].textContent
      };
      library.images[xml2.getAttribute("id")] = data;
    }
    function buildImage(data) {
      if (data.build !== void 0)
        return data.build;
      return data.init_from;
    }
    function getImage(id) {
      const data = library.images[id];
      if (data !== void 0) {
        return getBuild(data, buildImage);
      }
      console.warn("THREE.ColladaLoader: Couldn't find image with ID:", id);
      return null;
    }
    function parseEffect(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "profile_COMMON":
            data.profile = parseEffectProfileCOMMON(child);
            break;
        }
      }
      library.effects[xml2.getAttribute("id")] = data;
    }
    function parseEffectProfileCOMMON(xml2) {
      const data = {
        surfaces: {},
        samplers: {}
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "newparam":
            parseEffectNewparam(child, data);
            break;
          case "technique":
            data.technique = parseEffectTechnique(child);
            break;
          case "extra":
            data.extra = parseEffectExtra(child);
            break;
        }
      }
      return data;
    }
    function parseEffectNewparam(xml2, data) {
      const sid = xml2.getAttribute("sid");
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "surface":
            data.surfaces[sid] = parseEffectSurface(child);
            break;
          case "sampler2D":
            data.samplers[sid] = parseEffectSampler(child);
            break;
        }
      }
    }
    function parseEffectSurface(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "init_from":
            data.init_from = child.textContent;
            break;
        }
      }
      return data;
    }
    function parseEffectSampler(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "source":
            data.source = child.textContent;
            break;
        }
      }
      return data;
    }
    function parseEffectTechnique(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "constant":
          case "lambert":
          case "blinn":
          case "phong":
            data.type = child.nodeName;
            data.parameters = parseEffectParameters(child);
            break;
          case "extra":
            data.extra = parseEffectExtra(child);
            break;
        }
      }
      return data;
    }
    function parseEffectParameters(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "emission":
          case "diffuse":
          case "specular":
          case "bump":
          case "ambient":
          case "shininess":
          case "transparency":
            data[child.nodeName] = parseEffectParameter(child);
            break;
          case "transparent":
            data[child.nodeName] = {
              opaque: child.hasAttribute("opaque") ? child.getAttribute("opaque") : "A_ONE",
              data: parseEffectParameter(child)
            };
            break;
        }
      }
      return data;
    }
    function parseEffectParameter(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "color":
            data[child.nodeName] = parseFloats(child.textContent);
            break;
          case "float":
            data[child.nodeName] = parseFloat(child.textContent);
            break;
          case "texture":
            data[child.nodeName] = { id: child.getAttribute("texture"), extra: parseEffectParameterTexture(child) };
            break;
        }
      }
      return data;
    }
    function parseEffectParameterTexture(xml2) {
      const data = {
        technique: {}
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "extra":
            parseEffectParameterTextureExtra(child, data);
            break;
        }
      }
      return data;
    }
    function parseEffectParameterTextureExtra(xml2, data) {
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "technique":
            parseEffectParameterTextureExtraTechnique(child, data);
            break;
        }
      }
    }
    function parseEffectParameterTextureExtraTechnique(xml2, data) {
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "repeatU":
          case "repeatV":
          case "offsetU":
          case "offsetV":
            data.technique[child.nodeName] = parseFloat(child.textContent);
            break;
          case "wrapU":
          case "wrapV":
            if (child.textContent.toUpperCase() === "TRUE") {
              data.technique[child.nodeName] = 1;
            } else if (child.textContent.toUpperCase() === "FALSE") {
              data.technique[child.nodeName] = 0;
            } else {
              data.technique[child.nodeName] = parseInt(child.textContent);
            }
            break;
          case "bump":
            data[child.nodeName] = parseEffectExtraTechniqueBump(child);
            break;
        }
      }
    }
    function parseEffectExtra(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "technique":
            data.technique = parseEffectExtraTechnique(child);
            break;
        }
      }
      return data;
    }
    function parseEffectExtraTechnique(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "double_sided":
            data[child.nodeName] = parseInt(child.textContent);
            break;
          case "bump":
            data[child.nodeName] = parseEffectExtraTechniqueBump(child);
            break;
        }
      }
      return data;
    }
    function parseEffectExtraTechniqueBump(xml2) {
      var data = {};
      for (var i = 0, l = xml2.childNodes.length; i < l; i++) {
        var child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "texture":
            data[child.nodeName] = {
              id: child.getAttribute("texture"),
              texcoord: child.getAttribute("texcoord"),
              extra: parseEffectParameterTexture(child)
            };
            break;
        }
      }
      return data;
    }
    function buildEffect(data) {
      return data;
    }
    function getEffect(id) {
      return getBuild(library.effects[id], buildEffect);
    }
    function parseMaterial(xml2) {
      const data = {
        name: xml2.getAttribute("name")
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "instance_effect":
            data.url = parseId(child.getAttribute("url"));
            break;
        }
      }
      library.materials[xml2.getAttribute("id")] = data;
    }
    function getTextureLoader(image) {
      let loader;
      let extension = image.slice((image.lastIndexOf(".") - 1 >>> 0) + 2);
      extension = extension.toLowerCase();
      switch (extension) {
        case "tga":
          loader = tgaLoader;
          break;
        default:
          loader = textureLoader;
      }
      return loader;
    }
    function buildMaterial(data) {
      const effect = getEffect(data.url);
      const technique = effect.profile.technique;
      let material;
      switch (technique.type) {
        case "phong":
        case "blinn":
          material = new MeshPhongMaterial();
          break;
        case "lambert":
          material = new MeshLambertMaterial();
          break;
        default:
          material = new MeshBasicMaterial();
          break;
      }
      material.name = data.name || "";
      function getTexture(textureObject) {
        const sampler = effect.profile.samplers[textureObject.id];
        let image = null;
        if (sampler !== void 0) {
          const surface = effect.profile.surfaces[sampler.source];
          image = getImage(surface.init_from);
        } else {
          console.warn("THREE.ColladaLoader: Undefined sampler. Access image directly (see #12530).");
          image = getImage(textureObject.id);
        }
        if (image !== null) {
          const loader = getTextureLoader(image);
          if (loader !== void 0) {
            const texture = loader.load(image);
            const extra = textureObject.extra;
            if (extra !== void 0 && extra.technique !== void 0 && isEmpty(extra.technique) === false) {
              const technique2 = extra.technique;
              texture.wrapS = technique2.wrapU ? RepeatWrapping : ClampToEdgeWrapping;
              texture.wrapT = technique2.wrapV ? RepeatWrapping : ClampToEdgeWrapping;
              texture.offset.set(technique2.offsetU || 0, technique2.offsetV || 0);
              texture.repeat.set(technique2.repeatU || 1, technique2.repeatV || 1);
            } else {
              texture.wrapS = RepeatWrapping;
              texture.wrapT = RepeatWrapping;
            }
            return texture;
          } else {
            console.warn("THREE.ColladaLoader: Loader for texture %s not found.", image);
            return null;
          }
        } else {
          console.warn("THREE.ColladaLoader: Couldn't create texture with ID:", textureObject.id);
          return null;
        }
      }
      const parameters = technique.parameters;
      for (const key in parameters) {
        const parameter = parameters[key];
        switch (key) {
          case "diffuse":
            if (parameter.color)
              material.color.fromArray(parameter.color);
            if (parameter.texture)
              material.map = getTexture(parameter.texture);
            break;
          case "specular":
            if (parameter.color && material.specular)
              material.specular.fromArray(parameter.color);
            if (parameter.texture)
              material.specularMap = getTexture(parameter.texture);
            break;
          case "bump":
            if (parameter.texture)
              material.normalMap = getTexture(parameter.texture);
            break;
          case "ambient":
            if (parameter.texture)
              material.lightMap = getTexture(parameter.texture);
            break;
          case "shininess":
            if (parameter.float && material.shininess)
              material.shininess = parameter.float;
            break;
          case "emission":
            if (parameter.color && material.emissive)
              material.emissive.fromArray(parameter.color);
            if (parameter.texture)
              material.emissiveMap = getTexture(parameter.texture);
            break;
        }
      }
      let transparent = parameters["transparent"];
      let transparency = parameters["transparency"];
      if (transparency === void 0 && transparent) {
        transparency = {
          float: 1
        };
      }
      if (transparent === void 0 && transparency) {
        transparent = {
          opaque: "A_ONE",
          data: {
            color: [1, 1, 1, 1]
          }
        };
      }
      if (transparent && transparency) {
        if (transparent.data.texture) {
          material.transparent = true;
        } else {
          const color = transparent.data.color;
          switch (transparent.opaque) {
            case "A_ONE":
              material.opacity = color[3] * transparency.float;
              break;
            case "RGB_ZERO":
              material.opacity = 1 - color[0] * transparency.float;
              break;
            case "A_ZERO":
              material.opacity = 1 - color[3] * transparency.float;
              break;
            case "RGB_ONE":
              material.opacity = color[0] * transparency.float;
              break;
            default:
              console.warn('THREE.ColladaLoader: Invalid opaque type "%s" of transparent tag.', transparent.opaque);
          }
          if (material.opacity < 1)
            material.transparent = true;
        }
      }
      if (technique.extra !== void 0 && technique.extra.technique !== void 0) {
        const techniques = technique.extra.technique;
        for (const k in techniques) {
          const v = techniques[k];
          switch (k) {
            case "double_sided":
              material.side = v === 1 ? DoubleSide : FrontSide;
              break;
            case "bump":
              material.normalMap = getTexture(v.texture);
              material.normalScale = new Vector2(1, 1);
              break;
          }
        }
      }
      return material;
    }
    function getMaterial(id) {
      return getBuild(library.materials[id], buildMaterial);
    }
    function parseCamera(xml2) {
      const data = {
        name: xml2.getAttribute("name")
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "optics":
            data.optics = parseCameraOptics(child);
            break;
        }
      }
      library.cameras[xml2.getAttribute("id")] = data;
    }
    function parseCameraOptics(xml2) {
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        switch (child.nodeName) {
          case "technique_common":
            return parseCameraTechnique(child);
        }
      }
      return {};
    }
    function parseCameraTechnique(xml2) {
      const data = {};
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        switch (child.nodeName) {
          case "perspective":
          case "orthographic":
            data.technique = child.nodeName;
            data.parameters = parseCameraParameters(child);
            break;
        }
      }
      return data;
    }
    function parseCameraParameters(xml2) {
      const data = {};
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        switch (child.nodeName) {
          case "xfov":
          case "yfov":
          case "xmag":
          case "ymag":
          case "znear":
          case "zfar":
          case "aspect_ratio":
            data[child.nodeName] = parseFloat(child.textContent);
            break;
        }
      }
      return data;
    }
    function buildCamera(data) {
      let camera;
      switch (data.optics.technique) {
        case "perspective":
          camera = new PerspectiveCamera(
            data.optics.parameters.yfov,
            data.optics.parameters.aspect_ratio,
            data.optics.parameters.znear,
            data.optics.parameters.zfar
          );
          break;
        case "orthographic":
          let ymag = data.optics.parameters.ymag;
          let xmag = data.optics.parameters.xmag;
          const aspectRatio = data.optics.parameters.aspect_ratio;
          xmag = xmag === void 0 ? ymag * aspectRatio : xmag;
          ymag = ymag === void 0 ? xmag / aspectRatio : ymag;
          xmag *= 0.5;
          ymag *= 0.5;
          camera = new OrthographicCamera(
            -xmag,
            xmag,
            ymag,
            -ymag,
            // left, right, top, bottom
            data.optics.parameters.znear,
            data.optics.parameters.zfar
          );
          break;
        default:
          camera = new PerspectiveCamera();
          break;
      }
      camera.name = data.name || "";
      return camera;
    }
    function getCamera(id) {
      const data = library.cameras[id];
      if (data !== void 0) {
        return getBuild(data, buildCamera);
      }
      console.warn("THREE.ColladaLoader: Couldn't find camera with ID:", id);
      return null;
    }
    function parseLight(xml2) {
      let data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "technique_common":
            data = parseLightTechnique(child);
            break;
        }
      }
      library.lights[xml2.getAttribute("id")] = data;
    }
    function parseLightTechnique(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "directional":
          case "point":
          case "spot":
          case "ambient":
            data.technique = child.nodeName;
            data.parameters = parseLightParameters(child);
        }
      }
      return data;
    }
    function parseLightParameters(xml2) {
      const data = {};
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "color":
            const array = parseFloats(child.textContent);
            data.color = new Color().fromArray(array);
            break;
          case "falloff_angle":
            data.falloffAngle = parseFloat(child.textContent);
            break;
          case "quadratic_attenuation":
            const f = parseFloat(child.textContent);
            data.distance = f ? Math.sqrt(1 / f) : 0;
            break;
        }
      }
      return data;
    }
    function buildLight(data) {
      let light;
      switch (data.technique) {
        case "directional":
          light = new DirectionalLight();
          break;
        case "point":
          light = new PointLight();
          break;
        case "spot":
          light = new SpotLight();
          break;
        case "ambient":
          light = new AmbientLight();
          break;
      }
      if (data.parameters.color)
        light.color.copy(data.parameters.color);
      if (data.parameters.distance)
        light.distance = data.parameters.distance;
      return light;
    }
    function getLight(id) {
      const data = library.lights[id];
      if (data !== void 0) {
        return getBuild(data, buildLight);
      }
      console.warn("THREE.ColladaLoader: Couldn't find light with ID:", id);
      return null;
    }
    function parseGeometry(xml2) {
      const data = {
        name: xml2.getAttribute("name"),
        sources: {},
        vertices: {},
        primitives: []
      };
      const mesh = getElementsByTagName(xml2, "mesh")[0];
      if (mesh === void 0)
        return;
      for (let i = 0; i < mesh.childNodes.length; i++) {
        const child = mesh.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        const id = child.getAttribute("id");
        switch (child.nodeName) {
          case "source":
            data.sources[id] = parseSource(child);
            break;
          case "vertices":
            data.vertices = parseGeometryVertices(child);
            break;
          case "polygons":
            console.warn("THREE.ColladaLoader: Unsupported primitive type: ", child.nodeName);
            break;
          case "lines":
          case "linestrips":
          case "polylist":
          case "triangles":
            data.primitives.push(parseGeometryPrimitive(child));
            break;
          default:
            console.log(child);
        }
      }
      library.geometries[xml2.getAttribute("id")] = data;
    }
    function parseSource(xml2) {
      const data = {
        array: [],
        stride: 3
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "float_array":
            data.array = parseFloats(child.textContent);
            break;
          case "Name_array":
            data.array = parseStrings(child.textContent);
            break;
          case "technique_common":
            const accessor = getElementsByTagName(child, "accessor")[0];
            if (accessor !== void 0) {
              data.stride = parseInt(accessor.getAttribute("stride"));
            }
            break;
        }
      }
      return data;
    }
    function parseGeometryVertices(xml2) {
      const data = {};
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        data[child.getAttribute("semantic")] = parseId(child.getAttribute("source"));
      }
      return data;
    }
    function parseGeometryPrimitive(xml2) {
      const primitive = {
        type: xml2.nodeName,
        material: xml2.getAttribute("material"),
        count: parseInt(xml2.getAttribute("count")),
        inputs: {},
        stride: 0,
        hasUV: false
      };
      for (let i = 0, l = xml2.childNodes.length; i < l; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "input":
            const id = parseId(child.getAttribute("source"));
            const semantic = child.getAttribute("semantic");
            const offset = parseInt(child.getAttribute("offset"));
            const set = parseInt(child.getAttribute("set"));
            const inputname = set > 0 ? semantic + set : semantic;
            primitive.inputs[inputname] = { id, offset };
            primitive.stride = Math.max(primitive.stride, offset + 1);
            if (semantic === "TEXCOORD")
              primitive.hasUV = true;
            break;
          case "vcount":
            primitive.vcount = parseInts(child.textContent);
            break;
          case "p":
            primitive.p = parseInts(child.textContent);
            break;
        }
      }
      return primitive;
    }
    function groupPrimitives(primitives) {
      const build = {};
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives[i];
        if (build[primitive.type] === void 0)
          build[primitive.type] = [];
        build[primitive.type].push(primitive);
      }
      return build;
    }
    function checkUVCoordinates(primitives) {
      let count2 = 0;
      for (let i = 0, l = primitives.length; i < l; i++) {
        const primitive = primitives[i];
        if (primitive.hasUV === true) {
          count2++;
        }
      }
      if (count2 > 0 && count2 < primitives.length) {
        primitives.uvsNeedsFix = true;
      }
    }
    function buildGeometry(data) {
      const build = {};
      const sources = data.sources;
      const vertices = data.vertices;
      const primitives = data.primitives;
      if (primitives.length === 0)
        return {};
      const groupedPrimitives = groupPrimitives(primitives);
      for (const type in groupedPrimitives) {
        const primitiveType = groupedPrimitives[type];
        checkUVCoordinates(primitiveType);
        build[type] = buildGeometryType(primitiveType, sources, vertices);
      }
      return build;
    }
    function buildGeometryType(primitives, sources, vertices) {
      const build = {};
      const position2 = { array: [], stride: 0 };
      const normal = { array: [], stride: 0 };
      const uv = { array: [], stride: 0 };
      const uv1 = { array: [], stride: 0 };
      const color = { array: [], stride: 0 };
      const skinIndex = { array: [], stride: 4 };
      const skinWeight = { array: [], stride: 4 };
      const geometry = new BufferGeometry();
      const materialKeys = [];
      let start = 0;
      for (let p = 0; p < primitives.length; p++) {
        const primitive = primitives[p];
        const inputs = primitive.inputs;
        let count2 = 0;
        switch (primitive.type) {
          case "lines":
          case "linestrips":
            count2 = primitive.count * 2;
            break;
          case "triangles":
            count2 = primitive.count * 3;
            break;
          case "polylist":
            for (let g = 0; g < primitive.count; g++) {
              const vc = primitive.vcount[g];
              switch (vc) {
                case 3:
                  count2 += 3;
                  break;
                case 4:
                  count2 += 6;
                  break;
                default:
                  count2 += (vc - 2) * 3;
                  break;
              }
            }
            break;
          default:
            console.warn("THREE.ColladaLoader: Unknow primitive type:", primitive.type);
        }
        geometry.addGroup(start, count2, p);
        start += count2;
        if (primitive.material) {
          materialKeys.push(primitive.material);
        }
        for (const name in inputs) {
          const input = inputs[name];
          switch (name) {
            case "VERTEX":
              for (const key in vertices) {
                const id = vertices[key];
                switch (key) {
                  case "POSITION":
                    const prevLength = position2.array.length;
                    buildGeometryData(primitive, sources[id], input.offset, position2.array);
                    position2.stride = sources[id].stride;
                    if (sources.skinWeights && sources.skinIndices) {
                      buildGeometryData(primitive, sources.skinIndices, input.offset, skinIndex.array);
                      buildGeometryData(primitive, sources.skinWeights, input.offset, skinWeight.array);
                    }
                    if (primitive.hasUV === false && primitives.uvsNeedsFix === true) {
                      const count3 = (position2.array.length - prevLength) / position2.stride;
                      for (let i = 0; i < count3; i++) {
                        uv.array.push(0, 0);
                      }
                    }
                    break;
                  case "NORMAL":
                    buildGeometryData(primitive, sources[id], input.offset, normal.array);
                    normal.stride = sources[id].stride;
                    break;
                  case "COLOR":
                    buildGeometryData(primitive, sources[id], input.offset, color.array);
                    color.stride = sources[id].stride;
                    break;
                  case "TEXCOORD":
                    buildGeometryData(primitive, sources[id], input.offset, uv.array);
                    uv.stride = sources[id].stride;
                    break;
                  case "TEXCOORD1":
                    buildGeometryData(primitive, sources[id], input.offset, uv1.array);
                    uv.stride = sources[id].stride;
                    break;
                  default:
                    console.warn('THREE.ColladaLoader: Semantic "%s" not handled in geometry build process.', key);
                }
              }
              break;
            case "NORMAL":
              buildGeometryData(primitive, sources[input.id], input.offset, normal.array);
              normal.stride = sources[input.id].stride;
              break;
            case "COLOR":
              buildGeometryData(primitive, sources[input.id], input.offset, color.array);
              color.stride = sources[input.id].stride;
              break;
            case "TEXCOORD":
              buildGeometryData(primitive, sources[input.id], input.offset, uv.array);
              uv.stride = sources[input.id].stride;
              break;
            case "TEXCOORD1":
              buildGeometryData(primitive, sources[input.id], input.offset, uv1.array);
              uv1.stride = sources[input.id].stride;
              break;
          }
        }
      }
      if (position2.array.length > 0) {
        geometry.setAttribute("position", new Float32BufferAttribute(position2.array, position2.stride));
      }
      if (normal.array.length > 0) {
        geometry.setAttribute("normal", new Float32BufferAttribute(normal.array, normal.stride));
      }
      if (color.array.length > 0)
        geometry.setAttribute("color", new Float32BufferAttribute(color.array, color.stride));
      if (uv.array.length > 0)
        geometry.setAttribute("uv", new Float32BufferAttribute(uv.array, uv.stride));
      if (uv1.array.length > 0)
        geometry.setAttribute(UV1, new Float32BufferAttribute(uv1.array, uv1.stride));
      if (skinIndex.array.length > 0) {
        geometry.setAttribute("skinIndex", new Float32BufferAttribute(skinIndex.array, skinIndex.stride));
      }
      if (skinWeight.array.length > 0) {
        geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight.array, skinWeight.stride));
      }
      build.data = geometry;
      build.type = primitives[0].type;
      build.materialKeys = materialKeys;
      return build;
    }
    function buildGeometryData(primitive, source, offset, array) {
      const indices = primitive.p;
      const stride = primitive.stride;
      const vcount = primitive.vcount;
      function pushVector(i) {
        let index = indices[i + offset] * sourceStride;
        const length = index + sourceStride;
        for (; index < length; index++) {
          array.push(sourceArray[index]);
        }
      }
      const sourceArray = source.array;
      const sourceStride = source.stride;
      if (primitive.vcount !== void 0) {
        let index = 0;
        for (let i = 0, l = vcount.length; i < l; i++) {
          const count2 = vcount[i];
          if (count2 === 4) {
            const a = index + stride * 0;
            const b = index + stride * 1;
            const c = index + stride * 2;
            const d = index + stride * 3;
            pushVector(a);
            pushVector(b);
            pushVector(d);
            pushVector(b);
            pushVector(c);
            pushVector(d);
          } else if (count2 === 3) {
            const a = index + stride * 0;
            const b = index + stride * 1;
            const c = index + stride * 2;
            pushVector(a);
            pushVector(b);
            pushVector(c);
          } else if (count2 > 4) {
            for (let k = 1, kl = count2 - 2; k <= kl; k++) {
              const a = index + stride * 0;
              const b = index + stride * k;
              const c = index + stride * (k + 1);
              pushVector(a);
              pushVector(b);
              pushVector(c);
            }
          }
          index += stride * count2;
        }
      } else {
        for (let i = 0, l = indices.length; i < l; i += stride) {
          pushVector(i);
        }
      }
    }
    function getGeometry(id) {
      return getBuild(library.geometries[id], buildGeometry);
    }
    function parseKinematicsModel(xml2) {
      const data = {
        name: xml2.getAttribute("name") || "",
        joints: {},
        links: []
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "technique_common":
            parseKinematicsTechniqueCommon(child, data);
            break;
        }
      }
      library.kinematicsModels[xml2.getAttribute("id")] = data;
    }
    function buildKinematicsModel(data) {
      if (data.build !== void 0)
        return data.build;
      return data;
    }
    function getKinematicsModel(id) {
      return getBuild(library.kinematicsModels[id], buildKinematicsModel);
    }
    function parseKinematicsTechniqueCommon(xml2, data) {
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "joint":
            data.joints[child.getAttribute("sid")] = parseKinematicsJoint(child);
            break;
          case "link":
            data.links.push(parseKinematicsLink(child));
            break;
        }
      }
    }
    function parseKinematicsJoint(xml2) {
      let data;
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "prismatic":
          case "revolute":
            data = parseKinematicsJointParameter(child);
            break;
        }
      }
      return data;
    }
    function parseKinematicsJointParameter(xml2) {
      const data = {
        sid: xml2.getAttribute("sid"),
        name: xml2.getAttribute("name") || "",
        axis: new Vector3(),
        limits: {
          min: 0,
          max: 0
        },
        type: xml2.nodeName,
        static: false,
        zeroPosition: 0,
        middlePosition: 0
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "axis":
            const array = parseFloats(child.textContent);
            data.axis.fromArray(array);
            break;
          case "limits":
            const max = child.getElementsByTagName("max")[0];
            const min = child.getElementsByTagName("min")[0];
            data.limits.max = parseFloat(max.textContent);
            data.limits.min = parseFloat(min.textContent);
            break;
        }
      }
      if (data.limits.min >= data.limits.max) {
        data.static = true;
      }
      data.middlePosition = (data.limits.min + data.limits.max) / 2;
      return data;
    }
    function parseKinematicsLink(xml2) {
      const data = {
        sid: xml2.getAttribute("sid"),
        name: xml2.getAttribute("name") || "",
        attachments: [],
        transforms: []
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "attachment_full":
            data.attachments.push(parseKinematicsAttachment(child));
            break;
          case "matrix":
          case "translate":
          case "rotate":
            data.transforms.push(parseKinematicsTransform(child));
            break;
        }
      }
      return data;
    }
    function parseKinematicsAttachment(xml2) {
      const data = {
        joint: xml2.getAttribute("joint").split("/").pop(),
        transforms: [],
        links: []
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "link":
            data.links.push(parseKinematicsLink(child));
            break;
          case "matrix":
          case "translate":
          case "rotate":
            data.transforms.push(parseKinematicsTransform(child));
            break;
        }
      }
      return data;
    }
    function parseKinematicsTransform(xml2) {
      const data = {
        type: xml2.nodeName
      };
      const array = parseFloats(xml2.textContent);
      switch (data.type) {
        case "matrix":
          data.obj = new Matrix4();
          data.obj.fromArray(array).transpose();
          break;
        case "translate":
          data.obj = new Vector3();
          data.obj.fromArray(array);
          break;
        case "rotate":
          data.obj = new Vector3();
          data.obj.fromArray(array);
          data.angle = MathUtils.degToRad(array[3]);
          break;
      }
      return data;
    }
    function parsePhysicsModel(xml2) {
      const data = {
        name: xml2.getAttribute("name") || "",
        rigidBodies: {}
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "rigid_body":
            data.rigidBodies[child.getAttribute("name")] = {};
            parsePhysicsRigidBody(child, data.rigidBodies[child.getAttribute("name")]);
            break;
        }
      }
      library.physicsModels[xml2.getAttribute("id")] = data;
    }
    function parsePhysicsRigidBody(xml2, data) {
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "technique_common":
            parsePhysicsTechniqueCommon(child, data);
            break;
        }
      }
    }
    function parsePhysicsTechniqueCommon(xml2, data) {
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "inertia":
            data.inertia = parseFloats(child.textContent);
            break;
          case "mass":
            data.mass = parseFloats(child.textContent)[0];
            break;
        }
      }
    }
    function parseKinematicsScene(xml2) {
      const data = {
        bindJointAxis: []
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "bind_joint_axis":
            data.bindJointAxis.push(parseKinematicsBindJointAxis(child));
            break;
        }
      }
      library.kinematicsScenes[parseId(xml2.getAttribute("url"))] = data;
    }
    function parseKinematicsBindJointAxis(xml2) {
      const data = {
        target: xml2.getAttribute("target").split("/").pop()
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        switch (child.nodeName) {
          case "axis":
            const param = child.getElementsByTagName("param")[0];
            data.axis = param.textContent;
            const tmpJointIndex = data.axis.split("inst_").pop().split("axis")[0];
            data.jointIndex = tmpJointIndex.substr(0, tmpJointIndex.length - 1);
            break;
        }
      }
      return data;
    }
    function buildKinematicsScene(data) {
      if (data.build !== void 0)
        return data.build;
      return data;
    }
    function getKinematicsScene(id) {
      return getBuild(library.kinematicsScenes[id], buildKinematicsScene);
    }
    function setupKinematics() {
      const kinematicsModelId = Object.keys(library.kinematicsModels)[0];
      const kinematicsSceneId = Object.keys(library.kinematicsScenes)[0];
      const visualSceneId = Object.keys(library.visualScenes)[0];
      if (kinematicsModelId === void 0 || kinematicsSceneId === void 0)
        return;
      const kinematicsModel = getKinematicsModel(kinematicsModelId);
      const kinematicsScene = getKinematicsScene(kinematicsSceneId);
      const visualScene = getVisualScene(visualSceneId);
      const bindJointAxis = kinematicsScene.bindJointAxis;
      const jointMap = {};
      for (let i = 0, l = bindJointAxis.length; i < l; i++) {
        const axis = bindJointAxis[i];
        const targetElement = collada.querySelector('[sid="' + axis.target + '"]');
        if (targetElement) {
          const parentVisualElement = targetElement.parentElement;
          connect(axis.jointIndex, parentVisualElement);
        }
      }
      function connect(jointIndex, visualElement) {
        const visualElementName = visualElement.getAttribute("name");
        const joint = kinematicsModel.joints[jointIndex];
        visualScene.traverse(function(object) {
          if (object.name === visualElementName) {
            jointMap[jointIndex] = {
              object,
              transforms: buildTransformList(visualElement),
              joint,
              position: joint.zeroPosition
            };
          }
        });
      }
      const m0 = new Matrix4();
      kinematics = {
        joints: kinematicsModel && kinematicsModel.joints,
        getJointValue: function(jointIndex) {
          const jointData = jointMap[jointIndex];
          if (jointData) {
            return jointData.position;
          } else {
            console.warn("THREE.ColladaLoader: Joint " + jointIndex + " doesn't exist.");
          }
        },
        setJointValue: function(jointIndex, value) {
          const jointData = jointMap[jointIndex];
          if (jointData) {
            const joint = jointData.joint;
            if (value > joint.limits.max || value < joint.limits.min) {
              console.warn(
                "THREE.ColladaLoader: Joint " + jointIndex + " value " + value + " outside of limits (min: " + joint.limits.min + ", max: " + joint.limits.max + ")."
              );
            } else if (joint.static) {
              console.warn("THREE.ColladaLoader: Joint " + jointIndex + " is static.");
            } else {
              const object = jointData.object;
              const axis = joint.axis;
              const transforms = jointData.transforms;
              matrix.identity();
              for (let i = 0; i < transforms.length; i++) {
                const transform = transforms[i];
                if (transform.sid && transform.sid.indexOf(jointIndex) !== -1) {
                  switch (joint.type) {
                    case "revolute":
                      matrix.multiply(m0.makeRotationAxis(axis, MathUtils.degToRad(value)));
                      break;
                    case "prismatic":
                      matrix.multiply(m0.makeTranslation(axis.x * value, axis.y * value, axis.z * value));
                      break;
                    default:
                      console.warn("THREE.ColladaLoader: Unknown joint type: " + joint.type);
                      break;
                  }
                } else {
                  switch (transform.type) {
                    case "matrix":
                      matrix.multiply(transform.obj);
                      break;
                    case "translate":
                      matrix.multiply(m0.makeTranslation(transform.obj.x, transform.obj.y, transform.obj.z));
                      break;
                    case "scale":
                      matrix.scale(transform.obj);
                      break;
                    case "rotate":
                      matrix.multiply(m0.makeRotationAxis(transform.obj, transform.angle));
                      break;
                  }
                }
              }
              object.matrix.copy(matrix);
              object.matrix.decompose(object.position, object.quaternion, object.scale);
              jointMap[jointIndex].position = value;
            }
          } else {
            console.log("THREE.ColladaLoader: " + jointIndex + " does not exist.");
          }
        }
      };
    }
    function buildTransformList(node) {
      const transforms = [];
      const xml2 = collada.querySelector('[id="' + node.id + '"]');
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        let array, vector2;
        switch (child.nodeName) {
          case "matrix":
            array = parseFloats(child.textContent);
            const matrix2 = new Matrix4().fromArray(array).transpose();
            transforms.push({
              sid: child.getAttribute("sid"),
              type: child.nodeName,
              obj: matrix2
            });
            break;
          case "translate":
          case "scale":
            array = parseFloats(child.textContent);
            vector2 = new Vector3().fromArray(array);
            transforms.push({
              sid: child.getAttribute("sid"),
              type: child.nodeName,
              obj: vector2
            });
            break;
          case "rotate":
            array = parseFloats(child.textContent);
            vector2 = new Vector3().fromArray(array);
            const angle = MathUtils.degToRad(array[3]);
            transforms.push({
              sid: child.getAttribute("sid"),
              type: child.nodeName,
              obj: vector2,
              angle
            });
            break;
        }
      }
      return transforms;
    }
    function prepareNodes(xml2) {
      const elements = xml2.getElementsByTagName("node");
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element.hasAttribute("id") === false) {
          element.setAttribute("id", generateId());
        }
      }
    }
    const matrix = new Matrix4();
    const vector = new Vector3();
    function parseNode(xml2) {
      const data = {
        name: xml2.getAttribute("name") || "",
        type: xml2.getAttribute("type"),
        id: xml2.getAttribute("id"),
        sid: xml2.getAttribute("sid"),
        matrix: new Matrix4(),
        nodes: [],
        instanceCameras: [],
        instanceControllers: [],
        instanceLights: [],
        instanceGeometries: [],
        instanceNodes: [],
        transforms: {}
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        if (child.nodeType !== 1)
          continue;
        let array;
        switch (child.nodeName) {
          case "node":
            data.nodes.push(child.getAttribute("id"));
            parseNode(child);
            break;
          case "instance_camera":
            data.instanceCameras.push(parseId(child.getAttribute("url")));
            break;
          case "instance_controller":
            data.instanceControllers.push(parseNodeInstance(child));
            break;
          case "instance_light":
            data.instanceLights.push(parseId(child.getAttribute("url")));
            break;
          case "instance_geometry":
            data.instanceGeometries.push(parseNodeInstance(child));
            break;
          case "instance_node":
            data.instanceNodes.push(parseId(child.getAttribute("url")));
            break;
          case "matrix":
            array = parseFloats(child.textContent);
            data.matrix.multiply(matrix.fromArray(array).transpose());
            data.transforms[child.getAttribute("sid")] = child.nodeName;
            break;
          case "translate":
            array = parseFloats(child.textContent);
            vector.fromArray(array);
            data.matrix.multiply(matrix.makeTranslation(vector.x, vector.y, vector.z));
            data.transforms[child.getAttribute("sid")] = child.nodeName;
            break;
          case "rotate":
            array = parseFloats(child.textContent);
            const angle = MathUtils.degToRad(array[3]);
            data.matrix.multiply(matrix.makeRotationAxis(vector.fromArray(array), angle));
            data.transforms[child.getAttribute("sid")] = child.nodeName;
            break;
          case "scale":
            array = parseFloats(child.textContent);
            data.matrix.scale(vector.fromArray(array));
            data.transforms[child.getAttribute("sid")] = child.nodeName;
            break;
          case "extra":
            break;
          default:
            console.log(child);
        }
      }
      if (hasNode(data.id)) {
        console.warn(
          "THREE.ColladaLoader: There is already a node with ID %s. Exclude current node from further processing.",
          data.id
        );
      } else {
        library.nodes[data.id] = data;
      }
      return data;
    }
    function parseNodeInstance(xml2) {
      const data = {
        id: parseId(xml2.getAttribute("url")),
        materials: {},
        skeletons: []
      };
      for (let i = 0; i < xml2.childNodes.length; i++) {
        const child = xml2.childNodes[i];
        switch (child.nodeName) {
          case "bind_material":
            const instances = child.getElementsByTagName("instance_material");
            for (let j = 0; j < instances.length; j++) {
              const instance = instances[j];
              const symbol = instance.getAttribute("symbol");
              const target = instance.getAttribute("target");
              data.materials[symbol] = parseId(target);
            }
            break;
          case "skeleton":
            data.skeletons.push(parseId(child.textContent));
            break;
        }
      }
      return data;
    }
    function buildSkeleton(skeletons, joints) {
      const boneData = [];
      const sortedBoneData = [];
      let i, j, data;
      for (i = 0; i < skeletons.length; i++) {
        const skeleton = skeletons[i];
        let root;
        if (hasNode(skeleton)) {
          root = getNode(skeleton);
          buildBoneHierarchy(root, joints, boneData);
        } else if (hasVisualScene(skeleton)) {
          const visualScene = library.visualScenes[skeleton];
          const children = visualScene.children;
          for (let j2 = 0; j2 < children.length; j2++) {
            const child = children[j2];
            if (child.type === "JOINT") {
              const root2 = getNode(child.id);
              buildBoneHierarchy(root2, joints, boneData);
            }
          }
        } else {
          console.error("THREE.ColladaLoader: Unable to find root bone of skeleton with ID:", skeleton);
        }
      }
      for (i = 0; i < joints.length; i++) {
        for (j = 0; j < boneData.length; j++) {
          data = boneData[j];
          if (data.bone.name === joints[i].name) {
            sortedBoneData[i] = data;
            data.processed = true;
            break;
          }
        }
      }
      for (i = 0; i < boneData.length; i++) {
        data = boneData[i];
        if (data.processed === false) {
          sortedBoneData.push(data);
          data.processed = true;
        }
      }
      const bones = [];
      const boneInverses = [];
      for (i = 0; i < sortedBoneData.length; i++) {
        data = sortedBoneData[i];
        bones.push(data.bone);
        boneInverses.push(data.boneInverse);
      }
      return new Skeleton(bones, boneInverses);
    }
    function buildBoneHierarchy(root, joints, boneData) {
      root.traverse(function(object) {
        if (object.isBone === true) {
          let boneInverse;
          for (let i = 0; i < joints.length; i++) {
            const joint = joints[i];
            if (joint.name === object.name) {
              boneInverse = joint.boneInverse;
              break;
            }
          }
          if (boneInverse === void 0) {
            boneInverse = new Matrix4();
          }
          boneData.push({ bone: object, boneInverse, processed: false });
        }
      });
    }
    function buildNode(data) {
      const objects = [];
      const matrix2 = data.matrix;
      const nodes = data.nodes;
      const type = data.type;
      const instanceCameras = data.instanceCameras;
      const instanceControllers = data.instanceControllers;
      const instanceLights = data.instanceLights;
      const instanceGeometries = data.instanceGeometries;
      const instanceNodes = data.instanceNodes;
      for (let i = 0, l = nodes.length; i < l; i++) {
        objects.push(getNode(nodes[i]));
      }
      for (let i = 0, l = instanceCameras.length; i < l; i++) {
        const instanceCamera = getCamera(instanceCameras[i]);
        if (instanceCamera !== null) {
          objects.push(instanceCamera.clone());
        }
      }
      for (let i = 0, l = instanceControllers.length; i < l; i++) {
        const instance = instanceControllers[i];
        const controller = getController(instance.id);
        const geometries = getGeometry(controller.id);
        const newObjects = buildObjects(geometries, instance.materials);
        const skeletons = instance.skeletons;
        const joints = controller.skin.joints;
        const skeleton = buildSkeleton(skeletons, joints);
        for (let j = 0, jl = newObjects.length; j < jl; j++) {
          const object2 = newObjects[j];
          if (object2.isSkinnedMesh) {
            object2.bind(skeleton, controller.skin.bindMatrix);
            object2.normalizeSkinWeights();
          }
          objects.push(object2);
        }
      }
      for (let i = 0, l = instanceLights.length; i < l; i++) {
        const instanceLight = getLight(instanceLights[i]);
        if (instanceLight !== null) {
          objects.push(instanceLight.clone());
        }
      }
      for (let i = 0, l = instanceGeometries.length; i < l; i++) {
        const instance = instanceGeometries[i];
        const geometries = getGeometry(instance.id);
        const newObjects = buildObjects(geometries, instance.materials);
        for (let j = 0, jl = newObjects.length; j < jl; j++) {
          objects.push(newObjects[j]);
        }
      }
      for (let i = 0, l = instanceNodes.length; i < l; i++) {
        objects.push(getNode(instanceNodes[i]).clone());
      }
      let object;
      if (nodes.length === 0 && objects.length === 1) {
        object = objects[0];
      } else {
        object = type === "JOINT" ? new Bone() : new Group();
        for (let i = 0; i < objects.length; i++) {
          object.add(objects[i]);
        }
      }
      object.name = type === "JOINT" ? data.sid : data.name;
      object.matrix.copy(matrix2);
      object.matrix.decompose(object.position, object.quaternion, object.scale);
      return object;
    }
    const fallbackMaterial = new MeshBasicMaterial({ color: 16711935 });
    function resolveMaterialBinding(keys, instanceMaterials) {
      const materials = [];
      for (let i = 0, l = keys.length; i < l; i++) {
        const id = instanceMaterials[keys[i]];
        if (id === void 0) {
          console.warn("THREE.ColladaLoader: Material with key %s not found. Apply fallback material.", keys[i]);
          materials.push(fallbackMaterial);
        } else {
          materials.push(getMaterial(id));
        }
      }
      return materials;
    }
    function buildObjects(geometries, instanceMaterials) {
      const objects = [];
      for (const type in geometries) {
        const geometry = geometries[type];
        const materials = resolveMaterialBinding(geometry.materialKeys, instanceMaterials);
        if (materials.length === 0) {
          if (type === "lines" || type === "linestrips") {
            materials.push(new LineBasicMaterial());
          } else {
            materials.push(new MeshPhongMaterial());
          }
        }
        const skinning = geometry.data.attributes.skinIndex !== void 0;
        const material = materials.length === 1 ? materials[0] : materials;
        let object;
        switch (type) {
          case "lines":
            object = new LineSegments(geometry.data, material);
            break;
          case "linestrips":
            object = new Line(geometry.data, material);
            break;
          case "triangles":
          case "polylist":
            if (skinning) {
              object = new SkinnedMesh(geometry.data, material);
            } else {
              object = new Mesh(geometry.data, material);
            }
            break;
        }
        objects.push(object);
      }
      return objects;
    }
    function hasNode(id) {
      return library.nodes[id] !== void 0;
    }
    function getNode(id) {
      return getBuild(library.nodes[id], buildNode);
    }
    function parseVisualScene(xml2) {
      const data = {
        name: xml2.getAttribute("name"),
        children: []
      };
      prepareNodes(xml2);
      const elements = getElementsByTagName(xml2, "node");
      for (let i = 0; i < elements.length; i++) {
        data.children.push(parseNode(elements[i]));
      }
      library.visualScenes[xml2.getAttribute("id")] = data;
    }
    function buildVisualScene(data) {
      const group = new Group();
      group.name = data.name;
      const children = data.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        group.add(getNode(child.id));
      }
      return group;
    }
    function hasVisualScene(id) {
      return library.visualScenes[id] !== void 0;
    }
    function getVisualScene(id) {
      return getBuild(library.visualScenes[id], buildVisualScene);
    }
    function parseScene(xml2) {
      const instance = getElementsByTagName(xml2, "instance_visual_scene")[0];
      return getVisualScene(parseId(instance.getAttribute("url")));
    }
    function setupAnimations() {
      const clips = library.clips;
      if (isEmpty(clips) === true) {
        if (isEmpty(library.animations) === false) {
          const tracks = [];
          for (const id in library.animations) {
            const animationTracks = getAnimation(id);
            for (let i = 0, l = animationTracks.length; i < l; i++) {
              tracks.push(animationTracks[i]);
            }
          }
          animations.push(new AnimationClip("default", -1, tracks));
        }
      } else {
        for (const id in clips) {
          animations.push(getAnimationClip(id));
        }
      }
    }
    function parserErrorToText(parserError2) {
      let result = "";
      const stack = [parserError2];
      while (stack.length) {
        const node = stack.shift();
        if (node.nodeType === Node.TEXT_NODE) {
          result += node.textContent;
        } else {
          result += "\n";
          stack.push.apply(stack, node.childNodes);
        }
      }
      return result.trim();
    }
    if (text.length === 0) {
      return { scene: new Scene() };
    }
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const collada = getElementsByTagName(xml, "COLLADA")[0];
    const parserError = xml.getElementsByTagName("parsererror")[0];
    if (parserError !== void 0) {
      const errorElement = getElementsByTagName(parserError, "div")[0];
      let errorText;
      if (errorElement) {
        errorText = errorElement.textContent;
      } else {
        errorText = parserErrorToText(parserError);
      }
      console.error("THREE.ColladaLoader: Failed to parse collada file.\n", errorText);
      return null;
    }
    const version = collada.getAttribute("version");
    console.log("THREE.ColladaLoader: File version", version);
    const asset = parseAsset(getElementsByTagName(collada, "asset")[0]);
    const textureLoader = new TextureLoader(this.manager);
    textureLoader.setPath(this.resourcePath || path).setCrossOrigin(this.crossOrigin);
    let tgaLoader;
    if (TGALoader) {
      tgaLoader = new TGALoader(this.manager);
      tgaLoader.setPath(this.resourcePath || path);
    }
    const animations = [];
    let kinematics = {};
    let count = 0;
    const library = {
      animations: {},
      clips: {},
      controllers: {},
      images: {},
      effects: {},
      materials: {},
      cameras: {},
      lights: {},
      geometries: {},
      nodes: {},
      visualScenes: {},
      kinematicsModels: {},
      physicsModels: {},
      kinematicsScenes: {}
    };
    parseLibrary(collada, "library_animations", "animation", parseAnimation);
    parseLibrary(collada, "library_animation_clips", "animation_clip", parseAnimationClip);
    parseLibrary(collada, "library_controllers", "controller", parseController);
    parseLibrary(collada, "library_images", "image", parseImage);
    parseLibrary(collada, "library_effects", "effect", parseEffect);
    parseLibrary(collada, "library_materials", "material", parseMaterial);
    parseLibrary(collada, "library_cameras", "camera", parseCamera);
    parseLibrary(collada, "library_lights", "light", parseLight);
    parseLibrary(collada, "library_geometries", "geometry", parseGeometry);
    parseLibrary(collada, "library_nodes", "node", parseNode);
    parseLibrary(collada, "library_visual_scenes", "visual_scene", parseVisualScene);
    parseLibrary(collada, "library_kinematics_models", "kinematics_model", parseKinematicsModel);
    parseLibrary(collada, "library_physics_models", "physics_model", parsePhysicsModel);
    parseLibrary(collada, "scene", "instance_kinematics_scene", parseKinematicsScene);
    buildLibrary(library.animations, buildAnimation);
    buildLibrary(library.clips, buildAnimationClip);
    buildLibrary(library.controllers, buildController);
    buildLibrary(library.images, buildImage);
    buildLibrary(library.effects, buildEffect);
    buildLibrary(library.materials, buildMaterial);
    buildLibrary(library.cameras, buildCamera);
    buildLibrary(library.lights, buildLight);
    buildLibrary(library.geometries, buildGeometry);
    buildLibrary(library.visualScenes, buildVisualScene);
    setupAnimations();
    setupKinematics();
    const scene = parseScene(getElementsByTagName(collada, "scene")[0]);
    scene.animations = animations;
    if (asset.upAxis === "Z_UP") {
      scene.quaternion.setFromEuler(new Euler(-Math.PI / 2, 0, 0));
    }
    scene.scale.multiplyScalar(asset.unit);
    return {
      get animations() {
        console.warn("THREE.ColladaLoader: Please access animations over scene.animations now.");
        return animations;
      },
      kinematics,
      library,
      scene
    };
  }
}
export {
  ColladaLoader
};
//# sourceMappingURL=ColladaLoader.js.map
