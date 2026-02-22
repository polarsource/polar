import { Box, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

const variants: { variant: 'default' | 'subtle' | 'disabled'; label: string; desc: string }[] = [
  {
    variant: 'default',
    label: 'Default',
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

const fontSizes: { size: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl'; px: string }[] = [
  { size: 'xs', px: '12px' },
  { size: 'sm', px: '14px' },
  { size: 'base', px: '16px' },
  { size: 'lg', px: '18px' },
  { size: 'xl', px: '20px' },
  { size: '2xl', px: '24px' },
  { size: '3xl', px: '30px' },
]

const fontWeights: { weight: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'; value: string }[] = [
  { weight: 'light', value: '300' },
  { weight: 'normal', value: '400' },
  { weight: 'medium', value: '500' },
  { weight: 'semibold', value: '600' },
  { weight: 'bold', value: '700' },
]

const leadings: { leading: 'none' | 'tight' | 'snug' | 'normal' | 'relaxed' | 'loose'; value: string }[] = [
  { leading: 'none', value: '1' },
  { leading: 'tight', value: '1.25' },
  { leading: 'snug', value: '1.375' },
  { leading: 'normal', value: '1.5' },
  { leading: 'relaxed', value: '1.625' },
  { leading: 'loose', value: '2' },
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
    type: "'default' | 'subtle' | 'disabled'",
    default: "'default'",
    desc: 'Color intent. Maps to an Orbit color token — never a raw Tailwind color class.',
  },
  {
    name: 'fontSize',
    type: "'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl'",
    default: '—',
    desc: 'Font size token. Omit to inherit from context.',
  },
  {
    name: 'fontWeight',
    type: "'light' | 'normal' | 'medium' | 'semibold' | 'bold'",
    default: '—',
    desc: 'Font weight token. Omit to inherit from context.',
  },
  {
    name: 'leading',
    type: "'none' | 'tight' | 'snug' | 'normal' | 'relaxed' | 'loose'",
    default: '—',
    desc: 'Line height token. Use relaxed for body copy, tight for labels and captions.',
  },
  {
    name: 'tracking',
    type: "'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest'",
    default: '—',
    desc: 'Letter spacing token.',
  },
  {
    name: 'transform',
    type: "'uppercase' | 'lowercase' | 'capitalize'",
    default: '—',
    desc: 'Text transform token.',
  },
  {
    name: 'fontFamily',
    type: "'sans' | 'mono'",
    default: '—',
    desc: 'Font family token. Use mono for code, numeric values, and technical labels.',
  },
  {
    name: 'tabular',
    type: 'boolean',
    default: '—',
    desc: 'Enables tabular-nums for numeric alignment in tables and lists.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Additional classes merged via twMerge. Use sparingly — prefer token props.',
  },
]

export default function TextPage() {
  return (
    <Box display="flex" flexDirection="column" className="gap-20">
      <OrbitPageHeader
        label="Component"
        title="Text"
        description="The standard primitive for rendering body copy, labels, captions, and any non-heading text. Color is always resolved from an Orbit token — never a raw class — and all typographic properties are constrained to the defined token set."
      />

      {/* Variants */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Variants" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {variants.map(({ variant, label, desc }) => (
            <Box key={variant} className="grid grid-cols-5 items-start gap-8 py-6">
              <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
                <Text fontWeight="medium" fontSize="sm">{label}</Text>
                <Text variant="subtle" fontSize="xs">{desc}</Text>
              </Box>
              <Box className="col-span-3">
                <Text variant={variant} fontSize="sm" leading="relaxed">
                  The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Font size */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Font Size" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {fontSizes.map(({ size, px }) => (
            <Box key={size} className="grid grid-cols-5 items-baseline gap-8 py-5">
              <Box display="flex" flexDirection="column" className="gap-0.5">
                <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                  {size}
                </Text>
                <Text variant="subtle" fontSize="xs">{px}</Text>
              </Box>
              <Box className="col-span-4">
                <Text fontSize={size}>The quick brown fox</Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Font weight */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Font Weight" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {fontWeights.map(({ weight, value }) => (
            <Box key={weight} className="grid grid-cols-5 items-baseline gap-8 py-5">
              <Box display="flex" flexDirection="column" className="gap-0.5">
                <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                  {weight}
                </Text>
                <Text variant="subtle" fontSize="xs">{value}</Text>
              </Box>
              <Box className="col-span-4">
                <Text fontWeight={weight} fontSize="lg">The quick brown fox</Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Leading */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Leading" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          {leadings.map(({ leading, value }) => (
            <Box key={leading} className="grid grid-cols-5 items-start gap-8 py-5">
              <Box display="flex" flexDirection="column" className="gap-0.5">
                <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                  {leading}
                </Text>
                <Text variant="subtle" fontSize="xs">{value}</Text>
              </Box>
              <Box className="col-span-4">
                <Text leading={leading} fontSize="sm">
                  The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
                </Text>
              </Box>
            </Box>
          ))}
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
              <Text as="code" fontFamily="mono" fontSize="sm">
                {name}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs" className="col-span-2">
                {type}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                {def}
              </Text>
              <Text variant="subtle" fontSize="xs">{desc}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
