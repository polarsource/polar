import { BufferGeometry, Color, Mesh, ShaderMaterial, Side, Texture, Vector3 } from 'three'

export interface WaterOptions {
  textureWidth?: number
  textureHeight?: number
  clipBias?: number
  alpha?: number
  time?: number
  waterNormals?: Texture
  sunDirection?: Vector3
  sunColor?: Color | string | number
  waterColor?: Color | string | number
  eye?: Vector3
  distortionScale?: number
  side?: Side
  fog?: boolean
}

export class Water extends Mesh {
  material: ShaderMaterial
  constructor(geometry: BufferGeometry, options: WaterOptions)
}
