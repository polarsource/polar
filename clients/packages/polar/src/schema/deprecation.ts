import type { Builder, Mixin } from './builder'

export const deprecatedKey: unique symbol = Symbol.for(
  '~@polar-sh/polar/Deprecated',
)

export interface DeprecationBuilder {
  readonly [deprecatedKey]: boolean
  deprecated(): this
}

/**
 * Adds `.deprecated()` to a builder: the resource stays for customers who still
 * use it, but active resources can't reference it.
 */
export const withDeprecation = <Base extends Mixin<Builder>>(
  base: Base,
): Base & Mixin<DeprecationBuilder> => {
  abstract class WithDeprecation extends base implements DeprecationBuilder {
    readonly [deprecatedKey]: boolean = false

    deprecated(): this {
      return this.with({ [deprecatedKey]: true })
    }
  }
  return WithDeprecation
}
