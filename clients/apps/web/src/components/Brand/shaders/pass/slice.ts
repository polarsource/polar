import type { Effect, EffectInstance } from '../core'
import { FILM_GRAIN_GLSL, HASH_GLSL } from '../glsl'

function buildVerticalSliceShader(geometryGlsl: string): string {
  return `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;
    uniform vec2 u_contentSize;
    uniform float u_slices;
    uniform float u_offset;

    ${HASH_GLSL}
    ${FILM_GRAIN_GLSL}
    ${geometryGlsl}

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      uv.y = 1.0 - uv.y;
      float aspect = u_resolution.x / u_resolution.y;

      // Vertical slices: subdivide x into N bands, shift each band's UV.y
      float sliceIndex = floor(uv.x * u_slices);
      float shiftedY = uv.y + sliceIndex * u_offset;
      float mirroredY = abs(fract(shiftedY * 0.5) * 2.0 - 1.0);
      vec2 deformedUV = vec2(uv.x, mirroredY);

      vec3 color = computeColor(deformedUV, aspect, u_time);
      color += abs(filmGrain(gl_FragCoord.xy, u_time)) * 0.96;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
}

function buildCircularSliceShader(geometryGlsl: string): string {
  return `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;
    uniform vec2 u_contentSize;
    uniform float u_slices;
    uniform float u_offset;

    ${HASH_GLSL}
    ${FILM_GRAIN_GLSL}
    ${geometryGlsl}

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      uv.y = 1.0 - uv.y;
      float aspect = u_resolution.x / u_resolution.y;

      // Circular slices: concentric rings based on distance from center,
      // shift each ring's UV.y by ringIndex * offset
      vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);
      float dist = length(centered);
      float ringIndex = floor(dist * u_slices);
      vec2 deformedUV = vec2(uv.x, uv.y + ringIndex * u_offset);

      vec3 color = computeColor(deformedUV, aspect, u_time);
      color += abs(filmGrain(gl_FragCoord.xy, u_time)) * 0.96;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
}

interface SliceEffectOptions {
  /** Layout of slices. Default: 'vertical' */
  type?: 'vertical' | 'circular'
  /** Number of slices / angular sectors. Default: 20 */
  slices?: number
  /** UV.y offset applied per slice (additive, so slice N shifts by N * offset). Default: 0.05 */
  offset?: number
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
}

export function sliceEffect(options: SliceEffectOptions = {}): Effect {
  const { type = 'vertical', slices = 20, offset = 0.05 } = options
  const buildShader =
    type === 'circular' ? buildCircularSliceShader : buildVerticalSliceShader
  return {
    colorA: options.colorA,
    colorB: options.colorB,
    darkColorA: options.darkColorA,
    darkColorB: options.darkColorB,
    buildShader,
    init(gl: WebGLRenderingContext, program: WebGLProgram): EffectInstance {
      const resLoc = gl.getUniformLocation(program, 'u_resolution')
      const timeLoc = gl.getUniformLocation(program, 'u_time')
      const colorALoc = gl.getUniformLocation(program, 'u_colorA')
      const colorBLoc = gl.getUniformLocation(program, 'u_colorB')
      const slicesLoc = gl.getUniformLocation(program, 'u_slices')
      const offsetLoc = gl.getUniformLocation(program, 'u_offset')
      return {
        draw(gl, canvas, time, colors) {
          gl.uniform2f(resLoc, canvas.width, canvas.height)
          gl.uniform1f(timeLoc, time)
          gl.uniform3f(colorALoc, colors.a[0], colors.a[1], colors.a[2])
          gl.uniform3f(colorBLoc, colors.b[0], colors.b[1], colors.b[2])
          gl.uniform1f(slicesLoc, slices)
          gl.uniform1f(offsetLoc, offset)
        },
      }
    },
  }
}
