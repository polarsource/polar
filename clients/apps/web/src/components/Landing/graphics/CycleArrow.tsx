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
    // (cols - 1) full verticals of length 2*halfH plus the lengthened
    // last vertical (2*halfH + r).
    const totalLen = cols * 2 * halfH + r + (cols - 1) * arcLen
    const snakeLen = colGap * 2.6
    const cycleLen = totalLen + snakeLen
    const cycleMs = 4500

    const headLen = colGap * 0.8
    const headAngle = Math.PI / 4
    const lastGoingUp = (cols - 1) % 2 === 0
    const rx = startX + (cols - 1) * colGap
    const ry = lastGoingUp ? cy - halfH - r : cy + halfH + r

    const railWidth = 2
    const bodyWidth = 2.5

    let raf = 0
    let start = 0

    const draw = (now: number) => {
      if (!start) start = now
      const t = ((now - start) / cycleMs) % 1
      const offset = -t * cycleLen

      ctx.clearRect(0, 0, size, size)

      // Faint full rail underneath, at the dim graphic token.
      ctx.strokeStyle = dimColor
      ctx.lineWidth = railWidth
      ctx.setLineDash([])
      ctx.stroke(path)

      // Arrowhead — part of the resting body, drawn at the same
      // dim color so it matches the rest of the static path. The
      // snake passes through it and pops the tip briefly.
      ctx.beginPath()
      ctx.moveTo(
        rx - Math.sin(headAngle) * headLen,
        ry + Math.cos(headAngle) * headLen,
      )
      ctx.lineTo(rx, ry)
      ctx.lineTo(
        rx + Math.sin(headAngle) * headLen,
        ry + Math.cos(headAngle) * headLen,
      )
      ctx.stroke()

      // Snake travelling along the rail, in the bright stroke color.
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = bodyWidth
      ctx.setLineDash([snakeLen, totalLen])
      ctx.lineDashOffset = offset
      ctx.stroke(path)

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
