import { Object3D, LineSegments } from 'three'

export class VertexTangentsHelper extends LineSegments {
  readonly type: 'VertexTangentsHelper'
  constructor(object: Object3D, size?: number, hex?: number)

  object: Object3D
  size: number

  update(): void

  dispose(): void
}
