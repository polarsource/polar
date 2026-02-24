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

export const ColorSpace = Schema.Literal('srgb', 'display-p3', 'hsl', 'oklch')

export const ColorValue = Schema.Struct({
  colorSpace: ColorSpace,
  components: Schema.Array(Schema.Number),
  alpha: Schema.optional(Schema.Number),
  hex: Schema.optional(Schema.String),
})

export const DimensionValue = Schema.Struct({
  value: Schema.Number,
  unit: Schema.String,
})

export const RawToken = Schema.Struct({
  value: Schema.Union(Schema.String, Schema.Number, ColorValue, DimensionValue),
  type: Schema.optional(TokenType),
  category: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  themes: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, ColorValue, DimensionValue),
    }),
  ),
  breakpoints: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, ColorValue, DimensionValue),
    }),
  ),
})

export const TokenDocumentGlobal = Schema.Struct({
  type: Schema.optional(TokenType),
  category: Schema.optional(Schema.String),
})

export const TokenDocumentSchema = Schema.Struct({
  props: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),
  imports: Schema.Array(Schema.String),
  global: Schema.optional(TokenDocumentGlobal),
})

// A token group is a record of string keys to either tokens or nested groups.
// We validate it as a record of unknown values, then do deeper validation at resolution time.
export const TokenGroupSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})

export type TokenTypeEncoded = Schema.Schema.Encoded<typeof TokenType>
export type RawTokenEncoded = Schema.Schema.Encoded<typeof RawToken>
export type TokenDocumentEncoded = Schema.Schema.Encoded<typeof TokenDocumentSchema>
