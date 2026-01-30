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
      return isDark ? 'rgba(255, 255, 255, .7)' : 'rgba(0, 0, 0, .7)'
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

    const lineWidth = 1
    const gap = 12
    const numBars = 60 // This is the number of animated bars, total bars will be 2x - 1

    let time = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      const totalBars = numBars * 2 - 1
      const totalWidth = totalBars * (lineWidth + gap) - gap
      const startX = (width - totalWidth) / 2
      const baselineY = height * 0.85
      const maxBarHeight = height * 0.7

      for (let i = 0; i < totalBars; i++) {
        const x = startX + i * (lineWidth + gap)
        const isFullHeight = i % 2 === 0

        let barHeight: number

        if (isFullHeight) {
          // Full height bars - anchored to baseline
          barHeight = maxBarHeight
          const y = baselineY - barHeight

          ctx.strokeStyle = getStrokeColor()
          ctx.lineWidth = lineWidth
          ctx.lineCap = 'butt'
          ctx.beginPath()
          ctx.moveTo(x, baselineY)
          ctx.lineTo(x, y)
          ctx.stroke()
        } else {
          // Animated bars - use index of animated bar for wave calculation
          const animatedIndex = Math.floor(i / 2)
          const position = animatedIndex / (numBars - 1)

          // Create smooth wave envelope that shifts over time
          const wavePhase = time * 0.3
          const centerOffset = Math.sin(wavePhase) * 0.1
          const center = 0.5 + centerOffset

          // Distance from center, creates the bell curve shape
          const distFromCenter = Math.abs(position - center)

          // Base envelope - gaussian-like curve
          const envelope = Math.exp(-Math.pow(distFromCenter * 2.5, 2))

          // Add secondary wave for organic movement
          const secondaryWave = Math.sin(position * Math.PI * 4 + time * 0.8) * 0.25
          const tertiaryWave = Math.sin(position * Math.PI * 8 + time * 0.5) * 0.15

          // Combine waves with envelope
          const heightMultiplier = Math.max(0.1, envelope * 0.8 + secondaryWave + tertiaryWave + 0.15)
          barHeight = heightMultiplier * maxBarHeight

          // Mostly anchored from bottom - top moves more, bottom moves a little
          const maxHeight = maxBarHeight
          const movement = maxHeight - barHeight
          const bottomY = baselineY - movement * 0.2
          const topY = bottomY - barHeight

          ctx.strokeStyle = getStrokeColor()
          ctx.lineWidth = lineWidth
          ctx.lineCap = 'butt'
          ctx.beginPath()
          ctx.moveTo(x, bottomY)
          ctx.lineTo(x, topY)
          ctx.stroke()
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

export default AnimatedBars
