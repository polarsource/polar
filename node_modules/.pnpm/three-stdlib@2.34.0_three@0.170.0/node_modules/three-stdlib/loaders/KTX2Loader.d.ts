import { LoadingManager, CompressedTextureLoader, CompressedTexture, WebGLRenderer } from 'three'

export class KTX2Loader extends CompressedTextureLoader {
  constructor(manager?: LoadingManager)

  setTranscoderPath(path: string): KTX2Loader
  setWorkerLimit(limit: number): KTX2Loader
  detectSupport(renderer: WebGLRenderer): KTX2Loader
  dispose(): KTX2Loader
}
