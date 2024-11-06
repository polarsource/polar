"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const LineSegments2 = require("./LineSegments2.cjs");
const LineGeometry = require("./LineGeometry.cjs");
const LineMaterial = require("./LineMaterial.cjs");
class Line2 extends LineSegments2.LineSegments2 {
  constructor(geometry = new LineGeometry.LineGeometry(), material = new LineMaterial.LineMaterial({ color: Math.random() * 16777215 })) {
    super(geometry, material);
    this.isLine2 = true;
    this.type = "Line2";
  }
}
exports.Line2 = Line2;
//# sourceMappingURL=Line2.cjs.map
