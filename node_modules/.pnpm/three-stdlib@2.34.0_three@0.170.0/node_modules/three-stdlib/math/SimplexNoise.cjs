"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
class SimplexNoise {
  /**
   * You can pass in a random number generator object if you like.
   * It is assumed to have a random() method.
   */
  constructor(r = Math) {
    __publicField(this, "grad3", [
      [1, 1, 0],
      [-1, 1, 0],
      [1, -1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [-1, 0, 1],
      [1, 0, -1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, -1, 1],
      [0, 1, -1],
      [0, -1, -1]
    ]);
    __publicField(this, "grad4", [
      [0, 1, 1, 1],
      [0, 1, 1, -1],
      [0, 1, -1, 1],
      [0, 1, -1, -1],
      [0, -1, 1, 1],
      [0, -1, 1, -1],
      [0, -1, -1, 1],
      [0, -1, -1, -1],
      [1, 0, 1, 1],
      [1, 0, 1, -1],
      [1, 0, -1, 1],
      [1, 0, -1, -1],
      [-1, 0, 1, 1],
      [-1, 0, 1, -1],
      [-1, 0, -1, 1],
      [-1, 0, -1, -1],
      [1, 1, 0, 1],
      [1, 1, 0, -1],
      [1, -1, 0, 1],
      [1, -1, 0, -1],
      [-1, 1, 0, 1],
      [-1, 1, 0, -1],
      [-1, -1, 0, 1],
      [-1, -1, 0, -1],
      [1, 1, 1, 0],
      [1, 1, -1, 0],
      [1, -1, 1, 0],
      [1, -1, -1, 0],
      [-1, 1, 1, 0],
      [-1, 1, -1, 0],
      [-1, -1, 1, 0],
      [-1, -1, -1, 0]
    ]);
    __publicField(this, "p", []);
    // To remove the need for index wrapping, double the permutation table length
    __publicField(this, "perm", []);
    // A lookup table to traverse the simplex around a given point in 4D.
    // Details can be found where this table is used, in the 4D noise method.
    __publicField(this, "simplex", [
      [0, 1, 2, 3],
      [0, 1, 3, 2],
      [0, 0, 0, 0],
      [0, 2, 3, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 3, 0],
      [0, 2, 1, 3],
      [0, 0, 0, 0],
      [0, 3, 1, 2],
      [0, 3, 2, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 3, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 2, 0, 3],
      [0, 0, 0, 0],
      [1, 3, 0, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 3, 0, 1],
      [2, 3, 1, 0],
      [1, 0, 2, 3],
      [1, 0, 3, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 3, 1],
      [0, 0, 0, 0],
      [2, 1, 3, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [2, 0, 1, 3],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [3, 0, 1, 2],
      [3, 0, 2, 1],
      [0, 0, 0, 0],
      [3, 1, 2, 0],
      [2, 1, 0, 3],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [3, 1, 0, 2],
      [0, 0, 0, 0],
      [3, 2, 0, 1],
      [3, 2, 1, 0]
    ]);
    __publicField(this, "dot", (g, x, y) => {
      return g[0] * x + g[1] * y;
    });
    __publicField(this, "dot3", (g, x, y, z) => {
      return g[0] * x + g[1] * y + g[2] * z;
    });
    __publicField(this, "dot4", (g, x, y, z, w) => {
      return g[0] * x + g[1] * y + g[2] * z + g[3] * w;
    });
    __publicField(this, "noise", (xin, yin) => {
      let n0;
      let n1;
      let n2;
      const F2 = 0.5 * (Math.sqrt(3) - 1);
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s);
      const j = Math.floor(yin + s);
      const G2 = (3 - Math.sqrt(3)) / 6;
      const t = (i + j) * G2;
      const X0 = i - t;
      const Y0 = j - t;
      const x0 = xin - X0;
      const y0 = yin - Y0;
      let i1 = 0;
      let j1 = 1;
      if (x0 > y0) {
        i1 = 1;
        j1 = 0;
      }
      const x1 = x0 - i1 + G2;
      const y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2;
      const y2 = y0 - 1 + 2 * G2;
      const ii = i & 255;
      const jj = j & 255;
      const gi0 = this.perm[ii + this.perm[jj]] % 12;
      const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
      const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 < 0) {
        n0 = 0;
      } else {
        t0 *= t0;
        n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0);
      }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 < 0) {
        n1 = 0;
      } else {
        t1 *= t1;
        n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
      }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 < 0) {
        n2 = 0;
      } else {
        t2 *= t2;
        n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
      }
      return 70 * (n0 + n1 + n2);
    });
    // 3D simplex noise
    __publicField(this, "noise3d", (xin, yin, zin) => {
      let n0;
      let n1;
      let n2;
      let n3;
      const F3 = 1 / 3;
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s);
      const j = Math.floor(yin + s);
      const k = Math.floor(zin + s);
      const G3 = 1 / 6;
      const t = (i + j + k) * G3;
      const X0 = i - t;
      const Y0 = j - t;
      const Z0 = k - t;
      const x0 = xin - X0;
      const y0 = yin - Y0;
      const z0 = zin - Z0;
      let i1;
      let j1;
      let k1;
      let i2;
      let j2;
      let k2;
      if (x0 >= y0) {
        if (y0 >= z0) {
          i1 = 1;
          j1 = 0;
          k1 = 0;
          i2 = 1;
          j2 = 1;
          k2 = 0;
        } else if (x0 >= z0) {
          i1 = 1;
          j1 = 0;
          k1 = 0;
          i2 = 1;
          j2 = 0;
          k2 = 1;
        } else {
          i1 = 0;
          j1 = 0;
          k1 = 1;
          i2 = 1;
          j2 = 0;
          k2 = 1;
        }
      } else {
        if (y0 < z0) {
          i1 = 0;
          j1 = 0;
          k1 = 1;
          i2 = 0;
          j2 = 1;
          k2 = 1;
        } else if (x0 < z0) {
          i1 = 0;
          j1 = 1;
          k1 = 0;
          i2 = 0;
          j2 = 1;
          k2 = 1;
        } else {
          i1 = 0;
          j1 = 1;
          k1 = 0;
          i2 = 1;
          j2 = 1;
          k2 = 0;
        }
      }
      const x1 = x0 - i1 + G3;
      const y1 = y0 - j1 + G3;
      const z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3;
      const y2 = y0 - j2 + 2 * G3;
      const z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3;
      const y3 = y0 - 1 + 3 * G3;
      const z3 = z0 - 1 + 3 * G3;
      const ii = i & 255;
      const jj = j & 255;
      const kk = k & 255;
      const gi0 = this.perm[ii + this.perm[jj + this.perm[kk]]] % 12;
      const gi1 = this.perm[ii + i1 + this.perm[jj + j1 + this.perm[kk + k1]]] % 12;
      const gi2 = this.perm[ii + i2 + this.perm[jj + j2 + this.perm[kk + k2]]] % 12;
      const gi3 = this.perm[ii + 1 + this.perm[jj + 1 + this.perm[kk + 1]]] % 12;
      let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (t0 < 0) {
        n0 = 0;
      } else {
        t0 *= t0;
        n0 = t0 * t0 * this.dot3(this.grad3[gi0], x0, y0, z0);
      }
      let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (t1 < 0) {
        n1 = 0;
      } else {
        t1 *= t1;
        n1 = t1 * t1 * this.dot3(this.grad3[gi1], x1, y1, z1);
      }
      let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (t2 < 0) {
        n2 = 0;
      } else {
        t2 *= t2;
        n2 = t2 * t2 * this.dot3(this.grad3[gi2], x2, y2, z2);
      }
      let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (t3 < 0) {
        n3 = 0;
      } else {
        t3 *= t3;
        n3 = t3 * t3 * this.dot3(this.grad3[gi3], x3, y3, z3);
      }
      return 32 * (n0 + n1 + n2 + n3);
    });
    // 4D simplex noise
    __publicField(this, "noise4d", (x, y, z, w) => {
      const grad4 = this.grad4;
      const simplex = this.simplex;
      const perm = this.perm;
      const F4 = (Math.sqrt(5) - 1) / 4;
      const G4 = (5 - Math.sqrt(5)) / 20;
      let n0;
      let n1;
      let n2;
      let n3;
      let n4;
      const s = (x + y + z + w) * F4;
      const i = Math.floor(x + s);
      const j = Math.floor(y + s);
      const k = Math.floor(z + s);
      const l = Math.floor(w + s);
      const t = (i + j + k + l) * G4;
      const X0 = i - t;
      const Y0 = j - t;
      const Z0 = k - t;
      const W0 = l - t;
      const x0 = x - X0;
      const y0 = y - Y0;
      const z0 = z - Z0;
      const w0 = w - W0;
      const c1 = x0 > y0 ? 32 : 0;
      const c2 = x0 > z0 ? 16 : 0;
      const c3 = y0 > z0 ? 8 : 0;
      const c4 = x0 > w0 ? 4 : 0;
      const c5 = y0 > w0 ? 2 : 0;
      const c6 = z0 > w0 ? 1 : 0;
      const c = c1 + c2 + c3 + c4 + c5 + c6;
      let i1;
      let j1;
      let k1;
      let l1;
      let i2;
      let j2;
      let k2;
      let l2;
      let i3;
      let j3;
      let k3;
      let l3;
      i1 = simplex[c][0] >= 3 ? 1 : 0;
      j1 = simplex[c][1] >= 3 ? 1 : 0;
      k1 = simplex[c][2] >= 3 ? 1 : 0;
      l1 = simplex[c][3] >= 3 ? 1 : 0;
      i2 = simplex[c][0] >= 2 ? 1 : 0;
      j2 = simplex[c][1] >= 2 ? 1 : 0;
      k2 = simplex[c][2] >= 2 ? 1 : 0;
      l2 = simplex[c][3] >= 2 ? 1 : 0;
      i3 = simplex[c][0] >= 1 ? 1 : 0;
      j3 = simplex[c][1] >= 1 ? 1 : 0;
      k3 = simplex[c][2] >= 1 ? 1 : 0;
      l3 = simplex[c][3] >= 1 ? 1 : 0;
      const x1 = x0 - i1 + G4;
      const y1 = y0 - j1 + G4;
      const z1 = z0 - k1 + G4;
      const w1 = w0 - l1 + G4;
      const x2 = x0 - i2 + 2 * G4;
      const y2 = y0 - j2 + 2 * G4;
      const z2 = z0 - k2 + 2 * G4;
      const w2 = w0 - l2 + 2 * G4;
      const x3 = x0 - i3 + 3 * G4;
      const y3 = y0 - j3 + 3 * G4;
      const z3 = z0 - k3 + 3 * G4;
      const w3 = w0 - l3 + 3 * G4;
      const x4 = x0 - 1 + 4 * G4;
      const y4 = y0 - 1 + 4 * G4;
      const z4 = z0 - 1 + 4 * G4;
      const w4 = w0 - 1 + 4 * G4;
      const ii = i & 255;
      const jj = j & 255;
      const kk = k & 255;
      const ll = l & 255;
      const gi0 = perm[ii + perm[jj + perm[kk + perm[ll]]]] % 32;
      const gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1 + perm[ll + l1]]]] % 32;
      const gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2 + perm[ll + l2]]]] % 32;
      const gi3 = perm[ii + i3 + perm[jj + j3 + perm[kk + k3 + perm[ll + l3]]]] % 32;
      const gi4 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll + 1]]]] % 32;
      let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
      if (t0 < 0) {
        n0 = 0;
      } else {
        t0 *= t0;
        n0 = t0 * t0 * this.dot4(grad4[gi0], x0, y0, z0, w0);
      }
      let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
      if (t1 < 0) {
        n1 = 0;
      } else {
        t1 *= t1;
        n1 = t1 * t1 * this.dot4(grad4[gi1], x1, y1, z1, w1);
      }
      let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
      if (t2 < 0) {
        n2 = 0;
      } else {
        t2 *= t2;
        n2 = t2 * t2 * this.dot4(grad4[gi2], x2, y2, z2, w2);
      }
      let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
      if (t3 < 0) {
        n3 = 0;
      } else {
        t3 *= t3;
        n3 = t3 * t3 * this.dot4(grad4[gi3], x3, y3, z3, w3);
      }
      let t4 = 0.6 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
      if (t4 < 0) {
        n4 = 0;
      } else {
        t4 *= t4;
        n4 = t4 * t4 * this.dot4(grad4[gi4], x4, y4, z4, w4);
      }
      return 27 * (n0 + n1 + n2 + n3 + n4);
    });
    for (let i = 0; i < 256; i++) {
      this.p[i] = Math.floor(r.random() * 256);
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
  }
}
exports.SimplexNoise = SimplexNoise;
//# sourceMappingURL=SimplexNoise.cjs.map
