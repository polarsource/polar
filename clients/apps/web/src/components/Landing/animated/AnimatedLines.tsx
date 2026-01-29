'use client'

import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

const AnimatedLines = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const getFillColor = () => {
      const isDark = document.documentElement.classList.contains('dark')
      return isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)'
    }

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const cols = 32
    const rows = 12
    const lineWidth = 2
    const gapX = 8
    const gapY = 6

    // Initialize random phases and speeds for each line
    const lines: { phase: number; speed: number; baseHeight: number }[] = []
    for (let i = 0; i < cols * rows; i++) {
      lines.push({
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.4,
        baseHeight: 12 + Math.random() * 8,
      })
    }

    let time = 0

    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      const startX = (rect.width - (cols * (lineWidth + gapX) - gapX)) / 2
      const startY = (rect.height - (rows * (24 + gapY) - gapY)) / 2

      const fillColor = getFillColor()

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = row * cols + col
          const line = lines[index]

          // Calculate animated height with slow, irregular motion
          const heightOffset = Math.sin(time * line.speed + line.phase) * 6
          const height = line.baseHeight + heightOffset

          const x = startX + col * (lineWidth + gapX)
          const y = startY + row * (24 + gapY) + (24 - height) / 2

          ctx.fillStyle = fillColor
          ctx.fillRect(x, y, lineWidth, height)
        }
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

export default AnimatedLines
