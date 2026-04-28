'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * VolumetricSlices — WebGL implementation. Each horizontal slice through
 * an animated 4-metaball volume (clipped by a hard box) is rendered as
 * a quad in 3D space projected isometrically. The fragment shader
 * evaluates the CSG scalar field per pixel and emits either a smooth
 * antialiased contour line (where f ≈ 0) or writes depth only (where
 * f < 0) so closer slices occlude the strokes of deeper ones.
 */

// ---- Ball definitions (kept identical to the CPU version) ----
const BALLS = [
  { r: 0.38, a: [0.62, 0.55, 0.68], f: [0.3, 0.45, 0.38], p: [0.0, 1.1, 2.2] },
  { r: 0.35, a: [0.7, 0.6, 0.55], f: [0.45, 0.28, 0.5], p: [1.7, 0.4, 3.0] },
  { r: 0.36, a: [0.55, 0.7, 0.5], f: [0.38, 0.52, 0.31], p: [3.2, 2.7, 0.5] },
  { r: 0.33, a: [0.65, 0.5, 0.65], f: [0.55, 0.34, 0.44], p: [2.1, 3.8, 1.3] },
]

// ---- GLSL shaders ----
const VS = /* glsl */ `
attribute vec2 a_quad;                 // unit quad corners in [-0.5, 0.5]

uniform float u_sliceZ;
uniform vec2  u_halfXY;                // world-space half-extent for xy
uniform vec4  u_viewTrig;              // (cosYaw, sinYaw, cosPitch, sinPitch)
uniform float u_viewScale;             // world -> NDC scale
uniform float u_depthScale;            // world depth -> NDC depth scale

varying vec2 v_world;

void main() {
  vec2 xy = a_quad * u_halfXY * 2.0;
  v_world = xy;

  float cY = u_viewTrig.x, sY = u_viewTrig.y;
  float cP = u_viewTrig.z, sP = u_viewTrig.w;

  // Match the CPU isometric projection:
  //   Yaw around world Z (mixing x,y)
  //   Pitch around world X (mixing y,z)
  //   World Z is "up" — slices stack along Z.
  float x1 = xy.x * cY + xy.y * sY;
  float y1 = -xy.x * sY + xy.y * cY;
  float y2 = y1 * cP - u_sliceZ * sP;
  float z2 = y1 * sP + u_sliceZ * cP;

  // Depth uses ONLY slice Z so every pixel within a slice shares one
  // depth value. Otherwise adjacent slices' per-pixel depths overlap
  // (because pitch tilts the plane), causing the depth test to produce
  // dashed/broken occlusion along lines. This gives each slice a single
  // discrete depth layer and clean front-to-back culling.
  float sliceDepth = -u_sliceZ * u_depthScale;

  gl_Position = vec4(
    x1 * u_viewScale,
    y2 * u_viewScale,
    sliceDepth,
    1.0
  );
}
`

const FS = /* glsl */ `
#extension GL_OES_standard_derivatives : enable
precision highp float;

uniform float u_time;
uniform float u_sliceZ;
uniform vec3  u_lineColor;
uniform float u_lineAlpha;

// Ball uniforms: 4 balls × (radius, 3 amp, 3 freq, 3 phase) = 4 × 10 floats
uniform float u_ballR[4];
uniform vec3  u_ballA[4];
uniform vec3  u_ballF[4];
uniform vec3  u_ballP[4];

varying vec2 v_world;

// Rounded box SDF (iquilezles.org/articles/distfunctions)
// Radius r subtracted from the half-extents defines rounded corners/edges.
float boxSdf(vec3 p, vec3 h, float r) {
  vec3 d = abs(p) - h + vec3(r);
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - r;
}

float metaSum(vec3 p) {
  float sum = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 c = sin(u_time * u_ballF[i] + u_ballP[i]) * u_ballA[i];
    vec3 d = p - c;
    sum += u_ballR[i] * u_ballR[i] / (dot(d, d) + 1e-4);
  }
  return sum;
}

void main() {
  vec3 p = vec3(v_world, u_sliceZ);

  float metaSdf = 1.0 - metaSum(p);                       // < 0 inside blob
  float boxS    = boxSdf(p, vec3(0.55, 0.55, 0.7), 0.06);  // < 0 inside box (rounded)

  // Outside the intersection → no color, no depth
  if (max(metaSdf, boxS) > 0.0) discard;

  // Each SDF's contour is rendered independently using its own smooth
  // gradient, avoiding the max() ridge artefact where the two surfaces
  // meet. The box SDF's gradient is a clean axis-aligned vector along
  // each face, giving a crisp straight segment; the metaball gradient
  // is smooth, giving a soft curve. Both are combined with max().
  vec2 gm = vec2(dFdx(metaSdf), dFdy(metaSdf));
  float metaPx = abs(metaSdf) / max(length(gm), 1e-4);
  float metaLine = 1.0 - smoothstep(1.2, 2.2, metaPx);

  vec2 gb = vec2(dFdx(boxS), dFdy(boxS));
  float boxPx = abs(boxS) / max(length(gb), 1e-4);
  float boxLine = 1.0 - smoothstep(1.2, 2.2, boxPx);

  float line = max(metaLine, boxLine);

  if (line > 0.02) {
    gl_FragColor = vec4(u_lineColor, u_lineAlpha * line);
  } else {
    // Inside solid but not on the line — write depth only so closer
    // slices can occlude deeper contour strokes. Transparent color
    // contributes nothing visually.
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  }
}
`

