'use client'

import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)
const LERP_SPEED = 0.04

export interface Dot {
  x: number
  y: number
  r: number
}

export function generatePhyllotaxis(
  count: number,
  spread: number,
  centerX: number,
  centerY: number,
): Dot[] {
  const dots: Dot[] = []
  for (let i = 1; i <= count; i++) {
    const angle = i * GOLDEN_ANGLE
    const radius = spread * Math.sqrt(i)
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    dots.push({ x, y, r: 2 })
  }
  return dots
}

export function PhyllotaxisSunflower({ size = 400 }: { size?: number }) {
  const { resolvedTheme } = useTheme()
  const fill = resolvedTheme === 'dark' ? 'white' : 'black'

  const center = size / 2
  const svgRef = useRef<SVGSVGElement>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const currentDotsRef = useRef<Dot[] | null>(null)
  const rafRef = useRef<number>(0)
  const [renderedDots, setRenderedDots] = useState<Dot[]>([])

  const dots = useMemo(() => {
    const allDots = generatePhyllotaxis(300, size / 37.5, center, center)
    const maxRadius = size / 2 - 20
    return allDots.filter((dot) => {
      const dx = dot.x - center
      const dy = dot.y - center
      return Math.sqrt(dx * dx + dy * dy) <= maxRadius
    })
  }, [center, size])

  const influenceRadius = size * 2
  const maxDisplacement = size * 0.08

  const computeTargets = useCallback(
    (mouse: { x: number; y: number } | null): Dot[] => {
      if (!mouse) return dots

      return dots.map((dot) => {
        const dx = dot.x - mouse.x
        const dy = dot.y - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > influenceRadius || dist < 0.01) return dot

        const t = 1 - dist / influenceRadius
        const ease = t * t * t
        const displacement = ease * maxDisplacement
        const nx = dx / dist
        const ny = dy / dist

        return {
          x: dot.x + nx * displacement,
          y: dot.y + ny * displacement,
          r: dot.r + ease * 1.2,
        }
      })
    },
    [dots, influenceRadius, maxDisplacement],
  )

  useEffect(() => {
    currentDotsRef.current = dots.map((d) => ({ ...d }))
    setRenderedDots(dots)
  }, [dots])

  useEffect(() => {
    let active = true

    const tick = () => {
      if (!active) return

      const current = currentDotsRef.current
      if (!current || current.length === 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const targets = computeTargets(mouseRef.current)
      let needsUpdate = false

      for (let i = 0; i < current.length; i++) {
        const target = targets[i]
        const dx = target.x - current[i].x
        const dy = target.y - current[i].y
        const dr = target.r - current[i].r

        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(dr) > 0.01) {
          current[i] = {
            x: current[i].x + dx * LERP_SPEED,
            y: current[i].y + dy * LERP_SPEED,
            r: current[i].r + dr * LERP_SPEED,
          }
          needsUpdate = true
        }
      }

      if (needsUpdate) {
        setRenderedDots([...current])
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      active = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [computeTargets])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const scaleX = size / rect.width
      const scaleY = size / rect.height
      mouseRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    },
    [size],
  )

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = null
  }, [])

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="max-w-full cursor-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {renderedDots.map((dot, i) => (
        <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={fill} />
      ))}
    </svg>
  )
}
