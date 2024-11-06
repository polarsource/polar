import { Loader, LoadingManager } from 'three'

import { Volume } from '../misc/Volume'

export class NRRDLoader extends Loader {
  constructor(manager?: LoadingManager)
  manager: LoadingManager
  path: string

  fieldFunctions: object

  load(
    url: string,
    onLoad: (group: Volume) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<Volume>
  parse(data: string): Volume
  parseChars(array: number[], start?: number, end?: number): string
  setPath(value: string): this
}
