import { Schema } from 'effect'

export const Metadata = Schema.Record(
  Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(40)),
  Schema.Union([
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
    Schema.Finite,
    Schema.Boolean,
  ]),
).check(Schema.isMaxProperties(50))

export type Metadata = typeof Metadata.Type

export const metadataKey: unique symbol = Symbol.for(
  '~@polar-sh/polar/Metadata',
)

type Widen<Value> = Value extends string
  ? string
  : Value extends number
    ? number
    : boolean

export type MetadataShape<Values extends Metadata> = {
  readonly [Key in keyof Values]: Widen<Values[Key]>
}
