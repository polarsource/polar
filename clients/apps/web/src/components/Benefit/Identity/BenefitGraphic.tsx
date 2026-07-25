'use client'

import { useInView } from '@/hooks/useInView'
import { useEffect, useRef } from 'react'

export interface GraphicColors {
  stroke: string
  dim: string
}

/**
 * A per-frame renderer for a benefit graphic. Receives a cleared,
 * DPR-normalized square context — all geometry should be expressed
 * as fractions of `size` so the drawing is resolution-independent.
 */
export type GraphicRenderer = (
  ctx: CanvasRenderingContext2D,
  size: number,
  elapsed: number,
  colors: GraphicColors,
) => void

export const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

export const BenefitGraphic = ({ render }: { render: GraphicRenderer }) => {
  const { ref: wrapperRef, inView } = useInView()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !inView) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio ?? 1
    const size = canvas.offsetWidth
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const styles = getComputedStyle(canvas)
    const colors: GraphicColors = {
      stroke:
        styles.getPropertyValue('--color-graphic-stroke').trim() ||
        'rgb(190, 190, 190)',
      dim:
        styles.getPropertyValue('--color-graphic-dim').trim() ||
        'rgb(204, 204, 204)',
    }

    let raf = 0
    let start: number | null = null

    const draw = (now: number) => {
      if (start === null) start = now
      ctx.clearRect(0, 0, size, size)
      render(ctx, size, (now - start) / 1000, colors)
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [inView, render])

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
