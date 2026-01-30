'use client'

import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

const AnimatedInfinity = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

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

    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      const isDark = document.documentElement.classList.contains('dark')
      const dashColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)'

      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.28
      const circleGap = radius // Circles touch at center

      // Helper to get position on infinity path
      const getPosition = (pathT: number): { x: number; y: number } => {
        const normalizedT = ((pathT % 2) + 2) % 2 // Ensure positive modulo
        if (normalizedT < 1) {
          // Left circle counterclockwise starting from center crossing
          const angle = normalizedT * Math.PI * 2
          return {
            x: centerX - circleGap + Math.cos(angle) * radius,
            y: centerY - Math.sin(angle) * radius,
          }
        } else {
          // Right circle clockwise starting from center crossing
          const angle = Math.PI - (normalizedT - 1) * Math.PI * 2
          return {
            x: centerX + circleGap + Math.cos(angle) * radius,
            y: centerY - Math.sin(angle) * radius,
          }
        }
      }

      // Draw dashed infinity path as continuous line
      ctx.setLineDash([4, 8])
      ctx.strokeStyle = dashColor
      ctx.lineWidth = 2
      ctx.lineCap = 'round'

      ctx.beginPath()
      const pathSteps = 100
      for (let i = 0; i <= pathSteps; i++) {
        const pathT = (i / pathSteps) * 2
        const pos = getPosition(pathT)
        if (i === 0) {
          ctx.moveTo(pos.x, pos.y)
        } else {
          ctx.lineTo(pos.x, pos.y)
        }
      }
      ctx.stroke()

      ctx.setLineDash([])

      // Animated segment along infinity path
      const speed = 0.3
      const t = time * speed
      const segmentLength = 0.12

      // Draw animated gradient segment
      const steps = 50
      ctx.lineWidth = 3
      ctx.lineCap = 'round'

      for (let i = 0; i < steps; i++) {
        const progress = i / steps
        const pathT = t - progress * segmentLength

        const pos = getPosition(pathT)
        const nextPos = getPosition(pathT - segmentLength / steps)

        // Fade from full opacity to faint tail
        const alpha = Math.pow(1 - progress, 2) // Quadratic falloff for more fade
        const color = isDark ? 255 : 0
        // Fade color toward gray
        const tailColor = Math.round(color * alpha + 100 * (1 - alpha))

        ctx.strokeStyle = `rgba(${tailColor}, ${tailColor}, ${tailColor}, ${0.15 + alpha * 0.85})`
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
        ctx.lineTo(nextPos.x, nextPos.y)
        ctx.stroke()
      }

      time += 0.016
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

export default AnimatedInfinity
