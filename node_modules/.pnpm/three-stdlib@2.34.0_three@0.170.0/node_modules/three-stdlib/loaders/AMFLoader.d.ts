import { Loader, LoadingManager, Group } from 'three'

export class AMFLoader extends Loader {
  constructor(manager?: LoadingManager)

  load(
    url: string,
    onLoad: (object: Group) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<Group>
  parse(data: ArrayBuffer): Group
}
