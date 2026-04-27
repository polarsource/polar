'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const PARAGRAPHS = [
  `Polar has the tools to build the financial foundation for tomorrow's software.`,
  'One flat rate covering payment processing, global tax compliance & reliable support.',
]

export const LandingVision = () => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<HTMLSpanElement[]>([])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const words = wordsRef.current
    if (words.length === 0) return

    const trigger = ScrollTrigger.create({
      trigger: wrapper,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const progress = self.progress
        const total = words.length

        for (let i = 0; i < total; i++) {
          const wordProgress = i / total
          const filled = progress > wordProgress
          words[i].style.color = filled ? '' : 'var(--color-graphic-dim)'
        }
      },
    })

    return () => trigger.kill()
  }, [])

  let wordIndex = 0

  return (
    <div ref={wrapperRef} style={{ height: '300vh' }}>
      <section className="sticky top-0 flex h-screen items-center justify-center px-8 md:px-24">
        <div className="max-w-7xl">
          {PARAGRAPHS.map((paragraph, pi) => (
            <p
              key={pi}
              className="mb-16 text-[clamp(2rem,4.5vw,4.5rem)] leading-[1.3] font-normal text-neutral-900 dark:text-white"
            >
              {paragraph.split(' ').map((word, wi) => {
                const idx = wordIndex++
                return (
                  <span
                    key={`${pi}-${wi}`}
                    ref={(el) => {
                      if (el) wordsRef.current[idx] = el
                    }}
                    className="inline-block transition-colors duration-200"
                    style={{ color: 'var(--color-graphic-dim)' }}
                  >
                    {word}
                    &nbsp;
                  </span>
                )
              })}
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}
