'use client'

import { useEffect, useRef } from 'react'
import { GraphicContainer } from './GraphicContainer'

/**
 * PhyllotaxisSunflower — golden-angle phyllotactic arrangement of dots.
 * An orbiting circle acts as a repellent force: dots within the
 * influence radius get pushed outward from the orbiter's center,
 * creating a moving "hole" that sweeps through the sunflower.
 *
 * Port of polarsource/polar PhyllotaxisSunflower with mouse interaction
 * replaced by the orbiter, simplified to canvas 2D (no ASCII atlas,
 * no WebGL, no theming).
 */

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)
const LERP = 0.03
const ALPHA_LERP = 0.2
const CHARS = '$€¥£ '
const N_CHARS = CHARS.length

interface Dot {
  bx: number // base (target when unperturbed) x
  by: number
  x: number // current rendered position
  y: number
  charIdx: number // last character index shown, -1 = none
  charAlpha: number // eased opacity of the character
}

const generatePhyllotaxis = (
  count: number,
  spread: number,
  cx: number,
  cy: number,
): Dot[] =>
  Array.from({ length: count }, (_, i) => {
    const a = (i + 1) * GOLDEN_ANGLE
    const r = spread * Math.sqrt(i + 1)
    const bx = cx + r * Math.cos(a)
    const by = cy + r * Math.sin(a)
    return { bx, by, x: bx, y: by, charIdx: -1, charAlpha: 0 }
  })

export const PhyllotaxisSunflower = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio ?? 1
    const size = canvas.offsetWidth
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2

    // Crop sunflower to a circle that leaves a margin
    const maxR = size / 2 - size * 0.1
    const spread = size / 37.5
    const dots = generatePhyllotaxis(400, spread, cx, cy).filter(
      (d) => Math.hypot(d.bx - cx, d.by - cy) <= maxR,
    )

    // Orbiter: circles inside the sunflower at ~60% of the dot cloud radius
    const orbitR = maxR * 0.6
    const orbiterRadius = size * 0.006

    // Repel field parameters (ported from original)
    const influenceR = size * 0.5
    const maxDisp = size * 0.1

    // Character effect
    const asciiR = size * 0.16
    const asciiPt = Math.max(5, size * 0.014)
    const mono = getComputedStyle(canvas).getPropertyValue('--font-mono').trim() || 'monospace'
    ctx.font = `${asciiPt}px ${mono}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    let angle = 0
    let lastTime: number | null = null
    // Framerate-independent angular speed (rad/sec)
    const ANG_SPEED = 0.25

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      angle += ANG_SPEED * dt

      ctx.clearRect(0, 0, size, size)

      const ox = cx + Math.cos(angle) * orbitR
      const oy = cy + Math.sin(angle) * orbitR

      // --- Lerp dots toward their target + update character state ---
      for (const d of dots) {
        let tx = d.bx
        let ty = d.by

        const dx = d.bx - ox
        const dy = d.by - oy
        const dist = Math.hypot(dx, dy)

        if (dist > 0.01 && dist < influenceR) {
          const t = 1 - dist / influenceR
          const ease = t * t * t
          const disp = ease * maxDisp
          tx = d.bx + (dx / dist) * disp
          ty = d.by + (dy / dist) * disp
        }

        d.x += (tx - d.x) * LERP
        d.y += (ty - d.y) * LERP

        // Character zone: dots close to the orbiter switch to ASCII
        const liveDist = Math.hypot(d.x - ox, d.y - oy)
        const inZone = liveDist < asciiR
        if (inZone) {
          const ct = 1 - liveDist / asciiR
          d.charIdx = Math.min(N_CHARS - 1, Math.floor(ct * N_CHARS))
        }
        const targetAlpha = inZone ? 1 : 0
        d.charAlpha += (targetAlpha - d.charAlpha) * ALPHA_LERP
      }

      // --- Render dots ---
      // Pre-blended grays (no alpha): bg ≈ rgb(23,23,23)
      for (const d of dots) {
        if (d.charAlpha > 0.02 && d.charIdx >= 0) {
          const g = Math.round(23 + 167 * d.charAlpha)
          ctx.fillStyle = `rgb(${g}, ${g}, ${g})`
          ctx.fillText(CHARS[d.charIdx], d.x, d.y)
        } else {
          ctx.fillStyle = 'rgb(190, 190, 190)'
          ctx.beginPath()
          ctx.arc(d.x, d.y, 1.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // --- Orbiting repellent ---
      ctx.beginPath()
      ctx.arc(ox, oy, orbiterRadius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgb(190, 190, 190)'
      ctx.fill()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  )
}
