import { Material, WebGLRenderer } from 'three'

export class RoughnessMipmapper {
  constructor(renderer: WebGLRenderer)

  generateMipmaps(material: Material): void
  dispose(): void
}
