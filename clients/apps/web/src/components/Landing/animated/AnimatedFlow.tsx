'use client'

import React, { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface Particle {
  angle: number
  progress: number
  speed: number
}

const AnimatedFlow = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const getColors = () => {
      const isDark = document.documentElement.classList.contains('dark')
      return {
        node: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
        nodeBorder: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)',
        line: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
        particle: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        particleTail: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }
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

    const numSpokes = 8
    const spokeAngles = Array.from(
      { length: numSpokes },
      (_, i) => (i * Math.PI * 2) / numSpokes
    )

    // Initialize particles - staggered across spokes
    const particles: Particle[] = []
    spokeAngles.forEach((angle, index) => {
      // Add 1-2 particles per spoke, alternating
      const count = index % 2 === 0 ? 2 : 1
      for (let i = 0; i < count; i++) {
        particles.push({
          angle,
          progress: Math.random(),
          speed: 0.004 + Math.random() * 0.003,
        })
      }
    })

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      const colors = getColors()

      const centerX = width / 2
      const centerY = height / 2
      const outerRadius = Math.min(width, height) * 0.45
      const innerRadius = 10

      // Draw spokes (lines from outer edge to center)
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1
      spokeAngles.forEach((angle) => {
        const outerX = centerX + Math.cos(angle) * outerRadius
        const outerY = centerY + Math.sin(angle) * outerRadius

        ctx.beginPath()
        ctx.moveTo(outerX, outerY)
        ctx.lineTo(centerX, centerY)
        ctx.stroke()

        // Draw outer node
        ctx.fillStyle = colors.node
        ctx.beginPath()
        ctx.arc(outerX, outerY, 5, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = colors.nodeBorder
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(outerX, outerY, 5, 0, Math.PI * 2)
        ctx.stroke()

        ctx.strokeStyle = colors.line
      })

      // Draw and update particles (flowing inward)
      particles.forEach((particle) => {
        // Progress 0 = outer edge, 1 = center
        const currentRadius =
          outerRadius - particle.progress * (outerRadius - innerRadius)
        const x = centerX + Math.cos(particle.angle) * currentRadius
        const y = centerY + Math.sin(particle.angle) * currentRadius

        // Tail position (further out)
        const tailLength = 0.12
        const tailProgress = Math.max(0, particle.progress - tailLength)
        const tailRadius =
          outerRadius - tailProgress * (outerRadius - innerRadius)
        const tailX = centerX + Math.cos(particle.angle) * tailRadius
        const tailY = centerY + Math.sin(particle.angle) * tailRadius

        // Draw particle tail with gradient
        const gradient = ctx.createLinearGradient(tailX, tailY, x, y)
        gradient.addColorStop(0, colors.particleTail)
        gradient.addColorStop(1, colors.particle)

        ctx.strokeStyle = gradient
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(x, y)
        ctx.stroke()

        // Draw particle head
        ctx.fillStyle = colors.particle
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()

        // Update particle position
        particle.progress += particle.speed
        if (particle.progress > 1) {
          particle.progress = 0
          particle.speed = 0.004 + Math.random() * 0.003
        }
      })

      // Draw center node (larger, destination)
      ctx.fillStyle = colors.node
      ctx.beginPath()
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = colors.nodeBorder
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2)
      ctx.stroke()

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

export default AnimatedFlow
