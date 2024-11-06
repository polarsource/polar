import { BufferGeometry, Color, Mesh, Vector3 } from 'three'

export class MeshSurfaceSampler {
  distribution: Float32Array | null
  geometry: BufferGeometry
  positionAttribute: Float32Array
  weightAttribute: string | null
  randomFunction: () => number

  setRandomGenerator(randomFunction: () => number): this
  constructor(mesh: Mesh)
  binarySearch(x: number): number
  build(): this
  sample(targetPosition: Vector3, targetNormal?: Vector3, targetColor?: Color): this
  sampleFace(faceIndex: number, targetPosition: Vector3, targetNormal?: Vector3, targetColor?: Color): this
  sampleFaceIndex(): number
  setWeightAttribute(name: string | null): this
}
