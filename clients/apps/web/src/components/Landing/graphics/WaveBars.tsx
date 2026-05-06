'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * WaveBars — a grid of horizontal bars whose widths are modulated by
 * a travelling sine wave, producing a choreographed ripple across
 * the columns. Canvas 2D.
 */

const COLS = 1
const ROWS = 6

export const WaveBars = () => {
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

    const pad = size * 0.08
    const innerW = size - pad * 2
    const innerH = size - pad * 2
    const colW = innerW / COLS
    const rowH = innerH / ROWS
    const barH = Math.max(1, rowH * 0.03)
    const colGap = colW * 0.12
    const maxBarW = colW - colGap

    let lastTime: number | null = null
    let time = 0

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt

      const styles = getComputedStyle(canvas)
      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle =
        styles.getPropertyValue('--color-graphic-stroke').trim() ||
        'rgb(190, 190, 190)'
      // Max vertical displacement per bar
      const maxDisp = rowH * 2

      for (let c = 0; c < COLS; c++) {
        const cx = pad + c * colW + colGap / 2

        for (let r = 0; r < ROWS; r++) {
          const baseY = pad + r * rowH + (rowH - barH) / 2

          // Multi-frequency wave drives the y-position offset
          const phase1 = c * 0.9 + r * 0.25 - time * 1.8
          const phase2 = c * 0.4 - r * 0.15 + time * 0.7
          const phase3 = (c + r) * 0.3 + time * 1.1

          const wave =
            Math.sin(phase1) * 0.4 +
            Math.sin(phase2) * 0.35 +
            Math.sin(phase3) * 0.25

          // Top and bottom rows are fixed; inner rows scale displacement
          // by how far they are from the edges (0 at edges, 1 at center)
          const edgeDist = Math.min(r, ROWS - 1 - r) / ((ROWS - 1) / 2)
          const yOffset = wave * maxDisp * edgeDist

          ctx.fillRect(cx, baseY + yOffset, maxBarW, barH)
        }
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
