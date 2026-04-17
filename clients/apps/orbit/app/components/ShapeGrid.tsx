'use client'

import { useEffect, useRef } from 'react'
import { GraphicContainer } from './GraphicContainer'

/**
 * ShapeGrid — 3×3 grid of geometric motifs built from circles and
 * ellipses. Each cell animates independently: breathing, orbiting,
 * rotating, or oscillating.
 */

type CellDraw = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  t: number,
) => void

// Helper — stroke a circle
const circ = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) => {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}

// Helper — rounded rect (pill)
const pill = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, r)
  ctx.stroke()
}

// ---- 9 cell drawers ----

// 1. Breathing pill
const drawPill: CellDraw = (ctx, cx, cy, r, t) => {
  const w = r * (1.5 + Math.sin(t * 0.8) * 0.25)
  const h = r * 0.7
  pill(ctx, cx, cy, w, h, h / 2)
}

// 2. Three overlapping circles rotating
const drawVenn: CellDraw = (ctx, cx, cy, r, t) => {
  const cr = r * 0.38
  const d = r * 0.3
  for (let i = 0; i < 3; i++) {
    const a = t * 0.5 + (i * Math.PI * 2) / 3
    circ(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, cr)
  }
}

// 3. Dumbbell — two circles connected by a line
const drawDumbbell: CellDraw = (ctx, cx, cy, r, t) => {
  const gap = r * (0.55 + Math.sin(t * 0.6) * 0.15)
  const cr = r * 0.32
  circ(ctx, cx - gap, cy, cr)
  circ(ctx, cx + gap, cy, cr)
  ctx.beginPath()
  ctx.moveTo(cx - gap + cr, cy)
  ctx.lineTo(cx + gap - cr, cy)
  ctx.stroke()
}

// 4. Concentric with orbiting inner circle
const drawConcentric: CellDraw = (ctx, cx, cy, r, t) => {
  circ(ctx, cx, cy, r * 0.45)
  const ir = r * 0.18
  const d = r * 0.22
  const a = t * 0.7
  circ(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, ir)
}

const CELLS: CellDraw[] = [drawPill, drawVenn, drawDumbbell, drawConcentric]

export const ShapeGrid = () => {
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

    const cols = 2
    const rows = 2
    const pad = size * 0.04
    const cellW = (size - pad * 2) / cols
    const cellH = (size - pad * 2) / rows
    const cellR = Math.min(cellW, cellH) * 0.35

    let lastTime: number | null = null
    let time = 0

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt

      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = 'rgb(190, 190, 190)'
      ctx.lineWidth = 1

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const cx = pad + cellW * (i + 0.5)
          const cy = pad + cellH * (j + 0.5)
          const idx = j * cols + i
          CELLS[idx](ctx, cx, cy, cellR, time)
        }
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
