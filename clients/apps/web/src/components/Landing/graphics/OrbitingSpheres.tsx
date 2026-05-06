'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * OrbitingSpheres — a large circle plus a stack of nested circles that
 * all share a common tangent point at the large circle's centre. Each
 * inner circle passes through the anchor and extends toward an orbiting
 * satellite dot. As the dot circles the big sphere, the whole stack
 * swings around the anchor.
 *
 * Geometry — given anchor A (= big circle's centre), direction D toward
 * the satellite, and inner-circle radius r:
 *   center = A + D · r      (so the circle passes through A)
 *
 * Each deeper circle shrinks by SHRINK, so all inner circles remain
 * internally tangent to the previous at A.
 */

// How much each nested circle shrinks relative to its parent
const SHRINK = 0.62
// Recursion depth for the nested circles
const DEPTH = 3

export const OrbitingSpheres = () => {
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
    const R = size * 0.32

    // Orbit radius for the satellite (distance from large sphere centre)
    const orbitR = R + size * 0.08
    // Satellite dot radius
    const satR = size * 0.015

    let angle = 0
    let lastTime: number | null = null
    // Framerate-independent angular speed (rad/sec)
    const ANG_SPEED = 0.25

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      angle += ANG_SPEED * dt

      ctx.clearRect(0, 0, size, size)

      // Direction unit vector from big sphere's centre toward satellite
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)

      ctx.lineWidth = 1.5

      // Big sphere — bright
      ctx.strokeStyle = strokeColor
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()

      // Nested inner circles — bright
      ctx.strokeStyle = strokeColor
      let r = R * 0.5
      for (let i = 0; i < DEPTH; i++) {
        ctx.beginPath()
        ctx.arc(cx + dx * r, cy + dy * r, r, 0, Math.PI * 2)
        ctx.stroke()
        r *= SHRINK
      }

      // Satellite dot orbiting outside the big sphere
      const satX = cx + dx * orbitR
      const satY = cy + dy * orbitR
      ctx.beginPath()
      ctx.arc(satX, satY, satR, 0, Math.PI * 2)
      ctx.strokeStyle = strokeColor
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
