import { DataTexture, Texture } from 'three'
import { ShaderPass } from './ShaderPass'

export interface LUTPassParameters {
  lut?: DataTexture | Texture // Data3DTexture
  intensity?: number
}

export class LUTPass extends ShaderPass {
  lut?: DataTexture | Texture // Data3DTexture
  intensity?: number
  constructor(params: LUTPassParameters)
}
