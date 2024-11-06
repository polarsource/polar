import { Loader, BufferGeometry, LoadingManager } from 'three'

export class XYZLoader extends Loader {
  constructor(manager?: LoadingManager)

  load(
    url: string,
    onLoad: (geometry: BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<BufferGeometry>
  parse(data: string, onLoad: (geometry: BufferGeometry) => void): object
}
