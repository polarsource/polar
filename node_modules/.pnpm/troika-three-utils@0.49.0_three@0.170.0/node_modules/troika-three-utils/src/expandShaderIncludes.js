import { ShaderChunk } from 'three'

/**
 * Recursively expands all `#include <xyz>` statements within string of shader code.
 * Copied from three's WebGLProgram#parseIncludes for external use.
 *
 * @param {string} source - The GLSL source code to evaluate
 * @return {string} The GLSL code with all includes expanded
 */
export function expandShaderIncludes( source ) {
  const pattern = /^[ \t]*#include +<([\w\d./]+)>/gm
  function replace(match, include) {
    let chunk = ShaderChunk[include]
    return chunk ? expandShaderIncludes(chunk) : match
  }
  return source.replace( pattern, replace )
}
