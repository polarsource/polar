import { Scene, Camera, ShaderMaterial, Vector2, MeshNormalMaterial, WebGLRenderTarget } from 'three'

import { Pass, FullScreenQuad } from './Pass'

export interface RenderPixelatedPassParameters {
  normalEdgeStrength?: number
  depthEdgeStrength?: number
}

export class RenderPixelatedPass extends Pass {
  constructor(
    resolution: Vector2,
    pixelSize: number,
    scene: Scene,
    camera: Camera,
    options?: RenderPixelatedPassParameters,
  )
  pixelSize: number
  resolution: Vector2
  renderResolution: Vector2

  pixelatedMaterial: ShaderMaterial
  normalMaterial: MeshNormalMaterial

  fsQuad: FullScreenQuad
  scene: Scene
  camera: Camera

  normalEdgeStrength: RenderPixelatedPassParameters['normalEdgeStrength']
  depthEdgeStrength: RenderPixelatedPassParameters['depthEdgeStrength']

  rgbRenderTarget: WebGLRenderTarget
  normalRenderTarget: WebGLRenderTarget
}
