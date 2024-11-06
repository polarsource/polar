import { Loader, Texture, Mesh, LoadingManager } from 'three'

export interface Chunk {
  palette: number[]
  size: { x: number; y: number; z: number }
  data: Uint8Array
}

export class VOXLoader extends Loader {
  constructor(manager?: LoadingManager)

  load(
    url: string,
    onLoad: (chunks: Chunk[]) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (event: ErrorEvent) => void,
  ): void
  loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<object[]>
  parse(data: ArrayBuffer): object[]
}

export class VOXMesh extends Mesh {
  constructor(chunk: Chunk)
}

// Data3DTexture
export class VOXData3DTexture extends Texture {
  constructor(chunk: Chunk)
}
