'use client'
import { Box } from '@polar-sh/orbit/Box'

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
          words[i].classList.toggle('text-gray-300', !filled)
          words[i].classList.toggle('dark:text-polar-700', !filled)
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
    <Box ref={wrapperRef} style={{ height: '300vh' }}>
      <Box
        position="sticky"
        top={0}
        display="flex"
        height="100vh"
        alignItems="center"
        justifyContent="center"
      >
        <Box
          display="flex"
          flexDirection="row"
          columnGap={{
            base: 'xl',
            md: '5xl',
          }}
          paddingHorizontal={{
            base: 'l',
            md: 'none',
          }}
        >
          <Box width={1} alignSelf="stretch" backgroundColor="border-primary">
            <Box
              width="100%"
              ref={barRef}
              style={{ height: '0%' }}
              backgroundColor="background-opaque"
            />
          </Box>
          <Box display="flex" flexDirection="column">
            {PARAGRAPHS.map((paragraph, pi) => (
              <p
                key={pi}
                className="font-display text-[clamp(2rem,4.5vw,4rem)] leading-[1.3] font-normal text-gray-900 not-last:mb-16 dark:text-white"
              >
                {paragraph.split(' ').map((word, wi) => {
                  const idx = wordIndex++
                  return (
                    <Box
                      as="span"
                      display="inline-block"
                      key={`${pi}-${wi}`}
                      ref={(el) => {
                        if (el) wordsRef.current[idx] = el
                      }}
                      className="dark:text-polar-700 text-gray-300 transition-colors duration-200"
                    >
                      {word}
                      &nbsp;
                    </Box>
                  )
                })}
              </p>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
