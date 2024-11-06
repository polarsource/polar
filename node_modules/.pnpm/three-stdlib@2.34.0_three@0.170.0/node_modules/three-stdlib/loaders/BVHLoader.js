import { Loader, FileLoader, Skeleton, Vector3, Quaternion, Bone, VectorKeyframeTrack, QuaternionKeyframeTrack, AnimationClip } from "three";
class BVHLoader extends Loader {
  constructor(manager) {
    super(manager);
    this.animateBonePositions = true;
    this.animateBoneRotations = true;
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new FileLoader(scope.manager);
    loader.setPath(scope.path);
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
  parse(text) {
    function readBvh(lines2) {
      if (nextLine(lines2) !== "HIERARCHY") {
        console.error("THREE.BVHLoader: HIERARCHY expected.");
      }
      const list = [];
      const root = readNode(lines2, nextLine(lines2), list);
      if (nextLine(lines2) !== "MOTION") {
        console.error("THREE.BVHLoader: MOTION expected.");
      }
      let tokens = nextLine(lines2).split(/[\s]+/);
      const numFrames = parseInt(tokens[1]);
      if (isNaN(numFrames)) {
        console.error("THREE.BVHLoader: Failed to read number of frames.");
      }
      tokens = nextLine(lines2).split(/[\s]+/);
      const frameTime = parseFloat(tokens[2]);
      if (isNaN(frameTime)) {
        console.error("THREE.BVHLoader: Failed to read frame time.");
      }
      for (let i = 0; i < numFrames; i++) {
        tokens = nextLine(lines2).split(/[\s]+/);
        readFrameData(tokens, i * frameTime, root);
      }
      return list;
    }
    function readFrameData(data, frameTime, bone) {
      if (bone.type === "ENDSITE")
        return;
      const keyframe = {
        time: frameTime,
        position: new Vector3(),
        rotation: new Quaternion()
      };
      bone.frames.push(keyframe);
      const quat = new Quaternion();
      const vx = new Vector3(1, 0, 0);
      const vy = new Vector3(0, 1, 0);
      const vz = new Vector3(0, 0, 1);
      for (let i = 0; i < bone.channels.length; i++) {
        switch (bone.channels[i]) {
          case "Xposition":
            keyframe.position.x = parseFloat(data.shift().trim());
            break;
          case "Yposition":
            keyframe.position.y = parseFloat(data.shift().trim());
            break;
          case "Zposition":
            keyframe.position.z = parseFloat(data.shift().trim());
            break;
          case "Xrotation":
            quat.setFromAxisAngle(vx, parseFloat(data.shift().trim()) * Math.PI / 180);
            keyframe.rotation.multiply(quat);
            break;
          case "Yrotation":
            quat.setFromAxisAngle(vy, parseFloat(data.shift().trim()) * Math.PI / 180);
            keyframe.rotation.multiply(quat);
            break;
          case "Zrotation":
            quat.setFromAxisAngle(vz, parseFloat(data.shift().trim()) * Math.PI / 180);
            keyframe.rotation.multiply(quat);
            break;
          default:
            console.warn("THREE.BVHLoader: Invalid channel type.");
        }
      }
      for (let i = 0; i < bone.children.length; i++) {
        readFrameData(data, frameTime, bone.children[i]);
      }
    }
    function readNode(lines2, firstline, list) {
      const node = { name: "", type: "", frames: [] };
      list.push(node);
      let tokens = firstline.split(/[\s]+/);
      if (tokens[0].toUpperCase() === "END" && tokens[1].toUpperCase() === "SITE") {
        node.type = "ENDSITE";
        node.name = "ENDSITE";
      } else {
        node.name = tokens[1];
        node.type = tokens[0].toUpperCase();
      }
      if (nextLine(lines2) !== "{") {
        console.error("THREE.BVHLoader: Expected opening { after type & name");
      }
      tokens = nextLine(lines2).split(/[\s]+/);
      if (tokens[0] !== "OFFSET") {
        console.error("THREE.BVHLoader: Expected OFFSET but got: " + tokens[0]);
      }
      if (tokens.length !== 4) {
        console.error("THREE.BVHLoader: Invalid number of values for OFFSET.");
      }
      const offset = new Vector3(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
      if (isNaN(offset.x) || isNaN(offset.y) || isNaN(offset.z)) {
        console.error("THREE.BVHLoader: Invalid values of OFFSET.");
      }
      node.offset = offset;
      if (node.type !== "ENDSITE") {
        tokens = nextLine(lines2).split(/[\s]+/);
        if (tokens[0] !== "CHANNELS") {
          console.error("THREE.BVHLoader: Expected CHANNELS definition.");
        }
        const numChannels = parseInt(tokens[1]);
        node.channels = tokens.splice(2, numChannels);
        node.children = [];
      }
      while (true) {
        const line = nextLine(lines2);
        if (line === "}") {
          return node;
        } else {
          node.children.push(readNode(lines2, line, list));
        }
      }
    }
    function toTHREEBone(source, list) {
      const bone = new Bone();
      list.push(bone);
      bone.position.add(source.offset);
      bone.name = source.name;
      if (source.type !== "ENDSITE") {
        for (let i = 0; i < source.children.length; i++) {
          bone.add(toTHREEBone(source.children[i], list));
        }
      }
      return bone;
    }
    function toTHREEAnimation(bones2) {
      const tracks = [];
      for (let i = 0; i < bones2.length; i++) {
        const bone = bones2[i];
        if (bone.type === "ENDSITE")
          continue;
        const times = [];
        const positions = [];
        const rotations = [];
        for (let j = 0; j < bone.frames.length; j++) {
          const frame = bone.frames[j];
          times.push(frame.time);
          positions.push(frame.position.x + bone.offset.x);
          positions.push(frame.position.y + bone.offset.y);
          positions.push(frame.position.z + bone.offset.z);
          rotations.push(frame.rotation.x);
          rotations.push(frame.rotation.y);
          rotations.push(frame.rotation.z);
          rotations.push(frame.rotation.w);
        }
        if (scope.animateBonePositions) {
          tracks.push(new VectorKeyframeTrack(".bones[" + bone.name + "].position", times, positions));
        }
        if (scope.animateBoneRotations) {
          tracks.push(new QuaternionKeyframeTrack(".bones[" + bone.name + "].quaternion", times, rotations));
        }
      }
      return new AnimationClip("animation", -1, tracks);
    }
    function nextLine(lines2) {
      let line;
      while ((line = lines2.shift().trim()).length === 0) {
      }
      return line;
    }
    const scope = this;
    const lines = text.split(/[\r\n]+/g);
    const bones = readBvh(lines);
    const threeBones = [];
    toTHREEBone(bones[0], threeBones);
    const threeClip = toTHREEAnimation(bones);
    return {
      skeleton: new Skeleton(threeBones),
      clip: threeClip
    };
  }
}
export {
  BVHLoader
};
//# sourceMappingURL=BVHLoader.js.map
