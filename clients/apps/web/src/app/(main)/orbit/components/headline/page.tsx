import { Headline } from '@/components/Orbit'
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
    <div className="flex flex-col gap-20">
      <OrbitPageHeader
        label="Component"
        title="Headline"
        description="Display typography component for all heading levels. Supports a curtain-reveal animation that fires once on viewport entry, with staggered lines for multi-line content."
      />

      {/* Type scale demo */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="Type Scale" />
        {levels.map(({ tag, size, weight }) => (
          <div key={tag} className="grid grid-cols-5 items-baseline gap-8">
            <div className="flex flex-col gap-0.5">
              <span className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                {tag}
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                {size}
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                {weight}
              </span>
            </div>
            <div className="col-span-4">
              <Headline as={tag} text="The quick brown fox" />
            </div>
          </div>
        ))}
      </div>

      {/* Animated */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader
          title="Animated"
          description="Set animate to trigger a curtain-reveal on viewport entry. Each line clips upward independently; passing an array staggers them at 0.2s ÷ n."
        />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          <div className="grid grid-cols-5 items-baseline gap-8 py-6">
            <div className="flex flex-col gap-0.5">
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Single line
              </span>
            </div>
            <div className="col-span-4">
              <Headline animate as="h2" text="The quick brown fox" />
            </div>
          </div>
          <div className="grid grid-cols-5 items-baseline gap-8 py-6">
            <div className="flex flex-col gap-0.5">
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Multiline stagger
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Stagger: 0.2s ÷ n
              </span>
            </div>
            <div className="col-span-4">
              <Headline
                animate
                as="h2"
                text={['The quick', 'brown fox', 'jumps over']}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Props */}
      <div className="flex flex-col gap-6">
        <OrbitSectionHeader title="Props" />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {props.map(({ name, type, default: def, desc }) => (
            <div key={name} className="grid grid-cols-5 gap-4 py-4">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
