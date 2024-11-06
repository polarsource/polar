import { CubeTexture, LightProbe, WebGLRenderer, WebGLCubeRenderTarget } from 'three'

export namespace LightProbeGenerator {
  function fromCubeTexture(cubeTexture: CubeTexture): LightProbe
  function fromCubeRenderTarget(renderer: WebGLRenderer, cubeRenderTarget: WebGLCubeRenderTarget): LightProbe
}
