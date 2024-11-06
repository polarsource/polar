import { Texture, LinearFilter, ClampToEdgeWrapping, MeshBasicMaterial, DoubleSide, Mesh, PlaneGeometry } from "three";
class VolumeSlice {
  constructor(volume, index, axis) {
    const slice = this;
    this.volume = volume;
    index = index || 0;
    Object.defineProperty(this, "index", {
      get: function() {
        return index;
      },
      set: function(value) {
        index = value;
        slice.geometryNeedsUpdate = true;
        return index;
      }
    });
    this.axis = axis || "z";
    this.canvas = document.createElement("canvas");
    this.canvasBuffer = document.createElement("canvas");
    this.updateGeometry();
    const canvasMap = new Texture(this.canvas);
    canvasMap.minFilter = LinearFilter;
    canvasMap.wrapS = canvasMap.wrapT = ClampToEdgeWrapping;
    if ("colorSpace" in canvasMap)
      canvasMap.colorSpace = "srgb";
    else
      canvasMap.encoding = 3001;
    const material = new MeshBasicMaterial({ map: canvasMap, side: DoubleSide, transparent: true });
    this.mesh = new Mesh(this.geometry, material);
    this.mesh.matrixAutoUpdate = false;
    this.geometryNeedsUpdate = true;
    this.repaint();
  }
  /**
   * @member {Function} repaint Refresh the texture and the geometry if geometryNeedsUpdate is set to true
   * @memberof VolumeSlice
   */
  repaint() {
    if (this.geometryNeedsUpdate) {
      this.updateGeometry();
    }
    const iLength = this.iLength, jLength = this.jLength, sliceAccess = this.sliceAccess, volume = this.volume, canvas = this.canvasBuffer, ctx = this.ctxBuffer;
    const imgData = ctx.getImageData(0, 0, iLength, jLength);
    const data = imgData.data;
    const volumeData = volume.data;
    const upperThreshold = volume.upperThreshold;
    const lowerThreshold = volume.lowerThreshold;
    const windowLow = volume.windowLow;
    const windowHigh = volume.windowHigh;
    let pixelCount = 0;
    if (volume.dataType === "label") {
      for (let j = 0; j < jLength; j++) {
        for (let i = 0; i < iLength; i++) {
          let label = volumeData[sliceAccess(i, j)];
          label = label >= this.colorMap.length ? label % this.colorMap.length + 1 : label;
          const color = this.colorMap[label];
          data[4 * pixelCount] = color >> 24 & 255;
          data[4 * pixelCount + 1] = color >> 16 & 255;
          data[4 * pixelCount + 2] = color >> 8 & 255;
          data[4 * pixelCount + 3] = color & 255;
          pixelCount++;
        }
      }
    } else {
      for (let j = 0; j < jLength; j++) {
        for (let i = 0; i < iLength; i++) {
          let value = volumeData[sliceAccess(i, j)];
          let alpha = 255;
          alpha = upperThreshold >= value ? lowerThreshold <= value ? alpha : 0 : 0;
          value = Math.floor(255 * (value - windowLow) / (windowHigh - windowLow));
          value = value > 255 ? 255 : value < 0 ? 0 : value | 0;
          data[4 * pixelCount] = value;
          data[4 * pixelCount + 1] = value;
          data[4 * pixelCount + 2] = value;
          data[4 * pixelCount + 3] = alpha;
          pixelCount++;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    this.ctx.drawImage(canvas, 0, 0, iLength, jLength, 0, 0, this.canvas.width, this.canvas.height);
    this.mesh.material.map.needsUpdate = true;
  }
  /**
   * @member {Function} Refresh the geometry according to axis and index
   * @see Volume.extractPerpendicularPlane
   * @memberof VolumeSlice
   */
  updateGeometry() {
    const extracted = this.volume.extractPerpendicularPlane(this.axis, this.index);
    this.sliceAccess = extracted.sliceAccess;
    this.jLength = extracted.jLength;
    this.iLength = extracted.iLength;
    this.matrix = extracted.matrix;
    this.canvas.width = extracted.planeWidth;
    this.canvas.height = extracted.planeHeight;
    this.canvasBuffer.width = this.iLength;
    this.canvasBuffer.height = this.jLength;
    this.ctx = this.canvas.getContext("2d");
    this.ctxBuffer = this.canvasBuffer.getContext("2d");
    if (this.geometry)
      this.geometry.dispose();
    this.geometry = new PlaneGeometry(extracted.planeWidth, extracted.planeHeight);
    if (this.mesh) {
      this.mesh.geometry = this.geometry;
      this.mesh.matrix.identity();
      this.mesh.applyMatrix4(this.matrix);
    }
    this.geometryNeedsUpdate = false;
  }
}
export {
  VolumeSlice
};
//# sourceMappingURL=VolumeSlice.js.map
