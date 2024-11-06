import { Texture, ShaderMaterial } from 'three'

import { Pass, FullScreenQuad } from './Pass'

export class TexturePass extends Pass {
  constructor(map: Texture, opacity?: number)
  map: Texture
  opacity: number
  uniforms: object
  material: ShaderMaterial
  fsQuad: FullScreenQuad
}
