import { Mesh, BufferGeometry, Color, WebGLRenderTarget, PerspectiveCamera } from 'three'
import { TextureEncoding } from '../types/shared'

export interface RefractorOptions {
  color?: Color | string | number
  textureWidth?: number
  textureHeight?: number
  clipBias?: number
  shader?: object
  encoding?: TextureEncoding
  multisample?: number
}

export class Refractor extends Mesh {
  type: 'Refractor'
  camera: PerspectiveCamera

  constructor(geometry?: BufferGeometry, options?: RefractorOptions)

  getRenderTarget(): WebGLRenderTarget

  dispose(): void
}
