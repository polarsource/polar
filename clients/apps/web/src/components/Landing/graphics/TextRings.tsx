'use client'

import { useEffect, useRef } from 'react'
import { useInView } from '@/hooks/useInView'

/**
 * TextRings — concentric rings of text placed along circular paths.
 * Letter-spacing animates from collapsed (all characters bunched at
 * one point) to fully distributed around each ring, staggered from
 * the innermost ring outward with a cubic-bezier ease.
 */

const WORD = 'POLAR'

// Cubic ease-in-out
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

const RING_COUNT = 14
const MIN_R_FRAC = 0.06
const RING_STEP_FRAC = 0.028
// Minimum pixel gap between adjacent rings' text. At small canvas sizes
// the font shrinks to keep this gap visible.
const MIN_GAP_PX = 2

export const TextRings = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const { ref: wrapperRef, inView } = useInView()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!inView) return

    const dpr = window.devicePixelRatio ?? 1
    const size = canvas.offsetWidth
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const cx = size / 2
    const cy = size / 2
    const mono =
      getComputedStyle(canvas).getPropertyValue('--font-sans').trim() ||
      'sans-serif'

    // Precompute ring data — each ring gets exactly one copy of the word
    const ringStep = size * RING_STEP_FRAC
    const fontSize = Math.max(4, Math.min(size * 0.018, ringStep - MIN_GAP_PX))
    const rings = Array.from({ length: RING_COUNT }, (_, i) => {
      const radius = size * (MIN_R_FRAC + i * RING_STEP_FRAC)

      return {
        radius,
        fontSize,
        text: WORD,
        charCount: WORD.length,
        direction: i % 2 === 0 ? 1 : -1,
        stagger: i * 0.12,
      }
    })

    let lastTime: number | null = null
    let time = 0

    const draw = (now: number) => {
      const dt = lastTime === null ? 0 : (now - lastTime) / 1000
      lastTime = now
      time += dt

      ctx.clearRect(0, 0, size, size)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const styles = getComputedStyle(canvas)
      ctx.fillStyle =
        styles.getPropertyValue('--color-graphic-stroke').trim() ||
        'rgb(190, 190, 190)'

      for (const ring of rings) {
        // Oscillating progress: never fully collapses — stays readable
        const MIN_SPREAD = 0.4
        const phase = time * 0.4 - ring.stagger
        const raw = (Math.sin(phase) + 1) / 2
        const progress = MIN_SPREAD + ease(raw) * (1 - MIN_SPREAD)

        ctx.font = `${ring.fontSize}px ${mono}`

        // Slow base rotation
        const drift = time * 0.06 * ring.direction

        // Arc span for the word at current progress
        const arcSpan =
          (ring.charCount / (ring.charCount + 1)) * Math.PI * progress

        // Draw two arcs per ring — top and bottom — so "POLAR" always
        // reads left-to-right regardless of orientation.

        // TOP ARC: characters upright, reading L→R = CW across top
        const topCenter = -Math.PI / 2 + drift
        for (let j = 0; j < ring.charCount; j++) {
          const t = j / (ring.charCount - 1) - 0.5 // -0.5 to 0.5
          const angle = topCenter + t * arcSpan
          const x = cx + Math.cos(angle) * ring.radius
          const y = cy + Math.sin(angle) * ring.radius
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(angle + Math.PI / 2)
          ctx.fillText(ring.text[j], 0, 0)
          ctx.restore()
        }

        // BOTTOM ARC: characters inverted, reading L→R = CCW across bottom
        const botCenter = Math.PI / 2 + drift
        for (let j = 0; j < ring.charCount; j++) {
          const t = j / (ring.charCount - 1) - 0.5
          const angle = botCenter - t * arcSpan
          const x = cx + Math.cos(angle) * ring.radius
          const y = cy + Math.sin(angle) * ring.radius
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(angle - Math.PI / 2)
          ctx.fillText(ring.text[j], 0, 0)
          ctx.restore()
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(animRef.current)
  }, [inView])

  return (
    <div ref={wrapperRef} className="aspect-square w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