const compile = (gl: WebGLRenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile error')
  }
  return s
}

const link = (gl: WebGLRenderingContext, vs: string, fs: string) => {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? 'program link error')
  }
  return p
}

export const VolumetricSlices = () => {
  const { ref: wrapperRef, inView } = useInView()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      depth: true,
      antialias: true,
    })
    if (!gl) return
    if (!inView) return

    // fwidth requires derivatives extension in WebGL1
    gl.getExtension('OES_standard_derivatives')

    const dpr = window.devicePixelRatio ?? 1
    const resize = () => {
      const w = canvas.offsetWidth * dpr
      const h = canvas.offsetHeight * dpr
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const prog = link(gl, VS, FS)
    gl.useProgram(prog)

    const aQuad = gl.getAttribLocation(prog, 'a_quad')
    const uSliceZ = gl.getUniformLocation(prog, 'u_sliceZ')
    const uHalfXY = gl.getUniformLocation(prog, 'u_halfXY')
    const uViewTrig = gl.getUniformLocation(prog, 'u_viewTrig')
    const uViewScale = gl.getUniformLocation(prog, 'u_viewScale')
    const uDepthScale = gl.getUniformLocation(prog, 'u_depthScale')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uLineColor = gl.getUniformLocation(prog, 'u_lineColor')
    const uLineAlpha = gl.getUniformLocation(prog, 'u_lineAlpha')

    // Quad VBO — two triangles via a triangle strip
    const quadBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
      gl.STATIC_DRAW,
    )
    gl.enableVertexAttribArray(aQuad)
    gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0)

    // Seed — different on every mount/refresh so each instance animates
    // from a different starting configuration.
    const seed = Math.random() * 1000

    // Ball uniforms (static per program). Seed is added to each ball's
    // phase offsets so the Lissajous paths start in fresh positions.
    const rArr = new Float32Array(BALLS.map((b) => b.r))
    const aArr = new Float32Array(BALLS.flatMap((b) => b.a))
    const fArr = new Float32Array(BALLS.flatMap((b) => b.f))
    const pArr = new Float32Array(
      BALLS.flatMap((b) => b.p.map((v) => v + seed)),
    )
    gl.uniform1fv(gl.getUniformLocation(prog, 'u_ballR[0]'), rArr)
    gl.uniform3fv(gl.getUniformLocation(prog, 'u_ballA[0]'), aArr)
    gl.uniform3fv(gl.getUniformLocation(prog, 'u_ballF[0]'), fArr)
    gl.uniform3fv(gl.getUniformLocation(prog, 'u_ballP[0]'), pArr)

    // View parameters — classical isometric
    const yaw = Math.PI / 4
    const pitch = -Math.atan(Math.SQRT1_2)
    gl.uniform4f(
      uViewTrig,
      Math.cos(yaw),
      Math.sin(yaw),
      Math.cos(pitch),
      Math.sin(pitch),
    )
    // world extent ±0.62 xy, ±0.78 z; scaled down to leave margin inside
    // the container, matching the CPU version's visual footprint
    gl.uniform1f(uViewScale, 0.9)
    gl.uniform1f(uDepthScale, 0.5)
    gl.uniform2f(uHalfXY, 0.62, 0.62)
    gl.uniform3f(uLineColor, 190 / 255, 190 / 255, 190 / 255)

    // Blending: standard alpha with premultiplied off; depth test enabled
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    // Slice stack
    const sliceCount = 24
    const zMin = -0.78
    const zMax = 0.78

    let time = 0
    let lastTime: number | null = null

    const frame = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt * 1.2 // speed matching the old code

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      gl.uniform1f(uTime, time)

      // Opaque stroke
      gl.uniform1f(uLineAlpha, 1.0)

      // Render FRONT-to-BACK so depth test correctly culls deeper
      // slices' contours at pixels already filled by closer slices.
      for (let s = sliceCount - 1; s >= 0; s--) {
        const t = s / (sliceCount - 1)
        const z = zMin + t * (zMax - zMin)
        gl.uniform1f(uSliceZ, z)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }

      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      gl.deleteBuffer(quadBuf)
      gl.deleteProgram(prog)
    }
  }, [inView])

  return (
    <div ref={wrapperRef}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
