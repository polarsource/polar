import { Box, Headline } from '@/components/Orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

const levels = [
  { tag: 'h1', size: '3rem → 6rem', weight: '300' },
  { tag: 'h2', size: '2.25rem → 3rem', weight: '400' },
  { tag: 'h3', size: '1.875rem → 3rem', weight: '400' },
  { tag: 'h4', size: '1.5rem → 1.875rem', weight: '400' },
  { tag: 'h5', size: '1.25rem → 1.5rem', weight: '400' },
  { tag: 'h6', size: '1.125rem → 1.25rem', weight: '400' },
] as const

const props = [
  {
    name: 'as',
    type: "'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span'",
    default: "'h2'",
    desc: 'Rendered HTML element and default size',
  },
  {
    name: 'text',
    type: 'string | string[]',
    default: '—',
    desc: 'Content. Array triggers multi-line staggered animation',
  },
  {
    name: 'animate',
    type: 'boolean',
    default: 'false',
    desc: 'Enables curtain-reveal animation on viewport entry',
  },
  {
    name: 'size',
    type: 'string',
    default: 'derived from as',
    desc: 'Override the default Tailwind size classes',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Additional classes merged via twMerge',
  },
]

export default function HeadlinePage() {
  return (
    <Box display="flex" flexDirection="column" className="gap-20">
      <OrbitPageHeader
        label="Component"
        title="Headline"
        description="Display typography component for all heading levels. Supports a curtain-reveal animation that fires once on viewport entry, with staggered lines for multi-line content."
      />

      {/* Type scale demo */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Type Scale" />
        {levels.map(({ tag, size, weight }) => (
          <Box key={tag} className="grid grid-cols-5 items-baseline gap-8">
            <Box display="flex" flexDirection="column" className="gap-0.5">
              <span className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                {tag}
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                {size}
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                {weight}
              </span>
            </Box>
            <Box className="col-span-4">
              <Headline as={tag} text="The quick brown fox" />
            </Box>
          </Box>
        ))}
      </Box>

      {/* Animated */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader
          title="Animated"
          description="Set animate to trigger a curtain-reveal on viewport entry. Each line clips upward independently; passing an array staggers them at 0.2s ÷ n."
        />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          <Box className="grid grid-cols-5 items-baseline gap-8 py-6">
            <Box display="flex" flexDirection="column" className="gap-0.5">
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Single line
              </span>
            </Box>
            <Box className="col-span-4">
              <Headline animate as="h2" text="The quick brown fox" />
            </Box>
          </Box>
          <Box className="grid grid-cols-5 items-baseline gap-8 py-6">
            <Box display="flex" flexDirection="column" className="gap-0.5">
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Multiline stagger
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Stagger: 0.2s ÷ n
              </span>
            </Box>
            <Box className="col-span-4">
              <Headline
                animate
                as="h2"
                text={['The quick', 'brown fox', 'jumps over']}
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Props */}
      <Box display="flex" flexDirection="column" gap={3}>
        <OrbitSectionHeader title="Props" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {props.map(({ name, type, default: def, desc }) => (
            <Box key={name} className="grid grid-cols-5 gap-4 py-4">
              <code className="dark:text-polar-200 col-span-1 font-mono text-sm text-neutral-800">
                {name}
              </code>
              <code className="dark:text-polar-400 col-span-2 font-mono text-xs text-neutral-500">
                {type}
              </code>
              <code className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                {def}
              </code>
              <span className="dark:text-polar-400 text-xs text-neutral-500">
                {desc}
              </span>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
