import { SchemaError } from './error'
import type { Filter } from './filter'
import type { Money } from './money'
import type { Aggregation, Usage } from './usage'

export type MeterUnit = 'scalar' | 'token' | 'custom'

interface MeterBase<Key extends string> {
  readonly kind: 'meter'
  readonly key: Key
  readonly name: string
  readonly filter: Filter
  readonly aggregation: Aggregation
  readonly price: Money
}

export type MeterDef<Key extends string = string> =
  | (MeterBase<Key> & { readonly unit: 'scalar' | 'token' })
  | (MeterBase<Key> & {
      readonly unit: 'custom'
      readonly customLabel: string
      readonly customMultiplier?: number
    })

interface MeterCommonOptions {
  readonly name: string
  readonly usage: Usage
  readonly price: Money
}

export type MeterOptions = MeterCommonOptions &
  (
    | {
        readonly unit?: 'scalar' | 'token'
        readonly customLabel?: never
        readonly customMultiplier?: never
      }
    | {
        readonly unit: 'custom'
        readonly customLabel: string
        readonly customMultiplier?: number
      }
  )

export function meter<const Key extends string>(
  key: Key,
  options: MeterOptions,
): MeterDef<Key> {
  const {
    name,
    usage: { filter, aggregation },
    price,
    unit = 'scalar',
    customLabel,
    customMultiplier,
  } = options
  if (key === '') throw new SchemaError('meter', 'key is empty')
  if (codePointLength(name) < 3) {
    throw new SchemaError('meter', 'name must be at least 3 characters')
  }
  if (unit !== 'scalar' && unit !== 'token' && unit !== 'custom') {
    throw new SchemaError('meter', `unknown unit ${unit}`)
  }

  const defined = {
    kind: 'meter' as const,
    key,
    name,
    filter,
    aggregation,
    price,
  }

  if (unit === 'custom') {
    if (customLabel === undefined || customLabel === '') {
      throw new SchemaError(
        'meter',
        'custom label is required when unit is custom',
      )
    }
    if (
      customMultiplier !== undefined &&
      (!Number.isSafeInteger(customMultiplier) || customMultiplier <= 0)
    ) {
      throw new SchemaError(
        'meter',
        `custom multiplier must be a positive integer, got ${customMultiplier}`,
      )
    }
    return {
      ...defined,
      unit,
      customLabel,
      ...(customMultiplier !== undefined ? { customMultiplier } : {}),
    }
  }

  if (customLabel !== undefined || customMultiplier !== undefined) {
    throw new SchemaError(
      'meter',
      'custom label and multiplier are only allowed when unit is custom',
    )
  }
  return { ...defined, unit }
}

function codePointLength(value: string): number {
  return Array.from(value).length
}
