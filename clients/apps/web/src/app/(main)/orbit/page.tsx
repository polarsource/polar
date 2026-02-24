import { Box, Headline, Stack, Text, orbitTokens } from '@polar-sh/orbit'
import Link from 'next/link'
import { OrbitPageHeader } from './OrbitPageHeader'
const sp = orbitTokens.spacing
const cl = orbitTokens.colors
const ra = orbitTokens.radii


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

const sections = [
  {
    label: 'Get started',
    links: [
      {
        label: 'Guidelines',
        href: '/orbit/guidelines',
        desc: 'Motion, typography, color, spacing, and accessibility rules',
      },
    ],
  },
  {
    label: 'Foundations',
    links: [
      {
        label: 'Design Tokens',
        href: '/orbit/tokens',
        desc: 'The raw values behind every visual decision',
      },
    ],
  },
  {
    label: 'Components',
    links: [
      {
        label: 'Avatar',
        href: '/orbit/components/avatar',
        desc: 'User avatar with Facehash fallback for missing images',
      },
      {
        label: 'Headline',
        href: '/orbit/components/headline',
        desc: 'Display typography with staggered curtain animation',
      },
      {
        label: 'Text',
        href: '/orbit/components/text',
        desc: 'Body copy, labels, and captions with token-constrained styling',
      },
      {
        label: 'Button',
        href: '/orbit/components/button',
        desc: 'Four variants — primary, secondary, ghost, destructive',
      },
      {
        label: 'Card',
        href: '/orbit/components/card',
        desc: 'Surface container for grouping related content',
      },
      {
        label: 'Input',
        href: '/orbit/components/input',
        desc: 'Text, textarea, and currency inputs with slot support',
      },
      {
        label: 'BarChart',
        href: '/orbit/components/barchart',
        desc: 'Animated comparative data visualization',
      },
      {
        label: 'DataTable',
        href: '/orbit/components/datatable',
        desc: 'Sortable, filterable table with pagination and row selection',
      },
      {
        label: 'Status',
        href: '/orbit/components/status',
        desc: 'Semantic badge for neutral, success, warning, error, and info states',
      },
    ],
  },
]

export default function OrbitIntroductionPage() {
  return (
    <Stack vertical gap={sp['spacing-10']}>
      <OrbitPageHeader
        label="v0.1 — Polar Software Inc."
        title="Orbit"
        description="The design system for Polar — unifying design philosophies, guidelines, design tokens, and components to guardrail building exceptional user experiences."
      />

      {/* What is Orbit */}
      <Stack vertical gap={sp['spacing-3']}>
        <Headline as="h5" text="What is Orbit" />
        <Box className="dark:border-polar-800 border-t border-neutral-200" />
        <Stack vertical gap={sp['spacing-2']}>
          <Text variant="subtle" fontSize="sm" leading="relaxed">
            Orbit is the shared design language across every Polar product. It
            captures decisions that would otherwise be made inconsistently across
            teams — how things move, how type is set, what surfaces look like in
            the dark — and promotes them to named, reusable primitives.
          </Text>
          <Text variant="subtle" fontSize="sm" leading="relaxed">
            Rather than a component library alone, Orbit is a system of
            constraints. Design tokens encode the raw values. Guidelines encode
            the rules for applying them. Components encode the patterns those
            rules produce. Together they make the right choice the path of least
            resistance.
          </Text>
        </Stack>
      </Stack>

      {/* Design principles */}
      <Stack vertical gap={sp['spacing-3']}>
        <Headline as="h5" text="Design Principles" />
        <Box className="dark:border-polar-800 border-t border-neutral-200" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {principles.map(({ title, description }) => (
            <Box key={title} className="grid grid-cols-5 gap-8 py-5">
              <Box className="col-span-2">
                <Headline as="h6" text={title} />
              </Box>
              <Text variant="subtle" fontSize="sm" leading="relaxed" className="col-span-3">
                {description}
              </Text>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* What's inside */}
      <Stack vertical gap={sp['spacing-3']}>
        <Headline as="h5" text="What's inside" />
        <Box className="dark:border-polar-800 border-t border-neutral-200" />
        <Stack vertical gap={sp['spacing-5']}>
          {sections.map(({ label, links }) => (
            <Stack vertical key={label} gap={sp['spacing-1']}>
              <Text
                as="span"
                variant="subtle"
                fontSize="xs"
                tracking="widest"
                transform="uppercase"
              >
                {label}
              </Text>
              <Box className="dark:bg-polar-800 grid grid-cols-2 gap-px bg-neutral-200">
                {links.map(({ label: linkLabel, href, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className="dark:bg-polar-950 dark:hover:bg-polar-900 flex flex-col gap-1 bg-white p-5 transition-colors hover:bg-neutral-50"
                  >
                    <Headline as="h6" text={linkLabel} />
                    <Text as="span" variant="subtle" fontSize="xs">
                      {desc}
                    </Text>
                  </Link>
                ))}
              </Box>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
