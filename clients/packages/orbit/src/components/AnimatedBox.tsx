'use client'

import { motion, type Transition } from 'framer-motion'
import React from 'react'
import {
  animations,
  type AnimationDelay,
  type AnimationName,
  type AnimationProperties,
  type AnimationToken,
} from '../tokens/animations'
import { Box, type BoxProps } from './Box'

const MotionBox = motion.create(Box)

const EASING_MAP: Record<AnimationToken['easing'], Transition['ease']> = {
  linear: 'linear',
  ease: 'easeInOut',
  'ease-in': 'easeIn',
  'ease-out': 'easeOut',
  'ease-in-out': 'easeInOut',
}

const toFramerTarget = (properties?: AnimationProperties) => {
  if (!properties) return undefined
  const target: Record<string, number> = {}
  if (properties.opacity !== undefined) target.opacity = properties.opacity
  if (properties.translateX !== undefined) target.x = properties.translateX
  if (properties.translateY !== undefined) target.y = properties.translateY
  if (properties.scale !== undefined) target.scale = properties.scale
  if (properties.rotate !== undefined) target.rotate = properties.rotate
  return target
}

const toTransition = (
  token: AnimationToken,
  delayOverrideMs?: number,
): Transition => ({
  duration: token.duration / 1000,
  delay: (delayOverrideMs ?? token.delay ?? 0) / 1000,
  ease: EASING_MAP[token.easing],
  repeat: token.repeat === 'infinite' ? Infinity : (token.repeat ?? 0),
  repeatType: token.direction === 'alternate' ? 'reverse' : 'loop',
})

type AnimatedBoxOwnProps = {
  animation?: AnimationName
  entering?: AnimationName
  exiting?: AnimationName
  delay?: AnimationDelay
  inView?: boolean
  inViewRepeat?: boolean
  staggerIndex?: number
  staggerStep?: AnimationDelay
  onComplete?: () => void
}

export type Props = BoxProps & AnimatedBoxOwnProps

export const AnimatedBox = ({
  animation,
  entering,
  exiting,
  delay,
  inView,
  inViewRepeat,
  staggerIndex,
  staggerStep,
  onComplete,
  ...rest
}: Props) => {
  const enterName = entering ?? animation
  const enterToken = enterName ? animations[enterName] : undefined
  const exitToken = exiting ? animations[exiting] : undefined

  const baseDelayMs = delay !== undefined ? Number(delay) : 0
  const staggerDelayMs =
    staggerIndex !== undefined ? staggerIndex * Number(staggerStep ?? '100') : 0
  const totalDelayMs = baseDelayMs + staggerDelayMs
  const delayMs = totalDelayMs > 0 ? totalDelayMs : undefined

  const initial = toFramerTarget(enterToken?.from)
  const animate = toFramerTarget(enterToken?.to)
  const exit = toFramerTarget(exitToken?.to)
  const transition = enterToken ? toTransition(enterToken, delayMs) : undefined

  const motionProps = inView
    ? {
        initial,
        whileInView: animate,
        viewport: { once: !inViewRepeat },
        exit,
        transition,
      }
    : {
        initial,
        animate,
        exit,
        transition,
      }

  return (
    <MotionBox
      {...motionProps}
      onAnimationComplete={onComplete}
      {...(rest as React.ComponentProps<typeof MotionBox>)}
    />
  )
}
