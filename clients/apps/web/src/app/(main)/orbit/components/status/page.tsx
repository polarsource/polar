import { Box, Stack, Status, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

const variants = [
  {
    variant: 'neutral',
    label: 'Neutral',
    desc: 'Default. Informational states with no semantic weight.',
  },
  {
    variant: 'success',
    label: 'Success',
    desc: 'Positive outcomes — completed, active, paid.',
  },
  {
    variant: 'warning',
    label: 'Warning',
    desc: 'Requires attention — pending, expiring, degraded.',
  },
  {
    variant: 'error',
    label: 'Error',
    desc: 'Failed or blocked states — declined, expired, failed.',
  },
  {
    variant: 'info',
    label: 'Info',
    desc: 'Neutral informational context — processing, scheduled.',
  },
] as const

const props = [
  {
    name: 'status',
    type: 'string',
    default: '—',
    desc: 'The label text rendered inside the badge.',
  },
  {
    name: 'variant',
    type: "'neutral' | 'success' | 'warning' | 'error' | 'info'",
    default: "'neutral'",
    desc: 'Color and semantic intent.',
  },
  {
    name: 'size',
    type: "'sm' | 'md'",
    default: "'md'",
    desc: 'Controls padding and font size.',
  },
  {
    name: 'className',
    type: 'string',
    default: '—',
    desc: 'Additional classes merged via twMerge.',
  },
]

export default function StatusPage() {
  return (
    <Stack gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Status"
        description="A compact badge for communicating state at a glance. Five semantic variants cover the full range of system states without reaching for color decoratively."
      />

      {/* Variants */}
      <Stack gap={4}>
        <OrbitSectionHeader title="Variants" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {variants.map(({ variant, label, desc }) => (
            <Box
              key={variant}
              className="grid grid-cols-5 items-center gap-8 py-6"
            >
              <Stack className="col-span-2 gap-1">
                <Text fontSize="sm" fontWeight="medium">
                  {label}
                </Text>
                <Text as="span" variant="subtle" fontSize="xs">
                  {desc}
                </Text>
              </Stack>
              <Stack horizontal alignItems="center" gap={1.5} className="col-span-3">
                {variant === 'neutral' && (
                  <>
                    <Status variant={variant} status="Draft" />
                    <Status variant={variant} status="Archived" />
                    <Status variant={variant} size="sm" status="On hold" />
                  </>
                )}
                {variant === 'success' && (
                  <>
                    <Status variant={variant} status="Paid" />
                    <Status variant={variant} status="Active" />
                    <Status variant={variant} size="sm" status="Refunded" />
                  </>
                )}
                {variant === 'warning' && (
                  <>
                    <Status variant={variant} status="Past due" />
                    <Status variant={variant} status="Expiring" />
                    <Status variant={variant} size="sm" status="Retrying" />
                  </>
                )}
                {variant === 'error' && (
                  <>
                    <Status variant={variant} status="Failed" />
                    <Status variant={variant} status="Declined" />
                    <Status variant={variant} size="sm" status="Cancelled" />
                  </>
                )}
                {variant === 'info' && (
                  <>
                    <Status variant={variant} status="Processing" />
                    <Status variant={variant} status="Scheduled" />
                    <Status variant={variant} size="sm" status="Pending" />
                  </>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Sizes */}
      <Stack gap={4}>
        <OrbitSectionHeader title="Sizes" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Stack className="col-span-2 gap-1">
              <Text fontSize="sm" fontWeight="medium">
                Medium
              </Text>
              <Text as="span" variant="subtle" fontFamily="mono" fontSize="xs">
                size=&quot;md&quot;
              </Text>
            </Stack>
            <Stack horizontal alignItems="center" gap={1.5} className="col-span-3">
              <Status status="Paid" variant="success" size="md" />
              <Status status="Past due" variant="warning" size="md" />
              <Status status="Declined" variant="error" size="md" />
            </Stack>
          </Box>
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Stack className="col-span-2 gap-1">
              <Text fontSize="sm" fontWeight="medium">
                Small
              </Text>
              <Text as="span" variant="subtle" fontFamily="mono" fontSize="xs">
                size=&quot;sm&quot;
              </Text>
            </Stack>
            <Stack horizontal alignItems="center" gap={1.5} className="col-span-3">
              <Status status="Paid" variant="success" size="sm" />
              <Status status="Past due" variant="warning" size="sm" />
              <Status status="Declined" variant="error" size="sm" />
            </Stack>
          </Box>
        </Stack>
      </Stack>

      {/* Props */}
      <Stack gap={3}>
        <OrbitSectionHeader title="Props" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
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
