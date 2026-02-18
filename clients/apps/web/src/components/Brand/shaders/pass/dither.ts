import { HASH_GLSL, BAYER8_GLSL, FILM_GRAIN_GLSL } from '../glsl'
import type { Effect, EffectInstance } from '../core'

export interface DitherShaderOptions {
  filmGrain?: boolean
  thresholdBias?: number
}

export interface DitherEffectOptions {
  pixelSize?: number
  thresholdBias?: number
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
}

export function ditherEffect(options: DitherEffectOptions = {}): Effect {
  const { pixelSize = 4, thresholdBias = 0.02, colorA, colorB, darkColorA, darkColorB } = options

  return {
    colorA,
    colorB,
    darkColorA,
    darkColorB,
    buildShader(geometryGlsl: string): string {
      return buildDitherShader(geometryGlsl, { filmGrain: true, thresholdBias })
    },
    init(gl: WebGLRenderingContext, program: WebGLProgram): EffectInstance {
      const locs = getDitherUniformLocations(gl, program)
      return {
        draw(gl, canvas, time, colors) {
          setupDitherUniforms(gl, locs, canvas, time, colors, pixelSize)
        },
      }
    },
  }
}

export function buildDitherShader(
  geometryGlsl: string,
  options: DitherShaderOptions = {},
): string {
  const { filmGrain = true, thresholdBias = 0.02 } = options

  return `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_pixelSize;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;

    ${HASH_GLSL}
    ${BAYER8_GLSL}
    ${filmGrain ? FILM_GRAIN_GLSL : ''}
    ${geometryGlsl}

    void main() {
      vec2 pixelCoord = floor(gl_FragCoord.xy / u_pixelSize);
      vec2 uv = (pixelCoord * u_pixelSize) / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;

      float luminance = computeLuminance(uv, aspect, u_time);

      // Dither
      float threshold = bayer8(pixelCoord) + ${thresholdBias.toFixed(4)};
      float dithered = step(threshold, luminance);

      vec3 color = mix(u_colorA, u_colorB, dithered);
      ${filmGrain ? '// Film grain\n      color += filmGrain(gl_FragCoord.xy, u_time);' : ''}

      gl_FragColor = vec4(color, 1.0);
    }
  `
}

export interface DitherUniformLocations {
  resolution: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  pixelSize: WebGLUniformLocation | null
  colorA: WebGLUniformLocation | null
  colorB: WebGLUniformLocation | null
}

export function getDitherUniformLocations(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
): DitherUniformLocations {
  return {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    time: gl.getUniformLocation(program, 'u_time'),
    pixelSize: gl.getUniformLocation(program, 'u_pixelSize'),
    colorA: gl.getUniformLocation(program, 'u_colorA'),
    colorB: gl.getUniformLocation(program, 'u_colorB'),
  }
}

export function setupDitherUniforms(
  gl: WebGLRenderingContext,
  locs: DitherUniformLocations,
  canvas: HTMLCanvasElement,
  time: number,
  colors: { a: number[]; b: number[] },
  pixelSize: number,
): void {
  gl.uniform2f(locs.resolution, canvas.width, canvas.height)
  gl.uniform1f(locs.time, time)
  gl.uniform1f(locs.pixelSize, pixelSize * (window.devicePixelRatio || 1))
  gl.uniform3f(locs.colorA, colors.a[0], colors.a[1], colors.a[2])
  gl.uniform3f(locs.colorB, colors.b[0], colors.b[1], colors.b[2])
}
