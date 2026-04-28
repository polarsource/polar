'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * RadialSpinner — radial spokes that draw along their path. The
 * leading tip extends outward with a bezier ease, and the trailing
 * start follows a few ms behind (also bezier-eased), creating a
 * moving segment that travels from inner to outer radius. Spokes
 * fire sequentially at a constant (linear) interval around the
 * circle, then loop.
 */

const SPOKE_COUNT = 18
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
    const PATH_DURATION = 0.8 // how long the tip takes to travel the path
    const TAIL_DELAY = 0.16 // trailing start follows the tip
    const FULL_CYCLE =
      (SPOKE_COUNT - 1) * SPOKE_INTERVAL + PATH_DURATION + TAIL_DELAY

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

      for (let i = 0; i < SPOKE_COUNT; i++) {
        const angle = (i / SPOKE_COUNT) * Math.PI * 2 - Math.PI / 2

        // Linear stagger — each spoke fires at a constant interval
        const spokeStart = i * SPOKE_INTERVAL

        // Leading tip: bezier-eased from 0→1 along the path
        const tipT = (cycleTime - spokeStart) / PATH_DURATION
        const tipProgress = easeOut(Math.max(0, Math.min(1, tipT)))

        // Trailing start: same bezier, delayed
        const tailT = (cycleTime - spokeStart - TAIL_DELAY) / PATH_DURATION
        const tailProgress = easeOut(Math.max(0, Math.min(1, tailT)))

        if (tipProgress <= 0) continue
        if (tailProgress >= 1) continue

        const r1 = innerR + spokeLen * tailProgress
        const r2 = innerR + spokeLen * tipProgress

        if (r2 - r1 < 0.5) continue

        const x1 = cx + Math.cos(angle) * r1
        const y1 = cy + Math.sin(angle) * r1
        const x2 = cx + Math.cos(angle) * r2
        const y2 = cy + Math.sin(angle) * r2

        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 2
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
