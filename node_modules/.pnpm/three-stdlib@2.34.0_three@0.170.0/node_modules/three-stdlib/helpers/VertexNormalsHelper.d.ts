import { Object3D, LineSegments } from 'three'

export class VertexNormalsHelper extends LineSegments {
  readonly type: 'VertexNormalsHelper'
  constructor(object: Object3D, size?: number, hex?: number)

  object: Object3D
  size: number

  update(): void

  dispose(): void
}
