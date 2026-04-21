'use client'

import { useEffect, useRef } from 'react'
import { GraphicContainer } from './GraphicContainer'

/**
 * VectorField — grid of arrow segments on a disk, oriented by a
 * configurable vector field formula. Static render, no animation.
 *
 * The field function receives normalised polar coords (r, θ) and
 * returns the angle of the arrow at that point.
 */

export type FieldFn = (r: number, theta: number) => number

// Default: uniform rightward field
const uniformField: FieldFn = () => 0

interface VectorFieldProps {
  field?: FieldFn
  cols?: number
  rows?: number
}

export const VectorField = ({
  field = uniformField,
  cols = 14,
  rows = 14,
}: VectorFieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    const padding = size * 0.08
    const innerSize = size - padding * 2
    const cellW = innerSize / cols
    const cellH = innerSize / rows

    const half = Math.min(cellW, cellH) * 0.25

    const styles = getComputedStyle(canvas)
    const strokeColor =
      styles.getPropertyValue('--color-graphic-stroke').trim() ||
      'rgb(190, 190, 190)'

    ctx.clearRect(0, 0, size, size)
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.strokeStyle = strokeColor

    for (let ci = 0; ci < cols; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        const u = ((ci + 0.5) / cols - 0.5) * 2
        const v = ((ri + 0.5) / rows - 0.5) * 2

        const r = Math.hypot(u, v)
        if (r > 1) continue

        const theta = Math.atan2(v, u)
        const angle = field(r, theta)

        const ca = Math.cos(angle)
        const sa = Math.sin(angle)
        const dx = ca * half
        const dy = sa * half

        const cx = padding + cellW * (ci + 0.5)
        const cy = padding + cellH * (ri + 0.5)

        // Shaft
        ctx.beginPath()
        ctx.moveTo(cx - dx, cy - dy)
        ctx.lineTo(cx + dx, cy + dy)
        ctx.stroke()

        // V-shaped arrowhead at the tip
        const headLen = half
        const headAngle = Math.PI / 4
        const tipX = cx + dx
        const tipY = cy + dy
        ctx.beginPath()
        ctx.moveTo(
          tipX - Math.cos(angle - headAngle) * headLen,
          tipY - Math.sin(angle - headAngle) * headLen,
        )
        ctx.lineTo(tipX, tipY)
        ctx.lineTo(
          tipX - Math.cos(angle + headAngle) * headLen,
          tipY - Math.sin(angle + headAngle) * headLen,
        )
        ctx.stroke()
      }
    }
  }, [field, cols, rows])

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  )
}
