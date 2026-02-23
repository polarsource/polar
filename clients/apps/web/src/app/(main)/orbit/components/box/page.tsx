import { Box, Stack, Text } from '@polar-sh/orbit'
import { orbitRadii, orbitSpacing } from '@polar-sh/orbit'
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
  { token: 'text-disabled', label: 'text-disabled', desc: 'Secondary text' },
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
  padding="spacing-3"
  borderRadius="lg"
>`,
    dont: `<div
  className="bg-neutral-50
    p-6 rounded-2xl"
>`,
  },
  {
    rule: 'Use Stack for flex layouts',
    desc: 'Box is not a flex container. Use Stack for any row/column layout. Box can still carry token styling and flex child props (flex, alignSelf) when nested inside a Stack.',
    do: `<Stack vertical gap="spacing-2" verticalUntil="xl">
  <Box backgroundColor="bg-surface"
    padding="spacing-3" borderRadius="lg">…</Box>
</Stack>`,
    dont: `<Box
  display="flex"
  flexDirection="column"
  gap="spacing-2"
>`,
  },
  {
    rule: 'Use as for semantic HTML',
    desc: 'Box renders a div by default. Pass as="article", as="section", or any other element to keep the DOM semantically correct without adding wrapper nodes.',
    do: `<Box
  as="article"
  backgroundColor="bg-surface"
  padding="spacing-3"
>`,
    dont: `<div>
  <article className="...">
    ...
  </article>
</div>`,
  },
  {
    rule: 'className is an escape hatch',
    desc: 'Dimensions (h-12, w-full) and anything not in the token set belong in className. Do not use it to bypass token props.',
    do: `<Box
  padding="spacing-3"
  className="w-full md:w-1/2"
>`,
    dont: `<Box
  className="p-6 rounded-2xl
    bg-neutral-50 w-full"
>`,
  },
]

// ─── Flex child examples ───────────────────────────────────────────────────────

const flexChildExamples = [
  {
    label: 'flex="1"',
    desc: 'Fill all remaining space in a Stack.',
    code: `<Stack gap="spacing-2">
  <Box>Fixed</Box>
  <Box flex="1">Fills rest</Box>
</Stack>`,
  },
  {
    label: 'alignSelf="end"',
    desc: 'Override cross-axis alignment for a single child.',
    code: `<Stack alignItems="start" className="h-16">
  <Box alignSelf="end">Bottom</Box>
  <Box>Top</Box>
</Stack>`,
  },
  {
    label: 'flexGrow / flexShrink',
    desc: 'Fine-grained grow and shrink control.',
    code: `<Stack gap="spacing-2">
  <Box flexGrow="1">Grows</Box>
  <Box flexShrink="0">Won't shrink</Box>
