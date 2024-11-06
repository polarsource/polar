"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
function retarget(target, source, options = {}) {
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scale = new THREE.Vector3(), bindBoneMatrix = new THREE.Matrix4(), relativeMatrix = new THREE.Matrix4(), globalMatrix = new THREE.Matrix4();
  options.preserveMatrix = options.preserveMatrix !== void 0 ? options.preserveMatrix : true;
  options.preservePosition = options.preservePosition !== void 0 ? options.preservePosition : true;
  options.preserveHipPosition = options.preserveHipPosition !== void 0 ? options.preserveHipPosition : false;
  options.useTargetMatrix = options.useTargetMatrix !== void 0 ? options.useTargetMatrix : false;
  options.hip = options.hip !== void 0 ? options.hip : "hip";
  options.names = options.names || {};
  const sourceBones = source.isObject3D ? source.skeleton.bones : getBones(source), bones = target.isObject3D ? target.skeleton.bones : getBones(target);
  let bindBones, bone, name, boneTo, bonesPosition;
  if (target.isObject3D) {
    target.skeleton.pose();
  } else {
    options.useTargetMatrix = true;
    options.preserveMatrix = false;
  }
  if (options.preservePosition) {
    bonesPosition = [];
    for (let i = 0; i < bones.length; i++) {
      bonesPosition.push(bones[i].position.clone());
    }
  }
  if (options.preserveMatrix) {
    target.updateMatrixWorld();
    target.matrixWorld.identity();
    for (let i = 0; i < target.children.length; ++i) {
      target.children[i].updateMatrixWorld(true);
    }
  }
  if (options.offsets) {
    bindBones = [];
    for (let i = 0; i < bones.length; ++i) {
      bone = bones[i];
      name = options.names[bone.name] || bone.name;
      if (options.offsets[name]) {
        bone.matrix.multiply(options.offsets[name]);
        bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
        bone.updateMatrixWorld();
      }
      bindBones.push(bone.matrixWorld.clone());
    }
  }
  for (let i = 0; i < bones.length; ++i) {
    bone = bones[i];
    name = options.names[bone.name] || bone.name;
    boneTo = getBoneByName(name, sourceBones);
    globalMatrix.copy(bone.matrixWorld);
    if (boneTo) {
      boneTo.updateMatrixWorld();
      if (options.useTargetMatrix) {
        relativeMatrix.copy(boneTo.matrixWorld);
      } else {
        relativeMatrix.copy(target.matrixWorld).invert();
        relativeMatrix.multiply(boneTo.matrixWorld);
      }
      scale.setFromMatrixScale(relativeMatrix);
      relativeMatrix.scale(scale.set(1 / scale.x, 1 / scale.y, 1 / scale.z));
      globalMatrix.makeRotationFromQuaternion(quat.setFromRotationMatrix(relativeMatrix));
      if (target.isObject3D) {
        const boneIndex = bones.indexOf(bone), wBindMatrix = bindBones ? bindBones[boneIndex] : bindBoneMatrix.copy(target.skeleton.boneInverses[boneIndex]).invert();
        globalMatrix.multiply(wBindMatrix);
      }
      globalMatrix.copyPosition(relativeMatrix);
    }
    if (bone.parent && bone.parent.isBone) {
      bone.matrix.copy(bone.parent.matrixWorld).invert();
      bone.matrix.multiply(globalMatrix);
    } else {
      bone.matrix.copy(globalMatrix);
    }
    if (options.preserveHipPosition && name === options.hip) {
      bone.matrix.setPosition(pos.set(0, bone.position.y, 0));
    }
    bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
    bone.updateMatrixWorld();
  }
  if (options.preservePosition) {
    for (let i = 0; i < bones.length; ++i) {
      bone = bones[i];
      name = options.names[bone.name] || bone.name;
      if (name !== options.hip) {
        bone.position.copy(bonesPosition[i]);
      }
    }
  }
  if (options.preserveMatrix) {
    target.updateMatrixWorld(true);
  }
}
function retargetClip(target, source, clip, options = {}) {
  options.useFirstFramePosition = options.useFirstFramePosition !== void 0 ? options.useFirstFramePosition : false;
  options.fps = options.fps !== void 0 ? options.fps : 30;
  options.names = options.names || [];
  if (!source.isObject3D) {
    source = getHelperFromSkeleton(source);
  }
  const numFrames = Math.round(clip.duration * (options.fps / 1e3) * 1e3), delta = 1 / options.fps, convertedTracks = [], mixer = new THREE.AnimationMixer(source), bones = getBones(target.skeleton), boneDatas = [];
  let positionOffset, bone, boneTo, boneData, name;
  mixer.clipAction(clip).play();
  mixer.update(0);
  source.updateMatrixWorld();
  for (let i = 0; i < numFrames; ++i) {
    const time = i * delta;
    retarget(target, source, options);
    for (let j = 0; j < bones.length; ++j) {
      name = options.names[bones[j].name] || bones[j].name;
      boneTo = getBoneByName(name, source.skeleton);
      if (boneTo) {
        bone = bones[j];
        boneData = boneDatas[j] = boneDatas[j] || { bone };
        if (options.hip === name) {
          if (!boneData.pos) {
            boneData.pos = {
              times: new Float32Array(numFrames),
              values: new Float32Array(numFrames * 3)
            };
          }
          if (options.useFirstFramePosition) {
            if (i === 0) {
              positionOffset = bone.position.clone();
            }
            bone.position.sub(positionOffset);
          }
          boneData.pos.times[i] = time;
          bone.position.toArray(boneData.pos.values, i * 3);
        }
        if (!boneData.quat) {
          boneData.quat = {
            times: new Float32Array(numFrames),
            values: new Float32Array(numFrames * 4)
          };
        }
        boneData.quat.times[i] = time;
        bone.quaternion.toArray(boneData.quat.values, i * 4);
      }
    }
    mixer.update(delta);
    source.updateMatrixWorld();
  }
  for (let i = 0; i < boneDatas.length; ++i) {
    boneData = boneDatas[i];
    if (boneData) {
      if (boneData.pos) {
        convertedTracks.push(
          new THREE.VectorKeyframeTrack(
            ".bones[" + boneData.bone.name + "].position",
            boneData.pos.times,
            boneData.pos.values
          )
        );
      }
      convertedTracks.push(
        new THREE.QuaternionKeyframeTrack(
          ".bones[" + boneData.bone.name + "].quaternion",
          boneData.quat.times,
          boneData.quat.values
        )
      );
    }
  }
  mixer.uncacheAction(clip);
  return new THREE.AnimationClip(clip.name, -1, convertedTracks);
}
function clone(source) {
  const sourceLookup = /* @__PURE__ */ new Map();
  const cloneLookup = /* @__PURE__ */ new Map();
  const clone2 = source.clone();
  parallelTraverse(source, clone2, function(sourceNode, clonedNode) {
    sourceLookup.set(clonedNode, sourceNode);
    cloneLookup.set(sourceNode, clonedNode);
  });
  clone2.traverse(function(node) {
    if (!node.isSkinnedMesh)
      return;
    const clonedMesh = node;
    const sourceMesh = sourceLookup.get(node);
    const sourceBones = sourceMesh.skeleton.bones;
    clonedMesh.skeleton = sourceMesh.skeleton.clone();
    clonedMesh.bindMatrix.copy(sourceMesh.bindMatrix);
    clonedMesh.skeleton.bones = sourceBones.map(function(bone) {
      return cloneLookup.get(bone);
    });
    clonedMesh.bind(clonedMesh.skeleton, clonedMesh.bindMatrix);
  });
  return clone2;
}
function getBoneByName(name, skeleton) {
  for (let i = 0, bones = getBones(skeleton); i < bones.length; i++) {
    if (name === bones[i].name)
      return bones[i];
  }
}
function getBones(skeleton) {
  return Array.isArray(skeleton) ? skeleton : skeleton.bones;
}
function getHelperFromSkeleton(skeleton) {
  const source = new THREE.SkeletonHelper(skeleton.bones[0]);
  source.skeleton = skeleton;
  return source;
}
function parallelTraverse(a, b, callback) {
  callback(a, b);
  for (let i = 0; i < a.children.length; i++) {
    parallelTraverse(a.children[i], b.children[i], callback);
  }
}
const SkeletonUtils = { retarget, retargetClip, clone };
exports.SkeletonUtils = SkeletonUtils;
//# sourceMappingURL=SkeletonUtils.cjs.map
