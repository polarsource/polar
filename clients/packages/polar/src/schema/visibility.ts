import { Schema } from 'effect'
import type { Builder, Mixin } from './builder'

export const Visibility = Schema.Literals(['public', 'private'])

export type Visibility = typeof Visibility.Type

export const visibilityKey: unique symbol = Symbol.for(
  '~@polar-sh/polar/Visibility',
)

export type Visible = {
  readonly [visibilityKey]?: Visibility | undefined
}

export interface VisibleBuilder {
  readonly [visibilityKey]: Visibility | undefined
  private(): this
  public(): this
}

/**
 * Adds `.private()` and `.public()` to a builder. Left unset, the server
 * applies its own default for the resource.
 */
export const visible = <Base extends Mixin<Builder>>(
  base: Base,
): Base & Mixin<VisibleBuilder> => {
  abstract class WithVisibility extends base implements VisibleBuilder {
    readonly [visibilityKey]: Visibility | undefined = undefined

    private(): this {
      return this.with({ [visibilityKey]: 'private' })
    }

    public(): this {
      return this.with({ [visibilityKey]: 'public' })
    }
  }
  return WithVisibility
}
