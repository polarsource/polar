declare module "potpack" {
  export interface PotpackBox {
    w: number;
    h: number;
    /**
     * X coordinate in the resulting container.
     */
    x?: number;
    /**
     * Y coordinate in the resulting container.
     */
    y?: number;
  }

  interface PotpackStats {
    /**
     * Width of the resulting container.
     */
    w: number;
    /**
     * Height of the resulting container.
     */
    h: number;
    /**
     * The space utilization value (0 to 1). Higher is better.
     */
    fill: number;
  }

  /**
   * Packs 2D rectangles into a near-square container.
   *
   * Mutates the {@link boxes} array: it's sorted by height,
   * and box objects are augmented with `x`, `y` coordinates.
   */
  const potpack: (boxes: PotpackBox[]) => PotpackStats;

  export default potpack;
}
