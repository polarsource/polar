'use client'

import { useEffect, useRef } from 'react'
import { GraphicContainer } from './GraphicContainer'

/**
 * MagneticBubbles — a cluster of filled circles of varying size packed
 * inside a circular boundary. Each bubble slowly drifts (Brownian-like)
 * and repels its neighbours with an inverse-distance "magnetic" force.
 * Bubbles are also gently pulled toward the center so the cluster
 * stays cohesive.
 */

interface Bubble {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

const BUBBLE_COUNT = 48

// Pre-generate radii — mix of large, medium and small
const RADII_POOL = [
  0.07, 0.065, 0.06, 0.055, 0.05, 0.048, 0.045, 0.042, 0.04, 0.038, 0.035,
  0.033, 0.03, 0.028, 0.026, 0.024, 0.022, 0.021, 0.02, 0.019, 0.018, 0.017,
  0.016, 0.015, 0.014, 0.014, 0.013, 0.013, 0.012, 0.012, 0.011, 0.011, 0.01,
  0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01,
  0.01, 0.01,
]

export const MagneticBubbles = () => {
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

    // Bounding circle radius — visual cluster boundary
    const boundR = size * 0.46

    // Create bubbles with random initial positions near center
    const bubbles: Bubble[] = RADII_POOL.slice(0, BUBBLE_COUNT).map((rFrac) => {
      const a = Math.random() * Math.PI * 2
      const d = Math.random() * boundR * 0.5
      return {
        x: cx + Math.cos(a) * d,
        y: cy + Math.sin(a) * d,
        vx: 0,
        vy: 0,
        r: size * rFrac,
      }
    })

    // Physics constants
    const DAMPING = 0.96
    const CENTER_PULL = 0.0002
    const REPEL_STRENGTH = 0.4
    const DRIFT_STRENGTH = 0.25
    // Minimum gap between any two bubble edges (in pixels)
    const MIN_GAP = size * 0.035

    let lastTime: number | null = null

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      ctx.clearRect(0, 0, size, size)

      // --- Physics ---
      for (let i = 0; i < bubbles.length; i++) {
        const a = bubbles[i]

        // Random Brownian drift — keeps things alive
        a.vx += (Math.random() - 0.5) * DRIFT_STRENGTH
        a.vy += (Math.random() - 0.5) * DRIFT_STRENGTH

        // Pull toward center
        const dcx = cx - a.x
        const dcy = cy - a.y
        a.vx += dcx * CENTER_PULL
        a.vy += dcy * CENTER_PULL

        // Pairwise magnetic repulsion — inverse-distance force
        for (let j = i + 1; j < bubbles.length; j++) {
          const b = bubbles[j]
          const rx = a.x - b.x
          const ry = a.y - b.y
          const d2 = rx * rx + ry * ry
          const minDist = a.r + b.r
          const minDist2 = minDist * minDist

          // minDist includes the mandatory gap between edges
          const gappedDist = minDist + MIN_GAP
          const gappedDist2 = gappedDist * gappedDist

          if (d2 < gappedDist2 * 4 && d2 > 0.01) {
            const d = Math.sqrt(d2)
            const nx = rx / d
            const ny = ry / d

            // Force ramps smoothly: strong at overlap, fading at 2× gappedDist
            const t = 1 - d / (gappedDist * 2)
            const ease = t * t * t
            const force = ease * REPEL_STRENGTH

            // Mass-weighted (bigger bubbles move less)
            const mA = a.r * a.r
            const mB = b.r * b.r
            const total = mA + mB
            a.vx += nx * force * (mB / total)
            a.vy += ny * force * (mB / total)
            b.vx -= nx * force * (mA / total)
            b.vy -= ny * force * (mA / total)

            // Hard separation — enforces minimum gap
            if (d < gappedDist) {
              const overlap = (gappedDist - d) * 0.5
              a.x += nx * overlap * (mB / total)
              a.y += ny * overlap * (mB / total)
              b.x -= nx * overlap * (mA / total)
              b.y -= ny * overlap * (mA / total)
            }
          }
        }

        // Integrate
        a.x += a.vx * dt * 60
        a.y += a.vy * dt * 60
        a.vx *= DAMPING
        a.vy *= DAMPING

        // Bounding circle — keep bubble inside
        const distC = Math.hypot(a.x - cx, a.y - cy)
        const maxDist = boundR - a.r
        if (distC > maxDist && maxDist > 0) {
          const nx = (a.x - cx) / distC
          const ny = (a.y - cy) / distC
          a.x = cx + nx * maxDist
          a.y = cy + ny * maxDist
          const radVel = a.vx * nx + a.vy * ny
          if (radVel > 0) {
            a.vx -= radVel * nx
            a.vy -= radVel * ny
          }
        }
      }

      // --- Render ---
      ctx.strokeStyle = 'rgb(190, 190, 190)'
      for (const b of bubbles) {
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.stroke()
      }

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
