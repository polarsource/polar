"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
function UVsDebug(geometry, size = 1024) {
  const abc = "abc";
  const a = new THREE.Vector2();
  const b = new THREE.Vector2();
  const uvs = [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()];
  const face = [];
  const canvas = document.createElement("canvas");
  const width = size;
  const height = size;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgb( 63, 63, 63 )";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgb( 255, 255, 255 )";
  ctx.fillRect(0, 0, width, height);
  const index = geometry.index;
  const uvAttribute = geometry.attributes.uv;
  if (index) {
    for (let i = 0, il = index.count; i < il; i += 3) {
      face[0] = index.getX(i);
      face[1] = index.getX(i + 1);
      face[2] = index.getX(i + 2);
      uvs[0].fromBufferAttribute(uvAttribute, face[0]);
      uvs[1].fromBufferAttribute(uvAttribute, face[1]);
      uvs[2].fromBufferAttribute(uvAttribute, face[2]);
      processFace(face, uvs, i / 3);
    }
  } else {
    for (let i = 0, il = uvAttribute.count; i < il; i += 3) {
      face[0] = i;
      face[1] = i + 1;
      face[2] = i + 2;
      uvs[0].fromBufferAttribute(uvAttribute, face[0]);
      uvs[1].fromBufferAttribute(uvAttribute, face[1]);
      uvs[2].fromBufferAttribute(uvAttribute, face[2]);
      processFace(face, uvs, i / 3);
    }
  }
  return canvas;
  function processFace(face2, uvs2, index2) {
    ctx.beginPath();
    a.set(0, 0);
    for (let j = 0, jl = uvs2.length; j < jl; j++) {
      const uv = uvs2[j];
      a.x += uv.x;
      a.y += uv.y;
      if (j === 0) {
        ctx.moveTo(uv.x * (width - 2) + 0.5, (1 - uv.y) * (height - 2) + 0.5);
      } else {
        ctx.lineTo(uv.x * (width - 2) + 0.5, (1 - uv.y) * (height - 2) + 0.5);
      }
    }
    ctx.closePath();
    ctx.stroke();
    a.divideScalar(uvs2.length);
    ctx.font = "18px Arial";
    ctx.fillStyle = "rgb( 63, 63, 63 )";
    ctx.fillText(index2, a.x * width, (1 - a.y) * height);
    if (a.x > 0.95) {
      ctx.fillText(index2, a.x % 1 * width, (1 - a.y) * height);
    }
    ctx.font = "12px Arial";
    ctx.fillStyle = "rgb( 191, 191, 191 )";
    for (let j = 0, jl = uvs2.length; j < jl; j++) {
      const uv = uvs2[j];
      b.addVectors(a, uv).divideScalar(2);
      const vnum = face2[j];
      ctx.fillText(abc[j] + vnum, b.x * width, (1 - b.y) * height);
      if (b.x > 0.95) {
        ctx.fillText(abc[j] + vnum, b.x % 1 * width, (1 - b.y) * height);
      }
    }
  }
}
exports.UVsDebug = UVsDebug;
//# sourceMappingURL=UVsDebug.cjs.map
