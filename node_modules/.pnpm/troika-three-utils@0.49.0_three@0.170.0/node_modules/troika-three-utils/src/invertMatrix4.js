import { Matrix4 } from 'three'

/**
 * Helper for smoothing out the `m.getInverse(x)` --> `m.copy(x).invert()` conversion
 * that happened in ThreeJS r123.
 * @param {Matrix4} srcMatrix
 * @param {Matrix4} [tgtMatrix]
 */
export function invertMatrix4(srcMatrix, tgtMatrix = new Matrix4()) {
  if (typeof tgtMatrix.invert === 'function') {
    tgtMatrix.copy(srcMatrix).invert()
  } else {
    tgtMatrix.getInverse(srcMatrix)
  }
  return tgtMatrix
}
