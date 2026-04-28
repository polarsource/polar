'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * CycleArrow — a meander/serpentine pattern: vertical lines
 * connected by rounded semicircular caps at top and bottom.
 * Static, minimal.
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

    const cy = size / 2
    const cols = 7
    const colGap = size * 0.12
    const halfH = size * 0.16
    const r = colGap / 2

    const totalW = (cols - 1) * colGap
    const startX = (size - totalW) / 2

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 2

    ctx.beginPath()

    for (let i = 0; i < cols; i++) {
      const x = startX + i * colGap
      const goingUp = i % 2 === 0

      if (i === 0) {
        ctx.moveTo(x, goingUp ? cy + halfH : cy - halfH)
      }

      ctx.lineTo(x, goingUp ? cy - halfH : cy + halfH)

      if (i < cols - 1) {
        const arcCx = x + colGap / 2
        const arcCy = goingUp ? cy - halfH : cy + halfH
        ctx.arc(arcCx, arcCy, r, Math.PI, 0, !goingUp)
      }
    }

    ctx.stroke()

    // Arrowhead — right end only, pointing up
    const headLen = colGap * 0.8
    const headAngle = Math.PI / 4
    const rx = startX + (cols - 1) * colGap
    const ry = cy - halfH
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
  }, [inView])

  return (
    <div ref={wrapperRef}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
