import { LineSegmentsGeometry } from "./LineSegmentsGeometry.js";
class LineGeometry extends LineSegmentsGeometry {
  constructor() {
    super();
    this.isLineGeometry = true;
    this.type = "LineGeometry";
  }
  setPositions(array) {
    const length = array.length - 3;
    const points = new Float32Array(2 * length);
    for (let i = 0; i < length; i += 3) {
      points[2 * i] = array[i];
      points[2 * i + 1] = array[i + 1];
      points[2 * i + 2] = array[i + 2];
      points[2 * i + 3] = array[i + 3];
      points[2 * i + 4] = array[i + 4];
      points[2 * i + 5] = array[i + 5];
    }
    super.setPositions(points);
    return this;
  }
  setColors(array, itemSize = 3) {
    const length = array.length - itemSize;
    const colors = new Float32Array(2 * length);
    if (itemSize === 3) {
      for (let i = 0; i < length; i += itemSize) {
        colors[2 * i] = array[i];
        colors[2 * i + 1] = array[i + 1];
        colors[2 * i + 2] = array[i + 2];
        colors[2 * i + 3] = array[i + 3];
        colors[2 * i + 4] = array[i + 4];
        colors[2 * i + 5] = array[i + 5];
      }
    } else {
      for (let i = 0; i < length; i += itemSize) {
        colors[2 * i] = array[i];
        colors[2 * i + 1] = array[i + 1];
        colors[2 * i + 2] = array[i + 2];
        colors[2 * i + 3] = array[i + 3];
        colors[2 * i + 4] = array[i + 4];
        colors[2 * i + 5] = array[i + 5];
        colors[2 * i + 6] = array[i + 6];
        colors[2 * i + 7] = array[i + 7];
      }
    }
    super.setColors(colors, itemSize);
    return this;
  }
  fromLine(line) {
    const geometry = line.geometry;
    this.setPositions(geometry.attributes.position.array);
    return this;
  }
}
export {
  LineGeometry
};
//# sourceMappingURL=LineGeometry.js.map
