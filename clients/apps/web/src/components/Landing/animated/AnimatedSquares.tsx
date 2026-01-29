'use client'

import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface Square {
  x: number
  y: number
  size: number
  baseX: number
  baseY: number
  phaseX: number
  phaseY: number
  speed: number
  amplitude: number
  rotation: number
  rotationSpeed: number
}

const AnimatedSquares = ({ className }: { className?: string }) => {
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

    const numSquares = 12
    const squares: Square[] = []

    for (let i = 0; i < numSquares; i++) {
      squares.push({
        x: 0,
        y: 0,
        size: 12 + Math.random() * 20,
        baseX: 0.1 + Math.random() * 0.8,
        baseY: 0.1 + Math.random() * 0.8,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.25,
        amplitude: 10 + Math.random() * 20,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
      })
    }

    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      for (const square of squares) {
        const offsetX = Math.sin(time * square.speed + square.phaseX) * square.amplitude
        const offsetY = Math.cos(time * square.speed + square.phaseY) * square.amplitude
        square.x = square.baseX * width + offsetX
        square.y = square.baseY * height + offsetY
        square.rotation += square.rotationSpeed * 0.016

        ctx.save()
        ctx.translate(square.x, square.y)
        ctx.rotate(square.rotation)

        const alpha = 0.4 + (square.size / 32) * 0.4
        ctx.strokeStyle = getStrokeColor(alpha)
        ctx.lineWidth = 1.5
        ctx.strokeRect(-square.size / 2, -square.size / 2, square.size, square.size)

        ctx.restore()
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

export default AnimatedSquares
