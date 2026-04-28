'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * CreditArc — 2×2 grid of simple geometric glyphs:
 * plus, cross, circle, asterisk. Static, no animation.
 */

export const CreditArc = () => {
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

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 2

    const cx = size / 2
    const cy = size / 2
    const cellSize = size * 0.3
    const gap = size * 0.1
    const arm = cellSize * 0.4

    // Cell centers — 2×2 grid
    const cells = [
      { x: cx - gap / 2 - cellSize / 2, y: cy - gap / 2 - cellSize / 2 },
      { x: cx + gap / 2 + cellSize / 2, y: cy - gap / 2 - cellSize / 2 },
      { x: cx - gap / 2 - cellSize / 2, y: cy + gap / 2 + cellSize / 2 },
      { x: cx + gap / 2 + cellSize / 2, y: cy + gap / 2 + cellSize / 2 },
    ]

    // Plus
    const p = cells[0]
    ctx.beginPath()
    ctx.moveTo(p.x, p.y - arm)
    ctx.lineTo(p.x, p.y + arm)
    ctx.moveTo(p.x - arm, p.y)
    ctx.lineTo(p.x + arm, p.y)
    ctx.stroke()

    // Cross (X)
    const x = cells[1]
    const d = arm * 0.8
    ctx.beginPath()
    ctx.moveTo(x.x - d, x.y - d)
    ctx.lineTo(x.x + d, x.y + d)
    ctx.moveTo(x.x + d, x.y - d)
    ctx.lineTo(x.x - d, x.y + d)
    ctx.stroke()

    // Circle
    const o = cells[2]
    ctx.beginPath()
    ctx.arc(o.x, o.y, arm * 0.85, 0, Math.PI * 2)
    ctx.stroke()

    // Asterisk (6 spokes)
    const a = cells[3]
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(a.x + Math.cos(angle) * arm, a.y + Math.sin(angle) * arm)
      ctx.stroke()
    }
  }, [inView])

  return (
    <div ref={wrapperRef}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
