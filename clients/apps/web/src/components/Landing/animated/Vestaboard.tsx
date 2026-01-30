'use client'

import React, { useRef, useEffect, useCallback } from 'react'
import { cx } from 'class-variance-authority'

export interface VestaboardProps {
  className?: string
  height?: number
  characters?: string
  resolution?: number
  cellSize?: number
  fontSize?: number
  waveScale?: number
  waveSpeed?: number
}

export const Vestaboard = ({
  className = '',
  characters = ' .:-+*=%@#',
  cellSize: propCellSize,
  fontSize: propFontSize,
  waveScale = 4.0,
  waveSpeed = 0.8,
}: VestaboardProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)
  const dimensionsRef = useRef({
    cols: 0,
    rows: 0,
    width: 0,
    height: 0,
    cellWidth: 0,
    cellHeight: 0,
  })
  const flashTimesRef = useRef<Map<string, number>>(new Map())

  const cellSize = propCellSize ?? 10
  const fontSize = propFontSize ?? cellSize

  const updateDimensions = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const cols = Math.floor(rect.width / cellSize) & ~1
    const rows = Math.floor(rect.height / cellSize)

    const canvas = canvasRef.current
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
    }

    dimensionsRef.current = {
      cols,
      rows,
      width: rect.width,
      height: rect.height,
      cellWidth: rect.width / cols,
      cellHeight: rect.height / rows,
    }
  }, [cellSize])

  useEffect(() => {
    startTimeRef.current = performance.now()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })

    resizeObserver.observe(container)
    updateDimensions()

    return () => resizeObserver.disconnect()
  }, [updateDimensions])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { cols, rows, width, height, cellWidth, cellHeight } =
      dimensionsRef.current
    if (cols === 0 || rows === 0) return

    const now = performance.now()
    const time = (now - startTimeRef.current) / 1000
    const charList = characters.split('')
    const maxIdx = charList.length - 1

    ctx.clearRect(0, 0, width, height)
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const isDark = document.documentElement.classList.contains('dark')

    const flashColor = isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }
    const baseRgb = isDark
      ? { r: 111, g: 113, b: 123 }
      : { r: 106, g: 114, b: 130 }
    const baseColor = `rgb(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b})`
    const decayDuration = 1000 // 1 second decay

    // Randomly trigger new flashes
    const flashChance = 0.02
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.random() < flashChance) {
          flashTimesRef.current.set(`${x},${y}`, now)
        }
      }
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const uvX = x / cols
        const uvY = y / rows

        const t = time * waveSpeed

        const wave1 = Math.sin((uvX + uvY) * Math.PI * waveScale + t)
        const wave2 = Math.sin(uvX * Math.PI * waveScale * 1.5 - t * 0.7) * 0.5
        const wave3 = Math.sin(uvY * Math.PI * waveScale * 2 + t * 0.5) * 0.3

        let intensity = (wave1 + wave2 + wave3) / 1.8
        intensity = (intensity + 1) / 2
        intensity = intensity * intensity * (3 - 2 * intensity)

        const charIdx = Math.min(
          maxIdx,
          Math.max(0, Math.round(intensity * maxIdx)),
        )
        const char = charList[charIdx] || ' '

        // Calculate color based on flash state
        const key = `${x},${y}`
        const flashTime = flashTimesRef.current.get(key)
        let color = baseColor

        if (flashTime !== undefined) {
          const elapsed = now - flashTime
          if (elapsed < decayDuration) {
            const progress = elapsed / decayDuration
            // Ease out decay
            const eased = 1 - Math.pow(1 - progress, 2)
            const r = Math.round(flashColor.r + (baseRgb.r - flashColor.r) * eased)
            const g = Math.round(flashColor.g + (baseRgb.g - flashColor.g) * eased)
            const b = Math.round(flashColor.b + (baseRgb.b - flashColor.b) * eased)
            color = `rgb(${r}, ${g}, ${b})`
          } else {
            flashTimesRef.current.delete(key)
          }
        }

        const drawX = x * cellWidth + cellWidth / 2
        const drawY = y * cellHeight + cellHeight / 2

        ctx.fillStyle = color
        ctx.fillText(char, drawX, drawY)
      }
    }
  }, [characters, fontSize, waveScale, waveSpeed])

  useEffect(() => {
    let running = true
    const frameInterval = 1000 / 30

    const animate = (timestamp: number) => {
      if (!running) return

      const elapsed = timestamp - lastFrameRef.current
      if (elapsed >= frameInterval) {
        lastFrameRef.current = timestamp - (elapsed % frameInterval)
        render()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      running = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

  return (
    <div
      ref={containerRef}
      className={cx('relative w-full overflow-hidden h-full', className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ color: 'inherit' }}
      />
    </div>
  )
}

export default Vestaboard
