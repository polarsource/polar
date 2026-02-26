import { Stack, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'


const variants: { variant: 'body' | 'subtle' | 'disabled'; label: string; desc: string }[] = [
  {
    variant: 'body',
    label: 'Body',
    desc: 'Primary text. Use for body copy, headings outside of Headline, and any content that should read at full contrast.',
  },
  {
    variant: 'subtle',
    label: 'Subtle',
    desc: 'Secondary text. Use for supporting information, captions, labels, and metadata alongside primary content.',
  },
  {
    variant: 'disabled',
    label: 'Disabled',
    desc: 'Tertiary text. Use for placeholders, disabled states, and decorative copy that should recede from the hierarchy.',
  },
]

const textVariants: { variant: 'body' | 'label' | 'caption' | 'subtle' | 'disabled' | 'mono'; label: string; desc: string }[] = [
  { variant: 'body', label: 'body', desc: 'Default body text at base size' },
  { variant: 'label', label: 'label', desc: 'Medium-weight small text for labels' },
  { variant: 'caption', label: 'caption', desc: 'Extra-small text for captions and metadata' },
  { variant: 'subtle', label: 'subtle', desc: 'Muted secondary text' },
  { variant: 'disabled', label: 'disabled', desc: 'Dimmed text for placeholders and disabled states' },
  { variant: 'mono', label: 'mono', desc: 'Monospace for code, values, and technical labels' },
]

const props = [
  {
    name: 'as',
    type: "'p' | 'span' | 'label' | 'strong' | 'em' | 'small' | 'code' | 'div'",
    default: "'p'",
    desc: 'Rendered HTML element. Drives semantic meaning — use the correct tag for the context.',
  },
  {
    name: 'variant',
    type: "'body' | 'label' | 'caption' | 'subtle' | 'disabled' | 'mono'",
    default: "'body'",
    desc: 'Controls color, size, weight, and font family. Maps to an Orbit token — never a raw Tailwind color class.',
  },
  {
    name: 'align',
    type: "'left' | 'center' | 'right'",
    default: '—',
    desc: 'Text alignment.',
  },
  {
    name: 'wrap',
    type: 'boolean',
    default: '—',
    desc: 'Whether text wraps onto multiple lines.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Additional classes merged via twMerge. Use sparingly — prefer variant.',
  },
]

export default function TextPage() {
  return (
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Text"
        description="The standard primitive for rendering body copy, labels, captions, and any non-heading text. Style is always resolved from the variant token — body, label, caption, subtle, disabled, or mono."
      />

      {/* Color variants */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Color variants" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {variants.map(({ variant, label, desc }) => (
            <div key={variant} className="grid grid-cols-5 items-start gap-8 py-6">
              <Stack vertical className="col-span-2 gap-1">
                <Text variant="label">{label}</Text>
                <Text variant="caption">{desc}</Text>
              </Stack>
              <div className="col-span-3">
                <Text variant={variant}>
                  The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
                </Text>
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* All variants */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="All variants" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {textVariants.map(({ variant, label, desc }) => (
            <div key={variant} className="grid grid-cols-5 items-baseline gap-8 py-5">
              <Stack vertical className="gap-0.5">
                <Text as="code" variant="mono">
                  {label}
                </Text>
                <Text variant="caption">{desc}</Text>
              </Stack>
              <div className="col-span-4">
                <Text variant={variant}>The quick brown fox</Text>
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Props */}
      <Stack vertical gap={3}>
        <OrbitSectionHeader title="Props" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {props.map(({ name, type, default: def, desc }) => (
            <div key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" variant="mono">
                {name}
              </Text>
              <Text as="code" variant="mono" className="col-span-2">
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
