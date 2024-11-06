/**
 * Find all uniforms and their types within a shader code string.
 *
 * @param {string} shader - The shader code to parse
 * @return {object} mapping of uniform names to their glsl type
 */
export function getShaderUniformTypes(shader) {
  let uniformRE = /\buniform\s+(int|float|vec[234]|mat[34])\s+([A-Za-z_][\w]*)/g
  let uniforms = Object.create(null)
  let match
  while ((match = uniformRE.exec(shader)) !== null) {
    uniforms[match[2]] = match[1]
  }
  return uniforms
}

