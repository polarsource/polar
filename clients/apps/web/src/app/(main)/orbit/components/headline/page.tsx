import { Headline } from '@/components/Orbit'

const levels = [
  { tag: 'h1', size: '3rem → 6rem', weight: '300' },
  { tag: 'h2', size: '2.25rem → 3rem', weight: '400' },
  { tag: 'h3', size: '1.875rem → 3rem', weight: '400' },
  { tag: 'h4', size: '1.5rem → 1.875rem', weight: '400' },
  { tag: 'h5', size: '1.25rem → 1.5rem', weight: '400' },
  { tag: 'h6', size: '1.125rem → 1.25rem', weight: '400' },
] as const

const props = [
  { name: 'as', type: "'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span'", default: "'h2'", desc: 'Rendered HTML element and default size' },
  { name: 'text', type: 'string | string[]', default: '—', desc: 'Content. Array triggers multi-line staggered animation' },
  { name: 'animate', type: 'boolean', default: 'false', desc: 'Enables curtain-reveal animation on viewport entry' },
  { name: 'size', type: 'string', default: 'derived from as', desc: 'Override the default Tailwind size classes' },
  { name: 'className', type: 'string', default: '—', desc: 'Additional classes merged via twMerge' },
]

export default function HeadlinePage() {
  return (
    <div className="flex flex-col gap-20">
      <div className="flex flex-col gap-4">
        <span className="dark:text-polar-500 text-sm text-neutral-400">
          Component
        </span>
        <Headline as="h1" text="Headline" />
        <p className="dark:text-polar-400 max-w-lg text-base leading-relaxed text-neutral-600">
          Display typography component for all heading levels. Supports a
          curtain-reveal animation that fires once on viewport entry, with
          staggered lines for multi-line content.
        </p>
      </div>

      {/* Type scale demo */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Headline as="h4" text="Type Scale" />
          <div className="dark:border-polar-800 border-t border-neutral-200" />
        </div>
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
              <Headline animate as={tag} text="The quick brown fox" />
            </div>
          </div>
        ))}
      </div>

      {/* Animated multiline */}
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Headline as="h4" text="Multiline Stagger" />
          <div className="dark:border-polar-800 border-t border-neutral-200" />
        </div>
        <div className="grid grid-cols-5 gap-8">
          <div className="flex flex-col gap-0.5">
            <span className="dark:text-polar-500 text-xs text-neutral-400">
              Array text
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

      {/* Props */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Headline as="h4" text="Props" />
          <div className="dark:border-polar-800 border-t border-neutral-200" />
        </div>
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
