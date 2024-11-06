import { CylinderGeometry, DoubleSide, Mesh, MeshStandardMaterial, Vector2, Vector3 } from 'three'
import { createBezierMeshMaterial } from './BezierMeshMaterial.js'

let geometry = null

const defaultBaseMaterial = /*#__PURE__*/new MeshStandardMaterial({color: 0xffffff, side: DoubleSide})


/**
 * A ThreeJS `Mesh` that bends a tube shape along a 3D cubic bezier path. The bending is done
 * by deforming a straight cylindrical geometry in the vertex shader based on a set of four
 * control point uniforms. It patches the necessary GLSL into the mesh's assigned `material`
 * automatically.
 *
 * The cubiz bezier path is determined by its four `Vector3` properties:
 * - `pointA`
 * - `controlA`
 * - `controlB`
 * - `pointB`
 *
 * The tube's radius is controlled by its `radius` property, which defaults to `0.01`.
 *
 * You can also give the tube a dashed appearance with two properties:
 *
 * - `dashArray` - an array of two numbers, defining the length of "on" and "off" parts of
 *   the dash. Each is a 0-1 ratio of the entire path's length. (Actually this is the `t` length
 *   used as input to the cubic bezier function, not its visible length.)
 * - `dashOffset` - offset of where the dash starts. You can animate this to make the dashes move.
 *
 * Note that the dashes will appear like a hollow tube, not solid. This will be more apparent on
 * thicker tubes.
 *
 * TODO: proper geometry bounding sphere and raycasting
 * TODO: allow control of the geometry's segment counts
 */
class BezierMesh extends Mesh {
  static getGeometry() {
    return geometry || (geometry =
      new CylinderGeometry(1, 1, 1, 6, 64).translate(0, 0.5, 0)
    )
  }

  constructor() {
    super(
      BezierMesh.getGeometry(),
      defaultBaseMaterial
    )

    this.pointA = new Vector3()
    this.controlA = new Vector3()
    this.controlB = new Vector3()
    this.pointB = new Vector3()
    this.radius = 0.01
    this.dashArray = new Vector2()
    this.dashOffset = 0

    // TODO - disabling frustum culling until I figure out how to customize the
    //  geometry's bounding sphere that gets used
    this.frustumCulled = false
  }

  // Handler for automatically wrapping the base material with our upgrades. We do the wrapping
  // lazily on _read_ rather than write to avoid unnecessary wrapping on transient values.
  get material() {
    let derivedMaterial = this._derivedMaterial
    const baseMaterial = this._baseMaterial || this._defaultMaterial || (this._defaultMaterial = defaultBaseMaterial.clone())
    if (!derivedMaterial || derivedMaterial.baseMaterial !== baseMaterial) {
      derivedMaterial = this._derivedMaterial = createBezierMeshMaterial(baseMaterial)
      // dispose the derived material when its base material is disposed:
      baseMaterial.addEventListener('dispose', function onDispose() {
        baseMaterial.removeEventListener('dispose', onDispose)
        derivedMaterial.dispose()
      })
    }
    return derivedMaterial
  }
  set material(baseMaterial) {
    this._baseMaterial = baseMaterial
  }

  // Create and update material for shadows upon request:
  get customDepthMaterial() {
    return this.material.getDepthMaterial()
  }
  get customDistanceMaterial() {
    return this.material.getDistanceMaterial()
  }

  onBeforeRender() {
    const {uniforms} = this.material
    const {pointA, controlA, controlB, pointB, radius, dashArray, dashOffset} = this
    uniforms.pointA.value.copy(pointA)
    uniforms.controlA.value.copy(controlA)
    uniforms.controlB.value.copy(controlB)
    uniforms.pointB.value.copy(pointB)
    uniforms.radius.value = radius
    uniforms.dashing.value.set(dashArray.x, dashArray.y, dashOffset || 0)
  }

  raycast(/*raycaster, intersects*/) {
    // TODO - just fail for now
  }
}


export { BezierMesh }
