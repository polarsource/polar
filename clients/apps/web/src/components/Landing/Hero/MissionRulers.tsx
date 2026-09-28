'use client'

import { useInView } from '@/hooks/useInView'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useEffect, useRef } from 'react'

const HEIGHT = 96
const LABEL_HEIGHT = 16
const TOKENS_PER_DOLLAR = 6
const BURST = (Math.PI * 2) / 3.2

// Thousands of tokens streamed after `seconds`. The rate swells and eases
// on a (1 - cos)^2 curve, like a model streaming a response.
const streamedTokens = (seconds: number) =>
  240 +
  6 *
    (0.4 * seconds +
      0.4 *
        (1.5 * seconds -
          (2 * Math.sin(BURST * seconds)) / BURST +
          Math.sin(2 * BURST * seconds) / (4 * BURST)))

const earnedDollars = (seconds: number) =>
  streamedTokens(seconds) / TOKENS_PER_DOLLAR

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

interface RulerProps {
  valueAt: (seconds: number) => number
  unit: number
  pointer: number
  flip?: boolean
  format: (value: number) => string
}

const Ruler = ({
  valueAt,
  unit,
  pointer,
  flip = false,
  format,
}: RulerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { ref: wrapperRef, inView } = useInView()

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !inView) return

    const styles = getComputedStyle(canvas)
    const stroke =
      styles.getPropertyValue('--color-graphic-stroke').trim() || '#fff'
    const font = `12px ${styles.fontFamily}`
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let width = 0
    let pillWidth = 0
    let dpr = 1
    const labels = new Map<string, HTMLCanvasElement>()

    const labelSprite = (text: string) => {
      const cached = labels.get(text)
      if (cached) return cached
      if (labels.size > 64) labels.clear()
      const sprite = document.createElement('canvas')
      const spriteCtx = sprite.getContext('2d')!
      spriteCtx.font = font
      const spriteWidth = Math.ceil(spriteCtx.measureText(text).width) + 2
      sprite.width = spriteWidth * dpr
      sprite.height = LABEL_HEIGHT * dpr
      spriteCtx.scale(dpr, dpr)
      spriteCtx.font = font
      spriteCtx.fillStyle = stroke
      spriteCtx.textBaseline = 'middle'
      spriteCtx.fillText(text, 1, LABEL_HEIGHT / 2)
      labels.set(text, sprite)
      return sprite
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio ?? 1, 2)
      labels.clear()
      width = canvas.clientWidth
      canvas.width = width * dpr
      canvas.height = HEIGHT * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = stroke
      ctx.strokeStyle = stroke
      ctx.lineWidth = 1
      pillWidth = ctx.measureText(format(999)).width + 16
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const y = (offset: number) => (flip ? HEIGHT - offset : offset)
    const labelY = y(66)

    const draw = (now: number) => {
      const value = valueAt(reducedMotion ? 0 : now / 1000)
      const spacing = width < 640 ? 56 : 72
      const pointerX = width * pointer
      const xAt = (v: number) => pointerX + ((v - value) / unit) * spacing
      const clearance = pillWidth / 2

      ctx.clearRect(0, 0, width, HEIGHT)

      const step = unit / 2
      const first =
        Math.floor((value - (pointerX / spacing) * unit) / step) * step
      ctx.globalAlpha = 0.35
      ctx.beginPath()
      for (let v = first; xAt(v) <= width + spacing; v += step) {
        const x = xAt(v)
        ctx.moveTo(x, y(0))
        ctx.lineTo(x, y(40))
      }
      ctx.stroke()

      const firstLabel = Math.floor(first / unit) * unit
      for (let v = firstLabel; xAt(v) <= width + spacing; v += unit) {
        const x = xAt(v)
        const distance = Math.abs(x - pointerX)
        const alpha = 0.5 * smoothstep(clearance, clearance + 28, distance)
        if (alpha <= 0) continue
        const sprite = labelSprite(format(v))
        const spriteWidth = sprite.width / dpr
        ctx.globalAlpha = alpha
        ctx.drawImage(
          sprite,
          x - spriteWidth / 2,
          labelY - LABEL_HEIGHT / 2,
          spriteWidth,
          LABEL_HEIGHT,
        )
      }

      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.moveTo(pointerX, y(40))
      ctx.lineTo(pointerX - 4, y(47))
      ctx.lineTo(pointerX + 4, y(47))
      ctx.closePath()
      ctx.roundRect(pointerX - clearance, labelY - 11, pillWidth, 22, 11)
      ctx.fill()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillText(format(value), pointerX, labelY)
      ctx.globalCompositeOperation = 'source-over'
    }

    if (reducedMotion) {
      draw(0)
      return () => observer.disconnect()
    }

    let frame = requestAnimationFrame(function loop(now) {
      draw(now)
      frame = requestAnimationFrame(loop)
    })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [inView, valueAt, unit, pointer, flip, format])

  return (
    <Box ref={wrapperRef} display="block">
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          display: 'block',
          width: '100%',
          height: HEIGHT,
        }}
      />
    </Box>
  )
}

const formatTokens = (value: number) => `${Math.floor(value)}k`
const formatDollars = (value: number) => `$${Math.floor(value)}`

export const MissionRulers = () => (
  <Box
    flexDirection="column"
    rowGap={{ base: '2xl', md: '4xl' }}
    paddingVertical="xl"
  >
    <Ruler
      valueAt={streamedTokens}
      unit={20}
      pointer={0.72}
      format={formatTokens}
    />
    <Box flexDirection="column" alignItems="center" textAlign="center">
      <Text variant="heading-l" as="h2">
        Tokens in,
      </Text>
      <Text variant="heading-l" as="p" color="muted">
        revenue out
      </Text>
    </Box>
    <Ruler
      valueAt={earnedDollars}
      unit={10}
      pointer={0.3}
      flip
      format={formatDollars}
    />
  </Box>
)
