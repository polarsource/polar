export const IMAGE_GLSL = `
  uniform sampler2D u_geometryTexture;

  float computeLuminance(vec2 uv, float aspect, float time) {
    vec3 rgb = texture2D(u_geometryTexture, uv).rgb;
    return dot(rgb, vec3(0.299, 0.587, 0.114));
  }
`

export function loadImageTexture(
  gl: WebGLRenderingContext,
  src: string,
): Promise<{ texture: WebGLTexture; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const texture = gl.createTexture()
      if (!texture) {
        reject(new Error('Failed to create texture'))
        return
      }
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      resolve({ texture, width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}
