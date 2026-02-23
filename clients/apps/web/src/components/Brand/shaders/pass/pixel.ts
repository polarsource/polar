import type { Effect, EffectInstance } from '../core'
import { FILM_GRAIN_GLSL, HASH_GLSL } from '../glsl'

export interface PixelEffectOptions {
  pixelSize?: number
  gap?: number
  colorMode?: boolean
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
}

export function pixelEffect(options: PixelEffectOptions = {}): Effect {
  const {
    pixelSize = 8,
    gap = 2,
    colorMode = false,
    colorA,
    colorB,
    darkColorA,
    darkColorB,
  } = options

  return {
    colorA,
    colorB,
    darkColorA,
    darkColorB,
    buildShader(geometryGlsl: string): string {
      return colorMode
        ? buildColorPixelShader(geometryGlsl)
        : buildPixelShader(geometryGlsl)
    },
    init(gl: WebGLRenderingContext, program: WebGLProgram): EffectInstance {
      const locs = getPixelUniformLocations(gl, program)
      return {
        draw(gl, canvas, time, colors) {
          setupPixelUniforms(gl, locs, canvas, time, colors, pixelSize, gap)
        },
      }
    },
  }
}

function buildPixelShader(geometryGlsl: string): string {
  return `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_pixelSize;
    uniform float u_gap;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;

    ${HASH_GLSL}
    ${FILM_GRAIN_GLSL}
    ${geometryGlsl}

    void main() {
      float cellSize = u_pixelSize + u_gap;
      vec2 cell = floor(gl_FragCoord.xy / cellSize);

      // Position within cell
      vec2 localPos = mod(gl_FragCoord.xy, cellSize);

      // Discard gap pixels
      if (localPos.x >= u_pixelSize || localPos.y >= u_pixelSize) {
        gl_FragColor = vec4(u_colorA, 1.0);
        return;
      }

      // Sample geometry at cell center
      vec2 uv = (cell + 0.5) * cellSize / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;
      float luminance = computeLuminance(uv, aspect, u_time);

      vec3 color = mix(u_colorA, u_colorB, luminance);

      // Film grain
      color += filmGrain(gl_FragCoord.xy, u_time);

      gl_FragColor = vec4(color, 1.0);
    }
  `
}

function buildColorPixelShader(geometryGlsl: string): string {
  return `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_pixelSize;
    uniform float u_gap;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;

    ${HASH_GLSL}
    ${FILM_GRAIN_GLSL}
    ${geometryGlsl}

    void main() {
      float cellSize = u_pixelSize + u_gap;
      vec2 cell = floor(gl_FragCoord.xy / cellSize);

      // Position within cell
      vec2 localPos = mod(gl_FragCoord.xy, cellSize);

      // Gap pixels use colorA
      if (localPos.x >= u_pixelSize || localPos.y >= u_pixelSize) {
        gl_FragColor = vec4(u_colorA, 1.0);
        return;
      }

      // Sample geometry color at cell center
      vec2 uv = (cell + 0.5) * cellSize / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;
      vec3 color = computeColor(uv, aspect, u_time);

      // Subtle film grain
      color += filmGrain(gl_FragCoord.xy, u_time) * 0.6;

      gl_FragColor = vec4(color, 1.0);
    }
  `
}

interface PixelUniformLocations {
  resolution: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  pixelSize: WebGLUniformLocation | null
  gap: WebGLUniformLocation | null
  colorA: WebGLUniformLocation | null
  colorB: WebGLUniformLocation | null
}

function getPixelUniformLocations(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
): PixelUniformLocations {
  return {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    time: gl.getUniformLocation(program, 'u_time'),
    pixelSize: gl.getUniformLocation(program, 'u_pixelSize'),
    gap: gl.getUniformLocation(program, 'u_gap'),
    colorA: gl.getUniformLocation(program, 'u_colorA'),
    colorB: gl.getUniformLocation(program, 'u_colorB'),
  }
}

function setupPixelUniforms(
  gl: WebGLRenderingContext,
  locs: PixelUniformLocations,
  canvas: HTMLCanvasElement,
  time: number,
  colors: { a: number[]; b: number[] },
  pixelSize: number,
  gap: number,
): void {
  const dpr = window.devicePixelRatio || 1
  gl.uniform2f(locs.resolution, canvas.width, canvas.height)
  gl.uniform1f(locs.time, time)
  gl.uniform1f(locs.pixelSize, pixelSize * dpr)
  gl.uniform1f(locs.gap, gap * dpr)
  gl.uniform3f(locs.colorA, colors.a[0], colors.a[1], colors.a[2])
  gl.uniform3f(locs.colorB, colors.b[0], colors.b[1], colors.b[2])
}
