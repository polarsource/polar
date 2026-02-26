import { Stack, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

// ─── Examples data ────────────────────────────────────────────────────────────

const verticalUntilExamples = [
  { bp: 'sm', label: 'sm' },
  { bp: 'md', label: 'md' },
  { bp: 'lg', label: 'lg' },
  { bp: 'xl', label: 'xl' },
  { bp: '2xl', label: '2xl' },
] as const

const alignItemsExamples = [
  { value: 'start', label: 'start' },
  { value: 'center', label: 'center' },
  { value: 'end', label: 'end' },
  { value: 'stretch', label: 'stretch' },
] as const

const justifyContentExamples = [
  { value: 'start', label: 'start' },
  { value: 'center', label: 'center' },
  { value: 'between', label: 'between' },
  { value: 'end', label: 'end' },
] as const

// ─── Props ────────────────────────────────────────────────────────────────────

const props = [
  {
    name: 'vertical',
    type: 'boolean',
    default: 'false',
    desc: 'Render children in a column (flex-col). Use when you need to opt out of the default row.',
  },
  {
    name: 'horizontal',
    type: 'boolean',
    default: 'true',
    desc: 'Render children in a row (flex-row). This is the default — the prop is only needed for clarity.',
  },
  {
    name: 'verticalUntil',
    type: "'sm' | 'md' | 'lg' | 'xl' | '2xl'",
    default: '—',
    desc: 'Stack column until this breakpoint, then switch to row.',
  },
  {
    name: 'horizontalUntil',
    type: "'sm' | 'md' | 'lg' | 'xl' | '2xl'",
    default: '—',
    desc: 'Stack row until this breakpoint, then switch to column.',
  },
  {
    name: 'alignItems',
    type: "Responsive<'start' | 'end' | 'center' | 'stretch' | 'baseline'>",
    default: '—',
    desc: 'Cross-axis alignment of flex children.',
  },
  {
    name: 'justifyContent',
    type: "Responsive<'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'>",
    default: '—',
    desc: 'Main-axis distribution of flex children.',
  },
  {
    name: 'flexWrap',
    type: "Responsive<'wrap' | 'nowrap' | 'wrap-reverse'>",
    default: '—',
    desc: 'Whether flex children wrap onto multiple lines.',
  },
  {
    name: 'as',
    type: 'ElementType',
    default: "'div'",
    desc: 'Rendered HTML element. Pass any valid tag for semantic markup.',
  },
  {
    name: 'gap / padding / margin / …',
    type: 'OrbitSpacing',
    default: '—',
    desc: 'All Box token props are forwarded — spacing, color, radius.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Escape hatch merged via twMerge after resolved container classes.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StackPage() {
  return (
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Stack"
        description="The primary flex layout primitive in Orbit. Stack is always display:flex and defaults to a horizontal row. Add vertical for a column, or use verticalUntil / horizontalUntil to flip the axis at a breakpoint. Use className with Tailwind for token-constrained styling of individual elements."
      />

      {/* verticalUntil */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="verticalUntil"
          description="Stacks children in a column by default and switches to a row at the given breakpoint. This is the most common responsive layout pattern."
        />

        {/* Live demo */}
        <Stack vertical gap={3}>
          <Text as="span" variant="caption">
            Live demo — resize the window to see the layout switch at xl
          </Text>
          <div className="dark:bg-polar-800 rounded-2xl bg-gray-100 p-6">
            <Stack verticalUntil="xl" gap={2}>
              {(['A', 'B', 'C'] as const).map((label) => (
                <div
                  key={label}
                  className="dark:border-polar-700 dark:bg-polar-900 flex h-12 grow items-center justify-center rounded-xl border border-neutral-200 bg-gray-50 p-4"
                >
                  <Text variant="mono">{label}</Text>
                </div>
              ))}
            </Stack>
          </div>
          <pre className="dark:bg-polar-900 dark:text-polar-200 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-700">
            {`<Stack verticalUntil="xl" gap={2}>
  <div>A</div>
  <div>B</div>
  <div>C</div>
</Stack>`}
          </pre>
        </Stack>

        {/* Breakpoint reference */}
        <Stack vertical gap={3}>
          <Text as="span" variant="caption">
            All breakpoints
          </Text>
          <Stack gap={2} flexWrap="wrap">
            {verticalUntilExamples.map(({ bp, label }) => (
              <div
                key={bp}
                className="dark:bg-polar-800 dark:border-polar-700 rounded-lg border border-neutral-200 bg-gray-100 px-4 py-2"
              >
                <Text as="code" variant="mono">
                  verticalUntil=&quot;{label}&quot;
                </Text>
              </div>
            ))}
          </Stack>
        </Stack>
      </Stack>

      {/* horizontalUntil */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="horizontalUntil"
          description="The inverse of verticalUntil — stacks in a row by default and switches to a column at the given breakpoint."
        />
        <div className="dark:bg-polar-800 rounded-2xl bg-gray-100 p-6">
          <Stack horizontalUntil="lg" gap={2}>
            {(['A', 'B', 'C'] as const).map((label) => (
              <div
                key={label}
                className="dark:border-polar-700 dark:bg-polar-900 flex h-12 grow items-center justify-center rounded-xl border border-neutral-200 bg-gray-50 p-4"
              >
                <Text variant="mono">{label}</Text>
              </div>
            ))}
          </Stack>
        </div>
        <pre className="dark:bg-polar-900 dark:text-polar-200 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-700">
          {`<Stack horizontalUntil="lg" gap={2}>
  <div>A</div>
  <div>B</div>
  <div>C</div>
</Stack>`}
        </pre>
      </Stack>

      {/* alignItems */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="alignItems"
          description="Cross-axis alignment of flex children. Accepts a plain value or a responsive breakpoint map."
        />
        <Stack
          vertical
          gap={2}
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {alignItemsExamples.map(({ value, label }) => (
            <div
              key={value}
              className="grid grid-cols-5 items-center gap-8 py-5"
            >
              <div className="col-span-2">
                <Text as="code" variant="mono">
                  alignItems=&quot;{label}&quot;
                </Text>
              </div>
              <div className="col-span-3">
                <Stack
                  alignItems={value}
                  gap={1}
                  className="dark:bg-polar-800 h-16 rounded-lg bg-gray-100 p-4"
                >
                  {[4, 6, 8].map((h) => (
                    <div
                      key={h}
                      className={`dark:bg-polar-900 w-6 rounded-lg bg-gray-50 h-${h}`}
                    />
                  ))}
                </Stack>
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* justifyContent */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="justifyContent"
          description="Main-axis distribution of flex children."
        />
        <Stack
          vertical
          gap={2}
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {justifyContentExamples.map(({ value, label }) => (
            <div
              key={value}
              className="grid grid-cols-5 items-center gap-8 py-5"
            >
              <div className="col-span-2">
                <Text as="code" variant="mono">
                  justifyContent=&quot;{label}&quot;
                </Text>
              </div>
              <div className="col-span-3">
                <Stack
                  justifyContent={value}
                  className="dark:bg-polar-800 rounded-lg bg-gray-100 p-4"
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="dark:bg-polar-900 h-6 w-6 rounded-lg bg-gray-50"
                    />
                  ))}
                </Stack>
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Composition */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="Composition"
          description="Real-world patterns. Stack drives the flex layout; className handles styling on individual elements."
        />
        <Stack
          vertical
          gap={2}
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {/* Card */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap={1} className="col-span-2">
              <Text variant="body">Card</Text>
              <Text variant="subtle">
                Vertical stack · surface · padding · radius
              </Text>
            </Stack>
            <div className="col-span-3">
              <article className="dark:border-polar-800 dark:bg-polar-900 rounded-2xl border border-neutral-200 bg-gray-50 p-6">
                <Stack vertical gap={2}>
                  <Text variant="label">Card title</Text>
                  <Text variant="subtle">Supporting description text.</Text>
                </Stack>
              </article>
            </div>
          </div>

          {/* Toolbar */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap={1} className="col-span-2">
              <Text variant="body">Toolbar</Text>
              <Text variant="subtle">
                Horizontal · space-between · centered
              </Text>
            </Stack>
            <div className="col-span-3">
              <div className="dark:border-polar-800 dark:bg-polar-900 rounded-2xl border border-neutral-200 bg-gray-50 px-6 py-4">
                <Stack alignItems="center" justifyContent="between">
                  <Text variant="label">Section title</Text>
                  <div className="dark:bg-polar-800 rounded-lg bg-gray-100 px-4 py-2">
                    <Text variant="subtle">Action</Text>
                  </div>
                </Stack>
              </div>
            </div>
          </div>

          {/* Responsive card grid */}
          <div className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap={1} className="col-span-2">
              <Text variant="body">Responsive card row</Text>
              <Text variant="subtle">
                Column on mobile · row from xl · each card fills remaining space
              </Text>
            </Stack>
            <div className="col-span-3">
              <Stack verticalUntil="xl" gap={2}>
                {(['Analytics', 'Revenue', 'Customers'] as const).map((t) => (
                  <div
                    key={t}
                    className="dark:border-polar-700 dark:bg-polar-900 flex-1 rounded-xl border border-neutral-200 bg-gray-50 p-4"
                  >
                    <Text variant="mono">{t}</Text>
                  </div>
                ))}
              </Stack>
            </div>
          </div>
        </Stack>
      </Stack>

      {/* Props */}
      <Stack vertical gap={3}>
        <OrbitSectionHeader title="Props" />
        <Stack
          vertical
          gap={2}
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {props.map(({ name, type, default: def, desc }) => (
            <div key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" variant="mono" className="col-span-1">
                {name}
              </Text>
              <Text as="code" variant="mono" className="col-span-2">
                {type}
              </Text>
              <Text as="code" variant="mono">
                {def}
              </Text>
              <Text as="span" variant="subtle">
                {desc}
              </Text>
            </div>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
