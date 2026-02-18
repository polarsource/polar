'use client'

import { GeistMono } from 'geist/font/mono'
import React, { useEffect, useRef } from 'react'

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

// Shared vortex math as a GLSL function
const VORTEX_GLSL = `
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float computeVortex(vec2 uv, float aspect, float time) {
    vec2 d = uv - vec2(0.5, 0.5);
    d.x *= aspect;

    float r = length(d);
    float angle = atan(d.y, d.x);
    float rNorm = r / (aspect * 0.5);
    float logR = log(max(r, 0.001));

    float t = time * 0.15;
    float warp = sin(r * 10.0 - t * 2.5) * 0.12;

    float spiral = angle + logR * 2.5 - t * 1.8;
    float arms = sin(spiral * 3.0 + warp) * 0.5 + 0.5;
    arms = pow(arms, 0.5);

    float spiral2 = angle - logR * 1.8 + t * 0.9;
    float arms2 = sin(spiral2 * 2.0) * 0.5 + 0.5;

    float luminance = arms * 0.75 + arms2 * 0.25;
    luminance = smoothstep(0.2, 0.8, luminance);

    float centerFade = smoothstep(0.5, 0.85, rNorm);
    luminance *= centerFade;

    float edgeFade = 1.0 - smoothstep(0.85, 1.1, rNorm);
    luminance *= edgeFade;

    return luminance;
  }
`

const DITHER_FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_pixelSize;
  uniform vec3 u_colorA;
  uniform vec3 u_colorB;

  ${VORTEX_GLSL}

  // 8x8 Bayer matrix
  float bayer8(vec2 p) {
    ivec2 ip = ivec2(mod(p, 8.0));
    int index = ip.x + ip.y * 8;

    float m[64];
    m[0]  =  0.0; m[1]  = 32.0; m[2]  =  8.0; m[3]  = 40.0;
    m[4]  =  2.0; m[5]  = 34.0; m[6]  = 10.0; m[7]  = 42.0;
    m[8]  = 48.0; m[9]  = 16.0; m[10] = 56.0; m[11] = 24.0;
    m[12] = 50.0; m[13] = 18.0; m[14] = 58.0; m[15] = 26.0;
    m[16] = 12.0; m[17] = 44.0; m[18] =  4.0; m[19] = 36.0;
    m[20] = 14.0; m[21] = 46.0; m[22] =  6.0; m[23] = 38.0;
    m[24] = 60.0; m[25] = 28.0; m[26] = 52.0; m[27] = 20.0;
    m[28] = 62.0; m[29] = 30.0; m[30] = 54.0; m[31] = 22.0;
    m[32] =  3.0; m[33] = 35.0; m[34] = 11.0; m[35] = 43.0;
    m[36] =  1.0; m[37] = 33.0; m[38] =  9.0; m[39] = 41.0;
    m[40] = 51.0; m[41] = 19.0; m[42] = 59.0; m[43] = 27.0;
    m[44] = 49.0; m[45] = 17.0; m[46] = 57.0; m[47] = 25.0;
    m[48] = 15.0; m[49] = 47.0; m[50] =  7.0; m[51] = 39.0;
    m[52] = 13.0; m[53] = 45.0; m[54] =  5.0; m[55] = 37.0;
    m[56] = 63.0; m[57] = 31.0; m[58] = 55.0; m[59] = 23.0;
    m[60] = 61.0; m[61] = 29.0; m[62] = 53.0; m[63] = 21.0;

    float threshold = 0.0;
    for (int i = 0; i < 64; i++) {
      if (i == index) {
        threshold = m[i];
        break;
      }
    }
    return threshold / 64.0;
  }

  void main() {
    vec2 pixelCoord = floor(gl_FragCoord.xy / u_pixelSize);
    vec2 uv = (pixelCoord * u_pixelSize) / u_resolution;
    float aspect = u_resolution.x / u_resolution.y;

    float luminance = computeVortex(uv, aspect, u_time);

    // Dither
    float threshold = bayer8(pixelCoord) + 0.02;
    float dithered = step(threshold, luminance);

    vec3 color = mix(u_colorA, u_colorB, dithered);

    // Film grain
    float g = (hash(gl_FragCoord.xy + fract(u_time * 0.7)) * 2.0 - 1.0) * 0.15;
    color += g;

    gl_FragColor = vec4(color, 1.0);
  }
