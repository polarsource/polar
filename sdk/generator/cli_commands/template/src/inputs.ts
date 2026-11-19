import { Option, Schema } from 'effect'
import { Flag } from 'effect/cli'

export const nullableStringFlag = (name: string) =>
  Flag.String(name).pipe(Flag.map((value) => value === 'null' ? null : value))

export const jsonFlag = (name: string) =>
  Flag.String(name).pipe(
    Flag.mapTryCatch(
      (value): unknown => JSON.parse(value),
      () => `--${name} must contain valid JSON`,
    ),
  )

export const data = Flag.String('data').pipe(
  Flag.withAlias('d'),
  Flag.withSchema(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown))),
  Flag.optional,
  Flag.withDescription('JSON object; explicitly supplied flags override its top-level keys'),
)

export const confirm = Flag.Boolean('confirm').pipe(
  Flag.withAlias('c'),
  Flag.withDefault(false),
  Flag.withDescription('Skip the confirmation prompt for destructive requests'),
)

export const org = Flag.String('org').pipe(
  Flag.optional,
  Flag.map(Option.getOrUndefined),
  Flag.withDescription(
    'Organization ID or slug for this invocation only',
  ),
)

export const fields = Flag.String('fields').pipe(
  Flag.optional,
  Flag.withDescription(
    'Only print these fields, comma-separated; use dots for nested ones, e.g. id,name,prices.price_amount',
  ),
)

export const missingFlags = (
  input: object,
  required: ReadonlyArray<string>,
) =>
  required
    .filter((key) => (input as Record<string, unknown>)[key] === undefined)
    .map((key) => `--${key.replaceAll('_', '-')}`)

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

const splitList = (value: string): ReadonlyArray<string> => {
  if (value.trimStart().startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((item) => typeof item === 'string')
      ) {
        return parsed
      }
    } catch {
      return [value]
    }
  }
  const parts = value.split(',').map((part) => part.trim())
  return parts.length > 1 && parts.every((part) => UUID.test(part))
    ? parts
    : [value]
}

const expandLists = (value: unknown) =>
  Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === 'string' ? splitList(item) : [item],
      )
    : value

// The prototype validates flags and JSON syntax; full input validation remains server-side.
export const mergeInput = <A>(
  json: Option.Option<Record<string, unknown>>,
  fields: Record<string, Option.Option<unknown>>,
): A => {
  const provided = Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) =>
      Option.isSome(value) ? [[key, expandLists(value.value)]] : [],
    ),
  )
  return { ...Option.getOrElse(json, () => ({})), ...provided } as A
}
