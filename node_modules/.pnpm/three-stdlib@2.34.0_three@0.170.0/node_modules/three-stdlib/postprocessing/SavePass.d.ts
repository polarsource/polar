import { ShaderMaterial, WebGLRenderTarget } from 'three'

import { Pass } from './Pass'

export class SavePass extends Pass {
  constructor(renderTarget: WebGLRenderTarget)
  textureID: string
  renderTarget: WebGLRenderTarget
  uniforms: object
  material: ShaderMaterial
  fsQuad: object
}
