import { Loader, Mesh, LoadingManager } from 'three'

export interface XResult {
  animations: object[]
  models: Mesh[]
}

export class XLoader extends Loader {
  constructor(manager?: LoadingManager)

  load(
    url: string,
    onLoad: (object: XResult) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<XResult>
  parse(data: ArrayBuffer | string, onLoad: (object: object) => void): object
}
