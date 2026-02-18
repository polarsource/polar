'use client'

import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef } from 'react'
import { buildAtlas } from './shaders/pass/ascii'

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)
const LERP = 0.06
const ALPHA_LERP = 0.2
const CHARS = '.;:-~+<>1742356890$€£%#@'
const N_CHARS = CHARS.length
const ASCII_RADIUS = 400
const ASCII_PT = 20

export interface Dot {
  x: number
  y: number
  r: number
}

export function generatePhyllotaxis(
  count: number,
  spread: number,
  cx: number,
  cy: number,
): Dot[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i + 1) * GOLDEN_ANGLE
    const r = spread * Math.sqrt(i + 1)
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), r: 2 }
  })
}

// ── WebGL helpers ─────────────────────────────────────────────────────────────

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile error')
  return s
}

function linkProgram(
  gl: WebGLRenderingContext,
  vs: string,
  fs: string,
): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(p) ?? 'program link error')
  return p
}

// ── Shaders ───────────────────────────────────────────────────────────────────
// VBO layout per dot: [ x, y, radius, charIndex, charAlpha ]

const VS = /* glsl */ `
  precision mediump float;

  attribute vec2  a_pos;
  attribute float a_rad;
  attribute float a_char;
  attribute float a_alpha;

  uniform vec2  u_res;
  uniform float u_dpr;

  varying float v_char;
  varying float v_alpha;

  void main() {
    vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
    clip.y = -clip.y;
    gl_Position = vec4(clip, 0.0, 1.0);

    // Blend point size smoothly from circle size → ASCII size as alpha rises
    float circSz = max(2.0, a_rad * 2.0);
    float asciiSz = ${ASCII_PT}.0;
    float sz = mix(circSz, asciiSz, smoothstep(0.0, 1.0, a_alpha));
    gl_PointSize = min(256.0, sz * u_dpr);

    v_char  = a_char;
    v_alpha = a_alpha;
  }
`

const FS = /* glsl */ `
  precision mediump float;

  uniform sampler2D u_atlas;
  uniform float     u_nChars;
  uniform vec3      u_fg;

  varying float v_char;
  varying float v_alpha;

  void main() {
    vec2 pc = gl_PointCoord;

    if (v_char < 0.0) {
      // Plain circle dot
      if (length(pc - 0.5) > 0.5) discard;
      gl_FragColor = vec4(u_fg, 1.0);
    } else {
      // ASCII glyph, faded by v_alpha
      float idx = floor(v_char + 0.5);
      vec2  uv  = vec2((idx + pc.x) / u_nChars, pc.y);
      float a   = texture2D(u_atlas, uv).a * v_alpha;
      if (a < 0.02) discard;
      gl_FragColor = vec4(u_fg, a);
    }
  }
`

// ── Component ─────────────────────────────────────────────────────────────────

