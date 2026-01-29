'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { cx } from 'class-variance-authority'
import { GeistMono } from 'geist/font/mono'

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
  height = 200,
  characters = ' .:-+*=%@#',
  cellSize: propCellSize,
  fontSize: propFontSize,
  waveScale = 4.0,
  waveSpeed = 0.8,
}: VestaboardProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [asciiGrid, setAsciiGrid] = useState<string[][]>([])
  const [dimensions, setDimensions] = useState({ cols: 0, rows: 0 })
  const animationRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)
  const lastFrameRef = useRef<number>(0)

  useEffect(() => {
    startTimeRef.current = performance.now()
  }, [])

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const cellSize = propCellSize ?? 10
      const cols = Math.floor(rect.width / cellSize) & ~1
      const rows = Math.floor(rect.height / cellSize)

      setDimensions({ cols, rows })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [propCellSize, height])

  const updateGrid = useCallback(() => {
    if (dimensions.cols === 0 || dimensions.rows === 0) return

    const time = (performance.now() - startTimeRef.current) / 1000
    const charList = characters.split('')
    const maxIdx = charList.length - 1

    const grid: string[][] = []

    for (let y = 0; y < dimensions.rows; y++) {
      const row: string[] = []
      for (let x = 0; x < dimensions.cols; x++) {
        const uvX = x / dimensions.cols
        const uvY = y / dimensions.rows

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
        row.push(charList[charIdx] || ' ')
      }
      grid.push(row)
    }

    setAsciiGrid(grid)
  }, [dimensions, characters, waveScale, waveSpeed])

  useEffect(() => {
    let running = true
    const frameInterval = 1000 / 30

    const animate = (timestamp: number) => {
      if (!running) return

      const elapsed = timestamp - lastFrameRef.current
      if (elapsed >= frameInterval) {
        lastFrameRef.current = timestamp - (elapsed % frameInterval)
        updateGrid()
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
  }, [updateGrid])

  const cellSize = propCellSize ?? 10
  const fontSize = propFontSize ?? cellSize

  return (
    <div
      className={cx(
        'relative flex w-full flex-col items-center justify-center overflow-hidden text-center',
        className,
      )}
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 m-0 overflow-hidden font-mono"
        style={{
          fontSize: `${fontSize}px`,
          display: 'grid',
          gridTemplateColumns: `repeat(${dimensions.cols}, 1fr)`,
          gridTemplateRows: `repeat(${dimensions.rows}, ${cellSize}px)`,
        }}
      >
        {asciiGrid.flat().map((char, i) => (
          <div
            key={i}
            style={{
              height: cellSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {char}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Vestaboard
