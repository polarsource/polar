import { Box } from '@/components/Orbit'
import { orbitRadii, orbitSpacing } from '@/components/Orbit/theme'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

// ─── Token data ───────────────────────────────────────────────────────────────

const spacingEntries = (
  Object.keys(orbitSpacing) as unknown as (keyof typeof orbitSpacing)[]
).map((key) => ({ key, cls: orbitSpacing[key].padding }))

const radiiEntries = (
  Object.keys(orbitRadii) as (keyof typeof orbitRadii)[]
).map((key) => ({ key, cls: orbitRadii[key].all }))

const colorTokens = [
  { token: 'bg', label: 'bg', desc: 'Page background' },
  { token: 'bg-surface', label: 'bg-surface', desc: 'Card / sidebar' },
  { token: 'bg-elevated', label: 'bg-elevated', desc: 'Border / elevated' },
  { token: 'text', label: 'text', desc: 'Primary text' },
  { token: 'text-muted', label: 'text-muted', desc: 'Secondary text' },
  { token: 'text-subtle', label: 'text-subtle', desc: 'Placeholder' },
  { token: 'destructive', label: 'destructive', desc: 'Error / danger' },
] as const

const props = [
  {
    name: 'as',
    type: 'ElementType',
    default: "'div'",
    desc: 'Rendered HTML element',
  },
  {
    name: 'backgroundColor / color / borderColor',
    type: 'OrbitColor',
    default: '—',
    desc: 'Color tokens: bg, bg-surface, bg-elevated, text, text-muted, text-subtle, destructive',
  },
  {
    name: 'padding / paddingX / paddingY / paddingTop … paddingLeft',
    type: 'OrbitSpacing',
    default: '—',
    desc: 'Spacing scale: 1 (8px) → 32 (256px)',
  },
  {
    name: 'margin / marginX / marginY / marginTop … marginLeft',
    type: 'OrbitSpacing',
    default: '—',
    desc: 'Same scale as padding',
  },
  {
    name: 'gap / rowGap / columnGap',
    type: 'OrbitSpacing',
    default: '—',
    desc: 'Gap between flex / grid children',
  },
  {
    name: 'borderRadius / borderTopLeftRadius … borderBottomRightRadius',
    type: 'OrbitRadius',
    default: '—',
    desc: 'Radius tokens: sm (8px) → full (9999px)',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Tailwind classes — merged with token classes via twMerge. Use as an escape hatch for layout and anything outside the token set.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BoxPage() {
  return (
    <div className="flex flex-col gap-20">
      <OrbitPageHeader
        label="Component"
        title="Box"
        description="A polymorphic layout primitive. Spacing, color, and radius props are constrained to Orbit design tokens for type-safe composition. Use className or style as escape hatches for anything outside the token set."
      />

      {/* Spacing */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader
          title="Spacing"
          description="The padding prop (and its directional variants) maps numeric keys to the Orbit spacing scale. The inner square shows the resulting padding."
        />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {spacingEntries.map(({ key, cls }) => (
            <div
              key={key}
              className="grid grid-cols-5 items-center gap-8 py-5"
            >
              <div className="col-span-2 flex flex-col gap-0.5">
                <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
                  padding={`{${key}}`}
                </code>
                <span className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                  {cls}
                </span>
              </div>
              <div className="col-span-3">
                <Box
                  padding={key}
                  backgroundColor="bg-elevated"
                  borderRadius="sm"
                  className="inline-flex"
                >
                  <Box
                    backgroundColor="bg-surface"
                    className="h-6 w-6"
                  />
                </Box>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader
          title="Color tokens"
          description="backgroundColor, color, and borderColor accept OrbitColor keys. All values reference CSS custom properties so they respond to the dark mode class automatically."
        />
        <div className="grid grid-cols-7 gap-3">
          {colorTokens.map(({ token, label, desc }) => (
            <div key={token} className="flex flex-col gap-2">
              <Box
                backgroundColor={token}
                borderRadius="md"
                className="dark:border-polar-700 h-16 w-full border border-neutral-200"
              />
              <div className="flex flex-col gap-0.5">
                <code className="dark:text-polar-200 font-mono text-xs text-neutral-800">
                  {label}
                </code>
                <span className="dark:text-polar-500 text-xs text-neutral-400">
                  {desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Border radius */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader title="Border radius" />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {radiiEntries.map(({ key, cls }) => (
            <div
              key={key}
              className="grid grid-cols-5 items-center gap-8 py-5"
            >
              <div className="col-span-2 flex flex-col gap-0.5">
                <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
                  borderRadius="{key}"
                </code>
                <span className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                  {cls}
                </span>
              </div>
              <div className="col-span-3">
                <Box
                  backgroundColor="bg-elevated"
                  borderRadius={key}
                  className="h-12 w-12"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composition */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader
          title="Composition"
          description="Token props combine with className for layout and style for anything outside the token set."
        />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
          {/* Card example */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <div className="col-span-2 flex flex-col gap-1">
              <span className="dark:text-polar-200 text-sm text-neutral-800">
                Card
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Surface + padding + radius
              </span>
            </div>
            <div className="col-span-3">
              <Box
                as="article"
                backgroundColor="bg-surface"
                padding={3}
                borderRadius="lg"
                className="dark:border-polar-800 flex flex-col gap-2 border border-neutral-200"
              >
                <Box color="text" className="text-sm font-medium">
                  Card title
                </Box>
                <Box color="text-muted" className="text-xs leading-relaxed">
                  Supporting description text using the text-muted color token.
                </Box>
              </Box>
            </div>
          </div>

          {/* Row example */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <div className="col-span-2 flex flex-col gap-1">
              <span className="dark:text-polar-200 text-sm text-neutral-800">
                Row
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                gap + flex via className
              </span>
            </div>
            <div className="col-span-3">
              <Box gap={2} className="flex flex-row">
                {(['bg-surface', 'bg-elevated', 'destructive'] as const).map(
                  (token) => (
                    <Box
                      key={token}
                      backgroundColor={token}
                      padding={2}
                      borderRadius="md"
                      className="dark:border-polar-700 flex-1 border border-neutral-200 text-center font-mono text-xs"
                      color="text-muted"
                    >
                      {token}
                    </Box>
                  ),
                )}
              </Box>
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
              <code className="dark:text-polar-200 col-span-1 font-mono text-xs text-neutral-800">
                {name}
              </code>
              <code className="dark:text-polar-400 col-span-1 font-mono text-xs text-neutral-500">
                {type}
              </code>
              <code className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                {def}
              </code>
              <span className="dark:text-polar-400 col-span-2 text-xs text-neutral-500">
                {desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
