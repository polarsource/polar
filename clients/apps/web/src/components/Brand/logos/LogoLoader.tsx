'use client'

import {
  cubicBezier,
  motion,
  useReducedMotion,
  type Transition,
} from 'motion/react'
import { useId } from 'react'
import {
  LOGO_ICON_VIEWBOX,
  LOGO_MARK_ARC_PATH,
  LOGO_MARK_ARC_STROKE_WIDTH,
  LOGO_MARK_ARC_STROKES,
  LOGO_MARK_HUB,
  LOGO_MARK_PATH,
  LOGO_MARK_RAYS_PATH,
} from './paths'
import { LOGO_REVEAL_ARC, LOGO_REVEAL_EASE, LOGO_REVEAL_RAYS } from './timing'

// The reveal played forwards, then backwards, on repeat. The loop covers the
// stretch of the reveal where something visibly moves (before it only a speck
// at the centre shows, after it the curve is settling past the rim), plus a
// short rest at each turnaround.
const MOVING_FROM = 0.1
const MOVING_TO = 0.76
// Seconds the loop stays empty after the exit and complete after the enter.
const REST = 0.4
const FROM = MOVING_FROM - REST / 2
const TO = MOVING_TO + REST / 2
const STEPS = 48

const ease = cubicBezier(...LOGO_REVEAL_EASE)

const thereAndBack = ({
  duration,
  delay,
}: {
  duration: number
  delay: number
}) => {
  const forwards = Array.from({ length: STEPS + 1 }, (_, step) => {
    const time = FROM + ((TO - FROM) * step) / STEPS
    return ease(Math.min(Math.max((time - delay) / duration, 0), 1))
  })
  return [...forwards, ...forwards.slice(0, -1).reverse()]
}

const raysProgress = thereAndBack(LOGO_REVEAL_RAYS)
const arcProgress = thereAndBack(LOGO_REVEAL_ARC)

const loop: Transition = {
  duration: (TO - FROM) * 2,
  ease: 'linear',
  repeat: Infinity,
}

const { cx, cy, r } = LOGO_MARK_HUB

const LogoLoader = ({
  size = 29,
  className,
}: {
  size?: number
  className?: string
}) => {
  const id = useId()
  const reducedMotion = useReducedMotion()

  const svgProps = {
    width: size,
    height: size,
    viewBox: LOGO_ICON_VIEWBOX,
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
    role: 'status',
    'aria-label': 'Loading',
  }

  if (reducedMotion) {
    return (
      <motion.svg
        {...svgProps}
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
      >
        <path d={LOGO_MARK_PATH} fill="currentColor" />
      </motion.svg>
    )
  }

  return (
    <svg {...svgProps}>
      <mask id={`${id}-rays`}>
        <motion.circle
          cx={cx}
          cy={cy}
          fill="white"
          initial={{ r: 0 }}
          animate={{ r: raysProgress.map((progress) => progress * r) }}
          transition={loop}
        />
      </mask>
      <mask id={`${id}-arc`}>
        {LOGO_MARK_ARC_STROKES.map((d) => (
          <motion.path
            key={d}
            d={d}
            stroke="white"
            strokeWidth={LOGO_MARK_ARC_STROKE_WIDTH}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: arcProgress }}
            transition={loop}
          />
        ))}
      </mask>
      <path
        d={LOGO_MARK_RAYS_PATH}
        fill="currentColor"
        mask={`url(#${id}-rays)`}
      />
      <path
        d={LOGO_MARK_ARC_PATH}
        fill="currentColor"
        mask={`url(#${id}-arc)`}
      />
    </svg>
  )
}

export default LogoLoader
