'use client'

import { ShaderCanvas } from '@/components/Brand/ShaderCanvas'
import { MESH_GLSL } from '@/components/Brand/shaders/geometry/mesh'
import { rawEffect } from '@/components/Brand/shaders/pass/raw'
import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import gsap from 'gsap'
import Link from 'next/link'
import {
  PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'


const orbEffect = rawEffect()

// ── Data ──────────────────────────────────────────────────────────────────────

const PHILOSOPHY = [
  {
    id: 'p1',
    eyebrow: null,
    headline: 'Monetization wasn\u2019t built for developers.',
    body: 'It was built for finance departments, sales teams, and spreadsheets. Every payment gateway adds friction. Every jurisdiction adds risk.',
  },
  {
    id: 'p2',
    eyebrow: null,
    headline: 'Every layer between code and customer\u2014a tax.',
    body: 'Tax compliance, chargebacks, invoicing, payouts. Complexity that compounds. Time that should go to building, lost to plumbing.',
  },
  {
    id: 'p3',
    eyebrow: 'Our answer',
    headline: 'The last billing platform you\u2019ll ever need.',
    body: 'Open source. Developer-first. One flat rate. Global tax compliance built in. No monthly fees, no setup costs, no surprises.',
  },
  {
    id: 'p4',
    eyebrow: 'Our belief',
    headline:
      'Your software is the product. The infrastructure should disappear.',
    body: 'The best tools are the ones you never think about. We obsess over the plumbing so you don\u2019t have to.',
  },
]

const PILLARS = [
  {
    index: '01',
    title: 'Open',
    body: 'Everything we build is open source. No lock-in. Fork it, self-host, or let us run it.',
  },
  {
    index: '02',
    title: 'Global',
    body: 'Tax compliance in 130+ countries. Every currency, every regulation, handled for you.',
  },
  {
    index: '03',
    title: 'Simple',
    body: '4% + 40¢. One rate, all-in. No monthly fees, no setup costs, no surprises.',
  },
]

// ── Section primitive ─────────────────────────────────────────────────────────

interface VisionSectionProps {
  className?: string
  contentClassName?: string
  /** Hero sections manage their own animation via ref; skip the .vision-content wrapper */
  hero?: boolean
}

function VisionSection({
  children,
  className,
  contentClassName,
  hero = false,
}: PropsWithChildren<VisionSectionProps>) {
  return (
    <section
      className={twMerge(
        'vision-section flex h-screen flex-col items-center justify-center px-6',
        className,
      )}
      style={{ scrollSnapAlign: 'start' }}
    >
      {hero ? (
        children
      ) : (
        <div
          className={twMerge(
            'vision-content flex flex-col items-center gap-8 opacity-0',
            contentClassName,
          )}
        >
          {children}
        </div>
      )}
    </section>
  )
}

// ── Eyebrow / Headline / Body primitives ──────────────────────────────────────

function Eyebrow({ children }: PropsWithChildren) {
  return (
    <p className="font-mono text-xs tracking-widest text-gray-400 uppercase dark:text-white/30">
      {children}
    </p>
  )
}

function Headline({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <h2
      className={twMerge(
        'font-display leading-snug font-medium text-balance',
        className,
      )}
    >
      {children}
    </h2>
  )
}

function Body({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <p
      className={twMerge(
        'text-lg leading-relaxed text-balance text-gray-500 dark:text-white/40',
        className,
      )}
    >
      {children}
    </p>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function VisionPage() {
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const observers: IntersectionObserver[] = []

    const sections = Array.from(
      container.querySelectorAll<HTMLElement>('.vision-section:not(:first-child)'),
    )

    sections.forEach((section) => {
      const content = section.querySelector<HTMLElement>('.vision-content')
      if (!content) return

      gsap.set(content, { opacity: 0, y: 40 })

      const observer = new IntersectionObserver(
        ([entry]) => {
          const fromBottom = entry.boundingClientRect.top > 0
          if (entry.isIntersecting) {
            gsap.fromTo(
              content,
              { opacity: 0, y: fromBottom ? 40 : -40 },
              { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' },
            )
          } else {
            gsap.to(content, {
              opacity: 0,
              y: fromBottom ? 40 : -40,
              duration: 0.6,
              ease: 'power2.in',
            })
          }
        },
        { root: container, threshold: 0.4 },
      )

      observer.observe(section)
      observers.push(observer)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  return (
    <div>
      <nav className="fixed top-0 left-0 z-50 flex w-full items-center px-8 py-6">
        <Link href="/">
          <PolarLogotype />
        </Link>
      </nav>

      <div
        ref={scrollRef}
        className="dark:bg-polar-950 h-screen overflow-y-scroll bg-white text-gray-900 dark:text-white"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
      >
        <HeroSection />
        {PHILOSOPHY.map((item) => (
          <PhilosophySection key={item.id} {...item} />
        ))}
        <PillarsSection />
        <CtaSection />
      </div>
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection() {
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contentRef.current) return
    gsap.fromTo(
      Array.from(contentRef.current.children),
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.14,
        delay: 0.4,
      },
    )
  }, [])

  return (
    <VisionSection hero className="relative overflow-hidden text-center">
      <div
        ref={contentRef}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        <h1 className="font-display leading-tighter max-w-4xl text-5xl font-medium text-balance opacity-0 md:text-7xl">
          Infrastructure that disappears.
        </h1>
        <Body className="max-w-md opacity-0">
          We believe the layer between great software and sustainable businesses
          should be invisible.
        </Body>
      </div>
      <ScrollCue />
    </VisionSection>
  )
}

// ── Philosophy ────────────────────────────────────────────────────────────────

interface PhilosophySectionProps {
  eyebrow: string | null
  headline: string
  body: string
}

function PhilosophySection({
  eyebrow,
  headline,
  body,
}: PhilosophySectionProps) {
  return (
    <VisionSection className="text-center" contentClassName="max-w-3xl">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Headline className="text-4xl md:text-6xl">{headline}</Headline>
      <Body className="max-w-xl">{body}</Body>
    </VisionSection>
  )
}

// ── Pillars ───────────────────────────────────────────────────────────────────

function PillarsSection() {
  return (
    <VisionSection contentClassName="w-full max-w-5xl gap-16">
      <Eyebrow>What we stand for</Eyebrow>
      <div className="dark:border-polar-800 dark:bg-polar-800 grid w-full grid-cols-1 gap-px border border-gray-100 bg-gray-100 md:grid-cols-3">
        {PILLARS.map(({ index, title, body }) => (
          <div
            key={title}
            className="dark:bg-polar-950 flex flex-col gap-5 bg-white p-10"
          >
            <span className="font-mono text-xs text-gray-300 dark:text-white/20">
              {index}
            </span>
            <h3 className="font-display text-2xl font-medium">{title}</h3>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-white/40">
              {body}
            </p>
          </div>
        ))}
      </div>
    </VisionSection>
  )
}

// ── CTA ───────────────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <VisionSection className="text-center" contentClassName="gap-10">
      <div className="h-36 w-36 overflow-hidden rounded-full shadow-2xl">
        <ShaderCanvas
          geometry={MESH_GLSL}
          effect={orbEffect}
          className="h-full w-full"
        />
      </div>
      <Headline className="max-w-2xl text-4xl md:text-6xl">
        Join us in building a better way.
      </Headline>
      <Body className="max-w-sm text-base">
        Thousands of developers already use Polar. Ship your first product
        today.
      </Body>
    </VisionSection>
  )
}

// ── Scroll cue ────────────────────────────────────────────────────────────────

function ScrollCue() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="absolute bottom-10 flex flex-col items-center gap-2 transition-opacity duration-1000"
      style={{ opacity: visible ? 0.4 : 0 }}
    >
      <span className="font-mono text-xs tracking-widest text-gray-400 uppercase dark:text-white">
        Scroll
      </span>
      <div className="h-10 w-px animate-pulse bg-gray-300 dark:bg-white/60" />
    </div>
  )
}
