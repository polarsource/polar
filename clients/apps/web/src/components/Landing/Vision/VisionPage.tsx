'use client'

import { PhyllotaxisSunflower } from '@/components/Brand/PhyllotaxisSunflower'
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
    headline: 'AI changes how software is sold.',
    body: 'Usage-based. Metered. Token by token, API call by API call. The revenue model is new — but the billing infrastructure is still stuck in the past.',
  },
  {
    id: 'p2',
    eyebrow: null,
    headline:
      'Every API call is a transaction. Most platforms weren\u2019t built for that.',
    body: 'Legacy billing was designed for seat-based SaaS. AI products are different — dynamic pricing, usage meters, global customers from day one. The tools haven\u2019t kept up.',
  },
  {
    id: 'p3',
    eyebrow: 'Our answer',
    headline: 'We built the billing layer AI startups actually need.',
    body: 'Usage-based, seat-based, one-time — any model, any combination. Global tax compliance included. One flat rate. No monthly fees. Built for the velocity of AI.',
  },
  {
    id: 'p4',
    eyebrow: 'Our belief',
    headline: 'The best infrastructure is the kind you forget exists.',
    body: 'We measure success by how little you notice us. When it\u2019s working, you\u2019re shipping. That\u2019s the point.',
  },
]

const PILLARS = [
  {
    index: '01',
    title: 'Usage-based',
    body: 'Meter any dimension — tokens, API calls, seats, compute. Mix models freely. Bill exactly what your product delivers.',
  },
  {
    index: '02',
    title: 'Global',
    body: 'Tax compliance in 130+ countries, built in. Ship to the world from day one without touching a single tax form.',
  },
  {
    index: '03',
    title: 'Open',
    body: '4% + 40¢, all-in. Open source, no lock-in. Fork it, self-host, or let us run it. Your infrastructure, your rules.',
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

function Headline({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <h2
      className={twMerge(
        'font-display leading-tight font-medium text-balance',
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
        'dark:text-polar-500 text-xl leading-relaxed text-balance text-gray-500',
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
      container.querySelectorAll<HTMLElement>(
        '.vision-section:not(:first-child)',
      ),
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
              { opacity: 1, y: 0, duration: 2.4, ease: 'power3.out' },
            )
          } else {
            gsap.to(content, {
              opacity: 0,
              y: fromBottom ? 40 : -40,
              duration: 1.2,
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
      <nav className="fixed top-0 right-0 left-0 z-50 flex h-48 w-full flex-col items-center justify-center px-8 py-6">
        <Link href="/">
          <PolarLogotype size={60} />
        </Link>
      </nav>

      <div
        ref={scrollRef}
        className="dark:bg-polar-950 h-screen overflow-y-scroll bg-white text-gray-900 dark:text-white"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
      >
        <HeroSection />
        <SunflowerSection />
        {PHILOSOPHY.map((item) => (
          <PhilosophySection key={item.id} {...item} />
        ))}
        <PillarsSection />
        <CtaSection />
      </div>
    </div>
  )
}

// ── Sunflower ─────────────────────────────────────────────────────────────────

function SunflowerSection() {
  return (
    <VisionSection hero className="relative overflow-hidden">
      <div className="absolute inset-0">
        <PhyllotaxisSunflower />
      </div>
    </VisionSection>
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
        <h1 className="font-display max-w-4xl text-5xl leading-tight font-medium text-balance opacity-0 md:text-7xl">
          Build the product. We handle the rest.
        </h1>
        <Body className="max-w-md opacity-0">
          Polar is the billing layer for AI — so nothing stands between your
          idea and the world.
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

function PhilosophySection({ headline, body }: PhilosophySectionProps) {
  return (
    <VisionSection className="text-center" contentClassName="max-w-3xl">
      <Headline className="text-4xl md:text-6xl">{headline}</Headline>
      <Body className="max-w-xl">{body}</Body>
    </VisionSection>
  )
}

// ── Pillars ───────────────────────────────────────────────────────────────────

function PillarsSection() {
  return (
    <VisionSection contentClassName="w-full max-w-5xl gap-16">
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
      <div className="h-24 w-24 overflow-hidden rounded-full shadow-2xl">
        <ShaderCanvas
          geometry={MESH_GLSL}
          effect={orbEffect}
          className="h-full w-full"
        />
      </div>
      <Headline className="max-w-2xl text-4xl md:text-6xl">
        Start monetizing your AI product today.
      </Headline>
      <Body className="max-w-sm text-base">
        Join thousands of AI builders who ship faster because they never think
        about billing.
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
