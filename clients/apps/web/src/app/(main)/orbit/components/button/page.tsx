'use client'

import { Box, Button, Headline } from '@/components/Orbit'
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
    <Box display="flex" flexDirection="column" className="gap-20">
      <OrbitPageHeader
        label="Component"
        title="Button"
        description={
          <>
            The primary interactive element. Four semantic variants, three
            sizes, and a built-in loading state. Always renders as a native{' '}
            <code className="font-mono text-sm">{'<button>'}</code>.
          </>
        }
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
            <Box key={variant} className="grid grid-cols-5 items-center gap-8 py-6">
              <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
                <Headline as="h6" text={label} />
                <span className="dark:text-polar-500 text-xs text-neutral-400">
                  {desc}
                </span>
              </Box>
              <Box display="flex" alignItems="center" className="col-span-3 gap-3">
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
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Sizes */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Sizes" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
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
              <Box display="flex" flexDirection="column" className="col-span-2 gap-1">
                <Headline as="h6" text={label} />
                <span className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                  {height}
                </span>
                <span className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                  {px}
                </span>
              </Box>
              <Box display="flex" alignItems="end" className="col-span-3 gap-3">
                <Button size={size}>Label</Button>
                <Button size={size} variant="secondary">
                  Label
                </Button>
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
              <code className="dark:text-polar-200 col-span-1 font-mono text-sm text-neutral-800">
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
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
