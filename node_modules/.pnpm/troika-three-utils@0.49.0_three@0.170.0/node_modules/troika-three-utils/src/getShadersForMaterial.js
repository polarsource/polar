import { ShaderLib } from 'three'


// Copied from threejs WebGLPrograms.js so we can resolve builtin materials to their shaders
// TODO how can we keep this from getting stale?
const MATERIAL_TYPES_TO_SHADERS = {
  MeshDepthMaterial: 'depth',
  MeshDistanceMaterial: 'distanceRGBA',
  MeshNormalMaterial: 'normal',
  MeshBasicMaterial: 'basic',
  MeshLambertMaterial: 'lambert',
  MeshPhongMaterial: 'phong',
  MeshToonMaterial: 'toon',
  MeshStandardMaterial: 'physical',
  MeshPhysicalMaterial: 'physical',
  MeshMatcapMaterial: 'matcap',
  LineBasicMaterial: 'basic',
  LineDashedMaterial: 'dashed',
  PointsMaterial: 'points',
  ShadowMaterial: 'shadow',
  SpriteMaterial: 'sprite'
}

/**
 * Given a Three.js `Material` instance, find the shaders/uniforms that will be
 * used to render that material.
 *
 * @param material - the Material instance
 * @return {object} - the material's shader info: `{uniforms:{}, fragmentShader:'', vertexShader:''}`
 */
export function getShadersForMaterial(material) {
  let builtinType = MATERIAL_TYPES_TO_SHADERS[material.type]
  return builtinType ? ShaderLib[builtinType] : material //TODO fallback for unknown type?
}
