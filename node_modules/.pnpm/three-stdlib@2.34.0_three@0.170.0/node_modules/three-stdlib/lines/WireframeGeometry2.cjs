"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const LineSegmentsGeometry = require("./LineSegmentsGeometry.cjs");
class WireframeGeometry2 extends LineSegmentsGeometry.LineSegmentsGeometry {
  constructor(geometry) {
    super();
    this.isWireframeGeometry2 = true;
    this.type = "WireframeGeometry2";
    this.fromWireframeGeometry(new THREE.WireframeGeometry(geometry));
  }
}
exports.WireframeGeometry2 = WireframeGeometry2;
//# sourceMappingURL=WireframeGeometry2.cjs.map
