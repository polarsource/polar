'use client'

import { Button, Headline, Stack, Text } from '@polar-sh/orbit'
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
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Button"
        description={
          <>
            The primary interactive element. Four semantic variants, three
            sizes, and a built-in loading state. Always renders as a native{' '}
            <Text as="code" variant="mono">{'<button>'}</Text>.
          </>
        }
      />

      {/* Variants */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Variants" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
          {variants.map(({ variant, label, desc }) => (
            <div key={variant} className="grid grid-cols-5 items-center gap-8 py-6">
              <Stack vertical className="col-span-2 gap-1">
                <Headline as="h6" text={label} />
                <Text as="span" variant="caption">
                  {desc}
                </Text>
              </Stack>
              <Stack alignItems="center" gap={1} className="col-span-3">
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
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Sizes */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Sizes" />
        <Stack vertical className="dark:divide-polar-800 divide-y divide-neutral-200">
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
            <div key={size} className="grid grid-cols-5 items-center gap-8 py-6">
              <Stack vertical className="col-span-2 gap-1">
                <Headline as="h6" text={label} />
                <Text as="span" variant="mono">
                  {height}
                </Text>
                <Text as="span" variant="mono">
                  {px}
                </Text>
              </Stack>
              <Stack alignItems="end" gap={1} className="col-span-3">
                <Button size={size}>Label</Button>
                <Button size={size} variant="secondary">
                  Label
                </Button>
              </Stack>
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
              <Text as="code" variant="mono" className="col-span-1">
                {name}
              </Text>
              <Text as="code" variant="mono" className="col-span-2">
                {type}
              </Text>
              <Text as="code" variant="mono">
                {def}
              </Text>
              <Text variant="caption">
                {desc}
              </Text>
            </div>
          ))}
        </Stack>
      </Stack>
    </Stack>
  )
}
