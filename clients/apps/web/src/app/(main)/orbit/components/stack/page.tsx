import { Box, Stack, Text } from '@polar-sh/orbit'
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
        description="The primary flex layout primitive in Orbit. Stack is always display:flex and defaults to a horizontal row. Add vertical for a column, or use verticalUntil / horizontalUntil to flip the axis at a breakpoint. Use Box for token-constrained styling of individual elements."
      />

      {/* verticalUntil */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="verticalUntil"
          description="Stacks children in a column by default and switches to a row at the given breakpoint. This is the most common responsive layout pattern."
        />

        {/* Live demo */}
        <Stack vertical gap={3}>
          <Text as="span" variant="subtle" fontSize="xs">
            Live demo — resize the window to see the layout switch at xl
          </Text>
          <Box backgroundColor="bg-elevated" borderRadius="lg" padding={3}>
            <Stack verticalUntil="xl" gap={2}>
              {(['A', 'B', 'C'] as const).map((label) => (
                <Box
                  key={label}
                  backgroundColor="bg-surface"
                  borderRadius="md"
                  padding={2}
                  className="grow dark:border-polar-700 flex h-12 items-center justify-center border border-neutral-200"
                >
                  <Text fontFamily="mono" fontSize="sm">{label}</Text>
                </Box>
              ))}
            </Stack>
          </Box>
          <pre className="dark:bg-polar-900 dark:text-polar-200 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-700">
{`<Stack verticalUntil="xl" gap={2}>
  <Box>A</Box>
  <Box>B</Box>
  <Box>C</Box>
</Stack>`}
          </pre>
        </Stack>

        {/* Breakpoint reference */}
        <Stack vertical gap={3}>
          <Text as="span" variant="subtle" fontSize="xs">All breakpoints</Text>
          <Stack vertical gap={2} flexWrap="wrap">
            {verticalUntilExamples.map(({ bp, label }) => (
              <Box
                key={bp}
                backgroundColor="bg-elevated"
                borderRadius="sm"
                paddingX={2}
                paddingY={1}
                className="dark:border-polar-700 border border-neutral-200"
              >
                <Text as="code" fontFamily="mono" fontSize="xs">
                  verticalUntil=&quot;{label}&quot;
                </Text>
              </Box>
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
        <Box backgroundColor="bg-elevated" borderRadius="lg" padding={3}>
          <Stack horizontalUntil="lg" gap={2}>
            {(['A', 'B', 'C'] as const).map((label) => (
              <Box
                key={label}
                backgroundColor="bg-surface"
                borderRadius="md"
                padding={2}
                className="grow dark:border-polar-700 flex h-12 items-center justify-center border border-neutral-200"
              >
                <Text fontFamily="mono" fontSize="sm">{label}</Text>
              </Box>
            ))}
          </Stack>
        </Box>
        <pre className="dark:bg-polar-900 dark:text-polar-200 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-700">
{`<Stack horizontalUntil="lg" gap={2}>
  <Box>A</Box>
  <Box>B</Box>
  <Box>C</Box>
</Stack>`}
        </pre>
      </Stack>

      {/* alignItems */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="alignItems"
          description="Cross-axis alignment of flex children. Accepts a plain value or a responsive breakpoint map."
        />
        <Stack vertical gap={2} className="dark:divide-polar-800 divide-y divide-neutral-200">
          {alignItemsExamples.map(({ value, label }) => (
            <Box key={value} className="grid grid-cols-5 items-center gap-8 py-5">
              <Box className="col-span-2">
                <Text as="code" fontFamily="mono" fontSize="sm">
                  alignItems=&quot;{label}&quot;
                </Text>
              </Box>
              <Box className="col-span-3">
                <Stack
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
                </Stack>
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* justifyContent */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="justifyContent"
          description="Main-axis distribution of flex children."
        />
        <Stack vertical gap={2} className="dark:divide-polar-800 divide-y divide-neutral-200">
          {justifyContentExamples.map(({ value, label }) => (
            <Box key={value} className="grid grid-cols-5 items-center gap-8 py-5">
              <Box className="col-span-2">
                <Text as="code" fontFamily="mono" fontSize="sm">
                  justifyContent=&quot;{label}&quot;
                </Text>
              </Box>
              <Box className="col-span-3">
                <Stack
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
                </Stack>
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Composition */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="Composition"
          description="Real-world patterns. Stack drives the flex layout; Box handles token-based styling on individual elements."
        />
        <Stack vertical gap={2} className="dark:divide-polar-800 divide-y divide-neutral-200">

          {/* Card */}
          <Box className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap={1} className="col-span-2">
              <Text fontSize="sm">Card</Text>
              <Text variant="subtle" fontSize="xs">Vertical stack · surface · padding · radius</Text>
            </Stack>
            <Box className="col-span-3">
              <Box
                as="article"
                backgroundColor="bg-surface"
                padding={3}
                borderRadius="lg"
                className="dark:border-polar-800 border border-neutral-200"
              >
                <Stack vertical gap={2}>
                  <Text fontWeight="medium" fontSize="sm">Card title</Text>
                  <Text variant="subtle" fontSize="xs" leading="relaxed">
                    Supporting description text.
                  </Text>
                </Stack>
              </Box>
            </Box>
          </Box>

          {/* Toolbar */}
          <Box className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap={1} className="col-span-2">
              <Text fontSize="sm">Toolbar</Text>
              <Text variant="subtle" fontSize="xs">Horizontal · space-between · centered</Text>
            </Stack>
            <Box className="col-span-3">
              <Box
                backgroundColor="bg-surface"
                paddingX={3}
                paddingY={2}
                borderRadius="lg"
                className="dark:border-polar-800 border border-neutral-200"
              >
                <Stack alignItems="center" justifyContent="between">
                  <Text fontWeight="medium" fontSize="sm">Section title</Text>
                  <Box
                    backgroundColor="bg-elevated"
                    paddingX={2}
                    paddingY={1}
                    borderRadius="sm"
                  >
                    <Text variant="subtle" fontSize="xs">Action</Text>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Box>

          {/* Responsive card grid */}
          <Box className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap={1} className="col-span-2">
              <Text fontSize="sm">Responsive card row</Text>
              <Text variant="subtle" fontSize="xs">
                Column on mobile · row from xl · each card fills remaining space
              </Text>
            </Stack>
            <Box className="col-span-3">
              <Stack verticalUntil="xl" gap={2}>
                {(['Analytics', 'Revenue', 'Customers'] as const).map((t) => (
                  <Box
                    key={t}
                    flex="1"
                    backgroundColor="bg-surface"
                    padding={2}
                    borderRadius="md"
                    className="dark:border-polar-700 border border-neutral-200"
                  >
                    <Text fontFamily="mono" fontSize="xs" variant="subtle">{t}</Text>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>

        </Stack>
      </Stack>

      {/* Props */}
      <Stack vertical gap={3}>
        <OrbitSectionHeader title="Props" />
        <Stack vertical gap={2} className="dark:divide-polar-800 divide-y divide-neutral-200">
          {props.map(({ name, type, default: def, desc }) => (
            <Box key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" fontFamily="mono" fontSize="xs" className="col-span-1">
                {name}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs" className="col-span-2">
                {type}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                {def}
              </Text>
              <Text as="span" variant="subtle" fontSize="xs">
                {desc}
              </Text>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
