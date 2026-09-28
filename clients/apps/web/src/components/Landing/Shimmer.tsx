'use client'

import { gsap } from 'gsap'
import { useEffect, useRef } from 'react'

export const Shimmer = ({
  active,
  children,
}: {
  active: boolean
  children: string
}) => {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!active) return
    const tween = gsap.fromTo(
      ref.current,
      { backgroundPosition: '100% 0' },
      {
        backgroundPosition: '-100% 0',
        duration: 1.4,
        ease: 'none',
        repeat: -1,
      },
    )
    return () => {
      tween.kill()
    }
  }, [active])

  return (
    <span
      ref={ref}
      style={
        active
          ? {
              backgroundImage:
                'linear-gradient(90deg, currentColor 35%, var(--color-graphic-stroke) 50%, currentColor 65%)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }
          : undefined
      }
    >
      {children}
    </span>
  )
}
