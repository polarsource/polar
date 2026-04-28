'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * LinkedRings — one large circle with two smaller circles slowly
 * orbiting around it. Minimal, clean.
 */

export const LinkedRings = () => {
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
    const bigR = size * 0.2
    const smallR = size * 0.08
    const orbitR = bigR + smallR

    let lastTime: number | null = null
    let time = 0

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt

      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 2

      // Big center circle
      ctx.beginPath()
      ctx.arc(cx, cy, bigR, 0, Math.PI * 2)
      ctx.stroke()

      // Two small orbiting circles, opposite sides
      for (let i = 0; i < 2; i++) {
        const angle = time * 0.2 + i * Math.PI
        const sx = cx + Math.cos(angle) * orbitR
        const sy = cy + Math.sin(angle) * orbitR
        ctx.beginPath()
        ctx.arc(sx, sy, smallR, 0, Math.PI * 2)
        ctx.stroke()
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
