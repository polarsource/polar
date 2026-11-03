import { Schema } from 'effect'
import type { Builder, Mixin } from './builder'

export const Visibility = Schema.Literals(['public', 'private'])

export type Visibility = typeof Visibility.Type

export const visibilityKey: unique symbol = Symbol.for(
  '~@polar-sh/polar/Visibility',
)

export type HasVisibility = {
  readonly [visibilityKey]?: Visibility | undefined
}

export interface VisibilityBuilder {
  readonly [visibilityKey]: Visibility
  private(): this
  public(): this
}

/** Adds `.private()` and `.public()` to a builder. Builders start public. */
export const withVisibility = <Base extends Mixin<Builder>>(
  base: Base,
): Base & Mixin<VisibilityBuilder> => {
  abstract class WithVisibility extends base implements VisibilityBuilder {
    readonly [visibilityKey]: Visibility = 'public'

    private(): this {
      return this.with({ [visibilityKey]: 'private' })
    }

    public(): this {
      return this.with({ [visibilityKey]: 'public' })
    }
  }
  return WithVisibility
}
