'use client'

import { Avatar, Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'

export interface Testimonial {
  link: string
  name: string
  company: string
  quote: string
  avatar?: string
  logo?: ReactNode
}

const buttonReset: CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
}

const TestimonialNavigator = ({
  direction,
}: {
  direction: 'previous' | 'next'
}) => (direction === 'next' ? <ArrowRight /> : <ArrowLeft />)

const SlideshowRail = ({
  side,
  testimonial,
  onClick,
}: {
  side: 'previous' | 'next'
  testimonial: Testimonial
  onClick: () => void
}) => (
  <Box display={{ base: 'none', md: 'flex' }} alignItems="stretch">
    <button
      type="button"
      onClick={onClick}
      aria-label={`${side === 'previous' ? 'Previous' : 'Next'} testimonial, from ${testimonial.name}`}
      style={{ ...buttonReset, display: 'flex' }}
    >
      <Box
        paddingHorizontal="2xl"
        alignItems="center"
        justifyContent="center"
        backgroundColor={{
          base: 'background-secondary',
          hover: 'background-card',
        }}
        transitionProperty="colors"
        transitionDuration="fast"
      >
        <TestimonialNavigator direction={side} />
      </Box>
    </button>
  </Box>
)

const TestimonialIdentity = ({ testimonial }: { testimonial: Testimonial }) => {
  if (testimonial.logo) {
    return <Box alignItems="center">{testimonial.logo}</Box>
  }

  return (
    <Avatar
      avatar_url={testimonial.avatar ?? ''}
      name={testimonial.name}
      className="size-14"
    />
  )
}

export const TestimonialSlideshow = ({
  testimonials,
}: {
  testimonials: Testimonial[]
}) => {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = testimonials.length
  const go = (to: number) => setIndex(((to % count) + count) % count)

  useEffect(() => {
    if (paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 8000)
    return () => clearInterval(timer)
  }, [count, paused, index])

  const current = testimonials[index]

  return (
    <Box flexDirection="column" rowGap="l">
      <Box
        columnGap="s"
        alignItems="stretch"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <SlideshowRail
          side="previous"
          testimonial={testimonials[(index - 1 + count) % count]}
          onClick={() => go(index - 1)}
        />
        <Box
          position="relative"
          flex={1}
          flexDirection="column"
          backgroundColor="background-secondary"
          padding={{ base: '2xl', md: '4xl' }}
          minHeight={{ base: 380, md: 480 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              className="flex flex-1 flex-col justify-between gap-12"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3 }}
            >
              <Box display="block" maxWidth="64rem">
                <Text variant="heading-s" as="p" wrap="balance">
                  &ldquo;{current.quote}&rdquo;
                </Text>
              </Box>
              <Link href={current.link} target="_blank">
                <Box alignItems="center" columnGap="xl">
                  <TestimonialIdentity testimonial={current} />
                  <Box flexDirection="column">
                    <Text variant="heading-xxs" as="span">
                      {current.name}
                    </Text>
                    <Text variant="heading-xxs" as="span" color="muted">
                      {current.company}
                    </Text>
                  </Box>
                </Box>
              </Link>
            </motion.div>
          </AnimatePresence>
        </Box>
        <SlideshowRail
          side="next"
          testimonial={testimonials[(index + 1) % count]}
          onClick={() => go(index + 1)}
        />
      </Box>
      <Box
        alignItems="center"
        justifyContent={{ base: 'between', md: 'center' }}
        columnGap="l"
      >
        <Box display={{ base: 'flex', md: 'none' }}>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous testimonial"
            onClick={() => go(index - 1)}
          >
            <ArrowLeft className="size-4" />
          </Button>
        </Box>
        <Box alignItems="center" columnGap="s">
          {testimonials.map((testimonial, i) => (
            <button
              key={testimonial.name}
              type="button"
              aria-label={`Show testimonial from ${testimonial.name}`}
              onClick={() => go(i)}
              style={buttonReset}
            >
              <Box
                width={8}
                height={8}
                borderRadius="full"
                backgroundColor={
                  i === index ? 'background-inverse' : 'background-card'
                }
                transitionProperty="colors"
                transitionDuration="fast"
              />
            </button>
          ))}
        </Box>
        <Box display={{ base: 'flex', md: 'none' }}>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next testimonial"
            onClick={() => go(index + 1)}
          >
            <ArrowRight className="size-4" />
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
