import { Headline } from '@/components/Orbit'
import Link from 'next/link'
import { OrbitPageHeader } from './OrbitPageHeader'

const principles = [
  {
    title: 'Intentional',
    description:
      'Every visual decision is deliberate. Orbit avoids decoration without purpose — spacing, type, and color all carry meaning.',
  },
  {
    title: 'Expressive',
    description:
      'Motion and typography are primary communication tools. When something moves, it tells a story about what changed and why.',
  },
  {
    title: 'Composable',
    description:
      'Primitives over monoliths. Components combine freely to form complex interfaces without fighting each other.',
  },
  {
    title: 'Accessible',
    description:
      'WCAG 2.1 AA compliance by default. Accessibility is part of the component contract, not an afterthought.',
  },
]

const links = [
  {
    label: 'Guidelines',
    href: '/orbit/guidelines',
    desc: 'Motion, typography, color, and spacing rules',
  },
  {
    label: 'Design Tokens',
    href: '/orbit/tokens',
    desc: 'The raw values behind every decision',
  },
  {
    label: 'Headline',
    href: '/orbit/components/headline',
    desc: 'Display typography with curtain animation',
  },
  {
    label: 'Button',
    href: '/orbit/components/button',
    desc: 'Interactive element with four variants',
  },
  {
    label: 'BarChart',
    href: '/orbit/components/barchart',
    desc: 'Animated comparative data visualization',
  },
]

export default function OrbitOverviewPage() {
  return (
    <div className="flex flex-col gap-20">
      <OrbitPageHeader
        label="v0.1 — Polar Software Inc"
        title="Orbit"
        description="The design system powering Polar's products. A shared language of components, tokens, and patterns for building expressive, accessible interfaces."
      />

      <div className="flex flex-col gap-6">
        <Headline as="h5" text="Design Principles" />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {principles.map(({ title, description }) => (
            <div key={title} className="grid grid-cols-5 gap-8 py-5">
              <div className="col-span-2">
                <Headline as="h6" text={title} />
              </div>
              <p className="dark:text-polar-400 col-span-3 text-sm leading-relaxed text-neutral-600">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Headline as="h5" text="What's inside" />
        <div className="dark:bg-polar-800 grid grid-cols-2 gap-px bg-neutral-200">
          {links.map(({ label, href, desc }) => (
            <Link
              key={href}
              href={href}
              className="dark:bg-polar-950 dark:hover:bg-polar-900 flex flex-col gap-1 bg-white p-5 transition-colors hover:bg-neutral-50"
            >
              <Headline as="h6" text={label} />
              <span className="dark:text-polar-500 text-xs text-neutral-500">
                {desc}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
