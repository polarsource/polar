'use client'

import { GeistMono } from 'geist/font/mono'
import React, { useEffect, useRef } from 'react'

const DEFAULT_CHARACTERS = ' .:-=+*#%@'

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_cellSize;
  uniform vec3 u_color;
  uniform vec3 u_bgColor;
  uniform sampler2D u_atlas;
  uniform float u_charCount;
  uniform vec2 u_atlasSize;
  uniform float u_glyphWidth;

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    // Which cell are we in?
    vec2 cell = floor(gl_FragCoord.xy / u_cellSize);
    vec2 cellCount = floor(u_resolution / u_cellSize);

    // UV within the cell (0..1)
    vec2 cellUV = fract(gl_FragCoord.xy / u_cellSize);
    // Flip Y so top of cell = top of glyph
    cellUV.y = 1.0 - cellUV.y;

    // Normalized cell position for vortex computation
    vec2 uv = (cell + 0.5) / cellCount;

    // --- Vortex math (matches Vortex.tsx) ---
    vec2 center = vec2(0.5, 0.5);
    vec2 d = uv - center;
    float aspect = u_resolution.x / u_resolution.y;
    d.x *= aspect;

    float r = length(d);
    float angle = atan(d.y, d.x);
    float rNorm = r / (aspect * 0.5);
    float logR = log(max(r, 0.001));

    float t = u_time * 0.15;
    float warp = sin(r * 10.0 - t * 2.5) * 0.12;

    float spiral = angle + logR * 2.5 - t * 1.8;
    float arms = sin(spiral * 3.0 + warp) * 0.5 + 0.5;
    arms = pow(arms, 0.5);

    float spiral2 = angle - logR * 1.8 + t * 0.9;
    float arms2 = sin(spiral2 * 2.0) * 0.5 + 0.5;

    float luminance = arms * 0.75 + arms2 * 0.25;
    luminance = smoothstep(0.2, 0.8, luminance);

    float centerFade = smoothstep(0.3, 0.85, rNorm);
    luminance *= centerFade;

    float edgeFade = 1.0 - smoothstep(0.85, 1.1, rNorm);
    luminance *= edgeFade;

    // --- Map luminance to character ---
    float charIdx = floor(clamp(luminance, 0.0, 1.0) * (u_charCount - 1.0) + 0.5);

    // Sample from atlas: each glyph occupies u_glyphWidth pixels horizontally
    float atlasX = (charIdx * u_glyphWidth + cellUV.x * u_glyphWidth) / u_atlasSize.x;
    float atlasY = cellUV.y;

    float glyphAlpha = texture2D(u_atlas, vec2(atlasX, atlasY)).a;

    // Film grain
    float grain = (hash(gl_FragCoord.xy + fract(u_time * 0.7)) * 2.0 - 1.0) * 0.15;

    // Composite glyph over background, then add grain
    vec3 color = mix(u_bgColor, u_color, step(0.3, glyphAlpha) * glyphAlpha);
    color += grain;

    gl_FragColor = vec4(color, 1.0);
  }
`

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

export function VortexASCII({
  className,
  children,
  colorA,
  colorB,
  darkColorA,
  darkColorB,
  cellSize = 10,
  characters = DEFAULT_CHARACTERS,
}: {
  className?: string
  children?: React.ReactNode
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
  cellSize?: number
  characters?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const colorsRef = useRef({
    fg: [1, 1, 1] as [number, number, number],
    bg: [0, 0, 0] as [number, number, number],
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

    // Build character atlas texture
    const atlas = buildAtlas(characters, cellSize)
    const texture = gl.createTexture()
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

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
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
    const cellSizeLoc = gl.getUniformLocation(program, 'u_cellSize')
    const colorLoc = gl.getUniformLocation(program, 'u_color')
    const atlasLoc = gl.getUniformLocation(program, 'u_atlas')
    const charCountLoc = gl.getUniformLocation(program, 'u_charCount')
    const atlasSizeLoc = gl.getUniformLocation(program, 'u_atlasSize')
    const glyphWidthLoc = gl.getUniformLocation(program, 'u_glyphWidth')

    const bgColorLoc = gl.getUniformLocation(program, 'u_bgColor')

    // Color scheme
    const updateColor = (isDark: boolean) => {
      colorsRef.current = {
        fg: hexToRgb(isDark ? (darkColorB ?? colorB ?? '#ffffff') : (colorB ?? '#000000')),
        bg: hexToRgb(isDark ? (darkColorA ?? colorA ?? '#000000') : (colorA ?? '#ffffff')),
      }
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    updateColor(mql.matches)
    const onColorSchemeChange = (e: MediaQueryListEvent) =>
      updateColor(e.matches)
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
      const { fg, bg } = colorsRef.current

      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)

      gl.enableVertexAttribArray(positionLoc)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

      gl.uniform2f(resolutionLoc, canvas.width, canvas.height)
      gl.uniform1f(timeLoc, time)
      gl.uniform1f(cellSizeLoc, cellSize * dpr)
      gl.uniform3f(colorLoc, fg[0], fg[1], fg[2])
      gl.uniform3f(bgColorLoc, bg[0], bg[1], bg[2])
      gl.uniform1f(charCountLoc, characters.length)
      gl.uniform2f(atlasSizeLoc, atlas.canvas.width, atlas.canvas.height)
      gl.uniform1f(glyphWidthLoc, atlas.glyphWidth)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(atlasLoc, 0)

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
      gl.deleteTexture(texture)
    }
  }, [colorA, colorB, darkColorA, darkColorB, cellSize, characters])

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
