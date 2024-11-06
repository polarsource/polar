"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class AnimationClipCreator {
  static CreateRotationAnimation(period, axis = "x") {
    const times = [0, period], values = [0, 360];
    const trackName = ".rotation[" + axis + "]";
    const track = new THREE.NumberKeyframeTrack(trackName, times, values);
    return new THREE.AnimationClip(null, period, [track]);
  }
  static CreateScaleAxisAnimation(period, axis = "x") {
    const times = [0, period], values = [0, 1];
    const trackName = ".scale[" + axis + "]";
    const track = new THREE.NumberKeyframeTrack(trackName, times, values);
    return new THREE.AnimationClip(null, period, [track]);
  }
  static CreateShakeAnimation(duration, shakeScale) {
    const times = [], values = [], tmp = new THREE.Vector3();
    for (let i = 0; i < duration * 10; i++) {
      times.push(i / 10);
      tmp.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).multiply(shakeScale).toArray(values, values.length);
    }
    const trackName = ".position";
    const track = new THREE.VectorKeyframeTrack(trackName, times, values);
    return new THREE.AnimationClip(null, duration, [track]);
  }
  static CreatePulsationAnimation(duration, pulseScale) {
    const times = [], values = [], tmp = new THREE.Vector3();
    for (let i = 0; i < duration * 10; i++) {
      times.push(i / 10);
      const scaleFactor = Math.random() * pulseScale;
      tmp.set(scaleFactor, scaleFactor, scaleFactor).toArray(values, values.length);
    }
    const trackName = ".scale";
    const track = new THREE.VectorKeyframeTrack(trackName, times, values);
    return new THREE.AnimationClip(null, duration, [track]);
  }
  static CreateVisibilityAnimation(duration) {
    const times = [0, duration / 2, duration], values = [true, false, true];
    const trackName = ".visible";
    const track = new THREE.BooleanKeyframeTrack(trackName, times, values);
    return new THREE.AnimationClip(null, duration, [track]);
  }
  static CreateMaterialColorAnimation(duration, colors) {
    const times = [], values = [], timeStep = duration / colors.length;
    for (let i = 0; i < colors.length; i++) {
      times.push(i * timeStep);
      const color = colors[i];
      values.push(color.r, color.g, color.b);
    }
    const trackName = ".material.color";
    const track = new THREE.ColorKeyframeTrack(trackName, times, values);
    return new THREE.AnimationClip(null, duration, [track]);
  }
}
exports.AnimationClipCreator = AnimationClipCreator;
//# sourceMappingURL=AnimationClipCreator.cjs.map
