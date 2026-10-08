'use client'

import { motion, useReducedMotion, type Variants } from 'motion/react'
import { useId } from 'react'
import {
  LOGO_ICON_VIEWBOX,
  LOGO_MARK_ARC_PATH,
  LOGO_MARK_ARC_STROKE_WIDTH,
  LOGO_MARK_ARC_STROKES,
  LOGO_MARK_HUB,
  LOGO_MARK_RAYS_PATH,
  LOGO_TYPE_VIEWBOX,
  LOGO_WORDMARK_PATH,
} from './paths'
import { LOGO_REVEAL_ARC, LOGO_REVEAL_EASE, LOGO_REVEAL_RAYS } from './timing'

const EASE_FADE = [0.4, 0, 0.6, 1] as const

const rays: Variants = {
  hidden: { r: 0 },
  visible: {
    r: LOGO_MARK_HUB.r,
    transition: { ...LOGO_REVEAL_RAYS, ease: LOGO_REVEAL_EASE },
  },
}

const arc: Variants = {
  hidden: { pathLength: 0 },
  visible: {
    pathLength: 1,
    transition: { ...LOGO_REVEAL_ARC, ease: LOGO_REVEAL_EASE },
  },
}

const wordmark: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      x: { duration: 1.1, delay: 0.08, ease: LOGO_REVEAL_EASE },
      opacity: { duration: 0.55, delay: 0.3, ease: EASE_FADE },
    },
  },
}

const LogoReveal = ({
  variant = 'logotype',
  size,
  className,
}: {
  variant?: 'icon' | 'logotype'
  size?: number
  className?: string
}) => {
  const id = useId()
  const reducedMotion = useReducedMotion()

  return (
    <motion.svg
      width={size}
      height={variant === 'icon' ? size : undefined}
      viewBox={variant === 'icon' ? LOGO_ICON_VIEWBOX : LOGO_TYPE_VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Polar"
      initial={reducedMotion ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.6 }}
    >
      <mask id={`${id}-rays`}>
        <motion.circle
          cx={LOGO_MARK_HUB.cx}
          cy={LOGO_MARK_HUB.cy}
          fill="white"
          variants={rays}
        />
      </mask>
      <mask id={`${id}-arc`}>
        {LOGO_MARK_ARC_STROKES.map((d) => (
          <motion.path
            key={d}
            d={d}
            stroke="white"
            strokeWidth={LOGO_MARK_ARC_STROKE_WIDTH}
            variants={arc}
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
      {variant === 'logotype' ? (
        <motion.path
          d={LOGO_WORDMARK_PATH}
          fill="currentColor"
          variants={wordmark}
        />
      ) : null}
    </motion.svg>
  )
}

export default LogoReveal
