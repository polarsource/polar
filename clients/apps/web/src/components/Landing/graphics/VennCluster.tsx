'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * VennCluster — three internally-tangent circles. A small circle stays
 * centered; a medium circle contains it, tangent on one side; a big
 * circle contains the medium, tangent on the opposite side. The whole
 * arrangement rotates around the centered circle.
 *
 * Geometry — given small centre S, unit direction D, and radii rs<rm<rb:
 *   medium centre M = S + D · (rm - rs)
 *   big centre    B = M - D · (rb - rm)
 * so each pair shares a single tangent point and the tangent points
 * alternate sides as D rotates.
 */

export const VennCluster = () => {
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

    const rSmall = size * 0.08
    const rMedium = size * 0.2
    // Big radius chosen so big and small are concentric (canvas-centered);
    // only the medium rotates between them.
    const rBig = 2 * rMedium - rSmall

    let angle = 0
    let lastTime: number | null = null
    const ANG_SPEED = 0.25

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      angle += ANG_SPEED * dt

      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 1.5

      const dx = Math.cos(angle)
      const dy = Math.sin(angle)

      const mx = cx + dx * (rMedium - rSmall)
      const my = cy + dy * (rMedium - rSmall)

      const bx = mx - dx * (rBig - rMedium)
      const by = my - dy * (rBig - rMedium)

      ctx.beginPath()
      ctx.arc(bx, by, rBig, 0, Math.PI * 2)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(mx, my, rMedium, 0, Math.PI * 2)
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(cx, cy, rSmall, 0, Math.PI * 2)
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
