import type { Builder, Mixin } from './builder'

export const deprecatedKey: unique symbol = Symbol.for(
  '~@polar-sh/polar/Deprecated',
)

export type HasDeprecation = {
  readonly [deprecatedKey]?: boolean | undefined
}

/** Type-only marker left by `.deprecated()`, so configs can check references. */
export type Deprecated = {
  readonly [deprecatedKey]: true
}

export interface DeprecationBuilder {
  readonly [deprecatedKey]: boolean
  deprecated(): this & Deprecated
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

    deprecated(): this & Deprecated {
      return this.with<this & Deprecated>({ [deprecatedKey]: true })
    }
  }
  return WithDeprecation
}
