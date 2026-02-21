'use client'

import { Box, Headline, Input } from '@/components/Orbit'
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
    <Box display="flex" flexDirection="column" className="gap-20">
      <OrbitPageHeader
        label="Component"
        title="Input"
        description="A unified input primitive with no rounded corners. Covers standard HTML input types, multi-line textarea, and a currency mode that handles decimal conversion, keyboard stepping, and zero-decimal currencies automatically."
      />

      {/* Standard types */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Standard types" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
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
                <code className="dark:text-polar-500 font-mono text-xs text-neutral-400">
                  type=&quot;{type}&quot;
                </code>
              </Box>
              <Box className="col-span-3">
                <Input type={type} placeholder={placeholder} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Prefix / suffix slots */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Prefix & Suffix" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Box className="col-span-2">
              <Headline as="h6" text="Prefix" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                URL scheme, unit label, icon
              </span>
            </Box>
            <Box display="flex" flexDirection="column" className="col-span-3 gap-3">
              <Input
                type="text"
                prefix="https://"
                placeholder="yourdomain.com"
              />
              <Input type="number" prefix="px" placeholder="16" />
            </Box>
          </Box>
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Box className="col-span-2">
              <Headline as="h6" text="Suffix" />
              <span className="dark:text-polar-500 text-xs text-neutral-400">
                Unit, format hint
              </span>
            </Box>
            <Box display="flex" flexDirection="column" className="col-span-3 gap-3">
              <Input type="number" suffix="%" placeholder="0" />
              <Input type="number" suffix="ms" placeholder="300" />
            </Box>
          </Box>
          <Box className="grid grid-cols-5 items-center gap-8 py-6">
            <Box className="col-span-2">
              <Headline as="h6" text="Both" />
            </Box>
            <Box className="col-span-3">
              <Input type="number" prefix="$" suffix="USD" placeholder="0.00" />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Currency */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader
          title="Currency"
          description={
            <>
              Values are stored and emitted in smallest currency units (cents
              for USD, whole units for JPY). Arrow keys step by{' '}
              <code className="font-mono">step</code> (default 0.1).
            </>
          }
        />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
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
        </Box>
      </Box>

      {/* Textarea */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="Textarea" />
        <Box className="grid grid-cols-5 items-start gap-8">
          <Box className="col-span-2">
            <Headline as="h6" text="Multiline" />
            <span className="dark:text-polar-500 text-xs text-neutral-400">
              Resizable vertically
            </span>
          </Box>
          <Box className="col-span-3">
            <Input type="textarea" placeholder="Write something…" rows={4} />
          </Box>
        </Box>
      </Box>

      {/* States */}
      <Box display="flex" flexDirection="column" gap={4}>
        <OrbitSectionHeader title="States" />
        <Box
          display="flex"
          flexDirection="column"
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
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
              <code className="dark:text-polar-200 font-mono text-sm text-neutral-800">
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
