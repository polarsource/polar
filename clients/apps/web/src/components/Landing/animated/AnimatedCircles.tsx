'use client'

import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface Circle {
  x: number
  y: number
  radius: number
  baseX: number
  baseY: number
  phaseX: number
  phaseY: number
  speedX: number
  speedY: number
  amplitude: number
}

const AnimatedCircles = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const getStrokeColor = (alpha: number) => {
      const isDark = document.documentElement.classList.contains('dark')
      return isDark ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`
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

    // Initialize circles with varying sizes and movement patterns
    const circles: Circle[] = []
    const numCircles = 18

    for (let i = 0; i < numCircles; i++) {
      const radius = 4 + Math.random() * 12
      circles.push({
        x: 0,
        y: 0,
        radius,
        baseX: Math.random() * 100,
        baseY: Math.random() * 100,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speedX: 0.2 + Math.random() * 0.3,
        speedY: 0.2 + Math.random() * 0.3,
        amplitude: 15 + Math.random() * 25,
      })
    }

    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // Sort circles by radius for depth effect (smaller in back)
      const sortedCircles = [...circles].sort((a, b) => a.radius - b.radius)

      for (const circle of sortedCircles) {
        // Calculate position with smooth oscillation
        const offsetX = Math.sin(time * circle.speedX + circle.phaseX) * circle.amplitude
        const offsetY = Math.cos(time * circle.speedY + circle.phaseY) * circle.amplitude

        circle.x = (circle.baseX / 100) * width + offsetX
        circle.y = (circle.baseY / 100) * height + offsetY

        // Draw outlined circle
        const alpha = 0.4 + (circle.radius / 16) * 0.4
        ctx.beginPath()
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2)
        ctx.strokeStyle = getStrokeColor(alpha)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      time += 0.012
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

export default AnimatedCircles
