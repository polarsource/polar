'use client'

import React, { useEffect, useRef, useState } from 'react'
import { PolarLogotype } from '../Layout/Public/PolarLogotype'
import { SectionLayout } from './SectionLayout'

const words = [
  'Payments',
  'Subscriptions',
  'Donations',
  'Licensing',
  'Products',
  'Checkouts',
  'Benefits',
  'Webhooks',
  'Analytics',
  'Storefronts',
]

// Ease-in-out cubic
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const POSITIONS_PER_CIRCLE = 16 * words.length
const POSITION_ANGLE = (2 * Math.PI) / POSITIONS_PER_CIRCLE
// Each step advances by exactly 1 word position so the next word lands at center
const STEP_ANGLE = POSITION_ANGLE

export function CarouselSection() {
  const [rotation, setRotation] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const stepRef = useRef(0)
  const animatingRef = useRef(false)
  const startRotationRef = useRef(0)
  const startTimeRef = useRef(0)
  const animationRef = useRef<number>(0)

  const stepDuration = 600 // ms easing between words
  const pauseDuration = 1000 // ms hold center word

  useEffect(() => {
    const tick = (time: number) => {
      if (!animatingRef.current) {
        // Start a new step
        animatingRef.current = true
        startRotationRef.current = stepRef.current * STEP_ANGLE
        stepRef.current += 1
        startTimeRef.current = time
      }

      const elapsed = time - startTimeRef.current
      const targetRotation = stepRef.current * STEP_ANGLE

      if (elapsed < stepDuration) {
        // Animating
        setIsPaused(false)
        const progress = easeInOutCubic(elapsed / stepDuration)
        const current =
          startRotationRef.current +
          (targetRotation - startRotationRef.current) * progress
        setRotation(current)
      } else if (elapsed < stepDuration + pauseDuration) {
        // Pausing — word is settled at center
        setIsPaused(true)
        setRotation(targetRotation)
      } else {
        // Done pausing — start next step
        setIsPaused(false)
        animatingRef.current = false
      }

      animationRef.current = requestAnimationFrame(tick)
    }
    animationRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationRef.current)
  }, [])

  // Giant circle — only the right arc is visible
  const R = 1200
  const cx = -980
  const cy = 350

  const totalPositions = POSITIONS_PER_CIRCLE
  const spacing = POSITION_ANGLE

  // Render arc with fade buffer
  const renderArc = 0.38

  const items: React.ReactNode[] = []

  for (let i = 0; i < totalPositions; i++) {
    const fixedAngle = i * spacing
    const theta = fixedAngle - rotation
    // Normalize to [-π, π]
    const normalized =
      (((theta % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI

    if (Math.abs(normalized) > renderArc) continue

    const x = cx + R * Math.cos(normalized)
    const y = cy + R * Math.sin(normalized)
    const rotDeg = (normalized * 180) / Math.PI

    const wordIndex = i % words.length

    // Steep parabolic opacity: heavily center-weighted
    const t = normalized / renderArc
    const opacity = Math.max(0.2, Math.pow(1 - t * t, 200))

    const isCenter = Math.abs(normalized) < spacing * 0.5
    const xNudge = isCenter && isPaused ? 24 : 0

    items.push(
      <div
        key={i}
        className="absolute whitespace-nowrap transition-all duration-700 ease-in-out"
        style={{
          left: x + xNudge,
          top: y,
          transform: `translate(0, -50%) rotate(${rotDeg}deg)`,
          transformOrigin: 'left center',
          opacity,
        }}
      >
        <span className="text-4xl font-light text-black dark:text-white">
          {words[wordIndex]}
        </span>
      </div>,
    )
  }

  return (
    <SectionLayout label="08 / Product Carousel">
      <div className="dark:bg-polar-900 relative grid h-[700px] grid-cols-2 items-center bg-neutral-100">
        <div className="flex items-center justify-center">
          <PolarLogotype
            logoVariant="logotype"
            className="text-black dark:text-white"
            size={320}
          />
        </div>
        <div className="relative h-full overflow-hidden">{items}</div>
      </div>
    </SectionLayout>
  )
}
