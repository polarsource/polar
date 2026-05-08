'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * CycleArrow — a meander/serpentine pattern with a snake-like
 * highlight that travels along the path. The arrowhead is pinned
 * to the top of the rightmost column so it stays in place while
 * the snake loops past it.
 */

export const CycleArrow = () => {
  const { ref: wrapperRef, inView } = useInView()
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      styles.getPropertyValue('--color-graphic-dim').trim() ||
      'rgb(204, 204, 204)'

    const cy = size / 2
    const cols = 7
    const colGap = size * 0.12
    const halfH = size * 0.16
    const r = colGap / 2

    const totalW = (cols - 1) * colGap
    const startX = (size - totalW) / 2

    const path = new Path2D()
    for (let i = 0; i < cols; i++) {
      const x = startX + i * colGap
      const goingUp = i % 2 === 0
      const isLast = i === cols - 1
      if (i === 0) {
        path.moveTo(x, goingUp ? cy + halfH : cy - halfH)
      }
      // Extend the last column by `r` so its tip lands at the same
      // y as the bend peaks, where the arrowhead will sit.
      const endY = goingUp ? cy - halfH : cy + halfH
      const extension = isLast ? (goingUp ? -r : r) : 0
      path.lineTo(x, endY + extension)
      if (!isLast) {
        const arcCx = x + colGap / 2
        path.arc(arcCx, endY, r, Math.PI, 0, !goingUp)
      }
    }

    const arcLen = Math.PI * r
    // (cols - 1) full verticals plus the lengthened last vertical.
    const meanderLen = cols * 2 * halfH + r + (cols - 1) * arcLen
    const headLen = colGap * 0.8
    const headAngle = Math.PI / 4
    // The animation fills the meander first, then continues into the
    // V flanks of the arrowhead (both sides in parallel).
    const totalLen = meanderLen + headLen
    const cycleMs = 10000

    const lastGoingUp = (cols - 1) % 2 === 0
    const rx = startX + (cols - 1) * colGap
    const ry = lastGoingUp ? cy - halfH - r : cy + halfH + r
    const flankYDir = lastGoingUp ? 1 : -1

    // Pre-build small Path2D objects for each flank so we can stroke
    // them independently with their own dash window.
    const leftFlank = new Path2D()
    leftFlank.moveTo(rx, ry)
    leftFlank.lineTo(
      rx - Math.sin(headAngle) * headLen,
      ry + flankYDir * Math.cos(headAngle) * headLen,
    )
    const rightFlank = new Path2D()
    rightFlank.moveTo(rx, ry)
    rightFlank.lineTo(
      rx + Math.sin(headAngle) * headLen,
      ry + flankYDir * Math.cos(headAngle) * headLen,
    )

    const railWidth = 2
    const bodyWidth = 2.5

    let raf = 0
    let start = 0

    const draw = (now: number) => {
      if (!start) start = now
      const t = ((now - start) / cycleMs) % 1

      // Fill (first half) → leading edge advances from 0 to totalLen.
      // Drain (second half) → trailing edge follows along to empty
      // the path. This produces a continuous "fill in, then clear"
      // loop with no jarring reset.
      let dashStart: number
      let dashEnd: number
      // Cubic-bezier ease-in-out applied to each half separately so
      // the leading edge accelerates into the path then settles, and
      // the trailing edge does the same on the way out.
      const ease = (x: number): number =>
        x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
      if (t < 0.5) {
        dashStart = 0
        dashEnd = ease(t / 0.5) * totalLen
      } else {
        dashStart = ease((t - 0.5) / 0.5) * totalLen
        dashEnd = totalLen
      }

      ctx.clearRect(0, 0, size, size)

      // Faint full rail underneath, at the dim graphic token.
      ctx.strokeStyle = dimColor
      ctx.lineWidth = railWidth
      ctx.setLineDash([])
      ctx.stroke(path)

      // Arrowhead V at the right end, drawn at the same dim color
      // so it reads as part of the static body. The bright trail
      // overlays it on top once it spills past the meander.
      ctx.stroke(leftFlank)
      ctx.stroke(rightFlank)

      // Bright trail filling the path from start toward the leading
      // edge. `source-atop` masks against the already-painted rail
      // + arrowhead so the trail can't spill past the static line.
      ctx.globalCompositeOperation = 'source-atop'
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = bodyWidth

      // Portion that falls on the meander itself.
      const meanderStart = Math.min(dashStart, meanderLen)
      const meanderEnd = Math.min(dashEnd, meanderLen)
      const meanderVisible = meanderEnd - meanderStart
      if (meanderVisible > 0.5) {
        ctx.setLineDash([meanderVisible, meanderLen + 1])
        ctx.lineDashOffset = -meanderStart
        ctx.stroke(path)
      }

      // Portion that has spilled past the apex into the V flanks.
      // Both flanks fill in parallel from the apex outward.
      const flankStart = Math.max(0, dashStart - meanderLen)
      const flankEnd = Math.max(0, dashEnd - meanderLen)
      const flankVisible = flankEnd - flankStart
      if (flankVisible > 0.5) {
        ctx.setLineDash([flankVisible, headLen + 1])
        ctx.lineDashOffset = -flankStart
        ctx.stroke(leftFlank)
        ctx.stroke(rightFlank)
      }

      ctx.globalCompositeOperation = 'source-over'

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [inView])

  return (
    <div ref={wrapperRef}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
