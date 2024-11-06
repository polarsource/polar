import { Loader, CubeTexture, LoadingManager, TextureDataType } from 'three'

import { RGBELoader } from './RGBELoader'

export class HDRCubeTextureLoader extends Loader {
  constructor(manager?: LoadingManager)
  hdrLoader: RGBELoader
  type: TextureDataType

  load(
    urls: string | string[],
    onLoad: (texture: CubeTexture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): CubeTexture
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<CubeTexture>
  setDataType(type: TextureDataType): this
}
