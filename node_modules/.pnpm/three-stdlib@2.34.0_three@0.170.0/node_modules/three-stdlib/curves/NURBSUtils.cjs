"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
function findSpan(p, u, U) {
  const n = U.length - p - 1;
  if (u >= U[n]) {
    return n - 1;
  }
  if (u <= U[p]) {
    return p;
  }
  let low = p;
  let high = n;
  let mid = Math.floor((low + high) / 2);
  while (u < U[mid] || u >= U[mid + 1]) {
    if (u < U[mid]) {
      high = mid;
    } else {
      low = mid;
    }
    mid = Math.floor((low + high) / 2);
  }
  return mid;
}
function calcBasisFunctions(span, u, p, U) {
  const N = [];
  const left = [];
  const right = [];
  N[0] = 1;
  for (let j = 1; j <= p; ++j) {
    left[j] = u - U[span + 1 - j];
    right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; ++r) {
      const rv = right[r + 1];
      const lv = left[j - r];
      const temp = N[r] / (rv + lv);
      N[r] = saved + rv * temp;
      saved = lv * temp;
    }
    N[j] = saved;
  }
  return N;
}
function calcBSplinePoint(p, U, P, u) {
  const span = findSpan(p, u, U);
  const N = calcBasisFunctions(span, u, p, U);
  const C = new THREE.Vector4(0, 0, 0, 0);
  for (let j = 0; j <= p; ++j) {
    const point = P[span - p + j];
    const Nj = N[j];
    const wNj = point.w * Nj;
    C.x += point.x * wNj;
    C.y += point.y * wNj;
    C.z += point.z * wNj;
    C.w += point.w * Nj;
  }
  return C;
}
function calcBasisFunctionDerivatives(span, u, p, n, U) {
  const zeroArr = [];
  for (let i = 0; i <= p; ++i)
    zeroArr[i] = 0;
  const ders = [];
  for (let i = 0; i <= n; ++i)
    ders[i] = zeroArr.slice(0);
  const ndu = [];
  for (let i = 0; i <= p; ++i)
    ndu[i] = zeroArr.slice(0);
  ndu[0][0] = 1;
  const left = zeroArr.slice(0);
  const right = zeroArr.slice(0);
  for (let j = 1; j <= p; ++j) {
    left[j] = u - U[span + 1 - j];
    right[j] = U[span + j] - u;
    let saved = 0;
    for (let r2 = 0; r2 < j; ++r2) {
      const rv = right[r2 + 1];
      const lv = left[j - r2];
      ndu[j][r2] = rv + lv;
      const temp = ndu[r2][j - 1] / ndu[j][r2];
      ndu[r2][j] = saved + rv * temp;
      saved = lv * temp;
    }
    ndu[j][j] = saved;
  }
  for (let j = 0; j <= p; ++j) {
    ders[0][j] = ndu[j][p];
  }
  for (let r2 = 0; r2 <= p; ++r2) {
    let s1 = 0;
    let s2 = 1;
    const a = [];
    for (let i = 0; i <= p; ++i) {
      a[i] = zeroArr.slice(0);
    }
    a[0][0] = 1;
    for (let k = 1; k <= n; ++k) {
      let d = 0;
      const rk = r2 - k;
      const pk = p - k;
      if (r2 >= k) {
        a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
        d = a[s2][0] * ndu[rk][pk];
      }
      const j1 = rk >= -1 ? 1 : -rk;
      const j2 = r2 - 1 <= pk ? k - 1 : p - r2;
      for (let j3 = j1; j3 <= j2; ++j3) {
        a[s2][j3] = (a[s1][j3] - a[s1][j3 - 1]) / ndu[pk + 1][rk + j3];
        d += a[s2][j3] * ndu[rk + j3][pk];
      }
      if (r2 <= pk) {
        a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r2];
        d += a[s2][k] * ndu[r2][pk];
      }
      ders[k][r2] = d;
      const j = s1;
      s1 = s2;
      s2 = j;
    }
  }
  let r = p;
  for (let k = 1; k <= n; ++k) {
    for (let j = 0; j <= p; ++j) {
      ders[k][j] *= r;
    }
    r *= p - k;
  }
  return ders;
}
function calcBSplineDerivatives(p, U, P, u, nd) {
  const du = nd < p ? nd : p;
  const CK = [];
  const span = findSpan(p, u, U);
  const nders = calcBasisFunctionDerivatives(span, u, p, du, U);
  const Pw = [];
  for (let i = 0; i < P.length; ++i) {
    const point = P[i].clone();
    const w = point.w;
    point.x *= w;
    point.y *= w;
    point.z *= w;
    Pw[i] = point;
  }
  for (let k = 0; k <= du; ++k) {
    const point = Pw[span - p].clone().multiplyScalar(nders[k][0]);
    for (let j = 1; j <= p; ++j) {
      point.add(Pw[span - p + j].clone().multiplyScalar(nders[k][j]));
    }
    CK[k] = point;
  }
  for (let k = du + 1; k <= nd + 1; ++k) {
    CK[k] = new THREE.Vector4(0, 0, 0);
  }
  return CK;
}
function calcKoverI(k, i) {
  let nom = 1;
  for (let j = 2; j <= k; ++j) {
    nom *= j;
  }
  let denom = 1;
  for (let j = 2; j <= i; ++j) {
    denom *= j;
  }
  for (let j = 2; j <= k - i; ++j) {
    denom *= j;
  }
  return nom / denom;
}
function calcRationalCurveDerivatives(Pders) {
  const nd = Pders.length;
  const Aders = [];
  const wders = [];
  for (let i = 0; i < nd; ++i) {
    const point = Pders[i];
    Aders[i] = new THREE.Vector3(point.x, point.y, point.z);
    wders[i] = point.w;
  }
  const CK = [];
  for (let k = 0; k < nd; ++k) {
    const v = Aders[k].clone();
    for (let i = 1; i <= k; ++i) {
      v.sub(CK[k - i].clone().multiplyScalar(calcKoverI(k, i) * wders[i]));
    }
    CK[k] = v.divideScalar(wders[0]);
  }
  return CK;
}
function calcNURBSDerivatives(p, U, P, u, nd) {
  const Pders = calcBSplineDerivatives(p, U, P, u, nd);
  return calcRationalCurveDerivatives(Pders);
}
function calcSurfacePoint(p, q, U, V, P, u, v, target) {
  const uspan = findSpan(p, u, U);
  const vspan = findSpan(q, v, V);
  const Nu = calcBasisFunctions(uspan, u, p, U);
  const Nv = calcBasisFunctions(vspan, v, q, V);
  const temp = [];
  for (let l = 0; l <= q; ++l) {
    temp[l] = new THREE.Vector4(0, 0, 0, 0);
    for (let k = 0; k <= p; ++k) {
      const point = P[uspan - p + k][vspan - q + l].clone();
      const w = point.w;
      point.x *= w;
      point.y *= w;
      point.z *= w;
      temp[l].add(point.multiplyScalar(Nu[k]));
    }
  }
  const Sw = new THREE.Vector4(0, 0, 0, 0);
  for (let l = 0; l <= q; ++l) {
    Sw.add(temp[l].multiplyScalar(Nv[l]));
  }
  Sw.divideScalar(Sw.w);
  target.set(Sw.x, Sw.y, Sw.z);
}
exports.calcBSplineDerivatives = calcBSplineDerivatives;
exports.calcBSplinePoint = calcBSplinePoint;
exports.calcBasisFunctionDerivatives = calcBasisFunctionDerivatives;
exports.calcBasisFunctions = calcBasisFunctions;
exports.calcKoverI = calcKoverI;
exports.calcNURBSDerivatives = calcNURBSDerivatives;
exports.calcRationalCurveDerivatives = calcRationalCurveDerivatives;
exports.calcSurfacePoint = calcSurfacePoint;
exports.findSpan = findSpan;
//# sourceMappingURL=NURBSUtils.cjs.map
