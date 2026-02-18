export const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

export function createShader(
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

export function createProgram(
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

export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

export interface WebGLHandles {
  gl: WebGLRenderingContext
  program: WebGLProgram
  positionBuffer: WebGLBuffer
  positionLoc: number
}

export interface WebGLSetupOptions {
  antialias?: boolean
  preserveDrawingBuffer?: boolean
  premultipliedAlpha?: boolean
  alpha?: boolean
}

export function setupWebGL(
  canvas: HTMLCanvasElement,
  fragmentSource: string,
  options: WebGLSetupOptions = {},
): WebGLHandles | null {
  const gl = canvas.getContext('webgl', {
    antialias: options.antialias ?? false,
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    premultipliedAlpha: options.premultipliedAlpha ?? false,
    alpha: options.alpha ?? true,
  })
  if (!gl) return null

  if (options.alpha !== false) {
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)
  }

  const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  if (!vs || !fs) return null

  const program = createProgram(gl, vs, fs)
  if (!program) return null

  const positionBuffer = gl.createBuffer()
  if (!positionBuffer) return null
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  )

  const positionLoc = gl.getAttribLocation(program, 'a_position')

  return { gl, program, positionBuffer, positionLoc }
}

export interface ColorDefaults {
  light: { a: string; b: string }
  dark: { a: string; b: string }
}

export interface EffectInstance {
  draw(gl: WebGLRenderingContext, canvas: HTMLCanvasElement, time: number, colors: { a: number[]; b: number[] }): void
  cleanup?(): void
}

export interface Effect {
  buildShader(geometryGlsl: string): string
  init(gl: WebGLRenderingContext, program: WebGLProgram): EffectInstance
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
  colorDefaults?: ColorDefaults
}

export interface RenderLoopOptions {
  handles: WebGLHandles
  canvas: HTMLCanvasElement
  colorA?: string
  colorB?: string
  darkColorA?: string
  darkColorB?: string
  colorDefaults?: ColorDefaults
  draw: (gl: WebGLRenderingContext, time: number, colors: { a: number[]; b: number[] }) => void
}

export function createRenderLoop(options: RenderLoopOptions): () => void {
  const { handles, canvas, draw } = options
  const { gl, positionBuffer, positionLoc } = handles

  const defaults = options.colorDefaults ?? {
    light: { a: '#ffffff', b: '#000000' },
    dark: { a: '#000000', b: '#ffffff' },
  }

  const colorsRef = { a: [0, 0, 0] as number[], b: [1, 1, 1] as number[] }

  const updateColors = (isDark: boolean) => {
    const a = isDark
      ? (options.darkColorA ?? options.colorA ?? defaults.dark.a)
      : (options.colorA ?? defaults.light.a)
    const b = isDark
      ? (options.darkColorB ?? options.colorB ?? defaults.dark.b)
      : (options.colorB ?? defaults.light.b)
    colorsRef.a = hexToRgb(a)
    colorsRef.b = hexToRgb(b)
  }

  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  updateColors(mql.matches)

  const onColorSchemeChange = (e: MediaQueryListEvent) => updateColors(e.matches)
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
  let rafId = 0

  const render = () => {
    const time = (performance.now() - startTime) / 1000

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(handles.program)

    gl.enableVertexAttribArray(positionLoc)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    draw(gl, time, colorsRef)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    rafId = requestAnimationFrame(render)
  }

  rafId = requestAnimationFrame(render)

  return () => {
    cancelAnimationFrame(rafId)
    observer.disconnect()
    mql.removeEventListener('change', onColorSchemeChange)
    gl.deleteProgram(handles.program)
    gl.deleteBuffer(positionBuffer)
  }
}
