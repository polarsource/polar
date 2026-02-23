import { Schema } from 'effect'

export const TokenType = Schema.Literal(
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'string',
  'shadow',
  'gradient',
)

export const RawToken = Schema.Struct({
  $value: Schema.Union(Schema.String, Schema.Number),
  $type: Schema.optional(TokenType),
  $description: Schema.optional(Schema.String),
})

// A token group is a record of string keys to either tokens or nested groups.
// We validate it as a record of unknown values, then do deeper validation at resolution time.
export const TokenGroupSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})

export type TokenTypeEncoded = Schema.Schema.Encoded<typeof TokenType>
export type RawTokenEncoded = Schema.Schema.Encoded<typeof RawToken>
