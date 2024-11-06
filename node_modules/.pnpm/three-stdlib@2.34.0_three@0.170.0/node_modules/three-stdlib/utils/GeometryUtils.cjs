"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const hilbert2D = (center = new THREE.Vector3(0, 0, 0), size = 10, iterations = 1, v0 = 0, v1 = 1, v2 = 2, v3 = 3) => {
  const half = size / 2;
  const vec_s = [
    new THREE.Vector3(center.x - half, center.y, center.z - half),
    new THREE.Vector3(center.x - half, center.y, center.z + half),
    new THREE.Vector3(center.x + half, center.y, center.z + half),
    new THREE.Vector3(center.x + half, center.y, center.z - half)
  ];
  const vec = [vec_s[v0], vec_s[v1], vec_s[v2], vec_s[v3]];
  if (0 <= --iterations) {
    const tmp = [];
    Array.prototype.push.apply(tmp, hilbert2D(vec[0], half, iterations, v0, v3, v2, v1));
    Array.prototype.push.apply(tmp, hilbert2D(vec[1], half, iterations, v0, v1, v2, v3));
    Array.prototype.push.apply(tmp, hilbert2D(vec[2], half, iterations, v0, v1, v2, v3));
    Array.prototype.push.apply(tmp, hilbert2D(vec[3], half, iterations, v2, v1, v0, v3));
    return tmp;
  }
  return vec;
};
const hilbert3D = (center = new THREE.Vector3(0, 0, 0), size = 10, iterations = 1, v0 = 0, v1 = 1, v2 = 2, v3 = 3, v4 = 4, v5 = 5, v6 = 6, v7 = 7) => {
  const half = size / 2;
  const vec_s = [
    new THREE.Vector3(center.x - half, center.y + half, center.z - half),
    new THREE.Vector3(center.x - half, center.y + half, center.z + half),
    new THREE.Vector3(center.x - half, center.y - half, center.z + half),
    new THREE.Vector3(center.x - half, center.y - half, center.z - half),
    new THREE.Vector3(center.x + half, center.y - half, center.z - half),
    new THREE.Vector3(center.x + half, center.y - half, center.z + half),
    new THREE.Vector3(center.x + half, center.y + half, center.z + half),
    new THREE.Vector3(center.x + half, center.y + half, center.z - half)
  ];
  const vec = [vec_s[v0], vec_s[v1], vec_s[v2], vec_s[v3], vec_s[v4], vec_s[v5], vec_s[v6], vec_s[v7]];
  if (--iterations >= 0) {
    const tmp = [];
    Array.prototype.push.apply(tmp, hilbert3D(vec[0], half, iterations, v0, v3, v4, v7, v6, v5, v2, v1));
    Array.prototype.push.apply(tmp, hilbert3D(vec[1], half, iterations, v0, v7, v6, v1, v2, v5, v4, v3));
    Array.prototype.push.apply(tmp, hilbert3D(vec[2], half, iterations, v0, v7, v6, v1, v2, v5, v4, v3));
    Array.prototype.push.apply(tmp, hilbert3D(vec[3], half, iterations, v2, v3, v0, v1, v6, v7, v4, v5));
    Array.prototype.push.apply(tmp, hilbert3D(vec[4], half, iterations, v2, v3, v0, v1, v6, v7, v4, v5));
    Array.prototype.push.apply(tmp, hilbert3D(vec[5], half, iterations, v4, v3, v2, v5, v6, v1, v0, v7));
    Array.prototype.push.apply(tmp, hilbert3D(vec[6], half, iterations, v4, v3, v2, v5, v6, v1, v0, v7));
    Array.prototype.push.apply(tmp, hilbert3D(vec[7], half, iterations, v6, v5, v2, v1, v0, v3, v4, v7));
    return tmp;
  }
  return vec;
};
const gosper = (size = 1) => {
  function fractalize(config) {
    let output = "";
    let input = config.axiom;
    for (let i = 0, il = config.steps; 0 <= il ? i < il : i > il; 0 <= il ? i++ : i--) {
      output = "";
      for (let j = 0, jl = input.length; j < jl; j++) {
        const char = input[j];
        if (char in config.rules) {
          output += config.rules[char];
        } else {
          output += char;
        }
      }
      input = output;
    }
    return output;
  }
  function toPoints(config) {
    let currX = 0;
    let currY = 0;
    let angle = 0;
    const path = [0, 0, 0];
    const fractal = config.fractal;
    for (let i = 0, l = fractal.length; i < l; i++) {
      const char = fractal[i];
      if (char === "+") {
        angle += config.angle;
      } else if (char === "-") {
        angle -= config.angle;
      } else if (char === "F") {
        currX += config.size * Math.cos(angle);
        currY += -config.size * Math.sin(angle);
        path.push(currX, currY, 0);
      }
    }
    return path;
  }
  const gosper2 = fractalize({
    axiom: "A",
    steps: 4,
    rules: {
      A: "A+BF++BF-FA--FAFA-BF+",
      B: "-FA+BFBF++BF+FA--FA-B"
    }
  });
  const points = toPoints({
    fractal: gosper2,
    size,
    angle: Math.PI / 3
    // 60 degrees
  });
  return points;
};
const GeometryUtils = {
  hilbert3D,
  gosper,
  hilbert2D
};
exports.GeometryUtils = GeometryUtils;
//# sourceMappingURL=GeometryUtils.cjs.map
