import { Mesh, BufferGeometry, Color, WebGLRenderTarget, PerspectiveCamera } from 'three'
import { TextureEncoding } from '../types/shared'

export interface ReflectorOptions {
  color?: Color | string | number
  textureWidth?: number
  textureHeight?: number
  clipBias?: number
  shader?: object
  encoding?: TextureEncoding
  multisample?: number
}

export class Reflector extends Mesh {
  type: 'Reflector'
  camera: PerspectiveCamera

  constructor(geometry?: BufferGeometry, options?: ReflectorOptions)

  getRenderTarget(): WebGLRenderTarget

  dispose(): void
}
