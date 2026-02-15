'use client'

import React, { useEffect, useRef } from 'react'

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_pixelSize;
  uniform vec3 u_colorA;
  uniform vec3 u_colorB;

  // 8x8 Bayer matrix (normalized to 0-1)
  float bayer8(vec2 p) {
    ivec2 ip = ivec2(mod(p, 8.0));
    int index = ip.x + ip.y * 8;

    // Bayer 8x8 thresholds
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

    // Gradient pattern - radial with subtle animation
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(uv, center);

    float wave1 = sin(dist * 6.0 - u_time * 0.3) * 0.5 + 0.5;
    float wave2 = sin(uv.x * 4.0 + u_time * 0.2) * 0.3;
    float wave3 = cos(uv.y * 3.0 - u_time * 0.15) * 0.2;

    float luminance = wave1 + wave2 + wave3;
    luminance = clamp(luminance, 0.0, 1.0);

    // Apply Bayer dithering
    float threshold = bayer8(pixelCoord);
    float dithered = step(threshold, luminance);

    vec3 color = mix(u_colorA, u_colorB, dithered);
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

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

export function DitherShader({
  className,
  colorA,
  colorB,
  darkColorA,
  darkColorB,
  pixelSize = 4,
}: {
  className?: string
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
  pixelSize?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const colorsRef = useRef({ a: [0, 0, 0] as number[], b: [1, 1, 1] as number[] })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      antialias: false,
      preserveDrawingBuffer: false,
    })
    if (!gl) return

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
    const pixelSizeLoc = gl.getUniformLocation(program, 'u_pixelSize')
    const colorALoc = gl.getUniformLocation(program, 'u_colorA')
    const colorBLoc = gl.getUniformLocation(program, 'u_colorB')

    const updateColors = (isDark: boolean) => {
      const a = isDark ? (darkColorA ?? colorA ?? '#ffffff') : (colorA ?? '#000000')
      const b = isDark ? (darkColorB ?? colorB ?? '#000000') : (colorB ?? '#ffffff')
      colorsRef.current = { a: hexToRgb(a), b: hexToRgb(b) }
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    updateColors(mql.matches)

    const onColorSchemeChange = (e: MediaQueryListEvent) => {
      updateColors(e.matches)
    }
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

    const render = () => {
      const time = (performance.now() - startTime) / 1000
      const { a, b } = colorsRef.current

      gl.useProgram(program)

      gl.enableVertexAttribArray(positionLoc)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

      gl.uniform2f(resolutionLoc, canvas.width, canvas.height)
      gl.uniform1f(timeLoc, time)
      gl.uniform1f(pixelSizeLoc, pixelSize * (window.devicePixelRatio || 1))
      gl.uniform3f(colorALoc, a[0], a[1], a[2])
      gl.uniform3f(colorBLoc, b[0], b[1], b[2])

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
    }
  }, [colorA, colorB, darkColorA, darkColorB, pixelSize])

  return <canvas ref={canvasRef} className={className} />
}
