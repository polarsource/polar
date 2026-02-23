'use client'

import { Box, Headline, Input, Stack, Text } from '@polar-sh/orbit'
import { OrbitPageHeader, OrbitSectionHeader } from '../../OrbitPageHeader'

const props = [
  {
    name: 'type',
    type: "'text' | 'email' | 'password' | 'number' | 'search' | 'currency' | 'textarea' | …",
    default: "'text'",
    desc: "Determines rendering mode. 'currency' and 'textarea' activate dedicated sub-renderers.",
  },
  {
    name: 'prefix',
    type: 'ReactNode',
    default: '—',
    desc: 'Rendered as an adjacent bordered block to the left of the field.',
  },
  {
    name: 'suffix',
    type: 'ReactNode',
    default: '—',
    desc: 'Rendered as an adjacent bordered block to the right of the field.',
  },
  {
    name: 'currency',
    type: 'string',
    default: '—',
    desc: "Required when type='currency'. ISO 4217 code (e.g. 'USD', 'JPY'). Used as default prefix label and to determine decimal behaviour.",
  },
  {
    name: 'value',
    type: 'number | null',
    default: '—',
    desc: 'Currency mode: value in smallest currency unit (cents for USD). onChange receives the same unit.',
  },
  {
    name: 'step',
    type: 'number',
    default: '0.1',
    desc: 'Currency mode: amount added/subtracted per ↑/↓ keypress.',
  },
]

export default function InputPage() {
  return (
    <Stack gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Input"
        description="A unified input primitive with no rounded corners. Covers standard HTML input types, multi-line textarea, and a currency mode that handles decimal conversion, keyboard stepping, and zero-decimal currencies automatically."
      />

      {/* Standard types */}
      <Stack gap={4}>
        <OrbitSectionHeader title="Standard types" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {(
            [
              { label: 'Text', type: 'text', placeholder: 'Plain text…' },
              { label: 'Email', type: 'email', placeholder: 'you@example.com' },
              { label: 'Password', type: 'password', placeholder: '••••••••' },
              { label: 'Number', type: 'number', placeholder: '0' },
              { label: 'Search', type: 'search', placeholder: 'Search…' },
            ] as const
          ).map(({ label, type, placeholder }) => (
            <Box
              key={type}
              className="grid grid-cols-5 items-center gap-8 py-6"
            >
              <Box className="col-span-2">
                <Headline as="h6" text={label} />
                <Text as="code" variant="subtle" fontFamily="mono" fontSize="xs">
                  type=&quot;{type}&quot;
                </Text>
              </Box>
              <Box className="col-span-3">
                <Input type={type} placeholder={placeholder} />
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Prefix / suffix slots */}
      <Stack gap={4}>
        <OrbitSectionHeader title="Prefix & Suffix" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Box className="col-span-2">
              <Headline as="h6" text="Prefix" />
              <Text as="span" variant="subtle" fontSize="xs">
                URL scheme, unit label, icon
              </Text>
            </Box>
            <Stack gap={1.5} className="col-span-3">
              <Input
                type="text"
                prefix="https://"
                placeholder="yourdomain.com"
              />
              <Input type="number" prefix="px" placeholder="16" />
            </Stack>
          </Box>
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Box className="col-span-2">
              <Headline as="h6" text="Suffix" />
              <Text as="span" variant="subtle" fontSize="xs">
                Unit, format hint
              </Text>
            </Box>
            <Stack gap={1.5} className="col-span-3">
              <Input type="number" suffix="%" placeholder="0" />
              <Input type="number" suffix="ms" placeholder="300" />
            </Stack>
          </Box>
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Box className="col-span-2">
              <Headline as="h6" text="Both" />
            </Box>
            <Box className="col-span-3">
              <Input type="number" prefix="$" suffix="USD" placeholder="0.00" />
            </Box>
          </Box>
        </Stack>
      </Stack>

      {/* Currency */}
      <Stack gap={4}>
        <OrbitSectionHeader
          title="Currency"
          description={
            <>
              Values are stored and emitted in smallest currency units (cents
              for USD, whole units for JPY). Arrow keys step by{' '}
              <Text as="code" fontFamily="mono" fontSize="sm">step</Text> (default 0.1).
            </>
          }
        />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          {(
            [
              { currency: 'USD', placeholder: 1000, label: 'Decimal — USD' },
              { currency: 'EUR', placeholder: 1000, label: 'Decimal — EUR' },
              {
                currency: 'JPY',
                placeholder: 1000,
                label: 'Zero-decimal — JPY',
              },
            ] as const
          ).map(({ currency, placeholder, label }) => (
            <Box
              key={currency}
              className="grid grid-cols-5 items-center gap-8 py-6"
            >
              <Box className="col-span-2">
                <Headline as="h6" text={label} />
              </Box>
              <Box className="col-span-3">
                <Input
                  type="currency"
                  currency={currency}
                  placeholder={placeholder}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </Stack>

      {/* Textarea */}
      <Stack gap={4}>
        <OrbitSectionHeader title="Textarea" />
        <Box className="grid grid-cols-5 items-start gap-8">
          <Box className="col-span-2">
            <Headline as="h6" text="Multiline" />
            <Text as="span" variant="subtle" fontSize="xs">
              Resizable vertically
            </Text>
          </Box>
          <Box className="col-span-3">
            <Input type="textarea" placeholder="Write something…" rows={4} />
          </Box>
        </Box>
      </Stack>

      {/* States */}
      <Stack gap={4}>
        <OrbitSectionHeader title="States" />
        <Stack className="dark:divide-polar-800 divide-y divide-neutral-200">
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Box className="col-span-2">
              <Headline as="h6" text="Disabled" />
            </Box>
            <Box className="col-span-3">
              <Input type="text" placeholder="Disabled field" disabled />
            </Box>
          </Box>
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Box className="col-span-2">
              <Headline as="h6" text="With value" />
            </Box>
            <Box className="col-span-3">
              <Input type="text" defaultValue="Polar Software Inc" readOnly />
            </Box>
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
