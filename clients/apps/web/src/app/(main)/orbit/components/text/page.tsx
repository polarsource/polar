import { Stack, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

// ─── Data ─────────────────────────────────────────────────────────────────────

const variants = [
  {
    variant: 'body' as const,
    label: 'body',
    desc: 'Default body copy — 14 px, normal weight, full contrast.',
  },
  {
    variant: 'label' as const,
    label: 'label',
    desc: 'Form labels and table headers — 12 px, medium weight.',
  },
  {
    variant: 'caption' as const,
    label: 'caption',
    desc: 'Supporting annotations — 12 px, subtle color, snug leading.',
  },
  {
    variant: 'subtle' as const,
    label: 'subtle',
    desc: 'Secondary copy alongside primary content — 14 px, muted.',
  },
  {
    variant: 'disabled' as const,
    label: 'disabled',
    desc: 'Placeholders and non-interactive states — 14 px, dimmed.',
  },
  {
    variant: 'mono' as const,
    label: 'mono',
    desc: 'Inline code, IDs, and technical values — monospace, 12 px.',
  },
]

const colors = [
  {
    color: 'default' as const,
    label: 'default',
    desc: 'Inherits color from the active variant.',
  },
  {
    color: 'error' as const,
    label: 'error',
    desc: 'Destructive feedback — validation errors, delete confirmations.',
  },
  {
    color: 'warning' as const,
    label: 'warning',
    desc: 'Cautionary feedback — degraded states, expiry notices.',
  },
  {
    color: 'success' as const,
    label: 'success',
    desc: 'Positive feedback — confirmations, completed states.',
  },
]

const aligns = [
  { align: 'left' as const, label: 'left' },
  { align: 'center' as const, label: 'center' },
  { align: 'right' as const, label: 'right' },
  { align: 'justify' as const, label: 'justify' },
]

const wraps = [
  {
    wrap: 'wrap' as const,
    label: 'wrap',
    desc: 'Default — text wraps onto multiple lines.',
  },
  {
    wrap: 'nowrap' as const,
    label: 'nowrap',
    desc: 'Forces single line; text overflows if too long.',
  },
  {
    wrap: 'balance' as const,
    label: 'balance',
    desc: 'CSS text-wrap: balance — equalises line lengths.',
  },
  {
    wrap: 'pretty' as const,
    label: 'pretty',
    desc: 'CSS text-wrap: pretty — avoids single-word last lines.',
  },
]

const props = [
  {
    name: 'as',
    type: "'p' | 'span' | 'label' | 'strong' | 'em' | 'small' | 'code' | 'div'",
    default: "'p'",
    desc: 'Rendered HTML element. Drives semantic meaning — pick the correct tag.',
  },
  {
    name: 'variant',
    type: "'body' | 'label' | 'caption' | 'subtle' | 'disabled' | 'mono'",
    default: "'body'",
    desc: 'Controls size, weight, font family, and base color. All in one semantic token.',
  },
  {
    name: 'color',
    type: "'default' | 'error' | 'warning' | 'success'",
    default: "'default'",
    desc: "Overrides the variant's base color with a semantic intent color. Orthogonal to variant.",
  },
  {
    name: 'align',
    type: "'left' | 'center' | 'right' | 'justify'",
    default: '—',
    desc: 'Text alignment.',
  },
  {
    name: 'wrap',
    type: "'wrap' | 'nowrap' | 'balance' | 'pretty'",
    default: '—',
    desc: 'Controls CSS text-wrap behaviour.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Extra classes merged via twMerge. Use sparingly — prefer variant and color.',
  },
]

const SAMPLE = 'The quick brown fox jumps over the lazy dog.'
const LONG_SAMPLE =
  'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump.'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TextPage() {
  return (
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Text"
        description="The standard primitive for body copy, labels, captions, and any non-heading text. Style is always resolved from variant and color tokens — never raw Tailwind classes."
      />

      {/* Variants */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="Variants"
          description="Pick the semantic role — Text makes all typographic decisions from there."
        />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {variants.map(({ variant, label, desc }) => (
            <div
              key={variant}
              className="grid grid-cols-5 items-baseline gap-8 py-5"
            >
              <div className="col-span-1">
                <Text as="code" variant="mono">
                  {label}
                </Text>
              </div>
              <div className="col-span-2">
                <Text variant={variant}>{SAMPLE}</Text>
              </div>
              <div className="col-span-2">
                <Text variant="caption">{desc}</Text>
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Color */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="Color"
          description="color overrides the variant's base color with a semantic intent. Combine any variant with any color."
        />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {colors.map(({ color, label, desc }) => (
            <div
              key={color}
              className="grid grid-cols-5 items-baseline gap-8 py-5"
            >
              <div className="col-span-1">
                <Text as="code" variant="mono">
                  {label}
                </Text>
              </div>
              <div className="col-span-2">
                <Text color={color}>{SAMPLE}</Text>
              </div>
              <div className="col-span-2">
                <Text variant="caption">{desc}</Text>
              </div>
            </div>
          ))}
        </Stack>
        {/* Variant × color matrix */}
        <div className="dark:divide-polar-800 dark:border-polar-700 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
          <div className="grid grid-cols-5 gap-4 px-4 py-2">
            <Text variant="caption" className="col-span-1">
              variant
            </Text>
            <Text variant="caption">default</Text>
            <Text variant="caption">error</Text>
            <Text variant="caption">warning</Text>
            <Text variant="caption">success</Text>
          </div>
          {(['body', 'label', 'caption', 'subtle', 'mono'] as const).map(
            (v) => (
              <div key={v} className="grid grid-cols-5 gap-4 px-4 py-3">
                <Text as="code" variant="mono" className="col-span-1">
                  {v}
                </Text>
                <Text variant={v} color="default">
                  Sample
                </Text>
                <Text variant={v} color="error">
                  Sample
                </Text>
                <Text variant={v} color="warning">
                  Sample
                </Text>
                <Text variant={v} color="success">
                  Sample
                </Text>
              </div>
            ),
          )}
        </div>
      </Stack>

      {/* Align */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Align" />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {aligns.map(({ align, label }) => (
            <div
              key={align}
              className="grid grid-cols-5 items-baseline gap-8 py-5"
            >
              <div className="col-span-1">
                <Text as="code" variant="mono">
                  {label}
                </Text>
              </div>
              <div className="col-span-4">
                <Text align={align}>{LONG_SAMPLE}</Text>
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Wrap */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Wrap" />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {wraps.map(({ wrap, label, desc }) => (
            <div
              key={wrap}
              className="grid grid-cols-5 items-baseline gap-8 py-5"
            >
              <div className="col-span-1">
                <Text as="code" variant="mono">
                  {label}
                </Text>
              </div>
              <div className="col-span-2 max-w-xs">
                <Text wrap={wrap}>{LONG_SAMPLE}</Text>
              </div>
              <div className="col-span-2">
                <Text variant="caption">{desc}</Text>
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* as */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="Semantic element (as)"
          description="Text renders as <p> by default. Pass as to change the HTML element for semantic correctness without losing variant styling."
        />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {(
            ['p', 'span', 'label', 'strong', 'em', 'small', 'code'] as const
          ).map((tag) => (
            <div
              key={tag}
              className="grid grid-cols-5 items-baseline gap-8 py-4"
            >
              <div className="col-span-1">
                <Text as="code" variant="mono">
                  {tag}
                </Text>
              </div>
              <div className="col-span-4">
                <Text as={tag}>{SAMPLE}</Text>
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Props */}
      <Stack vertical gap={3}>
        <OrbitSectionHeader title="Props" />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {props.map(({ name, type, default: def, desc }) => (
            <div key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" variant="mono">
                {name}
              </Text>
              <Text as="code" variant="mono" className="col-span-2 text-wrap">
                {type}
              </Text>
              <Text as="code" variant="mono">
                {def}
              </Text>
              <Text variant="caption">{desc}</Text>
            </div>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
