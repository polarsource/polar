'use client'

import { useEffect, useRef } from 'react'
import { GraphicContainer } from './GraphicContainer'

/**
 * TileGrid — grid of filled tiles, each with a circular cut-out in
 * its bottom-right. The cut-out circle's center is offset per cell
 * (gradient across the grid) and its radius breathes over time,
 * producing a rolling pulse across the tiles.
 */

const COLS = 7
const ROWS = 7

export const TileGrid = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio ?? 1
    const size = canvas.offsetWidth
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const padding = size * 0.04
    const innerSize = size - padding * 2
    const cellW = innerSize / COLS
    const cellH = innerSize / ROWS
    const gap = cellW * 0.12
    const tileSize = Math.min(cellW, cellH) - gap

    let time = 0

    const drawTile = (
      tx: number,
      ty: number,
      s: number,
      cx: number,
      cy: number,
      r: number,
    ) => {
      // Fill the tile with the foreground
      ctx.fillStyle = 'rgba(232, 230, 222, 0.95)'
      ctx.fillRect(tx, ty, s, s)

      // Cut out the circle (in bg color) clipped to the tile so it
      // doesn't bleed into neighbouring tiles.
      ctx.save()
      ctx.beginPath()
      ctx.rect(tx, ty, s, s)
      ctx.clip()

      ctx.beginPath()
      ctx.arc(tx + cx, ty + cy, r, 0, Math.PI * 2)
      ctx.fillStyle = '#0a0a0a'
      ctx.fill()
      ctx.restore()
    }

    const draw = () => {
      ctx.clearRect(0, 0, size, size)

      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          // Cell-position offset — the circle drifts across the grid
          // so tiles near one corner have it further in, creating a
          // gradient of cutout sizes across the whole board.
          const nx = (i - (COLS - 1) / 2) / (COLS - 1) // [-0.5, 0.5]
          const ny = (j - (ROWS - 1) / 2) / (ROWS - 1)
          const offsetX = nx * tileSize * 0.55
          const offsetY = ny * tileSize * 0.55

          // Breathing radius — phase offset per cell so the pulse
          // rolls across the grid.
          const phase = (i + j) * 0.35
          const breath = 0.5 + 0.5 * Math.sin(time + phase)
          const radius = tileSize * (0.82 + breath * 0.18)

          // Base center is the bottom-right corner of the tile
          const cx = tileSize + offsetX
          const cy = tileSize + offsetY

          const x = padding + i * cellW + (cellW - tileSize) / 2
          const y = padding + j * cellH + (cellH - tileSize) / 2
          drawTile(x, y, tileSize, cx, cy, radius)
        }
      }

      time += 0.012
      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <GraphicContainer>
      <canvas ref={canvasRef} className="h-full w-full" />
    </GraphicContainer>
  )
}
