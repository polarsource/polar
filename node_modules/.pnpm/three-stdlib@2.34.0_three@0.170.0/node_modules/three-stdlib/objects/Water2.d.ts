import { BufferGeometry, Color, Mesh, ShaderMaterial, Texture, Vector2 } from 'three'
import { TextureEncoding } from '../types/shared'

export interface Water2Options {
  color?: Color | string | number
  textureWidth?: number
  textureHeight?: number
  clipBias?: number
  flowDirection?: Vector2
  flowSpeed?: number
  reflectivity?: number
  scale?: number
  shader?: object
  flowMap?: Texture
  normalMap0?: Texture
  normalMap1?: Texture
  encoding?: TextureEncoding
}

export class Water2 extends Mesh {
  material: ShaderMaterial
  constructor(geometry: BufferGeometry, options: Water2Options)
}