</Stack>`,
  },
]

// ─── Props ─────────────────────────────────────────────────────────────────────

const props = [
  {
    name: 'as',
    type: 'ElementType',
    default: "'div'",
    desc: 'Rendered HTML element. Pass any valid tag for semantic markup.',
  },
  {
    name: 'flex',
    type: "Responsive<'1' | 'auto' | 'none' | 'initial'>",
    default: '—',
    desc: 'flex shorthand — use flex="1" to fill remaining space in a Stack.',
  },
  {
    name: 'alignSelf',
    type: "Responsive<'auto' | 'start' | 'end' | 'center' | 'stretch' | 'baseline'>",
    default: '—',
    desc: 'align-self override for this element when inside a Stack.',
  },
  {
    name: 'flexGrow',
    type: "'0' | '1'",
    default: '—',
    desc: 'flex-grow: 0 (default) or 1 (grow to fill available space).',
  },
  {
    name: 'flexShrink',
    type: "'0' | '1'",
    default: '—',
    desc: 'flex-shrink: 0 (prevent shrinking) or 1 (default browser behavior).',
  },
  {
    name: 'backgroundColor / color / borderColor',
    type: 'OrbitColor',
    default: '—',
    desc: 'Color tokens. Values are CSS custom properties — dark mode is automatic.',
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
    desc: 'Gap between grid children (Box is not a flex container — use Stack for flex gaps).',
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
    desc: 'Escape hatch for dimensions, custom utilities, and anything outside the token set.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BoxPage() {
  return (
    <Stack vertical gap="spacing-16">
      <OrbitPageHeader
        label="Component"
        title="Box"
        description="The atomic styling primitive in Orbit. Box is not a flex container — use Stack for flex layouts. Box handles spacing, color, radius, and flex child props (flex, alignSelf) through type-safe token props."
      />

      {/* Guidelines */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader
          title="Guidelines"
          description="Four rules for reaching for Box. They keep design values tied to the token system and separate layout concerns (Stack) from styling concerns (Box)."
        />
        <Stack vertical gap="spacing-2">
          {guidelines.map(({ rule, desc, do: doExample, dont }) => (
            <Box
              key={rule}
              borderRadius="lg"
              padding="spacing-3"
              className="dark:border-polar-800 border border-neutral-200"
            >
              <Stack vertical gap="spacing-2">
                <Stack vertical gap="spacing-1">
                  <Text fontWeight="medium" fontSize="sm">{rule}</Text>
                  <Text variant="subtle" fontSize="xs" leading="relaxed">{desc}</Text>
                </Stack>
                <Box className="grid grid-cols-2 gap-1">
                  <Stack vertical gap="spacing-1">
                    <Text fontSize="xs" fontWeight="medium" className="text-green-600 dark:text-green-400">
                      Do
                    </Text>
                    <pre className="dark:bg-polar-900 dark:text-polar-200 flex-1 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-700">
                      {doExample}
                    </pre>
                  </Stack>
                  <Stack vertical gap="spacing-1">
                    <Text fontSize="xs" fontWeight="medium" className="text-red-500">
                      Don&apos;t
                    </Text>
                    <pre className="dark:bg-polar-900 dark:text-polar-400 flex-1 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-400">
                      {dont}
                    </pre>
                  </Stack>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Flex child props */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader
          title="Flex child props"
          description="When Box is a child inside a Stack, these props control how it participates in the flex layout."
        />
        <Stack vertical gap="spacing-2" className="dark:divide-polar-800 divide-y divide-neutral-200">
          {flexChildExamples.map(({ label, desc, code }) => (
            <Box key={label} className="grid grid-cols-5 items-start gap-8 py-5">
              <Stack vertical gap="spacing-1" className="col-span-2">
                <Text as="code" fontFamily="mono" fontSize="sm">{label}</Text>
                <Text variant="subtle" fontSize="xs">{desc}</Text>
              </Stack>
              <Box className="col-span-3">
                <pre className="dark:bg-polar-900 dark:text-polar-200 rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-700">
                  {code}
                </pre>
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Spacing */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader
          title="Spacing"
          description="Numeric keys map to the Orbit spacing scale. Directional variants (paddingX, paddingTop, marginY, gap, …) use the same keys."
        />
        <Stack vertical gap="spacing-2" className="dark:divide-polar-800 divide-y divide-neutral-200">
          {spacingEntries.map(({ key, cls }) => (
            <Box
              key={key}
              className="grid grid-cols-5 items-center gap-8 py-5"
            >
              <Stack vertical gap="spacing-0" className="col-span-2">
                <Text as="code" fontFamily="mono" fontSize="sm">
                  padding={`{${key}}`}
                </Text>
                <Text as="span" variant="subtle" fontFamily="mono" fontSize="xs">
                  {cls}
                </Text>
              </Stack>
              <Box className="col-span-3">
                <Box
                  padding={key}
                  backgroundColor="bg-elevated"
                  borderRadius="sm"
                  className="inline-flex"
                >
                  <Box backgroundColor="bg-surface" className="h-6 w-6" />
                </Box>
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Colors */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader
          title="Color tokens"
          description="backgroundColor, color, and borderColor accept OrbitColor keys. Values are CSS custom properties — dark mode is automatic, no dark: prefix needed."
        />
        <Box className="grid grid-cols-7 gap-3">
          {colorTokens.map(({ token, label, desc }) => (
            <Stack vertical key={token} gap="spacing-1">
              <Box
                backgroundColor={token}
                borderRadius="md"
                className="dark:border-polar-700 h-16 w-full border border-neutral-200"
              />
              <Stack vertical gap="spacing-0">
                <Text as="code" fontFamily="mono" fontSize="xs">{label}</Text>
                <Text as="span" variant="subtle" fontSize="xs">{desc}</Text>
              </Stack>
            </Stack>
          ))}
        </Box>
      </Stack>

      {/* Border radius */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader title="Border radius" />
        <Stack vertical gap="spacing-2" className="dark:divide-polar-800 divide-y divide-neutral-200">
          {radiiEntries.map(({ key, cls }) => (
            <Box
              key={key}
              className="grid grid-cols-5 items-center gap-8 py-5"
            >
              <Stack vertical gap="spacing-0" className="col-span-2">
                <Text as="code" fontFamily="mono" fontSize="sm">
                  borderRadius=&quot;{key}&quot;
                </Text>
                <Text as="span" variant="subtle" fontFamily="mono" fontSize="xs">
                  {cls}
                </Text>
              </Stack>
              <Box className="col-span-3">
                <Box
                  backgroundColor="bg-elevated"
                  borderRadius={key}
                  className="h-12 w-12"
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Composition */}
      <Stack vertical gap="spacing-4">
        <OrbitSectionHeader
          title="Composition"
          description="Real-world patterns. Stack drives flex layout; Box handles token-based styling."
        />
        <Stack vertical gap="spacing-2" className="dark:divide-polar-800 divide-y divide-neutral-200">

          {/* Card */}
          <Box className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap="spacing-1" className="col-span-2">
              <Text fontSize="sm">Card</Text>
              <Text variant="subtle" fontSize="xs">Surface · padding · radius</Text>
            </Stack>
            <Box className="col-span-3">
              <Box
                as="article"
                backgroundColor="bg-surface"
                padding="spacing-3"
                borderRadius="lg"
                className="dark:border-polar-800 border border-neutral-200"
              >
                <Stack vertical gap="spacing-2">
                  <Text fontWeight="medium" fontSize="sm">Card title</Text>
                  <Text variant="subtle" fontSize="xs" leading="relaxed">
                    Supporting description text using the text-muted color token.
                  </Text>
                </Stack>
              </Box>
            </Box>
          </Box>

          {/* Toolbar */}
          <Box className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap="spacing-1" className="col-span-2">
              <Text fontSize="sm">Toolbar</Text>
              <Text variant="subtle" fontSize="xs">Surface · Stack handles row layout</Text>
            </Stack>
            <Box className="col-span-3">
              <Box
                backgroundColor="bg-surface"
                paddingX="spacing-3"
                paddingY="spacing-2"
                borderRadius="lg"
                className="dark:border-polar-800 border border-neutral-200"
              >
                <Stack alignItems="center" justifyContent="between">
                  <Text fontWeight="medium" fontSize="sm">Section title</Text>
                  <Box
                    backgroundColor="bg-elevated"
                    paddingX="spacing-2"
                    paddingY="spacing-1"
                    borderRadius="sm"
                  >
                    <Text variant="subtle" fontSize="xs">Action</Text>
                  </Box>
                </Stack>
              </Box>
            </Box>
          </Box>

          {/* Semantic element */}
          <Box className="grid grid-cols-5 items-start gap-8 py-6">
            <Stack vertical gap="spacing-1" className="col-span-2">
              <Text fontSize="sm">Semantic element</Text>
              <Text variant="subtle" fontSize="xs">
                as=&quot;nav&quot; renders a &lt;nav&gt; — no extra wrapper needed
              </Text>
            </Stack>
            <Box className="col-span-3">
              <Box
                as="nav"
                backgroundColor="bg-surface"
                padding="spacing-2"
                borderRadius="lg"
                className="dark:border-polar-800 border border-neutral-200"
              >
                <Stack vertical gap="spacing-1">
                  {['Overview', 'Settings', 'Billing'].map((item) => (
                    <Box
                      key={item}
                      paddingX="spacing-2"
                      paddingY="spacing-1"
                      borderRadius="sm"
                      className="cursor-default"
                    >
                      <Text variant="subtle" fontSize="sm" className="hover:text-black dark:hover:text-white">
                        {item}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Box>
        </Stack>
      </Stack>

      {/* Props */}
      <Stack vertical gap="spacing-3">
        <OrbitSectionHeader title="Props" />
        <Stack vertical gap="spacing-2" className="dark:divide-polar-800 divide-y divide-neutral-200">
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
