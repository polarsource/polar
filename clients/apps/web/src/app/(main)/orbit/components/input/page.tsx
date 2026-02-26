'use client'

import { Headline, Input, Stack, Text } from '@polar-sh/orbit'
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
    <Stack vertical gap={10}>
      <OrbitPageHeader
        label="Component"
        title="Input"
        description="A unified input primitive with no rounded corners. Covers standard HTML input types, multi-line textarea, and a currency mode that handles decimal conversion, keyboard stepping, and zero-decimal currencies automatically."
      />

      {/* Standard types */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Standard types" />
        <Stack
          vertical
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
            <div
              key={type}
              className="grid grid-cols-5 items-center gap-8 py-6"
            >
              <div className="col-span-2">
                <Headline as="h6" text={label} />
                <Text as="code" variant="mono">
                  type=&quot;{type}&quot;
                </Text>
              </div>
              <div className="col-span-3">
                <Input type={type} placeholder={placeholder} />
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Prefix / suffix slots */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Prefix & Suffix" />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          <div className="grid grid-cols-5 items-center gap-8 py-6">
            <div className="col-span-2">
              <Headline as="h6" text="Prefix" />
              <Text as="span" variant="caption">
                URL scheme, unit label, icon
              </Text>
            </div>
            <Stack vertical gap={1} className="col-span-3">
              <Input
                type="text"
                prefix="https://"
                placeholder="yourdomain.com"
              />
              <Input type="number" prefix="px" placeholder="16" />
            </Stack>
          </div>
          <div className="grid grid-cols-5 items-center gap-8 py-6">
            <div className="col-span-2">
              <Headline as="h6" text="Suffix" />
              <Text as="span" variant="caption">
                Unit, format hint
              </Text>
            </div>
            <Stack vertical gap={1} className="col-span-3">
              <Input type="number" suffix="%" placeholder="0" />
              <Input type="number" suffix="ms" placeholder="300" />
            </Stack>
          </div>
          <div className="grid grid-cols-5 items-center gap-8 py-6">
            <div className="col-span-2">
              <Headline as="h6" text="Both" />
            </div>
            <div className="col-span-3">
              <Input type="number" prefix="$" suffix="USD" placeholder="0.00" />
            </div>
          </div>
        </Stack>
      </Stack>

      {/* Currency */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader
          title="Currency"
          description={
            <>
              Values are stored and emitted in smallest currency units (cents
              for USD, whole units for JPY). Arrow keys step by{' '}
              <Text as="code" variant="mono">
                step
              </Text>{' '}
              (default 0.1).
            </>
          }
        />
        <Stack
          vertical
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
            <div
              key={currency}
              className="grid grid-cols-5 items-center gap-8 py-6"
            >
              <div className="col-span-2">
                <Headline as="h6" text={label} />
              </div>
              <div className="col-span-3">
                <Input
                  type="currency"
                  currency={currency}
                  placeholder={placeholder}
                />
              </div>
            </div>
          ))}
        </Stack>
      </Stack>

      {/* Textarea */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="Textarea" />
        <div className="grid grid-cols-5 items-start gap-8">
          <div className="col-span-2">
            <Headline as="h6" text="Multiline" />
            <Text as="span" variant="caption">
              Resizable vertically
            </Text>
          </div>
          <div className="col-span-3">
            <Input type="textarea" placeholder="Write something…" rows={4} />
          </div>
        </div>
      </Stack>

      {/* States */}
      <Stack vertical gap={4}>
        <OrbitSectionHeader title="States" />
        <Stack
          vertical
          className="dark:divide-polar-800 divide-y divide-neutral-200"
        >
          <div className="grid grid-cols-5 items-center gap-8 py-6">
            <div className="col-span-2">
              <Headline as="h6" text="Disabled" />
            </div>
            <div className="col-span-3">
              <Input type="text" placeholder="Disabled field" disabled />
            </div>
          </div>
          <div className="grid grid-cols-5 items-center gap-8 py-6">
            <div className="col-span-2">
              <Headline as="h6" text="With value" />
            </div>
            <div className="col-span-3">
              <Input type="text" defaultValue="Polar Software Inc" readOnly />
            </div>
          </div>
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
