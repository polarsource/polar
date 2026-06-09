'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * MarginPulse — a vertical stack of horizontal bars emanating from a
 * center axis. Each bar's signed length is driven by a slow
 * multi-frequency wave: positive lengths extend right (profit, green),
 * negative lengths extend left (loss, red). A positive bias keeps most
 * bars in the green with the occasional dip into the red, echoing the
 * margin leaderboard beside it. Canvas 2D.
 */

const ROWS = 14
const SUCCESS = '#fff'
const DANGER = 'hsl(233, 4%, 18.5%)'

export const MarginPulse = () => {
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

    const padX = width * 0.12
    const padY = height * 0.12
    const innerH = height - padY * 2
    const cx = width / 2
    const rowH = innerH / ROWS
    const barH = rowH * 0.06
    const maxLen = width / 2 - padX

    let lastTime: number | null = null
    let time = 0

    const drawBar = (x: number, y: number, w: number, h: number) => {
      ctx.beginPath()
      ctx.rect(x, y, w, h)

      ctx.fill()
    }

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt

      ctx.clearRect(0, 0, width, height)

      for (let r = 0; r < ROWS; r++) {
        const baseY = padY + r * rowH + (rowH - barH) / 2

        const phase1 = r * 0.55 - time * 1.1
        const phase2 = r * 0.27 + time * 0.6
        const wave = Math.sin(phase1) * 0.6 + Math.sin(phase2) * 0.4

        // Positive bias: mostly profit, occasional dip into the red
        const signed = wave * 0.72
        const len = signed * maxLen

        ctx.fillStyle = signed >= 0 ? SUCCESS : DANGER
        if (signed >= 0) {
          drawBar(cx, baseY, len, barH)
        } else {
          drawBar(cx + len, baseY, -len, barH)
        }
      }

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
