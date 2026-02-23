'use client'

import { Box, Button, Headline, Stack, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

const variants = [
  {
    variant: 'primary',
    label: 'Default',
    desc: 'Primary actions. Use once per view.',
  },
  {
    variant: 'secondary',
    label: 'Secondary',
    desc: 'Supporting actions alongside a primary.',
  },
  {
    variant: 'ghost',
    label: 'Ghost',
    desc: 'Low-emphasis actions in toolbars or lists.',
  },
  {
    variant: 'destructive',
    label: 'Destructive',
    desc: 'Irreversible actions. Always confirm.',
  },
] as const

const props = [
  {
    name: 'variant',
    type: "'primary' | 'secondary' | 'ghost' | 'destructive'",
    default: "'primary'",
    desc: 'Visual style',
  },
  {
    name: 'size',
    type: "'sm' | 'default' | 'lg' | 'icon'",
    default: "'default'",
    desc: 'Height and padding scale',
  },
  {
    name: 'loading',
    type: 'boolean',
    default: 'false',
    desc: 'Replaces content with a spinner; disables interaction',
  },
  {
    name: 'fullWidth',
    type: 'boolean',
    default: 'false',
    desc: 'Expands to fill container width',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    desc: 'Disables interaction and dims the button',
  },
  {
    name: 'wrapperClassName',
    type: 'string',
    default: '—',
    desc: 'Classes applied to the inner content wrapper',
  },
]

export default function ButtonPage() {
  return (
    <Stack gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Button"
        description={
          <>
            The primary interactive element. Four semantic variants, three
            sizes, and a built-in loading state. Always renders as a native{' '}
            <Text as="code" fontFamily="mono" fontSize="sm">{'<button>'}</Text>.
          </>
        }
      />

      {/* Variants */}
      <Stack gap={4}>
        <OrbitSectionHeader title="Variants" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {variants.map(({ variant, label, desc }) => (
            <Box key={variant} className="grid grid-cols-5 items-center gap-8 py-6">
              <Stack className="col-span-2 gap-1">
                <Headline as="h6" text={label} />
                <Text as="span" variant="subtle" fontSize="xs">
                  {desc}
                </Text>
              </Stack>
              <Stack horizontal alignItems="center" gap={1.5} className="col-span-3">
                <Button variant={variant} size="lg">
                  Action
                </Button>
                <Button variant={variant}>Action</Button>
                <Button variant={variant} size="sm">
                  Action
                </Button>
                <Button variant={variant} loading>
                  Action
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Sizes */}
      <Stack gap={4}>
        <OrbitSectionHeader title="Sizes" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {(
            [
              { size: 'lg', label: 'Large', height: 'h-12 / 48px', px: 'px-5' },
              {
                size: 'default',
                label: 'Default',
                height: 'h-10 / 40px',
                px: 'px-4',
              },
              { size: 'sm', label: 'Small', height: 'h-8 / 32px', px: 'px-3' },
            ] as const
          ).map(({ size, label, height, px }) => (
            <Box key={size} className="grid grid-cols-5 items-center gap-8 py-6">
              <Stack className="col-span-2 gap-1">
                <Headline as="h6" text={label} />
                <Text as="span" variant="subtle" fontFamily="mono" fontSize="xs">
                  {height}
                </Text>
                <Text as="span" variant="subtle" fontFamily="mono" fontSize="xs">
                  {px}
                </Text>
              </Stack>
              <Stack horizontal alignItems="end" gap={1.5} className="col-span-3">
                <Button size={size}>Label</Button>
                <Button size={size} variant="secondary">
                  Label
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Props */}
      <Stack gap={3}>
        <OrbitSectionHeader title="Props" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {props.map(({ name, type, default: def, desc }) => (
            <Box key={name} className="grid grid-cols-5 gap-4 py-4">
              <Text as="code" fontFamily="mono" fontSize="sm" className="col-span-1">
                {name}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs" className="col-span-2">
                {type}
              </Text>
              <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                {def}
              </Text>
              <Text variant="subtle" fontSize="xs">
                {desc}
              </Text>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
