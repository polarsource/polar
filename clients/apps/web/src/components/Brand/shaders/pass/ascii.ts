import { GeistMono } from 'geist/font/mono'
import { HASH_GLSL, FILM_GRAIN_GLSL } from '../glsl'
import type { Effect, EffectInstance } from '../core'

export interface AsciiEffectOptions {
  cellSize?: number
  characters?: string
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
}

const DEFAULT_CHARACTERS = ' .:-=+*#%@'

export function asciiEffect(options: AsciiEffectOptions = {}): Effect {
  const {
    cellSize = 10,
    characters = DEFAULT_CHARACTERS,
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
      return buildAsciiShader(geometryGlsl)
    },
    init(gl: WebGLRenderingContext, program: WebGLProgram): EffectInstance {
      const locs = getAsciiUniformLocations(gl, program)
      const atlas = buildAtlas(characters, cellSize)
      const texture = gl.createTexture()!
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      return {
        draw(gl, canvas, time, colors) {
          setupAsciiUniforms(gl, locs, canvas, time, colors, atlas, texture, cellSize, characters.length)
        },
        cleanup() {
          gl.deleteTexture(texture)
        },
      }
    },
  }
}

export function buildAsciiShader(geometryGlsl: string): string {
  return `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_cellSize;
    uniform vec3 u_colorA;
    uniform vec3 u_colorB;
    uniform sampler2D u_atlas;
    uniform float u_charCount;
    uniform vec2 u_atlasSize;
    uniform float u_glyphWidth;

    ${HASH_GLSL}
    ${FILM_GRAIN_GLSL}
    ${geometryGlsl}

    void main() {
      vec2 cell = floor(gl_FragCoord.xy / u_cellSize);
      vec2 cellCount = floor(u_resolution / u_cellSize);

      vec2 cellUV = fract(gl_FragCoord.xy / u_cellSize);
      cellUV.y = 1.0 - cellUV.y;

      vec2 uv = (cell + 0.5) / cellCount;
      float aspect = u_resolution.x / u_resolution.y;

      float luminance = computeLuminance(uv, aspect, u_time);

      // Map luminance to character
      float charIdx = floor(clamp(luminance, 0.0, 1.0) * (u_charCount - 1.0) + 0.5);

      // Sample from atlas
      float atlasX = (charIdx * u_glyphWidth + cellUV.x * u_glyphWidth) / u_atlasSize.x;
      float atlasY = cellUV.y;
      float glyphAlpha = texture2D(u_atlas, vec2(atlasX, atlasY)).a;

      // Film grain
      float grain = filmGrain(gl_FragCoord.xy, u_time);

      // Composite glyph over background, then add grain
      vec3 color = mix(u_colorA, u_colorB, step(0.3, glyphAlpha) * glyphAlpha);
      color += grain;

      gl_FragColor = vec4(color, 1.0);
    }
  `
}

export function buildAtlas(
  characters: string,
  cellSize: number,
): { canvas: HTMLCanvasElement; glyphWidth: number } {
  const dpr = window.devicePixelRatio || 1
  const size = Math.ceil(cellSize * dpr)
  const canvas = document.createElement('canvas')
  canvas.width = size * characters.length
  canvas.height = size

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'white'
  ctx.font = `${size}px ${GeistMono.style.fontFamily}, monospace`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  for (let i = 0; i < characters.length; i++) {
    ctx.fillText(characters[i], i * size + size / 2, size / 2)
  }

  return { canvas, glyphWidth: size }
}

export interface AsciiUniformLocations {
  resolution: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  cellSize: WebGLUniformLocation | null
  colorA: WebGLUniformLocation | null
  colorB: WebGLUniformLocation | null
  atlas: WebGLUniformLocation | null
  charCount: WebGLUniformLocation | null
  atlasSize: WebGLUniformLocation | null
  glyphWidth: WebGLUniformLocation | null
}

export function getAsciiUniformLocations(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
): AsciiUniformLocations {
  return {
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    time: gl.getUniformLocation(program, 'u_time'),
    cellSize: gl.getUniformLocation(program, 'u_cellSize'),
    colorA: gl.getUniformLocation(program, 'u_colorA'),
    colorB: gl.getUniformLocation(program, 'u_colorB'),
    atlas: gl.getUniformLocation(program, 'u_atlas'),
    charCount: gl.getUniformLocation(program, 'u_charCount'),
    atlasSize: gl.getUniformLocation(program, 'u_atlasSize'),
    glyphWidth: gl.getUniformLocation(program, 'u_glyphWidth'),
  }
}

export function setupAsciiUniforms(
  gl: WebGLRenderingContext,
  locs: AsciiUniformLocations,
  canvas: HTMLCanvasElement,
  time: number,
  colors: { a: number[]; b: number[] },
  atlasData: { canvas: HTMLCanvasElement; glyphWidth: number },
  texture: WebGLTexture,
  cellSize: number,
  charCount: number,
): void {
  const dpr = window.devicePixelRatio || 1
  gl.uniform2f(locs.resolution, canvas.width, canvas.height)
  gl.uniform1f(locs.time, time)
  gl.uniform1f(locs.cellSize, cellSize * dpr)
  gl.uniform3f(locs.colorA, colors.a[0], colors.a[1], colors.a[2])
  gl.uniform3f(locs.colorB, colors.b[0], colors.b[1], colors.b[2])
  gl.uniform1f(locs.charCount, charCount)
  gl.uniform2f(locs.atlasSize, atlasData.canvas.width, atlasData.canvas.height)
  gl.uniform1f(locs.glyphWidth, atlasData.glyphWidth)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.uniform1i(locs.atlas, 0)
}
