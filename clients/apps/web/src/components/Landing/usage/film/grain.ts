/**
 * Film grain, drawn by a WebGL layer that is always the topmost thing on the stage. A pure function of the frame
 * number, so a given moment always gets the same grain. (films/metering-video/src/engine/grain.ts)
 */
export interface GrainOpts {
  amount: number
  blend: 'overlay' | 'normal'
  size: number
  fps: number
}

const VERT = `attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`
const FRAG = `
precision highp float;
uniform float uFrame;
uniform float uAmount;
uniform float uSize;
uniform float uOverlay;
float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
void main() {
  vec2 cell = floor(gl_FragCoord.xy / uSize);
  float n = hash(cell + uFrame * vec2(17.13, 91.7)) + hash(cell * 1.37 + uFrame * vec2(53.1, 7.9)) - 1.0;
  if (uOverlay > 0.5) {
    gl_FragColor = vec4(vec3(0.5 + n * uAmount), 1.0);
    return;
  }
  float a = abs(n) * uAmount;
  gl_FragColor = vec4(vec3(step(0.0, n)) * a, a);
}`

/** Adds the grain canvas to `stage` and returns a function that draws it for a given time. */
export function createGrain(
  stage: HTMLElement,
  W: number,
  H: number,
  opts: GrainOpts,
): (t: number) => void {
  if (!opts.amount) return () => {}
  const canvas = document.createElement('canvas')
  // the stage is scaled down to fit the page, so grain is drawn at stage size, not device pixels
  canvas.width = W
  canvas.height = H
  canvas.className = `pointer-events-none absolute left-0 top-0 z-[1000] h-[1080px] w-[1920px] ${opts.blend === 'overlay' ? 'mix-blend-overlay' : ''}`
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
    antialias: false,
  })
  if (!gl) return () => {}
  stage.appendChild(canvas)

  const program = gl.createProgram()!
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ] as const) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  )
  const at = gl.getAttribLocation(program, 'p')
  gl.enableVertexAttribArray(at)
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.uniform1f(gl.getUniformLocation(program, 'uAmount'), opts.amount)
  gl.uniform1f(gl.getUniformLocation(program, 'uSize'), opts.size)
  gl.uniform1f(
    gl.getUniformLocation(program, 'uOverlay'),
    opts.blend === 'overlay' ? 1 : 0,
  )
  const uFrame = gl.getUniformLocation(program, 'uFrame')

  let last = -1
  return (t) => {
    const frame = Math.floor(t * opts.fps + 1e-6)
    if (frame === last) return
    last = frame
    gl.uniform1f(uFrame, frame % 1024)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
