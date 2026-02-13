'use client'

import { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface Ripple {
  radius: number
  maxRadius: number
  opacity: number
  speed: number
}

interface ReturnParticle {
  angle: number
  progress: number // 1 = outer edge, 0 = center
  speed: number
  opacity: number
  size: number
}

const CheckoutFlow = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const getColor = () => {
      const isDark = document.documentElement.classList.contains('dark')
      return isDark
        ? { r: 255, g: 255, b: 255 }
        : { r: 0, g: 0, b: 0 }
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

    const ripples: Ripple[] = []
    const particles: ReturnParticle[] = []
    let time = 0
    let nextRipple = 0
    let centerGlow = 0

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      const { r, g, b } = getColor()

      const cx = width / 2
      const cy = height / 2
      const maxR = Math.min(width, height) * 0.45

      // Spawn ripples periodically
      if (time >= nextRipple) {
        ripples.push({
          radius: 8,
          maxRadius: maxR,
          opacity: 0.35,
          speed: 0.8 + Math.random() * 0.4,
        })
        nextRipple = time + 80 + Math.random() * 40
      }

      // Draw & update ripples (outward expanding rings)
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i]
        const progress = rip.radius / rip.maxRadius
        const alpha = rip.opacity * (1 - progress)

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, cy, rip.radius, 0, Math.PI * 2)
        ctx.stroke()

        // Spawn return particles at the wavefront
        if (Math.random() < 0.06 && rip.radius > maxR * 0.3) {
          const angle = Math.random() * Math.PI * 2
          particles.push({
            angle,
            progress: progress,
            speed: 0.004 + Math.random() * 0.004,
            opacity: 0.3 + Math.random() * 0.4,
            size: 1.2 + Math.random() * 1,
          })
        }

        rip.radius += rip.speed

        if (rip.radius >= rip.maxRadius) {
          ripples.splice(i, 1)
        }
      }

      // Draw & update return particles (flowing inward)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        const currentR = p.progress * maxR
        const px = cx + Math.cos(p.angle) * currentR
        const py = cy + Math.sin(p.angle) * currentR

        // Tail
        const tailR = Math.min(1, p.progress + 0.08) * maxR
        const tx = cx + Math.cos(p.angle) * tailR
        const ty = cy + Math.sin(p.angle) * tailR

        const fadeIn = Math.min(1, (1 - p.progress) * 5)
        const alpha = p.opacity * fadeIn

        // Trail gradient
        const grad = ctx.createLinearGradient(tx, ty, px, py)
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha})`)

        ctx.strokeStyle = grad
        ctx.lineWidth = p.size
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(px, py)
        ctx.stroke()

        // Head
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
        ctx.beginPath()
        ctx.arc(px, py, p.size * 0.7, 0, Math.PI * 2)
        ctx.fill()

        p.progress -= p.speed

        if (p.progress <= 0.02) {
          centerGlow = Math.min(1, centerGlow + 0.25)
          particles.splice(i, 1)
        }
      }

      // Decay center glow
      centerGlow *= 0.96

      // Center node
      const pulse = 0.5 + Math.sin(time * 0.04) * 0.15

      // Glow ring
      const glowR = 16 + centerGlow * 10
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
      glow.addColorStop(
        0,
        `rgba(${r}, ${g}, ${b}, ${0.08 + centerGlow * 0.2 + pulse * 0.05})`,
      )
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2)
      ctx.fill()

      // Center dot
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.2 + centerGlow * 0.3 + pulse * 0.1})`
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fill()

      // Outer ring
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.08 + centerGlow * 0.1})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, 9, 0, Math.PI * 2)
      ctx.stroke()

      time++
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

export default CheckoutFlow
