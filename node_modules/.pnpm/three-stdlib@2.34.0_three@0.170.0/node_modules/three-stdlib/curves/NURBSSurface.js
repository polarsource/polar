import { Vector4 } from "three";
import { calcSurfacePoint } from "./NURBSUtils.js";
class NURBSSurface {
  constructor(degree1, degree2, knots1, knots2, controlPoints) {
    this.degree1 = degree1;
    this.degree2 = degree2;
    this.knots1 = knots1;
    this.knots2 = knots2;
    this.controlPoints = [];
    const len1 = knots1.length - degree1 - 1;
    const len2 = knots2.length - degree2 - 1;
    for (let i = 0; i < len1; ++i) {
      this.controlPoints[i] = [];
      for (let j = 0; j < len2; ++j) {
        const point = controlPoints[i][j];
        this.controlPoints[i][j] = new Vector4(point.x, point.y, point.z, point.w);
      }
    }
  }
  getPoint(t1, t2, target) {
    const u = this.knots1[0] + t1 * (this.knots1[this.knots1.length - 1] - this.knots1[0]);
    const v = this.knots2[0] + t2 * (this.knots2[this.knots2.length - 1] - this.knots2[0]);
    calcSurfacePoint(this.degree1, this.degree2, this.knots1, this.knots2, this.controlPoints, u, v, target);
  }
}
export {
  NURBSSurface
};
//# sourceMappingURL=NURBSSurface.js.map
