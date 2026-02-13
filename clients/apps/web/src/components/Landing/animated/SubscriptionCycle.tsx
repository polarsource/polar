'use client'

import { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

const SubscriptionCycle = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const getColor = () => {
      const isDark = document.documentElement.classList.contains('dark')
      return isDark
        ? { r: 255, g: 255, b: 255 }
        : { r: 0, g: 0, b: 0 }
    }

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const NUM_RINGS = 3
    const PARTICLES_PER_RING = [4, 6, 8]
    // Radians per frame — visible rotation
    const RING_SPEEDS = [0.012, -0.008, 0.005]
    const TAIL_ARC = 0.35 // radians of arc trail

    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      const { r, g, b } = getColor()

      const cx = width / 2
      const cy = height / 2
      const maxRadius = Math.min(width, height) * 0.42

      // Draw orbital rings
      for (let ring = 0; ring < NUM_RINGS; ring++) {
        const radius = maxRadius * (0.3 + ring * 0.32)

        // Ring path
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.07)`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.stroke()

        // Particles on ring
        const numParticles = PARTICLES_PER_RING[ring]
        const speed = RING_SPEEDS[ring]

        for (let i = 0; i < numParticles; i++) {
          const baseAngle = (i / numParticles) * Math.PI * 2
          const angle = baseAngle + time * speed

          const px = cx + Math.cos(angle) * radius
          const py = cy + Math.sin(angle) * radius

          // Opacity pulse per particle
          const opacity = 0.35 + Math.sin(time * 0.02 + i * 1.5) * 0.15

          // Draw arc tail using actual arc path
          const tailAngle = angle - Math.sign(speed) * TAIL_ARC

          // Create gradient along the arc
          const tailX = cx + Math.cos(tailAngle) * radius
          const tailY = cy + Math.sin(tailAngle) * radius
          const grad = ctx.createLinearGradient(tailX, tailY, px, py)
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${opacity})`)

          ctx.strokeStyle = grad
          ctx.lineWidth = 1.5
          ctx.lineCap = 'round'
          ctx.beginPath()
          if (speed > 0) {
            ctx.arc(cx, cy, radius, tailAngle, angle)
          } else {
            ctx.arc(cx, cy, radius, angle, tailAngle)
          }
          ctx.stroke()

          // Head dot
          const size = 1.8 + (ring === 1 ? 0.5 : 0)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity + 0.25})`
          ctx.beginPath()
          ctx.arc(px, py, size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Center node — pulsing
      const pulse = 0.5 + Math.sin(time * 0.04) * 0.2
      const centerRadius = 5

      // Glow
      const glow = ctx.createRadialGradient(
        cx, cy, 0,
        cx, cy, centerRadius * 3.5,
      )
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.1 + pulse * 0.12})`)
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, centerRadius * 3.5, 0, Math.PI * 2)
      ctx.fill()

      // Center dot
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.2 + pulse * 0.2})`
      ctx.beginPath()
      ctx.arc(cx, cy, centerRadius, 0, Math.PI * 2)
      ctx.fill()

      // Center ring
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 + pulse * 0.1})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, centerRadius + 5, 0, Math.PI * 2)
      ctx.stroke()

      time++
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={twMerge('h-full w-full', className)}
    />
  )
}

export default SubscriptionCycle