export function PhyllotaxisSunflower({ size = 400 }: { size?: number }) {
  const { resolvedTheme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const darkRef = useRef(resolvedTheme === 'dark')

  useEffect(() => {
    darkRef.current = resolvedTheme === 'dark'
  }, [resolvedTheme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr

    const glRaw = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
    })
    if (!glRaw) return
    const gl: WebGLRenderingContext = glRaw

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.viewport(0, 0, canvas.width, canvas.height)

    // ── Program ──────────────────────────────────────────────────────────────
    const prog = linkProgram(gl, VS, FS)
    gl.useProgram(prog)

    const aPos = gl.getAttribLocation(prog, 'a_pos')
    const aRad = gl.getAttribLocation(prog, 'a_rad')
    const aChar = gl.getAttribLocation(prog, 'a_char')
    const aAlpha = gl.getAttribLocation(prog, 'a_alpha')
    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uDpr = gl.getUniformLocation(prog, 'u_dpr')
    const uFg = gl.getUniformLocation(prog, 'u_fg')
    const uAtlas = gl.getUniformLocation(prog, 'u_atlas')
    const uNChars = gl.getUniformLocation(prog, 'u_nChars')

    gl.uniform2f(uRes, size, size)
    gl.uniform1f(uDpr, dpr)
    gl.uniform1i(uAtlas, 0)
    gl.uniform1f(uNChars, N_CHARS)

    // ── Atlas texture ─────────────────────────────────────────────────────────
    const atlas = buildAtlas(CHARS, ASCII_PT)
    const atlasTex = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, atlasTex)
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

    // ── Phyllotaxis dots ──────────────────────────────────────────────────────
    const cx = size / 2
    const cy = size / 2
    // Extra padding so repelled dots never clip: maxDisp = size*0.08, ASCII_PT/2 ≈ 11px
    const maxR = size / 2 - size * 0.15
    const baseDots = generatePhyllotaxis(300, size / 37.5, cx, cy).filter(
      (d) => Math.hypot(d.x - cx, d.y - cy) <= maxR,
    )
    const N = baseDots.length
    const dots: Dot[] = baseDots.map((d) => ({ ...d }))

    // Per-dot ASCII fade state
    const charAlphas = new Float32Array(N) // current lerped alpha (0..1)
    const lastCharIdx = new Int32Array(N).fill(-1) // last assigned char, kept for fade-out

    // ── VBO: x, y, radius, charIndex, charAlpha (5 floats × N) ───────────────
    const STRIDE = 5
    const data = new Float32Array(N * STRIDE)

    const buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW)

    const B = STRIDE * 4 // byte stride
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, B, 0)
    gl.enableVertexAttribArray(aRad)
    gl.vertexAttribPointer(aRad, 1, gl.FLOAT, false, B, 8)
    gl.enableVertexAttribArray(aChar)
    gl.vertexAttribPointer(aChar, 1, gl.FLOAT, false, B, 12)
    gl.enableVertexAttribArray(aAlpha)
    gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, B, 16)

    const influenceR = size * 2
    const maxDisp = size * 0.08

    // ── Render loop ───────────────────────────────────────────────────────────
    let rafId = 0

    function tick() {
      const mouse = mouseRef.current
      const dark = darkRef.current

      // — ASCII zone: which dots are currently inside the cursor radius —
      const charMap = new Map<number, number>()
      if (mouse) {
        for (let i = 0; i < N; i++) {
          const dist = Math.hypot(dots[i].x - mouse.x, dots[i].y - mouse.y)
          if (dist < ASCII_RADIUS) {
            const t = 1 - dist / ASCII_RADIUS
            charMap.set(i, Math.min(N_CHARS - 1, Math.floor(t * N_CHARS)))
          }
        }
      }

      // — Lerp positions + fade alphas —
      for (let i = 0; i < N; i++) {
        const base = baseDots[i]
        let tx = base.x,
          ty = base.y,
          tr = base.r

        if (mouse) {
          const dx = base.x - mouse.x
          const dy = base.y - mouse.y
          const dist = Math.hypot(dx, dy)
          if (dist > 0.01 && dist < influenceR) {
            const t = 1 - dist / influenceR
            const ease = t * t * t
            const disp = ease * maxDisp
            tx = base.x + (dx / dist) * disp
            ty = base.y + (dy / dist) * disp
            tr = base.r + ease * 4
          }
        }

        dots[i].x += (tx - dots[i].x) * LERP
        dots[i].y += (ty - dots[i].y) * LERP
        dots[i].r += (tr - dots[i].r) * LERP

        // Update char alpha and remember last assigned char for smooth fade-out
        const inZone = charMap.has(i)
        if (inZone) lastCharIdx[i] = charMap.get(i) as number
        const targetAlpha = inZone ? 1 : 0
        charAlphas[i] += (targetAlpha - charAlphas[i]) * ALPHA_LERP
      }

      // — Fill VBO —
      for (let i = 0; i < N; i++) {
        const o = i * STRIDE
        data[o] = dots[i].x
        data[o + 1] = dots[i].y
        data[o + 2] = dots[i].r
        // Use lastCharIdx while alpha > 0 so the char is visible during fade-out;
        // fall back to -1 (circle) only once fully faded
        data[o + 3] = charAlphas[i] > 0.02 ? lastCharIdx[i] : -1
        data[o + 4] = charAlphas[i]
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data)

      const v = dark ? 1.0 : 0.0
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform3f(uFg, v, v, v)
      gl.drawArrays(gl.POINTS, 0, N)

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      gl.deleteBuffer(buf)
      gl.deleteTexture(atlasTex)
      gl.deleteProgram(prog)
    }
  }, [size])

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      mouseRef.current = {
        x: (e.clientX - rect.left) * (size / rect.width),
        y: (e.clientY - rect.top) * (size / rect.height),
      }
    },
    [size],
  )

  const onLeave = useCallback(() => {
    mouseRef.current = null
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="max-w-full cursor-none"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    />
  )
}
