'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const PARAGRAPHS = [
  'Event-based usage billing. Checkouts that convert. Realtime metrics. Worldwide tax handled.',
  `Polar is the financial layer for a new generation of intelligent software.`,
]

export const Vision = () => {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const wordsRef = useRef<HTMLSpanElement[]>([])
  const barRef = useRef<HTMLDivElement>(null)

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

        if (barRef.current) {
          barRef.current.style.height = `${progress * 100}%`
        }
      },
    })

    return () => trigger.kill()
  }, [])

  let wordIndex = 0

  return (
    <div ref={wrapperRef} style={{ height: '300vh' }}>
      <div className="sticky top-0 flex h-screen items-center justify-center">
        <div className="flex flex-row gap-x-6 px-4 md:gap-x-24 md:px-0">
          <div className="dark:bg-polar-700 w-px self-stretch bg-neutral-200">
            <div
              ref={barRef}
              className="w-full bg-black dark:bg-white"
              style={{ height: '0%' }}
            />
          </div>
          <div className="flex flex-col">
            {PARAGRAPHS.map((paragraph, pi) => (
              <p
                key={pi}
                className="font-display text-[clamp(2rem,4.5vw,4rem)] leading-[1.3] font-normal text-neutral-900 not-last:mb-16 dark:text-white"
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
        </div>
      </div>
    </div>
  )
}
