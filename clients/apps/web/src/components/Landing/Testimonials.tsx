'use client'

import { useInView } from '@/hooks/useInView'
import { Avatar, Grid, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { gsap } from 'gsap'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { ReactNode, useEffect, useRef, useState } from 'react'
import { Chapter } from './Chapter'
import { LogoGrid } from './LogoGrid'

const QUOTE_SECONDS = 6

interface Testimonial {
  link: string
  name: string
  company: string
  avatar: string
  quote: string[]
}

const TESTIMONIALS: Testimonial[] = [
  {
    link: 'https://x.com/rauchg/status/1909810055622672851',
    name: 'Guillermo Rauch',
    company: 'Vercel',
    avatar: '/assets/landing/testamonials/rauch.jpg',
    quote: [
      'The speed at which Polar is executing on the financial infrastructure primitives the new world needs is very impressive.',
    ],
  },
  {
    link: '/customers/stilla-ai',
    name: 'Siavash Ghorbani',
    company: 'Stilla AI',
    avatar: '/assets/landing/testamonials/siavash.jpg',
    quote: [
      "Polar's Python SDK and Webhook infrastructure made our billing integration straightforward.",
      'It gave us production-ready billing in hours, not weeks.',
      "It's rare to find a vendor that moves this fast.",
    ],
  },
  {
    link: 'https://x.com/mitchellh/status/1775925951668552005',
    name: 'Mitchell Hashimoto',
    company: 'Superlogical',
    avatar: '/assets/landing/testamonials/mitchell.jpg',
    quote: [
      "I've joined Polar as an advisor!",
      "I think it benefits everyone for devs to have more options to get paid to work on their passions, to support upstreams, and for users to have more confidence/transparency in the software they're supporting/purchasing.",
    ],
  },
  {
    link: 'https://fastapicloud.com',
    name: 'Sebastián Ramírez',
    company: 'FastAPI',
    avatar: '/assets/landing/testamonials/sebastian.jpg',
    quote: [
      'Polar has been giving us the high attention support of a startup, with an enterprise-level product and service.',
    ],
  },
]

const isExternalLink = (link: string) => /^https?:\/\//.test(link)

const QuoteLink = ({
  testimonial,
  children,
}: {
  testimonial: Testimonial
  children: ReactNode
}) =>
  isExternalLink(testimonial.link) ? (
    <a href={testimonial.link} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <Link href={testimonial.link}>{children}</Link>
  )

export const Testimonials = () => {
  const { ref, inView } = useInView()
  const reducedMotion = useReducedMotion()
  const [active, setActive] = useState(0)
  const progressRefs = useRef<(HTMLElement | null)[]>([])
  const tweenRef = useRef<gsap.core.Tween | null>(null)
  const pauseRef = useRef({ hovered: false, focused: false })
  const testimonial = TESTIMONIALS[active]

  const setPaused = (reason: 'hovered' | 'focused', paused: boolean) => {
    pauseRef.current[reason] = paused
    const { hovered, focused } = pauseRef.current
    if (hovered || focused) tweenRef.current?.pause()
    else tweenRef.current?.resume()
  }

  useEffect(() => {
    const bar = progressRefs.current[active]
    if (!bar || !inView || reducedMotion) return
    const tween = gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: QUOTE_SECONDS,
        ease: 'none',
        onComplete: () =>
          setActive((current) => (current + 1) % TESTIMONIALS.length),
      },
    )
    if (pauseRef.current.hovered || pauseRef.current.focused) tween.pause()
    tweenRef.current = tween
    return () => {
      tween.kill()
      gsap.set(bar, { scaleX: 0 })
    }
  }, [active, inView, reducedMotion])

  return (
    <Chapter
      index="04"
      name="What people say"
      title="Trusted by teams that ship daily"
      subtitle="From AI startups to infrastructure veterans"
    >
      <Box flexDirection="column" rowGap="3xl" width="100%">
        <LogoGrid />
        <Box
          ref={ref}
          flexDirection="column"
          alignItems="center"
          rowGap={{ base: '3xl', md: '4xl' }}
          paddingVertical={{ base: '3xl', md: '5xl' }}
          paddingHorizontal={{ base: 'xl', md: '4xl' }}
          backgroundColor="background-secondary"
          onMouseEnter={() => setPaused('hovered', true)}
          onMouseLeave={() => setPaused('hovered', false)}
          onFocus={() => setPaused('focused', true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setPaused('focused', false)
            }
          }}
        >
          <Box width="100%" maxWidth="48rem" minHeight={{ md: '18rem' }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <QuoteLink testimonial={testimonial}>
                  <figure>
                    <Box
                      flexDirection="column"
                      alignItems="center"
                      rowGap="2xl"
                      textAlign="center"
                      opacity={{ base: 1, hover: 0.75 }}
                      transitionProperty="opacity"
                      transitionDuration="base"
                    >
                      <blockquote>
                        <Box flexDirection="column" rowGap="l">
                          {testimonial.quote.map((paragraph) => (
                            <Text key={paragraph} variant="heading-s" as="p">
                              {paragraph}
                            </Text>
                          ))}
                        </Box>
                      </blockquote>
                      <figcaption>
                        <Text color="muted">
                          {testimonial.name}, {testimonial.company}
                        </Text>
                      </figcaption>
                    </Box>
                  </figure>
                </QuoteLink>
              </motion.div>
            </AnimatePresence>
          </Box>

          <Grid
            width="100%"
            maxWidth="64rem"
            templateColumns="repeat(4, 1fr)"
            gap="l"
          >
            {TESTIMONIALS.map((person, index) => (
              <button
                key={person.name}
                type="button"
                aria-pressed={index === active}
                aria-label={`${person.name}, ${person.company}`}
                onClick={(event) => {
                  setActive(index)
                  if (event.detail > 0) event.currentTarget.blur()
                }}
              >
                <Box
                  flexDirection="column"
                  rowGap="l"
                  opacity={index === active ? 1 : 0.5}
                  transitionProperty="opacity"
                  transitionDuration="slow"
                >
                  <Box
                    display="block"
                    height={1}
                    backgroundColor="background-card"
                    overflow="hidden"
                  >
                    <Box
                      ref={(element) => {
                        progressRefs.current[index] = element
                      }}
                      height="100%"
                      backgroundColor="background-inverse"
                      transformOrigin="left"
                      transform={
                        index === active && reducedMotion
                          ? 'scaleX(1)'
                          : 'scaleX(0)'
                      }
                    />
                  </Box>
                  <Box alignItems="center" columnGap="m" textAlign="left">
                    <Avatar
                      avatar_url={person.avatar}
                      name={person.name}
                      className="size-8"
                    />
                    <Box
                      display={{ base: 'none', md: 'flex' }}
                      flexDirection="column"
                    >
                      <Text as="span">{person.name}</Text>
                      <Text as="span" color="muted">
                        {person.company}
                      </Text>
                    </Box>
                  </Box>
                </Box>
              </button>
            ))}
          </Grid>
        </Box>
      </Box>
    </Chapter>
  )
}
