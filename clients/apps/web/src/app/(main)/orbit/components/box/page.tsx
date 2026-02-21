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
  { token: 'bg-surface', label: 'bg-surface', desc: 'Card / panel' },
  { token: 'bg-elevated', label: 'bg-elevated', desc: 'Divider / raised' },
  { token: 'text', label: 'text', desc: 'Primary text' },
  { token: 'text-muted', label: 'text-muted', desc: 'Secondary text' },
  { token: 'text-subtle', label: 'text-subtle', desc: 'Placeholder' },
  { token: 'destructive', label: 'destructive', desc: 'Error / danger' },
] as const

// ─── Guidelines ────────────────────────────────────────────────────────────────

const guidelines = [
  {
    rule: 'Use token props for design values',
    desc: 'backgroundColor, padding, gap, borderRadius should always come from the token system. Reach for className only for things the token set cannot express.',
    do: `<Box
  backgroundColor="bg-surface"
  padding={3}
  borderRadius="lg"
>`,
    dont: `<div
  className="bg-neutral-50
    p-6 rounded-2xl"
>`,
  },
  {
    rule: 'Use flex props for layout direction',
    desc: 'display, flexDirection, alignItems, and justifyContent cover the most common flex patterns without needing raw Tailwind class strings.',
    do: `<Box
  display="flex"
  flexDirection="column"
  gap={2}
>`,
    dont: `<Box
  className="flex flex-col gap-4"
>`,
  },
  {
    rule: 'Use as for semantic HTML',
    desc: 'Box renders a div by default. Pass as="article", as="section", or any other element to keep the DOM semantically correct without adding wrapper nodes.',
    do: `<Box
  as="article"
  backgroundColor="bg-surface"
  padding={3}
>`,
    dont: `<div>
  <article className="...">
    ...
  </article>
</div>`,
  },
  {
    rule: 'className is an escape hatch',
    desc: 'Dimensions (h-12, w-full), responsive prefixes (md:flex-row), and anything not in the token set belong in className. Do not use it to bypass token props.',
    do: `<Box
  padding={3}
  className="w-full md:w-1/2"
>`,
    dont: `<Box
  className="p-6 rounded-2xl
    bg-neutral-50 w-full"
>`,
  },
]

// ─── Flex examples ─────────────────────────────────────────────────────────────

const flexDirectionExamples = [
  { prop: 'row', label: 'flexDirection="row"' },
  { prop: 'column', label: 'flexDirection="column"' },
] as const

const alignItemsExamples = [
  { value: 'start', label: 'start' },
  { value: 'center', label: 'center' },
  { value: 'end', label: 'end' },
] as const

const justifyContentExamples = [
  { value: 'start', label: 'start' },
  { value: 'center', label: 'center' },
  { value: 'between', label: 'between' },
  { value: 'end', label: 'end' },
] as const

// ─── Props ─────────────────────────────────────────────────────────────────────

