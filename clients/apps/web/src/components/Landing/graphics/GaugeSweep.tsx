'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * GaugeSweep — 4 concentric bands of radial spokes (like CircularBand
 * but minimal). Alternating rotation, matching the visual size of the
 * other architecture tile graphics (~0.32 of canvas).
 */

const BAND_COUNT = 4
const RAY_COUNT = 12
const ANG_SPEED = 0.15

export const GaugeSweep = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const { ref: wrapperRef, inView } = useInView()

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

    // Size to match other tiles (~0.32 outer reach)
    const outerR = size * 0.32
    const startR = size * 0.08
    const bandWidth = (outerR - startR) / BAND_COUNT

    const bands = Array.from({ length: BAND_COUNT }, (_, i) => ({
      innerR: startR + i * bandWidth,
      outerR: startR + (i + 1) * bandWidth,
      direction: i % 2 === 0 ? 1 : -1,
      angle: 0,
    }))

    let lastTime: number | null = null

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now

      ctx.clearRect(0, 0, size, size)
      ctx.lineWidth = 2

      const step = (Math.PI * 2) / RAY_COUNT

      for (const band of bands) {
        band.angle += ANG_SPEED * band.direction * dt

        for (let j = 0; j < RAY_COUNT; j++) {
          const a = band.angle + j * step
          const cos = Math.cos(a)
          const sin = Math.sin(a)

          const x1 = cx + cos * band.innerR
          const y1 = cy + sin * band.innerR
          const x2 = cx + cos * band.outerR
          const y2 = cy + sin * band.outerR

          ctx.strokeStyle = strokeColor
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
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
