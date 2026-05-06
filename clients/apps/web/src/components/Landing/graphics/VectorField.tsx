'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * VectorField — grid of arrow segments on a disk. When hovered,
 * all arrows point toward the mouse cursor. When not hovered,
 * arrows use the provided field function. Transitions are lerped
 * for smooth enter/leave.
 */

export type FieldFn = (r: number, theta: number) => number

const uniformField: FieldFn = () => 0

// Lerp angle via shortest arc
const lerpAngle = (from: number, to: number, t: number) => {
  const diff = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return from + diff * t
}

interface VectorFieldProps {
  field?: FieldFn
  cols?: number
  rows?: number
}

export const VectorField = ({
  field = uniformField,
  cols = 4,
  rows = 4,
}: VectorFieldProps) => {
  const { ref: wrapperRef, inView } = useInView()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
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

    const padding = size * 0.08
    const innerSize = size - padding * 2
    const cellW = innerSize / cols
    const cellH = innerSize / rows
    const half = Math.min(cellW, cellH) * 0.2

    const styles = getComputedStyle(canvas)
    const strokeColor =
      styles.getPropertyValue('--color-graphic-stroke').trim() ||
      'rgb(190, 190, 190)'

    // Current rendered angle per cell — initialised lazily on first frame
    const angles: number[] = new Array(cols * rows).fill(0)
    let initialised = false

    const LERP_SPEED = 0.08

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
    const onLeave = () => {
      mouseRef.current = null
    }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    const draw = () => {
      ctx.clearRect(0, 0, size, size)
      ctx.lineWidth = 1.5
      ctx.strokeStyle = strokeColor

      const mouse = mouseRef.current

      for (let ci = 0; ci < cols; ci++) {
        for (let ri = 0; ri < rows; ri++) {
          const idx = ri * cols + ci
          const u = ((ci + 0.5) / cols - 0.5) * 2
          const v = ((ri + 0.5) / rows - 0.5) * 2

          const r = Math.hypot(u, v)
          if (r > 1) continue

          const cx = padding + cellW * (ci + 0.5)
          const cy = padding + cellH * (ri + 0.5)

          // Target angle
          let target: number
          if (mouse) {
            target = Math.atan2(mouse.y - cy, mouse.x - cx)
          } else {
            const theta = Math.atan2(v, u)
            target = field(r, theta)
          }

          // Lerp current toward target (or snap on first frame)
          if (!initialised) {
            angles[idx] = target
          } else {
            angles[idx] = lerpAngle(angles[idx], target, LERP_SPEED)
          }

          const angle = angles[idx]
          const ca = Math.cos(angle)
          const sa = Math.sin(angle)
          const dx = ca * half
          const dy = sa * half

          // Shaft
          ctx.beginPath()
          ctx.moveTo(cx - dx, cy - dy)
          ctx.lineTo(cx + dx, cy + dy)
          ctx.stroke()

          // V-shaped arrowhead
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

      initialised = true
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [field, cols, rows, inView])

  return (
    <div ref={wrapperRef}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