const props = [
  {
    name: 'as',
    type: 'ElementType',
    default: "'div'",
    desc: 'Rendered HTML element. Pass any valid tag for semantic markup.',
  },
  {
    name: 'display',
    type: "'flex' | 'block' | 'inline-flex' | 'grid' | 'inline-grid' | 'hidden'",
    default: '—',
    desc: 'CSS display value.',
  },
  {
    name: 'flexDirection',
    type: "'row' | 'column' | 'row-reverse' | 'column-reverse'",
    default: '—',
    desc: 'Flex axis direction. Requires display="flex" or display="inline-flex".',
  },
  {
    name: 'alignItems',
    type: "'start' | 'end' | 'center' | 'stretch' | 'baseline'",
    default: '—',
    desc: 'Cross-axis alignment.',
  },
  {
    name: 'justifyContent',
    type: "'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'",
    default: '—',
    desc: 'Main-axis distribution.',
  },
  {
    name: 'flexWrap',
    type: "'wrap' | 'nowrap' | 'wrap-reverse'",
    default: '—',
    desc: 'Whether flex children wrap onto multiple lines.',
  },
  {
    name: 'flex',
    type: "'1' | 'auto' | 'none' | 'initial'",
    default: '—',
    desc: 'flex shorthand for the element itself as a flex child.',
  },
  {
    name: 'backgroundColor / color / borderColor',
    type: 'OrbitColor',
    default: '—',
    desc: 'Color tokens. All values are CSS custom properties that respond to dark mode automatically.',
  },
  {
    name: 'padding / paddingX / paddingY / paddingTop … paddingLeft',
    type: 'OrbitSpacing',
    default: '—',
    desc: 'Spacing scale: 1 (8px) → 32 (256px).',
  },
  {
    name: 'margin / marginX / marginY / marginTop … marginLeft',
    type: 'OrbitSpacing',
    default: '—',
    desc: 'Same scale as padding.',
  },
  {
    name: 'gap / rowGap / columnGap',
    type: 'OrbitSpacing',
    default: '—',
    desc: 'Gap between flex or grid children.',
  },
  {
    name: 'borderRadius / borderTopLeftRadius … borderBottomRightRadius',
    type: 'OrbitRadius',
    default: '—',
    desc: 'Radius tokens: sm → full.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Escape hatch for dimensions, responsive variants, and anything outside the token set. Merged with token classes via twMerge.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BoxPage() {
  return (
    <div className="flex flex-col gap-20">
      <OrbitPageHeader
        label="Component"
        title="Box"
        description="The atomic layout primitive in Orbit. Spacing, color, radius, and flex layout are all expressed through type-safe token props — raw Tailwind strings are the escape hatch, not the default."
      />

      {/* Guidelines */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader
          title="Guidelines"
          description="Follow these four rules when reaching for Box. They keep design values tied to the token system and prevent one-off Tailwind strings from drifting out of sync with the design."
        />
        <div className="flex flex-col gap-4">
          {guidelines.map(({ rule, desc, do: doExample, dont }) => (
            <div
              key={rule}
              className="dark:border-polar-800 flex flex-col gap-4 rounded-2xl border border-neutral-200 p-6"
            >
              <div className="flex flex-col gap-1.5">
                <span className="dark:text-polar-200 text-sm font-medium text-neutral-800">
                  {rule}
                </span>
                <span className="dark:text-polar-500 text-xs leading-relaxed text-neutral-500">
                  {desc}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    Do
                  </span>
                  <pre className="dark:bg-polar-900 dark:text-polar-200 flex-1 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-700">
                    {doExample}
                  </pre>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-red-500">
                    Don&apos;t
                  </span>
                  <pre className="dark:bg-polar-900 dark:text-polar-400 flex-1 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-400">
                    {dont}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flex */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader
          title="Flex layout"
          description="display and flexDirection replace the most common className patterns. alignItems and justifyContent handle cross- and main-axis alignment without raw class strings."
        />

        {/* flexDirection */}
        <div className="flex flex-col gap-3">
          <span className="dark:text-polar-400 text-xs text-neutral-500">
            flexDirection
          </span>
          <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
            {flexDirectionExamples.map(({ prop, label }) => (
              <div
                key={prop}
                className="grid grid-cols-5 items-center gap-8 py-5"
              >
                <div className="col-span-2">
                  <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
                    {label}
                  </code>
                </div>
                <div className="col-span-3">
                  <Box
                    display="flex"
                    flexDirection={prop}
                    gap={1}
                    backgroundColor="bg-elevated"
                    borderRadius="sm"
                    padding={2}
                  >
                    {[0, 1, 2].map((i) => (
                      <Box
                        key={i}
                        backgroundColor="bg-surface"
                        borderRadius="sm"
                        className="h-6 w-6"
                      />
                    ))}
                  </Box>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* alignItems */}
        <div className="flex flex-col gap-3">
          <span className="dark:text-polar-400 text-xs text-neutral-500">
            alignItems
          </span>
          <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
            {alignItemsExamples.map(({ value, label }) => (
              <div
                key={value}
                className="grid grid-cols-5 items-center gap-8 py-5"
              >
                <div className="col-span-2">
                  <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
                    alignItems=&quot;{label}&quot;
                  </code>
                </div>
                <div className="col-span-3">
                  <Box
                    display="flex"
                    flexDirection="row"
                    alignItems={value}
                    gap={1}
                    backgroundColor="bg-elevated"
                    borderRadius="sm"
                    padding={2}
                    className="h-16"
                  >
                    {[4, 6, 8].map((h) => (
                      <Box
                        key={h}
                        backgroundColor="bg-surface"
                        borderRadius="sm"
                        className={`w-6 h-${h}`}
                      />
                    ))}
                  </Box>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* justifyContent */}
        <div className="flex flex-col gap-3">
          <span className="dark:text-polar-400 text-xs text-neutral-500">
            justifyContent
          </span>
          <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">
            {justifyContentExamples.map(({ value, label }) => (
              <div
                key={value}
                className="grid grid-cols-5 items-center gap-8 py-5"
              >
                <div className="col-span-2">
                  <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
                    justifyContent=&quot;{label}&quot;
                  </code>
                </div>
                <div className="col-span-3">
                  <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent={value}
                    backgroundColor="bg-elevated"
                    borderRadius="sm"
                    padding={2}
                  >
                    {[0, 1, 2].map((i) => (
                      <Box
                        key={i}
                        backgroundColor="bg-surface"
                        borderRadius="sm"
                        className="h-6 w-6"
                      />
                    ))}
                  </Box>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spacing */}
      <div className="flex flex-col gap-8">
        <OrbitSectionHeader
          title="Spacing"
          description="Numeric keys map to the Orbit spacing scale. Directional variants (paddingX, paddingTop, marginY, gap, …) use the same keys."
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
                  display="inline-flex"
                >
                  <Box backgroundColor="bg-surface" className="h-6 w-6" />
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
          description="backgroundColor, color, and borderColor accept OrbitColor keys. Values are CSS custom properties — dark mode is automatic, no dark: prefix needed."
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
                  borderRadius=&quot;{key}&quot;
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
          description="Real-world patterns combining token props. Note how className is only used for values outside the token set — dimensions, responsive variants, or one-off utilities."
        />
        <div className="dark:divide-polar-800 flex flex-col divide-y divide-neutral-200">

          {/* Card */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <div className="col-span-2 flex flex-col gap-1">
              <span className="dark:text-polar-200 text-sm text-neutral-800">
                Card
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Surface · padding · radius · column layout
              </span>
            </div>
            <div className="col-span-3">
              <Box
                as="article"
                backgroundColor="bg-surface"
                padding={3}
                borderRadius="lg"
                display="flex"
                flexDirection="column"
                gap={2}
                className="dark:border-polar-800 border border-neutral-200"
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

          {/* Toolbar */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <div className="col-span-2 flex flex-col gap-1">
              <span className="dark:text-polar-200 text-sm text-neutral-800">
                Toolbar
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Row · space-between · centered cross-axis
              </span>
            </div>
            <div className="col-span-3">
              <Box
                backgroundColor="bg-surface"
                paddingX={3}
                paddingY={2}
                borderRadius="lg"
                display="flex"
                flexDirection="row"
                alignItems="center"
                justifyContent="between"
                className="dark:border-polar-800 border border-neutral-200"
              >
                <Box color="text" className="text-sm font-medium">
                  Section title
                </Box>
                <Box
                  backgroundColor="bg-elevated"
                  paddingX={2}
                  paddingY={1}
                  borderRadius="sm"
                  color="text-muted"
                  className="text-xs"
                >
                  Action
                </Box>
              </Box>
            </div>
          </div>

          {/* Token grid */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <div className="col-span-2 flex flex-col gap-1">
              <span className="dark:text-polar-200 text-sm text-neutral-800">
                Color chips
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Row · gap token · flex children
              </span>
            </div>
            <div className="col-span-3">
              <Box display="flex" flexDirection="row" gap={2}>
                {(['bg-surface', 'bg-elevated', 'destructive'] as const).map(
                  (token) => (
                    <Box
                      key={token}
                      flex="1"
                      backgroundColor={token}
                      padding={2}
                      borderRadius="md"
                      color="text-muted"
                      className="dark:border-polar-700 border border-neutral-200 text-center font-mono text-xs"
                    >
                      {token}
                    </Box>
                  ),
                )}
              </Box>
            </div>
          </div>

          {/* Semantic element */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <div className="col-span-2 flex flex-col gap-1">
              <span className="dark:text-polar-200 text-sm text-neutral-800">
                Semantic element
              </span>
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                as="nav" renders a &lt;nav&gt; — no extra wrapper needed
              </span>
            </div>
            <div className="col-span-3">
              <Box
                as="nav"
                backgroundColor="bg-surface"
                padding={2}
                borderRadius="lg"
                display="flex"
                flexDirection="column"
                gap={1}
                className="dark:border-polar-800 border border-neutral-200"
              >
                {['Overview', 'Settings', 'Billing'].map((item) => (
                  <Box
                    key={item}
                    paddingX={2}
                    paddingY={1}
                    borderRadius="sm"
                    color="text-muted"
                    className="cursor-default text-sm hover:text-black dark:hover:text-white"
                  >
                    {item}
                  </Box>
                ))}
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
