"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const Reflector = require("./Reflector.cjs");
class ReflectorRTT extends Reflector.Reflector {
  constructor(geometry, options) {
    super(geometry, options);
    this.geometry.setDrawRange(0, 0);
  }
}
exports.ReflectorRTT = ReflectorRTT;
//# sourceMappingURL=ReflectorRTT.cjs.map
