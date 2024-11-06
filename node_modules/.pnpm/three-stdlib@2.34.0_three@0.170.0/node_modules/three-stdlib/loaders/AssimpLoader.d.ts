import { Loader, Object3D, LoadingManager } from 'three'

export interface Assimp {
  animation: any
  object: Object3D
}

export class AssimpLoader extends Loader {
  constructor(manager?: LoadingManager)

  load(
    url: string,
    onLoad: (result: Assimp) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<Assimp>
  parse(buffer: ArrayBuffer, path: string): Assimp
}
