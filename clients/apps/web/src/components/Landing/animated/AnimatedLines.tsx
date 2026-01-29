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

    const barHeight = 10
    const gapX = 12
    const gapY = 12
    const maxWidth = 8
    const cellWidth = maxWidth + gapX
    const cellHeight = barHeight + gapY

    // Will be populated on first frame
    let bars: { phase: number; speed: number; baseWidth: number }[] = []
    let cols = 0
    let rows = 0
    let time = 0

    const initBars = (newCols: number, newRows: number) => {
      if (newCols === cols && newRows === rows) return
      cols = newCols
      rows = newRows
      bars = []
      for (let i = 0; i < cols * rows; i++) {
        bars.push({
          phase: Math.random() * Math.PI * 2,
          speed: 0.3 + Math.random() * 0.4,
          baseWidth: 1 + Math.random() * 4,
        })
      }
    }

    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      // Calculate grid to fill canvas
      const newCols = Math.floor(rect.width / cellWidth)
      const newRows = Math.floor(rect.height / cellHeight)
      initBars(newCols, newRows)

      if (cols === 0 || rows === 0) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      // Calculate actual cell size to fill canvas evenly
      const actualCellWidth = rect.width / cols
      const actualCellHeight = rect.height / rows

      const fillColor = getFillColor()

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = row * cols + col
          const bar = bars[index]

          // Calculate animated width with slow, irregular motion
          const widthOffset = Math.sin(time * bar.speed + bar.phase) * 3
          const width = Math.max(1, bar.baseWidth + widthOffset)

          const x = col * actualCellWidth + (actualCellWidth - width) / 2
          const y = row * actualCellHeight + (actualCellHeight - barHeight) / 2

          ctx.fillStyle = fillColor
          ctx.fillRect(x, y, width, barHeight)
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
