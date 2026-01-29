'use client'

import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

const AnimatedWaves = ({ className }: { className?: string }) => {
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

    const numWaves = 5
    const waves = Array.from({ length: numWaves }, (_, i) => ({
      amplitude: 8 + i * 4,
      frequency: 0.015 - i * 0.002,
      speed: 0.4 + i * 0.1,
      phase: i * 0.5,
      yOffset: 0.3 + i * 0.1,
    }))

    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      for (let w = waves.length - 1; w >= 0; w--) {
        const wave = waves[w]
        const alpha = 0.25 + (w / waves.length) * 0.45

        ctx.beginPath()
        ctx.strokeStyle = getStrokeColor(alpha)
        ctx.lineWidth = 1.5

        for (let x = 0; x <= width; x += 2) {
          const y =
            height * wave.yOffset +
            Math.sin(x * wave.frequency + time * wave.speed + wave.phase) * wave.amplitude +
            Math.sin(x * wave.frequency * 2 + time * wave.speed * 0.7) * (wave.amplitude * 0.3)

          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        ctx.stroke()
      }

      time += 0.03
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

export default AnimatedWaves
