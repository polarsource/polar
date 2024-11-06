"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const NURBSUtils = require("./NURBSUtils.cjs");
class NURBSCurve extends THREE.Curve {
  constructor(degree, knots, controlPoints, startKnot, endKnot) {
    super();
    this.degree = degree;
    this.knots = knots;
    this.controlPoints = [];
    this.startKnot = startKnot || 0;
    this.endKnot = endKnot || this.knots.length - 1;
    for (let i = 0; i < controlPoints.length; ++i) {
      const point = controlPoints[i];
      this.controlPoints[i] = new THREE.Vector4(point.x, point.y, point.z, point.w);
    }
  }
  getPoint(t, optionalTarget) {
    const point = optionalTarget || new THREE.Vector3();
    const u = this.knots[this.startKnot] + t * (this.knots[this.endKnot] - this.knots[this.startKnot]);
    const hpoint = NURBSUtils.calcBSplinePoint(this.degree, this.knots, this.controlPoints, u);
    if (hpoint.w != 1) {
      hpoint.divideScalar(hpoint.w);
    }
    return point.set(hpoint.x, hpoint.y, hpoint.z);
  }
  getTangent(t, optionalTarget) {
    const tangent = optionalTarget || new THREE.Vector3();
    const u = this.knots[0] + t * (this.knots[this.knots.length - 1] - this.knots[0]);
    const ders = NURBSUtils.calcNURBSDerivatives(this.degree, this.knots, this.controlPoints, u, 1);
    tangent.copy(ders[1]).normalize();
    return tangent;
  }
}
exports.NURBSCurve = NURBSCurve;
//# sourceMappingURL=NURBSCurve.cjs.map
