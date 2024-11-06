import { Reflector } from "./Reflector.js";
class ReflectorRTT extends Reflector {
  constructor(geometry, options) {
    super(geometry, options);
    this.geometry.setDrawRange(0, 0);
  }
}
export {
  ReflectorRTT
};
//# sourceMappingURL=ReflectorRTT.js.map
