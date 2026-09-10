import { Option } from 'effect'
import { Flag } from 'effect/unstable/cli'

export const jsonFlag = (name: string) =>
  Flag.string(name).pipe(
    Flag.mapTryCatch(
      (value): unknown => JSON.parse(value),
      () => `--${name} must contain valid JSON`,
    ),
  )

export const data = jsonFlag('data').pipe(
  Flag.withAlias('d'),
  Flag.mapTryCatch(
    (value): Record<string, unknown> => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Expected a JSON object')
      }
      return value as Record<string, unknown>
    },
    () => '--data must contain a JSON object',
  ),
  Flag.optional,
  Flag.withDescription(
    'JSON object; explicitly supplied flags override its top-level keys',
  ),
)

export const production = Flag.boolean('production').pipe(
  Flag.withDefault(false),
  Flag.withDescription('Use production instead of sandbox'),
)

export const confirm = Flag.boolean('confirm').pipe(
  Flag.withAlias('c'),
  Flag.withDefault(false),
  Flag.withDescription(
    'Confirm deletion (required for DELETE in this prototype)',
  ),
)

// The prototype validates flags and JSON syntax; full input validation remains server-side.
export const mergeInput = <A>(
  json: Option.Option<Record<string, unknown>>,
  fields: Record<string, Option.Option<unknown>>,
): A => {
  const provided = Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) =>
      Option.isSome(value) ? [[key, value.value]] : [],
    ),
  )
  return { ...Option.getOrElse(json, () => ({})), ...provided } as A
}
