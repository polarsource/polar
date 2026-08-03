'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * SteppedRadial — a ring of radial ticks whose angular spacing is fixed
 * in screen space: tight on the right, opening into a wide gap on the
 * far left. The ticks advance through that distribution one pitch at a
 * time, like a turning mechanism — each step snaps every tick into the
 * slot vacated by its neighbour, so every resting frame shows the same
 * dense-right / sparse-left pattern.
 */

const SPOKE_COUNT = 14
const INNER_R_FRAC = 0.1
const OUTER_R_FRAC = 0.32

// Widest gap (far left) is (1 + GAP_SPREAD)× the tightest gap (right)
const GAP_SPREAD = 3
const WARP_SAMPLES = 720

const STEP_MOVE = 2 // seconds a single turn takes
const STEP_DWELL = 1 // rest between turns
const STEP_PERIOD = STEP_MOVE + STEP_DWELL

// Cubic-bezier ease-in-out (same curve as CycleArrow) — each turn
// accelerates out of rest and settles into the next position.
const ease = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

// Cumulative tick density around the circle: high density (small gaps)
// at angle 0 (right), low density at π (left). Maps a uniform parameter
// u ∈ [0, 2π) to a warped screen angle via inverse lookup.
const buildWarpTable = () => {
  const cumulative = new Float64Array(WARP_SAMPLES + 1)
  for (let k = 1; k <= WARP_SAMPLES; k++) {
    const midAngle = ((k - 0.5) / WARP_SAMPLES) * Math.PI * 2
    const gap = 1 + (GAP_SPREAD * (1 - Math.cos(midAngle))) / 2
    cumulative[k] = cumulative[k - 1] + 1 / gap
  }
  const scale = (Math.PI * 2) / cumulative[WARP_SAMPLES]
  for (let k = 0; k <= WARP_SAMPLES; k++) {
    cumulative[k] *= scale
  }
  return cumulative
}

const warpAngle = (cumulative: Float64Array, u: number) => {
  let lo = 0
  let hi = WARP_SAMPLES
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (cumulative[mid] <= u) lo = mid
    else hi = mid
  }
  const span = cumulative[hi] - cumulative[lo]
  const frac = span > 0 ? (u - cumulative[lo]) / span : 0
  return ((lo + frac) / WARP_SAMPLES) * Math.PI * 2
}

export const SteppedRadial = () => {
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

    const cx = size / 2
    const cy = size / 2
    const innerR = size * INNER_R_FRAC
    const outerR = size * OUTER_R_FRAC

    const cumulative = buildWarpTable()
    const pitch = (Math.PI * 2) / SPOKE_COUNT

    let lastTime: number | null = null
    let time = 0

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt

      const step = Math.floor(time / STEP_PERIOD)
      const stepTime = time - step * STEP_PERIOD
      const moveT = Math.min(1, stepTime / STEP_MOVE)
      const offset = (step + ease(moveT)) * pitch

      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 2

      for (let i = 0; i < SPOKE_COUNT; i++) {
        const u =
          (((i * pitch + offset) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
        const angle = warpAngle(cumulative, u)
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        ctx.beginPath()
        ctx.moveTo(cx + cos * innerR, cy + sin * innerR)
        ctx.lineTo(cx + cos * outerR, cy + sin * outerR)
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
