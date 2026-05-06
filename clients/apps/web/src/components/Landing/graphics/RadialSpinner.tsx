'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * RadialSpinner — radial spokes that alternate between two phases:
 *
 *   Round A (fill):  tail anchored at innerR, tip extends to outerR.
 *                    Each spoke persists once filled, so the ring
 *                    "fills in" one spoke at a time.
 *   Round B (empty): tip anchored at outerR, tail retracts outward
 *                    from innerR. Each spoke stays full until its
 *                    turn, then disappears from the inside out.
 *
 * Rounds A and B alternate forever. Both use the same bezier ease
 * and the same per-spoke stagger.
 */

const SPOKE_COUNT = 14
const INNER_R_FRAC = 0.1
const OUTER_R_FRAC = 0.32

// Cubic ease-out — fast start, gentle arrival
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export const RadialSpinner = () => {
  const { ref: wrapperRef, inView } = useInView()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!inView) return

    const dpr = window.devicePixelRatio ?? 1
    const size = canvas.offsetWidth
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const styles = getComputedStyle(canvas)
    const strokeColor =
      styles.getPropertyValue('--color-graphic-stroke').trim() ||
      'rgb(190, 190, 190)'
    const dimColor =
      styles.getPropertyValue('--color-graphic-dim').trim() || 'rgb(70, 70, 70)'

    const cx = size / 2
    const cy = size / 2
    const innerR = size * INNER_R_FRAC
    const outerR = size * OUTER_R_FRAC
    const spokeLen = outerR - innerR

    // Timing — linear sequence, bezier per-spoke path
    const SPOKE_INTERVAL = 0.2 // constant delay between spokes (linear)
    const PATH_DURATION = 0.8 // how long the tip/tail takes to travel
    const ROUND_DURATION = (SPOKE_COUNT - 1) * SPOKE_INTERVAL + PATH_DURATION
    const FULL_CYCLE = ROUND_DURATION * 2

    let lastTime: number | null = null
    let time = 0

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt

      ctx.clearRect(0, 0, size, size)

      // Faint background paths — always visible
      ctx.strokeStyle = dimColor
      ctx.lineWidth = 2
      for (let i = 0; i < SPOKE_COUNT; i++) {
        const angle = (i / SPOKE_COUNT) * Math.PI * 2 - Math.PI / 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR)
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR)
        ctx.stroke()
      }

      const cycleTime = time % FULL_CYCLE
      const isFillRound = cycleTime < ROUND_DURATION
      const roundTime = isFillRound ? cycleTime : cycleTime - ROUND_DURATION

      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 2

      for (let i = 0; i < SPOKE_COUNT; i++) {
        const angle = (i / SPOKE_COUNT) * Math.PI * 2 - Math.PI / 2

        // Linear stagger — each spoke fires at a constant interval
        const spokeStart = i * SPOKE_INTERVAL
        const localT = (roundTime - spokeStart) / PATH_DURATION
        const clamped = Math.max(0, Math.min(1, localT))
        const progress = easeOut(clamped)

        let r1: number
        let r2: number

        if (isFillRound) {
          // Hasn't fired yet this round — invisible until its stagger hits
          if (localT <= 0) continue
          r1 = innerR
          r2 = innerR + spokeLen * progress
        } else {
          // Already finished emptying — invisible for the rest of the round
          if (localT >= 1) continue
          r1 = innerR + spokeLen * progress
          r2 = outerR
        }

        if (r2 - r1 < 0.5) continue

        const x1 = cx + Math.cos(angle) * r1
        const y1 = cy + Math.sin(angle) * r1
        const x2 = cx + Math.cos(angle) * r2
        const y2 = cy + Math.sin(angle) * r2

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animRef.current)
  }, [inView])

  return (
    <div ref={wrapperRef}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
