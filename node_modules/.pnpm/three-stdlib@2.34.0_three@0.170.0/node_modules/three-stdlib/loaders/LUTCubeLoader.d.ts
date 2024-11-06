import { Loader, LoadingManager, Vector3, DataTexture, Texture } from 'three'

export interface LUTCubeResult {
  title: string
  size: number
  domainMin: Vector3
  domainMax: Vector3
  texture: DataTexture
  texture3D: Texture // Data3DTexture
}

export class LUTCubeLoader extends Loader {
  constructor(manager?: LoadingManager)

  load(
    url: string,
    onLoad: (result: LUTCubeResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: Error) => void,
  ): any
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<LUTCubeResult>
  parse(data: string): LUTCubeResult
}
