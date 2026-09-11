import { Option, Schema } from 'effect'
import { Flag } from 'effect/unstable/cli'

export const jsonFlag = (name: string) =>
  Flag.string(name).pipe(
    Flag.mapTryCatch(
      (value): unknown => JSON.parse(value),
      () => `--${name} must contain valid JSON`,
    ),
  )

export const data = Flag.string('data').pipe(
  Flag.withAlias('d'),
  Flag.withSchema(
    Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
  ),
  Flag.optional,
  Flag.withDescription(
    'JSON object; explicitly supplied flags override its top-level keys',
  ),
)

export const confirm = Flag.boolean('confirm').pipe(
  Flag.withAlias('c'),
  Flag.withDefault(false),
  Flag.withDescription('Skip the confirmation prompt for destructive requests'),
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
