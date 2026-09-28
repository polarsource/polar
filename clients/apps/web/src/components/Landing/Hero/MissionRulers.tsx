'use client'

import { useInView } from '@/hooks/useInView'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { RefObject, useEffect, useRef } from 'react'

const HEIGHT = 72
const LABEL_HEIGHT = 16
const TICK_HEIGHT = 28
const TICK_ALPHA = 0.35
const HANDOFF = 0.25
const BASE_TICK_HEIGHT = 12
const LABEL_ALPHA = 0.35
const BUMP_REACH = 2
const SUBDIVISIONS = 4
const KILOTOKENS_PER_DOLLAR = 6
const STARTING_KILOTOKENS = 240_000
const KILOTOKENS_PER_SECOND = 4_800
const SWELL = 0.3
const SWELL_PERIOD = (Math.PI * 2) / 4.8

// Thousands of tokens streamed after `seconds`. The rate eases between 0.7x
// and 1.3x on a sine wave, like a model streaming a response.
const streamedTokens = (seconds: number) =>
  STARTING_KILOTOKENS +
  KILOTOKENS_PER_SECOND *
    (seconds + (SWELL * (1 - Math.cos(SWELL_PERIOD * seconds))) / SWELL_PERIOD)

const earnedDollars = (seconds: number) =>
  streamedTokens(seconds) / KILOTOKENS_PER_DOLLAR

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

interface Clock {
  elapsed: number
  resumedAt: number | null
}

const clockSeconds = (clock: Clock, now: number) =>
  (clock.elapsed + (clock.resumedAt === null ? 0 : now - clock.resumedAt)) /
  1000

interface RulerProps {
  active: boolean
  clock: RefObject<Clock>
  valueAt: (seconds: number) => number
  unit: number
  pointer: number
  flip?: boolean
  format: (value: number) => string
}

const Ruler = ({
  active,
  clock,
  valueAt,
  unit,
  pointer,
  flip = false,
  format,
}: RulerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !active) return

    const styles = getComputedStyle(canvas)
    const stroke =
      styles.getPropertyValue('--color-graphic-stroke').trim() || '#fff'
    const font = `12px ${styles.fontFamily}`
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let width = 0
    let pillWidth = 0
    let measuredLength = 0
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
      measuredLength = 0
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const y = (offset: number) => (flip ? HEIGHT - offset : offset)
    const labelY = y(TICK_HEIGHT + 26)

    const draw = (now: number) => {
      const value = valueAt(
        reducedMotion ? 0 : clockSeconds(clock.current, now),
      )
      const spacing = width < 640 ? 56 : 72
      const pointerX = width * pointer
      const xAt = (v: number) => pointerX + ((v - value) / unit) * spacing
      const label = format(value)
      if (label.length > measuredLength) {
        measuredLength = label.length
        pillWidth = Math.max(pillWidth, ctx.measureText(label).width + 16)
      }
      const clearance = pillWidth / 2

      ctx.clearRect(0, 0, width, HEIGHT)

      const step = unit / SUBDIVISIONS
      const first =
        Math.floor((value - (pointerX / spacing) * unit) / step) * step
      const pitch = spacing / SUBDIVISIONS
      const tickLength = (x: number) => {
        const distance = Math.abs(x - pointerX) / (pitch * BUMP_REACH)
        const bump = Math.max(0, 1 - distance * distance)
        return BASE_TICK_HEIGHT + (TICK_HEIGHT - BASE_TICK_HEIGHT) * bump
      }
      const highlighted: { x: number; strength: number }[] = []
      ctx.globalAlpha = TICK_ALPHA
      ctx.beginPath()
      for (let v = first; xAt(v) <= width + spacing; v += step) {
        const x = xAt(v)
        const strength =
          1 -
          smoothstep(
            pitch * (0.5 - HANDOFF),
            pitch * (0.5 + HANDOFF),
            Math.abs(x - pointerX),
          )
        if (strength > 0) {
          highlighted.push({ x, strength })
          continue
        }
        ctx.moveTo(x, y(0))
        ctx.lineTo(x, y(tickLength(x)))
      }
      ctx.stroke()
      for (const { x, strength } of highlighted) {
        ctx.globalAlpha = TICK_ALPHA + (1 - TICK_ALPHA) * strength
        ctx.beginPath()
        ctx.moveTo(x, y(0))
        ctx.lineTo(x, y(tickLength(x)))
        ctx.stroke()
      }

      const firstLabel = Math.floor(first / unit) * unit
      for (let v = firstLabel; xAt(v) <= width + spacing; v += unit) {
        const x = xAt(v)
        const distance = Math.abs(x - pointerX)
        const alpha =
          LABEL_ALPHA * smoothstep(clearance, clearance + 28, distance)
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
      ctx.moveTo(pointerX, y(TICK_HEIGHT + 3))
      ctx.lineTo(pointerX - 4, y(TICK_HEIGHT + 10))
      ctx.lineTo(pointerX + 4, y(TICK_HEIGHT + 10))
      ctx.closePath()
      ctx.roundRect(pointerX - clearance, labelY - 11, pillWidth, 22, 11)
      ctx.fill()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillText(label, pointerX, labelY)
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
  }, [active, clock, valueAt, unit, pointer, flip, format])

  return (
    <Box display="block">
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

const formatTokens = (kilotokens: number) =>
  kilotokens < 1_000
    ? `${Math.floor(kilotokens)}k`
    : `${Math.floor(kilotokens / 1_000)}M`

const formatDollars = (dollars: number) => {
  if (dollars < 1_000) return `$${Math.floor(dollars)}`
  if (dollars < 1_000_000) return `$${Math.floor(dollars / 1_000)}k`
  return `$${Math.floor(dollars / 1_000_000)}M`
}

export const MissionRulers = () => {
  const { ref, inView } = useInView()
  const clock = useRef<Clock>({ elapsed: 0, resumedAt: null })

  useEffect(() => {
    if (!inView) return
    const current = clock.current
    current.resumedAt = performance.now()
    return () => {
      current.elapsed += performance.now() - (current.resumedAt ?? 0)
      current.resumedAt = null
    }
  }, [inView])

  return (
    <Box
      ref={ref}
      flexDirection="column"
      rowGap={{ base: '2xl', md: '4xl' }}
      paddingVertical="xl"
    >
      <Ruler
        active={inView}
        clock={clock}
        valueAt={streamedTokens}
        unit={5_000}
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
        active={inView}
        clock={clock}
        valueAt={earnedDollars}
        unit={2_000}
        pointer={0.3}
        flip
        format={formatDollars}
      />
    </Box>
  )
}
