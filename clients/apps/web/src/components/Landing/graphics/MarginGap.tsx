'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * MarginGap — a revenue curve and an inference-cost curve drawn across
 * time, with the gross-margin gap filled between them. Both curves reveal
 * left to right, then continue past a "today" divider as marching dashed
 * forecasts. Canvas 2D.
 */

const TODAY = 0.68
const SAMPLES = 160
const REVEAL_SECONDS = 2.4

const revenueAt = (t: number) =>
  0.3 + 0.54 * Math.pow(t, 1.15) + 0.035 * Math.sin(t * 8.5)

const costAt = (t: number) => 0.14 + 0.2 * t + 0.04 * Math.sin(t * 6.5 + 1.4)

export const MarginGap = () => {
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
    const width = canvas.offsetWidth
    const height = canvas.offsetHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const padX = width * 0.04
    const padY = height * 0.16
    const x = (t: number) => padX + t * (width - padX * 2)
    const y = (v: number) => height - padY - v * (height - padY * 2)

    const styles = getComputedStyle(canvas)
    const stroke =
      styles.getPropertyValue('--color-graphic-stroke').trim() ||
      'rgb(190, 190, 190)'
    const labelFont = `500 11px ${styles.fontFamily}`

    let startTime: number | null = null

    const tracePath = (
      valueAt: (t: number) => number,
      from: number,
      to: number,
    ) => {
      ctx.beginPath()
      for (let i = 0; i <= SAMPLES; i++) {
        const t = from + ((to - from) * i) / SAMPLES
        const px = x(t)
        const py = y(valueAt(t))
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
    }

    const fillBand = (from: number, to: number, alpha: number) => {
      if (to <= from) return
      ctx.globalAlpha = alpha
      ctx.fillStyle = stroke
      ctx.beginPath()
      for (let i = 0; i <= SAMPLES; i++) {
        const t = from + ((to - from) * i) / SAMPLES
        ctx.lineTo(x(t), y(revenueAt(t)))
      }
      for (let i = SAMPLES; i >= 0; i--) {
        const t = from + ((to - from) * i) / SAMPLES
        ctx.lineTo(x(t), y(costAt(t)))
      }
      ctx.closePath()
      ctx.fill()
    }

    const strokeCurve = (
      valueAt: (t: number) => number,
      from: number,
      to: number,
      alpha: number,
      dashOffset: number | null,
    ) => {
      if (to <= from) return
      ctx.globalAlpha = alpha
      ctx.strokeStyle = stroke
      ctx.lineWidth = 1.25
      if (dashOffset === null) {
        ctx.setLineDash([])
      } else {
        ctx.setLineDash([4, 5])
        ctx.lineDashOffset = dashOffset
      }
      tracePath(valueAt, from, to)
      ctx.stroke()
    }

    const drawLabel = (
      text: string,
      px: number,
      py: number,
      alpha: number,
      align: CanvasTextAlign,
    ) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = stroke
      ctx.font = labelFont
      ctx.textAlign = align
      ctx.fillText(text, px, py)
    }

    const draw = (now: number) => {
      if (startTime === null) startTime = now
      const elapsed = (now - startTime) / 1000
      const progress = Math.min(1, elapsed / REVEAL_SECONDS)
      const eased = 1 - Math.pow(1 - progress, 3)
      const tEnd = eased
      const dashMarch = -elapsed * 8

      ctx.clearRect(0, 0, width, height)

      fillBand(0, Math.min(tEnd, TODAY), 0.08)
      fillBand(TODAY, Math.max(tEnd, TODAY), 0.04)

      if (tEnd >= TODAY) {
        ctx.globalAlpha = 0.18
        ctx.strokeStyle = stroke
        ctx.lineWidth = 1
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(x(TODAY), padY * 0.55)
        ctx.lineTo(x(TODAY), height - padY * 0.55)
        ctx.stroke()
      }

      strokeCurve(revenueAt, 0, Math.min(tEnd, TODAY), 0.95, null)
      strokeCurve(costAt, 0, Math.min(tEnd, TODAY), 0.4, null)
      strokeCurve(revenueAt, TODAY, Math.max(tEnd, TODAY), 0.65, dashMarch)
      strokeCurve(costAt, TODAY, Math.max(tEnd, TODAY), 0.3, dashMarch)

      const labelAlpha = Math.max(0, Math.min(1, (progress - 0.7) / 0.3))
      if (labelAlpha > 0) {
        drawLabel(
          'Revenue',
          x(1),
          y(revenueAt(1)) - 10,
          labelAlpha * 0.9,
          'right',
        )
        drawLabel('Cost', x(1), y(costAt(1)) + 18, labelAlpha * 0.45, 'right')
        drawLabel(
          'Gross margin',
          x(0.42),
          y((revenueAt(0.42) + costAt(0.42)) / 2) + 4,
          labelAlpha * 0.6,
          'center',
        )
        drawLabel(
          'Today',
          x(TODAY) - 8,
          padY * 0.55 + 10,
          labelAlpha * 0.45,
          'right',
        )
        drawLabel(
          'Forecast',
          x(TODAY) + 8,
          padY * 0.55 + 10,
          labelAlpha * 0.45,
          'left',
        )
      }

      ctx.globalAlpha = 1
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animRef.current)
  }, [inView])

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
