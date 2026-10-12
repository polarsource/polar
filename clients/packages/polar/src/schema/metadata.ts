import { Schema } from 'effect'
import type { Builder, Mixin } from './builder'

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

declare const declaredMetadata: unique symbol

/** Type-only record of the values passed to `.metadata()`. */
export type DeclaredMetadata<Values extends Metadata> = {
  readonly [declaredMetadata]: Values
}

export type HasMetadata = {
  readonly [metadataKey]?: Metadata | undefined
}

export interface MetadataBuilder {
  readonly [metadataKey]: Metadata | undefined
  metadata<const Values extends Metadata>(
    metadata: Values,
  ): this & DeclaredMetadata<Values>
}

/** Adds `.metadata()` to a builder. The declared values stay in its type. */
export const withMetadata = <Base extends Mixin<Builder>>(
  base: Base,
): Base & Mixin<MetadataBuilder> => {
  abstract class WithMetadata extends base implements MetadataBuilder {
    readonly [metadataKey]: Metadata | undefined = undefined

    metadata<const Values extends Metadata>(
      metadata: Values,
    ): this & DeclaredMetadata<Values> {
      return this.with<this & DeclaredMetadata<Values>>({
        [metadataKey]: { ...metadata },
      })
    }
  }
  return WithMetadata
}
