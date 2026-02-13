'use client'

import { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'

interface Particle {
  lane: number
  progress: number
  speed: number
  size: number
  opacity: number
  tailLength: number
}

const NUM_LANES = 5
const LANE_YS = [0.12, 0.3, 0.5, 0.7, 0.88]
const CENTER_Y = 0.5
const MERGE_START = 0.3
const MERGE_END = 0.58
const OUTPUT_X = 0.92
const INPUT_X = 0.04

const EventStream = ({ className }: { className?: string }) => {
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

    // Get Y position along a lane's pipeline path at a given normalized x
    const getLaneY = (lane: number, nx: number): number => {
      const laneY = LANE_YS[lane]
      if (nx <= MERGE_START) return laneY
      if (nx >= MERGE_END) return CENTER_Y
      const t = (nx - MERGE_START) / (MERGE_END - MERGE_START)
      const ease = t * t * (3 - 2 * t)
      return laneY + (CENTER_Y - laneY) * ease
    }

    // Draw the pipeline infrastructure
    const drawPipeline = (r: number, g: number, b: number) => {
      const pipeAlpha = 0.14
      const nodeAlpha = 0.2
      const nodeRadius = 3

      // Draw each lane path
      for (let lane = 0; lane < NUM_LANES; lane++) {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${pipeAlpha})`
        ctx.lineWidth = 1
        ctx.beginPath()

        const steps = 80
        for (let s = 0; s <= steps; s++) {
          const nx = INPUT_X + (OUTPUT_X - INPUT_X) * (s / steps)
          const ny = getLaneY(lane, nx)
          const px = nx * width
          const py = ny * height
          if (s === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()

        // Input node
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${nodeAlpha})`
        ctx.beginPath()
        ctx.arc(INPUT_X * width, LANE_YS[lane] * height, nodeRadius, 0, Math.PI * 2)
        ctx.fill()
      }

      // Merge junction node
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${nodeAlpha})`
      ctx.beginPath()
      ctx.arc(MERGE_END * width, CENTER_Y * height, nodeRadius + 1, 0, Math.PI * 2)
      ctx.fill()
    }

    const particles: Particle[] = []

    const createParticle = (): Particle => ({
      lane: Math.floor(Math.random() * NUM_LANES),
      progress: 0,
      speed: 0.003 + Math.random() * 0.004,
      size: 1.2 + Math.random() * 1.3,
      opacity: 0.35 + Math.random() * 0.65,
      tailLength: 0.04 + Math.random() * 0.05,
    })

    // Pre-seed
    for (let i = 0; i < 18; i++) {
      const p = createParticle()
      p.progress = Math.random()
      particles.push(p)
    }

    let glowIntensity = 0
    let lastGlowTime = 0
    const GLOW_COOLDOWN = 500

    const getParticlePos = (p: Particle, t: number) => {
      const nx = INPUT_X + (OUTPUT_X - INPUT_X) * t
      return { x: nx, y: getLaneY(p.lane, nx) }
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      const { r, g, b } = getColor()

      drawPipeline(r, g, b)

      // Spawn
      if (Math.random() < 0.12) {
        particles.push(createParticle())
      }

      let arrivals = 0

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]

        const head = getParticlePos(p, p.progress)
        const tailT = Math.max(0, p.progress - p.tailLength)
        const tail = getParticlePos(p, tailT)

        const hx = head.x * width
        const hy = head.y * height
        const tx = tail.x * width
        const ty = tail.y * height

        // Slight fade near end
        const proximity = Math.max(0, 1 - p.progress)
        const alpha = p.opacity * Math.min(1, proximity * 3)

        // Comet tail along the curve
        const grad = ctx.createLinearGradient(tx, ty, hx, hy)
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`)
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha})`)

        ctx.strokeStyle = grad
        ctx.lineWidth = p.size
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(tx, ty)

        // Draw segmented curve following the pipeline path
        const segments = 6
        for (let s = 1; s <= segments; s++) {
          const st = tailT + (p.progress - tailT) * (s / segments)
          const sp = getParticlePos(p, st)
          ctx.lineTo(sp.x * width, sp.y * height)
        }
        ctx.stroke()

        // Head dot
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
        ctx.beginPath()
        ctx.arc(hx, hy, p.size * 0.7, 0, Math.PI * 2)
        ctx.fill()

        p.progress += p.speed

        if (p.progress >= 1) {
          arrivals++
          particles.splice(i, 1)
        }
      }

      // Output node glow — debounced to avoid rapid flashing
      const now = performance.now()
      if (arrivals > 0 && now - lastGlowTime >= GLOW_COOLDOWN) {
        glowIntensity = Math.min(1, glowIntensity + 0.35)
        lastGlowTime = now
      }
      glowIntensity *= 0.94

      const ox = OUTPUT_X * width
      const oy = CENTER_Y * height
      const glowR = 14 + glowIntensity * 12

      const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, glowR)
      glow.addColorStop(
        0,
        `rgba(${r}, ${g}, ${b}, ${0.08 + glowIntensity * 0.25})`,
      )
      glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(ox, oy, glowR, 0, Math.PI * 2)
      ctx.fill()

      // Output dot
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.25 + glowIntensity * 0.45})`
      ctx.beginPath()
      ctx.arc(ox, oy, 3, 0, Math.PI * 2)
      ctx.fill()

      // Output ring
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.06 + glowIntensity * 0.12})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(ox, oy, 8 + glowIntensity * 4, 0, Math.PI * 2)
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

export default EventStream
