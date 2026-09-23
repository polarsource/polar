import { Input, Text, TextArea } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { useId } from 'react'
import type { Definition } from './diff'

export type EditableKind = 'products' | 'meters'

export const DefinitionFields = ({
  kind,
  value,
  onChange,
}: {
  kind: EditableKind
  value: Definition
  onChange: (value: Definition) => void
}) => {
  const id = useId()
  const product = kind === 'products'
  const price = value.price as Record<string, unknown>
  const fields: {
    key: string
    label: string
    required?: boolean
    multiline?: boolean
    number?: boolean
  }[] = product
    ? [
        { key: 'name', label: 'Name', required: true },
        { key: 'description', label: 'Description', multiline: true },
        { key: 'amount', label: 'Price', number: true, required: true },
        { key: 'currency', label: 'Currency', required: true },
      ]
    : [
        {
          key: 'unit_amount',
          label: 'Unit price',
          number: true,
          required: true,
        },
        { key: 'currency', label: 'Currency', required: true },
        { key: 'reducer', label: 'Usage reducer', required: true },
        { key: 'credit_reducer', label: 'Credit reducer (optional)' },
      ]
  return (
    <Box flexDirection="column" rowGap="l">
      {fields.map((field) => {
        const nested = product && ['amount', 'currency'].includes(field.key)
        const current = (nested ? price : value)[field.key]
        const update = (text: string) => {
          const next = field.key === 'currency' ? text.toLowerCase() : text
          onChange(
            nested
              ? { ...value, price: { ...price, [field.key]: next } }
              : {
                  ...value,
                  [field.key]:
                    !next &&
                    ['description', 'credit_reducer'].includes(field.key)
                      ? null
                      : next,
                },
          )
        }
        return (
          <Box key={field.key} flexDirection="column" rowGap="s">
            <Text as="label" htmlFor={`${id}-${field.key}`}>
              {field.label}
            </Text>
            {field.multiline ? (
              <TextArea
                id={`${id}-${field.key}`}
                value={String(current ?? '')}
                onChange={(e) => update(e.target.value)}
              />
            ) : (
              <Input
                id={`${id}-${field.key}`}
                value={String(current ?? '')}
                onChange={(e) => update(e.target.value)}
                required={field.required}
                type={field.number ? 'number' : 'text'}
                min={field.number ? 0 : undefined}
                step={field.number ? 'any' : undefined}
                minLength={field.key === 'currency' ? 3 : undefined}
                maxLength={field.key === 'currency' ? 3 : undefined}
              />
            )}
          </Box>
        )
      })}
      <Text variant="caption" color="muted">
        Prices are in currency units (for example, 20 means $20 in USD).
      </Text>
    </Box>
  )
}
