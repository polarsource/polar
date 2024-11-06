import { WireframeGeometry } from "three";
import { LineSegmentsGeometry } from "./LineSegmentsGeometry.js";
class WireframeGeometry2 extends LineSegmentsGeometry {
  constructor(geometry) {
    super();
    this.isWireframeGeometry2 = true;
    this.type = "WireframeGeometry2";
    this.fromWireframeGeometry(new WireframeGeometry(geometry));
  }
}
export {
  WireframeGeometry2
};
//# sourceMappingURL=WireframeGeometry2.js.map
