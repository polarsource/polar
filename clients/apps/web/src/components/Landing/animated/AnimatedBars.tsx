'use client'

import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

const AnimatedBars = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const getStrokeColor = () => {
      const isDark = document.documentElement.classList.contains('dark')
      return isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)'
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

    const lineWidth = 2
    const gap = 6
    const numBars = 60

    // Initialize bars - every other bar is full height, in-between bars animate
    const bars: { isFullHeight: boolean; baseHeight: number; phase: number; speed: number; amplitude: number }[] = []
    for (let i = 0; i < numBars; i++) {
      const isFullHeight = i % 2 === 0
      if (isFullHeight) {
        bars.push({
          isFullHeight: true,
          baseHeight: 1,
          phase: 0,
          speed: 0,
          amplitude: 0,
        })
      } else {
        // Animated bars with organic varying heights
        const position = i / numBars
        const waveHeight = Math.sin(position * Math.PI * 2.5) * 0.25 +
                           Math.sin(position * Math.PI * 5) * 0.15
        bars.push({
          isFullHeight: false,
          baseHeight: 0.3 + waveHeight + Math.random() * 0.3,
          phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.3,
          amplitude: 0.08 + Math.random() * 0.12,
        })
      }
    }

    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      const totalWidth = numBars * (lineWidth + gap) - gap
      const startX = (width - totalWidth) / 2
      const baselineY = height * 0.85
      const maxBarHeight = height * 0.7

      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i]
        const x = startX + i * (lineWidth + gap)

        let barHeight: number
        if (bar.isFullHeight) {
          barHeight = maxBarHeight
        } else {
          // Animate height with slow undulation, clamped to non-negative
          const heightMultiplier = Math.max(0, bar.baseHeight + Math.sin(time * bar.speed + bar.phase) * bar.amplitude)
          barHeight = heightMultiplier * maxBarHeight
        }

        const y = baselineY - barHeight

        ctx.strokeStyle = getStrokeColor()
        ctx.lineWidth = lineWidth
        ctx.lineCap = 'butt'
        ctx.beginPath()
        ctx.moveTo(x, baselineY)
        ctx.lineTo(x, y)
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

export default AnimatedBars
