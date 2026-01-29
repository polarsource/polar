'use client'

import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface Node {
  x: number
  y: number
  baseX: number
  baseY: number
  phase: number
  speed: number
  amplitude: number
}

const AnimatedNodes = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const getColor = (alpha: number) => {
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

    const cols = 8
    const rows = 5
    const nodes: Node[] = []

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        nodes.push({
          x: 0,
          y: 0,
          baseX: (col + 0.5) / cols,
          baseY: (row + 0.5) / rows,
          phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.3,
          amplitude: 8 + Math.random() * 12,
        })
      }
    }

    let time = 0
    const connectionDistance = 120

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // Update node positions
      for (const node of nodes) {
        const offsetX = Math.sin(time * node.speed + node.phase) * node.amplitude
        const offsetY = Math.cos(time * node.speed * 0.8 + node.phase) * node.amplitude
        node.x = node.baseX * width + offsetX
        node.y = node.baseY * height + offsetY
      }

      // Draw connections
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < connectionDistance) {
            const alpha = (1 - distance / connectionDistance) * 0.3
            ctx.strokeStyle = getColor(alpha)
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = getColor(0.7)
        ctx.fill()
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

export default AnimatedNodes
