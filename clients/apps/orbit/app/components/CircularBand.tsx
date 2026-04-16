'use client'

import { useEffect, useRef } from 'react'
import { GraphicContainer } from './GraphicContainer'

interface Ring {
  radius: number
  rayCount: number
  rayLength: number
  direction: 1 | -1
  angle: number
}

interface CircularBandProps {
  fill?: boolean
}

export const CircularBand = ({ fill = false }: CircularBandProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const init = () => {
      const dpr = window.devicePixelRatio ?? 1
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      return { w, h }
    }

    let { w, h } = init()

    const resizeObserver = new ResizeObserver(() => {
      ;({ w, h } = init())
    })
    resizeObserver.observe(canvas)

    const rings: Ring[] = [
      { radius: 0, rayCount: 12, rayLength: 0, direction: 1, angle: 0 },
      { radius: 0, rayCount: 18, rayLength: 0, direction: -1, angle: 0 },
      { radius: 0, rayCount: 24, rayLength: 0, direction: 1, angle: 0 },
      { radius: 0, rayCount: 30, rayLength: 0, direction: -1, angle: 0 },
      { radius: 0, rayCount: 36, rayLength: 0, direction: 1, angle: 0 },
    ]

    // Target linear speed at every ring's perimeter, expressed as a
    // fraction of the canvas size per second. Each ring's angular
    // velocity is derived from this so all rings move at the same
    // constant linear velocity regardless of radius or framerate.
    const LINEAR_SPEED_FRAC = 0.02

    let lastTime: number | null = null

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now

      const size = Math.min(w, h)
      const cx = w / 2
      const cy = h / 2

      const radii = [0.06, 0.16, 0.29, 0.45, 0.65]
      const lengths = [0.1, 0.13, 0.16, 0.2, 0.5]

      ctx.clearRect(0, 0, w, h)

      // Linear speed in pixels per second
      const linearSpeedPx = size * LINEAR_SPEED_FRAC

      rings.forEach((ring, i) => {
        ring.radius = size * radii[i]
        ring.rayLength = size * lengths[i]
        // ω = v / r — smaller rings rotate faster angularly, but the
        // edge of every ring sweeps at the same linear speed.
        const angSpeed = linearSpeedPx / Math.max(1, ring.radius)
        ring.angle += angSpeed * ring.direction * dt

        const step = (Math.PI * 2) / ring.rayCount

        for (let j = 0; j < ring.rayCount; j++) {
          const a = ring.angle + j * step
          const x1 = cx + Math.cos(a) * ring.radius
          const y1 = cy + Math.sin(a) * ring.radius
          const x2 = cx + Math.cos(a) * (ring.radius + ring.rayLength)
          const y2 = cy + Math.sin(a) * (ring.radius + ring.rayLength)

          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.strokeStyle = 'rgba(220, 220, 220, 0.85)'
          ctx.lineWidth = 1
          ctx.stroke()
        }
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      resizeObserver.disconnect()
    }
  }, [])

  if (fill) {
    return <canvas ref={canvasRef} className="h-full w-full bg-neutral-950" />
  }

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  )
}