`

const ASCII_FRAGMENT_SHADER = `
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

  ${VORTEX_GLSL}

  void main() {
    vec2 cell = floor(gl_FragCoord.xy / u_cellSize);
    vec2 cellCount = floor(u_resolution / u_cellSize);

    vec2 cellUV = fract(gl_FragCoord.xy / u_cellSize);
    cellUV.y = 1.0 - cellUV.y;

    vec2 uv = (cell + 0.5) / cellCount;
    float aspect = u_resolution.x / u_resolution.y;

    float luminance = computeVortex(uv, aspect, u_time);

    // Map luminance to character
    float charIdx = floor(clamp(luminance, 0.0, 1.0) * (u_charCount - 1.0) + 0.5);

    // Sample from atlas
    float atlasX = (charIdx * u_glyphWidth + cellUV.x * u_glyphWidth) / u_atlasSize.x;
    float atlasY = cellUV.y;
    float glyphAlpha = texture2D(u_atlas, vec2(atlasX, atlasY)).a;

    // Film grain
    float grain = (hash(gl_FragCoord.xy + fract(u_time * 0.7)) * 2.0 - 1.0) * 0.15;

    // Composite glyph over background, then add grain
    vec3 color = mix(u_colorA, u_colorB, step(0.3, glyphAlpha) * glyphAlpha);
    color += grain;

    gl_FragColor = vec4(color, 1.0);
  }
`

const DEFAULT_CHARACTERS = ' .:-=+*#%@'

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

function buildAtlas(
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

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

export function Vortex({
  className,
  children,
  variant = 'dither',
  colorA,
  colorB,
  darkColorA,
  darkColorB,
  pixelSize = 4,
  cellSize = 10,
  characters = DEFAULT_CHARACTERS,
}: {
  className?: string
  children?: React.ReactNode
  variant?: 'dither' | 'ascii'
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
  pixelSize?: number
  cellSize?: number
  characters?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const colorsRef = useRef({
    a: [0, 0, 0] as number[],
    b: [1, 1, 1] as number[],
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      antialias: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: false,
      alpha: true,
    })
    if (!gl) return

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)

    const isAscii = variant === 'ascii'

    // Build atlas texture for ASCII variant
    let atlas: { canvas: HTMLCanvasElement; glyphWidth: number } | null = null
    let texture: WebGLTexture | null = null
    if (isAscii) {
      atlas = buildAtlas(characters, cellSize)
      texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        atlas.canvas,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }

    const fragmentSource = isAscii
      ? ASCII_FRAGMENT_SHADER
      : DITHER_FRAGMENT_SHADER

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
    if (!vs || !fs) return

    const program = createProgram(gl, vs, fs)
    if (!program) return

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    )

    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution')
    const timeLoc = gl.getUniformLocation(program, 'u_time')
    const colorALoc = gl.getUniformLocation(program, 'u_colorA')
    const colorBLoc = gl.getUniformLocation(program, 'u_colorB')

    // Variant-specific uniform locations
    const pixelSizeLoc = isAscii
      ? null
      : gl.getUniformLocation(program, 'u_pixelSize')
    const cellSizeLoc = isAscii
      ? gl.getUniformLocation(program, 'u_cellSize')
      : null
    const atlasLoc = isAscii
      ? gl.getUniformLocation(program, 'u_atlas')
      : null
    const charCountLoc = isAscii
      ? gl.getUniformLocation(program, 'u_charCount')
      : null
    const atlasSizeLoc = isAscii
      ? gl.getUniformLocation(program, 'u_atlasSize')
      : null
    const glyphWidthLoc = isAscii
      ? gl.getUniformLocation(program, 'u_glyphWidth')
      : null

    const updateColors = (isDark: boolean) => {
      const a = isDark
        ? (darkColorA ?? colorA ?? '#000000')
        : (colorA ?? '#ffffff')
      const b = isDark
        ? (darkColorB ?? colorB ?? '#ffffff')
        : (colorB ?? '#000000')
      colorsRef.current = { a: hexToRgb(a), b: hexToRgb(b) }
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    updateColors(mql.matches)

    const onColorSchemeChange = (e: MediaQueryListEvent) =>
      updateColors(e.matches)
    mql.addEventListener('change', onColorSchemeChange)

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const startTime = performance.now()
    const dpr = window.devicePixelRatio || 1

    const render = () => {
      const time = (performance.now() - startTime) / 1000
      const { a, b } = colorsRef.current

      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)

      gl.enableVertexAttribArray(positionLoc)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

      gl.uniform2f(resolutionLoc, canvas.width, canvas.height)
      gl.uniform1f(timeLoc, time)
      gl.uniform3f(colorALoc, a[0], a[1], a[2])
      gl.uniform3f(colorBLoc, b[0], b[1], b[2])

      if (isAscii && atlas) {
        gl.uniform1f(cellSizeLoc, cellSize * dpr)
        gl.uniform1f(charCountLoc, characters.length)
        gl.uniform2f(atlasSizeLoc, atlas.canvas.width, atlas.canvas.height)
        gl.uniform1f(glyphWidthLoc, atlas.glyphWidth)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.uniform1i(atlasLoc, 0)
      } else {
        gl.uniform1f(pixelSizeLoc, pixelSize * dpr)
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafRef.current)
      observer.disconnect()
      mql.removeEventListener('change', onColorSchemeChange)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(positionBuffer)
      if (texture) gl.deleteTexture(texture)
    }
  }, [
    variant,
    colorA,
    colorB,
    darkColorA,
    darkColorB,
    pixelSize,
    cellSize,
    characters,
  ])

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {children && (
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}
