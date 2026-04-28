'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * Dumbbell — two circles connected by a line, gently breathing
 * apart and together. Suggests measurement between two endpoints.
 */

export const Dumbbell = () => {
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

    const styles = getComputedStyle(canvas)
    const strokeColor =
      styles.getPropertyValue('--color-graphic-stroke').trim() ||
      'rgb(190, 190, 190)'

    const cx = size / 2
    const cy = size / 2
    const r = size * 0.18

    let lastTime: number | null = null
    let time = 0

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt

      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 2

      const gap = size * (0.25 + Math.sin(time * 0.6) * 0.06)

      // Left circle
      ctx.beginPath()
      ctx.arc(cx - gap, cy, r, 0, Math.PI * 2)
      ctx.stroke()

      // Right circle
      ctx.beginPath()
      ctx.arc(cx + gap, cy, r, 0, Math.PI * 2)
      ctx.stroke()

      // Connecting line
      ctx.beginPath()
      ctx.moveTo(cx - gap + r, cy)
      ctx.lineTo(cx + gap - r, cy)
      ctx.stroke()

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
